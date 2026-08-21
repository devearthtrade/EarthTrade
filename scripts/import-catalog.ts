/**
 * EarthTrade catalog importer.
 *
 * Reads a product export CSV and emits the canonical catalog record at
 * src/data/generated/catalog.json, plus a review report.
 *
 * Rules this script follows, in order of precedence:
 *
 *  1. Never invent a product fact. A missing price, SKU, image, description or
 *     category is recorded as missing and flagged, never filled in.
 *  2. Never publish copy that has not cleared docs/COMPLIANCE.md. Imported
 *     prose is screened paragraph by paragraph; anything matching the banned
 *     list is quarantined for human review rather than rendered.
 *  3. No third-party commerce dependency. Source identifiers are discarded and
 *     replaced with EarthTrade-native ids; images resolve to EarthTrade paths.
 *  4. Deterministic and re-runnable. Same input gives the same output, so the
 *     import can be repeated as assets and corrections land.
 *
 * Money is stored as integer cents, matching the commerce architecture.
 *
 * Multiple CSVs merge into one catalog. A product arriving twice is matched on
 * handle, then on SKU, and the records are folded together: gaps fill from the
 * later source, disagreements are recorded rather than resolved.
 *
 * Usage: node scripts/import-catalog.ts <csv-path> [csv-path...]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { screen } from "../src/lib/compliance.ts";

const root = join(fileURLToPath(import.meta.url), "..", "..");

/* ----------------------------- CSV parsing ------------------------------ */

/** RFC 4180 reader. Fields may contain commas, quotes and newlines. */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  // Strip a UTF-8 BOM so the first header name is not corrupted.
  if (input.charCodeAt(0) === 0xfeff) i = 1;

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
      /* handled by the \n branch */
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

/* --------------------------- text normalising --------------------------- */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", mdash: "-", ndash: "-",
  hellip: "...", trade: "™", reg: "®", deg: "°", times: "x",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Split product HTML into plain-text blocks, preserving list items. */
function htmlToBlocks(html: string): string[] {
  if (!html.trim()) return [];
  const withBreaks = html
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div|\/tr)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withBreaks)
    .split("\n")
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 1);
}

function titleCaseSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* --------------------------- compliance screen -------------------------- */

/*
 * The rule set lives in src/lib/compliance.ts so the importer and the future
 * Admin Dashboard screen copy identically. A product created by hand must not
 * be able to bypass what the importer enforces.
 */

/* ------------------------------- mapping -------------------------------- */

/** Vendor spellings that denote the same brand. */
const BRAND_BY_VENDOR: Record<string, string> = {
  "solutions hocl": "solutionshocl",
  solutionshocl: "solutionshocl",
  "life ionizers": "life-ionizers",
  lifeionizers: "life-ionizers",
  "pitcher of life": "pitcher-of-life",
  pitcheroflife: "pitcher-of-life",
  "hawaiian volcanic organic": "hawaiian-volcanic-organic",
  hawaiianvolcanicorganic: "hawaiian-volcanic-organic",
  "life sciences water": "life-sciences-water",
  lifescienceswater: "life-sciences-water",
};

/** Default merchandising category per brand. Overridden by TYPE_CATEGORY. */
const CATEGORY_BY_BRAND: Record<string, string> = {
  solutionshocl: "cleaning",
  "life-ionizers": "water",
  "pitcher-of-life": "water",
  "life-sciences-water": "water",
  "hawaiian-volcanic-organic": "gardening",
};

/** Product types that sit in a different category than their brand default. */
const TYPE_CATEGORY: { match: RegExp; category: string }[] = [
  { match: /copper water bottle|glass water bottle|copper water pitcher|infuser/i, category: "wellness" },
  { match: /book/i, category: "wellness" },
];

/** Source tags that denote the same collection. */
const COLLECTION_BY_TAG: Record<string, string> = {
  "pitcher of life": "pitcher-of-life",
  "pitcher of life with flower of life": "pitcher-of-life",
  "flower of life": "pitcher-of-life",
  "life ionizers": "life-ionizers",
  "solutions hocl": "solutionshocl",
  "hawaiian volcanic organic": "organic-gardening",
  "copper bottles": "wellness",
  "water systems": "water-filtration",
  "water pitchers": "water-filtration",
  accessories: "accessories",
  bundle: "bundles",
};

/* ------------------------------- records -------------------------------- */

