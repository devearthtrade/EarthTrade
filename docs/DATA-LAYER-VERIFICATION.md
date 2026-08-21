# Data layer verification

Storefront reads moved from the generated JSON catalog to PostgreSQL. This
records what was checked and what changed.

Reproduce with:

```sh
node db/verify-data-layer.ts   # 55 checks
node src/build.ts                                        # builds from PostgreSQL
EARTHTRADE_CATALOG_SOURCE=json node src/build.ts         # builds from JSON
```

## Requested checks

| # | Check | Result |
|---|---|---|
| 1 | All 110 products load | 110 |
| 2 | All 110 variants load | 110 |
| 3 | All 109 media links load | 109 |
| 4 | Published / withheld remain 106 / 4 | 106 / 4 |
| 5 | Collections correct | 8 collections, membership identical for all 8 |
| 6 | Search works | Terms preserved (222); server-side search returns expected results |
| 7 | Product pages work | 106 rendered, one per published product, none for withheld |
| 8 | Filters work | Brand (5) and category (4) counts match the JSON build exactly |
| 9 | Related products work | 0 recorded relations returns 0 results; stated-rule fallback returns siblings |
| 10 | No Shopify dependency introduced | No reference in any source file; none in catalog data |
| 11 | No production network connection made | Database host is loopback; no HTTP client anywhere in the layer |

All 55 checks pass.

## JSON-rendered vs PostgreSQL-rendered storefront

Both builds produce **164 pages, 292 files**. Five files differ. Every other
byte of the site is identical.

### The difference

| Product | JSON build | PostgreSQL build |
|---|---|---|
| `alkaline-water-pitcher-with-copper-bottle` | 2 gallery thumbnails | 1 image, no thumbnail strip |
| `hvo-beneficial-microbial-inoculant` | 2 gallery thumbnails | 1 image, no thumbnail strip |
| `superthrive®` | 2 gallery thumbnails | 1 image, no thumbnail strip |
| `toilet-bomb-fragrance-free` | 2 gallery thumbnails | 1 image, no thumbnail strip |
| `toilet-bomb-organic-lemon` | 2 gallery thumbnails | 1 image, no thumbnail strip |

**Cause.** The source CSV names a product's image in two columns, `Image Src`
and `Variant Image`. For these five products both columns name the same file.
The JSON export lists the reference twice; the database stores one link per
distinct file, because `product_media` is keyed on `(product_id, asset_id)`.

**Effect.** The JSON build rendered a thumbnail strip offering a choice between
two identical pictures — *"View image 1 of 2"* and *"View image 2 of 2"*, both
the same photo — and listed the file twice in the page's `Product` JSON-LD
`image` array. The PostgreSQL build renders one image, no thumbnail strip, and
one entry in the JSON-LD.

**Assessment.** A correction, not a regression. No product loses an image, and
no product's photograph changes. Product shape, label, logo, packaging, colours
and dimensions are untouched — the only change is that the same file is no
longer offered twice.

No other difference exists across the 292 files.

## Issues found and fixed

Four problems surfaced during verification. All are fixed.

### 1. Search term was matched as a pattern (`src/server/repositories/search.ts`)

`ILIKE '%' || $1 || '%'` binds the search string safely as a parameter, so there
was never an injection risk — but it then hands the value to the pattern
matcher, where `%` and `_` are operators. A search for `%` matched every
published product — capped at the default limit of 20 results — instead of the
single product whose text actually contains the character.

Replaced with `strpos`, which has no metacharacters. Verified: `%` now returns
1 result of 106 published, `_` returns 0, `100%` returns 1.

### 2. Shopify leftovers in the domain model (`src/lib/types.ts`)

Three references predating the architecture correction were still in the
storefront's core type definitions:

- A header comment: *"Shapes mirror Shopify objects (handles, GIDs, variants) so
  the data layer can later be swapped for live Storefront API queries"*
- A field: `shopifyId?: string` — *"Shopify product GID when the product exists
  in a connected store"*
- A comment on `pricePlaceholder`: *"SolutionsHOCL and HVO prices come from the
  live Shopify store"*

The field was unused, but it was in the type every product flows through, and it
described an architecture that is prohibited. All three removed.

### 3. Review state was lost by the migration (`db/migrations/0010_review_state.sql`)

The seeder wrote `status = 'active'` for all 110 products because the schema's
status check allows only `draft`/`active`/`archived`. Ten products carried
`needs_review` in the JSON catalog. The underlying flags survived, but the count
did not, so the build report would have shown 0 products needing review instead
of 10.

Fixed by deriving review state from the flags in a view rather than storing it.
Now reports 10, matching the JSON catalog. Clearing it means resolving the flag.

### 4. Public variant identifiers were not stored (`db/migrations/0009_public_refs.sql`)

The database generated a fresh uuid per variant and did not keep the catalog's
`etv_…` identifier — the one that appears 546 times in the rendered site, in
cart forms and `data-` attributes, and that shoppers hold in `localStorage`.

Reading variants from Postgres would have replaced every one of them. Any cart
saved before the switch would have referenced variants that no longer appeared
to exist, and the failure would have been silent.

Added `product_variants.ref`, unique, backfilled from the catalog. All 110
variants carry theirs, on an existing database and on a freshly created one.

Migration 0009 also added `product_tags.position` (tag order feeds the search
index and a set has no order) and `product_pending_media` (one product
references an image with no file; the record would otherwise have been dropped).

## Not migrated

| Item | Count | Why |
|---|---|---|
| Inventory levels | 0 | No stock has been counted. Absence is recorded as unknown, never as zero |
| Product relationships | 0 | None recorded. `relatedTo` returns nothing rather than inventing pairings |
| Collection rules | 0 | All 8 collections are curated by membership rows |
| Extra search terms | 0 | Tags and product type cover every product |

One provenance value is deliberately retained: `pitcher-with-copper-bottle`
records the URL its unfetched image was originally listed at, which happens to
be a Shopify CDN address. It is a text column noting where a missing file came
from, for whoever supplies it. No code path reads it, and
`verify-data-layer.ts` reports it by name on every run rather than letting it
pass unnoticed.

## Not in scope

Not built, per instruction: checkout, payments, authentication, customer
accounts, orders, the Admin Dashboard, and any production deployment.

`repositories/variants.ts` includes `priceVariants`, which reads authoritative
prices from the database by variant reference. It exists so that when checkout
is built, order totals come from Postgres rather than from the browser. It is
not wired to anything yet.
