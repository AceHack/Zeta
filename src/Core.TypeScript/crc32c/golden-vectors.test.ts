import { describe, expect, test } from "bun:test";
import { crc32c } from "./crc32c";
import vectors from "./golden-vectors.json";

// Replays the shared golden seed through the TS oracle; the C#/F#/Rust oracles replay the same file.

describe("CRC32C golden vectors", () => {
  test("crc32c agrees with the seed", () => {
    for (const v of vectors.crc32c) {
      expect(crc32c(v.payload)).toBe(v.result);
    }
  });
});
