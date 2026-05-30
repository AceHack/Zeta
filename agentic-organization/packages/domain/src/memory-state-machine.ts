/**
 * Memory lifecycle state machine — the observe→decide kernel for memory.
 * Determinism computes the LEGAL set of next phases from the current phase;
 * the maintenance cycle (MEM6) classifies each as AUTO (decay/reinforce/archive
 * — the system applies it) or DECIDED (promote/demote/conflict — a hat wears the
 * authority and picks within the legal set). Every transition emits one org_event.
 *
 * Archived is terminal (weight floored to 0 — the memory never surfaces again,
 * but the row is retained for audit). protected memories are never auto-archived
 * or auto-demoted.
 */

import { MemoryPhase, isTerminalMemory } from "./memory-record.ts";

/** Who applies a legal transition. */
export const MemoryTransitionAuthority = {
  /** the system applies it deterministically (decay, reinforce, archive-floor) */
  Auto: "auto",
  /** a hat wears authority and chooses within the legal set (promote/demote/conflict) */
  HatDecided: "hat_decided",
} as const;
export type MemoryTransitionAuthority =
  (typeof MemoryTransitionAuthority)[keyof typeof MemoryTransitionAuthority];

export type MemoryLegalTransition = {
  to: MemoryPhase;
  authority: MemoryTransitionAuthority;
  /** the signal that makes this transition legal (for the org_event decision text) */
  reason: string;
};

/**
 * The legal next-phases from a given phase. Pure — no thresholds applied here;
 * the maintenance cycle decides which legal transitions actually fire based on
 * weight/decay/outcome signals.
 */
export function legalMemoryTransitions(phase: MemoryPhase): readonly MemoryLegalTransition[] {
  if (isTerminalMemory(phase)) return [];
  const A = MemoryTransitionAuthority.Auto;
  const D = MemoryTransitionAuthority.HatDecided;
  switch (phase) {
    case MemoryPhase.Draft:
      return [
        { to: MemoryPhase.Active, authority: A, reason: "first observation confirmed the memory" },
        { to: MemoryPhase.Archived, authority: A, reason: "weight fell to the archive floor" },
      ];
    case MemoryPhase.Active:
      return [
        { to: MemoryPhase.Reinforced, authority: A, reason: "reinforcement crossed threshold" },
        { to: MemoryPhase.Stale, authority: A, reason: "freshness decayed past threshold" },
        { to: MemoryPhase.Promoted, authority: D, reason: "observed across scopes — promote up a tier" },
        { to: MemoryPhase.Demoted, authority: D, reason: "outcome correlation turned negative" },
        { to: MemoryPhase.Conflicted, authority: D, reason: "conflicts with another active memory" },
      ];
    case MemoryPhase.Reinforced:
      return [
        { to: MemoryPhase.Active, authority: A, reason: "reinforcement decayed back to baseline" },
        { to: MemoryPhase.Stale, authority: A, reason: "freshness decayed past threshold" },
        { to: MemoryPhase.Promoted, authority: D, reason: "observed across scopes — promote up a tier" },
        { to: MemoryPhase.Conflicted, authority: D, reason: "conflicts with another active memory" },
      ];
    case MemoryPhase.Stale:
      return [
        { to: MemoryPhase.Active, authority: A, reason: "re-confirmed after going stale" },
        { to: MemoryPhase.Demoted, authority: D, reason: "stale and outcome correlation negative" },
        { to: MemoryPhase.Archived, authority: A, reason: "weight fell to the archive floor" },
      ];
    case MemoryPhase.Promoted:
      return [
        { to: MemoryPhase.Active, authority: A, reason: "promotion settled into a higher tier" },
        { to: MemoryPhase.Conflicted, authority: D, reason: "conflicts with another active memory" },
      ];
    case MemoryPhase.Demoted:
      return [
        { to: MemoryPhase.Active, authority: D, reason: "outcome correlation recovered" },
        { to: MemoryPhase.Archived, authority: A, reason: "weight fell to the archive floor" },
      ];
    case MemoryPhase.Conflicted:
      return [
        { to: MemoryPhase.Active, authority: D, reason: "conflict resolved in this memory's favor" },
        { to: MemoryPhase.Demoted, authority: D, reason: "conflict resolved against this memory" },
        { to: MemoryPhase.Archived, authority: D, reason: "conflict resolved by retiring this memory" },
      ];
    default:
      return [];
  }
}

export function isLegalMemoryTransition(from: MemoryPhase, to: MemoryPhase): boolean {
  return legalMemoryTransitions(from).some((t) => t.to === to);
}

/** The legal-set as bare phases (observe→decide: chooser picks an index within this). */
export function legalMemoryNextPhases(phase: MemoryPhase): readonly MemoryPhase[] {
  return legalMemoryTransitions(phase).map((t) => t.to);
}
