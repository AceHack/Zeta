/**
 * key-custody.test.ts — acceptance criteria tests (clean-room derivation B).
 *
 * Each test maps to one acceptance criterion from the spec.
 * Per Otto's caution: break the implementation and confirm red.
 */

import { describe, test, expect } from "bun:test";
import {
  isGrantLive,
  authorize,
  rotateKey,
  verifyAgainstSlots,
  validateTransfer,
  selfIssueCredential,
  foldEvents,
  evaluateForkRead,
  isKeyValidPostFork,
  tryIssueGrant,
  describeGrantError,
  MAX_GRANT_SPAN_PHASES,
  type KeySlots,
  type KeyDescriptor,
  type Grant,
  type CustodyTransfer,
  type CustodyFork,
  type WitnessStake,
  type CustodyEvent,
  type ContentDag,
  type ContentNode,
} from "./key-custody";

function makeKey(id: string, principal: string, phase: number): KeyDescriptor {
  return { id, class: "node", owner: { principalId: principal, since: phase }, publicKey: `pub-${id}` };
}

/**
 * Test helper: a `Grant` can no longer be written as an object literal (the
 * brand is what enforces R8's ceiling), so tests go through the constructor
 * and assert the happy path succeeded.
 */
function makeGrant(id: string, principalId: string, capability: string, issuedAtPhase: number, expiresAtPhase: number): Grant {
  const result = tryIssueGrant({ id, principalId, capability, issuedAtPhase, expiresAtPhase });
  if (!result.ok) throw new Error(`test fixture is not a valid grant: ${describeGrantError(result.error)}`);
  return result.value;
}

// ═══ Acceptance 1: grant stops at expiry with no revocation message ══════════

describe("Acceptance 1: time-bounded grants expire without coordination", () => {
  test("grant is live before expiry", () => {
    const grant = makeGrant("g1", "alice", "read", 10, 20);
    expect(isGrantLive(grant, 15)).toBe(true);
  });

  test("grant is dead at expiry phase — NO revocation message needed", () => {
    const grant = makeGrant("g1", "alice", "read", 10, 20);
    expect(isGrantLive(grant, 20)).toBe(false); // expires AT 20, not after
  });

  test("grant is dead after expiry — no message sent, still expired", () => {
    const grant = makeGrant("g1", "alice", "read", 10, 20);
    expect(isGrantLive(grant, 100)).toBe(false);
  });

  test("authorize explains WHY it denied (R12)", () => {
    const grant = makeGrant("g1", "alice", "read", 10, 20);
    const decision = authorize([grant], "read", "alice", 25);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("expired at phase 20");
  });
});

// ═══ Acceptance 2: previous-signed material verifiable for stated window ═════

describe("Acceptance 2: rotation leaves previous verifiable for bounded window", () => {
  test("previous key accepted within the window", () => {
    const slots: KeySlots = {
      previous: makeKey("old", "alice", 1),
      current: makeKey("cur", "alice", 10),
      next: makeKey("nxt", "alice", 10),
      previousExpiresAtPhase: 15,
    };
    const result = verifyAgainstSlots(slots, "old", 12);
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("previous key");
  });

  test("previous key REJECTED after the window — no coordination needed", () => {
    const slots: KeySlots = {
      previous: makeKey("old", "alice", 1),
      current: makeKey("cur", "alice", 10),
      next: makeKey("nxt", "alice", 10),
      previousExpiresAtPhase: 15,
    };
    const result = verifyAgainstSlots(slots, "old", 16);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("expired at phase 15");
  });

  test("current key always accepted", () => {
    const slots: KeySlots = {
      previous: null,
      current: makeKey("cur", "alice", 10),
      next: null,
      previousExpiresAtPhase: null,
    };
    expect(verifyAgainstSlots(slots, "cur", 999).allowed).toBe(true);
  });

  test("next key NOT accepted (not yet active)", () => {
    const slots: KeySlots = {
      previous: null,
      current: makeKey("cur", "alice", 10),
      next: makeKey("nxt", "alice", 10),
      previousExpiresAtPhase: null,
    };
    const result = verifyAgainstSlots(slots, "nxt", 11);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not yet active");
  });
});

