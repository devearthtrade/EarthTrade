/**
 * Catalog aggregation: products, collections, brands, bundles, navigation,
 * the solution quiz and the replacement-filter finder graph.
 *
 * Everything the templates render comes from here, so a future migration to
 * a live Storefront API or a CMS only has to replace this module.
 */

import type {
  BrandInfo,
  Bundle,
  Collection,
  NavItem,
  Product,
  QuizResult,
  QuizStep,
} from "../lib/types.ts";
import { importedBrands, importedCollections, importedProducts } from "./imported.ts";

export const products: Product[] = importedProducts;

const productIndex = new Map(products.map((p) => [p.handle, p]));

export function getProduct(handle: string): Product | undefined {
  return productIndex.get(handle);
}

export function getProducts(handles: string[]): Product[] {
  return handles.map((h) => productIndex.get(h)).filter((p): p is Product => Boolean(p));
}

export function productPrice(p: Product): number {
  return Math.min(...p.variants.map((v) => v.price));
}

export function productMaxPrice(p: Product): number {
  return Math.max(...p.variants.map((v) => v.price));
}

/** Card display name: short title when provided, otherwise the full title. */
export function cardName(p: Product): string {
  return p.cardTitle ?? p.title;
}

/**
 * Brands and collections are read from the database, not written here.
 *
 * They used to be literals in this file, which meant that changing a
 * collection's editorial copy or a brand's story was a code change and a
 * rebuild. They now live in PostgreSQL alongside the products, so the same
 * management API that creates a product can edit them.
 *
 * `db/seed-data/presentation.json` holds the original text, so a database can
 * be built from nothing. It is a seed, not a source: once seeded, the database
 * is authoritative.
 */
export const brands: BrandInfo[] = importedBrands;

export const brandIndex = new Map(brands.map((b) => [b.id, b]));

/**
 * Collections, with membership already resolved by the database: curated order
 * first, then members derived from product tags.
 */
export const collections: Collection[] = importedCollections;

export const collectionIndex = new Map(collections.map((c) => [c.handle, c]));

/**
 * Bundles whose members still resolve. A bundle that has lost most of its
 * products to a catalog change is not a bundle, so it is withheld from the
 * storefront and listed in the import report instead of rendering hollow.
 */
export function sellableBundles(): Bundle[] {
  return bundles.filter((b) => bundleProducts(b).length >= 2);
}


/**
 * Products in a collection, in the order the collection presents them.
 *
 * Membership used to be assembled here from a curated list plus whatever the
 * import derived. The database now resolves both into one ordered list, so
 * this reads it rather than reconstructing it — one definition of what is in a
 * collection, shared by the storefront and by anything else that asks.
 */
export function collectionProducts(c: Collection): Product[] {
  return getProducts(c.productHandles);
}

/**
 * Curated handles that no longer exist in the catalog, for the bundles and
 * quiz results still defined in this file.
 *
 * Collections are no longer checked here: the database holds membership rows,
 * and a row can only exist for a product that exists. Curation that stopped
 * resolving is reported by `db/seed-presentation.ts` when it is dropped, which
 * is the moment the information exists.
 */
export function staleCuratedHandles(): { source: string; handle: string }[] {
  const stale: { source: string; handle: string }[] = [];
  const check = (source: string, handles: string[]) => {
    for (const h of handles) if (!productIndex.has(h)) stale.push({ source, handle: h });
  };
  for (const b of bundles) check(`bundle:${b.handle}`, b.productHandles);
  for (const r of quizResults) check(`quiz:${r.id}`, r.productHandles ?? []);
  return stale;
}

