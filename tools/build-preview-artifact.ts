/**
 * Packs the entire built storefront into one self-contained HTML file, for
 * publishing as a claude.ai Artifact.
 *
 * The artifact at
 *
 *   https://claude.ai/code/artifact/0fd14fd9-3ae1-44af-b0c8-9adb5bbf4b9d
 *
 * is the project's standing review URL: private to the owner, persistent
 * across sessions, and updated in place after site changes. This tool builds
 * the file; publishing it to that URL is done by Claude (see
 * docs/PREVIEW-ARTIFACT.md).
 *
 * The problem it solves: the built site is ~32 MB and an artifact page must
 * stay under 16 MB, in one file, with no external requests. Two moves close
 * the gap:
 *
 *   1. Every page is deflate-compressed at build time and decompressed in the
 *      viewer's browser with the native DecompressionStream API. 164 pages of
 *      HTML (~6.5 MB) travel as ~1.1 MB.
 *
 *   2. Every image is re-encoded at display resolution. There is no image
 *      library in the usual environments this runs in, but there is always a
 *      Chromium — so Chromium *is* the codec: each image is drawn to a canvas
 *      at a maximum long edge of 1000px and exported as WebP. Files that were
 *      already smaller than their re-encoding are kept as-is. This is a
 *      preview rendition only; the repository's originals are untouched.
 *
 * At runtime the shell mounts one real page at a time in an isolated frame:
 * the page's own CSS and JavaScript run unmodified, images resolve from a
 * shared blob-URL table, internal links become hash routes, and the search
 * box works because the search index is embedded and app.js's single fetch is
 * answered locally.
 *
 * Usage:
 *   node tools/build-preview-artifact.ts            # writes earthtrade-preview.html
 *   CHROME=/path/to/chrome node tools/...           # explicit browser binary
 *
 * The output file is git-ignored: it is a build product, ~8 MB, and derivable.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const dist = join(root, "dist");
const out = join(root, "earthtrade-preview.html");

/* ------------------------------ prerequisites ---------------------------- */

if (!existsSync(join(dist, "index.html"))) {
  console.log("dist/ is missing — building the site first\n");
  execFileSync("node", [join(root, "src", "build.ts")], { stdio: "inherit" });
}

function findChromium(): string {
  if (process.env["CHROME"] && existsSync(process.env["CHROME"])) return process.env["CHROME"];

  const pwRoot = "/opt/pw-browsers";
  if (existsSync(pwRoot)) {
    for (const d of readdirSync(pwRoot)) {
      const p = join(pwRoot, d, "chrome-linux", "chrome");
      if (existsSync(p)) return p;
    }
  }
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const p = execFileSync("which", [name], { encoding: "utf8" }).trim();
      if (p) return p;
    } catch {
      /* keep looking */
    }
  }
  throw new Error(
    "No Chromium found. Images are re-encoded through a headless browser; set CHROME=/path/to/chrome.",
  );
}

const CHROME = findChromium();

/* ------------------------- images, via Chromium --------------------------- */

interface Converted {
  data?: string;
  keep?: boolean;
  bytes: number;
  was?: number;
  error?: string;
}

