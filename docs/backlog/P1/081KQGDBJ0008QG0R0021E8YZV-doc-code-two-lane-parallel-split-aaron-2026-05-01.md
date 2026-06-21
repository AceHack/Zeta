---
id: 081KQGDBJ0008QG0R0021E8YZV
priority: P1
status: closed
closed: 2026-05-02
closed_by: "PR #1189 + PR #1190"
title: Doc/code two-lane parallel split — rung-2 unlock for factory parallelism
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
---

> **Closed 2026-05-02 by PR #1189 (protocol docs) + PR #1190
> (allocator scripts).** Acceptance criteria 1+2+3 (worktree-
> isolation pattern documented + subagent prompt templates +
> coordinator coordination protocol) shipped via the protocol
> docs at `tools/lanes/README.md` + `tools/lanes/prompts/{doc,code}-lane-template.md`.
> Allocator scripts shipped via `tools/lanes/{lane-allocator,doc-lane,code-lane}.sh`
> closing acceptance criterion #1 implementation. The CI/build
> side of the lane split landed earlier in the same session via
> PR #1185 (081KQGDBJ0008QG0R001MK4YPC path-filter — F# build steps skip on docs-only
> PRs). Acceptance criterion #4 (first demonstrated dry-run) and
> #5 (lessons-mechanization step) remain as open-ended follow-ups
> — those are operational rather than implementation-substrate.

# 081KQGDBJ0008QG0R0021E8YZV — Doc/code two-lane parallel split

## What

Operationalize a two-lane parallel-subagent dispatch pattern
where one lane mutates `docs/**` (with `memory/**`,
`openspec/**`) and the other lane mutates code (`src/Core/**`,
`src/Core.CSharp/**`, `src/Bayesian/**`, `tools/**` excluding
`tools/lint/`). Both lanes
run concurrently in **isolated worktrees** per the established
worktree-isolation discipline. Coordinator (Otto) merges via
PR-with-merge-queue cadence.

## Why now

Aaron 2026-05-01 explicitly named this as the next-rung-up
unlock for factory parallelism:

> *"if we get that doc/code split two lanes that will open you
> up and then you can split further by file isoletion for more
> parallel lanes and build you way there and save lessions to
> reduce fiction for more lanes"*

Per the parallelism scaling ladder (rung 2 of 5) captured in
`memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`,
this is the immediate next throughput multiplier with
structurally-near-zero collision risk because docs and code
have disjoint file trees, disjoint review-disciplines, and
disjoint mechanized-best-practice toolchains.

## Acceptance criteria

1. **Worktree isolation pattern documented** in
   `tools/lanes/README.md` covering:
   - How to allocate the doc-lane worktree
     (`tools/lanes/doc-lane.sh allocate <branch>`)
   - How to allocate the code-lane worktree
     (`tools/lanes/code-lane.sh allocate <branch>`)
   - File allowlist per lane (doc-lane writes to `docs/**`,
     `memory/**`, `openspec/**`, `*.md` at root; code-lane
     writes to `src/Core/**`, `src/Core.CSharp/**`,
     `src/Bayesian/**`, `tools/**` excluding `tools/lint/`,
     `*.fs`, `*.fsproj`)
   - File denylist per lane (doc-lane never writes code-tree
     files; code-lane never writes `docs/**` or `memory/**`)

2. **Subagent prompt templates** at
   `tools/lanes/prompts/doc-lane-template.md` and
   `tools/lanes/prompts/code-lane-template.md` that codify the
   lane discipline so subagents inherit the constraints
   without coordinator re-explaining each tick.

3. **Coordinator coordination protocol** documented:
   - Coordinator allocates BOTH worktrees BEFORE dispatching
     EITHER subagent (Amara 2026-04-29 rule:
     *"coordinator must allocate worktrees before
     allocating agents"*)
   - Coordinator dispatches both subagents in the SAME tool
     call (parallel block)
   - Coordinator waits for BOTH lanes' branch-pushes before
     opening PRs
   - Coordinator opens both PRs together (visibility:
     reviewer can see the lane-shape)
   - Coordinator merges in dependency order (or queues both
     in merge queue)

4. **First demonstrated dry-run.** A real tick where:
   - Doc-lane subagent fixes a thread on a `docs/**` PR
   - Code-lane subagent fixes a thread on a code PR
   - Both run concurrently
   - Both PRs land cleanly without cross-lane interference
   - Tick-history row records which lanes ran

5. **Lessons-mechanization step.** Any friction surfaced in
   the dry-run produces a memory-file or BP-NN candidate
   that mechanizes the decision per the
   automated-best-practice-decision-making-at-scale
   discipline.

## Out of scope (rung 3+ — defer)

- **N>2 file-isolation lanes** — covered by future B-row
  after rung 2 demonstrates clean operation. Rung 3 is the
  generalization, not a separate design.
- **Cross-harness parallel-mode** — covered by the
  agent-orchestra cluster (#324–#339). Rung 5; defer.
- **Automatic lane-classification** — *"is this a doc fix
  or code fix?"* — initially manual coordinator-call;
  mechanization candidate for later (would belong in
  `tools/lanes/classify.sh`).

## Risks

- **Stash collisions** if worktree-isolation slips — mitigated
  by mechanical worktree-allocation rule (4-criterion above).
- **Formatter bleed-through** (e.g., `prettier --write` running
  repo-wide from one lane) — mitigated by lane-allowlist
  enforcement and `--check` mode preferred for cross-cutting
  tools.
- **Reviewer load doubling** — two PRs open at once may feel
  like more review surface; mitigated by mechanized
  best-practice toolchain handling 80%+ of review surface
  automatically (per
  `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  rung-4 discipline).
- **Coordinator complexity** — managing two lanes is more
  bookkeeping than one; mitigated by codifying the
  coordination protocol (acceptance criterion #3) so it
  becomes mechanical.

## Composes with

- `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  — the architectural framing this row operationalizes (rung 2)
- `memory/feedback_parallel_agents_need_isolated_worktrees_coordinator_owns_main_aaron_amara_2026_04_29.md`
  — the worktree-isolation discipline this row instantiates
- `memory/project_loop_agent_named_otto_role_project_manager_2026_04_23.md`
  — Otto-as-PM role definition (the coordinator)
- `memory/feedback_zeta_agent_orchestra_capability_role_claim_isolation_aaron_amara_2026_04_29.md`
  — the agent-orchestra design (rung 5; this row's
  long-term endpoint)
- 081KQGDBJ0008QG0R002Y31XJ3 (verify-before-state-claim mechanized auditor),
  plus 081KQGDBJ0008QG0R0015RNK3P (pre/post pattern) and 081KQGDBJ0008QG0R002WY918J (Code Contracts
  revival) when they land — mechanization primitives that
  compound the rung-4
  lessons-to-reduce-friction discipline

## Effort

**M (medium, 1–3 days)** for the documented protocol +
allocator scripts + subagent prompt templates + first dry-run.
Lessons-mechanization is open-ended (continues across all
future ticks operating in two-lane mode).

## Why P1 (not P0 / not P2)

- **Not P0** because the factory functions today without it
  (rung-1 serial-subagent dispatch works); it is a throughput
  unlock, not a correctness fix.
- **Not P2** because the guardrail (per-PR quality) explicitly
  requires the mechanization-of-best-practice-decisions
  infrastructure to scale — and this row is the proving
  ground for that infrastructure. Deferring it defers the
  evidence we need for rungs 3–5.
- **P1** because every future tick that runs serial when it
  could have run parallel is forgone throughput; the cost
  compounds.
