// zeta-ir-v1-gen — Phase B of the gen-gen capstone (TS oracle).
//
// THE PHASE-B PROPERTY (value preservation under the freeze)
// ----------------------------------------------------------
// `zeta-ir-v1` (src/Core/ZetaIrV1.fs, PR #8725) froze the generator-IR envelope:
//   { schema:"zeta-ir-v1", generator, version, width, ops:[{op:"mul",k}|{op:"xorshr",s}] }
// resolving the legacy shape split (splitmix64 had no width; fmix32 had no zetaId).
// This oracle proves the freeze is **behavior-preserving**: building the v1 envelope
// for a generator, serialising it through the REAL canonical-JSON path, decoding it
// back through the REAL `fromCanonicalJson`, and folding it with a width-parametric
// total interpreter yields output vectors that are **byte-identical** to the committed
// legacy golden the five independent hand-ports + canonical already agree on
// (`../splitmix64/ts-output.json`, `../fmix32/ts-output.json`). compare.ts pins both
// (i) this TS oracle == the F# v1 oracle, and (ii) both == the committed legacy golden.
//
// WHY THIS IS THE RIGHT RUNG. `gen(gen)=gen` needs a STABLE IR (Phase A, done) AND the
// guarantee that emitting from that stable IR reproduces what humans already byte-locked
// (Phase B). For splitmix64 this is sharp: the legacy row had NO width, so its generator
// hardcoded the u64 mask; the v1 row supplies `width:64` AS DATA, and folding that data
// must still reproduce the identical golden — the width is now load-bearing IR, not code.
//
// INDEPENDENCE. This oracle builds the v1 envelope from the op-list itself and runs it
// through the project's real canonical-JSON encode+decode; the F# peer uses the SHIPPING
// `ZetaIrV1.toCanonicalJson`. Neither shares a fold module with the other (N-way
// independence). The interpreter here is intentionally a fresh, total fold.
//
// Tier: PROVEN that the frozen v1 envelope, encoded+decoded through the real
// canonical-JSON machinery and folded, reproduces the committed cross-language golden
// vectors byte-for-byte on the bun runtime (and, via the F# peer + compare.ts, on .NET).
// NOT claimed: the Face-3 gen(gen)=gen theorem itself — this is the value-preservation
// leg that the theorem builds on, not the theorem.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { canonicalJson, fromCanonicalJson, type Tagged } from "../../../../src/Core.TypeScript/dynamic-value/json.ts";

const SCHEMA_TAG = "zeta-ir-v1";

/** A single total u-word -> u-word step in the finaliser IR. */
type MixOp = { readonly op: "mul"; readonly k: bigint } | { readonly op: "xorshr"; readonly s: bigint };

/** A generator expressed as its v1 fields (the source the envelope is built from). */
interface GenSpec {
  readonly generator: string;
  readonly version: number;
  readonly width: number;
  readonly ops: readonly MixOp[];
  /** The committed legacy golden this v1 fold must reproduce byte-for-byte. */
  readonly goldenPrimitive: string;
  readonly inputs: Record<string, bigint>;
}

// ── the two known generators, as v1 specs (ops identical to the shipped finalisers) ──

const SPLITMIX64: GenSpec = {
  generator: "rng.splitmix64",
  version: 1,
  width: 64,
  ops: [
    { op: "mul", k: -7046029254386353131n }, // 0x9E3779B97F4A7C15
    { op: "xorshr", s: 30n },
    { op: "mul", k: -4658895280553007687n }, // 0xBF58476D1CE4E5B9
    { op: "xorshr", s: 27n },
    { op: "mul", k: -7723592293110705685n }, // 0x94D049BB133111EB
    { op: "xorshr", s: 31n },
  ],
  goldenPrimitive: "splitmix64",
  inputs: {
    "x-0": 0n,
    "x-1": 1n,
    "x-2": 2n,
    "x-10": 10n,
    "x-255": 255n,
    "x-u64max": 18446744073709551615n,
    "x-golden": 11400714819323198485n,
    "x-2pow63": 9223372036854775808n,
    "x-12345678901234567890": 12345678901234567890n,
    "x-1e18": 1000000000000000000n,
  },
};

const FMIX32: GenSpec = {
  generator: "hash.fmix32",
  version: 1,
  width: 32,
  ops: [
    { op: "xorshr", s: 16n },
    { op: "mul", k: 2246822507n }, // 0x85ebca6b
    { op: "xorshr", s: 13n },
    { op: "mul", k: 3266489909n }, // 0xc2b2ae35
    { op: "xorshr", s: 16n },
  ],
  goldenPrimitive: "fmix32",
  inputs: {
    "x-0": 0n,
    "x-1": 1n,
    "x-2": 2n,
    "x-10": 10n,
    "x-255": 255n,
    "x-u32max": 4294967295n,
    "x-0x9e3779b9": 2654435769n,
    "x-2pow31": 2147483648n,
    "x-3735928559": 3735928559n,
    "x-1e9": 1000000000n,
  },
};

