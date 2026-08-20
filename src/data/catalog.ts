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
import { hoclProducts } from "./products-hocl.ts";
import { hvoProducts } from "./products-hvo.ts";
import { waterProducts } from "./products-water.ts";

export const products: Product[] = [
  ...waterProducts,
  ...hoclProducts,
  ...hvoProducts,
];

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

export const brands: BrandInfo[] = [
  {
    id: "solutionshocl",
    name: "SolutionsHOCL™",
    tagline: "A smarter approach to clean.",
    summary:
      "Fast-dissolving, high-performance cleaners for water tanks, bathrooms and the whole home. Bleach-free, ammonia-free and phosphate-free.",
    story: [
      "SolutionsHOCL makes cleaners that arrive as concentrated powder instead of a bottle of shipped water. You mix what you need, when you need it, at full strength.",
      "Every formula works through a Powerful Deep Cleaning Oxidation Technology™ to break down contaminant residue, tough stains and odor-causing soil on the surfaces you actually clean: cistern and catchment tank walls, toilet bowls, counters, floors and fixtures.",
      "The range is built around the jobs that are hardest to keep on top of. Tank care that used to mean hauling bleach is now a pre-measured treatment. Bathroom upkeep is a drop-in. Everyday cleaning is a packet and a gallon of water.",
    ],
    collectionHandle: "solutionshocl",
    theme: "clean",
  },
  {
    id: "life-ionizers",
    name: "Life Ionizers™",
    tagline: "Engineered water, at the counter.",
    summary:
      "The MXL series of alkaline water ionizers, from the 5-plate Core to the 15-plate Apex, installed countertop or under counter.",
    story: [
      "Life Ionizers builds the MXL series around one variable that matters most: plate count. More plates mean more ionizing surface, a wider pH range and steadier performance as demand climbs.",
      "The line runs from the Core MXL-5 through the Supreme MXL-9, whose nine plates are dipped eight times in medical-grade platinum, up to the flagship Apex MXL-15.",
      "Every model self-installs on the countertop or under the counter with a faucet attachment, and shares the same replacement filter ecosystem rated for 6 to 12 months.",
    ],
    collectionHandle: "life-ionizers",
    theme: "dark",
  },
  {
    id: "pitcher-of-life",
    name: "Pitcher of Life®",
    tagline: "Better water, beautifully simple.",
    summary:
      "Alkaline water pitchers with a 6-stage filter, producing 8.5 to 9.5 pH water with added calcium, magnesium and potassium minerals.",
    story: [
      "Not every home needs a machine. Pitcher of Life is the simplest way into better-tasting water: fill it, wait, pour.",
      "The 6-stage cartridge reduces heavy metals and chlorine taste while adding calcium, magnesium and potassium minerals, producing water at 8.5 to 9.5 pH. The 3.8 liter body holds enough for the household, with a 2 liter filtering capacity.",
      "More than 3,000,000 replacement filters have been purchased by Pitcher of Life customers, and the drop-in design keeps upkeep to about two minutes.",
    ],
    collectionHandle: "pitcher-of-life",
    theme: "bright",
  },
  {
    id: "hawaiian-volcanic-organic",
    name: "Hawaiian Volcanic Organic™",
    tagline: "From volcanic earth to living soil.",
    summary:
      "Bokashi, compost starters and microbial inoculants that build living soil, drawing on Hawaii's volcanic mineral character.",
    story: [
      "Hawaiian Volcanic Organic starts from a simple idea: feed the soil, not just the plant.",
      "The bokashi range ferments organic material so it breaks down faster and more completely, while glauconite brings over 34 naturally occurring minerals into the mix as a slow-release amendment.",
      "The result is soil that holds moisture, stays porous, and keeps nutrients moving into forms roots can actually use. It works in a compost bucket on a lanai or across a grow bed.",
    ],
    collectionHandle: "organic-gardening",
    theme: "volcanic",
  },
  {
    id: "life-sciences-water",
    name: "Life Sciences Water",
    tagline: "The filter ecosystem behind the systems.",
    summary:
      "Replacement filters and cleaning cartridges across the Life Ionizers and Pitcher of Life families.",
    story: [
      "Life Sciences Water exists to solve the least glamorous and most important part of owning a water system: getting the right replacement filter, on time, without guesswork.",
      "Use the Filter Finder to move from brand to model to the exact cartridge your system takes, then put it on Auto-Ship so it arrives before performance drops off.",
    ],
    collectionHandle: "water-filtration",
    theme: "light",
  },
];

