// gen-ir.test.ts — generator-fidelity self-test for the IR-driven SplitMix64 oracle.
//
// WHY THIS EXISTS
// ---------------
// The TS oracle for splitmix64 is "generated-from-ir": the mixer is DATA — an
// ordered list of total u64->u64 ops carried in a real DynamicValue row
// (`splitmix64.ir.json`), decoded through the project's canonical-JSON decoder and
// folded by a tiny interpreter (see `gen.ts`). The N-way harness already proves the
// EMITTED bytes byte-lock against the five independent hand-ports.
//
// This test guards the layer beneath that. It proves three things:
//   1. the IR ROW is a CANONICAL DynamicValue (the real `fromCanonicalJson`
//      accepts it AND the fixed-point `canonicalJson(decode(x)) === x` holds) —
//      so the row is genuinely a schema value, not loose JSON;
//   2. the IR decoded FROM THE ROW reproduces the canonical golden vectors;
//   3. CORRUPTING the IR (one constant, or a dropped round) DIVERGES — the
//      generator-fidelity invariant the codegen-forward trajectory names: a green
//      that cannot turn red when the generator is wrong is a Sybil green.
//
// Run: `bun test tests/cross-verification/splitmix64/_gen/gen-ir.test.ts`

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, fromCanonicalJson, type Tagged } from "../../../../src/Core.TypeScript/dynamic-value/json.ts";

const MASK = (1n << 64n) - 1n;
const u64 = (x: bigint): bigint => x & MASK;

type MixOp = { readonly op: "mul"; readonly k: bigint } | { readonly op: "xorshr"; readonly s: bigint };

// --- load the IR from the real DynamicValue row, exactly as gen.ts does ---

const IR_TEXT = readFileSync(join(import.meta.dir, "splitmix64.ir.json"), "utf8").trim();

function field(obj: Tagged, key: string): Tagged {
  if (obj.t !== "obj") throw new Error("expected object");
  const hit = obj.v.find(([k]) => k === key);
  if (!hit) throw new Error(`missing field ${key}`);
  return hit[1];
}
function parseOps(ir: Tagged): MixOp[] {
  const ops = field(ir, "ops");
  if (ops.t !== "arr") throw new Error("ops must be array");
  return ops.v.map((node): MixOp => {
    const opNode = field(node, "op");
    if (opNode.t !== "str") throw new Error("op must be str");
    if (opNode.v === "mul") {
      const k = field(node, "k");
      if (k.t !== "int") throw new Error("k must be int");
      return { op: "mul", k: u64(BigInt(k.v)) }; // reinterpret stored i64 -> u64
    }
    const s = field(node, "s");
    if (s.t !== "int") throw new Error("s must be int");
    return { op: "xorshr", s: BigInt(s.v) };
  });
}

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

test("the IR row is a CANONICAL DynamicValue (decoder accepts it; fixed-point holds)", () => {
  const decoded = fromCanonicalJson(IR_TEXT);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  // fixed-point: re-encoding the decoded value reproduces the row byte-for-byte.
  expect(canonicalJson(decoded.value)).toBe(IR_TEXT);
});

test("IR decoded FROM THE ROW reproduces the canonical SplitMix64 golden vectors", () => {
  const decoded = fromCanonicalJson(IR_TEXT);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  const ir = parseOps(decoded.value);
  for (const [input, expected] of Object.entries(GOLDEN)) {
    expect(runIr(ir, BigInt(input)).toString()).toBe(expected);
  }
});

test("a one-constant corruption of the IR diverges from the golden (fidelity bites)", () => {
  const decoded = fromCanonicalJson(IR_TEXT);
  if (!decoded.ok) throw new Error("row did not decode");
  const ir = parseOps(decoded.value);
  // Flip the last finalizer multiplier's low bit. A wrong generator must NOT
  // silently produce the right bytes.
  const corrupt: MixOp[] = ir.map((op) =>
    op.op === "mul" && op.k === 0x94d049bb133111ebn ? { op: "mul", k: 0x94d049bb133111ean } : op,
  );
  let differedSomewhere = false;
  for (const [input, expected] of Object.entries(GOLDEN)) {
    if (input === "0") continue; // 0 maps to 0 under any multiply
    if (runIr(corrupt, BigInt(input)).toString() !== expected) differedSomewhere = true;
  }
  expect(differedSomewhere).toBe(true);
});

test("dropping a round from the IR diverges from the golden", () => {
  const decoded = fromCanonicalJson(IR_TEXT);
  if (!decoded.ok) throw new Error("row did not decode");
  const ir = parseOps(decoded.value);
  const truncated = ir.slice(0, ir.length - 1); // drop final xor-shift
  expect(runIr(truncated, 1n).toString()).not.toBe(GOLDEN["1"]);
});
