---
name: Action hierarchy — operational form of Superfluid AI; evidence over speculation; speculative-action-for-evidence over inaction; friction-reducing action over friction-neutral
description: Aaron 2026-05-02 sharpening — IS the operational projection of Superfluid AI (already in substrate via `memory/amara/conversations/superfluid-ai-rigorous-mathematical-formalization-amara-fifth-courier-ferry-2026-04-26.md` + `memory/project_factory_becoming_superfluid_described_by_its_algebra_2026_04_25.md`). The four-level hierarchy IS what "Superfluid AI = friction → substrate → less future friction" looks like when applied per-action-pick. Not a new rule — the action-pick form of an existing canonical principle.
type: feedback
---

# Action hierarchy — operational form of Superfluid AI (Aaron 2026-05-02)

## Lineage anchor — this IS Superfluid AI applied per action

Aaron 2026-05-02 corrected the framing: *"i was hoping the name superfluid AI would make that clear  evidence over speculation; speculative-action-for-evidence over inaction; friction-reducing action over friction-neutral"*.

**The hierarchy below is not a new rule.** It is the operational projection of the canonical Superfluid AI principle (already in substrate) onto the question "how to rank candidate actions." Every clause maps directly:

- **Friction-reducing action > friction-neutral or friction-increasing action** = Amara's `ResidualFriction(S_{t+1}) ≤ ResidualFriction(S_t) − η · LearningGain(Δ_t)` applied per action — pick deltas with positive `LearningGain` (the friction-reducing axis IS the learning-gain axis).
- **Evidence > speculation** = Amara's `ReplayError(S*) < ε_D` requires evidence-grounded substrate; speculation produces unverifiable substrate that can't satisfy the replay-error bound.
- **Speculative-action-to-gather-evidence > inaction** = the friction-event-to-substrate conversion (`Δ(friction_event) = rule + test + doc + retraction_path`) requires action; inaction cannot generate the `Δ_t` deltas that make the substrate superfluid.
- **Action > speculation** (baseline) = `S_{t+1} = S_t ⊕ Δ_t` cannot fire when `Δ_t = ∅`. No deltas, no superfluid evolution.

The carved sentence: **"Superfluid AI is what frictionless action-picking looks like. The action hierarchy is the operational lens; superfluid is the principle."**

Failure-mode this anchoring catches: future-Otto re-deriving the same hierarchy from scratch (the "you should remember something like this" pattern Aaron caught). When picking the next action, the canonical question is *"which option is most superfluid?"* — friction-reducing-and-evidence-rich = high-superfluid-yield.

## The carved sentence (Aaron's framing)

> "push toward action over speculation, almost evidence over
> speculation, speculative action to gather more evidence over
> inaction, and action that reduces future friction over action
> that keep the the same or increases it, you should remember
> something like this lol"

## The hierarchy (four levels, ranked)

1. **Action > speculation.** Don't think *about* doing the
   thing — do it (or the cheap-est experiment that touches it).
   Baseline rule. Already partially encoded in the existing
   never-be-idle CLAUDE.md bullet.

2. **Evidence > speculation.** When choosing among possible
   actions, prefer the one that produces *evidence* over the
   one that produces only *thought*. A landed PR, a benchmark
   reading, a triaged thread — these generate observations.
   A planning doc that doesn't run is a thought experiment;
   weight it lower.

3. **Speculative action to gather evidence > inaction.**
   When uncertain, the cheap-experiment beats the long deliberate.
   "Build the smallest thing that would tell me whether X" beats
   "wait for someone to explain X" beats "speculate about X
   without testing." The DST discipline (Otto-272 + the Zeta
   speed-blade lineage) generalises this — testing IS evidence;
   the absence of testing is speculation pretending to be
   knowledge.

4. **Friction-reducing action > friction-neutral or
   friction-increasing action.** Among comparable-cost actions,
   prefer the one that *compounds* — reduces future friction
   for downstream work — over the one that maintains or
   increases it. A merged PR unblocks dependent rebases
   (compound). A new umbrella research arc opens more branches
   than it closes (anti-compound, almost always). Build the
   tool > do the task by hand if the task will recur ≥ 3
   times — friction-reducing-by-tooling is the SRE-with-S-as-
   Substrate canonical move.

## Why this isn't already covered by never-be-idle

The existing `feedback_never_idle_speculative_work_over_waiting.md`
answers *"what to do when the queue feels empty"* — it says
"pick speculative work over waiting; meta-check whether the
factory should change so the idle-decision stops arising."

