/**
 * Search reads.
 *
 * The storefront ships a static search index, so the important query here is
 * the bulk one that supplies its terms. `searchProducts` is the server-side
 * counterpart for the API that will back live search later; it is written now
 * so search has one definition of what matches rather than two that drift.
 */

import { rows } from "../db/index.ts";
import { pgTextArray } from "./products.ts";

/** Source tags per product, in source order. */
export async function tagsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!productIds.length) return out;

  const r = await rows<{ product_id: string; tag: string }>(
    `SELECT product_id, tag
       FROM product_tags
      WHERE product_id = ANY($1::uuid[])
      ORDER BY product_id, position, tag`,
    [pgTextArray(productIds)],
  );
  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push(row.tag);
    out.set(row.product_id, list);
  }
  return out;
}

/** Extra search terms recorded against a product beyond its tags. */
export async function searchTermsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!productIds.length) return out;

  const r = await rows<{ product_id: string; term: string }>(
    `SELECT product_id, term
       FROM product_search_terms
      WHERE product_id = ANY($1::uuid[])
      ORDER BY product_id, term`,
    [pgTextArray(productIds)],
  );
  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push(row.term);
    out.set(row.product_id, list);
  }
  return out;
}

/**
 * Matches published products on name, benefit, type, brand and tags.
 *
 * Matching is literal substring containment via `strpos`, not `ILIKE`. Binding
 * a value as a parameter keeps it out of the SQL, but `ILIKE '%' || $1 || '%'`
 * would still hand it to the pattern matcher, where `%` and `_` are operators:
 * a shopper searching for "100%" would match the entire catalog. `strpos` has
 * no metacharacters, so the search term means exactly what it says.
 *
 * `strpos` over a hundred rows is fine, and cheaper than the alternative of
 * maintaining a full-text index whose notion of relevance would then have to be
 * kept in step with the client-side search index the storefront ships.
 */
export async function searchProducts(term: string, limit = 20): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const r = await rows<{ handle: string }>(
    `SELECT handle FROM (
       SELECT p.handle,
              CASE
                WHEN lower(p.title) = lower($1) THEN 0
                WHEN strpos(lower(p.title), lower($1)) > 0 THEN 1
                ELSE 2
              END AS rank
         FROM products p
         JOIN brands b ON b.id = p.brand_id
        WHERE p.publishable
          AND (
            strpos(lower(p.title), lower($1)) > 0
            OR strpos(lower(coalesce(p.short_benefit, '')), lower($1)) > 0
            OR strpos(lower(coalesce(p.product_type, '')), lower($1)) > 0
            OR strpos(lower(b.name), lower($1)) > 0
            OR EXISTS (
              SELECT 1 FROM product_tags t
               WHERE t.product_id = p.id AND strpos(lower(t.tag::text), lower($1)) > 0
            )
          )
     ) ranked
     ORDER BY rank, handle
     LIMIT $2`,
    [trimmed, limit],
  );
  return r.map((x) => x.handle);
}
