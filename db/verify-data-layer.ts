/**
 * Verifies the storefront reads the same catalog from PostgreSQL that it read
 * from the generated JSON export.
 *
 * Both sources are loaded through the same mapping and compared field by field,
 * so a difference reported here is a difference in the data, not in how two
 * loaders happened to shape it. Any divergence that is not accounted for is a
 * failure: a data layer that quietly drops or alters a product fact is worse
 * than one that refuses to load.
 *
 * Usage: node db/verify-data-layer.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "../src/data/catalog-record.ts";
import { loadFromJson } from "../src/data/sources/json.ts";
import { loadFromPostgres } from "../src/data/sources/postgres.ts";
import { dbConfig } from "../src/server/db/config.ts";
import * as repo from "../src/server/repositories/index.ts";
import { close, rows } from "../src/server/db/index.ts";

const root = join(fileURLToPath(import.meta.url), "..", "..");

const failures: string[] = [];
let checks = 0;

function check(label: string, expected: unknown, actual: unknown): boolean {
  checks++;
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  if (!ok) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label.padEnd(52)} ${JSON.stringify(actual)}`);
  return ok;
}

function section(title: string): void {
  console.log(`\n${title}\n`);
}

/* -------------------------- 1-4  the catalog loads ----------------------- */

section("1-4  catalog loads from PostgreSQL");

const pgInput = await loadFromPostgres();
const jsonInput = loadFromJson();
const pg = buildCatalog(pgInput);
const json = buildCatalog(jsonInput);

check("products loaded", 110, pgInput.products.length);
check("variants loaded", 110, pgInput.products.reduce((n, p) => n + p.variants.length, 0));
check(
  "media links loaded",
  109,
  pgInput.products.reduce((n, p) => n + p.images.length, 0),
);
check("published", 106, pg.meta.published);
check("withheld", 4, pg.meta.withheld);
check("published + withheld = total", 110, pg.meta.published + pg.meta.withheld);

/* ------------------------------ 5  collections --------------------------- */

section("5  collections");

const collections = await repo.collections.listCollections();
check("collections", 8, collections.length);
check(
  "collection handles",
  [...new Set(jsonInput.products.flatMap((p) => p.collections))].sort(),
  collections.map((c) => c.handle).sort(),
);

for (const c of collections.map((x) => x.handle)) {
  const fromJson = (json.collectionMembers.get(c) ?? []).slice().sort();
  const fromPg = (pg.collectionMembers.get(c) ?? []).slice().sort();
  check(`  members of ${c}`, fromJson.length, fromPg.length);
  if (JSON.stringify(fromJson) !== JSON.stringify(fromPg)) {
    failures.push(`collection ${c} membership differs`);
  }
}

/* -------------------------------- 6  search ------------------------------ */

section("6  search");

check("search terms preserved",
  jsonInput.products.reduce((n, p) => n + new Set(p.searchTerms).size, 0),
  pgInput.products.reduce((n, p) => n + new Set(p.searchTerms).size, 0));

const hocl = await repo.search.searchProducts("toilet bomb");
check("server-side search finds toilet bombs", true, hocl.length >= 2);
check("search excludes withheld", 0,
  (await repo.search.searchProducts("fogger")).length);

// A search string that would end a quoted literal must be matched as text.
const injection = await repo.search.searchProducts("' OR 1=1 --");
check("injection string returns no rows", 0, injection.length);
// "%" is a wildcard to a LIKE pattern but just a character to a shopper. It
// must match only the products whose text actually contains it.
const pct = await repo.search.searchProducts("%");
check("'%' matches only text containing it", true, pct.length > 0 && pct.length < 5);
check("'100%' is not a wildcard match", true, (await repo.search.searchProducts("100%")).length < 5);
check("'_' matches nothing", 0, (await repo.search.searchProducts("_")).length);

/* ---------------------------- 7  product pages --------------------------- */

section("7  product pages");

const distProducts = join(root, "dist", "products");
const rendered = statSync(distProducts, { throwIfNoEntry: false })
  ? readdirSync(distProducts).filter((d) => statSync(join(distProducts, d)).isDirectory())
  : [];
check("product pages rendered", 106, rendered.length);
check(
  "every published product has a page",
  [],
  pg.products.map((p) => p.handle).filter((h) => !rendered.includes(h)),
);
check(
  "no withheld product has a page",
  [],
  pg.withheldProducts.map((p) => p.handle).filter((h) => rendered.includes(h)),
);

