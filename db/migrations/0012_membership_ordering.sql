-- 0012  Separate the two orderings membership carries.
--
-- collection_products sits between two lists, and they are ordered by different
-- people for different reasons:
--
--   * where a product sits within a collection — a merchandising decision, and
--     what the collection page reads down;
--   * where a collection sits within a product's list — which comes from the
--     product's own tags, and decides which collection its breadcrumb names.
--
-- One column cannot hold both. It held the second and was read as the first,
-- so collection pages were ordered by an index that meant nothing to them.
-- Splitting the two makes each ordering say what it is.

ALTER TABLE collection_products
  RENAME COLUMN position TO collection_position;

ALTER TABLE collection_products
  ADD COLUMN product_position integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN collection_products.collection_position IS
  'Rank of the product within the collection. Curated rows only; derived rows sort by handle.';
COMMENT ON COLUMN collection_products.product_position IS
  'Rank of the collection within the product''s own list. Decides the breadcrumb.';

DROP INDEX collection_products_ordered_idx;

CREATE INDEX collection_products_in_collection_idx
  ON collection_products(collection_id, source, collection_position);

CREATE INDEX collection_products_in_product_idx
  ON collection_products(product_id, product_position);
