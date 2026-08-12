/**
 * mutation-convergence.ts — measure whether the freedom registry converges.
 *
 * The open enhancement from Otto (2026-08-11): "we have no false-alarm rate.
 * SLAM went 25.7% → <4%, and that reduction is what earned Static Driver Verifier
 * the right to be a required Windows 7 gate. Our equivalent is
 * revisions-per-freedom-entry over time — the falsifier nobody is measuring.
 * escapeProfile (intoDefined vs intoUndefined) is implemented and nothing reads
 * it per tick."
 *
 * This module reads the escape profile from all declarers' transcripts and
 * computes convergence metrics:
 *
 * 1. **Escape rate**: escapes / total choices — higher means the grammar is too narrow
 * 2. **Freedom churn**: supersedes / total freedoms — higher means declarations are unstable
 * 3. **Convergence signal**: both rates declining over a trailing window = converging
 *
 * Output is a single summary suitable for logging per tick and trending over time.
 */

import { readTranscript, loadAllLedgers, isLive } from "./mutation-freedoms";
import { escapeProfile } from "./mutation-readout";
import type { TranscriptEntry } from "./mutation-readout";

// ═══ Types ════════════════════════════════════════════════════════════════════

export interface ConvergenceSnapshot {
  /** Escape rate: escapes / total transcript entries. 0 = no escapes. */
  readonly escapeRate: number;
  /** Split: escapes into defined cells vs undefined cells. */
  readonly escapeIntoDefined: number;
  readonly escapeIntoUndefined: number;
  /** Total transcript entries across all declarers. */
  readonly totalEntries: number;
  /** Freedom churn: superseded / total. Lower = more stable. */
  readonly freedomChurn: number;
  /** Total live freedoms across all declarers. */
  readonly liveFreedoms: number;
  /** Total superseded freedoms. */
  readonly supersededFreedoms: number;
  /** Is the registry converging? Both rates below threshold = true. */
  readonly converging: boolean;
}

// ═══ Thresholds ═══════════════════════════════════════════════════════════════

/** Escape rate below this = acceptable (SLAM achieved <4%). */
const ESCAPE_RATE_THRESHOLD = 0.10; // 10% — generous start

/** Churn rate below this = stable. */
const CHURN_THRESHOLD = 0.15; // 15% — most entries should stick

// ═══ Computation ══════════════════════════════════════════════════════════════

/**
 * Compute the convergence snapshot from the current state of the freedom registry.
 *
 * PURE given the file-system state (reads transcripts and ledgers).
 */
export function measureConvergence(repoRoot: string): ConvergenceSnapshot {
  const ledgers = loadAllLedgers(repoRoot);

  // Count freedoms
  let liveFreedoms = 0;
  let supersededFreedoms = 0;
  for (const ledger of ledgers) {
    for (const f of ledger.freedoms) {
      if (isLive(f)) liveFreedoms++;
      else supersededFreedoms++;
    }
  }
  const totalFreedoms = liveFreedoms + supersededFreedoms;
  const freedomChurn = totalFreedoms === 0 ? 0 : supersededFreedoms / totalFreedoms;

  // Read all transcripts and compute escape profile
  let totalEntries = 0;
  let escapeIntoDefined = 0;
  let escapeIntoUndefined = 0;

  for (const ledger of ledgers) {
    const entries = readTranscript(repoRoot, ledger.declarer) as TranscriptEntry[];
    totalEntries += entries.length;
    const profile = escapeProfile(entries);
    escapeIntoDefined += profile.intoDefined;
    escapeIntoUndefined += profile.intoUndefined;
  }

  const totalEscapes = escapeIntoDefined + escapeIntoUndefined;
  const escapeRate = totalEntries === 0 ? 0 : totalEscapes / totalEntries;

  const converging = escapeRate < ESCAPE_RATE_THRESHOLD && freedomChurn < CHURN_THRESHOLD;

  return {
    escapeRate,
    escapeIntoDefined,
    escapeIntoUndefined,
    totalEntries,
    freedomChurn,
    liveFreedoms,
    supersededFreedoms,
    converging,
  };
}

/**
 * Format the snapshot for one-line logging in the heartbeat workflow.
 */
export function formatConvergence(s: ConvergenceSnapshot): string {
  const escPct = (s.escapeRate * 100).toFixed(1);
  const churnPct = (s.freedomChurn * 100).toFixed(1);
  const status = s.converging ? "CONVERGING" : "OPEN";
  return `[mutation-convergence] ${status}: escape=${escPct}% (${s.escapeIntoDefined}def+${s.escapeIntoUndefined}undef/${s.totalEntries}), churn=${churnPct}% (${s.supersededFreedoms}/${s.liveFreedoms + s.supersededFreedoms}), live=${s.liveFreedoms}`;
}
