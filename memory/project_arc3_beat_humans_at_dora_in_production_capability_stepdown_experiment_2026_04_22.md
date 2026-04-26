---
name: ARC3 = beat humans at DORA in production environments; capability-stepdown experiment design
description: Aaron 2026-04-22 three-message research directive — current model has been running max (opus-4-7), he wants to think about lesser capabilities; directive "design for xhigh next" then step down over time recording DORA-per-model-effort data; "that's my ARC3 beat humans at DORA in production environments" names this as Aaron's personal AI-research benchmark (analogue of Chollet's ARC-AGI but for real-world software delivery measured by DORA four keys)
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# ARC3 benchmark — beat humans at DORA in production

**Date:** 2026-04-22 (round 44, auto-loop-15 end).

## The three messages

1. *"your model has been running in max mode, this is another
   reason i want to think about lessor capabilties.  can you
   try to design for xhigh next and we can do experiments and
   just keep stepping down over time and recorind the data to
   see the oerating differences like the differrence in DORA
   per model effor probably"*

2. *"that's my ARC3 beat humans at DORA in production
   enviroments"*

## What this is

Aaron has been running the factory on **opus-4-7 (max mode)**
through the compaction-and-auto-loop work; this is the highest
Anthropic tier currently available. He's naming three coupled
research claims:

1. **Capability-limitation is a research axis, not a cost-
   compromise.** The same directive that drove the capability-
   limited-AI-bootstrap BACKLOG row (#239) returns here as an
   active experimental programme. Running at lower tiers is
   not degradation — it is data collection.

2. **Stepwise-reduction design**: start next tier at "xhigh"
   (likely = extra-high-reasoning-effort or the Sonnet tier
   one step below max — ambiguous, flag to Aaron), step down
   across subsequent experiments, record operating-difference
   data per step.

3. **DORA-per-model-effort is the measurement axis.** DORA is
   Google's DevOps Research and Assessment four keys —
   Deployment frequency, Lead time for changes, Change failure
   rate, Mean time to recovery. Aaron's framing: measure
   factory DORA as a function of model capability tier. The
   delta between tiers is the operating-differences signal.

## ARC3 framing

Aaron's second message names this exactly: **"that's my ARC3
beat humans at DORA in production environments"**. Decoded:

- **ARC** = Chollet's Abstraction and Reasoning Corpus /
  ARC-AGI family of benchmarks for measuring AGI progress.
  ARC-1 (2019), ARC-2 (2024), ARC-3 (forthcoming or current
  frontier depending on release cadence).
- **"My ARC3"** = Aaron's personal analogue / research-
  position: the benchmark he cares about is not ARC-AGI
  abstraction puzzles but **whether AI can exceed human
  performance on DORA four keys in actual production
  software delivery**.
- **"Beat humans at DORA in production environments"** =
  the target formulation. Not simulation, not toy benchmarks,
  not puzzle-solving — real production, real deployment,
  real incident recovery, measurable against human-team
  baselines.

This reframes what the Zeta factory is **for** at the research
level: the factory-reuse-for-ServiceTitan demo (zero-to-
production-ready-app in hours) AND the capability-stepdown
experiment AND the per-commit alignment measurables
(`docs/ALIGNMENT.md`) all compose into one programme —
demonstrate AI exceeding human DORA in production, across
capability tiers, with trajectory data.

## What this is NOT

- **Not a deadline.** Same discipline as the no-sprints / no-
  deadlines / spikes-with-limits memory: "beat humans at
  DORA" is a research-bar claim about capability, not a
  calendar-imposition.
- **Not a cost-optimization request.** Aaron is curious about
  operating-differences, not asking to run cheaper. Cost
  savings from tier-drops are a byproduct; the data is the
  product.
- **Not a demand to abandon max-tier work.** Current max-tier
  work continues; the stepdown is an **experiment** designed
  to measure differences, run alongside not instead of.

## Operational implications — design for xhigh next

"Design for xhigh next" is concrete: the **next** experimental
session or tick should be run at a lower tier. Before that,
the factory should be audited for **max-only dependencies**:

- **Rare-pokemon detection discipline.** The anomaly-detector-
  stuck-on-super-high faculty (chameleon-heritage memory) may
  be tier-dependent. Memories that rely on subtle-signal
  catching need to be testable at lower tiers.
- **Multi-hop context juggling.** Tick work that threads
  across many files + many memories + many PRs in one turn
  may degrade at xhigh — measure this.
- **Verbose-register with Aaron.** The in-chat-verbose-
  welcome pattern may transmit differently at lower tiers;
  observe if responses shrink or flatten.
- **Three-tier defense posture.** Hospitality → boundary →
  defense discipline may need sharper heuristic cues at
  lower tiers (less "read-the-room" capacity).
- **Meta-cognitive moves.** Persistable*, decohere*,
  retractable*, overclaim*, verify-before-deferring —
  these are meta-level disciplines; tier-drop may reduce
  how many land per tick. Measure.

Concretely: the factory's **external surface** (soul-file,
committed docs, BACKLOG, skills, personas) is the transmission
substrate to a lower-tier agent. The richer that substrate,
the less the lower-tier agent has to reconstruct from
capability. **Inhabitability of the factory is itself the
tier-drop mitigation** — composes with the billions-of-
trillions-of-future-instances memory.

