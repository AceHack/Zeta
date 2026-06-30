/**
 * HatSwap — append-only tick event for a single hat-binding transition.
 *
 * Faithful port of
 * `full-ai-cluster/k8s/applications/hat-system/crds/hatswap.yaml` (Merge1 §07).
 * Immutable (MP-4 retraction-native): controllers WRITE one HatSwap per state
 * transition and NEVER update an existing one. Room telemetry streams these via
 * the §04 bus to NATS subject `zeta.society.hats.ticks`.
 */

/** The 7 HatSwap event types (hatswap.yaml `spec.event` enum). */
export type HatSwapEvent =
  | "SwapOn" // Binding created and Active
  | "SwapOff" // Binding deleted or Revoked
  | "WarmupBegin" // Probation entry
  | "WarmupEnd" // Probation exit (Active)
  | "Probation" // Anomaly-triggered authority drop
  | "QuorumGrant" // Quorum signature collected
  | "Throttled"; // Throttle denied a binding/swap

export interface HatSwapBindingRef {
  readonly name: string;
  readonly namespace: string;
  readonly uid: string;
}

export interface HatSwapPreviousWearer {
  readonly spiffeID: string;
  readonly revokedAt: string; // ISO-8601
}

/** A single append-only HatSwap record. */
export interface HatSwap {
  readonly id: string; // ZetaId
  readonly hat: string;
  readonly wearer: { readonly spiffeID: string };
  readonly event: HatSwapEvent;
  readonly occurredAt: string; // ISO-8601
  readonly reason?: string; // short machine-readable code (e.g. "CooldownActive")
  readonly message?: string; // human-readable detail
  readonly bindingRef?: HatSwapBindingRef;
  readonly throttleName?: string; // which throttle fired, if event === "Throttled"
  readonly previousWearer?: HatSwapPreviousWearer; // for SwapOn — the prior holder, if any
}

/**
 * Append a HatSwap to the event log. Returns a NEW array (append-only —
 * never mutates an existing record, never reorders). MP-4 retraction-native.
 */
export function emitSwap(log: readonly HatSwap[], swap: HatSwap): readonly HatSwap[] {
  return [...log, swap];
}

/** Construct a HatSwap record (all fields explicit; deterministic). */
export function makeHatSwap(input: HatSwap): HatSwap {
  return input;
}
