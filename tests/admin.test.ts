/**
 * Tests for the Admin Dashboard and the write layer it sits on.
 *
 * Every test drives the Dashboard the way a person does — HTML forms posted to
 * the real server — and then checks the database, and where it matters, the
 * built storefront. A test that only checked the HTTP response would prove the
 * form submitted, not that anything happened.
 *
 * Test data uses the `zz-test-` prefix and is removed at the end. The final
 * suite asserts the 110 imported products came through untouched.
 */

import { suite, test, ok, equal, deepEqual, includes, rejects, run } from "./harness.ts";
import * as writes from "../src/server/repositories/writes.ts";
import * as repo from "../src/server/repositories/index.ts";
import { close, rows } from "../src/server/db/index.ts";
import { createApi } from "../src/server/api/http.ts";
import { buildRouter } from "../src/server/api/routes.ts";
import { adminErrorPage } from "../src/server/admin/routes.ts";
import { asActor } from "../src/server/audit.ts";
import { buildCatalog } from "../src/data/catalog-record.ts";
import { loadFromPostgres } from "../src/data/sources/postgres.ts";

/* -------------------------------- fixtures ------------------------------- */

const CREATED: string[] = [];
const CREATED_BRANDS: string[] = [];
const CREATED_COLLECTIONS: string[] = [];

function handle(name: string): string {
  const h = `zz-test-${name}`;
  CREATED.push(h);
  return h;
}

async function cleanup(): Promise<void> {
  await rows(
    `DELETE FROM inventory_movements m USING product_variants v, products p
      WHERE m.variant_id = v.id AND v.product_id = p.id AND p.handle LIKE 'zz-test-%'`,
  );
  for (const h of CREATED) await rows(`DELETE FROM products WHERE handle = $1`, [h]);
  for (const s of CREATED_BRANDS) await rows(`DELETE FROM brands WHERE slug = $1`, [s]);
  for (const c of CREATED_COLLECTIONS) await rows(`DELETE FROM collections WHERE handle = $1`, [c]);
  await rows(
    `DELETE FROM media_assets a WHERE a.storage_key LIKE 'images/zz-test-%'
       AND NOT EXISTS (SELECT 1 FROM product_media m WHERE m.asset_id = a.id)`,
  );
  // Audit rows are deliberately *not* removed. The log is append-only —
  // the schema says so, the Dashboard says so, and a cleanup routine that
  // quietly deletes from it is exactly the thing that later gets copied into
  // production code. They accumulate in the development database, tagged with
  // the actor that wrote them, which is what an audit trail is supposed to do.
}

/* --------------------------- driving the Dashboard ----------------------- */

let baseUrl = "";
let api: ReturnType<typeof createApi>;

/** Posts a form exactly as the browser does, following nothing. */
async function form(path: string, fields: Record<string, string | string[]>) {
  const body = new URLSearchParams();
  // Identifies this run in the audit trail, the same way a person's session
  // will once there are identities.
  body.append("__actor", "zz-test-suite");
  for (const [k, v] of Object.entries(fields)) {
    for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" },
    body: body.toString(),
    redirect: "manual",
  });
  return {
    status: res.status,
    location: res.headers.get("location") ?? "",
    // Bodies matter on a refusal, and on the one action that answers with a
    // page instead of a redirect.
    text: res.status === 303 ? "" : await res.text(),
  };
}

async function get(path: string) {
  const res = await fetch(`${baseUrl}${path}`, { headers: { accept: "text/html" } });
  return { status: res.status, html: await res.text() };
}

/** The audit rows this test run wrote, newest first. */
async function auditFor(action?: string) {
  return repo.audit.listAudit({ actor: "zz-test-suite (dashboard)", ...(action ? { action } : {}), limit: 50 });
}

/** Renders the storefront catalog from PostgreSQL, as the build does. */
async function storefront() {
  return buildCatalog(await loadFromPostgres());
}

/**
 * Reads back exactly what the browser would post from an unmodified editor.
 *
 * Round-trip fidelity is only testable this way. Constructing the fields by
 * hand tests what the test author believed the form contains, which is how a
 * field silently missing from it goes unnoticed.
 */
async function editorForm(handle: string): Promise<Record<string, string>> {
  const { html: doc } = await get(`/admin/products/${encodeURIComponent(handle)}`);

  const unescape = (v: string): string =>
    v.replaceAll("&quot;", '"').replaceAll("&#39;", "'")
      .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

  const input = (name: string): string => {
    const m = new RegExp(`<input[^>]*name="${name}"[^>]*value="([^"]*)"`).exec(doc);
    return m ? unescape(m[1]!) : "";
  };
  const area = (name: string): string => {
    const m = new RegExp(`<textarea[^>]*name="${name}"[^>]*>([\\s\\S]*?)</textarea>`).exec(doc);
    return m ? unescape(m[1]!) : "";
  };
  const chosen = (name: string): string => {
    const block = new RegExp(`<select[^>]*name="${name}"[\\s\\S]*?</select>`).exec(doc);
    if (!block) return "";
    const m = /<option value="([^"]*)"[^>]*selected/.exec(block[0]);
    return m ? m[1]! : "";
  };

  return {
    title: input("title"),
    cardTitle: input("cardTitle"),
    brandSlug: chosen("brandSlug"),
    categorySlug: chosen("categorySlug"),
    productType: input("productType"),
    shortBenefit: input("shortBenefit"),
    description: area("description"),
    heldBack: area("heldBack"),
    seoTitle: input("seoTitle"),
    seoDescription: area("seoDescription"),
    tags: input("tags"),
  };
}

/* ============================== the shell ================================ */

