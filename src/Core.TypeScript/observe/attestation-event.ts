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
 *   - src/Core.TypeScript/observe/attestation-record.ts (the canonical form, the
 *     attested-set digest, the derived-id check, and the SSHSIG persona binding)
 *   - src/Core.TypeScript/observe/self-claims.ts (reliability from attestation history)
 *   - src/Core.TypeScript/observe/event-sink-folder.ts (the durable write path)
 *   - src/Core.Lean4/Lean4/EntropyFloorLift.lean (pairwise floor additivity)
 *   - .github/workflows/agent-reviewer.yml (produces these events on approval)
 *
 * READ `attestation-record.ts` BEFORE TRUSTING ANYTHING BUILT HERE. "Verifiable
 * (content-addressed, ZetaId-named, self-certifying)" above was aspirational when
 * written and is now partly true: the record carries a digest of the exact event
 * set it attests, its id is recomputed rather than shape-matched, and it CAN be
 * bound to a key. Records in the corpus today are UNBOUND — no signature — which
 * is why `summarizeAttestations` refuses to fold them.
 *
 * DEPENDENCY DIRECTION: this module imports nothing from `attestation-record.ts`
 * (the digest is computed by the caller and passed in). One-way, so the verifier
 * never depends on the producer.
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
  /**
   * Number of events in the attested batch. A COUNT, which identifies nothing —
   * `attestedDigest` is the field that says WHICH events. Kept because it is
   * cheap, human-readable, and inside the signed bytes; never read it as evidence.
   */
  readonly eventCount: number;
  /**
   * `sha256:<64 hex>` over the sorted, deduplicated set of attested event ids
   * (`attestation-record.ts` `attestedEventsDigest`).
   *
   * THE FIELD THAT MAKES THE CLAIM NAME ITS SUBJECT. Without it an attestation
   * said "I saw 7 events from otto in this window" and a peer holding otto's
   * actual events could not tell whether those were the seven. With it the peer
   * recomputes and gets identity or contradiction.
   */
  readonly attestedDigest: string;
  /**
   * The claim. CLOSED vocabulary — `attestation-record.ts` `ATTESTATION_CLAIMS`.
   *
   * What it means, exactly: the attestor READ these event records and names the
   * set. It does NOT mean the events were verified genuine — nothing re-derives,
   * re-executes, or checks a signature on them. The string overclaims and is kept
   * only because `agent-reviewer.yml` writes it and 377 committed records carry it.
   */
  readonly claim: "heartbeat-genuine";
  /**
   * Attestation strength (pairwise = 1, trio-complete = bonus). DERIVED from
   * `simultaneousParticipants`, therefore NOT covered by the signature and
   * RECOMPUTED by the verifier — signing a derived field would let a signer
   * inflate the one number a trust fold multiplies by.
   */
  readonly strength: number;
  /** Whether this attestation is part of a simultaneous N-way (trio/quad/etc). */
  readonly simultaneousParticipants?: readonly string[];
}

/**
 * An attestation event envelope (same shape as observe events — fits the log).
 *
 * `AttestationRecord` in `attestation-record.ts` is this plus the optional
 * `signature`, and is what the verifier takes.
 */
export interface AttestationEnvelope {
  /**
   * ZetaId — the DEDUP KEY, derived from (attestor, attested, windowEnd).
   * `attestation-record.ts` `verifyAttestationId` RECOMPUTES it. A shape check
   * (`^[0-9a-f]{32}$`) is not a substitute: it asks whether the name looks like an
   * id, never whether it is THIS record's id, so under shape-only validation one
   * actor can write N self-attestations under N arbitrary names.
   */
  readonly id: string;
  /**
   * The writer's LOCAL wall clock. Deliberately OUTSIDE the signed bytes and not
   * used by any fold — `.claude/rules/local-time-never-enters-the-shared-fold.md`.
   * Recency comes from `windowEnd`, a property of the subject.
   */
  readonly at: string;
  /** The attestor. Must equal `attestation.attestor`; the verifier refuses otherwise. */
  readonly by: string;
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
  /**
   * `sha256:<64 hex>` naming the exact event set attested — compute it with
   * `attestation-record.ts` `attestedEventsDigest(ids)`.
   *
   * REQUIRED, not optional. An optional evidence field is one nobody fills in, and
   * an attestation that does not say what it is about is the vacuity class: it
   * looks like a fact and constrains nothing.
   */
  readonly attestedDigest: string;
  /** Other agents who attested in the same window (for simultaneous bonus). */
  readonly simultaneousParticipants?: readonly string[];
}

/** Shape gate only. The digest's VALUE is checked by recomputing it over the events. */
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

/**
 * Build an attestation event from a cross-verification approval.
 *
 * Throws on a malformed digest rather than emitting a record with an evidence
 * field that cannot possibly match anything — a bad digest is a producer bug, and
 * a producer bug that writes a durable, foldable event is the expensive kind.
 */
