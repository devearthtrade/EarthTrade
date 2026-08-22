/**
 * Writes.
 *
 * Everything that creates or changes catalog data goes through here, including
 * the management API and, later, the Admin Dashboard. Two rules hold
 * throughout:
 *
 * **Nothing is invented.** A field the caller did not supply is not filled in
 * with a plausible value. No default price, no default weight, no generated
 * SKU, no placeholder description. Absent stays absent, and the storefront
 * already knows how to render a product that is missing things.
 *
 * **Compliance is not optional.** Copy and product names are screened on every
 * write, by the same module the CSV importer uses. A product whose name states
 * a banned claim can be created and edited, but cannot be published — the
 * decision is recorded on the row rather than enforced by whoever remembers to
 * check.
 */

import { transaction } from "../db/index.ts";
import { screen, screenCopy, screenTitle } from "../../lib/compliance.ts";

/** A write was refused. The message is meant to be shown to whoever tried. */
export class WriteError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, status = 422, detail?: unknown) {
    super(message);
    this.name = "WriteError";
    this.status = status;
    this.detail = detail;
  }
}

type Query = <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>;

/* ------------------------------- helpers -------------------------------- */

async function productId(q: Query, handle: string): Promise<string> {
  const r = await q<{ id: string }>(`SELECT id FROM products WHERE handle = $1`, [handle]);
  const id = r[0]?.id;
  if (!id) throw new WriteError(`No product with handle ${JSON.stringify(handle)}`, 404);
  return id;
}

async function brandId(q: Query, slug: string): Promise<string> {
  const r = await q<{ id: string }>(`SELECT id FROM brands WHERE slug = $1`, [slug]);
  const id = r[0]?.id;
  if (!id) throw new WriteError(`No brand with slug ${JSON.stringify(slug)}`, 422);
  return id;
}

async function categoryId(q: Query, slug: string | null): Promise<string | null> {
  if (slug === null) return null;
  const r = await q<{ id: string }>(`SELECT id FROM categories WHERE slug = $1`, [slug]);
  const id = r[0]?.id;
  if (!id) throw new WriteError(`No category with slug ${JSON.stringify(slug)}`, 422);
  return id;
}

/**
 * A stable public variant reference.
 *
 * Derived from the product handle and the variant's position, so the same
 * variant keeps its reference across a reseed or a restore. Random ids would
 * not survive either, and carts hold these.
 */
function variantRef(handle: string, seed: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${handle}:${seed}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Two rounds so the reference is 16 hex digits, matching the imported ones.
  let g = 0x811c9dc5 ^ h;
  for (const ch of `${seed}:${handle}`) {
    g ^= ch.charCodeAt(0);
    g = Math.imul(g, 0x01000193) >>> 0;
  }
  return `etv_${h.toString(16).padStart(8, "0")}${g.toString(16).padStart(8, "0")}`;
}

/* ------------------------------ compliance ------------------------------ */

/**
 * Screens a product's name and copy, and writes the result.
 *
 * Copy that fails is stored in `product_quarantined_copy` rather than in the
 * description: kept, auditable and reversible, but not rendered. A name that
 * fails withholds the product from publication, because a product name is not
 * something a page can quietly omit.
 */
async function applyCompliance(
  q: Query,
  id: string,
  input: { title: string; description: string[]; brandSlug: string },
): Promise<{ published: string[]; publishable: boolean; withheldReason: string | null }> {
  const copy = screenCopy(input.description, input.brandSlug);
  const titleMatches = screenTitle(input.title, input.brandSlug);

  await q(`DELETE FROM product_quarantined_copy WHERE product_id = $1`, [id]);
  for (const [i, block] of copy.quarantined.entries()) {
    await q(
      `INSERT INTO product_quarantined_copy (product_id, position, body, matches)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [id, i, block.text, JSON.stringify(block.matches)],
    );
  }

  await q(`DELETE FROM product_title_matches WHERE product_id = $1`, [id]);
  for (const m of titleMatches) {
    await q(
      `INSERT INTO product_title_matches (product_id, term, reason) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [id, m.term, m.reason],
    );
  }

  const publishable = titleMatches.length === 0;
  return {
    published: copy.clean,
    publishable,
    withheldReason: publishable
      ? null
      : `Product name states a banned claim: ${[...new Set(titleMatches.map((m) => m.term))].join(", ")}`,
  };
}

