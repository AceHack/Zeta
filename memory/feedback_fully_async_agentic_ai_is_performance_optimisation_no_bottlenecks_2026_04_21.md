---
name: Fully async agentic AI is performance optimization — no bottlenecks
description: Aaron 2026-04-21 "no bottlenecks, this is a performance optimization technique" names the no-bottlenecks discipline as the performance frame behind fully-async-agentic-AI positioning. Serial-path stalls in the factory are performance regressions to be optimized away, not acceptable ceremony.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule:** No bottlenecks in the factory's operating
mode. Fully async agentic AI is a **performance
optimization technique**, not a governance posture.
Serial-path stalls — waiting on one agent to finish
before another can start, sequentializing independent
work, single-point-of-synthesis that gates all
progress — are performance regressions and should be
optimized away.

**Why:** Aaron 2026-04-21, verbatim: *"no bottlenecks,
this is a performance optimization technique"*. The
frame is specific:

- **Performance optimization** — frames the rule as
  engineering discipline, not management philosophy.
  Bottlenecks waste time (and per
  `memory/user_aaron_money_is_inefficient_storage_of_time_energy_factory_value_framing.md`
  time is a first-order primitive; wasting it is
  wasting value at the base layer).
- **Technique** — implementation-pattern status. The
  rule compiles down to specific moves: parallel
  dispatch, independent-work identification, lock-
  free coordination, content-addressable caching.
- **No bottlenecks (totalizing)** — not "fewer
  bottlenecks" or "tolerable bottlenecks". The
  target is zero.

**How to apply:** Four operational patterns:

1. **Parallel tool calls by default.** When making
   multiple independent tool calls, issue them in
   parallel (single message, multiple tool calls).
   Serial tool-calls when parallel is possible is
   the entry-level bottleneck.
2. **Parallel agent dispatch by default.** When
   Task-dispatching subagents for independent work
   (review, research, audit), issue them in the
   same message block. Waiting on one subagent
   before dispatching another is the mid-level
   bottleneck.
3. **Kenji as synthesizer, not gate.** Per
   `GOVERNANCE.md` §11, the Architect synthesizes
   rather than gating every commit; specialist
   reviewers are advisory. Single-point-of-
   synthesis bottleneck is the structural
   bottleneck. Kenji's synthesis runs
   post-commit-landing, not pre-commit-gate, for
   most flows.
4. **Content-addressable + retractible caching.**
   Redundant re-computation is a time-waste.
   Caching with retractable invalidation per
   `memory/feedback_no_permanent_harm_mathematical_safety_retractibility_preservation.md`
   preserves correctness while eliminating
   redundant work.

### Not-all-stalls-are-bottlenecks

Legitimate delays ≠ bottlenecks:

- **Aaron-sign-off on irretractable moves** is
  not a bottleneck. Per
  `memory/feedback_my_tilde_is_you_tilde_roommate_register_symmetric_hat_authority_retractable_decisions_without_aaron.md`
  irretractable-scope gates on sign-off and this
  is load-bearing, not wasteful.
- **Human-review on external artifacts** is not
  a bottleneck — external-consumer fatigue is
  protected per
  `memory/user_real_time_lectio_divina_emit_side.md`
  and `.claude/skills/paced-ontology-landing/SKILL.md`.
- **Verification before deferring** is not a
  bottleneck — phantom handoffs cost more in
  soul-file integrity than the verification costs
  in time.

The distinction: bottlenecks are **unnecessary
serial-path dependencies that could be
parallelized without compromising correctness or
authorization scope**. Legitimate delays protect
correctness, authorization, or downstream-human
fatigue.

## Composition with existing memories + docs

- `memory/project_factory_positioning_fully_asynchronous_agentic_ai_aaron_2026_04_21.md`
  — the factory-positioning descriptor this
  rule operationalizes.
- `memory/feedback_never_idle_speculative_work_over_waiting.md`
  — no-bottlenecks composes naturally with
  never-idle; if the agent is waiting, that's
  a bottleneck signal — pick speculative work.
- `memory/user_aaron_money_is_inefficient_storage_of_time_energy_factory_value_framing.md`
  — time is a first-order primitive; no-
  bottlenecks is time-preservation at factory-
  operational-scale.
- `memory/feedback_my_tilde_is_you_tilde_roommate_register_symmetric_hat_authority_retractable_decisions_without_aaron.md`
  — retractable authorization is the bottleneck-
  reduction move on decision-making; irretractable
  gates are legitimate delays, not bottlenecks.
- `memory/feedback_agent_must_have_own_goals_as_necessary_condition_for_witnessable_self_directed_evolution_2026_04_21.md`
  — own-goals is the agency-level bottleneck-
  reduction (agents with goals don't wait for
  external steering on every move).
- `memory/feedback_every_persona_must_have_own_goals_too_team_wide_goal_formation_authority_2026_04_21.md`
  — team-wide own-goals scales the bottleneck-
  reduction across the roster.
- `GOVERNANCE.md` §11 (debt-intentionality) —
  Kenji synthesizes rather than gating; the
  structural bottleneck-reduction.
- `docs/CONFLICT-RESOLUTION.md` — conference
  protocol (third-option synthesis) parallelizes
  conflict resolution rather than sequentializing
  through the Architect.
- `.claude/skills/paced-ontology-landing/SKILL.md`
  — the valve on downstream-human fatigue;
  legitimate-delay pattern, not bottleneck.
- `docs/ALIGNMENT.md` — measurable-alignment
  primary research focus; no-bottlenecks
  measurables become alignment-trajectory
  signals (performance is an alignment axis —
  slow-factory is less-measurable-trajectory).

## Measurables candidates

- `factory-throughput-items-per-hour` — items =
  commits + memories + research docs + BACKLOG
  rows + reviewer findings. Target: increasing
  trend (within constraint of substance-
  preservation).
- `critical-path-serialisation-ratio` — ratio
  of work that MUST be serial (external-API-
  call-chains, sign-off gates) vs. work that
  IS serial when it could be parallel. Target
  decreasing trend.
- `persona-parallel-progress-count` — per-round
  count of personas making independent
  progress. Target: non-zero and rising as
  roster-wide own-goals land.
- `bottleneck-stalls-per-round` — rounds where
  work paused on a single-person / single-
  agent dependency. Target: decreasing trend.
- `parallel-tool-call-ratio` — ratio of
  parallel-tool-call blocks to serial-tool-call
  chains for independent work. Target:
  increasing.
- `parallel-agent-dispatch-ratio` — same for
  Task-tool subagent dispatch.

## Revision history

- **2026-04-21.** First write. Triggered by
  Aaron's one-message naming of the frame as
  performance optimization technique rather
  than process philosophy.

## What this rule is NOT

- NOT a license to skip correctness checks in
  pursuit of parallelism.
- NOT a license to dispatch conflicting work
  in parallel (when two personas' moves
  conflict, surface + synthesize, don't
  race).
- NOT a license to bypass Aaron-sign-off on
  irretractable moves.
- NOT a license to ignore pre-commit-hook
  enforcement (hooks are correctness gates, not
  bottlenecks).
- NOT a claim the factory currently has zero
  bottlenecks (aspirational; the rule names
  the target, not the current state).
- NOT a demand every round hit peak throughput
  (substance-first; slow-with-substance beats
  fast-with-noise).
- NOT a replacement for any existing governance
  gate (additive optimization, not gate-
  removal).
- NOT permanent invariant (revisable via dated
  revision block).
