/**
 * Static site generator for the EarthTrade storefront.
 *
 * Run with `node src/build.ts` (Node 22+ strips the TypeScript natively, so
 * there is no compile step and no dependencies). Emits `dist/`.
 */

import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { dirname, join as joinPath } from "node:path";
import { fileURLToPath } from "node:url";

import { articles } from "./data/articles.ts";
import {
  brands,
  buildSearchIndex,
  collections,
  products,
} from "./data/catalog.ts";
import type { ArticleCategory } from "./lib/types.ts";
import { SITE_URL } from "./lib/seo.ts";
import { faviconSvg } from "./site/icons.ts";

import { homePage } from "./pages/home.ts";
import { collectionPage } from "./pages/collection.ts";
import { productPage } from "./pages/product.ts";
import { brandPage, brandsIndexPage } from "./pages/brand.ts";
import {
  bundlesPage,
  buildSystemPage,
  comparePage,
  faqsPage,
  finderPage,
  quizPage,
} from "./pages/tools.ts";
import {
  CATEGORY_META,
  articlePage,
  journalPage,
  learnCategoryPage,
  learnPage,
} from "./pages/content.ts";
import {
  aboutPage,
  accessibilityPage,
  accountPage,
  contactPage,
  notFoundPage,
  privacyPage,
  rewardsPage,
  searchPage,
  shippingPage,
  termsPage,
} from "./pages/misc.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = joinPath(here, "..");
const dist = joinPath(root, "dist");

/** Pages that belong in the sitemap, with a relative priority. */
const sitemap: { path: string; priority: number; changefreq: string }[] = [];

async function emit(
  routePath: string,
  htmlString: string,
  seo?: { priority: number; changefreq?: string },
): Promise<void> {
  // "/" -> dist/index.html, "/a/b" -> dist/a/b/index.html
  const filePath =
    routePath === "/"
      ? joinPath(dist, "index.html")
      : joinPath(dist, routePath.replace(/^\//, ""), "index.html");

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, htmlString, "utf8");

  if (seo) {
    sitemap.push({ path: routePath, priority: seo.priority, changefreq: seo.changefreq ?? "monthly" });
  }
}

async function copyAsset(from: string, to: string): Promise<void> {
  const buf = await readFile(joinPath(root, from));
  const dest = joinPath(dist, to);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

async function copyImages(): Promise<number> {
  const srcDir = joinPath(root, "public", "images");
  let names: string[] = [];
  try {
    const { readdir } = await import("node:fs/promises");
    names = await readdir(srcDir);
  } catch {
    return 0;
  }
  let count = 0;
  for (const name of names) {
    if (name.startsWith(".")) continue;
    await copyAsset(joinPath("public", "images", name), joinPath("images", name));
    count += 1;
  }
  return count;
}

function buildSitemapXml(): string {
  const urls = sitemap
    .slice()
    .sort((a, b) => b.priority - a.priority)
    .map(
      (entry) => `  <url>
    <loc>${SITE_URL}${entry.path === "/" ? "/" : entry.path}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.w3.org/1999/sitemap-image/1.1 http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function buildRobotsTxt(): string {
  return `User-agent: *
Allow: /

# Utility surfaces carry noindex in the page head as well.
Disallow: /account
Disallow: /search

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

async function main(): Promise<void> {
  const started = Date.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  // ---- Home
  await emit("/", homePage(articles), { priority: 1.0, changefreq: "weekly" });

  // ---- Collections
  for (const c of collections) {
    if (c.hidden) continue;
    await emit(`/collections/${c.handle}`, collectionPage(c), {
      priority: c.handle === "best-sellers" ? 0.9 : 0.8,
      changefreq: "weekly",
    });
  }

  // ---- Products
  for (const p of products) {
    await emit(`/products/${p.handle}`, productPage(p), { priority: 0.8, changefreq: "weekly" });
  }

  // ---- Brands
  await emit("/brands", brandsIndexPage(), { priority: 0.6 });
  for (const b of brands) {
    await emit(`/brands/${b.id}`, brandPage(b), { priority: 0.7 });
  }

  // ---- Tools
  await emit("/quiz", quizPage(), { priority: 0.8, changefreq: "monthly" });
  await emit("/filter-finder", finderPage(), { priority: 0.8, changefreq: "monthly" });
  await emit("/compare/ionizers", comparePage(), { priority: 0.7 });
  await emit("/build-your-system", buildSystemPage(), { priority: 0.7 });
  await emit("/bundles", bundlesPage(), { priority: 0.7 });
  await emit("/faqs", faqsPage(), { priority: 0.6 });

  // ---- Learn and journal
  await emit("/learn", learnPage(articles), { priority: 0.7, changefreq: "weekly" });
  const categories = [...new Set(articles.map((a) => a.category))] as ArticleCategory[];
  for (const category of categories) {
    if (!CATEGORY_META[category]) continue;
    await emit(`/learn/${category}`, learnCategoryPage(category, articles), { priority: 0.6 });
  }
  await emit("/journal", journalPage(articles), { priority: 0.7, changefreq: "weekly" });
  for (const a of articles) {
    await emit(`/journal/${a.slug}`, articlePage(a, articles), { priority: 0.6 });
  }

  // ---- Static pages
  await emit("/about", aboutPage(), { priority: 0.6 });
  await emit("/rewards", rewardsPage(), { priority: 0.5 });
  await emit("/contact", contactPage(), { priority: 0.5 });
  await emit("/shipping-returns", shippingPage(), { priority: 0.4, changefreq: "yearly" });
  await emit("/privacy", privacyPage(), { priority: 0.3, changefreq: "yearly" });
  await emit("/terms", termsPage(), { priority: 0.3, changefreq: "yearly" });
  await emit("/accessibility", accessibilityPage(), { priority: 0.3, changefreq: "yearly" });

  // Not in the sitemap (noindex).
  await emit("/account", accountPage());
  await emit("/search", searchPage());
  await writeFile(joinPath(dist, "404.html"), notFoundPage(), "utf8");

  // ---- Assets
  await copyAsset(joinPath("src", "site", "styles.css"), "styles.css");
  await copyAsset(joinPath("src", "site", "app.js"), "app.js");
  await writeFile(joinPath(dist, "favicon.svg"), faviconSvg, "utf8");
  const imageCount = await copyImages();

  // ---- Search index
  const index = buildSearchIndex(
    articles.map((a) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, category: a.category })),
  );
  await writeFile(joinPath(dist, "search-index.json"), JSON.stringify(index), "utf8");

  // ---- SEO files
  await writeFile(joinPath(dist, "sitemap.xml"), buildSitemapXml(), "utf8");
  await writeFile(joinPath(dist, "robots.txt"), buildRobotsTxt(), "utf8");

  const ms = Date.now() - started;
  console.log(
    [
      `EarthTrade build complete in ${ms}ms`,
      `  pages         ${sitemap.length + 3}`,
      `  products      ${products.length}`,
      `  collections   ${collections.filter((c) => !c.hidden).length}`,
      `  articles      ${articles.length}`,
      `  brands        ${brands.length}`,
      `  images        ${imageCount}`,
      `  search docs   ${index.length}`,
      `  output        dist/`,
    ].join("\n"),
  );

  if (imageCount === 0) {
    console.warn(
      "\nNote: public/images is empty, so pages reference images that are not present yet.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
