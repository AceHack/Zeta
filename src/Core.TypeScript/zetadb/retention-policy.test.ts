import { describe, expect, test } from "bun:test";
import fc from "fast-check";

import {
  canonicalCheckpointByteRetentionPolicy,
  canonicalEventIdRetentionPolicy,
  evaluateZetaDbRetentionPolicy,
  noForgetBackpressureRetentionPolicy,
  type ZetaDbRetentionPolicyPort,
} from "./retention-policy";

function applyBatches(
  policy: ZetaDbRetentionPolicyPort,
  batches: readonly (readonly string[])[],
  limit: number,
): { readonly retained: readonly string[]; readonly displaced: readonly string[] } | null {
  let current: readonly string[] = [];
  const displaced: string[] = [];
  for (const candidateEventIds of batches) {
    const result = evaluateZetaDbRetentionPolicy(policy, { currentEventIds: current, candidateEventIds, limit });
    if (!result.ok) return null;
    current = result.value.retainedEventIds;
    displaced.push(...result.value.displacedEventIds);
  }
  return { retained: current, displaced };
}

describe("ZetaDB retention policy port", () => {
  test("no-forget preserves admitted history and reports only cold refusals", () => {
    expect(
      evaluateZetaDbRetentionPolicy(noForgetBackpressureRetentionPolicy, {
        currentEventIds: ["e1", "e2"],
        candidateEventIds: ["e2", "e3", "e4"],
        limit: 3,
      }),
    ).toEqual({
      ok: true,
      value: {
        policyId: "no-forget-backpressure",
        resource: "retained-events",
        limit: 3,
        retainedEventIds: ["e1", "e2", "e3"],
        displacedEventIds: [],
        refusedEventIds: ["e4"],
        duplicateEventIds: ["e2"],
        heatReceipts: [],
      },
    });
  });

  test("canonical retention derives heat for every displaced event", () => {
    const result = evaluateZetaDbRetentionPolicy(canonicalEventIdRetentionPolicy, {
      currentEventIds: ["e3", "e4"],
      candidateEventIds: ["e1", "e2"],
      limit: 3,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        policyId: "canonical-event-id",
        resource: "retained-events",
        limit: 3,
        retainedEventIds: ["e1", "e2", "e3"],
        displacedEventIds: ["e4"],
        refusedEventIds: [],
        duplicateEventIds: [],
        heatReceipts: [
          {
            code: "database-retention-displaced",
            signal: "forgotten",
            kind: "database-retention.forgotten",
            policyId: "canonical-event-id",
            resource: "retained-events",
            limit: 3,
            units: 1,
            displacedEventIds: ["e4"],
            detail: "Retention policy canonical-event-id displaced 1 retained event(s).",
          },
        ],
      },
    });
  });

  test("canonical retention closes the maxEntries BIND witness while no-forget stays order-dependent", () => {
    const batchA = ["e1", "e2"];
    const batchB = ["e3", "e4"];
    const canonicalForward = applyBatches(canonicalEventIdRetentionPolicy, [batchA, batchB], 3);
    const canonicalReverse = applyBatches(canonicalEventIdRetentionPolicy, [batchB, batchA], 3);
    const noForgetForward = applyBatches(noForgetBackpressureRetentionPolicy, [batchA, batchB], 3);
    const noForgetReverse = applyBatches(noForgetBackpressureRetentionPolicy, [batchB, batchA], 3);

    expect(canonicalForward?.retained).toEqual(["e1", "e2", "e3"]);
    expect(canonicalReverse?.retained).toEqual(canonicalForward?.retained);
    expect(canonicalReverse?.displaced).toEqual(["e4"]);
    expect(noForgetForward?.retained).toEqual(["e1", "e2", "e3"]);
    expect(noForgetReverse?.retained).toEqual(["e1", "e3", "e4"]);
  });

  test("canonical retained IDs are invariant under candidate permutation", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 24 }),
        fc.integer({ min: 1, max: 24 }),
        (eventIds, requestedLimit) => {
          const limit = Math.min(requestedLimit, eventIds.length);
          const forward = evaluateZetaDbRetentionPolicy(canonicalEventIdRetentionPolicy, {
            currentEventIds: [],
            candidateEventIds: eventIds,
            limit,
          });
          const reverse = evaluateZetaDbRetentionPolicy(canonicalEventIdRetentionPolicy, {
            currentEventIds: [],
            candidateEventIds: [...eventIds].reverse(),
            limit,
          });
          return forward.ok && reverse.ok && JSON.stringify(forward.value) === JSON.stringify(reverse.value);
        },
      ),
      { numRuns: 300 },
    );
  });

  test("canonical byte retention skips oversized IDs using the kernel measurement capability", () => {
    const sizes = new Map([
      ["e1", 3],
      ["e2", 1],
      ["e3", 1],
    ]);
    const result = evaluateZetaDbRetentionPolicy(
      canonicalCheckpointByteRetentionPolicy,
      {
        currentEventIds: ["e3"],
        candidateEventIds: ["e1", "e2"],
        limit: 3,
      },
      {
        maxCheckpointBytes: 2,
        measureCheckpointBytes: (retainedEventIds) =>
          retainedEventIds.reduce((total, eventId) => total + (sizes.get(eventId) ?? 100), 0),
      },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        policyId: "canonical-checkpoint-byte",
        resource: "checkpoint-bytes",
        limit: 2,
        retainedEventIds: ["e2", "e3"],
        displacedEventIds: [],
        refusedEventIds: ["e1"],
        duplicateEventIds: [],
        heatReceipts: [],
      },
    });
  });

  test("canonical byte retention is invariant under candidate permutation", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 24 }),
        fc.integer({ min: 1, max: 24 }),
        fc.integer({ min: 1, max: 160 }),
        (eventIds, requestedLimit, maxCheckpointBytes) => {
          const limit = Math.min(requestedLimit, eventIds.length);
          const checkpointContext = {
            maxCheckpointBytes,
            measureCheckpointBytes: (retainedEventIds: readonly string[]): number =>
              retainedEventIds.reduce((total, eventId) => total + new TextEncoder().encode(eventId).byteLength, 0),
          };
          const forward = evaluateZetaDbRetentionPolicy(
            canonicalCheckpointByteRetentionPolicy,
            { currentEventIds: [], candidateEventIds: eventIds, limit },
            checkpointContext,
          );
          const reverse = evaluateZetaDbRetentionPolicy(
            canonicalCheckpointByteRetentionPolicy,
            { currentEventIds: [], candidateEventIds: [...eventIds].reverse(), limit },
            checkpointContext,
          );
          return forward.ok && reverse.ok && JSON.stringify(forward.value) === JSON.stringify(reverse.value);
        },
      ),
      { numRuns: 300 },
    );
  });

  test("returns typed feedback for invalid proposals and hostile policies", () => {
    expect(
      evaluateZetaDbRetentionPolicy(canonicalEventIdRetentionPolicy, {
        currentEventIds: ["e1", "e1"],
        candidateEventIds: [],
        limit: 1,
      }),
    ).toMatchObject({ ok: false, feedback: { code: "database-retention-request-invalid" } });

    const throwing: ZetaDbRetentionPolicyPort = {
      id: "throwing",
      resource: "retained-events",
      plan: () => {
        throw new Error("boom");
      },
    };
    expect(
      evaluateZetaDbRetentionPolicy(throwing, {
        currentEventIds: [],
        candidateEventIds: ["e1"],
        limit: 1,
      }),
    ).toMatchObject({ ok: false, feedback: { code: "database-retention-policy-failed" } });

    const invented: ZetaDbRetentionPolicyPort = {
      id: "invented",
      resource: "retained-events",
      plan: () => ({ retainedEventIds: ["never-observed"] }),
    };
    expect(
      evaluateZetaDbRetentionPolicy(invented, {
        currentEventIds: [],
        candidateEventIds: ["e1"],
        limit: 1,
      }),
    ).toMatchObject({ ok: false, feedback: { code: "database-retention-policy-failed" } });

    const oversized: ZetaDbRetentionPolicyPort = {
      id: "oversized",
      resource: "checkpoint-bytes",
      plan: (proposal) => ({ retainedEventIds: [...proposal.candidateEventIds] }),
    };
    const byteProposal = {
      currentEventIds: [],
      candidateEventIds: ["e1"],
      limit: 1,
    } as const;
    expect(evaluateZetaDbRetentionPolicy(oversized, byteProposal)).toMatchObject({
      ok: false,
      feedback: { code: "database-retention-request-invalid" },
    });
    expect(
      evaluateZetaDbRetentionPolicy(oversized, byteProposal, {
        maxCheckpointBytes: 1,
        measureCheckpointBytes: (retainedEventIds) => retainedEventIds.length * 2,
      }),
    ).toMatchObject({ ok: false, feedback: { code: "database-retention-policy-failed" } });

    const unreadable: ZetaDbRetentionPolicyPort = {
      id: "unreadable",
      get resource(): "retained-events" {
        throw new Error("resource getter failed");
      },
      plan: () => ({ retainedEventIds: [] }),
    };
    expect(evaluateZetaDbRetentionPolicy(unreadable, byteProposal)).toMatchObject({
      ok: false,
      feedback: { code: "database-retention-policy-failed" },
    });
  });
});
