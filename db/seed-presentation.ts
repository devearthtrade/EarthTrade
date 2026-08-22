/**
 * Seeds brand and collection presentation content.
 *
 * Source: db/seed-data/presentation.json, extracted once from what used to be
 * literals in src/data/catalog.ts. The database is authoritative after this
 * runs; the file exists so a database can be rebuilt from nothing.
 *
 * Runs after db/seed.ts, which creates the products this references.
 *
 * Idempotent, keyed on natural keys (brand slug, collection handle, FAQ
 * question). Re-running updates in place rather than duplicating.
 *
 * A curated product handle that does not resolve is reported and skipped, not
 * invented. Collections whose curation has gone stale stay populated by their
 * derived membership, which is the behaviour the storefront already had.
 *
 * Usage: node db/seed-presentation.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { psql, scalar } from "./migrate.ts";

const root = join(fileURLToPath(import.meta.url), "..", "..");

interface Brand {
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  story: string[];
  theme: string | null;
  collectionHandle: string | null;
  image: { src: string; alt: string } | null;
  position: number;
}

interface Collection {
  handle: string;
  title: string;
  heroTitle: string | null;
  eyebrow: string | null;
  description: string;
  editorial: string[];
  theme: string | null;
  hidden: boolean;
  curatedProducts: string[];
  faqs: { q: string; a: string }[];
  related: string[];
  image: { src: string; alt: string } | null;
  position: number;
}

const data = JSON.parse(
  readFileSync(join(root, "db", "seed-data", "presentation.json"), "utf8"),
) as { brands: Brand[]; collections: Collection[] };

/* ------------------------------ SQL helpers ----------------------------- */

function lit(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${v.replaceAll("'", "''")}'`;
}

function arr(xs: string[]): string {
  if (!xs.length) return "'{}'::text[]";
  return `ARRAY[${xs.map((x) => lit(x)).join(",")}]::text[]`;
}

const statements: string[] = [];
const w = (sql: string): void => void statements.push(sql);

/* ------------------------------ collections ----------------------------- */

// A brand collection carries a brand's own name; a category collection is the
// storefront face of one of the four product categories, whose handles are not
// always the category slug. Everything else is merchandising.
const CATEGORY_HANDLES = new Set([
  "water",
  "household-cleaning",
  "organic-gardening",
  "wellness",
]);
const brandHandles = new Set(data.brands.map((b) => b.collectionHandle).filter(Boolean));

const roleOf = (handle: string): string =>
  CATEGORY_HANDLES.has(handle) ? "category" : brandHandles.has(handle) ? "brand" : "editorial";

for (const c of data.collections) {
  w(
    `INSERT INTO collections (handle, title, hero_title, eyebrow, description, editorial,
                              theme, role, is_hidden, position)
     VALUES (${lit(c.handle)}, ${lit(c.title)}, ${lit(c.heroTitle)}, ${lit(c.eyebrow)},
             ${lit(c.description)}, ${arr(c.editorial)}, ${lit(c.theme)},
             ${lit(roleOf(c.handle))}, ${lit(c.hidden)}, ${c.position})
     ON CONFLICT (handle) DO UPDATE SET
       title = EXCLUDED.title,
       hero_title = EXCLUDED.hero_title,
       eyebrow = EXCLUDED.eyebrow,
       description = EXCLUDED.description,
       editorial = EXCLUDED.editorial,
       theme = EXCLUDED.theme,
       role = EXCLUDED.role,
       is_hidden = EXCLUDED.is_hidden,
       position = EXCLUDED.position;`,
  );

  const cid = `(SELECT id FROM collections WHERE handle = ${lit(c.handle)})`;

  // Curated membership. Derived rows are left alone: they come from the
  // product import and are re-derived there.
  // Withdraw curation, keeping rows that also arrived through the product's
  // own tags. Removing a product from a curated list does not remove it from
  // the collection its tags put it in.
  w(
    `DELETE FROM collection_products
      WHERE collection_id = ${cid} AND is_curated AND NOT is_derived;`,
  );
  w(
    `UPDATE collection_products SET is_curated = false
      WHERE collection_id = ${cid} AND is_curated AND is_derived;`,
  );
  for (const [i, handle] of c.curatedProducts.entries()) {
    w(
      `INSERT INTO collection_products
         (collection_id, product_id, collection_position, product_position, is_curated)
       SELECT ${cid}, p.id, ${i}, 0, true FROM products p WHERE p.handle = ${lit(handle)}
       ON CONFLICT (collection_id, product_id) DO UPDATE SET
         collection_position = EXCLUDED.collection_position, is_curated = true;`,
    );
  }

  w(`DELETE FROM collection_faqs WHERE collection_id = ${cid};`);
  for (const [i, f] of c.faqs.entries()) {
    w(
      `INSERT INTO collection_faqs (collection_id, position, question, answer)
       VALUES (${cid}, ${i}, ${lit(f.q)}, ${lit(f.a)})
       ON CONFLICT (collection_id, question) DO UPDATE SET
         answer = EXCLUDED.answer, position = EXCLUDED.position;`,
    );
  }
}

