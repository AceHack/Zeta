/**
 * key-custody.ts — Key custody & rotation (clean-room derivation B).
 *
 * Implemented from: docs/specs/key-custody-and-rotation-cleanroom-spec.md
 * Implements: R1–R12, acceptance criteria 1–6.
 *
 * This is derivation B of the N-version protocol. The implementer (Kiro/Alexa)
 * has NOT seen derivation A's code or branch.
 *
 * ── WHAT THIS MODULE DOES NOT DO (read before citing it as a custody guarantee)
 *
 * Nothing here is cryptographic. No signature is produced, no signature is
 * verified, no content is encrypted, and no key material is ever handled — a
 * `publicKey` is an opaque string that is stored and compared, never used.
 * Every function below is a **bookkeeping decision over declared records**:
 * it answers "does this record say this is permitted?", never "is this
 * cryptographically bound?". `verifyAgainstSlots` matches a key IDENTIFIER
 * against three slots; it does not verify anything signed. `evaluateForkRead`
 * decides read authorization from a declared lineage; it does not make
 * post-fork content unreadable — no confidentiality mechanism exists here.
 * Enforcement of these decisions is the caller's, and is not built.
 */

// ═══ R1: Ownership as a first-class type ═════════════════════════════════════

/** Ownership is its own entity — not a mutable field, not ambient context. */
export interface Ownership {
  readonly principalId: string;
  readonly since: number; // phase (agreed time, not wall-clock — R9)
}

// ═══ R2: Key classes ═════════════════════════════════════════════════════════

export type KeyClass =
  | "deployment"   // scoped to the whole deployment
  | "node"         // scoped to a single node/device
  | "bundle-ca";   // certifies other keys

export interface KeyDescriptor {
  readonly id: string;
  readonly class: KeyClass;
  readonly owner: Ownership;
  readonly publicKey: string; // the public half (R7: no secret in the stream)
}

// ═══ R5: Three key slots (previous, current, next) ══════════════════════════

export interface KeySlots {
  readonly previous: KeyDescriptor | null;
  readonly current: KeyDescriptor;
  readonly next: KeyDescriptor | null;
  /** Phase at which `previous` stops being accepted (bounded — R5/R8). */
  readonly previousExpiresAtPhase: number | null;
}

// ═══ R8/R9: Time-bounded grants (phase-based, not wall-clock) ═══════════════

export interface Grant {
  readonly id: string;
  readonly principalId: string;
  readonly capability: string;
  readonly issuedAtPhase: number;
  readonly expiresAtPhase: number; // MUST be bounded (R8)
}

/**
 * R8 + R9: evaluate a grant against agreed phase. No wall-clock.
 * Two principals with different local clocks but the same phase AGREE.
 */
export function isGrantLive(grant: Grant, currentPhase: number): boolean {
  return currentPhase >= grant.issuedAtPhase && currentPhase < grant.expiresAtPhase;
}

// ═══ R12: Authorization decisions explain themselves ═════════════════════════

export interface AuthzDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly grant?: Grant;
}

export function authorize(grants: readonly Grant[], capability: string, principalId: string, currentPhase: number): AuthzDecision {
  const matching = grants.filter((g) => g.principalId === principalId && g.capability === capability);
  if (matching.length === 0) {
    return { allowed: false, reason: `no grant for capability '${capability}' found for principal '${principalId}'` };
  }
  const live = matching.find((g) => isGrantLive(g, currentPhase));
  if (!live) {
    const expired = matching[0]!;
    return { allowed: false, reason: `grant expired at phase ${expired.expiresAtPhase}, current phase is ${currentPhase}` };
  }
  return { allowed: true, reason: `grant '${live.id}' is live (expires phase ${live.expiresAtPhase})`, grant: live };
}

// ═══ R6: Events on an append-only stream (emission + retraction) ═════════════

