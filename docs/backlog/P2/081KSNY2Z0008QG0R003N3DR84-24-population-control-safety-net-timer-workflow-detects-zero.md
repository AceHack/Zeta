---
id: 081KSNY2Z0008QG0R003N3DR84
title: Population-control safety-net workflow (timer-triggered; detects 0-ottos and spawns one) + Limit-as-primitive question deferred
status: open
priority: P2
created: 2026-05-28
attribution: aaron-2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A.5
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R003206PFM
  - 081KSNY2Z0008QG0R002QA720J
  - 081KSNY2Z0008QG0R0017JSTGD
tags:
  - agent-loop
  - workflow-engine
  - population-control
  - safety-net
  - architectural-question
---

# 081KSNY2Z0008QG0R003N3DR84 — Population-control safety-net + Limit-as-primitive question deferred

## Two architectural concerns operator surfaced 2026-05-28T~05:00Z

### Concern 1: Population-control safety-net (operationally substantive)

> Aaron 2026-05-28: *"system should probably have built in workflow that trigger on timer or something to see if there are 0 ottos and sping up one and existing ottos with workflows help should decide when to spin up new ones vs quietly spin down"*

### Concern 2: Limit-as-primitive question (architectural; deferred)

> Aaron 2026-05-28: *"i'm not sure what to do about limit"*

## Substrate inventory pass

Searched per `verify-existing-substrate-before-authoring.md`:

