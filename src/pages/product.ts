/** Product detail: gallery, variants, buy panel, deep content, related. */

import { html, join, raw } from "../lib/html.ts";
import type { Product } from "../lib/types.ts";
import { money, priceRange } from "../lib/format.ts";
import { brandIndex, cardName, collectionIndex, getProducts, productPrice } from "../data/catalog.ts";
import { layout } from "../site/layout.ts";
import {
  accordion,
  badges,
  breadcrumbs,
  newsletter,
  productRail,
  recentlyViewed,
  sectionHead,
} from "../site/components.ts";
import { breadcrumbLd, faqLd, productLd } from "../lib/seo.ts";
import { icon } from "../site/icons.ts";

function gallery(p: Product): ReturnType<typeof html> {
  if (!p.images.length) {
    const brand = brandIndex.get(p.brand);
    return html`
      <div class="gallery">
        <div class="gallery__main">
          <div class="card__glyph" aria-hidden="true">
            <b>${cardName(p)}</b>
            <span>${brand?.name ?? "EarthTrade"}</span>
          </div>
        </div>
        <p class="notice">
          Product photography for this item is being synced from the EarthTrade catalog.
        </p>
      </div>
    `;
  }

  const brand = brandIndex.get(p.brand);
  return html`
    <div class="gallery">
      <div class="gallery__main">
        <div class="card__glyph" aria-hidden="true">
          <b>${cardName(p)}</b>
          <span>${brand?.name ?? "EarthTrade"}</span>
        </div>
        <img
          src="${p.images[0]!.src}"
          alt="${p.images[0]!.alt}"
          data-gallery-main
          data-img-fallback
          width="900" height="900"
          fetchpriority="high" decoding="async"
        >
      </div>
      ${p.images.length > 1
        ? html`<div class="gallery__thumbs">
            ${join(
              p.images.map(
                (img, i) => html`
                  <button
                    class="gallery__thumb"
                    type="button"
                    data-gallery-thumb="${img.src}"
                    aria-current="${i === 0 ? "true" : "false"}"
                    aria-label="View image ${String(i + 1)} of ${String(p.images.length)}"
                  >
                    <img src="${img.src}" alt="" loading="lazy" decoding="async" data-img-fallback>
                  </button>
                `,
              ),
            )}
          </div>`
        : raw("")}
    </div>
  `;
}

