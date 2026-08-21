-- 0004  Variants.
--
-- Every one of the 110 seeded products is single-variant today. Variants are
-- still a separate table: the Dashboard will create multi-variant products,
-- and retrofitting that later would mean rewriting every price read.
--
-- sku is nullable because 30 seeded products have none. It therefore cannot
-- serve as an identity, which is why dedup falls back to handle.

CREATE TABLE product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku           citext UNIQUE,
  title         text NOT NULL,
  position      integer NOT NULL DEFAULT 0,

  -- Money is integer minor units. Never numeric, never float.
  price_cents      integer NOT NULL CHECK (price_cents >= 0),
  compare_at_cents integer CHECK (compare_at_cents IS NULL OR compare_at_cents >= 0),
  currency         char(3) NOT NULL DEFAULT 'USD',

  weight_grams  integer CHECK (weight_grams IS NULL OR weight_grams > 0),
  barcode       text,
  requires_shipping boolean NOT NULL DEFAULT true,
  taxable       boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- A strike-through price below the real price is a pricing error, not a sale.
  CONSTRAINT variants_compare_at_above_price
    CHECK (compare_at_cents IS NULL OR compare_at_cents >= price_cents)
);

CREATE INDEX variants_product_idx ON product_variants(product_id, position);
CREATE INDEX variants_sku_idx     ON product_variants(sku) WHERE sku IS NOT NULL;

CREATE TRIGGER variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
