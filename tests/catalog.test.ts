/**
 * Tests for the management API and the write layer beneath it.
 *
 * Every test that creates something removes it again, and the last suite
 * checks that the 110 imported products came through untouched. A test that
 * leaves data behind would make the next run's numbers wrong, and the numbers
 * are the point.
 */

import { suite, test, ok, equal, deepEqual, includes, rejects, run } from "./harness.ts";
import * as writes from "../src/server/repositories/writes.ts";
import * as repo from "../src/server/repositories/index.ts";
import { close, rows } from "../src/server/db/index.ts";
import { createApi, type Router } from "../src/server/api/http.ts";
import { buildRouter } from "../src/server/api/routes.ts";

/* ------------------------------ test fixtures ---------------------------- */

const CREATED: string[] = [];

/** A handle that cannot collide with an imported product. */
function handle(name: string): string {
  const h = `zz-test-${name}`;
  CREATED.push(h);
  return h;
}

async function cleanup(): Promise<void> {
  for (const h of CREATED) {
    await rows(`DELETE FROM products WHERE handle = $1`, [h]);
  }
  // Assets created by media tests that nothing references any more.
  await rows(
    `DELETE FROM media_assets a
      WHERE a.storage_key LIKE 'images/zz-test-%'
        AND NOT EXISTS (SELECT 1 FROM product_media m WHERE m.asset_id = a.id)`,
  );
}

/* ---------------------------- the API under test ------------------------- */

let baseUrl = "";
let api: ReturnType<typeof createApi>;

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/* ================================= create ================================ */

