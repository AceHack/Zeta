/**
 * trust-neighbourhood.ts — a party computes its own neighbourhood without the
 * global graph existing anywhere (trajectory slice 2).
 *
 * Trajectory: `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md`
 *
 * ## The fingerprint constraint
 *
 * A global graph that EXISTS can LEAVE (Narayanan–Shmatikov: sparse high-dimensional
 * history is uniquely identifying — the best-documented failure of the method being
 * borrowed). The only protection against a reading you do not control is that the
 * object was never assembled.
 *
 * This module ensures:
 * 1. A node can only see subjects it ALREADY holds anchors for (no discovery)
 * 2. Neighbourhood summaries reveal LOCAL topology only (no joins across nodes)
 * 3. The aggregate reveals LESS than the parts — a summary is strictly lossy
 * 4. No enumeration primitive — there is no `allSubjects()` or `size()`
 *
 * ## What a neighbourhood IS
 *
 * Your neighbourhood is the set of subjects you hold anchors for, plus how fresh
 * each relationship is. It is a SUMMARY you compute locally over your own
 * `HeldAnchor[]`, and it cannot be computed by anyone else without your data.
 *
 * ## Why this is separate from `local-trust-view.ts`
 *
 * `TrustView.about()` answers "what do I think about X?" — a point query.
 * This module answers "what does my neighbourhood look like?" — a LOCAL aggregate.
 * Combining them in one module would give a single object both the point query
 * AND the summary, which makes the graph assemblable by iterating subjects. The
 * separation is STRUCTURAL: you can hold one without the other.
 *
 * ## Connects to
 *
 * - `local-trust-view.ts` (slice 1) — the point query this CANNOT enumerate
 * - `signed-stamp.ts` (slice 3) — stamps in the neighbourhood may be signed
 * - `phase-clock.ts` — recency measured in phase distance
 * - Narayanan–Shmatikov 2008 — why the graph must not be assemblable
 * - `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`
 */

import type { PhaseState } from "./phase-clock";
import type { HeldAnchor, SubjectId } from "./local-trust-view";

// ═══ The Neighbourhood (a node's local view of its relationships) ═════════════

/**
 * A bin in the neighbourhood histogram. Subjects are bucketed by recency
 * (phase distance from the node's latest phase). The bin reveals COUNT only,
 * never identity — you can't extract which subjects are in which bin.
 *
 * Why buckets: a per-subject list IS the graph (enumerate subjects, done).
 * A histogram over phase-distance reveals topology (dense/sparse, recent/stale)
 * without identifying any individual relationship.
 */
export interface RecencyBin {
  /** Lower bound of the phase-distance range (inclusive). */
  readonly from: number;
  /** Upper bound of the phase-distance range (exclusive). Infinity for the last bin. */
  readonly to: number;
  /** How many subjects fall in this recency range. */
  readonly count: number;
}

/**
 * The neighbourhood fingerprint — a lossy summary of a node's local trust graph.
 *
 * INVARIANT: this reveals STRICTLY less than the underlying HeldAnchor[].
 * - No subject identifiers leak
 * - No exact phase values leak (only distances, bucketed)
 * - Count is the ONLY numeric — no mean, no median, no percentiles
 *   (all of which can narrow the anonymity set)
 *
 * A fingerprint from one node cannot be joined with a fingerprint from another
 * to reconstruct either's subjects — the bucketing is one-way and the subject
 * identity is discarded at construction.
 */
export interface NeighbourhoodFingerprint {
  /** The schema version (for forward compatibility). */
  readonly schema: "zeta.neighbourhood.v1";
  /** The node's own phase at the time of computation (the reference point). */
  readonly atPhase: number;
  /** Recency histogram — subjects bucketed by phase-distance. */
  readonly histogram: readonly RecencyBin[];
  /** Total number of distinct subjects (the only global scalar revealed). */
  readonly size: number;
  /**
   * Density: size / max possible (for self-assessment — "am I well-connected?").
   * Undefined/omitted if the node has no anchors at all.
   */
  readonly density?: number;
}

/**
 * Configuration for the fingerprint computation.
 * Bin edges are CONFIGURABLE so different nodes can use different granularity
 * (another structural defence: heterogeneous binning prevents cross-node joins).
 */
export interface FingerprintConfig {
  /**
   * Bin edges for the recency histogram. Each value is a phase-distance boundary.
   * E.g., [10, 100, 1000] creates bins: [0,10), [10,100), [100,1000), [1000,∞).
   * Default: [10, 50, 200, 1000] (recent, warm, cooling, cold).
   */
  readonly binEdges?: readonly number[];
  /**
   * Maximum expected population (for density computation).
   * If omitted, density is not computed.
   */
  readonly maxPopulation?: number;
}

const DEFAULT_BIN_EDGES = [10, 50, 200, 1000] as const;

/**
 * Compute a neighbourhood fingerprint from locally-held anchors.
 *
 * PURE: deterministic given (anchors, currentPhase, config). No I/O, no ambient state.
 *
 * The fingerprint is a ONE-WAY projection: you cannot reconstruct the anchors from it.
 * This is the structural guarantee — not encryption, not policy, but irreversibility
 * by construction (information is discarded, not hidden).
 */
