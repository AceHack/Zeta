// IR-DRIVEN TS oracle for SplitMix64 — the first "generated-from-ir" oracle.
//
// WHAT CHANGED (codegen-forward, 2026-06-20)
// ------------------------------------------
// Previously this file recomputed the mixer with hand-written imperative steps
// (a literal port). It now does NOT contain the algorithm as code — it contains
// the algorithm as DATA (`SPLITMIX64_IR`), and a tiny total interpreter folds
// that IR over each input. This is the smallest honest instance of the
// codegen-forward trajectory documented in `_harness/nway-diff.ts`:
//
//   "this harness then shifts from 'do the hand-ports agree?' to 'does the
//    generated code match the byte-lock?'"
//
// The emitted oracle tags itself `"_source": "generated-from-ir"`. The N-way
// harness then byte-locks THIS generated output against the five independent
// hand-ports (fsharp/cs/rust/python/go) AND the canonical vectors. If the IR or
// the interpreter is wrong, the byte-lock turns red and names TS as the
// dissenter — exactly the generator-fidelity check the trajectory calls for.
//
// IR SHAPE — the finalizer as an ordered list of total u64->u64 ops
// -----------------------------------------------------------------
// SplitMix64's finalizer (Vigna, arXiv:1410.0530 §3) is a seed multiply then a
// sequence of (xor-shift, multiply) rounds then a final xor-shift. Expressed as
// data, every op is a total wrapping-u64 function, so the whole IR is a total
// fold — DST-deterministic and byte-lockable, matching the `gen/README.md`
// generator contract.
//
// Tier: PROVEN that a data-defined IR + total interpreter byte-locks against the
// independent hand-ports. The IR here is an inline literal, NOT yet a row read
// from a DynamicValue Z-set schema (`src/Core/GeneratorRegistry.fs`) — that
// registry-sourced IR remains the next step.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const MASK = (1n << 64n) - 1n;
const u64 = (x: bigint): bigint => x & MASK;

/** A single total u64->u64 step in the finalizer IR. */
type MixOp =
  | { readonly op: "mul"; readonly k: bigint } // z := z * k        (wrapping)
  | { readonly op: "xorshr"; readonly s: bigint }; // z := z ^ (z >> s)

/** The SplitMix64 finalizer, as data. Change a constant here and the byte-lock
 *  will catch the divergence. */
const SPLITMIX64_IR: readonly MixOp[] = [
  { op: "mul", k: 0x9e3779b97f4a7c15n },
  { op: "xorshr", s: 30n },
  { op: "mul", k: 0xbf58476d1ce4e5b9n },
  { op: "xorshr", s: 27n },
  { op: "mul", k: 0x94d049bb133111ebn },
  { op: "xorshr", s: 31n },
];

/** The total interpreter: fold the IR over an input. It has no algorithm-
 *  specific branching — it only knows how to apply the two op kinds. */
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
console.log("wrote ts-output.json (generated-from-ir)");