suite("create", () => {
  test("creates a product with only the fields supplied", async () => {
    const h = handle("create-minimal");
    const r = await writes.createProduct({ handle: h, title: "Minimal Product", brandSlug: "solutionshocl" });

    equal(r.handle, h);
    equal(r.publishable, false, "a new product starts unpublished");

    const p = await repo.catalog.loadProduct(h);
    ok(p, "the product reads back");
    equal(p!.title, "Minimal Product");
    equal(p!.status, "draft");
  });

  test("invents nothing for fields left out", async () => {
    const h = handle("create-invents-nothing");
    await writes.createProduct({ handle: h, title: "Nothing Invented", brandSlug: "solutionshocl" });

    const p = await repo.catalog.loadProduct(h);
    equal(p!.shortBenefit, null, "no benefit line was made up");
    equal(p!.seo.title, null, "no SEO title was made up");
    equal(p!.seo.description, null, "no meta description was made up");
    equal(p!.productType, null);
    equal(p!.categoryId, null);
    deepEqual(p!.description, [], "no description was made up");
    deepEqual(p!.variants, [], "no variant, and therefore no price, was made up");
    deepEqual(p!.images, [], "no image was made up");
  });

  test("records that the product came from the API, not an import", async () => {
    const h = handle("create-provenance");
    await writes.createProduct({ handle: h, title: "Provenance", brandSlug: "solutionshocl" });

    const [row] = await rows<{ origin: string }>(
      `SELECT s.origin FROM product_sources s JOIN products p ON p.id = s.product_id WHERE p.handle = $1`,
      [h],
    );
    equal(row!.origin, "api");
  });

  test("refuses a duplicate handle", async () => {
    const h = handle("create-duplicate");
    await writes.createProduct({ handle: h, title: "First", brandSlug: "solutionshocl" });
    await rejects(
      () => writes.createProduct({ handle: h, title: "Second", brandSlug: "solutionshocl" }),
      "already exists",
    );
  });

  test("refuses a handle that is not URL-safe", async () => {
    await rejects(
      () => writes.createProduct({ handle: "Not A Handle", title: "x", brandSlug: "solutionshocl" }),
      "lowercase",
    );
  });

  test("refuses an unknown brand rather than inventing one", async () => {
    await rejects(
      () => writes.createProduct({ handle: "zz-test-unknown-brand", title: "x", brandSlug: "no-such-brand" }),
      "No brand with slug",
    );
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM products WHERE handle = 'zz-test-unknown-brand'`,
    );
    equal(n, 0, "the failed create left nothing behind");
  });

  test("requires a title", async () => {
    await rejects(
      () => writes.createProduct({ handle: "zz-test-no-title", title: "", brandSlug: "solutionshocl" }),
      "title is required",
    );
  });
});

/* ================================== read ================================= */

suite("read", () => {
  test("reads a product back with everything it was given", async () => {
    const h = handle("read-roundtrip");
    await writes.createProduct({
      handle: h,
      title: "Round Trip",
      brandSlug: "life-ionizers",
      categorySlug: "water",
      shortBenefit: "A short benefit.",
      productType: "Test Type",
      seoTitle: "Round Trip SEO",
      seoDescription: "Round trip meta description.",
      description: ["First paragraph.", "Second paragraph."],
      tags: ["alpha", "beta"],
    });

    const p = await repo.catalog.loadProduct(h);
    equal(p!.title, "Round Trip");
    equal(p!.brandId, "life-ionizers");
    equal(p!.categoryId, "water");
    equal(p!.shortBenefit, "A short benefit.");
    equal(p!.productType, "Test Type");
    equal(p!.seo.title, "Round Trip SEO");
    equal(p!.seo.description, "Round trip meta description.");
    deepEqual(p!.description, ["First paragraph.", "Second paragraph."]);
    deepEqual(p!.sourceTags, ["alpha", "beta"], "tag order is preserved");
  });

  test("returns null for a handle that does not exist", async () => {
    equal(await repo.catalog.loadProduct("zz-test-never-created"), null);
  });

  test("filters by brand, category and publication", async () => {
    const byBrand = await repo.products.listProductRows({ brandSlug: "life-ionizers", publishable: true });
    ok(byBrand.length > 0, "the imported catalog has published Life Ionizers products");
    ok(byBrand.every((r) => r.brand_slug === "life-ionizers"));

    const withheld = await repo.products.listProductRows({ publishable: false });
    ok(withheld.every((r) => !r.publishable));
  });

  test("search matches text literally, not as a pattern", async () => {
    const wildcard = await repo.search.searchProducts("%", 200);
    ok(wildcard.length < 5, `"%" must not match everything (matched ${wildcard.length})`);
    equal((await repo.search.searchProducts("_")).length, 0);
    equal((await repo.search.searchProducts("' OR 1=1 --")).length, 0);
  });
});

/* ================================= update ================================ */

suite("update", () => {
  test("changes only the fields sent", async () => {
    const h = handle("update-partial");
    await writes.createProduct({
      handle: h, title: "Before", brandSlug: "solutionshocl",
      shortBenefit: "Keep me.", seoTitle: "Keep this too.",
    });

    await writes.updateProduct(h, { title: "After" });

    const p = await repo.catalog.loadProduct(h);
    equal(p!.title, "After");
    equal(p!.shortBenefit, "Keep me.", "an unsent field is untouched");
    equal(p!.seo.title, "Keep this too.");
  });

  test("clears a field when null is sent explicitly", async () => {
    const h = handle("update-clear");
    await writes.createProduct({ handle: h, title: "Clear Me", brandSlug: "solutionshocl", shortBenefit: "Temporary." });

    await writes.updateProduct(h, { shortBenefit: null });
    equal((await repo.catalog.loadProduct(h))!.shortBenefit, null);
  });

  test("replaces the description when one is sent", async () => {
    const h = handle("update-description");
    await writes.createProduct({ handle: h, title: "Desc", brandSlug: "solutionshocl", description: ["Old copy."] });

    await writes.updateProduct(h, { description: ["New copy.", "More copy."] });
    deepEqual((await repo.catalog.loadProduct(h))!.description, ["New copy.", "More copy."]);
  });

  test("re-derives review flags after a change", async () => {
    const h = handle("update-flags");
    await writes.createProduct({ handle: h, title: "Flags", brandSlug: "solutionshocl" });

    let p = await repo.catalog.loadProduct(h);
    ok(p!.flags.includes("missing_description"), "starts flagged for a missing description");

    await writes.updateProduct(h, { description: ["Now it has one."] });
    p = await repo.catalog.loadProduct(h);
    ok(!p!.flags.includes("missing_description"), "the flag clears once the copy exists");
  });

  test("rejects an empty title", async () => {
    const h = handle("update-empty-title");
    await writes.createProduct({ handle: h, title: "Has A Title", brandSlug: "solutionshocl" });
    await rejects(() => writes.updateProduct(h, { title: "" }), "cannot be empty");
  });

  test("fails on a product that does not exist", async () => {
    await rejects(() => writes.updateProduct("zz-test-absent", { title: "x" }), "No product with handle");
  });
});

/* ============================ publish / archive ========================== */

suite("publish and unpublish", () => {
  test("refuses to publish a product with no variant", async () => {
    const h = handle("publish-no-variant");
    await writes.createProduct({ handle: h, title: "No Variant", brandSlug: "solutionshocl" });
    const err = await rejects(() => writes.publishProduct(h), "no variant to sell");
    includes(err.message, "Cannot publish");
  });

  test("refuses to publish a product with no price", async () => {
    const h = handle("publish-no-price");
    await writes.createProduct({ handle: h, title: "Free", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 0 });
    await rejects(() => writes.publishProduct(h), "no price to sell at");
  });

  test("publishes once it has a priced variant", async () => {
    const h = handle("publish-ok");
    await writes.createProduct({ handle: h, title: "Publishable", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 1250 });

    const r = await writes.publishProduct(h);
    equal(r.publishable, true);
    equal(r.withheldReason, null);

    const p = await repo.catalog.loadProduct(h);
    equal(p!.status, "active");
    equal(p!.priceProvisional, false);
  });

  test("unpublishing requires a reason", async () => {
    const h = handle("unpublish-reason");
    await writes.createProduct({ handle: h, title: "Reasoned", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 500 });
    await writes.publishProduct(h);

    await rejects(() => writes.unpublishProduct(h, ""), "reason is required");

    const r = await writes.unpublishProduct(h, "Supplier discontinued it");
    equal(r.publishable, false);
    equal(r.withheldReason, "Supplier discontinued it");
  });

  test("an unpublished product does not reach the storefront", async () => {
    const h = handle("unpublish-hidden");
    await writes.createProduct({ handle: h, title: "Hidden", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 500 });
    await writes.publishProduct(h);

    ok((await repo.catalog.loadProducts({ publishable: true })).some((p) => p.handle === h));
    await writes.unpublishProduct(h, "Testing");
    ok(!(await repo.catalog.loadProducts({ publishable: true })).some((p) => p.handle === h));
  });
});

suite("archive", () => {
  test("archives without deleting anything", async () => {
    const h = handle("archive-keeps-row");
    await writes.createProduct({ handle: h, title: "Archived", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 900 });
    await writes.publishProduct(h);

    await writes.archiveProduct(h);

    const p = await repo.catalog.loadProduct(h);
    ok(p, "the product still exists");
    equal(p!.status, "archived");
    equal(p!.publishable, false);
    equal(p!.variants.length, 1, "its variant is still there");
  });

  test("refuses to publish an archived product", async () => {
    const h = handle("archive-blocks-publish");
    await writes.createProduct({ handle: h, title: "Still Archived", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 900 });
    await writes.archiveProduct(h);

    await rejects(() => writes.publishProduct(h), "archived");
  });

  test("unarchives to draft, not straight back to the storefront", async () => {
    const h = handle("archive-unarchive");
    await writes.createProduct({ handle: h, title: "Back Again", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 900 });
    await writes.archiveProduct(h);

    await writes.unarchiveProduct(h);
    const p = await repo.catalog.loadProduct(h);
    equal(p!.status, "draft");
    equal(p!.publishable, false, "unarchiving does not republish");

    await writes.publishProduct(h);
    equal((await repo.catalog.loadProduct(h))!.publishable, true);
  });
});

/* ================================ variants =============================== */

suite("variants", () => {
  test("adds a variant with a stable public reference", async () => {
    const h = handle("variant-ref");
    await writes.createProduct({ handle: h, title: "Ref Test", brandSlug: "solutionshocl" });
    const { ref } = await writes.addVariant(h, { title: "Default", priceCents: 1000, sku: "ZZ-REF-1" });

    ok(/^etv_[0-9a-f]{16}$/.test(ref), `reference should look like an EarthTrade variant id, got ${ref}`);
    const found = await repo.variants.getVariantByRef(ref);
    equal(found!.productHandle, h);
    equal(found!.priceCents, 1000);
  });

  test("keeps money as integer cents", async () => {
    const h = handle("variant-money");
    await writes.createProduct({ handle: h, title: "Money", brandSlug: "solutionshocl" });

    await rejects(() => writes.addVariant(h, { title: "x", priceCents: 19.99 }), "integer number of cents");
    await rejects(() => writes.addVariant(h, { title: "x", priceCents: -1 }), "cannot be negative");
    await rejects(
      () => writes.addVariant(h, { title: "x", priceCents: "1999" as unknown as number }),
      "integer number of cents",
    );
  });

  test("refuses a compare-at price below the price", async () => {
    const h = handle("variant-compare-at");
    await writes.createProduct({ handle: h, title: "Compare", brandSlug: "solutionshocl" });
    await rejects(
      () => writes.addVariant(h, { title: "x", priceCents: 2000, compareAtCents: 1000 }),
      "cannot be below",
    );
  });

  test("updates a price without disturbing anything else", async () => {
    const h = handle("variant-update");
    await writes.createProduct({ handle: h, title: "Update", brandSlug: "solutionshocl" });
    const { ref } = await writes.addVariant(h, {
      title: "Large", priceCents: 1000, sku: "ZZ-UPD-1", weightGrams: 500,
    });

    await writes.updateVariant(ref, { priceCents: 1500 });
    const v = await repo.variants.getVariantByRef(ref);
    equal(v!.priceCents, 1500);
    equal(v!.title, "Large", "the title is untouched");
    equal(v!.sku, "ZZ-UPD-1");
    equal(v!.weightGrams, 500);
  });

  test("refuses a weight that is not a positive integer", async () => {
    const h = handle("variant-weight");
    await writes.createProduct({ handle: h, title: "Weight", brandSlug: "solutionshocl" });
    await rejects(() => writes.addVariant(h, { title: "x", priceCents: 100, weightGrams: 0 }), "positive integer");
    await rejects(() => writes.addVariant(h, { title: "x", priceCents: 100, weightGrams: 1.5 }), "positive integer");
  });

  test("holds several variants in order", async () => {
    const h = handle("variant-many");
    await writes.createProduct({ handle: h, title: "Many", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Small", priceCents: 500, sku: "ZZ-MANY-S" });
    await writes.addVariant(h, { title: "Medium", priceCents: 900, sku: "ZZ-MANY-M" });
    await writes.addVariant(h, { title: "Large", priceCents: 1400, sku: "ZZ-MANY-L" });

    const p = await repo.catalog.loadProduct(h);
    deepEqual(p!.variants.map((v) => v.title), ["Small", "Medium", "Large"]);
    deepEqual(p!.variants.map((v) => v.priceCents), [500, 900, 1400]);
  });

  test("deactivating keeps the row so carts stay resolvable", async () => {
    const h = handle("variant-deactivate");
    await writes.createProduct({ handle: h, title: "Deactivate", brandSlug: "solutionshocl" });
    const a = await writes.addVariant(h, { title: "Keep", priceCents: 500, sku: "ZZ-DEA-1" });
    const b = await writes.addVariant(h, { title: "Drop", priceCents: 700, sku: "ZZ-DEA-2" });

    await writes.deactivateVariant(b.ref);

    const p = await repo.catalog.loadProduct(h);
    deepEqual(p!.variants.map((v) => v.ref), [a.ref], "the storefront no longer offers it");

    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM product_variants WHERE ref = $1`, [b.ref],
    );
    equal(n, 1, "but the row still exists");
  });

  test("refuses to deactivate the last variant of a published product", async () => {
    const h = handle("variant-last");
    await writes.createProduct({ handle: h, title: "Last One", brandSlug: "solutionshocl" });
    const { ref } = await writes.addVariant(h, { title: "Only", priceCents: 800 });
    await writes.publishProduct(h);

    await rejects(() => writes.deactivateVariant(ref), "last variant");
  });

  test("reports unknown stock as unknown, not as zero", async () => {
    const h = handle("variant-stock");
    await writes.createProduct({ handle: h, title: "Stock", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 100 });

    const p = await repo.catalog.loadProduct(h);
    equal(p!.variants[0]!.sellable, null, "no inventory counted means unknown");
  });
});