interface ImportedVariant {
  id: string;
  title: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  weightGrams: number | null;
  requiresShipping: boolean;
  taxable: boolean;
  barcode: string | null;
}

interface PendingImage {
  path: string;
  alt: string | null;
  sourceUrl: string;
}

interface ProductSource {
  file: string;
  row: number;
  handle: string;
  sku: string | null;
}

interface ImportedProduct {
  handle: string;
  title: string;
  brandId: string;
  categoryId: string | null;
  collections: string[];
  sourceTags: string[];
  productType: string | null;
  shortBenefit: string | null;
  shortBenefitSource: string | null;
  description: string[];
  quarantinedContent: { text: string; matches: { reason: string; term: string }[] }[];
  images: { src: string; alt: string }[];
  pendingImages: PendingImage[];
  variants: ImportedVariant[];
  seo: { title: string | null; description: string | null };
  subscription: boolean;
  priceProvisional: boolean;
  inventoryKnown: boolean;
  publishable: boolean;
  titleMatches: { reason: string; term: string }[];
  status: "active" | "needs_review";
  flags: string[];
  /** Every source row this product was built from, in order of arrival. */
  sources: ProductSource[];
}

/** Stable EarthTrade-native id. Deterministic, carries no foreign identifier. */
function variantId(handle: string, optionValue: string): string {
  const h = createHash("sha256").update(`${handle}::${optionValue}`).digest("hex");
  return `etv_${h.slice(0, 16)}`;
}

