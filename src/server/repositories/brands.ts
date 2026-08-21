/** Brand and category reads. */

import { rows, one } from "../db/index.ts";
import type { BrandRecord, CategoryRecord } from "./types.ts";

interface BrandRow {
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  story: (string | null)[] | null;
  theme: string | null;
  position: number;
}

const toBrand = (r: BrandRow): BrandRecord => ({
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  summary: r.summary,
  story: (r.story ?? []).filter((s): s is string => s !== null),
  theme: r.theme,
  position: r.position,
});

const BRAND_COLUMNS = `slug, name, tagline, summary, story, theme, position`;

export async function listBrands(): Promise<BrandRecord[]> {
  const r = await rows<BrandRow>(
    `SELECT ${BRAND_COLUMNS} FROM brands ORDER BY position, slug`,
  );
  return r.map(toBrand);
}

export async function getBrand(slug: string): Promise<BrandRecord | null> {
  const r = await one<BrandRow>(
    `SELECT ${BRAND_COLUMNS} FROM brands WHERE slug = $1`,
    [slug],
  );
  return r ? toBrand(r) : null;
}

/** Published product counts per brand, for navigation and brand pages. */
export async function brandProductCounts(): Promise<Map<string, number>> {
  const r = await rows<{ slug: string; n: number }>(
    `SELECT b.slug, count(p.id)::int AS n
       FROM brands b
       LEFT JOIN products p ON p.brand_id = b.id AND p.publishable
      GROUP BY b.slug`,
  );
  return new Map(r.map((x) => [x.slug, x.n]));
}

export async function listCategories(): Promise<CategoryRecord[]> {
  const r = await rows<{
    slug: string;
    name: string;
    parent_slug: string | null;
    position: number;
  }>(
    `SELECT c.slug, c.name, parent.slug AS parent_slug, c.position
       FROM categories c
       LEFT JOIN categories parent ON parent.id = c.parent_id
      ORDER BY c.position, c.slug`,
  );
  return r.map((x) => ({
    slug: x.slug,
    name: x.name,
    parentSlug: x.parent_slug,
    position: x.position,
  }));
}
