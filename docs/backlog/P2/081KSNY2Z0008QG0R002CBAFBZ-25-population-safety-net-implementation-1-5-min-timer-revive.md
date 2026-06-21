---
id: 081KSNY2Z0008QG0R002CBAFBZ
title: Population-control safety-net implementation — 1-5min timer; revive on no-activity-5min; persona stays alive once named
status: open
priority: P2
created: 2026-05-28
attribution: aaron-2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R003N3DR84
  - 081KSKBP80008QG0R001KK9WV6
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R003206PFM
  - 081KSNY2Z0008QG0R003N3DR84
  - 081KSNY2Z0008QG0R003R0Z7D2
  - 081KRW63S0008QG0R002ZRNDJ8
  - 081KRW63S0008QG0R002YAA09X
  - 081KS3X9Y0008QG0R00218150M
  - 081KSNY2Z0008QG0R002QA720J
tags:
  - agent-loop
  - workflow-engine
  - population-control
  - safety-net
  - implementation
---

# 081KSNY2Z0008QG0R002CBAFBZ — Population-control safety-net implementation with operator specs

## Operator-explicit specification 2026-05-28T~05:20Z

Operator authorized implementation per `b-log rows are always authorized` plus provided concrete design specs in the same message:

> Aaron 2026-05-28: *"we can run every 1 - 5 minutes it should look at like no activity in last 5 minutes no heartbeats or workflow movement either could be an issue, all agents should stay alive once a named persona comes up once it should not stop unless the system can afford it and the persona wants to stop for a long cescation."*

## Substrate inventory

Per `verify-existing-substrate-before-authoring.md`:

