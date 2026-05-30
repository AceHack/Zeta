/**
 * HatBinding — an agent wearing a hat for a scoped duration. The phase advances
 * deterministically from the bound timestamp + the hat's warmup/TTL against the
 * DB clock (CLUSTER_NATIVE_HAT_SYSTEM.md §Time-Bounded Hat Binding).
 *
 *   Pending → Warmup (warmupSeconds) → Active → Expired (tokenTtlSeconds)
 *                                            ↘ Released | Succeeded | Revoked | Probation
 *
 * Cooldown is stamped on release (`cooldownUntil`) so re-capture rules are a
 * pure timestamp comparison.
 */

export const HatBindingPhase = {
  Pending: "pending",
  Warmup: "warmup",
  Active: "active",
  Probation: "probation",
  Expired: "expired",
  Released: "released",
  Succeeded: "succeeded",
  Revoked: "revoked",
} as const;

export type HatBindingPhase = (typeof HatBindingPhase)[keyof typeof HatBindingPhase];

/** Terminal phases: the binding no longer authorizes anything. */
export const TerminalHatBindingPhases: ReadonlySet<HatBindingPhase> = new Set([
  HatBindingPhase.Expired,
  HatBindingPhase.Released,
  HatBindingPhase.Succeeded,
  HatBindingPhase.Revoked,
]);

export type HatBinding = {
  id: string;
  hatId: string;
  organizationId: string;
  wearerAgentId: string;
  phase: HatBindingPhase;
  /** ISO timestamp the binding was created (entered Pending) */
  boundAt: string;
  /** boundAt + warmupSeconds — Warmup→Active is legal at/after this */
  warmupEndsAt: string;
  /** boundAt + tokenTtlSeconds — Active→Expired is forced at/after this */
  expiresAt: string;
  /** set when Active */
  activatedAt?: string;
  /** set when terminal */
  endedAt?: string;
  /** set on release/expiry: endedAt + cooldownSeconds; blocks same-wearer recapture */
  cooldownUntil?: string;
  reason?: string;
};

export function isTerminalHatBinding(binding: HatBinding): boolean {
  return TerminalHatBindingPhases.has(binding.phase);
}
