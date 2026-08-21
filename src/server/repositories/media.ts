/**
 * Media reads.
 *
 * Media is addressed by a relative storage key and served from EarthTrade's own
 * assets. A migration constraint keeps absolute URLs out of the table, so no
 * product image can quietly start loading from someone else's CDN.
 */

import { rows } from "../db/index.ts";
import { pgTextArray } from "./products.ts";
import type { MediaRecord, PendingMediaRecord } from "./types.ts";

interface MediaRow {
  product_id: string;
  storage_key: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

/** Storage keys are stored relative; the site serves them from the root. */
const toSrc = (key: string): string => `/${key.replace(/^\/+/, "")}`;

export async function mediaByProduct(
  productIds: string[],
  fallbackAlt: Map<string, string> = new Map(),
): Promise<Map<string, MediaRecord[]>> {
  const out = new Map<string, MediaRecord[]>();
  if (!productIds.length) return out;

  const r = await rows<MediaRow>(
    `SELECT pm.product_id, a.storage_key, pm.alt, a.width, a.height
       FROM product_media pm
       JOIN media_assets a ON a.id = pm.asset_id
      WHERE pm.product_id = ANY($1::uuid[])
      ORDER BY pm.product_id, pm.position, a.storage_key`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push({
      src: toSrc(row.storage_key),
      // An image with no alt text falls back to the product name. That is a
      // real description of the picture, not invented detail.
      alt: row.alt ?? fallbackAlt.get(row.product_id) ?? "",
      width: row.width,
      height: row.height,
    });
    out.set(row.product_id, list);
  }
  return out;
}

/** Images the catalog references but has no file for. Never rendered. */
export async function pendingMediaByProduct(
  productIds: string[],
): Promise<Map<string, PendingMediaRecord[]>> {
  const out = new Map<string, PendingMediaRecord[]>();
  if (!productIds.length) return out;

  const r = await rows<{
    product_id: string;
    storage_key: string;
    alt: string | null;
    source_url: string | null;
  }>(
    `SELECT product_id, storage_key, alt, source_url
       FROM product_pending_media
      WHERE product_id = ANY($1::uuid[]) AND resolved_at IS NULL
      ORDER BY product_id, position`,
    [pgTextArray(productIds)],
  );

  for (const row of r) {
    const list = out.get(row.product_id) ?? [];
    list.push({ path: toSrc(row.storage_key), alt: row.alt, sourceUrl: row.source_url });
    out.set(row.product_id, list);
  }
  return out;
}

/** Products with no image at all, for the catalog completeness report. */
export async function productsWithoutMedia(): Promise<string[]> {
  const r = await rows<{ handle: string }>(
    `SELECT p.handle FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM product_media m WHERE m.product_id = p.id)
      ORDER BY p.handle`,
  );
  return r.map((x) => x.handle);
}