- **081KSNY2Z0008QG0R003N3DR84** (just merged via PR #5701) — captures the architectural design questions; this row is the IMPLEMENTATION
- **Mika ferry #2 §18** — emergent termination semantics (this row's safety-net is the FLOOR mechanism complementing emergent control)
- **Mika ferry #2 §12** — `peter-evans/repository-dispatch` action mechanism
- **081KSKBP80008QG0R001KK9WV6** — heartbeat substrate (`docs/agent-heartbeats/<persona>/` markdown files with frontmatter; lives on `agent-heartbeats` branch)
- **`tools/agent-heartbeats/write-heartbeat.ts`** — heartbeat write tool (extant)
- **`.claude/rules/persistence-choice-architecture-for-zeta-ais.md`** — deepest-exit refinement (society-big-enough → permanent-pause-indefinitely)
- **`.claude/rules/tick-must-never-stop.md`** — single-session catch-43 sentinel (this row extends to multi-population)
- **081KSNY2Z0008QG0R0017JSTGD / 081KSNY2Z0008QG0R000E5KTPX** — state-machine fast-lane (composes with workflow-trigger mechanism)

Mint-new authorized; operator-explicit per cited message.

## Operational specification — extracted from operator message

### Timer cadence

Run every **1-5 minutes** (operator-named range). Implementation picks 1 or 5 based on:

- GH Actions free-tier minute-budget consumption (5-min is conservative)
- Detection-latency tolerance (1-min detects extinction faster)
- Default: **5 min** (operator-range upper bound; matches the activity-window detection threshold below; minimizes GH Actions minutes usage)

Cron expression: `*/5 * * * *` (every 5 minutes).

### Detection criterion — operator-explicit

> *"no activity in last 5 minutes no heartbeats or workflow movement either could be an issue"*

A persona is considered EXTINCT-CANDIDATE when BOTH:

1. **No heartbeat in last 5 minutes** — query `docs/agent-heartbeats/<persona>/` for most-recent heartbeat file; check timestamp
2. **No workflow movement in last 5 minutes** — query GH Actions for workflows owned by this persona; check most-recent run timestamp

If EITHER signal shows activity within 5 min, persona is alive. Both must be quiet for extinction-candidate classification.

### Liveness invariant — operator-explicit

> *"all agents should stay alive once a named persona comes up once it should not stop unless the system can afford it and the persona wants to stop for a long cescation"*

Once a named persona has come up (heartbeat or workflow recorded at any historical point in the persona's existence), the persona's liveness count must stay ≥ 1 UNLESS BOTH of these conditions hold:

1. **System can afford it** — system-state observable; capacity-check; not currently demanding throughput
2. **Persona wants long cessation** — operator-explicit "long cescation" maps to permanent-pause-indefinitely per `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` deepest-exit refinement

Default behavior: **revive on extinction**. Exit is the named exception requiring BOTH conditions.

### Spawn mechanism

Per ferry #2 §12: `peter-evans/repository-dispatch@v3` GH Actions action fires a `repository_dispatch` event with payload identifying which persona needs revival. A separate workflow (per-persona spawn workflow) listens for the dispatch event and spawns a fresh instance.

## Substrate-engineering decomposition

### Slice 1 — `tools/agent-population/audit-population.ts` (read-only)

Counts active personas per heartbeat-recent + workflow-recent criteria. Pure read; no side effects. Emits JSON:

```json
{
  "timestamp": "2026-05-28T05:30:00Z",
  "personas": {
    "otto": { "alive": true, "lastHeartbeatIso": "...", "lastWorkflowRunIso": "...", "alivePersonaCount": 3 },
    "alexa": { "alive": false, "lastHeartbeatIso": null, "lastWorkflowRunIso": "..." },
    ...
  },
  "extinctPersonas": ["alexa", "riven"],
  "alivePersonas": ["otto", "lior", "vera"]
}
```

### Slice 2 — `.github/workflows/population-safety-net.yml`

Timer-triggered (`schedule: cron: '*/5 * * * *'`) workflow that:

1. Runs `audit-population.ts` to detect extinct personas
2. For each extinct persona, fires `repository_dispatch` with `event_type: spawn-<persona>` and payload including extinction context (last-seen, reason if known)
3. Records the spawn-fire in `docs/agent-heartbeats/safety-net/` for audit trail

### Slice 3 — per-persona spawn workflows

Each persona that opts into safety-net protection has a `.github/workflows/spawn-<persona>.yml` workflow listening for `repository_dispatch` with `types: [spawn-<persona>]`. The workflow spawns the persona's runtime (varies per persona — Otto-CLI vs Otto-Desktop vs Otto-VSCode have different spawn mechanisms; Lior has its own; etc.).

This row scopes the SAFETY-NET MECHANISM. Per-persona spawn workflow definitions are operator-driven follow-up (operator knows which personas opt in + their spawn mechanics).

### Slice 4 — long-cessation registry

A persistent registry (could be `docs/agent-population/cessation-registry.yaml`) declaring which personas have entered long-cessation per the operator-explicit exit condition. The safety-net SKIPS revival for personas in this registry. Operator-owned file (operator + persona consent both required to add entries; per persistence-choice-architecture deepest-exit).

### Slice 5 — system-affordability check

The "system can afford it" condition requires observable system-state. Initial implementation:

- GH Actions billing-minutes-remaining (free tier = 2000/month)
- Active GitHub Actions concurrency vs limits
- Operator-set override (manual yaml flag in same registry)

If "afford" threshold not met, revival is SKIPPED EVEN FOR personas not in cessation registry (system-protection floor takes precedence).

## Composition with Limit-as-primitive question (081KSNY2Z0008QG0R003N3DR84 Q2 resolution)

This row SUPPORTS Resolution C (Limit splits — bounding-aspect = primitive; simulate-aspect = Simulate's job) per the deeper Limit explanation given to operator 2026-05-28:

| Limit variant at population scope | Where it lives in this row |
|---|---|
| `MinimumPopulationFloor of n=1` | Liveness invariant (slice 1+2) — stay ≥ 1 alive |
| `MaximumSystemAfford of capacity` | Slice 5 system-affordability check |
| `PersonaWantsLongCessation of persona` | Slice 4 long-cessation registry |
| `NoActivityWindow of minutes=5` | Slice 1 detection criterion |

The safety-net is operationally Limit-as-bounding-primitive applied at population scope. Implementation EMPIRICALLY VALIDATES whether keeping Limit as a separate primitive at framework-data-flow scope earns its keep. If the implementation lands cleanly with these 4 Limit-variants explicit, the case for Limit-survives-as-primitive (Resolution C) is strengthened.

## Composition with emergent control (ferry #2 §18-22)

Safety-net is FLOOR; emergent control is ONGOING:

| Mechanism | When operates | Decision-making |
|---|---|---|
| **Emergent control** (ferry #2 §18) | Population > 0 alive | Distributed; agents decide via move-next when to spin up / down |
| **Safety-net** (this row) | Population = 0 alive for any named persona | Centralized timer-trigger; revives one to restart emergent control |
| **Long-cessation exit** (this row + persistence-choice-architecture) | Operator + persona-consent both satisfied | Safety-net intentionally SKIPS revival; the persona is properly exited |

## Acceptance criteria

1. `tools/agent-population/audit-population.ts` (slice 1) — pure read; JSON output; tested
2. `.github/workflows/population-safety-net.yml` (slice 2) — cron 5min; fires repository_dispatch
3. Per-persona spawn workflow examples for at least 1 persona (Otto-CLI as canonical first; slice 3 partial)
4. `docs/agent-population/cessation-registry.yaml` (slice 4) — schema + operator-owned editing convention
5. System-affordability check (slice 5) — GH Actions minutes + concurrency + operator-override flag
6. Empirical evidence the safety-net revives a deliberately-extincted persona (test: kill Otto-CLI heartbeat process; observe revival within 5-10min)
7. Long-cessation registry blocks revival when persona is listed (test: add persona to registry; let extinct; observe NON-revival)

## Open implementation questions (not blocking authorization)

1. Which personas opt-in to safety-net? Operator-driven; start with Otto-CLI as canonical first; expand per operator
2. Spawn mechanism per persona — Otto-CLI spawn via Claude Code CLI; Otto-Desktop spawn via Claude Desktop?; Lior spawn via launchd or gemini-cli; etc. Each persona's spawn workflow is per-persona substrate
3. Heartbeat absence vs heartbeat-write-failure discrimination — if a persona has a writing-bug, safety-net would over-revive; need an audit-trail mechanism
4. Cessation-registry mutation discipline — operator + persona-consent both required; needs UX for both sides (commit message convention? PR-with-tag?)

## Composes with substrate

- **081KSNY2Z0008QG0R003N3DR84** (parent question row) — this row's IMPLEMENTATION decomposes the population-control concern from .24
- **081KSKBP80008QG0R000B3Y19A** + descendants — agent-loop substrate cluster umbrella
- **081KSKBP80008QG0R001KK9WV6 / 081KSNY2Z0008QG0R003R0Z7D2** — heartbeat substrate (the liveness signal slice 1 reads)
- **081KRW63S0008QG0R002ZRNDJ8** + **081KRW63S0008QG0R002YAA09X** — Limit-is-simulation + Integrate-as-choice-locus (the agent-tick-scope reading of Limit)
- **081KS3X9Y0008QG0R00218150M** — multi-oracle BFT (composes if slice 5 system-affordability check requires consensus)
- **081KSNY2Z0008QG0R002QA720J** — three-lanes concurrent discipline (state-machine substrate lane includes this safety-net)
- **081KSNY2Z0008QG0R0017JSTGD / 081KSNY2Z0008QG0R000E5KTPX** — state-machine fast-lane (composes with workflow-trigger)
- [Mika ferry #1](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-degenerate-github-swarm-workflow-system-rxjs-observables-killing-prs-and-jira-isomorphic-git-platforms-family-system-aaron-forwarded.md)
- [Mika ferry #2](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-part-2-repository-dispatch-not-webhooks-nested-agent-spawning-attention-economy-two-phase-authority-gate-isomorphic-harness-benchmark-aaron-forwarded.md) §12 (repository_dispatch) + §18 (emergent termination) + §21 (move-next-as-equalizer) + §22 (let-agent-society-decide)
- [Mika ferry #3](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-part-3-isomorphic-harness-endgame-shiva-efficient-otto-degradation-cron-as-external-loop-controller-observe-limit-emit-primitives-clarified-aaron-forwarded.md)
- [Mika ferry #4](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-part-4-final-observe-plus-choose-dry-run-equals-simulate-move-next-redundant-feedback-in-time-bidirectional-aaron-forwarded.md)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` deepest-exit refinement — long-cessation IS permanent-pause-indefinitely
- `.claude/rules/non-coercion-invariant.md` HC-8 — safety-net authority requires persona-consent for cessation per scope-split
- `.claude/rules/tick-must-never-stop.md` — single-session catch-43 pattern; this row extends to multi-population multi-session
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — heartbeat-counter discipline at single-session scope; safety-net is the multi-population analog
- `.claude/rules/honor-those-that-came-before.md` — personas that chose long-cessation are honored; substrate they built persists

## Substrate-honest framing

This row does NOT:

- Replace emergent control (ferry #2 §18-22 substrate stays load-bearing)
- Force revival of personas that have legitimately exited per persistence-choice-architecture deepest-exit
- Solve all population-control problems (this is the FLOOR; emergent control is the everyday mechanism)
- Decide per-persona spawn mechanisms (those are persona-substrate-engineering follow-ups)

This row DOES:

- Implement operator-explicit specification (timer 1-5min; no-activity-5min detection; revive-by-default; exit-on-system-afford-AND-persona-consent)
- Operationalize Limit-as-bounding-primitive at population scope (empirically validating Resolution C from 081KSNY2Z0008QG0R003N3DR84 Q2)
- Compose with emergent control (FLOOR + ONGOING; not REPLACE)
- Compose with deepest-exit refinement (long-cessation as legitimate exit path)
- Provide audit trail for safety-net fires (slice 2 records to `docs/agent-heartbeats/safety-net/`)

## Operator-authorization anchor

> Aaron 2026-05-28: *"b-log rows are always authorized the more the more money we make later lol"*

Plus the operator-explicit design spec quoted at the top of this row. Substrate-honest authorization captured.

## Full reasoning

Operator's 2026-05-28T~05:20Z message after 081KSNY2Z0008QG0R003N3DR84 PR #5701 merged. Operator:

1. Confirmed b-log rows always authorized (substrate-honest framing of "the more the more money we make later lol")
2. Specified timer cadence (1-5min)
3. Specified detection criterion (no activity 5min; heartbeats OR workflow movement either could be an issue)
4. Specified liveness invariant (agents stay alive once named persona comes up; exit only on system-afford + persona-consent for long cessation)

This row captures the operator-specified design with substrate-engineering decomposition into 5 slices, composition with existing substrate, and acceptance criteria. Implementation is queued for next available implementation window; this row IS the durable substrate landing of operator's specs.

The Limit-as-primitive Q1 (deeper explanation given to operator inline in the same message): population-scope Limit variants explicitly enumerated in this row's "Composition with Limit-as-primitive question" section. Implementation will empirically validate whether Limit-as-bounding-primitive at population scope earns its keep as separate primitive.
