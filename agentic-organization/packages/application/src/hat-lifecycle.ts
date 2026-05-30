/**
 * Hat lifecycle — deterministic binding transitions, each emitting exactly one
 * OrgEvent (the HatSwap-shaped trace record). The phase advances purely from the
 * bound timestamp + the hat's warmup/TTL against the supplied clock, so expiry
 * is DST-replayable and auditable from the row.
 *
 * Determinism here; the agent-driven choices (who to staff, how many hats) live
 * in the assignment engine (P4) and RMO (P3).
 */

import {
  HatBindingPhase,
  TerminalHatBindingPhases,
  type HatBinding,
} from "../../domain/src/hat-binding.ts";
import { OrgEventKind, type OrgEvent } from "../../domain/src/org-event.ts";
import type { HatDefinition } from "../../domain/src/hat-definition.ts";

export type LifecycleClock = {
  nowMs: () => number;
  nowIso: () => string;
};

export type LifecycleContext = {
  clock: LifecycleClock;
  createEventId: () => string;
  /** hat-id path root→actor, for the OrgEvent supervisor chain */
  supervisorChain: readonly string[];
  correlationId: string;
  causationId: string;
  traceId: string;
};

export type BindingTransition = {
  binding: HatBinding;
  event: OrgEvent;
};

function isoFromMsOffset(nowMs: number, offsetSeconds: number, toIso: (ms: number) => string): string {
  return toIso(nowMs + offsetSeconds * 1000);
}

function event(
  ctx: LifecycleContext,
  binding: HatBinding,
  hat: HatDefinition,
  fromState: HatBindingPhase | undefined,
  toState: HatBindingPhase,
  decision: string,
): OrgEvent {
  return {
    id: ctx.createEventId(),
    kind: OrgEventKind.HatBindingTransition,
    occurredAt: ctx.clock.nowIso(),
    organizationId: binding.organizationId,
    actorHatId: hat.id,
    actorAgentId: binding.wearerAgentId,
    departmentId: hat.departmentId,
    subjectId: binding.id,
    ...(fromState !== undefined ? { fromState } : {}),
    toState,
    decision,
    supervisorChain: ctx.supervisorChain,
    evidenceRefs: [],
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    traceId: ctx.traceId,
  };
}

/** Create a binding in Warmup (the assignment already approved the wearer). */
export function beginBinding(
  input: { bindingId: string; hat: HatDefinition; wearerAgentId: string; organizationId: string },
  ctx: LifecycleContext,
): BindingTransition {
  const nowMs = ctx.clock.nowMs();
  const toIso = (ms: number): string => new Date(ms).toISOString();
  const boundAt = ctx.clock.nowIso();
  const binding: HatBinding = {
    id: input.bindingId,
    hatId: input.hat.id,
    organizationId: input.organizationId,
    wearerAgentId: input.wearerAgentId,
    phase: HatBindingPhase.Warmup,
    boundAt,
    warmupEndsAt: isoFromMsOffset(nowMs, input.hat.warmupSeconds, toIso),
    expiresAt: isoFromMsOffset(nowMs, input.hat.tokenTtlSeconds, toIso),
  };
  return { binding, event: event(ctx, binding, input.hat, undefined, HatBindingPhase.Warmup, `${input.hat.name} bound to ${input.wearerAgentId} (warmup ${input.hat.warmupSeconds}s, ttl ${input.hat.tokenTtlSeconds}s)`) };
}

/**
 * Advance a binding deterministically: Warmup→Active at warmupEndsAt,
 * Active→Expired at expiresAt. Returns the (possibly unchanged) binding and the
 * transition event if one fired.
 */
export function advanceBinding(
  binding: HatBinding,
  hat: HatDefinition,
  ctx: LifecycleContext,
): { binding: HatBinding; event?: OrgEvent } {
  if (TerminalHatBindingPhases.has(binding.phase)) {
    return { binding };
  }
  const nowMs = ctx.clock.nowMs();
  const expiresMs = Date.parse(binding.expiresAt);
  const warmupMs = Date.parse(binding.warmupEndsAt);

  if (nowMs >= expiresMs) {
    const next: HatBinding = {
      ...binding,
      phase: HatBindingPhase.Expired,
      endedAt: ctx.clock.nowIso(),
      cooldownUntil: new Date(nowMs + hat.cooldownSeconds * 1000).toISOString(),
      reason: "token ttl reached",
    };
    return { binding: next, event: event(ctx, next, hat, binding.phase, HatBindingPhase.Expired, `${hat.name} binding for ${binding.wearerAgentId} expired (ttl); cooldown ${hat.cooldownSeconds}s`) };
  }

  if (binding.phase === HatBindingPhase.Warmup && nowMs >= warmupMs) {
    const next: HatBinding = { ...binding, phase: HatBindingPhase.Active, activatedAt: ctx.clock.nowIso() };
    return { binding: next, event: event(ctx, next, hat, binding.phase, HatBindingPhase.Active, `${hat.name} binding for ${binding.wearerAgentId} warmed up; authority active`) };
  }

  return { binding };
}

