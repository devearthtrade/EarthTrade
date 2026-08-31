/**
 * The admin shell: page chrome, navigation, and the small helpers every screen
 * uses.
 *
 * Rendered on the server with the same escape-by-default `html` helper the
 * storefront uses, so catalog copy — which people paste in from anywhere —
 * cannot become markup. There is no client-side framework and no client-side
 * authorisation; the pages are forms, and every decision they submit is made
 * again on the server.
 */

import { html, join, raw, type SafeHtml } from "../../lib/html.ts";

export interface NavCount {
  value: number;
  tone?: "warn";
}

export interface PageOptions {
  title: string;
  /** Highlights the matching sidebar link. */
  section: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: SafeHtml;
  counts?: Record<string, NavCount>;
  /** A one-off message after a redirect, from ?ok= or ?error=. */
  flash?: { kind: "ok" | "warn" | "danger"; message: string } | null;
}

interface NavLink {
  href: string;
  label: string;
  key: string;
  countKey?: string;
}

const NAV: { group: string; links: NavLink[] }[] = [
  {
    group: "Catalog",
    links: [
      { href: "/admin", label: "Overview", key: "overview" },
      { href: "/admin/products", label: "Products", key: "products", countKey: "products" },
      { href: "/admin/inventory", label: "Inventory", key: "inventory", countKey: "unknownStock" },
      { href: "/admin/collections", label: "Collections", key: "collections", countKey: "collections" },
      { href: "/admin/brands", label: "Brands", key: "brands", countKey: "brands" },
    ],
  },
  {
    group: "Review",
    links: [
      { href: "/admin/compliance", label: "Compliance", key: "compliance", countKey: "compliance" },
      { href: "/admin/curation", label: "Broken curation", key: "curation", countKey: "curation" },
      { href: "/admin/audit", label: "Audit trail", key: "audit" },
    ],
  },
];

function sidebar(section: string, counts: Record<string, NavCount>): SafeHtml {
  return html`
    <nav class="sidebar" aria-label="Admin sections">
      <a class="sidebar__brand" href="/admin">
        <img src="/images/Earthtrade%20logo.avif" alt="EarthTrade" width="260" height="84">
        <small>Admin</small>
      </a>
      ${join(
        NAV.map(
          (g) => html`
            <div class="sidebar__group">${g.group}</div>
            ${join(
              g.links.map((l) => {
                const count = l.countKey ? counts[l.countKey] : undefined;
                return html`
                  <a
                    class="nav"
                    href="${l.href}"
                    ${raw(l.key === section ? 'aria-current="page"' : "")}
                  >
                    <span>${l.label}</span>
                    ${count
                      ? html`<span class="count" ${raw(count.tone ? `data-tone="${count.tone}"` : "")}
                          >${String(count.value)}</span
                        >`
                      : ""}
                  </a>
                `;
              }),
            )}
          `,
        ),
      )}
    </nav>
  `;
}