export const bundles: Bundle[] = [
  {
    handle: "water-starter",
    title: "Water Starter",
    tagline: "The simplest way into better water.",
    description:
      "The alkaline pitcher plus a three-pack of replacement filters, covering roughly the first six months.",
    productHandles: ["pitcher-of-life-2nd-generation", "pitcher-of-life-2nd-generation-3pack-replacement-filter"],
  },
  {
    handle: "cistern-care",
    title: "Cistern Care",
    tagline: "Tank maintenance, sorted for the year.",
    description:
      "The Cistern & Catchment Bomb in the 500 g size with test strips, so you can confirm the mix before every treatment.",
    productHandles: ["cistern-catchment-bomb", "active-chlorine-test-strips-50"],
  },
  {
    handle: "home-cleaning",
    title: "Home Cleaning",
    tagline: "One system for the whole house.",
    description:
      "All-purpose concentrate, a refillable spray system and a drop-in bathroom treatment.",
    productHandles: [
      "solutions-hocl-cleaner-10-grams",
      "hocl-general-purpose-cleaner-spray",
      "toilet-bomb-fragrance-free",
    ],
  },
  {
    handle: "organic-garden-starter",
    title: "Organic Garden Starter",
    tagline: "Build living soil from the first season.",
    description:
      "Compost starter, bokashi inoculant and the liquid microbial concentrate for foliar and soil applications.",
    productHandles: [
      "hawaiian-bokashi-compost-starter",
      "hawaiian-bokashi-inoculant",
      "inoculant-liquid-concentrate",
    ],
  },
  {
    handle: "rv-ready",
    title: "RV Ready",
    tagline: "Leave the bleach at home.",
    description: "Tank cleaner and descaler with the RV and boat bowl treatment.",
    productHandles: ["rv-water-tank-cleaner", "rv-boat-toilet-bomb"],
  },
  {
    handle: "complete-water",
    title: "Complete Water",
    tagline: "Ionized water and the filters to keep it running.",
    description:
      "The Supreme MXL-9 with a replacement filter on hand, so performance never drops off waiting on a delivery.",
    productHandles: ["life-ionizer-mxl-9", "life-mxl-replacement-filter"],
  },
];

export function bundleProducts(b: Bundle): Product[] {
  return getProducts(b.productHandles);
}

export function bundleTotal(b: Bundle): number {
  return bundleProducts(b).reduce((sum, p) => sum + productPrice(p), 0);
}

export const navigation: NavItem[] = [
  {
    label: "Shop",
    href: "/collections/best-sellers",
    columns: [
      {
        title: "Water",
        links: [
          { label: "All Water", href: "/collections/water" },
          { label: "Life Ionizers", href: "/collections/life-ionizers" },
          { label: "Pitcher of Life", href: "/collections/pitcher-of-life" },
          { label: "Replacement Filters", href: "/collections/water-filtration" },
        ],
      },
      {
        title: "Home & Tank",
        links: [
          { label: "SolutionsHOCL", href: "/collections/solutionshocl" },
          { label: "Cistern & Catchment", href: "/collections/cistern-catchment" },
          { label: "Home Cleaning", href: "/collections/household-cleaning" },
          { label: "RV & Marine", href: "/collections/rv-marine" },
        ],
      },
      {
        title: "Garden & More",
        links: [
          { label: "Organic Gardening", href: "/collections/organic-gardening" },
          { label: "Natural Wellness", href: "/collections/wellness" },
          { label: "Accessories", href: "/collections/accessories" },
          { label: "Best Sellers", href: "/collections/best-sellers" },
        ],
      },
    ],
    feature: {
      title: "Find the right solution",
      text: "Answer a few questions and we will narrow the range down to what fits your home.",
      href: "/quiz",
    },
  },
  {
    label: "Solutions",
    href: "/collections/water",
    columns: [
      {
        title: "By problem",
        links: [
          { label: "Better Water", href: "/collections/water" },
          { label: "Cistern & Catchment", href: "/collections/cistern-catchment" },
          { label: "Home Cleaning", href: "/collections/household-cleaning" },
          { label: "Organic Gardening", href: "/collections/organic-gardening" },
          { label: "Water Filtration", href: "/collections/water-filtration" },
        ],
      },
      {
        title: "Tools",
        links: [
          { label: "Solution Quiz", href: "/quiz" },
          { label: "Filter Finder", href: "/filter-finder" },
          { label: "Compare Ionizers", href: "/compare/ionizers" },
          { label: "Build Your System", href: "/build-your-system" },
          { label: "Bundles", href: "/bundles" },
        ],
      },
    ],
    feature: {
      title: "Never run out",
      text: "Put filters and consumables on Auto-Ship and they arrive before you need them.",
      href: "/collections/subscribe",
    },
  },
  {
    label: "Brands",
    href: "/brands",
    columns: [
      {
        title: "Our brands",
        links: [
          { label: "Life Ionizers", href: "/brands/life-ionizers" },
          { label: "Pitcher of Life", href: "/brands/pitcher-of-life" },
          { label: "SolutionsHOCL", href: "/brands/solutionshocl" },
          { label: "Hawaiian Volcanic Organic", href: "/brands/hawaiian-volcanic-organic" },
          { label: "Life Sciences Water", href: "/brands/life-sciences-water" },
        ],
      },
    ],
  },
  {
    label: "Learn",
    href: "/learn",
    columns: [
      {
        title: "Education hub",
        links: [
          { label: "Water", href: "/learn/water" },
          { label: "Rainwater & Tanks", href: "/learn/rainwater" },
          { label: "Home Care", href: "/learn/home" },
          { label: "Gardening", href: "/learn/gardening" },
          { label: "Sustainability", href: "/learn/sustainability" },
        ],
      },
      {
        title: "Reading",
        links: [
          { label: "The Journal", href: "/journal" },
          { label: "Filter Finder", href: "/filter-finder" },
          { label: "FAQs", href: "/faqs" },
        ],
      },
    ],
  },
  {
    label: "About",
    href: "/about",
    columns: [
      {
        title: "EarthTrade",
        links: [
          { label: "Our Story", href: "/about" },
          { label: "Our Brands", href: "/brands" },
          { label: "EarthTrade Rewards", href: "/rewards" },
          { label: "Contact", href: "/contact" },
        ],
      },
    ],
  },
];

