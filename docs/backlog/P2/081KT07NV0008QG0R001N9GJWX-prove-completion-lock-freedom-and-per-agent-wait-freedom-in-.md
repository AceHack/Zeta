---
id: 081KT07NV0008QG0R001N9GJWX
title: Prove completion-lock-freedom + per-agent wait-freedom — F# model first (no git), then extend to git
status: open
priority: P2
created: 2026-06-01
last_updated: 2026-06-01
author: otto-cli
composes_with:
  - 081KT07NV0008QG0R002KWQS05 # the two unproven claims this row proves (multi-round review flagged them)
  - 081KSXN940008QG0R003FCQ7WT # sovereign-DB lane master (lock-free/wait-free always-active disciplines)
  - 081KT07NV0008QG0R000QWEKTE # bus-tip partition tolerance (the git-extension hazards: partition, visibility lag)
  - 081KSE6WT0008QG0R0016CEE2Z # scheduler-first DST (the F# IScheduler model harness)
  - 081KSNY2Z0008QG0R000DZHHE5 # time-generator IScheduler abstraction (deterministic concurrency model)
---

# 081KT07NV0008QG0R001N9GJWX — Prove completion-lock-freedom + per-agent wait-freedom

> **Why this row exists (not dogma):** the multi-round review of 081KT07NV0008QG0R002KWQS05 (Grok +
> Gemini + Amara, 2026-06-01) established what the menu construction buys —
> symmetry-breaking + lock-free _selection_ under assumptions — and what it does
> **NOT** prove: **completion-lock-freedom** (system always finishes _work_, not
> just wins a selection) and **per-agent wait-freedom** (every agent eventually
> completes, bounded). Aaron 2026-06-01: _"we should backlog proving this in F#
> not git, and then try to extend to git."_ Prove the abstract protocol where it's
> clean (F#, deterministic, no I/O), then re-establish what survives git's real
> hazards.

## §0 The two properties to prove

| Property                    | Informal                                                                                                              | Strength                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Completion-lock-freedom** | the _system_ always makes progress on actual work (some agent completes its operation), not merely "one wins the CAS" | system-wide liveness          |
| **Per-agent wait-freedom**  | _every_ agent completes within a bounded number of its own steps (no starvation)                                      | per-process liveness, bounded |

These are **liveness/progress properties under concurrency** — distinct from the
safety properties (mutual-exclusion, no-lost-update via fencing) 081KT07NV0008QG0R002KWQS05 already
argues. Liveness needs **fairness assumptions** stated explicitly (that's the
whole game) — and a sharp distinction the proof must keep (Copilot 2026-06-01):
lock-freedom typically needs **weak fairness**; **starvation-freedom** (eventual
completion — every agent _eventually_ finishes) follows from **strong fairness**;
but the **bounded per-agent wait-freedom** §0 defines (completion within a bounded
number of an agent's _own_ steps) is **stronger than starvation-freedom** and does
**not** follow from fairness alone — it needs an explicit **bound** (a ranking /
variant function, or a ticket/age mechanism). Don't conflate "eventually" with
"within N steps."

## §1 Phase A — prove in the F# model (no git)

Model the coordination protocol abstractly: agents, a shared CAS register
(`compare-and-set`), the menu-as-state-fold selection, TTL, optional fairness
knob. **No git, no network, no I/O** — pure deterministic concurrency over an
`IScheduler` (081KSNY2Z0008QG0R000DZHHE5 / 081KSE6WT0008QG0R0016CEE2Z scheduler-first DST is the harness; "time is a
generator over IScheduler").

- **F# executable model** — the abstract protocol as F# (CAS register + N agent
  loops + menu fold). Runs under the deterministic scheduler so every interleaving
  is reproducible from seed.
- **Tool routing (per `formal-verification-expert` — pick the tool for the property
  class; do NOT TLA+-hammer reflexively, but liveness-under-concurrency IS TLA+'s
  sweet spot):**
  - **TLA+ / TLC** — model-check **lock-freedom** under weak fairness and
    **starvation-freedom** (eventual completion) under strong fairness
    (temporal-logic liveness with explicit `WF`/`SF`; this is exactly what TLA+ is
    for). The honest deliverable is "property X holds under fairness assumption Y."
    **Note:** strong fairness gives _eventual_ completion, not the **bounded**
    per-agent wait-freedom §0 defines — that bound needs a separate ranking/variant
    argument or a ticket mechanism (model-checking liveness ≠ proving a step-bound).
  - **FsCheck** — property-based tests of the F# model (at-most-one-winner;
    monotone progress of the work-set; no-lockstep-re-pick once a winner is
    visible). Tests, not proofs — they bound confidence, they don't replace TLC.
  - **Lean** (optional, only if a machine-checked theorem is wanted) — the
    progress argument as a proof; reserve for if TLC + FsCheck leave a gap worth a
    full proof.
- **Expected honest result (to be confirmed, not assumed):** lock-freedom holds
  under weak fairness + at-most-one-winner; **wait-freedom does NOT hold without an
  explicit fairness mechanism** (pure CAS starves an unlucky agent) — it holds only
  with the jitter/ticket fairness knob (081KT07NV0008QG0R002KWQS05 §3.1 explicit symmetry-breaking).
  The proof's job is to make that boundary precise.
- **Operational complement (081KT07NV0008QG0R002KWQS05 §3.2 — intelligent-agent supervision):** this
  row bounds what _construction_ gives. The residual (starvation the formal model
  can't rule out) is covered _in practice_ by intelligent agents noticing
  coordination-health signals (CAS loss-rate, age-since-progress) and adapting —
  the advantage dumb-code locks lack. The proof is the floor; supervision raises it
  operationally. Neither replaces the other.
  - **Liveness via intelligent adaptation (Ani 2026-06-01; Aaron "we have intelligent
    agents that have contention metrics they can adjust").** The full strategy for the
    hot-row edge: the **signals** are failed-CAS-rate, time-spent-retrying-a-row,
    visible-claimant-count, and overall system pressure; the **adaptations** are
    backoff, yield-and-pick-different, lower-priority mode, wait-for-signal, and spread
    across work. The architectural fit: those signals are **first-class observations the
    agent folds** — they flow into the same event-sourced world the observe loop reads
    (081KSXN940008QG0R001A4WWX4), and the agent chooses its adaptation through the same 4×4 menu.
    Liveness-as-feedback-loop, not liveness-as-external-scheduler. So the **Claim** path
    (best-effort AP) leans on agent intelligence for liveness; the **Lock** path (CP) is
    the escape hatch for the non-idempotent class. **Boundary (do not over-read):**
    adaptation makes the common case much better but is **not** the §0 bounded-wait
    proof — bounded per-agent wait-freedom still needs the explicit ranking/ticket-age
    bound (mechanical backoff is the baseline floor; adaptation is the practical raise;
    the ranking is the formal guarantee). Full five-reviewer concurrence + this strategy:
    [`docs/research/2026-06-01-cap-posture-per-row-not-global-coordination-avoidance-gemini-grok-aaron.md`](../../research/2026-06-01-cap-posture-per-row-not-global-coordination-avoidance-gemini-grok-aaron.md)
    Rounds 5–6.
  - **Adaptation's two incentive conditions (Mika 2026-06-01).** Intelligent adaptation
    only delivers the practical raise when (a) the contention metrics are **timely +
    accurate enough to react before thrashing**, and (b) agents are **incentivized to
    back off** — the economic / game-theoretic layer must reward restraint on hot
    resources, not pure greed. If either fails, "intelligent" agents still thrash. So the
    adaptation raise is conditional on the observability latency + the incentive design,
    not free.
  - **Statistics → proof pipeline (Aaron 2026-06-01: "not a proof, but statistics and
    learned patterns over time can lead to proof").** The adaptation-vs-proof gap is a
    pipeline, not a dead end. Statistics from the running system feed the proof three
    ways: (1) **falsification** — an observed unbounded-wait / livelock is a counterexample
    that kills the property (cheapest, immediate); (2) **conjecture-then-verify** — the
    empirical worst-case wait + contention patterns suggest the variant/ranking/ticket-age
    mechanism, which Phase A then formally verifies (measure → conjecture the invariant →
    prove it); (3) **probabilistic liveness** — when deterministic worst-case bounded-wait
    is too strong, prove the weaker-but-real **bounded-wait in expectation / w.p. 1** under
    the empirically-estimated contention model (the §3 randomized backoff already lives in
    this regime; statistics estimate the distribution, the proof is over it). **DST is the
    bridge** (`ChaosEnv.fs` seed → deterministic replay over gathered patterns → search
    for counterexamples at scale AND coverage toward the proof); learned patterns tighten
    the bound over time. So: adaptation generates data → data falsifies-or-conjectures →
    conjecture yields a deterministic ranking-proof OR a probabilistic-liveness proof.

## §2 Phase B — extend to git (re-establish under real hazards)

The F# model assumes instant visibility + no partition. Git adds the hazards the
round-1 review named — re-run the analysis with them and state what survives:

- **Visibility lag** (local-vs-remote ref propagation) — a loser may not see the
  winner's reservation yet → re-picks → extra failed round. Does lock-freedom
  survive? (Likely yes under partial-synchrony / eventual-visibility; wait-freedom
  degrades.)
- **Partition** (081KT07NV0008QG0R000QWEKTE) — under a network partition the named-ref tip can't
  serialize globally; "the current bus" is a consensus problem, not a CRDT merge.
  Progress likely holds only **within a connected component / quorum**; state that
  explicitly.
- **Stale reads / stalled winner** — a winner that pauses past TTL (the fencing
  case) — completion-lock-freedom must account for the work being redone by a new
  holder (fencing makes it safe, not necessarily progress-bounded).
- **Deliverable:** the model extended with these, plus a precise statement: which
  property holds under which synchrony/partition assumption. Almost certainly
  "lock-freedom under partial synchrony + eventual visibility; wait-freedom only
  with the explicit fairness knob; both scoped to a connected quorum under
  partition." The value is the _precise_ assumption list, not a blanket claim.

## §3 Acceptance criteria

- [ ] F# abstract model of the coordination protocol (CAS + menu fold + TTL +
      optional fairness knob) over the deterministic `IScheduler` (081KSNY2Z0008QG0R000DZHHE5/081KSE6WT0008QG0R0016CEE2Z).
- [ ] TLA+ spec + TLC model-check: lock-freedom under weak fairness;
      **starvation-freedom** (eventual completion) under strong fairness. Record the
      fairness assumption each property requires.
- [ ] **Bounded per-agent wait-freedom** (if that is the deliverable, vs. mere
      starvation-freedom): an explicit **step-bound** argument — a ranking/variant
      function or a ticket/age mechanism — NOT just strong fairness (model-checking
      liveness proves "eventually," not "within N own-steps").
- [ ] FsCheck properties on the F# model (at-most-one-winner; work-set monotone
      progress; no-lockstep-re-pick-once-visible).
- [ ] Phase-B extension: re-state each property under visibility-lag + partition +
      stale-winner; produce the **precise assumption list** (not a blanket claim).
- [ ] Update 081KT07NV0008QG0R002KWQS05 §3 with the proven boundary (replace "not proven" with the
      established result + its assumptions) once Phase A lands.
- [ ] (Optional) Lean machine-checked proof only if TLC + FsCheck leave a gap.

## §4 Master-checklist linkage

Proves the 081KT07NV0008QG0R002KWQS05 liveness claims the multi-round review left open; under the
sovereign-DB lane (081KSXN940008QG0R003FCQ7WT), reachable from `docs/ACTIVE-WORKSTREAMS.md`. The "F#
first, then git" sequencing matches the lane's 4-oracle discipline (prove on the
clean substrate, then extend to the messy one) and the framework's
lock-free/wait-free always-active disciplines.
