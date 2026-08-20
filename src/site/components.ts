/** Reusable presentational pieces shared across page templates. */

import { html, join, raw, type Child, type SafeHtml } from "../lib/html.ts";
import { money, priceRange } from "../lib/format.ts";
import type { Badge, FaqItem, Product } from "../lib/types.ts";
import { brandIndex, cardName, productPrice } from "../data/catalog.ts";
import { icon } from "./icons.ts";

const BADGE_LABEL: Record<Badge, string> = {
  "best-seller": "Best Seller",
  new: "New",
  premium: "Premium",
  organic: "Organic",
  popular: "Popular",
  subscription: "Subscribe & Save",
};

export function badges(list: Badge[] | undefined, limit = 1): SafeHtml {
  if (!list?.length) return raw("");
  return html`<div class="card__badges">
    ${join(
      list
        .slice(0, limit)
        .map((b) => html`<span class="badge badge--${b}">${BADGE_LABEL[b]}</span>`),
    )}
  </div>`;
}

/**
 * Product imagery falls back to a typographic tile when no photograph has
 * been synced. Never substitute a generated image for a real product.
 */
function cardMedia(p: Product): SafeHtml {
  const image = p.images[0];
  if (image) {
    return html`<img src="${image.src}" alt="${image.alt}" loading="lazy" decoding="async" width="600" height="750">`;
  }
  const brand = brandIndex.get(p.brand);
  return html`<div class="card__glyph" aria-hidden="true">
    <b>${cardName(p)}</b>
    <span>${brand?.name ?? "EarthTrade"}</span>
  </div>`;
}

export interface CardOptions {
  /** Grid ordering index, used by client-side sort to restore "featured". */
  order?: number;
  eager?: boolean;
}

export function productCard(p: Product, opts: CardOptions = {}): SafeHtml {
  const brand = brandIndex.get(p.brand);
  const price = productPrice(p);
  const compare = p.variants.find((v) => v.compareAt)?.compareAt;
  const addPayload = JSON.stringify({
    handle: p.handle,
    title: cardName(p),
    variantId: p.variants[0]?.id ?? p.handle,
    variantTitle: p.variants[0]?.title ?? "",
    price,
    image: p.images[0]?.src ?? "",
  });

  const tags = [
    `brand:${p.brand}`,
    `category:${p.category}`,
    ...(p.subscription ? ["feature:subscription"] : []),
    ...(p.badges ?? []).map((b) => `badge:${b}`),
    price < 50 ? "price:under-50" : price < 200 ? "price:50-200" : "price:200-plus",
  ].join(" ");

  return html`
    <article
      class="card"
      data-card
      data-tags="${tags}"
      data-price="${String(price)}"
      data-name="${cardName(p)}"
      data-order="${String(opts.order ?? 0)}"
    >
      <div class="card__media">
        ${badges(p.badges)}
        <button
          class="card__wish"
          type="button"
          data-wish="${p.handle}"
          data-wish-title="${cardName(p)}"
          aria-pressed="false"
          aria-label="Save ${cardName(p)} to wishlist"
        >${icon("heart")}</button>
        ${cardMedia(p)}
      </div>
      <div class="card__body">
        <p class="card__brand">${brand?.name ?? "EarthTrade"}</p>
        <h3 class="card__title"><a href="/products/${p.handle}">${cardName(p)}</a></h3>
        <p class="card__benefit">${p.shortBenefit}</p>
        <div class="card__foot">
          <span class="card__price">
            ${compare ? html`<s>${money(compare)}</s>` : ""}${priceRange(p.variants.map((v) => v.price))}
          </span>
          <button class="card__add" type="button" data-add-to-cart="${addPayload}">Quick add</button>
        </div>
        ${p.subscription ? html`<p class="card__note">Auto-Ship available</p>` : ""}
      </div>
    </article>
  `;
}

export function productGrid(items: Product[], className = "grid grid--4"): SafeHtml {
  return html`<div class="${className}" data-filter-grid>
    ${join(items.map((p, i) => productCard(p, { order: i })))}
  </div>`;
}

/** Product rail: horizontal scroll on mobile, grid from large screens up. */
export function productRail(items: Product[]): SafeHtml {
  return html`<div class="rail">${join(items.map((p, i) => productCard(p, { order: i })))}</div>`;
}

export interface HeadOptions {
  eyebrow?: string;
  title: string;
  lede?: string;
  action?: { label: string; href: string };
  center?: boolean;
}

export function sectionHead(opts: HeadOptions): SafeHtml {
  const body = html`
    <div>
      ${opts.eyebrow ? html`<p class="eyebrow">${opts.eyebrow}</p>` : ""}
      <h2>${opts.title}</h2>
      ${opts.lede ? html`<p class="lede">${opts.lede}</p>` : ""}
    </div>
  `;
  return html`
    <div class="head ${opts.center ? "u-center" : ""}" data-reveal>
      ${opts.action
        ? html`<div class="head__row">
            ${body}
            <a class="link" href="${opts.action.href}">${opts.action.label} ${icon("arrow")}</a>
          </div>`
        : body}
    </div>
  `;
}

