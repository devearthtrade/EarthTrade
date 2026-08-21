-- 0010  Review state as a view.
--
-- The imported catalog carried a status of 'active' or 'needs_review'. Only the
-- first is a lifecycle state; 'needs_review' is a conclusion drawn from a
-- product's flags — it has no price, or no description, or all of its copy was
-- quarantined. Storing it as a status conflated two different things and meant
-- a product could be marked reviewed while still carrying the flags that put it
-- there.
--
-- So it is derived, not stored. The flags are the fact; this is the reading of
-- them, in one place, so the storefront build, the reports and the Admin
-- Dashboard cannot each answer "does this need review?" differently.

CREATE VIEW product_review_state AS
SELECT
  p.id,
  p.handle,
  -- Withheld products always need review: something is stopping them from
  -- being sold. Beyond that, these are the flags that mean a human has to look
  -- at the product before it is fit to publish, as opposed to the flags that
  -- merely note a missing nice-to-have.
  (NOT p.publishable
   OR EXISTS (
     SELECT 1 FROM product_flags f
      WHERE f.product_id = p.id
        AND f.resolved_at IS NULL
        AND f.flag IN (
          'all_content_quarantined',
          'missing_description',
          'missing_image',
          'missing_short_benefit'
        )
   )) AS needs_review
FROM products p;

COMMENT ON VIEW product_review_state IS
  'Derived review state. The flags are the fact; this is the single reading of them.';