export function productPage(p: Product): string {
  const brand = brandIndex.get(p.brand);
  const price = productPrice(p);
  const hasVariants = p.variants.length > 1;
  const related = getProducts(p.related ?? []);
  const boughtWith = getProducts(p.boughtWith ?? []).filter((x) => x.handle !== p.handle);

  const addPayload = JSON.stringify({
    handle: p.handle,
    title: cardName(p),
    variantId: p.variants[0]?.id ?? p.handle,
    variantTitle: p.variants[0]?.title ?? "",
    price,
    image: p.images[0]?.src ?? "",
  });

  const viewPayload = JSON.stringify({
    handle: p.handle,
    title: cardName(p),
    price,
    image: p.images[0]?.src ?? "",
  });

  // Use the collection's own title so the crumb reads "SolutionsHOCL", not the
  // handle it is addressed by.
  const parent = p.collections[0] ? collectionIndex.get(p.collections[0]) : undefined;
  const trail = [
    { label: "Home", href: "/" },
    ...(parent ? [{ label: parent.title, href: `/collections/${parent.handle}` }] : []),
    { label: cardName(p), href: `/products/${p.handle}` },
  ];

  const sections: { title: string; content: ReturnType<typeof html> }[] = [];

  sections.push({
    title: "Overview",
    content: html`<div class="prose">${join(p.description.map((para) => html`<p>${para}</p>`))}</div>`,
  });

  if (p.benefits?.length) {
    sections.push({
      title: "Benefits",
      content: html`<ul>${join(p.benefits.map((b) => html`<li>${b}</li>`))}</ul>`,
    });
  }
  if (p.howItWorks?.length) {
    sections.push({
      title: "How it works",
      content: html`<ol>${join(p.howItWorks.map((s) => html`<li>${s}</li>`))}</ol>`,
    });
  }
  if (p.specs?.length) {
    sections.push({
      title: "Specifications",
      content: html`<table class="spec">
        <tbody>
          ${join(p.specs.map(([k, v]) => html`<tr><th scope="row">${k}</th><td>${v}</td></tr>`))}
        </tbody>
      </table>`,
    });
  }
  if (p.included?.length) {
    sections.push({
      title: "What is included",
      content: html`<ul>${join(p.included.map((s) => html`<li>${s}</li>`))}</ul>`,
    });
  }
  if (p.howToUse?.length) {
    sections.push({
      title: "How to use",
      content: html`<ol>${join(p.howToUse.map((s) => html`<li>${s}</li>`))}</ol>`,
    });
  }

  const body = html`
    <div class="section section--tight" data-product-view="${viewPayload}">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="pdp">
          <div>${gallery(p)}</div>

          <div class="pdp__panel">
            <p class="pdp__brand">${brand?.name ?? "EarthTrade"}</p>
            <h1>${p.title}</h1>
            ${p.badges?.length
              ? html`<div class="u-flex u-mb" style="gap:.4rem">
                  ${join((p.badges ?? []).map((b) => html`<span class="badge badge--${b}">${b.replaceAll("-", " ")}</span>`))}
                </div>`
              : raw("")}
            <p class="pdp__benefit">${p.shortBenefit}</p>

            <p class="pdp__price">
              <span data-price>${hasVariants ? priceRange(p.variants.map((v) => v.price)) : money(price)}</span>
            </p>

            ${hasVariants
              ? html`
                  <div class="opt">
                    <p class="opt__label" id="variant-label">Option</p>
                    <div class="opt__row" role="group" aria-labelledby="variant-label">
                      ${join(
                        p.variants.map(
                          (v, i) => html`
                            <button
                              class="opt__btn"
                              type="button"
                              data-variant="${JSON.stringify({ id: v.id, title: v.title, price: v.price })}"
                              aria-pressed="${i === 0 ? "true" : "false"}"
                              ${v.available ? raw("") : raw("disabled")}
                            >${v.title}</button>
                          `,
                        ),
                      )}
                    </div>
                  </div>
                `
              : raw("")}

            <div class="opt">
              <p class="opt__label" id="qty-label">Quantity</p>
              <div class="qty" role="group" aria-labelledby="qty-label">
                <button type="button" data-qty-step="-1" aria-label="Decrease quantity">&minus;</button>
                <label class="visually-hidden" for="qty">Quantity</label>
                <input id="qty" type="number" min="1" value="1" data-qty-input>
                <button type="button" data-qty-step="1" aria-label="Increase quantity">+</button>
              </div>
            </div>

            <div class="pdp__actions" data-buy-anchor>
              <button class="btn" type="button" data-add-to-cart="${addPayload}" data-use-qty>Add to cart</button>
              <button class="btn btn--ghost" type="button" data-add-to-cart="${addPayload}" data-use-qty data-buy-now>Buy now</button>
              <button
                class="icon-btn"
                type="button"
                data-wish="${p.handle}"
                data-wish-title="${cardName(p)}"
                aria-pressed="false"
                aria-label="Save to wishlist"
                style="border:1px solid var(--line);border-radius:2px;width:3rem;height:3rem"
              >${icon("heart")}</button>
            </div>

            ${p.subscription
              ? html`<div class="ship-note">
                  ${icon("refresh")}
                  <div>
                    <strong>Auto-Ship available.</strong> Set a delivery rhythm and the replacement
                    arrives before you run out. Change or pause at any time.
                    ${p.replenish ? html`<br><span class="muted">${p.replenish.note}</span>` : raw("")}
                  </div>
                </div>`
              : raw("")}

            <div class="ship-note">
              ${icon("ship")}
              <div>Free shipping on orders over $75. Orders ship on business days.</div>
            </div>

            ${p.disclaimer ? html`<p class="disclaimer">${p.disclaimer}</p>` : raw("")}
            ${p.pricePlaceholder
              ? html`<p class="notice">
                  Pricing for this item is being synced from the live EarthTrade catalog and is shown
                  here for layout purposes.
                </p>`
              : raw("")}
          </div>
        </div>
      </div>
    </div>

    ${boughtWith.length
      ? html`
          <section class="section section--tight u-cream">
            <div class="wrap">
              ${sectionHead({ eyebrow: "Pairs well", title: "Frequently bought together" })}
              ${productRail(boughtWith)}
            </div>
          </section>
        `
      : raw("")}

    <section class="section">
      <div class="wrap wrap--narrow">
        ${accordion(
          sections.map((s) => ({ q: s.title, a: "" })),
          `pdp-${p.handle}`,
        ).value
          ? raw("")
          : raw("")}
        <div class="acc">
          ${join(
            sections.map(
              (s, i) => html`
                <div class="acc__item">
                  <h2>
                    <button
                      class="acc__btn"
                      type="button"
                      data-acc-btn
                      aria-expanded="${i === 0 ? "true" : "false"}"
                      aria-controls="sec-${String(i)}"
                      id="sec-btn-${String(i)}"
                    >${s.title} ${icon("plus")}</button>
                  </h2>
                  <div
                    class="acc__panel"
                    id="sec-${String(i)}"
                    role="region"
                    aria-labelledby="sec-btn-${String(i)}"
                    data-open="${i === 0 ? "true" : "false"}"
                  >${s.content}</div>
                </div>
              `,
            ),
          )}
        </div>
      </div>
    </section>

    ${p.faqs?.length
      ? html`
          <section class="section section--tight u-sand">
            <div class="wrap wrap--narrow">
              ${sectionHead({ eyebrow: "Questions", title: "Frequently asked" })}
              ${accordion(p.faqs, `faq-${p.handle}`)}
            </div>
          </section>
        `
      : raw("")}

    ${related.length
      ? html`
          <section class="section">
            <div class="wrap">
              ${sectionHead({ eyebrow: "Related", title: "You may also like" })}
              ${productRail(related)}
            </div>
          </section>
        `
      : raw("")}

    ${recentlyViewed()}
    ${newsletter()}

    <div class="sticky-buy" data-sticky-buy data-show="false">
      <div>
        <strong data-sticky-price>${hasVariants ? priceRange(p.variants.map((v) => v.price)) : money(price)}</strong>
        <div class="tiny muted">${cardName(p)}</div>
      </div>
      <button class="btn btn--sm" type="button" data-add-to-cart="${addPayload}" data-use-qty>Add to cart</button>
    </div>
  `;

  return layout(
    {
      title: `${p.title} | EarthTrade`,
      description: p.shortBenefit,
      path: `/products/${p.handle}`,
      type: "product",
      image: p.images[0]?.src,
      jsonLd: [
        productLd(p, brand?.name ?? "EarthTrade"),
        breadcrumbLd(trail),
        ...(p.faqs?.length ? [faqLd(p.faqs)] : []),
      ],
    },
    body,
  );
}
