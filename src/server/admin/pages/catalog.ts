/** Brands, collections, inventory and the audit trail. */

import { html, join, raw, type SafeHtml } from "../../../lib/html.ts";
import { field, money, page, pill, select, stockLabel, textarea, timestamp, type PageOptions } from "../layout.ts";
import type { Counts } from "./overview.ts";
import * as repo from "../../repositories/index.ts";

/* -------------------------------- brands --------------------------------- */

export async function brandsPage(flash: PageOptions["flash"], counts: Counts): Promise<string> {
  const [brands, collections, productCounts] = await Promise.all([
    repo.brands.listBrands(),
    repo.collections.listCollections(),
    repo.brands.brandProductCounts(),
  ]);

  const body = html`
    <div class="table-wrap">
      <table>
        <thead><tr><th>Brand</th><th>Tagline</th><th class="num">Published</th><th>Collection</th><th></th></tr></thead>
        <tbody>
          ${join(
            brands.map(
              (b) => html`
                <tr>
                  <td><a href="/admin/brands/${b.slug}">${b.name}</a><span class="sub handle">${b.slug}</span></td>
                  <td>${b.tagline ?? html`<span class="u-muted">—</span>`}</td>
                  <td class="num">${String(productCounts.get(b.slug) ?? 0)}</td>
                  <td>${b.collectionHandle ?? html`<span class="u-muted">—</span>`}</td>
                  <td class="u-right"><a class="btn btn--ghost btn--sm" href="/admin/brands/${b.slug}">Edit</a></td>
                </tr>
              `,
            ),
          )}
        </tbody>
      </table>
    </div>

    <section class="card">
      <h2>New brand</h2>
      <form method="post" action="/admin/brands">
        <div class="row">
          ${field("slug", "Slug", "", { required: true, hint: "Lowercase, hyphenated. Becomes the brand's URL." })}
          ${field("name", "Name", "", { required: true })}
        </div>
        ${field("tagline", "Tagline", "")}
        ${select("collectionHandle", "Collection", "", collections.map((c) => ({ value: c.handle, label: c.title })), {
          blank: "None",
          hint: "Where the brand page sends people. A brand without one simply does not offer the link.",
        })}
        <div class="actions"><button type="submit">Create brand</button></div>
      </form>
    </section>
  `;

  return page({ title: "Brands", section: "brands", flash, counts }, body);
}

