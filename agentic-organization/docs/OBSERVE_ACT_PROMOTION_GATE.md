---
title: Observe-Act Promotion Gate
canonical_name: Agentic Organization
status: current
---

# Observe-Act Promotion Gate

This document records the Phase 2.2 rule for moving a worker lane between
observe-act shadow mode and observe-act primary mode.

The gate is deterministic. Agents may select from legal menu slots, but they do
not decide whether the organization is safe to promote a lane. The runtime
evaluates a promotion window and chooses the effective execution mode.

## Public Modes

The production environment variable is `AGENT_LOOP_MODE`. Its public
`AgentLoopMode` values are:

- `legacy`: run only the legacy Work OS lane.
- `observe_act_shadow`: run legacy Work OS and observe-act side by side. The
  observe-act lane renders the menu, selects the slot, and records evidence, but
  command and MCP dispatch use shadow implementations.
- `observe_act_primary`: run observe-act as the worker lane. Command dispatch,
  tool dispatch, and act-time slot authorization use the real injected runtime.

The composition layer adapts those public values to its internal lane names
(`observe-act-shadow` and `observe-act-primary`). If no explicit promotion
window or source is supplied, composition uses the default Cockroach-backed
rolling window from durable worker-lane `observe_act_tick` events. A fresh or
insufficient durable window resolves to shadow; a clean durable window may
promote on a later tick.

## Promotion

A lane may promote to primary when all of these are true:

- the shadow window has at least 100 ticks or at least 24 hours of soak;
- the shadow window has zero illegal selected slots;
- the divergence rate is no greater than 5%;
- the primary safety counters are below demotion thresholds.

The code path is `evaluateObserveActPromotionGate` in
`apps/workers/src/org-cadence-composition.ts`.

## Demotion

A lane demotes to shadow when either condition is true in the last
30 minutes:

- primary selector rejections are at least 2;
- primary control-bypass rejections are at least 1.

Demotion chooses the safe paired mode: legacy Work OS runs while observe-act
continues to emit shadow evidence. This preserves observability without letting
an unsafe primary lane keep dispatching side effects.

## Evidence

The promotion gate emits evidence refs derived from the window:

- `observe-act-promotion:shadow_ticks:*`
- `observe-act-promotion:shadow_soak_hours:*`
- `observe-act-promotion:shadow_divergence_rate:*`
- `observe-act-promotion:shadow_illegal_selections:*`
- `observe-act-promotion:primary_selector_rejections_30m:*`
- `observe-act-promotion:primary_control_bypass_rejections_30m:*`

The KIND cadence proof records both shadow evidence and a primary-promotion
status. The expected primary proof status is:

```text
observe-act:command:accepted_primary_promotion
```