export type CustodyEventKind =
  | "key-issued"
  | "key-rotated"
  | "key-retracted"
  | "custody-forked"
  | "custody-witnessed"
  | "grant-issued"
  | "grant-expired"; // retraction

export interface CustodyEvent {
  readonly id: string;
  readonly kind: CustodyEventKind;
  readonly principalId: string;
  readonly phase: number; // agreed phase (R9)
  readonly payload: Record<string, unknown>; // R7: references only, no secret material
}

// ═══ R3/R4: Custody transfer as a fork over content-addressed structure ══════

export interface CustodyFork {
  /** The shared ancestor (pre-fork history). */
  readonly ancestorRef: string; // content-address of the shared history
  /** The new custodian's branch. */
  readonly newCustodian: Ownership;
  /**
   * The custodian who relinquished. NAMED, not asserted.
   *
   * This field replaces `priorCustodianRetainsPreFork: true`, which was typed
   * as the literal `true` and therefore could not be false for any input that
   * type-checked. AC#3 was "satisfied" by an assertion no test could fail
   * (spec amendment A4). R3's retention property is now decided by
   * `evaluateForkRead` against this identity and the content lineage, so it
   * has inputs that make its output differ.
   */
  readonly priorCustodian: Ownership;
  /** No key is valid across the fork in both directions (R4). */
  readonly keysInvalidatedPostFork: readonly string[];
}

// ═══ Content lineage — the structure AC#3 is decided against ═════════════════

/**
 * A node in the content-addressed history (R4). `parents` are the refs this
 * node was derived from; the fork's `ancestorRef` is the shared boundary.
 */
export interface ContentNode {
  readonly ref: string;
  readonly parents: readonly string[];
}

export type ContentDag = ReadonlyMap<string, ContentNode>;

/**
 * Is `candidateRef` the same as, or an ancestor of, `descendantRef`?
 *
 * Walks parent edges from `descendantRef`. A ref absent from the DAG
 * terminates that walk (it is not treated as a match) — unknown is not
 * permissive. The visited set makes this total even on malformed cyclic
 * input, which a genuine content-addressed store cannot produce but a caller
 * can hand us.
 */
export function isAncestorOrSelf(dag: ContentDag, candidateRef: string, descendantRef: string): boolean {
  const visited = new Set<string>();
  const frontier: string[] = [descendantRef];
  while (frontier.length > 0) {
    const ref = frontier.pop()!;
    if (ref === candidateRef) return true;
    if (visited.has(ref)) continue;
    visited.add(ref);
    const node = dag.get(ref);
    if (!node) continue;
    for (const parent of node.parents) frontier.push(parent);
  }
  return false;
}

/**
 * ACCEPTANCE #3, made falsifiable: may `readerPrincipalId` read `contentRef`
 * given this fork?
 *
 * The two inputs that make the output differ (spec amendment A4): for the
 * prior custodian, a ref that is an ancestor-or-self of `fork.ancestorRef`
 * is ALLOWED (R3 — the transfer must not destroy what they held) and a ref
 * on the post-fork branch is DENIED (R4 — no key crosses the boundary in
 * both directions).
 *
 * HONEST SCOPE — this is an authorization DECISION, not an enforcement
 * mechanism. It returns "denied" for post-fork content; it does not encrypt
 * that content, does not revoke any key, and cannot stop a party that holds
 * the bytes from reading them. A caller that does not consult this function
 * is not constrained by it. Whether refusal is *enforceable* is a separate,
 * unbuilt concern.
 */
