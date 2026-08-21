/**
 * PostgreSQL as the catalog source.
 *
 * The database is the catalog. This reads it once through the repository layer
 * and hands back a plain record, then releases the connections — a static build
 * reads the catalog a single time and then renders for a while, so holding
 * sockets open for the rest of the process would keep it from exiting.
 */

import { loadCatalog } from "../../server/repositories/catalog.ts";
import { close } from "../../server/db/index.ts";
import { dbConfig } from "../../server/db/config.ts";
import type { CatalogInput } from "../catalog-record.ts";

export async function loadFromPostgres(): Promise<CatalogInput> {
  const cfg = dbConfig();
  try {
    const snapshot = await loadCatalog();

    return {
      source: `postgres://${cfg.host}:${cfg.port}/${cfg.database}`,
      products: snapshot.products.map((p) => ({
        handle: p.handle,
        title: p.title,
        brandId: p.brandId,
        categoryId: p.categoryId,
        collections: p.collections,
        searchTerms: p.searchTerms,
        shortBenefit: p.shortBenefit,
        description: p.description,
        quarantinedContent: p.quarantinedContent,
        images: p.images.map((i) => ({ src: i.src, alt: i.alt })),
        variants: p.variants.map((v) => ({
          ref: v.ref,
          title: v.title,
          sku: v.sku,
          priceCents: v.priceCents,
          compareAtCents: v.compareAtCents,
          weightGrams: v.weightGrams,
          sellable: v.sellable,
        })),
        subscription: p.subscription,
        priceProvisional: p.priceProvisional,
        publishable: p.publishable,
        titleMatches: p.titleMatches,
        status: p.status,
        needsReview: p.needsReview,
        flags: p.flags,
      })),
    };
  } finally {
    await close();
  }
}
