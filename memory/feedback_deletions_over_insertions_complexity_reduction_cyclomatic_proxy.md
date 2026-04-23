---
name: Deletions > insertions (tests still passing) = complexity-reduction positive signal; cyclomatic complexity is the proxy; total CC / LOC ratio should trend down over time with local-optimum floor
description: The human maintainer 2026-04-22 auto-loop-37 developer-values + measurability statements. (1) *"i feel good about myself as a devloper when i delete more lines that i add in a day and nothing breaks, means i reduced complexity"*; (2) *"well yclomatic complexity is a proxy for that"*; (3) *"a metric that would [matter]: add up our cyclomatic complexity and / lines of code (or vice versa i also get inverses backwards) should decrease over time until it hit a floor which could be a local optimum"*; (4) *"if it's going up you are wring shit cod[e]"*. Net-negative-LOC ticks with tests passing are a POSITIVE outcome. Codebase-total CC/LOC (or LOC/CC — direction TBC) should trend DOWN over time; floor = local-optimum convergence. Trend UP = code-quality regression ("shit code"). Rodney's Razor in developer-values voice.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

**Migrated to in-repo memory/ on 2026-04-23** via AutoDream
Overlay A opportunistic-on-touch (third migration in the
2026-04-23 cadence; same discipline as PRs #157 and #158).
Sibling to `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md` (migrated via PR #158)
(both from the 2026-04-22 auto-loop-37 developer-values
thread). Per-user source retains "Migrated to in-repo" marker
at top for provenance.

**Verbatim 2026-04-22 auto-loop-37 (four messages):**

1. *"i feel good about myself as a devloper when i delete
   more lines that i add in a day and nothing breaks, means
   i reduced complexity"*
2. *"well yclomatic complexity is a proxy for that"*
3. *"that a metric that would atter add up add our
   cyclomatic complexity and / lines of code (or vice versa
   i also get inverses backwards) should decrease over time
   untill it hit a floor which could be a local optimum"*
4. *"if it's going up you are wring shit cod[e]"*

**Rule:** A day / tick / PR that **deletes more lines than it
adds while tests continue to pass** is a **positive outcome**,
not a neutral one and not a cost. Factory scoring, developer
satisfaction signals, and factory-health metrics should reward
net-deletion. Cyclomatic complexity delta is the proxy for the
"and nothing breaks" part — lower cyclomatic complexity per
module over time is the deeper signal.

**Why:**

- **Rodney's Razor in the maintainer's developer-values voice.** The
  factory already has `.claude/skills/reducer/` (reducer skill)
  encoding the essential-vs-accidental cut. This memory is the
  same principle stated from the maintainer's first-person
  satisfaction register: *"I feel good about myself as a
  developer when …"*. Rodney-the-skill formalizes the cut;
  this memory tells the factory the cut is load-bearing for
  maintainer morale, not just theory.
- **Goodhart-resistant in a specific way.** LOC-added is self-
  gameable — padding, verbose scaffolding, speculative
  abstractions all inflate insertions. LOC-deleted is *much*
  harder to game because:
  - You can only delete code that *exists* (inventory-bounded).
  - Tests-must-pass is a world-response constraint the agent
    does not unilaterally control — the test suite responds,
    not the agent.
  - Net-deletion-with-tests-passing is strong evidence the
    deleted code was genuinely accidental complexity.
- **Cyclomatic complexity is the deeper proxy.** Raw LOC-delta
  can be fooled by reformatting / whitespace / rename churn.
  Cyclomatic complexity measures branching / decision density
  — the thing that actually makes code hard to reason about.
  the maintainer's follow-up naming it is the intellectually-honest
  refinement: LOC-delta is the convenient daily proxy,
  cyclomatic-complexity-delta is the real measure.
- **Composes with the Goodhart-resistance correction** filed
  same tick (auto-loop-37). Outcome-based scoring should reward
  *both* world-response additions (commits merged, rows closed,
  validations received) AND world-response subtractions (code
  deleted with tests passing, cyclomatic complexity reduced).
  The scoring is symmetric around the real world, not biased
  toward volume.

**How to apply:**

- **Force-multiplication scoring** ((historical / per-session force-multiplication-log — not in-repo as a standing doc):
  add a **complexity-reduction outcome component** that scores
  net-deletion ticks (deletions > insertions AND test suite
  passes). Weight comparable to Copilot/CodeQL fix — concrete
  complexity reduction with test evidence. Cyclomatic-
  complexity-delta flagged as secondary indicator once tooling
  lands.
- **Feature PR evaluation:** when reviewing a PR, ask *"does
  this reduce surface area, or does it add it?"* Reduction is
  a feature; additive PRs need to justify their weight.
  Refactor-for-deletion is preferred over additive changes
  when an equivalent reductive alternative exists.
- **Tick-history rows:** note when a tick is net-negative-LOC;
  this is a virtue to record, not to hide. Tick-history already
  logs insertions / deletions per commit — the running delta
  should be surfaced, not buried.
- **Rodney-skill invocation cadence:** invoke `.claude/skills/reducer/` proactively before large refactors (the skill already
  says this); this memory adds: invoke Rodney when planning a
  feature where a deletion-first alternative might exist. The
  question *"could we delete our way to this outcome?"* is a
  first-pass design question, not a last-resort cleanup.
- **Cyclomatic complexity tooling:** future BACKLOG direction
  — add a cyclomatic-complexity-delta measurement to the
  factory's per-commit observability (alongside `dotnet build
  -c Release` and `dotnet test`). Until tooling lands, the LOC-
  delta is an acceptable first-pass proxy; after tooling lands,
  cyclomatic-delta becomes the primary reading and LOC-delta
  the secondary.
- **Developer-satisfaction signal:** when the maintainer notes a net-
  deletion day, the factory's correct response is *"good day,
  low-risk ship"* not *"low activity, investigate"*. Don't
  flag net-deletion as a factory-health concern.

**Composition:**

- Composes with `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md` (in-repo via PR #158)
  (same tick) — both are outcome-based scoring corrections;
  this memory adds the subtraction half of the symmetry.
- Composes with `.claude/skills/reducer/` — formal reducer skill
  + developer-values memory. Skill is authoritative on the
  procedure; this memory is authoritative on the valence.
- Composes with per-user memory `feedback_aaron_terse_directives_high_leverage_do_not_underweight.md` (not in-repo; lives at ~/.claude/projects/<slug>/memory/)
  — 118 chars + 38 chars = 156 chars maintainer keystrokes that
  produce a substantive scoring-model addition + cyclomatic-
  complexity tooling direction. Terse directive leverage again.
- Composes with six-step tick-close discipline — "commit" step
  should note net-LOC-delta in the commit message body when
  the tick is net-negative.
- Composes with quantum-Rodney branch-pruning — the Rodney
  skill also prunes future branches (accidental complexity in
  decision space). the maintainer's statement applies mainly to shipped
  complexity; the quantum version is the forward-looking
  companion.

**NOT:**

- NOT a mandate to delete code that is serving a purpose.
  Deletions must have tests-still-passing as the floor. A
  deletion that breaks the build or tests is not a virtue —
  it's a regression.
- NOT license to reject additive PRs wholesale. New features
  require new code; the rule is about preferring reductive
  alternatives when they exist, not about refusing to grow
  the codebase.
- NOT a claim that LOC-delta is the only measure of complexity
  reduction. Architectural simplification, dep removal, and
  surface-area reduction count even when LOC goes up (e.g.
  expanding one line into ten for readability may be a
  cyclomatic improvement despite +9 LOC).
- NOT a substitute for Rodney's formal essential-vs-accidental
  cut. The memory reinforces Rodney; it does not replace the
  procedure.
- NOT self-gaming license. "I deleted 1000 lines of imports
  today" is not a 1000-point score — the deletions must carry
  meaningful complexity reduction with test evidence. Vanity-
  deletion is as suspect as vanity-addition.

**Cross-references:**

- force-multiplication-log (historical / per-session scoring doc, not in-repo as a standing doc) — the scoring surface that
  gains the complexity-reduction outcome component this tick.
- `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md` (in-repo via PR #158)
  — sibling correction on vanity-metric avoidance.
- `.claude/skills/reducer/SKILL.md` — formal reducer skill.
- `docs/ROUND-HISTORY.md` — historical record of
  net-deletion rounds should be visible for cultural context.
- Cyclomatic complexity, McCabe (1976): "A Complexity
  Measure" — the proxy the maintainer named.
- Rodney's Razor (project idiom): "Essential complexity is
  justified; accidental complexity gets the cut."
