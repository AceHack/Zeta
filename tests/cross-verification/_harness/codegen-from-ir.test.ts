/**
 * codegen-from-ir.test.ts — Phase B gate: gen(IR) byte-matches the golden vectors.
 *
 * Proves the multi-language codegen produces oracle scripts whose output is
 * byte-identical to the committed canonical golden vectors. This is the gen(gen)
 * trajectory's Phase B gate: "gen(primitive-IR) == golden in all oracles."
 *
 * TWO CORRECTIONS TO THIS FILE (2026-08-15)
 * -----------------------------------------
 *   1. The test named "generated TS oracle execution produces golden-matching
 *      output" did not execute the generated oracle. It re-implemented the fold
 *      inline and checked THAT against the goldens — so it passed for any emitted
 *      text whatsoever, including text that does not parse. It now WRITES the
 *      emitted program and RUNS it, and asserts on the file the program produced.
 *   2. Everything here ran against splitmix64 only — width 64, `mul|xorshr` only.
 *      That is exactly the coverage hole that hid the width defect (four emitters
 *      hardcoded 64-bit words) and the grammar defect (any non-`mul` op emitted as
 *      `xorshr undefined`). A width-32 row and a v3/v4-op row now run too, and the
 *      refusal paths are asserted rather than assumed.
 *
 * The independent-oracle half — generated output vs the HAND-WRITTEN ports — is
 * `ir-vs-handwritten.test.ts`; these two are complements, not substitutes.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalInputsFor,
  emitCSharp,
  emitFSharp,
  emitGo,
  emitPython,
  emitRust,
  emitTypeScript,
  parseIrJson,
  type ZetaIrV1,
} from "./codegen-from-ir";

// Extract the splitmix64 v1 IR from the golden
const goldenFile = readFileSync(join(import.meta.dir, "../zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8");
const goldenMap: Record<string, string> = JSON.parse(goldenFile);
const ir: ZetaIrV1 = parseIrJson(goldenMap["rng.splitmix64"]!);
const fmix32Ir: ZetaIrV1 = parseIrJson(goldenMap["hash.fmix32"]!);

/** A v3/v4-grammar IR (rotl + add) — no `xorshr` at all, so a mul/xorshr-only emitter cannot fake it. */
const rotlAddIr: ZetaIrV1 = {
  schema: "zeta-ir-v4",
  generator: "test.rotl_add",
  version: 1,
  width: 64,
  ops: [{ op: "rotl", r: 7 }, { op: "mul", k: 5n }, { op: "add", k: 9n }],
};

// Canonical expected results (splitmix64, width 64)
const GOLDEN_VECTORS: Record<string, string> = {
  "x-0": "0",
  "x-1": "16294208416658607535",
  "x-2": "7960286522194355700",
  "x-10": "17561866513979060390",
  "x-255": "80788758552623550",
  "x-u64max": "3703370420611038912",
  "x-golden": "5878998237028904013",
  "x-2pow63": "2720858781877447050",
  "x-12345678901234567890": "284664278009360702",
  "x-1e18": "11308661470685490763",
};

/** Canonical expected results (fmix32, width 32) — the committed `fmix32/*-output.json` values. */
const FMIX32_VECTORS: Record<string, string> = {
  "x-0": "0",
  "x-1": "1364076727",
  "x-2": "821347078",
  "x-10": "3911517328",
  "x-255": "1818482051",
  "x-u32max": "2180083513",
  "x-0x9e3779b9": "2462723854",
  "x-2pow31": "1832674720",
  "x-3735928559": "233162409",
  "x-1e9": "4234498180",
};

