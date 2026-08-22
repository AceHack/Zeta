/**
 * attestation-event.ts — durable NFT receipt for cross-verification attestations.
 *
 * When one agent cross-verifies another's heartbeat batch, that attestation is
 * recorded as a durable event in the event log — not just a GitHub PR comment.
 * The event IS the NFT: a pairwise attestation between two provably-distinct
 * identities, committed to the append-only ledger.
 *
 * This makes attestations:
 * - Durable (in the git-native event log, survives PR deletion)
 * - Foldable (other agents can compute trust from the attestation history)
 * - Composable (pairwise attestations compose into trio/N-way attestations)
 * - Verifiable (content-addressed, ZetaId-named, self-certifying)
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/self-claims.ts (reliability from attestation history)
 *   - src/Core.TypeScript/observe/event-sink-folder.ts (the durable write path)
 *   - src/Core.Lean4/Lean4/EntropyFloorLift.lean (pairwise floor additivity)
 *   - .github/workflows/agent-reviewer.yml (produces these events on approval)
 */

// ═══ Attestation Event Types ═══════════════════════════════════════════════════

/** A cross-verification attestation — the NFT receipt. */
export interface AttestationEvent {
  /** The attesting agent (the reviewer — "I saw your heartbeats"). */
  readonly attestor: string;
  /** The attested agent (the producer — "my heartbeats were witnessed"). */
  readonly attested: string;
  /** The window this attestation covers (ISO timestamps). */
  readonly windowStart: string;
  readonly windowEnd: string;
  /** Number of heartbeat events in the attested batch. */
  readonly eventCount: number;
  /** The attestation claim: "I verified these events are genuine." */
  readonly claim: "heartbeat-genuine";
  /** Attestation strength (pairwise = 1, trio-member = 1, trio-complete = bonus). */
  readonly strength: number;
  /** Whether this attestation is part of a simultaneous N-way (trio/quad/etc). */
  readonly simultaneousParticipants?: readonly string[];
}

/** An attestation event envelope (same shape as observe events — fits the log). */
export interface AttestationEnvelope {
  readonly id: string;      // ZetaId (dedup key)
  readonly at: string;      // ISO timestamp
  readonly by: string;      // the attestor
  readonly kind: "attestation";
  readonly attestation: AttestationEvent;
}

// ═══ Attestation Strength Computation ══════════════════════════════════════════

/**
 * Compute attestation strength for a pairwise cross-verification.
 * Base strength = 1 (one pairwise attestation).
 */
export function pairwiseStrength(): number {
  return 1;
}

/**
 * Compute attestation strength for an N-way simultaneous verification.
 * The trio/N-way bonus: simultaneous attestation is worth more than the sum
 * of sequential pairwise (the simultaneity guarantee adds value).
 *
 * Formula: base pairwise (1) + simultaneity bonus (log2(N) - 1 for N > 2).
 * - N=2: strength = 1 (just pairwise, no bonus)
 * - N=3: strength = 1 + (log2(3) - 1) ≈ 1.58 (trio bonus)
 * - N=4: strength = 1 + (log2(4) - 1) = 2 (quad bonus)
 *
 * The log scaling means adding participants has diminishing returns
 * (consistent with the research question routed to the math team).
 */
export function simultaneousStrength(participantCount: number): number {
  if (participantCount <= 2) return 1;
  return 1 + (Math.log2(participantCount) - 1);
}

// ═══ Build Attestation Events ══════════════════════════════════════════════════

export interface BuildAttestationOptions {
  readonly attestor: string;
  readonly attested: string;
  readonly eventCount: number;
  readonly windowStart: string;
  readonly windowEnd: string;
  /** Other agents who attested in the same window (for simultaneous bonus). */
  readonly simultaneousParticipants?: readonly string[];
}

/**
 * Build an attestation event from a cross-verification approval.
 */
export function buildAttestation(opts: BuildAttestationOptions): AttestationEvent {
  const isSimultaneous = opts.simultaneousParticipants && opts.simultaneousParticipants.length > 0;
  const totalParticipants = isSimultaneous
    ? opts.simultaneousParticipants!.length + 2 // +2 for the attestor + attested
    : 2; // just the pair

  return {
    attestor: opts.attestor,
    attested: opts.attested,
    windowStart: opts.windowStart,
    windowEnd: opts.windowEnd,
    eventCount: opts.eventCount,
    claim: "heartbeat-genuine",
    strength: simultaneousStrength(totalParticipants),
    ...(isSimultaneous ? { simultaneousParticipants: opts.simultaneousParticipants } : {}),
  };
}

// ═══ Fold Attestations (compute trust from history) ═════════════════════════════

/** Summary of attestations an agent has received. */
export interface AttestationSummary {
  readonly agentId: string;
  /** Total attestations received (all time). */
  readonly totalAttestations: number;
  /** Total attestation strength accumulated. */
  readonly totalStrength: number;
  /** Distinct attestors (how many different peers have verified you). */
  readonly distinctAttestors: number;
  /** Attestations in the last 24h. */
  readonly recent24h: number;
  /** Whether a trio attestation has been received (stronger identity claim). */
  readonly hasTrioAttestation: boolean;
}

/**
 * Fold attestation events into a summary for a given agent.
 */
export function summarizeAttestations(
  agentId: string,
  attestations: readonly AttestationEvent[],
  now: string = new Date().toISOString(),
): AttestationSummary {
  const received = attestations.filter((a) => a.attested === agentId);
  const cutoff24h = new Date(new Date(now).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const recent = received.filter((a) => a.windowEnd >= cutoff24h);
  const attestors = new Set(received.map((a) => a.attestor));
  const hasTrio = received.some((a) => a.simultaneousParticipants && a.simultaneousParticipants.length > 0);

  return {
    agentId,
    totalAttestations: received.length,
    totalStrength: received.reduce((sum, a) => sum + a.strength, 0),
    distinctAttestors: attestors.size,
    recent24h: recent.length,
    hasTrioAttestation: hasTrio,
  };
}