function money(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/* -------------------------------- import -------------------------------- */

const csvPaths = process.argv.slice(2);
if (!csvPaths.length) {
  console.error("usage: node scripts/import-catalog.ts <csv-path> [csv-path...]");
  process.exit(1);
}

/** Every source row, tagged with the file it came from. */
const sourced: { file: string; row: number; r: Record<string, string> }[] = [];
for (const path of csvPaths) {
  const rows = toRecords(parseCsv(readFileSync(path, "utf8")));
  rows.forEach((r, i) => sourced.push({ file: basename(path), row: i + 2, r }));
}

// Assets already present locally are linked; the rest are reported as pending.
// The export names some files with an extension the uploaded asset does not
// use, so a same-stem file of a different type counts as the same image.
const assetDir = join(root, "public", "images");
const presentAssets = new Set(existsSync(assetDir) ? readdirSync(assetDir) : []);
const assetByStem = new Map<string, string>();
for (const f of presentAssets) {
  const stem = f.slice(0, f.length - extname(f).length);
  if (!assetByStem.has(stem)) assetByStem.set(stem, f);
}

/** Resolves a referenced filename to a file that actually exists. */
function localAsset(file: string): string | null {
  if (presentAssets.has(file)) return file;
  return assetByStem.get(file.slice(0, file.length - extname(file).length)) ?? null;
}

const products: ImportedProduct[] = [];
const skipped: { handle: string; reason: string; file?: string }[] = [];

/** Index for deduplication: handle first, then SKU. */
const byHandle = new Map<string, ImportedProduct>();
const bySku = new Map<string, ImportedProduct>();
const duplicates: {
  keptHandle: string;
  duplicateOf: string;
  matchedOn: "handle" | "sku";
  file: string;
  row: number;
  filled: string[];
  conflicts: { field: string; kept: string; ignored: string }[];
}[] = [];

for (const { file, row: sourceRow, r } of sourced) {
  const handle = r["Handle"];
  const title = r["Title"];

  if (!handle || !title) {
    skipped.push({ handle: handle || "(none)", reason: "missing handle or title", file });
    continue;
  }

  const flags: string[] = [];
  const vendor = (r["Vendor"] || "").trim();
  const brandId = BRAND_BY_VENDOR[vendor.toLowerCase()] ?? null;
  if (!brandId) {
    skipped.push({ handle, reason: `unrecognised vendor ${JSON.stringify(vendor)}` });
    continue;
  }

  const productType = r["Type"]?.trim() || null;
  if (!productType) flags.push("missing_type");

  let categoryId = CATEGORY_BY_BRAND[brandId] ?? null;
  for (const { match, category } of TYPE_CATEGORY) {
    if (productType && match.test(productType)) categoryId = category;
    else if (match.test(title)) categoryId = category;
  }
  if (!categoryId) flags.push("missing_category");
  if (!r["Product Category"]?.trim()) flags.push("missing_source_category");

  // Collections, normalised from source tags.
  const sourceTags = (r["Tags"] || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const collections = [
    ...new Set(
      sourceTags
        .map((t) => COLLECTION_BY_TAG[t.toLowerCase()])
        .filter((c): c is string => Boolean(c)),
    ),
  ];
  if (!collections.length) flags.push("no_collection_mapping");

  // A product name cannot be rewritten without misrepresenting the product, so
  // a title carrying a banned claim holds the whole record back for a human
  // decision instead of being quietly reworded.
  const titleMatches = screen(title, brandId);
  if (titleMatches.length) flags.push("title_not_publishable");

  // Copy: screened block by block. Clean blocks publish; matches quarantine.
  const blocks = htmlToBlocks(r["Body (HTML)"] || "");
  const description: string[] = [];
  const quarantinedContent: ImportedProduct["quarantinedContent"] = [];
  for (const b of blocks) {
    const matches = screen(b, brandId);
    if (matches.length) quarantinedContent.push({ text: b, matches });
    else description.push(b);
  }
  if (!blocks.length) flags.push("missing_description");
  if (quarantinedContent.length) flags.push("content_quarantined");
  if (blocks.length && !description.length) flags.push("all_content_quarantined");

  // Card line. Excerpted from supplied copy only, never written from scratch.
  const seoDescription = r["SEO Description"]?.trim() || null;
  let shortBenefit: string | null = null;
  let shortBenefitSource: string | null = null;
  if (seoDescription && !screen(seoDescription, brandId).length) {
    shortBenefit = seoDescription.length > 140 ? `${seoDescription.slice(0, 137).trimEnd()}...` : seoDescription;
    shortBenefitSource = "seo_description";
  } else if (description.length) {
    const first = description[0]!;
    shortBenefit = first.length > 140 ? `${first.slice(0, 137).trimEnd()}...` : first;
    shortBenefitSource = "first_clean_paragraph";
  } else {
    flags.push("missing_short_benefit");
  }

  // Images resolve to EarthTrade-served paths. Source hosts are never linked.
  const images: { src: string; alt: string }[] = [];
  const pendingImages: PendingImage[] = [];
  const altText = r["Image Alt Text"]?.trim() || null;
  if (!altText) flags.push("missing_image_alt");

  for (const col of ["Image Src", "Variant Image"]) {
    const url = r[col]?.trim();
    if (!url) continue;
    let file: string;
    try {
      file = decodeURIComponent(basename(new URL(url).pathname));
    } catch {
      continue;
    }
    if (!file || !extname(file)) continue;
    if (pendingImages.some((p) => p.sourceUrl === url)) continue;

    const local = localAsset(file);
    if (local) {
      images.push({ src: `/images/${local}`, alt: altText ?? title });
    } else {
      pendingImages.push({ path: `/images/${file}`, alt: altText, sourceUrl: url });
    }
  }
  if (!images.length && !pendingImages.length) flags.push("missing_image");
  else if (!images.length) flags.push("image_asset_pending");

  // Variant. This export carries a single variant row per product.
  const optionName = r["Option1 Name"]?.trim() || "Title";
  const optionValue = r["Option1 Value"]?.trim() || "Default Title";
  const priceCents = money(r["Variant Price"] || "");
  if (priceCents === null) flags.push("missing_price");
  if (priceCents === 0) flags.push("zero_price");

  const sku = r["Variant SKU"]?.trim() || null;
  if (!sku) flags.push("missing_sku");

  const grams = Number(r["Variant Grams"] || "");
  const weightGrams = Number.isFinite(grams) && grams > 0 ? Math.round(grams) : null;
  if (weightGrams === null) flags.push("missing_weight");

  const variant: ImportedVariant = {
    id: variantId(handle, optionValue),
    title: optionName === "Title" ? "Default Title" : optionValue,
    sku,
    priceCents: priceCents ?? 0,
    compareAtCents: money(r["Variant Compare At Price"] || ""),
    currency: "USD",
    weightGrams,
    requiresShipping: (r["Variant Requires Shipping"] || "").toLowerCase() !== "false",
    taxable: (r["Variant Taxable"] || "").toLowerCase() !== "false",
    barcode: r["Variant Barcode"]?.trim() || null,
  };

  // Auto-Ship is stated in the product's own name in this export. Reading it
  // is not the same as inventing a subscription option for products that do
  // not advertise one.
  const subscription = /\bauto[- ]?ship\b/i.test(title) || /auto-?ship/i.test(handle);

  // The export carries no stock quantities, so availability is unknown.
  flags.push("inventory_unknown");

  const seoTitle = r["SEO Title"]?.trim() || null;
  if (!seoTitle) flags.push("missing_seo_title");
  if (!seoDescription) flags.push("missing_seo_description");

  // A record is held from publication only when rendering it would state a
  // banned claim, or when it has no price to sell at. Everything else imports
  // and renders, flagged for correction.
  const withheld = ["title_not_publishable", "zero_price", "missing_price"];
  const reviewOnly = ["all_content_quarantined", "missing_description", "missing_image", "missing_short_benefit"];
  const publishable = !flags.some((f) => withheld.includes(f));
  const status = !publishable || flags.some((f) => reviewOnly.includes(f)) ? "needs_review" : "active";

  const candidate: ImportedProduct = {
    handle,
    title,
    brandId,
    categoryId,
    collections,
    sourceTags,
    productType,
    shortBenefit,
    shortBenefitSource,
    description,
    quarantinedContent,
    images,
    pendingImages,
    variants: [variant],
    seo: { title: seoTitle, description: seoDescription },
    subscription,
    priceProvisional: priceCents === null || priceCents === 0,
    inventoryKnown: false,
    publishable,
    titleMatches,
    status,
    flags: [...new Set(flags)].sort(),
    sources: [{ file, row: sourceRow, handle, sku }],
  };

  // Same product arriving from another file. Handle wins; SKU is the fallback
  // identity, since a second export may slug the same item differently.
  const existing = byHandle.get(handle) ?? (sku ? bySku.get(sku.toLowerCase()) : undefined);

  if (!existing) {
    products.push(candidate);
    byHandle.set(handle, candidate);
    if (sku) bySku.set(sku.toLowerCase(), candidate);
    continue;
  }

  mergeInto(existing, candidate, file, sourceRow, byHandle.has(handle) ? "handle" : "sku");
}

/**
 * Folds a later source into the record already held.
 *
 * Gaps are filled from the newer row, because that is real data the first
 * source simply lacked. A field that both sources supply with different values
 * is never overwritten: the first value stands and the disagreement is recorded
 * for a human, since choosing between two stated facts would be inventing one.
 */
function mergeInto(
  kept: ImportedProduct,
  incoming: ImportedProduct,
  file: string,
  row: number,
  matchedOn: "handle" | "sku",
): void {
  const filled: string[] = [];
  const conflicts: { field: string; kept: string; ignored: string }[] = [];

  const scalar = <K extends keyof ImportedProduct>(field: K, label = String(field)) => {
    const a = kept[field];
    const b = incoming[field];
    if (b === null || b === undefined || b === "") return;
    if (a === null || a === undefined || a === "") {
      kept[field] = b;
      filled.push(label);
    } else if (String(a) !== String(b)) {
      conflicts.push({ field: label, kept: String(a), ignored: String(b) });
    }
  };

  scalar("categoryId");
  scalar("productType");
  scalar("shortBenefit");
  if (kept.brandId !== incoming.brandId) {
    conflicts.push({ field: "brandId", kept: kept.brandId, ignored: incoming.brandId });
  }
  if (!kept.seo.title && incoming.seo.title) {
    kept.seo.title = incoming.seo.title;
    filled.push("seo.title");
  }
  if (!kept.seo.description && incoming.seo.description) {
    kept.seo.description = incoming.seo.description;
    filled.push("seo.description");
  }
  if (!kept.description.length && incoming.description.length) {
    kept.description = incoming.description;
    filled.push("description");
  }
  if (!kept.images.length && incoming.images.length) {
    kept.images = incoming.images;
    filled.push("images");
  }
  if (!kept.pendingImages.length && incoming.pendingImages.length) {
    kept.pendingImages = incoming.pendingImages;
  }

  // Collections and tags are additive: membership in one source does not
  // cancel membership from another.
  kept.collections = [...new Set([...kept.collections, ...incoming.collections])];
  kept.sourceTags = [...new Set([...kept.sourceTags, ...incoming.sourceTags])];
  kept.subscription = kept.subscription || incoming.subscription;
  kept.quarantinedContent.push(...incoming.quarantinedContent);

  // A genuinely different variant (distinct SKU or option) joins the product.
  for (const v of incoming.variants) {
    const dup = kept.variants.some(
      (k) => (v.sku && k.sku && k.sku.toLowerCase() === v.sku.toLowerCase()) || k.id === v.id,
    );
    if (dup) {
      const same = kept.variants.find(
        (k) => k.id === v.id || (v.sku && k.sku?.toLowerCase() === v.sku.toLowerCase()),
      );
      if (!same) continue;

      // Fill the gaps this variant had; disagreements stay unresolved.
      if (!same.sku && v.sku) {
        same.sku = v.sku;
        filled.push(`variant:${v.title}.sku`);
      }
      if (same.weightGrams === null && v.weightGrams !== null) {
        same.weightGrams = v.weightGrams;
        filled.push(`variant:${v.title}.weight`);
      }
      if (same.barcode === null && v.barcode !== null) same.barcode = v.barcode;
      if (same.compareAtCents === null && v.compareAtCents !== null) same.compareAtCents = v.compareAtCents;
      if (same.priceCents !== v.priceCents) {
        conflicts.push({
          field: `variant:${v.sku ?? v.title}.price`,
          kept: String(same.priceCents),
          ignored: String(v.priceCents),
        });
      }
      continue;
    }
    kept.variants.push(v);
    filled.push(`variant:${v.sku ?? v.title}`);
  }

  kept.sources.push(...incoming.sources);
  if (conflicts.length) kept.flags.push("source_conflict");
  // Re-derive the gap flags: a field filled from a later source is no longer
  // missing, and one the merge did not resolve must stay reported.
  const resolved = new Set<string>();
  if (kept.variants.every((v) => v.sku)) resolved.add("missing_sku");
  if (kept.variants.every((v) => v.weightGrams !== null)) resolved.add("missing_weight");
  if (kept.seo.title) resolved.add("missing_seo_title");
  if (kept.seo.description) resolved.add("missing_seo_description");
  if (kept.description.length) resolved.add("missing_description");
  if (kept.images.length || kept.pendingImages.length) resolved.add("missing_image");
  if (kept.shortBenefit) resolved.add("missing_short_benefit");
  if (kept.categoryId) resolved.add("missing_category");
  if (kept.productType) resolved.add("missing_type");
  if (kept.collections.length) resolved.add("no_collection_mapping");

  kept.flags = [...new Set([...kept.flags, ...incoming.flags])]
    .filter((f) => !resolved.has(f))
    .sort();

  duplicates.push({
    keptHandle: kept.handle,
    duplicateOf: incoming.handle,
    matchedOn,
    file,
    row,
    filled,
    conflicts,
  });
}

/* -------------------------------- output -------------------------------- */

const brands = [...new Set(products.map((p) => p.brandId))].sort();
const collectionsUsed = [...new Set(products.flatMap((p) => p.collections))].sort();

const catalog = {
  meta: {
    sources: csvPaths.map((c) => basename(c)),
    importedProducts: products.length,
    sourceRows: sourced.length,
    duplicatesMerged: duplicates.length,
    skipped: skipped.length,
    currency: "USD",
    moneyFormat: "integer_cents",
    note: "Generated by scripts/import-catalog.ts. Edit the source data, not this file.",
  },
  brands,
  collections: collectionsUsed,
  products: products.sort((a, b) => a.handle.localeCompare(b.handle)),
  duplicates,
  skipped,
};

const outDir = join(root, "src", "data", "generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

/* -------------------------------- summary ------------------------------- */

const flagCounts = new Map<string, number>();
for (const p of products) for (const f of p.flags) flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);

console.log(`sources  ${csvPaths.length} file(s), ${sourced.length} rows`);
console.log(`imported ${products.length} unique products`);
if (duplicates.length) {
  const conf = duplicates.filter((d) => d.conflicts.length).length;
  console.log(`merged   ${duplicates.length} duplicate row(s)${conf ? `, ${conf} with conflicting values` : ""}`);
}
if (skipped.length) console.log(`skipped  ${skipped.length}`);
console.log(`  publishable   ${products.filter((p) => p.publishable).length}`);
console.log(`  withheld      ${products.filter((p) => !p.publishable).length}`);
console.log(`  needs review  ${products.filter((p) => p.status === "needs_review").length}`);
console.log("\nflags:");
for (const [f, n] of [...flagCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
}
console.log(`\nwrote ${join("src", "data", "generated", "catalog.json")}`);
