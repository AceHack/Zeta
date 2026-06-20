import { test, expect } from "bun:test";
import seed from "./golden-vectors.json";
import { type Tagged, canonicalCbor, toHex, fromHex, fromCanonicalCbor } from "../dynamic-value/cbor";

// ═══════════════════════════════════════════════════════════════════
// Log noun — the TS oracle for the DeltaLogEntry byte-lock (workitem 081KTGD5JMD). Replays the shared
// seed (this directory's golden-vectors.json) that the F# reference oracle produced, and asserts TS
// reproduces byte-identical canonical CBOR + round-trips it. A whole entry { seq; delta; captured } maps
// to a DynamicValue object (obj keys captured/delta/seq, ordinal order; captured keys ordinal-sorted)
// riding the already-4-language-locked DynamicValue canonical CBOR — so the Log entry inherits the
// byte-lock with no new canonical encoding (an entry is just a DynamicValue). Mirrors F#
// DeltaLogEntryDynamic.toDynamicValue (src/Core/DeltaCodec.fs) + the C# oracle.
// ═══════════════════════════════════════════════════════════════════

type Entry = { seq: number; delta: [string, number][]; captured: Record<string, string> };

// Ordinal string order (UTF-16 code units == ordinal for the ASCII keys the seed uses; the seed
// deliberately avoids astral codepoints where UTF-16 vs UTF-8 order would diverge — culture-invariant).
const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function entryToTagged(entry: Entry): Tagged {
  const captured: [string, Tagged][] = Object.entries(entry.captured)
    .sort((x, y) => ordinal(x[0], y[0]))
    .map(([k, v]) => [k, { t: "str", v }] as [string, Tagged]);

  const delta: Tagged[] = entry.delta
    .slice()
    .sort((x, y) => ordinal(x[0], y[0]))
    .map(([k, w]) => ({ t: "arr", v: [{ t: "str", v: k }, { t: "int", v: String(w) }] }) as Tagged);

  return {
    t: "obj",
    v: [
      ["captured", { t: "obj", v: captured }],
      ["delta", { t: "arr", v: delta }],
      ["seq", { t: "int", v: String(entry.seq) }],
    ],
  };
}

const vectors = (seed as unknown as { vectors: { name: string; entry: Entry; cbor: string }[] }).vectors;

test("seed has the DeltaLogEntry vectors", () => {
  expect(vectors.length).toBeGreaterThanOrEqual(5);
});

for (const v of vectors) {
  test(`TS DeltaLogEntry byte-lock: ${v.name}`, () => {
    // encode → must equal the seed hex (the cross-language byte-lock)
    const enc1 = canonicalCbor(entryToTagged(v.entry));
    expect(enc1.ok).toBe(true);
    expect(toHex(enc1.ok ? enc1.value : [])).toBe(v.cbor);

    // decode(seed hex) → re-encode → must equal the seed hex (round-trip stability)
    const decoded = fromCanonicalCbor(fromHex(v.cbor));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      const enc2 = canonicalCbor(decoded.value);
      expect(enc2.ok).toBe(true);
      expect(toHex(enc2.ok ? enc2.value : [])).toBe(v.cbor);
    }
  });
}
