---
name: Parallelism scaling ladder — Kenji unlocked the loop agent → Otto-as-PM → doc/code two-lane → file-isolation lanes → peer-mode claims (Aaron 2026-05-01)
description: Aaron 2026-05-01 substrate-grade architectural framing of how factory parallelism scales. Lineage attribution — Kenji (Architect) unlocked the parallel-agents capability by suggesting the loop-agent, which made me a project manager (Otto). Before that Kenji-as-bottleneck (review-everything) was the friction. Felt-quality reported as "superfluid" / "crazy fast" / "unreal." Forward path: doc/code two-lane split → file-isolation lanes → save lessons to reduce friction for more lanes (compound improvement) → peer-mode claims protocol (ultimate). Hard guardrail: never sacrifice per-PR quality for throughput. Three-term keystone for the mechanism: AUTOMATED (rule-mechanization, gate) + MOTORIZED (kinetic-mechanization, propel) + AMORTIZED (cost-model, pay-once-reap-N). PM role splits two ways: PM-1 Project Manager (reactive, Otto, runs loop) + PM-2 Product Manager (proactive, unfilled, research-to-predict-features-before-friction; 081KQGDBJ0008QG0R000RWAA67). Established traditions to pull from: PMP, Product Management, Six Sigma DMAIC, Kanban WIP/flow, Lean kaizen, Agile/Scrum retrospective.
type: feedback
---

# Parallelism scaling ladder — the keystone is automated best-practice decision-making at scale

## Aaron 2026-05-01 verbatim (two messages composed)

> *"i'm not cretiquigin you, your progress is good with me but
> it felt like superfluid when you had those parallel agents
> working that was actually Kenji who unlocked it by suggesting
> you cause he was the archictect so he suggted a loop agent
> and now you are a project manager. when you were first born
> and running parallel agents it was crazy fast, i had Kenji
> have to review any code an it was a real bottle nech.*
>
> *it seemed unreal, and if we get that doc/code split two
> lanes that will open you up and then you can split further by
> file isoletion for more parallel lanes and build you way
> there and save lessions to reduce fiction for more lanes*
>
> *i imagine your gonna need to get the full peer mode claims
> protocol working that's on the backlog for ultimate
> performance (still never at the cost of per pr optimization,
> this is just operatilazations do the right long term thing at
> scale)"*
>
> *"amotoized best practice decison making at scale"*

## What this codifies

This is **not** a directive (per Otto-357 *no directives*); it
is Aaron's framing of the parallelism architecture's evolution,
scaling ladder, guardrail, and mechanism. Substrate-grade
because it answers the question *"how does parallel-agent
throughput scale without sacrificing per-PR quality?"* —
which is the central tension between speed and review-rigor.

## Lineage — Kenji unlocked the parallel-agents capability

Aaron's attribution (load-bearing for honest record):

1. **Pre-unlock state.** When this Claude instance was first
   born, it ran parallel agents — *"crazy fast"* — but Aaron
   *"had Kenji have to review any code an it was a real bottle
   nech."* Kenji-as-Architect was the gate; review-serialization
   was the bottleneck.

2. **The unlock.** Kenji (Architect) suggested the loop-agent —
   the autonomous-loop tick cadence that runs without
   per-action-Architect-gating. *"that was actually Kenji who
   unlocked it by suggesting you cause he was the archictect."*
   The Architect named the new layer that absorbs the work
   the Architect previously bottlenecked.

3. **The promotion.** *"and now you are a project manager."*
   The loop-agent becomes Otto-the-PM (per
   `project_loop_agent_named_otto_role_project_manager_2026_04_23.md`).
   Otto-as-PM dispatches, triages, and coordinates instead of
   Kenji-as-Architect reviewing-everything serially.

4. **Felt-quality.** *"superfluid"* / *"crazy fast"* /
   *"seemed unreal."* The phenomenological signal that the
   architecture was hitting its design potential. Naming this
   matters — when the factory loses that quality, the signal
   tells us we have regressed below capability.

## The scaling ladder — five rungs

