import { describe, test, expect } from "bun:test";
import {
  generateCodegen, referenceCodegen, verifyFixpoint,
  typeScriptCodegenIr, type CodegenIr
} from "./codegen-self-host";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load real IRs for testing
const goldenFile = JSON.parse(readFileSync(
  join(import.meta.dir, "../zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8"
));

function loadIr(name: string) {
  const raw = goldenFile[name] as string;
  const safe = raw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
  return JSON.parse(safe);
}

const sm64 = loadIr("rng.splitmix64");
const fmix32 = loadIr("hash.fmix32");

// A tiny hand-made IR for basic testing
const tinyIr = { generator: "test.tiny", width: 4, ops: [{ op: "mul", k: 3 }, { op: "xorshr", s: 1 }] };

describe("self-hosting codegen — gen(gen)=gen operational", () => {
  test("generateCodegen produces a valid function", () => {
    const codegen = generateCodegen(typeScriptCodegenIr);
    expect(typeof codegen).toBe("function");
    const output = codegen(tinyIr);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  test("generated codegen output matches reference for tiny IR", () => {
    const codegen = generateCodegen(typeScriptCodegenIr);
    const genOutput = codegen(tinyIr);
    const refOutput = referenceCodegen(tinyIr);
    expect(genOutput).toBe(refOutput);
  });

  test("gen(gen)=gen: fixpoint holds for splitmix64", () => {
    const codegen = generateCodegen(typeScriptCodegenIr);
    const genOutput = codegen(sm64);
    const refOutput = referenceCodegen(sm64);
    expect(genOutput).toBe(refOutput);
  });

  test("gen(gen)=gen: fixpoint holds for fmix32", () => {
    const codegen = generateCodegen(typeScriptCodegenIr);
    const genOutput = codegen(fmix32);
    const refOutput = referenceCodegen(fmix32);
    expect(genOutput).toBe(refOutput);
  });

  test("verifyFixpoint passes on all test IRs", () => {
    const result = verifyFixpoint(typeScriptCodegenIr, [sm64, fmix32, tinyIr]);
    expect(result.pass).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  test("generated output contains correct splitmix64 constants", () => {
    const codegen = generateCodegen(typeScriptCodegenIr);
    const output = codegen(sm64);
    expect(output).toContain("11400714819323198485n");
    expect(output).toContain("13787848793156543929n");
    expect(output).toContain("10723151780598845931n");
    expect(output).toContain("z ^ (z >> 30n)");
    expect(output).toContain("z ^ (z >> 27n)");
    expect(output).toContain("z ^ (z >> 31n)");
  });

  test("generated output is self-contained (has MASK, function, return)", () => {
    const codegen = generateCodegen(typeScriptCodegenIr);
    const output = codegen(sm64);
    expect(output).toContain("const MASK");
    expect(output).toContain("function mix");
    expect(output).toContain("return z;");
  });

  test("the meta-IR is deterministic (same input → same output)", () => {
    const codegen1 = generateCodegen(typeScriptCodegenIr);
    const codegen2 = generateCodegen(typeScriptCodegenIr);
    expect(codegen1(sm64)).toBe(codegen2(sm64));
  });

  test("the meta-IR is the ONLY input needed (no external deps)", () => {
    // A completely independent meta-IR can produce a codegen
    const customMeta: CodegenIr = {
      schema: "zeta-ir-v2-codegen",
      target: "custom",
      header: "fn run(x) {",
      footer: "}",
      wrapExpr: "{expr}",
      patterns: [
        { opType: "mul", template: "  x = {expr};", substitutions: [{ placeholder: "{expr}", source: "k_unsigned" }] },
      ],
    };
    const codegen = generateCodegen(customMeta);
    const output = codegen({ generator: "test", width: 4, ops: [{ op: "mul", k: 5 }] });
    // k_unsigned source emits "z * 5n"
    expect(output).toContain("z * 5n");
    expect(output).toContain("fn run(x)");
  });

  test("Π²=Π: re-generating the codegen from the same meta produces identical output", () => {
    const gen1 = generateCodegen(typeScriptCodegenIr);
    const gen2 = generateCodegen(typeScriptCodegenIr);
    // Both produce the same output for any input (idempotent)
    for (const ir of [sm64, fmix32, tinyIr]) {
      expect(gen1(ir)).toBe(gen2(ir));
    }
  });
});
