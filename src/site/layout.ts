/** Page shell: head, announcement rail, header, mega nav, drawers, footer. */

import { html, join, raw, type Child, type SafeHtml } from "../lib/html.ts";
import { canonical, jsonLdBlocks, organizationLd, websiteLd, type PageMeta } from "../lib/seo.ts";
import { navigation } from "../data/catalog.ts";
import { icon } from "./icons.ts";

const FREE_SHIP_THRESHOLD = 75;

export interface LayoutOptions extends PageMeta {
  /** Hero pages let the header float over the artwork until scrolled. */
  transparentHeader?: boolean;
  /** Show the reading progress rail (journal articles). */
  scrollRail?: boolean;
  bodyClass?: string;
}

function megaMenu(item: (typeof navigation)[number]): SafeHtml {
  if (!item.columns) return raw("");
  return html`
    <div class="mega">
      ${join(
        item.columns.map(
          (col) => html`
            <div>
              <h3 class="mega__title">${col.title}</h3>
              <ul class="mega__links">
                ${join(
                  col.links.map(
                    (link) => html`<li><a href="${link.href}">${link.label}</a></li>`,
                  ),
                )}
              </ul>
            </div>
          `,
        ),
      )}
      ${item.feature
        ? html`
            <div class="mega__feature">
              <h4>${item.feature.title}</h4>
              <p>${item.feature.text}</p>
              <a class="link" href="${item.feature.href}">Explore ${icon("arrow")}</a>
            </div>
          `
        : ""}
    </div>
  `;
}

function header(opts: LayoutOptions): SafeHtml {
  return html`
    <div class="announce">
      Free shipping on orders over $${String(FREE_SHIP_THRESHOLD)}.
      <a href="/collections/subscribe">Never run out with Auto-Ship</a>
    </div>
    <header class="header ${opts.transparentHeader ? "header--over" : ""}">
      <div class="wrap header__bar">
        <a class="header__brand" href="/">
          <b>Earth<em style="font-style:normal">Trade</em></b>
          <span>Naturally engineered</span>
        </a>

        <nav class="nav" aria-label="Primary">
          ${join(
            navigation.map(
              (item) => html`
                <div class="nav__item">
                  <a class="nav__link" href="${item.href}">${item.label}</a>
                  ${megaMenu(item)}
                </div>
              `,
            ),
          )}
        </nav>

        <div class="header__tools">
          <button class="icon-btn" type="button" data-open-drawer="search" aria-label="Search">
            ${icon("search")}
          </button>
          <a class="icon-btn" href="/account" aria-label="Account">${icon("user")}</a>
          <a class="icon-btn" href="/account#wishlist" aria-label="Wishlist">
            ${icon("heart")}
            <span class="icon-btn__count" data-wish-count data-empty="true">0</span>
          </a>
          <button class="icon-btn" type="button" data-open-drawer="cart" aria-label="Open cart">
            ${icon("bag")}
            <span class="icon-btn__count" data-cart-count data-empty="true">0</span>
          </button>
          <button class="icon-btn burger" type="button" data-open-drawer="menu" aria-label="Open menu">
            ${icon("menu")}
          </button>
        </div>
      </div>
    </header>
  `;
}

