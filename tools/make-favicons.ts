/**
 * Generates the site's favicon renditions from the original brand mark.
 *
 * The supplied `public/images/Earthtrade favicon.png` is a 2000×2000, ~450 KB
 * master — far too heavy to ship as a favicon. This produces the sizes
 * browsers actually ask for, into public/images so both the storefront build
 * and the Dashboard's image route serve them. The master file is left exactly
 * as uploaded.
 *
 *   node tools/make-favicons.ts
 *
 * The apple-touch rendition is composited onto the site's warm-white ground,
 * because iOS paints transparency black.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decode, encode, resize, type Raster } from "./png-codec.ts";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const SOURCE = join(root, "public", "images", "Earthtrade favicon.png");
const WARM_WHITE = [0xfa, 0xf9, 0xf5] as const;

function composite(img: Raster, [br, bg, bb]: readonly [number, number, number]): Raster {
  const pixels = new Uint8Array(img.pixels.length);
  for (let i = 0; i < img.pixels.length; i += 4) {
    const a = img.pixels[i + 3]! / 255;
    pixels[i] = Math.round(img.pixels[i]! * a + br * (1 - a));
    pixels[i + 1] = Math.round(img.pixels[i + 1]! * a + bg * (1 - a));
    pixels[i + 2] = Math.round(img.pixels[i + 2]! * a + bb * (1 - a));
    pixels[i + 3] = 255;
  }
  return { width: img.width, height: img.height, pixels };
}

const master = decode(readFileSync(SOURCE));
if ("skip" in master) {
  console.error(`Cannot read the favicon master: ${master.skip}`);
  process.exit(1);
}

const jobs: { name: string; size: number; flatten: boolean }[] = [
  { name: "earthtrade-favicon-32.png", size: 32, flatten: false },
  { name: "earthtrade-favicon-192.png", size: 192, flatten: false },
  { name: "earthtrade-favicon-512.png", size: 512, flatten: false },
  { name: "earthtrade-apple-touch.png", size: 180, flatten: true },
];

for (const { name, size, flatten } of jobs) {
  let img = resize(master, size, size);
  if (flatten) img = composite(img, WARM_WHITE);
  const bytes = encode(img, flatten);
  writeFileSync(join(root, "public", "images", name), bytes);
  console.log(`  ${size}x${size}  ${(bytes.length / 1024).toFixed(1)} KB  ${name}`);
}
console.log("done");