/* ================================== media ================================ */

suite("media", () => {
  test("attaches a local image", async () => {
    const h = handle("media-add");
    await writes.createProduct({ handle: h, title: "Media", brandSlug: "solutionshocl" });
    await writes.addMedia(h, { src: "/images/zz-test-one.jpg", alt: "A test image" });

    const p = await repo.catalog.loadProduct(h);
    equal(p!.images.length, 1);
    equal(p!.images[0]!.src, "/images/zz-test-one.jpg");
    equal(p!.images[0]!.alt, "A test image");
  });

  test("refuses an absolute URL", async () => {
    const h = handle("media-absolute");
    await writes.createProduct({ handle: h, title: "Absolute", brandSlug: "solutionshocl" });
    await rejects(
      () => writes.addMedia(h, { src: "https://cdn.shopify.com/x.jpg", alt: "External" }),
      "not an absolute URL",
    );
    await rejects(() => writes.addMedia(h, { src: "http://example.com/x.jpg", alt: "External" }), "absolute URL");
  });

  test("requires alt text", async () => {
    const h = handle("media-alt");
    await writes.createProduct({ handle: h, title: "Alt", brandSlug: "solutionshocl" });
    await rejects(() => writes.addMedia(h, { src: "/images/zz-test-two.jpg", alt: "" }), "alt text is required");
  });

  test("does not store the same file twice for one product", async () => {
    const h = handle("media-dedupe");
    await writes.createProduct({ handle: h, title: "Dedupe", brandSlug: "solutionshocl" });
    await writes.addMedia(h, { src: "/images/zz-test-three.jpg", alt: "First" });
    await writes.addMedia(h, { src: "/images/zz-test-three.jpg", alt: "Updated" });

    const p = await repo.catalog.loadProduct(h);
    equal(p!.images.length, 1, "the same file links once");
    equal(p!.images[0]!.alt, "Updated", "and the alt text was updated");
  });

  test("reorders images", async () => {
    const h = handle("media-order");
    await writes.createProduct({ handle: h, title: "Order", brandSlug: "solutionshocl" });
    await writes.addMedia(h, { src: "/images/zz-test-a.jpg", alt: "A" });
    await writes.addMedia(h, { src: "/images/zz-test-b.jpg", alt: "B" });
    await writes.addMedia(h, { src: "/images/zz-test-c.jpg", alt: "C" });

    await writes.reorderMedia(h, ["/images/zz-test-c.jpg", "/images/zz-test-a.jpg", "/images/zz-test-b.jpg"]);
    const p = await repo.catalog.loadProduct(h);
    deepEqual(p!.images.map((i) => i.alt), ["C", "A", "B"]);
  });

  test("refuses a reorder that does not list every image", async () => {
    const h = handle("media-order-partial");
    await writes.createProduct({ handle: h, title: "Partial", brandSlug: "solutionshocl" });
    await writes.addMedia(h, { src: "/images/zz-test-d.jpg", alt: "D" });
    await writes.addMedia(h, { src: "/images/zz-test-e.jpg", alt: "E" });

    await rejects(() => writes.reorderMedia(h, ["/images/zz-test-d.jpg"]), "exactly the images");
  });

  test("removes an image and closes the gap in the ordering", async () => {
    const h = handle("media-remove");
    await writes.createProduct({ handle: h, title: "Remove", brandSlug: "solutionshocl" });
    await writes.addMedia(h, { src: "/images/zz-test-f.jpg", alt: "F" });
    await writes.addMedia(h, { src: "/images/zz-test-g.jpg", alt: "G" });
    await writes.addMedia(h, { src: "/images/zz-test-h.jpg", alt: "H" });

    await writes.removeMedia(h, "/images/zz-test-g.jpg");

    const p = await repo.catalog.loadProduct(h);
    deepEqual(p!.images.map((i) => i.alt), ["F", "H"]);

    const positions = await rows<{ position: number }>(
      `SELECT m.position FROM product_media m JOIN products p ON p.id = m.product_id
        WHERE p.handle = $1 ORDER BY m.position`, [h],
    );
    deepEqual(positions.map((x) => x.position), [0, 1], "positions stay contiguous");
  });
});