/** Solution quiz */

export const quizSteps: QuizStep[] = [
  {
    id: "goal",
    question: "What are you trying to improve?",
    help: "Pick the one that matters most right now. You can always explore the rest later.",
    options: [
      { label: "The water we drink", tags: ["goal:water"] },
      { label: "A cistern or catchment tank", tags: ["goal:tank"] },
      { label: "Cleaning the home", tags: ["goal:home"] },
      { label: "Soil and the garden", tags: ["goal:garden"] },
    ],
  },
  {
    id: "source",
    question: "Where does your household water come from?",
    options: [
      { label: "Municipal supply", tags: ["src:city"] },
      { label: "Rainwater catchment or cistern", tags: ["src:catchment"] },
      { label: "A well", tags: ["src:well"] },
      { label: "I am not sure", tags: ["src:unknown"] },
    ],
  },
  {
    id: "household",
    question: "How many people are in the household?",
    options: [
      { label: "1 to 2", tags: ["size:small"] },
      { label: "3 to 4", tags: ["size:medium"] },
      { label: "5 or more", tags: ["size:large"] },
    ],
  },
  {
    id: "budget",
    question: "What feels right to spend?",
    help: "This only shapes the recommendation. Nothing is added to your cart.",
    options: [
      { label: "Under $100", tags: ["budget:low"] },
      { label: "$100 to $500", tags: ["budget:mid"] },
      { label: "$500 and up", tags: ["budget:high"] },
    ],
  },
  {
    id: "alkaline",
    question: "Do you want alkaline or ionized water on demand?",
    options: [
      { label: "Yes, that is the goal", tags: ["alk:yes"] },
      { label: "Filtration matters more to me", tags: ["alk:no"] },
      { label: "Not sure yet", tags: ["alk:maybe"] },
    ],
  },
];

