import { describe, expect, test } from "bun:test";
import { crc32c, crc32cBitwise } from "./crc32c";
import vectors from "./golden-vectors.json";

// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.

describe("CRC32C golden vectors", () => {
  test("crc32c agrees with the seed", () => {
    for (const v of vectors.crc32c) {
      expect(crc32c(v.payload)).toBe(v.result);
    }
  });

  // Added 2026-08-14 with the table-driven form (081KZYP1X3B087G0R001EZ37PQ). The seed above pins
  // the shipped function against the other three oracles; this pins it against its own DEFINITION,
  // which is the check the seed cannot make. A wrong entry in a 256-constant table is a silently
  // wrong checksum on a narrow slice of inputs, and the golden vectors are far too few to land on
  // it — so the table is checked by construction against the polynomial, over every byte value and
  // over lengths the seed does not cover.
  test("the table-driven form is byte-for-byte the bitwise definition", () => {
    for (const v of vectors.crc32c) {
      expect(crc32c(v.payload)).toBe(crc32cBitwise(v.payload));
    }

    // Every single-byte input — this is what touches all 256 table entries directly.
    for (let b = 0; b < 256; b++) {
      expect(crc32c([b])).toBe(crc32cBitwise([b]));
    }

    // Deterministic pseudo-random inputs across a range of lengths. No `Math.random()`: a
    // reproducibility failure here has to be reproducible (Sec.7 DST).
    let x = 0x12345678;
    const next = (): number => {
      x = (x * 1103515245 + 12345) >>> 0;
      return (x >>> 16) & 0xff;
    };
    for (const len of [0, 1, 2, 3, 4, 7, 8, 15, 16, 24, 28, 63, 64, 255, 256, 1024]) {
      const payload = new Uint8Array(len);
      for (let i = 0; i < len; i++) payload[i] = next();
      expect(crc32c(payload)).toBe(crc32cBitwise(payload));
    }

    // ANTI-VACUITY: the two must be able to DISAGREE. If `crc32cBitwise` were accidentally an
    // alias of `crc32c`, every assertion above would hold for a table of pure garbage.
    expect(crc32c([1])).not.toBe(crc32c([2]));
    expect(crc32cBitwise([1])).not.toBe(crc32cBitwise([2]));
    expect(crc32c([])).toBe(0);
  });
});
