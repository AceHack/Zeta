/**
 * corporate/hat-binding.ts — wearing a hat is TEMPORAL. It warms up, it is active, it expires.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * Until now a hat in this register was a permanent property of an agent: `bindHatToLoop` handed out
 * the authority of a level to anyone who named the hat, forever. So the RMO's whole job — deciding
 * who wears what, and for how long — had no object to act on, and "revoke this agent's authority"
 * was not expressible.
 *
 * A binding is that object. It has a lifetime, and the AUTHORITY IS THE BINDING'S, not the hat's:
 *
 *   Pending ──approve──▶ Warmup ──(warmupEndsAt)──▶ Active ──(expiresAt)──▶ Expired
 *                          │                          │
 *                          └──────release / revoke────┴──▶ Released / Revoked
 *
 * Only `Active` authorizes. That single rule is what makes the lifecycle load-bearing rather than
 * bookkeeping — see `activeAuthorityFor`, and `loop-policy.ts`, which will not bind a hat to the
 * loop without one.
 *
 * ── TIME IS MILLISECONDS, NOT ISO STRINGS ────────────────────────────────────
 * The reference stores `boundAt` / `expiresAt` as ISO strings and `Date.parse`s them back on every
 * advance. That round-trip has a quiet failure: a malformed or absent string parses to `NaN`, and
 * `nowMs >= NaN` is **false** — so the binding never expires and the authority is permanent, which
 * is the exact opposite of what the field was added to guarantee. Numbers here, validated at
 * construction, so an unusable timestamp is refused rather than silently granting forever.
 *
 * Same reason no function here reads a clock: `nowMs` is an argument, because a binding's validity
 * is shared evidence and must not depend on which machine asked
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 */

import { authorityForLevel, type HatAuthority } from "../observe/room/hat-gate";
import type { OrgChart, OrgHat } from "./org-chart";

export const BindingPhase = {
  Pending: "pending",
  Warmup: "warmup",
  Active: "active",
  Expired: "expired",
  Released: "released",
  Revoked: "revoked",
  Succeeded: "succeeded",
} as const;

export type BindingPhase = (typeof BindingPhase)[keyof typeof BindingPhase];

/** Phases in which the binding authorizes nothing further and will not advance again. */
export const TERMINAL_PHASES: ReadonlySet<BindingPhase> = new Set([
  BindingPhase.Expired,
  BindingPhase.Released,
  BindingPhase.Revoked,
  BindingPhase.Succeeded,
]);