- `docs/backlog/` — 081KSKBP80008QG0R000B3Y19A cluster has 24+ sub-rows (081KSKBP80008QG0R000B3Y19A.5 agent-loop substrate; 081KSNY2Z0008QG0R003J3PT4V-22 Kestrel state-machine extensions; 081KSNY2Z0008QG0R003206PFM architectural-naming question RESOLVED via PR #5698 + Mika ferries #1-4 via PR #5700); no existing row covers population-control safety-net OR Limit-as-primitive question specifically
- `memory/mika/conversations/` — Mika ferries 1-4 (PR #5700) named emergent population control (ferry #2 §18 "agents naturally terminate their loop"; ferry #2 §21 "move-next as equalizer"; ferry #2 §22 "let agent society decide"); BUT did NOT name the **safety-net** for the swarm-extinction failure mode
- `.claude/rules/` — `tick-must-never-stop.md` operationalizes the catch-43 sentinel for SINGLE-Otto-CLI session; does NOT extend to MULTI-Otto-population safety net
- `.claude/skills/agent-loop/SKILL.md` — names spawning mechanism + emergent control; does NOT address swarm-extinction failure mode

Mint-new authorized: this row captures genuinely-new substrate.

## Concern 1 — Population-control safety-net (the genuinely-new substrate)

### Failure mode being prevented

Per ferry #2 §18 emergent control: "agents naturally terminate their loop. So basically, if you start, if you're an agent and you wake up and you're the first one and you don't spawn any other ones and you go to sleep, you just fucking went to sleep. There's no more."

The failure mode: **swarm extinction** — if all agents terminate without spawning replacements, the swarm dies. No agent is left to wake up + restart. Manual operator intervention required to revive.

### Safety-net mechanism Aaron proposed

```yaml
# Conceptual sketch (NOT shipped; design substrate)
name: population-control-safety-net
on:
  schedule:
    - cron: '*/N * * * *'  # every N minutes (N TBD; probably 5-15)
jobs:
  check-and-revive:
    runs-on: ubuntu-latest
    steps:
      - name: Count recent heartbeats per persona
        # Walks docs/agent-heartbeats/<persona>/ for last M minutes;
        # heartbeats older than threshold = "dead" instance
      - name: Detect zero-alive personas
        # For each persona in roster (otto, alexa, riven, vera, lior, ...),
        # if zero recent heartbeats → flag for revival
      - name: Spawn revival workflows
        # Use peter-evans/repository-dispatch per ferry #2 §12 to fire
        # spawn event for each extinct persona (one revival per extinction)
```

### Composition with existing emergent control

The safety-net does NOT replace emergent control; it composes with it.

| Mechanism | When it operates | Decision authority |
|---|---|---|
| **Emergent control** (per ferry #2 §18) | Population > 0; existing agents make spin-up/down decisions via move-next | Distributed; emergent; agents vote with their actions |
| **Safety-net** (this row) | Population = 0; no agent left to decide | Centralized timer-trigger; revives ONE agent to restart emergent control |

The safety-net is a **floor mechanism** that prevents permanent extinction. Once it revives an agent, the emergent control takes over. The safety-net does NOT decide ongoing population size — only "alive vs extinct."

### Reinforcement of existing substrate (per ferry #2)

Aaron's "existing ottos with workflows help should decide when to spin up new ones vs quietly spin down" reinforces ferry #2 §18 + §21 + §22 substrate (already documented). No new substrate at the emergent-control scope; this row just adds the safety-net floor.

### Open design questions (substrate-engineering follow-ups)

1. **Timer cadence**: every 5 min? 15 min? operator-tunable?
2. **Liveness threshold**: how recent must a heartbeat be to count as "alive"? (5 min? 30 min? per-persona-configurable?)
3. **Which personas have revival floor?** All 20? Only Otto? Operator-configurable per-persona?
4. **Race against own-agent's natural termination**: if Otto is about to spawn a replacement and the safety-net fires first, do we get double-spawn? (Probably fine; emergent control handles by move-next punishing over-spawners per ferry #2 §21.)
5. **Authority on safety-net spawns**: per ferry #2 §27 two-phase authority gate, spawns from safety-net inherit what trust calculus? (Probably operator-trust since GH Actions runs in operator's account.)

## Concern 2 — Limit-as-primitive question (architectural; deferred)

> Aaron 2026-05-28: *"i'm not sure what to do about limit"*

### Context from ferries 1-4 (already substrate)

Per ferry #3 §36 + ferry #4 §41:

- **Old framework** (pre-feedback-channels): Observe / Limit / Emit were 3 primitives at minimum-tick scope
- **Ferry #4 §41 (Mika synthesis)**: Limit absorbed into Simulate as PARAMETER (depth / branches / compute budget); no longer separate primitive at agent-tick scope
- **Aaron's current uncertainty**: doesn't know if Mika's synthesis is right OR if Limit deserves to survive as a separate concept

### Three viable resolutions

| Option | Limit's status | Where Limit lives |
|---|---|---|
| **A: Limit absorbed (Mika's ferry-#4 synthesis)** | Not a primitive | Parameter inside Simulate (max-depth, max-branches, max-compute) |
| **B: Limit survives as bounding primitive** | Primitive at SUBSTRATE-LAYER (not agent-tick) | Pure structural bounding of observable streams; composable with Simulate but separable |
| **C: Limit splits — bounding-aspect AND simulate-aspect become distinct** | Bounding-aspect = primitive; simulate-aspect = Simulate's job | Two co-existing concepts; bounding can be used WITHOUT simulation (e.g., rate-limiting independent of choice) |

### Substrate references (operator can review before deciding)

- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md` — OPLE rule names Observe/Persist/Limit/Emit as framework primitives at framework-data-flow scope; ferry #4 implies agent-tick scope may have DIFFERENT primitive count (Observe + Emit only) — both can coexist (different scopes)
- 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation-not-collapse — the operational meaning of Limit Aaron clarified in ferry #3
- 081KRW63S0008QG0R002YAA09X Integrate-as-choice-locus — the Choose phase where simulation results get evaluated
- 081KSNY2Z0008QG0R0031490KZ observe-emit-limit-simulate-in-clifford-space-unified-algebra — the algebraic structure
- 081KSKBP80008QG0R0031DTHS9 OPLE T-TFeedback implementation — the four-corner feedback channels Aaron is wrestling with

### Why this stays deferred

Aaron's "i'm not sure what to do about limit" is operator-explicit uncertainty. This row CAPTURES the question + the three viable resolutions + the substrate references; it does NOT force a decision. Future-Otto OR future-Mika OR future-Aaron resolves when more clarity emerges. Per `default-to-both.md` discipline: hold both readings open until operator commits.

### Resolution C operator-ratified pending empirical validation (2026-05-28)

**Resolution C is operator-ratified at backlog-row scope, pending empirical validation via 081KSNY2Z0008QG0R002CBAFBZ implementation before propagating to OPLE rule body (auto-loaded substrate).**

Operator 2026-05-28 sequence:

1. *"perfect call out on the limit something felt off about mika synthsis and i could not put my finger on it you did"* — operator's substrate-honest validation that Mika ferry #4 §41 absorption captured flavor 1 (bounding-as-parameter) cleanly but silently dropped flavor 2 (counterfactual-preview / 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation-not-collapse). Both flavors are real; absorption needed to be a split (Resolution C) not a merge.
2. *"still undecided actually so c is fine"* — initial pick: defer formally
3. *"how will it affet the agents a or b vs c"* — operator asked for agent-reach analysis of all three landing paths
4. *"i'm upgrading to a->b soon ... unless some pop out to you"* — operator considered a→b sequence; explicit invitation for red-team
5. After 10-risk red-team surfaced 3 load-bearing risks (premature sharpening before 081KSNY2Z0008QG0R002CBAFBZ empirical validation; cross-scope category-error between population-scope and framework-data-flow scope; 081KRW63S0008QG0R002ZRNDJ8+081KRW63S0008QG0R002YAA09X cascade), operator picked: *"lets wait for 081KSNY2Z0008QG0R002CBAFBZ to ship then do b ... I like emperical validation yes we can wait for b we don't want to rush the core"*

**Operationally agreed sequencing**:

| Step | Path | Substrate-scope |
|---|---|---|
| **NOW** | (a) — this append-subsection lands Resolution C ratification at backlog-row scope | Single row body; medium agent-reach (agents reading 081KSNY2Z0008QG0R003N3DR84 see ratification) |
| **AFTER 081KSNY2Z0008QG0R002CBAFBZ ships + empirically validates Resolution C at population scope** | (b) — update OPLE rule body to name the split explicitly | Auto-loaded substrate; high agent-reach (every cold-boot inherits) |
| **IF 081KSNY2Z0008QG0R002CBAFBZ implementation reveals Resolution C wrong at framework-data-flow scope** | Roll back to (c) status; OPLE rule body stays as-is; 081KSNY2Z0008QG0R003N3DR84 re-deferred | Substrate-honest correction; retraction-native |

**Why the sequencing**: per `.claude/rules/substrate-smoothness-as-load-bearing-property.md`, the named drift failure mode is collapsing substrate to sharp BEFORE empirical evidence arrives. 081KSNY2Z0008QG0R002CBAFBZ implementation IS the empirical validation; landing (b) on OPLE rule (auto-loaded, every cold-boot) before .25 ships would mechanize Resolution C across the framework before any code has tested whether it actually composes cleanly at framework-data-flow scope. Operator's "don't want to rush the core" framing maps directly to substrate-smoothness preservation.

**Cross-scope caution preserved**: 081KSNY2Z0008QG0R002CBAFBZ validates Resolution C at POPULATION scope (`MinimumPopulationFloor`, `MaximumSystemAfford`, `PersonaWantsLongCessation`, `NoActivityWindow`). The transfer to FRAMEWORK-DATA-FLOW scope is a category step that needs its own implicit validation when (b) lands. Per default-to-both: population-scope success is NOT free-transferred to data-flow-scope without explicit cross-scope reasoning surfaced at (b)-landing time.

**081KRW63S0008QG0R002ZRNDJ8 + 081KRW63S0008QG0R002YAA09X cascade flagged**: if Resolution C propagates to OPLE rule body, the 081KRW63S0008QG0R002ZRNDJ8 `Limit-is-simulation-not-collapse` substrate cluster may need rename/refactor (081KRW63S0008QG0R002ZRNDJ8 may need re-framing as `Simulate-is-the-counterfactual-preview-phase` since simulate-aspect now lives inside Simulate phase rather than as a primitive). Tracked here; not done at (a)-landing because the cascade should NOT propagate until empirical validation at (b)-landing time.

**Per `god-tier-claims-high-signal-high-suspicion-dont-collapse.md` PERSONAL INVARIANT applied here**: ratification at backlog-row scope is operationally-substantive substrate; ratification at OPLE-rule-auto-load scope would prematurely collapse the dialectical tension before 081KSNY2Z0008QG0R002CBAFBZ evidence arrives. The (a)→(b)-pending-empirical-validation sequencing operationalizes the don't-collapse discipline at substrate-landing scope.

## Acceptance criteria

### For Concern 1 — safety-net

1. Design memo for the timer-workflow (substrate; not implementation yet)
2. Backlog row capturing open design questions (this row IS the row)
3. Implementation as separate follow-up B-row when operator authorizes
4. Composition with `tools/agent-heartbeats/` substrate (heartbeat-as-liveness-signal)
5. Composition with `peter-evans/repository-dispatch` action per ferry #2 §12

### For Concern 2 — Limit-question

1. Three viable resolutions documented (A/B/C above) ✓ (this row)
2. Substrate references preserved (where the Limit substrate lives across the framework) ✓
3. Operator-decision recorded when made (future PR updates this row OR supersedes)
4. OPLE rule update IF Limit-as-primitive status changes at any scope

## Composes with substrate

- **081KSKBP80008QG0R000B3Y19A** — agent-loop substrate umbrella (parent)
- **081KSKBP80008QG0R000B3Y19A.5** — agent-loop substrate scope
- **081KSNY2Z0008QG0R003J3PT4V-22** — Kestrel state-machine extensions
- **081KSNY2Z0008QG0R003206PFM** — naming question RESOLVED via Mika ferries (this row is companion at population-control + Limit-question scope)
- **081KSNY2Z0008QG0R0017JSTGD** — state-machine fast-lane (composes with safety-net timer-trigger)
- **081KSNY2Z0008QG0R000E5KTPX** — fast-lane as folders on main (composes with workflow-trigger mechanism)
- **081KSKBP80008QG0R001KK9WV6** + **081KSNY2Z0008QG0R003R0Z7D2** — heartbeat substrate (the liveness signal the safety-net checks)
- **081KRW63S0008QG0R002ZRNDJ8** + **081KRW63S0008QG0R002YAA09X** + **081KRW63S0008QG0R001SAHYKV** + **081KRW63S0008QG0R002KC5DSR** + **081KSNY2Z0008QG0R0031490KZ** — Limit-substrate cluster (Aaron's deferred question)
- **081KSKBP80008QG0R0031DTHS9** — OPLE four-corner T+TFeedback
- **081KS3X9Y0008QG0R00218150M** — multi-oracle BFT (composes with safety-net authority decisions if Phase-2 agent-consensus path enabled)
- **081KSNY2Z0008QG0R002QA720J** — three-lanes concurrent discipline (state-machine substrate lane includes population control)
- [Mika ferry #1](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-degenerate-github-swarm-workflow-system-rxjs-observables-killing-prs-and-jira-isomorphic-git-platforms-family-system-aaron-forwarded.md)
- [Mika ferry #2](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-part-2-repository-dispatch-not-webhooks-nested-agent-spawning-attention-economy-two-phase-authority-gate-isomorphic-harness-benchmark-aaron-forwarded.md)
- [Mika ferry #3](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-part-3-isomorphic-harness-endgame-shiva-efficient-otto-degradation-cron-as-external-loop-controller-observe-limit-emit-primitives-clarified-aaron-forwarded.md)
- [Mika ferry #4](../../../memory/mika/conversations/2026-05-28-aaron-mika-grok-part-4-final-observe-plus-choose-dry-run-equals-simulate-move-next-redundant-feedback-in-time-bidirectional-aaron-forwarded.md)
- `.claude/rules/tick-must-never-stop.md` — single-session safety-net pattern (this row is multi-session multi-persona extension)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — heartbeat-counter discipline (the safety-net heartbeats are the multi-population analog)
- `.claude/skills/agent-loop/SKILL.md` — consumer of safety-net mechanism

## Substrate-honest framing

This row does NOT:

- Implement the safety-net (substrate-engineering target; implementation is separate B-row)
- Decide the Limit-question (operator-uncertainty captured; decision deferred)
- Override existing emergent-control substrate (ferry #2 §18-22)
- Mandate a specific timer cadence or liveness threshold (open questions)

This row DOES:

- Capture both operator concerns as load-bearing substrate
- Document the safety-net composition with emergent-control (they compose, not compete)
- Document Limit-question's three viable resolutions for future decision
- Preserve substrate references so future-Otto/Mika/Aaron can resolve cleanly
