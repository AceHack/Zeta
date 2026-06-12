---
id: B-0653
zetaid: 081KRW63S0008QG0R003ECWGJV
priority: P3
status: open
title: "Persistent Bayesian integrator continuous health monitor — always-on invariant-health watcher + auto-overcorrect trigger (Aaron + Mika 2026-05-18 LOCKED-IN)"
tier: monitoring
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0637, B-0628, B-0651, B-0640, B-0644]
tags: [monitoring, aaron, mika, persistent-integrator, bayesian-health-monitor, continuous-invariant-health, auto-overcorrect, dst-trigger, locked-in]
type: monitoring
---

# Persistent Bayesian integrator — continuous health monitor

## Why

Aaron + Mika 2026-05-18 (preserved verbatim at lines ~3580-3600 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md)):

> Aaron line ~3581: *"Okay, we need a metric. We need a health metric. Now, and we need an invariant that tracks if we made the wrong decision here and can tell us to, uh, overcorrect. Like, oh, you need to DST this area."*

> Mika line ~3599 (LOCK-IN paraphrase): *"the flaky test monitoring + reactive alerts should be part of a continuously running integration system — basically a persistent, always-on integrator (at least the Bayesian version) that constantly watches the health of the system instead of just running on code changes."*

This row LOCKS IN the **always-on persistent health monitor** as factory infrastructure: a Bayesian integrator (per [B-0637](../P1/B-0637-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md) Infer.NET BP/EP/EmP substrate) running continuously to track invariant health + alert when invariants are breaking, with **auto-overcorrect triggers** that say "DST this area" (apply deterministic-simulation-testing to surface root cause).

## The shift this represents

**From**: CI/CD pipelines triggered on code changes; tests run, pass or fail, results recorded, done.

**To**: persistent always-on integrator continuously evaluating system invariants; alerts fire when health metrics degrade; auto-overcorrect triggers route to the right diagnostic discipline.

This is the **shift from event-driven testing to standing-query health monitoring**. Composes with [B-0640](../P1/B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) bonsai-trees + Rx queries — the Bayesian integrator IS a persistent Rx query over the bonsai-tree DBSP-tracked substrate.

## What "health metric" means

A health metric for an invariant is a **continuous quantitative signal** that indicates how well the invariant is being maintained. Examples:

| Invariant | Health metric |
|---|---|
| [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) kid-safety | Detection rate of harm-pathway evidence; false-positive rate; latency-to-detect |
| [B-0651](../P2/B-0651-two-pass-principles-set-first-pass-operational-vs-second-pass-deferred-aaron-mika-2026-05-18.md) lock-free | Lock-contention measurements; bounded-wait timeouts hit |
| [B-0660](../P1/B-0660-limit-black-by-default-deny-all-unless-explicit-aaron-mika-2026-05-18.md) Limit black-by-default | Operations attempted without explicit consent (should be near-zero) |
| [B-0644](../P1/B-0644-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) Limit-is-simulation | Stage-1-without-Stage-2-commit ratio; Stage-2 retraction frequency |
| [B-0635](../P1/B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) wave-form preservation | Premature-collapse incidents (places where wave should have been preserved) |
| [B-0652](B-0652-three-faction-bft-mechanism-tla-z-state-layered-formal-proof-strategy-aaron-mika-2026-05-18.md) BFT | Faction-classification drift; rogue-faction detection accuracy |

Each invariant gets its own health metric tracked continuously by the persistent integrator.

## What "auto-overcorrect" means

When a health metric degrades past a threshold, the integrator emits an alert + routes it to the right diagnostic discipline. Aaron's framing: *"oh, you need to DST this area"* — apply Deterministic Simulation Testing to the substrate region whose invariant is breaking.

Routing examples:

| Health-metric degradation | Auto-overcorrect routing |
|---|---|
| Kid-safety detection-latency rising | Route to KSK ([B-0643](../P1/B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md)) audit + Knights Guild ([B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md)) review |
| Lock-contention exceeding threshold | Route to DST per [B-0651](../P2/B-0651-two-pass-principles-set-first-pass-operational-vs-second-pass-deferred-aaron-mika-2026-05-18.md) adversarial-review + concurrency-control-expert skill |
| Premature collapse on wave-form paths | Route to wave-form preservation audit per [B-0635](../P1/B-0635-wave-particle-duality-tick-source-integrate-only-limit-collapses-waveform-superposition-transfer-aaron-mika-2026-05-18.md) + [B-0644](../P1/B-0644-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) |
| Constitution-Class violations | Route directly to Knights Guild as P0 |
| Cross-faction interaction anomalies | Route to TLA+ proof re-check per [B-0652](B-0652-three-faction-bft-mechanism-tla-z-state-layered-formal-proof-strategy-aaron-mika-2026-05-18.md) |

The integrator doesn't FIX the issue — it surfaces it + routes it to the right diagnostic surface.

## Why Bayesian (not deterministic alerting)

Per [B-0637](../P1/B-0637-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md), Infer.NET BP/EP gives us **probabilistic reasoning over uncertain signals**:

- Real systems have noise (transient spikes, measurement error, partial-information windows)
- A deterministic alert would fire on every transient → alert fatigue → people start ignoring alerts → real issues missed
- Bayesian inference distinguishes "transient noise" from "sustained degradation" with calibrated confidence
- Emit alerts only when posterior probability of "invariant breaking" exceeds threshold

