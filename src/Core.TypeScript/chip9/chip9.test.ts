/**
 * CHIP-9 cross-verify — the TS oracle replays the treaty ROM the F# oracle locked
 * (./golden-vectors.lines) and must reproduce the 32×64 hex color grid + plane register exactly.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { colorAt, create, H, loadRom, step, W } from "./chip9";

const lines = readFileSync(join(import.meta.dir, "golden-vectors.lines"), "utf-8")
  .split("\n")
  .filter((l) => !l.startsWith("#") && l.length > 0);

describe("CHIP-9 — the color-plane treaty (TS oracle)", () => {
  it("BYTE-LOCK: replaying the treaty ROM reproduces the golden color grid exactly", () => {
    const romHex = lines[0].split("\t")[1];
    const rom = new Uint8Array(romHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    const goldenPlane = parseInt(lines[1].split("\t")[1], 10);
    const goldenRows = lines.slice(2);
    expect(goldenRows.length).toBe(H);

    let f = create();
    f = loadRom(rom, f);
    f.mem.set(0x300, 0xff); // the treaty sprite (mirrors the F# test setup)
    for (let s = 0; s < 12; s++) f = step(f);

    expect(f.plane).toBe(goldenPlane);
    for (let y = 0; y < H; y++) {
      let row = "";
      for (let x = 0; x < W; x++) row += colorAt(x, y, f).toString(16);
      expect(row).toBe(goldenRows[y]);
    }
  });
});
