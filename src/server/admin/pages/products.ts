/** The product list and the product editor. */

import { html, join, raw, type SafeHtml } from "../../../lib/html.ts";
import { field, money, page, pill, select, stockLabel, textarea, timestamp, type PageOptions } from "../layout.ts";
import type { Counts } from "./overview.ts";
import * as repo from "../../repositories/index.ts";
import type { ProductRecord } from "../../repositories/types.ts";

const PAGE_SIZE = 25;

/* ------------------------------- the list -------------------------------- */

export async function productsPage(
  query: URLSearchParams,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string> {
  const search = query.get("q")?.trim() ?? "";
  const brand = query.get("brand") ?? "";
  const category = query.get("category") ?? "";
  const status = query.get("status") ?? "";
  const stock = query.get("stock") ?? "";
  const offset = Math.max(Number(query.get("offset") ?? 0) || 0, 0);

  const filter: repo.products.ProductFilter = {};
  if (brand) filter.brandSlug = brand;
  if (category) filter.categorySlug = category;
  if (status === "published") filter.publishable = true;
  if (status === "withheld") filter.publishable = false;
  if (search) filter.handles = await repo.search.searchProducts(search, 500);

  const [all, brands, categories] = await Promise.all([
    repo.catalog.loadProducts(filter),
    repo.brands.listBrands(),
    repo.brands.listCategories(),
  ]);

  // Status and stock are filtered here rather than in SQL because both are
  // derived: "archived" is a status the row carries, but "draft" means
  // unpublished and not archived, and stock state is the absence of a row.
  let matched = all;
  if (status === "draft") matched = matched.filter((p) => p.status === "draft");
  if (status === "archived") matched = matched.filter((p) => p.status === "archived");
  if (status === "review") matched = matched.filter((p) => p.needsReview);

  const stockByRef = await repo.inventory.stockByVariantRefs(
    matched.flatMap((p) => p.variants.map((v) => v.ref)),
  );
  const stateOf = (p: ProductRecord): string => {
    const states = p.variants.map((v) => stockByRef.get(v.ref)?.state ?? "unknown");
    if (!states.length) return "none";
    if (states.every((s) => s === "unknown")) return "unknown";
    if (states.some((s) => s === "positive")) return "positive";
    return "zero";
  };
  if (stock) matched = matched.filter((p) => stateOf(p) === stock);

  const shown = matched.slice(offset, offset + PAGE_SIZE);

  const keep = (extra: Record<string, string>): string => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (brand) params.set("brand", brand);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (stock) params.set("stock", stock);
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };

  const body = html`
    <form class="toolbar" method="get" action="/admin/products">
      <div class="field grow">
        <label for="f-q">Search</label>
        <input id="f-q" type="search" name="q" value="${search}" placeholder="Name, benefit, type, brand or tag">
      </div>
      ${select("brand", "Brand", brand, brands.map((b) => ({ value: b.slug, label: b.name })), { blank: "Any" })}
      ${select("category", "Category", category, categories.map((c) => ({ value: c.slug, label: c.name })), { blank: "Any" })}
      ${select("status", "Status", status, [
        { value: "published", label: "Published" },
        { value: "withheld", label: "Withheld" },
        { value: "draft", label: "Draft" },
        { value: "archived", label: "Archived" },
        { value: "review", label: "Needs review" },
      ], { blank: "Any" })}
      ${select("stock", "Stock", stock, [
        { value: "unknown", label: "Not counted" },
        { value: "zero", label: "None in stock" },
        { value: "positive", label: "In stock" },
        { value: "none", label: "No variants" },
      ], { blank: "Any" })}
      <div class="actions actions--inline">
        <button type="submit">Filter</button>
        <a class="btn btn--ghost" href="/admin/products">Clear</a>
      </div>
    </form>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Product</th>
            <th>Brand</th>
            <th>Status</th>
            <th>Stock</th>
            <th class="num">Price</th>
            <th>Collections</th>
          </tr>
        </thead>
        <tbody>
          ${shown.length
            ? join(shown.map((p) => productRow(p, stateOf(p))))
            : html`<tr><td colspan="7"><p class="empty">
                No products match these filters. <a href="/admin/products">Clear filters</a>
              </p></td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span>
        ${String(matched.length ? offset + 1 : 0)}–${String(Math.min(offset + PAGE_SIZE, matched.length))}
        of ${String(matched.length)}${matched.length !== all.length ? html` (filtered from ${String(all.length)})` : ""}
      </span>
      <span class="actions actions--inline">
        ${offset > 0
          ? html`<a class="btn btn--ghost btn--sm" href="${keep({ offset: String(Math.max(offset - PAGE_SIZE, 0)) })}">Previous</a>`
          : ""}
        ${offset + PAGE_SIZE < matched.length
          ? html`<a class="btn btn--ghost btn--sm" href="${keep({ offset: String(offset + PAGE_SIZE) })}">Next</a>`
          : ""}
      </span>
    </div>
  `;

  return page(
    {
      title: "Products",
      section: "products",
      flash,
      counts,
      actions: html`<a class="btn" href="/admin/products/new">New product</a>`,
    },
    body,
  );
}

function productRow(p: ProductRecord, stockState: string): SafeHtml {
  const price = p.variants.length
    ? money(Math.min(...p.variants.map((v) => v.priceCents)))
    : "—";

  return html`
    <tr>
      <td>
        ${p.images[0]
          ? html`<img class="thumb" src="${p.images[0].src}" alt="">`
          : html`<span class="thumb" aria-hidden="true"></span>`}
      </td>
      <td>
        <a href="/admin/products/${p.handle}">${p.cardTitle ?? p.title}</a>
        <span class="sub handle">${p.handle}</span>
      </td>
      <td>${p.brandId}<span class="sub">${p.categoryId ?? "no category"}</span></td>
      <td>
        ${p.publishable ? pill("published", "ok") : pill(p.status === "archived" ? "archived" : "withheld", p.status === "archived" ? "muted" : "danger")}
        ${p.needsReview ? pill("review", "warn") : ""}
        ${p.titleMatches.length ? pill("banned name", "danger") : ""}
        ${p.quarantinedContent.length ? pill(`${p.quarantinedContent.length} held`, "warn") : ""}
      </td>
      <td>${stockState === "none" ? pill("no variants", "danger") : stockLabel(stockState, null)}</td>
      <td class="num">${price}${p.priceProvisional ? html`<span class="sub">provisional</span>` : ""}</td>
      <td>${p.collections.length ? p.collections.join(", ") : html`<span class="u-muted">—</span>`}</td>
    </tr>
  `;
}

/* ------------------------------ the editor ------------------------------- */

export async function productEditorPage(
  handle: string,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string | null> {
  const product = await repo.catalog.loadProduct(handle);
  if (!product) return null;

  const [brands, categories, collections, stock, history] = await Promise.all([
    repo.brands.listBrands(),
    repo.brands.listCategories(),
    repo.collections.listCollections(),
    repo.inventory.stockByVariantRefs(product.variants.map((v) => v.ref)),
    repo.audit.productHistory(handle, 15),
  ]);

  const curated = new Set(product.collections);

  const body = html`
    ${product.titleMatches.length
      ? html`
          <div class="notice notice--danger">
            <p>
              <strong>This product cannot be published.</strong> Its name states a claim
              that may not appear on the storefront:
              ${join(product.titleMatches.map((m) => html`<code>${m.term}</code> (${m.reason})`), )}.
            </p>
            <p>Rename it, and the block clears by itself.</p>
          </div>
        `
      : ""}

    <div class="grid grid--2">
      <section class="card">
        <h2>Details</h2>
        <form method="post" action="/admin/products/${product.handle}">
          ${field("title", "Title", product.title, { required: true })}
          ${field("cardTitle", "Card title", product.cardTitle, {
            hint: "Shown on product cards where the full title is too long. Optional.",
          })}
          <div class="field">
            <label>Handle</label>
            <input type="text" value="${product.handle}" disabled>
            <span class="hint">The URL this product lives at. Changing it would break every link to it.</span>
          </div>
          <div class="row">
            ${select("brandSlug", "Brand", product.brandId, brands.map((b) => ({ value: b.slug, label: b.name })))}
            ${select("categorySlug", "Category", product.categoryId, categories.map((c) => ({ value: c.slug, label: c.name })), { blank: "None" })}
          </div>
          ${field("productType", "Product type", product.productType)}
          ${field("shortBenefit", "Short benefit", product.shortBenefit, {
            hint: "One line, shown on cards. Left empty it renders as nothing, never as filler.",
          })}
          ${textarea("description", "Description", product.description.join("\n\n"), {
            hint: "One paragraph per blank line. Screened on save; anything that fails moves to the box below.",
            rows: 10,
          })}
          ${textarea(
            "heldBack",
            `Held back by the screen${product.quarantinedContent.length ? ` (${product.quarantinedContent.length})` : ""}`,
            product.quarantinedContent.map((b) => b.text).join("\n\n"),
            {
              hint:
                "Copy that did not pass compliance. It is stored but never rendered. Edit the wording " +
                "here and save: anything that now passes moves up into the description. Released blocks " +
                "join the end of it — where they originally sat was not recorded at import.",
              rows: product.quarantinedContent.length ? 8 : 3,
            },
          )}
          ${product.quarantinedContent.length
            ? html`<div class="notice notice--warn">
                <p>What the screen objected to, block by block:</p>
                ${join(
                  product.quarantinedContent.map(
                    (b) => html`<p>
                      <span class="u-muted">${b.text.slice(0, 90)}${b.text.length > 90 ? "…" : ""}</span><br>
                      ${join(b.matches.map((m) => html`<code>${m.term}</code> — ${m.reason}. `))}
                    </p>`,
                  ),
                )}
              </div>`
            : ""}
          ${field("seoTitle", "SEO title", product.seo.title)}
          ${textarea("seoDescription", "Meta description", product.seo.description, { rows: 3 })}
          ${field("tags", "Tags", product.sourceTags.join(", "), {
            hint: "Comma separated. Tags feed search and derive collection membership.",
          })}
          ${select("subscription", "Subscribe & Save", product.subscription ? "true" : "false", [
            { value: "false", label: "Not eligible" },
            { value: "true", label: "Eligible" },
          ], { hint: "Whether Auto-Ship is offered for this product." })}
          <div class="actions">
            <button type="submit">Save changes</button>
            <a class="btn btn--ghost" href="/products/${product.handle}">View on storefront</a>
          </div>
        </form>
      </section>

      <div>
        <section class="card">
          <h2>Publication</h2>
          <dl class="meta">
            <dt>Storefront</dt>
            <dd>${product.publishable ? pill("published", "ok") : pill("not published", "danger")}</dd>
            <dt>Status</dt>
            <dd>${product.status}</dd>
            ${product.withheldReason ? html`<dt>Reason</dt><dd>${product.withheldReason}</dd>` : ""}
            <dt>Review</dt>
            <dd>${product.needsReview ? pill("needs review", "warn") : pill("clear", "ok")}</dd>
          </dl>

          <div class="actions">
            ${product.publishable
              ? html`
                  <form method="post" action="/admin/products/${product.handle}/unpublish" class="row">
                    <input
                      name="reason"
                      placeholder="Why is it coming down?"
                      aria-label="Reason for unpublishing"
                      required
                    >
                    <span class="actions actions--inline">
                      <button class="ghost" type="submit">Unpublish</button>
                    </span>
                  </form>
                `
              : html`
                  <form method="post" action="/admin/products/${product.handle}/publish">
                    <button type="submit">Publish</button>
                  </form>
                `}
            ${product.status === "archived"
              ? html`<form method="post" action="/admin/products/${product.handle}/unarchive">
                  <button class="ghost" type="submit">Unarchive</button>
                </form>`
              : html`<form method="post" action="/admin/products/${product.handle}/archive">
                  <button class="ghost" type="submit">Archive</button>
                </form>`}
            ${!product.publishable && product.status !== "archived"
              ? html`<a class="btn btn--danger" href="/admin/products/${product.handle}/delete">Delete&hellip;</a>`
              : ""}
          </div>
          ${product.status === "archived" || product.publishable
            ? html`<p class="u-muted u-mt">
                Deleting is only offered for a product that has never been published.
                Anything that has been live is archived instead, so every link to it stays resolvable.
              </p>`
            : ""}
        </section>

        <section class="card u-mt">
          <h2>Compliance</h2>
          ${product.quarantinedContent.length
            ? html`
                <p>
                  ${String(product.quarantinedContent.length)} block(s) of copy are held back.
                  They are stored, not deleted, and do not render.
                </p>
                <p class="u-muted">
                  Edit them in <strong>Held back by the screen</strong>, to the left. Removing the
                  offending phrasing releases a block on the next save. Nothing here can override
                  the screen.
                </p>
              `
            : html`<p class="u-muted">Nothing held back.</p>`}
          ${product.flags.length
            ? html`<p class="u-mt">${join(product.flags.map((f) => pill(f.replaceAll("_", " "), "warn")))}</p>`
            : ""}
        </section>

        <section class="card u-mt">
          <h2>Collections</h2>
          <form method="post" action="/admin/products/${product.handle}/collections">
            <fieldset class="checks">
              <legend>Curated into</legend>
              ${join(
                collections.map(
                  (c) => html`<label class="check">
                    <input type="checkbox" name="collections" value="${c.handle}"
                           ${raw(curated.has(c.handle) ? "checked" : "")}>
                    <span>${c.title}</span>
                  </label>`,
                ),
              )}
            </fieldset>
            <span class="hint">
              Curated products lead a collection. Membership the product's own tags
              give it is separate and is not changed here.
            </span>
            <div class="actions"><button type="submit">Save collections</button></div>
          </form>
        </section>
      </div>
    </div>

    ${variantsSection(product, stock)}
    ${mediaSection(product)}

    <section class="card">
      <h2>History</h2>
      ${history.length
        ? html`
            <div class="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Action</th><th>Change</th><th>Actor</th></tr></thead>
                <tbody>
                  ${join(
                    history.map(
                      (a) => html`
                        <tr>
                          <td class="u-nowrap mono">${timestamp(a.createdAt)}</td>
                          <td><code>${a.action}</code></td>
                          <td>${changeSummary(a.before, a.after)}</td>
                          <td class="u-muted">${a.actor}</td>
                        </tr>
                      `,
                    ),
                  )}
                </tbody>
              </table>
            </div>
          `
        : html`<p class="u-muted">Nothing recorded for this product yet.</p>`}
    </section>
  `;

  return page(
    {
      title: product.title,
      section: "products",
      breadcrumb: [{ label: "Products", href: "/admin/products" }, { label: product.handle }],
      flash,
      counts,
    },
    body,
  );
}

/** Cents for storage, dollars for people. */
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** A labelled control inside a per-variant form — no ids, so rows can repeat. */
function vfield(label: string, control: SafeHtml): SafeHtml {
  return html`<label class="vfield"><span>${label}</span>${control}</label>`;
}

function variantsSection(
  product: ProductRecord,
  stock: Map<string, repo.inventory.StockRecord>,
): SafeHtml {
  return html`
    <section class="card">
      <h2>Variants</h2>
      ${product.variants.length
        ? html`<div class="variants">
            ${join(
              product.variants.map((v) => {
                const s = stock.get(v.ref);
                return html`
                  <div class="variant">
                    <form method="post" action="/admin/variants/${v.ref}" class="variant__form">
                      ${vfield("Title", html`<input name="title" value="${v.title}" required>`)}
                      ${vfield("SKU", html`<input name="sku" value="${v.sku ?? ""}" placeholder="—">`)}
                      ${vfield("Price (USD)", html`<input name="price" inputmode="decimal" value="${centsToDollars(v.priceCents)}" required>`)}
                      ${vfield("Compare-at (USD)", html`<input name="compareAt" inputmode="decimal"
                        value="${v.compareAtCents === null ? "" : centsToDollars(v.compareAtCents)}" placeholder="—">`)}
                      ${vfield("Weight (g)", html`<input name="weightGrams" type="number" min="1" step="1"
                        value="${v.weightGrams === null ? "" : String(v.weightGrams)}" placeholder="—">`)}
                      <button class="sm" type="submit">Save</button>
                    </form>
                    <div class="variant__meta">
                      <span>
                        ${stockLabel(s?.state ?? "unknown", s?.onHand ?? null)}
                        <span class="sub">${money(v.priceCents, v.currency)}</span>
                        <span class="sub mono">${v.ref}</span>
                      </span>
                      <form method="post" action="/admin/variants/${v.ref}/stock" class="actions actions--inline">
                        <input name="onHand" type="number" min="0" step="1"
                               value="${s?.onHand === null || s?.onHand === undefined ? "" : String(s.onHand)}"
                               placeholder="not counted" aria-label="Units on hand"
                               class="stock-input">
                        <button class="ghost sm" type="submit" name="intent" value="set">Set stock</button>
                        <button class="ghost sm" type="submit" name="intent" value="clear">Uncount</button>
                      </form>
                      <form method="post" action="/admin/variants/${v.ref}/deactivate"
                            class="actions actions--inline"
                            onsubmit="return confirm('Deactivate ${v.title}? The row stays so carts keep working.')">
                        <button class="danger sm" type="submit">Deactivate</button>
                      </form>
                    </div>
                  </div>
                `;
              }),
            )}
          </div>`
        : html`<p class="empty">
            No variants. A product needs at least one priced variant before it can be published.
          </p>`}

      <form method="post" action="/admin/products/${product.handle}/variants" class="u-mt">
        <h2>Add a variant</h2>
        <div class="row">
          ${field("title", "Title", "", { required: true, placeholder: "500 g" })}
          ${field("sku", "SKU", "")}
          ${field("price", "Price (USD)", "", { required: true, hint: "Dollars — 19.99" })}
          ${field("weightGrams", "Weight in grams", "", { type: "number" })}
        </div>
        <div class="actions"><button type="submit">Add variant</button></div>
      </form>
    </section>
  `;
}

function mediaSection(product: ProductRecord): SafeHtml {
  return html`
    <section class="card">
      <h2>Media</h2>
      ${product.images.length
        ? html`
            <div class="media-grid">
              ${join(
                product.images.map(
                  (img, i) => html`
                    <div class="media-item">
                      <img src="${img.src}" alt="${img.alt}">
                      ${i === 0 ? html`<span class="primary">Primary</span>` : ""}
                      <p class="sub mono">${img.src}</p>
                      <form method="post" action="/admin/products/${product.handle}/media/alt">
                        <input type="hidden" name="src" value="${img.src}">
                        <input name="alt" value="${img.alt}" aria-label="Alt text for ${img.src}">
                        <div class="actions">
                          <button class="ghost sm" type="submit">Save alt</button>
                        </div>
                      </form>
                      <div class="actions">
                        ${i > 0
                          ? html`<form method="post" action="/admin/products/${product.handle}/media/primary">
                              <input type="hidden" name="src" value="${img.src}">
                              <button class="ghost sm" type="submit">Make primary</button>
                            </form>`
                          : ""}
                        ${i > 0
                          ? html`<form method="post" action="/admin/products/${product.handle}/media/move">
                              <input type="hidden" name="src" value="${img.src}">
                              <input type="hidden" name="direction" value="up">
                              <button class="ghost sm" type="submit" aria-label="Move ${img.src} earlier">↑</button>
                            </form>`
                          : ""}
                        ${i < product.images.length - 1
                          ? html`<form method="post" action="/admin/products/${product.handle}/media/move">
                              <input type="hidden" name="src" value="${img.src}">
                              <input type="hidden" name="direction" value="down">
                              <button class="ghost sm" type="submit" aria-label="Move ${img.src} later">↓</button>
                            </form>`
                          : ""}
                        <form method="post" action="/admin/products/${product.handle}/media/remove"
                              onsubmit="return confirm('Remove this image from the product?')">
                          <input type="hidden" name="src" value="${img.src}">
                          <button class="danger sm" type="submit">Remove</button>
                        </form>
                      </div>
                    </div>
                  `,
                ),
              )}
            </div>
          `
        : html`<p class="u-muted">No images. The storefront renders a typographic tile rather than a stand-in photo.</p>`}

      ${product.pendingImages.length
        ? html`
            <div class="notice notice--warn u-mt">
              <p><strong>Referenced but not supplied.</strong> The catalog names ${String(product.pendingImages.length)} image(s) that have no file:</p>
              ${join(product.pendingImages.map((p) => html`<p class="mono">${p.path}</p>`))}
            </div>
          `
        : ""}

      <form method="post" action="/admin/products/${product.handle}/media" class="u-mt">
        <h2>Add an image</h2>
        <div class="row">
          ${field("src", "Path", "", {
            required: true,
            placeholder: "/images/thing.jpg",
            hint: "A path this site serves. Absolute URLs are refused — media stays local.",
          })}
          ${field("alt", "Alt text", "", {
            required: true,
            hint: "Describe the picture. Required: an image without it is unusable to a screen reader.",
          })}
        </div>
        <div class="actions"><button type="submit">Attach image</button></div>
      </form>
    </section>
  `;
}

function changeSummary(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): SafeHtml {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (!keys.length) return html`<span class="u-muted">—</span>`;

  const short = (v: unknown): string => {
    const s = v === null || v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  };

  return html`<p class="diff">${join(
    keys.slice(0, 6).map(
      (k) => html`${k}: <span class="was">${short(before?.[k])}</span> → <span class="now">${short(after?.[k])}</span>\n`,
    ),
  )}${keys.length > 6 ? html`…and ${String(keys.length - 6)} more` : ""}</p>`;
}

/* ------------------------------- new product ----------------------------- */

export async function newProductPage(flash: PageOptions["flash"], counts: Counts): Promise<string> {
  const [brands, categories] = await Promise.all([repo.brands.listBrands(), repo.brands.listCategories()]);

  const body = html`
    <section class="card" style="max-width:760px">
      <h2>New product</h2>
      <p class="u-muted">
        A new product starts as a draft, unpublished, with only what you supply.
        Nothing is filled in for you — no price, no SKU, no placeholder copy.
      </p>
      <p class="u-muted">
        Price, SKU, weight, images, stock and collections are added on the product
        page you land on after creating — each of those attaches to the product,
        so the product has to exist first. Publishing is a separate step once a
        priced variant exists.
      </p>
      <form method="post" action="/admin/products" class="u-mt">
        ${field("handle", "Handle", "", {
          required: true,
          hint: "Lowercase letters, digits and hyphens. This becomes the URL and cannot be changed later.",
        })}
        ${field("title", "Title", "", { required: true })}
        ${field("cardTitle", "Card title", "", {
          hint: "Shown on product cards where the full title is too long. Optional.",
        })}
        <div class="row">
          ${select("brandSlug", "Brand", "", brands.map((b) => ({ value: b.slug, label: b.name })))}
          ${select("categorySlug", "Category", "", categories.map((c) => ({ value: c.slug, label: c.name })), { blank: "None" })}
        </div>
        ${field("productType", "Product type", "")}
        ${field("shortBenefit", "Short benefit", "")}
        ${textarea("description", "Description", "", {
          hint: "One paragraph per blank line. Screened on save; anything that fails is held back, not published.",
        })}
        ${field("seoTitle", "SEO title", "")}
        ${textarea("seoDescription", "Meta description", "", { rows: 3 })}
        ${field("tags", "Tags", "", {
          hint: "Comma separated. Tags feed search and derive collection membership.",
        })}
        ${select("subscription", "Subscribe & Save", "false", [
          { value: "false", label: "Not eligible" },
          { value: "true", label: "Eligible" },
        ], { hint: "Whether Auto-Ship is offered for this product." })}
        <div class="actions"><button type="submit">Create product</button></div>
      </form>
    </section>
  `;

  return page(
    {
      title: "New product",
      section: "products",
      breadcrumb: [{ label: "Products", href: "/admin/products" }, { label: "New" }],
      flash,
      counts,
    },
    body,
  );
}
