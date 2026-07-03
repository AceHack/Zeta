/**
 * from-image.ts — the mechanical photo->grid front end for the chip9-cart capture format
 * (081KWJE90EZ, layer-2 slice: image in, quantized 3-plane grid out, cart optional).
 *
 * Zero new dependencies: a minimal PNG codec (8-bit RGB/RGBA, non-interlaced, all five row
 * filters) over node:zlib, plus a box-downsample + 3-bit-RGB quantizer that fits any image
 * into the treaty VM's 64x32, aspect-preserved.
 *
 * HONEST BOUNDS: this is LOSSY BY DESIGN — the output gamut is 8 colors at <=64x32; it is the
 * cart-fidelity view of a capture, not an archival copy. "No stored photos" is only true once
 * the SEMANTIC layer (transcription) carries the load-bearing content; this front end feeds the
 * drawable layer. PNG support is deliberately narrow (bit depth 8, color types 2/6, no
 * interlace) and fails loudly outside it.
 */

import { inflateSync, deflateSync } from "node:zlib";
import { compile, type CaptureCart } from "./capture";

// ---- CRC-32 (IEEE 0xEDB88320 — PNG's; NOT the repo's crc32c/Castagnoli) ----------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array; // 4 bytes/pixel, row-major
}

// ---- decode -----------------------------------------------------------------------------

export function decodePng(bytes: Uint8Array): RgbaImage {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error("not a PNG (bad signature)");
  let off = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  const u32 = (at: number): number => ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
  while (off + 8 <= bytes.length) {
    const len = u32(off);
    const type = String.fromCharCode(bytes[off + 4]!, bytes[off + 5]!, bytes[off + 6]!, bytes[off + 7]!);
    const data = bytes.subarray(off + 8, off + 8 + len);
    const stored = u32(off + 8 + len);
    const actual = crc32(bytes.subarray(off + 4, off + 8 + len));
    if (stored !== actual) throw new Error(`PNG chunk ${type}: CRC mismatch`);
    if (type === "IHDR") {
      width = u32(off + 8);
      height = u32(off + 12);
      const bitDepth = data[8]!;
      const colorType = data[9]!;
      const interlace = data[12]!;
      if (bitDepth !== 8) throw new Error(`unsupported PNG: bit depth ${bitDepth} (only 8)`);
      if (colorType !== 2 && colorType !== 6) throw new Error(`unsupported PNG: color type ${colorType} (only RGB=2/RGBA=6)`);
      if (interlace !== 0) throw new Error("unsupported PNG: interlaced");
      channels = colorType === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (width === 0 || channels === 0) throw new Error("PNG missing IHDR");
  const raw = inflateSync(Buffer.concat(idat.map((d) => Buffer.from(d))));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const rowAt = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const x = raw[rowAt + i]!;
      const a = i >= channels ? cur[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`unsupported PNG row filter ${filter}`);
      }
      cur[i] = v & 0xff;
    }
    for (let px = 0; px < width; px++) {
      const s = px * channels;
      const d = (y * width + px) * 4;
      out[d] = cur[s]!;
      out[d + 1] = cur[s + 1]!;
      out[d + 2] = cur[s + 2]!;
      out[d + 3] = channels === 4 ? cur[s + 3]! : 255;
    }
    prev.set(cur);
  }
  return { width, height, rgba: out };
}

// ---- encode (for synthetic tests + emitting renders; filter selectable to exercise decode) ----

export function encodePng(img: RgbaImage, filter: 0 | 1 | 2 | 3 | 4 = 0): Uint8Array {
  const { width, height, rgba } = img;
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = filter;
    const row = rgba.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const x = row[i]!;
      const a = i >= 4 ? row[i - 4]! : 0;
      const b = prev[i]!;
      const c = i >= 4 ? prev[i - 4]! : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x - a; break;
        case 2: v = x - b; break;
        case 3: v = x - ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = x - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
      }
      raw[y * (stride + 1) + 1 + i] = v & 0xff;
    }
    prev.set(row);
  }
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, width);
  new DataView(ihdr.buffer).setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = deflateSync(Buffer.from(raw));
  return new Uint8Array(Buffer.concat([
    Buffer.from(SIGNATURE), Buffer.from(chunk("IHDR", ihdr)),
    Buffer.from(chunk("IDAT", new Uint8Array(idat))), Buffer.from(chunk("IEND", new Uint8Array(0))),
  ]));
}

// ---- quantize: box-downsample into <=64x32 (aspect-preserved), 3-bit RGB gamut ----------

export function quantize(img: RgbaImage, maxW = 64, maxH = 32, threshold = 128): number[][] {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const grid: number[][] = [];
  for (let gy = 0; gy < h; gy++) {
    const row: number[] = [];
    for (let gx = 0; gx < w; gx++) {
      const x0 = Math.floor((gx * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * img.width) / w));
      const y0 = Math.floor((gy * img.height) / h);
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * img.height) / h));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const at = (y * img.width + x) * 4;
          r += img.rgba[at]!;
          g += img.rgba[at + 1]!;
          b += img.rgba[at + 2]!;
          n += 1;
        }
      }
      // 3-bit RGB: plane bit set iff the box-average channel crosses threshold.
      row.push((r / n >= threshold ? 1 : 0) | (g / n >= threshold ? 2 : 0) | (b / n >= threshold ? 4 : 0));
    }
    grid.push(row);
  }
  return grid;
}

/** The whole front end: PNG bytes -> quantized grid -> self-verifying cart. */
export function fromImage(name: string, pngBytes: Uint8Array): { grid: number[][]; cart: CaptureCart } {
  const grid = quantize(decodePng(pngBytes));
  return { grid, cart: compile(name, grid) };
}
