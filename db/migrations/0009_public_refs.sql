-- 0009  Public variant references, tag ordering, and unfetched media.
--
-- Three facts the storefront depends on that the schema had no room for.
-- Found while moving the storefront's reads off the JSON catalog and onto
-- Postgres: each one would have been silently lost at that boundary.
--
-- 1. product_variants.ref
--
--    Variants have two identities. `id` is internal: a uuid, generated here,
--    meaningful only to this database. `ref` is the public one the storefront
--    puts in cart forms and shoppers carry in localStorage between visits.
--
--    They have to be separate. If the public identifier were the uuid, then
--    reseeding a development database, restoring a backup, or recreating a
--    variant through the Dashboard would mint a new id and quietly invalidate
--    every cart already referencing the old one. `ref` is derived from the
--    product and variant rather than from the row, so it survives all three.
--
-- 2. product_tags.position
--
--    Tag order comes from the source data and feeds the search index. A set
--    has no order, so re-reading tags from Postgres would have reshuffled
--    them against the imported catalog.
--
-- 3. product_pending_media
--
--    One imported product references an image that could not be fetched. It
--    is not rendered and is not a media asset, but it is a real gap in the
--    catalog. Recording it keeps it visible for whoever supplies the file,
--    instead of dropping the only evidence the product is missing a photo.

ALTER TABLE product_variants
  ADD COLUMN ref text;

-- Backfilled from the imported catalog by db/seed.ts, then made mandatory in a
-- later migration once every row is known to carry one. Made unique now so a
-- duplicate can never be written in the meantime.
CREATE UNIQUE INDEX product_variants_ref_key ON product_variants(ref);

COMMENT ON COLUMN product_variants.ref IS
  'Stable public variant identifier used in carts and URLs. Never the uuid.';

ALTER TABLE product_tags
  ADD COLUMN position integer NOT NULL DEFAULT 0;

CREATE TABLE product_pending_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Where the file is expected to land once it exists.
  storage_key text NOT NULL,
  alt         text,
  -- Where it was referenced from. Kept verbatim for provenance; this is a
  -- record of an unresolved reference, not a URL anything fetches.
  source_url  text,
  position    integer NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (product_id, storage_key)
);

CREATE INDEX product_pending_media_unresolved_idx
  ON product_pending_media(product_id) WHERE resolved_at IS NULL;
