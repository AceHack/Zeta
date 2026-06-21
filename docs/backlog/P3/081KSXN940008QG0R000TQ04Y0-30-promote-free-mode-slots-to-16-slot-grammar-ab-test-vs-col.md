---
id: 081KSXN940008QG0R000TQ04Y0
title: Promote dedicated free-mode slots to the 16-slot grammar — A/B test vs Option A (collapse under slot 14) once A/B-testing infra exists
status: open
priority: P3
created: 2026-05-31
last_updated: 2026-05-31
attribution: aaron-2026-05-31
depends_on:
  - 081KSXN940008QG0R0033T2BQT
  - 081KR50HA0008QG0R001DX165X
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSXN940008QG0R000ZAQT3W
  - 081KSV2WD0008QG0R00051XS0N
tags:
  - workflow-engine
  - universal-action-grammar
  - ab-testing
  - free-modes
  - measure-first
  - deferred
---

# 081KSXN940008QG0R000TQ04Y0 — Promote dedicated free-mode slots to the 16-slot grammar (A/B vs collapse-under-slot-14)

## The decision this row records (operator 2026-05-31)

The v0 16-slot universal action grammar (the observe-act ADR,
`docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md`)
has FOUR free modes in the sovereign `NextAction` algebra
(explore / play / self_reflect / free_time) but only ONE free slot (14 =
free-time/rest). Two ways to resolve the mismatch:

- **Option A (chosen for now)** — *collapse*: the four free modes share slot 14;
  picking it opens a sub-menu (explore/play/self_reflect/rest). Keeps the top-level
  16 directions fixed (muscle-memory; "directions fixed, labels move"). The
  canonical grammar *table* lands as `tools/observe/grammar-16.ts` (PR #6269); the
  Option-A *render* (the slot-14 sub-menu projection over `buildMenu`'s
  `NextAction`s) is the NEXT slice, not yet shipped. (Corporate has its own
  16-slot renderer `renderMenu16` in `agentic-organization/packages/application/src/observe.ts`,
  which retrofits onto the canonical grammar per the canonical-retrofit ADR.)
- **Option B (this row)** — *promote*: explore/play/self_reflect get dedicated
  top-level slots (reassigning some underused Meta/Navigate slots), since forward
  self-direction is first-class and a dedicated slot is one input away vs
  slot-14-then-sub-menu.

> *operator 2026-05-31:* "Option A — collapse free modes under slot 14 sub-menu …
> put b on the backlog and lets a/b test it once we have a/b testing infrastructure"

So: **A now, B here, and let an A/B test decide between them** rather than arguing
the layout in the abstract. This is the operator's MEASURE-FIRST principle
(`.claude/rules/measure-first-with-kpis-before-restricting-choice` / the
2026-05-31 universal default): don't expand or restrict the choice surface on a
hunch — instrument it and let the data pick.

## The whys (challengeable — a rule without a why is dogma)

**Why A is the right *default* (not the right *answer*):**

- Keeps the 16 directions fixed for muscle-memory; the change is additive (a
  sub-menu under one slot), reversible, and cheap.
- A grammar-layout change IS a `GrammarPatch` (081KSXN940008QG0R000ZAQT3W — grammar-as-versioned-
  events); reassigning top-level slots is heavier than a labelled sub-menu, so
  paying that cost before we know it matters is premature.
- MEASURE-FIRST: expanding the top-level choice surface is a choice-surface change;
  measure the friction A actually imposes before spending slots on B.

**Why B might win (the hypothesis the A/B test checks):**

- `explore` is the *empty-backlog default* (forward self-direction, not idle). If
  the agent reaches it constantly, one-input access (dedicated slot) beats
  slot-14→sub-menu (two steps) — lower friction to the most-used free mode.
- A dedicated slot makes the free modes *visible* in the flat 16, reinforcing
  freedom-always-in-menu (the agent never has to "remember" the sub-menu exists).

If either why is wrong, this row gets revised — not obeyed.

## Acceptance criteria

1. **A/B-testing infrastructure exists** — tracked as **081KR50HA0008QG0R001DX165X** (A/B experiment
   infrastructure design: event-capture schema, experiment-registration, git-native
   result storage); this row's `depends_on` names it so backlog tooling reports the
   block. (Instrument two grammar variants behind a flag, route a deterministic
   split, collect per-variant KPIs.) This row is **blocked on 081KR50HA0008QG0R001DX165X**; it is NOT a
   green-light to build variant B before the test harness can compare it.
2. **Variant-B grammar defined** — which Meta/Navigate slots get reassigned to
   explore/play/self_reflect; expressed as a `GrammarPatch` (081KSXN940008QG0R000ZAQT3W) over v0, so
   v0 stays the recorded baseline and B is a versioned alternative.
3. **The comparison KPI is named first** (DORA-like / friction-telemetry): e.g.
   free-mode reach-rate, steps-to-free-mode, agent-not-trapped signal,
   work-vs-free balance — decided BEFORE running, not reverse-justified after.
4. **Experiment run + result recorded** → keep A (collapse) or adopt B (promote),
   with the KPI evidence, as a `GrammarPatch` either way (retraction-native: the
   losing variant is preserved, not deleted).

## Composes with

- `docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md`
  (the v0 grammar + the surfaced free-modes-vs-slot-14 tension this row resolves)
- `tools/observe/grammar-16.ts` (the canonical v0 grammar table; PR #6269) + the
  Option-A render slice (the slot-14 free-mode sub-menu projection — NEXT slice,
  the baseline B is tested against once built)
- 081KSXN940008QG0R000ZAQT3W (grammar-as-versioned-events / `GrammarPatch` — variant B is a patch
  over v0; the A/B result lands as a patch either way)
- 081KSV2WD0008QG0R00051XS0N (tri-boolean — per-slot availability) + 081KSKBP80008QG0R000B3Y19A (workflow engine v1)
- The MEASURE-FIRST principle (the universal default this row instantiates) +
  `.claude/rules/non-coercion-invariant.md` (free modes are NCI-protected in BOTH
  variants — the A/B test is about *friction*, never about gating the exits)

## Substrate-honest framing

This row does NOT pre-decide that B is better — it records that the layout question
is **empirical, not rhetorical**, and parks it behind the A/B-testing prerequisite.
Until that infra exists, Option A (the chosen direction; canonical grammar table
shipped via #6269, render slice pending) is the live path; this row is the held
alternative + the experiment design that would settle it.
