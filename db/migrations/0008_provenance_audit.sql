-- 0008  Provenance and audit.
--
-- Records where each product came from, so a value can be traced back to a
-- file and row long after the import, and distinguishes imported products from
-- ones created by hand in the Dashboard.

CREATE TABLE product_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  origin        text NOT NULL,          -- 'csv:<file>' or 'admin'
  source_row    integer,
  source_handle text,
  source_sku    text,
  imported_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_sources_product_idx ON product_sources(product_id);
CREATE INDEX product_sources_origin_idx  ON product_sources(origin);

-- Every mutation of a price, stock level or publication state lands here, in
-- the same transaction as the change so the log cannot drift from reality.
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor       text,                     -- admin user id once auth exists
  action      text NOT NULL,            -- price.update, inventory.adjust, ...
  entity_type text NOT NULL,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_log_created_idx ON audit_log(created_at DESC);
