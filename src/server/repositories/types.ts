/**
 * Record shapes returned by the repositories.
 *
 * These describe the catalog as EarthTrade owns it: money in integer cents,
 * publication separate from status, absence represented as null rather than as
 * a stand-in value. Nothing here is shaped for a template — mapping to what a
 * page renders happens above this layer.
 */

export interface BrandRecord {
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  story: string[];
  theme: string | null;
  /** The collection this brand's page links to, if it has one. */
  collectionHandle: string | null;
  image: MediaRecord | null;
  position: number;
}

export interface CategoryRecord {
  slug: string;
  name: string;
  parentSlug: string | null;
  position: number;
}

export interface VariantRecord {
  /** Public identifier, stable across reseeds. Used in carts and URLs. */
  ref: string;
  title: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  weightGrams: number | null;
  barcode: string | null;
  requiresShipping: boolean;
  taxable: boolean;
  /**
   * Units available to sell, or null when no inventory has been recorded.
   * Null is not zero: it means unknown, and the storefront says so rather than
   * claiming a product is out of stock.
   */
  sellable: number | null;
}

export interface MediaRecord {
  /** Site-root-relative path. Media is served by EarthTrade, not a third party. */
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** An image the catalog references but that has no file yet. */
export interface PendingMediaRecord {
  path: string;
  alt: string | null;
  sourceUrl: string | null;
}

export interface ComplianceMatchRecord {
  term: string;
  reason: string;
}

export interface QuarantinedBlockRecord {
  text: string;
  matches: ComplianceMatchRecord[];
}

export interface RelationRecord {
  handle: string;
  kind: string;
  position: number;
}

export interface ProductRecord {
  handle: string;
  title: string;
  cardTitle: string | null;
  brandId: string;
  categoryId: string | null;
  productType: string | null;
  shortBenefit: string | null;
  description: string[];
  seo: { title: string | null; description: string | null };

  collections: string[];
  sourceTags: string[];
  searchTerms: string[];
  images: MediaRecord[];
  pendingImages: PendingMediaRecord[];
  variants: VariantRecord[];
  relations: RelationRecord[];

  subscription: boolean;
  priceProvisional: boolean;
  /** False when the product is held back from the storefront. */
  publishable: boolean;
  withheldReason: string | null;
  /** Lifecycle state: draft, active or archived. */
  status: string;
  /**
   * True when a person has to look at this product before it is fit to
   * publish. Derived from its flags by the product_review_state view, never
   * stored — clearing it means fixing the flag, not overwriting a column.
   */
  needsReview: boolean;

  quarantinedContent: QuarantinedBlockRecord[];
  titleMatches: ComplianceMatchRecord[];
  flags: string[];
}

export interface CollectionFaqRecord {
  question: string;
  answer: string;
}

export interface CollectionRecord {
  handle: string;
  title: string;
  heroTitle: string | null;
  eyebrow: string | null;
  description: string | null;
  editorial: string[];
  theme: string | null;
  /** How membership is decided: manual rows, or a rule. */
  kind: string;
  /** What the collection is: a category, a brand, or merchandising. */
  role: string;
  isHidden: boolean;
  seo: { title: string | null; description: string | null };
  image: MediaRecord | null;
  faqs: CollectionFaqRecord[];
  /** Handles of collections this one points at. Directed, not mutual. */
  related: string[];
  position: number;
}