/** Re-derives the review flags a product carries, after any change. */
async function reflag(q: Query, id: string): Promise<void> {
  const [row] = await q<{
    handle: string;
    seo_title: string | null;
    seo_description: string | null;
    short_benefit: string | null;
    product_type: string | null;
    category_id: string | null;
    description_len: number;
    quarantined: number;
    image_count: number;
    variant_count: number;
    missing_sku: number;
    missing_weight: number;
    zero_price: number;
    title_matches: number;
  }>(
    `SELECT p.handle, p.seo_title, p.seo_description, p.short_benefit, p.product_type, p.category_id,
            cardinality(coalesce(pc.description, '{}'))::int                     AS description_len,
            (SELECT count(*) FROM product_quarantined_copy x
              WHERE x.product_id = p.id AND x.resolved_at IS NULL)::int          AS quarantined,
            (SELECT count(*) FROM product_media m WHERE m.product_id = p.id)::int AS image_count,
            (SELECT count(*) FROM product_variants v WHERE v.product_id = p.id)::int AS variant_count,
            (SELECT count(*) FROM product_variants v
              WHERE v.product_id = p.id AND v.sku IS NULL)::int                  AS missing_sku,
            (SELECT count(*) FROM product_variants v
              WHERE v.product_id = p.id AND v.weight_grams IS NULL)::int         AS missing_weight,
            (SELECT count(*) FROM product_variants v
              WHERE v.product_id = p.id AND v.price_cents = 0)::int              AS zero_price,
            (SELECT count(*) FROM product_title_matches t WHERE t.product_id = p.id)::int AS title_matches
       FROM products p
       LEFT JOIN product_content pc ON pc.product_id = p.id
      WHERE p.id = $1`,
    [id],
  );
  if (!row) return;

  const flags: string[] = [];
  // Inventory is unknown until someone counts it, for every product.
  if (!(await q(`SELECT 1 FROM inventory_levels l
                   JOIN product_variants v ON v.id = l.variant_id
                  WHERE v.product_id = $1 LIMIT 1`, [id])).length) {
    flags.push("inventory_unknown");
  }
  if (!row.description_len) flags.push("missing_description");
  if (row.quarantined && !row.description_len) flags.push("all_content_quarantined");
  else if (row.quarantined) flags.push("content_quarantined");
  if (!row.image_count) flags.push("missing_image");
  if (!row.seo_title) flags.push("missing_seo_title");
  if (!row.seo_description) flags.push("missing_seo_description");
  if (!row.short_benefit) flags.push("missing_short_benefit");
  if (row.missing_sku) flags.push("missing_sku");
  if (row.missing_weight) flags.push("missing_weight");
  if (!row.product_type) flags.push("missing_type");
  if (!row.category_id) flags.push("missing_source_category");
  if (row.zero_price) flags.push("zero_price");
  if (row.title_matches) flags.push("title_not_publishable");

  await q(`DELETE FROM product_flags WHERE product_id = $1`, [id]);
  for (const flag of flags.sort()) {
    await q(`INSERT INTO product_flags (product_id, flag) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, flag]);
  }
}

/* -------------------------------- products ------------------------------ */

export interface ProductInput {
  handle: string;
  title: string;
  brandSlug: string;
  categorySlug?: string | null;
  cardTitle?: string | null;
  shortBenefit?: string | null;
  productType?: string | null;
  description?: string[];
  seoTitle?: string | null;
  seoDescription?: string | null;
  subscription?: boolean;
  tags?: string[];
}

const HANDLE_RE = /^[a-z0-9]+(?:[-®™][a-z0-9]*)*$/;

export interface WriteResult {
  handle: string;
  publishable: boolean;
  withheldReason: string | null;
  quarantinedBlocks: number;
  titleMatches: { term: string; reason: string }[];
  flags: string[];
}

export async function createProduct(input: ProductInput): Promise<WriteResult> {
  if (!input.handle?.trim()) throw new WriteError("handle is required");
  if (!input.title?.trim()) throw new WriteError("title is required");
  if (!input.brandSlug?.trim()) throw new WriteError("brandSlug is required");
  if (!HANDLE_RE.test(input.handle)) {
    throw new WriteError(
      `handle ${JSON.stringify(input.handle)} must be lowercase letters, digits and hyphens`,
    );
  }

  return transaction(async (q) => {
    const clash = await q(`SELECT 1 FROM products WHERE handle = $1`, [input.handle]);
    if (clash.length) throw new WriteError(`A product with handle ${JSON.stringify(input.handle)} already exists`, 409);

    const brand = await brandId(q, input.brandSlug);
    const category = await categoryId(q, input.categorySlug ?? null);

    // A new product starts as a draft and unpublished. Publishing is a separate
    // decision, made once someone has looked at it.
    const [row] = await q<{ id: string }>(
      `INSERT INTO products (handle, title, card_title, short_benefit, brand_id, category_id,
                             product_type, status, publishable, withheld_reason,
                             price_provisional, subscription_eligible, seo_title, seo_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', false, $8, true, $9, $10, $11)
       RETURNING id`,
      [
        input.handle,
        input.title,
        input.cardTitle ?? null,
        input.shortBenefit ?? null,
        brand,
        category,
        input.productType ?? null,
        "Not published yet",
        input.subscription ?? false,
        input.seoTitle ?? null,
        input.seoDescription ?? null,
      ],
    );
    const id = row!.id;

    const compliance = await applyCompliance(q, id, {
      title: input.title,
      description: input.description ?? [],
      brandSlug: input.brandSlug,
    });

    await q(
      `INSERT INTO product_content (product_id, description) VALUES ($1, $2::text[])`,
      [id, pgArray(compliance.published)],
    );

    // A new product is unpublished either way, but *why* differs and matters.
    // "Not published yet" is a workflow state someone can resolve by looking at
    // it; a banned claim in the name is a fact about the product that has to be
    // fixed first. Recording the wrong one sends whoever reads it down the
    // wrong path.
    if (!compliance.publishable) {
      await q(`UPDATE products SET withheld_reason = $2 WHERE id = $1`, [id, compliance.withheldReason]);
    }

    for (const [i, tag] of (input.tags ?? []).entries()) {
      await q(
        `INSERT INTO product_tags (product_id, tag, position) VALUES ($1, $2, $3)
         ON CONFLICT (product_id, tag) DO UPDATE SET position = EXCLUDED.position`,
        [id, tag, i],
      );
    }

    // Provenance: this product was created through the API, not imported. The
    // record says where every product came from, and a hand-created one is as
    // worth recording as a spreadsheet row.
    await q(
      `INSERT INTO product_sources (product_id, origin, source_handle)
       VALUES ($1, 'api', $2)`,
      [id, input.handle],
    );

    await reflag(q, id);
    return summarise(q, id);
  });
}

export async function updateProduct(
  handle: string,
  patch: Partial<ProductInput>,
): Promise<WriteResult> {
  return transaction(async (q) => {
    const id = await productId(q, handle);

    const sets: string[] = [];
    const params: unknown[] = [];
    const bind = (v: unknown): string => `$${params.push(v)}`;

    // Only fields the caller actually sent are touched. An absent key means
    // "leave it alone"; an explicit null means "clear it".
    if ("title" in patch) {
      if (!patch.title?.trim()) throw new WriteError("title cannot be empty");
      sets.push(`title = ${bind(patch.title)}`);
    }
    if ("cardTitle" in patch) sets.push(`card_title = ${bind(patch.cardTitle ?? null)}`);
    if ("shortBenefit" in patch) sets.push(`short_benefit = ${bind(patch.shortBenefit ?? null)}`);
    if ("productType" in patch) sets.push(`product_type = ${bind(patch.productType ?? null)}`);
    if ("seoTitle" in patch) sets.push(`seo_title = ${bind(patch.seoTitle ?? null)}`);
    if ("seoDescription" in patch) sets.push(`seo_description = ${bind(patch.seoDescription ?? null)}`);
    if ("subscription" in patch) sets.push(`subscription_eligible = ${bind(patch.subscription ?? false)}`);
    if ("brandSlug" in patch && patch.brandSlug) {
      sets.push(`brand_id = ${bind(await brandId(q, patch.brandSlug))}`);
    }
    if ("categorySlug" in patch) {
      sets.push(`category_id = ${bind(await categoryId(q, patch.categorySlug ?? null))}`);
    }

    if (sets.length) {
      await q(`UPDATE products SET ${sets.join(", ")} WHERE id = ${bind(id)}`, params);
    }

    // Re-screen whenever the name or the copy changed. Editing a title into a
    // banned claim has to withhold the product, not merely be recorded.
    if ("title" in patch || "description" in patch) {
      const [current] = await q<{ title: string; brand: string; description: (string | null)[] | null }>(
        `SELECT p.title, b.slug AS brand, pc.description
           FROM products p
           JOIN brands b ON b.id = p.brand_id
           LEFT JOIN product_content pc ON pc.product_id = p.id
          WHERE p.id = $1`,
        [id],
      );

      const description =
        "description" in patch
          ? (patch.description ?? [])
          : (current?.description ?? []).filter((s): s is string => s !== null);

      const compliance = await applyCompliance(q, id, {
        title: current!.title,
        description,
        brandSlug: current!.brand,
      });

      await q(
        `INSERT INTO product_content (product_id, description) VALUES ($1, $2::text[])
         ON CONFLICT (product_id) DO UPDATE SET description = EXCLUDED.description`,
        [id, pgArray(compliance.published)],
      );

      // A product already published whose name has become unpublishable is
      // withdrawn immediately. The alternative is a live page stating a claim
      // that was just banned.
      if (!compliance.publishable) {
        await q(
          `UPDATE products SET publishable = false, withheld_reason = $2 WHERE id = $1`,
          [id, compliance.withheldReason],
        );
      }
    }

    if ("tags" in patch) {
      await q(`DELETE FROM product_tags WHERE product_id = $1`, [id]);
      for (const [i, tag] of (patch.tags ?? []).entries()) {
        await q(
          `INSERT INTO product_tags (product_id, tag, position) VALUES ($1, $2, $3)
           ON CONFLICT (product_id, tag) DO UPDATE SET position = EXCLUDED.position`,
          [id, tag, i],
        );
      }
    }

    await reflag(q, id);
    return summarise(q, id);
  });
}

/* --------------------------- publication state --------------------------- */

/**
 * Publishes a product, or refuses and says why.
 *
 * Three things block publication, and none of them can be overridden here: a
 * name that states a banned claim, no variant to sell, and no price to sell at.
 * Each is a fact about the product, so the fix is to change the product.
 */
export async function publishProduct(handle: string): Promise<WriteResult> {
  return transaction(async (q) => {
    const id = await productId(q, handle);

    const [state] = await q<{
      archived: boolean;
      title_matches: number;
      variants: number;
      priced: number;
    }>(
      `SELECT (p.archived_at IS NOT NULL) AS archived,
              (SELECT count(*) FROM product_title_matches t WHERE t.product_id = p.id)::int AS title_matches,
              (SELECT count(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active)::int AS variants,
              (SELECT count(*) FROM product_variants v
                WHERE v.product_id = p.id AND v.is_active AND v.price_cents > 0)::int AS priced
         FROM products p WHERE p.id = $1`,
      [id],
    );

    const blockers: string[] = [];
    if (state!.archived) blockers.push("the product is archived");
    if (state!.title_matches) blockers.push("its name states a claim that cannot be published");
    if (!state!.variants) blockers.push("it has no variant to sell");
    else if (!state!.priced) blockers.push("it has no price to sell at");

    if (blockers.length) {
      throw new WriteError(`Cannot publish ${handle}: ${blockers.join("; ")}.`, 409, { blockers });
    }

    await q(
      `UPDATE products SET publishable = true, withheld_reason = NULL, status = 'active',
                           price_provisional = false,
                           published_at = coalesce(published_at, now())
        WHERE id = $1`,
      [id],
    );
    await reflag(q, id);
    return summarise(q, id);
  });
}

export async function unpublishProduct(handle: string, reason: string): Promise<WriteResult> {
  if (!reason?.trim()) {
    // The schema requires a reason on any withheld product, and rightly: a
    // product that vanished from the storefront with no explanation is a
    // support ticket nobody can answer.
    throw new WriteError("A reason is required to unpublish a product");
  }
  return transaction(async (q) => {
    const id = await productId(q, handle);
    await q(`UPDATE products SET publishable = false, withheld_reason = $2 WHERE id = $1`, [id, reason]);
    await reflag(q, id);
    return summarise(q, id);
  });
}

/**
 * Archives a product: out of the storefront, still in the database.
 *
 * Nothing is deleted. Orders, reports and links referencing it stay meaningful,
 * and un-archiving is an edit rather than a restore from backup.
 */
export async function archiveProduct(handle: string): Promise<WriteResult> {
  return transaction(async (q) => {
    const id = await productId(q, handle);
    await q(
      `UPDATE products SET status = 'archived', publishable = false,
                           withheld_reason = coalesce(withheld_reason, 'Archived'),
                           archived_at = coalesce(archived_at, now())
        WHERE id = $1`,
      [id],
    );
    await reflag(q, id);
    return summarise(q, id);
  });
}

/** Returns a product to draft. It does not republish: that is a separate call. */
export async function unarchiveProduct(handle: string): Promise<WriteResult> {
  return transaction(async (q) => {
    const id = await productId(q, handle);
    await q(
      `UPDATE products SET status = 'draft', archived_at = NULL,
                           withheld_reason = coalesce(withheld_reason, 'Not published yet')
        WHERE id = $1`,
      [id],
    );
    await reflag(q, id);
    return summarise(q, id);
  });
}

/* -------------------------------- variants ------------------------------ */

export interface VariantInput {
  title: string;
  priceCents: number;
  sku?: string | null;
  compareAtCents?: number | null;
  weightGrams?: number | null;
  barcode?: string | null;
  currency?: string;
  requiresShipping?: boolean;
  taxable?: boolean;
}

function checkMoney(name: string, cents: unknown): number {
  if (typeof cents !== "number" || !Number.isInteger(cents)) {
    throw new WriteError(`${name} must be an integer number of cents, got ${JSON.stringify(cents)}`);
  }
  if (cents < 0) throw new WriteError(`${name} cannot be negative`);
  return cents;
}

export async function addVariant(handle: string, input: VariantInput): Promise<{ ref: string }> {
  if (!input.title?.trim()) throw new WriteError("variant title is required");
  const price = checkMoney("priceCents", input.priceCents);
  const compareAt =
    input.compareAtCents === null || input.compareAtCents === undefined
      ? null
      : checkMoney("compareAtCents", input.compareAtCents);
  if (compareAt !== null && compareAt < price) {
    throw new WriteError("compareAtCents cannot be below priceCents");
  }
  if (input.weightGrams !== null && input.weightGrams !== undefined) {
    if (!Number.isInteger(input.weightGrams) || input.weightGrams <= 0) {
      throw new WriteError("weightGrams must be a positive integer");
    }
  }

  return transaction(async (q) => {
    const id = await productId(q, handle);
    const [{ n }] = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM product_variants WHERE product_id = $1`,
      [id],
    );
    const ref = variantRef(handle, input.sku?.trim() || `${input.title}#${n}`);

    const clash = await q(`SELECT 1 FROM product_variants WHERE ref = $1`, [ref]);
    if (clash.length) throw new WriteError(`A variant with reference ${ref} already exists`, 409);

    await q(
      `INSERT INTO product_variants
         (product_id, ref, sku, title, position, price_cents, compare_at_cents,
          currency, weight_grams, barcode, requires_shipping, taxable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id, ref, input.sku ?? null, input.title, n, price, compareAt,
        input.currency ?? "USD", input.weightGrams ?? null, input.barcode ?? null,
        input.requiresShipping ?? true, input.taxable ?? true,
      ],
    );
    await reflag(q, id);
    return { ref };
  });
}

export async function updateVariant(ref: string, patch: Partial<VariantInput>): Promise<{ ref: string }> {
  return transaction(async (q) => {
    const [existing] = await q<{ id: string; product_id: string; price_cents: number; compare_at_cents: number | null }>(
      `SELECT id, product_id, price_cents, compare_at_cents FROM product_variants WHERE ref = $1`,
      [ref],
    );
    if (!existing) throw new WriteError(`No variant with reference ${JSON.stringify(ref)}`, 404);

    const sets: string[] = [];
    const params: unknown[] = [];
    const bind = (v: unknown): string => `$${params.push(v)}`;

    if ("title" in patch) {
      if (!patch.title?.trim()) throw new WriteError("variant title cannot be empty");
      sets.push(`title = ${bind(patch.title)}`);
    }
    if ("sku" in patch) sets.push(`sku = ${bind(patch.sku ?? null)}`);
    if ("barcode" in patch) sets.push(`barcode = ${bind(patch.barcode ?? null)}`);
    if ("requiresShipping" in patch) sets.push(`requires_shipping = ${bind(patch.requiresShipping ?? true)}`);
    if ("taxable" in patch) sets.push(`taxable = ${bind(patch.taxable ?? true)}`);

    if ("weightGrams" in patch) {
      const w = patch.weightGrams;
      if (w !== null && w !== undefined && (!Number.isInteger(w) || w <= 0)) {
        throw new WriteError("weightGrams must be a positive integer");
      }
      sets.push(`weight_grams = ${bind(w ?? null)}`);
    }

    const price = "priceCents" in patch ? checkMoney("priceCents", patch.priceCents) : existing.price_cents;
    if ("priceCents" in patch) sets.push(`price_cents = ${bind(price)}`);

    if ("compareAtCents" in patch) {
      const c =
        patch.compareAtCents === null || patch.compareAtCents === undefined
          ? null
          : checkMoney("compareAtCents", patch.compareAtCents);
      if (c !== null && c < price) throw new WriteError("compareAtCents cannot be below priceCents");
      sets.push(`compare_at_cents = ${bind(c)}`);
    } else if ("priceCents" in patch && existing.compare_at_cents !== null && existing.compare_at_cents < price) {
      throw new WriteError(
        `priceCents ${price} would exceed this variant's compare-at price of ${existing.compare_at_cents}. ` +
          `Send compareAtCents in the same request to change both.`,
      );
    }

    if (sets.length) {
      await q(`UPDATE product_variants SET ${sets.join(", ")} WHERE id = ${bind(existing.id)}`, params);
    }
    await reflag(q, existing.product_id);
    return { ref };
  });
}

