/**
 * Hawaiian Volcanic Organic™ catalog - real products from the connected
 * Shopify store, captured 2026-08-20. The broader HVO range (top soil,
 * potting soil, coco coir, seeds) is described on the brand page and will
 * be added to the catalog when synced from the EarthTrade store.
 */

import type { Product } from "../lib/types.ts";

export const hvoProducts: Product[] = [
  {
    handle: "hawaiian-bokashi-compost-starter",
    title: "Hawaiian Bokashi Compost Starter",
    brand: "hawaiian-volcanic-organic",
    category: "gardening",
    collections: ["organic-gardening", "best-sellers"],
    shortBenefit: "Kick-start compost with 34 naturally occurring minerals.",
    description: [
      "Hawaiian Bokashi Compost Starter is a fermented blend that accelerates decomposition in compost piles and bokashi buckets, turning kitchen scraps and garden waste into rich, living compost faster.",
      "The premium blend incorporates glauconite, a mineral deposit from the ocean floor carrying over 34 naturally occurring minerals, acting as an organic slow-release fertilizer while the beneficial microorganisms do their work.",
      "Use 1 pound per 1 cubic yard of soil for gardens and grow beds.",
    ],
    benefits: [
      "Accelerates compost decomposition",
      "34 naturally occurring minerals from glauconite",
      "Improves soil structure, porosity and moisture retention",
      "Helps convert locked-up nutrients into plant-available forms",
      "Works in bokashi buckets, compost piles and grow beds",
    ],
    howToUse: [
      "Sprinkle a thin layer over each addition of kitchen scraps or green waste.",
      "For garden beds, mix 1 pound per cubic yard of soil.",
      "Keep the pile lightly moist and turn as usual.",
    ],
    specs: [
      ["Weight", "2 lb"],
      ["Application rate", "1 lb per cubic yard of soil"],
      ["Minerals", "34 naturally occurring minerals"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/compost-stater.webp?v=1727811323",
        alt: "Hawaiian Bokashi Compost Starter bag",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/45732688101597", title: "2 Pounds", sku: "HVO-BOK-COMP-2LB", price: 29.97, available: true },
    ],
    badges: ["organic"],
    replenish: { intervalDays: 90, note: "A 2 lb bag covers a season of steady composting." },
    related: ["hawaiian-bokashi-inoculant", "inoculant-liquid-concentrate"],
    boughtWith: ["hawaiian-bokashi-inoculant"],
    shopifyId: "gid://shopify/Product/8814232436957",
    searchTerms: ["compost starter", "bokashi", "compost accelerator"],
  },
  {
    handle: "hawaiian-bokashi-inoculant",
    title: "Hawaiian Bokashi Inoculant",
    brand: "hawaiian-volcanic-organic",
    category: "gardening",
    collections: ["organic-gardening"],
    shortBenefit: "Feed the microbial ecosystem in gardens and grow beds.",
    description: [
      "Hawaiian Bokashi Inoculant is a versatile fermented blend that enhances the microbial ecosystem in gardens and grow beds. Whether you are growing mushrooms, vegetables or ornamentals, it helps build living soil from the ground up.",
      "The microorganisms break down organic matter more efficiently, improving soil structure so it holds moisture while staying light and porous, and helping release locked-up nutrients into forms plant roots can absorb.",
    ],
    benefits: [
      "Enriches soil with beneficial microorganisms",
      "Speeds the breakdown of compost and kitchen scraps",
      "Improves soil structure and moisture retention",
      "Makes nutrients more bioavailable to roots",
    ],
    howToUse: [
      "Work into the top layer of garden beds or mix into grow-bed media.",
      "Add to compost or bokashi systems to boost microbial activity.",
    ],
    specs: [["Weight", "2 lb"]],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/bokashi_inoculant.webp?v=1752691980",
        alt: "Hawaiian Bokashi Inoculant bag",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/45732653465821", title: "2 Pounds", sku: "HVO-BOK-INOC-2LB", price: 29.97, available: true },
    ],
    badges: ["organic"],
    related: ["hawaiian-bokashi-compost-starter", "inoculant-liquid-concentrate"],
    boughtWith: ["hawaiian-bokashi-compost-starter"],
    shopifyId: "gid://shopify/Product/8814213464285",
    searchTerms: ["bokashi inoculant", "soil microbes", "living soil"],
  },
  {
    handle: "inoculant-liquid-concentrate",
    title: "HVO Microbial Inoculant Concentrate – Foliar Spray",
    cardTitle: "Microbial Inoculant Concentrate",
    brand: "hawaiian-volcanic-organic",
    category: "gardening",
    collections: ["organic-gardening"],
    shortBenefit: "A liquid boost of beneficial microorganisms for soil and leaf.",
    description: [
      "Beneficial Microbial Inoculant is a liquid concentrate built on bokashi cultures and effective microorganisms. Dilute and apply as a foliar spray or soil drench to support a thriving root zone.",
      "Regular applications help maintain the microbial life that makes organic soil productive: cycling nutrients, improving structure and supporting healthy growth.",
    ],
    benefits: [
      "Concentrated liquid, dilutes for foliar or soil application",
      "Built on bokashi cultures and effective microorganisms",
      "Supports nutrient cycling in the root zone",
      "Pairs with Hawaiian Bokashi products for a complete system",
    ],
    howToUse: [
      "Dilute per the label for foliar spraying or soil drenching.",
      "Apply in the morning or evening, avoiding strong midday sun.",
    ],
    specs: [
      ["Sizes", "16 oz and 32 oz"],
      ["Application", "Foliar spray or soil drench"],
    ],
    images: [
      {
        src: "https://cdn.shopify.com/s/files/1/0623/7995/0301/files/HVO1-16-ounce-1.webp?v=1727811923",
        alt: "HVO Microbial Inoculant Concentrate bottle",
      },
    ],
    variants: [
      { id: "gid://shopify/ProductVariant/45732693016797", title: "16 oz", sku: "HVO-INOC-16OZ", price: 28.97, available: true },
      { id: "gid://shopify/ProductVariant/45732693049565", title: "32 oz", sku: "HVO-INOC-32OZ", price: 49.97, available: true },
    ],
    badges: ["organic"],
    subscription: true,
    replenish: { intervalDays: 60, note: "Apply monthly during the growing season." },
    related: ["hawaiian-bokashi-inoculant", "hawaiian-bokashi-compost-starter"],
    shopifyId: "gid://shopify/Product/8814245052637",
    searchTerms: ["microbial inoculant", "foliar spray", "organic fertilizer", "effective microorganisms"],
  },
];
