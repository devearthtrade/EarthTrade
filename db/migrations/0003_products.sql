-- 0003  Products, content, and the compliance record.
--
-- Publication is deliberately separate from status. A product can be complete,
-- active and correct yet still withheld because its own name states a claim
-- docs/COMPLIANCE.md forbids. Two of the 110 seeded products are in exactly
-- that position, so this is a real state and not a hypothetical one.

CREATE TABLE products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        citext NOT NULL UNIQUE,
  title         text   NOT NULL,
  card_title    text,
  short_benefit text,

  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  category_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  product_type  text,

  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'archived')),

  -- Compliance gate. publishable=false keeps a product out of the storefront
  -- without deleting it or pretending it does not exist.
  publishable     boolean NOT NULL DEFAULT false,
  withheld_reason text,

  price_provisional     boolean NOT NULL DEFAULT false,
  subscription_eligible boolean NOT NULL DEFAULT false,
  replenish_interval_days integer CHECK (replenish_interval_days IS NULL OR replenish_interval_days > 0),

  seo_title       text,
  seo_description text,

  published_at  timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- A withheld product must say why. Guards against a product silently
  -- vanishing from the storefront with no recorded reason.
  CONSTRAINT products_withheld_has_reason
    CHECK (publishable OR withheld_reason IS NOT NULL)
);

CREATE INDEX products_brand_idx    ON products(brand_id);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_status_idx   ON products(status);
-- The storefront only ever reads publishable, active products.
CREATE INDEX products_storefront_idx ON products(brand_id)
  WHERE publishable AND status = 'active';

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Prose lives apart from commerce so a merchandiser changing a price and a
-- reviewer approving copy are different operations with different risk.
CREATE TABLE product_content (
  product_id   uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  description  text[] NOT NULL DEFAULT '{}',
  benefits     text[] NOT NULL DEFAULT '{}',
  how_it_works text[] NOT NULL DEFAULT '{}',
  how_to_use   text[] NOT NULL DEFAULT '{}',
  included     text[] NOT NULL DEFAULT '{}',
  specs        jsonb  NOT NULL DEFAULT '[]',
  faqs         jsonb  NOT NULL DEFAULT '[]',
  disclaimer   text,
  draft        jsonb,
  compliance_state text NOT NULL DEFAULT 'approved'
                CHECK (compliance_state IN ('approved', 'pending', 'rejected')),
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER product_content_updated_at BEFORE UPDATE ON product_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Copy the screen held back, kept with the terms that held it so a reviewer
-- can see what was flagged rather than guessing.
CREATE TABLE product_quarantined_copy (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  body        text NOT NULL,
  matches     jsonb NOT NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_quarantined_copy_product_idx
  ON product_quarantined_copy(product_id)
  WHERE resolved_at IS NULL;

-- Banned claims found in the product name itself.
CREATE TABLE product_title_matches (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  term       text NOT NULL,
  reason     text NOT NULL,
  PRIMARY KEY (product_id, term)
);

-- The review queue as data, so the Dashboard can filter on it directly
-- instead of recomputing a report.
CREATE TABLE product_flags (
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flag        text NOT NULL,
  resolved_at timestamptz,
  PRIMARY KEY (product_id, flag)
);

CREATE INDEX product_flags_open_idx ON product_flags(flag) WHERE resolved_at IS NULL;

CREATE TABLE product_tags (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag        citext NOT NULL,
  PRIMARY KEY (product_id, tag)
);

CREATE INDEX product_tags_tag_idx ON product_tags(tag);

CREATE TABLE product_search_terms (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  term       text NOT NULL,
  PRIMARY KEY (product_id, term)
);

CREATE TABLE product_relations (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('related', 'bought_with', 'replacement')),
  position   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, related_id, kind),
  CONSTRAINT product_relations_not_self CHECK (product_id <> related_id)
);