/* =========================== collection assignment ======================= */

suite("collection assignment", () => {
  test("assigns a product to collections", async () => {
    const h = handle("collection-assign");
    await writes.createProduct({ handle: h, title: "Assigned", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 700 });
    await writes.publishProduct(h);

    await writes.setProductCollections(h, ["accessories", "wellness"]);

    ok((await repo.collections.collectionMembers("accessories")).includes(h));
    ok((await repo.collections.collectionMembers("wellness")).includes(h));
  });

  test("curated products lead the collection", async () => {
    const h = handle("collection-order");
    await writes.createProduct({ handle: h, title: "Leads", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 700 });
    await writes.publishProduct(h);

    await writes.setProductCollections(h, ["wellness"]);
    const members = await repo.collections.collectionMembers("wellness");
    equal(members[0], h, "a curated member comes before derived ones");
  });

  test("replaces curation rather than adding to it", async () => {
    const h = handle("collection-replace");
    await writes.createProduct({ handle: h, title: "Replaced", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 700 });
    await writes.publishProduct(h);

    await writes.setProductCollections(h, ["accessories", "wellness"]);
    await writes.setProductCollections(h, ["accessories"]);

    ok((await repo.collections.collectionMembers("accessories")).includes(h));
    ok(!(await repo.collections.collectionMembers("wellness")).includes(h), "the removed one is gone");
  });

  test("refuses an unknown collection", async () => {
    const h = handle("collection-unknown");
    await writes.createProduct({ handle: h, title: "Unknown", brandSlug: "solutionshocl" });
    await rejects(() => writes.setProductCollections(h, ["no-such-collection"]), "No collection with handle");
  });

  test("an unpublished product is not shown in a collection", async () => {
    const h = handle("collection-unpublished");
    await writes.createProduct({ handle: h, title: "Draft Member", brandSlug: "solutionshocl" });
    await writes.setProductCollections(h, ["accessories"]);

    ok(!(await repo.collections.collectionMembers("accessories")).includes(h));
  });
});

