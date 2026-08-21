/** Homepage: an art-directed sequence, each section earning its place. */

import { html, join, raw } from "../lib/html.ts";
import type { Article } from "../lib/types.ts";
import {
  bundles,
  sellableBundles,
  collectionIndex,
  collectionProducts,
  getProducts,
} from "../data/catalog.ts";
import { layout } from "../site/layout.ts";
import {
  newsletter,
  productRail,
  sectionHead,
  trustRow,
} from "../site/components.ts";
import { icon } from "../site/icons.ts";
import { displayDate } from "../lib/format.ts";

const SOLUTIONS = [
  {
    title: "Better Water",
    text: "Filtration, ionizers and alkaline pitchers, from the kitchen counter to a whole-home system.",
    href: "/collections/water",
    image: "/images/card-water.avif",
    alt: "A glass of clear water on a warm travertine counter in soft window light",
  },
  {
    title: "Cleaner Living",
    text: "High-performance cleaners for tanks, bathrooms and the whole home. Bleach-free and phosphate-free.",
    href: "/collections/solutionshocl",
    image: "/images/card-clean.avif",
    alt: "A sunlit kitchen counter with folded linen and a spotless ceramic surface",
  },
  {
    title: "Organic Gardening",
    text: "Bokashi, compost starters and microbial inoculants that build living soil.",
    href: "/collections/organic-gardening",
    image: "/images/card-garden.avif",
    alt: "A young green seedling emerging from rich dark volcanic soil",
  },
  {
    title: "Natural Wellness",
    text: "Copper vessels and everyday pieces made to last, chosen to pair with the water range.",
    href: "/collections/wellness",
    image: "/images/card-wellness.avif",
    alt: "A copper water vessel and a glass of water resting on natural linen",
  },
];

/** Condensed warranty table shown inside the dark ionizer feature. */
const heroCompareRows = [
  { model: "MXL-7", plates: "7", warranty: "Lifetime parts, 10 years labor" },
  { model: "MXL-9", plates: "9", warranty: "Guaranteed lifetime" },
  { model: "MXL-11", plates: "11", warranty: "Guaranteed lifetime" },
  { model: "MXL-15", plates: "15", warranty: "Guaranteed lifetime" },
];

const WATER_FLOW = [
  { title: "Source", text: "Municipal, well, or rainwater catchment. Everything downstream starts here." },
  { title: "Filtration", text: "Reduce chlorine taste, sediment and heavy metals before anything else." },
  { title: "Conditioning", text: "Add back calcium, magnesium and potassium minerals for taste and balance." },
  { title: "Ionization", text: "Alkaline water on demand, at the pH range you choose." },
  { title: "Every day", text: "Replacement filters on Auto-Ship, so performance never quietly drops off." },
];

