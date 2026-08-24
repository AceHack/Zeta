import { describe, expect, test } from "bun:test";

import { createReservedCapacityAdmissionPolicy, noForgetBackpressureAdmissionPolicy } from "./admission-policy";

describe("ZetaDB admission policy port", () => {
  test("admits proposals exactly at both finite bounds", () => {
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "retained-events",
        current: 2,
        candidate: 3,
        limit: 3,
      }),
    ).toEqual({ action: "admit" });
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "checkpoint-bytes",
        current: 511,
        candidate: 512,
        limit: 512,
      }),
    ).toEqual({ action: "admit" });
  });

  test("refuses entry growth without displacing retained events", () => {
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "retained-events",
        current: 3,
        candidate: 4,
        limit: 3,
      }),
    ).toEqual({
      action: "backpressure",
      detail: "The retained event ledger reached its 3-entry no-forget budget.",
      accounting: {
        resource: "retained-events",
        current: 3,
        candidate: 4,
        hardLimit: 3,
        effectiveLimit: 3,
        reserved: 0,
      },
    });
  });

  test("reports the candidate checkpoint size when its byte bound is crossed", () => {
    expect(
      noForgetBackpressureAdmissionPolicy.decide({
        resource: "checkpoint-bytes",
        current: 480,
        candidate: 529,
        limit: 512,
      }),
    ).toEqual({
      action: "backpressure",
      detail: "The next database image needs 529 bytes; the no-forget checkpoint budget is 512 bytes.",
      accounting: {
        resource: "checkpoint-bytes",
        current: 480,
        candidate: 529,
        hardLimit: 512,
        effectiveLimit: 512,
        reserved: 0,
      },
    });
  });

  test("reserves entry and byte headroom with exact accounting", () => {
    const created = createReservedCapacityAdmissionPolicy({ retainedEvents: 1, checkpointBytes: 128 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.decide({ resource: "retained-events", current: 1, candidate: 2, limit: 3 })).toEqual({
      action: "admit",
    });
    expect(created.value.decide({ resource: "retained-events", current: 2, candidate: 3, limit: 3 })).toEqual({
      action: "backpressure",
      detail: "The reserved-capacity policy held 1 entries; candidate 3 exceeds the effective limit 2 of 3.",
      accounting: {
        resource: "retained-events",
        current: 2,
        candidate: 3,
        hardLimit: 3,
        effectiveLimit: 2,
        reserved: 1,
      },
    });
    expect(created.value.decide({ resource: "checkpoint-bytes", current: 383, candidate: 384, limit: 512 })).toEqual({
      action: "admit",
    });
    expect(created.value.decide({ resource: "checkpoint-bytes", current: 384, candidate: 385, limit: 512 })).toEqual({
      action: "backpressure",
      detail: "The reserved-capacity policy held 128 bytes; candidate 385 exceeds the effective limit 384 of 512.",
      accounting: {
        resource: "checkpoint-bytes",
        current: 384,
        candidate: 385,
        hardLimit: 512,
        effectiveLimit: 384,
        reserved: 128,
      },
    });
  });

  test("caps an oversized reservation at the caller's hard limit", () => {
    const created = createReservedCapacityAdmissionPolicy({ retainedEvents: 99, checkpointBytes: 0 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(created.value.decide({ resource: "retained-events", current: 0, candidate: 1, limit: 3 })).toMatchObject({
      action: "backpressure",
      accounting: { hardLimit: 3, effectiveLimit: 0, reserved: 3 },
    });
  });

  test("returns typed feedback for invalid reservation configuration", () => {
    for (const invalid of [
      { retainedEvents: -1, checkpointBytes: 0 },
      { retainedEvents: 0.5, checkpointBytes: 0 },
      { retainedEvents: 0, checkpointBytes: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      expect(createReservedCapacityAdmissionPolicy(invalid)).toEqual({
        ok: false,
        feedback: {
          code: "database-admission-policy-configuration-invalid",
          detail: "Reserved database capacity requires non-negative safe-integer entry and byte amounts.",
        },
      });
    }
  });

  test("is deterministic for repeated proposals", () => {
    const created = createReservedCapacityAdmissionPolicy({ retainedEvents: 2, checkpointBytes: 64 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const proposal = { resource: "checkpoint-bytes" as const, current: 430, candidate: 449, limit: 512 };

    expect(created.value.decide(proposal)).toEqual(created.value.decide(proposal));
  });
});