export function evaluateForkRead(
  fork: CustodyFork,
  dag: ContentDag,
  readerPrincipalId: string,
  contentRef: string,
): AuthzDecision {
  if (!dag.has(contentRef)) {
    return { allowed: false, reason: `content '${contentRef}' is not present in the supplied lineage — unknown is not permissive` };
  }
  const isPreFork = isAncestorOrSelf(dag, contentRef, fork.ancestorRef);

  if (readerPrincipalId === fork.priorCustodian.principalId) {
    if (isPreFork) {
      return { allowed: true, reason: `prior custodian '${readerPrincipalId}' retains pre-fork content '${contentRef}' (shared ancestor '${fork.ancestorRef}') — R3` };
    }
    return { allowed: false, reason: `content '${contentRef}' is post-fork (not an ancestor of '${fork.ancestorRef}'); prior custodian '${readerPrincipalId}' does not carry across the fork boundary — R4` };
  }

  if (readerPrincipalId === fork.newCustodian.principalId) {
    return { allowed: true, reason: `new custodian '${readerPrincipalId}' holds the post-fork branch and its shared ancestry — R4` };
  }

  return { allowed: false, reason: `principal '${readerPrincipalId}' is neither the prior nor the new custodian of this fork` };
}

/**
 * R4's key half: a key the fork declared invalid does not verify on the
 * post-fork branch.
 *
 * "Invalidated" here means *declared invalid by this fork record* — it is a
 * list membership test. No key is cryptographically revoked, and no
 * revocation is published anywhere.
 */
export function isKeyValidPostFork(fork: CustodyFork, keyId: string): AuthzDecision {
  if (fork.keysInvalidatedPostFork.includes(keyId)) {
    return { allowed: false, reason: `key '${keyId}' was invalidated at the fork boundary and is not valid post-fork — R4` };
  }
  return { allowed: true, reason: `key '${keyId}' was not invalidated by this fork` };
}

// ═══ R10: Witness with unpurchasable stake ═══════════════════════════════════

export interface WitnessStake {
  readonly witnessId: string;
  /** The socially-conferred, non-purchasable resource being staked. */
  readonly resource: string; // e.g. "reputation", "identity-continuity", "citizenship"
  readonly voluntary: true; // MUST be voluntary (R10)
  readonly attestedAtPhase: number;
}

export interface CustodyTransfer {
  readonly fork: CustodyFork;
  readonly witness: WitnessStake; // REQUIRED — cannot complete without (R10)
  readonly events: readonly CustodyEvent[];
}

/**
 * R10: A custody transfer cannot complete without a witness who stakes something
 * unpurchasable. Returns the validation result.
 */
export function validateTransfer(transfer: CustodyTransfer): AuthzDecision {
  if (!transfer.witness) {
    return { allowed: false, reason: "custody transfer requires a witness stake (R10)" };
  }
  if (!transfer.witness.voluntary) {
    return { allowed: false, reason: "witness stake must be voluntary (R10)" };
  }
  if (!transfer.witness.resource) {
    return { allowed: false, reason: "witness must stake a non-purchasable resource (R10)" };
  }
  return { allowed: true, reason: `transfer witnessed by '${transfer.witness.witnessId}' staking '${transfer.witness.resource}'` };
}

// ═══ R5: Rotation with three slots ══════════════════════════════════════════

export interface RotationResult {
  readonly slots: KeySlots;
  readonly events: readonly CustodyEvent[];
}

/**
 * R5: Rotate a principal's key. Moves current → previous, next → current,
 * publishes a new next. The previous acceptance window is bounded (R8).
 */
export function rotateKey(
  currentSlots: KeySlots,
  newNextKey: KeyDescriptor,
  currentPhase: number,
  previousWindowSize: number, // how many phases to accept `previous` (the bound)
): RotationResult {
  if (!currentSlots.next) {
    // Can't rotate without a pre-published next key
    throw new Error("Cannot rotate: no 'next' key has been published (R5: publish next BEFORE use)");
  }

  const newSlots: KeySlots = {
    previous: currentSlots.current,
    current: currentSlots.next,
    next: newNextKey,
    previousExpiresAtPhase: currentPhase + previousWindowSize,
  };

  const events: CustodyEvent[] = [
    {
      id: `rot-${currentSlots.next.id}-${currentPhase}`,
      kind: "key-rotated",
      principalId: currentSlots.current.owner.principalId,
      phase: currentPhase,
      payload: {
        previousKeyId: currentSlots.current.id,
        newCurrentKeyId: currentSlots.next.id,
        newNextKeyId: newNextKey.id,
        previousExpiresAtPhase: currentPhase + previousWindowSize,
      },
    },
    {
      id: `retract-${currentSlots.current.id}-${currentPhase}`,
      kind: "key-retracted",
      principalId: currentSlots.current.owner.principalId,
      phase: currentPhase,
      payload: { retractedKeyId: currentSlots.current.id, supersededBy: currentSlots.next.id },
    },
  ];

  return { slots: newSlots, events };
}

