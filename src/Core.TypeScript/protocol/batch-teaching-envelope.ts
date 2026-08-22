/**
 * BatchTeachingEnvelope.ts
 *
 * RFC 9457 (Problem Details for HTTP APIs) extended with per-item four-corner cells.
 *
 * The RFC 7807/9457 batch pattern:
 *   { type, title, status: 207, errors: [ { itemId, ... } ] }
 *
 * The Zeta extension: each item in the batch is a full four-corner cell:
 *   (retraction, generator, dimension, severity)
 *
 * This is the tensor/matrix generalization of the single-item teaching error:
 *   rows = batch items, columns = four corners
 *   [retractableBeliefId | generatorFn | dimension | severity]
 *
 * Pseudo-retrocausality: the generatorFn is the new behavior to try BEFORE
 * the error occurred (from the receiver's perspective). The retractableBeliefId
 * is the belief to retract as if it was never asserted.
 *
 * Anchors: RFC 9457 §3 (problem+json), RFC 4918 §11.1 (207 Multi-Status),
 *          ASP.NET Core ValidationProblemDetails (invalid-params pattern),
 *          Zeta four-corner-feedback.ts (TeachingBatchAck)
 */

import type { ErrorDimension, ErrorSeverity } from "./error-envelope";
import { envelopeId } from "./error-envelope";

// ── Bayesian prior hint ───────────────────────────────────────────────────────

/**
 * A Gaussian posterior snapshot that the sender attaches to the feedback channel.
 *
 * This makes the four-corner model commutative:
 *   - Sender → Receiver: BatchTeachingEnvelope (errors, generators)
 *   - Receiver → Sender: BatchTeachingEnvelope with priorHints (posteriors)
 *
 * The receiver uses the sender's posterior as a prior for its own BNN update.
 * This is bidirectional EP: both sides learn from each other's beliefs.
 *
 * Mathematical anchor: EP cavity update
 *   q(x) ∝ p(x) · t(x)   (prior × likelihood)
 *   where p(x) = sender's posterior (the prior hint)
 *         t(x) = receiver's own likelihood (its local observations)
 *
 * Commutativity: if A sends priorHint to B and B sends priorHint to A,
 *   the joint posterior converges to the same value regardless of order.
 *   This holds because Gaussian EP is commutative over the natural parameters.
 *
 * Anchor: Minka (2001) §4.1 — EP is commutative for exponential family factors.
 */
export interface PriorHint {
  /** The error dimension this prior applies to. */
  readonly dimension: ErrorDimension;
  /** The sender's current posterior mean for this dimension. */
  readonly mu: number;
  /** The sender's current posterior variance for this dimension. */
  readonly sigma2: number;
  /** The sender's current robustness weight (Student-t EP). */
  readonly robustnessWeight: number;
  /** Number of observations the sender has seen for this dimension. */
  readonly obsCount: number;
  /** The sender's ZetaId (for trust-weighting the prior). */
  readonly senderZid?: string;
}

/**
 * Merge a PriorHint into a local (mu, sigma2) posterior using EP natural parameters.
 *
 * EP natural parameter update:
 *   τ_joint = τ_local + τ_prior   (precision-weighted mean)
 *   ρ_joint = ρ_local + ρ_prior   (precision sum)
 *
 * where τ = μ/σ² (natural mean), ρ = 1/σ² (precision).
 *
 * This is the commutative operation: mergePriorHint(A, B) = mergePriorHint(B, A)
 * in terms of the resulting joint posterior.
 *
 * REFUSAL: a hint with `obsCount <= 0` contributes NO precision -- the local belief
 * is returned unchanged. A prior is not evidence, and the commutativity above holds
 * for the refusal too (a no-op commutes with everything).
 */
