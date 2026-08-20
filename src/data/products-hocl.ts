/**
 * SolutionsHOCL™ catalog - real products from the connected Shopify store
 * (solutionshocl.com). Handles, variants, prices and images are live store
 * data captured 2026-08-20.
 *
 * COMPLIANCE: every line of customer-facing copy in this file follows
 * "Standard copy rules for Solutions HOCL" (see docs/COMPLIANCE.md).
 * Key rules applied here:
 *  - One official oxidation phrase: "Powerful Deep Cleaning Oxidation
 *    Technology™" (headline/feature) or "Powerful Oxidation" (in-line).
 *  - "generates HOCL when dissolved in water", HOCL with a capital L.
 *  - We clean the stain; copy lands on soil on a named surface.
 *  - "contaminant residue" / "contaminant buildup", never "organic residue".
 *  - No kill/germ words, no safety claims, no water claims, no regulatory
 *    or authority references, no "natural" for HOCL, no chemical names,
 *    no fogger/mister application methods, no retired comparison claims,
 *    no em dashes, no all-caps CTAs.
 *  - Cistern & catchment products carry the one approved disclaimer line.
 *  - Pool Bomb, Spa Bomb, Cold Plunge and the Produce Cleaner line are on
 *    compliance hold and are intentionally NOT in this catalog.
 */

import type { Product } from "../lib/types.ts";

/** Approved standard sentence (verbatim from the compliance rule set). */
export const OXIDATION_SENTENCE =
  "HOCL works through a Powerful Deep Cleaning Oxidation Technology™ to break down contaminant residue.";

/** Approved ingredient sentence; always lands on a named surface. */
export function ingredientSentence(surface: string): string {
  return `Uses a sodium-based ingredient that generates HOCL when dissolved in water. HOCL is an oxidizer that breaks down contaminant residue, buildup, and odor-causing soil on ${surface}.`;
}

/** The one approved disclaimer, cistern & catchment products only. */
export const TANK_DISCLAIMER =
  "This is a cleaning product for tank walls and surfaces, for use in non-potable water systems.";

const FREE_OF = "Bleach-free, ammonia-free, phosphate-free and biodegradable.";

