// IR-DRIVEN TS oracle for SplitMix64 — a "generated-from-ir" oracle whose IR is a
// real DynamicValue ROW, not an inline literal.
//
// THE TRAJECTORY (codegen-forward)
// --------------------------------
// `_harness/nway-diff.ts` documents the shift from "do the hand-ports agree?" to
// "does the generated code match the byte-lock?". This oracle does NOT contain the
// SplitMix64 algorithm as code. It READS the algorithm as DATA from a serialised
// DynamicValue document (`splitmix64.ir.json`), DECODES it with the project's real
// canonical-JSON decoder (`src/Core.TypeScript/dynamic-value/json.ts` —
// `fromCanonicalJson`), and a tiny total interpreter folds the decoded ops over
// each input. The emitted oracle tags itself `"_source": "generated-from-ir"`; the
// N-way harness byte-locks it against the five independent hand-ports + canonical.
//
// WHY A DynamicValue ROW (the schema, not a literal)
// --------------------------------------------------
// The IR is the payload of the registered generator `rng.splitmix64@1`
// (`src/Core/GeneratorRegistry.fs`; id `129c1fac…deb06`, byte-locked cross-language
// in `../generator-registry-id`). Storing the IR as a canonical DynamicValue makes
// it a genuine row in the universal value schema: language-neutral, byte-lockable,
// and decoded here through the SAME decoder the rest of Zeta uses — so a malformed
// or non-canonical IR is rejected as data, never silently mis-folded.
//
// INT64 DOMAIN NOTE (honest constraint)
// -------------------------------------
// DynamicValue.Int is int64, but SplitMix64's multiplier constants are u64. They
// are therefore stored as their two's-complement SIGNED-int64 bit-pattern (e.g.
// 0x9e3779b97f4a7c15 -> -7046029254386353131). Because the mix multiply is mod
// 2^64, reinterpreting the stored i64 back to u64 (`& MASK`) is bit-identical — the
// round-trip is exact. Shift amounts (<64) need no reinterpretation.
//
// Tier: PROVEN that the IR-as-DynamicValue-row + total interpreter byte-locks
// against the five independent hand-ports and the canonical vectors. The IR is now
// sourced FROM THE RELATION: `generatorIr.byZetaId(idOf("rng.splitmix64", 1))`
// returns the row whose payload is the canonical-JSON IR (the committed
// splitmix64.ir.json is that row's materialised view; the F#
// GeneratorIrRegistry.Tests pin the byte-for-byte equality, and prove register =
// +1 delta / retract = -1 delta / full == incremental on the real ZSet relation).
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fromCanonicalJson, type Tagged } from "../../../../src/Core.TypeScript/dynamic-value/json.ts";
import * as generatorIr from "../../_harness/generator-ir-registry.ts";

const MASK = (1n << 64n) - 1n;
const u64 = (x: bigint): bigint => x & MASK;
/** Reinterpret a stored signed-int64 back to the u64 it bit-encodes. */
const fromI64 = (i: bigint): bigint => u64(i);

/** A single total u64->u64 step in the finalizer IR. */
type MixOp =
  | { readonly op: "mul"; readonly k: bigint } // z := z * k        (wrapping)
  | { readonly op: "xorshr"; readonly s: bigint }; // z := z ^ (z >> s)

// --- obtain the IR ROW from the relation (by content-addressed ZetaId) and decode it ---

const zetaId = generatorIr.idOf("rng.splitmix64", 1);
const irRow = generatorIr.byZetaId(zetaId);
if (!irRow) {
  throw new Error(`no IR row on the relation for rng.splitmix64@1 (zetaId ${zetaId})`);
}
const decoded = fromCanonicalJson(irRow.irCanonicalJson);
if (!decoded.ok) {
  throw new Error(`rng.splitmix64@1 IR row is not a canonical DynamicValue: ${decoded.error}`);
}

// --- project the decoded DynamicValue (Tagged) down to the typed op list ---

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
      default:
        throw new Error(`IR: unknown op "${op}"`);
    }
  });
}

const SPLITMIX64_IR: readonly MixOp[] = parseOps(decoded.value);

/** The total interpreter: fold the IR (decoded from the row) over an input. */
function mix(x: bigint): bigint {
  return SPLITMIX64_IR.reduce((z, step) => {
    switch (step.op) {
      case "mul":
        return u64(z * step.k);
      case "xorshr":
        return u64(z ^ (z >> step.s));
    }
  }, u64(x));
}

const inputs: Record<string, bigint> = {
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
};

const out: Record<string, string> = { _source: "generated-from-ir" };
for (const [id, x] of Object.entries(inputs)) out[id] = mix(x).toString();

const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ts-output.json (generated-from-ir, IR sourced from the relation row zetaId=${zetaId})`);
