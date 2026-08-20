/**
 * Minimal static preview server for `dist/`.
 *
 * Node's built-in http only, no dependencies. Resolves clean URLs the way a
 * CDN would: `/products/foo` serves `dist/products/foo/index.html`.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(fileURLToPath(import.meta.url), "..", "..", "dist");
const port = Number(process.env.PORT ?? 4173);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function resolveFile(urlPath: string): Promise<string | null> {
  // Strip query/hash, decode, and block path traversal before touching disk.
  const clean = decodeURIComponent(urlPath.split("?")[0]!.split("#")[0]!);
  const safe = normalize(clean).replace(/^(\.\.[/\\])+/, "");
  const target = join(dist, safe);
  if (!target.startsWith(dist)) return null;

  const candidates = extname(target)
    ? [target]
    : [join(target, "index.html"), `${target}.html`];

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? "/");

  if (!file) {
    try {
      const body = await readFile(join(dist, "404.html"));
      res.writeHead(404, { "content-type": TYPES[".html"]! });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
    return;
  }

  const body = await readFile(file);
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
  });
  res.end(body);
});

server.listen(port, () => {
  console.log(`EarthTrade preview running at http://localhost:${port}`);
});