export const hoclProducts: Product[] = [
  {
    handle: "cistern-tank-cleaner",
    title: "Cistern Bomb – Cistern Tank Cleaner",
    cardTitle: "Cistern Bomb",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "water-tank-care", "cistern-catchment"],
    shortBenefit: "Fast-dissolving deep cleaning for cistern tank walls and surfaces.",
    description: [
      "Cistern Bomb is a fast-dissolving tank cleaner built for the hard job of keeping cistern walls and surfaces free of contaminant buildup, tough stains and odors.",
      OXIDATION_SENTENCE,
      ingredientSentence("cistern tank walls and interior surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Deep cleans cistern tank walls and interior surfaces",
      "Breaks down contaminant residue and buildup",
      "Removes mold and mildew stains and cleans algae stains",
      "Neutralizes odors at the source",
      "Fast-dissolving formula, no scrubbing between cleanings",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howItWorks: [
      "Drop the pre-measured cleaner into your cistern. It dissolves fast and generates HOCL when dissolved in water.",
      "Powerful Oxidation goes to work on tank walls and surfaces, breaking down contaminant residue, stains and odor-causing soil.",
      "Follow the label schedule for routine care to keep buildup from returning between deep cleanings.",
    ],
    specs: [
      ["Format", "Fast-dissolving powder"],
      ["Sizes", "100 g and 500 g"],
      ["Use", "Cistern tank walls and interior surfaces"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    howToUse: [
      "Measure the recommended amount for your tank size (see label).",
      "Add directly to the cistern and allow it to dissolve fully.",
      "Wait the label-recommended time while Powerful Oxidation cleans tank walls and surfaces.",
      "Drain and rinse according to the label before returning the tank to service.",
    ],
    faqs: [
      {
        q: "How often should I clean my cistern?",
        a: "Most households clean quarterly, with a monthly maintenance dose to control buildup and odors between deep cleanings. Follow the label schedule for your tank size.",
      },
      {
        q: "Will it work on stained tank walls?",
        a: "Yes. The formula is tough on contaminant buildup, mildew stains and algae stains on tank walls and surfaces.",
      },
      {
        q: "Is this a bleach product?",
        a: "No. Cistern Bomb is bleach-free, ammonia-free and phosphate-free. It uses a sodium-based ingredient that generates HOCL when dissolved in water.",
      },
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/C_C_100g.webp?v=1786226668",
        alt: "SolutionsHOCL Cistern Bomb cistern tank cleaner container",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/45489578574045", title: "100 Grams", sku: "Cistern 100G", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/45489578606813", title: "500 Grams", sku: "CIS-500G", price: 49.97, available: true },
    ],
    badges: ["best-seller", "subscription"],
    subscription: true,
    replenish: { intervalDays: 90, note: "Most cisterns need a deep clean every quarter." },
    disclaimer: TANK_DISCLAIMER,
    related: ["catchment-bomb", "cistern-catchment-bomb", "active-chlorine-test-strips-50"],
    boughtWith: ["active-chlorine-test-strips-50", "toilet-bomb-fragrance-free"],
    shopifyId: "gid://shopify/Product/8275267354845",
    searchTerms: ["cistern cleaner", "water tank cleaner", "tank stains", "tank odor"],
  },
  {
    handle: "catchment-bomb",
    title: "Catchment Bomb – Rainwater Tank Cleaner",
    cardTitle: "Catchment Bomb",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "water-tank-care", "cistern-catchment"],
    shortBenefit: "Professional-grade cleaning for rainwater catchment tank surfaces.",
    description: [
      "Catchment Bomb keeps rainwater catchment tank walls and surfaces clean, deodorized and free of contaminant buildup, season after season.",
      OXIDATION_SENTENCE,
      ingredientSentence("catchment tank walls and interior surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Deep cleans catchment tank walls and interior surfaces",
      "Breaks down contaminant residue left behind by roof runoff",
      "Removes mold and mildew stains and cleans algae stains",
      "Eliminates and controls odors",
      "Fast-dissolving, pre-measured format",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howItWorks: [
      "Add the pre-measured cleaner to your catchment tank, where it generates HOCL when dissolved in water.",
      "Powerful Oxidation breaks down contaminant residue, stains and odor-causing soil on tank walls and surfaces.",
      "Repeat on the label schedule to keep surfaces clean through the rainy season.",
    ],
    specs: [
      ["Format", "Fast-dissolving powder"],
      ["Sizes", "100 g and 500 g"],
      ["Use", "Rainwater catchment tank walls and interior surfaces"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    howToUse: [
      "Measure the recommended amount for your tank size (see label).",
      "Add directly to the catchment tank and allow it to dissolve fully.",
      "Wait the label-recommended time while the formula cleans tank walls and surfaces.",
      "Drain and rinse according to the label before returning the tank to service.",
    ],
    faqs: [
      {
        q: "Why do catchment tanks need routine cleaning?",
        a: "Roof runoff carries dirt, leaf debris and contaminant residue into the tank, where it settles on walls and surfaces as buildup and stains. Routine cleaning keeps that soil from taking hold.",
      },
      {
        q: "Does it handle tank odors?",
        a: "Yes. The formula neutralizes odors at the source rather than covering them with fragrance.",
      },
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/C_C_100g.webp?v=1786226668",
        alt: "SolutionsHOCL Catchment Bomb rainwater tank cleaner container",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/45489565434077", title: "100 Grams", sku: "Catchment 100g", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/45489565499613", title: "500 Grams", sku: "CAT-500G", price: 49.97, available: true },
    ],
    badges: ["best-seller", "subscription"],
    subscription: true,
    replenish: { intervalDays: 90, note: "Clean catchment tanks quarterly, and after heavy storm seasons." },
    disclaimer: TANK_DISCLAIMER,
    related: ["cistern-tank-cleaner", "cistern-catchment-bomb", "active-chlorine-test-strips-50"],
    boughtWith: ["active-chlorine-test-strips-50"],
    shopifyId: "gid://shopify/Product/8275263127773",
    searchTerms: ["catchment cleaner", "rainwater tank cleaner", "rain tank", "tank maintenance"],
  },
  {
    handle: "cistern-catchment-bomb",
    title: "Cistern & Catchment Bomb – Water Tank Cleaner",
    cardTitle: "Cistern & Catchment Bomb",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "water-tank-care", "cistern-catchment", "best-sellers"],
    shortBenefit: "One high-performance cleaner for cistern and catchment tank surfaces.",
    description: [
      "One cleaner for both jobs. Cistern & Catchment Bomb breaks down contaminant residue and buildup on the walls and surfaces of cistern and rainwater catchment tanks, and controls odors at the source.",
      OXIDATION_SENTENCE,
      ingredientSentence("cistern and catchment tank walls and interior surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Deep cleans cistern and catchment tank walls in one product",
      "Breaks down contaminant residue and buildup",
      "Removes mold and mildew stains and cleans algae stains",
      "Neutralizes odors at the source",
      "Pre-measured, fast-dissolving format",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howItWorks: [
      "Add the pre-measured cleaner to your tank, where it generates HOCL when dissolved in water.",
      "Powerful Oxidation breaks down contaminant residue, stains and odor-causing soil on tank walls and surfaces.",
      "Use on the label schedule for routine care.",
    ],
    specs: [
      ["Format", "Fast-dissolving powder"],
      ["Sizes", "100 g and 500 g"],
      ["Use", "Cistern and catchment tank walls and interior surfaces"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    howToUse: [
      "Measure the recommended amount for your tank size (see label).",
      "Add directly to the tank and allow it to dissolve fully.",
      "Wait the label-recommended time while the formula cleans tank walls and surfaces.",
      "Drain and rinse according to the label before returning the tank to service.",
    ],
    faqs: [
      {
        q: "Which product should I choose: Cistern Bomb, Catchment Bomb, or this one?",
        a: "All three share the same cleaning approach. Choose Cistern & Catchment Bomb if your system combines both tank types or you want one product for the whole system.",
      },
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/C_C_100g.webp?v=1786226668",
        alt: "SolutionsHOCL Cistern and Catchment Bomb water tank cleaner container",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/45717892661469", title: "100 Grams", sku: "Cistern and Catchment 100g", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/45717892694237", title: "500 Grams", sku: "Cistern and Catchment 500g", price: 49.97, available: true },
    ],
    badges: ["best-seller", "subscription"],
    subscription: true,
    replenish: { intervalDays: 90, note: "Quarterly deep cleaning keeps tank surfaces free of buildup." },
    disclaimer: TANK_DISCLAIMER,
    related: ["cistern-tank-cleaner", "catchment-bomb", "cistern-catchment-bomb-bulk"],
    boughtWith: ["active-chlorine-test-strips-50"],
    shopifyId: "gid://shopify/Product/8809516564701",
    searchTerms: ["cistern cleaner", "catchment cleaner", "water tank cleaner", "tank bomb"],
  },
  {
    handle: "cistern-catchment-bomb-bulk",
    title: "Cistern & Catchment Bomb – Commercial Bucket",
    cardTitle: "Commercial Bucket",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "water-tank-care", "cistern-catchment", "commercial-bulk"],
    shortBenefit: "Professional-grade tank cleaning in 1 and 5 gallon buckets.",
    description: [
      "Built for property managers, tank service professionals and large households, the Commercial Bucket brings the same Powerful Deep Cleaning Oxidation Technology™ to high-volume tank care.",
      ingredientSentence("water storage tank walls and interior surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Professional-grade format for frequent or large-scale tank cleaning",
      "Breaks down contaminant residue and buildup on tank walls",
      "Removes tough stains and controls odors",
      "Resealable bucket keeps the powder ready between services",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    specs: [
      ["Format", "Fast-dissolving powder, resealable bucket"],
      ["Sizes", "1 gallon and 5 gallon buckets"],
      ["Use", "Cistern and catchment tank walls and interior surfaces"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    howToUse: [
      "Measure the recommended amount for each tank size (see label).",
      "Add directly to the tank and allow it to dissolve fully.",
      "Wait the label-recommended time, then drain and rinse according to the label.",
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/C_CBucketfront3000g.png?v=1740181533",
        alt: "SolutionsHOCL Cistern and Catchment Bomb commercial bucket",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/46192358654173", title: "1 Gallon Bucket", sku: "Cistern and Catchment 1GBKT", price: 269.0, available: true },
      { id: "gid://shopify/ProductVariant/46192358621405", title: "5 Gallon Bucket", sku: "CC-5GBKT", price: 1197.0, available: true },
    ],
    badges: ["premium"],
    disclaimer: TANK_DISCLAIMER,
    related: ["cistern-catchment-bomb", "active-chlorine-test-strips-50"],
    shopifyId: "gid://shopify/Product/8926369710301",
    searchTerms: ["bulk tank cleaner", "commercial cistern cleaner", "property manager"],
  },
  {
    handle: "toilet-bomb-fragrance-free",
    title: "Toilet Bomb – Toilet Bowl Cleaner – Fragrance-Free",
    cardTitle: "Toilet Bomb, Fragrance-Free",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning", "best-sellers"],
    shortBenefit: "Drop-in deep cleaning for the toilet bowl, no scrubbing, no fragrance.",
    description: [
      "Tired of stubborn toilet stains, lingering odors and harsh fumes? Toilet Bomb is a drop-in cleaner that works inside the bowl, breaking down tough stains and odor-causing soil on the porcelain surface.",
      OXIDATION_SENTENCE,
      ingredientSentence("the toilet bowl surface"),
      FREE_OF,
    ],
    benefits: [
      "Removes tough stains from the toilet bowl surface",
      "Neutralizes odors at the source",
      "Fast-dissolving drop-in format, no scrubbing",
      "Fragrance-free formula",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Drop one treatment into the toilet bowl.",
      "Wait the label-recommended time while it dissolves and cleans the bowl surface.",
      "Flush. For heavy stains, repeat and allow a longer dwell time.",
    ],
    specs: [
      ["Format", "Fast-dissolving treatment"],
      ["Sizes", "13 uses and 33 uses (value size)"],
      ["Scent", "Fragrance-free"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    faqs: [
      {
        q: "Will it remove hard water rings?",
        a: "Toilet Bomb is tough on stains and buildup on the bowl surface. Rings from mineral-heavy water may need a second treatment with a longer dwell time.",
      },
      {
        q: "Does fragrance-free mean it does less?",
        a: "No. It is the same deep cleaning formula, without added scent. It neutralizes odors at the source instead of masking them.",
      },
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/toilet_free_scent_13_trt.webp?v=1764460922",
        alt: "SolutionsHOCL fragrance-free Toilet Bomb toilet bowl cleaner pack",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/44292551573725", title: "13 Uses", sku: "TCFF13T", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/44292551606493", title: "Value Size Pack: 33 Uses", sku: "TCFF33T", price: 39.97, available: true },
    ],
    badges: ["best-seller", "subscription"],
    subscription: true,
    replenish: { intervalDays: 30, note: "A weekly treatment keeps the bowl clean between deep cleanings." },
    related: ["toilet-bomb-organic-lemon", "rv-boat-toilet-bomb", "hocl-general-purpose-cleaner-spray"],
    boughtWith: ["toilet-bomb-organic-lemon"],
    shopifyId: "gid://shopify/Product/8275264831709",
    searchTerms: ["toilet cleaner", "toilet bowl stains", "toilet odor", "drop in toilet cleaner"],
  },
  {
    handle: "toilet-bomb-organic-lemon",
    title: "Toilet Bomb – Toilet Bowl Cleaner – Lemon",
    cardTitle: "Toilet Bomb, Lemon",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning"],
    shortBenefit: "Drop-in toilet bowl cleaning with a bright lemon scent.",
    description: [
      "The same drop-in deep cleaning as our fragrance-free Toilet Bomb, finished with a bright lemon scent.",
      "SolutionsHOCL™ Toilet Bomb uses the Powerful Deep Cleaning Oxidation Technology™ to break down tough stains and odor-causing soil on the toilet bowl surface.",
      ingredientSentence("the toilet bowl surface"),
      FREE_OF,
    ],
    benefits: [
      "Removes tough stains from the toilet bowl surface",
      "Neutralizes odors at the source, finishes with lemon",
      "Fast-dissolving drop-in format, no scrubbing",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Drop one treatment into the toilet bowl.",
      "Wait the label-recommended time while it dissolves and cleans the bowl surface.",
      "Flush. For heavy stains, repeat and allow a longer dwell time.",
    ],
    specs: [
      ["Format", "Fast-dissolving treatment"],
      ["Sizes", "13 uses and 33 uses (value size)"],
      ["Scent", "Lemon"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/Toilet_lemon_13_trt.webp?v=1764458412",
        alt: "SolutionsHOCL lemon Toilet Bomb toilet bowl cleaner pack",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/44292559044829", title: "13 Uses", sku: "TCLS13T", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/44292559077597", title: "Value Size Pack: 33 Uses", sku: "TCLS33T", price: 39.97, available: true },
    ],
    badges: ["subscription"],
    subscription: true,
    replenish: { intervalDays: 30, note: "A weekly treatment keeps the bowl clean between deep cleanings." },
    related: ["toilet-bomb-fragrance-free", "rv-boat-toilet-bomb"],
    boughtWith: ["toilet-bomb-fragrance-free"],
    shopifyId: "gid://shopify/Product/8275266339037",
    searchTerms: ["lemon toilet cleaner", "toilet bowl cleaner", "toilet stains"],
  },
  {
    handle: "rv-boat-toilet-bomb",
    title: "RV & Boat Toilet Bomb – Lemon",
    cardTitle: "RV & Boat Toilet Bomb",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning", "rv-marine"],
    shortBenefit: "Scoop-in toilet bowl cleaning for RVs and boats, without hauling bleach on board.",
    description: [
      "Keep your RV or boat toilet bowl clean and fresh without hauling bleach on board. RV & Boat Toilet Bomb is an effervescent powder you scoop straight into the bowl.",
      OXIDATION_SENTENCE,
      ingredientSentence("the RV or marine toilet bowl surface"),
      FREE_OF,
    ],
    benefits: [
      "Removes tough stains from RV and marine toilet bowl surfaces",
      "Neutralizes odors at the source in tight quarters",
      "Compact, fast-dissolving powder, travels well",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Scoop the recommended amount into the toilet bowl.",
      "Wait the label-recommended time while it dissolves and cleans the bowl surface.",
      "Flush per your system's guidance.",
    ],
    specs: [
      ["Format", "Effervescent powder"],
      ["Sizes", "100 g and 500 g"],
      ["Scent", "Lemon"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/RV_Boat_toilet_bomb_500g.webp?v=1785375284",
        alt: "SolutionsHOCL RV and Boat Toilet Bomb lemon container",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/48278076555485", title: "100 g", sku: "RV-Boat-toilet-bomb-100g", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/48278076588253", title: "500 g", sku: "RV-Boat-toilet-bomb-500g", price: 49.97, available: true },
    ],
    badges: ["new"],
    related: ["rv-water-tank-cleaner", "boat-tank-cleaner", "toilet-bomb-organic-lemon"],
    boughtWith: ["rv-water-tank-cleaner"],
    shopifyId: "gid://shopify/Product/9593772015837",
    searchTerms: ["rv toilet cleaner", "boat toilet cleaner", "marine toilet"],
  },
  {
    handle: "rv-water-tank-cleaner",
    title: "RV Tank Cleaner & Descaler",
    cardTitle: "RV Tank Cleaner",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "water-tank-care", "rv-marine"],
    shortBenefit: "A clean, fresh, odor-free RV tank between adventures.",
    description: [
      "Do not let a smelly or crusty tank slow down the trip. RV Tank Cleaner & Descaler deep cleans RV water tank walls and surfaces, breaking down scale, contaminant buildup and odor-causing soil.",
      OXIDATION_SENTENCE,
      ingredientSentence("RV water tank walls and interior surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Deep cleans and descales RV tank walls and surfaces",
      "Breaks down contaminant residue and buildup",
      "Eliminates and controls tank odors",
      "Say no to hauling bleach on the road",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Add the recommended amount to the tank (see label for tank size).",
      "Fill with water and allow the formula to dissolve and dwell per the label.",
      "Drain and rinse according to the label before refilling.",
    ],
    specs: [
      ["Format", "Fast-dissolving powder"],
      ["Sizes", "100 g and 400 g"],
      ["Use", "RV water tank walls and interior surfaces"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/RvTank100g.webp?v=1783646698",
        alt: "SolutionsHOCL RV tank cleaner and descaler container",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/46195023053021", title: "100 Grams", sku: "RV 100 G", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/46195023085789", title: "400 Grams", sku: "RV 300 G", price: 49.97, available: true },
    ],
    related: ["rv-boat-toilet-bomb", "boat-tank-cleaner", "cistern-catchment-bomb"],
    boughtWith: ["rv-boat-toilet-bomb"],
    shopifyId: "gid://shopify/Product/8927564955869",
    searchTerms: ["rv tank cleaner", "rv descaler", "camper water tank", "rv tank odor"],
  },
  {
    handle: "boat-tank-cleaner",
    title: "Marine & Boat Tank Cleaner & Descaler",
    cardTitle: "Marine & Boat Tank Cleaner",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "water-tank-care", "rv-marine"],
    shortBenefit: "Pristine tanks and smooth sailing, without bleach on board.",
    description: [
      "When you are out on the water, the last thing you want is a foul-smelling or residue-filled tank. Marine & Boat Tank Cleaner & Descaler deep cleans marine water tank walls and surfaces.",
      OXIDATION_SENTENCE,
      ingredientSentence("marine water tank walls and interior surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Deep cleans and descales marine tank walls and surfaces",
      "Breaks down contaminant residue and buildup",
      "Eliminates and controls tank odors",
      "Compact powder format stows easily on board",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Add the recommended amount to the tank (see label for tank size).",
      "Fill with water and allow the formula to dissolve and dwell per the label.",
      "Drain and rinse according to the label before refilling.",
    ],
    specs: [
      ["Format", "Fast-dissolving powder"],
      ["Sizes", "100 g and 400 g"],
      ["Use", "Marine and boat water tank walls and interior surfaces"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/Marine_Boat_Cleaner_f100g.webp?v=1783639234",
        alt: "SolutionsHOCL marine and boat tank cleaner and descaler container",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/46287217524957", title: "100 Grams", sku: "Marine and Boat 100g", price: 19.97, available: true },
      { id: "gid://shopify/ProductVariant/46287217557725", title: "400 Grams", sku: "MAR-400G", price: 49.97, available: true },
    ],
    related: ["rv-water-tank-cleaner", "rv-boat-toilet-bomb"],
    boughtWith: ["rv-boat-toilet-bomb"],
    shopifyId: "gid://shopify/Product/8949948481757",
    searchTerms: ["boat tank cleaner", "marine tank cleaner", "sailboat water tank", "boat tank odor"],
  },
  {
    handle: "super-wash-500ppm",
    title: "SuperWash HOCL Liquid – 1 Gallon – 500 PPM",
    cardTitle: "SuperWash HOCL Liquid, 1 Gallon",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning", "best-sellers"],
    shortBenefit: "Ready-to-use 500 PPM HOCL cleaning liquid for the whole home.",
    description: [
      "SuperWash HOCL Liquid arrives ready to use at 500 PPM, or dilutes to cover up to two gallons of everyday cleaning strength.",
      OXIDATION_SENTENCE,
      ingredientSentence("counters, sinks, appliances and hard household surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Ready to use at 500 PPM, or dilute for everyday cleaning",
      "Cuts grease and grime on hard household surfaces",
      "Deodorizes as it cleans",
      "Available fragrance-free, lemon or coconut",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Use full strength for deep cleaning, or dilute per the label for everyday use.",
      "Apply to the surface, wait the label-recommended time, then wipe clean.",
    ],
    specs: [
      ["Format", "Ready-to-use liquid, 128 fl oz jug"],
      ["Strength", "500 PPM, dilutable"],
      ["Scents", "The Original (unscented), Lemon, Coconut"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/hoclsolutions500ppm-233638835.jpg?v=1717090548",
        alt: "SolutionsHOCL SuperWash HOCL liquid one gallon jug",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42862157988061", title: "The Original - Unscented", sku: "Solutions - No Scent", price: 29.97, available: true },
      { id: "gid://shopify/ProductVariant/42862158020829", title: "Lemon", sku: "Solutions - Lemon", price: 29.97, available: true },
      { id: "gid://shopify/ProductVariant/42862158053597", title: "Coconut", sku: "Solutions - Coconut", price: 29.97, available: true },
    ],
    badges: ["best-seller"],
    replenish: { intervalDays: 60, note: "A gallon covers about two months of routine cleaning for most homes." },
    related: ["hocl-general-purpose-cleaner-spray", "solutions-hocl-cleaner-10-grams"],
    boughtWith: ["hocl-general-purpose-cleaner-spray"],
    shopifyId: "gid://shopify/Product/7559780040925",
    searchTerms: ["hocl liquid", "gallon cleaner", "all purpose cleaner", "500 ppm"],
  },
  {
    handle: "solutions-hocl-cleaner-10-grams",
    title: "SuperWash Powder – 10 g × 10-Pack – Fragrance-Free",
    cardTitle: "SuperWash Powder, 10-Pack",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning", "best-sellers"],
    shortBenefit: "Ten packets, ten gallons of high-performance cleaner you mix at home.",
    description: [
      "SuperWash is a concentrated general purpose cleaner for household and commercial use. Each 10 g packet generates HOCL when dissolved in water, making a full gallon of high-performance cleaner.",
      OXIDATION_SENTENCE,
      ingredientSentence("counters, floors, appliances and hard surfaces"),
      "Also available in Lemon, Orange, Lavender, Coconut, Hawaiian Paradise and a scent variety pack.",
      FREE_OF,
    ],
    benefits: [
      "Makes 10 gallons of cleaner from one lightweight pack",
      "Cuts grease and grime, removes tough stains",
      "Deodorizes as it cleans, no harsh fumes",
      "Mix only what you need, when you need it",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howItWorks: [
      "Each packet uses a sodium-based ingredient that generates HOCL when dissolved in water.",
      "Powerful Oxidation breaks down contaminant residue, grease and odor-causing soil on hard surfaces.",
      "Mix a fresh gallon whenever you need it, so the cleaner is always at full strength.",
    ],
    howToUse: [
      "Dissolve one packet in one gallon of water.",
      "Apply to the surface with a cloth or spray bottle.",
      "Wait the label-recommended time, then wipe clean.",
    ],
    specs: [
      ["Format", "Concentrated powder packets"],
      ["Pack", "10 packets × 10 g, each makes 1 gallon"],
      ["Scent", "Fragrance-free (more scents available)"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    faqs: [
      {
        q: "How is a powder better than a bottled cleaner?",
        a: "You mix cleaner fresh at full strength, skip shipping water, and store ten gallons of cleaning power in a drawer.",
      },
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/GPC_no_scent.webp?v=1749665685",
        alt: "SolutionsHOCL SuperWash fragrance-free powder ten pack",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42378956112093", title: "10-Pack, Fragrance-Free", sku: "General Purpose 10 G No Scent", price: 24.97, available: true },
    ],
    badges: ["best-seller", "subscription"],
    subscription: true,
    replenish: { intervalDays: 60, note: "Ten packets cover about two months of regular cleaning." },
    related: ["superwash-powder-2-gram-packets", "hocl-general-purpose-cleaner-spray", "super-wash-500ppm"],
    boughtWith: ["hocl-general-purpose-cleaner-spray"],
    shopifyId: "gid://shopify/Product/7559850295517",
    searchTerms: ["hocl powder", "general purpose cleaner", "concentrate", "powder packets"],
  },
  {
    handle: "superwash-powder-2-gram-packets",
    title: "SuperWash Powder – 2 g × 10-Pack",
    cardTitle: "SuperWash Powder, 2 g Packets",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning"],
    shortBenefit: "Quart-size packets for spray bottles and quick refills.",
    description: [
      "The same concentrated SuperWash cleaner in a smaller 2 g packet, sized for quart spray bottles and quick mixing.",
      ingredientSentence("counters, glass, fixtures and hard surfaces"),
      "Available fragrance-free or in Lemon, Orange, Lavender and Coconut.",
      FREE_OF,
    ],
    benefits: [
      "Each packet makes a quart of high-performance cleaner",
      "Sized for reusable spray bottles",
      "Cuts grease and grime, deodorizes as it cleans",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Dissolve one packet in one quart of water in a spray bottle.",
      "Spray the surface, wait the label-recommended time, then wipe clean.",
    ],
    specs: [
      ["Format", "Concentrated powder packets"],
      ["Pack", "10 packets × 2 g, each makes 1 quart"],
      ["Scents", "Fragrance-free, Lemon, Orange, Lavender, Coconut"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/Solutions-HOCL-SuperWash-Powder-2-gram-Packets-a-10-Packs_20-grams_-Solutions-HOCL-233641185.jpg?v=1784755072",
        alt: "SolutionsHOCL SuperWash two gram powder packets ten pack",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42426976698589", title: "Fragrance-Free", sku: "General Purpose 2G No Scent", price: 39.0, available: true },
      { id: "gid://shopify/ProductVariant/42426976600285", title: "Lemon", sku: "General Purpose 2G Lemon Scent", price: 44.0, available: true },
      { id: "gid://shopify/ProductVariant/42426976567517", title: "Orange", sku: "General Purpose 2G Orange Scent", price: 44.0, available: true },
      { id: "gid://shopify/ProductVariant/42426976633053", title: "Lavender", sku: "General Purpose 2G Lavender Scent", price: 46.0, available: true },
      { id: "gid://shopify/ProductVariant/42483024429277", title: "Coconut", sku: "General Purpose 2G Coconut Scent", price: 39.0, available: true },
    ],
    badges: ["best-seller"],
    related: ["solutions-hocl-cleaner-10-grams", "two-2-ready-to-use-2-fl-oz-4-fl-oz-total-each-sprayers-plus-two-2-powerwash-powder-packets-that-makes-2-gallons"],
    shopifyId: "gid://shopify/Product/7573506359517",
    searchTerms: ["spray bottle refill", "quart cleaner", "powder packets"],
  },
  {
    handle: "superwash-cleaner-100-grams",
    title: "SuperWash Powder – 100 g",
    cardTitle: "SuperWash Powder, 100 g",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning", "commercial-bulk"],
    shortBenefit: "Concentrated cleaning power for larger spaces and frequent users.",
    description: [
      "The ultimate format for frequent users. SuperWash 100 g brings concentrated, professional-grade cleaning to bigger homes, rentals and commercial spaces.",
      OXIDATION_SENTENCE,
      ingredientSentence("floors, counters, equipment and hard surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Concentrated format for high-volume cleaning",
      "Cuts grease and grime, removes tough stains",
      "Deodorizes large spaces as it cleans",
      "Available in five scent options",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Measure per the label for your mixing container.",
      "Dissolve fully in water, then apply to the surface.",
      "Wait the label-recommended time, then wipe or mop clean.",
    ],
    specs: [
      ["Format", "Concentrated powder, 100 g"],
      ["Scents", "Fragrance-free, Lemon, Orange, Lavender, Coconut"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/1212_1-233639152.jpg?v=1717090546",
        alt: "SolutionsHOCL SuperWash 100 gram powder container",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42409501491421", title: "Fragrance-Free", sku: "GPC-100G-FF", price: 100.0, available: true },
      { id: "gid://shopify/ProductVariant/42409501524189", title: "Lemon", sku: "GPC-100G-LEM", price: 120.0, available: true },
      { id: "gid://shopify/ProductVariant/42409501622493", title: "Coconut", sku: "GPC-100G-COC", price: 120.0, available: true },
      { id: "gid://shopify/ProductVariant/42409501589725", title: "Lavender", sku: "GPC-100G-LAV", price: 120.0, available: true },
      { id: "gid://shopify/ProductVariant/42409501556957", title: "Orange", sku: "GPC-100G-ORG", price: 135.0, available: true },
    ],
    related: ["solutions-hocl-cleaner-10-grams", "powerwash-30days-supply"],
    shopifyId: "gid://shopify/Product/7559906459869",
    searchTerms: ["bulk cleaner", "commercial cleaner", "concentrate 100g"],
  },
  {
    handle: "hocl-general-purpose-cleaner-spray",
    title: "SuperWash Cleaner Spray – 20 g Pack",
    cardTitle: "SuperWash Cleaner Spray",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning"],
    shortBenefit: "A refillable spray system with concentrated refill packets.",
    description: [
      "A smarter spray bottle. The SuperWash Cleaner Spray pairs a reusable sprayer with concentrated packets, so you mix high-performance cleaner fresh instead of shipping water.",
      ingredientSentence("kitchen and bathroom surfaces, glass and fixtures"),
      FREE_OF,
    ],
    benefits: [
      "Reusable spray system with concentrated refills",
      "Cuts grease and grime on kitchen and bath surfaces",
      "Deodorizes as it cleans",
      "Five scent options",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Dissolve one packet in the sprayer filled with water.",
      "Spray the surface, wait the label-recommended time, then wipe clean.",
    ],
    specs: [
      ["Format", "Spray system with 20 g of concentrate"],
      ["Scents", "Fragrance-free, Lemon, Orange, Lavender, Coconut"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/Spray_e_fragrance_Scent.webp?v=1774480650",
        alt: "SolutionsHOCL SuperWash cleaner spray bottle with refill packets",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/46419374342365", title: "Fragrance Free", sku: "General Purpose Spray No Scent", price: 39.97, available: true },
      { id: "gid://shopify/ProductVariant/46419374375133", title: "Lemon Scent", sku: "General Purpose Spray Lemon Scent", price: 39.97, available: true },
      { id: "gid://shopify/ProductVariant/46419374407901", title: "Orange Scent", sku: "General Purpose Spray Orange Scent", price: 39.97, available: true },
      { id: "gid://shopify/ProductVariant/46419374440669", title: "Coconut Scent", sku: "General Purpose Spray Coconut Scent", price: 39.97, available: true },
      { id: "gid://shopify/ProductVariant/46419374473437", title: "Lavender Scent", sku: "General Purpose Spray Lavender Scent", price: 39.97, available: true },
    ],
    related: ["superwash-powder-2-gram-packets", "super-wash-500ppm"],
    boughtWith: ["superwash-powder-2-gram-packets"],
    shopifyId: "gid://shopify/Product/8843467981021",
    searchTerms: ["spray cleaner", "kitchen spray", "bathroom spray", "refillable spray"],
  },
  {
    handle: "two-2-ready-to-use-2-fl-oz-4-fl-oz-total-each-sprayers-plus-two-2-powerwash-powder-packets-that-makes-2-gallons",
    title: "PowerWash Spray Kit – Two 2 oz Bottles + 2 Packets",
    cardTitle: "PowerWash Spray Kit",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning"],
    shortBenefit: "Two ready-to-use travel sprayers plus refills that make 2 gallons.",
    description: [
      "Two ready-to-use, refillable 2 fl oz sprayers arrive prefilled in your chosen scent, with two PowerWash packets to refill up to two gallons of cleaner.",
      ingredientSentence("counters, handles, gear and hard surfaces on the go"),
      FREE_OF,
    ],
    benefits: [
      "Prefilled travel sprayers, ready to use anywhere",
      "Refill packets make up to 2 gallons of cleaner",
      "Cuts grease and grime on the go",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Spray the surface, wait the label-recommended time, then wipe clean.",
      "To refill, dissolve one packet per gallon of water and top up the sprayers.",
    ],
    specs: [
      ["Format", "Two 2 fl oz sprayers + 2 refill packets"],
      ["Scents", "Fragrance Free, Lemon, Orange"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/Two-_2_-Ready-to-use-2-FL-Oz.-_4-FL-Oz.-total_-each-Sprayers-PLUS-Two-_2_-PowerWash-Powder-Packets-that-makes-2-Gallons-Solutions-HOCL-233642837.webp?v=1753126555",
        alt: "SolutionsHOCL PowerWash spray kit with two bottles and packets",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42512184377565", title: "Fragrance Free", sku: "SHPL2-FF", price: 29.97, available: true },
      { id: "gid://shopify/ProductVariant/42512184410333", title: "Lemon", sku: "SHPL2.o Lemon Scent", price: 29.97, available: true },
      { id: "gid://shopify/ProductVariant/42512184508637", title: "Orange", sku: "SHPL2.o Orange Scent", price: 29.97, available: true },
    ],
    related: ["hocl-general-purpose-cleaner-spray", "superwash-powder-2-gram-packets"],
    shopifyId: "gid://shopify/Product/7602663129309",
    searchTerms: ["travel spray", "spray kit", "portable cleaner"],
  },
  {
    handle: "powerwash-30days-supply",
    title: "PowerWash Powder – 30-Day Supply – 30 Packs",
    cardTitle: "PowerWash 30-Day Supply",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning"],
    shortBenefit: "A month of daily deep cleaning, one packet at a time.",
    description: [
      "Thirty packets, thirty days of high-performance cleaning. The PowerWash 30-Day Supply keeps a fresh gallon of cleaner within reach all month.",
      ingredientSentence("everyday household surfaces"),
      FREE_OF,
    ],
    benefits: [
      "A full month of cleaning in one box",
      "Mix fresh cleaner daily or as needed",
      "Cuts grease and grime, deodorizes as it cleans",
      "Great savings versus single packs",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Dissolve one packet per gallon of water.",
      "Apply to the surface, wait the label-recommended time, then wipe clean.",
    ],
    specs: [
      ["Format", "30 concentrated powder packets"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/30dayssupply-227986861.jpg?v=1717090567",
        alt: "SolutionsHOCL PowerWash 30 day supply box",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42473227714781", title: "30-Day Supply", sku: "General Purpose 30D Solution", price: 59.97, available: true },
    ],
    badges: ["subscription"],
    subscription: true,
    replenish: { intervalDays: 30, note: "One box is a month of daily cleaning." },
    related: ["solutions-hocl-cleaner-10-grams", "superwash-cleaner-100-grams"],
    shopifyId: "gid://shopify/Product/7589447696605",
    searchTerms: ["monthly supply", "subscription cleaner", "30 day"],
  },
  {
    handle: "active-chlorine-test-strips-50",
    title: "Active Chlorine Test Strips – 50 Pack",
    cardTitle: "Active Chlorine Test Strips",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "water-tank-care", "accessories", "best-sellers"],
    shortBenefit: "Know exactly how strong your cleaning solution is, 0 to 1000 PPM.",
    description: [
      "Take the guesswork out of mixing. These test strips read active chlorine from 0 to 1000 PPM, so you can confirm your cleaning solution is at the strength the job calls for.",
      "Dip, wait, and match the pad to the color chart. Fifty strips per pack.",
    ],
    benefits: [
      "Reads 0 to 1000 PPM active chlorine",
      "Confirms your mix is at full cleaning strength",
      "Simple dip-and-match color chart",
      "50 strips per pack",
    ],
    howToUse: [
      "Dip a strip into the mixed solution for the time shown on the pack.",
      "Match the pad against the color chart to read PPM.",
    ],
    specs: [
      ["Range", "0 to 1000 PPM active chlorine"],
      ["Pack", "50 strips"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/active_test_strips_chlorine.webp?v=1779312713",
        alt: "SolutionsHOCL active chlorine test strips pack of fifty",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42409106440413", title: "50 Pack", sku: "Chlorine Test Strips 50 Pack", price: 29.97, available: true },
    ],
    badges: ["best-seller"],
    related: ["cistern-catchment-bomb", "solutions-hocl-cleaner-10-grams"],
    shopifyId: "gid://shopify/Product/7568252600541",
    searchTerms: ["test strips", "ppm strips", "chlorine test"],
  },
  {
    handle: "hypobright-pack",
    title: "HypoBright Laundry Additive – 10 Pack",
    cardTitle: "HypoBright Laundry Additive",
    brand: "solutionshocl",
    category: "cleaning",
    collections: ["solutionshocl", "household-cleaning"],
    shortBenefit: "Brighter laundry and fresher clothes, straight from the dispenser.",
    description: [
      "HypoBright is a high-performance additive for getting laundry bright and clothes fresh. Just add to the bleach dispenser. That is it.",
      ingredientSentence("fabric fibers and washer surfaces"),
      FREE_OF,
    ],
    benefits: [
      "Brightens whites and colors",
      "Neutralizes laundry odors at the source",
      "Simple dispenser format, ten treatments per pack",
      "Bleach-free, ammonia-free and phosphate-free",
    ],
    howToUse: [
      "Add one packet to the bleach dispenser.",
      "Run your normal wash cycle.",
    ],
    specs: [
      ["Format", "10 dispenser packets"],
      ["Formula", "Bleach-free, ammonia-free, phosphate-free, biodegradable"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/Untitled-1_2x_32d677b1-b23f-4a3f-b6f5-b0e66afabe28-227986957.jpg?v=1717090574",
        alt: "SolutionsHOCL HypoBright laundry additive ten pack",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/42658628370653", title: "10 Pack", sku: "HypoBright-10Pack", price: 25.0, available: true },
    ],
    related: ["solutions-hocl-cleaner-10-grams", "super-wash-500ppm"],
    shopifyId: "gid://shopify/Product/7654873071837",
    searchTerms: ["laundry additive", "laundry brightener", "whites"],
  },
];