export function page(options: PageOptions, body: SafeHtml): string {
  const crumbs = options.breadcrumb ?? [];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Nothing here should ever be indexed, and nothing here is reachable off this machine. -->
<meta name="robots" content="noindex, nofollow">
<title>${escapeText(options.title)} · EarthTrade Admin</title>
<link rel="icon" href="/images/earthtrade-favicon-32.png" sizes="32x32" type="image/png">
<link rel="stylesheet" href="/admin/admin.css">
</head>
<body>
${render(html`
  <div class="shell">
    ${sidebar(options.section, options.counts ?? {})}
    <div class="main">
      <header class="topbar">
        <div>
          ${crumbs.length
            ? html`<div class="crumb">
                ${join(
                  crumbs.map((c, i) =>
                    html`${i > 0 ? raw(" / ") : ""}${c.href
                      ? html`<a href="${c.href}">${c.label}</a>`
                      : html`<span>${c.label}</span>`}`,
                  ),
                )}
              </div>`
            : ""}
          <h1>${options.title}</h1>
        </div>
        ${options.actions ? html`<div class="actions actions--inline">${options.actions}</div>` : ""}
      </header>
      <main class="content">
        ${options.flash
          ? html`<div class="notice notice--${options.flash.kind}" role="status">
              <p>${options.flash.message}</p>
            </div>`
          : ""}
        ${body}
      </main>
    </div>
  </div>
`)}
</body>
</html>
`;
}

/* ------------------------------- helpers --------------------------------- */

function escapeText(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function render(node: SafeHtml): string {
  return node.value;
}

/** A labelled text input. */
export function field(
  name: string,
  label: string,
  value: string | number | null | undefined,
  options: { hint?: string; type?: string; placeholder?: string; required?: boolean; disabled?: boolean } = {},
): SafeHtml {
  return html`
    <div class="field">
      <label for="f-${name}">
        ${label}
        ${options.hint ? html`<span class="hint">${options.hint}</span>` : ""}
      </label>
      <input
        id="f-${name}"
        name="${name}"
        type="${options.type ?? "text"}"
        value="${value === null || value === undefined ? "" : String(value)}"
        ${raw(options.placeholder ? `placeholder="${escapeAttr(options.placeholder)}"` : "")}
        ${raw(options.required ? "required" : "")}
        ${raw(options.disabled ? "disabled" : "")}
      >
    </div>
  `;
}

/** A labelled textarea. Paragraph lists are edited one per line. */
export function textarea(
  name: string,
  label: string,
  value: string | null | undefined,
  options: { hint?: string; rows?: number } = {},
): SafeHtml {
  return html`
    <div class="field">
      <label for="f-${name}">
        ${label}
        ${options.hint ? html`<span class="hint">${options.hint}</span>` : ""}
      </label>
      <textarea id="f-${name}" name="${name}" rows="${String(options.rows ?? 6)}">${value ?? ""}</textarea>
    </div>
  `;
}

/** A labelled select. */
export function select(
  name: string,
  label: string,
  value: string | null | undefined,
  choices: { value: string; label: string }[],
  options: { hint?: string; blank?: string } = {},
): SafeHtml {
  return html`
    <div class="field">
      <label for="f-${name}">
        ${label}
        ${options.hint ? html`<span class="hint">${options.hint}</span>` : ""}
      </label>
      <select id="f-${name}" name="${name}">
        ${options.blank !== undefined
          ? html`<option value="" ${raw(!value ? "selected" : "")}>${options.blank}</option>`
          : ""}
        ${join(
          choices.map(
            (c) => html`<option value="${c.value}" ${raw(c.value === value ? "selected" : "")}>${c.label}</option>`,
          ),
        )}
      </select>
    </div>
  `;
}

function escapeAttr(s: string): string {
  return escapeText(s).replaceAll('"', "&quot;");
}

/** A status pill. */
export function pill(label: string, tone: "ok" | "warn" | "danger" | "muted" = "muted"): SafeHtml {
  return html`<span class="pill pill--${tone}">${label}</span>`;
}

/** Money, from integer cents. Cents are the truth; this is only display. */
export function money(cents: number | null | undefined, currency = "USD"): string {
  if (cents === null || cents === undefined) return "—";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

/** A count of stock, keeping "unknown" distinct from zero. */
export function stockLabel(state: string, onHand: number | null): SafeHtml {
  if (state === "unknown") return pill("not counted", "muted");
  if (state === "zero") return pill("0 in stock", "warn");
  return pill(`${onHand} in stock`, "ok");
}

export function timestamp(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // Seconds included: many audit rows land in the same minute, and the trail
  // is only as good as its ordering is legible.
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/** Reads ?ok= / ?error= into a flash message. */
export function flashFrom(query: URLSearchParams): PageOptions["flash"] {
  const ok = query.get("ok");
  if (ok) return { kind: "ok", message: ok };
  const warn = query.get("warn");
  if (warn) return { kind: "warn", message: warn };
  const error = query.get("error");
  if (error) return { kind: "danger", message: error };
  return null;
}