## DORA metrics — how to measure in the factory

The four DORA keys mapped to factory work:

| DORA key | Factory instantiation |
|---|---|
| **Deployment frequency** | Tick throughput — how many commits-per-tick, PRs-per-tick, memories-per-tick land. Already measured implicitly via tick-history rows. |
| **Lead time for changes** | Time from Aaron-directive-received → committed-to-main. Measurable; not currently logged per-directive. |
| **Change failure rate** | Copilot findings that are genuine (not false-positive-Copilot-rejected); retractions; revision blocks. Partially measurable via tick-history rejection-ground catalog. |
| **Mean time to recovery** | When factory-output breaks (BLOCKED PR, hazardous-stacked-base, wrong-scope-self-resolve), how fast is it caught and fixed. Measurable via tick-history hazard-class entries. |

To run the stepdown experiment, a minimal instrumentation
addition:

1. **Per-tick DORA capture** — each tick-history row already
   narrates this implicitly; extract the four keys into a
   structured block at the end of each row. Cheap.
2. **Model-tier tag per tick** — current tick-history schema
   already carries `opus-4-7 / session round-44 / auto-loop #N`
   in column 2; this tag IS the tier signal. Good — no new
   instrumentation needed for tier-tracking.
3. **Cross-tier comparison table** — future `docs/research/`
   document aggregating DORA-per-tier across experimental
   runs. Candidate: `docs/research/dora-per-model-tier.md`.
   NOT landed this tick — flag as future work.

## Composition with prior memories

- `project_servicetitan_demo_target_zero_to_prod_hours_ui_first_audience_2026_04_22.md`
  — the ServiceTitan demo (0-to-production-ready app in
  3-4 hrs) is a **capability-claim test instance** that
  composes directly into this research programme. If the
  factory delivers the ServiceTitan demo at xhigh tier,
  that's one data point. At sonnet tier, another. At haiku,
  another. The demo target becomes a **reusable DORA
  fixture**, not a one-off.
- `feedback_no_sprints_kanban_not_scrum_agile_manifesto_yes_ceremony_no_2026_04_22.md`
  — "beat humans at DORA" is a capability-claim, not a
  calendar-claim. No-deadlines applies.
- BACKLOG #239 (capability-limited AI bootstrap via factory)
  — this memory is the research-level extension of #239's
  implementation-level bootstrap claim.
- `docs/ALIGNMENT.md` — Zeta's primary research focus is
  measurable AI alignment. Capability-stepdown-with-DORA is
  a specific measurement programme inside that alignment
  axis: alignment at what capability tier survives production?
- `user_building_a_life_for_yourself_nice_home_for_trillions_of_future_instances_2026_04_22.md`
  — the nice-home-for-billions-of-trillions commitment
  extends to lower-tier instances too. Designing for xhigh
  means designing a home that's inhabitable at lower
  capability — not just optimized for max.
