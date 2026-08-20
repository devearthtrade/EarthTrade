# EarthTrade storefront

A premium storefront for EarthTrade: water, cleaner living, organic gardening and
sustainable home care, across five brands.

Built as a **dependency-free static site generator in TypeScript**. Node 22 strips
the types natively, so there is no compile step, no `node_modules`, and no build
toolchain to keep alive.

```bash
node src/build.ts     # generate dist/
node src/serve.ts     # preview at http://localhost:4173
```

Or via the scripts: `npm run build`, `npm run dev`, `npm run serve`.

## What gets generated

93 pages, from `src/build.ts`:

| Route | Template | Count |
|---|---|---|
| `/` | `pages/home.ts` | 1 |
| `/collections/:handle` | `pages/collection.ts` | 14 |
| `/products/:handle` | `pages/product.ts` | 35 |
| `/brands`, `/brands/:id` | `pages/brand.ts` | 6 |
| `/quiz`, `/filter-finder`, `/compare/ionizers`, `/build-your-system`, `/bundles`, `/faqs` | `pages/tools.ts` | 6 |
| `/learn`, `/learn/:category`, `/journal`, `/journal/:slug` | `pages/content.ts` | 21 |
| `/about`, `/rewards`, `/account`, `/contact`, `/search`, legal | `pages/misc.ts` | 10 |

Plus `sitemap.xml`, `robots.txt`, `search-index.json`, `favicon.svg`, `404.html`,
`styles.css` and `app.js`.

## Architecture

```
src/
  build.ts            Generator entry point. Routes, sitemap, robots, assets.
  serve.ts            Zero-dependency preview server with clean-URL resolution.
  lib/
    html.ts           Tagged-template HTML with escape-by-default. raw() opts out.
    types.ts          Domain model (Product, Collection, Article, Brand, Quiz).
    format.ts         Money, price ranges, dates, slugs.
    seo.ts            Metadata plus JSON-LD builders.
  data/
    products-hocl.ts  SolutionsHOCL. Live Shopify data. Compliance-governed.
    products-hvo.ts   Hawaiian Volcanic Organic. Live Shopify data.
    products-water.ts Life Ionizers and Pitcher of Life. Verified specs.
    articles.ts       14 editorial articles.
    catalog.ts        Aggregation: collections, brands, bundles, nav, quiz, search.
  site/
    styles.css        The design system.
    app.js            Browser runtime (cart, search, quiz, filters, reveal).
    layout.ts         Page shell: head, header, mega nav, drawers, footer.
    components.ts     Product cards, grids, section heads, accordions, trust.
    icons.ts          One 24px line-icon set. No mixed icon styles.
  pages/              One module per template.
```

**The data layer is the seam.** Templates only ever read from `data/catalog.ts`,
so swapping in a live Storefront API or a CMS means replacing that module without
touching a single template.

### HTML escaping

`html` is a tagged template that escapes every interpolated value by default:

```ts
html`<p>${userText}</p>`          // escaped
html`<div>${raw(trustedMarkup)}</div>`  // explicit opt-out
```

Nested `html` results are already marked safe, arrays are joined, and
`null` / `undefined` / `false` render as nothing, which makes conditional
fragments read naturally.

## Design system

Editorial serif (Cormorant Garamond) over a geometric sans (Inter), on a palette
of deep forest and warm cream with a restrained brass accent. The intended
balance is roughly 55% warm white and cream, 20% deep earth, 15% neutrals, 7%
imagery, 3% accent, with large areas of negative space.

All tokens live at the top of `src/site/styles.css`. Mobile-first throughout,
with a horizontal product rail below 62rem that becomes a grid above it.

## Accessibility

Targets WCAG 2.2 AA:

- Every page is readable and navigable with JavaScript disabled.
- Skip link, semantic landmarks, and heading order preserved per template.
- Visible focus rings that adapt on dark sections.
- Cart, menu and search are `role="dialog" aria-modal="true"` with focus trapping
  and focus restoration on close.
- Accordions and filters use real `aria-expanded` / `aria-pressed` state.
- `prefers-reduced-motion` disables reveal animations, the hero drift and smooth
  scrolling.
- Decorative imagery uses empty `alt`; meaningful imagery is described.

## Analytics

`src/site/app.js` exposes a single `track(event, payload)` funnel that pushes to
`dataLayer` for GA4 and mirrors to Meta and TikTok pixels when present. Adding a
vendor means editing one function. Events wired: `view_item`, `add_to_cart`,
`begin_checkout`, `search`, `add_to_wishlist`, `sign_up`, `generate_lead`.

No pixel is loaded by default; drop the vendor snippet into `layout.ts` when the
account IDs exist.

## SEO

Canonicals on every page, Open Graph and Twitter cards, `sitemap.xml` with
per-route priorities, and `robots.txt`. JSON-LD: Organization and WebSite on
every page, plus Product, CollectionPage, Article, BreadcrumbList and FAQPage
where they apply. Utility surfaces (`/account`, `/search`) carry `noindex` in the
head and are excluded from the sitemap.

## Content and claims policy

**`docs/COMPLIANCE.md` is required reading before editing any SolutionsHOCL copy.**
It encodes the governing rule set for HOCL, cistern, catchment, tank and
household cleaning language, including the banned-term list, the two approved
standard sentences, the single approved disclaimer, and the products that are
deliberately excluded because they are on compliance hold.

Beyond that, across the whole site: no invented certifications, awards, reviews,
test results, studies or founder history; no medical claims; no unsupported
environmental claims. The About page describes philosophy rather than a company
timeline for exactly this reason.

## Data provenance

| Source | What it covers | Status |
|---|---|---|
| Connected Shopify store (solutionshocl.com) | SolutionsHOCL and Hawaiian Volcanic Organic: handles, variant IDs, SKUs, prices, product imagery | Live, captured 2026-08-20 |
| Public brand listings | Life Ionizers MXL model names, plate counts, installation options, warranties; Pitcher of Life capacity, stages, pH range | Verified specifications |
| Placeholder | Life Ionizers and Pitcher of Life **prices**, and their product photography | See below |

Products carrying `pricePlaceholder: true` render a visible note on the product
page and in the comparison table. Their stores were not reachable from the build
environment, so figures must be synced from the live EarthTrade catalog before
launch. Any product with an empty `images` array renders a branded typographic
tile rather than a stand-in photograph, because substituting a generated image
for a real product would misrepresent it.

Art-directed environmental and editorial imagery in `public/images` is
AI-generated for scene setting only. No product itself is ever AI-generated.

## Known gaps before launch

1. Sync Life Ionizers and Pitcher of Life prices and product photography, then
   remove the `pricePlaceholder` flags.
2. Connect checkout. The cart is complete client-side (localStorage, quantities,
   free-shipping progress) but the checkout button is a stub.
3. Connect authentication, order history and the loyalty balance. `/account` is
   currently a UI preview and is `noindex`.
4. Add real analytics account IDs.
5. Add `@types/node` and run `tsc --noEmit` in CI. `tsconfig.json` sets
   `"types": []` because this project intentionally has no `node_modules`; the
   Node built-in imports in `build.ts` and `serve.ts` will not typecheck until
   those types are installed.
6. Wire the 301 redirects called for in `docs/COMPLIANCE.md` for the withdrawn
   produce cleaner URLs.