// ═══ R11: Every principal issues and verifies; no central issuer ═════════════

/**
 * R11: A principal issues a credential for itself. No central authority.
 * Trust decisions are per-principal (each decides whom it trusts).
 */
export function selfIssueCredential(principalId: string, publicKey: string, keyClass: KeyClass, phase: number): {
  key: KeyDescriptor;
  event: CustodyEvent;
} {
  const key: KeyDescriptor = {
    id: `key-${principalId}-${phase}`,
    class: keyClass,
    owner: { principalId, since: phase },
    publicKey,
  };
  const event: CustodyEvent = {
    id: `issue-${key.id}`,
    kind: "key-issued",
    principalId,
    phase,
    payload: { keyId: key.id, class: keyClass, publicKeyRef: publicKey },
  };
  return { key, event };
}

// ═══ Verification (R5 — accept previous within window) ══════════════════════

/**
 * Decide whether a key IDENTIFIER is acceptable for a principal at this
 * phase: `previous` within the bounded window, `current` always, `next`
 * never (published but not yet active).
 *
 * This verifies NO SIGNATURE. It compares `signingKeyId` against three slot
 * ids — an eligibility check that a caller would run *before* a real
 * signature verification it must perform itself. The previous docstring said
 * "verify a signature", which this function has never done.
 */
export function verifyAgainstSlots(slots: KeySlots, signingKeyId: string, currentPhase: number): AuthzDecision {
  if (slots.current.id === signingKeyId) {
    return { allowed: true, reason: "signed with current key" };
  }
  if (slots.previous?.id === signingKeyId) {
    if (slots.previousExpiresAtPhase === null) {
      return { allowed: false, reason: "previous key has no expiry set (spec violation)" };
    }
    if (currentPhase < slots.previousExpiresAtPhase) {
      return { allowed: true, reason: `signed with previous key (accepted until phase ${slots.previousExpiresAtPhase})` };
    }
    return { allowed: false, reason: `previous key expired at phase ${slots.previousExpiresAtPhase}, current phase is ${currentPhase}` };
  }
  if (slots.next?.id === signingKeyId) {
    return { allowed: false, reason: "next key is published but not yet active (rotate first)" };
  }
  return { allowed: false, reason: `key '${signingKeyId}' is not in any slot for this principal` };
}

// ═══ Fold: replay events from empty → final state (acceptance #5) ════════════

export interface CustodyState {
  /** Keys asserted active: issued and not since retracted. */
  readonly keys: Map<string, KeyDescriptor>;
  /**
   * Keys whose assertion was withdrawn by a `key-retracted` event. RETAINED,
   * not deleted (§5 memory preservation, R6: "retraction rather than
   * deletion keeps history intact while changing the fold's result").
   */
  readonly retiredKeys: Map<string, KeyDescriptor>;
  readonly slots: Map<string, KeySlots>; // principalId → slots
  /** Grants still asserted: issued and not since retracted. */
  readonly grants: Grant[];
  /** Grants withdrawn by a `grant-expired` retraction — retained for audit. */
  readonly retiredGrants: Grant[];
  readonly forks: CustodyFork[];
  readonly events: CustodyEvent[];
}