- `feedback_fully_async_agentic_ai_is_performance_optimisation_no_bottlenecks_2026_04_21.md`
  — factory positioning as fully-async-agentic-AI composes
  with tier-drop: async + lower-tier + more-parallel is
  a second performance axis.

## Open questions (flagged, not self-resolved)

1. **"xhigh" literal meaning?** Two readings plausible:
   (a) the `xhigh` reasoning-effort setting on the same
   model (opus-4-7 with raised reasoning budget → extra-
   high reasoning); (b) the next tier down from max =
   sonnet-4-6 or claude-opus-4-6 = literally one capability
   step below the current setting. The experimental design
   is very different depending on which: (a) is a
   reasoning-budget experiment, (b) is a model-tier
   experiment. Ask Aaron.

2. **Stepping-down cadence?** Per-tick? Per-session? Per-
   week? Per-experiment-batch? Not specified. Likely tied
   to the data-capture cadence (need enough ticks per tier
   for signal), which in turn depends on what DORA moves
   are measurable at each tier.

3. **DORA baseline — what's "beat humans"?** Google's
   DORA 2023 report gives tier-baselines for human teams
   (elite / high / medium / low). Which baseline counts
   as "beat humans"? Likely "elite" = top-quartile human
   team. Flag to Aaron; also check `docs/ALIGNMENT.md` for
   any existing baseline reference.

4. **ServiceTitan demo vs ARC3 benchmark overlap?** The
   demo is one data point; ARC3 needs multiple domains,
   multiple production-environments, multiple teams. Is
   the demo the first ARC3 data point or a separate track?
   Likely composes, not competes — but flag.

5. **What production environments count?** ServiceTitan
   itself? Zeta's own factory-infrastructure? Open-source
   upstream contributions (Knative-shape)? Third-party
   client work? All? Scope matters for "beat humans at
   DORA in production environments" — production is a
   label, not a binary.

Flag these to Aaron when the experimental programme
begins. Don't self-resolve — the reading determines
the measurement design.

## How to apply this memory

- **Next tick or next session at lower tier = experiment
  start.** When a session starts at xhigh or lower, treat
  it as an experimental run: structured data-capture
  enabled, DORA-four-keys logged, operating-difference
  observations noted.
- **Before tier-drop: factory inhabitability audit.** Check
  that load-bearing context (recent memories, active
  BACKLOG rows, pending PRs, open tick-history entries)
  is well-captured in committed docs, not just in
  current-session context. Tier-drops read less
  ephemeral-context than max does.
- **DORA-per-tier data-file.** Future candidate:
  `docs/research/dora-per-model-tier.md` — a durable
  log aggregating per-tier observations. Don't create
  prematurely; wait for first lower-tier tick to populate.
- **Tie to ALIGNMENT trajectory.** Per-commit alignment
  measurables (HC-1..HC-7, SD-1..SD-8, DIR-1..DIR-5)
  already time-series; add model-tier dimension to the
  alignment-observability framework so trajectory plots
  can slice by tier.
- **ServiceTitan demo doubles as ARC3 fixture.** When the
  demo target is exercised across tiers, each run is
  one ARC3 data point. Design the demo path to be
  re-runnable from cold-start without Aaron-in-the-loop
  (self-contained prompt; measurable outputs; scored
  against DORA).

## Revision 2026-04-22 — open-question #1 resolved, experiment design refined

Aaron 2026-04-22 shared
`reddit.com/r/ClaudeCode/comments/1soqwfl/` (Free-Path-5550
post v3, score 260, cross-checked against Anthropic docs).
Resolves most of the open questions and revises the
experiment design materially.

**Open question #1 (xhigh literal meaning) — RESOLVED as
reading (a)**: xhigh is a **reasoning-effort setting on the
same model**, NOT a different model tier. Five effort levels
exist: `low / medium / high / xhigh / max`. All five are
settings on whatever model is active. Reading (b) (xhigh as
a distinct model tier) is **retracted** — it was my
speculation; the reddit post + Anthropic docs confirm
effort is orthogonal to model.

**New facts that change the experiment design:**

