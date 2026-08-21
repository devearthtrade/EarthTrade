/**
 * The catalog as the storefront consumes it, and the one place it is shaped.
 *
 * Everything the templates render is derived here from a `CatalogInput`: money
 * in integer cents, publication already decided, absent fields still absent.
 * Where that input comes from — Postgres in normal operation, the generated
 * JSON when comparing the two — is decided in `imported.ts` and is invisible
 * from here down.
 *
 * Keeping the mapping in a single function is the point. Two sources that each
 * did their own conversion would be two definitions of what a product is, and
 * they would drift.
 */

import type { BrandId, CategoryId, Product } from "../lib/types.ts";

export interface InputVariant {
  ref: string;
  title: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  weightGrams: number | null;
  /** Units sellable, or null when nothing has been counted. */
  sellable?: number | null;
}

export interface InputProduct {
  handle: string;
  title: string;
  brandId: string;
  categoryId: string | null;
  collections: string[];
  searchTerms: string[];
  shortBenefit: string | null;
  description: string[];
  quarantinedContent: { text: string; matches: { reason: string; term: string }[] }[];
  images: { src: string; alt: string }[];
  variants: InputVariant[];
  subscription: boolean;
  priceProvisional: boolean;
  publishable: boolean;
  titleMatches: { reason: string; term: string }[];
  status: string;
  /** Derived from the product's flags, not a state anyone sets by hand. */
  needsReview: boolean;
  flags: string[];
}

export interface CatalogInput {
  source: string;
  products: InputProduct[];
}

const BRANDS = new Set<BrandId>([
  "earthtrade",
  "solutionshocl",
  "life-ionizers",
  "pitcher-of-life",
  "hawaiian-volcanic-organic",
  "life-sciences-water",
]);

const CATEGORIES = new Set<CategoryId>(["water", "cleaning", "gardening", "wellness"]);

/** Cents are authoritative; the display layer still works in dollars. */
const toDollars = (cents: number): number => Math.round(cents) / 100;

function toProduct(p: InputProduct): Product {
  const brand = (BRANDS.has(p.brandId as BrandId) ? p.brandId : "earthtrade") as BrandId;
  const category = (p.categoryId && CATEGORIES.has(p.categoryId as CategoryId)
    ? p.categoryId
    : "water") as CategoryId;

  return {
    handle: p.handle,
    title: p.title,
    brand,
    category,
    collections: p.collections,
    // An empty benefit renders as nothing rather than a fabricated line.
    shortBenefit: p.shortBenefit ?? "",
    description: p.description,
    images: p.images,
    variants: p.variants.map((v) => ({
      id: v.ref,
      title: v.title,
      ...(v.sku ? { sku: v.sku } : {}),
      price: toDollars(v.priceCents),
      ...(v.compareAtCents ? { compareAt: toDollars(v.compareAtCents) } : {}),
      // No stock has been counted for any variant yet. Availability is
      // unresolved and is reported as such rather than guessed at per variant;
      // once inventory exists, `sellable` decides it.
      available: v.sellable === null || v.sellable === undefined ? true : v.sellable > 0,
    })),
    ...(p.subscription ? { subscription: true } : {}),
    // Reuses the existing provisional-price notice for zero or absent prices.
    ...(p.priceProvisional ? { pricePlaceholder: true } : {}),
    searchTerms: [...new Set(p.searchTerms)],
  };
}

export interface Catalog {
  /** Records held back from publication, kept visible and reversible. */
  withheldProducts: InputProduct[];
  products: Product[];
  collectionMembers: Map<string, string[]>;
  meta: {
    source: string;
    total: number;
    published: number;
    withheld: number;
    needsReview: number;
    missingImages: number;
    missingSku: number;
    quarantined: number;
    inventoryKnown: boolean;
  };
  flags: Map<string, string[]>;
}

export function buildCatalog(input: CatalogInput): Catalog {
  const all = input.products;
  const publishable = all.filter((p) => p.publishable);

  const collectionMembers = new Map<string, string[]>();
  for (const p of publishable) {
    for (const c of p.collections) {
      const list = collectionMembers.get(c) ?? [];
      list.push(p.handle);
      collectionMembers.set(c, list);
    }
  }

  return {
    withheldProducts: all.filter((p) => !p.publishable),
    products: publishable.map(toProduct),
    collectionMembers,
    meta: {
      source: input.source,
      total: all.length,
      published: publishable.length,
      withheld: all.length - publishable.length,
      needsReview: all.filter((p) => p.needsReview).length,
      missingImages: all.filter((p) => !p.images.length).length,
      missingSku: all.filter((p) => p.flags.includes("missing_sku")).length,
      quarantined: all.filter((p) => p.quarantinedContent.length).length,
      // Nothing has been stocked yet, so no product's availability is known.
      inventoryKnown: all.some((p) =>
        p.variants.some((v) => v.sellable !== null && v.sellable !== undefined),
      ),
    },
    flags: new Map(all.map((p) => [p.handle, p.flags])),
  };
}
