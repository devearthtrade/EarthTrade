/**
 * Seeds the local database from the canonical catalog record.
 *
 * `src/data/generated/catalog.json` is the seed source, not a sync target. The
 * flow is one-way and final: JSON to Postgres, once, after which the database
 * is authoritative and the Dashboard writes to it.
 *
 * Properties:
 *
 *  - Idempotent, keyed on natural keys (brand slug, product handle, variant
 *    SKU or product+title). Re-running against a seeded database updates in
 *    place rather than duplicating.
 *  - One transaction. A failure anywhere leaves the database untouched.
 *  - Nothing is invented. A missing SKU, weight, description or category is
 *    inserted as NULL. Absent stays absent.
 *  - No inventory rows are created. The source carries no stock, and absence
 *    means unknown, which is a different fact from zero.
 *
 * Usage: node db/seed.ts [--dry-run]
 */

import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { psql, scalar, dbConfig } from "./migrate.ts";

const root = join(fileURLToPath(import.meta.url), "..", "..");

/* -------------------------------- source -------------------------------- */

interface Variant {
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

interface Product {
  handle: string;
  title: string;
  brandId: string;
  categoryId: string | null;
  collections: string[];
  sourceTags: string[];
  productType: string | null;
  shortBenefit: string | null;
  description: string[];
  quarantinedContent: { text: string; matches: { reason: string; term: string }[] }[];
  images: { src: string; alt: string }[];
  pendingImages: { path: string; alt: string | null; sourceUrl: string }[];
  variants: Variant[];
  seo: { title: string | null; description: string | null };
  subscription: boolean;
  priceProvisional: boolean;
  publishable: boolean;
  titleMatches: { reason: string; term: string }[];
  status: string;
  flags: string[];
  sources: { file: string; row: number; handle: string; sku: string | null }[];
}

const catalog = JSON.parse(
  readFileSync(join(root, "src", "data", "generated", "catalog.json"), "utf8"),
) as { meta: { sources: string[] }; products: Product[] };

/* ------------------------------ SQL helpers ----------------------------- */

/** Quotes a value as a SQL literal. Null-safe. */
function lit(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${v.replaceAll("'", "''")}'`;
}

/** Quotes a string array as a SQL text[] literal. */
function arr(xs: string[]): string {
  if (!xs.length) return "'{}'";
  return `ARRAY[${xs.map((x) => lit(x)).join(",")}]::text[]`;
}

/** Quotes a value as a jsonb literal. */
function json(v: unknown): string {
  return `${lit(JSON.stringify(v))}::jsonb`;
}

/* ------------------------- reference data (curated) --------------------- */

/*
 * Brand and collection presentation copy lives in src/data/catalog.ts, which
 * is hand-authored editorial rather than imported product data. It is carried
 * across here so the database holds the whole picture, but the catalog record
 * stays the source for everything the CSV supplied.
 */

const BRANDS: { slug: string; name: string; position: number }[] = [
  { slug: "solutionshocl", name: "SolutionsHOCL™", position: 0 },
  { slug: "life-ionizers", name: "Life Ionizers™", position: 1 },
  { slug: "pitcher-of-life", name: "Pitcher of Life®", position: 2 },
  { slug: "hawaiian-volcanic-organic", name: "Hawaiian Volcanic Organic™", position: 3 },
  { slug: "life-sciences-water", name: "Life Sciences Water", position: 4 },
];

const CATEGORIES: { slug: string; name: string; position: number }[] = [
  { slug: "water", name: "Water", position: 0 },
  { slug: "cleaning", name: "Cleaning", position: 1 },
  { slug: "gardening", name: "Gardening", position: 2 },
  { slug: "wellness", name: "Wellness", position: 3 },
];

const COLLECTION_TITLE: Record<string, string> = {
  "pitcher-of-life": "Pitcher of Life",
  "life-ionizers": "Life Ionizers",
  solutionshocl: "SolutionsHOCL",
  wellness: "Wellness",
  "organic-gardening": "Organic Gardening",
  "water-filtration": "Water Filtration",
  bundles: "Bundles",
  accessories: "Accessories",
};

/* -------------------------------- build --------------------------------- */

const P = catalog.products;
const origin = `csv:${catalog.meta.sources.join(",")}`;
const sql: string[] = [];
const w = (s: string) => sql.push(s);

w("BEGIN;");
w("SET LOCAL client_min_messages = WARNING;");

// --- brands
for (const b of BRANDS) {
  w(
    `INSERT INTO brands (slug, name, position) VALUES (${lit(b.slug)}, ${lit(b.name)}, ${b.position})
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position;`,
  );
}

// --- categories
for (const c of CATEGORIES) {
  w(
    `INSERT INTO categories (slug, name, position) VALUES (${lit(c.slug)}, ${lit(c.name)}, ${c.position})
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position;`,
  );
}

// --- collections
const collectionHandles = [...new Set(P.flatMap((p) => p.collections))].sort();
for (const [i, h] of collectionHandles.entries()) {
  w(
    `INSERT INTO collections (handle, title, position) VALUES (${lit(h)}, ${lit(COLLECTION_TITLE[h] ?? h)}, ${i})
     ON CONFLICT (handle) DO UPDATE SET title = EXCLUDED.title;`,
  );
}

// --- media assets, deduped by storage key
const assetKeys = [...new Set(P.flatMap((p) => p.images.map((i) => i.src)))].sort();
for (const src of assetKeys) {
  // The catalog stores a served path; the database stores a storage key, so
  // the serving origin stays configuration rather than data.
  const key = src.replace(/^\/+/, "");
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "avif" ? "image/avif" : "image/jpeg";
  w(
    `INSERT INTO media_assets (storage_key, kind, mime_type) VALUES (${lit(key)}, 'image', ${lit(mime)})
     ON CONFLICT (storage_key) DO NOTHING;`,
  );
}

// --- products
for (const p of P) {
  const withheldReason = p.publishable
    ? null
    : p.titleMatches.length
      ? `Product name states a banned claim: ${[...new Set(p.titleMatches.map((m) => m.term))].join(", ")}`
      : p.flags.includes("zero_price")
        ? "Price is 0.00 in the source"
        : "No price in the source";

  // Imported products are active; publication is gated separately.
  const status = "active";

  w(
    `INSERT INTO products (
       handle, title, short_benefit, brand_id, category_id, product_type,
       status, publishable, withheld_reason, price_provisional,
       subscription_eligible, seo_title, seo_description, published_at
     ) VALUES (
       ${lit(p.handle)}, ${lit(p.title)}, ${lit(p.shortBenefit)},
       (SELECT id FROM brands WHERE slug = ${lit(p.brandId)}),
       ${p.categoryId ? `(SELECT id FROM categories WHERE slug = ${lit(p.categoryId)})` : "NULL"},
       ${lit(p.productType)}, ${lit(status)}, ${lit(p.publishable)}, ${lit(withheldReason)},
       ${lit(p.priceProvisional)}, ${lit(p.subscription)},
       ${lit(p.seo.title)}, ${lit(p.seo.description)},
       ${p.publishable ? "now()" : "NULL"}
     )
     ON CONFLICT (handle) DO UPDATE SET
       title = EXCLUDED.title, short_benefit = EXCLUDED.short_benefit,
       brand_id = EXCLUDED.brand_id, category_id = EXCLUDED.category_id,
       product_type = EXCLUDED.product_type, status = EXCLUDED.status,
       publishable = EXCLUDED.publishable, withheld_reason = EXCLUDED.withheld_reason,
       price_provisional = EXCLUDED.price_provisional,
       subscription_eligible = EXCLUDED.subscription_eligible,
       seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description;`,
  );

  const pid = `(SELECT id FROM products WHERE handle = ${lit(p.handle)})`;

  // content
  w(
    `INSERT INTO product_content (product_id, description, compliance_state, approved_at)
     VALUES (${pid}, ${arr(p.description)}, 'approved', now())
     ON CONFLICT (product_id) DO UPDATE SET description = EXCLUDED.description;`,
  );

  // quarantined copy, replaced wholesale so a re-seed cannot duplicate it
  w(`DELETE FROM product_quarantined_copy WHERE product_id = ${pid};`);
  for (const [i, q] of p.quarantinedContent.entries()) {
    w(
      `INSERT INTO product_quarantined_copy (product_id, position, body, matches)
       VALUES (${pid}, ${i}, ${lit(q.text)}, ${json(q.matches)});`,
    );
  }

  // banned claims in the name
  w(`DELETE FROM product_title_matches WHERE product_id = ${pid};`);
  for (const m of p.titleMatches) {
    w(
      `INSERT INTO product_title_matches (product_id, term, reason)
       VALUES (${pid}, ${lit(m.term)}, ${lit(m.reason)}) ON CONFLICT DO NOTHING;`,
    );
  }

  // review queue
  w(`DELETE FROM product_flags WHERE product_id = ${pid};`);
  for (const f of p.flags) {
    w(`INSERT INTO product_flags (product_id, flag) VALUES (${pid}, ${lit(f)}) ON CONFLICT DO NOTHING;`);
  }

  // tags and search terms
  w(`DELETE FROM product_tags WHERE product_id = ${pid};`);
  for (const [i, t] of p.sourceTags.entries()) {
    // Order is carried from the source and feeds the search index, so it is
    // stored rather than left to whatever order rows come back in.
    w(
      `INSERT INTO product_tags (product_id, tag, position) VALUES (${pid}, ${lit(t)}, ${i})
       ON CONFLICT (product_id, tag) DO UPDATE SET position = EXCLUDED.position;`,
    );
  }

  // Variants seeded before `ref` existed (migration 0009) have none, so there
  // is nothing for ON CONFLICT (ref) to match and the insert below would
  // collide on SKU instead. Stamp the reference onto the existing row first,
  // using the identity the seeder used at the time: SKU where there is one,
  // title otherwise.
  for (const v of p.variants) {
    w(
      `UPDATE product_variants SET ref = ${lit(v.id)}
        WHERE product_id = ${pid} AND ref IS NULL
          AND ${v.sku ? `sku = ${lit(v.sku)}` : `sku IS NULL AND title = ${lit(v.title)}`};`,
    );
  }

  // variants, keyed on the public reference
  for (const [i, v] of p.variants.entries()) {
    w(
      `INSERT INTO product_variants (
         product_id, ref, sku, title, position, price_cents, compare_at_cents,
         currency, weight_grams, barcode, requires_shipping, taxable
       ) VALUES (
         ${pid}, ${lit(v.id)}, ${lit(v.sku)}, ${lit(v.title)}, ${i}, ${v.priceCents},
         ${lit(v.compareAtCents)}, ${lit(v.currency)}, ${lit(v.weightGrams)},
         ${lit(v.barcode)}, ${lit(v.requiresShipping)}, ${lit(v.taxable)}
       )
       ON CONFLICT (ref) DO UPDATE SET
         sku = EXCLUDED.sku,
         price_cents = EXCLUDED.price_cents,
         compare_at_cents = EXCLUDED.compare_at_cents,
         weight_grams = EXCLUDED.weight_grams,
         barcode = EXCLUDED.barcode;`,
    );
  }
  // `ref` is present on every variant and unique, so it is the idempotency
  // key. SKU cannot be: 30 products have none.

  // media links
  w(`DELETE FROM product_media WHERE product_id = ${pid};`);
  for (const [i, img] of p.images.entries()) {
    const key = img.src.replace(/^\/+/, "");
    w(
      `INSERT INTO product_media (product_id, asset_id, alt, position)
       VALUES (${pid}, (SELECT id FROM media_assets WHERE storage_key = ${lit(key)}), ${lit(img.alt)}, ${i})
       ON CONFLICT (product_id, asset_id) DO UPDATE SET alt = EXCLUDED.alt, position = EXCLUDED.position;`,
    );
  }

  // images referenced by the import that have no file yet
  w(`DELETE FROM product_pending_media WHERE product_id = ${pid} AND resolved_at IS NULL;`);
  for (const [i, img] of p.pendingImages.entries()) {
    w(
      `INSERT INTO product_pending_media (product_id, storage_key, alt, source_url, position)
       VALUES (${pid}, ${lit(img.path.replace(/^\/+/, ""))}, ${lit(img.alt)}, ${lit(img.sourceUrl)}, ${i})
       ON CONFLICT (product_id, storage_key) DO UPDATE SET
         alt = EXCLUDED.alt, position = EXCLUDED.position;`,
    );
  }

  // Collection membership derived from the product's tags. Only derived rows
  // are cleared: a curated row is somebody's decision about what a collection
  // leads with, and re-importing the catalog must not silently discard it.
  // Clear this product's derived memberships, then re-derive. A row that is
  // also curated keeps its curation: only the derived origin is withdrawn, and
  // the row survives if someone chose to put the product there.
  w(
    `DELETE FROM collection_products
      WHERE product_id = ${pid} AND is_derived AND NOT is_curated;`,
  );
  w(
    `UPDATE collection_products SET is_derived = false
      WHERE product_id = ${pid} AND is_derived AND is_curated;`,
  );
  for (const [i, ch] of p.collections.entries()) {
    // Two orderings, and this loop only knows one of them. `product_position`
    // is where the collection sits in this product's list, which is what the
    // breadcrumb reads. `collection_position` — where the product sits within
    // the collection — is a merchandising decision made per collection, so a
    // derived row leaves it at zero and sorts by handle.
    w(
      `INSERT INTO collection_products
         (collection_id, product_id, collection_position, product_position, is_derived)
       VALUES ((SELECT id FROM collections WHERE handle = ${lit(ch)}), ${pid}, 0, ${i}, true)
       ON CONFLICT (collection_id, product_id)
         DO UPDATE SET product_position = EXCLUDED.product_position, is_derived = true;`,
    );
  }

  // provenance
  w(`DELETE FROM product_sources WHERE product_id = ${pid};`);
  for (const s of p.sources) {
    w(
      `INSERT INTO product_sources (product_id, origin, source_row, source_handle, source_sku)
       VALUES (${pid}, ${lit(`csv:${s.file}`)}, ${s.row}, ${lit(s.handle)}, ${lit(s.sku)});`,
    );
  }
}

// A single default location exists so stock can be entered later. No
// inventory_levels rows: absence means unknown, not zero.
w(
  `INSERT INTO inventory_locations (code, name) VALUES ('default', 'Default location')
   ON CONFLICT (code) DO NOTHING;`,
);

w(
  `INSERT INTO audit_log (actor, action, entity_type, after)
   VALUES ('seed', 'catalog.seed', 'catalog', ${json({ origin, products: P.length })});`,
);

w("COMMIT;");

/* --------------------------------- run ---------------------------------- */

const dryRun = process.argv.includes("--dry-run");
const cfg = dbConfig();

console.log(`database   ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
console.log(`source     ${catalog.meta.sources.join(", ")}`);
console.log(`products   ${P.length}`);
console.log(`statements ${sql.length}`);

if (dryRun) {
  console.log("\ndry run, nothing written");
  process.exit(0);
}

const staging = mkdtempSync(join(tmpdir(), "et-seed-"));
try {
  const file = join(staging, "seed.sql");
  writeFileSync(file, sql.join("\n") + "\n", "utf8");
  psql("", { file, quiet: true });
} finally {
  rmSync(staging, { recursive: true, force: true });
}

console.log("\nseeded");
for (const t of [
  "brands", "categories", "collections", "products", "product_variants",
  "media_assets", "product_media", "collection_products",
  "product_quarantined_copy", "product_title_matches", "product_flags",
  "product_tags", "product_sources", "inventory_locations", "inventory_levels",
]) {
  console.log(`  ${String(scalar(`SELECT count(*) FROM ${t};`)).padStart(5)}  ${t}`);
}
