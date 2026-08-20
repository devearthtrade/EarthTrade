/** Collection template: editorial hero, filter toolbar, grid, education. */

import { html, join, raw } from "../lib/html.ts";
import type { Collection } from "../lib/types.ts";
import {
  brandIndex,
  collectionIndex,
  collectionProducts,
  productPrice,
} from "../data/catalog.ts";
import { layout } from "../site/layout.ts";
import {
  accordion,
  breadcrumbs,
  newsletter,
  productCard,
  recentlyViewed,
  sectionHead,
  trustRow,
} from "../site/components.ts";
import { breadcrumbLd, collectionLd, faqLd } from "../lib/seo.ts";
import { icon } from "../site/icons.ts";

const HERO_IMAGE: Record<string, { src: string; alt: string }> = {
  water: { src: "/images/card-water.avif", alt: "A glass of clear water on a warm stone counter" },
  "water-filtration": { src: "/images/pitcher-bright.avif", alt: "A glass pitcher pouring water in a sunlit kitchen" },
  "life-ionizers": { src: "/images/ionizer-dark.avif", alt: "A dark modern kitchen with water pouring into a glass" },
  "pitcher-of-life": { src: "/images/pitcher-bright.avif", alt: "A glass pitcher pouring water in a sunlit kitchen" },
  solutionshocl: { src: "/images/hocl-editorial.avif", alt: "A tropical home beside a rainwater catchment tank after rain" },
  "cistern-catchment": { src: "/images/hocl-editorial.avif", alt: "A tropical home beside a rainwater catchment tank after rain" },
  "water-tank-care": { src: "/images/hocl-editorial.avif", alt: "A tropical home beside a rainwater catchment tank after rain" },
  "rv-marine": { src: "/images/water-macro.avif", alt: "Clear water flowing over dark volcanic rock" },
  "household-cleaning": { src: "/images/card-clean.avif", alt: "A sunlit kitchen counter with folded linen" },
  "organic-gardening": { src: "/images/hvo-volcanic.avif", alt: "Black volcanic rock giving way to tropical vegetation" },
  wellness: { src: "/images/card-wellness.avif", alt: "A copper vessel and a glass of water on linen" },
  accessories: { src: "/images/card-wellness.avif", alt: "A copper vessel and a glass of water on linen" },
  "best-sellers": { src: "/images/hero-home.avif", alt: "A modern home in a green landscape at golden hour" },
  subscribe: { src: "/images/water-macro.avif", alt: "Clear water flowing over dark volcanic rock" },
};

interface FilterDef {
  label: string;
  tag: string;
}

function buildFilters(c: Collection): FilterDef[] {
  const items = collectionProducts(c);
  const filters: FilterDef[] = [];

  const brandsPresent = [...new Set(items.map((p) => p.brand))];
  if (brandsPresent.length > 1) {
    for (const b of brandsPresent) {
      const info = brandIndex.get(b);
      if (info) filters.push({ label: info.name.replace(/[™®]/g, ""), tag: `brand:${b}` });
    }
  }

  if (items.some((p) => p.subscription) && items.some((p) => !p.subscription)) {
    filters.push({ label: "Auto-Ship", tag: "feature:subscription" });
  }
  if (items.some((p) => p.badges?.includes("best-seller"))) {
    filters.push({ label: "Best sellers", tag: "badge:best-seller" });
  }

  const prices = items.map(productPrice);
  if (Math.max(...prices) - Math.min(...prices) > 60) {
    if (prices.some((p) => p < 50)) filters.push({ label: "Under $50", tag: "price:under-50" });
    if (prices.some((p) => p >= 50 && p < 200)) filters.push({ label: "$50 to $200", tag: "price:50-200" });
    if (prices.some((p) => p >= 200)) filters.push({ label: "$200 and up", tag: "price:200-plus" });
  }

  return filters;
}

