/**
 * Merge analysis for an incoming product export.
 *
 * Compares every row of one or more incoming CSVs against the catalog already
 * held in src/data/generated/catalog.json, and writes docs/MERGE-REPORT.md.
 *
 * This script never modifies the catalog. It only classifies, so a person can
 * decide what to import before anything is written.
 *
 * Matching, in order of confidence:
 *
 *   1. Exact SKU, when both sides have one. A SKU is a deliberate identifier,
 *      so an exact match is treated as the same product.
 *   2. Exact handle.
 *   3. Normalised handle or title comparison. This is reported as a possible
 *      match only and never merged automatically, because normalisation
 *      discards real distinctions.
 *
 * Size and count tokens survive normalisation. "100 g" and "500 g" are
 * different products, and collapsing them would silently merge two SKUs.
 *
 * Usage: node scripts/merge-report.ts <csv-path> [csv-path...]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");

/* ----------------------------- CSV parsing ------------------------------ */

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = input.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      /* handled by \n */
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toRecords(rows: string[][]): Record<string, string>[] {
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/* ---------------------------- normalisation ----------------------------- */

/**
 * Lowercase, strip punctuation, collapse whitespace. Digits and unit tokens are
 * preserved, so pack sizes remain distinguishing.
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const STOP = new Set(["the", "a", "an", "and", "for", "with", "of", "by", "to", "in", "plus"]);

function tokens(s: string): Set<string> {
  return new Set(normalise(s).split(" ").filter((t) => t && !STOP.has(t)));
}

/** Jaccard overlap of two token sets. */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Size and count tokens, which must agree before two rows can be one product. */
function sizeTokens(s: string): string[] {
  const out: string[] = [];
  for (const m of normalise(s).matchAll(/\b(\d+(?:\s?\d+)?)\s?(g|kg|ml|l|oz|lb|lbs|gram|grams|pack|packs|ct|count|gallon|gal|pk)\b/g)) {
    out.push(`${m[1]!.replace(/\s/g, "")}${m[2]}`);
  }
  return [...new Set(out)].sort();
}

/* ------------------------------- catalog -------------------------------- */

interface CatVariant { sku: string | null; priceCents: number; title: string }
interface CatProduct {
  handle: string;
  title: string;
  brandId: string;
  variants: CatVariant[];
  images: { src: string }[];
  description: string[];
  flags: string[];
  sources: { file: string; row: number }[];
}

const cat = JSON.parse(
  readFileSync(join(root, "src", "data", "generated", "catalog.json"), "utf8"),
) as { meta: { sources: string[] }; products: CatProduct[] };

const existing = cat.products;
const bySku = new Map<string, CatProduct>();
const byHandle = new Map<string, CatProduct>();
const byNormHandle = new Map<string, CatProduct[]>();
for (const p of existing) {
  byHandle.set(p.handle, p);
  for (const v of p.variants) if (v.sku) bySku.set(v.sku.trim().toLowerCase(), p);
  const n = normalise(p.handle);
  byNormHandle.set(n, [...(byNormHandle.get(n) ?? []), p]);
}
const existingTokens = existing.map((p) => ({ p, t: tokens(p.title) }));

/* ------------------------------ classify -------------------------------- */

type Verdict = "NEW" | "EXISTING_MATCH" | "POSSIBLE_DUPLICATE" | "CONFLICT" | "NEEDS_REVIEW";

interface Row {
  file: string;
  row: number;
  handle: string;
  title: string;
  vendor: string;
  sku: string | null;
  priceCents: number | null;
  verdict: Verdict;
  matchedOn: string;
  match: CatProduct | null;
  confidence: number | null;
  differences: { field: string; incoming: string; existing: string }[];
  gaps: string[];
}

const money = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

const csvPaths = process.argv.slice(2);
if (!csvPaths.length) {
  console.error("usage: node scripts/merge-report.ts <csv-path> [csv-path...]");
  process.exit(1);
}

const rows: Row[] = [];

for (const path of csvPaths) {
  const file = basename(path);
  const records = toRecords(parseCsv(readFileSync(path, "utf8")));

  records.forEach((r, i) => {
    const handle = r["Handle"] ?? "";
    const title = r["Title"] ?? "";
    const sku = r["Variant SKU"]?.trim() || null;
    const priceCents = money(r["Variant Price"] ?? "");
    const vendor = r["Vendor"]?.trim() ?? "";

    const gaps: string[] = [];
    if (!sku) gaps.push("no SKU");
    if (priceCents === null) gaps.push("no price");
    else if (priceCents === 0) gaps.push("price is 0.00");
    if (!r["Body (HTML)"]?.trim()) gaps.push("no description");
    if (!r["Image Src"]?.trim()) gaps.push("no image");
    if (!vendor) gaps.push("no vendor");

    const base: Row = {
      file, row: i + 2, handle, title, vendor, sku, priceCents,
      verdict: "NEW", matchedOn: "-", match: null, confidence: null,
      differences: [], gaps,
    };

    if (!handle || !title) {
      rows.push({ ...base, verdict: "NEEDS_REVIEW", matchedOn: "unusable row", gaps: [...gaps, "missing handle or title"] });
      return;
    }

    // 1. Exact SKU, when both sides carry one.
    let match: CatProduct | undefined;
    let matchedOn = "";
    if (sku) {
      match = bySku.get(sku.toLowerCase());
      if (match) matchedOn = "exact SKU";
    }
    // 2. Exact handle.
    if (!match) {
      match = byHandle.get(handle);
      if (match) matchedOn = "exact handle";
    }

    if (match) {
      // Compare the facts both sides state. A disagreement is a conflict, not
      // a merge decision this script is entitled to make.
      const diffs: Row["differences"] = [];
      const existingPrice = Math.min(...match.variants.map((v) => v.priceCents));
      if (priceCents !== null && priceCents !== existingPrice) {
        diffs.push({ field: "price", incoming: `${(priceCents / 100).toFixed(2)}`, existing: `${(existingPrice / 100).toFixed(2)}` });
      }
      if (normalise(title) !== normalise(match.title)) {
        diffs.push({ field: "title", incoming: title, existing: match.title });
      }
      const existingSku = match.variants.find((v) => v.sku)?.sku ?? null;
      if (sku && existingSku && sku.toLowerCase() !== existingSku.toLowerCase()) {
        diffs.push({ field: "sku", incoming: sku, existing: existingSku });
      }
      rows.push({
        ...base,
        verdict: diffs.length ? "CONFLICT" : "EXISTING_MATCH",
        matchedOn, match, confidence: 1, differences: diffs,
      });
      return;
    }

    // 3. Normalised comparison. Reported only, never merged.
    const nh = normalise(handle);
    const handleNear = byNormHandle.get(nh)?.[0];
    const incTokens = tokens(title);
    const incSizes = sizeTokens(`${title} ${handle}`);
    let best: { p: CatProduct; score: number } | null = null;
    for (const { p, t } of existingTokens) {
      const score = similarity(incTokens, t);
      if (!best || score > best.score) best = { p, score };
    }

    if (handleNear) {
      rows.push({ ...base, verdict: "POSSIBLE_DUPLICATE", matchedOn: "normalised handle", match: handleNear, confidence: 0.9 });
      return;
    }
    if (best && best.score >= 0.6) {
      // Different pack sizes are different products, however similar the words.
      const candSizes = sizeTokens(`${best.p.title} ${best.p.handle}`);
      const sizesAgree = incSizes.join("|") === candSizes.join("|");
      if (sizesAgree) {
        rows.push({ ...base, verdict: "POSSIBLE_DUPLICATE", matchedOn: "normalised title", match: best.p, confidence: Number(best.score.toFixed(2)) });
        return;
      }
    }

    // No match. New, unless the record is too incomplete to stand alone.
    const blocking = gaps.filter((g) => g === "no price" || g === "price is 0.00" || g === "no vendor");
    rows.push({
      ...base,
      verdict: blocking.length ? "NEEDS_REVIEW" : "NEW",
      matchedOn: "no match",
      confidence: best ? Number(best.score.toFixed(2)) : 0,
      match: blocking.length ? null : null,
    });
  });
}

/* -------------------------------- report -------------------------------- */

const by = (v: Verdict) => rows.filter((r) => r.verdict === v);
const L: string[] = [];
const w = (s = "") => L.push(s);

w("# Merge report");
w();
w("Analysis only. **The catalog has not been modified.**");
w();
w(`Incoming: ${csvPaths.map((p) => `\`${basename(p)}\``).join(", ")}`);
w(`Existing catalog: ${existing.length} products, from ${cat.meta.sources.map((s) => `\`${s}\``).join(", ")}`);
w();

w("## Verdicts");
w();
w("| Verdict | Rows | Meaning |");
w("|---|---:|---|");
w(`| NEW | ${by("NEW").length} | No match in the catalog. Safe to import. |`);
w(`| EXISTING_MATCH | ${by("EXISTING_MATCH").length} | Matched exactly, and every stated fact agrees. Nothing to import. |`);
w(`| CONFLICT | ${by("CONFLICT").length} | Matched exactly, but the two sources state different values. |`);
w(`| POSSIBLE_DUPLICATE | ${by("POSSIBLE_DUPLICATE").length} | Resembles an existing product. Needs a human decision. |`);
w(`| NEEDS_REVIEW | ${by("NEEDS_REVIEW").length} | Unmatched, but too incomplete to stand as a product. |`);
w(`| **Total incoming rows** | **${rows.length}** | |`);
w();

/* ---- file-level identity check, cheap and worth stating outright ---- */
const allMatched = rows.length > 0 && by("EXISTING_MATCH").length === rows.length;
if (allMatched) {
  w("> Every incoming row matched an existing product exactly, with no differing");
  w("> values. This export contains nothing the catalog does not already hold, so");
  w("> importing it would add no products and change no data.");
  w();
}

if (by("NEW").length) {
  w("## NEW");
  w();
  w("No SKU or handle match, and no close resemblance to an existing product.");
  w();
  w("| Row | Handle | Title | Vendor | Price | Gaps |");
  w("|---|---|---|---|---:|---|");
  for (const r of by("NEW")) {
    w(`| ${r.file}:${r.row} | \`${r.handle}\` | ${r.title.slice(0, 54)} | ${r.vendor} | ` +
      `${r.priceCents !== null ? `$${(r.priceCents / 100).toFixed(2)}` : "-"} | ${r.gaps.join(", ") || "none"} |`);
  }
  w();
}

