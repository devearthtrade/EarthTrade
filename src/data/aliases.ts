/**
 * Product handle aliases and editorial link resolution.
 *
 * The imported catalog renamed or dropped products the editorial content was
 * written against. Two mechanisms keep that content honest:
 *
 *  - `HANDLE_ALIASES` redirects an old handle to the same product under its new
 *    handle. Only genuine same-product renames belong here. Pointing a link at
 *    a different product would misdescribe it, so near-matches are excluded.
 *
 *  - `resolveProductLinks` rewrites article prose at build time. Aliased links
 *    are repointed; links to products that no longer exist lose their anchor
 *    and stay as plain text, so the sentence still reads and nothing 404s.
 *
 * Every unresolved link is collected in `unresolvedLinks` for the import report
 * rather than disappearing quietly.
 */

/**
 * Old handle to current handle. Each entry is a rename of the same product,
 * confirmed by matching product title, and each is listed in the import report
 * for sign-off.
 */
export const HANDLE_ALIASES: Record<string, string> = {
  // "Cistern & Catchment Bomb" under its fuller imported name.
  "cistern-catchment-bomb": "cistern-catchment-bomb-tank-cleaner",
  // The imported catalog splits this by pack size; 100 g is the base size.
  "cistern-tank-cleaner": "cistern-tank-cleaner-100-grams",
};

export const unresolvedLinks: { handle: string; context: string }[] = [];

/**
 * Rewrites `/products/<handle>` anchors in a block of editorial HTML.
 * `exists` reports whether a handle is in the current catalog.
 */
export function resolveProductLinks(
  bodyHtml: string,
  exists: (handle: string) => boolean,
  context: string,
): string {
  return bodyHtml.replace(
    /<a\b([^>]*?)href="\/products\/([a-z0-9-]+)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (whole, pre: string, handle: string, post: string, inner: string) => {
      if (exists(handle)) return whole;

      const alias = HANDLE_ALIASES[handle];
      if (alias && exists(alias)) {
        return `<a${pre}href="/products/${alias}"${post}>${inner}</a>`;
      }

      if (!unresolvedLinks.some((u) => u.handle === handle && u.context === context)) {
        unresolvedLinks.push({ handle, context });
      }
      // Keep the words, drop the dead link.
      return inner;
    },
  );
}

/** Resolves a handle through the alias map. Returns null when nothing matches. */
export function resolveHandle(
  handle: string,
  exists: (h: string) => boolean,
): string | null {
  if (exists(handle)) return handle;
  const alias = HANDLE_ALIASES[handle];
  return alias && exists(alias) ? alias : null;
}