export function emptyCustodyState(): CustodyState {
  return { keys: new Map(), retiredKeys: new Map(), slots: new Map(), grants: [], retiredGrants: [], forks: [], events: [] };
}

/**
 * Acceptance #5: replay from empty reproduces the same final state (deterministic).
 * This is the fold function — applies events sequentially to produce state.
 *
 * RETRACTIONS ARE CONSUMED (R6, spec amendment A3). `key-retracted` and
 * `grant-expired` move their subject out of the asserted set and into the
 * retired set. Removing every retraction event from a stream therefore
 * CHANGES the folded state — which is the executable test A3 states, and the
 * one this fold previously failed by handling both kinds in `default: break`.
 *
 * Retraction is *correction*, not a duplicate-guard: it withdraws an
 * assertion nobody stands behind any more. Membership sets rather than
 * integer Z-set weights are used deliberately, so that replaying the same
 * retraction twice has the same effect as once (discipline #6 idempotency);
 * integer weights would make a redelivered retraction reach −1 and diverge.
 *
 * What retraction does NOT govern: whether already-signed material still
 * verifies. That is the bounded `previous`-slot window (R5), a separate
 * question with a separate answer — see `verifyAgainstSlots`. Retracting a
 * key ends its forward use; it does not retroactively unmake what it signed.
 */
export function foldEvents(events: readonly CustodyEvent[]): CustodyState {
  const state = emptyCustodyState();
  for (const event of events) {
    state.events.push(event);
    switch (event.kind) {
      case "key-issued": {
        const key: KeyDescriptor = {
          id: event.payload.keyId as string,
          class: event.payload.class as KeyClass,
          owner: { principalId: event.principalId, since: event.phase },
          publicKey: event.payload.publicKeyRef as string,
        };
        state.keys.set(key.id, key);
        // Initialize slots if first key for this principal
        if (!state.slots.has(event.principalId)) {
          state.slots.set(event.principalId, { previous: null, current: key, next: null, previousExpiresAtPhase: null });
        }
        break;
      }
      case "key-rotated": {
        const principalSlots = state.slots.get(event.principalId);
        if (principalSlots) {
          const newCurrent = state.keys.get(event.payload.newCurrentKeyId as string);
          const newNext = state.keys.get(event.payload.newNextKeyId as string);
          if (newCurrent) {
            state.slots.set(event.principalId, {
              previous: principalSlots.current,
              current: newCurrent,
              next: newNext ?? null,
              previousExpiresAtPhase: event.payload.previousExpiresAtPhase as number,
            });
          }
        }
        break;
      }
      case "grant-issued": {
        state.grants.push({
          id: event.payload.grantId as string,
          principalId: event.principalId,
          capability: event.payload.capability as string,
          issuedAtPhase: event.phase,
          expiresAtPhase: event.payload.expiresAtPhase as number,
        });
        break;
      }
      case "key-retracted": {
        // R6: withdraw the assertion. The key leaves the active set; the
        // descriptor is retained so history is not destroyed (§5).
        const retractedKeyId = event.payload.retractedKeyId as string;
        const key = state.keys.get(retractedKeyId);
        if (key) {
          state.keys.delete(retractedKeyId);
          state.retiredKeys.set(retractedKeyId, key);
        }
        break;
      }
      case "grant-expired": {
        // R6: a retraction of authority. Withdraws the grant even when its
        // `expiresAtPhase` has not been reached — the early-withdrawal case
        // is exactly where an ignored retraction leaves `authorize` granting
        // a capability nobody asserts any more.
        const retractedGrantId = event.payload.grantId as string;
        const index = state.grants.findIndex((g) => g.id === retractedGrantId);
        if (index >= 0) {
          state.retiredGrants.push(state.grants[index]!);
          state.grants.splice(index, 1);
        }
        break;
      }
      case "custody-forked": {
        state.forks.push(event.payload as unknown as CustodyFork);
        break;
      }
      default:
        break;
    }
  }
  return state;
}