function mobileDrawer(): SafeHtml {
  return html`
    <div class="drawer drawer--left" data-drawer="menu" data-open="false" role="dialog" aria-modal="true" aria-label="Menu">
      <button class="drawer__scrim" type="button" data-close-drawer aria-label="Close menu"></button>
      <div class="drawer__panel">
        <div class="drawer__head">
          <h2>Menu</h2>
          <button class="icon-btn" type="button" data-close-drawer aria-label="Close menu">${icon("close")}</button>
        </div>
        <div class="drawer__body">
          <ul class="mnav">
            ${join(
              navigation.map((item) =>
                item.columns
                  ? html`
                      <li>
                        <button class="mnav__top" type="button" data-mnav-toggle aria-expanded="false">
                          ${item.label} ${icon("plus")}
                        </button>
                        <div class="mnav__panel" data-open="false">
                          ${join(
                            item.columns.map(
                              (col) => html`
                                <h3>${col.title}</h3>
                                <ul>
                                  ${join(
                                    col.links.map(
                                      (link) => html`<li><a href="${link.href}">${link.label}</a></li>`,
                                    ),
                                  )}
                                </ul>
                              `,
                            ),
                          )}
                        </div>
                      </li>
                    `
                  : html`<li><a class="mnav__top" href="${item.href}">${item.label}</a></li>`,
              ),
            )}
          </ul>
          <div class="u-mt-lg">
            <a class="btn btn--block" href="/quiz">Find the right solution</a>
          </div>
        </div>
        <div class="drawer__foot">
          <p class="small" style="margin:0">
            Questions? <a href="/contact">Talk to us</a>. We are happy to help you choose.
          </p>
        </div>
      </div>
    </div>
  `;
}

function cartDrawer(): SafeHtml {
  return html`
    <div class="drawer" data-drawer="cart" data-open="false" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button class="drawer__scrim" type="button" data-close-drawer aria-label="Close cart"></button>
      <div class="drawer__panel">
        <div class="drawer__head">
          <h2>Your cart</h2>
          <button class="icon-btn" type="button" data-close-drawer aria-label="Close cart">${icon("close")}</button>
        </div>
        <div class="drawer__body" data-cart-body></div>
        <div class="drawer__foot" data-cart-foot hidden>
          <div class="progress">
            <p data-progress-msg class="small"></p>
            <div class="progress__bar"><div class="progress__fill" data-progress-fill style="width:0%"></div></div>
          </div>
          <div class="totals">
            <span class="small muted">Subtotal</span>
            <strong data-cart-total>$0</strong>
          </div>
          <p class="tiny muted">Shipping and taxes calculated at checkout.</p>
          <button class="btn btn--block u-mt" type="button" data-checkout>Checkout</button>
        </div>
      </div>
    </div>
  `;
}

function searchOverlay(): SafeHtml {
  return html`
    <div class="search-overlay" data-search data-open="false" role="dialog" aria-modal="true" aria-label="Search">
      <div class="search-panel">
        <div class="wrap">
          <div class="search-field">
            ${icon("search")}
            <label class="visually-hidden" for="site-search">Search EarthTrade</label>
            <input
              id="site-search"
              type="search"
              data-search-input
              placeholder="Search products, models, problems"
              autocomplete="off"
              spellcheck="false"
            />
            <button class="icon-btn" type="button" data-close-drawer aria-label="Close search">${icon("close")}</button>
          </div>
          <p class="search-hint">
            Try
            <button type="button" data-search-suggest>Cistern cleaner</button>·
            <button type="button" data-search-suggest>MXL-9</button>·
            <button type="button" data-search-suggest>Pitcher filter</button>·
            <button type="button" data-search-suggest>Organic fertilizer</button>
          </p>
          <div class="results" data-search-results role="region" aria-live="polite" aria-label="Search results"></div>
        </div>
      </div>
    </div>
  `;
}

