/**
 * error-envelope.ts — The canonical machine-readable error envelope.
 *
 * ## The four-part shape (from the ferry doc, 2026-08-09)
 *
 * Every error, whether from a CLI or a multiplexed transport, must carry:
 *
 * 1. **WHAT** — the specific token/field/marker (never a category).
 * 2. **WHY** — including the distinction the receiver could not draw for itself.
 * 3. **HOW to fix** — a runnable command or a valid alternative, not prose.
 * 4. **WHAT WON'T reproduce it** — when the failure is context-specific.
 *
 * ## Dual register
 *
 * Every envelope has two representations:
 * - **Beacon** (human-legible prose): for human reviewers, logs, terminals.
 * - **Mirror** (machine-parseable payload): for agent peers, so they never
 *   have to regex prose to extract the learning signal.
 *
 * ## Multiplexed transport requirements
 *
 * For errors on bidirectional multiplexed channels:
 * - **Correlation, not ordering**: the `correlationId` field ties the error
 *   to the message that caused it, independent of arrival order.
 *   (`local-time-never-enters-the-shared-fold`)
 * - **Idempotent under redelivery**: the `envelopeId` is a stable hash of
 *   the error content. Delivering the same error twice produces one learning
 *   update, not two (discipline #6).
 * - **Declared, metered channel**: errors cross a declared boundary (§13).
 *   If an error updates a peer's model, that is influence and must be metered.
 *
 * ## Connection to the online BNN (R4)
 *
 * Each error envelope is one observation for the EP update:
 * - `dimension` names the factor to update (not the whole model).
 * - `severity` is the observation magnitude (how far from the expected value).
 * - `teacherZid` is the teacher's identity (for trust-weighting the update).
 * - The receiver's StudentTBnn downweights hostile/badly-calibrated teachers
 *   automatically via the robustness weight w = (ν+1)/(ν+z²).
 *
 * ## Connection to Landauer / thermodynamics
 *
 * A teaching error buys a RETRACTION (no erasure, no Landauer floor).
 * A bare error buys an ERASURE (kT ln 2 per bit — the floor is paid).
 * The `retractableBeliefId` field names the belief to retract, not overwrite.
 * If absent, the receiver must discard and redo (erasure path, expensive).
 *
 * ## References
 *
 * - Shannon (1948) — information as reduction in uncertainty
 * - RFC 9413 (Thomson & Eggert, IAB 2023) — active feedback keeps protocols healthy
 * - Goguen & Meseguer (1982) — noninterference (§13)
 * - Landauer (1961) — kT ln 2 floor for erasure
 * - Bennett (1973) — retraction vs erasure
 */

// ── Error dimensions ───────────────────────────────────────────────────────────

/**
 * The dimension of the error — which factor in the model to update.
 * Naming the dimension is what makes an error a training example rather than
 * a status report. A bare failure has dimension "unknown"; the receiver must
 * guess and retry (erasure path).
 */
export const ERROR_DIMENSIONS = [
  "schema",
  "type",
  "range",
  "constraint",
  "auth",
  "transport",
  "toolchain",
  "calibration",
  "unknown",
] as const;

export type ErrorDimension = (typeof ERROR_DIMENSIONS)[number];

/**
 * Severity of the error — the observation magnitude for the EP update.
 * Maps to the z-score in the StudentTBnn robustness weight:
 * w = (ν+1) / (ν + severity²)
 * severity=1: normal update. severity→∞: outlier, downweighted.
 */
export type ErrorSeverity = "info" | "warn" | "error" | "fatal";

export const SEVERITY_Z: Record<ErrorSeverity, number> = {
  info: 0.5,
  warn: 1.0,
  error: 2.0,
  fatal: 4.0,
};

/**
 * The largest z the severity alphabet can express (`fatal`).
 *
 * Exported because a consumer that normalises a posterior mean into a bounded
 * scale must divide by a number that comes FROM the alphabet, not from taste.
 * Both sides of that ratio are severity z-scores, so the ratio is dimensionless
 * and lies in [0, 1] for any belief the alphabet can support.
 */
export const MAX_SEVERITY_Z: number = Math.max(...Object.values(SEVERITY_Z));

// ── The envelope ───────────────────────────────────────────────────────────────

/**
 * The machine-parseable Mirror payload.
 * An agent peer reads this; it never has to regex the Beacon prose.
 */
export interface ErrorMirror {
  /** The specific token/field/marker that is wrong. Never a category. */
  readonly what: string;
  /** The distinction the receiver could not draw for itself. */
  readonly why: string;
  /** A runnable command or valid alternative. Not prose. */
  readonly howToFix: string;
  /** What context makes this failure non-reproducible elsewhere. Optional. */
  readonly contextSpecific?: string;
  /** The dimension of the error — which factor to update. */
  readonly dimension: ErrorDimension;
  /** Severity — the observation magnitude for the EP update. */
  readonly severity: ErrorSeverity;
  /**
   * The belief to retract (not overwrite) if this error is a teaching error.
   * If absent, the receiver must discard and redo (erasure path).
   * Format: a stable content-addressed id of the superseded belief.
   */
  readonly retractableBeliefId?: string;
  /**
   * The teacher's ZetaId — for trust-weighting the EP update.
   * A peer that teaches badly degrades its own trustBound.
   */
  readonly teacherZid?: string;
}

/**
 * The full error envelope — dual-register (Beacon prose + Mirror payload).
 */
