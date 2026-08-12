import { describe, expect, test } from "bun:test";
import {
  appendSocietyEventEvidence,
  emptySocietyEventIndex,
  validateSocietyEventIndex,
} from "./society-event-index";

function evidence(id: string, eventText = `{"id":"${id}","kind":"evolution"}`) {
  return {
    id,
    at: "2026-08-12T00:00:00.000Z",
    file: `${id}.json`,
    eventText,
    sourceRevision: "0123456789abcdef0123456789abcdef01234567",
  };
}

describe("SocietyEventIndex", () => {
  test("SEI-1: appending committed event evidence creates a valid hash chain", () => {
    const first = appendSocietyEventEvidence(emptySocietyEventIndex(), evidence("society-a"));
    const second = appendSocietyEventEvidence(first, evidence("society-b"));
    validateSocietyEventIndex(second);
    expect(second.eventCount).toBe(2);
    expect(second.events[1]!.previousDigest).toBe(second.events[0]!.chainDigest);
    expect(second.headDigest).toBe(second.events[1]!.chainDigest);
  });

  test("SEI-2: retrying exact committed evidence is idempotent", () => {
    const first = appendSocietyEventEvidence(emptySocietyEventIndex(), evidence("society-a"));
    const retried = appendSocietyEventEvidence(first, evidence("society-a"));
    expect(retried).toBe(first);
  });

  test("SEI-3 FAULT INJECTION: changing an event digest breaks independent validation", () => {
    const index = appendSocietyEventEvidence(emptySocietyEventIndex(), evidence("society-a"));
    const entry = index.events[0]!;
    const tampered = {
      ...index,
      events: [{ ...entry, eventDigest: "f".repeat(64) }],
    };
    expect(() => validateSocietyEventIndex(tampered)).toThrow("chain digest");
  });

  test("SEI-4 FAULT INJECTION: conflicting duplicate id cannot overwrite prior evidence", () => {
    const index = appendSocietyEventEvidence(emptySocietyEventIndex(), evidence("society-a"));
    expect(() => appendSocietyEventEvidence(index, evidence("society-a", "{\"changed\":true}"))).toThrow("conflicting");
  });

  test("SEI-5 FAULT INJECTION: swapped entries break the predecessor link", () => {
    const first = appendSocietyEventEvidence(emptySocietyEventIndex(), evidence("society-a"));
    const index = appendSocietyEventEvidence(first, evidence("society-b"));
    const tampered = { ...index, events: [index.events[1]!, index.events[0]!] };
    expect(() => validateSocietyEventIndex(tampered)).toThrow("predecessor link");
  });
});