function footer(): SafeHtml {
  const cols = [
    {
      title: "Shop",
      links: [
        { label: "Water", href: "/collections/water" },
        { label: "Life Ionizers", href: "/collections/life-ionizers" },
        { label: "Pitcher of Life", href: "/collections/pitcher-of-life" },
        { label: "SolutionsHOCL", href: "/collections/solutionshocl" },
        { label: "Organic Gardening", href: "/collections/organic-gardening" },
        { label: "Replacement Filters", href: "/collections/water-filtration" },
      ],
    },
    {
      title: "Solutions",
      links: [
        { label: "Cistern & Catchment", href: "/collections/cistern-catchment" },
        { label: "Home Cleaning", href: "/collections/household-cleaning" },
        { label: "RV & Marine", href: "/collections/rv-marine" },
        { label: "Bundles", href: "/bundles" },
        { label: "Build Your System", href: "/build-your-system" },
        { label: "Never Run Out", href: "/collections/subscribe" },
      ],
    },
    {
      title: "Learn",
      links: [
        { label: "Education Hub", href: "/learn" },
        { label: "The Journal", href: "/journal" },
        { label: "Solution Quiz", href: "/quiz" },
        { label: "Filter Finder", href: "/filter-finder" },
        { label: "Compare Ionizers", href: "/compare/ionizers" },
        { label: "FAQs", href: "/faqs" },
      ],
    },
    {
      title: "EarthTrade",
      links: [
        { label: "Our Story", href: "/about" },
        { label: "Our Brands", href: "/brands" },
        { label: "Rewards", href: "/rewards" },
        { label: "Account", href: "/account" },
        { label: "Contact", href: "/contact" },
        { label: "Shipping & Returns", href: "/shipping-returns" },
      ],
    },
  ];

  return html`
    <footer class="footer">
      <div class="wrap">
        <div class="footer__grid">
          <div>
            <div class="footer__brand">EarthTrade</div>
            <p>
              Better solutions for water, home, wellness and organic living. Five brands, one
              standard: products that do the job and last.
            </p>
            <form class="inline-form u-mt" data-newsletter>
              <label class="visually-hidden" for="footer-email">Email address</label>
              <input id="footer-email" type="email" name="email" placeholder="Your email" required />
              <button class="btn btn--brass" type="submit">Join</button>
            </form>
          </div>
          ${join(
            cols.map(
              (col) => html`
                <div>
                  <h3>${col.title}</h3>
                  <ul>
                    ${join(col.links.map((l) => html`<li><a href="${l.href}">${l.label}</a></li>`))}
                  </ul>
                </div>
              `,
            ),
          )}
        </div>
        <div class="footer__base">
          <p style="margin:0">© ${String(new Date().getFullYear())} EarthTrade. All rights reserved.</p>
          <ul>
            <li><a href="/privacy">Privacy</a></li>
            <li><a href="/terms">Terms</a></li>
            <li><a href="/shipping-returns">Shipping &amp; Returns</a></li>
            <li><a href="/accessibility">Accessibility</a></li>
          </ul>
        </div>
      </div>
    </footer>
  `;
}

export function layout(opts: LayoutOptions, body: Child): string {
  const url = canonical(opts.path);
  const ogImage = opts.image ? (opts.image.startsWith("http") ? opts.image : `${canonical(opts.image)}`) : `${canonical("/images/hero-home.avif")}`;

  const blocks = [organizationLd(), websiteLd(), ...(opts.jsonLd ?? [])];

  const page = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
<meta name="description" content="${opts.description}">
<link rel="canonical" href="${url}">
${opts.noindex ? raw('<meta name="robots" content="noindex,follow">') : raw('<meta name="robots" content="index,follow,max-image-preview:large">')}
<meta name="theme-color" content="#26382f">

<meta property="og:type" content="${opts.type ?? "website"}">
<meta property="og:site_name" content="EarthTrade">
<meta property="og:title" content="${opts.title}">
<meta property="og:description" content="${opts.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${opts.title}">
<meta name="twitter:description" content="${opts.description}">
<meta name="twitter:image" content="${ogImage}">

<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@400;500;600&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@400;500;600&display=swap"></noscript>
<link rel="stylesheet" href="/styles.css">
${jsonLdBlocks(blocks)}
</head>
<body class="${opts.bodyClass ?? ""}">
<a class="skip-link" href="#main">Skip to content</a>
${opts.scrollRail ? raw('<div class="scroll-rail" data-scroll-rail></div>') : ""}
${header(opts)}
<main id="main">${body}</main>
${footer()}
${mobileDrawer()}
${cartDrawer()}
${searchOverlay()}
<script src="/app.js" defer></script>
</body>
</html>`;

  return page.value;
}