suite("admin shell", () => {
  test("every screen renders", async () => {
    for (const path of [
      "/admin", "/admin/products", "/admin/products/new", "/admin/inventory",
      "/admin/collections", "/admin/brands", "/admin/compliance", "/admin/curation", "/admin/audit",
    ]) {
      const { status } = await get(path);
      equal(status, 200, `${path} should render`);
    }
  });

  test("serves its own stylesheet, separate from the storefront", async () => {
    const res = await fetch(`${baseUrl}/admin/admin.css`);
    equal(res.status, 200);
    includes(res.headers.get("content-type") ?? "", "text/css");
    includes(await res.text(), "--deep-green");
  });

  test("every text control is styled, including the ones written without a type", async () => {
    // Listing input types individually skipped `<input name="alt">` and the
    // variant row fields: they rendered with browser defaults, and carried an
    // intrinsic ~185px width that pushed the page sideways on a phone.
    const { html: css } = await get("/admin/admin.css");
    ok(
      css.includes("input:where(:not([type=checkbox]"),
      "the control rule must match untyped inputs, not a list of specific types",
    );
    ok(css.includes("min-width: 0"), "and must let them shrink below their intrinsic width");

    const { html: page } = await get("/admin/products/toilet-bomb-organic-lemon");
    const untyped = [...page.matchAll(/<input(?![^>]*\btype=)[^>]*>/g)];
    ok(untyped.length > 0, "the Dashboard does render untyped inputs, so the rule has to cover them");
  });

  test("the control rule keeps element-level specificity", async () => {
    // The exclusions have to sit inside :where(). Written as a bare :not()
    // chain the rule outranks input:disabled, and a read-only field — the
    // handle, which must never be edited — stops looking read-only.
    const { html: css } = await get("/admin/admin.css");
    ok(
      /input:where\(:not\(\[type=checkbox\]/.test(css),
      "exclusions must be wrapped in :where() so the rule stays at specificity (0,0,1)",
    );
    ok(css.includes("input:disabled"), "and the disabled styling must still be defined");
  });

  test("is marked never to be indexed", async () => {
    const { html } = await get("/admin");
    includes(html, 'name="robots" content="noindex, nofollow"');
  });

  test("escapes catalog copy rather than rendering it as markup", async () => {
    const h = handle("shell-escaping");
    await writes.createProduct({
      handle: h, title: "Bold <script>alert(1)</script> Cleaner", brandSlug: "solutionshocl",
    });
    const { html } = await get(`/admin/products/${h}`);
    ok(!html.includes("<script>alert(1)</script>"), "the script tag must not survive as markup");
    includes(html, "&lt;script&gt;");
  });

  test("shows a refusal as a page, not as JSON", async () => {
    const { status, html } = await get("/admin/products/zz-test-absent");
    equal(status, 404);
    includes(html, "<!doctype html>");
    includes(html, "No product with handle");
  });
});

/* =============================== products ================================ */

suite("product: create → database → storefront", () => {
  test("creating through the Dashboard reaches the database", async () => {
    const h = handle("lifecycle");
    const res = await form("/admin/products", {
      handle: h, title: "Lifecycle Product", brandSlug: "solutionshocl",
      categorySlug: "cleaning", shortBenefit: "A short benefit.",
      description: "First paragraph.\n\nSecond paragraph.",
    });
    equal(res.status, 303);
    includes(res.location, `/admin/products/${h}`);

    const p = await repo.catalog.loadProduct(h);
    ok(p, "the product exists");
    equal(p!.title, "Lifecycle Product");
    equal(p!.categoryId, "cleaning");
    deepEqual(p!.description, ["First paragraph.", "Second paragraph."], "blank lines split paragraphs");
  });

  test("a new product does not reach the storefront until it is published", async () => {
    const h = handle("not-yet-live");
    await form("/admin/products", { handle: h, title: "Not Yet Live", brandSlug: "solutionshocl" });

    const catalog = await storefront();
    ok(!catalog.products.some((p) => p.handle === h), "an unpublished product is not rendered");
  });

  test("edit → database → storefront", async () => {
    const h = handle("edit-flow");
    await form("/admin/products", { handle: h, title: "Before Edit", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "15.00" });
    await form(`/admin/products/${h}/publish`, {});

    await form(`/admin/products/${h}`, {
      title: "After Edit", brandSlug: "solutionshocl",
      shortBenefit: "Edited benefit.", description: "Edited copy.",
    });

    const catalog = await storefront();
    const p = catalog.products.find((x) => x.handle === h);
    ok(p, "the edited product is on the storefront");
    equal(p!.title, "After Edit");
    equal(p!.shortBenefit, "Edited benefit.");
    deepEqual(p!.description, ["Edited copy."]);
  });

  test("publish → storefront", async () => {
    const h = handle("publish-flow");
    await form("/admin/products", { handle: h, title: "Publish Flow", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "9.99" });

    ok(!(await storefront()).products.some((p) => p.handle === h), "not there yet");
    const res = await form(`/admin/products/${h}/publish`, {});
    equal(res.status, 303);

    const p = (await storefront()).products.find((x) => x.handle === h);
    ok(p, "published products render");
    equal(p!.variants[0]!.price, 9.99, "cents become dollars only at the display boundary");
  });

  test("unpublishing demands a real reason", async () => {
    const h = handle("unpublish-reason");
    await form("/admin/products", { handle: h, title: "Reasoned", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${h}/publish`, {});

    const refused = await form(`/admin/products/${h}/unpublish`, { reason: "" });
    equal(refused.status, 422, "an empty reason is refused rather than filled in with boilerplate");
    equal((await repo.catalog.loadProduct(h))!.publishable, true, "and it stays published");

    await form(`/admin/products/${h}/unpublish`, { reason: "Supplier discontinued it" });
    equal((await repo.catalog.loadProduct(h))!.withheldReason, "Supplier discontinued it");
  });

  test("unpublish → storefront", async () => {
    const h = handle("unpublish-flow");
    await form("/admin/products", { handle: h, title: "Unpublish Flow", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "9.99" });
    await form(`/admin/products/${h}/publish`, {});
    ok((await storefront()).products.some((p) => p.handle === h));

    await form(`/admin/products/${h}/unpublish`, { reason: "Testing removal" });
    ok(!(await storefront()).products.some((p) => p.handle === h), "it is gone from the storefront");
    equal((await repo.catalog.loadProduct(h))!.withheldReason, "Testing removal");
  });

  test("archive → storefront, and nothing is deleted", async () => {
    const h = handle("archive-flow");
    await form("/admin/products", { handle: h, title: "Archive Flow", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "9.99" });
    await form(`/admin/products/${h}/publish`, {});

    await form(`/admin/products/${h}/archive`, {});

    ok(!(await storefront()).products.some((p) => p.handle === h), "archived products do not render");
    const p = await repo.catalog.loadProduct(h);
    ok(p, "but the product is still there");
    equal(p!.status, "archived");
    equal(p!.variants.length, 1, "and so is its variant");
  });

  test("refuses to delete anything that has been published", async () => {
    const h = handle("delete-guard");
    await form("/admin/products", { handle: h, title: "Delete Guard", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${h}/publish`, {});
    await form(`/admin/products/${h}/unpublish`, { reason: "Testing" });

    const res = await form(`/admin/products/${h}/delete`, {});
    equal(res.status, 409);
    includes(res.text, "Archive it instead");
    ok(await repo.catalog.loadProduct(h), "the product survives the refusal");
  });

  test("deletes a draft that has never been live", async () => {
    const h = handle("delete-draft");
    await form("/admin/products", { handle: h, title: "Delete Draft", brandSlug: "solutionshocl" });

    const res = await form(`/admin/products/${h}/delete`, {});
    equal(res.status, 303);
    equal(await repo.catalog.loadProduct(h), null);
  });

  test("a draft with a stock count entered can still be deleted", async () => {
    // Trying the Dashboard out means creating a product and typing things into
    // it. Refusing to delete it afterwards left every experiment permanently in
    // the catalog, with archiving the only way out.
    const h = handle("delete-with-stock");
    await form("/admin/products", { handle: h, title: "Delete With Stock", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    const ref = (await repo.catalog.loadProduct(h))!.variants[0]!.ref;
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "7" });

    const res = await form(`/admin/products/${h}/delete`, {});
    equal(res.status, 303, "a never-published draft deletes even with a count on it");
    equal(await repo.catalog.loadProduct(h), null);

    // The count is not simply gone: what it was is in the trail.
    const [deleted] = await repo.audit.listAudit({ action: "product.deleted", limit: 1 });
    equal((deleted!.before as Record<string, unknown>)["stockMovements"], 1);
    ok((deleted!.before as Record<string, unknown>)["stockOnHand"], "the quantity is recorded before the row goes");
  });

  test("a product that has been published is still archived, never deleted", async () => {
    const h = handle("delete-after-publish");
    await form("/admin/products", { handle: h, title: "Was Live", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${h}/publish`, {});
    await form(`/admin/products/${h}/unpublish`, { reason: "Testing" });

    const res = await form(`/admin/products/${h}/delete`, {});
    equal(res.status, 409);
    includes(res.text, "Archive it instead");
    ok(await repo.catalog.loadProduct(h), "it survives");
  });

  test("the product list filters and paginates", async () => {
    const all = await get("/admin/products");
    equal(all.status, 200);

    const byBrand = await get("/admin/products?brand=life-ionizers&status=published");
    equal(byBrand.status, 200);
    ok(!byBrand.html.includes("/admin/products/toilet-bomb-organic-lemon"), "a SolutionsHOCL product is filtered out");

    const searched = await get("/admin/products?q=toilet%20bomb");
    includes(searched.html, "toilet-bomb-organic-lemon");

    const paged = await get("/admin/products?offset=25");
    includes(paged.html, "26–");
  });
});

/* ======================= the complete create-product flow ================ */

suite("complete create-product flow", () => {
  test("the create form offers every field the backend accepts at create time", async () => {
    const { html } = await get("/admin/products/new");
    for (const name of [
      "handle", "title", "cardTitle", "brandSlug", "categorySlug", "productType",
      "shortBenefit", "description", "seoTitle", "seoDescription", "tags", "subscription",
    ]) {
      ok(html.includes(`name="${name}"`), `the create form is missing ${name}`);
    }
  });

  test("create-time fields all persist from the form", async () => {
    const h = handle("create-all-fields");
    const res = await form("/admin/products", {
      handle: h,
      title: "Complete Creation",
      cardTitle: "Complete",
      brandSlug: "solutionshocl",
      categorySlug: "cleaning",
      productType: "Cleaner",
      shortBenefit: "One line of benefit.",
      description: "First paragraph.\n\nSecond paragraph.",
      seoTitle: "Complete Creation SEO",
      seoDescription: "A meta description for the complete product.",
      tags: "zeta, alpha",
      subscription: "true",
    });
    equal(res.status, 303);

    const p = await repo.catalog.loadProduct(h);
    equal(p!.title, "Complete Creation");
    equal(p!.cardTitle, "Complete");
    equal(p!.brandId, "solutionshocl");
    equal(p!.categoryId, "cleaning");
    equal(p!.productType, "Cleaner");
    equal(p!.shortBenefit, "One line of benefit.");
    deepEqual(p!.description, ["First paragraph.", "Second paragraph."]);
    equal(p!.seo.title, "Complete Creation SEO");
    equal(p!.seo.description, "A meta description for the complete product.");
    deepEqual(p!.sourceTags, ["zeta", "alpha"], "tag order as entered");
    equal(p!.subscription, true, "subscription eligibility persists");
  });

  test("subscription eligibility is editable and round-trips through the editor", async () => {
    const h = handle("create-subscription-edit");
    await form("/admin/products", {
      handle: h, title: "Sub Edit", brandSlug: "solutionshocl", subscription: "true",
    });
    equal((await repo.catalog.loadProduct(h))!.subscription, true);

    await form(`/admin/products/${h}`, {
      ...(await editorForm(h)), subscription: "false",
    });
    equal((await repo.catalog.loadProduct(h))!.subscription, false);
  });

  test("form to PostgreSQL to storefront, every field the schema supports", async () => {
    const h = handle("create-e2e");

    // 1. Create with every create-time field.
    await form("/admin/products", {
      handle: h, title: "End To End Widget", cardTitle: "E2E Widget",
      brandSlug: "solutionshocl", categorySlug: "cleaning", productType: "Cleaner",
      shortBenefit: "Cleans end to end.",
      description: "The whole flow in one product.",
      seoTitle: "E2E SEO", seoDescription: "E2E meta.",
      tags: "e2e-marker, cleaning", subscription: "true",
    });

    // 2. Variant carries price, SKU and weight; its ref is the public identity.
    await form(`/admin/products/${h}/variants`, {
      title: "500 g", price: "24.95", sku: "ZZ-E2E-500", weightGrams: "500",
    });
    const created = await repo.catalog.loadProduct(h);
    const ref = created!.variants[0]!.ref;
    equal(created!.variants[0]!.priceCents, 2495);
    equal(created!.variants[0]!.sku, "ZZ-E2E-500");
    equal(created!.variants[0]!.weightGrams, 500);

    // 3. Inventory: counted stock on the variant.
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "12" });
    equal((await repo.inventory.stockFor(ref))!.onHand, 12);

    // 4. Media, with required alt text.
    await form(`/admin/products/${h}/media`, { src: "/images/lotus.png", alt: "E2E product photo" });

    // 5. Curated into a collection.
    await form(`/admin/products/${h}/collections`, { collections: ["accessories"] });

    // 6. Publish — allowed because a priced variant now exists.
    const pub = await form(`/admin/products/${h}/publish`, {});
    equal(pub.status, 303);

    // PostgreSQL holds all of it.
    const p = await repo.catalog.loadProduct(h);
    equal(p!.publishable, true, "published");
    equal(p!.status, "active");
    equal(p!.needsReview, false, "clean copy has no review flags that gate it");
    deepEqual(p!.quarantinedContent, [], "compliance held nothing back");
    equal(p!.images[0]!.alt, "E2E product photo");
    ok(p!.collections.includes("accessories"));

    // The storefront renders it after a rebuild of the catalog.
    const catalog = await storefront();
    const rendered = catalog.products.find((x) => x.handle === h);
    ok(rendered, "the new product reaches the storefront");
    equal(rendered!.title, "End To End Widget");
    equal(rendered!.variants[0]!.price, 24.95, "cents become dollars at the display boundary only");
    equal(rendered!.variants[0]!.sku, "ZZ-E2E-500");
    equal(rendered!.images[0]!.src, "/images/lotus.png");
    ok(rendered!.searchTerms!.includes("e2e-marker"), "its tags are searchable");
    ok(
      catalog.collections.find((c) => c.handle === "accessories")!.productHandles.includes(h),
      "and the collection page lists it",
    );

    // Compliance still cannot be routed around from this flow: a banned name
    // in an edit withdraws it, exactly as on any other path.
    await form(`/admin/products/${h}`, { ...(await editorForm(h)), title: "End To End Fogger" });
    equal((await repo.catalog.loadProduct(h))!.publishable, false, "banned name withdraws it");
  });
});

/* ========================= editor round-trip fidelity ==================== */

suite("editor round-trip", () => {
  test("saving an unmodified editor changes nothing", async () => {
    // A published product that carries copy the screen held back — the case
    // where the form not carrying a field costs real data.
    const withHeld = (await repo.catalog.loadProducts({ publishable: true }))
      .find((p) => p.quarantinedContent.length > 0);
    ok(withHeld, "the seeded catalog has a product with held-back copy");

    // Saving recomputes this product's review flags, and the import left ~50
    // products with a `missing_image_alt` flag their media rows contradict
    // (the seeder derived alt text the CSV lacked). The recompute is correct,
    // but it would leave the database one flag away from catalog.json and
    // break the JSON-vs-PG parity check — so the seeded flags are put back
    // exactly as found. The contradiction itself is an import-data question,
    // not this test's to resolve.
    const flagRows = await rows<{ flag: string; resolved_at: string | null }>(
      `SELECT flag, resolved_at FROM product_flags pf
        JOIN products p ON p.id = pf.product_id WHERE p.handle = $1`,
      [withHeld!.handle],
    );

    const before = await repo.catalog.loadProduct(withHeld!.handle);
    const res = await form(`/admin/products/${withHeld!.handle}`, await editorForm(withHeld!.handle));
    equal(res.status, 303);

    const after = await repo.catalog.loadProduct(withHeld!.handle);
    equal(after!.quarantinedContent.length, before!.quarantinedContent.length,
      "held-back copy must survive a save that did not touch it");
    deepEqual(after!.description, before!.description);
    deepEqual(after!.sourceTags, before!.sourceTags);
    equal(after!.publishable, before!.publishable);
    equal(after!.seo.title, before!.seo.title);

    await rows(
      `DELETE FROM product_flags WHERE product_id = (SELECT id FROM products WHERE handle = $1)`,
      [withHeld!.handle],
    );
    for (const f of flagRows) {
      await rows(
        `INSERT INTO product_flags (product_id, flag, resolved_at)
         SELECT id, $2, $3 FROM products WHERE handle = $1 ON CONFLICT DO NOTHING`,
        [withHeld!.handle, f.flag, f.resolved_at],
      );
    }
  });

  test("held-back copy can be fixed through the editor", async () => {
    const h = handle("release-held-copy");
    await form("/admin/products", {
      handle: h, title: "Release Test", brandSlug: "solutionshocl",
      description: "A clean opening line.\n\nRegistered with the EPA and certified by NSF.",
    });

    let p = await repo.catalog.loadProduct(h);
    equal(p!.quarantinedContent.length, 1, "the offending block starts held back");
    equal(p!.description.length, 1);

    // Rewrite the wording in the held-back box, exactly as a person would.
    const fields = await editorForm(h);
    await form(`/admin/products/${h}`, {
      ...fields,
      heldBack: fields["heldBack"]!.replace("EPA", "the regulator").replace("NSF", "the standards body"),
    });

    p = await repo.catalog.loadProduct(h);
    equal(p!.quarantinedContent.length, 0, "fixing the wording releases the block");
    equal(p!.description.length, 2, "and it joins the published copy");
  });

  test("a field the request omits is left alone, not cleared", async () => {
    const h = handle("partial-post");
    await form("/admin/products", {
      handle: h, title: "Partial", brandSlug: "solutionshocl",
      shortBenefit: "Keep me.", description: "Keep this too.", tags: "alpha, beta",
    });
    const before = await repo.catalog.loadProduct(h);

    // A post carrying only the title. Everything else must survive.
    await form(`/admin/products/${h}`, { title: "Partial Renamed", brandSlug: "solutionshocl" });

    const after = await repo.catalog.loadProduct(h);
    equal(after!.title, "Partial Renamed");
    equal(after!.shortBenefit, before!.shortBenefit, "short benefit was not sent, so it must not change");
    deepEqual(after!.description, before!.description, "description was not sent");
    deepEqual(after!.sourceTags, before!.sourceTags, "tags were not sent");
  });

  test("a brand field the request omits is left alone", async () => {
    const slug = "zz-test-partial-brand";
    CREATED_BRANDS.push(slug);
    await form("/admin/brands", { slug, name: "Partial Brand", tagline: "Keep me." });
    await form(`/admin/brands/${slug}`, { name: "Partial Brand", story: "One.\n\nTwo." });
    const before = await repo.brands.getBrand(slug);

    await form(`/admin/brands/${slug}`, { name: "Partial Brand Renamed" });

    const after = await repo.brands.getBrand(slug);
    equal(after!.name, "Partial Brand Renamed");
    equal(after!.tagline, before!.tagline, "tagline was not sent");
    deepEqual(after!.story, before!.story, "story was not sent");
  });

  test("sending only the description keeps the held-back copy", async () => {
    const h = handle("partial-copy");
    await form("/admin/products", {
      handle: h, title: "Partial Copy", brandSlug: "solutionshocl",
      description: "A clean line.\n\nRegistered with the EPA.",
    });
    equal((await repo.catalog.loadProduct(h))!.quarantinedContent.length, 1);

    // Only the published half. The held-back half must not be read as empty.
    await form(`/admin/products/${h}`, {
      title: "Partial Copy", brandSlug: "solutionshocl", description: "A different clean line.",
    });

    const p = await repo.catalog.loadProduct(h);
    deepEqual(p!.description, ["A different clean line."]);
    equal(p!.quarantinedContent.length, 1, "held-back copy was not submitted, so it must survive");
  });

  test("an empty field that WAS sent does clear", async () => {
    const h = handle("explicit-clear");
    await form("/admin/products", {
      handle: h, title: "Clear Me", brandSlug: "solutionshocl", shortBenefit: "Temporary.",
    });
    await form(`/admin/products/${h}`, {
      title: "Clear Me", brandSlug: "solutionshocl", shortBenefit: "",
    });
    equal((await repo.catalog.loadProduct(h))!.shortBenefit, null,
      "sending an empty box means clear it; not sending it means leave it");
  });
});

/* =============================== variants ================================ */

suite("variants: create → edit → deactivate", () => {
  test("creates a variant with a stable public reference", async () => {
    const h = handle("variant-create");
    await form("/admin/products", { handle: h, title: "Variant Create", brandSlug: "solutionshocl" });
    const res = await form(`/admin/products/${h}/variants`, {
      title: "500 g", price: "24.95", sku: "ZZ-VAR-1", weightGrams: "500",
    });
    equal(res.status, 303);

    const p = await repo.catalog.loadProduct(h);
    equal(p!.variants.length, 1);
    equal(p!.variants[0]!.priceCents, 2495);
    equal(p!.variants[0]!.weightGrams, 500);
    ok(/^etv_[0-9a-f]{16}$/.test(p!.variants[0]!.ref));
  });

  test("edits a variant", async () => {
    const h = handle("variant-edit");
    await form("/admin/products", { handle: h, title: "Variant Edit", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Small", price: "10.00", sku: "ZZ-VAR-2" });

    const ref = (await repo.catalog.loadProduct(h))!.variants[0]!.ref;
    await form(`/admin/variants/${ref}`, {
      title: "Large", sku: "ZZ-VAR-2L", price: "18.00", weightGrams: "750",
    });

    const v = (await repo.catalog.loadProduct(h))!.variants[0]!;
    equal(v.title, "Large");
    equal(v.priceCents, 1800);
    equal(v.weightGrams, 750);
    equal(v.ref, ref, "the public reference does not change when the variant is edited");
  });

  test("prices are typed in dollars and stored as integer cents", async () => {
    const h = handle("variant-money");
    await form("/admin/products", { handle: h, title: "Variant Money", brandSlug: "solutionshocl" });

    // "19.99" is what a person types; 1999 is what the database keeps.
    await form(`/admin/products/${h}/variants`, { title: "x", price: "19.99" });
    equal((await repo.catalog.loadProduct(h))!.variants[0]!.priceCents, 1999);

    // Sub-cent fractions, negatives and word salad are refused, not rounded.
    for (const bad of ["19.999", "-1", "abc", "1,2,3"]) {
      const res = await form(`/admin/products/${h}/variants`, { title: "y", price: bad });
      equal(res.status, 422, `expected ${JSON.stringify(bad)} to be refused`);
      includes(res.text, "dollar amount");
    }
    equal((await repo.catalog.loadProduct(h))!.variants.length, 1, "only the valid price created a variant");
  });

  test("deactivates a variant, keeping the row", async () => {
    const h = handle("variant-deactivate");
    await form("/admin/products", { handle: h, title: "Variant Deactivate", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Keep", price: "5.00", sku: "ZZ-VAR-K" });
    await form(`/admin/products/${h}/variants`, { title: "Drop", price: "7.00", sku: "ZZ-VAR-D" });

    const before = (await repo.catalog.loadProduct(h))!.variants;
    const dropped = before.find((v) => v.title === "Drop")!;
    await form(`/admin/variants/${dropped.ref}/deactivate`, {});

    const after = (await repo.catalog.loadProduct(h))!.variants;
    equal(after.length, 1, "the storefront no longer offers it");
    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM product_variants WHERE ref = $1`, [dropped.ref],
    );
    equal(n, 1, "but the row is still resolvable");
  });
});

/* ================================= media ================================= */

suite("media: upload → database → product → storefront", () => {
  test("attaches an image and it reaches the storefront", async () => {
    const h = handle("media-flow");
    await form("/admin/products", { handle: h, title: "Media Flow", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${h}/media`, { src: "/images/zz-test-hero.jpg", alt: "A test hero image" });
    await form(`/admin/products/${h}/publish`, {});

    const p = (await storefront()).products.find((x) => x.handle === h);
    equal(p!.images.length, 1);
    equal(p!.images[0]!.src, "/images/zz-test-hero.jpg");
    equal(p!.images[0]!.alt, "A test hero image");
  });

  test("refuses an absolute URL, keeping media local", async () => {
    const h = handle("media-external");
    await form("/admin/products", { handle: h, title: "Media External", brandSlug: "solutionshocl" });

    const res = await form(`/admin/products/${h}/media`, {
      src: "https://cdn.shopify.com/thing.jpg", alt: "External",
    });
    equal(res.status, 422);
    includes(res.text, "absolute URL");
    equal((await repo.catalog.loadProduct(h))!.images.length, 0);
  });

  test("requires alt text", async () => {
    const h = handle("media-alt-required");
    await form("/admin/products", { handle: h, title: "Media Alt", brandSlug: "solutionshocl" });

    const res = await form(`/admin/products/${h}/media`, { src: "/images/zz-test-x.jpg", alt: "" });
    equal(res.status, 422);
    includes(res.text, "alt is required");
  });

  test("reorder → storefront", async () => {
    const h = handle("media-reorder");
    await form("/admin/products", { handle: h, title: "Media Reorder", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    for (const n of ["a", "b", "c"]) {
      await form(`/admin/products/${h}/media`, { src: `/images/zz-test-${n}.jpg`, alt: n.toUpperCase() });
    }
    await form(`/admin/products/${h}/publish`, {});

    deepEqual(
      (await storefront()).products.find((x) => x.handle === h)!.images.map((i) => i.alt),
      ["A", "B", "C"],
    );

    await form(`/admin/products/${h}/media/primary`, { src: "/images/zz-test-c.jpg" });
    deepEqual(
      (await storefront()).products.find((x) => x.handle === h)!.images.map((i) => i.alt),
      ["C", "A", "B"],
      "the new primary leads the gallery on the storefront",
    );

    await form(`/admin/products/${h}/media/move`, { src: "/images/zz-test-a.jpg", direction: "down" });
    deepEqual(
      (await storefront()).products.find((x) => x.handle === h)!.images.map((i) => i.alt),
      ["C", "B", "A"],
    );
  });

  test("edits alt text without duplicating the image", async () => {
    const h = handle("media-alt-edit");
    await form("/admin/products", { handle: h, title: "Media Alt Edit", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/media`, { src: "/images/zz-test-alt.jpg", alt: "First wording" });
    await form(`/admin/products/${h}/media/alt`, { src: "/images/zz-test-alt.jpg", alt: "Better wording" });

    const p = await repo.catalog.loadProduct(h);
    equal(p!.images.length, 1);
    equal(p!.images[0]!.alt, "Better wording");
  });

  test("removes an image", async () => {
    const h = handle("media-remove");
    await form("/admin/products", { handle: h, title: "Media Remove", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/media`, { src: "/images/zz-test-r1.jpg", alt: "One" });
    await form(`/admin/products/${h}/media`, { src: "/images/zz-test-r2.jpg", alt: "Two" });

    await form(`/admin/products/${h}/media/remove`, { src: "/images/zz-test-r1.jpg" });
    deepEqual((await repo.catalog.loadProduct(h))!.images.map((i) => i.alt), ["Two"]);
  });
});

/* ============================== collections ============================== */

suite("collections: create → assign → collection page", () => {
  test("creates a collection", async () => {
    const c = "zz-test-collection";
    CREATED_COLLECTIONS.push(c);
    const res = await form("/admin/collections", {
      handle: c, title: "Test Collection", description: "A described collection.", role: "editorial",
    });
    equal(res.status, 303);

    const created = await repo.collections.getCollection(c);
    ok(created);
    equal(created!.title, "Test Collection");
    equal(created!.isHidden, false, "a described collection is visible");
  });

  test("a collection with no description stays hidden", async () => {
    const c = "zz-test-undescribed";
    CREATED_COLLECTIONS.push(c);
    await form("/admin/collections", { handle: c, title: "Undescribed", role: "editorial" });

    equal((await repo.collections.getCollection(c))!.isHidden, true);
    const catalog = await storefront();
    const rendered = catalog.collections.find((x) => x.handle === c);
    ok(rendered?.hidden, "the storefront will not publish a page for it");
  });

  test("assign product → collection page", async () => {
    const c = "zz-test-assign";
    CREATED_COLLECTIONS.push(c);
    await form("/admin/collections", { handle: c, title: "Assign Target", description: "Has a description." });

    const h = handle("collection-member");
    await form("/admin/products", { handle: h, title: "Collection Member", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${h}/publish`, {});
    await form(`/admin/products/${h}/collections`, { collections: [c] });

    ok((await repo.collections.collectionMembers(c)).includes(h));
    const catalog = await storefront();
    const rendered = catalog.collections.find((x) => x.handle === c);
    ok(rendered!.productHandles.includes(h), "the collection page lists it");
  });

  test("remove product → collection page", async () => {
    const c = "zz-test-remove";
    CREATED_COLLECTIONS.push(c);
    await form("/admin/collections", { handle: c, title: "Remove Target", description: "Has a description." });

    const h = handle("collection-removed");
    await form("/admin/products", { handle: h, title: "Collection Removed", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${h}/publish`, {});
    await form(`/admin/products/${h}/collections`, { collections: [c] });
    ok((await storefront()).collections.find((x) => x.handle === c)!.productHandles.includes(h));

    await form(`/admin/products/${h}/collections`, { collections: [] });
    ok(
      !(await storefront()).collections.find((x) => x.handle === c)!.productHandles.includes(h),
      "it is gone from the collection page",
    );
  });

  test("sets curated order from the collection side", async () => {
    const c = "zz-test-order";
    CREATED_COLLECTIONS.push(c);
    await form("/admin/collections", { handle: c, title: "Order Target", description: "Has a description." });

    const a = handle("order-a");
    const b = handle("order-b");
    for (const [h, title] of [[a, "Order A"], [b, "Order B"]] as const) {
      await form("/admin/products", { handle: h, title, brandSlug: "solutionshocl" });
      await form(`/admin/products/${h}/variants`, { title: "Default", price: "5.00" });
      await form(`/admin/products/${h}/publish`, {});
    }

    await form(`/admin/collections/${c}/products`, { order: `${b}\n${a}` });
    deepEqual(await repo.collections.collectionMembers(c), [b, a], "curated order is respected");
  });

  test("edits collection copy and it reaches the storefront", async () => {
    const c = "zz-test-copy";
    CREATED_COLLECTIONS.push(c);
    await form("/admin/collections", { handle: c, title: "Copy Target", description: "Initial." });

    await form(`/admin/collections/${c}`, {
      title: "Copy Target", description: "Updated description.",
      heroTitle: "A hero line", editorial: "First paragraph.\n\nSecond paragraph.",
      role: "editorial", isHidden: "false",
    });

    const rendered = (await storefront()).collections.find((x) => x.handle === c);
    equal(rendered!.description, "Updated description.");
    equal(rendered!.heroTitle, "A hero line");
    deepEqual(rendered!.editorial, ["First paragraph.", "Second paragraph."]);
  });
});

/* ================================= brands ================================ */

suite("brands: create/edit → storefront", () => {
  test("creates a brand", async () => {
    const slug = "zz-test-brand";
    CREATED_BRANDS.push(slug);
    const res = await form("/admin/brands", { slug, name: "Test Brand", tagline: "A tagline." });
    equal(res.status, 303);

    const brand = await repo.brands.getBrand(slug);
    equal(brand!.name, "Test Brand");
    equal(brand!.tagline, "A tagline.");
  });

  test("edits a brand and it reaches the storefront", async () => {
    const slug = "zz-test-brand-edit";
    CREATED_BRANDS.push(slug);
    await form("/admin/brands", { slug, name: "Before" });

    await form(`/admin/brands/${slug}`, {
      name: "After", tagline: "Edited tagline.", summary: "Edited summary.",
      story: "Story one.\n\nStory two.", seoTitle: "SEO title", seoDescription: "SEO description",
    });

    const brand = await repo.brands.getBrand(slug);
    equal(brand!.name, "After");
    deepEqual(brand!.story, ["Story one.", "Story two."]);
    equal(brand!.seoTitle, "SEO title");

    const rendered = (await storefront()).brands.find((b) => b.id === slug);
    ok(rendered, "the brand reaches the storefront catalog");
    equal(rendered!.tagline, "Edited tagline.");
    deepEqual(rendered!.story, ["Story one.", "Story two."]);
  });

  test("refuses an absolute URL for a brand image", async () => {
    const slug = "zz-test-brand-image";
    CREATED_BRANDS.push(slug);
    await form("/admin/brands", { slug, name: "Image Brand" });

    const res = await form(`/admin/brands/${slug}/image`, {
      kind: "logo", intent: "set", src: "https://example.com/logo.png", logoAlt: "Logo",
    });
    equal(res.status, 422);
    includes(res.text, "absolute URL");
  });

  test("sets and clears a brand logo", async () => {
    const slug = "zz-test-brand-logo";
    CREATED_BRANDS.push(slug);
    await form("/admin/brands", { slug, name: "Logo Brand" });

    await form(`/admin/brands/${slug}/image`, {
      kind: "logo", intent: "set", src: "/images/zz-test-logo.png", logoAlt: "The logo",
    });
    equal((await repo.brands.getBrand(slug))!.logo!.src, "/images/zz-test-logo.png");

    await form(`/admin/brands/${slug}/image`, { kind: "logo", intent: "clear" });
    equal((await repo.brands.getBrand(slug))!.logo, null);
  });
});

/* =============================== compliance ============================== */

suite("compliance: the Dashboard cannot route around it", () => {
  test("invalid content → flagged", async () => {
    const h = handle("compliance-flagged");
    await form("/admin/products", {
      handle: h, title: "Ordinary Name", brandSlug: "solutionshocl",
      description: "A clean sentence.\n\nKills 99.9% of bacteria on contact.",
    });

    const p = await repo.catalog.loadProduct(h);
    deepEqual(p!.description, ["A clean sentence."], "only the clean block is published");
    equal(p!.quarantinedContent.length, 1, "the failing block is kept and flagged");
    ok(p!.flags.includes("content_quarantined"));
  });

  test("flagged product → publication blocked", async () => {
    const h = handle("compliance-blocked");
    await form("/admin/products", { handle: h, title: "Atomizer", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });

    const res = await form(`/admin/products/${h}/publish`, {});
    equal(res.status, 409);
    includes(res.text, "cannot be published");
    equal((await repo.catalog.loadProduct(h))!.publishable, false);
    ok(!(await storefront()).products.some((p) => p.handle === h));
  });

  test("approved content → publishable", async () => {
    const h = handle("compliance-clean");
    await form("/admin/products", {
      handle: h, title: "Plain Cleaner", brandSlug: "solutionshocl",
      description: "An ordinary description with nothing to screen.",
    });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });

    const res = await form(`/admin/products/${h}/publish`, {});
    equal(res.status, 303);
    ok((await storefront()).products.some((p) => p.handle === h));
  });

  test("editing a live product into a banned name withdraws it immediately", async () => {
    const h = handle("compliance-withdraw");
    await form("/admin/products", { handle: h, title: "Ordinary Spray", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });
    await form(`/admin/products/${h}/publish`, {});
    ok((await storefront()).products.some((p) => p.handle === h));

    await form(`/admin/products/${h}`, { title: "Ordinary Fogger", brandSlug: "solutionshocl" });

    equal((await repo.catalog.loadProduct(h))!.publishable, false);
    ok(!(await storefront()).products.some((p) => p.handle === h), "it leaves the storefront at once");
  });

  test("the screen preview renders in place, not through the URL", async () => {
    // A realistic body used to be echoed back in a query string, producing an
    // 11 KB URL. It is rendered directly now.
    const body = "This is a perfectly ordinary sentence about cleaning. ".repeat(200);
    const res = await form("/admin/compliance/screen", {
      brandSlug: "solutionshocl", title: "Ordinary", text: body,
    });
    equal(res.status, 200, "the result is a page, not a redirect");
    equal(res.location, "", "and nothing travels in a URL");
  });

  test("the screen preview writes nothing", async () => {
    const [before] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM products`);
    const res = await form("/admin/compliance/screen", {
      brandSlug: "solutionshocl", title: "Fogger", text: "Kills germs.",
    });
    equal(res.status, 200);

    const [after] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM products`);
    equal(after!.n, before!.n);
  });

  test("no Dashboard route can publish something the screen refused", async () => {
    const h = handle("compliance-no-backdoor");
    await form("/admin/products", { handle: h, title: "Fogger Deluxe", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });

    // Every route that touches publication, tried in turn.
    for (const path of [`/admin/products/${h}/publish`, `/admin/products/${h}/unarchive`]) {
      await form(path, {});
    }
    // And an update that does not change the name.
    await form(`/admin/products/${h}`, { title: "Fogger Deluxe", brandSlug: "solutionshocl" });

    equal((await repo.catalog.loadProduct(h))!.publishable, false, "still not publishable");
  });
});

/* =============================== inventory =============================== */

suite("inventory: unknown, zero and a number are three different things", () => {
  async function variantFor(name: string): Promise<string> {
    const h = handle(name);
    await form("/admin/products", { handle: h, title: `Stock ${name}`, brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });
    return (await repo.catalog.loadProduct(h))!.variants[0]!.ref;
  }

  test("unknown → remains unknown", async () => {
    const ref = await variantFor("stock-unknown");
    const stock = await repo.inventory.stockFor(ref);
    equal(stock!.state, "unknown");
    equal(stock!.onHand, null, "unknown is the absence of a number, not zero");

    const [{ n }] = await rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM inventory_levels l
         JOIN product_variants v ON v.id = l.variant_id WHERE v.ref = $1`, [ref],
    );
    equal(n, 0, "and the absence of a row");
  });

  test("unknown → quantity", async () => {
    const ref = await variantFor("stock-count");
    const res = await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "12" });
    equal(res.status, 303);

    const stock = await repo.inventory.stockFor(ref);
    equal(stock!.state, "positive");
    equal(stock!.onHand, 12);
  });

  test("quantity → zero", async () => {
    const ref = await variantFor("stock-to-zero");
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "5" });
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "0" });

    const stock = await repo.inventory.stockFor(ref);
    equal(stock!.state, "zero", "counted and none is not the same as uncounted");
    equal(stock!.onHand, 0);
  });

  test("zero → quantity", async () => {
    const ref = await variantFor("stock-from-zero");
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "0" });
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "9" });

    equal((await repo.inventory.stockFor(ref))!.onHand, 9);
  });

  test("uncounting returns to unknown rather than setting zero", async () => {
    const ref = await variantFor("stock-uncount");
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "4" });
    equal((await repo.inventory.stockFor(ref))!.state, "positive");

    await form(`/admin/variants/${ref}/stock`, { intent: "clear" });
    const stock = await repo.inventory.stockFor(ref);
    equal(stock!.state, "unknown");
    equal(stock!.onHand, null);
  });

  test("an empty field with Set pressed is refused, not read as uncount", async () => {
    const ref = await variantFor("stock-empty");
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "3" });

    const res = await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "" });
    equal(res.status, 422);
    equal((await repo.inventory.stockFor(ref))!.onHand, 3, "the count is untouched");
  });

  test("records a movement when a count changes", async () => {
    const ref = await variantFor("stock-movements");
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "10" });
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "7" });

    const movements = await repo.inventory.movementsFor(ref);
    deepEqual(movements.map((m) => m.delta), [-3, 10], "newest first");
  });

  test("the storefront reads availability from stock", async () => {
    const h = handle("stock-storefront");
    await form("/admin/products", { handle: h, title: "Stock Storefront", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });
    await form(`/admin/products/${h}/publish`, {});
    const ref = (await repo.catalog.loadProduct(h))!.variants[0]!.ref;

    // Uncounted: the storefront does not claim it is unavailable.
    equal((await storefront()).products.find((p) => p.handle === h)!.variants[0]!.available, true);

    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "0" });
    equal(
      (await storefront()).products.find((p) => p.handle === h)!.variants[0]!.available,
      false,
      "counted at zero, it is unavailable",
    );

    await form(`/admin/variants/${ref}/stock`, { intent: "clear" });
    equal(
      (await storefront()).products.find((p) => p.handle === h)!.variants[0]!.available,
      true,
      "back to uncounted, it stops claiming to be out of stock",
    );
  });
});

