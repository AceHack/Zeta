import { describe, expect, test } from "bun:test";

import {
  compareAndSwapRevisionPolicy,
  monotoneLastWriterWinsRevisionPolicy,
  type RevisionPolicyPort,
  type RevisionedBytes,
} from "./revision-policy";

function record(nodeId: string, revision: number, payload: readonly number[]): RevisionedBytes {
  return { nodeId, revision, payload: new Uint8Array(payload) };
}

const POLICIES: readonly RevisionPolicyPort[] = [compareAndSwapRevisionPolicy, monotoneLastWriterWinsRevisionPolicy];

describe("revision policy port", () => {
  for (const policy of POLICIES) {
    test(`${policy.id} admits successors and identical retries`, () => {
      const existing = record("node/a", 4, [1, 2, 3]);
      expect(policy.decide(existing, record("node/a", 5, [4]))).toMatchObject({
        ok: true,
        value: { action: "write" },
      });
      expect(policy.decide(existing, record("node/a", 4, [1, 2, 3]))).toMatchObject({
        ok: true,
        value: { action: "idempotent" },
      });
    });

    test(`${policy.id} refuses regressions, forks, and node mismatches`, () => {
      const existing = record("node/a", 4, [1]);
      expect(policy.decide(existing, record("node/a", 3, [1]))).toMatchObject({
        ok: false,
        refusal: { reason: "revision-regression" },
      });
      expect(policy.decide(existing, record("node/a", 4, [2]))).toMatchObject({
        ok: false,
        refusal: { reason: "revision-fork" },
      });
      expect(policy.decide(existing, record("node/b", 5, [2]))).toMatchObject({
        ok: false,
        refusal: { reason: "node-mismatch" },
      });
    });
  }

  test("compare-and-swap requires revision 1 first and refuses gaps", () => {
    expect(compareAndSwapRevisionPolicy.decide(null, record("node/a", 7, [1]))).toMatchObject({
      ok: false,
      refusal: { reason: "first-revision-not-allowed" },
    });
    expect(compareAndSwapRevisionPolicy.decide(record("node/a", 4, [1]), record("node/a", 7, [2]))).toMatchObject({
      ok: false,
      refusal: { reason: "revision-gap" },
    });
  });

  test("monotone last-writer-wins admits nonzero first revisions and gaps", () => {
    expect(monotoneLastWriterWinsRevisionPolicy.decide(null, record("node/a", 7, [1]))).toMatchObject({
      ok: true,
      value: { action: "write" },
    });
    expect(
      monotoneLastWriterWinsRevisionPolicy.decide(record("node/a", 4, [1]), record("node/a", 7, [2])),
    ).toMatchObject({ ok: true, value: { action: "write" } });
  });
});