export function homePage(articles: Article[]): string {
  const bestSellers = collectionProducts(collectionIndex.get("best-sellers")!).slice(0, 8);
  const hoclFeature = getProducts([
    "cistern-catchment-bomb",
    "toilet-bomb-fragrance-free",
    "super-wash-500ppm",
    "active-chlorine-test-strips-50",
  ]);
  const ionizers = getProducts(["life-ionizer-mxl-9", "life-ionizer-mxl-15", "life-ionizer-mxl-11"]);
  const pitchers = getProducts([
    "pitcher-of-life-2nd-generation",
    "pitcher-with-copper-bottle",
    "pitcher-of-life-replacement-filter-3pack",
  ]);
  const garden = getProducts([
    "hawaiian-bokashi-compost-starter",
    "hawaiian-bokashi-inoculant",
    "inoculant-liquid-concentrate",
  ]);
  const journal = articles.slice(0, 3);

  const body = html`
    <!-- Hero -->
    <section class="hero">
      <div class="hero__media">
        <img
          src="/images/hero-home.avif"
          alt="A modern home in cream stone and dark timber set in a green landscape at golden hour, with a still reflecting pool"
          width="2048" height="878" fetchpriority="high" decoding="async"
        >
      </div>
      <div class="wrap hero__inner">
        <div class="hero__copy">
          <p class="eyebrow">Water · Home · Garden · Wellness</p>
          <h1>Better Solutions<br>for Living Well.</h1>
          <p class="hero__sub">
            Premium solutions for water, home, wellness and organic living. Five brands, chosen
            and organized so you can find the one that fits.
          </p>
          <div class="hero__cta">
            <a class="btn btn--light" href="/collections/best-sellers">Explore EarthTrade</a>
            <a class="btn btn--outline-light" href="/quiz">Find your solution</a>
          </div>
        </div>
        <div class="hero__meta">
          <div><strong>5</strong><span>Brands under one roof</span></div>
          <div><strong>MXL-5 to 15</strong><span>Life Ionizer range</span></div>
          <div><strong>8.5 to 9.5 pH</strong><span>Pitcher of Life output</span></div>
          <div><strong>34</strong><span>Minerals in HVO glauconite</span></div>
        </div>
      </div>
    </section>

    <!-- Trust -->
    <section class="section section--tight">
      <div class="wrap">${trustRow()}</div>
    </section>

    <!-- Shop by solution -->
    <section class="section u-cream">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "Shop by solution",
          title: "Start with the problem, not the product",
          lede: "Four ways into the range. Each one leads to the products built for that job, and the guidance to choose between them.",
        })}
        <div class="grid grid--2">
          ${join(
            SOLUTIONS.map(
              (s, i) => html`
                <a class="solution" href="${s.href}" data-reveal style="--reveal-delay:${String(i * 0.07)}s">
                  <img src="${s.image}" alt="${s.alt}" loading="lazy" decoding="async">
                  <h3>${s.title}</h3>
                  <p>${s.text}</p>
                  <span class="link">Explore ${icon("arrow")}</span>
                </a>
              `,
            ),
          )}
        </div>
      </div>
    </section>

    <!-- Best sellers -->
    <section class="section">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "Most reordered",
          title: "Best sellers",
          lede: "The products customers come back for, across all five brands.",
          action: { label: "Shop all", href: "/collections/best-sellers" },
        })}
        ${productRail(bestSellers)}
      </div>
    </section>

    <!-- SolutionsHOCL editorial -->
    <section class="section feature feature--dark">
      <div class="wrap">
        <div class="split">
          <div class="figure figure--wide" data-reveal>
            <img
              src="/images/hocl-editorial.avif"
              alt="A modern tropical home beside a round rainwater catchment tank, vegetation glistening after rain"
              loading="lazy" decoding="async"
            >
          </div>
          <div data-reveal>
            <p class="eyebrow">SolutionsHOCL</p>
            <h2>A Smarter Approach to Clean.</h2>
            <p class="lede u-mt">
              HOCL works through a Powerful Deep Cleaning Oxidation Technology™ to break down
              contaminant residue. It arrives as concentrated powder rather than a bottle of
              shipped water, so you mix at full strength whenever you need it.
            </p>
            <div class="grid grid--2 u-mt-lg" style="gap:1.25rem">
              ${join(
                [
                  { i: "tank", t: "Cistern & Catchment", d: "Tank walls and interior surfaces" },
                  { i: "home", t: "Toilet & Bath", d: "Drop-in treatments, no scrubbing" },
                  { i: "spray", t: "Everyday Cleaning", d: "One packet makes a gallon" },
                  { i: "beaker", t: "Test Strips", d: "Confirm your mix, 0 to 1000 PPM" },
                ].map(
                  (item) => html`
                    <div style="display:flex;gap:.8rem;align-items:flex-start">
                      <span style="color:var(--brass);flex:none">${icon(item.i, 22)}</span>
                      <div>
                        <h3 style="font-family:var(--sans);font-size:.92rem;font-weight:600;color:var(--warm-white)">${item.t}</h3>
                        <p style="font-size:.82rem;margin:.2rem 0 0;color:rgba(250,249,245,.7)">${item.d}</p>
                      </div>
                    </div>
                  `,
                ),
              )}
            </div>
            <div class="u-flex u-mt-lg">
              <a class="btn btn--light" href="/collections/solutionshocl">Explore SolutionsHOCL</a>
              <a class="link" style="border-color:rgba(250,249,245,.35)" href="/learn/rainwater">Tank care guides ${icon("arrow")}</a>
            </div>
          </div>
        </div>
        <div class="u-mt-lg">${productRail(hoclFeature)}</div>
      </div>
    </section>

    <!-- Water technology flow -->
    <section class="section feature feature--cream">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "The water ecosystem",
          title: "From source to glass",
          lede: "Every product in the water range sits at one step of the same path. Knowing which step you are solving for makes the choice obvious.",
        })}
        <div class="flow">
          ${join(
            WATER_FLOW.map(
              (step, i) => html`
                <div class="flow__step" data-reveal style="--reveal-delay:${String(i * 0.06)}s">
                  <h3>${step.title}</h3>
                  <p>${step.text}</p>
                </div>
              `,
            ),
          )}
        </div>
        <div class="u-flex u-mt-lg">
          <a class="btn" href="/collections/water">Explore water solutions</a>
          <a class="btn btn--ghost" href="/build-your-system">Build your system</a>
        </div>
      </div>
    </section>

    <!-- Life Ionizers, dark technology -->
    <section class="section feature feature--dark">
      <div class="wrap">
        <div class="split split--media-right">
          <div class="figure figure--wide" data-reveal>
            <img
              src="/images/ionizer-dark.avif"
              alt="A dark modern kitchen at dusk with water pouring from a matte black faucet into a clear glass"
              loading="lazy" decoding="async"
            >
          </div>
          <div data-reveal>
            <p class="eyebrow">Life Ionizers</p>
            <h2>Plates are the whole story.</h2>
            <p class="lede u-mt">
              The MXL series runs from the 5-plate Core to the 15-plate Apex. More plates mean a
              wider pH range and steadier performance as demand climbs. Every model installs
              countertop or under counter, and shares one replacement filter.
            </p>
            <div class="table-scroll u-mt-lg">
              <table class="compare" style="min-width:34rem">
                <caption class="visually-hidden">Life Ionizer MXL plate counts and warranty</caption>
                <thead>
                  <tr>
                    <th scope="col" style="color:rgba(250,249,245,.6)">Model</th>
                    <th scope="col" style="color:rgba(250,249,245,.6)">Plates</th>
                    <th scope="col" style="color:rgba(250,249,245,.6)">Warranty</th>
                  </tr>
                </thead>
                <tbody>
                  ${join(
                    heroCompareRows.map(
                      (row) => html`<tr>
                        <th scope="row" style="color:var(--warm-white)">${row.model}</th>
                        <td style="color:rgba(250,249,245,.8)">${row.plates}</td>
                        <td style="color:rgba(250,249,245,.8)">${row.warranty}</td>
                      </tr>`,
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div class="u-flex u-mt-lg">
              <a class="btn btn--light" href="/compare/ionizers">Find your ionizer</a>
              <a class="link" style="border-color:rgba(250,249,245,.35)" href="/collections/life-ionizers">Shop the range ${icon("arrow")}</a>
            </div>
          </div>
        </div>
        <div class="u-mt-lg">${productRail(ionizers)}</div>
      </div>
    </section>

    <!-- Pitcher of Life, bright -->
    <section class="section">
      <div class="wrap">
        <div class="split">
          <div data-reveal>
            <p class="eyebrow">Pitcher of Life</p>
            <h2>Better Water,<br>Beautifully Simple.</h2>
            <p class="lede u-mt">
              No installation and no plumbing. A 6-stage cartridge reduces heavy metals and
              chlorine taste while adding calcium, magnesium and potassium minerals, producing
              water at 8.5 to 9.5 pH. Fill it, wait, pour.
            </p>
            <div class="stats u-mt-lg" style="grid-template-columns:repeat(3,minmax(0,1fr))">
              <div><strong>3.8 L</strong><span>Pitcher capacity</span></div>
              <div><strong>6</strong><span>Filtration stages</span></div>
              <div><strong>3M+</strong><span>Filters purchased by customers</span></div>
            </div>
            <div class="u-flex u-mt-lg">
              <a class="btn" href="/collections/pitcher-of-life">Shop Pitcher of Life</a>
              <a class="link" href="/filter-finder">Find your filter ${icon("arrow")}</a>
            </div>
          </div>
          <div class="figure figure--wide" data-reveal>
            <img
              src="/images/pitcher-bright.avif"
              alt="Morning light in a warm minimalist kitchen as a glass pitcher pours water into a drinking glass"
              loading="lazy" decoding="async"
            >
          </div>
        </div>
        <div class="u-mt-lg">${productRail(pitchers)}</div>
      </div>
    </section>

    <!-- Hawaiian Volcanic Organic -->
    <section class="section feature feature--volcanic">
      <div class="wrap">
        <div class="split split--media-right">
          <div class="figure figure--wide" data-reveal>
            <img
              src="/images/hvo-volcanic.avif"
              alt="Black volcanic lava rock giving way to lush tropical vegetation under dramatic light"
              loading="lazy" decoding="async"
            >
          </div>
          <div data-reveal>
            <p class="eyebrow">Hawaiian Volcanic Organic</p>
            <h2>From Volcanic Earth<br>to Living Soil.</h2>
            <p class="lede u-mt">
              Feed the soil, not just the plant. Bokashi ferments material so it breaks down
              faster and more completely, while glauconite brings over 34 naturally occurring
              minerals in as a slow-release amendment.
            </p>
            <ul class="u-mt" style="list-style:none;padding:0">
              ${join(
                [
                  "Improves soil structure, porosity and moisture retention",
                  "Moves locked-up nutrients into plant-available forms",
                  "Works in a compost bucket or across a grow bed",
                ].map(
                  (line) => html`<li style="display:flex;gap:.7rem;align-items:flex-start;margin:.55rem 0">
                    <span style="color:var(--brass);flex:none;margin-top:.15rem">${icon("check", 18)}</span>
                    <span style="color:rgba(250,249,245,.82);font-size:.94rem">${line}</span>
                  </li>`,
                ),
              )}
            </ul>
            <div class="u-mt-lg">
              <a class="btn btn--light" href="/collections/organic-gardening">Explore organic gardening</a>
            </div>
          </div>
        </div>
        <div class="u-mt-lg">${productRail(garden)}</div>
      </div>
    </section>

    <!-- Quiz + filter finder -->
    <section class="section u-cream">
      <div class="wrap">
        <div class="grid grid--2">
          <div class="panel" data-reveal>
            <p class="eyebrow">Guided</p>
            <h2 style="font-size:clamp(1.8rem,3vw,2.6rem)">Find the Right Solution</h2>
            <p class="u-mt muted">
              Five questions about your water, your home and what you are trying to improve. We
              return a shortlist, not a catalog.
            </p>
            <div class="u-mt-lg"><a class="btn" href="/quiz">Start the quiz</a></div>
          </div>
          <div class="panel" data-reveal>
            <p class="eyebrow">Replacements</p>
            <h2 style="font-size:clamp(1.8rem,3vw,2.6rem)">Find Your Filter</h2>
            <p class="u-mt muted">
              Brand, then model, then the exact cartridge your system takes. No cross-referencing
              part numbers.
            </p>
            <div class="u-mt-lg"><a class="btn btn--ghost" href="/filter-finder">Open the finder</a></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bundles -->
    <section class="section">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "Shop the system",
          title: "Compatible products, grouped",
          lede: "Bundles built from products that genuinely work together, so you are not left guessing what pairs with what.",
          action: { label: "All bundles", href: "/bundles" },
        })}
        <div class="grid grid--3">
          ${join(
            sellableBundles().slice(0, 3).map(
              (b, i) => html`
                <a class="post post--tile" href="/bundles#${b.handle}" data-reveal style="--reveal-delay:${String(i * 0.06)}s">
                  <div>
                    <p class="post__cat">Bundle</p>
                    <h3 style="margin-top:.5rem">${b.title}</h3>
                    <p class="u-mt">${b.tagline}</p>
                  </div>
                  <span class="link">See what is included ${icon("arrow")}</span>
                </a>
              `,
            ),
          )}
        </div>
      </div>
    </section>

    <!-- Journal -->
    ${journal.length
      ? html`
          <section class="section u-sand">
            <div class="wrap">
              ${sectionHead({
                eyebrow: "The Journal",
                title: "Read before you buy",
                lede: "Practical guidance on water, tanks, home care and soil, written to be useful whether you buy from us or not.",
                action: { label: "All articles", href: "/journal" },
              })}
              <div class="grid grid--3">
                ${join(
                  journal.map(
                    (a, i) => html`
                      <a class="post" href="/journal/${a.slug}" data-reveal style="--reveal-delay:${String(i * 0.06)}s">
                        <div class="post__media">
                          <img src="/images/journal-${i % 2 === 0 ? "soil" : "rain"}.avif" alt="" loading="lazy" decoding="async">
                        </div>
                        <div>
                          <p class="post__cat">${a.category}</p>
                          <h3 style="margin-top:.4rem">${a.title}</h3>
                          <p class="u-mt">${a.excerpt}</p>
                          <p class="post__meta u-mt">${displayDate(a.date)} · ${String(a.readingMinutes)} min read</p>
                        </div>
                      </a>
                    `,
                  ),
                )}
              </div>
            </div>
          </section>
        `
      : raw("")}

    ${newsletter()}
  `;

  return layout(
    {
      title: "EarthTrade | Better Solutions for Living Well",
      description:
        "Premium solutions for water, home, wellness and organic living. Water ionizers, alkaline pitchers, high-performance cleaners and organic soil products, organized so you can find what fits.",
      path: "/",
      transparentHeader: true,
      image: "/images/hero-home.avif",
    },
    body,
  );
}