export function isTerminal(phase: BindingPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

/** What happens to a hat when its wearer's binding ends. */
export const SuccessionPolicy = {
  /** The next candidate in the roster takes it. Deterministic. */
  Rotate: "rotate",
  /** The same wearer takes it again. */
  Renew: "renew",
  /** An authority decides — the plan names candidates and no successor. */
  Appoint: "appoint",
  /** Nothing automatic; the hat goes unworn until someone is assigned. */
  None: "none",
} as const;

export type SuccessionPolicy = (typeof SuccessionPolicy)[keyof typeof SuccessionPolicy];

/** Defaults for hats that do not specify their own timing. */
export const DEFAULT_WARMUP_MS = 60_000;
export const DEFAULT_TTL_MS = 8 * 3_600_000;
export const DEFAULT_COOLDOWN_MS = 3_600_000;

export interface BindingTiming {
  readonly warmupMs: number;
  readonly ttlMs: number;
  readonly cooldownMs: number;
  readonly succession: SuccessionPolicy;
}

export function timingFor(hat: OrgHat): BindingTiming {
  return {
    warmupMs: hat.warmupMs ?? DEFAULT_WARMUP_MS,
    ttlMs: hat.ttlMs ?? DEFAULT_TTL_MS,
    cooldownMs: hat.cooldownMs ?? DEFAULT_COOLDOWN_MS,
    succession: hat.successionPolicy ?? SuccessionPolicy.Appoint,
  };
}

export interface HatBinding {
  readonly bindingId: string;
  readonly hatId: string;
  readonly wearerAgentId: string;
  readonly phase: BindingPhase;
  readonly boundAtMs: number;
  /** Warmup → Active is legal at or after this. */
  readonly warmupEndsMs: number;
  /** Active → Expired is forced at or after this. */
  readonly expiresMs: number;
  readonly activatedAtMs?: number;
  readonly endedAtMs?: number;
  /** Set on release/expiry. Blocks the same wearer re-taking this hat until then. */
  readonly cooldownUntilMs?: number;
  readonly reason?: string;
}

export type BindingResult =
  | { readonly ok: true; readonly binding: HatBinding }
  | { readonly ok: false; readonly reason: string };

/**
 * Create a binding, in `Warmup`.
 *
 * REFUSES a TTL that does not outlast the warmup. Such a binding expires before it can activate, so
 * it would occupy the hat, block the cooldown of whoever held it, and never authorize anything —
 * a configuration that reads as "this agent is wearing the hat" and never is. The reference computes
 * both offsets independently and never compares them, so the shape is constructible there.
 */
export function beginBinding(
  hat: OrgHat,
  input: { readonly bindingId: string; readonly wearerAgentId: string; readonly nowMs: number },
): BindingResult {
  const t = timingFor(hat);
  if (!Number.isFinite(input.nowMs)) return { ok: false, reason: "nowMs is not a finite number" };
  if (t.warmupMs < 0 || t.ttlMs <= 0 || t.cooldownMs < 0) {
    return { ok: false, reason: `hat '${hat.id}' has non-positive binding timing` };
  }
  if (t.ttlMs <= t.warmupMs) {
    return {
      ok: false,
      reason: `hat '${hat.id}' has ttl ${t.ttlMs}ms <= warmup ${t.warmupMs}ms — the binding would expire before it could activate`,
    };
  }
  return {
    ok: true,
    binding: {
      bindingId: input.bindingId,
      hatId: hat.id,
      wearerAgentId: input.wearerAgentId,
      phase: BindingPhase.Warmup,
      boundAtMs: input.nowMs,
      warmupEndsMs: input.nowMs + t.warmupMs,
      expiresMs: input.nowMs + t.ttlMs,
    },
  };
}

/**
 * Advance a binding by the clock. Pure: the same binding and the same `nowMs` always give the same
 * result, which is what lets a binding's validity be replayed rather than remembered.
 *
 * Expiry is checked BEFORE warmup deliberately. If both are due — a tick that skipped over the whole
 * lifetime — the binding must land on `Expired`, not on `Active`. Checking warmup first would make a
 * long gap between ticks grant authority that had already lapsed, and the longer the outage the more
 * authority it would hand out.
 */
export function advanceBinding(binding: HatBinding, hat: OrgHat, nowMs: number): HatBinding {
  if (isTerminal(binding.phase)) return binding;
  const t = timingFor(hat);

  if (nowMs >= binding.expiresMs) {
    return {
      ...binding,
      phase: BindingPhase.Expired,
      endedAtMs: nowMs,
      cooldownUntilMs: nowMs + t.cooldownMs,
      reason: "ttl reached",
    };
  }
  if (binding.phase === BindingPhase.Warmup && nowMs >= binding.warmupEndsMs) {
    return { ...binding, phase: BindingPhase.Active, activatedAtMs: nowMs };
  }
  return binding;
}

/** A supervisor approves a proposed binding: Pending → Warmup, with the clock starting now. */
export function approveBinding(binding: HatBinding, hat: OrgHat, nowMs: number): BindingResult {
  if (binding.phase !== BindingPhase.Pending) {
    return { ok: false, reason: `binding '${binding.bindingId}' is ${binding.phase}, not pending` };
  }
  const t = timingFor(hat);
  return {
    ok: true,
    binding: {
      ...binding,
      phase: BindingPhase.Warmup,
      boundAtMs: nowMs,
      warmupEndsMs: nowMs + t.warmupMs,
      expiresMs: nowMs + t.ttlMs,
    },
  };
}

/** The wearer or a supervisor returns the hat early. Serves the cooldown. */
export function releaseBinding(binding: HatBinding, hat: OrgHat, nowMs: number, reason: string): BindingResult {
  if (isTerminal(binding.phase)) {
    return { ok: false, reason: `binding '${binding.bindingId}' is already ${binding.phase}` };
  }
  const t = timingFor(hat);
  return {
    ok: true,
    binding: {
      ...binding,
      phase: BindingPhase.Released,
      endedAtMs: nowMs,
      cooldownUntilMs: nowMs + t.cooldownMs,
      reason,
    },
  };
}

/**
 * Forced revocation — policy or incident.
 *
 * NO COOLDOWN is set, and that is not an oversight. Cooldown exists to stop an agent cycling a hat
 * to refresh its own authority; a revocation is a decision that this agent should not hold it, and
 * expressing that as a timer would say the opposite — that it may take it back once the timer runs
 * out. Whether a revoked agent may be re-bound is an authority's decision, not a clock's.
 */
export function revokeBinding(binding: HatBinding, nowMs: number, reason: string): BindingResult {
  if (isTerminal(binding.phase)) {
    return { ok: false, reason: `binding '${binding.bindingId}' is already ${binding.phase}` };
  }
  return { ok: true, binding: { ...binding, phase: BindingPhase.Revoked, endedAtMs: nowMs, reason } };
}

// ─── Authority ──────────────────────────────────────────────────────────────

/**
 * The authority a binding confers RIGHT NOW.
 *
 * `undefined` unless the binding is `Active` and unexpired. This is the rule that makes the whole
 * module load-bearing: a warming-up binding does not authorize yet, and an expired one does not
 * authorize any more, so an agent cannot act on a hat it merely used to hold.
 *
 * The expiry is re-checked here rather than trusted from the phase, because a caller that has not
 * run `advanceBinding` since the deadline holds a binding still marked `Active`. Trusting the field
 * would make the authority depend on how recently someone remembered to tick.
 */
export function activeAuthorityFor(
  chart: OrgChart,
  binding: HatBinding,
  nowMs: number,
): HatAuthority | undefined {
  if (binding.phase !== BindingPhase.Active) return undefined;
  if (nowMs >= binding.expiresMs) return undefined;
  const hat = chart.byId.get(binding.hatId);
  return hat === undefined ? undefined : authorityForLevel(hat.level);
}

/** Is this binding conferring authority at `nowMs`? */
export function isAuthorizing(binding: HatBinding, nowMs: number): boolean {
  return binding.phase === BindingPhase.Active && nowMs < binding.expiresMs;
}

// ─── Cooldown and eligibility ───────────────────────────────────────────────

/**
 * May `agentId` take `hatId` at `nowMs`, given every binding on record?
 *
 * Two refusals:
 *   - the hat is currently held by a live binding (one wearer at a time), and
 *   - this agent is still cooling down on this hat.
 *
 * The cooldown is per (agent, hat) rather than per agent: an agent finishing a stint as tech lead is
 * not thereby barred from every other hat in the organization, which would make cooldown a
 * punishment rather than a rotation.
 */
export function mayTakeHat(
  bindings: readonly HatBinding[],
  agentId: string,
  hatId: string,
  nowMs: number,
  /**
   * How many agents the RMO authorized to wear this hat at once. Default 1 — one wearer at a time.
   *
   * A hat is a ROLE. With one seat per role, MEASURED on the Agentic Team's first real run, three
   * tickets shared two contributor hats and only one ticket could ever move; the org's own
   * `supplyTarget` ("wearers per hat the RMO has authorized") existed and nothing honoured it.
   */
  supply = 1,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const live = bindings.filter((b) => b.hatId === hatId && !isTerminal(b.phase));
  // The SAME agent never holds the same hat twice — that is one person in two places, not supply.
  const mine = live.find((b) => b.wearerAgentId === agentId);
  if (mine !== undefined) {
    return { ok: false, reason: `hat '${hatId}' is already held by '${agentId}' (${mine.phase})` };
  }
  if (live.length >= Math.max(1, supply)) {
    const first = live[0] as HatBinding;
    return {
      ok: false,
      reason:
        supply <= 1
          ? `hat '${hatId}' is held by '${first.wearerAgentId}' (${first.phase})`
          : `hat '${hatId}' is at its authorized supply (${String(live.length)}/${String(supply)} wearers)`,
    };
  }
  const cooling = bindings.find(
    (b) =>
      b.hatId === hatId &&
      b.wearerAgentId === agentId &&
      b.cooldownUntilMs !== undefined &&
      nowMs < b.cooldownUntilMs,
  );
  if (cooling !== undefined) {
    return {
      ok: false,
      reason: `'${agentId}' is cooling down on '${hatId}' until ${cooling.cooldownUntilMs}`,
    };
  }
  return { ok: true };
}

/** The live binding for a hat, if anyone holds it. */
export function bindingForHat(bindings: readonly HatBinding[], hatId: string): HatBinding | undefined {
  return bindings.find((b) => b.hatId === hatId && !isTerminal(b.phase));
}

/** Advance every non-terminal binding to `nowMs`. The tick the runtime calls. */
export function advanceAll(
  bindings: readonly HatBinding[],
  chart: OrgChart,
  nowMs: number,
): readonly HatBinding[] {
  return bindings.map((b) => {
    const hat = chart.byId.get(b.hatId);
    return hat === undefined ? b : advanceBinding(b, hat, nowMs);
  });
}

// ─── Succession ─────────────────────────────────────────────────────────────

export interface SuccessionPlan {
  readonly hatId: string;
  readonly policy: SuccessionPolicy;
  readonly candidateAgentIds: readonly string[];
  /** Absent when an authority must decide. */
  readonly nextWearerAgentId?: string;
}

/**
 * Is this agent still cooling down on this hat?
 *
 * EXTRACTED from `assignment-engine`, where it was four inlined conditions inside a `find`. A rule
 * that lives only inside its caller cannot be falsified on its own — the same reason `inboxOrder`
 * and `gateChooserFrom` were pulled out of theirs — and this one decides who may be staffed, which
 * makes "the cooldown quietly stopped applying" a defect nobody would see except as an agent
 * cycling through a hat it should have been resting from.
 *
 * ABSENT `cooldownUntilMs` is NOT cooling. A binding that never recorded one is a binding whose
 * cooldown was never started; reading the silence as "still cooling" would strand an agent forever
 * on the strength of a missing field.
 */
export function isInCooldown(
  bindings: readonly HatBinding[],
  hatId: string,
  agentId: string,
  nowMs: number,
): boolean {
  return bindings.some(
    (b) =>
      b.hatId === hatId &&
      b.wearerAgentId === agentId &&
      b.cooldownUntilMs !== undefined &&
      nowMs < b.cooldownUntilMs,
  );
}

/**
 * Who takes the hat next.
 *
 * `Rotate` is deterministic — the candidate after the last wearer, wrapping. `Renew` returns the
 * same wearer. `Appoint` and `None` deliberately leave the successor UNDECIDED: those policies route
 * to an authority, and inventing a successor here would be this module making a staffing decision it
 * has no standing to make.
 *
 * A rotation whose last wearer is not in the roster starts from the top rather than failing — a
 * wearer can legitimately have left the candidate pool, and a hat that cannot be handed on because
 * its previous holder is gone is the succession problem, not a solution to it.
 */
export function planSuccession(input: {
  readonly hat: OrgHat;
  readonly candidateAgentIds: readonly string[];
  readonly lastWearerAgentId: string;
}): SuccessionPlan {
  const policy = timingFor(input.hat).succession;
  const base = { hatId: input.hat.id, policy, candidateAgentIds: input.candidateAgentIds };

  if (policy === SuccessionPolicy.Renew) {
    return { ...base, nextWearerAgentId: input.lastWearerAgentId };
  }
  if (policy === SuccessionPolicy.Rotate && input.candidateAgentIds.length > 0) {
    const i = input.candidateAgentIds.indexOf(input.lastWearerAgentId);
    // `indexOf` returning -1 makes this `(0) % n` — the top of the roster, which is the right answer
    // for a wearer who has left the pool.
    const next = input.candidateAgentIds[(i + 1) % input.candidateAgentIds.length];
    return next === undefined ? base : { ...base, nextWearerAgentId: next };
  }
  return base;
}
