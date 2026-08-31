/**
 * Minimal PNG codec: decode to RGBA8, box-resample, encode.
 *
 * There is no image library available here — no ImageMagick, no PIL, and the
 * package registry is unreachable — but PNG is tractable without one: it is
 * zlib-compressed scanlines, and zlib is built into Node.
 *
 * Extracted verbatim from tools/optimise-images.ts so the favicon generator
 * can share it; that script's top level runs the optimiser, so importing it
 * directly was not an option.
 */

import { deflateSync, inflateSync } from "node:zlib";

export const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ------------------------------- PNG chunks ------------------------------ */

interface Chunk {
  type: string;
  data: Buffer;
}

function readChunks(buf: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let off = 8;
  while (off < buf.length) {
    const length = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + length) });
    off += 12 + length; // length + type + data + crc
  }
  return chunks;
}

/** CRC-32, as the PNG spec defines it. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/* -------------------------------- decoding ------------------------------- */

export interface Raster {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel. */
  pixels: Uint8Array;
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Reverses the per-scanline filter PNG applies before compression. */
function unfilter(raw: Buffer, width: number, height: number, bpp: number): Buffer {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp]! : 0;
      const b = prev ? prev[i]! : 0;
      const c = prev && i >= bpp ? prev[i - bpp]! : 0;
      const x = line[i]!;

      cur[i] =
        filter === 0 ? x
        : filter === 1 ? (x + a) & 0xff
        : filter === 2 ? (x + b) & 0xff
        : filter === 3 ? (x + ((a + b) >> 1)) & 0xff
        : (x + paeth(a, b, c)) & 0xff;
    }
  }
  return out;
}

/** Reads a PNG into RGBA8, or explains which form it will not touch. */
export function decode(buf: Buffer): Raster | { skip: string } {
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return { skip: "not a PNG" };

  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) return { skip: "no IHDR" };

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data[8]!;
  const colourType = ihdr.data[9]!;
  const interlace = ihdr.data[12]!;

  // Adam7 is a different scanline layout and is rare in exported product
  // photography. Refusing is better than getting it subtly wrong.
  if (interlace !== 0) return { skip: "interlaced" };
  if (bitDepth !== 8) return { skip: `${bitDepth}-bit` };

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colourType];
  if (!channels) return { skip: `colour type ${colourType}` };

  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const raw = unfilter(inflateSync(idat), width, height, channels);

  const palette = chunks.find((c) => c.type === "PLTE")?.data;
  const transparency = chunks.find((c) => c.type === "tRNS")?.data;
  if (colourType === 3 && !palette) return { skip: "palette image with no PLTE" };

  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const s = i * channels;
    if (colourType === 0) {
      pixels[p] = pixels[p + 1] = pixels[p + 2] = raw[s]!;
      pixels[p + 3] = 255;
    } else if (colourType === 2) {
      pixels[p] = raw[s]!; pixels[p + 1] = raw[s + 1]!; pixels[p + 2] = raw[s + 2]!;
      pixels[p + 3] = 255;
    } else if (colourType === 3) {
      const idx = raw[s]!;
      pixels[p] = palette![idx * 3]!;
      pixels[p + 1] = palette![idx * 3 + 1]!;
      pixels[p + 2] = palette![idx * 3 + 2]!;
      pixels[p + 3] = transparency && idx < transparency.length ? transparency[idx]! : 255;
    } else if (colourType === 4) {
      pixels[p] = pixels[p + 1] = pixels[p + 2] = raw[s]!;
      pixels[p + 3] = raw[s + 1]!;
    } else {
      pixels[p] = raw[s]!; pixels[p + 1] = raw[s + 1]!;
      pixels[p + 2] = raw[s + 2]!; pixels[p + 3] = raw[s + 3]!;
    }
  }

  return { width, height, pixels };
}

/* ------------------------------- resampling ------------------------------ */

/**
 * Box filter: each output pixel is the average of the source pixels it covers.
 *
 * For a large reduction this is what you want. Nearest-neighbour would alias
 * badly on product photography with fine print on labels, and a box average
 * over the whole source region keeps that text readable rather than sparkling.
 *
 * Colour is averaged weighted by alpha, so a transparent edge does not drag
 * the visible pixels towards whatever colour happens to sit behind them.
 */
export function resize(src: Raster, width: number, height: number): Raster {
  const out = new Uint8Array(width * height * 4);
  const xRatio = src.width / width;
  const yRatio = src.height / height;

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.min(Math.ceil((y + 1) * yRatio), src.height);

    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.min(Math.ceil((x + 1) * xRatio), src.width);

      let r = 0, g = 0, b = 0, a = 0, weight = 0, count = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const s = (sy * src.width + sx) * 4;
          const alpha = src.pixels[s + 3]!;
          r += src.pixels[s]! * alpha;
          g += src.pixels[s + 1]! * alpha;
          b += src.pixels[s + 2]! * alpha;
          a += alpha;
          weight += alpha;
          count++;
        }
      }

      const d = (y * width + x) * 4;
      if (weight === 0) {
        out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0;
      } else {
        out[d] = Math.round(r / weight);
        out[d + 1] = Math.round(g / weight);
        out[d + 2] = Math.round(b / weight);
        out[d + 3] = Math.round(a / count);
      }
    }
  }
  return { width, height, pixels: out };
}

/* -------------------------------- encoding ------------------------------- */

/** Sum of absolute differences, the standard heuristic for choosing a filter. */
function score(line: Buffer): number {
  let total = 0;
  for (const byte of line) total += byte < 128 ? byte : 256 - byte;
  return total;
}

export function encode(img: Raster, opaque: boolean): Buffer {
  const channels = opaque ? 3 : 4;
  const stride = img.width * channels;
  const raw = Buffer.alloc((stride + 1) * img.height);

  const candidate = Buffer.alloc(stride);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < img.height; y++) {
    const line = Buffer.alloc(stride);
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      const d = x * channels;
      line[d] = img.pixels[s]!;
      line[d + 1] = img.pixels[s + 1]!;
      line[d + 2] = img.pixels[s + 2]!;
      if (!opaque) line[d + 3] = img.pixels[s + 3]!;
    }

    // Try every filter and keep the one that compresses best. This is what
    // makes the difference between a merely smaller file and a much smaller
    // one — flat product backgrounds filter extremely well.
    let bestFilter = 0;
    let bestScore = Infinity;
    let best = Buffer.alloc(stride);

    for (let f = 0; f < 5; f++) {
      for (let i = 0; i < stride; i++) {
        const a = i >= channels ? line[i - channels]! : 0;
        const b = prev[i]!;
        const c = i >= channels ? prev[i - channels]! : 0;
        const x = line[i]!;
        candidate[i] =
          f === 0 ? x
          : f === 1 ? (x - a) & 0xff
          : f === 2 ? (x - b) & 0xff
          : f === 3 ? (x - ((a + b) >> 1)) & 0xff
          : (x - paeth(a, b, c)) & 0xff;
      }
      const s = score(candidate);
      if (s < bestScore) {
        bestScore = s;
        bestFilter = f;
        candidate.copy(best);
      }
    }

    raw[y * (stride + 1)] = bestFilter;
    best.copy(raw, y * (stride + 1) + 1);
    prev = line;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    PNG_MAGIC,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