/* ================================= audit ================================= */

suite("audit: every mutation leaves a record", () => {
  test("creating, editing and publishing each record an entry", async () => {
    const h = handle("audit-lifecycle");
    await form("/admin/products", { handle: h, title: "Audit Lifecycle", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });
    await form(`/admin/products/${h}`, { title: "Audit Renamed", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/publish`, {});
    await form(`/admin/products/${h}/unpublish`, { reason: "Testing" });
    await form(`/admin/products/${h}/archive`, {});

    const actions = (await auditFor()).map((a) => a.action);
    for (const expected of [
      "product.created", "variant.created", "product.updated",
      "product.published", "product.unpublished", "product.archived",
    ]) {
      ok(actions.includes(expected), `expected an audit row for ${expected}`);
    }
  });

  test("records what changed, not just that something did", async () => {
    const h = handle("audit-diff");
    await form("/admin/products", { handle: h, title: "Audit Diff", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}`, { title: "Audit Diff Renamed", brandSlug: "solutionshocl" });

    const [update] = await auditFor("product.updated");
    ok(update, "an update was recorded");
    equal((update!.before as Record<string, unknown>)["title"], "Audit Diff");
    equal((update!.after as Record<string, unknown>)["title"], "Audit Diff Renamed");
  });

  test("names the actor", async () => {
    const h = handle("audit-actor");
    await form("/admin/products", { handle: h, title: "Audit Actor", brandSlug: "solutionshocl" });

    const entries = await auditFor("product.created");
    ok(entries.length > 0);
    includes(entries[0]!.actor, "zz-test-suite");
    includes(entries[0]!.actor, "dashboard");
  });

  test("an update that changed nothing writes no row", async () => {
    const h = handle("audit-noop");
    await form("/admin/products", { handle: h, title: "Audit Noop", brandSlug: "solutionshocl" });
    const before = (await auditFor("product.updated")).length;

    await form(`/admin/products/${h}`, { title: "Audit Noop", brandSlug: "solutionshocl" });
    equal((await auditFor("product.updated")).length, before, "no event, no row");
  });

  test("a refused change writes nothing at all", async () => {
    const h = handle("audit-rollback");
    await form("/admin/products", { handle: h, title: "Audit Rollback", brandSlug: "solutionshocl" });
    const before = (await repo.audit.listAudit({ limit: 500 })).length;

    const res = await form(`/admin/products/${h}/variants`, { title: "x", price: "not a number" });
    equal(res.status, 422);

    equal((await repo.audit.listAudit({ limit: 500 })).length, before, "the trail records only what happened");
  });

  test("variant, media, collection and inventory changes are all recorded", async () => {
    const h = handle("audit-coverage");
    await form("/admin/products", { handle: h, title: "Audit Coverage", brandSlug: "solutionshocl" });
    await form(`/admin/products/${h}/variants`, { title: "Default", price: "10.00" });
    const ref = (await repo.catalog.loadProduct(h))!.variants[0]!.ref;

    await form(`/admin/variants/${ref}`, { title: "Default", price: "15.00" });
    await form(`/admin/products/${h}/media`, { src: "/images/zz-test-audit.jpg", alt: "Audit" });
    await form(`/admin/products/${h}/media/remove`, { src: "/images/zz-test-audit.jpg" });
    await form(`/admin/products/${h}/collections`, { collections: ["accessories"] });
    await form(`/admin/variants/${ref}/stock`, { intent: "set", onHand: "3" });
    await form(`/admin/variants/${ref}/deactivate`, {});

    const actions = new Set((await auditFor()).map((a) => a.action));
    for (const expected of [
      "variant.price_changed", "media.attached", "media.removed",
      "product.collections_changed", "inventory.counted", "variant.deactivated",
    ]) {
      ok(actions.has(expected), `expected an audit row for ${expected}`);
    }
  });

  test("brand and collection changes are recorded", async () => {
    const slug = "zz-test-audit-brand";
    CREATED_BRANDS.push(slug);
    await form("/admin/brands", { slug, name: "Audit Brand" });
    await form(`/admin/brands/${slug}`, { name: "Audit Brand Renamed" });

    const c = "zz-test-audit-collection";
    CREATED_COLLECTIONS.push(c);
    await form("/admin/collections", { handle: c, title: "Audit Collection", description: "Described." });
    await form(`/admin/collections/${c}`, { title: "Audit Collection Renamed", description: "Described." });

    const actions = new Set((await auditFor()).map((a) => a.action));
    for (const expected of ["brand.created", "brand.updated", "collection.created", "collection.updated"]) {
      ok(actions.has(expected), `expected an audit row for ${expected}`);
    }
  });

  test("the audit page shows the trail", async () => {
    const { status, html } = await get("/admin/audit");
    equal(status, 200);
    includes(html, "product.created");
  });
});

/* ============================ broken curation ============================ */

suite("broken curation", () => {
  test("the 61 unresolved references are recorded, not lost", async () => {
    const summary = await repo.curation.gapSummary();
    ok(summary.open >= 61, `expected at least 61 open gaps, found ${summary.open}`);

    const { status, html } = await get("/admin/curation");
    equal(status, 200);
    includes(html, "no longer resolve");
  });

  test("nothing picks a replacement automatically", async () => {
    const [gap] = await repo.curation.listGaps({ open: true });
    ok(gap, "there is a gap to test with");

    const res = await form(`/admin/curation/${gap!.id}/resolve`, { kind: "mapped", productHandle: "" });
    equal(res.status, 422);
    includes(res.text, "Nothing is chosen for you");

    equal((await repo.curation.getGap(gap!.id))!.resolvedAt, null, "the gap is untouched");
  });

  test("mapping puts the chosen product in the collection", async () => {
    const gaps = await repo.curation.listGaps({ open: true, sourceHandle: "accessories" });
    ok(gaps.length > 0, "accessories has an unresolved reference");
    const gap = gaps[0]!;

    const replacement = handle("curation-replacement");
    await form("/admin/products", { handle: replacement, title: "Curation Replacement", brandSlug: "solutionshocl" });
    await form(`/admin/products/${replacement}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${replacement}/publish`, {});

    const res = await form(`/admin/curation/${gap.id}/resolve`, {
      kind: "mapped", productHandle: replacement,
    });
    equal(res.status, 303);

    const settled = await repo.curation.getGap(gap.id);
    equal(settled!.resolution, "mapped");
    equal(settled!.mappedToHandle, replacement);
    ok(
      (await repo.collections.collectionMembers("accessories")).includes(replacement),
      "the replacement now appears in the collection",
    );

    // Put it back so the count the next run sees is the same.
    await form(`/admin/curation/${gap.id}/reopen`, {});
    await form(`/admin/products/${replacement}/collections`, { collections: [] });
  });

  test("removing settles a reference without touching the catalog", async () => {
    const gaps = await repo.curation.listGaps({ open: true, sourceHandle: "wellness" });
    ok(gaps.length > 0);
    const gap = gaps[0]!;

    const before = await repo.collections.collectionMembers("wellness");
    await form(`/admin/curation/${gap.id}/resolve`, { kind: "removed" });

    equal((await repo.curation.getGap(gap.id))!.resolution, "removed");
    deepEqual(await repo.collections.collectionMembers("wellness"), before, "membership is unchanged");

    await form(`/admin/curation/${gap.id}/reopen`, {});
  });

  test("reopening a mapped gap withdraws the curation it added", async () => {
    const gaps = await repo.curation.listGaps({ open: true, sourceHandle: "best-sellers" });
    ok(gaps.length > 0);
    const gap = gaps[0]!;

    const replacement = handle("reopen-replacement");
    await form("/admin/products", { handle: replacement, title: "Reopen", brandSlug: "solutionshocl" });
    await form(`/admin/products/${replacement}/variants`, { title: "Default", price: "5.00" });
    await form(`/admin/products/${replacement}/publish`, {});

    await form(`/admin/curation/${gap.id}/resolve`, { kind: "mapped", productHandle: replacement });
    ok((await repo.collections.collectionMembers("best-sellers")).includes(replacement));

    await form(`/admin/curation/${gap.id}/reopen`, {});
    ok(
      !(await repo.collections.collectionMembers("best-sellers")).includes(replacement),
      "an outstanding gap must not leave its former replacement on the storefront",
    );
  });

  test("mapping onto a product already curated there is refused", async () => {
    const gaps = await repo.curation.listGaps({ open: true, sourceHandle: "solutionshocl" });
    ok(gaps.length > 0);
    const gap = gaps[0]!;

    // Already curated into this collection, at a position somebody chose.
    const already = "toilet-bomb-organic-lemon";
    const before = await repo.collections.collectionMembers("solutionshocl");

    const res = await form(`/admin/curation/${gap.id}/resolve`, {
      kind: "mapped", productHandle: already,
    });
    equal(res.status, 409);
    includes(res.text, "already curated into");
    includes(res.text, "Remove this reference instead");

    deepEqual(await repo.collections.collectionMembers("solutionshocl"), before,
      "the refusal changed nothing");
    equal((await repo.curation.getGap(gap.id))!.resolvedAt, null, "and the gap is still open");
  });

  test("reopening restores a tag-derived member to where it was", async () => {
    const gaps = await repo.curation.listGaps({ open: true, sourceHandle: "water-filtration" });
    ok(gaps.length > 0, "water-filtration has an unresolved reference");
    const gap = gaps[0]!;

    // A product in this collection through its tags but not curated into it.
    const membership = await repo.collections.collectionMembership("water-filtration");
    const derivedOnly = membership.find((m) => m.isDerived && !m.isCurated);
    ok(derivedOnly, "and a member that is there through its own tags alone");

    const before = await repo.collections.collectionMembers("water-filtration");
    await form(`/admin/curation/${gap.id}/resolve`, {
      kind: "mapped", productHandle: derivedOnly!.handle,
    });
    await form(`/admin/curation/${gap.id}/reopen`, {});

    const after = await repo.collections.collectionMembers("water-filtration");
    ok(after.includes(derivedOnly!.handle), "tag-derived membership is not this gap's to take away");
    deepEqual(after, before, "and the order it had is restored");
  });

  test("refuses a replacement that does not exist", async () => {
    const [gap] = await repo.curation.listGaps({ open: true });
    const res = await form(`/admin/curation/${gap!.id}/resolve`, {
      kind: "mapped", productHandle: "zz-test-does-not-exist",
    });
    equal(res.status, 422);
    includes(res.text, "No product with handle");
  });
});

/* ================================ security =============================== */

suite("security", () => {
  test("refuses to bind anywhere but loopback", async () => {
    await rejects(
      async () => createApi({ router: buildRouter(), host: "0.0.0.0" }),
      "Refusing to bind",
    );
  });

  test("validates on the server, whatever the form says", async () => {
    const h = handle("security-validation");
    await form("/admin/products", { handle: h, title: "Security", brandSlug: "solutionshocl" });

    // A form can post anything. The server decides.
    for (const [fields, expected] of [
      [{ title: "x", price: "-1" }, "dollar amount"],
      [{ title: "x", price: "10.00", weightGrams: "0" }, "positive integer"],
      [{ title: "", price: "10.00" }, "required"],
    ] as const) {
      const res = await form(`/admin/products/${h}/variants`, fields as Record<string, string>);
      equal(res.status, 422, `expected ${JSON.stringify(fields)} to be refused`);
      includes(res.text, expected);
    }
  });

  test("a handle cannot escape its path segment", async () => {
    const { status } = await get("/admin/products/..%2F..%2Fetc%2Fpasswd");
    equal(status, 404);
  });

  test("sets headers that limit what a pasted payload could do", async () => {
    const res = await fetch(`${baseUrl}/admin`, { headers: { accept: "text/html" } });
    equal(res.headers.get("x-frame-options"), "DENY");
    equal(res.headers.get("x-content-type-options"), "nosniff");
    equal(res.headers.get("cache-control"), "no-store");
  });
});

/* ===================== dashboard ergonomics (phase 11) =================== */

suite("dashboard ergonomics", () => {
  test("a browser hitting a wrong admin URL gets a page, not raw JSON", async () => {
    const { status, html: doc } = await get("/admin/no-such-screen");
    equal(status, 404);
    includes(doc, "EarthTrade Admin");
    ok(!doc.trimStart().startsWith("{"), "the body must be a page, not a JSON blob");
  });

  test("deleting asks first, on its own page", async () => {
    const h = handle("delete-confirm");
    await form("/admin/products", { handle: h, title: "Delete Confirm", brandSlug: "solutionshocl" });

    const { status, html: doc } = await get(`/admin/products/${h}/delete`);
    equal(status, 200);
    includes(doc, "Delete permanently");
    includes(doc, "no undo");

    // The confirm page is a question; the product is still there.
    ok(await repo.catalog.loadProduct(h), "viewing the confirmation deletes nothing");

    await form(`/admin/products/${h}/delete`, {});
    equal(await repo.catalog.loadProduct(h), null, "the POST behind the button still deletes");
  });

  test("inventory can be searched by product name", async () => {
    const { html: doc } = await get("/admin/inventory?q=borosilicate");
    includes(doc, "Borosilicate Glass Pitcher");
    ok(!doc.includes("Catchment Bomb"), "non-matching products are filtered out");
  });

  test("a curation suggestion can pre-fill the replacement box", async () => {
    const [gap] = await repo.curation.listGaps({ open: true });
    ok(gap, "the seeded catalog has open curation gaps");
    const { html: doc } = await get(
      `/admin/curation?gap=${gap!.id}&fill=zz-prefilled-handle`,
    );
    includes(doc, 'value="zz-prefilled-handle"');
  });

  test("collection membership is edited with checkboxes, not ctrl-click", async () => {
    const h = handle("checkbox-collections");
    await form("/admin/products", { handle: h, title: "Checkbox Collections", brandSlug: "solutionshocl" });
    const { html: doc } = await get(`/admin/products/${h}`);
    includes(doc, 'type="checkbox" name="collections"');
    ok(!/<select[^>]*name="collections"/.test(doc), "the old multi-select is gone");
  });
});

/* ==================== product photos on the admin origin ================= */

suite("images: the Dashboard serves its own product photos, read-only", () => {
  test("a real product photo comes back with its image type", async () => {
    const res = await fetch(`${baseUrl}/images/3stagesfiltersystem.png`);
    equal(res.status, 200);
    equal(res.headers.get("content-type"), "image/png");
    ok((await res.arrayBuffer()).byteLength > 1000, "expected actual image bytes");
  });

  test("nothing outside public/images is reachable", async () => {
    for (const path of [
      "/images/..%2F..%2Fpackage.json",
      "/images/%2e%2e%2fdb%2fseed.ts",
      "/images/x.ts",
      "/images/no-such-file.png",
    ]) {
      const res = await fetch(`${baseUrl}${path}`);
      equal(res.status, 404, `expected 404 for ${path}`);
    }
  });

  test("the route is GET-only", async () => {
    const res = await fetch(`${baseUrl}/images/3stagesfiltersystem.png`, { method: "POST" });
    equal(res.status, 405);
  });
});

/* ======================= the imported catalog is intact ================== */

suite("imported catalog untouched", () => {
  test("still 110 products, 106 published, 4 withheld", async () => {
    const counts = await repo.products.publicationCounts();
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

  test("prices are unchanged", async () => {
    const [row] = await rows<{ sum: number }>(
      `SELECT coalesce(sum(price_cents), 0)::int AS sum FROM product_variants`,
    );
    equal(row!.sum, IMPORTED_PRICE_SUM);
  });

  test("no inventory was invented", async () => {
    const [row] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM inventory_levels`);
    equal(row!.n, 0, "no imported variant was quietly given a stock figure");
  });

  test("the curation gaps are back where they started", async () => {
    const summary = await repo.curation.gapSummary();
    equal(summary.open, 61);
    equal(summary.resolved, 0);
  });

  test("no test data left behind", async () => {
    for (const [label, sql] of [
      ["products", `SELECT count(*)::int AS n FROM products WHERE handle LIKE 'zz-test-%'`],
      ["brands", `SELECT count(*)::int AS n FROM brands WHERE slug LIKE 'zz-test-%'`],
      ["collections", `SELECT count(*)::int AS n FROM collections WHERE handle LIKE 'zz-test-%'`],
    ] as const) {
      const [{ n }] = await rows<{ n: number }>(sql);
      equal(n, 0, `${label} left behind`);
    }
  });
});

/* --------------------------------- run ----------------------------------- */

const [{ sum: IMPORTED_PRICE_SUM }] = await rows<{ sum: number }>(
  `SELECT coalesce(sum(price_cents), 0)::int AS sum FROM product_variants`,
);

api = createApi({ router: buildRouter(), port: 0, onRequest: () => {}, errorPage: adminErrorPage });
const port = await api.listen();
baseUrl = `http://127.0.0.1:${port}`;

const UNTOUCHED = "imported catalog untouched";

// A few tests call the write layer directly rather than through a form; this
// keeps their audit rows identifiable too.
await asActor({ name: "zz-admin-tests", via: "test" }, () =>
  run("EarthTrade Admin Dashboard", (s) => s !== UNTOUCHED),
);

await cleanup();
const result = await run("Imported catalog", (s) => s === UNTOUCHED);

await api.close();
await close();

process.exit(result.failed.length ? 1 : 0);
