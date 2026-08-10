/**
 * local-neighbourhood.ts — slice 2: compute your neighbourhood without the graph existing.
 *
 * Trajectory: `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md`, slice 2.
 *
 * ## The constraint, and why it is not about internal misreading
 *
 * A party must be able to learn *who it is close to* **without a global graph existing
 * anywhere**. The reason is not that the graph would be misread inside the society — it is
 * that **a graph which exists can leave**, and the only reliable protection against a
 * reading you do not control is that the object was never assembled.
 *
 * This is the best-documented failure of the method being borrowed. Narayanan & Shmatikov
 * (2008) de-anonymised the Netflix Prize dataset by matching sparse, high-dimensional
 * viewing histories against public profiles. No malice and no cooperation were required —
 * just an auxiliary dataset. **Anchor sets have the same shape**: sparse, high-dimensional,
 * history-derived. If the neighbourhood computation works well, it works as a fingerprint.
 *
 * ## The three structural defences, in order of strength
 *
 * 1. **No crawling.** Proximity is computed only over evidence a peer *handed you*
 *    (`offered`). There is no fetch inside this module, so reach is bounded by who chose
 *    to share — not by diligence, bandwidth, or intent.
 * 2. **The output carries no evidence.** `Proximity` holds a coarse band and a count. It
 *    contains no stamps, so **it cannot be fed back in to reach further peers**. Chaining
 *    calls cannot walk a graph, because each hop requires evidence the output does not
 *    supply. This is the load-bearing one: it makes transitive assembly impossible rather
 *    than merely discouraged.
 * 3. **Bounded cardinality and coarsened disclosure.** At most `maxNeighbours` results,
 *    banded rather than exact. A census is not expressible, and the emitted value is
 *    strictly less identifying than the input it was computed from.
 *
 * ## Honest limit — coarsening REDUCES identifiability, it does not remove it
 *
 * k-anonymity-style coarsening is known-weak against an adversary with a good auxiliary
 * dataset; Narayanan & Shmatikov is itself the demonstration. Defence 2 is the one that
 * holds structurally; 3 raises cost and should not be mistaken for a guarantee. Nothing
 * here makes a *deliberately* disclosed neighbourhood safe — it makes an *accidentally*
 * assembled one impossible.
 */

import type { PhaseState } from "./phase-clock";
import type { SubjectId } from "./local-trust-view";

/** Stamps a peer chose to hand over about a shared subject. Nothing is fetched. */
export interface NeighbourEvidence {
  readonly peer: SubjectId;
  readonly stamps: readonly PhaseState[];
}

/**
 * A coarse band, never an exact distance.
 *
 * Exact shared-anchor depth is a high-resolution coordinate — precisely the sparse,
 * high-dimensional quantity that makes a history uniquely identifying. Bands are the
 * disclosure; depth stays private to the node that computed it.
 */
export type ProximityBand = "adjacent" | "near" | "far";

/**
 * Deliberately evidence-free. No stamps, no phases, no seeds — so this value cannot be
 * used as the `offered` input to another call, and therefore cannot extend anyone's reach.
 */
export interface Proximity {
  readonly peer: SubjectId;
  readonly band: ProximityBand;
  /** How many stamps were shared. A count, not the stamps. */
  readonly sharedCount: number;
}

export const DEFAULT_MAX_NEIGHBOURS = 8;

/** Band thresholds on the newest shared phase's distance from our own newest. */
export function bandFor(gap: number): ProximityBand {
  if (gap <= 1) return "adjacent";
  if (gap <= 16) return "near";
  return "far";
}

const key = (s: PhaseState) => `${s.phase}:${s.seed}`;

/**
 * Compute this node's neighbourhood from evidence it was handed.
 *
 * Pure: no I/O, no fetch, no registry. Results are ordered by proximity then peer id so
 * two nodes with the same inputs cannot disagree on ordering (idempotency / DST).
 */
export function localNeighbourhood(
  mine: readonly PhaseState[],
  offered: readonly NeighbourEvidence[],
  opts?: { readonly maxNeighbours?: number },
): readonly Proximity[] {
  const maxNeighbours = opts?.maxNeighbours ?? DEFAULT_MAX_NEIGHBOURS;
  const ours = new Set(mine.map(key));
  const ourNewest = mine.reduce((a, s) => Math.max(a, s.phase), -1);

  const rows: { p: Proximity; sortPhase: number }[] = [];
  for (const ev of offered) {
    const shared = ev.stamps.filter((s) => ours.has(key(s)));
    if (shared.length === 0) continue; // no shared history: not a neighbour, and not reported
    const newestShared = shared.reduce((a, s) => Math.max(a, s.phase), -1);
    const gap = ourNewest >= 0 ? ourNewest - newestShared : 0;
    rows.push({
      p: { peer: ev.peer, band: bandFor(gap), sharedCount: shared.length },
      sortPhase: newestShared,
    });
  }

  return rows
    .sort((a, b) => b.sortPhase - a.sortPhase || a.p.peer.localeCompare(b.p.peer))
    .slice(0, maxNeighbours)
    .map((r) => r.p);
}
