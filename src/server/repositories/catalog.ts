/**
 * Assembles whole product records from the tables that make them up.
 *
 * The build renders every product, so this reads the catalog in a fixed number
 * of set-based queries — one per child table — rather than one query per
 * product. Adding a product does not add a round trip.
 */

import { listProductRows, publicationCounts, type ProductFilter, type ProductRow } from "./products.ts";
import { variantsByProduct } from "./variants.ts";
import { mediaByProduct, pendingMediaByProduct } from "./media.ts";
import { collectionsByProduct, listCollections } from "./collections.ts";
import { tagsByProduct, searchTermsByProduct } from "./search.ts";
import { relationsByProduct } from "./relations.ts";
import { quarantinedCopyByProduct, titleMatchesByProduct, flagsByProduct } from "./compliance.ts";
import { listBrands } from "./brands.ts";
import type { CollectionRecord, ProductRecord } from "./types.ts";

function assemble(
  row: ProductRow,
  parts: {
    variants: Map<string, ProductRecord["variants"]>;
    media: Map<string, ProductRecord["images"]>;
    pending: Map<string, ProductRecord["pendingImages"]>;
    collections: Map<string, string[]>;
    tags: Map<string, string[]>;
    terms: Map<string, string[]>;
    relations: Map<string, ProductRecord["relations"]>;
    quarantined: Map<string, ProductRecord["quarantinedContent"]>;
    titleMatches: Map<string, ProductRecord["titleMatches"]>;
    flags: Map<string, string[]>;
  },
): ProductRecord {
  const id = row.id;
  const tags = parts.tags.get(id) ?? [];

  return {
    handle: row.handle,
    title: row.title,
    cardTitle: row.card_title,
    brandId: row.brand_slug,
    categoryId: row.category_slug,
    productType: row.product_type,
    shortBenefit: row.short_benefit,
    description: (row.description ?? []).filter((s): s is string => s !== null),
    seo: { title: row.seo_title, description: row.seo_description },

    collections: parts.collections.get(id) ?? [],
    sourceTags: tags,
    // Tags first, then the product type, then anything recorded separately.
    // Deduplicated but order-preserving, so the search index stays stable.
    searchTerms: [
      ...new Set([
        ...tags,
        ...(row.product_type ? [row.product_type] : []),
        ...(parts.terms.get(id) ?? []),
      ]),
    ],
    images: parts.media.get(id) ?? [],
    pendingImages: parts.pending.get(id) ?? [],
    variants: parts.variants.get(id) ?? [],
    relations: parts.relations.get(id) ?? [],

    subscription: row.subscription_eligible,
    priceProvisional: row.price_provisional,
    publishable: row.publishable,
    withheldReason: row.withheld_reason,
    status: row.status,
    needsReview: row.needs_review,

    quarantinedContent: parts.quarantined.get(id) ?? [],
    titleMatches: parts.titleMatches.get(id) ?? [],
    flags: parts.flags.get(id) ?? [],
  };
}

/** Full product records, ordered by handle. */
export async function loadProducts(filter: ProductFilter = {}): Promise<ProductRecord[]> {
  const productRows = await listProductRows(filter);
  const ids = productRows.map((r) => r.id);
  const altFallback = new Map(productRows.map((r) => [r.id, r.title]));

  const [variants, media, pending, collections, tags, terms, relations, quarantined, titleMatches, flags] =
    await Promise.all([
      variantsByProduct(ids),
      mediaByProduct(ids, altFallback),
      pendingMediaByProduct(ids),
      collectionsByProduct(ids),
      tagsByProduct(ids),
      searchTermsByProduct(ids),
      relationsByProduct(ids),
      quarantinedCopyByProduct(ids),
      titleMatchesByProduct(ids),
      flagsByProduct(ids),
    ]);

  const parts = { variants, media, pending, collections, tags, terms, relations, quarantined, titleMatches, flags };
  return productRows.map((r) => assemble(r, parts));
}

export async function loadProduct(handle: string): Promise<ProductRecord | null> {
  const [p] = await loadProducts({ handles: [handle] });
  return p ?? null;
}

export interface CatalogSnapshot {
  products: ProductRecord[];
  brands: string[];
  collections: CollectionRecord[];
  counts: { total: number; published: number; withheld: number };
}

/** Everything the storefront build needs, in one call. */
export async function loadCatalog(): Promise<CatalogSnapshot> {
  const [products, brandRecords, collections, counts] = await Promise.all([
    loadProducts(),
    listBrands(),
    listCollections(),
    publicationCounts(),
  ]);

  return {
    products,
    brands: brandRecords.map((b) => b.slug),
    collections,
    counts,
  };
}