export const brandIndex = new Map(brands.map((b) => [b.id, b]));

export const collections: Collection[] = [
  {
    handle: "water",
    title: "Water",
    eyebrow: "Category",
    heroTitle: "Everything for better water",
    description:
      "Ionizers, pitchers, filtration and the replacement parts that keep them performing. Start from the source and work toward the glass.",
    editorial: [
      "Water is the one thing every household uses every single day, and the one thing most people never look at closely. The EarthTrade water range is organized the way a system actually works: what comes in, what filters it, what conditions it, and what you drink from.",
      "If you are not sure where to start, the solution quiz narrows the whole range down to two or three products in about a minute.",
    ],
    theme: "light",
    productHandles: [
      "life-ionizer-mxl-9",
      "pitcher-of-life-2nd-generation",
      "life-ionizer-mxl-15",
      "pitcher-with-copper-bottle",
      "life-ionizer-mxl-11",
      "borosilicate-pitcher-filter-bundle",
      "life-ionizer-mxl-7",
      "life-ionizer-mxl-13",
      "life-ionizer-mxl-5",
      "pitcher-of-life-replacement-filter-3pack",
      "life-mxl-replacement-filter",
      "pitcher-of-life-replacement-filter",
      "pitcher-of-life-2nd-generation-3pack-replacement-filter",
      "flower-of-life-copper-bottle",
    ],
    faqs: [
      {
        q: "Where should I start if I have never filtered my water?",
        a: "Most people start with a Pitcher of Life. It needs no installation and shows you the difference in taste immediately. An ionizer is the step up when you want alkaline water on demand for the whole household.",
      },
      {
        q: "How do I know which replacement filter I need?",
        a: "Use the Filter Finder. Pick your brand, then your model, and it returns the exact replacement cartridge for your system.",
      },
    ],
    related: ["life-ionizers", "pitcher-of-life", "water-filtration"],
  },
  {
    handle: "water-filtration",
    title: "Water Filtration & Replacement Filters",
    eyebrow: "Never run out",
    heroTitle: "The right filter, on time",
    description:
      "Replacement filters and cartridges for Life Ionizers and Pitcher of Life systems. Put them on Auto-Ship and stop thinking about it.",
    editorial: [
      "A filter that is past its life is not filtering. It is the single most common reason a water system stops performing the way it did on day one.",
      "MXL cartridges are rated for 6 to 12 months depending on water quality and how much you use. Pitcher of Life cartridges run about two months of typical use, which is why they are sold in threes.",
    ],
    theme: "light",
    productHandles: [
      "life-mxl-replacement-filter",
      "pitcher-of-life-replacement-filter-3pack",
      "pitcher-of-life-2nd-generation-3pack-replacement-filter",
      "pitcher-of-life-replacement-filter",
    ],
    faqs: [
      {
        q: "How often should I replace my filter?",
        a: "MXL ionizer filters are rated for 6 to 12 months depending on water quality and usage. Pitcher of Life cartridges cover about two months of typical use.",
      },
      {
        q: "What is Auto-Ship?",
        a: "Auto-Ship sends your replacement on a schedule you choose, so the filter arrives before the old one is spent. You can change or pause it at any time.",
      },
    ],
    related: ["life-ionizers", "pitcher-of-life", "water"],
  },
  {
    handle: "life-ionizers",
    title: "Life Ionizers",
    eyebrow: "Brand",
    heroTitle: "The MXL series",
    description:
      "Alkaline water ionizers from the 5-plate Core to the 15-plate Apex. Countertop or under counter, with lifetime warranty coverage from the MXL-9 up.",
    editorial: [
      "Plate count is the spine of the MXL range. Five plates get you started; fifteen give you the widest pH range and the highest flow in the line.",
      "Every model self-installs on the countertop or under the counter with a faucet attachment, and every model shares the same replacement filter, so upkeep does not change if you upgrade later.",
    ],
    theme: "dark",
    productHandles: [
      "life-ionizer-mxl-9",
      "life-ionizer-mxl-15",
      "life-ionizer-mxl-11",
      "life-ionizer-mxl-13",
      "life-ionizer-mxl-7",
      "life-ionizer-mxl-5",
      "life-mxl-replacement-filter",
    ],
    faqs: [
      {
        q: "Countertop or under counter?",
        a: "Both are supported on every MXL model. Countertop is the fastest to install; under counter keeps the machine out of sight with a dedicated faucet attachment.",
      },
      {
        q: "What is the warranty?",
        a: "The MXL-7 carries a lifetime parts warranty with 10 years of labor. The MXL-9, MXL-11, MXL-13 and MXL-15, including under-counter configurations, carry a guaranteed lifetime warranty.",
      },
      {
        q: "How many plates do I need?",
        a: "More plates mean a wider pH range and steadier performance at higher flow. The MXL-9 is the most popular balance of capability and price; larger households that draw a lot of water benefit from the MXL-11 and up.",
      },
    ],
    related: ["water", "water-filtration", "pitcher-of-life"],
  },
  {
    handle: "pitcher-of-life",
    title: "Pitcher of Life",
    eyebrow: "Brand",
    heroTitle: "Better water, beautifully simple",
    description:
      "Alkaline water pitchers with a 6-stage filter producing 8.5 to 9.5 pH water, plus replacement filters and the Flower of Life copper bottle.",
    editorial: [
      "The pitcher holds 3.8 liters with a 2 liter filtering capacity, enough to keep a household poured through the day.",
      "The 6-stage cartridge reduces heavy metals and chlorine taste while adding calcium, magnesium and potassium minerals. Replacements drop straight in.",
    ],
    theme: "bright",
    productHandles: [
      "pitcher-of-life-2nd-generation",
      "pitcher-with-copper-bottle",
      "borosilicate-pitcher-filter-bundle",
      "pitcher-of-life-replacement-filter-3pack",
      "pitcher-of-life-2nd-generation-3pack-replacement-filter",
      "pitcher-of-life-replacement-filter",
      "flower-of-life-copper-bottle",
    ],
    faqs: [
      {
        q: "What pH does the pitcher produce?",
        a: "The 6-stage cartridge produces water in the 8.5 to 9.5 pH range.",
      },
      {
        q: "How long does a filter last?",
        a: "About two months of typical household use, which is why filters are sold in three-packs covering roughly six months.",
      },
    ],
    related: ["water", "water-filtration", "life-ionizers"],
  },
  {
    handle: "solutionshocl",
    title: "SolutionsHOCL",
    eyebrow: "Brand",
    heroTitle: "A smarter approach to clean",
    description:
      "Fast-dissolving, high-performance cleaners for tanks, bathrooms and the whole home. Bleach-free, ammonia-free and phosphate-free.",
    editorial: [
      "HOCL works through a Powerful Deep Cleaning Oxidation Technology™ to break down contaminant residue.",
      "Every SolutionsHOCL product uses a sodium-based ingredient that generates HOCL when dissolved in water. HOCL is an oxidizer that breaks down contaminant residue, buildup, and odor-causing soil on the surfaces you clean.",
      "Because the concentrate ships as powder rather than a bottle of water, you mix at full strength whenever you need it, and store a season of cleaning in a drawer.",
    ],
    theme: "clean",
    productHandles: [
      "cistern-catchment-bomb",
      "cistern-tank-cleaner",
      "catchment-bomb",
      "toilet-bomb-fragrance-free",
      "toilet-bomb-organic-lemon",
      "super-wash-500ppm",
      "solutions-hocl-cleaner-10-grams",
      "hocl-general-purpose-cleaner-spray",
      "superwash-powder-2-gram-packets",
      "rv-water-tank-cleaner",
      "boat-tank-cleaner",
      "rv-boat-toilet-bomb",
      "active-chlorine-test-strips-50",
      "hypobright-pack",
      "powerwash-30days-supply",
      "superwash-cleaner-100-grams",
      "two-2-ready-to-use-2-fl-oz-4-fl-oz-total-each-sprayers-plus-two-2-powerwash-powder-packets-that-makes-2-gallons",
      "cistern-catchment-bomb-bulk",
    ],
    faqs: [
      {
        q: "What makes a powder better than a bottled cleaner?",
        a: "You mix fresh cleaner at full strength, you are not paying to ship water, and ten gallons of cleaning power fits in a drawer.",
      },
      {
        q: "Is it bleach?",
        a: "No. Every formula is bleach-free, ammonia-free and phosphate-free. Each uses a sodium-based ingredient that generates HOCL when dissolved in water.",
      },
    ],
    related: ["cistern-catchment", "household-cleaning", "water-tank-care"],
  },
  {
    handle: "cistern-catchment",
    title: "Cistern & Catchment",
    eyebrow: "Solution",
    heroTitle: "Tank care that actually keeps up",
    description:
      "Pre-measured, fast-dissolving cleaners for cistern and rainwater catchment tank walls and interior surfaces.",
    editorial: [
      "Roof runoff carries dirt and leaf debris into a catchment tank, where it settles on the walls as contaminant buildup and stains. Cistern tanks collect the same soil from a different path.",
      "Routine treatment keeps that buildup from taking hold, so a deep clean stays a scheduled job instead of an emergency.",
      "This is a cleaning product for tank walls and surfaces, for use in non-potable water systems.",
    ],
    theme: "clean",
    productHandles: [
      "cistern-catchment-bomb",
      "cistern-tank-cleaner",
      "catchment-bomb",
      "cistern-catchment-bomb-bulk",
      "active-chlorine-test-strips-50",
    ],
    faqs: [
      {
        q: "How often should I treat my tank?",
        a: "Most households deep clean quarterly with a lighter maintenance dose in between. Follow the label schedule for your tank size, and treat after heavy storm seasons.",
      },
      {
        q: "Which product do I need?",
        a: "Cistern Bomb and Catchment Bomb are tuned to those tank types. Cistern & Catchment Bomb covers both, which is the simplest choice when your system combines them.",
      },
      {
        q: "How do I know the mix is at strength?",
        a: "Active Chlorine Test Strips read 0 to 1000 PPM, so you can confirm the solution is where the job needs it before you start.",
      },
    ],
    related: ["solutionshocl", "water-tank-care", "household-cleaning"],
  },
  {
    handle: "water-tank-care",
    title: "Water Tank Care",
    eyebrow: "Solution",
    heroTitle: "Cistern, catchment, RV and marine",
    description:
      "Every tank cleaner in the range, from household cisterns to RV and marine water tanks.",
    editorial: [
      "A tank is a surface problem. Contaminant residue, scale and odor-causing soil settle on the walls, and the fix is a cleaner that breaks that soil down rather than covering it.",
      "This is a cleaning product for tank walls and surfaces, for use in non-potable water systems.",
    ],
    theme: "clean",
    productHandles: [
      "cistern-catchment-bomb",
      "cistern-tank-cleaner",
      "catchment-bomb",
      "rv-water-tank-cleaner",
      "boat-tank-cleaner",
      "rv-boat-toilet-bomb",
      "cistern-catchment-bomb-bulk",
      "active-chlorine-test-strips-50",
    ],
    related: ["cistern-catchment", "solutionshocl", "rv-marine"],
  },
  {
    handle: "rv-marine",
    title: "RV & Marine",
    eyebrow: "Solution",
    heroTitle: "Clean tanks, on the road and on the water",
    description:
      "Tank cleaners and descalers for RVs and boats, without hauling bleach on board.",
    editorial: [
      "Space is tight and a bad-smelling tank ruins the trip. These are the same fast-dissolving formulas as the household range, sized for travel.",
    ],
    theme: "clean",
    productHandles: [
      "rv-water-tank-cleaner",
      "boat-tank-cleaner",
      "rv-boat-toilet-bomb",
      "active-chlorine-test-strips-50",
    ],
    related: ["water-tank-care", "solutionshocl"],
  },
  {
    handle: "household-cleaning",
    title: "Home Cleaning",
    eyebrow: "Solution",
    heroTitle: "The whole home, one system",
    description:
      "Toilet treatments, all-purpose cleaner, spray systems and laundry, all bleach-free, ammonia-free and phosphate-free.",
    editorial: [
      "One concentrate covers counters, floors, glass and fixtures. A drop-in treatment covers the bathroom. A dispenser packet covers laundry.",
      "Every formula uses a sodium-based ingredient that generates HOCL when dissolved in water. HOCL is an oxidizer that breaks down contaminant residue, buildup, and odor-causing soil on household surfaces.",
    ],
    theme: "clean",
    productHandles: [
      "toilet-bomb-fragrance-free",
      "toilet-bomb-organic-lemon",
      "super-wash-500ppm",
      "solutions-hocl-cleaner-10-grams",
      "hocl-general-purpose-cleaner-spray",
      "superwash-powder-2-gram-packets",
      "two-2-ready-to-use-2-fl-oz-4-fl-oz-total-each-sprayers-plus-two-2-powerwash-powder-packets-that-makes-2-gallons",
      "powerwash-30days-supply",
      "hypobright-pack",
      "superwash-cleaner-100-grams",
    ],
    faqs: [
      {
        q: "How much cleaner does one packet make?",
        a: "A 10 g packet makes a full gallon. A 2 g packet makes a quart, sized for a spray bottle.",
      },
    ],
    related: ["solutionshocl", "cistern-catchment"],
  },
  {
    handle: "organic-gardening",
    title: "Organic Gardening",
    eyebrow: "Solution",
    heroTitle: "From volcanic earth to living soil",
    description:
      "Bokashi, compost starters and microbial inoculants from Hawaiian Volcanic Organic.",
    editorial: [
      "Living soil is the whole game. Beneficial microorganisms break material down faster, improve structure so soil holds moisture while staying porous, and move locked-up nutrients into forms roots can absorb.",
      "Start with a compost starter or inoculant in the bed, then keep the system fed with the liquid concentrate through the growing season.",
    ],
    theme: "volcanic",
    productHandles: [
      "hawaiian-bokashi-compost-starter",
      "hawaiian-bokashi-inoculant",
      "inoculant-liquid-concentrate",
    ],
    faqs: [
      {
        q: "What is bokashi?",
        a: "Bokashi is a fermentation method. A culture-rich bran is layered with kitchen scraps or worked into beds, breaking material down faster and more completely than an untreated pile.",
      },
      {
        q: "How much do I need for a garden bed?",
        a: "Hawaiian Bokashi Compost Starter is applied at 1 pound per cubic yard of soil.",
      },
    ],
    related: ["best-sellers"],
  },
  {
    handle: "wellness",
    title: "Natural Wellness",
    eyebrow: "Category",
    heroTitle: "Everyday objects, made well",
    description:
      "Copper vessels and lifestyle pieces that pair with the water range.",
    theme: "light",
    productHandles: ["flower-of-life-copper-bottle", "pitcher-with-copper-bottle"],
    related: ["pitcher-of-life", "water"],
  },
  {
    handle: "accessories",
    title: "Accessories",
    eyebrow: "Category",
    heroTitle: "The parts that finish the system",
    description: "Test strips, bottles and the small things that make upkeep easy.",
    theme: "light",
    productHandles: [
      "active-chlorine-test-strips-50",
      "flower-of-life-copper-bottle",
      "pitcher-with-copper-bottle",
    ],
    related: ["water-filtration", "solutionshocl"],
  },
  {
    handle: "best-sellers",
    title: "Best Sellers",
    eyebrow: "Most loved",
    heroTitle: "What customers reorder",
    description: "The products that come back to the cart most often.",
    theme: "light",
    productHandles: [
      "cistern-catchment-bomb",
      "toilet-bomb-fragrance-free",
      "life-ionizer-mxl-9",
      "pitcher-of-life-2nd-generation",
      "solutions-hocl-cleaner-10-grams",
      "super-wash-500ppm",
      "pitcher-of-life-replacement-filter-3pack",
      "active-chlorine-test-strips-50",
      "hawaiian-bokashi-compost-starter",
      "cistern-catchment-bomb-500g-placeholder",
    ].filter((h) => h !== "cistern-catchment-bomb-500g-placeholder"),
  },
  {
    handle: "subscribe",
    title: "Never Run Out",
    eyebrow: "Subscribe & Save",
    heroTitle: "Consumables, handled",
    description:
      "Filters, cleaners and garden consumables available on Auto-Ship, so the replacement arrives before you need it.",
    editorial: [
      "The products people forget are the ones that matter most: the filter that is past its rating, the tank treatment that slipped a quarter, the packet drawer that ran empty.",
      "Auto-Ship sets a schedule based on how the product is actually used. Change it, pause it or cancel it whenever you like.",
    ],
    theme: "light",
    productHandles: products.filter((p) => p.subscription).map((p) => p.handle),
    related: ["water-filtration", "solutionshocl"],
  },
];

export const collectionIndex = new Map(collections.map((c) => [c.handle, c]));

export function collectionProducts(c: Collection): Product[] {
  return getProducts(c.productHandles);
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
