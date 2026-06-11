import { describe, expect, test } from "bun:test";
import { encode, decode, ofQuantumObservableRow, type Observable } from "./reticulum-quantum";
import transcript from "./quantum-treaty-transcript.json";
import type { QuantumObservableTranscript } from "./types";

const treatyTranscript = transcript as QuantumObservableTranscript;

describe("ReticulumQuantum symmetry and codec", () => {
  test("encode and decode are symmetric", () => {
    const original: Observable = {
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
});
