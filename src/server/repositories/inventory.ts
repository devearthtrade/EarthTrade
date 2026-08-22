/**
 * Inventory reads.
 *
 * Three states, and the reads keep them apart: `unknown` when no level row
 * exists, `zero` when one says none, `positive` otherwise. Nothing here
 * coalesces a missing row to zero — that would erase the distinction the whole
 * design exists to preserve.
 */

import { rows } from "../db/index.ts";
import { pgTextArray } from "./products.ts";

export type StockState = "unknown" | "zero" | "positive";

export interface StockRecord {
  variantRef: string;
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  state: StockState;
  onHand: number | null;
  reserved: number | null;
  sellable: number | null;
  locationCode: string | null;
}

interface Row {
  ref: string;
  handle: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  on_hand: number | null;
  reserved: number | null;
  sellable: number | null;
  location_code: string | null;
}

const SELECT = `
  SELECT v.ref, p.handle, p.title AS product_title, v.title AS variant_title, v.sku,
         l.on_hand, l.reserved,
         CASE WHEN l.variant_id IS NULL THEN NULL ELSE inventory_sellable(l) END AS sellable,
         loc.code AS location_code
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    LEFT JOIN inventory_levels l ON l.variant_id = v.id
    LEFT JOIN inventory_locations loc ON loc.id = l.location_id`;

const toRecord = (r: Row): StockRecord => ({
  variantRef: r.ref,
  productHandle: r.handle,
  productTitle: r.product_title,
  variantTitle: r.variant_title,
  sku: r.sku,
  // The absence of a row is the fact, not a missing value to fill in.
  state: r.on_hand === null ? "unknown" : r.on_hand > 0 ? "positive" : "zero",
  onHand: r.on_hand,
  reserved: r.reserved,
  sellable: r.sellable,
  locationCode: r.location_code,
});

export interface StockFilter {
  state?: StockState;
  productHandle?: string;
  limit?: number;
  offset?: number;
}

export async function listStock(filter: StockFilter = {}): Promise<StockRecord[]> {
  const where: string[] = ["v.is_active"];
  const params: unknown[] = [];
  const bind = (v: unknown): string => `$${params.push(v)}`;

  if (filter.productHandle) where.push(`p.handle = ${bind(filter.productHandle)}`);
  if (filter.state === "unknown") where.push(`l.variant_id IS NULL`);
  if (filter.state === "zero") where.push(`l.on_hand = 0`);
  if (filter.state === "positive") where.push(`l.on_hand > 0`);

  const limit = bind(Math.min(filter.limit ?? 100, 500));
  const offset = bind(filter.offset ?? 0);

  const r = await rows<Row>(
    `${SELECT} WHERE ${where.join(" AND ")}
      ORDER BY p.handle, v.position
      LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return r.map(toRecord);
}

export async function stockFor(ref: string): Promise<StockRecord | null> {
  const r = await rows<Row>(`${SELECT} WHERE v.ref = $1`, [ref]);
  return r[0] ? toRecord(r[0]) : null;
}

export async function stockByVariantRefs(refs: string[]): Promise<Map<string, StockRecord>> {
  if (!refs.length) return new Map();
  const r = await rows<Row>(`${SELECT} WHERE v.ref = ANY($1::text[])`, [pgTextArray(refs)]);
  return new Map(r.map((x) => [x.ref, toRecord(x)]));
}

/** How many variants sit in each state. The headline number for the dashboard. */
export async function stockSummary(): Promise<{
  unknown: number;
  zero: number;
  positive: number;
  total: number;
}> {
  const [row] = await rows<{ unknown: number; zero: number; positive: number; total: number }>(
    `SELECT count(*) FILTER (WHERE l.variant_id IS NULL)::int AS unknown,
            count(*) FILTER (WHERE l.on_hand = 0)::int        AS zero,
            count(*) FILTER (WHERE l.on_hand > 0)::int        AS positive,
            count(*)::int                                     AS total
       FROM product_variants v
       LEFT JOIN inventory_levels l ON l.variant_id = v.id
      WHERE v.is_active`,
  );
  return row ?? { unknown: 0, zero: 0, positive: 0, total: 0 };
}

export async function listLocations(): Promise<{ code: string; name: string; isActive: boolean }[]> {
  const r = await rows<{ code: string; name: string; is_active: boolean }>(
    `SELECT code, name, is_active FROM inventory_locations ORDER BY code`,
  );
  return r.map((x) => ({ code: x.code, name: x.name, isActive: x.is_active }));
}

/** Recent movements for a variant, newest first. */
export async function movementsFor(ref: string, limit = 50) {
  return rows<{ delta: number; reason: string; note: string | null; created_at: Date }>(
    `SELECT m.delta, m.reason, m.note, m.created_at
       FROM inventory_movements m JOIN product_variants v ON v.id = m.variant_id
      WHERE v.ref = $1 ORDER BY m.created_at DESC LIMIT $2`,
    [ref, limit],
  );
}
