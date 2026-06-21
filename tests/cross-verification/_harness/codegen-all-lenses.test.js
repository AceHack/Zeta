import { describe, test, expect } from "bun:test";
import { emitFSharpRx, emitRustRx, emitGoRx, emitQSharpRx } from "./codegen-rx-remaining";
import { emitCliffordPython, emitCliffordFSharp, emitCliffordCSharp, emitCliffordRust, emitCliffordGo, emitCliffordQSharp } from "./codegen-clifford-remaining";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Load splitmix64 IR
const goldenFile = JSON.parse(readFileSync(join(import.meta.dir, "../zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8"));
const sm64Raw = goldenFile["rng.splitmix64"];
const sm64Safe = sm64Raw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
const sm64 = JSON.parse(sm64Safe);
// Load branching IR
const branchIr = JSON.parse(readFileSync(join(import.meta.dir, "../zset-isa-v2/sample-circuit.ir.json"), "utf-8"));
describe("Rx lens — F#, Rust, Go, Q# emitters", () => {
    test("F# Rx: Observable.map for deterministic ops", () => {
        const fsx = emitFSharpRx(sm64);
        expect(fsx).toContain("Observable.map");
        expect(fsx).toContain("11400714819323198485UL");
        expect(fsx).toContain("z ^^^ (z >>> 30)");
        expect(fsx).not.toContain("Observable.flatMap");
    });
    test("F# Rx: flatMap for branching", () => {
        const fsx = emitFSharpRx(branchIr);
        expect(fsx).toContain("Observable.flatMap");
    });
    test("Rust Rx: futures::stream map + wrapping_mul", () => {
        const rs = emitRustRx(sm64);
        expect(rs).toContain(".map(|z|");
        expect(rs).toContain("wrapping_mul");
        expect(rs).toContain("0x9E3779B97F4A7C15");
        expect(rs).not.toContain("flat_map");
    });
    test("Rust Rx: flat_map for branching", () => {
        const rs = emitRustRx(branchIr);
        expect(rs).toContain("flat_map");
    });
    test("Go Rx: channel pipeline with goroutines", () => {
        const go = emitGoRx(sm64);
        expect(go).toContain("go func()");
        expect(go).toContain("chan uint64");
        expect(go).toContain("0x9E3779B97F4A7C15");
        expect(go).toContain("ch0 := input");
    });
    test("Go Rx: branch op produces fork goroutine", () => {
        const go = emitGoRx(branchIr);
        expect(go).toContain("branch");
        expect(go).toContain("cap*2");
    });
    test("Q# Rx: quantum IS the Rx (all paths simultaneously)", () => {
        const qs = emitQSharpRx(sm64);
        expect(qs).toContain("operation Pipeline");
        expect(qs).toContain("Qubit[]");
        expect(qs).toContain("scale amplitude");
        expect(qs).toContain("reflect through basis vector");
    });
    test("all 4 new Rx emitters include GENERATED marker", () => {
        expect(emitFSharpRx(sm64)).toContain("GENERATED");
        expect(emitRustRx(sm64)).toContain("GENERATED");
        expect(emitGoRx(sm64)).toContain("GENERATED");
        expect(emitQSharpRx(sm64)).toContain("GENERATED");
    });
});
describe("Clifford lens — Python, F#, C#, Rust, Go, Q# emitters", () => {
    test("Python Clifford: numpy multivector + geo_product", () => {
        const py = emitCliffordPython(sm64);
        expect(py).toContain("import numpy");
        expect(py).toContain("geo_product");
        expect(py).toContain("sandwich");
        expect(py).toContain("scale(state,");
    });
    test("F# Clifford: uses Cl3 module", () => {
        const fsx = emitCliffordFSharp(sm64);
        expect(fsx).toContain("open Zeta.Core");
        expect(fsx).toContain("Cl3.scale");
        expect(fsx).toContain("Cl3.sandwich");
        expect(fsx).toContain("Cl3.basisVector");
    });
    test("C# Clifford: static methods on Cl3 class", () => {
        const cs = emitCliffordCSharp(sm64);
        expect(cs).toContain("using Zeta.Core");
        expect(cs).toContain("Cl3.Scale");
        expect(cs).toContain("Cl3.Sandwich");
        expect(cs).toContain("Cl3.BasisVector");
    });
    test("Rust Clifford: cl3 crate with scale/sandwich", () => {
        const rs = emitCliffordRust(sm64);
        expect(rs).toContain("use crate::cl3");
        expect(rs).toContain("cl3::scale");
        expect(rs).toContain("cl3::sandwich");
        expect(rs).toContain("cl3::basis_vector");
    });
    test("Go Clifford: cl3 package with Scale/Sandwich", () => {
        const go = emitCliffordGo(sm64);
        expect(go).toContain("cl3.Scale");
        expect(go).toContain("cl3.Sandwich");
        expect(go).toContain("cl3.BasisVector");
    });
    test("Q# Clifford: Pauli gates ARE Clifford operations", () => {
        const qs = emitCliffordQSharp(sm64);
        expect(qs).toContain("is Adj + Ctl");
        expect(qs).toContain("Rz rotation");
        expect(qs).toContain("Pauli reflection");
    });
    test("all 6 new Clifford emitters include GENERATED marker", () => {
        expect(emitCliffordPython(sm64)).toContain("GENERATED");
        expect(emitCliffordFSharp(sm64)).toContain("GENERATED");
        expect(emitCliffordCSharp(sm64)).toContain("GENERATED");
        expect(emitCliffordRust(sm64)).toContain("GENERATED");
        expect(emitCliffordGo(sm64)).toContain("GENERATED");
        expect(emitCliffordQSharp(sm64)).toContain("GENERATED");
    });
    test("each Clifford emitter has 3 mul + 3 xorshr steps for splitmix64", () => {
        for (const emit of [emitCliffordPython, emitCliffordFSharp, emitCliffordCSharp, emitCliffordRust, emitCliffordGo, emitCliffordQSharp]) {
            const code = emit(sm64);
            const steps = (code.match(/Step \d/g) || []).length;
            expect(steps).toBe(6); // 3 mul + 3 xorshr
        }
    });
});