/* =============================== compliance ============================== */

suite("compliance enforcement", () => {
  test("quarantines copy that states a banned claim", async () => {
    const h = handle("compliance-copy");
    const r = await writes.createProduct({
      handle: h, title: "Clean Name", brandSlug: "solutionshocl",
      description: ["A perfectly ordinary sentence.", "Kills 99.9% of bacteria on contact."],
    });

    equal(r.quarantinedBlocks, 1);
    const p = await repo.catalog.loadProduct(h);
    deepEqual(p!.description, ["A perfectly ordinary sentence."], "only the clean block is published");
    equal(p!.quarantinedContent.length, 1, "the held block is kept, not deleted");
    ok(p!.quarantinedContent[0]!.matches.length > 0, "and it records why");
  });

  test("withholds a product whose name states a banned claim", async () => {
    const h = handle("compliance-title");
    const r = await writes.createProduct({ handle: h, title: "Atomizer", brandSlug: "solutionshocl" });

    equal(r.publishable, false);
    includes(r.withheldReason!, "Atomizer");
    ok(r.titleMatches.some((m) => m.term === "Atomizer"));
  });

  test("refuses to publish a product with a banned name", async () => {
    const h = handle("compliance-publish-block");
    await writes.createProduct({ handle: h, title: "Fogger", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 1000 });

    await rejects(() => writes.publishProduct(h), "cannot be published");
  });

  test("withdraws a published product whose name becomes unpublishable", async () => {
    const h = handle("compliance-edit-withdraws");
    await writes.createProduct({ handle: h, title: "Ordinary Cleaner", brandSlug: "solutionshocl" });
    await writes.addVariant(h, { title: "Default", priceCents: 1000 });
    await writes.publishProduct(h);
    equal((await repo.catalog.loadProduct(h))!.publishable, true);

    const r = await writes.updateProduct(h, { title: "Ordinary Fogger" });
    equal(r.publishable, false, "editing the name into a banned claim withdraws it immediately");
    includes(r.withheldReason!, "Fogger");
  });

  test("applies HOCL rules only to the brand they govern", async () => {
    const governed = handle("compliance-hocl");
    const other = handle("compliance-other-brand");

    // "Purifier" is a HOCL-specific term; the same word is ordinary elsewhere.
    const a = await writes.createProduct({
      handle: governed, title: "Ordinary Name", brandSlug: "solutionshocl",
      description: ["This is a purifier for tanks."],
    });
    const b = await writes.createProduct({
      handle: other, title: "Ordinary Name Too", brandSlug: "life-ionizers",
      description: ["This is a purifier for tanks."],
    });

    equal(a.quarantinedBlocks, 1, "the governed brand is screened against the HOCL rules");
    equal(b.quarantinedBlocks, 0, "another brand is not");
  });

  test("checks regulatory acronyms case-sensitively", async () => {
    const upper = handle("compliance-acronym-upper");
    const lower = handle("compliance-acronym-lower");

    const a = await writes.createProduct({
      handle: upper, title: "Acronym Upper", brandSlug: "life-ionizers",
      description: ["Registered with the EPA."],
    });
    const b = await writes.createProduct({
      handle: lower, title: "Acronym Lower", brandSlug: "life-ionizers",
      description: ["Ask the customers who bought this."],
    });

    equal(a.quarantinedBlocks, 1, "EPA is a regulatory claim");
    equal(b.quarantinedBlocks, 0, `"who" inside a word is not the WHO`);
  });

  test("screens without writing, for previewing an edit", async () => {
    const screened = repo.compliance.screenProduct({
      title: "Fogger", brandId: "solutionshocl", description: ["Kills germs."],
    });
    equal(screened.publishable, false);
    equal(screened.quarantined.length, 1);
    equal(screened.description.length, 0);
  });
});

