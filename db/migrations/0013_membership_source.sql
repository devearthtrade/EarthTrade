-- 0013  Membership can have both origins at once.
--
-- `source` was a single value, 'curated' or 'derived', which forced a choice
-- that does not exist: a product can be curated into a collection *and* be a
-- member of it through its own tags. Writing one origin overwrote the other,
-- and the product's collection list then had no way to tell which collections
-- described the product from which merely displayed it.
--
-- Two flags instead of one value. A row records how it came to be, and can
-- record both.

ALTER TABLE collection_products
  ADD COLUMN is_curated boolean NOT NULL DEFAULT false,
  ADD COLUMN is_derived boolean NOT NULL DEFAULT false;

UPDATE collection_products SET
  is_curated = (source = 'curated'),
  is_derived = (source = 'derived');

ALTER TABLE collection_products DROP COLUMN source;

-- A membership row with neither origin is a row nobody can explain.
ALTER TABLE collection_products
  ADD CONSTRAINT collection_products_has_an_origin
    CHECK (is_curated OR is_derived);

COMMENT ON COLUMN collection_products.is_curated IS
  'Someone chose to put this product here. Curated rows lead the collection.';
COMMENT ON COLUMN collection_products.is_derived IS
  'The product''s own tags put it here. Derived rows describe what it is.';

-- Dropping `source` takes the index that referenced it with it, so there is
-- nothing to drop here — only to rebuild on the column that replaced it.
CREATE INDEX collection_products_in_collection_idx
  ON collection_products(collection_id, is_curated, collection_position);
