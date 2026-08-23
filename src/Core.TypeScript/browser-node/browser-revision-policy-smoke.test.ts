import { describe, expect, test } from "bun:test";
import {
  BROWSER_REVISION_POLICY_SMOKE_SCHEMA,
  validateBrowserRevisionPolicyTranscript,
  type BrowserRevisionPolicySmokeTranscript,
  type BrowserRevisionPolicyTranscript,
} from "./browser-revision-policy-smoke";
import type { RevisionPolicyId } from "../persistence/revision-policy";

const accepted = (revision: number) => ({ outcome: "accepted" as const, revision, code: null });
const refused = () => ({ outcome: "refused" as const, revision: null, code: "checkpoint-revision-conflict" });

function policyTranscript(policyId: RevisionPolicyId): BrowserRevisionPolicyTranscript {
  const compareAndSwap = policyId === "compare-and-swap";
  return {
    policyId,
    injection: compareAndSwap ? "explicit" : "default",
    reportedPolicyId: policyId,
    initial: accepted(1),
    concurrentFork: {
      accepted: 1,
      refused: 1,
      refusalCodes: ["checkpoint-revision-conflict"],
      durableRevision: 2,
      replicasAgree: true,
    },
    idempotent: accepted(2),
    stale: refused(),
    leapfrog: compareAndSwap ? refused() : accepted(4),
    removedThroughFour: true,
    recreateAtSeven: compareAndSwap ? refused() : accepted(7),
    revisionOneAfterRecreate: compareAndSwap ? accepted(1) : refused(),
    finalRevision: compareAndSwap ? 1 : 7,
    finalReplicasAgree: true,
    closedPorts: 2,
  };
}

function validTranscript(): BrowserRevisionPolicySmokeTranscript {
  return {
    schema: BROWSER_REVISION_POLICY_SMOKE_SCHEMA,
    policies: [policyTranscript("compare-and-swap"), policyTranscript("monotone-last-writer-wins")],
  };
}

describe("browser revision-policy smoke transcript", () => {
  test("accepts the shared laws and the two intentional policy differences", () => {
    expect(validateBrowserRevisionPolicyTranscript(validTranscript())).toEqual([]);
  });

  test("rejects a compare-and-swap implementation that admits a revision gap", () => {
    const transcript = validTranscript();
    const compareAndSwap = policyTranscript("compare-and-swap");
    const falsified: BrowserRevisionPolicySmokeTranscript = {
      ...transcript,
      policies: [{ ...compareAndSwap, leapfrog: accepted(4) }, ...transcript.policies.slice(1)],
    };

    expect(validateBrowserRevisionPolicyTranscript(falsified)).toContain(
      "Compare-and-swap admitted revision 4 after revision 2.",
    );
  });

  test("rejects a one-policy matrix instead of passing vacuously", () => {
    const transcript = validTranscript();
    const compareAndSwap = policyTranscript("compare-and-swap");

    expect(validateBrowserRevisionPolicyTranscript({ ...transcript, policies: [compareAndSwap] })).toContain(
      "The monotone-last-writer-wins policy is absent from the matrix.",
    );
  });
});
