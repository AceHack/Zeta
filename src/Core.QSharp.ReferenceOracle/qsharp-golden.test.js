import { expect, test } from "bun:test";
import golden from "./qsharp-golden.json";
const tolerance = 1e-6;
const qsharpDumpTolerance = 1e-5;
function closeTo(actual, expected, epsilon = tolerance) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon);
}
function closeComplexTo(actual, expected, epsilon = tolerance) {
    closeTo(actual.real, expected.real, epsilon);
    closeTo(actual.imag, expected.imag, epsilon);
}
function expectDefined(value, label) {
    expect(value, label).toBeDefined();
    return value;
}
function matrixRow(matrix, row) {
    return expectDefined(matrix[row], `missing matrix row ${String(row)}`);
}
function matrixAt(matrix, row, col) {
    const rowValues = matrixRow(matrix, row);
    return expectDefined(rowValues[col], `missing matrix cell ${String(row)},${String(col)}`);
}
function probabilitySum(probabilities) {
    return probabilities.Zero + probabilities.One;
}
test("Q# golden fixture exposes the observable treaty", () => {
    expect(golden.schema).toBe("zeta.qsharp.reference-observables.v1");
    expect(golden.qsharpSource).toBe("src/Core.QSharp.ReferenceOracle/ZetaReferenceOracle.qs");
    expect(golden.qdkPackage).toBe("qdk[azure]==1.29.1");
    expect(golden.qsharpPackage).toBe("qsharp==1.29.1");
});
test("single-qubit measurement observables match textbook probabilities", () => {
    const cases = new Map(golden.vectors.singleQubitMeasurement.map((v) => [v.id, v]));
    const h = expectDefined(cases.get("H|0>"), "H|0>").probabilities;
    closeTo(h.Zero, 0.5);
    closeTo(h.One, 0.5);
    closeTo(probabilitySum(h), 1);
    const ryPiOver3 = expectDefined(cases.get("Ry(pi/3)|0>"), "Ry(pi/3)|0>").probabilities;
    closeTo(ryPiOver3.Zero, 0.75);
    closeTo(ryPiOver3.One, 0.25);
    closeTo(probabilitySum(ryPiOver3), 1);
    const ryPiOver2 = expectDefined(cases.get("Ry(pi/2)|0>"), "Ry(pi/2)|0>").probabilities;
    closeTo(ryPiOver2.Zero, 0.5);
    closeTo(ryPiOver2.One, 0.5);
    closeTo(probabilitySum(ryPiOver2), 1);
});
test("Bell/CHSH vector pins the canonical correlators and singlet corner observables", () => {
    const canonical = golden.vectors.bellChsh.canonical;
    closeTo(canonical.correlators["E(a,b)"], Math.SQRT1_2);
    closeTo(canonical.correlators["E(a,bPrime)"], -Math.SQRT1_2);
    closeTo(canonical.correlators["E(aPrime,b)"], Math.SQRT1_2);
    closeTo(canonical.correlators["E(aPrime,bPrime)"], Math.SQRT1_2);
    closeTo(canonical.s, 2 * Math.SQRT2);
    closeTo(canonical.tsirelson, 2 * Math.SQRT2);
    expect(canonical.s).toBeGreaterThan(canonical.classicalBound);
    const singlet = golden.vectors.bellChsh.singletCorners;
    expect(singlet.scope).toContain("Tsirelson maximality is cited/proved separately");
    expect(singlet.corners).toHaveLength(4);
    closeTo(singlet.analytic, 2 * Math.SQRT2);
    closeTo(singlet.s, singlet.analytic, qsharpDumpTolerance);
    const cornerMap = new Map(singlet.corners.map((v) => [v.id, v]));
    closeTo(expectDefined(cornerMap.get("E(a0,b0)"), "E(a0,b0)").correlator, Math.SQRT1_2, qsharpDumpTolerance);
    closeTo(expectDefined(cornerMap.get("E(a0,b1)"), "E(a0,b1)").correlator, Math.SQRT1_2, qsharpDumpTolerance);
    closeTo(expectDefined(cornerMap.get("E(a1,b0)"), "E(a1,b0)").correlator, Math.SQRT1_2, qsharpDumpTolerance);
    closeTo(expectDefined(cornerMap.get("E(a1,b1)"), "E(a1,b1)").correlator, -Math.SQRT1_2, qsharpDumpTolerance);
});
test("Bell coincidence observables pin PhiPlus and singlet outcome conventions", () => {
    const cases = new Map(golden.vectors.bellCoincidence.map((v) => [v.id, v]));
    const phiPiOver4 = expectDefined(cases.get("PhiPlus same-outcome a=0 b=pi/4"), "PhiPlus pi/4");
    closeTo(phiPiOver4.probability, Math.cos(Math.PI / 8) ** 2);
    expect(phiPiOver4.event).toBe("sameOutcome");
    const singletPiOver4 = expectDefined(cases.get("Singlet opposite-outcome a=0 b=pi/4"), "Singlet pi/4");
    closeTo(singletPiOver4.probability, Math.cos(Math.PI / 8) ** 2);
    expect(singletPiOver4.event).toBe("oppositeOutcome");
    const phiPiOver2 = expectDefined(cases.get("PhiPlus same-outcome a=0 b=pi/2"), "PhiPlus pi/2");
    closeTo(phiPiOver2.probability, 0.5);
    const phiPi = expectDefined(cases.get("PhiPlus same-outcome a=0 b=pi"), "PhiPlus pi");
    closeTo(phiPi.probability, 0);
});
test("interference observables distinguish open, reinforce, and cancel cases", () => {
    const cases = new Map(golden.vectors.interferenceVisibility.map((v) => [v.id, v]));
    const open = expectDefined(cases.get("mach-zehnder-open"), "mach-zehnder-open").probabilities;
    closeTo(open.Zero, 0.5, qsharpDumpTolerance);
    closeTo(open.One, 0.5, qsharpDumpTolerance);
    const reinforced = expectDefined(cases.get("mach-zehnder-closed-zero-phase"), "mach-zehnder-zero").probabilities;
    closeTo(reinforced.Zero, 1);
    closeTo(reinforced.One, 0);
    const piOver3 = expectDefined(cases.get("mach-zehnder-closed-pi-over-3-phase"), "mach-zehnder-pi-over-3").probabilities;
    closeTo(piOver3.Zero, 0.75, qsharpDumpTolerance);
    closeTo(piOver3.One, 0.25, qsharpDumpTolerance);
    const piOver2 = expectDefined(cases.get("mach-zehnder-closed-pi-over-2-phase"), "mach-zehnder-pi-over-2").probabilities;
    closeTo(piOver2.Zero, 0.5, qsharpDumpTolerance);
    closeTo(piOver2.One, 0.5, qsharpDumpTolerance);
    const twoPiOver3 = expectDefined(cases.get("mach-zehnder-closed-two-pi-over-3-phase"), "mach-zehnder-two-pi-over-3").probabilities;
    closeTo(twoPiOver3.Zero, 0.25, qsharpDumpTolerance);
    closeTo(twoPiOver3.One, 0.75, qsharpDumpTolerance);
    const cancelled = expectDefined(cases.get("mach-zehnder-closed-pi-phase"), "mach-zehnder-pi").probabilities;
    closeTo(cancelled.Zero, 0);
    closeTo(cancelled.One, 1);
});
test("flow-bit distinction turns one external entropy bit into a measured identity bit", () => {
    const cases = new Map(golden.vectors.flowBitDistinction.map((v) => [v.id, v]));
    const zero = expectDefined(cases.get("external-bit-zero"), "external-bit-zero");
    expect(zero.operation).toBe("Zeta.ReferenceOracle.ApplyExternalBitDistinguishZero");
    expect(zero.externalBit).toBe(false);
    closeTo(zero.probabilities.Zero, 1);
    closeTo(zero.probabilities.One, 0);
    const one = expectDefined(cases.get("external-bit-one"), "external-bit-one");
    expect(one.operation).toBe("Zeta.ReferenceOracle.ApplyExternalBitDistinguishOne");
    expect(one.externalBit).toBe(true);
    closeTo(one.probabilities.Zero, 0);
    closeTo(one.probabilities.One, 1);
});
test("Q# Pauli products pin the hardware-side anticommutation signs", () => {
    for (const item of golden.vectors.pauliAnticommutation) {
        expect(item.relation).toBe("lhsMatrix = -rhsMatrix");
        const lhs = item.lhsMatrix;
        const rhs = item.rhsMatrix;
        for (let row = 0; row < lhs.length; row++) {
            const lhsRow = matrixRow(lhs, row);
            for (let col = 0; col < lhsRow.length; col++) {
                const lhsValue = matrixAt(lhs, row, col);
                const rhsValue = matrixAt(rhs, row, col);
                closeComplexTo(lhsValue, { real: -rhsValue.real, imag: -rhsValue.imag });
            }
        }
    }
});
