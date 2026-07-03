// tick-codec.golden-vectors.test.ts — Gate T2 byte-lock cross-verify (TypeScript oracle).
import { describe, expect, test } from "bun:test";
import { encodeVersionstamp, decodeVersionstamp, toHex } from "./tick-codec";
import vectors from "./tick-codec-golden-vectors.json";

describe("Versionstamp codec — Gate T2 golden vectors", () => {
  for (const v of vectors.vectors) {
    test(`encode ${v.name} (${v.version}) → ${v.hex}`, () => {
      const encoded = encodeVersionstamp(BigInt(v.version));
      expect(toHex(encoded)).toBe(v.hex);
    });

    test(`decode ${v.hex} → ${v.name} (${v.version})`, () => {
      const buf = Uint8Array.from(
        v.hex.match(/.{2}/g)!.map(h => parseInt(h, 16))
      );
      const decoded = decodeVersionstamp(buf);
      expect(decoded).toBe(BigInt(v.version));
    });

    test(`round-trip ${v.name}`, () => {
      const encoded = encodeVersionstamp(BigInt(v.version));
      const decoded = decodeVersionstamp(encoded);
      expect(decoded).toBe(BigInt(v.version));
    });
  }
});
