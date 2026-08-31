/** The overview: what needs attention, and how much of it there is. */

import { html, join, type SafeHtml } from "../../../lib/html.ts";
import { page, pill, timestamp, type PageOptions } from "../layout.ts";
import * as repo from "../../repositories/index.ts";

export interface Counts extends Record<string, { value: number; tone?: "warn" }> {}

/** The counts every page's sidebar shows. Read once per request. */
export async function navCounts(): Promise<Counts> {
  const [products, collections, brands, compliance, gaps, stock] = await Promise.all([
    repo.products.publicationCounts(),
    repo.collections.listCollections(),
    repo.brands.listBrands(),
    repo.compliance.complianceSummary(),
    repo.curation.gapSummary(),
    repo.inventory.stockSummary(),
  ]);

  const needsAttention =
    compliance.productsWithQuarantinedCopy + compliance.productsWithBannedTitles;

  return {
    products: { value: products.total },
    collections: { value: collections.length },
    brands: { value: brands.length },
    compliance: { value: needsAttention, ...(needsAttention ? { tone: "warn" as const } : {}) },
    curation: { value: gaps.open, ...(gaps.open ? { tone: "warn" as const } : {}) },
    unknownStock: { value: stock.unknown, ...(stock.unknown ? { tone: "warn" as const } : {}) },
  };
}

/**
 * A stat card is also the door to its screen, and a count that needs a human
 * looks different from a count that is merely a fact.
 */
function stat(n: number | string, label: string, href: string, tone?: "warn" | "danger"): SafeHtml {
  return html`
    <a class="card card--stat" href="${href}" ${tone ? html`data-tone="${tone}"` : ""}>
      <span class="stat">
        <span class="n">${String(n)}</span>
        <span class="label">${label}</span>
      </span>
    </a>
  `;
}

export async function overviewPage(flash: PageOptions["flash"], counts: Counts): Promise<string> {
  const [pubs, stock, compliance, gaps, withheld, recent] = await Promise.all([
    repo.products.publicationCounts(),
    repo.inventory.stockSummary(),
    repo.compliance.complianceSummary(),
    repo.curation.gapSummary(),
    repo.publication.withheldProducts(),
    repo.audit.listAudit({ limit: 12 }),
  ]);

  const body = html`
    <div class="grid grid--stats">
      ${stat(pubs.total, "products", "/admin/products")}
      ${stat(pubs.published, "published", "/admin/products")}
      ${stat(pubs.withheld, "withheld", "/admin/compliance", pubs.withheld ? "danger" : undefined)}
      ${stat(stock.unknown, "stock not counted", "/admin/inventory", stock.unknown ? "warn" : undefined)}
      ${stat(gaps.open, "broken curations", "/admin/curation", gaps.open ? "warn" : undefined)}
      ${stat(compliance.quarantinedBlocks, "quarantined blocks", "/admin/compliance", compliance.quarantinedBlocks ? "warn" : undefined)}
    </div>

    <div class="grid grid--2">
      <section class="card">
        <h2>Withheld from the storefront</h2>
        ${withheld.length
          ? html`
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Product</th><th>Reason</th></tr></thead>
                  <tbody>
                    ${join(
                      withheld.map(
                        (w) => html`
                          <tr>
                            <td>
                              <a href="/admin/products/${w.handle}">${w.title}</a>
                              <span class="sub handle">${w.handle}</span>
                            </td>
                            <td>${w.reason}</td>
                          </tr>
                        `,
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            `
          : html`<p class="u-muted">Nothing is being held back.</p>`}
      </section>

      <section class="card">
        <h2>Inventory</h2>
        <p>
          Stock has three states, and two of them are numbers. A variant nobody has
          counted is <em>not</em> a variant with none in stock.
        </p>
        <dl class="meta u-mt">
          <dt>${pill("not counted", "muted")}</dt>
          <dd>${String(stock.unknown)} of ${String(stock.total)} variants</dd>
          <dt>${pill("0 in stock", "warn")}</dt>
          <dd>${String(stock.zero)}</dd>
          <dt>${pill("in stock", "ok")}</dt>
          <dd>${String(stock.positive)}</dd>
        </dl>
        <div class="actions"><a class="btn btn--ghost" href="/admin/inventory">Manage inventory</a></div>
      </section>
    </div>

    <section class="card">
      <h2>Recent changes</h2>
      ${recent.length
        ? html`
            <div class="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Actor</th></tr></thead>
                <tbody>
                  ${join(
                    recent.map(
                      (a) => html`
                        <tr>
                          <td class="u-nowrap mono">${timestamp(a.createdAt)}</td>
                          <td><code>${a.action}</code></td>
                          <td>${a.entityType}</td>
                          <td class="u-muted">${a.actor}</td>
                        </tr>
                      `,
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div class="actions"><a class="btn btn--ghost" href="/admin/audit">Full audit trail</a></div>
          `
        : html`<p class="u-muted">No changes recorded yet.</p>`}
    </section>
  `;

  return page({ title: "Overview", section: "overview", flash, counts }, body);
}