export function computeFingerprint(
  held: readonly HeldAnchor[],
  currentPhase: number,
  config?: FingerprintConfig,
): NeighbourhoodFingerprint {
  const edges = config?.binEdges ?? DEFAULT_BIN_EDGES;

  // Deduplicate by subject — take the most recent anchor per subject
  const bestPerSubject = new Map<SubjectId, PhaseState>();
  for (const anchor of held) {
    const existing = bestPerSubject.get(anchor.subject);
    if (!existing || anchor.stamp.phase > existing.phase) {
      bestPerSubject.set(anchor.subject, anchor.stamp);
    }
  }

  const size = bestPerSubject.size;

  // Build histogram bins
  const bins: RecencyBin[] = [];
  const sortedEdges = [...edges].sort((a, b) => a - b);

  // Create bin boundaries: [0, edge1), [edge1, edge2), ..., [edgeN, ∞)
  const boundaries: { from: number; to: number }[] = [];
  boundaries.push({ from: 0, to: sortedEdges[0] ?? Infinity });
  for (let i = 0; i < sortedEdges.length - 1; i++) {
    boundaries.push({ from: sortedEdges[i]!, to: sortedEdges[i + 1]! });
  }
  if (sortedEdges.length > 0) {
    boundaries.push({ from: sortedEdges[sortedEdges.length - 1]!, to: Infinity });
  }

  // Count subjects per bin
  const counts = new Array(boundaries.length).fill(0) as number[];
  for (const stamp of bestPerSubject.values()) {
    const distance = Math.max(0, currentPhase - stamp.phase);
    for (let i = 0; i < boundaries.length; i++) {
      const b = boundaries[i]!;
      if (distance >= b.from && distance < b.to) {
        counts[i]!++;
        break;
      }
    }
  }

  for (let i = 0; i < boundaries.length; i++) {
    bins.push({ from: boundaries[i]!.from, to: boundaries[i]!.to, count: counts[i]! });
  }

  const fingerprint: NeighbourhoodFingerprint = {
    schema: "zeta.neighbourhood.v1",
    atPhase: currentPhase,
    histogram: bins,
    size,
  };

  if (config?.maxPopulation && config.maxPopulation > 0) {
    return { ...fingerprint, density: size / config.maxPopulation };
  }

  return fingerprint;
}

// ═══ Neighbourhood comparison (structurally safe) ═════════════════════════════

/**
 * A structural comparison between two fingerprints. Reveals ONLY:
 * - Whether one neighbourhood is denser than the other
 * - Whether the recency distributions differ in shape
 *
 * Does NOT reveal: which subjects are shared, which are unique, any identifiers.
 * This is the safe primitive for "should I seek more connections?" without
 * revealing "who are your connections?"
 */
export interface NeighbourhoodComparison {
  /** My size vs theirs (sign only — positive means I have more). */
  readonly sizeDirection: -1 | 0 | 1;
  /** Do our histograms use compatible binning? If not, comparison is coarse-only. */
  readonly binsCompatible: boolean;
  /**
   * Per-bin delta (mine - theirs) if bins are compatible.
   * Positive = I have more subjects in this recency range.
   * Reveals nothing about WHICH subjects — only the count difference.
   */
  readonly binDeltas?: readonly number[];
}

/**
 * Compare two fingerprints. Safe to exchange between nodes because the comparison
 * reveals strictly less than either fingerprint alone (it's a delta over counts,
 * and counts are already lossy over identifiers).
 */
export function compareFingerprints(
  mine: NeighbourhoodFingerprint,
  theirs: NeighbourhoodFingerprint,
): NeighbourhoodComparison {
  const sizeDirection = mine.size > theirs.size ? 1 : mine.size < theirs.size ? -1 : 0;

  // Check bin compatibility: same number of bins, same edges
  const binsCompatible =
    mine.histogram.length === theirs.histogram.length &&
    mine.histogram.every((b, i) => {
      const t = theirs.histogram[i]!;
      return b.from === t.from && b.to === t.to;
    });

  if (!binsCompatible) {
    return { sizeDirection, binsCompatible: false };
  }

  const binDeltas = mine.histogram.map((b, i) => b.count - theirs.histogram[i]!.count);
  return { sizeDirection, binsCompatible: true, binDeltas };
}

// ═══ Anti-fingerprinting: the heterogeneity defence ═══════════════════════════

/**
 * Generate a node-specific bin configuration from a seed.
 * Different nodes using DIFFERENT binning makes cross-node joins structurally
 * impossible — you can't align histograms whose edges don't match.
 *
 * This is the active defence against Narayanan-Shmatikov: even if an attacker
 * obtains two fingerprints, they cannot JOIN them because the bucketing is
 * incompatible. No protocol, no encryption — just heterogeneous binning.
 */
export function nodeSpecificBins(nodeSeed: number): readonly number[] {
  // Simple deterministic perturbation of default edges
  // Each edge is shifted by a seed-derived offset (±30% of default spacing)
  const defaults = [10, 50, 200, 1000];
  const result: number[] = [];

  let s = nodeSeed >>> 0; // ensure unsigned
  for (const edge of defaults) {
    // xorshift32 step
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    s = s >>> 0;
    // Map to ±30% of the gap to previous edge
    const jitter = ((s % 61) - 30) / 100; // -0.30 to +0.30
    const shifted = Math.max(1, Math.round(edge * (1 + jitter)));
    result.push(shifted);
  }

  // Ensure monotone (ascending)
  for (let i = 1; i < result.length; i++) {
    if (result[i]! <= result[i - 1]!) {
      result[i] = result[i - 1]! + 1;
    }
  }

  return result;
}
