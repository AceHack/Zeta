// gen.ts — the GENERATED-FROM-IR TypeScript oracle for the `lcg32_numerical_recipes` generator.
//
// Like the other generated-from-ir oracles, this reads its IR from the RELATION
// (`generatorIr.byZetaId(idOf("rng.lcg32_numerical_recipes", 1))`) and decodes it through the project's real
// `fromCanonicalJson`. A malformed/non-canonical IR is rejected as data.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson, type Tagged } from "../../../../src/Core.TypeScript/dynamic-value/json.ts";
import * as generatorIr from "../../_harness/generator-ir-registry.ts";

const MASK = (1n << 32n) - 1n;
const u32 = (x: bigint): bigint => x & MASK;
/** Reinterpret a stored signed-int64 back to the u32 it bit-encodes. */
const fromI64 = (i: bigint): bigint => u32(i);

/** A single total u32->u32 step in the mixer IR (v4 grammar: mul | xorshr | rotl | xrotxor | xshrxor | add). */
type MixOp =
  | { readonly op: "mul"; readonly k: bigint }
  | { readonly op: "xorshr"; readonly s: bigint }
  | { readonly op: "rotl"; readonly r: bigint }
  | { readonly op: "xrotxor"; readonly rs: readonly bigint[] }
  | { readonly op: "xshrxor"; readonly ss: readonly bigint[] }
  | { readonly op: "add"; readonly k: bigint };

// --- obtain the IR ROW from the relation (by content-addressed ZetaId) and decode it ---
const zetaId = generatorIr.idOf("rng.lcg32_numerical_recipes", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow) {
  throw new Error(`no IR row on the relation for rng.lcg32_numerical_recipes@1 (zetaId ${zetaId})`);
}
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok) {
  throw new Error(`rng.lcg32_numerical_recipes@1 IR row is not a canonical DynamicValue: ${decoded.error}`);
}

// --- project the decoded DynamicValue (Tagged) down to (width, op list) ---
function field(obj: Tagged, key: string): Tagged {
  if (obj.t !== "obj") throw new Error("IR: expected object");
  const hit = obj.v.find(([k]) => k === key);
  if (!hit) throw new Error(`IR: missing field "${key}"`);
  return hit[1];
}
function asInt(v: Tagged): bigint {
  if (v.t !== "int") throw new Error("IR: expected int");
  return BigInt(v.v);
}
function asStr(v: Tagged): string {
  if (v.t !== "str") throw new Error("IR: expected string");
  return v.v;
}
function asIntList(v: Tagged): bigint[] {
  if (v.t !== "arr") throw new Error("IR: expected array");
  return v.v.map(asInt);
}

// the v4 envelope carries the thrice-bumped schema tag — assert it.
const schema = asStr(field(decoded.value, "schema"));
if (schema !== "zeta-ir-v4") throw new Error(`IR: lcg32_numerical_recipes expects schema zeta-ir-v4, got ${schema}`);
const width = asInt(field(decoded.value, "width"));
if (width !== 32n) throw new Error(`IR: lcg32_numerical_recipes expects width 32, got ${width}`);

function parseOps(ir: Tagged): readonly MixOp[] {
  const opsNode = field(ir, "ops");
  if (opsNode.t !== "arr") throw new Error("IR: ops must be an array");
  return opsNode.v.map((node): MixOp => {
    const op = asStr(field(node, "op"));
    switch (op) {
      case "mul":
        return { op: "mul", k: fromI64(asInt(field(node, "k"))) };
      case "xorshr":
        return { op: "xorshr", s: asInt(field(node, "s")) };
      case "rotl":
        return { op: "rotl", r: asInt(field(node, "r")) };
      case "xrotxor":
        return { op: "xrotxor", rs: asIntList(field(node, "rs")) };
      case "xshrxor":
        return { op: "xshrxor", ss: asIntList(field(node, "ss")) };
      case "add":
        return { op: "add", k: fromI64(asInt(field(node, "k"))) };
      default:
        throw new Error(`IR: unknown op "${op}" (v4 grammar is mul | xorshr | rotl | xrotxor | xshrxor | add)`);
    }
  });
}
const LCG_IR: readonly MixOp[] = parseOps(decoded.value);

const rotl = (x: bigint, r: bigint, w: bigint): bigint => {
  const k = ((r % w) + w) % w;
  return k === 0n ? u32(x) : u32(((x << k) | (x >> (w - k))) & MASK);
};

function mix(x: bigint): bigint {
  return LCG_IR.reduce((z, step) => {
    switch (step.op) {
      case "mul":
        return u32(z * step.k);
      case "xorshr":
        return u32(z ^ (z >> step.s));
      case "rotl":
        return rotl(z, step.r, width);
      case "xrotxor":
        return u32(step.rs.reduce((acc, r) => acc ^ rotl(z, r, width), z));
      case "xshrxor":
        return u32(step.ss.reduce((acc, s) => acc ^ (z >> s), z));
      case "add":
        return u32(z + step.k);
    }
  }, u32(x));
}

const inputs: Record<string, bigint> = {
  "x-0": 0n,
  "x-1": 1n,
  "x-2": 2n,
  "x-10": 10n,
  "x-255": 255n,
  "x-u32max": 4294967295n,
  "x-golden": 2654435769n,
  "x-2pow31": 2147483648n,
  "x-1234567890": 1234567890n,
  "x-1e9": 1000000000n,
};

const out: Record<string, string> = { _source: "generated-from-ir" };
for (const [id, x] of Object.entries(inputs)) out[id] = mix(x).toString();

const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `wrote ts-output.json (generated-from-ir, IR sourced from the relation row zetaId=${zetaId}, schema=zeta-ir-v4, width 32)`,
);