export const quizResults: QuizResult[] = [
  {
    id: "ionizer-large",
    match: ["goal:water", "alk:yes", "budget:high"],
    title: "A Life Ionizer, sized up",
    text: "You want alkaline water on demand and you have the household to justify it. More plates mean a wider pH range and steadier performance when several people are drawing water through the day.",
    productHandles: ["life-ionizer-mxl-11", "life-ionizer-mxl-9", "life-mxl-replacement-filter"],
    collectionHandle: "life-ionizers",
  },
  {
    id: "ionizer-core",
    match: ["goal:water", "alk:yes"],
    title: "The Supreme MXL-9",
    text: "The MXL-9 is where most people land: nine plates dipped eight times in medical-grade platinum, countertop or under counter, with a guaranteed lifetime warranty.",
    productHandles: ["life-ionizer-mxl-9", "life-ionizer-mxl-7", "life-mxl-replacement-filter"],
    collectionHandle: "life-ionizers",
  },
  {
    id: "pitcher",
    match: ["goal:water"],
    title: "Start with Pitcher of Life",
    text: "No installation, no plumbing, and you taste the difference the first time you pour. The 6-stage cartridge produces 8.5 to 9.5 pH water with added calcium, magnesium and potassium minerals.",
    productHandles: [
      "pitcher-of-life-2nd-generation",
      "pitcher-of-life-2nd-generation-3pack-replacement-filter",
      "pitcher-with-copper-bottle",
    ],
    collectionHandle: "pitcher-of-life",
  },
  {
    id: "tank",
    match: ["goal:tank"],
    title: "Cistern & Catchment care",
    text: "Pre-measured and fast-dissolving, sized to your tank. Add test strips so you can confirm the mix is at strength before every treatment.",
    productHandles: [
      "cistern-catchment-bomb",
      "cistern-tank-cleaner",
      "active-chlorine-test-strips-50",
    ],
    collectionHandle: "cistern-catchment",
  },
  {
    id: "home",
    match: ["goal:home"],
    title: "The home cleaning system",
    text: "One concentrate for counters, floors and glass, a refillable spray system for daily use, and a drop-in treatment for the bathroom. Bleach-free, ammonia-free and phosphate-free.",
    productHandles: [
      "solutions-hocl-cleaner-10-grams",
      "hocl-general-purpose-cleaner-spray",
      "toilet-bomb-fragrance-free",
    ],
    collectionHandle: "household-cleaning",
  },
  {
    id: "garden",
    match: ["goal:garden"],
    title: "Build living soil",
    text: "Start the season with a compost starter and inoculant worked into the bed, then keep the system fed with the liquid concentrate as a foliar spray or soil drench.",
    productHandles: [
      "hawaiian-bokashi-compost-starter",
      "hawaiian-bokashi-inoculant",
      "inoculant-liquid-concentrate",
    ],
    collectionHandle: "organic-gardening",
  },
];

/** Filter finder graph */

export interface FilterFinderNode {
  brand: string;
  models: { model: string; note: string; filterHandle: string }[];
}

export const filterFinder: FilterFinderNode[] = [
  {
    brand: "Life Ionizers",
    models: [
      { model: "Core MXL-5", note: "Countertop, 5 plates", filterHandle: "life-mxl-replacement-filter" },
      { model: "MXL-7 / MXL-7 UC", note: "Countertop or under counter, 7 plates", filterHandle: "life-mxl-replacement-filter" },
      { model: "Supreme MXL-9 / MXL-9 UC", note: "Countertop or under counter, 9 plates", filterHandle: "life-mxl-replacement-filter" },
      { model: "MXL-11 / MXL-11 UC", note: "Countertop or under counter, 11 plates", filterHandle: "life-mxl-replacement-filter" },
      { model: "MXL-13", note: "Countertop or under counter, 13 plates", filterHandle: "life-mxl-replacement-filter" },
      { model: "Apex MXL-15 / MXL-15 UC", note: "Countertop or under counter, 15 plates", filterHandle: "life-mxl-replacement-filter" },
    ],
  },
  {
    brand: "Pitcher of Life",
    models: [
      {
        model: "Pitcher of Life (1st generation)",
        note: "Original pitcher body",
        filterHandle: "pitcher-of-life-replacement-filter-3pack",
      },
      {
        model: "Pitcher of Life (2nd generation)",
        note: "3.8 L body, 2 L filtering capacity",
        filterHandle: "pitcher-of-life-2nd-generation-3pack-replacement-filter",
      },
      {
        model: "Flower of Life Pitcher with Copper Bottle",
        note: "Uses the 2nd generation cartridge",
        filterHandle: "pitcher-of-life-2nd-generation-3pack-replacement-filter",
      },
      {
        model: "Borosilicate Glass Pitcher with Infuser",
        note: "Uses the 2nd generation cartridge",
        filterHandle: "pitcher-of-life-2nd-generation-3pack-replacement-filter",
      },
    ],
  },
];

