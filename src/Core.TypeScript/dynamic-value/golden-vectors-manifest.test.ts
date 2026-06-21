import { test, expect } from "bun:test";
import manifest from "./golden-vectors-values.json";
import jsonSeed from "./golden-vectors.json";
import cborSeed from "./golden-vectors-cbor.json";
import { type Tagged as JsonTagged, fromCanonicalJson } from "./json";
import { type Tagged as CborTagged, fromCanonicalCbor, fromHex } from "./cbor";

// 081KT07NV0008QG0R0032MCYER (slice 1) — the unified value manifest (golden-vectors-values.json) is the single source
// for WHICH canonical DynamicValues exist; the per-format seeds are PROJECTIONS of it. This proves
// the existing CBOR + JSON seeds are faithful projections: (1) no seed value drifts from the manifest
// (every seed value is listed, with that format flagged) + each encoding decodes back to it; (2) each
// format's projection is complete (every manifest value flagged for a format appears in that seed);
// (3) the two formats AGREE on every value they both express. YAML + XML join the manifest as their
// codecs land. Nothing is single source of truth for ENCODINGS (each is cross-checked by decode
// round-trip + the RFC-8949 Appendix-A anchor); the manifest is the single source for VALUES.

type AnyTagged = JsonTagged | CborTagged;
interface ManifestEntry {
  value: AnyTagged;
  formats: string[];
}
interface JsonVec {
  name: string;
  value: JsonTagged;
  json: string;
}
interface CborVec {
  name: string;
  value: CborTagged;
  cbor: string;
}

const key = (v: AnyTagged): string => JSON.stringify(v);

const entries = (manifest as unknown as { values: ManifestEntry[] }).values;
const jsonVectors = (jsonSeed as unknown as { vectors: JsonVec[] }).vectors;
const cborVectors = (cborSeed as unknown as { vectors: CborVec[] }).vectors;
const manifestByValue = new Map(entries.map((e) => [key(e.value), e.formats]));

test("manifest is non-empty and every value lists at least one format", () => {
  expect(entries.length).toBeGreaterThan(0);
  for (const e of entries) expect(e.formats.length).toBeGreaterThan(0);
});

test("JSON seed is a faithful projection of the manifest", () => {
  for (const v of jsonVectors) {
    const fmts = manifestByValue.get(key(v.value));
    expect(fmts).toBeDefined();
    expect(fmts).toContain("json");
    const r = fromCanonicalJson(v.json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(key(r.value)).toBe(key(v.value)); // encoding decodes back to the manifest value
  }
});

test("CBOR seed is a faithful projection of the manifest", () => {
  for (const v of cborVectors) {
    const fmts = manifestByValue.get(key(v.value));
    expect(fmts).toBeDefined();
    expect(fmts).toContain("cbor");
    const r = fromCanonicalCbor(fromHex(v.cbor));
    expect(r.ok).toBe(true);
    if (r.ok) expect(key(r.value)).toBe(key(v.value));
  }
});

test("each format projection is complete (every flagged manifest value is in that seed)", () => {
  const jsonValues = new Set(jsonVectors.map((v) => key(v.value)));
  const cborValues = new Set(cborVectors.map((v) => key(v.value)));
  for (const e of entries) {
    if (e.formats.includes("json")) expect(jsonValues.has(key(e.value))).toBe(true);
    if (e.formats.includes("cbor")) expect(cborValues.has(key(e.value))).toBe(true);
  }
});

test("CBOR and JSON agree on every value both express (nothing is single source of truth)", () => {
  const jsonByValue = new Map(jsonVectors.map((v) => [key(v.value), v]));
  const cborByValue = new Map(cborVectors.map((v) => [key(v.value), v]));
  let shared = 0;
  for (const e of entries) {
    if (!(e.formats.includes("json") && e.formats.includes("cbor"))) continue;
    const jv = jsonByValue.get(key(e.value));
    const cv = cborByValue.get(key(e.value));
    expect(jv).toBeDefined();
    expect(cv).toBeDefined();
    if (!jv || !cv) continue;
    shared += 1;
    const fj = fromCanonicalJson(jv.json);
    const fc = fromCanonicalCbor(fromHex(cv.cbor));
    expect(fj.ok && fc.ok).toBe(true);
    if (fj.ok && fc.ok) expect(key(fj.value)).toBe(key(fc.value));
  }
  expect(shared).toBeGreaterThan(0); // there ARE values both formats express
});