export function mergePriorHint(
  local: { mu: number; sigma2: number },
  hint: PriorHint,
  trustWeight: number = 1.0,
): { mu: number; sigma2: number } {
  // A hint that absorbed NOTHING is a prior, and a prior is not evidence.
  //
  // Measured before this guard existed: a receiver at N(0,1) merging the society
  // runner's zero-observation hint at trustWeight 0.5 came out at sigma2 = 0.666667
  // -- 18% narrower for a message carrying no observation -- and the 82 such hints
  // already on main drive it to sigma2 = 0.023810 (sigma 1.0 -> 0.154303, precision
  // 1 -> 42). Nothing measured any of that precision.
  //
  // The principled statement, which is why the guard is a no-op for correct senders:
  // under EP the message a peer owes is its SITE contribution (posterior / cavity),
  // not its posterior (Minka 2001 ch. 4). Sending the posterior counts the shared
  // prior once per peer -- the classic prior-double-counting failure the cavity
  // exists to prevent. `StudentTState` already carries that site message, and for a
  // never-observed dimension it is exactly uniform (`factorSigma2 = +Infinity`, so
  // zero precision). So a hint built from the right object would have contributed
  // nothing here anyway; the guard makes the WRONG object behave like the right one
  // in the one case where the difference is total. Exchanging site messages instead
  // of posteriors is the full repair and it changes the wire type: 081M005CFFE087G0R0026WF2DS.
  if (!(hint.obsCount > 0)) return { mu: local.mu, sigma2: local.sigma2 };

  const rhoLocal = 1 / local.sigma2;
  const tauLocal = local.mu * rhoLocal;
  const rhoHint = (1 / hint.sigma2) * hint.robustnessWeight * trustWeight;
  const tauHint = hint.mu * rhoHint;
  const rhoJoint = rhoLocal + rhoHint;
  const muJoint = (tauLocal + tauHint) / rhoJoint;
  const sigma2Joint = 1 / rhoJoint;
  return { mu: muJoint, sigma2: sigma2Joint };
}

// ── Per-item four-corner cell ──────────────────────────────────────────────────

/**
 * One cell in the batch tensor.
 * Maps to one item in the originating BatchFrame.
 */
export interface BatchItemCell {
  /**
   * The item id within the originating batch frame.
   * Correlates back to BatchFrame.items[i].id.
   */
  readonly itemId: string;

  /**
   * Corner 1 (Retraction): the belief to retract.
   * If absent, this is a bare erasure (no teaching value).
   * Format: stable content-addressed id of the superseded belief.
   */
  readonly retractableBeliefId?: string;

  /**
   * Corner 2 (Generator): the new behavior to try.
   * A runnable command or valid alternative. Not prose.
   * This is the pseudo-retrocausal generator function.
   */
  readonly generatorFn: string;

  /**
   * Corner 3 (Dimension): which BNN factor to update.
   * Determines which StudentTBnn state absorbs this observation.
   */
  readonly dimension: ErrorDimension;

  /**
   * Corner 4 (Severity): the EP observation magnitude.
   * Maps to SEVERITY_Z in error-envelope.ts.
   */
  readonly severity: ErrorSeverity;

  /**
   * Human-readable reason for this item's failure.
   * Corresponds to RFC 7807 invalid-params[i].reason.
   */
  readonly reason: string;

  /**
   * The specific token/field/marker that is wrong.
   * Corresponds to RFC 7807 invalid-params[i].name.
   */
  readonly what: string;

  /**
   * HTTP-style status code for this individual item.
   * Enables 207 Multi-Status semantics: each item has its own status.
   */
  readonly itemStatus: number;

  /**
   * True if this item has a retractableBeliefId (teaching error).
   * False if it is a bare erasure.
   * Computed field — not stored, derived from retractableBeliefId presence.
   */
  readonly isTeaching: boolean;
  /**
   * Optional reason why this erasure was deliberately paid.
   * Present = accounted heat (the system is working, not alarming).
   * Absent = unaccounted heat (the alarm signal).
   *
   * Examples of accounted reasons:
   * - "versioned-migration: dropped old schema form after 30-day transition window"
   * - "bounded-forget: TTL expired, bounded-forget policy applied"
   * - "known-landauer: branch collapsed after measurement, Landauer cost paid"
   */
  readonly accountedReason?: string;
}

// ── The batch envelope ────────────────────────────────────────────────────────

/**
 * The full batch teaching envelope.
 * Conforms to RFC 9457 application/problem+json with Zeta extensions.
 *
 * Wire format:
 * {
 *   "type": "https://zeta.lfg/problems/batch-teaching",
 *   "title": "Batch of teaching errors",
 *   "status": 207,
 *   "correlationId": "...",
 *   "batchFrameId": "...",
 *   "errors": [ { itemId, retractableBeliefId, generatorFn, dimension, severity, reason, what, itemStatus, isTeaching } ]
 * }
 */
