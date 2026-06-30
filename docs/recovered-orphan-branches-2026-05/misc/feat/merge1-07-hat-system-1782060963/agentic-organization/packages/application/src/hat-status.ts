/**
 * Hat status helpers — reputation accrual on the hat.
 *
 * Faithful port of the `Hat.status.reputation` semantics from the K8s Hat CRD
 * (Merge1 §07 §3.6). Reputation accrues on the hat AND the pairings — never
 * only the agent. Pure + immutable (returns a new `HatDefinition`).
 */

import type { HatDefinition, HatStatus } from "../../domain/src/hat-definition.ts";

const EMPTY_STATUS: HatStatus = { reputation: 0, currentWearers: [], lifetimeWearers: 0 };

/** Apply a reputation delta to a hat's status, returning a new hat. */
export function updateHatReputation(hat: HatDefinition, delta: number): HatDefinition {
  const current = hat.status ?? EMPTY_STATUS;
  return {
    ...hat,
    status: { ...current, reputation: current.reputation + delta },
  };
}

/** Record a new wearer taking the hat: appends to currentWearers, bumps lifetime. */
export function recordWearerOn(hat: HatDefinition, wearerId: string): HatDefinition {
  const current = hat.status ?? EMPTY_STATUS;
  if (current.currentWearers.includes(wearerId)) return hat;
  return {
    ...hat,
    status: {
      ...current,
      currentWearers: [...current.currentWearers, wearerId],
      lifetimeWearers: current.lifetimeWearers + 1,
    },
  };
}

/** Record a wearer leaving the hat: removes from currentWearers (lifetime unchanged). */
export function recordWearerOff(hat: HatDefinition, wearerId: string): HatDefinition {
  const current = hat.status ?? EMPTY_STATUS;
  return {
    ...hat,
    status: { ...current, currentWearers: current.currentWearers.filter((w) => w !== wearerId) },
  };
}
