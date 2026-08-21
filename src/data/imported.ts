/**
 * Adapter over the generated catalog record.
 *
 * `generated/catalog.json` is the canonical catalog: money in integer cents,
 * EarthTrade-native variant ids, one row per product, shaped to map straight
 * onto Postgres tables when the backend lands. This module is the only place
 * that translates it into the `Product` shape the templates already render, so
 * presentation components never learn where the data came from.
 *
 * Nothing here invents product facts. Fields absent from the import stay
 * absent: no badges, no bundled relationships, no specs, no stock figures.
 */

import type { BrandId, CategoryId, Product } from "../lib/types.ts";
import record from "./generated/catalog.json" with { type: "json" };

interface ImportedVariant {
  id: string;
  title: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  weightGrams: number | null;
}

interface ImportedProduct {
  handle: string;
  title: string;
  brandId: string;
  categoryId: string | null;
  collections: string[];
  sourceTags: string[];
  productType: string | null;
  shortBenefit: string | null;
  description: string[];
  quarantinedContent: { text: string; matches: { reason: string; term: string }[] }[];
  images: { src: string; alt: string }[];
  pendingImages: { path: string; alt: string | null; sourceUrl: string }[];
  variants: ImportedVariant[];
  subscription: boolean;
  priceProvisional: boolean;
  publishable: boolean;
  titleMatches: { reason: string; term: string }[];
  status: "active" | "needs_review";
  flags: string[];
}

const raw = record as unknown as {
  meta: { source: string; importedProducts: number };
  brands: string[];
  collections: string[];
  products: ImportedProduct[];
};

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

function toProduct(p: ImportedProduct): Product {
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
      id: v.id,
      title: v.title,
      ...(v.sku ? { sku: v.sku } : {}),
      price: toDollars(v.priceCents),
      ...(v.compareAtCents ? { compareAt: toDollars(v.compareAtCents) } : {}),
      // The import carries no stock figures. Availability is unresolved, and
      // is reported as such rather than guessed at per variant.
      available: true,
    })),
    ...(p.subscription ? { subscription: true } : {}),
    // Reuses the existing provisional-price notice for zero or absent prices.
    ...(p.priceProvisional ? { pricePlaceholder: true } : {}),
    searchTerms: [...new Set([...p.sourceTags, ...(p.productType ? [p.productType] : [])])],
  };
}

/**
 * Records held back from publication: a title stating a banned claim, or no
 * price to sell at. They stay in `generated/catalog.json` and in the import
 * report so the decision is visible and reversible, but they do not render.
 */
export const withheldProducts = raw.products.filter((p) => !p.publishable);

const publishable = raw.products.filter((p) => p.publishable);

export const importedProducts: Product[] = publishable.map(toProduct);

/** Collection membership derived from the source tags, keyed by handle. */
export const importedCollectionMembers = new Map<string, string[]>();
for (const p of publishable) {
  for (const c of p.collections) {
    const list = importedCollectionMembers.get(c) ?? [];
    list.push(p.handle);
    importedCollectionMembers.set(c, list);
  }
}

/** Counts the review report and the build banner read from. */
export const importMeta = {
  source: raw.meta.source,
  total: raw.products.length,
  published: publishable.length,
  withheld: withheldProducts.length,
  needsReview: raw.products.filter((p) => p.status === "needs_review").length,
  missingImages: raw.products.filter((p) => !p.images.length).length,
  missingSku: raw.products.filter((p) => p.flags.includes("missing_sku")).length,
  quarantined: raw.products.filter((p) => p.quarantinedContent.length).length,
  inventoryKnown: false,
};

export const importedFlags = new Map<string, string[]>(
  raw.products.map((p) => [p.handle, p.flags]),
);
