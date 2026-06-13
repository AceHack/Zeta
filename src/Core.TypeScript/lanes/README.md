# tools/lanes/ — Doc/code two-lane parallel-subagent dispatch protocol

This directory carries the protocol for **rung-2 factory parallelism**:
two-lane parallel-subagent dispatch where one lane mutates `docs/**`
(plus `memory/**` and `openspec/**`) and the other lane mutates
code (`src/**`, `tests/**`, `tools/**`, `*.fs`, `*.fsproj`,
`*.csproj`). Both lanes run concurrently in **isolated worktrees**
per the established worktree-isolation discipline. The coordinator
(the loop-agent / PM-1) merges via PR-with-merge-queue cadence.

Backing substrate:

- `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  — the architectural ladder: rung-1 serial-subagent → rung-2
  doc/code two-lane → rung-3 file-isolation lanes → rung-4
  mechanized-best-practice → rung-5 peer-mode claims protocol.
  This row is the protocol for rung-2.
- `memory/feedback_parallel_agents_need_isolated_worktrees_coordinator_owns_main_aaron_amara_2026_04_29.md`
  — the worktree-isolation discipline this protocol instantiates.
- `memory/project_loop_agent_named_otto_role_project_manager_2026_04_23.md`
  — loop-agent-as-PM role definition (the coordinator). Persona
  name appears in the filename only (history surface); body of
  this README uses the role-ref ("the coordinator").
- `B-0144` — backlog row this protocol closes (acceptance
  criteria 1+3: worktree-isolation pattern documented + coordinator
  coordination protocol documented).

Companion CI work that landed first:

- **PR #1185 (B-0125)** — gate.yml `path-filter` job classifies
  PRs as docs-only vs code-touching and skips the F# build steps
  on docs-only PRs. The build/CI side of the lane split. This
  protocol is the **agent-dispatch side** of the same split:
  not just *"the build skips when files don't overlap"* but also
  *"the agents themselves work in parallel without overlap."*

## When to dispatch two lanes vs single lane

**Two-lane (rung-2):** when the work cleanly decomposes into a
docs-side change AND a code-side change that share no files.
Examples:

- Updating documentation that also requires a behavioral spec
  edit + an F# implementation tweak.
- Adding a new lint script (code-lane: `tools/hygiene/*.sh`)
  + documenting it in the backlog row + skill body
  (doc-lane: `docs/`, `.claude/skills/`).
- Backfilling a research preservation (doc-lane:
  `docs/research/*.md`) while a sibling-PR migrates a tool to
  TypeScript (code-lane: `tools/**/*.ts`).

**Single-lane:** when the work touches both surfaces but the
changes are entangled enough that the doc edit needs to see the
code edit (or vice versa) before it can be written. Don't force
two-lane on entangled work — the coordination cost outweighs
the throughput gain.

**Heuristic:** if you can write the doc-side PR description
without reading the code-side diff, the two surfaces are
independent enough for two-lane dispatch.

## Coordinator coordination protocol

The coordinator is the loop-agent / PM-1. The protocol the
coordinator follows for every two-lane dispatch:

1. **Allocate BOTH worktrees BEFORE dispatching EITHER subagent.**
   This is the load-bearing invariant from the maintainer's
   2026-04-29 rule: *"coordinator must allocate worktrees
   before allocating agents"*. Allocating in this order
   prevents the failure mode where a subagent's first
   git-write collides with main because its worktree wasn't
   ready.

2. **Dispatch both subagents in the SAME tool call** (parallel
   block). This is what makes them *parallel* rather than
   *sequential* — the coordinator emits a single message
   containing two `Agent` tool calls, and the harness runs
   them concurrently.

3. **Wait for BOTH lanes' branch-pushes before opening PRs.**
   Don't open the doc-lane PR while the code-lane subagent is
   still working — the synchronization point is the dual-push.

4. **Open both PRs together.** Visibility for the reviewer:
   they see the lane-shape immediately, can switch between
   the two PRs, can grade the decomposition itself. Two PRs
   opened together is the visible-architecture form.

5. **Merge in dependency order, OR queue both in merge-queue.**
   Doc-only PRs typically have no dependencies on code PRs (and
   vice versa) so order doesn't matter; the merge-queue handles
   the trivial case automatically.

## File allowlist per lane

The lanes have **disjoint file trees** by construction. The
allowlist is the contract:

### Doc lane — writes to

- `docs/**` (including `docs/backlog/`, `docs/hygiene-history/`,
  `docs/research/`, `docs/aurora/`, `docs/DECISIONS/`)
- `memory/**`
- `openspec/specs/**` (behavioral specs are documentation, not
  build artifacts)
- Root-level `*.md` (README, AGENTS, GOVERNANCE, CLAUDE.md, etc.)
- `.claude/skills/**/SKILL.md`, `.claude/agents/*.md`,
  `.claude/rules/*.md`, `.claude/commands/*.md` (skill +
  agent + rule definitions are documentation)
- `.github/copilot-instructions.md`, `.github/PULL_REQUEST_TEMPLATE.md`,
  `.github/ISSUE_TEMPLATE/*`

### Doc lane — NEVER writes

- Anything under `src/`, `tests/`, `tools/` (the code lane owns
  the entire `tools/**` tree, including `tools/*.md`
  co-located docs — preserves disjoint-file-trees)
- `*.fs`, `*.fsproj`, `*.csproj`, `Zeta.sln`
- `global.json`, `Directory.Packages.props`,
  `.config/dotnet-tools.json`
- `.github/workflows/*.yml`
- `package.json`, `bun.lock`, `tsconfig*.json`

### Code lane — writes to

- `src/**`, `tests/**`
- `tools/**` (including `tools/hygiene/`, `tools/github/`,
  `tools/setup/`, `tools/peer-call/`, etc.)
  — except `tools/lint/` which is itself code-surface lint
  not subject to lane-allowlist enforcement
- `*.fs`, `*.fsproj`, `*.csproj`, `Zeta.sln`
- `global.json`, `Directory.Packages.props`,
  `.config/dotnet-tools.json`
- `.github/workflows/*.yml`
- `package.json`, `bun.lock`, `tsconfig*.json`

### Code lane — NEVER writes

The disjoint contract is symmetric: doc-lane files are
forbidden to the code lane.

- Anything under `docs/**` or `memory/**` or `openspec/specs/**`
  (including all of `docs/research/`, `docs/aurora/`,
  `docs/DECISIONS/`, `docs/backlog/`, `docs/hygiene-history/`,
  etc. — the entire `docs/` tree is doc-lane territory)
- Root-level `*.md` (README, AGENTS, GOVERNANCE, CLAUDE.md, etc.)
- `.claude/skills/**/SKILL.md`, `.claude/agents/*.md`,
  `.claude/rules/*.md`, `.claude/commands/*.md` (skill / agent /
  rule / command bodies move with the doc lane)
- `.github/copilot-instructions.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/*`

## Worktree isolation pattern

Each lane runs in its own git worktree, allocated and torn
down per dispatch. The pattern:

```bash
# Allocate doc-lane worktree
git worktree add ../zeta-doc-lane -b docs/<topic>-<date>

# Allocate code-lane worktree
git worktree add ../zeta-code-lane -b code/<topic>-<date>

# Dispatch the two subagents (coordinator does this in the
# same tool call):
#   - Doc-lane subagent works in ../zeta-doc-lane/
#   - Code-lane subagent works in ../zeta-code-lane/

# After both subagents push their branches, the coordinator:
git worktree remove ../zeta-doc-lane
git worktree remove ../zeta-code-lane
```

Allocator scripts (TBD; see B-0144 acceptance criteria #1):

- `tools/lanes/doc-lane.sh allocate <branch>` — allocate doc lane
- `tools/lanes/code-lane.sh allocate <branch>` — allocate code lane
- `tools/lanes/doc-lane.sh release` — clean up doc lane worktree
- `tools/lanes/code-lane.sh release` — clean up code lane worktree

These will land as a follow-up; for now the coordinator uses
`git worktree` directly.

## Subagent prompt templates

See `tools/lanes/prompts/doc-lane-template.md` and
`tools/lanes/prompts/code-lane-template.md` for the prompts
the coordinator passes to each subagent. The templates encode:

- The lane's file allowlist (which the subagent must respect)
- The lane's disallowed-file-set (catches accidental cross-lane
  writes early)
- The branch name + worktree path the coordinator allocated
- Standard PR-body shape for the lane
- Pointer back to this README for the coordination protocol

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Worktree allocation slips and one subagent collides with main | Mechanical worktree-allocation rule (allocate BOTH before dispatching EITHER); 4-criterion mandatory in the protocol |
| Formatter bleed-through (e.g., `prettier --write` running repo-wide from one lane) | Lane-allowlist enforcement; prefer `--check` mode for cross-cutting tools |
| Reviewer load doubling (two PRs to review) | Mechanized best-practice toolchain (lint/CI/agent-reviewers) handles 80%+ of review surface automatically; per the rung-4 scaling ladder |
| Coordinator complexity | This protocol codifies the steps so coordination becomes mechanical |
| Docs PR introduces a code-surface dependency that breaks the code lane | Lane-allowlist disallows the cross-write at write-time; if the work *requires* it, fall back to single-lane |

## Lessons-mechanization (rung-4 feedback loop)

Per the parallelism-scaling-ladder rule, every friction surfaced
in two-lane dispatch should become **mechanized best-practice**:

- Friction surfaces during a two-lane dispatch (the coordinator
  notices something inefficient or error-prone)
- A memory-file or `BP-NN` candidate captures the friction +
  proposed mechanization
- The mechanization lands as a tool, lint, hook, or skill update
- Future two-lane dispatches inherit the mechanization without
  the coordinator re-explaining

This is the compound-improvement engine: each dispatch makes the
next one cheaper. Ultimately rungs 3 (file-isolation lanes) and
4 (full mechanization) become tractable because the friction
that would have blocked them at rung-2 is already absorbed.

## What this protocol does NOT do

- Does NOT implement the allocator scripts. They're follow-up
  work referenced above; the protocol is documented first so
  the scripts have a target shape to satisfy.
- Does NOT implement the subagent prompt templates body — those
  live as separate files under `tools/lanes/prompts/`. This
  README points at them.
- Does NOT generalize to N>2 lanes. That's rung-3 (file-isolation
  lanes) and is intentionally out of scope until rung-2 has
  demonstrated clean operation.
- Does NOT cover cross-harness parallel-mode (different AI
  vendors running simultaneously on different lanes). That's
  rung-5 / agent-orchestra (#324–#339).
- Does NOT replace per-PR quality. The hard guardrail from the
  parallelism-scaling-ladder rule: *"never sacrifice per-PR
  quality for throughput"*. Two-lane dispatch is a throughput
  multiplier, not a quality compromise.

## Status

**Protocol documented (this file).** Allocator scripts +
subagent prompt templates are follow-up work. First
demonstrated dry-run of an actual two-lane dispatch (acceptance
criterion #4) is also follow-up.

The protocol is enforceable today via `git worktree` directly
(no scripts needed); the follow-up work mechanizes the
ergonomics, not the substance.
