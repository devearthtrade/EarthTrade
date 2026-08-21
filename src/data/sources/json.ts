/**
 * The generated JSON catalog as a data source.
 *
 * Postgres is the catalog now. This source is kept so the two can be rendered
 * against each other and compared — a migration you cannot diff is a migration
 * you are taking on faith. Select it with EARTHTRADE_CATALOG_SOURCE=json.
 */

import record from "../generated/catalog.json" with { type: "json" };
import type { CatalogInput, InputProduct } from "../catalog-record.ts";

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

export function loadFromJson(): CatalogInput {
  const raw = record as unknown as { meta: { sources: string[] }; products: JsonProduct[] };

  return {
    source: `json:${raw.meta.sources.join(", ")}`,
    products: raw.products.map((p) => ({
      ...p,
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
