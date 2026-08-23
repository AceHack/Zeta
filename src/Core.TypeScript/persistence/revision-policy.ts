export interface RevisionedBytes {
  readonly nodeId: string;
  readonly revision: number;
  readonly payload: Uint8Array;
}

export type RevisionPolicyId = "compare-and-swap" | "monotone-last-writer-wins";

export type RevisionPolicyRefusal =
  | {
      readonly reason: "node-mismatch";
      readonly detail: string;
    }
  | {
      readonly reason: "first-revision-not-allowed" | "revision-regression" | "revision-gap" | "revision-fork";
      readonly detail: string;
    };

export type RevisionPolicyDecision<T extends RevisionedBytes> =
  | { readonly action: "write"; readonly record: T }
  | { readonly action: "idempotent"; readonly record: T };

export type RevisionPolicyResult<T extends RevisionedBytes> =
  | { readonly ok: true; readonly value: RevisionPolicyDecision<T> }
  | { readonly ok: false; readonly refusal: RevisionPolicyRefusal };

/** Pure policy port. The persistence adapter remains responsible for atomic application. */
export interface RevisionPolicyPort {
  /** Stable diagnostic identity; callers execute `decide` instead of branching on this value. */
  readonly id: RevisionPolicyId;
  decide<T extends RevisionedBytes>(existing: T | null, candidate: T): RevisionPolicyResult<T>;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function refused(reason: RevisionPolicyRefusal["reason"], detail: string): RevisionPolicyResult<never> {
  return { ok: false, refusal: { reason, detail } };
}

function compareExisting<T extends RevisionedBytes>(existing: T, candidate: T): RevisionPolicyResult<T> | null {
  if (existing.nodeId !== candidate.nodeId) {
    return refused(
      "node-mismatch",
      `Stored revision node ${existing.nodeId} does not match candidate node ${candidate.nodeId}.`,
    );
  }
  if (candidate.revision < existing.revision) {
    return refused(
      "revision-regression",
      `Revision ${String(candidate.revision)} is older than stored revision ${String(existing.revision)}.`,
    );
  }
  if (candidate.revision !== existing.revision) return null;
  return sameBytes(candidate.payload, existing.payload)
    ? { ok: true, value: { action: "idempotent", record: candidate } }
    : refused("revision-fork", `Revision ${String(candidate.revision)} already names different bytes.`);
}

export const compareAndSwapRevisionPolicy: RevisionPolicyPort = {
  id: "compare-and-swap",
  decide: <T extends RevisionedBytes>(existing: T | null, candidate: T): RevisionPolicyResult<T> => {
    if (existing === null) {
      return candidate.revision === 1
        ? { ok: true, value: { action: "write", record: candidate } }
        : refused("first-revision-not-allowed", `The first revision must be 1, not ${String(candidate.revision)}.`);
    }
    const shared = compareExisting(existing, candidate);
    if (shared !== null) return shared;
    return candidate.revision === existing.revision + 1
      ? { ok: true, value: { action: "write", record: candidate } }
      : refused(
          "revision-gap",
          `Revision ${String(candidate.revision)} cannot follow stored revision ${String(existing.revision)}.`,
        );
  },
};

export const monotoneLastWriterWinsRevisionPolicy: RevisionPolicyPort = {
  id: "monotone-last-writer-wins",
  decide: <T extends RevisionedBytes>(existing: T | null, candidate: T): RevisionPolicyResult<T> => {
    if (existing === null) return { ok: true, value: { action: "write", record: candidate } };
    const shared = compareExisting(existing, candidate);
    return shared ?? { ok: true, value: { action: "write", record: candidate } };
  },
};
