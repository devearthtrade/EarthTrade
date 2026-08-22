-- 0014  What the Admin Dashboard needs and the schema does not yet have.
--
-- Four gaps, found by working backwards from the screens:
--
--   1. Curated references that no longer resolve are reported when the seeder
--      drops them and then forgotten. There are 61 of them. They are work
--      somebody has to do, so they need somewhere to live.
--   2. Brands have no SEO fields and no logo, though their pages have both.
--   3. audit_log exists but nothing writes to it, and its actor column is
--      nullable, so a record can exist without saying who caused it.
--   4. Audit is read by actor as well as by entity and by time, and only the
--      first two of those are indexed (0008).

/* --------------------------- curation gaps ------------------------------- */

-- A curated product reference that names a product the catalog does not have.
--
-- Kept rather than dropped because it is a decision someone made that has come
-- unstuck: the product was renamed, replaced, or never imported. Only a person
-- can say which. Nothing here guesses a replacement, and there is deliberately
-- no "resolve automatically" path — a wrong guess would put the wrong product
-- in front of a customer under a heading somebody chose by hand.
CREATE TABLE curation_gaps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Where the dangling reference lives. A collection today; bundles and quiz
  -- results are still defined in code and will land here when they move.
  source_type    text NOT NULL CHECK (source_type IN ('collection', 'bundle', 'quiz')),
  source_handle  text NOT NULL,
  -- The handle that was curated and does not resolve. Kept verbatim.
  missing_handle text NOT NULL,
  position       integer NOT NULL DEFAULT 0,

  -- How a person settled it. NULL while it is still open.
  resolution     text CHECK (resolution IN ('mapped', 'removed', 'reviewed')),
  -- The product a person chose to stand in for the missing one. Only set for
  -- 'mapped', and never chosen by the system.
  mapped_to      uuid REFERENCES products(id) ON DELETE SET NULL,
  note           text,
  resolved_at    timestamptz,
  resolved_by    text,

  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source_type, source_handle, missing_handle),

  -- A resolution and its evidence travel together.
  CONSTRAINT curation_gaps_resolution_complete
    CHECK ((resolution IS NULL) = (resolved_at IS NULL)),
  CONSTRAINT curation_gaps_mapped_has_target
    CHECK (resolution IS DISTINCT FROM 'mapped' OR mapped_to IS NOT NULL)
);

CREATE INDEX curation_gaps_open_idx ON curation_gaps(source_type, source_handle)
  WHERE resolved_at IS NULL;

/* ------------------------------ brand fields ----------------------------- */

ALTER TABLE brands
  ADD COLUMN seo_title       text,
  ADD COLUMN seo_description text,
  ADD COLUMN logo_id         uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN logo_alt        text;

ALTER TABLE brands
  ADD CONSTRAINT brands_logo_alt_with_logo
    CHECK (logo_id IS NULL OR logo_alt IS NOT NULL);

/* -------------------------------- audit ---------------------------------- */

-- Every mutation records who did it. There is no authentication yet, so the
-- actor is whatever the caller declares — which is worth recording even so:
-- knowing a change came from `seed` rather than `dashboard` is most of the
-- value, and the column is ready for a real identity when there is one.
ALTER TABLE audit_log
  ALTER COLUMN actor SET DEFAULT 'unknown';

UPDATE audit_log SET actor = 'unknown' WHERE actor IS NULL;

ALTER TABLE audit_log
  ALTER COLUMN actor SET NOT NULL;

-- 0008 already indexes (entity_type, entity_id, created_at) and (created_at).
-- "What did this actor change?" is the third question an audit view is asked.
CREATE INDEX audit_log_actor_idx ON audit_log(actor, created_at DESC);

COMMENT ON TABLE audit_log IS
  'Append-only record of every mutation. Never updated, never deleted.';