if (by("CONFLICT").length) {
  w("## CONFLICT");
  w();
  w("Matched an existing product, but the sources disagree. Nothing is overwritten;");
  w("each of these needs a decision about which value is correct.");
  w();
  w("| Row | Product | Matched on | Field | Incoming | Existing |");
  w("|---|---|---|---|---|---|");
  for (const r of by("CONFLICT")) {
    for (const d of r.differences) {
      w(`| ${r.file}:${r.row} | \`${r.match?.handle}\` | ${r.matchedOn} | ${d.field} | ${d.incoming.slice(0, 40)} | ${d.existing.slice(0, 40)} |`);
    }
  }
  w();
}

if (by("POSSIBLE_DUPLICATE").length) {
  w("## POSSIBLE_DUPLICATE");
  w();
  w("Similar to an existing product under normalised comparison, but not an exact");
  w("SKU or handle match. **Never merged automatically.** Confirm each one.");
  w();
  w("| Row | Incoming handle | Resembles | Basis | Confidence |");
  w("|---|---|---|---|---:|");
  for (const r of by("POSSIBLE_DUPLICATE")) {
    w(`| ${r.file}:${r.row} | \`${r.handle}\` | \`${r.match?.handle}\` | ${r.matchedOn} | ${r.confidence} |`);
  }
  w();
}

