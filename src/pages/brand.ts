/** Brand story pages and the brand index. */

import { html, join, raw } from "../lib/html.ts";
import type { BrandInfo } from "../lib/types.ts";
import { brands, collectionIndex, collectionProducts, products } from "../data/catalog.ts";
import { layout } from "../site/layout.ts";
import {
  breadcrumbs,
  newsletter,
  productRail,
  sectionHead,
  trustRow,
} from "../site/components.ts";
import { breadcrumbLd } from "../lib/seo.ts";
import { icon } from "../site/icons.ts";

const BRAND_IMAGE: Record<string, { src: string; alt: string }> = {
  solutionshocl: {
    src: "/images/hocl-editorial.avif",
    alt: "A tropical home beside a round rainwater catchment tank after rain",
  },
  "life-ionizers": {
    src: "/images/ionizer-dark.avif",
    alt: "A dark modern kitchen at dusk with water pouring into a clear glass",
  },
  "pitcher-of-life": {
    src: "/images/pitcher-bright.avif",
    alt: "Morning light in a minimalist kitchen as a glass pitcher pours water",
  },
  "hawaiian-volcanic-organic": {
    src: "/images/hvo-volcanic.avif",
    alt: "Black volcanic rock giving way to lush tropical vegetation",
  },
  "life-sciences-water": {
    src: "/images/water-macro.avif",
    alt: "Clear water flowing over dark volcanic basalt rock",
  },
};

export function brandPage(b: BrandInfo): string {
  const image = BRAND_IMAGE[b.id];
  const items = b.collectionHandle
    ? collectionProducts(collectionIndex.get(b.collectionHandle)!).slice(0, 8)
    : products.filter((p) => p.brand === b.id).slice(0, 8);

  const heroClass =
    b.theme === "dark"
      ? "phero phero--dark"
      : b.theme === "volcanic"
        ? "phero phero--volcanic"
        : "phero";

  const trail = [
    { label: "Home", href: "/" },
    { label: "Brands", href: "/brands" },
    { label: b.name, href: `/brands/${b.id}` },
  ];

  const body = html`
    <section class="${heroClass}">
      ${image ? html`<div class="phero__media"><img src="${image.src}" alt="" decoding="async"></div>` : raw("")}
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">EarthTrade brand</p>
          <h1>${b.name}</h1>
          <p class="lede u-mt">${b.tagline}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="split split--wide-text">
          <div data-reveal>
            <p class="eyebrow">The story</p>
            <h2>${b.summary}</h2>
          </div>
          <div class="prose" data-reveal>
            ${join(b.story.map((para) => html`<p>${para}</p>`))}
            ${b.collectionHandle
              ? html`<div class="u-mt-lg">
                  <a class="btn" href="/collections/${b.collectionHandle}">Shop ${b.name.replace(/[™®]/g, "")}</a>
                </div>`
              : raw("")}
          </div>
        </div>
      </div>
    </section>

    ${items.length
      ? html`
          <section class="section u-cream">
            <div class="wrap">
              ${sectionHead({
                eyebrow: "The range",
                title: `Shop ${b.name.replace(/[™®]/g, "")}`,
                ...(b.collectionHandle
                  ? { action: { label: "View all", href: `/collections/${b.collectionHandle}` } }
                  : {}),
              })}
              ${productRail(items)}
            </div>
          </section>
        `
      : raw("")}

    <section class="section section--tight">
      <div class="wrap">${trustRow()}</div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: `${b.name} | EarthTrade`,
      description: b.summary,
      path: `/brands/${b.id}`,
      image: image?.src,
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

export function brandsIndexPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Brands", href: "/brands" },
  ];

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Our brands</p>
          <h1>Five brands, one standard</h1>
          <p class="lede u-mt">
            EarthTrade brings together the makers we would use ourselves, each solving a specific
            part of living well: water, home, garden and the everyday objects in between.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="stagger">
          ${join(
            brands.map((b) => {
              const image = BRAND_IMAGE[b.id];
              return html`
                <a class="solution" href="/brands/${b.id}" data-reveal style="min-height:clamp(24rem,44vw,34rem)">
                  ${image ? html`<img src="${image.src}" alt="${image.alt}" loading="lazy" decoding="async">` : raw("")}
                  <p class="eyebrow" style="color:rgba(250,249,245,.75)">${b.tagline}</p>
                  <h3>${b.name}</h3>
                  <p>${b.summary}</p>
                  <span class="link">Read the story ${icon("arrow")}</span>
                </a>
              `;
            }),
          )}
        </div>
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "Our Brands | EarthTrade",
      description:
        "Life Ionizers, Pitcher of Life, SolutionsHOCL, Hawaiian Volcanic Organic and Life Sciences Water, brought together under EarthTrade.",
      path: "/brands",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}
