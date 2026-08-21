/**
 * Publication status.
 *
 * `publishable` is a separate column from `status` on purpose. A product can be
 * active, complete and correct and still be held back — because its name states
 * a claim that cannot be published, or because it has no price to sell at.
 * Collapsing the two would make a compliance decision look like a lifecycle
 * state, and the reason for holding it back would be lost.
 *
 * Withheld products stay in the database and in the reports. They are visible
 * to whoever can fix them, and invisible to shoppers.
 */

import { rows } from "../db/index.ts";

export interface WithheldProduct {
  handle: string;
  title: string;
  brandId: string;
  reason: string;
}

export async function withheldProducts(): Promise<WithheldProduct[]> {
  const r = await rows<{ handle: string; title: string; brand: string; withheld_reason: string }>(
    `SELECT p.handle, p.title, b.slug AS brand, p.withheld_reason
       FROM products p
       JOIN brands b ON b.id = p.brand_id
      WHERE NOT p.publishable
      ORDER BY p.handle`,
  );
  return r.map((x) => ({
    handle: x.handle,
    title: x.title,
    brandId: x.brand,
    reason: x.withheld_reason,
  }));
}

/** True when a product may render on the storefront. */
export async function isPublished(handle: string): Promise<boolean> {
  const r = await rows<{ publishable: boolean }>(
    `SELECT publishable FROM products WHERE handle = $1`,
    [handle],
  );
  return r[0]?.publishable ?? false;
}

/** Why each withheld product is withheld, grouped by reason. */
export async function withheldReasons(): Promise<Map<string, number>> {
  const r = await rows<{ withheld_reason: string; n: number }>(
    `SELECT withheld_reason, count(*)::int AS n
       FROM products WHERE NOT publishable
      GROUP BY withheld_reason ORDER BY n DESC, withheld_reason`,
  );
  return new Map(r.map((x) => [x.withheld_reason, x.n]));
}
