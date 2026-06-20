// IR-DRIVEN TS oracle for MurmurHash3 fmix32 — the SECOND "generated-from-ir"
// oracle, proving the DynamicValue IR vocabulary generalises.
//
// WHY THIS EXISTS
// ---------------
// splitmix64 was the first oracle whose mixer is DATA (a DynamicValue row) folded
// by a tiny total interpreter rather than hand-written code. This file does the
// same for a DIFFERENT primitive at a DIFFERENT integer width (u32), using the
// SAME op vocabulary (`mul`, `xorshr`) plus a single `width` field on the row. The
// only thing that changes between the two generators is the row — proving the IR
// is not splitmix64-specific. The emitted oracle tags `"_source": "generated-from-
// ir"`; the N-way harness byte-locks it against the five independent hand-ports +
// canonical.
//
// THE IR IS A ROW IN THE SCHEMA
// -----------------------------
// The finaliser IR is read from `fmix32.ir.json` (a canonical-JSON DynamicValue)
// and decoded through the project's real decoder
// (`src/Core.TypeScript/dynamic-value/json.ts` — `fromCanonicalJson`). The
// algorithm appears NOWHERE as code here; it lives in the row. A malformed or
// non-canonical IR is rejected as data, never silently mis-folded.
//
// WIDTH NOTE
// ----------
// fmix32 is u32, so the row carries `width: 32` and the interpreter masks to
// 2^width - 1 after every step. fmix32's multiplier constants are < 2^31, so they
// fit DynamicValue.Int (int64) directly with NO signed reinterpretation (unlike
// splitmix64's u64 constants). The same interpreter handles width 64 by setting
// `width: 64` and reinterpreting any stored-negative `k` back to u-word.
//
// Tier: PROVEN that the IR-as-DynamicValue-row + width-parametric total interpreter
// byte-locks a SECOND primitive against the five independent hand-ports and
// canonical. REMAINING (shared with splitmix64): carry the row as a live tuple on
// the registry's DBSP Z-set relation rather than a checked-in document.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson, type Tagged } from "../../../../src/Core.TypeScript/dynamic-value/json.ts";

/** A single total u-word -> u-word step in a finaliser IR. */
type MixOp =
  | { readonly op: "mul"; readonly k: bigint } // z := z * k        (wrapping)
  | { readonly op: "xorshr"; readonly s: bigint }; // z := z ^ (z >> s)

// --- read the IR ROW and decode it through the real DynamicValue canonical-JSON decoder ---

const irPath = join(import.meta.dir, "fmix32.ir.json");
const irText = readFileSync(irPath, "utf8").trim();
const decoded = fromCanonicalJson(irText);
if (!decoded.ok) {
  throw new Error(`fmix32.ir.json is not a canonical DynamicValue: ${decoded.error}`);
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

const width = asInt(field(decoded.value, "width"));
if (width !== 32n && width !== 64n) throw new Error(`IR: unsupported width ${width}`);
const MASK = (1n << width) - 1n;
const uword = (x: bigint): bigint => x & MASK;
/** Reinterpret a stored (possibly signed-int64) constant back to the u-word it encodes. */
const fromStored = (i: bigint): bigint => uword(i);

function parseOps(ir: Tagged): readonly MixOp[] {
  const opsNode = field(ir, "ops");
  if (opsNode.t !== "arr") throw new Error("IR: ops must be an array");
  return opsNode.v.map((node): MixOp => {
    const op = asStr(field(node, "op"));
    switch (op) {
      case "mul":
        return { op: "mul", k: fromStored(asInt(field(node, "k"))) };
      case "xorshr":
        return { op: "xorshr", s: asInt(field(node, "s")) };
      default:
        throw new Error(`IR: unknown op "${op}"`);
    }
  });
}

const FMIX32_IR: readonly MixOp[] = parseOps(decoded.value);

/** The total interpreter: fold the IR (decoded from the row) over an input, at the
 *  IR's declared width. Identical to the splitmix64 interpreter except the mask is
 *  width-parametric. */
function mix(x: bigint): bigint {
  return FMIX32_IR.reduce((z, step) => {
    switch (step.op) {
      case "mul":
        return uword(z * step.k);
      case "xorshr":
        return uword(z ^ (z >> step.s));
    }
  }, uword(x));
}

const inputs: Record<string, bigint> = {
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
};

const out: Record<string, string> = { _source: "generated-from-ir" };
for (const [id, x] of Object.entries(inputs)) out[id] = mix(x).toString();

const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log("wrote ts-output.json (generated-from-ir, IR read from fmix32.ir.json DynamicValue row, width 32)");
