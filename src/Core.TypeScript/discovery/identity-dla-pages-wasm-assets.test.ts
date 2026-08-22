import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PAGES_WASM_ASSETS } from "./identity-dla-pages-wasm-assets";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("GitHub Pages WebAssembly asset contract", () => {
  test("every staged source has module bytes and the declared ABI", () => {
    for (const asset of PAGES_WASM_ASSETS) {
      const source = join(repoRoot, asset.source);
      expect(existsSync(source), `${asset.name} source exists`).toBe(true);
      const bytes = readFileSync(source);
      expect(Array.from(bytes.subarray(0, 4)), `${asset.name} magic`).toEqual([0x00, 0x61, 0x73, 0x6d]);
      const exports = new Set(WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map((entry) => entry.name));
      for (const requiredExport of asset.requiredExports) expect(exports.has(requiredExport), `${asset.name} export ${requiredExport}`).toBe(true);
    }
  });

  test("negative control: HTML cannot satisfy the module-byte contract", () => {
    const html = Buffer.from("<!doctype html><title>not wasm</title>", "utf8");
    expect(Array.from(html.subarray(0, 4))).not.toEqual([0x00, 0x61, 0x73, 0x6d]);
  });
});
