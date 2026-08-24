/**
 * Admin routes.
 *
 * Every screen is a server-rendered page and every action is a form POST that
 * ends in a redirect. There is no client-side state and no client-side
 * authorisation, because there is nothing a browser could assert that this
 * server would believe.
 *
 * All writes go through `repositories/writes.ts` — the same layer the JSON API
 * uses. Nothing here issues SQL. That is what keeps compliance, validation and
 * audit impossible to route around: there is only one door.
 */

import { Asset, Html, Redirect, Router, type RequestContext } from "../api/http.ts";
import { WriteError } from "../repositories/writes.ts";
import * as writes from "../repositories/writes.ts";
import * as repo from "../repositories/index.ts";
import { ADMIN_CSS } from "./styles.ts";
import { flashFrom, page } from "./layout.ts";
import { html } from "../../lib/html.ts";
import { navCounts, overviewPage } from "./pages/overview.ts";
import { newProductPage, productEditorPage, productsPage } from "./pages/products.ts";
import {
  auditPage, brandEditorPage, brandsPage, collectionEditorPage, collectionsPage, inventoryPage,
} from "./pages/catalog.ts";
import { compliancePage, curationPage, screenResultPage } from "./pages/review.ts";

/* ------------------------------ input reading ---------------------------- */

/**
 * A form value as a trimmed string, or null when the field was submitted empty.
 *
 * "Submitted empty" and "not submitted" are different things, and only the
 * first means clear it. See `patch` below.
 */
function text(ctx: RequestContext, key: string): string | null {
  const v = ctx.body[key];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Builds a patch containing only the fields the request actually sent.
 *
 * The write layer reads a patch as "change what is here, leave alone what is
 * not". Passing every possible key on every request destroys that: a form that
 * submits only a name would clear the tagline, the story and the description,
 * because each arrives as an absent value that looks like an empty one.
 *
 * The Dashboard's own forms do submit every field they own, so this changes
 * nothing for them. It matters for everything else that will ever post here —
 * a script, a partial save, a future inline edit — where silently erasing a
 * field the caller never mentioned is the worst kind of bug: quiet, permanent,
 * and indistinguishable from an intentional change in the audit trail.
 */
function patch<T extends object>(
  ctx: RequestContext,
  fields: { [K in keyof T]?: () => T[K] },
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, read] of Object.entries(fields) as [string, () => unknown][]) {
    if (key in ctx.body) out[key] = read();
  }
  return out as Partial<T>;
}

function required(ctx: RequestContext, key: string): string {
  const v = text(ctx, key);
  if (v === null) throw new WriteError(`${key} is required`);
  return v;
}

/**
 * A whole number from a form field.
 *
 * Forms send strings, and an empty one means "not given" rather than zero.
 * Anything that is not a whole number is refused rather than rounded — a price
 * that quietly becomes a different price is worse than a rejected form.
 */
function integer(ctx: RequestContext, key: string): number | null {
  const v = text(ctx, key);
  if (v === null) return null;
  if (!/^-?\d+$/.test(v)) {
    throw new WriteError(`${key} must be a whole number, got ${JSON.stringify(v)}`);
  }
  return Number(v);
}

/** Paragraphs, edited one per blank line. */
function paragraphs(ctx: RequestContext, key: string): string[] {
  const v = ctx.body[key];
  if (typeof v !== "string") return [];
  return v
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+\n/g, "\n").trim())
    .filter(Boolean);
}