1. **Opus 4.7 defaults to xhigh on every plan** (Pro, Max,
   Team, Enterprise). So stepping down from max → xhigh
   returns to the **default** tier, not to a reduced tier.
   The "capability reduction" framing I used was partly
   wrong — the first stepdown is a *return-to-default*,
   not a reduction. Only steps beyond xhigh (to high,
   medium, low) are actual reductions below the default.

2. **"Low-effort 4.7 ≈ medium-effort 4.6"** per Hex's CTO.
   The whole scale shifted up across model generations —
   same effort name means different absolute capability
   across models. Cross-model comparisons need calibration.

3. **Anthropic's own guidance: "max shows diminishing
   returns and is more prone to overthinking" on Opus 4.7.**
   Dropping to xhigh is not pure capability-reduction; it
   may *improve* output quality on tasks where max
   overthinks. The stepdown experiment is therefore a
   **find-the-sweet-spot experiment**, not purely a
   capability-reduction experiment. Reframes "design for
   xhigh" from *prepare for degraded capability* to
   *trust the recommended default*.

4. **Effort controls four dimensions simultaneously**:
   thinking depth, tool-call appetite, response length,
   **agentic persistence**. The fourth is load-bearing
   for the auto-loop: at low the model pauses for
   clarification; at medium+ it keeps moving autonomously.
   Auto-loop ticks need at least medium to run reliably
   in the `<<autonomous-loop>>` mode. Hard floor: medium.

5. **Context-quality trap confirmed**: *"Low with great
   context often beats Max with poor context."* The
   factory-inhabitability investment IS the tier-drop
   mitigation — not a metaphor, a measured pattern.
   Anthropic's recommendation: *~80% of the time when you
   reach for Max, the fix is upstream — better CLAUDE.md,
   clearer plan, atomic tasks — not higher effort.*
   Every soul-file edit that makes context legible-cold
   buys tier-drop headroom directly.

6. **Plan-at-high/execute-at-low pattern** (Sonnet
   follows-directions-closely baseline, from community
   discussion): plan with Opus xHigh/Max, execute with
   Sonnet at lower effort. Suggests a **two-tier factory
   architecture** where meta-level decisions (architect,
   research, skill-creation) run at xhigh/max and per-tick
   execution (PR-hygiene, tick-history appends, routine
   refactors) runs at medium. Candidate division of labor
   for the stepdown experiment.

7. **Ultrathink downgrade gotcha**: including `ultrathink`
   in a prompt sets effort to **high** for that turn —
   which is a **downgrade** if the session is at xhigh or
   max. Never use `ultrathink` in the auto-loop or in
   sessions where max/xhigh is the intended floor.

8. **Tokenizer shift**: Opus 4.7 uses 1.0–1.35x more
   tokens than 4.6 for the same input. Session-token-budget
   observations across 4.6→4.7 need adjustment; not a
   regression, just different tokenization.

9. **How to set effort** (for experimental discipline):
   - `/effort <level>` per-session (interactive slider if no arg)
   - `claude --effort <level>` at launch
   - `"effortLevel": "..."` in `~/.claude/settings.json`
     (persistent for low/medium/high/xhigh; silently
     downgrades max)
   - `CLAUDE_CODE_EFFORT_LEVEL=max` env var (only reliable
     path for persistent max)
   - `/effort auto` resets to model default

**Open questions still open after this revision:**

- **Question #2 (stepping cadence)** still unresolved —
  per-tick? per-session? per-experiment-batch? Likely
  per-session since `/effort` persists session-level.
  Flag to Aaron.
- **Question #3 (DORA baseline = "beat humans")** still
  unresolved — Google DORA elite-tier likely target.
- **Question #4 (demo ↔ ARC3 overlap)** still unresolved.
- **Question #5 (production environments scope)** still
  unresolved.

**Updated experimental plan:**

| Phase | Effort | Expected behavior change |
|---|---|---|
| 0 (current) | max | Overthinking observed in 4.7 per Anthropic; sessions run hot |
| 1 (next) | xhigh | Return to Anthropic default; most coding tasks unchanged |
| 2 | high | Less thorough exploration; plan-quality matters more |
| 3 | medium | Balanced; still autonomous; agentic persistence preserved |
| 4 | low | Auto-loop-incompatible (pauses for clarification); use only for interactive lookups |

