# EarthTrade PostgreSQL data model

Proposal for review. **Nothing here is implemented.**

Covers the schema for products, variants, brands, collections, media, inventory,
customers, orders and discounts; the migration architecture that gets the
current catalog into it; and what has to change in the storefront when catalog
data stops being a JSON file.

The model is grounded in what the 110-product catalog actually contains, not in
a generic commerce shape. Where the real data forced a decision, that is stated.

## Contents

1. [Principles](#principles)
2. [What the current data forces](#what-the-current-data-forces)
3. [Schema](#schema)
4. [Manual product creation](#manual-product-creation)
5. [Migration architecture](#migration-architecture)
6. [Storefront impact](#storefront-impact)
7. [Open questions](#open-questions)

---

## Principles

1. **No Shopify anywhere.** No Shopify IDs, no API, no CDN, no Liquid, no
   assumption that a Shopify export is the source of truth. Identifiers are
   EarthTrade UUIDs; `handle` and `sku` are the only external keys, and they are
   ours.
2. **Money is integer minor units.** `*_cents integer` plus a currency code. The
   catalog is already stored this way, so the migration is a copy, not a
   conversion.
3. **The browser is never trusted for money.** Prices, discounts, shipping, tax
   and totals are computed server-side. The client sends variant and quantity.
4. **Orders are immutable.** An order snapshots title, SKU, price and address at
   capture, so later catalog edits never rewrite what someone was charged.
5. **Compliance state is first-class.** `docs/COMPLIANCE.md` governs product
   copy. Quarantined text, banned-claim matches and publishability are columns,
   not comments, so no admin path can publish held copy by accident.
6. **Absent stays absent.** A missing SKU, weight or description migrates as
   `NULL`. Nothing is invented to satisfy a `NOT NULL`.

---

## What the current data forces

Facts from the audit that shaped the schema:

| Observation | Consequence |
|---|---|
| All 110 products are **single-variant** | Variants must still be a separate table. The Admin Dashboard will create multi-variant products, and retrofitting that later means rewriting every price read. |
| **30 products have no SKU** | `sku` is nullable, and cannot be the primary key or a required identity. Dedup falls back to `handle`. |
| **28 have no weight** | `weight_grams` nullable. Weight-based shipping cannot cover the whole catalog yet. |
| **No product has stock** | Inventory is a separate table with no row required. Absence means unknown, which is different from zero. |
| **2 products priced 0.00** | Price is `NOT NULL` but a zero price is legal and flagged, not blocked. Publishability is a separate decision. |
| **2 product names state banned claims** | `publishable` and `title_matches` are columns. A product can exist, be correct, and still not render. |
| **41 products carry quarantined copy** | Held text lives in its own table with the matched terms, never in the rendered description. |
| **5 products have more than one image** | Media is one-to-many with explicit ordering from day one. |
| Prices already integer cents | Migration copies `price_cents` directly. No float rounding step. |
| Every image is a local path under `/images/` | `storage_key` holds a key, not an absolute URL, so the origin can move without a data migration. |

---

## Schema

PostgreSQL 16. UUID primary keys via `pgcrypto`, `citext` for case-insensitive
external keys, `timestamptz` throughout.

### Catalog

```sql
CREATE TABLE brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        citext NOT NULL UNIQUE,        -- solutionshocl, life-ionizers
  name        text NOT NULL,                 -- "SolutionsHOCL™"
  tagline     text,
  summary     text,
  story       text[] NOT NULL DEFAULT '{}',
  theme       text,                          -- drives the brand page treatment
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug      citext NOT NULL UNIQUE,          -- water, cleaning, gardening, wellness
  name      text NOT NULL,
  parent_id uuid REFERENCES categories(id),
  position  integer NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        citext NOT NULL UNIQUE,      -- URL key, carried from the import
  title         text NOT NULL,
  card_title    text,                        -- short title for cards
  short_benefit text,                        -- one line on the product card
  brand_id      uuid NOT NULL REFERENCES brands(id),
  category_id   uuid REFERENCES categories(id),
  product_type  text,                        -- 28 are NULL today

  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','archived')),

  -- Publication is separate from status. A product can be complete and active
  -- yet withheld because its name states a claim we cannot publish.
  publishable   boolean NOT NULL DEFAULT false,
  withheld_reason text,

  price_provisional boolean NOT NULL DEFAULT false,
  subscription_eligible boolean NOT NULL DEFAULT false,
  replenish_interval_days integer,

  seo_title       text,
  seo_description text,

  published_at  timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON products (brand_id);
CREATE INDEX ON products (status) WHERE status = 'active';

-- Description paragraphs, ordered. Kept out of products so the compliance
-- workflow can gate copy without touching commerce columns.
CREATE TABLE product_content (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  description  text[] NOT NULL DEFAULT '{}',
  benefits     text[] NOT NULL DEFAULT '{}',
  how_it_works text[] NOT NULL DEFAULT '{}',
  how_to_use   text[] NOT NULL DEFAULT '{}',
  included     text[] NOT NULL DEFAULT '{}',
  specs        jsonb  NOT NULL DEFAULT '[]',
  faqs         jsonb  NOT NULL DEFAULT '[]',
  disclaimer   text,                          -- approved tank disclaimer only
  draft        jsonb,                         -- pending edit awaiting approval
  compliance_state text NOT NULL DEFAULT 'approved'
                CHECK (compliance_state IN ('approved','pending','rejected')),
  approved_by  uuid REFERENCES admin_users(id),
  approved_at  timestamptz
);

-- Copy held back by the compliance screen, with the terms that held it.
CREATE TABLE product_quarantined_copy (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  body       text NOT NULL,
  matches    jsonb NOT NULL,                  -- [{reason, term}]
  resolved_at timestamptz,
  resolved_by uuid REFERENCES admin_users(id)
);

-- Banned-claim matches found in the product name itself.
CREATE TABLE product_title_matches (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reason     text NOT NULL,
  term       text NOT NULL,
  PRIMARY KEY (product_id, term)
);

CREATE TABLE product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku           citext UNIQUE,                -- 30 products have none
  title         text NOT NULL,                -- "100 Grams", "Default Title"
  position      integer NOT NULL DEFAULT 0,
  price_cents   integer NOT NULL CHECK (price_cents >= 0),
  compare_at_cents integer CHECK (compare_at_cents >= 0),
  currency      char(3) NOT NULL DEFAULT 'USD',
  weight_grams  integer CHECK (weight_grams > 0),
  barcode       text,
  requires_shipping boolean NOT NULL DEFAULT true,
  taxable       boolean NOT NULL DEFAULT true,
  tax_class_id  uuid REFERENCES tax_classes(id),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON product_variants (product_id, position);

CREATE TABLE product_relations (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('related','bought_with','replacement')),
  position   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, related_id, kind),
  CHECK (product_id <> related_id)
);

CREATE TABLE product_tags (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag        citext NOT NULL,
  PRIMARY KEY (product_id, tag)
);

-- Extra search terms folded into the index: model numbers, problems solved.
CREATE TABLE product_search_terms (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  term       text NOT NULL,
  PRIMARY KEY (product_id, term)
);
```

### Media

```sql
CREATE TABLE media_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL UNIQUE,           -- "products/cistern-100g.webp"
  kind        text NOT NULL DEFAULT 'image'
              CHECK (kind IN ('image','video')),
  mime_type   text,
  width       integer,
  height      integer,
  byte_size   integer,
  checksum    text,                           -- dedupes re-uploads
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_media (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asset_id   uuid NOT NULL REFERENCES media_assets(id),
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  alt        text,                            -- 52 fall back to the title today
  position   integer NOT NULL DEFAULT 0,
  UNIQUE (product_id, asset_id)
);

CREATE INDEX ON product_media (product_id, position);
```

`storage_key` is a key, not a URL. The serving origin is configuration, so
moving from local files to object storage plus CDN is a config change rather
than a data migration. Video is modelled but unused; no product has one.

### Collections

```sql
CREATE TABLE collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle      citext NOT NULL UNIQUE,
  title       text NOT NULL,
  hero_title  text,
  eyebrow     text,
  description text,
  editorial   text[] NOT NULL DEFAULT '{}',
  theme       text,
  kind        text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','smart')),
  is_hidden   boolean NOT NULL DEFAULT false,
  seo_title   text,
  seo_description text,
  position    integer NOT NULL DEFAULT 0
);

-- Curated membership and order.
CREATE TABLE collection_products (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

-- Rule-driven membership for smart collections, evaluated on write.
CREATE TABLE collection_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  field         text NOT NULL,   -- brand | category | tag | price | subscription
  operator      text NOT NULL,   -- eq | neq | lt | gt | in
  value         jsonb NOT NULL
);
```

The storefront currently unions curated handles with tag-derived membership.
That behaviour maps onto `collection_products` for curation plus
`collection_rules` for the derived part, so nothing is lost.

### Inventory

```sql
CREATE TABLE inventory_locations (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code    citext NOT NULL UNIQUE,
  name    text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE inventory_levels (
  variant_id    uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES inventory_locations(id),
  on_hand       integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved      integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  safety_stock  integer NOT NULL DEFAULT 0,
  backorderable boolean NOT NULL DEFAULT false,
  PRIMARY KEY (variant_id, location_id)
);
-- sellable = on_hand - reserved - safety_stock

-- Append-only. Every change is explainable after the fact.
CREATE TABLE inventory_movements (
  id            bigserial PRIMARY KEY,
  variant_id    uuid NOT NULL REFERENCES product_variants(id),
  location_id   uuid NOT NULL REFERENCES inventory_locations(id),
  delta         integer NOT NULL,
  reason        text NOT NULL,  -- receipt | sale | return | correction | shrink
  reference_type text, reference_id uuid,
  actor_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Short-lived holds taken at checkout, released on expiry.
CREATE TABLE inventory_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid NOT NULL REFERENCES product_variants(id),
  location_id uuid NOT NULL REFERENCES inventory_locations(id),
  quantity    integer NOT NULL CHECK (quantity > 0),
  order_id    uuid REFERENCES orders(id),
  state       text NOT NULL DEFAULT 'held'
              CHECK (state IN ('held','committed','released')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON inventory_reservations (expires_at) WHERE state = 'held';
```

**No product has an inventory row after migration.** Absence means unknown,
which is deliberately distinct from zero. Until a real count is entered, a
variant is not sellable, and the storefront says so rather than guessing.

Reservations are taken with a conditional update so two shoppers cannot both
take the last unit:

```sql
UPDATE inventory_levels
   SET reserved = reserved + $qty
 WHERE variant_id = $v AND location_id = $l
   AND (on_hand - reserved - safety_stock) >= $qty
RETURNING *;   -- zero rows means insufficient stock
```

### Customers

```sql
CREATE TABLE customers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext NOT NULL UNIQUE,
  email_verified_at timestamptz,
  password_hash     text,                     -- argon2id; null = passwordless
  first_name text, last_name text, phone text,
  accepts_marketing boolean NOT NULL DEFAULT false,
  marketing_consent_at timestamptz,
  locked_until      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text, line1 text NOT NULL, line2 text,
  city text NOT NULL, region text, postal_code text,
  country_code char(2) NOT NULL, phone text,
  is_default_shipping boolean NOT NULL DEFAULT false,
  is_default_billing  boolean NOT NULL DEFAULT false
);

-- Opaque server-side sessions. No JWT in localStorage: an XSS bug must not
-- hand out a portable, unrevokable credential.
CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash  bytea NOT NULL UNIQUE,
  user_agent  text, ip_hash bytea,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);

CREATE TABLE email_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('verify','reset','magic_link')),
  token_hash  bytea NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz
);
```

### Carts and orders

```sql
CREATE TABLE carts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    bytea NOT NULL UNIQUE,
  customer_id   uuid REFERENCES customers(id),
  currency      char(3) NOT NULL DEFAULT 'USD',
  discount_code citext,
  state         text NOT NULL DEFAULT 'active'
                CHECK (state IN ('active','converted','abandoned')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

-- No price column. Totals recompute from product_variants on every read, so a
-- stale client can never pin an old price.
CREATE TABLE cart_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id),
  quantity   integer NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, variant_id)
);

CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     text NOT NULL UNIQUE,       -- ET-100042
  customer_id      uuid REFERENCES customers(id),   -- null for guest
  email            citext NOT NULL,
  status           text NOT NULL DEFAULT 'pending_payment',
  fulfillment_status text NOT NULL DEFAULT 'unfulfilled',
  currency         char(3) NOT NULL,
  subtotal_cents   integer NOT NULL,
  discount_cents   integer NOT NULL DEFAULT 0,
  shipping_cents   integer NOT NULL DEFAULT 0,
  tax_cents        integer NOT NULL DEFAULT 0,
  total_cents      integer NOT NULL,
  shipping_rate_name text,
  discount_code    citext,
  access_token_hash bytea NOT NULL,            -- guest order lookup
  placed_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents)
);

-- Full snapshot. An order stays readable after the product is renamed,
-- repriced or archived.
CREATE TABLE order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id       uuid REFERENCES product_variants(id),  -- nullable by design
  product_handle   text NOT NULL,
  product_title    text NOT NULL,
  variant_title    text NOT NULL,
  sku              text,
  quantity         integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL,
  line_discount_cents integer NOT NULL DEFAULT 0,
  line_tax_cents   integer NOT NULL DEFAULT 0,
  line_total_cents integer NOT NULL
);

CREATE TABLE order_addresses (
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind     text NOT NULL CHECK (kind IN ('shipping','billing')),
  name text, line1 text, line2 text, city text, region text,
  postal_code text, country_code char(2), phone text,
  PRIMARY KEY (order_id, kind)
);

CREATE TABLE order_events (
  id         bigserial PRIMARY KEY,
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  payload    jsonb,
  actor_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

The `CHECK` on `orders` makes an arithmetically impossible order unwritable,
beneath whatever the application believes.

### Discounts

```sql
CREATE TABLE discounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           citext UNIQUE,               -- null = automatic
  title          text NOT NULL,
  kind           text NOT NULL
                 CHECK (kind IN ('percentage','fixed_amount','free_shipping')),
  value          integer NOT NULL,            -- basis points, or cents
  min_subtotal_cents integer,
  applies_to     text NOT NULL DEFAULT 'order'
                 CHECK (applies_to IN ('order','products','collections','brands')),
  starts_at timestamptz, ends_at timestamptz,
  usage_limit integer, usage_limit_per_customer integer,
  used_count     integer NOT NULL DEFAULT 0,
  stackable      boolean NOT NULL DEFAULT false,
  priority       integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true
);

CREATE TABLE discount_conditions (
  discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('product','collection','brand')),
  ref_id      uuid NOT NULL,
  PRIMARY KEY (discount_id, kind, ref_id)
);

CREATE TABLE discount_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id uuid NOT NULL REFERENCES discounts(id),
  order_id    uuid NOT NULL REFERENCES orders(id),
  customer_id uuid REFERENCES customers(id),
  amount_cents integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (discount_id, order_id)
);
```

Usage limits increment `used_count` under a guard inside the checkout
transaction. Counting redemptions afterwards lets concurrent checkouts race
past a single-use code.

### Provenance and audit

```sql
-- Where each value came from. Carried over from the importer so any field can
-- be traced to a file and row after migration.
CREATE TABLE product_sources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  origin     text NOT NULL,       -- 'csv:Earthtrade_products.csv' | 'admin'
  source_row integer,
  source_handle text,
  source_sku text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- The review queue, as data rather than a report.
CREATE TABLE product_flags (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flag       text NOT NULL,       -- missing_sku, inventory_unknown, ...
  resolved_at timestamptz,
  PRIMARY KEY (product_id, flag)
);

CREATE TABLE admin_users (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email    citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role     text NOT NULL
           CHECK (role IN ('owner','admin','catalog','support','compliance')),
  mfa_secret text,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES admin_users(id),
  action      text NOT NULL,      -- price.update, inventory.adjust, order.refund
  entity_type text NOT NULL, entity_id uuid,
  before jsonb, after jsonb,
  ip_hash     bytea,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

`product_flags` is the audit's review queue turned into rows, so the Dashboard
can filter "products missing a SKU" without recomputing a report.

---

## Manual product creation

The Dashboard will create products that never came from a CSV. The schema
supports that without special cases:

- `handle` is the only required external key, generated from the title and
  editable before first publish.
- `sku` is nullable, so a product can be saved before its SKU is known.
- `products.status` starts `draft`; `publishable` stays false until the
  compliance screen has run over the title and copy.
- `product_sources.origin = 'admin'` distinguishes hand-created products from
  imported ones, so provenance stays honest.
- The same compliance screen the importer uses must run on save. If it lives
  only in `scripts/import-catalog.ts`, a product created by hand bypasses it.
  **Extract the screen into a shared module before the Dashboard is built.**

---

## Migration architecture

Forward-only numbered SQL migrations, run in CI before deploy, each reversible
by a paired down-migration where a down is meaningful.

```
migrations/
  0001_extensions.sql        pgcrypto, citext
  0002_brands_categories.sql
  0003_products.sql          products, content, quarantined copy, title matches
  0004_variants.sql
  0005_media.sql
  0006_collections.sql
  0007_inventory.sql
  0008_customers.sql
  0009_carts_orders.sql
  0010_discounts.sql
  0011_provenance_audit.sql
  0012_seed_catalog.sql      the 110 products, idempotent
```

### Seeding

`catalog.json` is the seed source, not a sync target. The seeder is idempotent,
keyed on `handle` and `sku`, so re-running against a fresh database produces the
same result.

| Step | Detail |
|---|---|
| 1. Brands and categories | 5 brands, 4 categories, from the catalog aggregation |
| 2. Products | 110 rows. `publishable` and `withheld_reason` carried across |
| 3. Content | Description paragraphs; `compliance_state = 'approved'` (already reviewed) |
| 4. Quarantined copy | 41 products' held text with matched terms |
| 5. Variants | 110 rows. `price_cents` copied directly, no conversion |
| 6. Media | 109 assets, 114 links, alt where present |
| 7. Collections | 8 collections plus curated order |
| 8. Flags | The review queue, so nothing is lost in translation |
| 9. Inventory | **No rows.** Absence means unknown |

Verification after seed: row counts match the audit exactly, every price is an
integer, no `gid://` or `shopify` string appears anywhere, and every
`storage_key` resolves to a file.

### Rollback

`seed/legacy-v1/` holds the pre-import 35-product catalog. `catalog.json` stays
in the repo after migration as the reproducible seed. Until the Dashboard can
write, Postgres is a read replica of the JSON, and reverting is a config flag.

---

## Storefront impact

The site is a static generator. **The design does not change**, and no template
markup needs rewriting. The changes are in how data arrives.

### The one structural problem

`src/data/catalog.ts` and `src/data/imported.ts` are **entirely synchronous** —
zero `async`/`await`. Every template calls `getProduct()`, `collectionProducts()`
and `productPrice()` synchronously, and ten modules import them.

Making the data layer `async` would ripple into every template and page
function. **It should not be.** Instead:

> `build.ts` loads the whole catalog from Postgres once, at the start of the
> build, into the same in-memory structures `catalog.ts` exposes today. The
> catalog is 110 products; it fits in memory trivially. Every template keeps its
> synchronous API and none of them change.

That confines the async boundary to one function in one file.

### Module-by-module

| Module | Change | Notes |
|---|---|---|
| `src/data/imported.ts` | **Replace** | Becomes a Postgres reader instead of a JSON reader. Same exported shape. |
| `src/data/catalog.ts` | **Small edit** | One `await loadCatalog()` at module init; everything downstream unchanged. |
| `src/data/generated/catalog.json` | **Retained** | Stays as the seed and as an offline build fallback. |
| `src/build.ts` | **Small edit** | Await the catalog load before emitting routes. Already async. |
| `src/lib/types.ts` | **Regenerate** | From the schema. Add `inventory`, `availability`, per-variant media. |
| `src/pages/*.ts` | **No change** | They read from `catalog.ts` and never touch storage. |
| `src/site/components.ts` | **No change** | Unless stock badges are added, which is a new feature not a migration. |
| `src/site/app.js` | **Later** | Cart, checkout and auth move server-side. Not part of the catalog migration. |
| `scripts/import-catalog.ts` | **Retained** | Still the CSV path. Writes to Postgres instead of JSON. |
| `scripts/catalog-report.ts` | **Small edit** | Query the database instead of reading the file. |
| `scripts/merge-report.ts` | **Small edit** | Same. |

### Things that must not regress

- **Money stays integer cents** end to end. The display adapter converts to
  dollars at the last moment; that conversion is the only place floats appear.
- **The compliance screen** must move out of the importer into a shared module,
  or hand-created products bypass it.
- **`getProducts()` drops unknown handles.** Curated collections, bundles and
  quiz results depend on that tolerance. A DB version must behave identically or
  stale curation starts throwing.
- **Withheld products must stay out** of `products` as the storefront sees it.
  The adapter filters on `publishable`; the DB query must apply the same filter,
  not leave it to the template.
- **`search-index.json` and `sitemap.xml`** are build artifacts derived from the
  catalog. Both keep working as long as the load happens before emit.

### Not affected

Templates, CSS, the design system, `app.js` behaviour, routing, the 164-page
output, article content, and every page's markup.

---

## Open questions

These need decisions before implementation, not before approval of the shape:

1. **Opening stock counts.** Nothing is sellable until real quantities exist.
   Physical count, or an opening-balance file?
2. **Locations.** One warehouse, or several? The schema supports many; seeding
   one is simpler if that matches reality.
3. **The 30 products without a SKU.** Assign SKUs before or after migration?
   Before is cleaner, since `sku` is the dedup fallback for manual additions.
4. **Tax.** Internal rate tables, or a tax service? US destination sourcing is
   genuinely hard and this changes the order schema slightly.
5. **Hosting** for Postgres, the API and object storage.
6. **The two withheld product names** stating banned claims: supply compliant
   names, or keep them off the storefront permanently?
