-- 0006  Collections.
--
-- Membership is curated rows plus, for smart collections, stored predicates.
-- That mirrors the storefront, which unions hand-ordered handles with
-- tag-derived membership.

CREATE TABLE collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle      citext NOT NULL UNIQUE,
  title       text NOT NULL,
  hero_title  text,
  eyebrow     text,
  description text,
  editorial   text[] NOT NULL DEFAULT '{}',
  theme       text,
  kind        text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'smart')),
  is_hidden   boolean NOT NULL DEFAULT false,
  seo_title   text,
  seo_description text,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE collection_products (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX collection_products_product_idx ON collection_products(product_id);
CREATE INDEX collection_products_order_idx   ON collection_products(collection_id, position);

CREATE TABLE collection_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  field         text NOT NULL CHECK (field IN ('brand', 'category', 'tag', 'price', 'subscription')),
  operator      text NOT NULL CHECK (operator IN ('eq', 'neq', 'lt', 'gt', 'in')),
  value         jsonb NOT NULL
);

CREATE INDEX collection_rules_collection_idx ON collection_rules(collection_id);
