/** Education hub, journal index, category pages and article template. */

import { html, join, raw } from "../lib/html.ts";
import type { Article, ArticleCategory } from "../lib/types.ts";
import { displayDate } from "../lib/format.ts";
import { getProducts } from "../data/catalog.ts";
import { layout } from "../site/layout.ts";
import {
  breadcrumbs,
  newsletter,
  productRail,
  sectionHead,
} from "../site/components.ts";
import { articleLd, breadcrumbLd } from "../lib/seo.ts";
import { icon } from "../site/icons.ts";

export const CATEGORY_META: Record<
  ArticleCategory,
  { title: string; blurb: string; image: string; related: string[] }
> = {
  water: {
    title: "Water",
    blurb:
      "Filtration, alkaline water, ionizers and the replacement filters that keep a system honest.",
    image: "/images/pitcher-bright.avif",
    related: ["life-ionizer-mxl-9", "pitcher-of-life-2nd-generation", "life-mxl-replacement-filter"],
  },
  rainwater: {
    title: "Rainwater & Tanks",
    blurb: "Cistern care, catchment maintenance and keeping tank surfaces free of buildup.",
    image: "/images/hocl-editorial.avif",
    related: ["cistern-catchment-bomb", "catchment-bomb", "active-chlorine-test-strips-50"],
  },
  home: {
    title: "Home Care",
    blurb: "Cleaning that works on the surfaces you actually live with, without the bleach cabinet.",
    image: "/images/card-clean.avif",
    related: ["toilet-bomb-fragrance-free", "super-wash-500ppm", "hocl-general-purpose-cleaner-spray"],
  },
  gardening: {
    title: "Gardening",
    blurb: "Compost, bokashi, soil structure and the microbial life that makes a garden productive.",
    image: "/images/journal-soil.avif",
    related: [
      "hawaiian-bokashi-compost-starter",
      "hawaiian-bokashi-inoculant",
      "inoculant-liquid-concentrate",
    ],
  },
  sustainability: {
    title: "Sustainability",
    blurb: "Buying less, buying better, and the quiet math of shipping concentrate instead of water.",
    image: "/images/journal-rain.avif",
    related: ["solutions-hocl-cleaner-10-grams", "powerwash-30days-supply"],
  },
  guides: {
    title: "Guides",
    blurb: "Step-by-step walkthroughs for the jobs that come up more than once.",
    image: "/images/water-macro.avif",
    related: ["active-chlorine-test-strips-50", "life-mxl-replacement-filter"],
  },
};

/** Deterministic editorial image per article, so the grid stays varied. */
function articleImage(a: Article, index: number): string {
  if (a.image?.src) return a.image.src;
  const pool = [
    "/images/journal-soil.avif",
    "/images/journal-rain.avif",
    "/images/water-macro.avif",
    "/images/card-clean.avif",
    "/images/card-water.avif",
    "/images/hocl-editorial.avif",
  ];
  return pool[index % pool.length]!;
}

function articleCard(a: Article, index: number) {
  return html`
    <a class="post" href="/journal/${a.slug}" data-reveal style="--reveal-delay:${String((index % 3) * 0.06)}s">
      <div class="post__media">
        <img src="${articleImage(a, index)}" alt="" loading="lazy" decoding="async">
      </div>
      <div>
        <p class="post__cat">${CATEGORY_META[a.category].title}</p>
        <h3 style="margin-top:.4rem">${a.title}</h3>
        <p class="u-mt">${a.excerpt}</p>
        <p class="post__meta u-mt">${displayDate(a.date)} · ${String(a.readingMinutes)} min read</p>
      </div>
    </a>
  `;
}

/* ------------------------------ learn hub -------------------------------- */