// ═══ Acceptance 3: custody fork preserves prior access, blocks post-fork ═════
//
// This block previously asserted `expect(fork.priorCustodianRetainsPreFork)
// .toBe(true)` on a field typed as the literal `true`. That assertion passed
// for every input that type-checked — `false` was not assignable, so no
// counterexample could even be written. It was the vacuity class: a check
// that cannot fail is not a check (spec amendment A4).
//
// The named observable is now `evaluateForkRead`, and the two inputs that
// make its output differ are a pre-fork ref and a post-fork ref.
//
//   g0 ── g1 ── g2(ancestorRef) ── b1 ── b2      (b* = new custodian's branch)

const preForkLineage: ContentDag = new Map<string, ContentNode>([
  ["g0", { ref: "g0", parents: [] }],
  ["g1", { ref: "g1", parents: ["g0"] }],
  ["g2", { ref: "g2", parents: ["g1"] }],
  ["b1", { ref: "b1", parents: ["g2"] }],
  ["b2", { ref: "b2", parents: ["b1"] }],
]);

function makeFork(): CustodyFork {
  return {
    ancestorRef: "g2",
    newCustodian: { principalId: "bob", since: 50 },
    priorCustodian: { principalId: "alice", since: 1 },
    keysInvalidatedPostFork: ["key-alice-1", "key-alice-2"],
  };
}

describe("Acceptance 3: custody fork — prior reads pre-fork, cannot read post-fork", () => {
  test("prior custodian CAN read pre-fork content (R3 — transfer is non-destructive)", () => {
    const decision = evaluateForkRead(makeFork(), preForkLineage, "alice", "g1");
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toContain("retains pre-fork");
  });

  test("prior custodian CAN read the fork point itself (ancestor-or-SELF)", () => {
    expect(evaluateForkRead(makeFork(), preForkLineage, "alice", "g2").allowed).toBe(true);
  });

  test("THE INPUT IT MUST REJECT: prior custodian CANNOT read post-fork content (R4)", () => {
    const decision = evaluateForkRead(makeFork(), preForkLineage, "alice", "b1");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("post-fork");
  });

  test("post-fork denial holds deeper down the new custodian's branch", () => {
    expect(evaluateForkRead(makeFork(), preForkLineage, "alice", "b2").allowed).toBe(false);
  });

  test("new custodian CAN read their own post-fork branch", () => {
    expect(evaluateForkRead(makeFork(), preForkLineage, "bob", "b2").allowed).toBe(true);
  });

  test("a stranger is denied on both sides of the boundary", () => {
    expect(evaluateForkRead(makeFork(), preForkLineage, "mallory", "g1").allowed).toBe(false);
    expect(evaluateForkRead(makeFork(), preForkLineage, "mallory", "b2").allowed).toBe(false);
  });

  test("unknown content ref is DENIED — unknown is not permissive", () => {
    const decision = evaluateForkRead(makeFork(), preForkLineage, "alice", "no-such-ref");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("not present in the supplied lineage");
  });

  test("the decision is driven by lineage, not by the reader's name", () => {
    // Same reader, same fork, two refs — opposite outcomes. If this pair ever
    // agrees, the function has stopped discriminating and AC#3 is vacuous again.
    const fork = makeFork();
    const pre = evaluateForkRead(fork, preForkLineage, "alice", "g0").allowed;
    const post = evaluateForkRead(fork, preForkLineage, "alice", "b1").allowed;
    expect(pre).not.toBe(post);
  });

  test("R4 key half: an invalidated key does not verify post-fork", () => {
    const fork = makeFork();
    expect(isKeyValidPostFork(fork, "key-alice-1").allowed).toBe(false);
    expect(isKeyValidPostFork(fork, "key-bob-1").allowed).toBe(true);
  });

  test("cyclic lineage input terminates and denies rather than hanging", () => {
    const cyclic: ContentDag = new Map<string, ContentNode>([
      ["x", { ref: "x", parents: ["y"] }],
      ["y", { ref: "y", parents: ["x"] }],
    ]);
    const fork: CustodyFork = {
      ancestorRef: "x",
      newCustodian: { principalId: "bob", since: 50 },
      priorCustodian: { principalId: "alice", since: 1 },
      keysInvalidatedPostFork: [],
    };
    expect(evaluateForkRead(fork, cyclic, "alice", "z").allowed).toBe(false);
  });
});

