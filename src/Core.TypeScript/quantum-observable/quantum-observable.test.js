import { describe, expect, test } from "bun:test";
import { QuantumObservableOracle } from "./oracle";
describe("QuantumObservableOracle simulator", () => {
    const oracle = new QuantumObservableOracle();
    test("SingleQubit measurements match expected probabilities", () => {
        const h = oracle.runSingleQubit("H|0>", "Zeta.ReferenceOracle.ApplyH");
        expect(h.Probabilities.Zero).toBeCloseTo(0.5, 5);
        expect(h.Probabilities.One).toBeCloseTo(0.5, 5);
        const ry3 = oracle.runSingleQubit("Ry(pi/3)|0>", "Zeta.ReferenceOracle.ApplyRyPiOver3", Math.PI / 3.0);
        // Ry(pi/3) rotation on |0> prepares cos(pi/6)|0> + sin(pi/6)|1>
        // P(0) = cos^2(pi/6) = 0.75, P(1) = sin^2(pi/6) = 0.25
        expect(ry3.Probabilities.Zero).toBeCloseTo(0.75, 5);
        expect(ry3.Probabilities.One).toBeCloseTo(0.25, 5);
        const ry2 = oracle.runSingleQubit("Ry(pi/2)|0>", "Zeta.ReferenceOracle.ApplyRyPiOver2", Math.PI / 2.0);
        // Ry(pi/2) prepares cos(pi/4)|0> + sin(pi/4)|1> -> equal probabilities
        expect(ry2.Probabilities.Zero).toBeCloseTo(0.5, 5);
        expect(ry2.Probabilities.One).toBeCloseTo(0.5, 5);
    });
    test("Canonical CHSH prepares PhiPlus and violates classical bounds", () => {
        const a = 0.0;
        const aPrime = Math.PI / 2.0;
        const b = Math.PI / 4.0;
        const bPrime = (3.0 * Math.PI) / 4.0;
        const chsh = oracle.runCanonicalChsh("PhiPlus canonical CHSH", a, aPrime, b, bPrime);
        // S should be close to Tsirelson bound (2 * sqrt(2) ≈ 2.8284)
        expect(chsh.S).toBeCloseTo(2 * Math.sqrt(2), 5);
        expect(chsh.ClassicalBound).toBe(2.0);
        expect(chsh.Tsirelson).toBeCloseTo(2.828427, 5);
    });
    test("Singlet CHSH corners sum to Tsirelson bound", () => {
        // Standard singlet CHSH configuration: angles a0=0, a1=pi/2, b0=pi/4, b1=-pi/4
        const corners = [
            {
                id: "E(a0,b0)",
                operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA0B0",
                a: 0.0,
                b: Math.PI / 4.0,
                coefficient: 1,
            },
            {
                id: "E(a0,b1)",
                operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA0B1",
                a: 0.0,
                b: -Math.PI / 4.0,
                coefficient: 1,
            },
            {
                id: "E(a1,b0)",
                operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA1B0",
                a: Math.PI / 2.0,
                b: Math.PI / 4.0,
                coefficient: 1,
            },
            {
                id: "E(a1,b1)",
                operation: "Zeta.ReferenceOracle.ApplyBellSingletChshA1B1",
                a: Math.PI / 2.0,
                b: -Math.PI / 4.0,
                coefficient: -1,
            },
        ];
        const singlet = oracle.runSingletChsh("BellSinglet CHSH corners", corners);
        expect(singlet.S).toBeCloseTo(2 * Math.sqrt(2), 5);
    });
    test("Bell coincidence outcomes match analytic overlap", () => {
        const c1 = oracle.runBellCoincidence("PhiPlus same-outcome a=0 b=pi/4", "PhiPlus", "Zeta.ReferenceOracle.ApplyBellPhiPlusAnalyzers", 0.0, Math.PI / 4.0, "sameOutcome");
        // same outcome probability is cos^2((a-b)/2) = cos^2(pi/8) ≈ 0.85355
        expect(c1.Probability).toBeCloseTo(Math.cos(Math.PI / 8.0) ** 2, 5);
        const c2 = oracle.runBellCoincidence("Singlet opposite-outcome a=0 b=pi/4", "Singlet", "Zeta.ReferenceOracle.ApplyBellSingletAnalyzers", 0.0, Math.PI / 4.0, "oppositeOutcome");
        // opposite outcome probability is cos^2((a-b)/2) = cos^2(pi/8) ≈ 0.85355
        expect(c2.Probability).toBeCloseTo(Math.cos(Math.PI / 8.0) ** 2, 5);
    });
    test("Mach-Zehnder interference visibility matches analytic visibility", () => {
        const openCase = oracle.runInterferenceVisibility("mach-zehnder-open", "Zeta.ReferenceOracle.ApplyMachZehnderOpen");
        expect(openCase.Probabilities.Zero).toBeCloseTo(0.5, 5);
        expect(openCase.Probabilities.One).toBeCloseTo(0.5, 5);
        expect(openCase.Visibility).toBeUndefined();
        const closedZero = oracle.runInterferenceVisibility("mach-zehnder-closed-zero-phase", "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase", 0.0);
        expect(closedZero.Probabilities.Zero).toBeCloseTo(1.0, 5);
        expect(closedZero.Probabilities.One).toBeCloseTo(0.0, 5);
        expect(closedZero.Visibility).toBe(1.0);
        const closedPi = oracle.runInterferenceVisibility("mach-zehnder-closed-pi-phase", "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase", Math.PI);
        expect(closedPi.Probabilities.Zero).toBeCloseTo(0.0, 5);
        expect(closedPi.Probabilities.One).toBeCloseTo(1.0, 5);
    });
    test("flow-bit distinction turns one external bit into a measured identity", () => {
        const zero = oracle.runFlowBitDistinction("external-bit-zero", "Zeta.ReferenceOracle.ApplyExternalBitDistinguishZero", false);
        expect(zero.ExternalBit).toBe(false);
        expect(zero.Probabilities.Zero).toBeCloseTo(1.0, 5);
        expect(zero.Probabilities.One).toBeCloseTo(0.0, 5);
        const one = oracle.runFlowBitDistinction("external-bit-one", "Zeta.ReferenceOracle.ApplyExternalBitDistinguishOne", true);
        expect(one.ExternalBit).toBe(true);
        expect(one.Probabilities.Zero).toBeCloseTo(0.0, 5);
        expect(one.Probabilities.One).toBeCloseTo(1.0, 5);
    });
});
