-- 0005  Media.
--
-- storage_key holds a key, not an absolute URL, so the serving origin is
-- configuration. Moving from local files to object storage plus CDN becomes a
-- config change rather than a data migration, and no third-party host can
-- creep back into the data.

CREATE TABLE media_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key text NOT NULL UNIQUE,
  kind        text NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
  mime_type   text,
  width       integer CHECK (width IS NULL OR width > 0),
  height      integer CHECK (height IS NULL OR height > 0),
  byte_size   integer CHECK (byte_size IS NULL OR byte_size >= 0),
  checksum    text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- No absolute URLs, and in particular no third-party CDN.
  CONSTRAINT media_assets_key_is_relative
    CHECK (storage_key !~ '^[a-z]+://')
);

CREATE TABLE product_media (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asset_id   uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  alt        text,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, asset_id)
);

CREATE INDEX product_media_product_idx ON product_media(product_id, position);
CREATE INDEX product_media_asset_idx   ON product_media(asset_id);
