import { describe, test, expect } from "bun:test";
import { emitTypeScriptHarness, emitPythonHarness, emitGoHarness } from "./codegen-harness";
import { emitSpecializedFSharp, emitSpecializedCSharp, emitSpecializedRust, emitSpecializedGo, emitSpecializedQSharp } from "./codegen-specialize-remaining";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Load splitmix64 IR (BigInt-safe)
const goldenFile = JSON.parse(readFileSync(join(import.meta.dir, "../zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8"));
const irRaw = goldenFile["rng.splitmix64"];
const irSafe = irRaw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
const ir = JSON.parse(irSafe);
// Load golden vectors
const goldens = JSON.parse(readFileSync(join(import.meta.dir, "../splitmix64/ts-output.json"), "utf-8"));
// Build HarnessConfig
const vectors = Object.entries(goldens)
    .filter(([id]) => id !== "_source")
    .map(([id, expected]) => {
    const inputStr = id.replace("x-", "");
    const input = inputStr === "u64max" ? "18446744073709551615" :
        inputStr === "golden" ? "11400714819323198485" :
            inputStr === "2pow63" ? "9223372036854775808" :
                inputStr === "1e18" ? "1000000000000000000" : inputStr;
    return { id, input, expected: expected };
});
const cfg = { generator: ir.generator, width: ir.width, ops: ir.ops, goldens: vectors };
describe("codegen-harness — auto-generated test harnesses", () => {
    test("TS harness contains golden assertions and benchmark", () => {
        const ts = emitTypeScriptHarness(cfg);
        expect(ts).toContain("mix(1n) === 16294208416658607535n");
        expect(ts).toContain("performance.now()");
        expect(ts).toContain("golden vectors PASS");
    });
    test("Python harness contains golden assertions and benchmark", () => {
        const py = emitPythonHarness(cfg);
        expect(py).toContain("16294208416658607535");
        expect(py).toContain("time.perf_counter()");
        expect(py).toContain("golden vectors PASS");
    });
    test("Go harness contains golden assertions and benchmark", () => {
        const go = emitGoHarness(cfg);
        expect(go).toContain("16294208416658607535");
        expect(go).toContain("time.Now()");
        expect(go).toContain("golden vectors PASS");
    });
    test("all harnesses are self-contained (import their own deps)", () => {
        const ts = emitTypeScriptHarness(cfg);
        const py = emitPythonHarness(cfg);
        const go = emitGoHarness(cfg);
        // Each file defines mix() inline — no external imports needed
        expect(ts).toContain("function mix(");
        expect(py).toContain("def mix(");
        expect(go).toContain("func mix(");
    });
});
describe("codegen-specialize-remaining — 5 additional language targets", () => {
    test("F# specialized: inline, no loop, correct multipliers", () => {
        const fsx = emitSpecializedFSharp(ir);
        expect(fsx).toContain("let inline mix");
        expect(fsx).toContain("11400714819323198485UL");
        expect(fsx).toContain("z ^^^ (z >>> 30)");
        // No loops in the generated function body
        expect(fsx).not.toContain("for i");
        expect(fsx).not.toContain("while ");
    });
    test("C# specialized: unchecked, AggressiveInlining, hex constants", () => {
        const cs = emitSpecializedCSharp(ir);
        expect(cs).toContain("AggressiveInlining");
        expect(cs).toContain("unchecked");
        expect(cs).toContain("0x9E3779B97F4A7C15UL");
        expect(cs).not.toContain("for (");
    });
    test("Rust specialized: wrapping_mul, inline(always), hex constants", () => {
        const rs = emitSpecializedRust(ir);
        expect(rs).toContain("#[inline(always)]");
        expect(rs).toContain("wrapping_mul(0x9E3779B97F4A7C15)");
        expect(rs).toContain("z ^ (z >> 30)");
        expect(rs).not.toContain("for ");
    });
    test("Go specialized: straight-line, correct hex constants", () => {
        const go = emitSpecializedGo(ir);
        expect(go).toContain("func mix(x uint64) uint64");
        expect(go).toContain("0x9E3779B97F4A7C15");
        expect(go).not.toContain("for ");
    });
    test("Q# specialized: Int masking, no loop", () => {
        const qs = emitSpecializedQSharp(ir);
        expect(qs).toContain("function Mix(x : Int)");
        expect(qs).toContain("11400714819323198485L");
        expect(qs).toContain("z ^^^ (z >>> 30)");
        expect(qs).not.toContain("for");
    });
    test("all 5 targets are UNROLLED (1st Futamura — no interpreter loop)", () => {
        const all = [emitSpecializedFSharp(ir), emitSpecializedCSharp(ir),
            emitSpecializedRust(ir), emitSpecializedGo(ir), emitSpecializedQSharp(ir)];
        for (const code of all) {
            expect(code).toContain("SPECIALIZED (1st Futamura projection)");
            // No iteration constructs in the function body
            expect(code).not.toContain("ops.reduce");
            expect(code).not.toContain("ops.forEach");
        }
    });
});