function convertImages(): Record<string, Converted> {
  const imagesDir = join(dist, "images");
  const files = readdirSync(imagesDir)
    .filter((f) => statSync(join(imagesDir, f)).isFile())
    .sort()
    .map((name) => ({
      name,
      size: statSync(join(imagesDir, name)).size,
      url: pathToFileURL(join(imagesDir, name)).href,
    }));

  // The conversion has to finish before headless Chromium dumps the DOM, and
  // headless dumps at the load event. Real <img> elements delay load until
  // they are decoded, and everything after decoding — drawImage, toDataURL —
  // is synchronous, so running it all inside the load handler guarantees the
  // result is in the DOM when the dump happens.
  const driver = `<!doctype html><meta charset="utf-8"><body style="display:none">
${files.map((f) => `<img data-n="${f.name}" data-s="${f.size}" src="${f.url}">`).join("\n")}
<pre id="out">working</pre><script>
const MAX = 1000, Q = 0.82;
window.addEventListener("load", () => {
  const results = {};
  const c = document.createElement("canvas");
  for (const img of document.images) {
    const name = img.dataset.n, orig = Number(img.dataset.s);
    try {
      if (!img.naturalWidth) { results[name] = {error: "failed to decode", bytes: orig}; continue; }
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const webp = c.toDataURL("image/webp", Q);
      const webpBytes = Math.floor((webp.length - 23) * 3 / 4);
      if (webpBytes >= orig) results[name] = {keep: true, bytes: orig};
      else results[name] = {data: webp, bytes: webpBytes, was: orig};
    } catch (e) { results[name] = {error: String(e), bytes: orig}; }
  }
  document.getElementById("out").textContent = "RESULT" + JSON.stringify(results) + "ENDRESULT";
});
<` + `/script></body>`;

  const work = mkdtempSync(join(tmpdir(), "et-preview-"));
  try {
    const driverPath = join(work, "convert.html");
    writeFileSync(driverPath, driver);
    const dom = execFileSync(
      CHROME,
      ["--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
       "--dump-dom", pathToFileURL(driverPath).href],
      { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
    );
    const m = /RESULT(\{[\s\S]*\})ENDRESULT/.exec(dom);
    if (!m) throw new Error("Chromium image conversion did not complete");
    return JSON.parse(m[1]!) as Record<string, Converted>;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

console.log("converting images through Chromium...");
const converted = convertImages();

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif",
};

const images: Record<string, { m: string; d: string }> = {};
const errors: string[] = [];
let imageB64 = 0;
for (const [name, v] of Object.entries(converted)) {
  if (v.error) {
    errors.push(`${name}: ${v.error}`);
    continue;
  }
  const key = `/images/${name}`;
  if (v.data) {
    const b64 = v.data.split(",", 2)[1]!;
    images[key] = { m: "image/webp", d: b64 };
    imageB64 += b64.length;
  } else {
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    const b64 = readFileSync(join(dist, "images", name)).toString("base64");
    images[key] = { m: MIME[ext] ?? "application/octet-stream", d: b64 };
    imageB64 += b64.length;
  }
}
if (errors.length) {
  console.error(`image conversion errors:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

/* -------------------------------- pages ----------------------------------- */

const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function* pageFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* pageFiles(p);
    else if (entry.name === "index.html") yield p;
  }
}

const pages: Record<string, string> = {};
let rawTotal = 0;
let compTotal = 0;
for (const file of [...pageFiles(dist)].sort()) {
  const rel = file.slice(dist.length, -"/index.html".length) || "/";
  let s = readFileSync(file, "utf8");
  s = s.replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml">', "");
  // Images must never attempt their raw path inside the frame: the 404 would
  // fire the site's own image-fallback before the shell can swap in the blob.
  s = s.replace(/src="(\/images\/[^"]+)"/g, (_m, p1: string) => `src="${BLANK}" data-psrc="${p1}"`);
  const raw = Buffer.from(s, "utf8");
  const comp = deflateRawSync(raw, { level: 9 });
  pages[rel] = comp.toString("base64");
  rawTotal += raw.length;
  compTotal += comp.length;
}

/* ------------------------------ build audit -------------------------------- */

const KNOWN_ASSETS = new Set(["/styles.css", "/app.js", "/favicon.svg", "/search-index.json"]);
const problems: string[] = [];
for (const file of pageFiles(dist)) {
  const s = readFileSync(file, "utf8");
  for (const m of s.matchAll(/href="(\/[^"#?]*)"/g)) {
    const clean = m[1]!.replace(/\/+$/, "") || "/";
    if (pages[clean] || images[clean] || KNOWN_ASSETS.has(clean)) continue;
    problems.push(`${file}: ${m[1]}`);
  }
  for (const m of s.matchAll(/(?:src|data-psrc|data-gallery-thumb)="(\/images\/[^"]+)"/g)) {
    if (!images[m[1]!] && !images[decodeURIComponent(m[1]!)]) {
      problems.push(`${file}: missing image ${m[1]}`);
    }
  }
}
if (problems.length) {
  console.error(`audit failures:\n  ${problems.slice(0, 10).join("\n  ")}`);
  process.exit(1);
}

/* ---------------------------- shared assets -------------------------------- */

const css = readFileSync(join(dist, "styles.css"), "utf8");
const appjs = readFileSync(join(dist, "app.js"), "utf8").replace(
  'fetch("/search-index.json")',
  "Promise.resolve({ok:true,json:()=>Promise.resolve(window.parent.__SEARCH_INDEX)})",
);
if (appjs.includes("search-index.json")) {
  console.error("app.js fetch patch did not apply — its search call changed shape");
  process.exit(1);
}
const search = readFileSync(join(dist, "search-index.json"), "utf8");

const jsJson = (o: unknown): string =>
  JSON.stringify(o).replace(/<\/script/g, "<\\/script");

const built = new Date().toISOString().slice(0, 10);

/* ------------------------------- the shell --------------------------------- */

// No template-literal interpolation below: the shell is assembled with
// placeholder tokens so page content can never be parsed as part of this file.
const shell = `<title>EarthTrade Storefront</title>
<style>
  /* The storefront carries its complete design system inside the frame; this
     shell paints the ground and one slim status bar in the site's own palette.
     One visual world by design, explicit on both host themes. */
  :root { --deep-green:#26382F; --warm-white:#FAF9F5; --sand:#E9E4D9; }
  html, body { margin:0; height:100%; }
  body { background:var(--warm-white); color:var(--deep-green);
         font:13px/1.4 Inter, -apple-system, "Segoe UI", sans-serif;
         display:flex; flex-direction:column; }
  #page { flex:1; border:0; width:100%; display:block; background:var(--warm-white); }
  #bar { flex:none; background:var(--deep-green); color:var(--sand);
         display:flex; gap:1rem; align-items:center; padding:.45rem .9rem;
         font-size:.72rem; letter-spacing:.02em; }
  #bar b { color:var(--warm-white); font-weight:600; }
  #bar .sp { flex:1; }
  #bar a { color:var(--sand); text-decoration:underline; text-underline-offset:2px; }
  #bar a:focus-visible { outline:2px solid var(--sand); outline-offset:2px; }
  #toast { position:fixed; left:50%; bottom:3.2rem; transform:translateX(-50%) translateY(8px);
           background:var(--deep-green); color:var(--warm-white); padding:.6rem 1rem;
           border-radius:4px; font-size:.78rem; max-width:min(92vw,34rem);
           opacity:0; pointer-events:none; transition:opacity .18s, transform .18s;
           box-shadow:0 6px 24px rgba(32,39,34,.35); }
  #toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
  @media (prefers-reduced-motion: reduce) { #toast { transition:none; } }
  @media (max-width: 640px) { #bar span.hide-sm { display:none; } }
</style>
<iframe id="page" title="EarthTrade storefront"></iframe>
<div id="bar">
  <b>EarthTrade</b><span class="hide-sm">all __COUNT__ pages &middot; built from PostgreSQL __BUILT__</span>
  <span class="sp"></span>
  <span><a href="#" id="how">run it locally</a></span>
</div>
<div id="toast" role="status"></div>
<script id="d-pages" type="application/json">__PAGES__</script>
<script id="d-images" type="application/json">__IMAGES__</script>
<script id="d-search" type="application/json">__SEARCH__</script>
<script id="d-css" type="application/json">__CSS__</script>
<script id="d-js" type="application/json">__APPJS__</script>
<script>
(() => {
  const PAGES  = JSON.parse(document.getElementById("d-pages").textContent);
  const IMAGES = JSON.parse(document.getElementById("d-images").textContent);
  const CSS    = JSON.parse(document.getElementById("d-css").textContent);
  const APPJS  = JSON.parse(document.getElementById("d-js").textContent);
  window.__SEARCH_INDEX = JSON.parse(document.getElementById("d-search").textContent);

  const frame = document.getElementById("page");
  const toastEl = document.getElementById("toast");
  let toastTimer;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4200);
  };

  if (typeof DecompressionStream === "undefined") {
    document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">This preview needs a current browser (Chrome 80+, Safari 16.4+, Firefox 113+).</p>';
    return;
  }

  // Every image once, shared by all pages as blob URLs.
  const BLOBS = {};
  for (const [path, e] of Object.entries(IMAGES)) {
    const bin = atob(e.d), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    BLOBS[path] = URL.createObjectURL(new Blob([bytes], {type: e.m}));
  }

  const cache = new Map();
  async function pageHtml(route) {
    if (cache.has(route)) return cache.get(route);
    const bin = atob(PAGES[route]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    let html = await new Response(stream).text();
    html = html.replace('<link rel="stylesheet" href="/styles.css">', "<style>" + CSS + "</style>");
    html = html.replace('<script src="/app.js" defer><' + "/script>",
                        "<script defer>" + APPJS + "<" + "/script>");
    cache.set(route, html);
    return html;
  }

  const route = () => {
    const r = decodeURIComponent(location.hash.slice(1)) || "/";
    return PAGES[r] ? r : "/";
  };

  const resolveImages = (doc) => {
    for (const el of doc.querySelectorAll("[data-psrc]")) {
      // Pages reference percent-encoded paths ("Earthtrade%20logo.avif") while
      // the table is keyed by raw filenames — accept either form, or a
      // filename with a space mounts as a blank pixel.
      const p = el.getAttribute("data-psrc");
      const b = BLOBS[p] || BLOBS[decodeURIComponent(p)];
      if (b) { el.src = b; el.removeAttribute("data-psrc"); }
    }
    for (const el of doc.querySelectorAll('img[src^="/images/"]')) {
      const b = BLOBS[el.getAttribute("src")];
      if (b) el.src = b;
    }
    for (const el of doc.querySelectorAll('[data-gallery-thumb^="/images/"]')) {
      const b = BLOBS[el.getAttribute("data-gallery-thumb")];
      if (b) el.setAttribute("data-gallery-thumb", b);
    }
  };

  const wire = (doc) => {
    resolveImages(doc);
    new MutationObserver(() => resolveImages(doc))
      .observe(doc.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["src"]});

    doc.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!href.startsWith("/")) { e.preventDefault(); return; }
      e.preventDefault();
      const clean = href.replace(/[#?].*$/, "").replace(/\\/+$/, "") || "/";
      if (PAGES[clean]) location.hash = "#" + clean;
      else toast("That link has no page in this preview.");
    }, true);
  };

  let seq = 0;
  async function show() {
    const my = ++seq;
    const html = await pageHtml(route());
    if (my !== seq) return;
    frame.addEventListener("load", () => { try { wire(frame.contentDocument); } catch (e) {} }, {once: true});
    frame.srcdoc = html;
  }

  window.addEventListener("hashchange", show);
  document.getElementById("how").addEventListener("click", (e) => {
    e.preventDefault();
    toast("Clone branch claude/earthtrade-premium-redesign-ucf0x6, then: node src/build.ts && node src/serve.ts \\u2192 http://localhost:4173 \\u2014 see docs/LOCAL-SETUP.md");
  });
  show();
})();
<` + `/script>`;

const result = shell
  .replace("__COUNT__", String(Object.keys(pages).length))
  .replace("__BUILT__", built)
  .replace("__PAGES__", jsJson(pages))
  .replace("__IMAGES__", jsJson(images))
  .replace("__SEARCH__", jsJson(JSON.parse(search)))
  .replace("__CSS__", jsJson(css))
  .replace("__APPJS__", jsJson(appjs));

writeFileSync(out, result, "utf8");

const size = statSync(out).size;
console.log(`routes      ${Object.keys(pages).length}`);
console.log(`images      ${Object.keys(images).length}  (${(imageB64 / 1e6).toFixed(1)}MB as base64)`);
console.log(`page HTML   ${(rawTotal / 1e6).toFixed(1)}MB raw -> ${(compTotal / 1e6).toFixed(1)}MB deflated`);
console.log(`output      ${out}`);
console.log(`size        ${(size / 1e6).toFixed(1)}MB  ${size < 15_500_000 ? "(within the 16MB artifact limit)" : "(TOO BIG for an artifact)"}`);
if (size >= 15_500_000) process.exit(1);
console.log(
  "\nTo update the review URL, ask Claude to publish this file to the existing artifact:" +
  "\n  https://claude.ai/code/artifact/0fd14fd9-3ae1-44af-b0c8-9adb5bbf4b9d",
);