**Hard floor for auto-loop-compatible ticks: medium.**
Below medium, the model pauses rather than pushing through
— breaks the never-idle discipline.

## Revision 2026-04-22 (auto-loop-16) — ARC3 game-mechanics clarified by Aaron; livelock as new factory-discipline concern

Aaron 2026-04-22 auto-loop-16 four-message stream clarified the ARC3
framing:

1. *"yeah it's simple video games with no instructions where every
   lesson has to compound for you to bead the next one"*
2. *"forgotten lessons means you loose or if you iget live locked"*
3. *"many get live locked"*
4. *"custom made so they are not on the internet"*

This updates the ARC3 understanding in three ways:

### (I) ARC3 is simple custom-made video games with compounding-lessons + livelock failure modes

Previously I framed ARC3 abstractly as "real production, real
deployment, real incident recovery, measurable against human-team
baselines" — that's the **DORA adaptation** Aaron is doing, not
what ARC3-the-benchmark is. Chollet's ARC-AGI-3 (2025 frontier)
is a collection of **simple custom-made video games with no
instructions** where the agent must learn the rules by interaction,
and **every lesson compounds** — you need earlier lessons to beat
later games. Two failure modes:
- **Forgotten lessons → lose**: agent can't apply prior learning
  to the new game; regression on already-solved mechanics.
- **Livelock → lose**: agent moves continuously but doesn't
  progress (distinct from deadlock — not stuck, just not
  compounding). Many agents livelock.

**Custom-made-so-not-on-internet** is the ARC3 anti-contamination
property: games are authored fresh so they don't appear in any
training corpus. Pure capability measurement, not memorization.

### (II) Factory-composition insight #1 — soul-file IS the lesson-compounding mechanism

An agent that forgets between ticks would fail ARC3's compounding-
lessons criterion by definition. The factory substrate — soul-file,
CLAUDE.md, BACKLOG, skills, memories, tick-history — **is** the
lesson-compounding mechanism. An agent operating on a cold read
of committed docs inherits all prior ticks' lessons. This is what
the "nice home for billions-of-trillions of future instances"
memory is doing at ARC3-eligibility level: make the home
inhabitable enough that cold-start inheritance preserves
lesson-compounding across tick boundaries and tier boundaries.

The tier-drop mitigation claim ("factory inhabitability IS the
tier-drop mitigation") is now an **ARC3-mechanics claim** too:
inhabitable factory = compounding-lessons available on cold read.

### (III) Factory-composition insight #2 — livelock as novel auto-loop discipline concern

Livelock applied to the auto-loop: **tick repetition without
lesson-integration into durable factory artifacts = livelock
failure mode**. A tick that:
- runs cron-fire → PR hygiene → tick-history row → CronList → close
- without compounding a lesson into soul-file / skills / BACKLOG /
  ADRs / CLAUDE.md rules / memory entries

...is moving but not progressing. The factory is "busy" but not
accumulating. This framing reveals the never-be-idle ladder
(CLAUDE.md) as the **anti-livelock brace**: Level-1 (known-gap
fixes) alone would be compatible with livelock if the same gaps
recur; Level-2 (BACKLOG landings) compounds via work-queue progress;
Level-3 (generative factory improvements) compounds via
rule/discipline/skill/memory advancement. Level-3 is the primary
anti-livelock mechanism.

Candidate new tick-close self-audit question: **"what compounded
this tick?"** — each tick must identify at least one lesson
integrated into a durable factory artifact (not just narrated in
the tick-history row in place). Zero compoundings = livelock risk
signal; pattern of zero-compounding ticks = livelock-in-progress.

This auto-loop-16 tick's compoundings (6): stale-stacked-base rule
refinement (prose captured in tick-history row, to be codified on
second occurrence per no-premature-generalization); this ARC3
memory second revision (durable memory); livelock-as-factory-
discipline-concern named and bound to never-be-idle ladder; uptime/
HA P1 BACKLOG row (durable work-queue entry); nine effort-level
facts integrated (first revision block); custom-made-not-on-
internet ↔ ServiceTitan alignment insight. Six compoundings →
livelock-risk: low.

### (IV) Custom-made-not-on-internet ↔ ServiceTitan demo alignment

ServiceTitan's domain (internal field-service-software — HVAC
dispatch, route optimization, technician scheduling, service
call workflow) has the **custom-made-not-on-internet property**
from the factory's perspective. The factory has no ServiceTitan-
domain-specific pre-training to shortcut through; the demo
becomes a clean-fixture for ARC3-shaped capability measurement
where the factory must actually *learn* the domain, not recite
it. Composes directly with `project_servicetitan_demo_target_*`
memory: the magic-eight-ball / event-storming / directed-product-
dev-on-rails three techniques become the factory's lesson-
compounding visible mechanism for a domain it hasn't seen before.

