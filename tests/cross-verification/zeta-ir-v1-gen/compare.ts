// compare.ts — zeta-ir-v1-gen N-way oracle (Phase B of the gen-gen capstone).
//
// Asserts TWO properties, neither sufficient alone:
//   (1) N-way AGREEMENT — the TS v1 oracle (`_gen/gen.ts`, envelope built + folded via
//       the TS canonical-JSON path) and the F# v1 oracle (shipping
//       `ZetaIrV1.toCanonicalJson`, folded over the decoded ops) compute the SAME value
//       for every (primitive, input).
//   (2) VALUE PRESERVATION — both v1 oracles reproduce the COMMITTED LEGACY GOLDEN
//       (`../splitmix64/ts-output.json`, `../fmix32/ts-output.json`) value-for-value.
//       This is the Phase-B claim: freezing the IR to zeta-ir-v1 (explicit width, no
//       stored zetaId) did NOT change any oracle's output — the freeze is
//       behavior-preserving, the precondition a gen(gen)=gen fixed-point needs.
//
// Comparison is over PARSED maps, not raw bytes: the F# emitter sorts object keys and
// the TS emitter preserves insertion order, so the JSON texts differ while the vectors
// are identical. The `_source` tag is intentionally excluded — the v1 oracles tag
// themselves `generated-from-zeta-ir-v1` vs the legacy golden's `generated-from-ir`;
// that provenance label is meant to differ, only the computed values must match.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dir;
const CV = join(DIR, ".."); // tests/cross-verification

type Vec = Record<string, string>;
type Nested = Record<string, Vec>;

function load(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Strip the provenance tag; return the (input -> value) map only. */
function values(vec: Vec): Vec {
  const { _source, ...rest } = vec;
  void _source;
  return rest;
}

function assertSameVec(a: Vec, b: Vec, ctx: string): void {
  const av = values(a);
  const bv = values(b);
  const keys = new Set([...Object.keys(av), ...Object.keys(bv)]);
  for (const k of keys) {
    if (av[k] !== bv[k]) {
      throw new Error(`${ctx}: mismatch at "${k}": ${JSON.stringify(av[k])} vs ${JSON.stringify(bv[k])}`);
    }
  }
}

const ts = load(join(DIR, "ts-output.json")) as Nested;
const fs = load(join(DIR, "fsharp-output.json")) as Nested;

const primitives = Object.keys(ts);
if (primitives.length === 0) throw new Error("ts-output.json has no primitives");

// (1) N-way agreement between the two v1 oracles.
for (const p of primitives) {
  const tsVec = ts[p];
  const fsVec = fs[p];
  if (!tsVec) throw new Error(`ts-output.json missing primitive "${p}"`);
  if (!fsVec) throw new Error(`fsharp-output.json missing primitive "${p}"`);
  assertSameVec(tsVec, fsVec, `v1 oracles disagree for ${p}`);
}

// (2) value preservation against the committed legacy golden for each primitive.
const legacyGolden: Record<string, string> = {
  splitmix64: join(CV, "splitmix64", "ts-output.json"),
  fmix32: join(CV, "fmix32", "ts-output.json"),
};

let vectorCount = 0;
for (const p of primitives) {
  const tsVec = ts[p];
  if (!tsVec) throw new Error(`ts-output.json missing primitive "${p}"`);
  const goldenPath = legacyGolden[p];
  if (!goldenPath) throw new Error(`no legacy golden mapping for primitive "${p}"`);
  const golden = load(goldenPath) as Vec;
  // the legacy golden's _source is "generated-from-ir"; the v1 oracle's is
  // "generated-from-zeta-ir-v1" — values() drops both, so we compare values only.
  assertSameVec(tsVec, golden, `v1 fold does not preserve legacy golden for ${p}`);
  vectorCount += Object.keys(values(tsVec)).length;
}

console.log("zeta-ir-v1-gen (Phase B) cross-verification:");
console.log(`  v1 oracles: TS + F# agree on ${primitives.length} primitive(s)`);
console.log(`  value preservation: ${vectorCount} vectors match the committed legacy golden byte-for-byte`);
console.log(`OK: freezing the IR to zeta-ir-v1 is behavior-preserving across ${primitives.join(", ")}.`);
