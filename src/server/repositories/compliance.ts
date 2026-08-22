/**
 * Compliance reads, and the write-side screen.
 *
 * The screening rules themselves live in `src/lib/compliance.ts` and are shared
 * with the CSV importer. This module is the database-facing half: it reads what
 * a past screen decided, and offers `screenProduct` for anything that creates or
 * edits a product later, so copy entered by hand goes through exactly the same
 * check as copy that arrived in a spreadsheet.
 *
 * Nothing here softens a decision. A block of copy that failed screening is
 * stored, not deleted, so the reason stays auditable and reversible — but it is
 * kept out of what renders.
 */

import { rows } from "../db/index.ts";
import { pgTextArray } from "./products.ts";
import { screenCopy, screenTitle, type ComplianceMatch } from "../../lib/compliance.ts";
import type { ComplianceMatchRecord, QuarantinedBlockRecord } from "./types.ts";

export async function quarantinedCopyByProduct(
  productIds: string[],
): Promise<Map<string, QuarantinedBlockRecord[]>> {
  const out = new Map<string, QuarantinedBlockRecord[]>();
  if (!productIds.length) return out;

  const r = await rows<{ product_id: string; body: string; matches: ComplianceMatchRecord[] | null }>(
    `SELECT product_id, body, matches
       FROM product_quarantined_copy
      WHERE product_id = ANY($1::uuid[]) AND resolved_at IS NULL
      ORDER BY product_id, position`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push({ text: row.body, matches: row.matches ?? [] });
    out.set(row.product_id, list);
  }
  return out;
}

export async function titleMatchesByProduct(
  productIds: string[],
): Promise<Map<string, ComplianceMatchRecord[]>> {
  const out = new Map<string, ComplianceMatchRecord[]>();
  if (!productIds.length) return out;

  const r = await rows<{ product_id: string; term: string; reason: string }>(
    `SELECT product_id, term, reason
       FROM product_title_matches
      WHERE product_id = ANY($1::uuid[])
      ORDER BY product_id, term`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push({ term: row.term, reason: row.reason });
    out.set(row.product_id, list);
  }
  return out;
}

export async function flagsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!productIds.length) return out;

  const r = await rows<{ product_id: string; flag: string }>(
    `SELECT product_id, flag
       FROM product_flags
      WHERE product_id = ANY($1::uuid[]) AND resolved_at IS NULL
      ORDER BY product_id, flag`,
    [pgTextArray(productIds)],
  );
  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push(row.flag);
    out.set(row.product_id, list);
  }
  return out;
}

/* ------------------------------- write side ------------------------------ */

export interface ScreenedProduct {
  /** Copy that passed and may be published. */
  description: string[];
  /** Copy that failed, with the terms that failed it. */
  quarantined: { text: string; matches: ComplianceMatch[] }[];
  titleMatches: ComplianceMatch[];
  /** False when the name itself states a claim that cannot be published. */
  publishable: boolean;
  withheldReason: string | null;
}

/**
 * Screens a product's copy for a brand. This is the function the Admin
 * Dashboard must call before writing a product; skipping it would let
 * hand-entered copy bypass a check every imported product passed through.
 */
export function screenProduct(input: {
  title: string;
  description: string[];
  brandId: string;
}): ScreenedProduct {
  const copy = screenCopy(input.description, input.brandId);
  const titleMatches = screenTitle(input.title, input.brandId);

  return {
    description: copy.clean,
    quarantined: copy.quarantined,
    titleMatches,
    publishable: titleMatches.length === 0,
    withheldReason: titleMatches.length
      ? `Product name states a banned claim: ${titleMatches.map((m) => m.term).join(", ")}`
      : null,
  };
}

/** Counts for the compliance section of the catalog report. */
export async function complianceSummary(): Promise<{
  productsWithQuarantinedCopy: number;
  quarantinedBlocks: number;
  productsWithBannedTitles: number;
  withheldForTitle: number;
  withheldForPrice: number;
}> {
  const r = await rows<Record<string, number>>(
    `SELECT
       (SELECT count(DISTINCT product_id)::int FROM product_quarantined_copy WHERE resolved_at IS NULL) AS q_products,
       (SELECT count(*)::int FROM product_quarantined_copy WHERE resolved_at IS NULL) AS q_blocks,
       (SELECT count(DISTINCT product_id)::int FROM product_title_matches) AS t_products,
       (SELECT count(*)::int FROM products WHERE NOT publishable AND withheld_reason LIKE 'Product name%') AS w_title,
       (SELECT count(*)::int FROM products WHERE NOT publishable AND withheld_reason LIKE 'Price%') AS w_price`,
  );
  const x = r[0] ?? {};
  return {
    productsWithQuarantinedCopy: x["q_products"] ?? 0,
    quarantinedBlocks: x["q_blocks"] ?? 0,
    productsWithBannedTitles: x["t_products"] ?? 0,
    withheldForTitle: x["w_title"] ?? 0,
    withheldForPrice: x["w_price"] ?? 0,
  };
}