/** Ionizer comparison table */

export const ionizerComparison = {
  handles: [
    "life-ionizer-mxl-5",
    "life-ionizer-mxl-7",
    "life-ionizer-mxl-9",
    "life-ionizer-mxl-11",
    "life-ionizer-mxl-13",
    "life-ionizer-mxl-15",
  ],
  rows: [
    { label: "Plates", values: ["5", "7", "9", "11", "13", "15"] },
    {
      label: "Installation",
      values: [
        "Countertop",
        "Countertop or under counter",
        "Countertop or under counter",
        "Countertop or under counter",
        "Countertop or under counter",
        "Countertop or under counter",
      ],
    },
    {
      label: "Warranty",
      values: [
        "See product page",
        "Lifetime parts, 10 years labor",
        "Guaranteed lifetime",
        "Guaranteed lifetime",
        "Guaranteed lifetime",
        "Guaranteed lifetime",
      ],
    },
    {
      label: "Filter life",
      values: ["6 to 12 months", "6 to 12 months", "6 to 12 months", "6 to 12 months", "6 to 12 months", "6 to 12 months"],
    },
    {
      label: "Best for",
      values: [
        "Smaller kitchens and first systems",
        "Households wanting more range",
        "The balanced favorite",
        "Larger households, heavier use",
        "Near-flagship range",
        "Maximum range and flow",
      ],
    },
  ],
};

/** Search index */

export interface SearchDoc {
  type: "product" | "collection" | "brand" | "article" | "page";
  title: string;
  href: string;
  meta: string;
  terms: string;
}

export function buildSearchIndex(
  articleDocs: { slug: string; title: string; excerpt: string; category: string }[],
): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const p of products) {
    docs.push({
      type: "product",
      title: p.title,
      href: `/products/${p.handle}`,
      meta: p.shortBenefit,
      terms: [
        p.title,
        p.handle.replaceAll("-", " "),
        p.shortBenefit,
        ...(p.searchTerms ?? []),
        ...p.variants.map((v) => `${v.title} ${v.sku ?? ""}`),
        brandIndex.get(p.brand)?.name ?? "",
      ]
        .join(" ")
        .toLowerCase(),
    });
  }

  for (const c of collections) {
    if (c.hidden) continue;
    docs.push({
      type: "collection",
      title: c.title,
      href: `/collections/${c.handle}`,
      meta: c.description,
      terms: `${c.title} ${c.handle.replaceAll("-", " ")} ${c.description}`.toLowerCase(),
    });
  }

  for (const b of brands) {
    docs.push({
      type: "brand",
      title: b.name,
      href: `/brands/${b.id}`,
      meta: b.tagline,
      terms: `${b.name} ${b.tagline} ${b.summary}`.toLowerCase(),
    });
  }

  for (const a of articleDocs) {
    docs.push({
      type: "article",
      title: a.title,
      href: `/journal/${a.slug}`,
      meta: a.excerpt,
      terms: `${a.title} ${a.excerpt} ${a.category}`.toLowerCase(),
    });
  }

  for (const page of [
    { title: "Find the Right Solution", href: "/quiz", meta: "Answer a few questions, get a shortlist." },
    { title: "Find Your Filter", href: "/filter-finder", meta: "Match your model to the right replacement." },
    { title: "Compare Life Ionizers", href: "/compare/ionizers", meta: "MXL-5 through MXL-15, side by side." },
    { title: "Build Your Water System", href: "/build-your-system", meta: "Source to glass, step by step." },
    { title: "EarthTrade Rewards", href: "/rewards", meta: "Points, referrals and the EarthTrade Circle." },
    { title: "Bundles", href: "/bundles", meta: "Compatible products, grouped." },
  ]) {
    docs.push({ type: "page", ...page, terms: `${page.title} ${page.meta}`.toLowerCase() });
  }

  return docs;
}
