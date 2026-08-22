/**
 * The management API's endpoints.
 *
 * Every handler is a thin translation between HTTP and the repository layer.
 * Validation, compliance and the refusal to invent data all live in the
 * repositories, so a future caller that is not HTTP — a script, a migration, the
 * Dashboard's own server code — gets the same guarantees.
 */

import { Created, NoContent, Router, type RequestContext } from "./http.ts";
import { WriteError } from "../repositories/writes.ts";
import * as writes from "../repositories/writes.ts";
import * as repo from "../repositories/index.ts";
import { rows } from "../db/index.ts";
import { addAdminRoutes } from "../admin/routes.ts";

/* ------------------------------ input reading ---------------------------- */

function str(ctx: RequestContext, key: string, required = false): string | null | undefined {
  if (!(key in ctx.body)) return required ? fail(`${key} is required`) : undefined;
  const v = ctx.body[key];
  if (v === null) return null;
  if (typeof v !== "string") return fail(`${key} must be a string`);
  return v;
}

function num(ctx: RequestContext, key: string): number | null | undefined {
  if (!(key in ctx.body)) return undefined;
  const v = ctx.body[key];
  if (v === null) return null;
  if (typeof v !== "number") return fail(`${key} must be a number`);
  return v;
}

function bool(ctx: RequestContext, key: string): boolean | undefined {
  if (!(key in ctx.body)) return undefined;
  const v = ctx.body[key];
  if (typeof v !== "boolean") return fail(`${key} must be true or false`);
  return v;
}

function strList(ctx: RequestContext, key: string): string[] | undefined {
  if (!(key in ctx.body)) return undefined;
  const v = ctx.body[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    return fail(`${key} must be an array of strings`);
  }
  return v as string[];
}

function fail(message: string): never {
  throw new WriteError(message);
}

/** Copies only the keys present, so "absent" and "null" stay different. */
function pick<T extends object>(source: Record<string, unknown>, entries: [keyof T, unknown][]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value !== undefined || key in source) out[key as string] = value;
  }
  return out as Partial<T>;
}

/* --------------------------------- routes -------------------------------- */