export function buildAttestation(opts: BuildAttestationOptions): AttestationEvent {
  if (!DIGEST_RE.test(opts.attestedDigest)) {
    throw new RangeError(`buildAttestation: attestedDigest ${JSON.stringify(opts.attestedDigest)} is not sha256:<64 hex>`);
  }
  if (!Number.isSafeInteger(opts.eventCount) || opts.eventCount <= 0) {
    throw new RangeError(`buildAttestation: eventCount ${opts.eventCount} — an attestation over nothing attests nothing`);
  }
  if (opts.attestor === opts.attested) {
    throw new RangeError(`buildAttestation: ${opts.attestor} cannot attest itself`);
  }

  const isSimultaneous = opts.simultaneousParticipants !== undefined && opts.simultaneousParticipants.length > 0;
  const totalParticipants = isSimultaneous
    ? (opts.simultaneousParticipants?.length ?? 0) + 2 // +2 for the attestor + attested
    : 2; // just the pair

  return {
    attestor: opts.attestor,
    attested: opts.attested,
    windowStart: opts.windowStart,
    windowEnd: opts.windowEnd,
    eventCount: opts.eventCount,
    attestedDigest: opts.attestedDigest,
    claim: "heartbeat-genuine",
    strength: simultaneousStrength(totalParticipants),
    ...(isSimultaneous && opts.simultaneousParticipants !== undefined
      ? { simultaneousParticipants: opts.simultaneousParticipants }
      : {}),
  };
}

// ═══ Fold Attestations (compute trust from history) ═════════════════════════════

/**
 * One attestation paired with the verdict on whether it is BOUND to a key.
 *
 * The pairing is mandatory and the type is why. Before this, the fold took bare
 * `AttestationEvent[]` — so every field of the summary below was mintable by any
 * process that could write a file into `docs/observe-events/`: pick a persona for
 * `attestor`, write N files, and `totalStrength`, `distinctAttestors`, and
 * `hasTrioAttestation` all move. Requiring the verdict at the type level means a
 * caller cannot fold unattributed records by accident; it has to say so.
 *
 * Get `binding` from `attestation-record.ts` `verifyAttestationRecord(...).status`.
 */
export interface AttestedRecord {
  readonly attestation: AttestationEvent;
  readonly binding: "bound" | "unbound" | "refused";
}

/**
 * Summary of attestations an agent has received.
 *
 * EVERY TRUST FIELD COUNTS BOUND RECORDS ONLY. `unboundReceived` and
 * `refusedReceived` are reported beside them — loudly, because that is the entire
 * corpus today — but they never enter a number anyone would multiply by.
 * Reporting them rather than dropping them is the point: "no unbound records" and
 * "we did not look" must not print the same sentence.
 */
export interface AttestationSummary {
  readonly agentId: string;
  /** Bound attestations received (all time). */
  readonly totalAttestations: number;
  /** Total strength accumulated from BOUND attestations. */
  readonly totalStrength: number;
  /**
   * Distinct BOUND attestors — the field an anti-Sybil count would rest on, so it
   * is worth saying exactly what it counts and what it must never count.
   *
   * COUNTS: distinct attestor personas whose signature verified against a key
   * committed for THAT persona (`attestation-record.ts` `verifyAttestationRecord`
   * returning `bound`). The scarcity is key custody plus the roster — both held by
   * other parties — which is the same "socially conferred, never self-minted"
   * construction the privacy budget and the naming eigenvector use.
   *
   * MUST NEVER COUNT: distinct STRINGS. A count over unbound `attestor` values is
   * countable by anyone who can vary a string, and varying a string is free. That
   * is not a hypothetical: six committed records on main name
   * `/tmp/attest-<random>` — a fresh `mkdtempSync` path per run — and a
   * string-counting fold would have read three accidental temp directories as
   * three independent witnesses. Accidental Sybil via temp-path entropy, and a
   * deliberate one would look identical.
   *
   * HONEST SCOPE, so this is not read as more than it is: nothing in production
   * folds this today. `distinctAttestors` appears only in this file and its test
   * (verified against `origin/main` 3465e2fc57) — in particular `self-claims.ts`
   * does not reference attestations at all. The current blast radius is a polluted
   * event log, not a bypassed gate. It is specified now so the wiring, when it
   * happens, cannot be wired to the forgeable version.
   */
  readonly distinctAttestors: number;
  /** Bound attestations whose window ended in the last 24h. */
  readonly recent24h: number;
  /** Whether a BOUND trio attestation has been received. */
  readonly hasTrioAttestation: boolean;
  /**
   * Structurally valid but cryptographically unattributed — a self-claim by an
   * unauthenticated writer. Reported, never folded.
   */
  readonly unboundReceived: number;
  /** Records that failed verification outright. */
  readonly refusedReceived: number;
}

/**
 * Fold attestation events into a summary for a given agent.
 *
 * Recency uses `windowEnd` — a property of the attested subject — and never the
 * envelope's local `at`, so two peers with different clocks fold the same set
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`). `now` is a
 * parameter rather than an ambient clock for the same reason (discipline #7 DST:
 * this fold replays deterministically).
 */
export function summarizeAttestations(
  agentId: string,
  records: readonly AttestedRecord[],
  now: string = new Date().toISOString(),
): AttestationSummary {
  const received = records.filter((r) => r.attestation.attested === agentId);
  const bound = received.filter((r) => r.binding === "bound").map((r) => r.attestation);
  const cutoff24h = new Date(new Date(now).getTime() - 24 * 60 * 60 * 1000).toISOString();

  return {
    agentId,
    totalAttestations: bound.length,
    totalStrength: bound.reduce((sum, a) => sum + a.strength, 0),
    distinctAttestors: new Set(bound.map((a) => a.attestor)).size,
    recent24h: bound.filter((a) => a.windowEnd >= cutoff24h).length,
    hasTrioAttestation: bound.some(
      (a) => a.simultaneousParticipants !== undefined && a.simultaneousParticipants.length > 0,
    ),
    unboundReceived: received.filter((r) => r.binding === "unbound").length,
    refusedReceived: received.filter((r) => r.binding === "refused").length,
  };
}
