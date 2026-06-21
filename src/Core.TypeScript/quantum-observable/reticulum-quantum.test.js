import { describe, expect, test } from "bun:test";
import { consolidateQuantumObservableDeltas, decode, decodeDelta, encode, encodeDelta, ofQuantumObservableDelta, ofQuantumObservableRow, } from "./reticulum-quantum";
import deltaVectors from "./reticulum-quantum-delta-vectors.json";
import transcript from "./quantum-treaty-transcript.json";
const treatyTranscript = transcript;
const deltaTreaty = deltaVectors;
function rowId(row) {
    return row.value.Id;
}
describe("ReticulumQuantum symmetry and codec", () => {
    test("encode and decode are symmetric", () => {
        const original = {
            Room: "salon",
            Source: "test|source!*",
            Name: "born:P(|1>)",
            Value: 0.64,
            Norm: 1.0,
            Support: 2,
            Sequence: 42n,
        };
        const payload = encode(original);
        // Let's assert format
        expect(payload).toContain("zeta-reticulum-observable/v1");
        expect(payload).toContain("room=salon");
        expect(payload).toContain("source=test%7Csource%21%2A"); // Custom RFC 3986 check matching F#
        const decoded = decode(payload);
        expect(decoded.ok).toBe(true);
        if (decoded.ok) {
            expect(decoded.value).toEqual(original);
        }
    });
    test("decode returns malformed error for invalid schema or fields", () => {
        const res1 = decode("not-a-reticulum-observable");
        expect(res1.ok).toBe(false);
        if (!res1.ok) {
            expect(res1.error.reason).toBe("schema");
        }
        const res2 = decode("zeta-reticulum-observable/v1|room=salon|source=test");
        expect(res2.ok).toBe(false);
    });
    test("cross-check transcript rows map and serialize cleanly", () => {
        let sequence = 0n;
        for (const batch of treatyTranscript.batches) {
            for (const delta of batch.deltas) {
                const obs = ofQuantumObservableRow("test-source", sequence, delta.row);
                expect(obs.Source).toBe("test-source");
                expect(obs.Sequence).toBe(sequence);
                const payload = encode(obs);
                const decoded = decode(payload);
                expect(decoded.ok).toBe(true);
                if (decoded.ok) {
                    expect(decoded.value.Room).toBe(obs.Room);
                    expect(decoded.value.Source).toBe(obs.Source);
                    expect(decoded.value.Name).toBe(obs.Name);
                    expect(decoded.value.Value).toBeCloseTo(obs.Value, 5);
                    expect(decoded.value.Norm).toBeCloseTo(obs.Norm, 5);
                    expect(decoded.value.Support).toBe(obs.Support);
                    expect(decoded.value.Sequence).toBe(obs.Sequence);
                }
                sequence++;
            }
        }
    });
    test("delta golden vectors are byte-locked against the F# Reticulum encoder", () => {
        expect(deltaTreaty.schema).toBe("zeta.reticulum.quantum-observable-delta-vectors.v1");
        expect(deltaTreaty.packetSchema).toBe("zeta-reticulum-quantum-observable-delta/v1");
        expect(deltaTreaty.vectors.length).toBeGreaterThanOrEqual(9);
        for (const vector of deltaTreaty.vectors) {
            const decoded = decodeDelta(vector.payload);
            expect(decoded.ok).toBe(true);
            if (!decoded.ok) {
                continue;
            }
            expect(decoded.value.source).toBe(vector.source);
            expect(decoded.value.sequence).toBe(vector.sequence);
            expect(rowId(decoded.value.row)).toBe(vector.rowId);
            expect(decoded.value.weight).toBe(vector.weight);
            expect(encodeDelta(decoded.value)).toBe(vector.payload);
            const lifted = ofQuantumObservableDelta(vector.source, vector.sequence, {
                row: decoded.value.row,
                weight: vector.weight,
            });
            expect(encodeDelta(lifted)).toBe(vector.payload);
        }
    });
    test("delta golden vectors replay DBSP retractions", () => {
        const vectorsByName = new Map(deltaTreaty.vectors.map((vector) => [vector.name, vector]));
        const decoded = deltaTreaty.retractionScenario.vectorNames.map((name) => {
            const vector = vectorsByName.get(name);
            expect(vector).toBeDefined();
            if (vector === undefined) {
                throw new Error(`missing vector ${name}`);
            }
            const result = decodeDelta(vector.payload);
            expect(result.ok).toBe(true);
            if (!result.ok) {
                throw new Error(result.error.reason);
            }
            return result.value;
        });
        const consolidated = consolidateQuantumObservableDeltas(decoded);
        expect(consolidated.map((delta) => rowId(delta.row))).toEqual([...deltaTreaty.retractionScenario.expectedRowIds]);
        expect(consolidated.map((delta) => delta.weight)).toEqual([1]);
    });
    test("flow-bit rows survive the Reticulum delta codec", () => {
        const row = {
            type: "FlowBitDistinction",
            value: {
                Id: "external-bit-one",
                Operation: "Zeta.ReferenceOracle.ApplyExternalBitDistinguishOne",
                ExternalBit: true,
                Probabilities: { Zero: 0, One: 1 },
            },
        };
        const payload = encodeDelta({
            source: "qsharp-flow-bit",
            sequence: 7,
            row,
            weight: 1,
        });
        const decoded = decodeDelta(payload);
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) {
            throw new Error(decoded.error.reason);
        }
        expect(decoded.value.row).toEqual(row);
        expect(decoded.value.weight).toBe(1);
    });
    test("delta decode returns malformed error for invalid schema", () => {
        const decoded = decodeDelta('{"schema":"wrong","delta":{}}');
        expect(decoded.ok).toBe(false);
        if (!decoded.ok) {
            expect(decoded.error.reason).toBe("schema");
        }
    });
});
