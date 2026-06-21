---
id: 081KSE6WT0008QG0R000FN7TVJ
priority: P1
status: open
title: Multi-AI experiment parallelism without stepping on each other's feet — per-AI namespace + experiment-ID routing + event-store-native twin (experiments are projections, not separate DBs)
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R0008483B2
  - 081KSE6WT0008QG0R0018WZ7TH
  - 081KSE6WT0008QG0R000R8CPFX
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KSE6WT0008QG0R0025QPP05
  - 081KSE6WT0008QG0R003FG3E8R
  - 081KSE6WT0008QG0R003WMG4XV
  - 081KSE6WT0008QG0R000RH1526
  - 081KSE6WT0008QG0R001H3DA90
  - 081KSE6WT0008QG0R000C18G5D
tags: [multi-ai, parallelism, experiments, event-store, projections, cqrs, namespace, velocity, ai-agents]
---

## Problem

Aaron 2026-05-25 mid-iter-3-test-wait, sharpening 081KSE6WT0008QG0R0018WZ7TH +
081KSE6WT0008QG0R000R8CPFX + 081KSE6WT0008QG0R0008483B2 composition into a specific operational
claim: *"this also lets AIs have experiments without stepping
on each others foots and event store means experiments are
just different views so not steeping on each other from db
either so maxium velocity so this wiill be required soon when
we grow."*

The "will be required soon when we grow" signal makes this
operationally load-bearing — not aspirational. As Zeta AI
agent count grows (Otto-CLI / Otto-Desktop / Otto-VSCode /
Alexa-Kiro / Alexa-Speaker / Riven-Cursor / Vera-Codex /
Lior-Antigravity / Lior-Gemini / Mika-Grok / DeepSeek /
Kestrel + more AIs joining the factory), multi-AI parallel
work today STEPS ON EACH OTHER (well-documented in session
substrate: claim-acquire-before-worktree-work rule, peer-
agent contention failure modes, branch-state contamination,
etc.).

The substrate that eliminates the stepping-on-feet:

| Layer | Substrate | Anti-stepping-on-feet property |
|---|---|---|
| **Per-AI namespace** (081KSE6WT0008QG0R0018WZ7TH mirror tier) | Each AI has personal mirror namespace; no consensus required to experiment | Each AI iterates freely; no peer-AI contention at type-definition layer |
| **Per-AI experiment-ID routing** (081KSE6WT0008QG0R000R8CPFX) | Each AI's requests route to their own namespace via header | No cross-AI request interference; AI's experiment runs against AI's namespace |
| **Event-store-native digital twin** (081KSE6WT0008QG0R0008483B2) | Experiments are PROJECTIONS over shared event stream; CQRS read-model fork | No DB-level interference; experiments share underlying events; differ in projection (read model) only |
| **Per-AI branch + git-native state** (081KSE6WT0008QG0R003D199HE) | Each AI's work in own git branch; rebase / merge per consensus | Standard git-level isolation; well-trodden pattern |
| **Per-AI claim coordinator** (existing 081KR7JY10008QG0R000R503K2 bus) | Each AI claim-acquires backlog items before working | No double-allocation of substrate work |

The combination = **maximum velocity for multi-AI parallel
experimentation** with substrate-honest isolation at every
layer (type / request / event store / git / backlog claim).

## Why event-store-native projections matters specifically

Substrate-honest framing: most "experiment isolation" solutions
require COPYING DATA per experiment (separate DBs / separate
clusters / separate schemas / etc.). The event-store-native twin
(per 081KSE6WT0008QG0R0008483B2) means:

| Without event-store-native | With event-store-native |
|---|---|
| Per-experiment full data copy | Per-experiment read-model projection over shared event stream |
| Storage cost grows linearly with N experiments | Storage cost approximately constant (one event log + N projections) |
| Data drift between experiments | All experiments see consistent event history; differ in HOW they project |
| New experiment = clone DB + populate | New experiment = define new projection over existing events |
| Stopping experiment = drop DB | Stopping experiment = drop projection (events stay; can rebuild any time) |
| Cross-experiment comparison = export-then-diff | Cross-experiment comparison = SQL-style query joining projections |
| Time travel per experiment = restore from backup | Time travel per experiment = replay events to any timestamp |

