/**
 * One-time extraction of brand and collection definitions from source code
 * into a seed file.
 *
 * These were literals in `src/data/catalog.ts`. Moving them to PostgreSQL means
 * the database becomes the source of truth for them, and the Dashboard can edit
 * them without a code change. This script does the move by reading the literals
 * rather than by retyping them, so nothing is lost or altered in transit.
 *
 * Run once. After the seed file exists, edit the database, not this.
 *
 * Usage: node scripts/extract-presentation.ts
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { brands, collections } from "../src/data/catalog.ts";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const out = join(root, "db", "seed-data", "presentation.json");

writeFileSync(
  out,
  JSON.stringify(
    {
      note:
        "Extracted from src/data/catalog.ts. The database is authoritative once seeded; " +
        "this file exists so a fresh database can be built from nothing.",
      brands: brands.map((b, i) => ({
        slug: b.id,
        name: b.name,
        tagline: b.tagline,
        summary: b.summary,
        story: b.story,
        theme: b.theme ?? null,
        collectionHandle: b.collectionHandle ?? null,
        image: b.image ?? null,
        position: i,
      })),
      collections: collections.map((c, i) => ({
        handle: c.handle,
        title: c.title,
        heroTitle: c.heroTitle ?? null,
        eyebrow: c.eyebrow ?? null,
        description: c.description,
        editorial: c.editorial ?? [],
        theme: c.theme ?? null,
        hidden: c.hidden ?? false,
        curatedProducts: c.productHandles,
        faqs: c.faqs ?? [],
        related: c.related ?? [],
        image: c.image ?? null,
        position: i,
      })),
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(`wrote ${out}`);
console.log(`  brands       ${brands.length}`);
console.log(`  collections  ${collections.length}`);
console.log(`  curated refs ${collections.reduce((n, c) => n + c.productHandles.length, 0)}`);
console.log(`  faqs         ${collections.reduce((n, c) => n + (c.faqs?.length ?? 0), 0)}`);
console.log(`  related refs ${collections.reduce((n, c) => n + (c.related?.length ?? 0), 0)}`);
