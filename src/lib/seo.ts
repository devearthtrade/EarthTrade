/** Structured data and metadata helpers. */

import { html, raw, type SafeHtml } from "./html.ts";
import type { Article, Collection, FaqItem, Product } from "./types.ts";
import { isoDate } from "./format.ts";

export const SITE_URL = "https://earthtrade.com";
export const SITE_NAME = "EarthTrade";

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  /** Absolute or root-relative image used for Open Graph. */
  image?: string;
  type?: "website" | "article" | "product";
  /** Suppress indexing (utility pages such as the account preview). */
  noindex?: boolean;
  /** Extra JSON-LD blocks. */
  jsonLd?: unknown[];
}

export function canonical(path: string): string {
  return `${SITE_URL}${path === "/" ? "" : path}`;
}

function ld(data: unknown): SafeHtml {
  // JSON-LD sits inside a script tag, so only "<" needs neutralising.
  const json = JSON.stringify(data, null, 0).replaceAll("<", "\\u003c");
  return html`<script type="application/ld+json">${raw(json)}</script>`;
}

export function jsonLdBlocks(blocks: unknown[]): SafeHtml {
  return raw(blocks.map((b) => ld(b).value).join("\n"));
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    slogan: "Better living, naturally engineered.",
    description:
      "EarthTrade is a premium marketplace for water, cleaner living, organic gardening and sustainable home care.",
    brand: [
      "Life Ionizers",
      "Pitcher of Life",
      "SolutionsHOCL",
      "Hawaiian Volcanic Organic",
      "Life Sciences Water",
    ].map((name) => ({ "@type": "Brand", name })),
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(trail: { label: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: canonical(item.href),
    })),
  };
}

export function productLd(p: Product, brandName: string) {
  const prices = p.variants.map((v) => v.price);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.shortBenefit,
    sku: p.variants[0]?.sku ?? p.handle,
    brand: { "@type": "Brand", name: brandName },
    ...(p.images.length ? { image: p.images.map((i) => i.src) } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: p.variants.length,
      availability: p.variants.some((v) => v.available)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: canonical(`/products/${p.handle}`),
    },
  };
}

export function faqLd(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function articleLd(a: Article) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt,
    datePublished: isoDate(a.date),
    dateModified: isoDate(a.date),
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: canonical(`/journal/${a.slug}`),
  };
}

export function collectionLd(c: Collection, items: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.title,
    description: c.description,
    url: canonical(`/collections/${c.handle}`),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.slice(0, 24).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title,
        url: canonical(`/products/${p.handle}`),
      })),
    },
  };
}