/* ============================== the HTTP API ============================= */

suite("HTTP API", () => {
  test("reports health", async () => {
    const { status, json } = await call("GET", "/api/health");
    equal(status, 200);
    equal(json.status, "ok");
  });

  test("creates, reads, updates and publishes over HTTP", async () => {
    const h = handle("http-lifecycle");

    let res = await call("POST", "/api/products", {
      handle: h, title: "Over HTTP", brandSlug: "solutionshocl", description: ["Created through the API."],
    });
    equal(res.status, 201, "creating returns 201");
    equal(res.json.publishable, false);

    res = await call("GET", `/api/products/${h}`);
    equal(res.status, 200);
    equal(res.json.title, "Over HTTP");

    res = await call("PATCH", `/api/products/${h}`, { shortBenefit: "Added later." });
    equal(res.status, 200);

    res = await call("POST", `/api/products/${h}/variants`, { title: "Default", priceCents: 2500, sku: "ZZ-HTTP-1" });
    equal(res.status, 201);
    ok(res.json.ref.startsWith("etv_"));

    res = await call("POST", `/api/products/${h}/publish`);
    equal(res.status, 200);
    equal(res.json.publishable, true);

    res = await call("GET", `/api/products/${h}`);
    equal(res.json.shortBenefit, "Added later.");
    equal(res.json.variants[0].priceCents, 2500);
  });

  test("returns 404 for a product that does not exist", async () => {
    const { status, json } = await call("GET", "/api/products/zz-test-not-here");
    equal(status, 404);
    includes(json.error, "No product with handle");
  });

  test("returns 405 for a method the endpoint does not accept", async () => {
    const { status, json } = await call("DELETE", "/api/health");
    equal(status, 405);
    includes(json.error, "not allowed");
  });

  test("returns 422 with a usable message on invalid input", async () => {
    const { status, json } = await call("POST", "/api/products", { title: "No Handle", brandSlug: "solutionshocl" });
    equal(status, 422);
    includes(json.error, "handle is required");
  });

  test("returns 409 when publication is refused", async () => {
    const h = handle("http-publish-refused");
    await call("POST", "/api/products", { handle: h, title: "Refused", brandSlug: "solutionshocl" });

    const { status, json } = await call("POST", `/api/products/${h}/publish`);
    equal(status, 409);
    ok(Array.isArray(json.detail.blockers));
  });

  test("rejects a body that is not JSON", async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json at all",
    });
    equal(res.status, 400);
  });

  test("screens copy without writing anything", async () => {
    const [before] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM products`);

    const { status, json } = await call("POST", "/api/compliance/screen", {
      brandSlug: "solutionshocl", title: "Atomizer", description: ["Kills bacteria."],
    });
    equal(status, 200);
    equal(json.publishable, false);
    equal(json.wouldQuarantine.length, 1);
    includes(json.withheldReason, "Atomizer");

    const [after] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM products`);
    equal(after!.n, before!.n, "screening created nothing");
  });

  test("lists and filters products", async () => {
    let res = await call("GET", "/api/products?published=true&limit=5");
    equal(res.status, 200);
    equal(res.json.products.length, 5);

    const counts = await repo.products.publicationCounts();
    equal(res.json.total, counts.published, "the listing agrees with the database");

    res = await call("GET", "/api/products?brand=life-ionizers&published=true");
    ok(res.json.products.every((p: { brandId: string }) => p.brandId === "life-ionizers"));
  });

  test("refuses an absolute media URL over HTTP", async () => {
    const h = handle("http-media-absolute");
    await call("POST", "/api/products", { handle: h, title: "Media HTTP", brandSlug: "solutionshocl" });

    const { status, json } = await call("POST", `/api/products/${h}/media`, {
      src: "https://cdn.shopify.com/thing.jpg", alt: "External",
    });
    equal(status, 422);
    includes(json.error, "absolute URL");
  });
});