/** A list edited one item per line. */
function lines(ctx: RequestContext, key: string): string[] {
  const v = ctx.body[key];
  if (typeof v !== "string") return [];
  return v.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** A multi-select, which arrives as a string when one option is chosen. */
function multi(ctx: RequestContext, key: string): string[] {
  const v = ctx.body[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function commaList(ctx: RequestContext, key: string): string[] {
  const v = text(ctx, key);
  return v === null ? [] : v.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Where to go after a successful action, with a message the next page shows. */
function back(path: string, message: string, kind: "ok" | "warn" = "ok"): Redirect {
  const params = new URLSearchParams({ [kind]: message });
  return new Redirect(`${path}${path.includes("?") ? "&" : "?"}${params}`);
}

/*
 * Actions are not wrapped for attribution here. The server does that once, for
 * every request, so no route can be added without it — see `createApi`.
 */
const action = <T>(handler: (ctx: RequestContext) => Promise<T>) => handler;

/* --------------------------------- routes -------------------------------- */

export function addAdminRoutes(r: Router): Router {
  r.get("/admin/admin.css", async () => new Asset(ADMIN_CSS, "text/css; charset=utf-8"));

  /* ------------------------------- screens ------------------------------- */

  r.get("/admin", async (ctx) => new Html(await overviewPage(flashFrom(ctx.query), await navCounts())));

  r.get("/admin/products", async (ctx) =>
    new Html(await productsPage(ctx.query, flashFrom(ctx.query), await navCounts())));

  r.get("/admin/products/new", async (ctx) =>
    new Html(await newProductPage(flashFrom(ctx.query), await navCounts())));

  r.get("/admin/products/:handle", async (ctx) => {
    const rendered = await productEditorPage(ctx.params["handle"]!, flashFrom(ctx.query), await navCounts());
    if (!rendered) throw new WriteError(`No product with handle ${JSON.stringify(ctx.params["handle"])}`, 404);
    return new Html(rendered);
  });

  r.get("/admin/brands", async (ctx) => new Html(await brandsPage(flashFrom(ctx.query), await navCounts())));

  r.get("/admin/brands/:slug", async (ctx) => {
    const rendered = await brandEditorPage(ctx.params["slug"]!, flashFrom(ctx.query), await navCounts());
    if (!rendered) throw new WriteError(`No brand with slug ${JSON.stringify(ctx.params["slug"])}`, 404);
    return new Html(rendered);
  });

  r.get("/admin/collections", async (ctx) =>
    new Html(await collectionsPage(flashFrom(ctx.query), await navCounts())));

  r.get("/admin/collections/:handle", async (ctx) => {
    const rendered = await collectionEditorPage(ctx.params["handle"]!, flashFrom(ctx.query), await navCounts());
    if (!rendered) throw new WriteError(`No collection with handle ${JSON.stringify(ctx.params["handle"])}`, 404);
    return new Html(rendered);
  });

  r.get("/admin/inventory", async (ctx) =>
    new Html(await inventoryPage(ctx.query, flashFrom(ctx.query), await navCounts())));

  r.get("/admin/compliance", async (ctx) =>
    new Html(await compliancePage(ctx.query, flashFrom(ctx.query), await navCounts())));

  r.get("/admin/curation", async (ctx) =>
    new Html(await curationPage(ctx.query, flashFrom(ctx.query), await navCounts())));

  r.get("/admin/audit", async (ctx) =>
    new Html(await auditPage(ctx.query, flashFrom(ctx.query), await navCounts())));

  /* ------------------------------ product actions ------------------------ */

  r.post("/admin/products", action(async (ctx) => {
    const result = await writes.createProduct({
      handle: required(ctx, "handle"),
      title: required(ctx, "title"),
      brandSlug: required(ctx, "brandSlug"),
      categorySlug: text(ctx, "categorySlug"),
      productType: text(ctx, "productType"),
      shortBenefit: text(ctx, "shortBenefit"),
      description: paragraphs(ctx, "description"),
    });

    // Every new product is unpublished; that is not news. What is worth saying
    // is when the screen has already decided it can never be published as named.
    const blocked = result.titleMatches.length > 0;
    return back(
      `/admin/products/${result.handle}`,
      blocked
        ? `Created, but it cannot be published: ${result.withheldReason}`
        : "Created as a draft. Add a priced variant, then publish it.",
      blocked ? "warn" : "ok",
    );
  }));

  r.post("/admin/products/:handle", action(async (ctx) => {
    const handle = ctx.params["handle"]!;

    /*
     * Copy is one document to the screen, even though the editor shows it in
     * two boxes: what publishes, and what the screen held back. Both are
     * submitted together and screened as one, because which is which is the
     * screen's conclusion rather than the editor's input.
     *
     * Either box being absent means that half was not submitted, so it is read
     * from the database instead of treated as empty. Sending only a new
     * description must not discard copy the screen is holding — that is the
     * same silent deletion the patch helper exists to prevent, and held-back
     * text is the one thing here that cannot be retyped from the page.
     *
     * Held-back blocks go last. Where they originally sat among the published
     * ones was not recorded at import, so a block that is fixed and released
     * joins the end rather than a position nobody knows.
     */
    const sentPublished = "description" in ctx.body;
    const sentHeld = "heldBack" in ctx.body;

    let copy: string[] | undefined;
    if (sentPublished || sentHeld) {
      const current = await repo.catalog.loadProduct(handle);
      if (!current) throw new WriteError(`No product with handle ${JSON.stringify(handle)}`, 404);

      copy = [
        ...(sentPublished ? paragraphs(ctx, "description") : current.description),
        ...(sentHeld ? paragraphs(ctx, "heldBack") : current.quarantinedContent.map((b) => b.text)),
      ];
    }

    const result = await writes.updateProduct(handle, {
      ...patch<writes.ProductInput>(ctx, {
        title: () => required(ctx, "title"),
        cardTitle: () => text(ctx, "cardTitle"),
        brandSlug: () => required(ctx, "brandSlug"),
        categorySlug: () => text(ctx, "categorySlug"),
        productType: () => text(ctx, "productType"),
        shortBenefit: () => text(ctx, "shortBenefit"),
        seoTitle: () => text(ctx, "seoTitle"),
        seoDescription: () => text(ctx, "seoDescription"),
        tags: () => commaList(ctx, "tags"),
      }),
      ...(copy ? { description: copy } : {}),
    });

    const held = result.quarantinedBlocks;
    return back(
      `/admin/products/${handle}`,
      held
        ? `Saved. ${held} block(s) of copy did not pass the screen and are held back.`
        : "Saved.",
      held ? "warn" : "ok",
    );
  }));

  r.post("/admin/products/:handle/publish", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.publishProduct(handle);
    return back(`/admin/products/${handle}`, "Published. It appears on the next storefront build.");
  }));

  r.post("/admin/products/:handle/unpublish", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    // No default. "Unpublished from the Dashboard" says nothing a person could
    // act on, and a product that vanished from the storefront with no
    // explanation is a support ticket nobody can answer.
    const reason = text(ctx, "reason");
    if (!reason) {
      throw new WriteError("Say why this product is coming down. The reason is shown wherever it is listed as withheld.");
    }
    await writes.unpublishProduct(handle, reason);
    return back(`/admin/products/${handle}`, "Unpublished.", "warn");
  }));

  r.post("/admin/products/:handle/archive", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.archiveProduct(handle);
    return back(`/admin/products/${handle}`, "Archived. Nothing was deleted.", "warn");
  }));

  r.post("/admin/products/:handle/unarchive", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.unarchiveProduct(handle);
    return back(`/admin/products/${handle}`, "Returned to draft. Publish it separately when ready.");
  }));

  r.post("/admin/products/:handle/delete", action(async (ctx) => {
    await writes.deleteProduct(ctx.params["handle"]!);
    return back("/admin/products", `Deleted ${ctx.params["handle"]}.`, "warn");
  }));

  r.post("/admin/products/:handle/collections", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.setProductCollections(handle, multi(ctx, "collections"));
    return back(`/admin/products/${handle}`, "Collections saved.");
  }));

  /* ------------------------------ variant actions ------------------------ */

  r.post("/admin/products/:handle/variants", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    const price = integer(ctx, "priceCents");
    if (price === null) throw new WriteError("A price in cents is required");

    await writes.addVariant(handle, {
      title: required(ctx, "title"),
      priceCents: price,
      sku: text(ctx, "sku"),
      weightGrams: integer(ctx, "weightGrams"),
    });
    return back(`/admin/products/${handle}`, "Variant added.");
  }));

  r.post("/admin/variants/:ref", action(async (ctx) => {
    const ref = ctx.params["ref"]!;
    const variant = await repo.variants.getVariantByRef(ref);
    if (!variant) throw new WriteError(`No variant with reference ${JSON.stringify(ref)}`, 404);

    await writes.updateVariant(ref, patch<writes.VariantInput>(ctx, {
      title: () => required(ctx, "title"),
      sku: () => text(ctx, "sku"),
      priceCents: () => {
        const price = integer(ctx, "priceCents");
        if (price === null) throw new WriteError("A price in cents is required");
        return price;
      },
      compareAtCents: () => integer(ctx, "compareAtCents"),
      weightGrams: () => integer(ctx, "weightGrams"),
    }));
    return back(`/admin/products/${variant.productHandle}`, "Variant saved.");
  }));

  r.post("/admin/variants/:ref/deactivate", action(async (ctx) => {
    const ref = ctx.params["ref"]!;
    const variant = await repo.variants.getVariantByRef(ref);
    if (!variant) throw new WriteError(`No variant with reference ${JSON.stringify(ref)}`, 404);

    await writes.deactivateVariant(ref);
    return back(
      `/admin/products/${variant.productHandle}`,
      "Variant deactivated. The row stays, so carts holding it still resolve.",
      "warn",
    );
  }));

  r.post("/admin/variants/:ref/stock", action(async (ctx) => {
    const ref = ctx.params["ref"]!;
    const variant = await repo.variants.getVariantByRef(ref);
    if (!variant) throw new WriteError(`No variant with reference ${JSON.stringify(ref)}`, 404);

    const clearing = ctx.body["intent"] === "clear";
    const onHand = clearing ? null : integer(ctx, "onHand");

    // An empty field with "Set" pressed is a mistake worth catching: it would
    // otherwise silently uncount a variant somebody meant to give a number.
    if (!clearing && onHand === null) {
      throw new WriteError(
        "Enter a number of units, or press Uncount to record that this variant has not been counted.",
      );
    }

    const result = await writes.setStock(ref, { onHand });
    const destination = text(ctx, "return") ?? `/admin/products/${variant.productHandle}`;

    return back(
      destination,
      result.state === "unknown"
        ? `${ref} is back to not counted. That is not the same as zero.`
        : `${ref} set to ${result.onHand}.`,
      result.state === "unknown" ? "warn" : "ok",
    );
  }));

  /* ------------------------------- media actions ------------------------- */

  r.post("/admin/products/:handle/media", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.addMedia(handle, { src: required(ctx, "src"), alt: required(ctx, "alt") });
    return back(`/admin/products/${handle}`, "Image attached.");
  }));

  r.post("/admin/products/:handle/media/alt", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    // addMedia updates the alt text of an image already attached, so this is
    // the same call rather than a second path that could drift from it.
    await writes.addMedia(handle, { src: required(ctx, "src"), alt: required(ctx, "alt") });
    return back(`/admin/products/${handle}`, "Alt text saved.");
  }));

  r.post("/admin/products/:handle/media/remove", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.removeMedia(handle, required(ctx, "src"));
    return back(`/admin/products/${handle}`, "Image removed from the product.", "warn");
  }));

  r.post("/admin/products/:handle/media/primary", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    const src = required(ctx, "src");
    const product = await repo.catalog.loadProduct(handle);
    if (!product) throw new WriteError(`No product with handle ${JSON.stringify(handle)}`, 404);

    // Primary is simply first. Moving it to the front is the whole operation.
    const order = [src, ...product.images.map((i) => i.src).filter((s) => s !== src)];
    await writes.reorderMedia(handle, order);
    return back(`/admin/products/${handle}`, "Primary image changed.");
  }));

  r.post("/admin/products/:handle/media/move", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    const src = required(ctx, "src");
    const direction = required(ctx, "direction");

    const product = await repo.catalog.loadProduct(handle);
    if (!product) throw new WriteError(`No product with handle ${JSON.stringify(handle)}`, 404);

    const order = product.images.map((i) => i.src);
    const from = order.indexOf(src);
    if (from < 0) throw new WriteError(`${handle} has no image at ${src}`, 404);

    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= order.length) return back(`/admin/products/${handle}`, "Already at the end.", "warn");

    order.splice(to, 0, ...order.splice(from, 1));
    await writes.reorderMedia(handle, order);
    return back(`/admin/products/${handle}`, "Order changed.");
  }));

  /* ------------------------------- brand actions ------------------------- */

  r.post("/admin/brands", action(async (ctx) => {
    const result = await writes.createBrand({
      slug: required(ctx, "slug"),
      name: required(ctx, "name"),
      tagline: text(ctx, "tagline"),
      collectionHandle: text(ctx, "collectionHandle"),
    });
    return back(`/admin/brands/${result.slug}`, "Brand created.");
  }));

  r.post("/admin/brands/:slug", action(async (ctx) => {
    const slug = ctx.params["slug"]!;
    await writes.updateBrand(slug, patch<writes.BrandInput>(ctx, {
      name: () => required(ctx, "name"),
      tagline: () => text(ctx, "tagline"),
      summary: () => text(ctx, "summary"),
      story: () => paragraphs(ctx, "story"),
      theme: () => text(ctx, "theme"),
      collectionHandle: () => text(ctx, "collectionHandle"),
      seoTitle: () => text(ctx, "seoTitle"),
      seoDescription: () => text(ctx, "seoDescription"),
    }));
    return back(`/admin/brands/${slug}`, "Brand saved.");
  }));

  r.post("/admin/brands/:slug/image", action(async (ctx) => {
    const slug = ctx.params["slug"]!;
    const kind = required(ctx, "kind") === "logo" ? "logo" : "hero";

    if (ctx.body["intent"] === "clear") {
      await writes.setBrandImage(slug, kind, null);
      return back(`/admin/brands/${slug}`, `${kind} removed.`, "warn");
    }

    await writes.setBrandImage(slug, kind, {
      src: required(ctx, "src"),
      alt: required(ctx, `${kind}Alt`),
    });
    return back(`/admin/brands/${slug}`, `${kind} saved.`);
  }));

  /* ---------------------------- collection actions ----------------------- */

  r.post("/admin/collections", action(async (ctx) => {
    const description = text(ctx, "description");
    const result = await writes.createCollection({
      handle: required(ctx, "handle"),
      title: required(ctx, "title"),
      description,
      role: text(ctx, "role") ?? "editorial",
    });
    return back(
      `/admin/collections/${result.handle}`,
      description
        ? "Collection created."
        : "Collection created, and hidden until it has a description.",
      description ? "ok" : "warn",
    );
  }));

  r.post("/admin/collections/:handle", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.updateCollection(handle, patch<writes.CollectionInput>(ctx, {
      title: () => required(ctx, "title"),
      heroTitle: () => text(ctx, "heroTitle"),
      eyebrow: () => text(ctx, "eyebrow"),
      description: () => text(ctx, "description"),
      editorial: () => paragraphs(ctx, "editorial"),
      theme: () => text(ctx, "theme"),
      role: () => text(ctx, "role") ?? "editorial",
      isHidden: () => ctx.body["isHidden"] === "true",
      seoTitle: () => text(ctx, "seoTitle"),
      seoDescription: () => text(ctx, "seoDescription"),
    }));
    return back(`/admin/collections/${handle}`, "Collection saved.");
  }));

  r.post("/admin/collections/:handle/products", action(async (ctx) => {
    const handle = ctx.params["handle"]!;
    await writes.setCollectionProducts(handle, lines(ctx, "order"));
    return back(`/admin/collections/${handle}`, "Curated order saved.");
  }));

  /* ----------------------------- curation actions ------------------------ */

  r.post("/admin/curation/:id/resolve", action(async (ctx) => {
    const id = ctx.params["id"]!;
    const kind = required(ctx, "kind");

    if (kind === "mapped") {
      const productHandle = text(ctx, "productHandle");
      if (!productHandle) {
        throw new WriteError(
          "Name the product this reference should point at. Nothing is chosen for you.",
        );
      }
      await writes.resolveCurationGap(id, { kind: "mapped", productHandle });
      return back("/admin/curation", `Mapped to ${productHandle}.`);
    }

    if (kind === "removed") {
      await writes.resolveCurationGap(id, { kind: "removed" });
      return back("/admin/curation", "Reference removed.", "warn");
    }

    if (kind === "reviewed") {
      await writes.resolveCurationGap(id, { kind: "reviewed" });
      return back("/admin/curation", "Marked as reviewed.");
    }

    throw new WriteError(`Unknown resolution ${JSON.stringify(kind)}`);
  }));

  r.post("/admin/curation/:id/reopen", action(async (ctx) => {
    await writes.reopenCurationGap(ctx.params["id"]!);
    return back("/admin/curation?show=resolved", "Reopened.", "warn");
  }));

  /* ---------------------------- compliance actions ----------------------- */

  r.post("/admin/compliance/screen", action(async (ctx) => {
    const brandSlug = required(ctx, "brandSlug");
    const title = text(ctx, "title") ?? "";
    const body = text(ctx, "text") ?? "";

    // The same screen a save runs, with nothing written.
    const screened = repo.compliance.screenProduct({
      title,
      description: body ? [body] : [],
      brandId: brandSlug,
    });

    // Rendered directly rather than redirected. Post-redirect-get exists so a
    // refresh cannot repeat a write, and this writes nothing — while sending
    // the submitted copy back through a query string put the whole pasted body
    // in a URL, which passed at a few hundred characters and produced an
    // 11 KB URL at a realistic length. Plenty of things in front of a server
    // refuse a URL that size.
    return new Html(
      await screenResultPage(
        { brandSlug, title, body, screened },
        flashFrom(ctx.query),
        await navCounts(),
      ),
    );
  }));

  return r;
}

/** Renders a refusal as a page rather than as JSON, for a browser. */
export function adminErrorPage(message: string, status: number, url: URL): string {
  return page(
    {
      title: status === 404 ? "Not found" : "That was refused",
      section: "",
      flash: null,
    },
    html`
      <div class="notice notice--danger">
        <p><strong>${message}</strong></p>
      </div>
      <section class="card">
        <p>
          ${status === 404
            ? "Nothing lives at this address."
            : "The change was not made. Nothing was written."}
        </p>
        <div class="actions">
          <a class="btn btn--ghost" href="${url.pathname.startsWith("/admin/products") ? "/admin/products" : "/admin"}">
            Go back
          </a>
        </div>
      </section>
    `,
  );
}
