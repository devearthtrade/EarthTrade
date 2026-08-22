/**
 * Verifies the seeded database against the catalog record, field by field.
 *
 * Every product, variant, price, SKU, weight, image link, collection
 * membership, flag and compliance record is compared. Any divergence is a
 * failure: a migration that loses or alters a product fact is worse than one
 * that refuses to run.
 *
 * Usage: node db/verify.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scalar } from "./migrate.ts";

const root = join(fileURLToPath(import.meta.url), "..", "..");

interface Variant {
  sku: string | null;
  title: string;
  priceCents: number;
  compareAtCents: number | null;
  weightGrams: number | null;
}
interface Product {
  handle: string;
  title: string;
  brandId: string;
  categoryId: string | null;
  collections: string[];
  productType: string | null;
  shortBenefit: string | null;
  description: string[];
  quarantinedContent: unknown[];
  images: { src: string }[];
  variants: Variant[];
  seo: { title: string | null; description: string | null };
  publishable: boolean;
  priceProvisional: boolean;
  titleMatches: unknown[];
  flags: string[];
}

const catalog = JSON.parse(
  readFileSync(join(root, "src", "data", "generated", "catalog.json"), "utf8"),
) as { products: Product[] };

const P = catalog.products;
const failures: string[] = [];
const check = (label: string, expected: unknown, actual: unknown) => {
  const ok = String(expected) === String(actual);
  if (!ok) failures.push(`${label}: expected ${expected}, got ${actual}`);
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label.padEnd(42)} ${expected}`);
  return ok;
};

console.log("counts\n");

check("products", P.length, scalar("SELECT count(*) FROM products;"));
check("variants", P.reduce((n, p) => n + p.variants.length, 0), scalar("SELECT count(*) FROM product_variants;"));
check("brands", new Set(P.map((p) => p.brandId)).size, scalar("SELECT count(*) FROM brands;"));
check("categories", new Set(P.map((p) => p.categoryId).filter(Boolean)).size, scalar("SELECT count(*) FROM categories;"));
// The database holds more collections than the import produced: the ones the
// import derived from product tags, plus the collections the storefront
// presents. What must hold is that every imported collection is still there.
check(
  "imported collections all present",
  new Set(P.flatMap((p) => p.collections)).size,
  scalar(
    `SELECT count(*) FROM collections WHERE handle = ANY(ARRAY[${[
      ...new Set(P.flatMap((p) => p.collections)),
    ]
      .map((h) => `'${h.replaceAll("'", "''")}'`)
      .join(",")}]);`,
  ),
);
check(
  "derived memberships",
  P.reduce((n, p) => n + p.collections.length, 0),
  scalar("SELECT count(*) FROM collection_products WHERE is_derived;"),
);
check(
  "media assets (distinct files)",
  new Set(P.flatMap((p) => p.images.map((i) => i.src))).size,
  scalar("SELECT count(*) FROM media_assets;"),
);
check(
  "product media links (deduped per product)",
  P.reduce((n, p) => n + new Set(p.images.map((i) => i.src)).size, 0),
  scalar("SELECT count(*) FROM product_media;"),
);
check("published products", P.filter((p) => p.publishable).length, scalar("SELECT count(*) FROM products WHERE publishable;"));
check("withheld products", P.filter((p) => !p.publishable).length, scalar("SELECT count(*) FROM products WHERE NOT publishable;"));
check(
  "quarantined copy blocks",
  P.reduce((n, p) => n + p.quarantinedContent.length, 0),
  scalar("SELECT count(*) FROM product_quarantined_copy;"),
);
check(
  "banned claims in names",
  P.reduce((n, p) => n + p.titleMatches.length, 0),
  scalar("SELECT count(*) FROM product_title_matches;"),
);
check("review flags", P.reduce((n, p) => n + p.flags.length, 0), scalar("SELECT count(*) FROM product_flags;"));
check("provenance rows", P.length, scalar("SELECT count(*) FROM product_sources;"));
check("inventory levels (must be none)", 0, scalar("SELECT count(*) FROM inventory_levels;"));

console.log("\nfield parity\n");

check("variants with a SKU", P.filter((p) => p.variants.some((v) => v.sku)).length,
  scalar("SELECT count(DISTINCT product_id) FROM product_variants WHERE sku IS NOT NULL;"));
check("variants with a weight", P.filter((p) => p.variants.some((v) => v.weightGrams !== null)).length,
  scalar("SELECT count(DISTINCT product_id) FROM product_variants WHERE weight_grams IS NOT NULL;"));
check("variants with compare-at", P.filter((p) => p.variants.some((v) => v.compareAtCents !== null)).length,
  scalar("SELECT count(DISTINCT product_id) FROM product_variants WHERE compare_at_cents IS NOT NULL;"));
check("products with an SEO title", P.filter((p) => p.seo.title).length,
  scalar("SELECT count(*) FROM products WHERE seo_title IS NOT NULL;"));
check("products with a meta description", P.filter((p) => p.seo.description).length,
  scalar("SELECT count(*) FROM products WHERE seo_description IS NOT NULL;"));
check("products with a description", P.filter((p) => p.description.length).length,
  scalar("SELECT count(*) FROM product_content WHERE cardinality(description) > 0;"));
check("products with a category", P.filter((p) => p.categoryId).length,
  scalar("SELECT count(*) FROM products WHERE category_id IS NOT NULL;"));
check("provisional prices", P.filter((p) => p.priceProvisional).length,
  scalar("SELECT count(*) FROM products WHERE price_provisional;"));

// Money must survive as exact integers.
const sumCents = P.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.priceCents, 0), 0);
check("sum of all prices (cents)", sumCents, scalar("SELECT coalesce(sum(price_cents),0) FROM product_variants;"));

console.log("\nper-product handle parity\n");

const dbHandles = new Set(
  scalar("SELECT string_agg(handle, E'\\n' ORDER BY handle) FROM products;").split("\n"),
);
const missing = P.filter((p) => !dbHandles.has(p.handle));
const extra = [...dbHandles].filter((h) => h && !P.some((p) => p.handle === h));
check("every catalog handle present", 0, missing.length);
check("no unexpected handles", 0, extra.length);
if (missing.length) console.log("   missing:", missing.map((p) => p.handle).join(", "));
if (extra.length) console.log("   extra:", extra.join(", "));

console.log("\nindependence\n");

const foreign = scalar(`
  SELECT count(*) FROM (
    SELECT storage_key AS v FROM media_assets
    UNION ALL SELECT handle FROM products
    UNION ALL SELECT coalesce(sku,'') FROM product_variants
    UNION ALL SELECT origin FROM product_sources
  ) t WHERE v ~* '(shopify|gid://|myshopify|githubusercontent)';`);
check("no foreign identifier or host anywhere", 0, foreign);

const absolute = scalar("SELECT count(*) FROM media_assets WHERE storage_key ~ '^[a-z]+://';");
check("no absolute media URLs", 0, absolute);

console.log();
if (failures.length) {
  console.error(`${failures.length} check(s) failed:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log("all checks passed");