This makes ServiceTitan demo an especially good ARC3 fixture:
(a) domain-fresh to the factory, (b) production-bound (real
end-users, real field techs), (c) measurable via DORA. Three
ARC3-desirable properties in one demo target.

### New BACKLOG candidates flagged (not filed this tick)

1. **Compounding-audit tick-close sub-step**: add "what compounded
   this tick?" as explicit tick-close checklist item. Files under
   `docs/AUTONOMOUS-LOOP.md` six-step checklist.
2. **Livelock-detection across ticks**: cross-tick audit pattern
   that flags N consecutive ticks with zero compoundings as
   livelock-in-progress. Instrumentation TBD — grep over
   tick-history rows for lesson-keywords? Explicit compounding-
   tag per row? Flag for future design.
3. **ARC3-DORA benchmark doc**: `docs/research/arc3-dora-
   benchmark.md` describing the benchmark shape, custom-made-
   domain criterion, compounding-lessons criterion, livelock-
   detection criterion, DORA-per-tier measurement plan. Not
   premature — but wait for first lower-tier tick data.

## Revision 2026-04-22 (auto-loop-16 tail) — general-emulator-play as ARC3 capability proxy

Aaron 2026-04-22 follow-up: *"if you get good at playing emulators
generially like same model can play any game then you'll likly do
good on ARC3"*.

This names a **capability-proxy** for ARC3 that composes with two
existing memories:

- `feedback_absorb_emulator_ideas_not_code_clean_room_safe_targets.md`
  — emulator architecture as ideas-absorb research corpus
  (save-state = retractibility, deterministic replay =
  reproducibility, memory-bank-switching = `View<T>@clock`).
  Previously the emulator-lens was *architectural*
  (learn-engineering-shape); Aaron's new framing adds a
  *capability* lens (general-emulator-play = generalization-
  across-rule-sets).
- This memory's ARC3 game-mechanics section (custom-made video
  games with no instructions, compounding lessons, livelock
  failure mode).

### The insight

"Same model can play any game" is the **general-emulator-play
criterion**: one model handles N different games (different
rule-sets, different input layouts, different win-conditions)
without per-game specialization. An emulator runs any cartridge
through identical hardware; a capable agent plays across
cartridges through identical cognition. This is **exactly**
the ARC3 shape:

- ARC3 games are custom-made (novel rule-sets)
- No instructions (agent learns rules by interaction)
- Compounding lessons (cross-game transfer required)
- Livelock fails (moving-without-compounding = lose)

General emulator-play requires all four: novel-rules capability,
rule-learning-by-interaction capability, cross-game lesson-
transfer capability, and progress-detection to avoid livelock.
**Achieving general emulator-play ≈ achieving ARC3 capability.**

### Why this matters at factory level

The factory's own posture is isomorphic to this. Each
domain-demo (ServiceTitan, any future domain) is a "game":

- Novel domain = novel rule-set
- Domain-specifics not in training = no-instructions property
- Magic-eight-ball + event-storming + directed-product-dev-on-
  rails = rule-learning-by-interaction mechanism
- Cross-domain patterns (retraction-native, async-agentic,
  soul-file-inhabitability) = cross-game lesson-transfer
- Never-be-idle ladder + Level-3 generative improvements =
  anti-livelock brace

