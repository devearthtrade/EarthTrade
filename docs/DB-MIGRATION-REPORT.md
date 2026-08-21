# Data migration report

Local development database only. No production domain, host or external service is involved.

Source: `src/data/generated/catalog.json` (a618695a-Earthtrade_products.csv)
Target: `earthtrade_dev` on PostgreSQL 16.13, localhost

## Result

**All 110 products are represented in the database.** Every field-level parity check in `db/verify.ts` passes.

| | Catalog | Database |
|---|---:|---:|
| Products | 110 | 110 |
| Variants | 110 | 110 |
| Brands | 5 | 5 |
| Categories | 4 | 4 |
| Collections | 8 | 8 |
| Collection memberships | 123 | 123 |
| Media assets | 109 | 109 |
| Media links | 109 | 109 |
| Published | 106 | 106 |
| Withheld | 4 | 4 |
| Quarantined copy blocks | 60 | 60 |
| Banned claims in names | 2 | 2 |
| Review flags | 455 | 455 |
| Provenance rows | 110 | 110 |
| Inventory levels | 0 | 0 |

Money survived exactly: the sum of every variant price is **1110449 cents**, matching the catalog to the cent.

## One count that legitimately differs

The catalog holds **114** image references but the database holds **109** media links. Five products list the same file twice, because the source CSV named it in both `Image Src` and `Variant Image`:

```
alkaline-water-pitcher-with-copper-bottle
hvo-beneficial-microbial-inoculant
superthrive®
toilet-bomb-fragrance-free
toilet-bomb-organic-lemon
```

The `UNIQUE (product_id, asset_id)` constraint collapsed each pair to one row. No image was lost. Those five products have one image each, not two, and an earlier report describing them as multi-image was counting the duplicate reference.

## Nothing failed to migrate

No product, variant, image, collection or compliance record failed to migrate. Nothing was skipped, truncated or altered.

What is **absent by design**, carried across as absent rather than invented:

| Field | Products | Stored as |
|---|---:|---|
| SKU | 30 | NULL on the variant |
| Shipping weight | 28 | NULL on the variant |
| SEO title | 70 | NULL on the product |
| Meta description | 33 | NULL on the product |
| Description | 7 | empty array in product_content |
| Image | 1 | no product_media row |
| Card benefit line | 8 | NULL on the product |
| Product type | 28 | NULL on the product |
| Stock quantity | 110 | no inventory_levels row |

Each gap is also a row in `product_flags`, so the Dashboard can query the review queue directly instead of recomputing a report.

## Withheld products

Four products are in the database but not publishable. They exist, they are correct, and `withheld_reason` records why each is held.

| Handle | Reason |
|---|---|
| `hawaiian-volcanic-organic-compost` | Price is 0.00 in the source |
| `pitcher-of-life-with-stainless-steel-infuser` | Price is 0.00 in the source |
| `rechargeable-atomizer-sprayer` | Product name states a banned claim: Atomizer |
| `ryobi-one-cordless-fogger-plus-two-10g-power-wash` | Product name states a banned claim: Fogger |

## Independence

Verified by query across storage keys, handles, SKUs and provenance origins:

- No Shopify identifier, GID reference or Shopify host anywhere
- No absolute media URLs; a CHECK constraint prevents them being inserted
- Media is addressed by storage key, so the serving origin is configuration

## Reproducing

```bash
node db/migrate.ts   # 8 migrations, forward-only
node db/seed.ts      # idempotent
node db/verify.ts    # 29 checks
```

Re-running the seed leaves counts unchanged, confirmed by seeding twice and re-verifying.
