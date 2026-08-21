# EarthTrade database, local development

Local-only PostgreSQL foundation for the catalog. No application features are
built on it yet: no checkout, payments, customers, authentication, orders,
loyalty, or Admin Dashboard.

The storefront is untouched and still builds from
`src/data/generated/catalog.json`. The database is populated in parallel so it
can be inspected and iterated on without any risk to the live site.

## Requirements

- PostgreSQL 16
- Node 22.18+ (the repo has no `node_modules`; the tooling drives `psql`)

## Setup

```bash
# 1. start a local server
pg_ctlcluster 16 main start

# 2. create the development role and database
su postgres -c "psql -c \"CREATE ROLE earthtrade LOGIN PASSWORD 'earthtrade_dev_only';\""
su postgres -c "createdb -O earthtrade earthtrade_dev"

# 3. apply the schema
node db/migrate.ts

# 4. load the 110-product catalog
node db/seed.ts

# 5. confirm every product survived
node db/verify.ts
```

## Commands

| Command | Effect |
|---|---|
| `node db/migrate.ts` | Apply pending migrations |
| `node db/migrate.ts --status` | List applied and pending, change nothing |
| `node db/seed.ts` | Load the catalog. Idempotent |
| `node db/seed.ts --dry-run` | Build the SQL, write nothing |
| `node db/verify.ts` | Field-by-field parity against `catalog.json` |

## Connection

Read from the environment, defaulting to a local development database:

| Variable | Default |
|---|---|
| `PGHOST` | `127.0.0.1` |
| `PGPORT` | `5432` |
| `PGUSER` | `earthtrade` |
| `PGPASSWORD` | `earthtrade_dev_only` |
| `PGDATABASE` | `earthtrade_dev` |

**A non-local host is refused** unless `EARTHTRADE_ALLOW_REMOTE_DB=yes` is set.
That guard exists so a stray environment variable cannot point local tooling at
something real. The default password is a development placeholder and is not a
secret; a real deployment supplies credentials through the environment.

## Migrations

Forward-only, numbered, applied once each, recorded in `schema_migrations` with
a checksum.

- Each migration and its ledger entry run in **one transaction**. A failure
  leaves the database exactly as it was.
- If an applied migration's file later changes, the runner **refuses to run**.
  The database would no longer match its own history, and proceeding would hide
  that. Add a new migration instead of editing one that has run.

```
0001_extensions.sql        pgcrypto, citext, shared updated_at trigger
0002_brands_categories.sql brands, categories
0003_products.sql          products, content, compliance, flags, tags, relations
0004_variants.sql          product_variants
0005_media.sql             media_assets, product_media
0006_collections.sql       collections, membership, smart-collection rules
0007_inventory.sql         locations, levels, movements, reservations
0008_provenance_audit.sql  product_sources, audit_log
```

## Seeding

`src/data/generated/catalog.json` is the seed **source**, not a sync target.
The direction is one-way: JSON to Postgres. After the Dashboard can write, the
database is authoritative.

The seeder is idempotent and keyed on natural keys (brand slug, product handle,
variant SKU or product plus title), so re-running updates in place. It runs in a
single transaction.

**Nothing is invented.** A missing SKU, weight, description or category is
inserted as `NULL`.

**No `inventory_levels` rows are created.** The source carries no stock figures,
and absence means *unknown*, which is a different fact from *zero in stock*.
Only one of those should block a sale, and neither should be guessed.