export async function brandEditorPage(
  slug: string,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string | null> {
  const brand = await repo.brands.getBrand(slug);
  if (!brand) return null;

  const [collections, products] = await Promise.all([
    repo.collections.listCollections(),
    repo.products.listProductRows({ brandSlug: slug }),
  ]);

  const body = html`
    <div class="grid grid--2">
      <section class="card">
        <h2>Details</h2>
        <form method="post" action="/admin/brands/${brand.slug}">
          ${field("name", "Name", brand.name, { required: true })}
          ${field("tagline", "Tagline", brand.tagline)}
          ${textarea("summary", "Summary", brand.summary, { rows: 3 })}
          ${textarea("story", "Story", brand.story.join("\n\n"), {
            hint: "One paragraph per blank line.",
            rows: 10,
          })}
          <div class="row">
            ${select("theme", "Theme", brand.theme, [
              { value: "light", label: "light" }, { value: "dark", label: "dark" },
              { value: "volcanic", label: "volcanic" }, { value: "bright", label: "bright" },
              { value: "clean", label: "clean" },
            ], { blank: "None" })}
            ${select("collectionHandle", "Collection", brand.collectionHandle,
              collections.map((c) => ({ value: c.handle, label: c.title })), { blank: "None" })}
          </div>
          ${field("seoTitle", "SEO title", brand.seoTitle ?? null)}
          ${textarea("seoDescription", "Meta description", brand.seoDescription ?? null, { rows: 3 })}
          <div class="actions">
            <button type="submit">Save brand</button>
            <a class="btn btn--ghost" href="/brands/${brand.slug}">View on storefront</a>
          </div>
        </form>
      </section>

      <div>
        <section class="card">
          <h2>Images</h2>
          ${brandImageForm(brand.slug, "logo", brand.logo)}
          ${brandImageForm(brand.slug, "hero", brand.image)}
        </section>

        <section class="card u-mt">
          <h2>Products</h2>
          <p class="u-muted">
            ${String(products.length)} product(s) carry this brand. A product's brand is
            set on the product itself, so it can only ever have one.
          </p>
          <div class="table-wrap u-mt">
            <table>
              <thead><tr><th>Product</th><th>Status</th></tr></thead>
              <tbody>
                ${products.length
                  ? join(
                      products.slice(0, 40).map(
                        (p) => html`
                          <tr>
                            <td><a href="/admin/products/${p.handle}">${p.title}</a></td>
                            <td>${p.publishable ? pill("published", "ok") : pill("withheld", "danger")}</td>
                          </tr>
                        `,
                      ),
                    )
                  : html`<tr><td colspan="2"><p class="empty">No products yet.</p></td></tr>`}
              </tbody>
            </table>
          </div>
          ${products.length > 40 ? html`<p class="u-muted u-mt">Showing the first 40.</p>` : ""}
        </section>
      </div>
    </div>
  `;

  return page(
    {
      title: brand.name,
      section: "brands",
      breadcrumb: [{ label: "Brands", href: "/admin/brands" }, { label: brand.slug }],
      flash,
      counts,
    },
    body,
  );
}

function brandImageForm(
  slug: string,
  kind: "logo" | "hero",
  current: { src: string; alt: string } | null,
): SafeHtml {
  return html`
    <form method="post" action="/admin/brands/${slug}/image">
      <input type="hidden" name="kind" value="${kind}">
      <div class="field">
        <label for="f-${kind}-src">${kind === "logo" ? "Logo" : "Hero image"}</label>
        ${current ? html`<img class="thumb thumb--lg" src="${current.src}" alt="${current.alt}">` : ""}
        <input id="f-${kind}-src" name="src" value="${current?.src ?? ""}" placeholder="/images/brand.png">
        <span class="hint">A path this site serves. Absolute URLs are refused.</span>
      </div>
      ${field(`${kind}Alt`, "Alt text", current?.alt ?? "")}
      <div class="actions">
        <button class="ghost sm" type="submit" name="intent" value="set">Save ${kind}</button>
        ${current
          ? html`<button class="danger sm" type="submit" name="intent" value="clear">Remove</button>`
          : ""}
      </div>
    </form>
  `;
}

/* ------------------------------ collections ------------------------------ */

export async function collectionsPage(flash: PageOptions["flash"], counts: Counts): Promise<string> {
  const collections = await repo.collections.listCollections();
  const members = await repo.collections.allCollectionMembers();

  const body = html`
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Collection</th><th>Role</th><th class="num">Products</th><th>Storefront</th><th></th></tr>
        </thead>
        <tbody>
          ${join(
            collections.map(
              (c) => html`
                <tr>
                  <td>
                    <a href="/admin/collections/${c.handle}">${c.title}</a>
                    <span class="sub handle">${c.handle}</span>
                  </td>
                  <td>${pill(c.role, c.role === "category" ? "ok" : "muted")}</td>
                  <td class="num">${String((members.get(c.handle) ?? []).length)}</td>
                  <td>
                    ${c.isHidden ? pill("hidden", "muted") : pill("visible", "ok")}
                    ${!c.description ? pill("no description", "warn") : ""}
                  </td>
                  <td class="u-right"><a class="btn btn--ghost btn--sm" href="/admin/collections/${c.handle}">Edit</a></td>
                </tr>
              `,
            ),
          )}
        </tbody>
      </table>
    </div>

    <section class="card">
      <h2>New collection</h2>
      <form method="post" action="/admin/collections">
        <div class="row">
          ${field("handle", "Handle", "", { required: true })}
          ${field("title", "Title", "", { required: true })}
        </div>
        ${textarea("description", "Description", "", {
          rows: 3,
          hint: "A collection with no description stays hidden — an empty page is not something anyone decided to publish.",
        })}
        ${select("role", "Role", "editorial", [
          { value: "category", label: "Category" },
          { value: "brand", label: "Brand" },
          { value: "editorial", label: "Editorial / merchandising" },
        ])}
        <div class="actions"><button type="submit">Create collection</button></div>
      </form>
    </section>
  `;

  return page({ title: "Collections", section: "collections", flash, counts }, body);
}

export async function collectionEditorPage(
  handle: string,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string | null> {
  const collection = await repo.collections.getCollection(handle);
  if (!collection) return null;

  const [memberRows, allProducts, gaps] = await Promise.all([
    repo.collections.collectionMembership(handle),
    repo.products.listProductRows({ publishable: true }),
    repo.curation.listGaps({ open: true, sourceHandle: handle }),
  ]);

  const curated = memberRows.filter((m) => m.isCurated);

  const body = html`
    ${gaps.length
      ? html`<div class="notice notice--warn">
          <p>
            ${String(gaps.length)} curated reference(s) in this collection name a product the
            catalog does not have. <a href="/admin/curation?source=${collection.handle}">Review them</a>.
          </p>
        </div>`
      : ""}

    <div class="grid grid--2">
      <section class="card">
        <h2>Details</h2>
        <form method="post" action="/admin/collections/${collection.handle}">
          ${field("title", "Title", collection.title, { required: true })}
          ${field("heroTitle", "Hero title", collection.heroTitle)}
          ${field("eyebrow", "Eyebrow", collection.eyebrow)}
          ${textarea("description", "Description", collection.description, { rows: 3 })}
          ${textarea("editorial", "Editorial", collection.editorial.join("\n\n"), {
            hint: "One paragraph per blank line. Shown under the product grid.",
            rows: 8,
          })}
          <div class="row">
            ${select("role", "Role", collection.role, [
              { value: "category", label: "Category" },
              { value: "brand", label: "Brand" },
              { value: "editorial", label: "Editorial" },
            ])}
            ${select("theme", "Theme", collection.theme, [
              { value: "light", label: "light" }, { value: "dark", label: "dark" },
              { value: "volcanic", label: "volcanic" }, { value: "bright", label: "bright" },
              { value: "clean", label: "clean" },
            ], { blank: "None" })}
            ${select("isHidden", "Storefront", collection.isHidden ? "true" : "false", [
              { value: "false", label: "Visible" },
              { value: "true", label: "Hidden" },
            ])}
          </div>
          ${field("seoTitle", "SEO title", collection.seo.title)}
          ${textarea("seoDescription", "Meta description", collection.seo.description, { rows: 3 })}
          <div class="actions">
            <button type="submit">Save collection</button>
            ${!collection.isHidden
              ? html`<a class="btn btn--ghost" href="/collections/${collection.handle}">View on storefront</a>`
              : ""}
          </div>
        </form>
      </section>

      <section class="card">
        <h2>Products</h2>
        <p class="u-muted">
          Curated products lead the collection, in the order below. Products their own
          tags put here follow, and are not editable from this list.
        </p>

        <form method="post" action="/admin/collections/${collection.handle}/products" class="u-mt">
          <div class="field">
            <label for="f-order">Curated order</label>
            <textarea id="f-order" name="order" rows="8">${curated.map((m) => m.handle).join("\n")}</textarea>
            <span class="hint">One product handle per line, in the order they should appear.</span>
          </div>
          <div class="actions"><button type="submit">Save order</button></div>
        </form>

        <div class="table-wrap u-mt">
          <table>
            <thead><tr><th>Product</th><th>Why it is here</th></tr></thead>
            <tbody>
              ${memberRows.length
                ? join(
                    memberRows.map(
                      (m) => html`
                        <tr>
                          <td><a href="/admin/products/${m.handle}">${m.title}</a></td>
                          <td>
                            ${m.isCurated ? pill("curated", "ok") : ""}
                            ${m.isDerived ? pill("from tags", "muted") : ""}
                          </td>
                        </tr>
                      `,
                    ),
                  )
                : html`<tr><td colspan="2"><p class="empty">Nothing in this collection yet.</p></td></tr>`}
            </tbody>
          </table>
        </div>

        <details class="u-mt">
          <summary>Published product handles</summary>
          <p class="mono u-muted" style="max-height:12rem;overflow:auto">
            ${allProducts.map((p) => p.handle).join(", ")}
          </p>
        </details>
      </section>
    </div>
  `;

  return page(
    {
      title: collection.title,
      section: "collections",
      breadcrumb: [{ label: "Collections", href: "/admin/collections" }, { label: collection.handle }],
      flash,
      counts,
    },
    body,
  );
}

/* ------------------------------- inventory ------------------------------- */

export async function inventoryPage(
  query: URLSearchParams,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string> {
  const state = query.get("state") ?? "";
  const [summary, levels, locations] = await Promise.all([
    repo.inventory.stockSummary(),
    repo.inventory.listStock({
      ...(state ? { state: state as repo.inventory.StockState } : {}),
      limit: 300,
    }),
    repo.inventory.listLocations(),
  ]);

  const body = html`
    <div class="notice">
      <p>
        <strong>Stock has three states, and only two of them are numbers.</strong>
        A variant nobody has counted is not a variant with none in stock — the first
        means the catalog does not know, the second means it does. Clearing a count
        returns a variant to <em>not counted</em>; it does not set it to zero.
      </p>
    </div>

    <div class="grid grid--stats">
      <div class="card"><span class="stat"><span class="n">${String(summary.total)}</span><span class="label">active variants</span></span></div>
      <div class="card"><span class="stat" data-tone="warn"><span class="n">${String(summary.unknown)}</span><span class="label">not counted</span></span></div>
      <div class="card"><span class="stat"><span class="n">${String(summary.zero)}</span><span class="label">none in stock</span></span></div>
      <div class="card"><span class="stat"><span class="n">${String(summary.positive)}</span><span class="label">in stock</span></span></div>
    </div>

    <form class="toolbar" method="get" action="/admin/inventory">
      ${select("state", "State", state, [
        { value: "unknown", label: "Not counted" },
        { value: "zero", label: "None in stock" },
        { value: "positive", label: "In stock" },
      ], { blank: "All" })}
      <div class="actions actions--inline"><button type="submit">Filter</button></div>
    </form>

    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Product</th><th>Variant</th><th>SKU</th><th>State</th><th class="num">On hand</th><th>Set</th></tr>
        </thead>
        <tbody>
          ${levels.length
            ? join(
                levels.map(
                  (l) => html`
                    <tr>
                      <td><a href="/admin/products/${l.productHandle}">${l.productTitle}</a></td>
                      <td>${l.variantTitle}<span class="sub mono">${l.variantRef}</span></td>
                      <td>${l.sku ?? html`<span class="u-muted">—</span>`}</td>
                      <td>${stockLabel(l.state, l.onHand)}</td>
                      <td class="num">${l.onHand === null ? html`<span class="u-muted">—</span>` : String(l.onHand)}</td>
                      <td>
                        <form method="post" action="/admin/variants/${l.variantRef}/stock" class="actions actions--inline">
                          <input type="hidden" name="return" value="/admin/inventory${state ? `?state=${state}` : ""}">
                          <input name="onHand" type="number" min="0" step="1"
                                 value="${l.onHand === null ? "" : String(l.onHand)}"
                                 placeholder="not counted" aria-label="Units on hand for ${l.variantRef}"
                                 style="max-width:7rem">
                          <button class="ghost sm" type="submit" name="intent" value="set">Set</button>
                          ${l.state !== "unknown"
                            ? html`<button class="ghost sm" type="submit" name="intent" value="clear">Uncount</button>`
                            : ""}
                        </form>
                      </td>
                    </tr>
                  `,
                ),
              )
            : html`<tr><td colspan="6"><p class="empty">Nothing matches.</p></td></tr>`}
        </tbody>
      </table>
    </div>
    <p class="u-muted">
      Location: ${locations.map((l) => l.name).join(", ") || "none configured"}.
      ${levels.length >= 300 ? "Showing the first 300 variants." : ""}
    </p>
  `;

  return page({ title: "Inventory", section: "inventory", flash, counts }, body);
}

/* --------------------------------- audit --------------------------------- */

export async function auditPage(
  query: URLSearchParams,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string> {
  const actor = query.get("actor") ?? "";
  const action = query.get("action") ?? "";
  const entityType = query.get("entity") ?? "";
  const offset = Math.max(Number(query.get("offset") ?? 0) || 0, 0);
  const limit = 50;

  const filter = {
    ...(actor ? { actor } : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const [entries, total, facets] = await Promise.all([
    repo.audit.listAudit({ ...filter, limit, offset }),
    repo.audit.countAudit(filter),
    repo.audit.auditFacets(),
  ]);

  const keep = (o: number): string => {
    const params = new URLSearchParams();
    if (actor) params.set("actor", actor);
    if (action) params.set("action", action);
    if (entityType) params.set("entity", entityType);
    if (o) params.set("offset", String(o));
    const s = params.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  const body = html`
    <div class="notice">
      <p>
        Every mutation writes a row here, on the same connection and inside the same
        transaction as the change it describes — so a change that rolls back takes its
        record with it, and the trail never claims something happened that did not.
        Nothing updates or deletes these rows.
      </p>
    </div>

    <form class="toolbar" method="get" action="/admin/audit">
      ${select("actor", "Actor", actor, facets.actors.map((a) => ({ value: a, label: a })), { blank: "Anyone" })}
      ${select("action", "Action", action, facets.actions.map((a) => ({ value: a, label: a })), { blank: "Anything" })}
      ${select("entity", "Entity", entityType, facets.entityTypes.map((a) => ({ value: a, label: a })), { blank: "Any" })}
      <div class="actions actions--inline">
        <button type="submit">Filter</button>
        <a class="btn btn--ghost" href="/admin/audit">Clear</a>
      </div>
    </form>

    <div class="table-wrap">
      <table>
        <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Before</th><th>After</th><th>Actor</th></tr></thead>
        <tbody>
          ${entries.length
            ? join(
                entries.map(
                  (a) => html`
                    <tr>
                      <td class="u-nowrap mono">${timestamp(a.createdAt)}</td>
                      <td><code>${a.action}</code></td>
                      <td>${a.entityType}</td>
                      <td><p class="diff">${jsonPreview(a.before)}</p></td>
                      <td><p class="diff">${jsonPreview(a.after)}</p></td>
                      <td class="u-muted">${a.actor}</td>
                    </tr>
                  `,
                ),
              )
            : html`<tr><td colspan="6"><p class="empty">Nothing recorded yet.</p></td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="pager">
      <span>${String(total ? offset + 1 : 0)}–${String(Math.min(offset + limit, total))} of ${String(total)}</span>
      <span class="actions actions--inline">
        ${offset > 0 ? html`<a class="btn btn--ghost btn--sm" href="${keep(Math.max(offset - limit, 0))}">Previous</a>` : ""}
        ${offset + limit < total ? html`<a class="btn btn--ghost btn--sm" href="${keep(offset + limit)}">Next</a>` : ""}
      </span>
    </div>
  `;

  return page({ title: "Audit trail", section: "audit", flash, counts }, body);
}

function jsonPreview(v: Record<string, unknown> | null): string {
  if (!v) return "—";
  const s = JSON.stringify(v, null, 1).replaceAll("\n", " ").replaceAll(/\s+/g, " ");
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}
