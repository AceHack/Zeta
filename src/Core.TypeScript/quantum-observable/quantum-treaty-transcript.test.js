import { describe, expect, test } from "bun:test";
import transcript from "./quantum-treaty-transcript.json";
import { QuantumObservableOracle } from "./oracle";
describe("Quantum treaty transcript integrity", () => {
    const oracle = new QuantumObservableOracle();
    test("transcript schema is correct", () => {
        expect(transcript.schema).toBe("zeta.quantum.zset-transcript.v1");
        expect(transcript.batches.length).toBe(2);
    });
    test("batch 0 deltas match simulator expectations", () => {
        const batch = transcript.batches[0];
        if (batch === undefined) {
            throw new Error("Batch 0 is undefined");
        }
        expect(batch.batchId).toBe(0);
        for (const delta of batch.deltas) {
            expect(delta.weight).toBe(1);
            const row = delta.row;
            switch (row.type) {
                case "SingleQubit": {
                    const expected = row.value;
                    const actual = oracle.runSingleQubit(expected.Id, expected.Operation, expected.ThetaRadians);
                    expect(actual.Probabilities.Zero).toBeCloseTo(expected.Probabilities.Zero, 5);
                    expect(actual.Probabilities.One).toBeCloseTo(expected.Probabilities.One, 5);
                    break;
                }
                case "CanonicalChsh": {
                    const expected = row.value;
                    const actual = oracle.runCanonicalChsh(expected.Id, expected.Angles.A, expected.Angles.APrime, expected.Angles.B, expected.Angles.BPrime);
                    expect(actual.Correlators.EAB).toBeCloseTo(expected.Correlators.EAB, 5);
                    expect(actual.Correlators.EABPrime).toBeCloseTo(expected.Correlators.EABPrime, 5);
                    expect(actual.Correlators.EAPrimeB).toBeCloseTo(expected.Correlators.EAPrimeB, 5);
                    expect(actual.Correlators.EAPrimeBPrime).toBeCloseTo(expected.Correlators.EAPrimeBPrime, 5);
                    expect(actual.S).toBeCloseTo(expected.S, 5);
                    break;
                }
                case "SingletChsh": {
                    const expected = row.value;
                    const actual = oracle.runSingletChsh(expected.Id, expected.Corners);
                    expect(actual.S).toBeCloseTo(expected.S, 5);
                    break;
                }
                case "BellCorner": {
                    const expected = row.value;
                    // We can test a corner by wrapping it as a single-element list in runSingletChsh
                    const actualSinglet = oracle.runSingletChsh("dummy", [expected]);
                    const actual = actualSinglet.Corners[0];
                    if (actual === undefined) {
                        throw new Error("Expected at least one corner");
                    }
                    expect(actual.SameOutcomeProbability).toBeCloseTo(expected.SameOutcomeProbability, 5);
                    expect(actual.OppositeOutcomeProbability).toBeCloseTo(expected.OppositeOutcomeProbability, 5);
                    expect(actual.Correlator).toBeCloseTo(expected.Correlator, 5);
                    break;
                }
                case "BellCoincidence": {
                    const expected = row.value;
                    const actual = oracle.runBellCoincidence(expected.Id, expected.State, expected.Operation, expected.A, expected.B, expected.Event);
                    expect(actual.Probability).toBeCloseTo(expected.Probability, 5);
                    break;
                }
                case "InterferenceVisibility": {
                    const expected = row.value;
                    const actual = oracle.runInterferenceVisibility(expected.Id, expected.Operation, expected.PhaseRadians);
                    expect(actual.Probabilities.Zero).toBeCloseTo(expected.Probabilities.Zero, 5);
                    expect(actual.Probabilities.One).toBeCloseTo(expected.Probabilities.One, 5);
                    expect(actual.Visibility).toBe(expected.Visibility);
                    break;
                }
            }
        }
    });
    test("batch 1 deltas match simulator expectations", () => {
        const batch = transcript.batches[1];
        if (batch === undefined) {
            throw new Error("Batch 1 is undefined");
        }
        expect(batch.batchId).toBe(1);
        for (const delta of batch.deltas) {
            const row = delta.row;
            if (delta.weight === -1) {
                expect(row.type).toBe("InterferenceVisibility");
                if (row.type === "InterferenceVisibility") {
                    const expected = row.value;
                    const actual = oracle.runInterferenceVisibility(expected.Id, expected.Operation, expected.PhaseRadians);
                    expect(actual.Probabilities.Zero).toBeCloseTo(expected.Probabilities.Zero, 5);
                    expect(actual.Probabilities.One).toBeCloseTo(expected.Probabilities.One, 5);
                }
            }
            else {
                expect(delta.weight).toBe(1);
                expect(row.type).toBe("InterferenceVisibility");
                if (row.type === "InterferenceVisibility") {
                    const expected = row.value;
                    const actual = oracle.runInterferenceVisibility(expected.Id, expected.Operation, expected.PhaseRadians);
                    expect(actual.Probabilities.Zero).toBeCloseTo(expected.Probabilities.Zero, 5);
                    expect(actual.Probabilities.One).toBeCloseTo(expected.Probabilities.One, 5);
                }
            }
        }
    });
});
