/**
 * Public adjudication-parser controls — valid local teaching is rendered; mismatched or incoherent inputs are rejected.
 */
import { describe, expect, test } from "bun:test";
import { parseLocalWitnessAdjudication, parseLocalWitnessAdjudicationReference } from "./room-witness-adjudication";

const eventId = "59e83513bb0123e733f549982610cdc9";
const expected = {
  eventId,
  auditContentKey: "c7fa6cae0e0d96a21ef34d9314404fb5",
  receiptContentKey: "359d5d330f2813c1613d21e46b7445d8",
};

function unresolvedRecord() {
  return {
    schema: "zeta.room-witness-adjudication.v1",
    prior: expected,
    witnessRefs: [],
    authority: "unresolved",
    disposition: "request-local-witness",
    teaching: {
      code: "RWA-1",
      lesson: "No local verifier established the genesis binding.",
      nextGenerator: "Request and append a locally verifiable witness atom.",
    },
  };
}

describe("public local witness-adjudication parser", () => {
  test("PWA-1: reads a valid event-bound unresolved teaching record without elevating it to global authority", () => {
    expect(
      parseLocalWitnessAdjudicationReference(
        { file: `adjudications/${eventId}.json`, contentKey: "342b146befc7086d718de9bce9991a39" },
        eventId,
      ),
    ).toEqual({ file: `adjudications/${eventId}.json`, contentKey: "342b146befc7086d718de9bce9991a39" });
    expect(parseLocalWitnessAdjudication(unresolvedRecord(), expected)).toMatchObject({
      authority: "unresolved",
      disposition: "request-local-witness",
      teaching: { code: "RWA-1" },
    });
  });

  test("PWA-2: an event-swapped file reference is rejected before any sidecar is trusted", () => {
    expect(() =>
      parseLocalWitnessAdjudicationReference(
        { file: "adjudications/11d5cf2c2f32f6ccff77d6a6174466d5.json", contentKey: "342b146befc7086d718de9bce9991a39" },
        eventId,
      ),
    ).toThrow("must bind this event ID");
  });

  test("PWA-3: a valid-looking sidecar with a substituted prior cannot assign an authority state to another receipt", () => {
    const mutated = unresolvedRecord();
    mutated.prior = { ...expected, receiptContentKey: "00000000000000000000000000000000" };
    expect(() => parseLocalWitnessAdjudication(mutated, expected)).toThrow("does not bind the discovered envelope");
  });

  test("PWA-4: incompatible unresolved/disputed teaching triples are rejected rather than repaired by the reader", () => {
    const mutated = unresolvedRecord();
    mutated.teaching.code = "RWA-2";
    expect(() => parseLocalWitnessAdjudication(mutated, expected)).toThrow("do not agree");
  });
});