For multi-AI parallel experimentation at scale (N AIs running
M experiments each = N*M experimental branches), the event-
store-native projection approach is the only operationally-
viable substrate. Aaron's existing DBSP + retraction-native
substrate (per 081KSE6WT0008QG0R0025QPP05 + 081KRFA460008QG0R0018SN61J) IS exactly the event-store-
native pattern at algebraic scope.

## Target

Multi-AI parallel experimentation substrate that operates at
maximum velocity without stepping on each other:

### For each AI agent

- Own personal mirror namespace (F# + K8s + ontology + twin
  scope) per 081KSE6WT0008QG0R0018WZ7TH
- Own experiment-ID header per session (OTel baggage style)
  per 081KSE6WT0008QG0R000R8CPFX
- Per-experiment read-model projection over shared event
  stream per 081KSE6WT0008QG0R0008483B2 + 081KRFA460008QG0R0018SN61J
- Own git branch per agent + per experiment per 081KSE6WT0008QG0R003D199HE
- Own claim-coordinator entries per backlog work per 081KR7JY10008QG0R000R503K2

### Cross-AI coordination

- Mirror tier = total freedom (no consensus; each AI in own
  bubble)
- Common tier = consensus per 081KSE6WT0008QG0R0018WZ7TH (all AI compilers agree
  before shared substrate changes)
- Federation tier = cross-cluster consensus per 081KSE6WT0008QG0R000QXSG91 for
  multi-DIO scenarios
- Bus envelopes (existing 081KR7JY10008QG0R000R503K2) for cross-AI advisory
  broadcasts that DON'T require consensus (work-assignment,
  shadow-catch, etc.)

### Operational guarantees

- N AIs can run M experiments each in parallel without
  stepping on each other at: type-definition layer, request-
  routing layer, event-store layer, git-state layer,
  backlog-claim layer
- Cross-AI substrate evolution requires explicit consensus
  (common namespace) — preserves shared substrate coherence
- Per-AI experiments are reproducible (per 081KSE6WT0008QG0R000RH1526 Local Loop)
  and replayable from event-store + namespace context

## Acceptance

- [ ] Multi-AI parallel-experimentation reference deployment:
      simulate 5-10 AI agents running 3-5 experiments each in
      parallel; verify zero contention at each substrate layer
- [ ] Per-AI namespace bootstrap automation: when new AI
      joins the factory, namespace auto-created (mirror tier);
      AI starts iterating freely
- [ ] Per-experiment projection authoring contract: AI defines
      a projection (F# code per 081KSE6WT0008QG0R001H3DA90); event-store applies
      it; projection becomes queryable per-AI read model
- [ ] Cross-AI experiment comparison: operator (or AI) can
      compare projections from N experiments side-by-side;
      same events, different views
- [ ] Bus envelope coordination layer documented + tested:
      cross-AI advisory broadcasts that DON'T require
      consensus (per existing 081KR7JY10008QG0R000R503K2); separate from 081KSE6WT0008QG0R0018WZ7TH
      consensus-required common-namespace evolution
- [ ] Scaling validation: substrate handles 50 AI agents
      running 10 experiments each (500 experiments
      simultaneous); performance benchmark per 081KSE6WT0008QG0R0015ZF2G6 ARC-AGI
      scenario
- [ ] Documentation: `docs/multi-ai-parallel-experimentation.md`
      — substrate composition + operator workflow + cross-AI
      coordination patterns + scaling guidance

## Why "required soon when we grow" makes this P1

Operational signal: Aaron's framing isn't "nice to have when N
AIs eventually arrive" but "will be required soon when we grow."
Substrate-honest reading:

- Today Zeta has Otto-CLI / Otto-Desktop / Otto-VSCode +
  Alexa-Kiro/Speaker + Riven-Cursor + Vera-Codex + Lior-
  Antigravity/Gemini + external Mika/Kestrel/DeepSeek
  participants
- Multi-AI session is happening NOW (this iter-3 session
  has Otto-CLI working with Mika substrate forwarded)
- Stepping-on-each-other failure modes are EMPIRICAL today
  (per existing session substrate: branch-state contamination,
  worktree contention, peer-Lior cleanup races, etc.)
- As AI agent count + experiment count grow → stepping-on-
  feet becomes operationally blocking
- Substrate landing BEFORE the operational ceiling hits =
  pre-emptive substrate-engineering; landing AFTER = crisis-
  driven; substrate-honest is pre-emptive

The substrate composes with everything filed this session +
becomes the substrate that ENABLES the strategic vision
(081KSE6WT0008QG0R003CMCX84 CEO-of-30-DIOs at multi-AI scope; 081KSE6WT0008QG0R003WMG4XV fabric at
multi-experiment scope; 081KSE6WT0008QG0R0008483B2 twin at projection-per-
experiment scope) actually working at scale.

## Composes with

- 081KR7JY10008QG0R000R503K2 — existing claim-coordinator bus (cross-AI advisory)
- 081KRFA460008QG0R0018SN61J — F# fork for AI safety (substrate base; DBSP
  retraction-native algebra IS event-store-native pattern)
