# Catalog import report

Source: `a618695a-Earthtrade_products.csv` - 110 source rows - 110 imported, 0 skipped.

The importer is `scripts/import-catalog.ts`. It is deterministic and safe to
re-run: the same CSV produces the same output, so corrections and asset
uploads can be picked up by running it again.

```bash
node scripts/import-catalog.ts <csv-path>   # rewrites src/data/generated/catalog.json
node src/build.ts
```

## Result

| | Count |
|---|---|
| Imported from CSV | 110 |
| Published to the storefront | 106 |
| Withheld pending a decision | 4 |
| Pages built | 164 |

Nothing was invented. Every field absent from the CSV is absent from the
catalog and listed below.

### By brand

| Brand | Products |
|---|---|
| Pitcher of Life | 43 |
| Life Ionizers | 41 |
| SolutionsHOCL | 15 |
| Hawaiian Volcanic Organic | 7 |
| Life Sciences Water | 4 |

Vendor spellings `Hawaiian Volcanic Organic` and `HawaiianVolcanicOrganic`
were normalised to one brand.

### By collection

| Collection | Products |
|---|---|
| `pitcher-of-life` | 45 |
| `life-ionizers` | 41 |
| `solutionshocl` | 15 |
| `wellness` | 8 |
| `organic-gardening` | 7 |
| `water-filtration` | 5 |
| `bundles` | 1 |
| `accessories` | 1 |

Source tags were normalised where they denote the same collection:
`pitcher of life`, `Pitcher of Life with Flower of Life` and `Flower of Life`
all map to `pitcher-of-life`; `Water Systems` and `Water Pitchers` both map to
`water-filtration`.

## Withheld from the storefront

These four import into `catalog.json` but do not render. They are recoverable
by fixing the underlying issue and re-running the importer.