export interface ErrorEnvelope {
  /**
   * Stable content-addressed id of this envelope.
   * Computed as a hash of (correlationId, dimension, what, why).
   * Idempotent under redelivery: the same error delivered twice
   * produces one learning update, not two.
   */
  readonly envelopeId: string;
  /**
   * The id of the message that caused this error.
   * Correlation, not ordering — ties the error to its cause
   * regardless of arrival order on a multiplexed channel.
   */
  readonly correlationId: string;
  /** Human-legible prose for logs and terminals (Beacon register). */
  readonly beacon: string;
  /** Machine-parseable payload for agent peers (Mirror register). */
  readonly mirror: ErrorMirror;
  /** ISO timestamp of when the error was emitted. */
  readonly emittedAt: string;
}

// ── Construction ───────────────────────────────────────────────────────────────

/**
 * Compute a stable content-addressed id for an envelope.
 * Deterministic: same inputs → same id (byte-locked, DST-replayable).
 * Uses a simple djb2-style hash (no crypto dependency — this is for dedup, not security).
 */
export function envelopeId(correlationId: string, dimension: ErrorDimension, what: string, why: string): string {
  const s = `${correlationId}::${dimension}::${what}::${why}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Build a teaching error envelope — the full four-part shape.
 *
 * A teaching error names the dimension, so the receiver can emit a targeted
 * −1 retraction and carry the rest of its state forward (retraction path, cheap).
 */
export function teachingError(correlationId: string, mirror: ErrorMirror, emittedAt: string): ErrorEnvelope {
  const id = envelopeId(correlationId, mirror.dimension, mirror.what, mirror.why);
  const beacon = buildBeacon(mirror);
  return {
    envelopeId: id,
    correlationId,
    beacon,
    mirror,
    emittedAt,
  };
}

/**
 * Build a bare error envelope — the minimum shape.
 *
 * A bare error gives the receiver nothing to retract with: it must discard
 * and redo (erasure path, expensive). Use only when the dimension is genuinely
 * unknown. The `why` field should still explain what was observed.
 */
export function bareError(
  correlationId: string,
  what: string,
  why: string,
  emittedAt: string,
  severity: ErrorSeverity = "error",
): ErrorEnvelope {
  const mirror: ErrorMirror = {
    what,
    why,
    howToFix: "unknown — retry with more context",
    dimension: "unknown",
    severity,
  };
  return teachingError(correlationId, mirror, emittedAt);
}

/**
 * Build the human-legible Beacon prose from the Mirror payload.
 * Format: [DIMENSION/SEVERITY] WHAT — WHY\n  Fix: HOW_TO_FIX\n  Context: CONTEXT
 */
function buildBeacon(mirror: ErrorMirror): string {
  const tag = `[${mirror.dimension.toUpperCase()}/${mirror.severity.toUpperCase()}]`;
  let s = `${tag} ${mirror.what}\n  Why: ${mirror.why}\n  Fix: ${mirror.howToFix}`;
  if (mirror.contextSpecific) s += `\n  Context: ${mirror.contextSpecific}`;
  if (mirror.retractableBeliefId) s += `\n  Retract: ${mirror.retractableBeliefId}`;
  return s;
}

// ── EP observation adapter ─────────────────────────────────────────────────────

/**
 * Convert an error envelope to an EP observation for the online BNN.
 *
 * The observation is the z-score of the error severity, trust-weighted by
 * the teacher's ZetaId (via the calibration ledger).
 *
 * This is the R4 coupling: each error is one observation absorbed by EP.
 * Rich errors (named dimension) update the right factor; bare errors
 * (unknown dimension) smear probability across the whole model.
 *
 * @returns { x: number, dimension: ErrorDimension, teacherZid: string | undefined }
 *   where x is the observation value for the StudentTBnn update.
 */
export function toEpObservation(envelope: ErrorEnvelope): {
  readonly x: number;
  readonly dimension: ErrorDimension;
  readonly teacherZid: string | undefined;
  readonly isRetraction: boolean;
} {
  const z = SEVERITY_Z[envelope.mirror.severity];
  return {
    x: z,
    dimension: envelope.mirror.dimension,
    teacherZid: envelope.mirror.teacherZid,
    isRetraction: envelope.mirror.retractableBeliefId !== undefined,
  };
}

// ── Idempotency guard ──────────────────────────────────────────────────────────

/**
 * An idempotency guard for error envelopes on a multiplexed channel.
 *
 * Tracks seen envelope ids. Calling `absorb` returns true only the first time
 * a given envelope id is seen — subsequent deliveries of the same error are
 * silently dropped (one learning update, not two).
 *
 * The seen set is bounded by `maxSize` (default 1024) to prevent unbounded growth.
 * When full, the oldest entries are evicted (FIFO).
 */
export class EnvelopeIdempotencyGuard {
  private readonly seen: string[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 1024) {
    this.maxSize = maxSize;
  }

  /**
   * Returns true if this envelope has not been seen before (absorb it).
   * Returns false if it is a duplicate (drop it).
   */
  absorb(envelope: ErrorEnvelope): boolean {
    if (this.seen.includes(envelope.envelopeId)) return false;
    this.seen.push(envelope.envelopeId);
    if (this.seen.length > this.maxSize) this.seen.shift();
    return true;
  }

  /** Number of unique envelopes absorbed. */
  get count(): number {
    return this.seen.length;
  }
}
