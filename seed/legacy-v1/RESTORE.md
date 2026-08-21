# Legacy seed catalog (v1) — 35 products

Snapshot of the hand-authored catalog as it stood immediately before the
110-product CSV import, taken at commit `086a157`.

Contents: `products-hocl.ts` (18), `products-hvo.ts` (3), `products-water.ts`
(14), plus the `catalog.ts` aggregator and `articles.ts` of that generation.

## Why it is kept

The v1 product prose was written against `docs/COMPLIANCE.md` and reviewed. The
imported CSV copy has not been. If a compliance question arises about wording
that shipped before the import, this is the reference.

## Restoring

```bash
cp seed/legacy-v1/products-*.ts seed/legacy-v1/catalog.ts src/data/
node src/build.ts
```

That returns the storefront to the 35-product catalog exactly as it built at
`086a157`. `articles.ts` is unchanged by the import and is kept here only so the
snapshot is self-contained.