/** Pending → Warmup: a supervisor approves a proposed binding. */
export function approveBinding(binding: HatBinding, hat: HatDefinition, ctx: LifecycleContext): BindingTransition {
  const nowMs = ctx.clock.nowMs();
  const toIso = (ms: number): string => new Date(ms).toISOString();
  const next: HatBinding = {
    ...binding,
    phase: HatBindingPhase.Warmup,
    boundAt: ctx.clock.nowIso(),
    warmupEndsAt: isoFromMsOffset(nowMs, hat.warmupSeconds, toIso),
    expiresAt: isoFromMsOffset(nowMs, hat.tokenTtlSeconds, toIso),
  };
  return { binding: next, event: event(ctx, next, hat, binding.phase, HatBindingPhase.Warmup, `${hat.name} binding approved for ${binding.wearerAgentId}`) };
}

/** Voluntary release: the wearer or a supervisor returns the hat early. */
export function releaseBinding(binding: HatBinding, hat: HatDefinition, ctx: LifecycleContext, reason: string): BindingTransition {
  const nowMs = ctx.clock.nowMs();
  const next: HatBinding = {
    ...binding,
    phase: HatBindingPhase.Released,
    endedAt: ctx.clock.nowIso(),
    cooldownUntil: new Date(nowMs + hat.cooldownSeconds * 1000).toISOString(),
    reason,
  };
  return { binding: next, event: event(ctx, next, hat, binding.phase, HatBindingPhase.Released, `${hat.name} binding released by ${binding.wearerAgentId}: ${reason}`) };
}

/** Forced revocation (policy / incident). */
export function revokeBinding(binding: HatBinding, hat: HatDefinition, ctx: LifecycleContext, reason: string): BindingTransition {
  const next: HatBinding = { ...binding, phase: HatBindingPhase.Revoked, endedAt: ctx.clock.nowIso(), reason };
  return { binding: next, event: event(ctx, next, hat, binding.phase, HatBindingPhase.Revoked, `${hat.name} binding revoked: ${reason}`) };
}

/** Is this agent still cooling down on this hat (cannot re-take yet)? */
export function isInCooldown(binding: HatBinding, agentId: string, nowMs: number): boolean {
  if (binding.wearerAgentId !== agentId || binding.cooldownUntil === undefined) {
    return false;
  }
  return nowMs < Date.parse(binding.cooldownUntil);
}

export type SuccessionPlan = {
  hatId: string;
  policy: HatDefinition["successionPolicy"];
  nextWearerAgentId?: string;
  candidateAgentIds: readonly string[];
};

/**
 * Plan succession for a hat whose binding just ended. For `rotate` the next
 * wearer is deterministic (the candidate after the last wearer). Election /
 * vote / director-assigned policies leave `nextWearerAgentId` undefined — those
 * route to RMO/assignment/voting where an authority hat decides.
 */
export function planSuccession(input: {
  hat: HatDefinition;
  candidateAgentIds: readonly string[];
  lastWearerAgentId: string;
}): SuccessionPlan {
  const { hat, candidateAgentIds, lastWearerAgentId } = input;
  if (hat.successionPolicy === "rotate" && candidateAgentIds.length > 0) {
    const idx = candidateAgentIds.indexOf(lastWearerAgentId);
    const next = candidateAgentIds[(idx + 1) % candidateAgentIds.length];
    return { hatId: hat.id, policy: hat.successionPolicy, candidateAgentIds, ...(next !== undefined ? { nextWearerAgentId: next } : {}) };
  }
  if (hat.successionPolicy === "renew") {
    return { hatId: hat.id, policy: hat.successionPolicy, candidateAgentIds, nextWearerAgentId: lastWearerAgentId };
  }
  return { hatId: hat.id, policy: hat.successionPolicy, candidateAgentIds };
}

export function successionEvent(plan: SuccessionPlan, hat: HatDefinition, organizationId: string, ctx: LifecycleContext): OrgEvent {
  const decision = plan.nextWearerAgentId !== undefined
    ? `succession for ${hat.name} (${plan.policy}): next wearer ${plan.nextWearerAgentId}`
    : `succession for ${hat.name} (${plan.policy}): awaiting authority decision among ${plan.candidateAgentIds.length} candidate(s)`;
  return {
    id: ctx.createEventId(),
    kind: OrgEventKind.SuccessionPlanned,
    occurredAt: ctx.clock.nowIso(),
    organizationId,
    actorHatId: hat.id,
    departmentId: hat.departmentId,
    subjectId: hat.id,
    decision,
    supervisorChain: ctx.supervisorChain,
    evidenceRefs: [],
    correlationId: ctx.correlationId,
    causationId: ctx.causationId,
    traceId: ctx.traceId,
  };
}