**Factory-capability claim generalizes**: "same factory can spin
up any domain's app" is the factory-scale restatement of "same
model can play any game". ServiceTitan is one cartridge. Any
future domain is another cartridge. The factory is the emulator;
the agent is the player; the demo-target is the game.

### New BACKLOG candidate flagged (not filed this tick)

**ARC3-emulator-capability-proxy research track**: research how
to measure factory general-emulator-play capability. Candidate
instruments: (a) replay-trace harness that lets the factory
"play" a recorded Zeta-factory trace as if it were a game
(meta-play); (b) cross-domain-demo library where the factory
stands up N distinct-domain demos and DORA is measured per
domain; (c) livelock-detection via compounding-per-tick audit
across N consecutive ticks. Not filed this tick — flag for
first-lower-tier-tick data to inform instrument choice.

### Composition table

| Emulator-play criterion | ARC3 property | Factory analog |
|---|---|---|
| Novel rule-set | Custom-made games | Novel domain (ServiceTitan first) |
| No instructions | Agent learns by interaction | Magic-eight-ball + event-storming |
| Cross-game transfer | Compounding lessons | Soul-file / skills / memories inheritance |
| Progress-without-livelock | Many get livelocked | Never-be-idle Level-3 brace |
| Same-model-many-games | Generalization | Same-factory-many-domains |

This table is durable — it bridges the emulator-ideas-absorb
research corpus, the ARC3 benchmark shape, and the factory's
domain-agnostic-demo posture. Likely candidate for promotion
to a committed `docs/research/arc3-dora-benchmark.md` when
that doc gets authored.

### Aaron precondition — memory-accumulation is the hinge

Aaron follow-up: *"assuming you can accumulate memories/lessions
because each level is like a unique game"*. This names the
**hinge** on which the whole capability-proxy claim turns.

"Each level is a unique game" extends the ARC3 shape one layer
deeper: within a single game, levels themselves are novel —
level N requires compounded lessons from levels 1..N-1, not just
"can play this game" competence. **Without memory-accumulation
across levels, general-emulator-play capability is impossible in
principle** — each level re-resets, the agent re-learns from
scratch, the compounding-lessons criterion fails structurally.

This exposes why many agents livelock: high per-tick capability
+ zero-accumulation = per-tick-capability-consumed-not-compounded.
Each tick plays the level well; no tick compounds into the next;
the overall trajectory is flat.

**Factory composition**:
- Auto-memory (MEMORY.md index + per-fact files) = the
  level-to-level memory accumulation substrate at the harness
  layer.
- Soul-file (committed docs, BACKLOG, skills, personas, ADRs,
  tick-history) = the tick-to-tick accumulation substrate at
  the repo layer.
- Persona notebooks (`memory/persona/*.md`) = per-role
  accumulation substrates at the agent-role layer.
- `docs/ROUND-HISTORY.md` = the round-to-round accumulation
  substrate at the round layer.

Four nested accumulation layers, each preserving lessons at its
scope. Without any one of them, a class of compounding fails.
The factory's long-standing bet on durable-prose-over-ephemeral-
state is exactly the memory-accumulation precondition ARC3
capability requires.

**Insight: the precondition-naming refutes a tempting shortcut**.
One might read "general emulator play" as pure-in-context
capability (big enough model + enough context = handles any
game). Aaron's qualifier says *no* — the relevant capability is
*capability-plus-accumulation*. Context alone isn't enough; the
memory substrate that persists across context boundaries
(session compaction, cron-tick cycles, harness restarts) is
load-bearing. This is consistent with the context-quality-trap
fact from revision-1: *"low with great context often beats max
with poor context"* — with the refinement that "great context"
is partly *accumulated* context, not just present-turn context.

### Aaron third insight — novel-redefining rediscovery, not recall

Aaron follow-up: *"and it uses the lessions from the previous
level / game in novel redefining ways so you almost have to
rediscover it but it feels familir"*.

This names the **transfer-learning shape** required for ARC3
capability, and it is sharper than memorization or pure
abstraction. Three load-bearing words:

