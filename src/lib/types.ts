/** Domain model for the EarthTrade storefront. Shapes mirror Shopify objects
 *  (handles, GIDs, variants) so the data layer can later be swapped for live
 *  Storefront API queries without touching templates. */

export type BrandId =
  | "earthtrade"
  | "solutionshocl"
  | "life-ionizers"
  | "pitcher-of-life"
  | "hawaiian-volcanic-organic"
  | "life-sciences-water";

export type CategoryId = "water" | "cleaning" | "gardening" | "wellness";

export type Badge =
  | "best-seller"
  | "new"
  | "premium"
  | "organic"
  | "popular"
  | "subscription";

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku?: string;
  price: number;
  compareAt?: number;
  available: boolean;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Product {
  handle: string;
  title: string;
  /** Short display title for cards where the full title is too long. */
  cardTitle?: string;
  brand: BrandId;
  category: CategoryId;
  /** Collection handles this product belongs to. */
  collections: string[];
  /** One-line benefit shown on product cards. */
  shortBenefit: string;
  /** Overview paragraphs. */
  description: string[];
  benefits?: string[];
  howItWorks?: string[];
  specs?: [string, string][];
  included?: string[];
  howToUse?: string[];
  faqs?: FaqItem[];
  images: ProductImage[];
  variants: ProductVariant[];
  badges?: Badge[];
  /** Subscribe & Save / autoship available for this product. */
  subscription?: boolean;
  /** Replenishment guidance for consumables ("Never Run Out"). */
  replenish?: { intervalDays: number; note: string };
  /** Required compliance line (cistern & catchment products only). */
  disclaimer?: string;
  related?: string[];
  boughtWith?: string[];
  /** Shopify product GID when the product exists in a connected store. */
  shopifyId?: string;
  /**
   * True when the price shown is a representative placeholder pending
   * catalog sync (brands whose live store was not reachable at build time).
   * SolutionsHOCL and HVO prices come from the live Shopify store.
   */
  pricePlaceholder?: boolean;
  /** Extra terms folded into the search index (model numbers, problems). */
  searchTerms?: string[];
}

export type CollectionTheme = "light" | "dark" | "volcanic" | "bright" | "clean";

export interface Collection {
  handle: string;
  title: string;
  /** Editorial H1 for the collection hero (defaults to title). */
  heroTitle?: string;
  eyebrow?: string;
  description: string;
  /** Longer editorial intro under the product grid. */
  editorial?: string[];
  image?: ProductImage;
  theme?: CollectionTheme;
  productHandles: string[];
  faqs?: FaqItem[];
  related?: string[];
  /** Hide from navigation/related listings (utility collections). */
  hidden?: boolean;
}

export interface BrandInfo {
  id: BrandId;
  name: string;
  tagline: string;
  summary: string;
  story: string[];
  image?: ProductImage;
  collectionHandle?: string;
  theme?: CollectionTheme;
}

export type ArticleCategory =
  | "water"
  | "rainwater"
  | "home"
  | "gardening"
  | "sustainability"
  | "guides";

export interface Article {
  slug: string;
  title: string;
  category: ArticleCategory;
  excerpt: string;
  date: string; // YYYY-MM-DD
  readingMinutes: number;
  image?: ProductImage;
  /** Body as HTML string (built with the html helper in the data module). */
  body: string;
}

export interface Bundle {
  handle: string;
  title: string;
  tagline: string;
  description: string;
  productHandles: string[];
  /** Whole-bundle savings note, only when derivable from real prices. */
  note?: string;
}

export interface NavColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface NavItem {
  label: string;
  href: string;
  columns?: NavColumn[];
  /** Featured card inside the mega menu. */
  feature?: { title: string; text: string; href: string; image?: string };
}

export interface QuizOption {
  label: string;
  /** Tag(s) this answer contributes to the recommendation profile. */
  tags: string[];
  /** Jump target step id (defaults to next step). */
  next?: string;
}

export interface QuizStep {
  id: string;
  question: string;
  help?: string;
  options: QuizOption[];
}

export interface QuizResult {
  id: string;
  /** Profile tags that trigger this result (all must match). */
  match: string[];
  title: string;
  text: string;
  productHandles: string[];
  collectionHandle?: string;
}
