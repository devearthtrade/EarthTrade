/** Discovery tools: comparison, quiz, filter finder, system builder, bundles. */

import { html, join, raw } from "../lib/html.ts";
import { money } from "../lib/format.ts";
import {
  bundleProducts,
  bundleTotal,
  bundles,
  sellableBundles,
  cardName,
  filterFinder,
  getProduct,
  getProducts,
  ionizerComparison,
  productPrice,
  quizResults,
  quizSteps,
} from "../data/catalog.ts";
import { resolveHandle } from "../data/aliases.ts";
import { layout } from "../site/layout.ts";
import {
  breadcrumbs,
  newsletter,
  productCard,
  productRail,
  sectionHead,
  trustRow,
} from "../site/components.ts";
import { breadcrumbLd, faqLd } from "../lib/seo.ts";
import { icon } from "../site/icons.ts";

/* ------------------------------ comparison ------------------------------ */

export function comparePage(): string {
  const items = getProducts(ionizerComparison.handles);
  const trail = [
    { label: "Home", href: "/" },
    { label: "Compare Ionizers", href: "/compare/ionizers" },
  ];

  const body = html`
    <section class="phero phero--dark">
      <div class="phero__media"><img src="/images/ionizer-dark.avif" alt="" decoding="async"></div>
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Find your ionizer</p>
          <h1>Which Life Ionizer is right for you?</h1>
          <p class="lede u-mt">
            Every MXL model installs countertop or under counter and shares one replacement filter.
            What changes as you move up the range is plate count, pH range and how well the machine
            holds performance when several people are drawing water.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        ${items.length === 0
          ? html`<p class="notice">
              The Life Ionizer machines are not in the current catalogue, so there is nothing to
              compare yet. Replacement filters and parts for these models are available, and the
              filter finder will match one to your model.
            </p>
            <div class="u-mt-lg"><a class="btn" href="/filter-finder">Find your filter</a></div>`
          : html`
        <div class="table-scroll">
          <table class="compare">
            <caption class="visually-hidden">Life Ionizer MXL series comparison</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                ${join(
                  items.map(
                    (p) => html`<th scope="col">
                      <a class="compare__name" href="/products/${p.handle}">${cardName(p)}</a>
                      <span class="compare__price">${money(productPrice(p))}</span>
                    </th>`,
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              ${join(
                ionizerComparison.rows.map(
                  (row) => html`
                    <tr>
                      <th scope="row">${row.label}</th>
                      ${join(row.values.map((v) => html`<td>${v}</td>`))}
                    </tr>
                  `,
                ),
              )}
              <tr>
                <th scope="row">Shop</th>
                ${join(
                  items.map(
                    (p) => html`<td><a class="btn btn--sm btn--ghost" href="/products/${p.handle}">View</a></td>`,
                  ),
                )}
              </tr>
            </tbody>
          </table>
        </div>
        <p class="notice">
          Pricing for the ionizer range is being synced from the live EarthTrade catalog and is shown
          here for layout purposes.
        </p>`}
      </div>
    </section>

    <section class="section u-cream">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "Still deciding",
          title: "Two shortcuts",
          lede: "If the table has not settled it, these narrow the field faster.",
        })}
        <div class="grid grid--2">
          <div class="panel" data-reveal>
            <h3>Answer five questions</h3>
            <p class="u-mt muted">
              The quiz factors in household size, water source and whether alkaline water is
              actually your goal.
            </p>
            <div class="u-mt-lg"><a class="btn" href="/quiz">Start the quiz</a></div>
          </div>
          <div class="panel" data-reveal>
            <h3>Already own one?</h3>
            <p class="u-mt muted">
              Skip the machines and go straight to the correct replacement cartridge for your model.
            </p>
            <div class="u-mt-lg"><a class="btn btn--ghost" href="/filter-finder">Find your filter</a></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        ${sectionHead({ eyebrow: "The range", title: "Shop Life Ionizers" })}
        ${productRail(items.slice(0, 4))}
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "Compare Life Ionizers, MXL-5 to MXL-15 | EarthTrade",
      description:
        "Compare the Life Ionizer MXL series side by side: plate count, installation, warranty, filter life and who each model suits.",
      path: "/compare/ionizers",
      image: "/images/ionizer-dark.avif",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* --------------------------------- quiz --------------------------------- */

export function quizPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Find the Right Solution", href: "/quiz" },
  ];

  // Results carry pre-rendered product cards so the client script stays small.
  const resultsPayload = quizResults.map((r) => ({
    id: r.id,
    match: r.match,
    title: r.title,
    text: r.text,
    collectionHandle: r.collectionHandle ?? "",
    cards: getProducts(r.productHandles)
      .map((p) => productCard(p).value)
      .join(""),
  }));

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Guided</p>
          <h1>Find the Right Solution</h1>
          <p class="lede u-mt">
            Five questions about your home and what you are trying to improve. We return a
            shortlist, not a catalog. Nothing is added to your cart.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="quiz" data-quiz data-quiz-results="${JSON.stringify(resultsPayload)}">
          <div class="quiz__bar" data-quiz-bar aria-hidden="true">
            ${join(quizSteps.map(() => html`<i data-done="false"></i>`))}
          </div>

          ${join(
            quizSteps.map(
              (step, i) => html`
                <div class="quiz__step" data-quiz-step="${step.id}" data-active="${i === 0 ? "true" : "false"}">
                  <h2 class="quiz__q" tabindex="-1">${step.question}</h2>
                  ${step.help ? html`<p class="quiz__help">${step.help}</p>` : raw("")}
                  <div class="quiz__options">
                    ${join(
                      step.options.map(
                        (opt) => html`
                          <button class="quiz__opt" type="button" data-quiz-opt="${opt.tags.join(",")}">
                            ${opt.label}
                          </button>
                        `,
                      ),
                    )}
                  </div>
                  ${i > 0
                    ? html`<div class="quiz__nav">
                        <button class="quiz__back" type="button" data-quiz-back>Back</button>
                      </div>`
                    : raw("")}
                </div>
              `,
            ),
          )}

          <div data-quiz-result hidden></div>

          <noscript>
            <p class="lede u-mt">
              The quiz needs JavaScript. You can browse the same recommendations directly:
            </p>
            <ul class="u-mt">
              <li><a href="/collections/water">Better water</a></li>
              <li><a href="/collections/cistern-catchment">Cistern and catchment care</a></li>
              <li><a href="/collections/household-cleaning">Home cleaning</a></li>
              <li><a href="/collections/organic-gardening">Organic gardening</a></li>
            </ul>
          </noscript>
        </div>
      </div>
    </section>

    <section class="section section--tight u-cream">
      <div class="wrap">${trustRow()}</div>
    </section>
  `;

  return layout(
    {
      title: "Find the Right Solution | EarthTrade",
      description:
        "Answer five questions about your water, home and goals, and we will narrow the EarthTrade range to the products that fit.",
      path: "/quiz",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* ----------------------------- filter finder ----------------------------- */

export function finderPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Find Your Filter", href: "/filter-finder" },
  ];

  const body = html`
    <section class="phero">
      <div class="phero__media"><img src="/images/water-macro.avif" alt="" decoding="async"></div>
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Replacements</p>
          <h1>Find Your Filter</h1>
          <p class="lede u-mt">
            Pick your brand, then your model. We will show the exact replacement your system takes,
            so there is no cross-referencing part numbers.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="finder" data-finder>
          <div class="finder__step" data-finder-step="brand" data-active="true">
            <h2 tabindex="-1">Which brand is your system?</h2>
            <p class="muted u-mt">Step 1 of 2</p>
            <div class="finder__grid u-mt-lg">
              ${join(
                filterFinder.map(
                  (node) => html`
                    <button class="finder__opt" type="button" data-finder-go="${node.brand.toLowerCase().replaceAll(" ", "-")}">
                      <b>${node.brand}</b>
                      <span>${String(node.models.length)} models</span>
                    </button>
                  `,
                ),
              )}
            </div>
          </div>

          ${join(
            filterFinder.map((node) => {
              const stepId = node.brand.toLowerCase().replaceAll(" ", "-");
              return html`
                <div class="finder__step" data-finder-step="${stepId}" data-active="false">
                  <h2 tabindex="-1">Which ${node.brand} model?</h2>
                  <p class="muted u-mt">Step 2 of 2</p>
                  <div class="finder__grid u-mt-lg">
                    ${join(
                      node.models.map((m) => {
                        const handle = resolveHandle(m.filterHandle, (h) => Boolean(getProduct(h)));
                        const filter = handle ? getProduct(handle) : undefined;

                        // The model itself is still useful to show. Without a
                        // matching filter in the catalog it stays on the page
                        // as plain text rather than linking nowhere.
                        if (!filter || !handle) {
                          return html`
                            <div class="finder__opt">
                              <b>${m.model}</b>
                              <span>${m.note}</span>
                              <span style="display:block;margin-top:.6rem;color:var(--ink-3);font-size:.8rem">
                                Matching filter not in the catalogue yet
                              </span>
                            </div>
                          `;
                        }

                        return html`
                          <a class="finder__opt" href="/products/${handle}" style="text-decoration:none;display:block">
                            <b>${m.model}</b>
                            <span>${m.note}</span>
                            <span style="display:block;margin-top:.6rem;color:var(--forest);font-size:.8rem">
                              Takes: ${cardName(filter)} ${icon("arrow", 14)}
                            </span>
                          </a>
                        `;
                      }),
                    )}
                  </div>
                  <div class="quiz__nav">
                    <button class="quiz__back" type="button" data-finder-go="brand">Back to brands</button>
                  </div>
                </div>
              `;
            }),
          )}
        </div>
      </div>
    </section>

    <section class="section section--tight u-cream">
      <div class="wrap wrap--narrow u-center">
        <p class="eyebrow eyebrow--plain" style="justify-content:center">Never run out</p>
        <h2>Put replacements on Auto-Ship</h2>
        <p class="lede u-mt" style="margin-inline:auto">
          MXL cartridges are rated 6 to 12 months. Pitcher cartridges run about two months. Auto-Ship
          times the delivery so performance never quietly drops off.
        </p>
        <div class="u-mt-lg"><a class="btn" href="/collections/subscribe">See Auto-Ship products</a></div>
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "Find Your Replacement Filter | EarthTrade",
      description:
        "Match your Life Ionizer or Pitcher of Life model to the exact replacement filter it takes, in two steps.",
      path: "/filter-finder",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* --------------------------- build your system --------------------------- */

const SYSTEM_STEPS = [
  {
    title: "Choose your source",
    text: "Municipal, well or rainwater catchment. If your water comes from a tank, tank care comes first.",
    handles: ["cistern-catchment-bomb", "active-chlorine-test-strips-50"],
  },
  {
    title: "Choose your filtration",
    text: "Reduce chlorine taste, sediment and heavy metals before anything else in the chain.",
    handles: ["pitcher-of-life-2nd-generation", "pitcher-of-life-2nd-generation-3pack-replacement-filter"],
  },
  {
    title: "Choose your conditioning",
    text: "Add calcium, magnesium and potassium minerals back for taste and balance.",
    handles: ["pitcher-with-copper-bottle", "flower-of-life-copper-bottle"],
  },
  {
    title: "Choose your ionization",
    text: "Alkaline water on demand, at the pH range you set. Plate count drives the range.",
    handles: ["life-ionizer-mxl-9", "life-ionizer-mxl-15"],
  },
  {
    title: "Choose your replacements",
    text: "The step most people skip. A filter past its rating is not filtering.",
    handles: ["life-mxl-replacement-filter", "pitcher-of-life-replacement-filter-3pack"],
  },
];

export function buildSystemPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Build Your System", href: "/build-your-system" },
  ];

  const body = html`
    <section class="phero">
      <div class="phero__media"><img src="/images/water-macro.avif" alt="" decoding="async"></div>
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Shop the system</p>
          <h1>Build Your Water System</h1>
          <p class="lede u-mt">
            Five steps from source to glass. Work through them in order and the range stops feeling
            like a catalog and starts looking like a plan.
          </p>
        </div>
      </div>
    </section>

    ${join(
      SYSTEM_STEPS.map(
        (step, i) => html`
          <section class="section ${i % 2 === 1 ? "u-cream" : ""}">
            <div class="wrap">
              <div class="split ${i % 2 === 1 ? "split--media-right" : ""}">
                <div data-reveal>
                  <p class="eyebrow">Step ${String(i + 1).padStart(2, "0")}</p>
                  <h2>${step.title}</h2>
                  <p class="lede u-mt">${step.text}</p>
                </div>
                <div data-reveal>
                  <div class="grid grid--2">
                    ${join(getProducts(step.handles).map((p) => productCard(p)))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        `,
      ),
    )}

    <section class="section u-dark">
      <div class="wrap wrap--narrow u-center">
        <p class="eyebrow eyebrow--plain" style="justify-content:center;color:rgba(250,249,245,.7)">Not sure?</p>
        <h2>Let the quiz do the sorting</h2>
        <p class="lede u-mt" style="margin-inline:auto;color:rgba(250,249,245,.82)">
          Five questions and we will point you at the two or three products that actually fit your
          household.
        </p>
        <div class="u-mt-lg"><a class="btn btn--light" href="/quiz">Start the quiz</a></div>
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "Build Your Water System | EarthTrade",
      description:
        "Source, filtration, conditioning, ionization and replacements. Five steps that turn the EarthTrade water range into a plan.",
      path: "/build-your-system",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* -------------------------------- bundles -------------------------------- */

export function bundlesPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Bundles", href: "/bundles" },
  ];

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Shop the system</p>
          <h1>Bundles</h1>
          <p class="lede u-mt">
            Built from products that genuinely work together, so you are not left guessing what
            pairs with what. Every item can also be bought on its own.
          </p>
        </div>
      </div>
    </section>

    ${join(
      sellableBundles().map((b, i) => {
        const items = bundleProducts(b);
        return html`
          <section class="section ${i % 2 === 1 ? "u-cream" : ""}" id="${b.handle}">
            <div class="wrap">
              <div class="head">
                <div class="head__row">
                  <div data-reveal>
                    <p class="eyebrow">Bundle ${String(i + 1).padStart(2, "0")}</p>
                    <h2>${b.title}</h2>
                    <p class="lede u-mt">${b.tagline}</p>
                    <p class="u-mt muted" style="max-width:44rem">${b.description}</p>
                  </div>
                  <div data-reveal>
                    <p class="tiny muted">Bought together</p>
                    <p style="font-family:var(--serif);font-size:2rem;margin:.2rem 0 0">${money(bundleTotal(b))}</p>
                  </div>
                </div>
              </div>
              <div class="grid grid--3">${join(items.map((p) => productCard(p)))}</div>
            </div>
          </section>
        `;
      }),
    )}

    ${newsletter()}
  `;

  return layout(
    {
      title: "Bundles | EarthTrade",
      description:
        "Water starters, cistern care, home cleaning and organic garden bundles, built from compatible EarthTrade products.",
      path: "/bundles",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* --------------------------------- faqs ---------------------------------- */

const SITE_FAQS = [
  {
    q: "How quickly do orders ship?",
    a: "Orders placed on business days are prepared for dispatch the same or next business day. Shipping is free on orders over $75.",
  },
  {
    q: "How do I know which replacement filter I need?",
    a: "Use the Filter Finder. Choose your brand, then your model, and it returns the exact cartridge your system takes.",
  },
  {
    q: "What is Auto-Ship?",
    a: "Auto-Ship sends consumables on a schedule you choose, timed so the replacement arrives before the old one is spent. You can change, pause or cancel it at any time.",
  },
  {
    q: "How often should MXL ionizer filters be replaced?",
    a: "MXL replacement filters are rated for 6 to 12 months depending on water quality and how much water you use.",
  },
  {
    q: "How long does a Pitcher of Life filter last?",
    a: "About two months of typical household use, which is why the cartridges are sold in three-packs covering roughly six months.",
  },
  {
    q: "Are SolutionsHOCL products bleach?",
    a: "No. Every formula is bleach-free, ammonia-free and phosphate-free. Each uses a sodium-based ingredient that generates HOCL when dissolved in water.",
  },
  {
    q: "How often should I clean a cistern or catchment tank?",
    a: "Most households deep clean quarterly with a lighter maintenance dose in between, and treat again after heavy storm seasons. Follow the label schedule for your tank size.",
  },
  {
    q: "What warranty do Life Ionizers carry?",
    a: "The MXL-7 carries a lifetime parts warranty with 10 years of labor. The MXL-9, MXL-11, MXL-13 and MXL-15, including under-counter configurations, carry a guaranteed lifetime warranty.",
  },
];

export function faqsPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "FAQs", href: "/faqs" },
  ];

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Support</p>
          <h1>Frequently asked questions</h1>
          <p class="lede u-mt">
            Shipping, filters, Auto-Ship and tank care. If your question is not here, we are happy
            to answer it directly.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap wrap--narrow">
        <div class="acc">
          ${join(
            SITE_FAQS.map(
              (item, i) => html`
                <div class="acc__item">
                  <h2>
                    <button
                      class="acc__btn"
                      type="button"
                      data-acc-btn
                      aria-expanded="${i === 0 ? "true" : "false"}"
                      aria-controls="sitefaq-${String(i)}"
                      id="sitefaq-btn-${String(i)}"
                    >${item.q} ${icon("plus")}</button>
                  </h2>
                  <div
                    class="acc__panel"
                    id="sitefaq-${String(i)}"
                    role="region"
                    aria-labelledby="sitefaq-btn-${String(i)}"
                    data-open="${i === 0 ? "true" : "false"}"
                  ><p>${item.a}</p></div>
                </div>
              `,
            ),
          )}
        </div>
        <div class="u-mt-lg u-flex">
          <a class="btn" href="/contact">Ask us directly</a>
          <a class="btn btn--ghost" href="/learn">Read the guides</a>
        </div>
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "FAQs | EarthTrade",
      description:
        "Answers on shipping, replacement filters, Auto-Ship, warranties and cistern and catchment tank care.",
      path: "/faqs",
      jsonLd: [breadcrumbLd(trail), faqLd(SITE_FAQS)],
    },
    body,
  );
}
