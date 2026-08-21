/**
 * Variant reads, including sellable stock.
 *
 * Availability is the subtle part. A variant with no inventory row is not out
 * of stock — nothing has been counted yet. That distinction is carried through
 * as `null` rather than collapsed to zero, because telling a shopper an item is
 * unavailable when nobody has checked is a lie in the expensive direction.
 */

import { rows } from "../db/index.ts";
import { pgTextArray } from "./products.ts";
import type { VariantRecord } from "./types.ts";

interface VariantRow {
  product_id: string;
  ref: string;
  title: string;
  sku: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  currency: string;
  weight_grams: number | null;
  barcode: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  sellable: number | null;
}

const COLUMNS = `
  v.product_id,
  v.ref,
  v.title,
  v.sku,
  v.price_cents,
  v.compare_at_cents,
  v.currency,
  v.weight_grams,
  v.barcode,
  v.requires_shipping,
  v.taxable,
  -- No inventory row means unknown, and sums to NULL rather than to 0.
  (SELECT sum(inventory_sellable(l))::int
     FROM inventory_levels l WHERE l.variant_id = v.id) AS sellable`;

const toRecord = (r: VariantRow): VariantRecord => ({
  ref: r.ref,
  title: r.title,
  sku: r.sku,
  priceCents: r.price_cents,
  compareAtCents: r.compare_at_cents,
  currency: r.currency.trim(),
  weightGrams: r.weight_grams,
  barcode: r.barcode,
  requiresShipping: r.requires_shipping,
  taxable: r.taxable,
  sellable: r.sellable,
});

/** Variants for many products at once, grouped by internal product id. */
export async function variantsByProduct(productIds: string[]): Promise<Map<string, VariantRecord[]>> {
  const out = new Map<string, VariantRecord[]>();
  if (!productIds.length) return out;

  const r = await rows<VariantRow>(
    `SELECT ${COLUMNS}
       FROM product_variants v
      WHERE v.product_id = ANY($1::uuid[]) AND v.is_active
      ORDER BY v.product_id, v.position, v.ref`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push(toRecord(row));
    out.set(row.product_id, list);
  }
  return out;
}

/** One variant by its public reference — the identifier a cart holds. */
export async function getVariantByRef(
  ref: string,
): Promise<(VariantRecord & { productHandle: string }) | null> {
  const r = await rows<VariantRow & { handle: string }>(
    `SELECT ${COLUMNS}, p.handle
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
      WHERE v.ref = $1`,
    [ref],
  );
  const row = r[0];
  return row ? { ...toRecord(row), productHandle: row.handle } : null;
}

/**
 * Authoritative prices for a set of variant references.
 *
 * This exists for the checkout that will be built later. Prices for an order
 * are read here, from the database, never taken from the request — the browser
 * is not a source of truth about what something costs.
 */
export async function priceVariants(
  refs: string[],
): Promise<Map<string, { priceCents: number; currency: string; sellable: number | null }>> {
  const out = new Map<string, { priceCents: number; currency: string; sellable: number | null }>();
  if (!refs.length) return out;

  const r = await rows<VariantRow>(
    `SELECT ${COLUMNS} FROM product_variants v WHERE v.ref = ANY($1::text[]) AND v.is_active`,
    [pgTextArray(refs)],
  );
  for (const row of r) {
    out.set(row.ref, {
      priceCents: row.price_cents,
      currency: row.currency.trim(),
      sellable: row.sellable,
    });
  }
  return out;
}