export function buildRouter(): Router {
  const r = new Router();

  r.get("/api/health", async () => {
    const [{ n }] = await rows<{ n: number }>("SELECT count(*)::int AS n FROM products");
    return { status: "ok", products: n };
  });

  /* ------------------------------- products ------------------------------ */

  r.get("/api/products", async (ctx) => {
    const filter: repo.products.ProductFilter = {};
    const published = ctx.query.get("published");
    if (published === "true") filter.publishable = true;
    if (published === "false") filter.publishable = false;
    const brand = ctx.query.get("brand");
    if (brand) filter.brandSlug = brand;
    const category = ctx.query.get("category");
    if (category) filter.categorySlug = category;

    const search = ctx.query.get("q");
    if (search) filter.handles = await repo.search.searchProducts(search, 200);

    const all = await repo.catalog.loadProducts(filter);
    const limit = Math.min(Number(ctx.query.get("limit") ?? 50) || 50, 200);
    const offset = Math.max(Number(ctx.query.get("offset") ?? 0) || 0, 0);

    return {
      total: all.length,
      limit,
      offset,
      products: all.slice(offset, offset + limit),
    };
  });

  r.post("/api/products", async (ctx) => {
    const result = await writes.createProduct({
      handle: str(ctx, "handle", true)!,
      title: str(ctx, "title", true)!,
      brandSlug: str(ctx, "brandSlug", true)!,
      categorySlug: str(ctx, "categorySlug"),
      cardTitle: str(ctx, "cardTitle"),
      shortBenefit: str(ctx, "shortBenefit"),
      productType: str(ctx, "productType"),
      seoTitle: str(ctx, "seoTitle"),
      seoDescription: str(ctx, "seoDescription"),
      description: strList(ctx, "description"),
      subscription: bool(ctx, "subscription"),
      tags: strList(ctx, "tags"),
    });
    return new Created(result);
  });

  r.get("/api/products/:handle", async (ctx) => {
    const product = await repo.catalog.loadProduct(ctx.params["handle"]!);
    if (!product) throw new WriteError(`No product with handle ${JSON.stringify(ctx.params["handle"])}`, 404);
    return product;
  });

  r.patch("/api/products/:handle", async (ctx) =>
    writes.updateProduct(
      ctx.params["handle"]!,
      pick<writes.ProductInput>(ctx.body, [
        ["title", str(ctx, "title")],
        ["cardTitle", str(ctx, "cardTitle")],
        ["shortBenefit", str(ctx, "shortBenefit")],
        ["productType", str(ctx, "productType")],
        ["seoTitle", str(ctx, "seoTitle")],
        ["seoDescription", str(ctx, "seoDescription")],
        ["brandSlug", str(ctx, "brandSlug")],
        ["categorySlug", str(ctx, "categorySlug")],
        ["description", strList(ctx, "description")],
        ["subscription", bool(ctx, "subscription")],
        ["tags", strList(ctx, "tags")],
      ]),
    ),
  );

  r.post("/api/products/:handle/publish", async (ctx) => writes.publishProduct(ctx.params["handle"]!));

  r.post("/api/products/:handle/unpublish", async (ctx) =>
    writes.unpublishProduct(ctx.params["handle"]!, str(ctx, "reason", true)!),
  );

  r.post("/api/products/:handle/archive", async (ctx) => writes.archiveProduct(ctx.params["handle"]!));
  r.post("/api/products/:handle/unarchive", async (ctx) => writes.unarchiveProduct(ctx.params["handle"]!));

  /* ------------------------------- variants ------------------------------ */

  r.get("/api/products/:handle/variants", async (ctx) => {
    const product = await repo.catalog.loadProduct(ctx.params["handle"]!);
    if (!product) throw new WriteError(`No product with handle ${JSON.stringify(ctx.params["handle"])}`, 404);
    return { variants: product.variants };
  });

  r.post("/api/products/:handle/variants", async (ctx) => {
    const result = await writes.addVariant(ctx.params["handle"]!, {
      title: str(ctx, "title", true)!,
      priceCents: num(ctx, "priceCents") ?? fail("priceCents is required"),
      sku: str(ctx, "sku"),
      compareAtCents: num(ctx, "compareAtCents"),
      weightGrams: num(ctx, "weightGrams"),
      barcode: str(ctx, "barcode"),
      currency: str(ctx, "currency") ?? undefined,
      requiresShipping: bool(ctx, "requiresShipping"),
      taxable: bool(ctx, "taxable"),
    });
    return new Created(result);
  });

  r.get("/api/variants/:ref", async (ctx) => {
    const variant = await repo.variants.getVariantByRef(ctx.params["ref"]!);
    if (!variant) throw new WriteError(`No variant with reference ${JSON.stringify(ctx.params["ref"])}`, 404);
    return variant;
  });

  r.patch("/api/variants/:ref", async (ctx) =>
    writes.updateVariant(
      ctx.params["ref"]!,
      pick<writes.VariantInput>(ctx.body, [
        ["title", str(ctx, "title")],
        ["sku", str(ctx, "sku")],
        ["priceCents", num(ctx, "priceCents")],
        ["compareAtCents", num(ctx, "compareAtCents")],
        ["weightGrams", num(ctx, "weightGrams")],
        ["barcode", str(ctx, "barcode")],
        ["requiresShipping", bool(ctx, "requiresShipping")],
        ["taxable", bool(ctx, "taxable")],
      ]),
    ),
  );

  r.delete("/api/variants/:ref", async (ctx) => {
    await writes.deactivateVariant(ctx.params["ref"]!);
    return NoContent;
  });

  /* -------------------------------- media -------------------------------- */

  r.get("/api/products/:handle/media", async (ctx) => {
    const product = await repo.catalog.loadProduct(ctx.params["handle"]!);
    if (!product) throw new WriteError(`No product with handle ${JSON.stringify(ctx.params["handle"])}`, 404);
    return { images: product.images, pending: product.pendingImages };
  });

  r.post("/api/products/:handle/media", async (ctx) => {
    const result = await writes.addMedia(ctx.params["handle"]!, {
      src: str(ctx, "src", true)!,
      alt: str(ctx, "alt", true)!,
      width: num(ctx, "width"),
      height: num(ctx, "height"),
    });
    return new Created(result);
  });

  r.put("/api/products/:handle/media/order", async (ctx) =>
    writes.reorderMedia(ctx.params["handle"]!, strList(ctx, "order") ?? fail("order is required")),
  );

  r.delete("/api/products/:handle/media/:src", async (ctx) => {
    await writes.removeMedia(ctx.params["handle"]!, ctx.params["src"]!);
    return NoContent;
  });

  /* ----------------------------- collections ----------------------------- */

  r.get("/api/collections", async () => ({ collections: await repo.collections.listCollections() }));

  r.get("/api/collections/:handle", async (ctx) => {
    const collection = await repo.collections.getCollection(ctx.params["handle"]!);
    if (!collection) throw new WriteError(`No collection with handle ${JSON.stringify(ctx.params["handle"])}`, 404);
    return {
      ...collection,
      products: await repo.collections.collectionMembers(ctx.params["handle"]!),
    };
  });

  r.put("/api/products/:handle/collections", async (ctx) =>
    writes.setProductCollections(ctx.params["handle"]!, strList(ctx, "collections") ?? fail("collections is required")),
  );

  /* -------------------------------- brands ------------------------------- */

  r.get("/api/brands", async () => ({ brands: await repo.brands.listBrands() }));

  r.get("/api/brands/:slug", async (ctx) => {
    const brand = await repo.brands.getBrand(ctx.params["slug"]!);
    if (!brand) throw new WriteError(`No brand with slug ${JSON.stringify(ctx.params["slug"])}`, 404);
    return brand;
  });

  /* ------------------------------ compliance ----------------------------- */

  /**
   * Screens copy without writing anything, so an editor can see what would be
   * held back before committing to it.
   */
  r.post("/api/compliance/screen", async (ctx) => {
    const brandSlug = str(ctx, "brandSlug", true)!;
    const title = str(ctx, "title") ?? "";
    const description = strList(ctx, "description") ?? [];

    const screened = repo.compliance.screenProduct({ title, description, brandId: brandSlug });
    return {
      brandSlug,
      publishable: screened.publishable,
      withheldReason: screened.withheldReason,
      titleMatches: screened.titleMatches,
      wouldPublish: screened.description,
      wouldQuarantine: screened.quarantined,
    };
  });

  r.get("/api/compliance/summary", async () => repo.compliance.complianceSummary());

  r.get("/api/withheld", async () => ({ products: await repo.publication.withheldProducts() }));

  r.get("/api/audit", async (ctx) => ({
    total: await repo.audit.countAudit({}),
    entries: await repo.audit.listAudit({
      ...(ctx.query.get("entity") ? { entityType: ctx.query.get("entity")! } : {}),
      ...(ctx.query.get("actor") ? { actor: ctx.query.get("actor")! } : {}),
      limit: Number(ctx.query.get("limit") ?? 50) || 50,
      offset: Number(ctx.query.get("offset") ?? 0) || 0,
    }),
  }));

  r.get("/api/inventory", async (ctx) => ({
    summary: await repo.inventory.stockSummary(),
    levels: await repo.inventory.listStock({
      ...(ctx.query.get("state") ? { state: ctx.query.get("state") as repo.inventory.StockState } : {}),
      limit: Number(ctx.query.get("limit") ?? 100) || 100,
    }),
  }));

  r.put("/api/variants/:ref/stock", async (ctx) => {
    const onHand = ctx.body["onHand"];
    if (onHand !== null && typeof onHand !== "number") {
      throw new WriteError("onHand must be a number of units, or null to record it as uncounted");
    }
    return writes.setStock(ctx.params["ref"]!, {
      onHand: onHand as number | null,
      ...(typeof ctx.body["reason"] === "string" ? { reason: ctx.body["reason"] } : {}),
      ...(typeof ctx.body["note"] === "string" ? { note: ctx.body["note"] } : {}),
    });
  });

  r.get("/api/curation", async (ctx) => ({
    summary: await repo.curation.gapSummary(),
    gaps: await repo.curation.listGaps({ open: ctx.query.get("show") !== "resolved" }),
  }));

  // The admin screens share this router, so the API and the Dashboard cannot
  // diverge: both go through the same repository layer, and adding an endpoint
  // to one does not silently leave the other behind.
  addAdminRoutes(r);

  return r;
}