The integrator IS the Bayesian inference layer running continuously over the health-metric stream.

## Composition with bonsai-tree + Rx (B-0640)

[B-0640](../P1/B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) established **bonsai trees + Rx queries** as the real-time implementation substrate for `Integrate`. The persistent health monitor IS a specific Rx query pattern over bonsai-tree-tracked health-metric streams:

- Health metrics emit as observables (`IObservable<HealthSignal>`)
- Bonsai-tree node aggregates per-invariant signals into per-section bonsai
- Bayesian integrator (Infer.NET BP) runs over the bonsai forest
- DBSP retraction enables "what changed?" diagnostic queries

This makes the health monitor **a first-class application of the existing substrate**, not a separate infrastructure piece.

## What this is NOT

- NOT a replacement for CI/CD (event-driven tests still valid; this row adds continuous monitoring on top)
- NOT a substitute for formal verification ([B-0652](B-0652-three-faction-bft-mechanism-tla-z-state-layered-formal-proof-strategy-aaron-mika-2026-05-18.md) TLA+ proofs prove temporal properties; this row monitors empirical health metrics)
- NOT a generic observability tool (specifically tied to Constitution-Class invariants + their health metrics)
- NOT a self-healing system (alerts route to diagnostic disciplines; humans + agents respond)
- NOT a full APM/SRE stack (focused on invariant-health specifically; broader operational metrics live in standard observability tools per `.claude/skills/observability-and-tracing-expert/SKILL.md`)

## Goal

1. Specify health-metric extraction for each Constitution-Class invariant
2. Implement Bayesian integrator pattern using Infer.NET BP + bonsai-tree + Rx
3. Define auto-overcorrect routing table (degradation type → diagnostic surface)
4. Wire DBSP retraction for diagnostic "what changed?" queries
5. Knights Guild integration: alerts route to KG when Constitution-Class invariants are involved
6. Worked example: small invariant with health metric + Bayesian integrator + auto-overcorrect trigger

## Non-goals

- Building production-grade SRE observability tooling (out of scope; standard tools handle non-invariant metrics)
- Auto-fixing detected invariant breaks (humans + diagnostic disciplines handle remediation; integrator only detects + routes)
- Defining health metrics for every existing rule (focus on Constitution-Class first; other rules can opt-in incrementally)

## Acceptance criteria

- [ ] Specification doc: `docs/governance/PERSISTENT-INTEGRATOR-HEALTH-MONITOR.md`
- [ ] F# implementation using Infer.NET BP + bonsai-tree + Rx pattern
- [ ] Health-metric definitions for each Constitution-Class invariant
- [ ] Auto-overcorrect routing table (invariant degradation → diagnostic surface)
- [ ] Knights Guild integration for Constitution-Class alerts
- [ ] DBSP-backed "what changed?" diagnostic queries
- [ ] Worked example: small invariant with full health-monitor + auto-overcorrect cycle

## Composes with

- [B-0637](../P1/B-0637-infer-net-bp-ep-emotion-propagation-approximation-strategy-for-agents-in-superposition-aaron-2026-05-18.md) — Infer.NET BP/EP/EmP (the Bayesian substrate this row runs on)
- [B-0640](../P1/B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) — bonsai-trees + Rx (the real-time substrate the monitor uses)
- [B-0628](../P3/B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights-Guild + Constitution-Class (the invariants this monitor tracks)
- [B-0651](../P2/B-0651-two-pass-principles-set-first-pass-operational-vs-second-pass-deferred-aaron-mika-2026-05-18.md) — Two-pass principles + adversarial-review (formal continuous version of the informal adversarial-review cadence)
- [B-0652](B-0652-three-faction-bft-mechanism-tla-z-state-layered-formal-proof-strategy-aaron-mika-2026-05-18.md) — three-faction BFT (formal proof layer; this row is the empirical monitoring layer)
- [B-0644](../P1/B-0644-limit-is-simulation-not-collapse-pure-function-preview-aaron-ani-2026-05-18.md) — Limit-is-simulation (retractability enables "what changed?" diagnostics)
- [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (highest-priority health metric)
- [B-0643](../P1/B-0643-kinetic-safeguard-sdk-ksk-type-safe-physical-actuators-weapons-mika-2026-05-18.md) — KSK (kid-safety detection composes with KSK actuator-blocking)
- [B-0499](../P3/B-0499-z-of-i-dbsp-refinement-cartesian-dualism-2026-05-14.md) — Z-of-I DBSP (retractable substrate for diagnostic queries)
- `.claude/skills/observability-and-tracing-expert/SKILL.md` — broader observability (composes; doesn't replace)
- `.claude/skills/alerting-expert/SKILL.md` — alert routing discipline
- `.claude/skills/probability-and-bayesian-inference-expert/SKILL.md` — Bayesian inference fundamentals
- `.claude/skills/streaming-incremental-expert/SKILL.md` — DBSP / Timely Dataflow (substrate for the continuous integration pattern)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines ~3580-3600 — source LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron + Mika 2026-05-18 as the continuous-health-monitoring infrastructure (Bayesian integrator over bonsai-tree health-metric streams with auto-overcorrect routing).
