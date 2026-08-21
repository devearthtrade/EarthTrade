-- 0001  Extensions and shared conventions.
--
-- pgcrypto  gen_random_uuid() for primary keys.
-- citext    case-insensitive external keys (handle, slug, sku), so
--           "CIS-500G" and "cis-500g" cannot both exist.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Every mutable table carries updated_at. One trigger function serves them all.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
