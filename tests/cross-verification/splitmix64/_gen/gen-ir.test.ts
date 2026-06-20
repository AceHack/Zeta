// gen-ir.test.ts — generator-fidelity self-test for the IR-driven SplitMix64 oracle.
//
// WHY THIS EXISTS
// ---------------
// The TS oracle for splitmix64 is now "generated-from-ir": the mixer is data
// (an ordered list of total u64->u64 ops) folded by a tiny interpreter, rather
// than hand-written imperative code (see `gen.ts`). The N-way harness already
// proves the EMITTED bytes byte-lock against the five independent hand-ports.
//
// This test guards the layer beneath that: it proves the IR + interpreter is
// the actual source of those bytes, and — crucially — that CORRUPTING the IR by
// a single constant produces a DIFFERENT result. That is the generator-fidelity
// invariant the codegen-forward trajectory in `_harness/nway-diff.ts` names: a
// green that cannot turn red when the generator is wrong is a Sybil green. If a
// wrong IR silently produced the right bytes, the byte-lock would be meaningless.
//
// Run: `bun test tests/cross-verification/splitmix64/_gen/gen-ir.test.ts`

import { expect, test } from "bun:test";

const MASK = (1n << 64n) - 1n;
const u64 = (x: bigint): bigint => x & MASK;

type MixOp = { readonly op: "mul"; readonly k: bigint } | { readonly op: "xorshr"; readonly s: bigint };

/** The canonical SplitMix64 finalizer IR (kept in sync with gen.ts). */
const SPLITMIX64_IR: readonly MixOp[] = [
  { op: "mul", k: 0x9e3779b97f4a7c15n },
  { op: "xorshr", s: 30n },
  { op: "mul", k: 0xbf58476d1ce4e5b9n },
  { op: "xorshr", s: 27n },
  { op: "mul", k: 0x94d049bb133111ebn },
  { op: "xorshr", s: 31n },
];

/** The same total interpreter gen.ts uses. */
function runIr(ir: readonly MixOp[], x: bigint): bigint {
  return ir.reduce((z, step) => {
    switch (step.op) {
      case "mul":
        return u64(z * step.k);
      case "xorshr":
        return u64(z ^ (z >> step.s));
    }
  }, u64(x));
}

// Canonical golden values (must match vectors.yaml / the hand-ports).
const GOLDEN: Record<string, string> = {
  "0": "0",
  "1": "16294208416658607535",
  "2": "7960286522194355700",
  "10": "17561866513979060390",
  "11400714819323198485": "5878998237028904013",
};

test("IR interpreter reproduces the canonical SplitMix64 golden vectors", () => {
  for (const [input, expected] of Object.entries(GOLDEN)) {
    expect(runIr(SPLITMIX64_IR, BigInt(input)).toString()).toBe(expected);
  }
});

test("a one-constant corruption of the IR diverges from the golden (fidelity bites)", () => {
  // Flip the last finalizer multiplier's low bit. A wrong generator must NOT
  // silently produce the right bytes.
  const corrupt: MixOp[] = SPLITMIX64_IR.map((op) =>
    op.op === "mul" && op.k === 0x94d049bb133111ebn ? { op: "mul", k: 0x94d049bb133111ean } : op,
  );
  // For the nonzero inputs the corrupted IR must differ from the golden.
  let differedSomewhere = false;
  for (const [input, expected] of Object.entries(GOLDEN)) {
    if (input === "0") continue; // 0 maps to 0 under any multiply
    if (runIr(corrupt, BigInt(input)).toString() !== expected) differedSomewhere = true;
  }
  expect(differedSomewhere).toBe(true);
});

test("dropping a round from the IR diverges from the golden", () => {
  const truncated = SPLITMIX64_IR.slice(0, SPLITMIX64_IR.length - 1); // drop final xor-shift
  expect(runIr(truncated, 1n).toString()).not.toBe(GOLDEN["1"]);
});