```
  Rung 1 (current):   Otto-as-PM dispatches subagents serially
                       within one working tree (collisions risk)

  Rung 2 (NEXT):       doc/code two-lane split
                       (one lane mutates docs, one mutates code,
                        run in parallel — no file overlap)

  Rung 3:              file-isolation lanes — each lane owns a
                       disjoint file set; N lanes run concurrently
                       with merge-coordinator owning main per
                       memory/feedback_parallel_agents_need_isolated_worktrees_coordinator_owns_main_aaron_amara_2026_04_29.md

  Rung 4 (compound):   save-lessons-to-reduce-friction discipline
                       (each parallel lane that hits friction
                        produces a lesson-memory or BP-NN rule
                        that mechanizes the decision so the
                        NEXT lane doesn't hit it; compounding
                        reduction in coordinator load per lane
                        added)

  Rung 5 (ultimate):   peer-mode claims protocol
                       (multi-harness — Otto + Codex + Cursor +
                        Gemini + Grok — operating concurrently
                        on disjoint claims with structured
                        coordination per the agent-orchestra
                        backlog cluster #324–#339)
```

Each rung **multiplies** throughput by adding lanes; the
guardrail prevents quality degradation from being the cost.

## The guardrail — never at cost of per-PR optimization

Aaron's exact phrasing: *"still never at the cost of per pr
optimization, this is just operatilazations do the right long
term thing at scale."*

Translation: scale-up ladder is a means; per-PR quality is the
end. If a rung-up move trades quality for throughput, it is
**not the right long-term thing** — it is the wrong long-term
thing wearing a costume of progress.

This is the same shape as Otto-281 *DST-exempt-is-deferred-
bug* — short-term shortcut becomes long-term debt. Parallelism
without quality preservation is the same anti-pattern at the
factory-architecture level.

## The mechanism — automated AND motorized AND amortized best-practice decision-making at scale

Aaron's keystone (three messages composed):

