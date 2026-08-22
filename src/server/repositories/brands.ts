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
  collection_handle: string | null;
  image_key: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  logo_key: string | null;
  logo_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  position: number;
}

const toBrand = (r: BrandRow): BrandRecord => ({
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  summary: r.summary,
  story: (r.story ?? []).filter((s): s is string => s !== null),
  theme: r.theme,
  collectionHandle: r.collection_handle,
  image: r.image_key
    ? {
        src: `/${r.image_key.replace(/^\/+/, "")}`,
        alt: r.image_alt ?? r.name,
        width: r.image_width,
        height: r.image_height,
      }
    : null,
  logo: r.logo_key
    ? { src: `/${r.logo_key.replace(/^\/+/, "")}`, alt: r.logo_alt ?? r.name, width: null, height: null }
    : null,
  seoTitle: r.seo_title,
  seoDescription: r.seo_description,
  position: r.position,
});

const BRAND_COLUMNS = `
  b.slug, b.name, b.tagline, b.summary, b.story, b.theme, b.position,
  c.handle       AS collection_handle,
  a.storage_key  AS image_key,
  b.image_alt    AS image_alt,
  a.width        AS image_width,
  a.height       AS image_height,
  lg.storage_key AS logo_key,
  b.logo_alt     AS logo_alt,
  b.seo_title    AS seo_title,
  b.seo_description AS seo_description`;

const BRAND_FROM = `
  FROM brands b
  LEFT JOIN collections c   ON c.id = b.collection_id
  LEFT JOIN media_assets a  ON a.id = b.image_id
  LEFT JOIN media_assets lg ON lg.id = b.logo_id`;

export async function listBrands(): Promise<BrandRecord[]> {
  const r = await rows<BrandRow>(
    `SELECT ${BRAND_COLUMNS} ${BRAND_FROM} ORDER BY b.position, b.slug`,
  );
  return r.map(toBrand);
}

export async function getBrand(slug: string): Promise<BrandRecord | null> {
  const r = await one<BrandRow>(
    `SELECT ${BRAND_COLUMNS} ${BRAND_FROM} WHERE b.slug = $1`,
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
