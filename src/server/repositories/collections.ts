/**
 * Collection reads.
 *
 * Membership has two sources: rows in `collection_products`, written by the
 * importer, and `collection_rules`, which describe membership as a condition
 * for collections that are defined rather than curated. Both are read here so
 * callers do not have to know which kind they are looking at.
 */

import { rows, one } from "../db/index.ts";
import { pgTextArray } from "./products.ts";
import type { CollectionRecord } from "./types.ts";

interface CollectionRow {
  handle: string;
  title: string;
  hero_title: string | null;
  eyebrow: string | null;
  description: string | null;
  editorial: (string | null)[] | null;
  theme: string | null;
  kind: string;
  is_hidden: boolean;
  seo_title: string | null;
  seo_description: string | null;
  position: number;
}

const COLUMNS = `handle, title, hero_title, eyebrow, description, editorial,
                 theme, kind, is_hidden, seo_title, seo_description, position`;

const toRecord = (r: CollectionRow): CollectionRecord => ({
  handle: r.handle,
  title: r.title,
  heroTitle: r.hero_title,
  eyebrow: r.eyebrow,
  description: r.description,
  editorial: (r.editorial ?? []).filter((s): s is string => s !== null),
  theme: r.theme,
  kind: r.kind,
  isHidden: r.is_hidden,
  seo: { title: r.seo_title, description: r.seo_description },
  position: r.position,
});

export async function listCollections(): Promise<CollectionRecord[]> {
  const r = await rows<CollectionRow>(
    `SELECT ${COLUMNS} FROM collections ORDER BY position, handle`,
  );
  return r.map(toRecord);
}

export async function getCollection(handle: string): Promise<CollectionRecord | null> {
  const r = await one<CollectionRow>(
    `SELECT ${COLUMNS} FROM collections WHERE handle = $1`,
    [handle],
  );
  return r ? toRecord(r) : null;
}

/** Collection handles per product, in the order the source listed them. */
export async function collectionsByProduct(productIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!productIds.length) return out;

  const r = await rows<{ product_id: string; handle: string }>(
    `SELECT cp.product_id, c.handle
       FROM collection_products cp
       JOIN collections c ON c.id = cp.collection_id
      WHERE cp.product_id = ANY($1::uuid[])
      ORDER BY cp.product_id, cp.position, c.handle`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push(row.handle);
    out.set(row.product_id, list);
  }
  return out;
}

/** Published product handles in a collection, curated order first. */
export async function collectionMembers(handle: string): Promise<string[]> {
  const r = await rows<{ handle: string }>(
    `SELECT p.handle
       FROM collection_products cp
       JOIN collections c ON c.id = cp.collection_id
       JOIN products p    ON p.id = cp.product_id
      WHERE c.handle = $1 AND p.publishable
      ORDER BY cp.position, p.handle`,
    [handle],
  );
  return r.map((x) => x.handle);
}

/**
 * Rule-defined membership. Rules are stored as (field, operator, value) rows
 * and evaluated here against a fixed set of fields, rather than stored as SQL
 * fragments — a rule is data, and data must never become a statement.
 */
export interface CollectionRule {
  field: string;
  operator: string;
  value: unknown;
}

export async function collectionRules(handle: string): Promise<CollectionRule[]> {
  return rows<CollectionRule>(
    `SELECT r.field, r.operator, r.value
       FROM collection_rules r
       JOIN collections c ON c.id = r.collection_id
      WHERE c.handle = $1
      ORDER BY r.field`,
    [handle],
  );
}
