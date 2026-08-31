/**
 * Downscales oversized PNGs in public/images.
 *
 * The catalog arrived with product photographs at 3000×3000 and larger — one is
 * a 6 MB PNG. The storefront never displays them above about 700 CSS pixels, so
 * every visitor was downloading roughly twenty times the pixels their screen
 * could use, on a page that shows several of them.
 *
 * There is no image library available here: no ImageMagick, no ffmpeg, not even
 * PIL, and the package registry is unreachable. PNG is tractable without one —
 * it is zlib-compressed scanlines, and zlib is built into Node — so this decodes
 * and re-encodes them directly.
 *
 * What it does NOT do, deliberately: no cropping, no colour conversion, no
 * sharpening, no re-encoding to a lossy format. A product photograph has to keep
 * showing the product exactly as it is. Scaling down loses nothing a shopper
 * could see at the size it renders; anything else would be altering the product.
 *
 * Usage:
 *   node tools/optimise-images.ts            report what would change
 *   node tools/optimise-images.ts --write    rewrite the files in place
 *   node tools/optimise-images.ts --max 1600 use a different long edge
 *
 * Originals are in git. Run it, look at the result, and revert if you disagree.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const imagesDir = join(root, "public", "images");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const MAX_EDGE = Number(args[args.indexOf("--max") + 1]) || 1400;
/** Files below this are left alone; the work is not worth the risk. */
const THRESHOLD_BYTES = 400_000;

import { decode, encode, resize } from "./png-codec.ts";

/* ---------------------------------- run ---------------------------------- */

const files = readdirSync(imagesDir)
  .filter((f) => f.toLowerCase().endsWith(".png"))
  .map((name) => ({ name, size: statSync(join(imagesDir, name)).size }))
  .filter((f) => f.size > THRESHOLD_BYTES)
  .sort((a, b) => b.size - a.size);

console.log(
  `${files.length} PNG(s) over ${(THRESHOLD_BYTES / 1000).toFixed(0)} KB, long edge capped at ${MAX_EDGE}px` +
    `${WRITE ? "" : "  (dry run — pass --write to apply)"}\n`,
);

let before = 0;
let after = 0;
const skipped: string[] = [];

for (const { name, size } of files) {
  const path = join(imagesDir, name);
  const decoded = decode(readFileSync(path));

  if ("skip" in decoded) {
    skipped.push(`${name}: ${decoded.skip}`);
    continue;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(decoded.width, decoded.height));
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));

  const resized = scale < 1 ? resize(decoded, width, height) : decoded;

  // An image with no transparency does not need an alpha channel, and dropping
  // it removes a quarter of the data before compression even starts.
  let opaque = true;
  for (let i = 3; i < resized.pixels.length; i += 4) {
    if (resized.pixels[i] !== 255) { opaque = false; break; }
  }

  const encoded = encode(resized, opaque);

  // Never make a file bigger. If the re-encode does not help, leave it alone.
  if (encoded.length >= size) {
    skipped.push(`${name}: re-encoding would not shrink it`);
    before += size;
    after += size;
    continue;
  }

  before += size;
  after += encoded.length;

  console.log(
    `  ${(size / 1e6).toFixed(2)}MB -> ${(encoded.length / 1e6).toFixed(2)}MB  ` +
      `${decoded.width}x${decoded.height} -> ${width}x${height}` +
      `${opaque ? "  (alpha dropped)" : ""}  ${name}`,
  );

  if (WRITE) writeFileSync(path, encoded);
}

if (skipped.length) {
  console.log(`\nleft alone:`);
  for (const s of skipped) console.log(`  ${s}`);
}

console.log(
  `\n${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB` +
    ` (${before ? Math.round((1 - after / before) * 100) : 0}% smaller)` +
    `${WRITE ? "" : ", nothing written"}`,
);
