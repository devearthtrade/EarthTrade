/**
 * Product relationship reads.
 *
 * Relationships are explicit rows, not inferred at read time. Nothing here
 * invents a pairing: if no one has recorded that two products go together, the
 * query returns nothing and the page shows nothing.
 */

import { rows } from "../db/index.ts";
import { pgTextArray } from "./products.ts";
import type { RelationRecord } from "./types.ts";

export async function relationsByProduct(productIds: string[]): Promise<Map<string, RelationRecord[]>> {
  const out = new Map<string, RelationRecord[]>();
  if (!productIds.length) return out;

  const r = await rows<{ product_id: string; handle: string; kind: string; position: number }>(
    `SELECT r.product_id, related.handle, r.kind, r.position
       FROM product_relations r
       JOIN products related ON related.id = r.related_id
      WHERE r.product_id = ANY($1::uuid[]) AND related.publishable
      ORDER BY r.product_id, r.kind, r.position, related.handle`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push({ handle: row.handle, kind: row.kind, position: row.position });
    out.set(row.product_id, list);
  }
  return out;
}

/** Related published products for one product, optionally of one kind. */
export async function relatedTo(handle: string, kind?: string): Promise<RelationRecord[]> {
  const params: unknown[] = [handle];
  const kindClause = kind ? `AND r.kind = $${params.push(kind)}` : "";

  const r = await rows<{ handle: string; kind: string; position: number }>(
    `SELECT related.handle, r.kind, r.position
       FROM product_relations r
       JOIN products p       ON p.id = r.product_id
       JOIN products related ON related.id = r.related_id
      WHERE p.handle = $1 AND related.publishable ${kindClause}
      ORDER BY r.kind, r.position, related.handle`,
    params,
  );
  return r.map((x) => ({ handle: x.handle, kind: x.kind, position: x.position }));
}

/**
 * Products sharing a brand and category, excluding the product itself.
 *
 * A fallback for pages that want something to show when no relationship has
 * been recorded. It is a stated rule — same brand, same category — not a claim
 * that these products are recommended together.
 */
export async function sameBrandAndCategory(handle: string, limit = 4): Promise<string[]> {
  const r = await rows<{ handle: string }>(
    `SELECT other.handle
       FROM products p
       JOIN products other
         ON other.brand_id = p.brand_id
        AND other.category_id IS NOT DISTINCT FROM p.category_id
        AND other.id <> p.id
      WHERE p.handle = $1 AND other.publishable
      ORDER BY other.handle
      LIMIT $2`,
    [handle, limit],
  );
  return r.map((x) => x.handle);
}
