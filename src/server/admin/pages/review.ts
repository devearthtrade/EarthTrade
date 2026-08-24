/** Compliance review, and settling broken curation. */

import { html, join, raw, type SafeHtml } from "../../../lib/html.ts";
import { page, pill, timestamp, type PageOptions } from "../layout.ts";
import type { Counts } from "./overview.ts";
import * as repo from "../../repositories/index.ts";

/* ------------------------------- compliance ------------------------------ */

export async function compliancePage(
  query: URLSearchParams,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string> {
  const view = query.get("view") ?? "quarantined";

  const [summary, all, withheld] = await Promise.all([
    repo.compliance.complianceSummary(),
    repo.catalog.loadProducts(),
    repo.publication.withheldProducts(),
  ]);

  const quarantined = all.filter((p) => p.quarantinedContent.length);
  const bannedNames = all.filter((p) => p.titleMatches.length);
  const flagged = all.filter((p) => p.needsReview);

  const tab = (key: string, label: string, n: number): SafeHtml => html`
    <a class="btn ${raw(view === key ? "" : "btn--ghost")} btn--sm" href="/admin/compliance?view=${key}"
       ${raw(view === key ? 'aria-current="page"' : "")}>${label} (${String(n)})</a>
  `;

  const body = html`
    <div class="notice">
      <p>
        <strong>Compliance is enforced in one place and cannot be overridden from here.</strong>
        Copy and product names are screened by <code>src/lib/compliance.ts</code> on every
        write — the same module the CSV importer uses. This page shows what the screen
        decided and lets you fix the copy; it has no button that publishes something
        the screen refused.
      </p>
    </div>

    <div class="grid grid--stats">
      <div class="card"><span class="stat" data-tone="${quarantined.length ? "warn" : ""}"><span class="n">${String(summary.quarantinedBlocks)}</span><span class="label">blocks held back</span></span></div>
      <div class="card"><span class="stat"><span class="n">${String(summary.productsWithQuarantinedCopy)}</span><span class="label">products affected</span></span></div>
      <div class="card"><span class="stat" data-tone="${summary.withheldForTitle ? "danger" : ""}"><span class="n">${String(summary.withheldForTitle)}</span><span class="label">withheld for their name</span></span></div>
      <div class="card"><span class="stat" data-tone="${summary.withheldForPrice ? "warn" : ""}"><span class="n">${String(summary.withheldForPrice)}</span><span class="label">withheld for price</span></span></div>
    </div>

    <div class="actions">
      ${tab("quarantined", "Quarantined copy", quarantined.length)}
      ${tab("names", "Banned names", bannedNames.length)}
      ${tab("withheld", "Withheld", withheld.length)}
      ${tab("flags", "Needs review", flagged.length)}
      ${tab("screen", "Test the screen", 0)}
    </div>

    ${view === "quarantined" ? quarantinedView(quarantined) : ""}
    ${view === "names" ? namesView(bannedNames) : ""}
    ${view === "withheld" ? withheldView(withheld) : ""}
    ${view === "flags" ? flagsView(flagged) : ""}
    ${view === "screen" ? screenView() : ""}
  `;

  return page({ title: "Compliance", section: "compliance", flash, counts }, body);
}

function quarantinedView(products: repo.ProductRecord[]): SafeHtml {
  if (!products.length) return html`<section class="card"><p class="u-muted">Nothing is being held back.</p></section>`;

  return html`
    <section class="card">
      <h2>Copy held back</h2>
      <p class="u-muted">
        These blocks are stored and auditable but do not render. Editing the product's
        description re-screens it; removing the offending phrasing releases the block.
      </p>
      ${join(
        products.map(
          (p) => html`
            <div class="u-mt">
              <p>
                <a href="/admin/products/${p.handle}"><strong>${p.title}</strong></a>
                <span class="handle mono">${p.handle}</span>
                ${p.publishable ? pill("published", "ok") : pill("withheld", "danger")}
              </p>
              ${join(
                p.quarantinedContent.map(
                  (b) => html`
                    <div class="quarantined">
                      <p>${b.text}</p>
                      <p class="u-muted">${join(b.matches.map((m) => html`<code>${m.term}</code> — ${m.reason}`))}</p>
                    </div>
                  `,
                ),
              )}
            </div>
          `,
        ),
      )}
    </section>
  `;
}

function namesView(products: repo.ProductRecord[]): SafeHtml {
  return html`
    <section class="card">
      <h2>Product names that state a banned claim</h2>
      <p class="u-muted">
        A product name cannot be quietly omitted from a page, so a name that fails the
        screen withholds the whole record. Renaming the product clears the block; there
        is no way to publish it as it stands.
      </p>
      ${products.length
        ? html`
            <div class="table-wrap u-mt">
              <table>
                <thead><tr><th>Product</th><th>Terms</th><th>Publishable</th></tr></thead>
                <tbody>
                  ${join(
                    products.map(
                      (p) => html`
                        <tr>
                          <td><a href="/admin/products/${p.handle}">${p.title}</a><span class="sub handle">${p.handle}</span></td>
                          <td>${join(p.titleMatches.map((m) => html`<code>${m.term}</code> <span class="u-muted">${m.reason}</span><br>`))}</td>
                          <td>${pill("blocked", "danger")}</td>
                        </tr>
                      `,
                    ),
                  )}
                </tbody>
              </table>
            </div>
          `
        : html`<p class="u-muted">No product name states a banned claim.</p>`}
    </section>
  `;
}

function withheldView(withheld: { handle: string; title: string; brandId: string; reason: string }[]): SafeHtml {
  return html`
    <section class="card">
      <h2>Withheld from the storefront</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Brand</th><th>Reason</th></tr></thead>
          <tbody>
            ${withheld.length
              ? join(
                  withheld.map(
                    (w) => html`
                      <tr>
                        <td><a href="/admin/products/${w.handle}">${w.title}</a><span class="sub handle">${w.handle}</span></td>
                        <td>${w.brandId}</td>
                        <td>${w.reason}</td>
                      </tr>
                    `,
                  ),
                )
              : html`<tr><td colspan="3"><p class="empty">Nothing is being held back.</p></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function flagsView(products: repo.ProductRecord[]): SafeHtml {
  return html`
    <section class="card">
      <h2>Needs review</h2>
      <p class="u-muted">
        Derived from each product's flags, not stored. Clearing one means fixing what
        the flag points at — there is no field to mark it reviewed.
      </p>
      <div class="table-wrap u-mt">
        <table>
          <thead><tr><th>Product</th><th>Flags</th><th>Storefront</th></tr></thead>
          <tbody>
            ${products.length
              ? join(
                  products.map(
                    (p) => html`
                      <tr>
                        <td><a href="/admin/products/${p.handle}">${p.title}</a><span class="sub handle">${p.handle}</span></td>
                        <td>${join(p.flags.map((f) => pill(f.replaceAll("_", " "), "warn")))}</td>
                        <td>${p.publishable ? pill("published", "ok") : pill("withheld", "danger")}</td>
                      </tr>
                    `,
                  ),
                )
              : html`<tr><td colspan="3"><p class="empty">Nothing needs review.</p></td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

const SCREEN_BRANDS = [
  { value: "solutionshocl", label: "SolutionsHOCL (governed by the HOCL rules)" },
  { value: "life-ionizers", label: "Life Ionizers" },
  { value: "pitcher-of-life", label: "Pitcher of Life" },
  { value: "hawaiian-volcanic-organic", label: "Hawaiian Volcanic Organic" },
  { value: "life-sciences-water", label: "Life Sciences Water" },
];

function screenForm(values: { brandSlug?: string; title?: string; body?: string } = {}): SafeHtml {
  return html`
    <section class="card" style="max-width:800px">
      <h2>Test the screen</h2>
      <p class="u-muted">
        Runs the same check a save would, and writes nothing. Useful before committing
        to a phrasing.
      </p>
      <form method="post" action="/admin/compliance/screen" class="u-mt">
        <div class="field">
          <label for="f-brandSlug">Brand</label>
          <select id="f-brandSlug" name="brandSlug">
            ${join(
              SCREEN_BRANDS.map(
                (b) => html`<option value="${b.value}" ${raw(b.value === values.brandSlug ? "selected" : "")}>${b.label}</option>`,
              ),
            )}
          </select>
        </div>
        <div class="field">
          <label for="f-title">Product name</label>
          <input id="f-title" name="title" value="${values.title ?? ""}">
        </div>
        <div class="field">
          <label for="f-text">Copy</label>
          <textarea id="f-text" name="text" rows="6">${values.body ?? ""}</textarea>
        </div>
        <div class="actions"><button type="submit">Screen it</button></div>
      </form>
    </section>
  `;
}

function screenView(): SafeHtml {
  return screenForm();
}

export interface ScreenOutcome {
  brandSlug: string;
  title: string;
  body: string;
  screened: {
    publishable: boolean;
    withheldReason: string | null;
    titleMatches: { term: string; reason: string }[];
    quarantined: { text: string; matches: { term: string; reason: string }[] }[];
    description: string[];
  };
}

/** The result of a dry-run screen, rendered in place rather than redirected. */
export async function screenResultPage(
  outcome: ScreenOutcome,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string> {
  const { screened } = outcome;
  const clean = !screened.titleMatches.length && !screened.quarantined.length;

  const body = html`
    <div class="notice ${raw(clean ? "notice--ok" : "notice--danger")}">
      <p>
        <strong>
          ${clean
            ? "Nothing in this would be held back."
            : screened.publishable
              ? "This would publish, with some copy held back."
              : "This would not be publishable."}
        </strong>
      </p>
      ${screened.withheldReason ? html`<p>${screened.withheldReason}</p>` : ""}
    </div>

    ${screened.titleMatches.length
      ? html`<section class="card">
          <h2>The name</h2>
          <p>
            A product name cannot be quietly omitted from a page, so a match here
            withholds the whole record.
          </p>
          ${join(screened.titleMatches.map((m) => html`<p><code>${m.term}</code> — ${m.reason}</p>`))}
        </section>`
      : ""}

    ${screened.quarantined.length
      ? html`<section class="card">
          <h2>Copy that would be held back</h2>
          ${join(
            screened.quarantined.map(
              (b) => html`<div class="quarantined">
                <p>${b.text}</p>
                <p class="u-muted">${join(b.matches.map((m) => html`<code>${m.term}</code> — ${m.reason}. `))}</p>
              </div>`,
            ),
          )}
        </section>`
      : ""}

    ${screened.description.length
      ? html`<section class="card">
          <h2>Copy that would publish</h2>
          ${join(screened.description.map((t) => html`<p>${t}</p>`))}
        </section>`
      : ""}

    ${screenForm({ brandSlug: outcome.brandSlug, title: outcome.title, body: outcome.body })}
  `;

  return page({ title: "Compliance", section: "compliance", flash, counts }, body);
}

/* --------------------------------- curation ------------------------------ */

export async function curationPage(
  query: URLSearchParams,
  flash: PageOptions["flash"],
  counts: Counts,
): Promise<string> {
  const source = query.get("source") ?? "";
  const showResolved = query.get("show") === "resolved";

  const [gaps, summary] = await Promise.all([
    repo.curation.listGaps({ open: !showResolved, ...(source ? { sourceHandle: source } : {}) }),
    repo.curation.gapSummary(),
  ]);

  // Suggestions are looked up per gap. They shorten a search and nothing more:
  // no code path acts on them.
  const suggestions = new Map<string, string[]>();
  for (const g of gaps.slice(0, 40)) {
    suggestions.set(g.id, await repo.curation.suggestionsFor(g.missingHandle));
  }

  const body = html`
    <div class="notice notice--warn">
      <p>
        <strong>These are curated references that no longer resolve.</strong> Somebody
        chose to put a product in a collection, and the catalog no longer has that
        product — it was renamed, replaced, or never imported. Only a person can say
        which.
      </p>
      <p>
        Nothing here picks a replacement automatically. A wrong guess would put the
        wrong product in front of a customer under a heading someone chose by hand,
        and a similar handle is not evidence.
      </p>
    </div>

    <div class="grid grid--stats">
      <div class="card"><span class="stat" data-tone="${summary.open ? "warn" : ""}"><span class="n">${String(summary.open)}</span><span class="label">open</span></span></div>
      <div class="card"><span class="stat"><span class="n">${String(summary.resolved)}</span><span class="label">settled</span></span></div>
      <div class="card"><span class="stat"><span class="n">${String(summary.sources)}</span><span class="label">collections affected</span></span></div>
    </div>

    <div class="actions">
      <a class="btn ${raw(showResolved ? "btn--ghost" : "")} btn--sm" href="/admin/curation">Open</a>
      <a class="btn ${raw(showResolved ? "" : "btn--ghost")} btn--sm" href="/admin/curation?show=resolved">Settled</a>
      ${source ? html`<a class="btn btn--ghost btn--sm" href="/admin/curation">All collections</a>` : ""}
    </div>

    ${gaps.length
      ? html`
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Collection</th><th>Missing handle</th><th>Similar products</th><th>What to do</th></tr>
              </thead>
              <tbody>
                ${join(gaps.map((g) => gapRow(g, suggestions.get(g.id) ?? [], showResolved)))}
              </tbody>
            </table>
          </div>
          ${gaps.length > 40
            ? html`<p class="u-muted">Suggestions are loaded for the first 40 rows.</p>`
            : ""}
        `
      : html`<section class="card"><p class="empty">
          ${showResolved ? "Nothing has been settled yet." : "No outstanding broken curations."}
        </p></section>`}
  `;

  return page({ title: "Broken curation", section: "curation", flash, counts }, body);
}

function gapRow(g: repo.curation.CurationGap, suggestions: string[], resolved: boolean): SafeHtml {
  if (resolved) {
    return html`
      <tr>
        <td>${g.sourceHandle}</td>
        <td class="mono">${g.missingHandle}</td>
        <td>
          ${pill(g.resolution ?? "", g.resolution === "mapped" ? "ok" : "muted")}
          ${g.mappedToHandle ? html`<span class="sub mono">${g.mappedToHandle}</span>` : ""}
          ${g.note ? html`<span class="sub">${g.note}</span>` : ""}
        </td>
        <td class="u-right">
          <span class="sub u-muted">${g.resolvedBy ?? ""} ${g.resolvedAt ? timestamp(g.resolvedAt) : ""}</span>
          <form method="post" action="/admin/curation/${g.id}/reopen">
            <button class="ghost sm" type="submit">Reopen</button>
          </form>
        </td>
      </tr>
    `;
  }

  return html`
    <tr>
      <td>
        <a href="/admin/collections/${g.sourceHandle}">${g.sourceHandle}</a>
        <span class="sub">position ${String(g.position)}</span>
      </td>
      <td class="mono">${g.missingHandle}</td>
      <td>
        ${suggestions.length
          ? html`<span class="sub u-muted">Similar handles, to shorten the search:</span>
              ${join(suggestions.map((s) => html`<span class="sub mono">${s}</span>`))}`
          : html`<span class="u-muted">No similar handles.</span>`}
      </td>
      <td>
        <form method="post" action="/admin/curation/${g.id}/resolve" class="row">
          <input name="productHandle" placeholder="Replacement handle" aria-label="Replacement product handle"
                 list="products-${g.id}">
          <datalist id="products-${g.id}">
            ${join(suggestions.map((s) => html`<option value="${s}"></option>`))}
          </datalist>
          <span class="actions actions--inline">
            <button class="sm" type="submit" name="kind" value="mapped">Map</button>
            <button class="ghost sm" type="submit" name="kind" value="removed">Remove</button>
            <button class="ghost sm" type="submit" name="kind" value="reviewed">Reviewed</button>
          </span>
        </form>
      </td>
    </tr>
  `;
}
