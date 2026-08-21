/**
 * Product reads.
 *
 * Two shapes are offered deliberately. `listProductRows` fetches many products
 * in one statement for the build, which renders the whole catalog at once;
 * `getProductRow` fetches one for a page or an API request. Both return the
 * product row only — variants, media, collections and compliance records are
 * separate repositories, composed in `catalog.ts`.
 */

import { rows, one } from "../db/index.ts";

/** A product row plus the internal id its child rows are keyed by. */
export interface ProductRow {
  id: string;
  handle: string;
  title: string;
  card_title: string | null;
  brand_slug: string;
  category_slug: string | null;
  product_type: string | null;
  short_benefit: string | null;
  description: (string | null)[] | null;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  needs_review: boolean;
  publishable: boolean;
  withheld_reason: string | null;
  price_provisional: boolean;
  subscription_eligible: boolean;
}

const COLUMNS = `
  p.id,
  p.handle,
  p.title,
  p.card_title,
  b.slug  AS brand_slug,
  c.slug  AS category_slug,
  p.product_type,
  p.short_benefit,
  pc.description,
  p.seo_title,
  p.seo_description,
  p.status,
  rs.needs_review,
  p.publishable,
  p.withheld_reason,
  p.price_provisional,
  p.subscription_eligible`;

const FROM = `
  FROM products p
  JOIN brands b            ON b.id = p.brand_id
  LEFT JOIN categories c   ON c.id = p.category_id
  LEFT JOIN product_content pc ON pc.product_id = p.id
  JOIN product_review_state rs ON rs.id = p.id`;

export interface ProductFilter {
  /** true = storefront-visible only, false = withheld only, undefined = both. */
  publishable?: boolean;
  brandSlug?: string;
  categorySlug?: string;
  handles?: string[];
}

/**
 * Filters are composed as numbered placeholders rather than interpolated. The
 * `handles` list uses `= ANY($n)` with a single array parameter, so the SQL
 * text is identical whether one handle is requested or a hundred — which also
 * means Postgres can reuse the plan.
 */
export async function listProductRows(filter: ProductFilter = {}): Promise<ProductRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (v: unknown): string => `$${params.push(v)}`;

  if (filter.publishable !== undefined) where.push(`p.publishable = ${bind(filter.publishable)}`);
  if (filter.brandSlug) where.push(`b.slug = ${bind(filter.brandSlug)}`);
  if (filter.categorySlug) where.push(`c.slug = ${bind(filter.categorySlug)}`);
  if (filter.handles) where.push(`p.handle = ANY(${bind(pgTextArray(filter.handles))})`);

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return rows<ProductRow>(
    `SELECT ${COLUMNS} ${FROM} ${clause} ORDER BY p.handle`,
    params,
  );
}

export async function getProductRow(handle: string): Promise<ProductRow | null> {
  return one<ProductRow>(`SELECT ${COLUMNS} ${FROM} WHERE p.handle = $1`, [handle]);
}

/**
 * Encodes a string list as a Postgres array literal for a single bound
 * parameter. Values still travel as one parameter, so this is quoting for the
 * array parser rather than for SQL: `"` and `\` are escaped, and there is no
 * path by which a value here becomes a statement.
 */
export function pgTextArray(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
}

/** Counts by publication state, for the build report. */
export async function publicationCounts(): Promise<{ total: number; published: number; withheld: number }> {
  const r = await one<{ total: number; published: number; withheld: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE publishable)::int AS published,
            count(*) FILTER (WHERE NOT publishable)::int AS withheld
       FROM products`,
  );
  return r ?? { total: 0, published: 0, withheld: 0 };
}