/**
 * Deactivates a variant. The row stays: a variant referenced by a past order,
 * or by a cart somebody has not emptied, must remain resolvable.
 */
export async function deactivateVariant(ref: string): Promise<{ ref: string }> {
  return transaction(async (q) => {
    const [v] = await q<{ id: string; product_id: string }>(
      `SELECT id, product_id FROM product_variants WHERE ref = $1`,
      [ref],
    );
    if (!v) throw new WriteError(`No variant with reference ${JSON.stringify(ref)}`, 404);

    const [{ n }] = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM product_variants
        WHERE product_id = $1 AND is_active AND id <> $2`,
      [v.product_id, v.id],
    );
    const [{ published }] = await q<{ published: boolean }>(
      `SELECT publishable AS published FROM products WHERE id = $1`,
      [v.product_id],
    );
    if (published && n === 0) {
      throw new WriteError(
        "Cannot deactivate the last variant of a published product. Unpublish the product first.",
        409,
      );
    }

    await q(`UPDATE product_variants SET is_active = false WHERE id = $1`, [v.id]);
    await reflag(q, v.product_id);
    return { ref };
  });
}

/* --------------------------------- media -------------------------------- */

export interface MediaInput {
  /** Site-relative path, e.g. /images/thing.jpg. Never an absolute URL. */
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

/**
 * Attaches an image to a product.
 *
 * The path must be relative and served by EarthTrade. An absolute URL is
 * refused: media on someone else's host is a dependency on that host staying
 * up, staying free, and continuing to want to serve us.
 */
export async function addMedia(handle: string, input: MediaInput): Promise<{ src: string }> {
  if (!input.src?.trim()) throw new WriteError("src is required");
  if (!input.alt?.trim()) {
    // Alt text is not decoration. A product image with none is unusable to
    // anyone reading the page with a screen reader.
    throw new WriteError("alt text is required for every product image");
  }
  if (/^[a-z]+:\/\//i.test(input.src)) {
    throw new WriteError(
      `src must be a path served by EarthTrade, not an absolute URL (${input.src}). ` +
        `Store the file under /images and reference it by path.`,
    );
  }

  const key = input.src.replace(/^\/+/, "");
  return transaction(async (q) => {
    const id = await productId(q, handle);

    await q(
      `INSERT INTO media_assets (storage_key, kind, width, height)
       VALUES ($1, 'image', $2, $3)
       ON CONFLICT (storage_key) DO UPDATE SET
         width = coalesce(EXCLUDED.width, media_assets.width),
         height = coalesce(EXCLUDED.height, media_assets.height)`,
      [key, input.width ?? null, input.height ?? null],
    );

    const [{ n }] = await q<{ n: number }>(
      `SELECT count(*)::int AS n FROM product_media WHERE product_id = $1`,
      [id],
    );

    await q(
      `INSERT INTO product_media (product_id, asset_id, alt, position)
       VALUES ($1, (SELECT id FROM media_assets WHERE storage_key = $2), $3, $4)
       ON CONFLICT (product_id, asset_id) DO UPDATE SET alt = EXCLUDED.alt`,
      [id, key, input.alt, n],
    );
    await reflag(q, id);
    return { src: `/${key}` };
  });
}

export async function removeMedia(handle: string, src: string): Promise<{ removed: boolean }> {
  const key = src.replace(/^\/+/, "");
  return transaction(async (q) => {
    const id = await productId(q, handle);
    const removed = await q(
      `DELETE FROM product_media
        WHERE product_id = $1
          AND asset_id = (SELECT id FROM media_assets WHERE storage_key = $2)
        RETURNING id`,
      [id, key],
    );
    if (!removed.length) throw new WriteError(`${handle} has no image at ${src}`, 404);

    // Close the gap left in the ordering so positions stay 0..n-1.
    await q(
      `UPDATE product_media m SET position = ranked.rn - 1
         FROM (SELECT id, row_number() OVER (ORDER BY position) AS rn
                 FROM product_media WHERE product_id = $1) ranked
        WHERE m.id = ranked.id`,
      [id],
    );
    await reflag(q, id);
    return { removed: true };
  });
}

export async function reorderMedia(handle: string, order: string[]): Promise<{ order: string[] }> {
  return transaction(async (q) => {
    const id = await productId(q, handle);
    const current = await q<{ storage_key: string }>(
      `SELECT a.storage_key FROM product_media m JOIN media_assets a ON a.id = m.asset_id
        WHERE m.product_id = $1`,
      [id],
    );
    const keys = new Set(current.map((c) => c.storage_key));
    const wanted = order.map((s) => s.replace(/^\/+/, ""));

    if (wanted.length !== keys.size || wanted.some((k) => !keys.has(k))) {
      throw new WriteError(
        `The order must list exactly the images this product has (${[...keys].map((k) => `/${k}`).join(", ")})`,
      );
    }

    for (const [i, key] of wanted.entries()) {
      await q(
        `UPDATE product_media SET position = $3
          WHERE product_id = $1 AND asset_id = (SELECT id FROM media_assets WHERE storage_key = $2)`,
        [id, key, i],
      );
    }
    return { order: wanted.map((k) => `/${k}`) };
  });
}

/* ---------------------------- collection membership ---------------------- */

/**
 * Sets which collections a product is curated into.
 *
 * Only curation is replaced. Membership the product earned through its own tags
 * is left alone — removing a product from a curated list is not a statement
 * about what the product is.
 */
export async function setProductCollections(
  handle: string,
  handles: string[],
): Promise<{ curated: string[] }> {
  return transaction(async (q) => {
    const id = await productId(q, handle);

    for (const h of handles) {
      const found = await q(`SELECT 1 FROM collections WHERE handle = $1`, [h]);
      if (!found.length) throw new WriteError(`No collection with handle ${JSON.stringify(h)}`, 422);
    }

    await q(`DELETE FROM collection_products WHERE product_id = $1 AND is_curated AND NOT is_derived`, [id]);
    await q(`UPDATE collection_products SET is_curated = false WHERE product_id = $1 AND is_curated`, [id]);

    for (const [i, h] of handles.entries()) {
      await q(
        `INSERT INTO collection_products
           (collection_id, product_id, collection_position, product_position, is_curated)
         SELECT c.id, $2, $3, 0, true FROM collections c WHERE c.handle = $1
         ON CONFLICT (collection_id, product_id)
           DO UPDATE SET is_curated = true, collection_position = EXCLUDED.collection_position`,
        [h, id, i],
      );
    }
    return { curated: handles };
  });
}

/* -------------------------------- summary -------------------------------- */

async function summarise(q: Query, id: string): Promise<WriteResult> {
  const [row] = await q<{
    handle: string;
    publishable: boolean;
    withheld_reason: string | null;
  }>(`SELECT handle, publishable, withheld_reason FROM products WHERE id = $1`, [id]);

  const [quarantined] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM product_quarantined_copy WHERE product_id = $1 AND resolved_at IS NULL`,
    [id],
  );
  const matches = await q<{ term: string; reason: string }>(
    `SELECT term, reason FROM product_title_matches WHERE product_id = $1 ORDER BY term`,
    [id],
  );
  const flags = await q<{ flag: string }>(
    `SELECT flag FROM product_flags WHERE product_id = $1 AND resolved_at IS NULL ORDER BY flag`,
    [id],
  );

  return {
    handle: row!.handle,
    publishable: row!.publishable,
    withheldReason: row!.withheld_reason,
    quarantinedBlocks: quarantined!.n,
    titleMatches: matches,
    flags: flags.map((f) => f.flag),
  };
}

/** Encodes a string list as a Postgres array literal for one bound parameter. */
function pgArray(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",")}}`;
}

/** Screens text without writing anything, for previewing an edit. */
export function screenText(text: string, brandSlug: string) {
  return screen(text, brandSlug);
}
