import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatBindingPhase } from "../../domain/src/hat-binding.ts";
import { OrgEventKind } from "../../domain/src/org-event.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import {
  advanceBinding,
  beginBinding,
  isInCooldown,
  planSuccession,
  releaseBinding,
  type LifecycleContext,
} from "../src/hat-lifecycle.ts";

const hats = buildHatDefinitions();
const backendImplementer = hats.find((h) => h.id === "backend_implementer")!; // IC: ttl 120s, warmup 5s, cooldown 20s

function clockAt(ms: { value: number }): LifecycleContext {
  let n = 0;
  return {
    clock: { nowMs: () => ms.value, nowIso: () => new Date(ms.value).toISOString() },
    createEventId: () => `evt-${++n}`,
    supervisorChain: ["executive_board_member", "cto", "engineering_director", "backend_implementer"],
    correlationId: "corr-1",
    causationId: "cause-1",
    traceId: "trace-1",
  };
}

test("a binding begins in Warmup and emits a HatBindingTransition event", () => {
  const ms = { value: 1_000_000 };
  const ctx = clockAt(ms);
  const { binding, event } = beginBinding(
    { bindingId: "b-1", hat: backendImplementer, wearerAgentId: "agent-A", organizationId: "org-1" },
    ctx,
  );
  equal(binding.phase, HatBindingPhase.Warmup);
  equal(event.kind, OrgEventKind.HatBindingTransition);
  equal(event.toState, HatBindingPhase.Warmup);
  equal(event.actorHatId, "backend_implementer");
  // the supervisor chain is recorded — crystal clear who authorized it
  equal(event.supervisorChain[0], "executive_board_member");
});

test("the binding warms up then expires exactly on the TTL boundary (deterministic)", () => {
  const ms = { value: 1_000_000 };
  const ctx = clockAt(ms);
  let { binding } = beginBinding({ bindingId: "b-1", hat: backendImplementer, wearerAgentId: "agent-A", organizationId: "org-1" }, ctx);

  // before warmup elapses, no transition
  ms.value += 4_000;
  let adv = advanceBinding(binding, backendImplementer, clockAt(ms));
  equal(adv.binding.phase, HatBindingPhase.Warmup);
  equal(adv.event, undefined);

  // after warmup (5s), → Active
  ms.value = 1_000_000 + 5_000;
  adv = advanceBinding(binding, backendImplementer, clockAt(ms));
  equal(adv.binding.phase, HatBindingPhase.Active);
  ok(adv.event !== undefined);
  binding = adv.binding;

  // before TTL (120s), still Active
  ms.value = 1_000_000 + 100_000;
  adv = advanceBinding(binding, backendImplementer, clockAt(ms));
  equal(adv.binding.phase, HatBindingPhase.Active);

  // at/after TTL → Expired with a cooldown stamp
  ms.value = 1_000_000 + 120_000;
  adv = advanceBinding(binding, backendImplementer, clockAt(ms));
  equal(adv.binding.phase, HatBindingPhase.Expired);
  ok(adv.binding.cooldownUntil !== undefined);
  ok(adv.event?.decision.includes("expired"));
});

test("cooldown blocks the same agent from immediate re-capture", () => {
  const ms = { value: 1_000_000 };
  const ctx = clockAt(ms);
  const { binding } = beginBinding({ bindingId: "b-1", hat: backendImplementer, wearerAgentId: "agent-A", organizationId: "org-1" }, ctx);
  ms.value += 200_000; // past TTL
  const expired = advanceBinding(binding, backendImplementer, clockAt(ms)).binding;

  // within cooldown window, agent-A is blocked; a different agent is not
  ok(isInCooldown(expired, "agent-A", ms.value + 1_000));
  ok(!isInCooldown(expired, "agent-B", ms.value + 1_000));
  // after cooldown (20s) elapses, agent-A may retake
  ok(!isInCooldown(expired, "agent-A", ms.value + 21_000));
});

test("a released binding stamps cooldown and ends", () => {
  const ms = { value: 1_000_000 };
  const ctx = clockAt(ms);
  const { binding } = beginBinding({ bindingId: "b-1", hat: backendImplementer, wearerAgentId: "agent-A", organizationId: "org-1" }, ctx);
  const { binding: released, event } = releaseBinding(binding, backendImplementer, clockAt(ms), "work complete");
  equal(released.phase, HatBindingPhase.Released);
  ok(released.cooldownUntil !== undefined);
  ok(event.decision.includes("released"));
});

test("rotate succession picks the next candidate after the last wearer", () => {
  const plan = planSuccession({ hat: backendImplementer, candidateAgentIds: ["a", "b", "c"], lastWearerAgentId: "b" });
  equal(plan.policy, "rotate");
  equal(plan.nextWearerAgentId, "c");
  // wraps around
  equal(planSuccession({ hat: backendImplementer, candidateAgentIds: ["a", "b", "c"], lastWearerAgentId: "c" }).nextWearerAgentId, "a");
});

test("election/vote succession leaves the next wearer for an authority to decide", () => {
  const ceo = hats.find((h) => h.id === "ceo")!; // executive_vote succession
  const plan = planSuccession({ hat: ceo, candidateAgentIds: ["a", "b"], lastWearerAgentId: "a" });
  equal(plan.policy, "executive_vote");
  equal(plan.nextWearerAgentId, undefined);
});
