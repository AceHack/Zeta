#!/usr/bin/env bun
// run-image-demo.ts — synthetic "paper sheet" PNG -> quantized grid -> self-verifying chip9 cart.
// Usage: bun run-image-demo.ts [path/to/photo.png]  (defaults to the built-in synthetic sheet)
import { readFileSync } from "node:fs";
import { encodePng, fromImage, type RgbaImage } from "./from-image";
import { verify } from "./capture";

function syntheticSheet(width: number, height: number): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      let [r, g, b] = [250, 250, 250];
      if (y < height / 8) [r, g, b] = [220, 30, 30];
      else if (x < width / 16) [r, g, b] = [30, 30, 220];
      else if (x > width / 2 && x < width / 2 + width / 8 && y > height / 2 && y < height / 2 + height / 8)
        [r, g, b] = [20, 200, 20];
      rgba[at] = r; rgba[at + 1] = g; rgba[at + 2] = b; rgba[at + 3] = 255;
    }
  }
  return { width, height, rgba };
}

const path = process.argv[2];
const png = path ? new Uint8Array(readFileSync(path)) : encodePng(syntheticSheet(512, 256), 4);
const { grid, cart } = fromImage(path ?? "synthetic-sheet", png);
console.log(`\n${cart.name}: ${png.length}-byte PNG -> ${cart.width}x${cart.height} grid -> ${cart.romHex.length / 2}-byte cart (${cart.steps} instructions)`);
console.log(`verify (re-execute + byte-compare): ${verify(cart) ? "PASS" : "FAIL"}\n`);
for (const row of grid) console.log("  " + row.map((px) => (px === 0 ? "." : px.toString(16))).join(""));
console.log("\nLossy by design: 8 colors at <=64x32 — the cart-fidelity view, not an archival copy.\n");