export interface BatchTeachingEnvelope {
  /** RFC 9457 §3.1 — problem type URI */
  readonly type: "https://zeta.lfg/problems/batch-teaching";

  /** RFC 9457 §3.1 — short human-readable summary */
  readonly title: string;

  /** RFC 9457 §3.1 — HTTP status (207 Multi-Status for heterogeneous batches) */
  readonly status: 207;

  /** RFC 9457 §3.1 — URI identifying this specific occurrence */
  readonly instance: string;

  /** Stable content-addressed id of this envelope (Zeta extension) */
  readonly envelopeId: string;

  /** The id of the originating batch frame (correlates to BatchFrame.id) */
  readonly batchFrameId: string;

  /** The correlation id of the originating request */
  readonly correlationId: string;

  /** ISO timestamp of when the envelope was emitted */
  readonly emittedAt: string;

  /**
   * The per-item four-corner cells.
   * This is the tensor: rows = items, columns = four corners.
   * Corresponds to RFC 7807 §3.2 invalid-params extension.
   */
  readonly errors: readonly BatchItemCell[];

  /**
   * Optional Bayesian prior hints from the sender.
   * One hint per error dimension that the sender has a posterior for.
   * The receiver merges these into its own BNN via EP natural parameter update.
   * This makes the feedback channel bidirectional and commutative.
   */
  readonly priorHints?: readonly PriorHint[];

  /**
   * Summary statistics for the batch.
   * Allows a receiver to quickly assess the batch without iterating errors.
   */
  readonly summary: BatchSummary;
}

export interface BatchSummary {
  /** Total number of items in the originating batch frame */
  readonly totalItems: number;
  /** Number of items that failed */
  readonly failedItems: number;
  /** Number of items that succeeded */
  readonly succeededItems: number;
  /** Number of teaching errors (have retractableBeliefId) */
  readonly teachingErrors: number;
  /** Number of bare erasures (no retractableBeliefId) */
  readonly bareErasures: number;
  /** Dominant error dimension across all failed items */
  readonly dominantDimension: ErrorDimension;
  /** Teaching ratio: teachingErrors / failedItems (0 = all erasure, 1 = all teaching) */
  readonly teachingRatio: number;
  /**
   * Accounted heat: bare erasures that were DELIBERATELY paid (marked with accountedReason).
   * Deliberate erasures are the system working — a versioned migration that drops the old
   * form, a known Landauer cost, a bounded-forget policy. These are NOT alarming.
   * Grounding: docs/research/2026-08-10-tsirelson-… §4a — a versioned migration is
   * Adj-shaped (near-free); a migration that drops the old form is an erasure and pays.
   */
  readonly accountedHeat: number;
  /**
   * Unaccounted heat: bare erasures that were NOT deliberately paid (no accountedReason).
   * This is the alarm signal. Minimising total heat is NOT the goal — heat spent
   * deliberately is the system working. Unaccounted heat is the entropy leak.
   */
  readonly unaccountedHeat: number;
  /**
   * True if this envelope carries prior hints (bidirectional EP mode).
   * False if it is one-way teaching only.
   */
  readonly hasPriorHints: boolean;
}

// ── Construction ──────────────────────────────────────────────────────────────

/**
 * Build a BatchItemCell from a partial spec.
 * Computes isTeaching from retractableBeliefId presence.
 */
export function makeBatchItemCell(spec: {
  itemId: string;
  retractableBeliefId?: string;
  generatorFn: string;
  dimension: ErrorDimension;
  severity: ErrorSeverity;
  reason: string;
  what: string;
  itemStatus?: number;
  accountedReason?: string;
}): BatchItemCell {
  return {
    itemId: spec.itemId,
    ...(spec.retractableBeliefId === undefined ? {} : { retractableBeliefId: spec.retractableBeliefId }),
    generatorFn: spec.generatorFn,
    dimension: spec.dimension,
    severity: spec.severity,
    reason: spec.reason,
    what: spec.what,
    itemStatus: spec.itemStatus ?? 422,
    isTeaching: spec.retractableBeliefId !== undefined,
    ...(spec.accountedReason === undefined ? {} : { accountedReason: spec.accountedReason }),
  };
}

/**
 * Build a BatchTeachingEnvelope from a list of cells and batch metadata.
 */