| Product | Reason |
|---|---|
| `hawaiian-volcanic-organic-compost`<br>100% Natural Hawaiian Volcanic Organic Compost with 7 pounds of Bokash | Price is 0.00 in the CSV |
| `pitcher-of-life-with-stainless-steel-infuser`<br>Pitcher of Life with Stainless Steel Infuser | Price is 0.00 in the CSV |
| `rechargeable-atomizer-sprayer`<br>HOCL Cleaner with Rechargeable Atomizer Sprayer for Home/Office/Auto K | Product name states a claim banned by `docs/COMPLIANCE.md` (Atomizer) |
| `ryobi-one-cordless-fogger-plus-two-10g-power-wash`<br>Ryobi ONE+ Cordless Fogger PLUS Two (2) Powder 10 Pack (1 gram packets | Product name states a claim banned by `docs/COMPLIANCE.md` (Fogger) |

A product name cannot be rewritten without misdescribing the product, so the
two compliance cases need a decision from you: supply a compliant name, or
confirm the product stays off the storefront.

## Requires manual correction

| Gap | Products | Effect today |
|---|---|---|
| Image weight over 300 KB | 23 | Slow first paint on product and collection pages |
| Stock quantity absent from CSV | 110 | Availability unresolved; nothing can be oversold yet because checkout is not connected |
| No SEO title | 70 | Page title falls back to the product title |
| No image alt text | 52 | Alt falls back to the product title |
| No source category | 42 | Category derived from brand |
| No SEO description | 33 | Meta description falls back |
| No SKU | 30 | Variant has no SKU |
| No product type | 28 | Not used for categorisation |
| No shipping weight | 28 | Shipping cannot be rated by weight |
| No description at all | 7 | Product page has no overview |
| No short benefit | 8 | Card shows title only |

### Products with no SKU

```
12-packs-of-flower-of-life-stickers
25-bpa-free-tubing-3-foot-increments
5-stage-reverse-osmosis-system
6-stage-ro-system-with-mineral-cartridge-housing
alkaline-water-pitcher-with-copper-bottle
borosilicate-glass-pitcher-of-life-alkaline-water-purifier
catchment-bomb
catchment-bomb-500-grams
cistern-catchment-bomb-500g
cistern-catchment-bomb-tank-cleaner
cistern-tank-cleaner-100-grams
cistern-tank-cleaner-500-grams
dolphin-xl-home-agriculture-filtration-system-1-inlet-outlet
fluoride-reduction-system
hawaiian-bokashi-compost-starter
hawaiian-bokashi-inoculant
hawaiian-volcanic-organic-compost
hvo-beneficial-microbial-inoculant
hvo-organic-fertilizer
life-reverse-osmosis-post-filter-™
pitcher-of-life-with-stainless-steel-infuser
pitcher-with-copper-bottle
pre-filter-wrench
reverse-osmosis-alkaline-water-purifier-undercounter
ro-membrane-50-gpd-1
shower-filter-replacement-composite-filter-with-four-4-pp-polymer-cotton-filters
superthrive®
toilet-bomb-fragrance-free
toilet-bomb-organic-lemon
top-soil
```

### Products with no description

```
7700-9000-9200-9200-filter-1
life-ionizer-5100-internal-replacement-filter-1
life-ionizer-5100-internal-replacement-filter-2
life-ionizer-5100-internal-replacement-filter-citric-acid-cleaning-cartridge
life-water-filter-mx-mxl-1-internal-replacement-filter
mx-mxl-2-internal-replacement-filter
pitcher-of-life-with-stainless-steel-infuser
```

## Copy held for compliance review

41 products had at least one paragraph quarantined. The paragraph is
kept in `catalog.json` under `quarantinedContent` with the matched terms; it
is not rendered. Everything else from that product's description publishes.

Screening is scoped the way `docs/COMPLIANCE.md` is scoped. The kill, safety,
water and application-method rules apply to SolutionsHOCL copy. All brands are
screened for invented certifications, medical claims and unsupported
environmental claims.

| Product | Blocks held | Terms |
|---|---|---|
| `borosilicate-glass-pitcher-of-life-alkaline-water-purifier` | 4 | eco-friendly, nsf |
| `rechargeable-atomizer-sprayer` | 4 | disinfectant, non-toxic, sanitization, sanitizer |
| `reverse-osmosis-alkaline-water-purifier-undercounter` | 3 | immune system, nsf |
| `3-stages-filters` | 2 | epa, nsf |
| `auto-ship-glass-pitcher-of-life-f007-ultra-replacement-filter-3-pack` | 2 | nsf |
| `catchment-bomb` | 2 | eco-friendly |
| `catchment-bomb-500-grams` | 2 | eco-friendly |
| `countertop-alkaline-water-purifier` | 2 | nsf |
| `glass-pitcher-of-life-f004-3pack-replacement-filters` | 2 | nsf |
| `glass-pitcher-of-life-f004-replacement-filters-3-pack` | 2 | nsf |
| `glass-pitcher-of-life-f004-singlepack-replacement-filters` | 2 | nsf |
| `glass-pitcher-of-life-f007-ultra-replacement-filter` | 2 | nsf |
| `hydrogen-alkaline-bio-energy-water-system` | 2 | nsf |
| `ryobi-one-cordless-fogger-plus-two-10g-power-wash` | 2 | atomizers, fogger, misters, spores |
| `5-replacement-filter-bundle-1` | 1 | eco-friendly |
| `active-chlorine-test-strips-50` | 1 | disinfecting |
| `auto-ship-pitcher-of-life-2nd-gen-replacement-filter-3-pack` | 1 | nsf |
| `auto-ship-replacement-filters-pack-of-3` | 1 | nsf |
| `cistern-tank-cleaner-500-grams` | 1 | eco-friendly |
| `copper-bottle-black-and-copper-color` | 1 | eco-friendly |
| `copper-bottle-blue-and-white-color-peacock-design` | 1 | eco-friendly |
| `copper-bottle-flowers-design` | 1 | eco-friendly |
| `copper-bottle-igrets-white-bird-design` | 1 | eco-friendly |
| `copper-bottle-peacock-and-flower-design` | 1 | eco-friendly |
| `copper-bottle-pounded-design` | 1 | eco-friendly |

...and 16 more, all listed in `catalog.json`.

## Product images

All 109 referenced images were uploaded to `public/images/` and are now served
from EarthTrade's own origin. 109 of the 106
published products carry a photograph; the one product with no image in the CSV
is withheld for a separate reason.

The CSV names 15 files with a `.webp` extension where the uploaded asset is a
`.jpg`. The importer matches on filename stem, so those resolve automatically.
No image URL points at a third-party host.

### Image weight needs attention

| | |
|---|---|
| Product images | 109 files, 40 MB |
| Average | 375 KB |
| Over 300 KB | 23 files |
| Largest | 5.7 MB |

For comparison, the 13 art-directed background images total 112 KB. The heaviest
product files are:

```
    5829 KB  hvofertilizer_443865da-bd15-4a83-ae8e-e0541cac6b30.png
    5677 KB  SolutionsHOCLUnscented.png
    4815 KB  Borosilicate_Glass_Pitcher_of_Life_Alkaline_Water_Purifier_with_Food-Grade_Stainless_Steel_Infuser.png
    1860 KB  FlowerofLifeAlkalineWaterPITCHERwithCopperBottle-LotusFlowerDesign.png
    1226 KB  green1_8dfe1ebd-666f-4cac-ba2c-fe6a94c971aa.png
```

A collection page renders up to 44 of these. Cards use `loading="lazy"` and
carry explicit dimensions, so layout is stable and off-screen images defer, but
the weight will still hurt Core Web Vitals on a slow connection.

Recommended before launch: resize to the display size (cards render at roughly
600x750) and serve AVIF or WebP with a JPEG fallback. That is a change to your
uploaded assets, so I have not done it. The originals are in git either way.

## Editorial links

The imported catalog renames or omits products the journal was written against.

Two handles were confirmed as the same product under a new name and are aliased
in `src/data/aliases.ts`. **Please confirm both:**

| Was | Now |
|---|---|
| `cistern-catchment-bomb` | `cistern-catchment-bomb-tank-cleaner` |
| `cistern-tank-cleaner` | `cistern-tank-cleaner-100-grams` (base size) |

Thirteen article links had no honest equivalent. Those anchors were unwrapped:
the sentence still reads, the link is gone, nothing 404s. They need an editorial
decision about what to point at.

```
boat-tank-cleaner
super-wash-500ppm
inoculant-liquid-concentrate
pitcher-of-life-2nd-generation
life-mxl-replacement-filter
rv-water-tank-cleaner
life-ionizer-mxl-9
life-ionizer-mxl-15
```

## What the CSV does not contain

Worth flagging, because it changes what the storefront can say:

- **No Life Ionizer machines.** 41 Life Ionizers rows are filters, housings and
  parts. The MXL-5 to MXL-15 units are absent, so `/compare/ionizers` has
  nothing to compare and now shows a notice pointing at the filter finder.
- **No Pitcher of Life pitcher.** The pitchers themselves are missing; the 43
  Pitcher of Life rows are mostly replacement filters.
- **No SolutionsHOCL core range.** SuperWash, PowerWash, the RV and marine tank
  cleaners and the toilet bombs are not in this export.
- **No stock quantities** on any row.

Two bundles and two quiz results lost all their products as a result and are
withheld from render rather than shown empty:

```
bundles:      rv-ready, complete-water, water-starter, cistern-care, home-cleaning
quiz results: ionizer-large, ionizer-core
```

## Rollback

The previous 35-product catalog is retained at `seed/legacy-v1/` with restore
instructions, and in git at `086a157`.
