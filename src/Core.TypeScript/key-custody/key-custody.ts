/**
 * key-custody.ts — Key custody & rotation (clean-room derivation B).
 *
 * Implemented from: docs/specs/key-custody-and-rotation-cleanroom-spec.md
 * Implements: R1–R12, acceptance criteria 1–6.
 *
 * This is derivation B of the N-version protocol. The implementer (Kiro/Alexa)
 * has NOT seen derivation A's code or branch.
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
  /** The prior custodian retains read access to pre-fork content (R3). */
  readonly priorCustodianRetainsPreFork: true;
  /** No key is valid across the fork in both directions (R4). */
  readonly keysInvalidatedPostFork: readonly string[];
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
 * Verify a signature against a principal's key slots. Accepts `previous`
 * if within the bounded window, `current` always, `next` never (not yet active).
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
  readonly keys: Map<string, KeyDescriptor>;
  readonly slots: Map<string, KeySlots>; // principalId → slots
  readonly grants: Grant[];
  readonly forks: CustodyFork[];
  readonly events: CustodyEvent[];
}

export function emptyCustodyState(): CustodyState {
  return { keys: new Map(), slots: new Map(), grants: [], forks: [], events: [] };
}

/**
 * Acceptance #5: replay from empty reproduces the same final state (deterministic).
 * This is the fold function — applies events sequentially to produce state.
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
