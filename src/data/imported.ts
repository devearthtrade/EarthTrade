/**
 * The storefront's catalog, loaded from PostgreSQL.
 *
 * This module is the boundary between a database and a set of templates that
 * are, and should stay, synchronous. Loading happens once here, at module
 * evaluation, using top-level await; every export below is a plain value by the
 * time anything imports it. Pushing async any further up would have meant
 * threading promises through every page in the site to gain nothing — the
 * catalog is read exactly once per build.
 *
 * Set EARTHTRADE_CATALOG_SOURCE=json to render from the generated JSON export
 * instead. That exists so the two can be built and diffed against each other,
 * not as a fallback: if Postgres is unreachable the build should fail loudly
 * rather than quietly serve a stale copy of the catalog.
 *
 * Nothing here invents product facts. Fields absent from the catalog stay
 * absent: no badges, no bundled relationships, no specs, no stock figures.
 */

import { buildCatalog, type Catalog } from "./catalog-record.ts";
import { catalogSource } from "../server/db/config.ts";
import { loadFromJson } from "./sources/json.ts";
import type { BrandInfo, Collection, Product } from "../lib/types.ts";

async function load(): Promise<Catalog> {
  if (catalogSource() === "json") return buildCatalog(loadFromJson());

  // Imported lazily so a JSON-sourced build never opens a connection.
  const { loadFromPostgres } = await import("./sources/postgres.ts");
  return buildCatalog(await loadFromPostgres());
}

const catalog = await load();

export const withheldProducts = catalog.withheldProducts;
export const importedProducts: Product[] = catalog.products;

/** Brand and collection presentation, also owned by the database. */
export const importedBrands: BrandInfo[] = catalog.brands;
export const importedCollections: Collection[] = catalog.collections;

/** Collection membership as recorded against each product, keyed by handle. */
export const importedCollectionMembers = catalog.collectionMembers;

/** Counts the review report and the build banner read from. */
export const importMeta = catalog.meta;

export const importedFlags = catalog.flags;
