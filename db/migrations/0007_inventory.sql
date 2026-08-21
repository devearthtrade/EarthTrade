-- 0007  Inventory.
--
-- No seeded product gets an inventory row. The source carried no stock
-- figures, and absence here means "unknown", which is a different fact from
-- "zero in stock". Only one of those should block a sale, and neither should
-- be invented.

CREATE TABLE inventory_locations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       citext NOT NULL UNIQUE,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER inventory_locations_updated_at BEFORE UPDATE ON inventory_locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE inventory_levels (
  variant_id    uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  on_hand       integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved      integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  safety_stock  integer NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  backorderable boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, location_id),

  -- Reserved stock cannot exceed what is physically held.
  CONSTRAINT inventory_reserved_within_on_hand CHECK (reserved <= on_hand)
);

CREATE TRIGGER inventory_levels_updated_at BEFORE UPDATE ON inventory_levels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sellable quantity, in one place so no caller re-derives it differently.
CREATE OR REPLACE FUNCTION inventory_sellable(lvl inventory_levels)
RETURNS integer AS $$
  SELECT GREATEST(0, lvl.on_hand - lvl.reserved - lvl.safety_stock);
$$ LANGUAGE sql IMMUTABLE;

-- Append-only ledger. Every movement stays explainable after the fact.
CREATE TABLE inventory_movements (
  id             bigserial PRIMARY KEY,
  variant_id     uuid NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  location_id    uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  delta          integer NOT NULL CHECK (delta <> 0),
  reason         text NOT NULL
                 CHECK (reason IN ('receipt', 'sale', 'return', 'correction', 'shrink', 'transfer')),
  reference_type text,
  reference_id   uuid,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_variant_idx ON inventory_movements(variant_id, created_at DESC);

-- Short-lived holds taken when a checkout begins, released on expiry.
CREATE TABLE inventory_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  quantity    integer NOT NULL CHECK (quantity > 0),
  reference   text,
  state       text NOT NULL DEFAULT 'held'
              CHECK (state IN ('held', 'committed', 'released')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_reservations_expiry_idx
  ON inventory_reservations(expires_at) WHERE state = 'held';
CREATE INDEX inventory_reservations_variant_idx
  ON inventory_reservations(variant_id) WHERE state = 'held';