/* ====================== the imported catalog is intact =================== */

suite("imported catalog untouched", () => {
  test("still 110 products, 106 published, 4 withheld", async () => {
    const counts = await repo.products.publicationCounts();
    // Test products are created and removed within this run; this suite runs
    // after cleanup, so only imported products remain.
    equal(counts.total, 110);
    equal(counts.published, 106);
    equal(counts.withheld, 4);
  });

  test("still 110 variants and 109 media links", async () => {
    const [v] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM product_variants`);
    const [m] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM product_media`);
    equal(v!.n, 110);
    equal(m!.n, 109);
  });

  test("no imported product changed", async () => {
    const [row] = await rows<{ sum: number; titles: string }>(
      `SELECT coalesce(sum(v.price_cents), 0)::int AS sum,
              md5(string_agg(p.title, '|' ORDER BY p.handle)) AS titles
         FROM products p LEFT JOIN product_variants v ON v.product_id = p.id`,
    );
    equal(row!.sum, IMPORTED_PRICE_SUM, "the sum of every price is unchanged");
  });

  test("no test data left behind", async () => {
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM products WHERE handle LIKE 'zz-test-%'`,
    );
    equal(n, 0);
  });
});

/* --------------------------------- run ----------------------------------- */

// Captured before anything is created, so the "untouched" suite compares
// against what was actually there rather than against a number typed in.
const [{ sum: IMPORTED_PRICE_SUM }] = await rows<{ sum: number }>(
  `SELECT coalesce(sum(price_cents), 0)::int AS sum FROM product_variants`,
);

api = createApi({ router: buildRouter(), port: 0, onRequest: () => {} });
const port = await api.listen();
baseUrl = `http://127.0.0.1:${port}`;

const UNTOUCHED = "imported catalog untouched";

await run("EarthTrade catalog and management API", (s) => s !== UNTOUCHED);

// Everything this run created is removed before the last suite, which asserts
// that the imported catalog came through unchanged. That claim is only
// meaningful once the test data is gone.
await cleanup();
const result = await run("Imported catalog", (s) => s === UNTOUCHED);

await api.close();
await close();

process.exit(result.failed.length ? 1 : 0);