export function accordion(items: FaqItem[], idPrefix: string): SafeHtml {
  return html`<div class="acc">
    ${join(
      items.map(
        (item, i) => html`
          <div class="acc__item">
            <h3>
              <button
                class="acc__btn"
                type="button"
                data-acc-btn
                aria-expanded="${i === 0 ? "true" : "false"}"
                aria-controls="${idPrefix}-${String(i)}"
                id="${idPrefix}-btn-${String(i)}"
              >
                ${item.q} ${icon("plus")}
              </button>
            </h3>
            <div
              class="acc__panel"
              id="${idPrefix}-${String(i)}"
              role="region"
              aria-labelledby="${idPrefix}-btn-${String(i)}"
              data-open="${i === 0 ? "true" : "false"}"
            >
              <p>${item.a}</p>
            </div>
          </div>
        `,
      ),
    )}
  </div>`;
}

export function breadcrumbs(trail: { label: string; href: string }[]): SafeHtml {
  return html`
    <nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        ${join(
          trail.map((item, i) =>
            i === trail.length - 1
              ? html`<li><span aria-current="page">${item.label}</span></li>`
              : html`<li><a href="${item.href}">${item.label}</a></li>`,
          ),
        )}
      </ol>
    </nav>
  `;
}

export function trustRow(): SafeHtml {
  const items: { icon: string; title: string; text: string }[] = [
    {
      icon: "ship",
      title: "Free shipping over $75",
      text: "Flat rate below that, calculated at checkout.",
    },
    {
      icon: "refresh",
      title: "Auto-Ship on consumables",
      text: "Filters and cleaners arrive before you run out. Change or pause anytime.",
    },
    {
      icon: "shield",
      title: "Warranty-backed systems",
      text: "Life Ionizer MXL-9 and above carry a guaranteed lifetime warranty.",
    },
    {
      icon: "support",
      title: "Help choosing",
      text: "Not sure which product fits? The quiz narrows it down in a minute.",
    },
  ];

  return html`<div class="trust" data-reveal>
    ${join(
      items.map(
        (item) => html`
          <div>
            ${icon(item.icon)}
            <div>
              <h3>${item.title}</h3>
              <p>${item.text}</p>
            </div>
          </div>
        `,
      ),
    )}
  </div>`;
}

export function newsletter(): SafeHtml {
  return html`
    <section class="section news">
      <div class="wrap">
        <div class="split split--wide-text">
          <div data-reveal>
            <p class="eyebrow">The EarthTrade letter</p>
            <h2>Better living, once a month</h2>
          </div>
          <div data-reveal>
            <p class="lede" style="color:rgba(250,249,245,.82)">
              Practical guidance on water, tanks, home care and soil. Plus early access to new
              products and member offers. No noise.
            </p>
            <form class="inline-form u-mt" data-newsletter>
              <label class="visually-hidden" for="news-email">Email address</label>
              <input id="news-email" type="email" name="email" placeholder="Your email" required />
              <button class="btn btn--brass" type="submit">Subscribe</button>
            </form>
            <p class="tiny u-mt">Unsubscribe at any time. We never share your address.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

/** Recently viewed rail, populated client-side from localStorage. */
export function recentlyViewed(): SafeHtml {
  return html`
    <section class="section section--tight" data-recent-host hidden>
      <div class="wrap">
        ${sectionHead({ eyebrow: "Pick up where you left off", title: "Recently viewed" })}
        <div class="grid grid--4" data-recent-grid></div>
      </div>
    </section>
  `;
}

export function relatedProducts(items: Product[], title = "You may also like"): SafeHtml {
  if (!items.length) return raw("");
  return html`
    <section class="section">
      <div class="wrap">
        ${sectionHead({ eyebrow: "Complete the system", title })}
        ${productRail(items)}
      </div>
    </section>
  `;
}

/** A simple two-column editorial block with an image and copy. */
export interface EditorialOptions {
  eyebrow?: string;
  title: string;
  body: Child;
  image?: { src: string; alt: string };
  action?: { label: string; href: string };
  mediaRight?: boolean;
  tone?: "" | "feature--dark" | "feature--cream" | "feature--sand" | "feature--volcanic";
}

export function editorial(opts: EditorialOptions): SafeHtml {
  const media = opts.image
    ? html`<div class="figure figure--wide" data-reveal>
        <img src="${opts.image.src}" alt="${opts.image.alt}" loading="lazy" decoding="async">
      </div>`
    : raw("");

  return html`
    <section class="section feature ${opts.tone ?? ""}">
      <div class="wrap">
        <div class="split ${opts.mediaRight ? "split--media-right" : ""}">
          ${media}
          <div data-reveal>
            ${opts.eyebrow ? html`<p class="eyebrow">${opts.eyebrow}</p>` : ""}
            <h2>${opts.title}</h2>
            <div class="lede u-mt">${opts.body}</div>
            ${opts.action
              ? html`<div class="u-mt-lg"><a class="btn" href="${opts.action.href}">${opts.action.label}</a></div>`
              : ""}
          </div>
        </div>
      </div>
    </section>
  `;
}