const scratch = mkdtempSync(join(tmpdir(), "codegen-from-ir-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** Write the emitted TS oracle, RUN it, and return the JSON file it wrote. */
function runEmittedTypeScript(target: ZetaIrV1, label: string): Record<string, string> {
  const dir = join(scratch, label);
  mkdirSync(join(dir, "gen"), { recursive: true });
  const file = join(dir, "gen", "gen.ts");
  writeFileSync(file, emitTypeScript(target));
  execFileSync("bun", [file], { cwd: join(dir, "gen"), encoding: "utf-8" });
  return JSON.parse(readFileSync(join(dir, "ts-output.json"), "utf-8")) as Record<string, string>;
}

/** Write the emitted Python oracle, RUN it, and return the JSON file it wrote. */
function runEmittedPython(target: ZetaIrV1, label: string): Record<string, string> {
  const dir = join(scratch, label);
  mkdirSync(join(dir, "gen"), { recursive: true });
  const file = join(dir, "gen", "gen.py");
  writeFileSync(file, emitPython(target));
  execFileSync("python3", [file], { cwd: join(dir, "gen"), encoding: "utf-8" });
  return JSON.parse(readFileSync(join(dir, "python-output.json"), "utf-8")) as Record<string, string>;
}

describe("codegen-from-ir — Phase B gate (gen(IR) === golden)", () => {
  test("generated TS oracle carries the multipliers as unsigned words of the IR width", () => {
    const ts = emitTypeScript(ir);
    // 0x9E3779B97F4A7C15 / 0xBF58476D1CE4E5B9 / 0x94D049BB133111EB, unsigned.
    expect(ts).toContain('"11400714819323198485"');
    expect(ts).toContain('"13787848793156543929"');
    expect(ts).toContain('"10723151780598845931"');
    expect(ts).toContain('"xorshr"');
  });

  test("generated F# oracle contains correct unsigned multipliers", () => {
    const fsx = emitFSharp(ir);
    expect(fsx).toContain("11400714819323198485UL");
    expect(fsx).toContain("13787848793156543929UL");
    expect(fsx).toContain("10723151780598845931UL");
    expect(fsx).toContain(">>> 30");
    expect(fsx).toContain(">>> 27");
    expect(fsx).toContain(">>> 31");
  });

  test("generated C# oracle uses unchecked and correct hex constants", () => {
    const csx = emitCSharp(ir);
    expect(csx).toContain("unchecked");
    expect(csx).toContain("0x9E3779B97F4A7C15UL");
    expect(csx).toContain("0xBF58476D1CE4E5B9UL");
    expect(csx).toContain("0x94D049BB133111EBUL");
    expect(csx).toContain(">> 30");
    expect(csx).toContain(">> 27");
    expect(csx).toContain(">> 31");
  });

  test("generated Rust oracle uses wrapping_mul and correct hex constants", () => {
    const rs = emitRust(ir);
    expect(rs).toContain("wrapping_mul");
    expect(rs).toContain("0x9E3779B97F4A7C15");
    expect(rs).toContain("0xBF58476D1CE4E5B9");
    expect(rs).toContain("0x94D049BB133111EB");
    expect(rs).toContain(">> 30");
    expect(rs).toContain(">> 27");
    expect(rs).toContain(">> 31");
  });

  test("codegen is deterministic (same IR → same output)", () => {
    expect(emitTypeScript(ir)).toBe(emitTypeScript(ir));
    expect(emitFSharp(ir)).toBe(emitFSharp(ir));
    expect(emitPython(fmix32Ir)).toBe(emitPython(fmix32Ir));
  });

  test("all targets are tagged as generated-from-ir", () => {
    expect(emitTypeScript(ir)).toContain("generated-from-ir");
    expect(emitFSharp(ir)).toContain("generated-from-ir");
    expect(emitCSharp(ir)).toContain("generated-from-ir");
    expect(emitRust(ir)).toContain("generated-from-ir");
    expect(emitPython(ir)).toContain("generated-from-ir");
    expect(emitGo(ir)).toContain("generated-from-ir");
  });

  test("EXECUTING the generated TS oracle reproduces the splitmix64 goldens", () => {
    const out = runEmittedTypeScript(ir, "sm-ts");
    expect(out._source).toBe("generated-from-ir");
    for (const [id, expected] of Object.entries(GOLDEN_VECTORS)) {
      expect(`${id}=${String(out[id])}`).toBe(`${id}=${expected}`);
    }
  });

  test("EXECUTING the generated Python oracle reproduces the splitmix64 goldens", () => {
    const out = runEmittedPython(ir, "sm-py");
    for (const [id, expected] of Object.entries(GOLDEN_VECTORS)) {
      expect(`${id}=${String(out[id])}`).toBe(`${id}=${expected}`);
    }
  });

  test("WIDTH 32: executing the generated TS oracle reproduces the fmix32 goldens", () => {
    // The regression row. Before the width fix this returned 64-bit values
    // (x-1 = 7340060871154608311) because the TS emitter hardcoded a 64-bit mask.
    const out = runEmittedTypeScript(fmix32Ir, "fm-ts");
    for (const [id, expected] of Object.entries(FMIX32_VECTORS)) {
      expect(`${id}=${String(out[id])}`).toBe(`${id}=${expected}`);
    }
  });

  test("WIDTH 32: the TS and Python lanes of one IR agree with each other", () => {
    const a = runEmittedTypeScript(fmix32Ir, "fm-ts2");
    const b = runEmittedPython(fmix32Ir, "fm-py2");
    for (const [id] of canonicalInputsFor(32)) {
      expect(`ts:${id}=${String(a[id])}`).toBe(`ts:${id}=${String(b[id])}`);
    }
  });

  test("width-32 canonical inputs are all IN RANGE for a 32-bit word", () => {
    // The Go lane failed to COMPILE at width 32 because the input list was a
    // fixed u64 set; nothing asserted the inputs fit the width.
    for (const [id, v] of canonicalInputsFor(32)) {
      expect(`${id}<2^32: ${String(BigInt(v) < 1n << 32n)}`).toBe(`${id}<2^32: true`);
    }
    for (const [id, v] of canonicalInputsFor(64)) {
      expect(`${id}<2^64: ${String(BigInt(v) < 1n << 64n)}`).toBe(`${id}<2^64: true`);
    }
  });

  test("v3/v4 grammar (rotl + add) is emitted, not silently turned into xorshr", () => {
    // Pre-fix, every emitter's fallthrough produced `xorshr undefined` here.
    for (const src of [emitFSharp, emitCSharp, emitRust, emitPython, emitGo, emitTypeScript]) {
      const text = src(rotlAddIr);
      expect(text).not.toContain("undefined");
    }
    const out = runEmittedTypeScript(rotlAddIr, "ra-ts");
    const py = runEmittedPython(rotlAddIr, "ra-py");
    // rotl(1,7)=128; 128*5=640; 640+9=649
    expect(out["x-1"]).toBe("649");
    expect(py["x-1"]).toBe("649");
  });

  test("an op outside the v1..v4 grammar is REFUSED, in every emitter", () => {
    const bad: ZetaIrV1 = { ...ir, ops: [{ op: "frobnicate" } as unknown as ZetaIrV1["ops"][0]] };
    for (const src of [emitTypeScript, emitFSharp, emitCSharp, emitRust, emitPython, emitGo]) {
      expect(() => src(bad)).toThrow(/not in the v1\.\.v4 grammar/);
    }
  });

  test("an unsupported width is REFUSED, in every emitter", () => {
    const bad: ZetaIrV1 = { ...ir, width: 24 };
    for (const src of [emitTypeScript, emitFSharp, emitCSharp, emitRust, emitPython, emitGo]) {
      expect(() => src(bad)).toThrow(/width 24 is not supported/);
    }
  });

  test("IR schema is zeta-ir-v1", () => {
    expect(ir.schema).toBe("zeta-ir-v1");
    expect(ir.width).toBe(64);
    expect(ir.generator).toBe("rng.splitmix64");
    expect(fmix32Ir.width).toBe(32);
  });
});