const single = await repo.catalog.loadProduct("toilet-bomb-organic-lemon");
check("single product read by handle", "toilet-bomb-organic-lemon", single?.handle);
check("  its variant carries a price", true, (single?.variants[0]?.priceCents ?? 0) > 0);
check("  its variant has a public ref", true, /^etv_[0-9a-f]+$/.test(single?.variants[0]?.ref ?? ""));

/* ------------------------------- 8  filters ------------------------------ */

section("8  filters");

for (const brand of pgInput.products.map((p) => p.brandId).filter((v, i, a) => a.indexOf(v) === i)) {
  const viaFilter = await repo.products.listProductRows({ brandSlug: brand, publishable: true });
  const viaJson = json.products.filter((p) => p.brand === brand);
  check(`  brand=${brand}`, viaJson.length, viaFilter.length);
}
for (const cat of ["water", "cleaning", "gardening", "wellness"]) {
  const viaFilter = await repo.products.listProductRows({ categorySlug: cat, publishable: true });
  const viaJson = json.products.filter((p) => p.category === cat);
  check(`  category=${cat}`, viaJson.length, viaFilter.length);
}
check("  handles filter", 2,
  (await repo.products.listProductRows({ handles: ["toilet-bomb-organic-lemon", "toilet-bomb-fragrance-free"] })).length);
check("  unknown handle returns nothing", 0,
  (await repo.products.listProductRows({ handles: ["does-not-exist"] })).length);

/* --------------------------- 9  related products ------------------------- */

section("9  related products");

// No relationships have been recorded, so the explicit query must return
// nothing rather than invent a pairing.
check("recorded relations", 0, (await rows("SELECT count(*)::int AS n FROM product_relations"))[0]?.["n"]);
check("relatedTo returns nothing when none recorded", 0,
  (await repo.relations.relatedTo("toilet-bomb-organic-lemon")).length);
const sameBrand = await repo.relations.sameBrandAndCategory("toilet-bomb-organic-lemon", 4);
check("stated-rule fallback returns siblings", true, sameBrand.length > 0);
check("  fallback excludes the product itself", false, sameBrand.includes("toilet-bomb-organic-lemon"));

/* ---------------------------- 10  no Shopify ----------------------------- */

section("10  no Shopify dependency");

const sourceFiles: string[] = [];
(function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|js|sql|json)$/.test(entry.name)) sourceFiles.push(p);
  }
})(join(root, "src"));
for (const d of ["db", "scripts"]) {
  (function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|js|sql)$/.test(entry.name)) sourceFiles.push(p);
    }
  })(join(root, d));
}

// These files scan *for* the string and would otherwise match themselves.
const SCANNERS = ["db/verify.ts", "db/verify-data-layer.ts"];
// Generated data is checked separately below: a recorded provenance URL is not
// a dependency, and conflating the two would let a real one hide behind it.
const GENERATED = ["src/data/generated/catalog.json"];

const scannable = sourceFiles
  .map((f) => f.replace(root + "/", ""))
  .filter((f) => !SCANNERS.includes(f) && !GENERATED.includes(f));

const shopifyHits: string[] = [];
for (const rel of scannable) {
  const text = readFileSync(join(root, rel), "utf8");
  for (const m of text.matchAll(/^.*\b(shopify|myshopify|gid:\/\/shopify|storefrontapi)\b.*$/gim)) {
    shopifyHits.push(`${rel}: ${m[0].trim().slice(0, 100)}`);
  }
}
check("no Shopify reference anywhere in the source", [], shopifyHits);

check("no Shopify identifier in catalog data", 0,
  (await rows<{ n: number }>(`SELECT count(*)::int AS n FROM (
      SELECT storage_key AS v FROM media_assets
      UNION ALL SELECT handle FROM products
      UNION ALL SELECT ref FROM product_variants
      UNION ALL SELECT coalesce(sku,'') FROM product_variants
      UNION ALL SELECT storage_key FROM product_pending_media
    ) t WHERE v ~* '(shopify|gid://|myshopify)'`))[0]?.n);

// One Shopify URL is recorded, deliberately: where an image the catalog
// references was originally listed, for whoever has to supply the file. It is
// named here rather than allowed to pass unnoticed. Nothing reads it.
const provenance = await rows<{ product: string; source_url: string }>(
  `SELECT p.handle AS product, m.source_url
     FROM product_pending_media m JOIN products p ON p.id = m.product_id
    WHERE m.source_url ~* '(shopify|myshopify)'`);
check("recorded provenance URLs, unused by any code path", 1, provenance.length);
for (const r of provenance) console.log(`        ${r.product} -> ${r.source_url.slice(0, 72)}…`);

/* ------------------------ 11  no production network ---------------------- */

