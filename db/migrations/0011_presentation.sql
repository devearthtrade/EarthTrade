-- 0011  Brand and collection presentation, and curated membership.
--
-- Until now PostgreSQL was the source of truth for products only. Brands and
-- collections existed as rows, but everything that makes them readable — a
-- brand's story, a collection's editorial copy, its curated product order, its
-- FAQs — was still a literal in src/data/catalog.ts. Editing a collection
-- meant editing source code, which is not a thing an Admin Dashboard can do.
--
-- This migration gives those facts a home.

/* --------------------------- collection content -------------------------- */

-- The site renders category collections, brand collections and merchandising
-- collections. `kind` describes how membership is decided; this describes what
-- the collection is, which is a different question.
ALTER TABLE collections
  ADD COLUMN role text NOT NULL DEFAULT 'editorial'
    CHECK (role IN ('category', 'brand', 'editorial'));

-- A collection's hero image. Nullable: most collections have none, and an
-- invented one would be a picture of something that does not exist.
ALTER TABLE collections
  ADD COLUMN image_id  uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN image_alt text;

ALTER TABLE collections
  ADD CONSTRAINT collections_image_alt_with_image
    CHECK (image_id IS NULL OR image_alt IS NOT NULL);

CREATE TABLE collection_faqs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  question      text NOT NULL,
  answer        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (collection_id, question)
);

CREATE INDEX collection_faqs_collection_idx ON collection_faqs(collection_id, position);

CREATE TRIGGER collection_faqs_updated_at BEFORE UPDATE ON collection_faqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- "You might also like" between collections. Directed: that A points at B does
-- not mean B points back, and the pages differ accordingly.
CREATE TABLE collection_relations (
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  related_id    uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,

  PRIMARY KEY (collection_id, related_id),
  CONSTRAINT collection_relations_not_self CHECK (collection_id <> related_id)
);

/* -------------------------- curated membership --------------------------- */

-- Membership arrives two ways and the difference matters. A curated row is a
-- decision someone made about what a collection leads with. A derived row is a
-- consequence of a product's tags. Curated rows come first and hold their
-- order; derived rows fill in behind them.
--
-- Keeping both in one table with a source column means the storefront reads
-- membership with one ordered query instead of merging two lists in code, and
-- means re-importing the catalog cannot quietly discard a curation decision.
ALTER TABLE collection_products
  ADD COLUMN source text NOT NULL DEFAULT 'derived'
    CHECK (source IN ('curated', 'derived'));

CREATE INDEX collection_products_ordered_idx
  ON collection_products(collection_id, source, position);

/* ------------------------------ brand content ---------------------------- */

ALTER TABLE brands
  ADD COLUMN image_id  uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN image_alt text,
  -- The collection a brand's page sends people to. A brand without one is not
  -- broken; its page simply does not offer the link.
  ADD COLUMN collection_id uuid REFERENCES collections(id) ON DELETE SET NULL;

ALTER TABLE brands
  ADD CONSTRAINT brands_image_alt_with_image
    CHECK (image_id IS NULL OR image_alt IS NOT NULL);