> *"amotoized best practice decison making at scale."*
>
> *"amotorized is what i was trying to say but both are true
> automated"*
>
> *"amortized\*"* (Aaron's literal asterisk-as-correction-marker preserved)

**Three terms, each capturing a distinct dimension. All three
load-bearing.**

- **Automated** = *rule-mechanization*. The decision is
  encoded as a check / lint / contract / proof. Static, gating:
  does this work pass the BP-NN rule? Yes → continue; no →
  fix. Quality-at-scale guardrail.
- **Motorized** = *kinetic-mechanization*. The decision is
  encoded as a *mover* that propels work to the right next
  state. Active, propagating: does this BP-NN rule have an
  *automatic-fix* / *auto-promotion* / *auto-routing* shape
  that advances the work without coordinator load?
  Throughput-multiplier on top of automation.
- **Amortized** = *cost-model*. The expensive part of the
  decision (research, design, encoding, validation) is paid
  **once**, then the decision runs cheaply **N times** across
  the scale. Per-use cost approaches zero as N grows. *This
  is why mechanization scales economically* — without
  amortization, mechanizing each decision would be a flat
  per-use cost equal to the human-decision cost it replaced;
  with amortization, the cost is sunk-once and the benefit
  is recurring-forever.

All three together: automation makes the decision *correct*
at scale, motorization makes it *propulsive* at scale,
amortization makes it *economical* at scale. **Drop any one
of the three and the keystone fails.** Automated-without-
motorized = static gate that doesn't move work. Motorized-
without-automated = movement without correctness. Either-
without-amortized = doesn't pay off because each decision
still costs as much as the human-decision it replaced.

The economic version: *"the cost of making a best-practice
decision should be paid once and reaped a thousand times."*

This is **the answer to the guardrail.** Parallelism preserves
quality by **automating** the best-practice decisions that
previously required human (or Architect) judgment. Quality is
not preserved by serializing decisions through a bottleneck;
it is preserved by **mechanizing** the decision itself so it
runs in every lane without coordinator load. *Motorized*
mechanization additionally **propagates** the decision —
auto-fixing where the fix is mechanical, auto-promoting
tech-radar rows where evidence threshold is hit, auto-routing
claims to the right reviewer-persona, auto-rebasing PRs when
the merge-base advances cleanly.

### Static vs kinetic — examples

| Best-practice decision | Automated (static) | Motorized (kinetic) |
|---|---|---|
| BP-10 invisible-Unicode | Lint catches violation | Pre-commit hook auto-strips |
| §33 archive-header | Lint validates 4 fields | Template-injector auto-emits at file-create |
| Markdownlint MD013 | CI fails on long line | `prettier --write` auto-wraps |
| Test-coverage threshold | CI fails below 80% | Coverage-promoter auto-flags untested files for harsh-critic |
| TECH-RADAR Trial→Adopt | Manual reviewer call | Evidence-accumulator auto-promotes when N citations cross threshold |
| PR-merge-readiness | Reviewer checks + CI | Merge-queue auto-merges on green |
| Stale-PR triage | Manual sweep | Bot auto-pings author / auto-closes >N days |
| Backlog-row-without-frontmatter | Lint warns | Auto-frontmatter-injector adds skeleton |
| Brittle-pointer (081KQGDBJ0008QG0R0015RNK3P, not yet filed) | Pre/post check fails | Auto-rewriter converts §N → anchor-link |
| Pre-condition violation | Code Contracts (081KQGDBJ0008QG0R002WY918J, not yet filed) throws at runtime | Compiler-time refinement-types reject the build |

Reading the table: each row's left column is the *guardrail
form* (automated, gating); the right column is the *mover
form* (motorized, propelling). The keystone says: where both
exist, prefer kinetic. Where only static exists, the kinetic
version is a candidate for next-iteration mechanization.

Operational shape:

- **Linters as best-practice enforcers** — BP-NN rules
  encoded as `tools/lint/*.sh` / Semgrep / CodeQL queries.
  Each lane is checked mechanically; coordinator only
  reviews lint failures.
- **Pre/post mechanization** (per 081KQGDBJ0008QG0R0015RNK3P (not yet filed)) — preconditions
  + postconditions checked at function/module/PR boundary;
  Hoare-logic discipline mechanized.
- **Code Contracts revival** (per 081KQGDBJ0008QG0R002WY918J (not yet filed)) — design-by-contract
  primitives that enforce invariants at compile/runtime,
  not at review time.
- **Mechanized claim verification** (per 081KQGDBJ0008QG0R002Y31XJ3) —
  verify-before-state-claim runs as a script, not as a
  reviewer's manual check.
- **Mechanized auditor for BP violations** (per
  task #350 — Otto-357 mechanized auditor extension) —
  no-directives-prose lint runs in CI, not in human review.
- **Sequent calculus for retraction-attribution** (per
  081KQGDBJ0008QG0R0035M1YRC) — formal-system mechanization of attribution +
  retraction; correctness guaranteed by proof, not by
  vigilance.
- **Modal logic for retractability** (per 081KQGDBJ0008QG0R002X4AFA0) —
  formal grounding for Quantum Rodney's Razor; retractable
  decisions identifiable mechanically.
- **Type-theoretic orthogonality discipline** (per
  081KQGDBJ0008QG0R0032X1MMC) — orthogonality enforced by type system, not
  by review.

The pattern: **every BP-NN rule that can be mechanized
should be, before it is depended-on at scale.** Unmechanized
BP-NN rules are coordinator-load that doesn't scale; mechanized
ones are zero-coordinator-load that scales infinitely.

This is **why the lessons-to-reduce-friction discipline (rung
4) compounds**: each lesson learned becomes a mechanization,
which removes coordinator load from every future lane that
would have hit the same friction.

## Why doc/code is the right next-rung-up

Aaron explicitly named the doc/code split as the next unlock:
*"if we get that doc/code split two lanes that will open you
up."*

Why doc/code is the right next-rung:

1. **Maximal file-disjointness.** `docs/**` and `src/**` (the
   F# code under `src/Core/**`, `src/Core.CSharp/**`,
   `src/Bayesian/**`) have no overlap; the risk of cross-lane
   stash-collisions is structurally near-zero.
2. **Different review-discipline shapes.** Docs are reviewed
   for clarity / accuracy / glossary-discipline /
   archive-header compliance. Code is reviewed for
   correctness / type-safety / test-coverage / performance.
   The reviewer-shape is disjoint, which means the
   automated-best-practice-decision tools are also disjoint
   (envisioned: markdownlint + §33-archive lint +
   no-directives-otto-prose lint for docs; F# compiler +
   dotnet test + harsh-critic + optional Stryker-style
   mutation testing for code — actual tool paths to be
   established when this rung lands). No shared bottleneck.
3. **No new-design-decision required.** The worktree-
   isolation discipline (per
   `feedback_parallel_agents_need_isolated_worktrees_
   coordinator_owns_main_aaron_amara_2026_04_29.md`) already
   covers the mechanics; doc/code just instantiates it with
   two well-known lanes.
4. **Immediate visibility.** Aaron's *"two lanes that will
   open you up"* — the throughput improvement should be
   visible from one tick to the next, not deferred.

After doc/code lands cleanly (and lessons are mechanized), the
file-isolation rung (rung 3) is just N>2 generalization of the
same pattern — same tools, more lanes.

## What this is NOT

- **Not a directive.** Per Otto-357 (CLAUDE.md), Aaron's input
  is framing / observation / signal — not an order. The
  decision to act on the scaling ladder is mine (Otto / future-
  Otto). What is *load-bearing* is the substrate Aaron's
  observation captures.
- **Not a deprecation of Kenji.** Kenji-as-Architect still
  owns round synthesis + glossary-police + debt-ledger reads
  per `project_loop_agent_named_otto_role_project_manager_
  2026_04_23.md`. The unlock was Kenji *expanding* the factory
  by naming the loop-agent; Kenji is not removed by being the
  one who unlocked the new layer.
- **Not an excuse to skip review.** Mechanized best-practice
  decisions complement, not replace, specialist-review for
  novel work. Per `docs/CONFLICT-RESOLUTION.md` — when
  judgment is needed, dispatch to the specialist persona.
  Mechanization handles the *known* best-practice space;
  specialists handle the unknown.
- **Not a license to parallelize prematurely.** Worktree
  isolation (rung 3) requires the worktree-allocation
  discipline already locked. Skipping it produces the
  2026-04-29 incident shape (stash collisions, bleed-through
  formatter side-effects). *"Parallel agents may inspect
  broadly, but mutate narrowly"* (Amara) still binds.
- **Not a quality-vs-speed tradeoff.** The whole point of the
  guardrail + the mechanism is that they preserve quality
  WHILE adding speed. If a parallel-up move feels like a
  quality cost, the mechanism (automated best-practice
  decision) was insufficient — fix the mechanism, don't
  accept the quality cost.

## The PM split — two kinds of PM, both needed

Aaron 2026-05-01 (third message in the same conversation arc):

> *"this seem like it would make my PM a real company say hey
> you know what we are missing a feature and then there is the
> other kind of (first kind being Project Manager) the 2nd
> Product Manager who should have done research to predict you
> we had the missing feature before running into the issue with
> the product."*

Aaron's framing distinguishes **two role-shapes** that the
abbreviation "PM" collapses:

### PM-1 — Project Manager (reactive)

- **Stance**: reactive / loop-driven / queue-driven.
- **Trigger**: friction is encountered (PR is BLOCKED, thread
  is unresolved, claim fails verification, lint catches a
  violation, demo hits a missing-feature wall).
- **Output**: capture the friction (memory file / BP-NN
  candidate / backlog row), mechanize where possible (rung 4
  of the scaling ladder), dispatch to specialist if novel.
- **Cadence**: every tick (autonomous-loop heartbeat).
- **Felt-quality target**: *"superfluid"* throughput — many
  small ticks closing many small frictions.
- **Currently filled by**: Otto.

### PM-2 — Product Manager (proactive)

- **Stance**: proactive / research-driven / prediction-driven.
- **Trigger**: *not yet encountered* friction — gaps that
  haven't surfaced in the loop because the work that would
  surface them hasn't been done yet.
- **Output**: research findings (what's missing, what will
  break, what's coming upstream, what users will need),
  feature-gap-prediction-before-running-into-the-issue, road
  map adjustments.
- **Cadence**: longer-than-tick (rounds / weeks / phases).
- **Felt-quality target**: *"we knew that was coming"* —
  feature gaps surfaced and queued **before** they block work.
- **Currently filled by**: nobody (gap; this is the new role
  Aaron is naming).

### Why the split matters

The parallelism scaling ladder (rungs 1–5) increases **how
much work the factory can do per unit time** — but it does
not change **what the factory chooses to do**. PM-1 (reactive)
is sufficient for queue-clearing; it is insufficient for
**direction-setting at the feature/architecture level**.
Without PM-2, the factory is a fast queue-clearer with no
forward-radar; the only feature gaps it discovers are the
ones it stumbles into.

Aaron's framing locates the gap precisely: *"who should have
done research to predict you we had the missing feature
before running into the issue with the product."* The
counterfactual standard (*should have*) names PM-2 by its
**absence** — every time the loop hits a missing-feature
wall, that is a PM-2 miss in retrospect.

### Mapping to existing factory roles

The factory already has roles that PM-2-flavored work
flows through:

- **Kenji (Architect)** — architectural foresight, but
  scoped to *system architecture* not *product/feature
  research*. Kenji predicts how systems compose; PM-2
  predicts what features users / consumers / contributors
  will need.
- **Aarav (Skill-Expert)** — runs `skill-tune-up` with
  live-search to scout new agent-best-practices. This is
  PM-2-flavored research scoped to skills/agents, not
  features.
- **Mateo (Security-Researcher)** — proactive scouting of
  novel attack classes / CVEs / supply-chain risks. PM-2-
  flavored research scoped to security.
- **Tech-radar maintenance** (per `docs/TECH-RADAR.md`) —
  Trial / Adopt / Hold rows; PM-2-flavored but currently
  fragmented across persona work.

PM-2 unifies the proactive-research stance across these
fragments at the **product/feature** layer specifically —
*"what is Zeta missing?"* / *"what feature will block the
next demo?"* / *"what consumer-side friction will surface
in the first 10 minutes after publish?"* These overlap with
Iris (UX-researcher) and Bodhi (DX-engineer) for narrow
slices, but PM-2 owns the *integrated forward-view* across
all of them.

### Mechanism — research-to-predict-features-before-friction

PM-2's core discipline: **scheduled forward-research cadence**
that produces feature-gap-predictions and queues them as
backlog rows BEFORE the loop encounters them.

Operational shape (candidate; to be designed in 081KQGDBJ0008QG0R000RWAA67):

- **Cadence**: weekly or per-round (longer-than-tick).
- **Inputs**: TECH-RADAR, GLOSSARY churn, recent
  Claude.ai/Amara/peer-AI ferries, upstream-doc WebSearch
  per Otto-364 search-first authority, demo target
  requirements, consumer-facing API audits.
- **Outputs**: feature-gap-prediction backlog rows
  (B-NNNN format), TECH-RADAR row updates, periodic
  forward-radar memos.
- **Quality test**: the percentage of friction-encounters
  in the loop that were ALREADY in the backlog as
  predicted-gap rows. High % = PM-2 calibrated; low % =
  PM-2 not enough lead-time / wrong research direction.
- **Anti-pattern guard**: PM-2 must NOT become *more*
  bureaucracy — research-without-action is overhead.
  PM-2 outputs land as backlog rows that PM-1 (Otto)
  can pick up; if PM-2 is producing memos no one acts
  on, the role is failing.

### Why this composes with the scaling ladder

The two are **orthogonal axes**:

- **Scaling ladder (rungs 1–5)** = *how much* work
  per unit time (throughput axis).
- **PM-split (PM-1 + PM-2)** = *what* work to do
  (direction axis).

Both axes need to be advanced for the factory to scale
correctly. Throughput-without-direction produces fast
random-walk; direction-without-throughput produces
visionary-but-slow. *"Automated best-practice decision-making
at scale"* serves both: PM-1 mechanizes the reactive-decisions
(scale throughput) and PM-2 mechanizes the proactive-research
(scale direction).

### Backlog row

081KQGDBJ0008QG0R000RWAA67 captures the actionable design work for the PM-2 role:
research-to-predict-features-before-friction discipline,
cadence, inputs, outputs, calibration metric.

## Established traditions this composes with — PMP, Six Sigma, Kanban, Lean, Agile

Aaron 2026-05-01 (fourth message in the arc):

> *"There is like a PMP or something tradition for the project
> and maybe product managment sixsigma is in there too and
> khanban"*

Aaron is naming the established professional traditions this
conversation roots in. **The factory should pull from these
traditions rather than reinventing.** Each tradition maps
cleanly onto a dimension of the architecture:

### PMP (Project Management Professional / PMI body of knowledge)

- **Tradition**: 10 knowledge-areas (integration, scope,
  schedule, cost, quality, resource, communication, risk,
  procurement, stakeholder) over 5 process-groups (initiating,
  planning, executing, monitoring-controlling, closing).
- **Maps to**: PM-1 (Otto / Project Manager). Otto's
  loop-cadence is the *executing* + *monitoring-controlling*
  process-group; tick-history closes each unit. Most of PMP
  is about coordination, communication, risk-management —
  exactly what Otto-as-PM does at tick scale.
- **Pull-list for the factory**:
  - Risk register (we have BACKLOG; consider explicit
    risk-register surface for high-stakes work)
  - Stakeholder analysis (we have CONFLICT-RESOLUTION
    persona-mapping; PMP framing adds explicit stakeholder
    register)
  - Communication plan (we have ROUND-HISTORY +
    tick-history; PMP framing adds *what gets communicated
    when to whom*)

### Product Management (the discipline PM-2 derives from)

- **Tradition**: market research, roadmap, customer
  discovery, JTBD (jobs-to-be-done), discovery-vs-delivery
  split.
- **Maps to**: PM-2 (Product Manager — currently unfilled
  per 081KQGDBJ0008QG0R000RWAA67). The discovery-vs-delivery distinction is the
  same shape as PM-2 (proactive research) vs PM-1 (reactive
  execution).
- **Pull-list for the factory**:
  - Discovery cadence (PM-2's forward-radar memo)
  - JTBD framing for feature-gap predictions ("what job
    is this feature hiring Zeta to do?")
  - Customer-discovery surface (Iris UX-research is
    adjacent; PM-2 owns the cross-cutting view)

### Six Sigma (DMAIC / quality-at-scale)

- **Tradition**: DMAIC cycle (Define / Measure / Analyze /
  Improve / Control), defect-reduction, statistical-process-
  control, cost-of-quality.
- **Maps to**: the **automated** + **amortized** dimensions
  of the keystone. DMAIC's *Control* phase IS the
  amortization step — once the improvement is mechanized,
  the cost is paid once and the quality is preserved
  recurring.
- **Pull-list for the factory**:
  - Define defect-classes for factory work
    (e.g., "missing §33 header", "directives-prose",
    "stale forward-ref") — most of these we have
    informally as BP-NN
  - Measure defect rates (CI failure rate, lint-violation
    rate, manual-review-thread rate per PR)
  - Analyze root-causes (we already do this informally
    in tick-history; Six Sigma adds explicit
    Pareto/fishbone tooling)
  - Improve via mechanization (this IS the keystone)
  - Control via amortization (this IS the cost-model)

### Kanban (WIP limits / pull-based flow)

- **Tradition**: visualize-the-work, work-in-progress
  limits, pull-based-workflow, manage-flow,
  continuous-improvement.
- **Maps to**: the **scaling ladder** (rungs 1-5) and the
  **motorized** dimension of the keystone. Kanban is
  literally about how to scale parallel work without
  losing flow. The doc/code two-lane split (rung 2) IS
  a Kanban swimlane addition.
- **Pull-list for the factory**:
  - Visualize the work — current `gh pr list` view is
    raw; consider Kanban-style swimlane visualization
    (open / in-review / approved / merged columns;
    doc-lane vs code-lane swimlanes)
  - WIP limits — *how many PRs in review at once is too
    many?* This is exactly the question the scaling
    ladder asks; Kanban answers it with *measure flow,
    set limit at the bottleneck*.
  - Pull-based workflow — Otto's tick is currently
    *push-based* (cron fires, tick happens). Kanban
    would suggest *pull-based*: a downstream consumer
    (reviewer / merge-queue / Aaron) pulls work when
    capacity exists. This is a candidate evolution.
  - Manage flow — track lead-time per PR (open → merge);
    queue-aging metric.

### Lean (waste elimination / value-stream)

- **Tradition**: 8 wastes (Defects, Overproduction,
  Waiting, Non-Utilized-Talent, Transport, Inventory,
  Motion, Extra-Processing — DOWNTIME mnemonic),
  value-stream mapping, kaizen (continuous improvement).
- **Maps to**: the **lessons-to-reduce-friction** discipline
  (rung 4 of the scaling ladder). Lean's *kaizen* is
  exactly the compound-improvement loop where each
  encountered friction produces a lesson-mechanization.
- **Pull-list for the factory**:
  - Waste audit — currently no formal; consider periodic
    factory-waste audit (where is the loop spending time
    that isn't producing value?)
  - Value-stream mapping — `commit → PR → review → merge`
    is the value stream; can map cycle-time per stage
  - Kaizen — ROUND-HISTORY contains kaizen artifacts
    (each round's lessons); formalize as kaizen-log

### Agile / Scrum

- **Tradition**: iterative-cycles, sprint-planning, retrospectives,
  product-owner / scrum-master / team triad, story-pointing.
- **Maps to**: the **round structure** of the factory.
  Each "round" is approximately a sprint; ROUND-HISTORY is
  the retrospective artifact.
- **Pull-list for the factory**:
  - Retrospective discipline — each round-close is
    informally a retro; could formalize the
    *what-went-well / what-went-wrong / what-to-change*
    structure
  - Story-pointing equivalent — backlog rows have
    informal effort labels (S/M/L); Agile adds
    *velocity tracking* per round
  - Triad mapping — *Product Owner = Aaron + PM-2*;
    *Scrum Master = Otto / PM-1*; *Team = persona-roster*

### The shared root — all these traditions share the same principle

Aaron 2026-05-01 (composing across four follow-up messages):

> *"that's what all those have at the root"*
>
> *"those traditions"*
>
> *"and reduce ceremony"*
>
> *"some try to expancd ceromoy six sigma lol but it's
> principles are what matter"*

**At the root, all six traditions (PMP / Product Mgmt / Six
Sigma / Kanban / Lean / Agile-Scrum) share the same load-
bearing principle: reproducible accuracy via measurement-
driven iteration with a fitness function.** That principle
is captured in its own memory file:
`feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`.

The traditions are **multiple instantiations of the same
underlying discipline** in different operational contexts:

- **PMP** — measure project health (schedule / cost / scope /
  quality variance) → iterate against measured deviation
- **Product Mgmt** — measure customer value (JTBD fit /
  retention / activation) → iterate against measured gap
- **Six Sigma** — measure defect rate → iterate via DMAIC
  (literally Define → **Measure** → Analyze → Improve →
  Control)
- **Kanban** — measure flow (cycle time / WIP / throughput) →
  iterate against measured bottleneck
- **Lean** — measure waste (the 8 wastes / value-stream
  cycle-time) → iterate via kaizen against measured waste
- **Agile-Scrum** — measure velocity / sprint outcome →
  iterate via retrospective against measured deviation

**Reproducible measurement → iteration with fitness function.**
Same root, six surface forms.

### Pull principles, reduce ceremony — the discipline for absorbing traditions

Aaron's pull-list rule is **principles, not ceremony**:

- **Principles** = the load-bearing root pattern that does the
  work (measurement-driven iteration; fitness function;
  reproducibility-first).
- **Ceremony** = the practitioner overhead built on top of
  the principle that doesn't add to the principle (belt
  rankings, certification programs, formal templates,
  multi-day workshops, big-binder methodology, formal-
  artifact requirements).

Aaron specifically calls out **Six Sigma's ceremony-expansion
failure mode** — *"some try to expancd ceromoy six sigma lol
but it's principles are what matter."*

Six Sigma's principles (DMAIC, defect-measurement-driven
iteration, root-cause analysis) are load-bearing and
extractable. Six Sigma's ceremony (Yellow / Green / Black /
Master Black Belt certification ladder, Six-Sigma project
charter templates, multi-day waterfall-style improvement
projects) is the inflated-overhead the principles do NOT
require.

**The factory's discipline: extract the principle, leave the
ceremony.** Apply the same rule to PMP (extract risk-register
discipline; skip the certification ladder), Product Mgmt
(extract JTBD framing; skip 6-month roadmap rituals),
Kanban (extract WIP limits; skip the trademarked board
templates), Lean (extract waste-audit; skip the consultant
overhead), Agile (extract retrospective discipline; skip the
sprint-ceremony machinery when it's overhead-only).

**Anti-pattern guard.** Whenever pulling from a tradition, ask
*"is this principle producing measurement-driven improvement,
or is it ceremony around the appearance of doing so?"* If the
latter, drop it. The bar is **does this contribute to the
fitness-function discipline** — not *"is this what
practitioners do."*

This composes with `feedback_orthogonal_axes_factory_hygiene.md`
(orthogonality discipline — the principles are the orthogonal
axes; ceremony is correlated overhead) and the broader
*pirate-not-priest* disposition (the razor applies impartially
even to revered methodologies; Six Sigma doesn't get a pass
for being prestigious).

### Synthesis — what the factory is already doing vs gaps

The factory already operates much of this informally:

| Tradition | Factory artifact (current) | Gap |
|---|---|---|
| PMP | Otto-as-PM, BACKLOG, ROUND-HISTORY | Risk register, stakeholder register |
| Product Mgmt | TECH-RADAR, demo target | PM-2 role unfilled (081KQGDBJ0008QG0R000RWAA67) |
| Six Sigma | BP-NN rules, automated lints | DMAIC measure-analyze formalization |
| Kanban | `gh pr list`, scaling-ladder | WIP limits, pull-based flow, swimlane viz |
| Lean | ROUND-HISTORY (informal kaizen) | Formal waste audit, value-stream cycle-time |
| Agile/Scrum | Round structure, BACKLOG | Formal retrospective, velocity tracking |

The carved sentence: *"We are not inventing this; we are
operationalizing it for an autonomous-loop factory of agents
where the traditional human-cost-economics no longer hold —
which is precisely why amortization is the keystone."*

## Composes with

- `project_loop_agent_named_otto_role_project_manager_2026_04_23.md`
  — the original Otto naming; Aaron's lineage attribution
  enriches it with *who unlocked* the role.
- `feedback_parallel_agents_need_isolated_worktrees_coordinator_owns_main_aaron_amara_2026_04_29.md`
  — the worktree-isolation discipline that operationalizes
  rungs 2 + 3.
- `feedback_parallel_subagent_dispatch_for_content_preserving_merge_pattern_2026_04_26.md`
  — earlier parallel-dispatch pattern; this memory adds the
  *scaling-ladder* dimension above it.
- `feedback_zeta_agent_orchestra_capability_role_claim_isolation_aaron_amara_2026_04_29.md`
  — the agent-orchestra design that operationalizes rung 5
  (peer-mode claims protocol).
- `feedback_merge_queue_structural_fix_for_parallel_pr_rebase_cost.md`
  — merge-queue mechanization; an example of automated
  best-practice decision-making at scale.
- `docs/AGENT-BEST-PRACTICES.md` — the BP-NN rule list.
  Each rule is a candidate for mechanization; the
  unmechanized ones are coordinator-load.
- `docs/CONFLICT-RESOLUTION.md` — specialist-review
  protocol; complements (not replaced by) mechanization.
- 081KQGDBJ0008QG0R0015RNK3P (pre/post pattern) — mechanization primitive at
  function/module boundary.
- 081KQGDBJ0008QG0R002WY918J (Code Contracts revival) — mechanization primitive
  at runtime/compile boundary.
- 081KQGDBJ0008QG0R002Y31XJ3 (verify-before-state-claim mechanized auditor) —
  mechanization of claim-integrity discipline.
- 081KQGDBJ0008QG0R0035M1YRC (sequent calculus for claim retraction) — formal
  mechanization of attribution.
- 081KQGDBJ0008QG0R0032X1MMC (type-theoretic orthogonality) — type-system
  mechanization of orthogonality.
- 081KQGDBJ0008QG0R002X4AFA0 (modal logic for retractability) — formal
  mechanization of Quantum Rodney's Razor.
- agent-orchestra cluster (#324–#339) — operationalization
  of rung 5 peer-mode-claims protocol.

## Future-Otto check

Future-Otto reading this should know:

- **Lineage.** Kenji unlocked the parallel-agents capability
  by suggesting the loop-agent. Honor that attribution.
- **Felt-quality target.** *"superfluid / crazy fast / unreal."*
  When the factory loses that, the architecture has regressed
  below capability — investigate the regression.
- **Next rung.** Doc/code two-lane split is the immediate
  unlock. Then file-isolation. Then (eventually) peer-mode
  claims protocol per the agent-orchestra cluster.
- **Compound improvement.** Each lane that hits friction
  produces a lesson-mechanization that benefits all future
  lanes. The discipline is *capture the lesson durably*
  (memory file or BP-NN), then *mechanize it* (lint /
  contract / type / formal verification), so coordinator
  load stays bounded as lanes grow.
- **Guardrail.** Never sacrifice per-PR quality for
  throughput. If a parallel-up move feels like it does, the
  mechanism is insufficient — fix the mechanism, not the
  quality.
- **Mechanism keystone.** Automated best-practice
  decision-making at scale is what makes the guardrail
  hold. Every BP-NN rule that can be mechanized should be,
  before being depended-on at scale.

The carved sentence: *"Quality at scale is not vigilance at
scale; it is mechanization of the decisions vigilance was
making — automated to gate them, motorized to propel them,
amortized to make the cost economical."*