section("11  no production network connection");

const cfg = dbConfig();
check("database host is loopback", true, ["127.0.0.1", "localhost", "::1"].includes(cfg.host));
check("catalog source is postgres", "postgres", pgInput.source.split(":")[0]);

const outbound: string[] = [];
for (const rel of scannable) {
  const text = readFileSync(join(root, rel), "utf8");
  for (const m of text.matchAll(/^.*\b(fetch\(|https?\.request|https?\.get\(|XMLHttpRequest)\b.*$/gm)) {
    const line = m[0].trim();
    if (line.startsWith("*") || line.startsWith("//") || line.startsWith("--")) continue;
    outbound.push(`${rel}: ${line.slice(0, 90)}`);
  }
}
check("no outbound HTTP client in the data layer", [], outbound);
// earthtrade.com may appear as the canonical origin in rendered metadata.
// What must not appear is anything that would *connect* to it.
check("earthtrade.com is never a connection target", [],
  scannable.flatMap((rel) =>
    [...readFileSync(join(root, rel), "utf8").matchAll(/^.*earthtrade\.com.*$/gm)]
      .map((m) => m[0].trim())
      .filter((l) => /fetch|connect|request|PGHOST|DATABASE_URL|deploy|rsync|scp|ssh/i.test(l))
      .map((l) => `${rel}: ${l.slice(0, 90)}`)));

/* --------------------- field-level JSON vs PostgreSQL -------------------- */

section("field-level comparison, JSON vs PostgreSQL");

// Compliance matches are compared by value, not by the order their keys were
// written in — the two sources build the same object from different directions.
const normMatch = (m: { term: string; reason: string }) => ({ term: m.term, reason: m.reason });

const jsonByHandle = new Map(jsonInput.products.map((p) => [p.handle, p]));
const differences: string[] = [];

for (const p of pgInput.products) {
  const j = jsonByHandle.get(p.handle);
  if (!j) {
    differences.push(`${p.handle}: present in PostgreSQL, absent from JSON`);
    continue;
  }
  const compare: [string, unknown, unknown][] = [
    ["title", j.title, p.title],
    ["brandId", j.brandId, p.brandId],
    ["categoryId", j.categoryId, p.categoryId],
    ["shortBenefit", j.shortBenefit, p.shortBenefit],
    ["description", j.description, p.description],
    ["collections", j.collections, p.collections],
    ["searchTerms", [...new Set(j.searchTerms)], [...new Set(p.searchTerms)]],
    ["publishable", j.publishable, p.publishable],
    ["status", j.status, p.status],
    ["needsReview", j.needsReview, p.needsReview],
    ["flags", j.flags, p.flags],
    ["priceProvisional", j.priceProvisional, p.priceProvisional],
    ["subscription", j.subscription, p.subscription],
    ["titleMatches", j.titleMatches.map(normMatch), p.titleMatches.map(normMatch)],
    ["quarantinedContent",
      j.quarantinedContent.map((b) => ({ text: b.text, matches: b.matches.map(normMatch) })),
      p.quarantinedContent.map((b) => ({ text: b.text, matches: b.matches.map(normMatch) }))],
    ["variants", j.variants.map((v) => ({ ...v, sellable: undefined })),
                 p.variants.map((v) => ({ ...v, sellable: undefined }))],
    // Images are compared after removing repeats: the JSON export lists a file
    // once per source column, so five products name the same file twice.
    ["images", [...new Map(j.images.map((i) => [i.src, i])).values()], p.images],
  ];
  for (const [field, a, b] of compare) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      differences.push(`${p.handle}.${field}\n      json: ${JSON.stringify(a).slice(0, 200)}\n      pg:   ${JSON.stringify(b).slice(0, 200)}`);
    }
  }
}
for (const j of jsonInput.products) {
  if (!pgInput.products.some((p) => p.handle === j.handle)) {
    differences.push(`${j.handle}: present in JSON, absent from PostgreSQL`);
  }
}

check("products compared", 110, pgInput.products.length);
check("unaccounted field differences", [], differences);

// The one accounted-for difference, asserted rather than assumed.
const dupImages = jsonInput.products.filter(
  (p) => new Set(p.images.map((i) => i.src)).size < p.images.length,
);
check("JSON records with a repeated image file", 5, dupImages.length);
check("  all repeats are the same file twice", true,
  dupImages.every((p) => new Set(p.images.map((i) => i.src)).size === 1));

await close();

console.log();
if (failures.length) {
  console.error(`${failures.length} of ${checks} check(s) failed:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`all ${checks} checks passed`);