// ── build the FROZEN v1 envelope as a Tagged DynamicValue (frozen key order) ──

function opToTagged(op: MixOp): Tagged {
  return op.op === "mul"
    ? { t: "obj", v: [["op", { t: "str", v: "mul" }], ["k", { t: "int", v: op.k.toString() }]] }
    : { t: "obj", v: [["op", { t: "str", v: "xorshr" }], ["s", { t: "int", v: op.s.toString() }]] };
}

function v1Envelope(spec: GenSpec): Tagged {
  return {
    t: "obj",
    v: [
      ["schema", { t: "str", v: SCHEMA_TAG }],
      ["generator", { t: "str", v: spec.generator }],
      ["version", { t: "int", v: spec.version.toString() }],
      ["width", { t: "int", v: spec.width.toString() }],
      ["ops", { t: "arr", v: spec.ops.map(opToTagged) }],
    ],
  };
}

// ── decode the v1 envelope back to a typed op-list, enforcing the v1 contract ──

function field(obj: Tagged, key: string): Tagged {
  if (obj.t !== "obj") throw new Error("v1 IR: expected object");
  const hit = obj.v.find(([k]) => k === key);
  if (!hit) throw new Error(`v1 IR: missing field "${key}"`);
  return hit[1];
}
function asInt(v: Tagged): bigint {
  if (v.t !== "int") throw new Error("v1 IR: expected int");
  return BigInt(v.v);
}
function asStr(v: Tagged): string {
  if (v.t !== "str") throw new Error("v1 IR: expected string");
  return v.v;
}

interface DecodedV1 {
  readonly width: number;
  readonly ops: readonly MixOp[];
}

/** Decode a v1 envelope, REJECTING any shape deviation (mirrors ZetaIrV1.validate). */
function decodeV1(ir: Tagged): DecodedV1 {
  if (ir.t === "obj" && ir.v.some(([k]) => k === "zetaId")) {
    throw new Error("v1 IR must NOT carry a stored zetaId (identity is the derived content-address)");
  }
  if (asStr(field(ir, "schema")) !== SCHEMA_TAG) throw new Error("v1 IR: wrong schema tag");
  const width = Number(asInt(field(ir, "width"))); // width is REQUIRED in v1
  const opsNode = field(ir, "ops");
  if (opsNode.t !== "arr") throw new Error("v1 IR: ops must be an array");
  const ops = opsNode.v.map((node): MixOp => {
    const op = asStr(field(node, "op"));
    switch (op) {
      case "mul":
        return { op: "mul", k: asInt(field(node, "k")) };
      case "xorshr":
        return { op: "xorshr", s: asInt(field(node, "s")) };
      default:
        throw new Error(`v1 IR: op "${op}" is not in the frozen grammar (mul | xorshr)`);
    }
  });
  return { width, ops };
}

// ── the total interpreter: fold the decoded v1 IR at its declared width ──

function fold(decoded: DecodedV1, x: bigint): bigint {
  const mask = (1n << BigInt(decoded.width)) - 1n;
  const uword = (z: bigint): bigint => z & mask;
  return decoded.ops.reduce((z, step) => {
    switch (step.op) {
      case "mul":
        return uword(z * step.k);
      case "xorshr":
        return uword(z ^ (z >> step.s));
    }
  }, uword(x));
}

/** Emit one generator's vectors by going FROM the v1 envelope THROUGH canonical JSON. */
export function emit(spec: GenSpec): Record<string, string> {
  // build envelope -> real canonical-JSON encode -> real decode (round-trip through the
  // exact machinery the freeze byte-locks) -> v1-contract decode -> fold.
  const cj = canonicalJson(v1Envelope(spec));
  const reparsed = fromCanonicalJson(cj);
  if (!reparsed.ok) throw new Error(`v1 envelope for ${spec.generator} is not canonical: ${reparsed.error}`);
  const decoded = decodeV1(reparsed.value);
  const out: Record<string, string> = { _source: "generated-from-zeta-ir-v1" };
  for (const [id, x] of Object.entries(spec.inputs)) out[id] = fold(decoded, x).toString();
  return out;
}

if (import.meta.main) {
  const result: Record<string, Record<string, string>> = {};
  for (const spec of [SPLITMIX64, FMIX32]) result[spec.goldenPrimitive] = emit(spec);
  const target = join(dirname(import.meta.dir), "ts-output.json");
  writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
  console.log("wrote ts-output.json (generated-from-zeta-ir-v1)");
}

export { SPLITMIX64, FMIX32, type GenSpec };
