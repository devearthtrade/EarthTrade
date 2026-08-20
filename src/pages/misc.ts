/**
 * About, rewards, account, contact, search, legal and 404.
 *
 * The About page deliberately describes philosophy and approach rather than
 * founder history, dates or milestones: none of that is verified, and the
 * brief forbids inventing it. Same for certifications, awards and reviews.
 */

import { html, join, raw } from "../lib/html.ts";
import { brands, collectionIndex, collectionProducts } from "../data/catalog.ts";
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

/* -------------------------------- about ---------------------------------- */

export function aboutPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
  ];

  const principles = [
    {
      icon: "water",
      title: "Start with the problem",
      text: "Nobody wakes up wanting a 9-plate ionizer. They want water that tastes better. We organize the range around the problem, not the product category.",
    },
    {
      icon: "layers",
      title: "Explain the whole system",
      text: "Most of our range is part of a chain: source, filtration, conditioning, replacement. A product sold without that context tends to disappoint.",
    },
    {
      icon: "refresh",
      title: "Make reordering effortless",
      text: "The filter you forget is the one that stops working. Auto-Ship exists so performance never quietly drops off between purchases.",
    },
    {
      icon: "shield",
      title: "Say only what we can support",
      text: "We describe what a product does to the surface or the water in front of it. We do not make medical claims or borrow authority we have not earned.",
    },
  ];

  const body = html`
    <section class="phero phero--dark">
      <div class="phero__media"><img src="/images/about-hero.avif" alt="" decoding="async"></div>
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Our story</p>
          <h1>Better living,<br>naturally engineered.</h1>
          <p class="lede u-mt">
            EarthTrade brings together five brands solving different parts of the same problem:
            what comes into your home, what you clean it with, and what you grow in.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="split split--wide-text">
          <div data-reveal>
            <p class="eyebrow">Why EarthTrade exists</p>
            <h2>One roof, five specialists</h2>
          </div>
          <div class="prose" data-reveal>
            <p>
              Water technology, home cleaning and soil science are three different disciplines. The
              companies that do each of them well are rarely the same company. That is the case for
              a marketplace rather than a house brand.
            </p>
            <p>
              What EarthTrade adds is the connective work: putting the ranges next to each other,
              explaining where one ends and the next begins, and making the replacement parts easy
              to find years after the original purchase.
            </p>
            <p>
              The catalog spans high-ticket water systems and a $4 packet of cleaner. Both deserve
              the same clarity about what they do and who they are for.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="section u-cream">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "Our philosophy",
          title: "Four things we hold to",
          lede: "These are the rules we apply when deciding what to stock and how to describe it.",
        })}
        <div class="grid grid--2">
          ${join(
            principles.map(
              (p, i) => html`
                <div class="panel" data-reveal style="--reveal-delay:${String(i * 0.06)}s">
                  <span style="color:var(--brass)">${icon(p.icon, 26)}</span>
                  <h3 class="u-mt">${p.title}</h3>
                  <p class="u-mt muted">${p.text}</p>
                </div>
              `,
            ),
          )}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "Our brands",
          title: "Who makes what",
          action: { label: "All brands", href: "/brands" },
        })}
        <div class="grid grid--3">
          ${join(
            brands.map(
              (b) => html`
                <a class="post post--tile" href="/brands/${b.id}" data-reveal>
                  <div>
                    <p class="post__cat">${b.tagline}</p>
                    <h3 style="margin-top:.5rem">${b.name}</h3>
                    <p class="u-mt">${b.summary}</p>
                  </div>
                  <span class="link">Read more ${icon("arrow")}</span>
                </a>
              `,
            ),
          )}
        </div>
      </div>
    </section>

    <section class="section u-dark">
      <div class="wrap">
        <div class="split split--wide-text">
          <div data-reveal>
            <p class="eyebrow" style="color:rgba(250,249,245,.7)">Sustainability</p>
            <h2>Ship the concentrate, not the water</h2>
          </div>
          <div data-reveal>
            <p class="lede" style="color:rgba(250,249,245,.82)">
              A large share of our cleaning range ships as concentrated powder. A 10 g packet makes
              a full gallon, which means the bottle, the water and the freight that would have
              carried them simply are not part of the transaction.
            </p>
            <p class="u-mt" style="color:rgba(250,249,245,.75)">
              The same logic runs through the rest of the catalog: durable vessels over disposable
              ones, refills over replacements, and warranty-backed systems built to be repaired
              rather than replaced.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="wrap">${trustRow()}</div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "About EarthTrade | Better Living, Naturally Engineered",
      description:
        "EarthTrade brings together five brands across water, home care, organic gardening and wellness, with the guidance to choose between them.",
      path: "/about",
      image: "/images/about-hero.avif",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* ------------------------------- rewards --------------------------------- */

export function rewardsPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Rewards", href: "/rewards" },
  ];

  const earn = [
    { title: "Create an account", points: "100 points" },
    { title: "Join the newsletter", points: "50 points" },
    { title: "Every dollar spent", points: "2 points" },
    { title: "Write a product review", points: "150 points" },
    { title: "Refer a friend", points: "500 points" },
    { title: "Follow along socially", points: "50 points" },
  ];

  const spend = [
    { title: "$5 off", points: "500 points" },
    { title: "$15 off", points: "1,400 points" },
    { title: "$40 off", points: "3,500 points" },
    { title: "Free replacement filter", points: "2,500 points" },
  ];

  const circle = [
    "Early access to new products and restocks",
    "Members-only bundles and seasonal offers",
    "Priority support when you need help choosing",
    "Product education sent before you need it, not after",
  ];

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">EarthTrade Rewards</p>
          <h1>Points for the things you already do</h1>
          <p class="lede u-mt">
            Earn on every order, review and referral. Redeem against the consumables you buy
            anyway. No tiers to decode.
          </p>
          <div class="u-flex u-mt-lg">
            <a class="btn" href="/account">Create an account</a>
            <a class="btn btn--ghost" href="#circle">About the Circle</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="grid grid--2">
          <div data-reveal>
            ${sectionHead({ eyebrow: "Earning", title: "How points add up" })}
            <table class="spec">
              <tbody>
                ${join(earn.map((r) => html`<tr><th scope="row">${r.title}</th><td>${r.points}</td></tr>`))}
              </tbody>
            </table>
          </div>
          <div data-reveal>
            ${sectionHead({ eyebrow: "Redeeming", title: "What points are worth" })}
            <table class="spec">
              <tbody>
                ${join(spend.map((r) => html`<tr><th scope="row">${r.title}</th><td>${r.points}</td></tr>`))}
              </tbody>
            </table>
            <p class="notice">
              Rewards are shown as a design preview. Balances activate once the loyalty programme is
              connected to the live store.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="section u-dark" id="circle">
      <div class="wrap">
        <div class="split split--wide-text">
          <div data-reveal>
            <p class="eyebrow" style="color:rgba(250,249,245,.7)">Membership</p>
            <h2>The EarthTrade Circle</h2>
          </div>
          <div data-reveal>
            <p class="lede" style="color:rgba(250,249,245,.82)">
              A quieter membership for customers who run whole systems: several filters, a tank
              schedule, a garden that needs feeding through the season.
            </p>
            <ul class="u-mt-lg" style="list-style:none;padding:0">
              ${join(
                circle.map(
                  (line) => html`<li style="display:flex;gap:.7rem;align-items:flex-start;margin:.6rem 0">
                    <span style="color:var(--brass);flex:none;margin-top:.15rem">${icon("check", 18)}</span>
                    <span style="color:rgba(250,249,245,.82)">${line}</span>
                  </li>`,
                ),
              )}
            </ul>
            <div class="u-mt-lg"><a class="btn btn--brass" href="/account">Join the Circle</a></div>
          </div>
        </div>
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "EarthTrade Rewards | Points, Referrals and the Circle",
      description:
        "Earn points on orders, reviews and referrals, and redeem them against the consumables you reorder. Plus the EarthTrade Circle membership.",
      path: "/rewards",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* ------------------------------- account --------------------------------- */

export function accountPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Account", href: "/account" },
  ];

  const panels = [
    { icon: "bag", title: "Orders & tracking", text: "Every order, its status and its tracking link in one list." },
    { icon: "refresh", title: "Subscriptions", text: "See what is on Auto-Ship, change the rhythm, pause or cancel." },
    { icon: "heart", title: "Wishlist", text: "Saved products, kept across visits on this device." },
    { icon: "home", title: "Addresses", text: "Shipping and billing addresses for faster checkout." },
    { icon: "star", title: "Rewards balance", text: "Points earned, points available and what they are worth." },
    { icon: "filter", title: "Your filters", text: "The replacement cartridges matched to systems you own." },
  ];

  const subscribe = collectionProducts(collectionIndex.get("subscribe")!).slice(0, 4);

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Your account</p>
          <h1>Everything in one place</h1>
          <p class="lede u-mt">
            Orders, subscriptions, saved products and rewards. Sign in to pick up where you left
            off.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="split">
          <div data-reveal>
            <div class="panel">
              <h2 style="font-size:1.8rem">Sign in</h2>
              <form class="u-mt-lg" data-demo-form>
                <div class="field">
                  <label for="acc-email">Email</label>
                  <input id="acc-email" type="email" name="email" autocomplete="email" required>
                </div>
                <div class="field">
                  <label for="acc-pass">Password</label>
                  <input id="acc-pass" type="password" name="password" autocomplete="current-password" required>
                </div>
                <button class="btn btn--block" type="submit">Sign in</button>
                <p class="tiny muted u-mt">
                  New here? Creating an account earns 100 reward points.
                </p>
              </form>
              <p class="notice">
                Authentication is not connected in this design preview. No credentials are
                transmitted or stored.
              </p>
            </div>
          </div>
          <div data-reveal>
            <p class="eyebrow">Once you are in</p>
            <h2>What your dashboard holds</h2>
            <div class="grid grid--2 u-mt-lg" style="gap:1.25rem">
              ${join(
                panels.map(
                  (p) => html`
                    <div style="display:flex;gap:.8rem;align-items:flex-start">
                      <span style="color:var(--forest);flex:none">${icon(p.icon, 22)}</span>
                      <div>
                        <h3 style="font-family:var(--sans);font-size:.92rem;font-weight:600">${p.title}</h3>
                        <p style="font-size:.83rem;margin:.2rem 0 0;color:var(--ink-2)">${p.text}</p>
                      </div>
                    </div>
                  `,
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section u-cream" id="wishlist">
      <div class="wrap">
        ${sectionHead({
          eyebrow: "Never run out",
          title: "Set up Auto-Ship",
          lede: "The consumables customers most often forget, and most often wish they had not.",
          action: { label: "All Auto-Ship products", href: "/collections/subscribe" },
        })}
        ${productRail(subscribe)}
      </div>
    </section>
  `;

  return layout(
    {
      title: "Your Account | EarthTrade",
      description: "Orders, tracking, subscriptions, wishlist and rewards in one place.",
      path: "/account",
      noindex: true,
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* ------------------------------- contact --------------------------------- */

export function contactPage(): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: "Contact", href: "/contact" },
  ];

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <p class="eyebrow">Contact</p>
          <h1>Talk to us</h1>
          <p class="lede u-mt">
            Choosing between two models, matching a replacement filter, or working out a tank
            schedule. We would rather you asked than guessed.
          </p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="split">
          <div data-reveal>
            <form class="panel" data-demo-form>
              <h2 style="font-size:1.6rem">Send a message</h2>
              <div class="field u-mt-lg">
                <label for="c-name">Name</label>
                <input id="c-name" name="name" autocomplete="name" required>
              </div>
              <div class="field">
                <label for="c-email">Email</label>
                <input id="c-email" type="email" name="email" autocomplete="email" required>
              </div>
              <div class="field">
                <label for="c-topic">What is this about?</label>
                <select class="select" id="c-topic" name="topic" style="width:100%">
                  <option>Choosing a product</option>
                  <option>Replacement filters</option>
                  <option>Cistern or catchment care</option>
                  <option>An existing order</option>
                  <option>Something else</option>
                </select>
              </div>
              <div class="field">
                <label for="c-msg">Message</label>
                <textarea id="c-msg" name="message" rows="5" required></textarea>
              </div>
              <button class="btn btn--block" type="submit">Send</button>
              <p class="notice">
                Message delivery is not connected in this design preview.
              </p>
            </form>
          </div>
          <div data-reveal>
            <p class="eyebrow">Faster answers</p>
            <h2>You may not need us</h2>
            <p class="lede u-mt">
              Three tools answer most of what arrives in our inbox, and they answer it instantly.
            </p>
            <div class="u-mt-lg" style="display:grid;gap:.75rem">
              ${join(
                [
                  { t: "Find your filter", d: "Match your model to the right cartridge.", h: "/filter-finder" },
                  { t: "Find the right solution", d: "Five questions, a shortlist.", h: "/quiz" },
                  { t: "Frequently asked questions", d: "Shipping, warranties, Auto-Ship and tank care.", h: "/faqs" },
                ].map(
                  (item) => html`
                    <a class="panel" href="${item.h}" style="text-decoration:none;display:block">
                      <h3 style="font-size:1.2rem">${item.t}</h3>
                      <p class="muted" style="margin:.35rem 0 0;font-size:.88rem">${item.d}</p>
                    </a>
                  `,
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>

    ${newsletter()}
  `;

  return layout(
    {
      title: "Contact EarthTrade",
      description: "Get help choosing a product, matching a replacement filter or planning tank care.",
      path: "/contact",
      jsonLd: [breadcrumbLd(trail)],
    },
    body,
  );
}

/* -------------------------------- search --------------------------------- */

export function searchPage(): string {
  const body = html`
    <section class="section">
      <div class="wrap wrap--narrow">
        <p class="eyebrow">Search</p>
        <h1>Find it fast</h1>
        <p class="lede u-mt">
          Search by product name, model number, or the problem you are solving. Try
          <em>MXL-9</em>, <em>cistern cleaner</em>, <em>pitcher filter</em> or
          <em>organic fertilizer</em>.
        </p>
        <div class="u-mt-lg">
          <button class="btn" type="button" data-open-drawer="search">Open search</button>
        </div>
        <div class="rule"></div>
        <h2 style="font-size:1.6rem">Popular destinations</h2>
        <div class="grid grid--2 u-mt">
          ${join(
            [
              { t: "Best sellers", h: "/collections/best-sellers" },
              { t: "Replacement filters", h: "/collections/water-filtration" },
              { t: "Cistern & catchment", h: "/collections/cistern-catchment" },
              { t: "Organic gardening", h: "/collections/organic-gardening" },
              { t: "Compare ionizers", h: "/compare/ionizers" },
              { t: "The Journal", h: "/journal" },
            ].map(
              (item) => html`<a class="panel" href="${item.h}" style="text-decoration:none">
                <h3 style="font-size:1.15rem">${item.t}</h3>
              </a>`,
            ),
          )}
        </div>
      </div>
    </section>
  `;

  return layout(
    {
      title: "Search | EarthTrade",
      description: "Search EarthTrade products, collections, brands and guides.",
      path: "/search",
      noindex: true,
    },
    body,
  );
}

/* --------------------------------- legal --------------------------------- */

interface DocSection {
  heading: string;
  paragraphs: string[];
}

function docPage(
  slug: string,
  title: string,
  intro: string,
  sections: DocSection[],
  description: string,
): string {
  const trail = [
    { label: "Home", href: "/" },
    { label: title, href: `/${slug}` },
  ];

  const body = html`
    <section class="phero">
      <div class="wrap">
        ${breadcrumbs(trail)}
        <div class="phero__inner">
          <h1>${title}</h1>
          <p class="lede u-mt">${intro}</p>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="wrap wrap--narrow">
        <div class="prose">
          ${join(
            sections.map(
              (s) => html`
                <h2>${s.heading}</h2>
                ${join(s.paragraphs.map((p) => html`<p>${p}</p>`))}
              `,
            ),
          )}
        </div>
      </div>
    </section>
  `;

  return layout({ title: `${title} | EarthTrade`, description, path: `/${slug}`, jsonLd: [breadcrumbLd(trail)] }, body);
}

export function shippingPage(): string {
  return docPage(
    "shipping-returns",
    "Shipping & Returns",
    "How orders ship, what it costs and what happens if something is not right.",
    [
      {
        heading: "Shipping",
        paragraphs: [
          "Shipping is free on orders over $75. Below that a flat rate is calculated at checkout based on destination and weight.",
          "Orders placed on business days are prepared for dispatch the same or next business day. You will receive tracking as soon as the parcel is collected.",
        ],
      },
      {
        heading: "Returns",
        paragraphs: [
          "Unopened products in original packaging can be returned within 30 days of delivery. Start a return from your account or by contacting us.",
          "Opened consumables cannot be returned for hygiene reasons unless the product arrived damaged or was sent in error.",
        ],
      },
      {
        heading: "Damaged or incorrect items",
        paragraphs: [
          "If a parcel arrives damaged or contains the wrong item, contact us with a photograph and your order number and we will arrange a replacement.",
        ],
      },
      {
        heading: "Warranties",
        paragraphs: [
          "Warranty terms are set by each manufacturer and are listed on the relevant product page. Life Ionizer MXL-9 and above carry a guaranteed lifetime warranty; the MXL-7 carries a lifetime parts warranty with 10 years of labor.",
        ],
      },
    ],
    "Shipping costs, delivery timing, returns and warranty coverage for EarthTrade orders.",
  );
}

export function privacyPage(): string {
  return docPage(
    "privacy",
    "Privacy",
    "What we collect, why we collect it and the choices you have.",
    [
      {
        heading: "What we collect",
        paragraphs: [
          "We collect the information needed to process an order: name, contact details, delivery address and payment confirmation. Payment card details are handled by our payment processor and are never stored on our systems.",
          "We also collect analytics about how the site is used, so we can see which pages help people choose and which do not.",
        ],
      },
      {
        heading: "Your browser storage",
        paragraphs: [
          "Your cart, wishlist and recently viewed products are stored locally in your own browser rather than on our servers. Clearing site data removes them.",
        ],
      },
      {
        heading: "Marketing",
        paragraphs: [
          "If you subscribe to the newsletter we use your address to send it. Every message includes an unsubscribe link, and we do not share your address with third parties.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          "You can request a copy of the data we hold about you, ask us to correct it, or ask us to delete it. Contact us and we will action the request.",
        ],
      },
    ],
    "How EarthTrade collects, uses and protects your personal information.",
  );
}

export function termsPage(): string {
  return docPage(
    "terms",
    "Terms",
    "The terms that apply when you buy from EarthTrade.",
    [
      {
        heading: "Orders",
        paragraphs: [
          "Placing an order is an offer to buy. We confirm acceptance when the order is dispatched. If an item is unavailable we will contact you before charging for it.",
        ],
      },
      {
        heading: "Pricing",
        paragraphs: [
          "Prices are shown in US dollars and exclude taxes and shipping unless stated. We correct pricing errors when we find them and will contact you before proceeding if an order is affected.",
        ],
      },
      {
        heading: "Product information",
        paragraphs: [
          "We describe products as accurately as we can, using specifications supplied by each manufacturer. Always follow the instructions and directions printed on the product label, which take precedence over any summary on this site.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "Nothing in these terms limits liability that cannot be limited by law. Otherwise our liability in relation to any product is limited to the amount you paid for it.",
        ],
      },
    ],
    "Terms and conditions for purchases made through EarthTrade.",
  );
}

export function accessibilityPage(): string {
  return docPage(
    "accessibility",
    "Accessibility",
    "What we build toward, and how to tell us when we fall short.",
    [
      {
        heading: "Our target",
        paragraphs: [
          "This site is built to target WCAG 2.2 Level AA. That covers keyboard access to every interactive control, visible focus indicators, semantic structure for screen readers, text alternatives for meaningful images, and contrast ratios that meet the standard.",
        ],
      },
      {
        heading: "Specific choices",
        paragraphs: [
          "Every page works without JavaScript for reading and navigation. Motion respects the reduced-motion setting in your operating system. Interactive surfaces such as the cart, menu and search trap focus while open and return it when closed.",
        ],
      },
      {
        heading: "Telling us about a problem",
        paragraphs: [
          "If something on this site blocks you, please contact us and describe what you were trying to do, the page you were on and the assistive technology you were using. We treat access defects as bugs, not feature requests.",
        ],
      },
    ],
    "EarthTrade's accessibility commitments, targeting WCAG 2.2 Level AA.",
  );
}

export function notFoundPage(): string {
  const body = html`
    <section class="section">
      <div class="wrap wrap--narrow u-center" style="padding-block:clamp(3rem,10vw,7rem)">
        <p class="eyebrow eyebrow--plain" style="justify-content:center">404</p>
        <h1>That page has moved on</h1>
        <p class="lede u-mt" style="margin-inline:auto">
          The link may be old, or the address may have a typo. Here is the fastest way back.
        </p>
        <div class="u-flex u-mt-lg" style="justify-content:center">
          <a class="btn" href="/">Back to home</a>
          <button class="btn btn--ghost" type="button" data-open-drawer="search">Search the site</button>
        </div>
        <div class="rule"></div>
        <div class="grid grid--3">
          ${join(
            [
              { t: "Best sellers", h: "/collections/best-sellers" },
              { t: "Find your filter", h: "/filter-finder" },
              { t: "The Journal", h: "/journal" },
            ].map(
              (item) => html`<a class="panel" href="${item.h}" style="text-decoration:none">
                <h3 style="font-size:1.15rem">${item.t}</h3>
              </a>`,
            ),
          )}
        </div>
      </div>
    </section>
  `;

  return layout(
    {
      title: "Page not found | EarthTrade",
      description: "The page you were looking for could not be found.",
      path: "/404",
      noindex: true,
    },
    body,
  );
}