export function collectionPage(c: Collection): string {
  const items = collectionProducts(c);
  const filters = buildFilters(c);
  const hero = HERO_IMAGE[c.handle];
  const heroClass =
    c.theme === "dark" ? "phero phero--dark" : c.theme === "volcanic" ? "phero phero--volcanic" : "phero";

  const trail = [
    { label: "Home", href: "/" },
    { label: c.title, href: `/collections/${c.handle}` },
  ];

  const related = (c.related ?? [])
    .map((h) => collectionIndex.get(h))
    .filter((x): x is Collection => Boolean(x));

  const body = html`
    <section class="${heroClass}">
      ${hero
        ? html`<div class="phero__media"><img src="${hero.src}" alt="" loading="eager" decoding="async"></div>`
        : raw("")}
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          ${c.eyebrow ? html`<p class="eyebrow">${c.eyebrow}</p>` : ""}
          <h1>${c.heroTitle ?? c.title}</h1>
          <p class="lede u-mt">${c.description}</p>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap">
        <div class="toolbar">
          <div class="chips" role="group" aria-label="Filter products">
            ${filters.length
              ? join(
                  filters.map(
                    (f) => html`<button class="chip" type="button" data-filter="${f.tag}" aria-pressed="false">${f.label}</button>`,
                  ),
                )
              : html`<span class="count" data-filter-count>${String(items.length)} products</span>`}
          </div>
          <div class="u-flex">
            ${filters.length ? html`<span class="count" data-filter-count>${String(items.length)} products</span>` : ""}
            <label class="visually-hidden" for="sort">Sort products</label>
            <select class="select" id="sort" data-sort>
              <option value="featured">Featured</option>
              <option value="price-asc">Price, low to high</option>
              <option value="price-desc">Price, high to low</option>
              <option value="name">Name, A to Z</option>
            </select>
          </div>
        </div>

        <div class="grid grid--4" data-filter-grid>
          ${join(items.map((p, i) => productCard(p, { order: i })))}
        </div>

        <div class="empty" data-filter-empty hidden>
          <h3>No products match those filters</h3>
          <p>Clear a filter to widen the results, or let the quiz narrow the whole range down for you.</p>
          <div class="u-mt"><a class="btn btn--ghost" href="/quiz">Find your solution</a></div>
        </div>
      </div>
    </section>

    ${c.editorial?.length
      ? html`
          <section class="section u-cream">
            <div class="wrap">
              <div class="split split--wide-text">
                <div data-reveal>
                  <p class="eyebrow">Good to know</p>
                  <h2>About ${c.title}</h2>
                </div>
                <div class="prose" data-reveal>
                  ${join(c.editorial.map((para) => html`<p>${para}</p>`))}
                </div>
              </div>
            </div>
          </section>
        `
      : raw("")}

    ${c.faqs?.length
      ? html`
          <section class="section">
            <div class="wrap wrap--narrow">
              ${sectionHead({ eyebrow: "Questions", title: "Before you choose" })}
              ${accordion(c.faqs, `faq-${c.handle}`)}
            </div>
          </section>
        `
      : raw("")}

    ${related.length
      ? html`
          <section class="section section--tight">
            <div class="wrap">
              ${sectionHead({ eyebrow: "Keep exploring", title: "Related collections" })}
              <div class="grid grid--3">
                ${join(
                  related.map(
                    (r) => html`
                      <a class="post post--tile" href="/collections/${r.handle}" data-reveal>
                        <div>
                          <p class="post__cat">${r.eyebrow ?? "Collection"}</p>
                          <h3 style="margin-top:.5rem">${r.title}</h3>
                          <p class="u-mt">${r.description}</p>
                        </div>
                        <span class="link">View ${icon("arrow")}</span>
                      </a>
                    `,
                  ),
                )}
              </div>
            </div>
          </section>
        `
      : raw("")}

    <section class="section section--tight">
      <div class="wrap">${trustRow()}</div>
    </section>

    ${recentlyViewed()}
    ${newsletter()}
  `;

  return layout(
    {
      title: `${c.title} | EarthTrade`,
      description: c.description,
      path: `/collections/${c.handle}`,
      image: hero?.src,
      jsonLd: [
        collectionLd(c, items),
        breadcrumbLd(trail),
        ...(c.faqs?.length ? [faqLd(c.faqs)] : []),
      ],
    },
    body,
  );
}