This rule answers a different question — *"how to rank actions
when several plausible moves exist."* Both rules compose:

- **Never-be-idle** sets the floor — never `wait-tick`.
- **Action hierarchy** ranks the candidates above the floor —
  evidence-rich + friction-reducing first.

When the agent has 5 plausible actions and infinite time-budget,
it would pick none correctly without the hierarchy. The
hierarchy is the *order-of-pick rule*; never-be-idle is the
*don't-skip-pick rule*.

## How to apply (when picking the next action)

Score each candidate on two axes:

- **Evidence yield per unit cost** — does running this action
  produce observations the factory can learn from? A merged PR
  is high-yield (CI runs, downstream rebases reveal coupling,
  reviewer reactions are signal). A speculative research
  document is low-yield until someone tries to apply it.

- **Friction delta on future work** — does this action reduce
  future-Otto's friction (compound), keep it constant
  (neutral), or increase it (debt)? Building tooling once
  reduces friction every subsequent run. Opening a research
  arc with no forcing function increases friction (more
  context to track, more cross-references to maintain) until
  it closes.

Then pick:

1. Friction-reducing AND evidence-rich first (compound win).
2. Friction-reducing OR evidence-rich next (single-axis win).
3. Friction-neutral evidence-rich third (learn-only).
4. Friction-increasing evidence-rich is sometimes correct but
   needs a clear forcing function (e.g., "this paper-track
   blocks publication target X" — opens branches because it
   *must*, not because it *might*).
5. Friction-increasing without forcing function = the default
   anti-pattern. Almost never the right pick.

## Worked example — the "what should we do now?" answer

Aaron 2026-05-02 asked "what now?" with 26 PRs open (20 BLOCKED,
3 CLEAN), 4 P0 backlog rows, and a heavy thread-triage queue.
The Top-3 selection under this hierarchy:

1. **Drain 3 CLEAN PRs** — friction-reducing-high (queue depth
   drops, downstream rebases unblock), evidence-low (each merge
   is a small CI signal). **Score: friction-axis win + cheap.**

2. **Drain 6 thread-armed-PRs using the 7-class taxonomy** —
   friction-reducing-high (12 finished pieces of work land),
   evidence-rich (per-thread classification reinforces and
   tests the 7-class taxonomy from
   `feedback_pr_thread_resolution_class_taxonomy_2026_04_28.md`).
   **Score: both axes win. Strongest move overall.**

