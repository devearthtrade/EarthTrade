# Data access layer

The storefront reads its catalog from PostgreSQL. This document describes how,
and the decisions worth knowing about before changing any of it.

```
 templates            src/site/*.ts            synchronous, unchanged
      ↑
 catalog seam         src/data/catalog.ts      synchronous
      ↑
 loading boundary     src/data/imported.ts     ← the only await
      ↑
 sources              src/data/sources/        postgres | json
      ↑
 repositories         src/server/repositories/ one module per concern
      ↑
 database             src/server/db/           pool, wire protocol
      ↑
 PostgreSQL           local, 127.0.0.1:5432
```

## Where the async boundary lives

Templates are synchronous and stay that way. `src/data/imported.ts` loads the
catalog once with a top-level `await` and exports plain values; by the time any
page imports it, the data is already there.

The alternative — making every page renderer async — would have meant threading
promises through the whole site to gain nothing. A static build reads the
catalog exactly once. One await at the boundary is the entire cost.

## Modules

### `src/server/db/`

| File | What it is |
|---|---|
| `protocol.ts` | PostgreSQL wire protocol v3 over a socket: SCRAM-SHA-256 auth, extended query protocol, type decoding |
| `pool.ts` | Connection pool. Lazy, capped, FIFO waiters |
| `config.ts` | Connection settings from the environment, with a local-host guard |
| `index.ts` | `query`, `rows`, `one`, `withConnection`, `close` |

`protocol.ts` exists because this project has no `node_modules` — the package
registry is unreachable from the build environment, so `pg` cannot be
installed. It is not a general-purpose driver and should be replaced with `pg`
when that becomes possible; nothing above `db/index.ts` would change.

**Parameters are never concatenated into SQL.** The client uses the extended
query protocol, where `Parse` carries the statement text and `Bind` carries the
values as separate protocol messages. The server never sees user data in a
position where it could be parsed as SQL. This is a structural property, not an
escaping convention that someone could forget to apply.

### `src/server/repositories/`

| File | Reads |
|---|---|
| `products.ts` | Product rows, filters, publication counts |
| `variants.ts` | Variants, sellable stock, authoritative prices by reference |
| `brands.ts` | Brands and categories |
| `collections.ts` | Collections, membership, rules |
| `media.ts` | Images, unfetched images, products without any |
| `search.ts` | Tags, search terms, server-side product search |
| `relations.ts` | Recorded relationships, and a stated-rule fallback |
| `publication.ts` | Withheld products and why |
| `compliance.ts` | Quarantined copy, banned title terms, and the write-side screen |
| `catalog.ts` | Assembles whole product records from all of the above |
| `types.ts` | The record shapes returned |

Repositories return records, not template props. Mapping to what a page renders
happens in `src/data/catalog-record.ts`, above this layer.

## Decisions

### Variants have two identities

`product_variants.id` is a uuid, internal to the database. `product_variants.ref`
(`etv_…`) is the public identifier that appears in cart forms and that shoppers
carry in `localStorage` between visits.

They must be separate. If the public identifier were the uuid, reseeding a
development database, restoring a backup, or recreating a variant through the
Admin Dashboard would mint a new id and silently invalidate every cart holding
the old one. `ref` is derived from the product and variant, so it survives all
three.

### Unknown stock is not zero stock

A variant with no `inventory_levels` row has `sellable: null`, not `0`. Nothing
has been counted yet. Telling a shopper an item is unavailable when nobody has
checked is a lie in the expensive direction, so the distinction is carried all
the way to the template.

No inventory has been recorded for any of the 110 products. Every variant is
currently `null`.

### Review state is derived, not stored

The imported catalog carried a status of `active` or `needs_review`. Only the
first is a lifecycle state; the second is a conclusion drawn from a product's
flags. It is now the `product_review_state` view, so the build, the reports and
the Dashboard cannot each answer "does this need review?" differently. Clearing
it means fixing the flag, not overwriting a column.

### Search matches literally

`searchProducts` uses `strpos`, not `ILIKE`. Binding a value as a parameter
keeps it out of the SQL, but `ILIKE '%' || $1 || '%'` still hands it to the
pattern matcher, where `%` and `_` are operators — a shopper searching for
"100%" would have matched the entire catalog. `strpos` has no metacharacters.

### Compliance screening has one implementation

`src/lib/compliance.ts` holds the rules. The CSV importer uses it, and
`repositories/compliance.ts` exposes `screenProduct` over the same functions for
anything that creates or edits a product later. A Dashboard that wrote products
without calling it would let hand-entered copy bypass a check every imported
product passed through.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PGHOST` | `127.0.0.1` | Non-local hosts are refused unless `EARTHTRADE_ALLOW_REMOTE_DB=yes` |
| `PGPORT` | `5432` | |
| `PGUSER` | `earthtrade` | |
| `PGPASSWORD` | `earthtrade_dev_only` | Local development credential. Not a secret, and not reused anywhere |
| `PGDATABASE` | `earthtrade_dev` | |
| `PGPOOL_SIZE` | `4` | |
| `EARTHTRADE_CATALOG_SOURCE` | `postgres` | `json` renders from the generated export instead, for comparison |

`EARTHTRADE_CATALOG_SOURCE=json` is a comparison tool, not a fallback. If
Postgres is unreachable the build fails loudly rather than quietly serving a
stale copy of the catalog.

## Running it

```sh
node db/migrate.ts            # apply pending migrations
node db/seed.ts               # load the catalog (idempotent)
node db/verify.ts             # database vs the catalog record
node db/verify-data-layer.ts  # storefront reads, JSON vs PostgreSQL
node src/build.ts             # build from PostgreSQL
```

Setup for a fresh machine is in `db/README.md`.