// ═══ Acceptance 4: custody transfer CANNOT complete without witness stake ════
//
// The combine doc recorded that `validateTransfer` "cannot return
// allowed: false for any CustodyTransfer that type-checks". Checking that by
// construction found it was an over-statement, and found the real hole:
//
//   !transfer.witness            UNREACHABLE — `undefined` not assignable
//   !transfer.witness.voluntary  UNREACHABLE — `false` not assignable to `true`
//   !transfer.witness.resource   REACHABLE   — `resource: ""` type-checks
//
// So one guard was live. What NOTHING checked was whether the witness was a
// party OTHER than the two transacting — alice witnessing her own transfer
// away, and bob witnessing the transfer to himself, both returned allowed.
// That is the one-sided transfer R10 exists to prevent.

function makeTransfer(witness: WitnessStake): CustodyTransfer {
  return {
    fork: {
      ancestorRef: "ref-1",
      newCustodian: { principalId: "bob", since: 100 },
      priorCustodian: { principalId: "alice", since: 1 },
      keysInvalidatedPostFork: ["k1"],
    },
    witness,
    events: [],
  };
}

describe("Acceptance 4: the witness must be a distinct, willing third party", () => {
  test("THE HOLE: the prior custodian cannot witness her own transfer away", () => {
    const decision = validateTransfer(
      makeTransfer({ witnessId: "alice", resource: "reputation", voluntary: true, attestedAtPhase: 100 }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("prior custodian");
  });

  test("THE HOLE: the beneficiary cannot witness the transfer to himself", () => {
    const decision = validateTransfer(
      makeTransfer({ witnessId: "bob", resource: "reputation", voluntary: true, attestedAtPhase: 100 }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("beneficiary");
  });

  test("a genuine third-party witness is accepted (the control)", () => {
    const decision = validateTransfer(
      makeTransfer({ witnessId: "carol", resource: "reputation", voluntary: true, attestedAtPhase: 100 }),
    );
    expect(decision.allowed).toBe(true);
  });

  test("an INVOLUNTARY stake is refused — this guard was dead code before", () => {
    // `voluntary` was typed as the literal `true`, so this input could not be
    // written. A compelled stake must be representable in order to be refused.
    const decision = validateTransfer(
      makeTransfer({ witnessId: "carol", resource: "reputation", voluntary: false, attestedAtPhase: 100 }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("voluntary");
  });

  test("an empty staked resource is refused (the one guard that already worked)", () => {
    const decision = validateTransfer(
      makeTransfer({ witnessId: "carol", resource: "", voluntary: true, attestedAtPhase: 100 }),
    );
    expect(decision.allowed).toBe(false);
  });

  test("whitespace is not a stake", () => {
    const decision = validateTransfer(
      makeTransfer({ witnessId: "carol", resource: "   ", voluntary: true, attestedAtPhase: 100 }),
    );
    expect(decision.allowed).toBe(false);
  });

  test("an unnamed witness is refused", () => {
    const decision = validateTransfer(
      makeTransfer({ witnessId: "  ", resource: "reputation", voluntary: true, attestedAtPhase: 100 }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("name the witness");
  });
});

// ═══ R8 / spec amendment A2: the grant span is bounded, unconstructibly ══════
//
// B carried an `expiresAtPhase` field and called R8 satisfied. But
// `Number.MAX_SAFE_INTEGER` was constructible, so indefinite authority was
// reachable — the capture R8 exists to prevent. A2: "a maximum span MUST be
// stated as a constant, and no public constructor may yield a grant exceeding
// it... indefinite authority is unconstructible through the public surface."
//
// The brand on `Grant` is what makes that true rather than merely intended:
// a `Grant` object literal is now a COMPILE error, so `tryIssueGrant` is the
// only way to obtain one. See the PR body for the tsc output proving it.

describe("R8/A2: indefinite authority is unconstructible", () => {
  test("THE INPUT IT MUST REJECT: a span to MAX_SAFE_INTEGER", () => {
    const result = tryIssueGrant({
      id: "g-forever",
      principalId: "alice",
      capability: "deploy",
      issuedAtPhase: 0,
      expiresAtPhase: Number.MAX_SAFE_INTEGER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("span-exceeds-maximum");
      expect(describeGrantError(result.error)).toContain("exceeds the maximum");
    }
  });

  test("a span one phase over the ceiling is refused", () => {
    const result = tryIssueGrant({
      id: "g-over",
      principalId: "alice",
      capability: "deploy",
      issuedAtPhase: 10,
      expiresAtPhase: 10 + MAX_GRANT_SPAN_PHASES + 1,
    });
    expect(result.ok).toBe(false);
  });

  test("a span exactly at the ceiling is allowed (the boundary is not off by one)", () => {
    const result = tryIssueGrant({
      id: "g-max",
      principalId: "alice",
      capability: "deploy",
      issuedAtPhase: 10,
      expiresAtPhase: 10 + MAX_GRANT_SPAN_PHASES,
    });
    expect(result.ok).toBe(true);
  });

  test("Infinity is refused — it would sail past a naive span comparison", () => {
    const result = tryIssueGrant({
      id: "g-inf",
      principalId: "alice",
      capability: "deploy",
      issuedAtPhase: 0,
      expiresAtPhase: Number.POSITIVE_INFINITY,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("phase-not-finite-integer");
  });

  test("a zero-length or reversed span is refused", () => {
    expect(tryIssueGrant({ id: "g0", principalId: "a", capability: "c", issuedAtPhase: 10, expiresAtPhase: 10 }).ok).toBe(false);
    expect(tryIssueGrant({ id: "g0", principalId: "a", capability: "c", issuedAtPhase: 10, expiresAtPhase: 5 }).ok).toBe(false);
  });

  test("the EVENT STREAM is not a bypass — the fold refuses an over-long grant", () => {
    // A peer that emits an unbounded grant must not smuggle it past the
    // ceiling by having it folded in.
    const events: CustodyEvent[] = [
      { id: "e1", kind: "grant-issued", principalId: "mallory", phase: 0, payload: { grantId: "g-forever", capability: "deploy", expiresAtPhase: Number.MAX_SAFE_INTEGER } },
    ];
    const state = foldEvents(events);
    expect(state.grants.length).toBe(0);
    // and it is REFUSED OUT LOUD, not silently dropped
    expect(state.refusals.length).toBe(1);
    expect(state.refusals[0]!.reason).toContain("exceeds the maximum");
    expect(authorize(state.grants, "deploy", "mallory", 5).allowed).toBe(false);
  });

  test("a bounded grant in the stream is still admitted (the control)", () => {
    const events: CustodyEvent[] = [
      { id: "e1", kind: "grant-issued", principalId: "alice", phase: 0, payload: { grantId: "g-ok", capability: "deploy", expiresAtPhase: 500 } },
    ];
    const state = foldEvents(events);
    expect(state.grants.length).toBe(1);
    expect(state.refusals.length).toBe(0);
  });
});

// ═══ R12: the denial must cite the grant that actually decided it ════════════

describe("R12: authorize cites the correct grant", () => {
  test("THE BUG: with grants expiring at 5 and 100, a denial cites 100 not 5", () => {
    const short = makeGrant("g-short", "alice", "deploy", 0, 5);
    const long = makeGrant("g-long", "alice", "deploy", 0, 100);
    const decision = authorize([short, long], "deploy", "alice", 200);
    expect(decision.allowed).toBe(false);
    // `matching[0]` was the short one — stream order, not relevance.
    expect(decision.reason).toContain("expired at phase 100");
    expect(decision.reason).not.toContain("expired at phase 5");
    expect(decision.grant?.id).toBe("g-long");
  });

  test("the citation does not depend on stream order", () => {
    const short = makeGrant("g-short", "alice", "deploy", 0, 5);
    const long = makeGrant("g-long", "alice", "deploy", 0, 100);
    expect(authorize([long, short], "deploy", "alice", 200).grant?.id).toBe("g-long");
    expect(authorize([short, long], "deploy", "alice", 200).grant?.id).toBe("g-long");
  });

  test("a not-yet-issued grant is not described as 'expired'", () => {
    const future = makeGrant("g-future", "alice", "deploy", 100, 200);
    const decision = authorize([future], "deploy", "alice", 50);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("not yet in force");
    expect(decision.reason).not.toContain("expired");
  });

  test("the denial says how many grants matched when more than one did", () => {
    const a = makeGrant("g-a", "alice", "deploy", 0, 5);
    const b = makeGrant("g-b", "alice", "deploy", 0, 100);
    expect(authorize([a, b], "deploy", "alice", 200).reason).toContain("2 grants matched");
  });

  test("a live grant is still cited as the one that allowed it", () => {
    const live = makeGrant("g-live", "alice", "deploy", 0, 100);
    const decision = authorize([live], "deploy", "alice", 50);
    expect(decision.allowed).toBe(true);
    expect(decision.grant?.id).toBe("g-live");
  });
});

describe("Acceptance 4 (original shape retained)", () => {
  test("valid transfer with witness succeeds", () => {
    const transfer: CustodyTransfer = {
      fork: {
        ancestorRef: "ref-1",
        newCustodian: { principalId: "bob", since: 100 },
        priorCustodian: { principalId: "alice", since: 1 },
        keysInvalidatedPostFork: ["k1"],
      },
      witness: {
        witnessId: "carol",
        resource: "reputation",
        voluntary: true,
        attestedAtPhase: 100,
      },
      events: [],
    };
    const result = validateTransfer(transfer);
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("carol");
    expect(result.reason).toContain("reputation");
  });

  test("transfer WITHOUT witness is rejected", () => {
    const transfer = {
      fork: {
        ancestorRef: "ref-1",
        newCustodian: { principalId: "bob", since: 100 },
        priorCustodian: { principalId: "alice", since: 1 },
        keysInvalidatedPostFork: ["k1"],
      },
      witness: null as unknown as WitnessStake,
      events: [],
    };
    const result = validateTransfer(transfer as CustodyTransfer);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("witness");
  });
});

// ═══ Acceptance 5: replay from empty reproduces same final state ═════════════

describe("Acceptance 5: deterministic replay from empty", () => {
  test("foldEvents produces identical state on replay", () => {
    const events: CustodyEvent[] = [
      { id: "e1", kind: "key-issued", principalId: "alice", phase: 1, payload: { keyId: "k1", class: "node", publicKeyRef: "pub1" } },
      { id: "e2", kind: "key-issued", principalId: "alice", phase: 5, payload: { keyId: "k2", class: "node", publicKeyRef: "pub2" } },
      { id: "e3", kind: "grant-issued", principalId: "alice", phase: 5, payload: { grantId: "g1", capability: "deploy", expiresAtPhase: 50 } },
    ];

    const state1 = foldEvents(events);
    const state2 = foldEvents(events);

    // Same keys
    expect(state1.keys.size).toBe(state2.keys.size);
    expect(state1.keys.get("k1")).toEqual(state2.keys.get("k1"));
    // Same grants
    expect(state1.grants.length).toBe(state2.grants.length);
    expect(state1.grants[0]).toEqual(state2.grants[0]);
    // Same event count
    expect(state1.events.length).toBe(state2.events.length);
  });

  test("fold from empty produces the expected state", () => {
    const events: CustodyEvent[] = [
      { id: "e1", kind: "key-issued", principalId: "node-1", phase: 1, payload: { keyId: "k-node1", class: "node", publicKeyRef: "pub-node1" } },
    ];
    const state = foldEvents(events);
    expect(state.keys.has("k-node1")).toBe(true);
    expect(state.slots.has("node-1")).toBe(true);
    expect(state.slots.get("node-1")!.current.id).toBe("k-node1");
  });
});

// ═══ R6 / spec amendment A3: a retraction MUST change the fold ═══════════════
//
// `rotateKey` emitted `key-retracted` events that `foldEvents` handled in
// `default: break`. Removing every retraction from a stream left the folded
// state byte-identical, so the retraction was decorative — the fold kept a
// belief nobody asserted any more. A3 states the test executably: removing
// the retraction events must CHANGE the folded state.

const retractionStream: CustodyEvent[] = [
  { id: "e1", kind: "key-issued", principalId: "alice", phase: 1, payload: { keyId: "k1", class: "node", publicKeyRef: "pub1" } },
  { id: "e2", kind: "key-issued", principalId: "alice", phase: 2, payload: { keyId: "k2", class: "node", publicKeyRef: "pub2" } },
  { id: "e3", kind: "grant-issued", principalId: "alice", phase: 3, payload: { grantId: "g1", capability: "deploy", expiresAtPhase: 5000 } },
  // k1 is withdrawn (say, compromised); g1 is withdrawn LONG before its
  // expiry phase — the early-withdrawal case an ignored retraction loses.
  { id: "e4", kind: "key-retracted", principalId: "alice", phase: 4, payload: { retractedKeyId: "k1", supersededBy: "k2" } },
  { id: "e5", kind: "grant-expired", principalId: "alice", phase: 4, payload: { grantId: "g1" } },
];

const withoutRetractions = retractionStream.filter(
  (e) => e.kind !== "key-retracted" && e.kind !== "grant-expired",
);

/**
 * Serialize the folded state WITHOUT the raw event log. The log trivially
 * differs when events are removed — that is the input echoed back, not the
 * fold honouring anything. Everything compared here is derived state.
 */
function foldedStateSansEventLog(events: readonly CustodyEvent[]): string {
  const s = foldEvents(events);
  return JSON.stringify({
    keys: [...s.keys.entries()].sort(),
    retiredKeys: [...s.retiredKeys.entries()].sort(),
    slots: [...s.slots.entries()].sort(),
    grants: s.grants,
    retiredGrants: s.retiredGrants,
    forks: s.forks,
  });
}

describe("R6/A3: retraction changes the fold (not decorative)", () => {
  test("THE FALSIFIER: removing the retractions changes the folded state", () => {
    const withRetractions = foldedStateSansEventLog(retractionStream);
    const without = foldedStateSansEventLog(withoutRetractions);
    // If these are ever byte-identical again, the retraction is being ignored.
    expect(withRetractions).not.toBe(without);
  });

  test("a retracted key leaves the active set", () => {
    const state = foldEvents(retractionStream);
    expect(state.keys.has("k1")).toBe(false);
    expect(state.keys.has("k2")).toBe(true);
  });

  test("a retracted key is RETAINED, not deleted (§5 memory preservation)", () => {
    const state = foldEvents(retractionStream);
    expect(state.retiredKeys.has("k1")).toBe(true);
    expect(state.retiredKeys.get("k1")!.publicKey).toBe("pub1");
    // and the event itself is still in the log — retraction, not erasure
    expect(state.events.some((e) => e.kind === "key-retracted")).toBe(true);
  });

  test("without the retraction the key would still be active (the control)", () => {
    const state = foldEvents(withoutRetractions);
    expect(state.keys.has("k1")).toBe(true);
    expect(state.retiredKeys.size).toBe(0);
  });

  test("SECURITY CONSEQUENCE: an early-retracted grant no longer authorizes", () => {
    const state = foldEvents(retractionStream);
    // g1 says it expires at phase 5000 and we ask at phase 100 — only the
    // retraction can deny this.
    const decision = authorize(state.grants, "deploy", "alice", 100);
    expect(decision.allowed).toBe(false);
    expect(state.retiredGrants.map((g) => g.id)).toContain("g1");
  });

  test("the control: with the retraction removed, that same grant DOES authorize", () => {
    const state = foldEvents(withoutRetractions);
    expect(authorize(state.grants, "deploy", "alice", 100).allowed).toBe(true);
  });

  test("replaying a retraction twice has the same effect as once (idempotency #6)", () => {
    const doubled = [...retractionStream, retractionStream[3]!, retractionStream[4]!];
    expect(foldedStateSansEventLog(doubled)).toBe(foldedStateSansEventLog(retractionStream));
  });

  test("retraction does not retroactively unmake the previous-slot window (R5)", () => {
    // Retracting a key ends its forward use; whether already-signed material
    // still verifies is the bounded window, a separate question.
    const slots: KeySlots = {
      previous: makeKey("k1", "alice", 1),
      current: makeKey("k2", "alice", 2),
      next: null,
      previousExpiresAtPhase: 15,
    };
    expect(verifyAgainstSlots(slots, "k1", 12).allowed).toBe(true);
  });

  test("rotation's own retraction is consumed by the fold end to end", () => {
    const issued: CustodyEvent[] = [
      { id: "i1", kind: "key-issued", principalId: "alice", phase: 1, payload: { keyId: "k1", class: "node", publicKeyRef: "p1" } },
      { id: "i2", kind: "key-issued", principalId: "alice", phase: 2, payload: { keyId: "k2", class: "node", publicKeyRef: "p2" } },
      { id: "i3", kind: "key-issued", principalId: "alice", phase: 2, payload: { keyId: "k3", class: "node", publicKeyRef: "p3" } },
    ];
    const slots: KeySlots = {
      previous: null,
      current: makeKey("k1", "alice", 1),
      next: makeKey("k2", "alice", 2),
      previousExpiresAtPhase: null,
    };
    const rotation = rotateKey(slots, makeKey("k3", "alice", 2), 10, 5);
    const state = foldEvents([...issued, ...rotation.events]);
    expect(state.slots.get("alice")!.current.id).toBe("k2");
    // the rotated-away key was retracted by rotateKey and the fold honoured it
    expect(state.keys.has("k1")).toBe(false);
    expect(state.retiredKeys.has("k1")).toBe(true);
  });
});

// ═══ Acceptance 6: skewed clocks agree on grant liveness (phase-based) ═══════

describe("Acceptance 6: two principals with skewed clocks agree (phase not wall-clock)", () => {
  test("both principals at same phase agree on liveness", () => {
    const grant = makeGrant("g1", "alice", "write", 10, 30);
    // Principal A's clock: phase 25
    // Principal B's clock: also phase 25 (agreed phase)
    // They AGREE: grant is live
    expect(isGrantLive(grant, 25)).toBe(true);
    expect(isGrantLive(grant, 25)).toBe(true); // same call = same result (trivially)
  });

  test("phase-based expiry prevents clock-skew disagreement", () => {
    const grant = makeGrant("g1", "alice", "write", 10, 30);
    // The function takes PHASE not wall-clock — if both principals
    // have converged to the same phase (via HLC observe), they agree.
    // If they haven't converged, they have different phases — and the
    // LATER phase is always >= the EARLIER one (HLC monotone).
    // So the grant expires for the ahead-principal FIRST, which is safe
    // (you never accept something your peer already considers expired).
    const behindPrincipal = 28; // still live
    const aheadPrincipal = 31; // expired
    expect(isGrantLive(grant, behindPrincipal)).toBe(true);
    expect(isGrantLive(grant, aheadPrincipal)).toBe(false);
    // The behind-principal will eventually advance past 30 and also see it expired.
    // No disagreement once converged. The ONLY window of disagreement is the
    // convergence gap itself — bounded by the HLC skew.
  });
});

// ═══ R5 rotation mechanics ═══════════════════════════════════════════════════

describe("R5: rotation carries three slots", () => {
  test("rotate moves current→previous, next→current, publishes new next", () => {
    const slots: KeySlots = {
      previous: null,
      current: makeKey("k1", "alice", 1),
      next: makeKey("k2", "alice", 5),
      previousExpiresAtPhase: null,
    };
    const newNext = makeKey("k3", "alice", 10);
    const result = rotateKey(slots, newNext, 10, 5); // 5-phase window

    expect(result.slots.previous!.id).toBe("k1"); // old current → previous
    expect(result.slots.current.id).toBe("k2"); // old next → current
    expect(result.slots.next!.id).toBe("k3"); // new next published
    expect(result.slots.previousExpiresAtPhase).toBe(15); // bounded window
  });

  test("rotation without pre-published next throws (R5: publish BEFORE use)", () => {
    const slots: KeySlots = {
      previous: null,
      current: makeKey("k1", "alice", 1),
      next: null, // no next published!
      previousExpiresAtPhase: null,
    };
    expect(() => rotateKey(slots, makeKey("k3", "alice", 10), 10, 5)).toThrow("no 'next' key");
  });

  test("rotation produces events (R6: append-only stream)", () => {
    const slots: KeySlots = {
      previous: null,
      current: makeKey("k1", "alice", 1),
      next: makeKey("k2", "alice", 5),
      previousExpiresAtPhase: null,
    };
    const result = rotateKey(slots, makeKey("k3", "alice", 10), 10, 5);
    expect(result.events.length).toBe(2);
    expect(result.events[0]!.kind).toBe("key-rotated");
    expect(result.events[1]!.kind).toBe("key-retracted"); // retraction, not deletion (R6)
  });
});

// ═══ R11: self-issue ═════════════════════════════════════════════════════════

describe("R11: every principal issues for itself", () => {
  test("self-issue produces key + event", () => {
    const { key, event } = selfIssueCredential("node-42", "ssh-ed25519 AAAA...", "node", 1);
    expect(key.owner.principalId).toBe("node-42");
    expect(key.class).toBe("node");
    expect(event.kind).toBe("key-issued");
    expect(event.principalId).toBe("node-42");
  });
});

// ═══ Sabotage control: break something and confirm the test goes red ═════════

describe("SABOTAGE CONTROL: verify tests are non-vacuous", () => {
  test("if isGrantLive returned true always, acceptance 1 would FAIL", () => {
    // This test verifies that our acceptance 1 test is falsifiable:
    // a grant at phase 20 with current phase 25 MUST return false.
    const grant = makeGrant("g1", "a", "x", 10, 20);
    const result = isGrantLive(grant, 25);
    // If this were true, the implementation would be wrong
    expect(result).toBe(false);
  });

  test("if verifyAgainstSlots accepted everything, acceptance 2 would FAIL", () => {
    const slots: KeySlots = {
      previous: makeKey("old", "a", 1),
      current: makeKey("cur", "a", 10),
      next: null,
      previousExpiresAtPhase: 15,
    };
    // Expired previous MUST be rejected
    expect(verifyAgainstSlots(slots, "old", 20).allowed).toBe(false);
  });
});