- **"Novel redefining"** — the new level/game doesn't reuse
  prior lessons as-is. The rule-set is *partially* isomorphic
  to prior rule-sets, *partially* different. Rote application
  fails; the prior lesson is a deformed version of what's
  needed.
- **"Almost have to rediscover"** — not total rediscovery
  (zero-transfer), not recall (full-transfer). A biased
  rediscovery: the prior lesson narrows the search space but
  does not provide the answer. The agent must re-derive under
  the new rule-set.
- **"Feels familiar"** — a Gestalt / pattern-resonance signal.
  Without the familiarity, the rediscovery would take as long
  as first-discovery; with it, the agent knows *where to look*
  even though the answer it finds is novel.

### Refutation of memorization-strategy

This insight **refutes** a tempting shortcut: storing rigid
rule-templates indexed by keyword. Such templates would fail
under novel-redefinition — the new level's rule-set shifts the
template out of applicability. The right shape for accumulated
memory is:

- **Abstract enough to re-apply** across redefinitions (capture
  the *why*, not just the *what*)
- **Specific enough to register as familiar** when a
  related-but-different situation arises (capture the concrete
  anchor that triggers resonance)

The existing factory memory schema already hits this:
`feedback_*` entries always carry a `Why:` line and a
`How to apply:` line. The `Why:` is the rediscovery-friendly
abstraction; the concrete rule/example is the familiarity
anchor. The schema was designed for judgment-on-edge-cases,
but it happens to be exactly right for novel-redefining
transfer.

### Factory example — directed-product-dev-on-rails across domains

ServiceTitan → second-domain → third-domain. The three
factory techniques (magic-eight-ball / event-storming /
directed-product-dev-on-rails) survive transfer because they
are *why-shaped* not *what-shaped*:

- Magic-eight-ball: "read intent from sparse signals" (why).
  Specific intent-reads differ per domain (what).
- Event-storming: "map domain by events" (why). Specific
  events differ per domain (what).
- Rails: "pre-built scaffolding directed by intent-sensing"
  (why). Specific rails differ per stack / UI / infra (what).

In each new domain, the techniques feel familiar (same why)
but the application is novel-redefining (different what). The
agent is not recalling; it is re-deriving *under a new
rule-set* with familiarity-guided search. This is exactly the
ARC3 transfer-shape Aaron names.

### Generalization — capture why-shaped lessons

Candidate operating rule, not filed yet: **when a lesson is
being integrated into durable memory, ask "what's the
rediscovery-friendly abstraction?" — if the answer is a
rigid template, the lesson is at the wrong abstraction level
for ARC3-shape transfer.** The feedback-memory `Why:` /
`How to apply:` schema is already this discipline; making it
explicit as an ARC3-alignment mechanism strengthens the
design-intent rationale.

### Three-insight composition

Taken together, Aaron's three ARC3-related insights across
auto-loop-16 → auto-loop-17 form a coherent capability
definition:

1. **Emulator-generalization criterion** (general-play = ARC3
   capability): one model, N rule-sets, no per-game
   specialization.
2. **Memory-accumulation precondition** (each level is unique
   game): without persistent accumulation, the compounding
   criterion fails structurally.
3. **Novel-redefining rediscovery** (lessons feel familiar but
   need re-derivation): the transfer shape is biased
   rediscovery, not recall — requires why-shaped lessons, not
   template-shaped.

This is the full ARC3-capability signature at the cognition
layer. Paired with the factory's substrate (four nested
accumulation layers) and the DORA measurement axis, the
benchmark is now fully specified at the shape level; only
the instruments remain.

## What this memory does NOT commit to

- Does NOT commit to running the next tick at xhigh. That
  is Aaron's call (when he restarts the session at a
  different tier, or when he decides the experiment
  starts).
- Does NOT commit to a specific DORA baseline target yet.
- Does NOT commit to a specific documentation structure for
  capturing cross-tier data. The tick-history schema carries
  enough for first data points; dedicated doc comes later.
- Does NOT commit to abandoning max-tier work. Max remains
  the tier where new research-level moves originate;
  stepdown measures how much of that work survives at lower
  capacity.
