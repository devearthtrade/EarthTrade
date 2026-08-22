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

import type { BrandId, BrandInfo, CategoryId, Collection, CollectionTheme, Product } from "../lib/types.ts";

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

/** A brand as the catalog holds it, before it becomes a `BrandInfo`. */
export interface InputBrand {
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  story: string[];
  theme: string | null;
  collectionHandle: string | null;
  image: { src: string; alt: string } | null;
}

/** A collection as the catalog holds it, membership already resolved. */
export interface InputCollection {
  handle: string;
  title: string;
  heroTitle: string | null;
  eyebrow: string | null;
  description: string | null;
  editorial: string[];
  theme: string | null;
  isHidden: boolean;
  /** Published members, curated order first. */
  productHandles: string[];
  faqs: { question: string; answer: string }[];
  related: string[];
  image: { src: string; alt: string } | null;
}

export interface CatalogInput {
  source: string;
  products: InputProduct[];
  brands: InputBrand[];
  collections: InputCollection[];
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

function toBrandInfo(b: InputBrand): BrandInfo {
  return {
    id: b.slug as BrandId,
    name: b.name,
    // These read as prose on the brand page. An absent one renders as nothing
    // rather than as a sentence nobody wrote.
    tagline: b.tagline ?? "",
    summary: b.summary ?? "",
    story: b.story,
    ...(b.image ? { image: b.image } : {}),
    ...(b.collectionHandle ? { collectionHandle: b.collectionHandle } : {}),
    ...(b.theme ? { theme: b.theme as CollectionTheme } : {}),
  };
}

function toCollection(c: InputCollection): Collection {
  return {
    handle: c.handle,
    title: c.title,
    ...(c.heroTitle ? { heroTitle: c.heroTitle } : {}),
    ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}),
    description: c.description ?? "",
    ...(c.editorial.length ? { editorial: c.editorial } : {}),
    ...(c.image ? { image: c.image } : {}),
    ...(c.theme ? { theme: c.theme as CollectionTheme } : {}),
    productHandles: c.productHandles,
    ...(c.faqs.length ? { faqs: c.faqs.map((f) => ({ q: f.question, a: f.answer })) } : {}),
    ...(c.related.length ? { related: c.related } : {}),
    ...(c.isHidden ? { hidden: true } : {}),
  };
}

export interface Catalog {
  /** Records held back from publication, kept visible and reversible. */
  withheldProducts: InputProduct[];
  products: Product[];
  brands: BrandInfo[];
  collections: Collection[];
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
    brands: input.brands.map(toBrandInfo),
    collections: input.collections.map(toCollection),
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