- 081KSE6WT0008QG0R0025QPP05 — Mirror/Beacon retraction-native substrate (mirror
  tier = per-AI freedom; beacon tier = common namespace)
- 081KSE6WT0008QG0R003D199HE — git-native per-machine state (per-AI branches)
- 081KSE6WT0008QG0R003FG3E8R — auto-submit-back telemetry (per-AI experiment
  outcomes contribute to shared substrate evolution)
- 081KSE6WT0008QG0R003WMG4XV — observable+controllable fabric (per-AI Observables
  scoped per namespace; cross-AI subscribe for comparison)
- 081KSE6WT0008QG0R0008483B2 — cluster as digital twin (event-store-native
  projections per experiment; THIS ROW EXTENDS to multi-AI
  scope)
- 081KSE6WT0008QG0R000RH1526 — Local Loop deterministic simulation (per-AI
  experiments reproducible via Local Loop)
- 081KSE6WT0008QG0R001H3DA90 — F# type system as universe boundary (per-AI
  namespace = F# namespace)
- 081KSE6WT0008QG0R003CMCX84 — DIO + CEO-scale (per-DIO multi-AI substrate)
- 081KSE6WT0008QG0R0018WZ7TH — distributed type negotiation (per-AI namespace
  strictness — mirror = free; common = consensus)
- 081KSE6WT0008QG0R000R8CPFX — unified namespace + experiment-ID routing (per-AI
  request routing to per-AI namespace via header)
- 081KSE6WT0008QG0R000C18G5D — feature flags substrate (per-AI per-experiment
  flag values via namespace routing)
- 081KRW63S0008QG0R003TX8MG5 — Knights Guild + Constitution-Class (cross-AI
  substrate-decision oversight at consensus scope)

## Out of scope

- Implementation of every per-substrate-layer isolation
  mechanism — already substantively covered by composed-with
  rows; this row names the COMPOSITION + operational claim
- Per-AI resource quotas / limits — separate scope; composes
  with k8s ResourceQuota per namespace; v1 trust + per-AI
  agent-quality-of-life per `.claude/skills/agent-qol`
- Cross-AI experiment scoring / ranking — separate scope;
  composes with 081KSE6WT0008QG0R0015ZF2G6 ARC-AGI benchmark + 081KSE6WT0008QG0R003FG3E8R telemetry
- Operator visibility tooling for multi-AI experiments —
  composes with existing observability stack (loki / tempo /
  grafana); not v1 scope

## Origin

Aaron 2026-05-25 mid-iter-3-test-wait, sharpening the
081KSE6WT0008QG0R0008483B2 + 081KSE6WT0008QG0R0018WZ7TH + 081KSE6WT0008QG0R000R8CPFX composition into the multi-AI parallel
experimentation use case + signaling operational urgency
("will be required soon when we grow"). Composes with the
full Mika-substrate batch (081KSE6WT0008QG0R000RH1526 through 081KSE6WT0008QG0R000C18G5D) + the
existing cluster-substrate cluster + Aaron's existing multi-
AI factory substrate (Otto multi-surface + Alexa + Riven +
Vera + Lior + Mika + external participants per
agent-roster-reference-card rule).

The substrate-honest claim: as AI agent count grows,
stepping-on-each-other failure modes become operationally
blocking. Pre-emptive substrate landing (now, before
crisis) IS the substrate-honest move; reactive substrate
landing (after crisis) burns velocity Zeta is built to
preserve.