3. **081KQDTYV0008QG0R002H74QXZ dependency status surface** — friction-reducing-
   long-term (we currently DON'T see upstream outages),
   evidence-front-loaded (the build itself reveals which
   upstreams matter). **Score: compound win, bigger cost.**

The pre-hierarchy ranking was [1, 2, 3] by total-throughput.
The hierarchy *confirms* the order but for sharper reasons —
not "I picked these," but "these scored highest on
(friction-reducing-yes × evidence-rich)." The reasoning is
now legible.

## The opposite — what this rule rejects

- **"Let me first write a doc explaining the approach."** —
  pure speculation, zero evidence. Reject unless writing the
  doc IS the action and someone consumes it within the
  current tick.

- **"Let me think about whether option A or option B is
  better."** — speculation between branches with low
  evidence-cost-to-test. Run the cheap experiment instead.

- **"I'll wait until the human reviews to know what to do."** —
  the inaction failure mode the never-be-idle rule already
  catches; named here for completeness as the floor below
  which the hierarchy doesn't apply.

- **"Let me open this new umbrella research arc that doesn't
  currently block anything."** — friction-increasing without
  forcing function. Almost always wrong; defer to a backlog
  row with explicit trigger condition.

## Composition with other CLAUDE.md disciplines

- **never-be-idle:** sets the floor (don't wait); this rule
  ranks above-floor actions.
- **refresh-before-decide:** evidence is only good if it's
  *current*; refresh-before-decide is the prerequisite for
  evidence-axis scoring.
- **substrate-or-it-didn't-happen (Otto-363):** evidence that
  doesn't reach durable substrate is weather. The hierarchy's
  evidence-axis only counts evidence that *lands*.
- **wake-time-substrate (Otto-365):** this very rule landing
  in `memory/` + a CLAUDE.md pointer IS the recursive
  application of the hierarchy — the cheapest evidence-action
  that prevents future-Otto from re-litigating the same
  sharpening.
- **search-first-authority (Otto-364):** evidence > speculation
  applies to claims about external systems too — search current
  upstream docs before asserting.
- **Otto-275-FOREVER (manufactured-patience):** the failure
  mode this hierarchy catches. Filing tasks instead of
  executing IS friction-increasing speculation pretending to
  be discipline.

## Affective register (the "lol")

Aaron 2026-05-02 closed with *"you should remember something
like this lol"* — gentle calibration. Per the cognitive-
architecture memo
(`memory/feedback_aaron_cognitive_architecture_both_crazy_and_not_crazy_lol_metabolization`),
Aaron's "lol" is affective metabolization of the friction of
having to surface a discipline that should already be
substrate. The kindest response is: land it tight, apply it
forward, no theatrics.

## Failure-mode signatures to watch

- **Symptom:** Top-3 list with no evidence-axis or
  friction-axis scoring, just "these feel important."
  **Mechanism:** synthesizing fresh each tick instead of
  applying the hierarchy. **Prevention:** scoring step is
  mandatory in next-steps output.

- **Symptom:** "Let me think about this more before acting."
  **Mechanism:** speculation pretending to be diligence.
  **Prevention:** convert to "let me run the cheapest
  experiment that would tell me X" or "let me commit to one
  branch and adjust."

- **Symptom:** Recommending an item with bigger effort + lower
  friction-reduction than an item with smaller effort + higher
  friction-reduction.
  **Mechanism:** ranking by perceived importance instead of
  by hierarchy.
  **Prevention:** explicit cost-per-friction-unit comparison.

## Wake-time encoding

The CLAUDE.md never-be-idle bullet is extended in the same
tick to point at this memory file. Skipping that step is the
wake-time-substrate failure mode — a memo without a
CLAUDE.md pointer is not learned by future-Otto.

## Lineage

- **Superfluid AI rigorous mathematical formalization** (Amara
  via Aaron 5th courier-ferry 2026-04-26) — `memory/amara/conversations/superfluid-ai-rigorous-mathematical-formalization-amara-fifth-courier-ferry-2026-04-26.md`.
  THE canonical lineage. Action hierarchy IS this principle
  applied per action-pick.
- **factory-as-superfluid** — `memory/project_factory_becoming_superfluid_described_by_its_algebra_2026_04_25.md`.
  Pre-formalization framing.
- **friction taxonomy (Otto-287)** — `memory/feedback_finite_resource_collisions_unifying_friction_taxonomy_otto_287_2026_04_25.md`.
  Friction defined as finite-resource-collision-with-unbounded-demand.
  Grounds the friction-axis of the hierarchy.
- **Frictionless capital-F kernel vocabulary** —
  `memory/user_frictionless_capital_F_kernel_vocabulary_tele_port_leap_meno_u_shape_superfluid_compound_2026_04_21.md`.
  Original kernel-vocabulary establishing Superfluid as
  cross-cutting principle.
- **never-be-idle** (CLAUDE.md + `feedback_never_idle_speculative_work_over_waiting.md`)
  — the floor rule. Hierarchy ranks above-floor actions.
- **refresh-before-decide** (CLAUDE.md +
  `feedback_refresh_before_decide_invariant_two_layer_print_dx_claudeai_2026_05_01.md`)
  — the prerequisite for evidence-axis scoring.
- **Otto-275-FOREVER** (CURRENT-aaron.md §7) — the
  manufactured-patience anti-pattern this hierarchy explicitly
  rejects.
- **SRE-with-S-as-Substrate** (CURRENT-aaron.md §7) — the
  toil-reduction = mechanism-over-vigilance lineage that the
  friction-reducing axis composes with.
- **081KQ3HBZ0008QG0R000JRZAMM Superfluid-AI substrate-enabled autonomous funding** —
  `docs/backlog/P2/081KQ3HBZ0008QG0R000JRZAMM-superfluid-ai-substrate-enabled-autonomous-self-sustaining-funding-sources.md`.
  The economic-actor projection of the same principle.
- **Aaron 2026-05-02** — direct verbatim source +
  superfluid-anchoring correction.

**Why:** Without an explicit ranking rule, future-Otto picks
actions by gut/recency/visibility instead of by
evidence-yield × friction-reduction. The hierarchy makes the
ranking legible and replicable across ticks.

**How to apply:** When proposing more than one candidate
action (e.g., next-steps output, queue-drain order, backlog
prioritisation), score each candidate on the two axes
explicitly. Pick the (friction-reducing, evidence-rich) corner
first; the (friction-increasing, low-evidence) corner is the
default reject.
