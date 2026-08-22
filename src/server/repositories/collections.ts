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
import type { CollectionFaqRecord, CollectionMemberRecord, CollectionRecord } from "./types.ts";

interface CollectionRow {
  handle: string;
  title: string;
  hero_title: string | null;
  eyebrow: string | null;
  description: string | null;
  editorial: (string | null)[] | null;
  theme: string | null;
  kind: string;
  role: string;
  is_hidden: boolean;
  seo_title: string | null;
  seo_description: string | null;
  image_key: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  position: number;
}

const COLUMNS = `
  c.handle, c.title, c.hero_title, c.eyebrow, c.description, c.editorial,
  c.theme, c.kind, c.role, c.is_hidden, c.seo_title, c.seo_description, c.position,
  a.storage_key AS image_key,
  c.image_alt   AS image_alt,
  a.width       AS image_width,
  a.height      AS image_height`;

const FROM = `FROM collections c LEFT JOIN media_assets a ON a.id = c.image_id`;

const toRecord = (
  r: CollectionRow,
  faqs: CollectionFaqRecord[],
  related: string[],
): CollectionRecord => ({
  handle: r.handle,
  title: r.title,
  heroTitle: r.hero_title,
  eyebrow: r.eyebrow,
  description: r.description,
  editorial: (r.editorial ?? []).filter((s): s is string => s !== null),
  theme: r.theme,
  kind: r.kind,
  role: r.role,
  isHidden: r.is_hidden,
  seo: { title: r.seo_title, description: r.seo_description },
  image: r.image_key
    ? {
        src: `/${r.image_key.replace(/^\/+/, "")}`,
        alt: r.image_alt ?? r.title,
        width: r.image_width,
        height: r.image_height,
      }
    : null,
  faqs,
  related,
  position: r.position,
});

/** FAQs for every collection, keyed by handle. */
async function allFaqs(): Promise<Map<string, CollectionFaqRecord[]>> {
  const r = await rows<{ handle: string; question: string; answer: string }>(
    `SELECT c.handle, f.question, f.answer
       FROM collection_faqs f JOIN collections c ON c.id = f.collection_id
      ORDER BY c.handle, f.position`,
  );
  const out = new Map<string, CollectionFaqRecord[]>();
  for (const x of r) {
    const list = out.get(x.handle) ?? [];
    list.push({ question: x.question, answer: x.answer });
    out.set(x.handle, list);
  }
  return out;
}

/** Related-collection handles for every collection, keyed by handle. */
async function allRelated(): Promise<Map<string, string[]>> {
  const r = await rows<{ handle: string; related: string }>(
    `SELECT c.handle, rel.handle AS related
       FROM collection_relations cr
       JOIN collections c   ON c.id = cr.collection_id
       JOIN collections rel ON rel.id = cr.related_id
      ORDER BY c.handle, cr.position`,
  );
  const out = new Map<string, string[]>();
  for (const x of r) {
    const list = out.get(x.handle) ?? [];
    list.push(x.related);
    out.set(x.handle, list);
  }
  return out;
}

export async function listCollections(): Promise<CollectionRecord[]> {
  const [r, faqs, related] = await Promise.all([
    rows<CollectionRow>(`SELECT ${COLUMNS} ${FROM} ORDER BY c.position, c.handle`),
    allFaqs(),
    allRelated(),
  ]);
  return r.map((x) => toRecord(x, faqs.get(x.handle) ?? [], related.get(x.handle) ?? []));
}

export async function getCollection(handle: string): Promise<CollectionRecord | null> {
  const r = await one<CollectionRow>(`SELECT ${COLUMNS} ${FROM} WHERE c.handle = $1`, [handle]);
  if (!r) return null;

  const [faqs, related] = await Promise.all([
    rows<CollectionFaqRecord>(
      `SELECT f.question, f.answer FROM collection_faqs f
         JOIN collections c ON c.id = f.collection_id
        WHERE c.handle = $1 ORDER BY f.position`,
      [handle],
    ),
    rows<{ handle: string }>(
      `SELECT rel.handle FROM collection_relations cr
         JOIN collections c   ON c.id = cr.collection_id
         JOIN collections rel ON rel.id = cr.related_id
        WHERE c.handle = $1 ORDER BY cr.position`,
      [handle],
    ),
  ]);
  return toRecord(r, faqs, related.map((x) => x.handle));
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
      -- Collections the product's own tags put it in come first: they say what
      -- the product is, which is what a breadcrumb should name. Curated-only
      -- memberships follow.
      ORDER BY cp.product_id, NOT cp.is_derived, cp.product_position, c.handle`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push(row.handle);
    out.set(row.product_id, list);
  }
  return out;
}

/**
 * Published product handles in a collection.
 *
 * Curated rows first, in the order someone chose; derived rows behind them, in
 * the order the import produced. This is the whole of membership — the union
 * the storefront used to assemble in code is now one ordered query.
 */
export async function collectionMembers(handle: string): Promise<string[]> {
  const r = await rows<{ handle: string }>(
    `SELECT p.handle
       FROM collection_products cp
       JOIN collections c ON c.id = cp.collection_id
       JOIN products p    ON p.id = cp.product_id
      WHERE c.handle = $1 AND p.publishable
      ORDER BY NOT cp.is_curated, cp.collection_position, p.handle`,
    [handle],
  );
  return r.map((x) => x.handle);
}

/**
 * Everything in a collection, published or not, with how each product came to
 * be there. This is the admin's view — the storefront only ever sees the
 * published members, in order.
 */
export async function collectionMembership(handle: string): Promise<CollectionMemberRecord[]> {
  const r = await rows<{
    handle: string; title: string; is_curated: boolean; is_derived: boolean;
    collection_position: number; publishable: boolean;
  }>(
    `SELECT p.handle, p.title, cp.is_curated, cp.is_derived, cp.collection_position, p.publishable
       FROM collection_products cp
       JOIN collections c ON c.id = cp.collection_id
       JOIN products p    ON p.id = cp.product_id
      WHERE c.handle = $1
      ORDER BY NOT cp.is_curated, cp.collection_position, p.handle`,
    [handle],
  );
  return r.map((x) => ({
    handle: x.handle,
    title: x.title,
    isCurated: x.is_curated,
    isDerived: x.is_derived,
    position: x.collection_position,
    publishable: x.publishable,
  }));
}

/** Membership for every collection at once, for the build. */
export async function allCollectionMembers(): Promise<Map<string, string[]>> {
  const r = await rows<{ collection: string; handle: string }>(
    `SELECT c.handle AS collection, p.handle
       FROM collection_products cp
       JOIN collections c ON c.id = cp.collection_id
       JOIN products p    ON p.id = cp.product_id
      WHERE p.publishable
      ORDER BY c.handle, NOT cp.is_curated, cp.collection_position, p.handle`,
  );
  const out = new Map<string, string[]>();
  for (const x of r) {
    const list = out.get(x.collection) ?? [];
    list.push(x.handle);
    out.set(x.collection, list);
  }
  return out;
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