export function learnPage(articles: Article[]): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Learn", href: "/learn" },
  ];

  const groups = (Object.keys(CATEGORY_META) as ArticleCategory[])
    .map((key) => ({ key, meta: CATEGORY_META[key], items: articles.filter((a) => a.category === key) }))
    .filter((g) => g.items.length > 0);

  const body = html`
    <section class="phero">
      <div class="phero__media"><img src="/images/water-macro.avif" alt="" decoding="async"></div>
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Education hub</p>
          <h1>Understand it before you buy it</h1>
          <p class="lede u-mt">
            Practical guidance on water, tanks, home care and soil. Written to be useful whether you
            buy from us or not.
          </p>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap">
        <div class="grid grid--3">
          ${join(
            groups.map(
              (g) => html`
                <a class="solution" href="/learn/${g.key}" data-reveal style="min-height:18rem">
                  <img src="${g.meta.image}" alt="" loading="lazy" decoding="async">
                  <h3>${g.meta.title}</h3>
                  <p>${g.meta.blurb}</p>
                  <span class="link">${String(g.items.length)} articles ${icon("arrow")}</span>
                </a>
              `,
            ),
          )}
        </div>
      </div>
    </section>

    ${join(
      groups.map(
        (g, i) => html`
          <section class="section ${i % 2 === 1 ? "u-cream" : ""}">
            <div class="wrap">
              ${sectionHead({
                eyebrow: "Education hub",
                title: g.meta.title,
                lede: g.meta.blurb,
                action: { label: "All articles", href: `/learn/${g.key}` },
              })}
              <div class="grid grid--3">
                ${join(g.items.slice(0, 3).map((a, n) => articleCard(a, n)))}
              </div>
            </div>
          </section>
        `,
      ),
    )}

    ${newsletter()}
  `;

  return layout(
    {
      title: "Education Hub | EarthTrade",
      description:
        "Guides on water filtration, alkaline water, cistern and catchment care, home cleaning and building living soil.",
      path: "/learn",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

export function learnCategoryPage(category: ArticleCategory, articles: Article[]): string {
  const meta = CATEGORY_META[category];
  const items = articles.filter((a) => a.category === category);
  const trail = [
    { label: "Home", href: "/" },
    { label: "Learn", href: "/learn" },
    { label: meta.title, href: `/learn/${category}` },
  ];
  const related = getProducts(meta.related);

  const body = html`
    <section class="phero">
      <div class="phero__media"><img src="${meta.image}" alt="" decoding="async"></div>
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Education hub</p>
          <h1>${meta.title}</h1>
          <p class="lede u-mt">${meta.blurb}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="grid grid--3">${join(items.map((a, i) => articleCard(a, i)))}</div>
      </div>
    </section>

    ${related.length
      ? html`
          <section class="section u-cream">
            <div class="wrap">
              ${sectionHead({ eyebrow: "Related products", title: `Shop ${meta.title.toLowerCase()}` })}
              ${productRail(related)}
            </div>
          </section>
        `
      : raw("")}

    ${newsletter()}
  `;

  return layout(
    {
      title: `${meta.title} Guides | EarthTrade`,
      description: meta.blurb,
      path: `/learn/${category}`,
      image: meta.image,
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* ------------------------------- journal --------------------------------- */

export function journalPage(articles: Article[]): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Journal", href: "/journal" },
  ];
  const [lead, ...rest] = articles;

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">The Journal</p>
          <h1>Notes on living well</h1>
          <p class="lede u-mt">
            Water, home, garden and the thinking behind the products. A slower read than a product
            page, and usually more useful.
          </p>
        </div>
      </div>
    </section>

    ${lead
      ? html`
          <section class="section section--tight">
            <div class="wrap">
              <a class="split" href="/journal/${lead.slug}" style="text-decoration:none" data-reveal>
                <div class="figure figure--wide">
                  <img src="${articleImage(lead, 0)}" alt="" decoding="async">
                </div>
                <div>
                  <p class="eyebrow">${CATEGORY_META[lead.category].title} · Latest</p>
                  <h2>${lead.title}</h2>
                  <p class="lede u-mt">${lead.excerpt}</p>
                  <p class="post__meta u-mt">${displayDate(lead.date)} · ${String(lead.readingMinutes)} min read</p>
                  <span class="link u-mt-lg" style="display:inline-flex">Read the article ${icon("arrow")}</span>
                </div>
              </a>
            </div>
          </section>
        `
      : raw("")}

    <section class="section">
      <div class="wrap">
        <div class="grid grid--3">${join(rest.map((a, i) => articleCard(a, i + 1)))}</div>
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "The Journal | EarthTrade",
      description:
        "Editorial on water, tank care, home cleaning, organic gardening and sustainable living from EarthTrade.",
      path: "/journal",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

export function articlePage(a: Article, all: Article[]): string {
  const meta = CATEGORY_META[a.category];
  const trail = [
    { label: "Home", href: "/" },
    { label: "Journal", href: "/journal" },
    { label: a.title, href: `/journal/${a.slug}` },
  ];
  const index = all.findIndex((x) => x.slug === a.slug);
  const more = all.filter((x) => x.slug !== a.slug && x.category === a.category).slice(0, 3);
  const related = getProducts(meta.related);

  const body = html`
    <article>
      <section class="phero">
        <div class="phero__media"><img src="${articleImage(a, Math.max(index, 0))}" alt="" decoding="async"></div>
        <div class="wrap">
          ${breadcrumbs(trail)}
          <div class="phero__inner">
            <p class="eyebrow">${meta.title}</p>
            <h1>${a.title}</h1>
            <p class="lede u-mt">${a.excerpt}</p>
            <p class="post__meta u-mt">${displayDate(a.date)} · ${String(a.readingMinutes)} min read</p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap wrap--narrow">
          <div class="prose">${raw(a.body)}</div>
          <div class="rule"></div>
          <p class="tiny muted">
            Published ${displayDate(a.date)} in
            <a href="/learn/${a.category}">${meta.title}</a>.
          </p>
        </div>
      </section>
    </article>

    ${related.length
      ? html`
          <section class="section u-cream">
            <div class="wrap">
              ${sectionHead({ eyebrow: "Mentioned in this piece", title: "Related products" })}
              ${productRail(related)}
            </div>
          </section>
        `
      : raw("")}

    ${more.length
      ? html`
          <section class="section">
            <div class="wrap">
              ${sectionHead({
                eyebrow: "Keep reading",
                title: `More on ${meta.title.toLowerCase()}`,
                action: { label: "All articles", href: "/journal" },
              })}
              <div class="grid grid--3">${join(more.map((x, i) => articleCard(x, i)))}</div>
            </div>
          </section>
        `
      : raw("")}

    ${newsletter()}
  `;

  return layout(
    {
      title: `${a.title} | EarthTrade Journal`,
      description: a.excerpt,
      path: `/journal/${a.slug}`,
      type: "article",
      image: articleImage(a, Math.max(index, 0)),
      scrollRail: true,
      jsonLd: [articleLd(a), breadcrumbLd(trail)],
    },
    body,
  );
}