if (by("NEEDS_REVIEW").length) {
  w("## NEEDS_REVIEW");
  w();
  w("| Row | Handle | Why |");
  w("|---|---|---|");
  for (const r of by("NEEDS_REVIEW")) {
    w(`| ${r.file}:${r.row} | \`${r.handle || "(none)"}\` | ${r.gaps.join(", ")} |`);
  }
  w();
}

if (by("EXISTING_MATCH").length) {
  w("## EXISTING_MATCH");
  w();
  const bySkuN = by("EXISTING_MATCH").filter((r) => r.matchedOn === "exact SKU").length;
  const byHandleN = by("EXISTING_MATCH").filter((r) => r.matchedOn === "exact handle").length;
  w(`${by("EXISTING_MATCH").length} rows already in the catalog, unchanged:`);
  w(`${bySkuN} matched on exact SKU, ${byHandleN} on exact handle.`);
  w();
  w("<details><summary>Full list</summary>");
  w();
  w("| Row | Handle | Matched on |");
  w("|---|---|---|");
  for (const r of by("EXISTING_MATCH")) {
    w(`| ${r.file}:${r.row} | \`${r.handle}\` | ${r.matchedOn} |`);
  }
  w();
  w("</details>");
  w();
}

w("## What happens on import");
w();
w("Only NEW rows would be added. EXISTING_MATCH rows are already held.");
w("CONFLICT, POSSIBLE_DUPLICATE and NEEDS_REVIEW rows are held back until each is");
w("confirmed, because resolving them would mean choosing between two stated facts");
w("or inventing one.");
w();

writeFileSync(join(root, "docs", "MERGE-REPORT.md"), `${L.join("\n")}\n`, "utf8");

console.log(`merge report written to docs/MERGE-REPORT.md  (catalog not modified)`);
console.log(`  incoming rows      ${rows.length}`);
console.log(`  NEW                ${by("NEW").length}`);
console.log(`  EXISTING_MATCH     ${by("EXISTING_MATCH").length}`);
console.log(`  CONFLICT           ${by("CONFLICT").length}`);
console.log(`  POSSIBLE_DUPLICATE ${by("POSSIBLE_DUPLICATE").length}`);
console.log(`  NEEDS_REVIEW       ${by("NEEDS_REVIEW").length}`);
