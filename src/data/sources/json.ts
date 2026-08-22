/**
 * The generated JSON catalog as a data source.
 *
 * Postgres is the catalog now. This source is kept so the two can be rendered
 * against each other and compared — a migration you cannot diff is a migration
 * you are taking on faith. Select it with EARTHTRADE_CATALOG_SOURCE=json.
 */

import record from "../generated/catalog.json" with { type: "json" };
import presentation from "../../../db/seed-data/presentation.json" with { type: "json" };
import type { CatalogInput, InputCollection, InputProduct } from "../catalog-record.ts";

interface JsonVariant {
  id: string;
  title: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  weightGrams: number | null;
}

interface JsonProduct extends Omit<InputProduct, "variants" | "searchTerms" | "needsReview"> {
  sourceTags: string[];
  productType: string | null;
  variants: JsonVariant[];
}

interface SeedBrand {
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  story: string[];
  theme: string | null;
  collectionHandle: string | null;
  image: { src: string; alt: string } | null;
}

interface SeedCollection {
  handle: string;
  title: string;
  heroTitle: string | null;
  eyebrow: string | null;
  description: string;
  editorial: string[];
  theme: string | null;
  hidden: boolean;
  curatedProducts: string[];
  faqs: { q: string; a: string }[];
  related: string[];
  image: { src: string; alt: string } | null;
}

/**
 * Rebuilds collection membership the way the storefront used to, before the
 * database resolved it: curated handles first in their chosen order, then
 * members derived from product tags, minus anything already listed. Curated
 * handles that name a product the catalog no longer has are dropped.
 *
 * This exists so that building from JSON and building from PostgreSQL can be
 * compared. It is not a second definition of membership — it is a reproduction
 * of the old one, kept only for the diff.
 */
function membership(c: SeedCollection, products: JsonProduct[]): string[] {
  const published = products.filter((p) => p.publishable);
  const known = new Set(published.map((p) => p.handle));

  const curated = c.curatedProducts.filter((h) => known.has(h));
  const seen = new Set(curated);
  const derived = published
    .filter((p) => p.collections.includes(c.handle) && !seen.has(p.handle))
    .map((p) => p.handle);

  return [...curated, ...derived];
}

/**
 * The collections a product belongs to, matching how the database resolves it:
 * the ones its own tags put it in first, then the ones it was curated into,
 * by handle. A collection reached both ways counts as derived.
 */
function productCollections(p: JsonProduct, seeds: SeedCollection[]): string[] {
  const derived = p.collections;
  const curated = seeds
    .filter((c) => c.curatedProducts.includes(p.handle) && !derived.includes(c.handle))
    .map((c) => c.handle)
    .sort();
  return [...derived, ...curated];
}

export function loadFromJson(): CatalogInput {
  const raw = record as unknown as { meta: { sources: string[] }; products: JsonProduct[] };
  const seed = presentation as unknown as { brands: SeedBrand[]; collections: SeedCollection[] };

  // The imported catalog names collections the presentation file does not
  // describe. They still render, titled from their handle, exactly as the
  // database seeds them.
  const described = new Set(seed.collections.map((c) => c.handle));
  const extra: InputCollection[] = [...new Set(raw.products.flatMap((p) => p.collections))]
    .filter((h) => !described.has(h))
    .map((handle) => ({
      handle,
      title: handle,
      heroTitle: null,
      eyebrow: null,
      description: null,
      editorial: [],
      theme: null,
      // Undescribed, so not presented — the same rule the database applies.
      isHidden: true,
      productHandles: raw.products.filter((p) => p.publishable && p.collections.includes(handle)).map((p) => p.handle),
      faqs: [],
      related: [],
      image: null,
    }));

  return {
    source: `json:${raw.meta.sources.join(", ")}`,
    brands: seed.brands.map((b) => ({
      slug: b.slug,
      name: b.name,
      tagline: b.tagline,
      summary: b.summary,
      story: b.story,
      theme: b.theme,
      collectionHandle: b.collectionHandle,
      image: b.image,
    })),
    collections: [
      ...seed.collections.map((c) => ({
        handle: c.handle,
        title: c.title,
        heroTitle: c.heroTitle,
        eyebrow: c.eyebrow,
        description: c.description,
        editorial: c.editorial,
        theme: c.theme,
        isHidden: c.hidden,
        productHandles: membership(c, raw.products),
        faqs: c.faqs.map((f) => ({ question: f.q, answer: f.a })),
        related: c.related,
        image: c.image,
      })),
      ...extra,
    ],
    products: raw.products.map((p) => ({
      ...p,
      collections: productCollections(p, seed.collections),
      // The export folded review state into status. Postgres keeps the two
      // apart, so it is unfolded here rather than compared against a value
      // that means something different on the other side.
      status: p.status === "needs_review" ? "active" : p.status,
      needsReview: p.status === "needs_review",
      searchTerms: [...p.sourceTags, ...(p.productType ? [p.productType] : [])],
      variants: p.variants.map((v) => ({
        ref: v.id,
        title: v.title,
        sku: v.sku,
        priceCents: v.priceCents,
        compareAtCents: v.compareAtCents,
        weightGrams: v.weightGrams,
        // The JSON export carries no stock figures at all.
        sellable: null,
      })),
    })),
  };
}