export function makeBatchEnvelope(spec: {
  batchFrameId: string;
  correlationId: string;
  totalItems: number;
  errors: readonly BatchItemCell[];
  priorHints?: readonly PriorHint[];
}): BatchTeachingEnvelope {
  const { batchFrameId, correlationId, totalItems, errors, priorHints } = spec;
  const failedItems = errors.length;
  const succeededItems = totalItems - failedItems;
  const teachingErrors = errors.filter(e => e.isTeaching).length;
  const bareErasures = failedItems - teachingErrors;
  const teachingRatio = failedItems > 0 ? teachingErrors / failedItems : 1;
  const accountedHeat = errors.filter(e => !e.isTeaching && e.accountedReason !== undefined).length;
  const unaccountedHeat = bareErasures - accountedHeat;

  // Dominant dimension: most common dimension across failed items
  const dimCounts = new Map<ErrorDimension, number>();
  for (const e of errors) {
    dimCounts.set(e.dimension, (dimCounts.get(e.dimension) ?? 0) + 1);
  }
  let dominantDimension: ErrorDimension = "unknown";
  let maxCount = 0;
  for (const [dim, count] of dimCounts) {
    if (count > maxCount) { maxCount = count; dominantDimension = dim; }
  }

  const id = envelopeId(correlationId, dominantDimension, `batch:${batchFrameId}`, `${failedItems} failures`);
  const now = new Date().toISOString();

  return {
    type: "https://zeta.lfg/problems/batch-teaching",
    title: `Batch of ${failedItems} teaching error${failedItems !== 1 ? "s" : ""} (${teachingErrors} teaching, ${bareErasures} erasure)`,
    status: 207,
    instance: `zeta:batch:${batchFrameId}`,
    envelopeId: id,
    batchFrameId,
    correlationId,
    emittedAt: now,
    errors,
    priorHints: priorHints ?? [],
    summary: {
      totalItems,
      failedItems,
      succeededItems,
      teachingErrors,
      bareErasures,
      dominantDimension,
      teachingRatio,
      accountedHeat,
      unaccountedHeat,
      hasPriorHints: (priorHints?.length ?? 0) > 0,
    },
  };
}

// ── Tensor operations ─────────────────────────────────────────────────────────

/**
 * Extract the four-corner tensor as a 2D array.
 * rows = batch items (ordered by itemId)
 * columns = [retractableBeliefId, generatorFn, dimension, severity]
 *
 * This is the matrix form of the four-corner model.
 * Useful for bulk BNN updates: iterate rows, update each dimension's StudentTBnn.
 */
export function toFourCornerTensor(
  envelope: BatchTeachingEnvelope,
): Array<[string | undefined, string, ErrorDimension, ErrorSeverity]> {
  return envelope.errors.map(e => [
    e.retractableBeliefId,
    e.generatorFn,
    e.dimension,
    e.severity,
  ]);
}

/**
 * Filter the batch to only teaching errors (have retractableBeliefId).
 * Bare erasures are excluded — they have no learning value.
 */
export function teachingOnly(envelope: BatchTeachingEnvelope): BatchTeachingEnvelope {
  const teaching = envelope.errors.filter(e => e.isTeaching);
  return makeBatchEnvelope({
    batchFrameId: envelope.batchFrameId,
    correlationId: envelope.correlationId,
    totalItems: envelope.summary.totalItems,
    errors: teaching,
  });
}

/**
 * Group the batch by error dimension.
 * Returns a Map<ErrorDimension, BatchItemCell[]>.
 * Useful for routing each dimension's cells to the right BNN factor.
 */
export function groupByDimension(
  envelope: BatchTeachingEnvelope,
): Map<ErrorDimension, BatchItemCell[]> {
  const groups = new Map<ErrorDimension, BatchItemCell[]>();
  for (const cell of envelope.errors) {
    const group = groups.get(cell.dimension) ?? [];
    group.push(cell);
    groups.set(cell.dimension, group);
  }
  return groups;
}

/**
 * Compute the "erasure heat" of a batch envelope.
 * Heat = bareErasures / totalItems (0 = all teaching, 1 = all erasure).
 * High heat = the protocol is losing information (entropy leak).
 * Low heat = the protocol is teaching (information gain).
 */
export function erasureHeat(envelope: BatchTeachingEnvelope): number {
  return envelope.summary.totalItems > 0
    ? envelope.summary.bareErasures / envelope.summary.totalItems
    : 0;
}