// Relations are written after every collection exists, so a forward reference
// resolves rather than being silently dropped.
for (const c of data.collections) {
  const cid = `(SELECT id FROM collections WHERE handle = ${lit(c.handle)})`;
  w(`DELETE FROM collection_relations WHERE collection_id = ${cid};`);
  for (const [i, handle] of c.related.entries()) {
    w(
      `INSERT INTO collection_relations (collection_id, related_id, position)
       SELECT ${cid}, r.id, ${i} FROM collections r WHERE r.handle = ${lit(handle)}
       ON CONFLICT (collection_id, related_id) DO UPDATE SET position = EXCLUDED.position;`,
    );
  }
}

/*
 * A collection the import created but nobody has written copy for is not a
 * page anyone decided to publish. It stays in the database — the membership is
 * real, and the Dashboard should be able to find and describe it — but it is
 * hidden from the storefront until it has something to say.
 *
 * Hiding it here rather than deleting it means describing it later is an edit,
 * not a recovery.
 */
w(`UPDATE collections SET is_hidden = true
    WHERE description IS NULL AND NOT is_hidden;`);

/* -------------------------------- brands -------------------------------- */

for (const b of data.brands) {
  w(
    `INSERT INTO brands (slug, name, tagline, summary, story, theme, position)
     VALUES (${lit(b.slug)}, ${lit(b.name)}, ${lit(b.tagline)}, ${lit(b.summary)},
             ${arr(b.story)}, ${lit(b.theme)}, ${b.position})
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       tagline = EXCLUDED.tagline,
       summary = EXCLUDED.summary,
       story = EXCLUDED.story,
       theme = EXCLUDED.theme,
       position = EXCLUDED.position;`,
  );

  if (b.collectionHandle) {
    w(
      `UPDATE brands SET collection_id = (SELECT id FROM collections WHERE handle = ${lit(b.collectionHandle)})
        WHERE slug = ${lit(b.slug)};`,
    );
  }
}

/* --------------------------------- run ---------------------------------- */

console.log(`source       db/seed-data/presentation.json`);
console.log(`brands       ${data.brands.length}`);
console.log(`collections  ${data.collections.length}`);

psql(`BEGIN;\n${statements.join("\n")}\nCOMMIT;`, { quiet: true });

console.log("\nseeded\n");
for (const [label, sql] of [
  ["collections", "SELECT count(*) FROM collections"],
  ["  with editorial", "SELECT count(*) FROM collections WHERE cardinality(editorial) > 0"],
  ["  category role", "SELECT count(*) FROM collections WHERE role = 'category'"],
  ["  brand role", "SELECT count(*) FROM collections WHERE role = 'brand'"],
  ["curated members", "SELECT count(*) FROM collection_products WHERE is_curated"],
  ["derived members", "SELECT count(*) FROM collection_products WHERE is_derived"],
  ["  both origins", "SELECT count(*) FROM collection_products WHERE is_curated AND is_derived"],
  ["collection faqs", "SELECT count(*) FROM collection_faqs"],
  ["collection relations", "SELECT count(*) FROM collection_relations"],
  ["hidden (undescribed)", "SELECT count(*) FROM collections WHERE is_hidden"],
  ["brands with a story", "SELECT count(*) FROM brands WHERE cardinality(story) > 0"],
  ["brands linked to a collection", "SELECT count(*) FROM brands WHERE collection_id IS NOT NULL"],
] as const) {
  console.log(`  ${String(scalar(sql + ";")).padStart(5)}  ${label}`);
}

// Curation that no longer resolves. Reported rather than invented or dropped
// in silence: these are the handles somebody has to re-curate.
const stale = data.collections.flatMap((c) =>
  c.curatedProducts.map((h) => ({ collection: c.handle, handle: h })),
);
const known = new Set(
  scalar("SELECT string_agg(handle, E'\\n') FROM products;").split("\n"),
);
const missing = stale.filter((s) => !known.has(s.handle));
if (missing.length) {
  console.log(`\n${missing.length} curated handle(s) do not resolve:\n`);
  for (const m of missing) console.log(`  ${m.collection.padEnd(22)} ${m.handle}`);
  console.log("\nThese collections stay populated by their derived membership.");
}
