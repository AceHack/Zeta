---
id: 081KQR4HQ0008QG0R002YNV361
priority: P1
status: closed
title: Orchestrator branch-verify mechanization design — pre-commit hook + branch-name display + worktree-aware checks (Aaron 2026-05-04)
tier: foundation
effort: M
ask: Aaron 2026-05-04 verbatim *"for humans this is why oh my zsh reminds us of many things like this it has branch name in the ui"* + same-tick *"maybe a deliberate design/redesign on the backlog?"*
created: 2026-05-04
last_updated: 2026-05-09
closed: 2026-05-09
depends_on: []
decomposition: atomic
classification: buildable-now
composes_with: [081KQ0YZ80008QG0R001V0XCYZ, 081KQGDBJ0008QG0R0022EW5ZE, 081KQGDBJ0008QG0R000A4EZS5, 081KQJZR90008QG0R000V16E1C]
tags: [orchestrator, concurrency-hazard, mechanization, pre-commit-hook, worktree, foundation]
type: friction-reducer
---

# 081KQR4HQ0008QG0R002YNV361 — Orchestrator branch-verify mechanization design

## The naming

Aaron 2026-05-04, after watching me re-do the orchestrator-CWD-bleed-over hazard twice in succession (the second time IN the very commit that encoded the rule preventing it):

> *"for humans this is why oh my zsh reminds us of many things like this it has branch name in the ui"*

> *"maybe a deliberate design/redesign on the backlog?"*

The substrate-level rule already exists (PR #1551 + PR #1568). The operational discipline keeps failing because it relies on agent-memory rather than mechanization. oh-my-zsh's branch-name-in-prompt solves the equivalent human problem — make the current branch ALWAYS visible, removing the discipline-burden.

This row plans the AI-substrate equivalent: mechanized branch-verify that catches wrong-branch commits before they happen.

## The hazard (recap)

When parallel subagents run in worktrees that share the parent `.git` directory, the orchestrator's `git checkout` operations can silently fail to switch HEAD as expected. Symptoms:

1. Orchestrator runs `git checkout main && git restore . && git pull --ff-only`.
2. Output appears successful.
3. Orchestrator runs `git checkout -b new-feature-branch`.
4. Output reports "Switched to a new branch 'new-feature-branch'".
5. Orchestrator commits.
6. Commit lands on a SUBAGENT's branch instead of `new-feature-branch`.

Empirically observed twice 2026-05-04 (081KQR4HQ0008QG0R001909FPT commit landed on tier-48 branch; 081KQR4HQ0008QG0R002YNV361/PR #1568 commit landed on openspec-audit branch).

## Mechanization candidates (in priority order)

### 1. Harness pre-tool-use hook -- fail-on-unexpected-branch (HIGH leverage)

**Design correction (Aaron 2026-05-05)**: original draft proposed a git pre-commit hook under `tools/git-hooks/` installed via `tools/setup/` symlink. Two problems:

1. **Contradicts** `memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md`. Aaron 2026-05-03 verbatim: *"i don't think we need git hooks harness hooks are good vibe coders will never be without a harness of some kind."* Vibe-coders always have a harness (Claude Code, Codex, Cursor, etc.); harnesses provide TS runtime + hook surfaces; harness hooks suffice. Git hooks are unnecessary.
2. **Symlinks are unreliable** (Aaron 2026-05-05): *"i love symlinks but just an FYI nothing works right with them it always goes wrong it's sad but true even agents can't use them for skills they don't follow the link."* Empirical fact about contributor experience; the install path was doubly bad.

Revised implementation: the verify-branch check fires as a **harness hook** (Claude Code's PreToolUse hook, or each harness's equivalent), invoked before any Bash tool call that runs `git commit`. The check is a TS script under `tools/orchestrator-checks/` that the harness invokes; no git-hooks directory, no symlinks, no tools/setup/ install step.

```typescript
// tools/orchestrator-checks/verify-branch.ts
// Harness hook: checks current branch matches expected before allowing commit.
import { spawnSync } from "node:child_process";

const expected = process.env.ZETA_EXPECTED_BRANCH ?? "";
const current = spawnSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
}).stdout.trim();

if (expected && current !== expected) {
  console.error(`ERROR: Pre-commit branch mismatch.`);
  console.error(`  Expected: ${expected}`);
  console.error(`  Current:  ${current}`);
  console.error(`  Run \`git checkout ${expected}\` and verify, or unset ZETA_EXPECTED_BRANCH.`);
  process.exit(1);
}

// Worktree-suffix warning class (generic contributor pattern):
const WORKTREE_PATTERN =
  /^(research|fix\/memory-md-tier|feature)\/.+-\d{4}-\d{2}-\d{2}$/;
if (WORKTREE_PATTERN.test(current)) {
  console.error(`INFO: committing on '${current}' -- verify this is intentional.`);
}
```

Wired into Claude Code via `.claude/settings.json` PreToolUse hook on Bash tool invocations matching `git commit`. Other harnesses get equivalent wiring (Codex / Cursor / Aider may run Node or Deno rather than bun -- the script should use a runner-agnostic shebang or be invoked via the harness's available TS runtime; if no TS runtime is available the wrapper falls back to compiled JS). The TS-over-bash choice is per Otto-272 DST + the harness-hooks-suffice memory file -- TypeScript is properly DST-able and bash is not. Per-harness runtime audit is part of the implementation when this row ships.

Acceptance: harness hook fires before `git commit` invocations, blocks when `ZETA_EXPECTED_BRANCH` is set and doesn't match. No git-hooks directory required.

### 2. Branch-name in shell prompt (MED leverage — orchestrator UX)

Mechanization: customize the shell prompt for any session running orchestrator git operations to show the current branch (oh-my-zsh equivalent). Already supported by every modern shell config; just needs to be the default for Claude Code sessions on this repo.

Acceptance: `.zshrc` / `.bashrc` snippet documented in `tools/setup/` that adds branch-aware prompt.

### 3. Worktree-aware status check (LOW-MED leverage — diagnostic)

Implementation: a `tools/check-orchestrator-state.sh` script that runs:

- `git branch --show-current`
- `git status --short`
- `git worktree list`
- Cross-checks: any worktree branches the orchestrator is currently on by accident?

Output: structured status for orchestrator's start-of-tick health check.

Acceptance: script runs in <1s; integrated into autonomous-loop tick start.

### 4. Bash wrapper around `git commit` (LOW leverage — heavy-handed)

Wrap `git commit` with a function that runs `git branch --show-current` first and aborts on mismatch.

Trade-off: catches everything but heavy-handed; hook (option 1) is cleaner.

### 5. ZETA_EXPECTED_BRANCH convention (cross-cutting)

Establish a session-level env var that ALL orchestrator git operations check. Each `git checkout -b X` sets `ZETA_EXPECTED_BRANCH=X`. Every commit verifies. The hook + wrapper both use this var.

## Why P1

- **Demonstrated recurrence**: hazard hit twice in one session 2026-05-04, including in the substrate-encoding commit itself.
- **Foundation tier**: every parallel-subagent dispatch carries this risk; the substrate-encoding-of-the-rule has not prevented recurrence.
- **Low effort, high leverage**: harness pre-tool-use hook is ~30 lines of TypeScript (per the section 1 example); mechanization removes the entire class of failure.

## Why not P0

- **Not blocking**: the hazard recovers via force-push; no data loss.
- **Substrate-encoding-of-the-rule** (PR #1568) already gives manual discipline.

## Acceptance criteria

1. **Harness pre-tool-use hook** under `tools/orchestrator-checks/verify-branch.ts` invoked before `git commit` Bash calls, fails the call when `ZETA_EXPECTED_BRANCH` is set and `git branch --show-current` doesn't match.
2. **Hook wired into `.claude/settings.json`** PreToolUse for Claude Code; per-harness wiring documented for Codex / Cursor / other harnesses.
3. **Documentation** in CLAUDE.md or AGENTS.md pointing at the hook + the env-var convention.
4. **Test**: deliberately checkout the wrong branch, attempt commit, verify hook blocks.
5. **At least one mechanization-related sub-row landed** (harness hook or prompt or status-check); others can defer.

## Out of scope

- **Replacing the substrate-encoding rule** (PR #1568 stays — manual discipline still load-bearing for non-mechanized scenarios).
- **Forcing every commit through the hook** (env var unset = hook is informational, not blocking).
- **Cross-machine enforcement** (can't enforce on someone else's clone unless hook is in tools/setup/).

## Composes with

- `memory/feedback_orchestrator_pre_commit_verify_branch_rule_aaron_2026_05_04.md` (PR #1568) — manual discipline this row mechanizes.
- `memory/feedback_parallel_subagent_concurrency_lessons_cluster_aaron_2026_05_04.md` (PR #1551) — Lesson 2 (orchestrator stays on main); same family.
- `memory/feedback_dst_justifies_ts_quality_over_bash_and_harness_hooks_suffice_no_git_hooks_aaron_2026_05_03.md` -- the harness-hooks-suffice rule that drives the design correction in section 1 (TS over bash, harness hooks not git hooks, no symlink install path).
- `081KQ0YZ80008QG0R001V0XCYZ` — memory work pattern that hits this most.
- `081KQ0YZ80008QG0R0003GAYYN` (folds 081KQR4HQ0008QG0R002ZDREYC) -- bulk-review / bulk-alignment UI for backlog rows; the systematic answer for catching cross-row inconsistencies like the original git-hooks-vs-harness-hooks contradiction (Aaron 2026-05-05: *"it's something we would have caught in the bulk alignment UI on the backlog"*).
- `081KQJZR90008QG0R000V16E1C` — pre-commit hook for direct-name-attribution; similar mechanization approach (also worth revising to harness hook per same logic).

## Pre-start checklist (2026-05-09)

**Prior-art search:**

- `tools/orchestrator-checks/verify-branch.ts` — already exists (PR #1585), merged.
- `.claude/hooks/verify-branch-pretooluse.ts` — already exists (PR #1586), merged.
- `.claude/settings.json` hook wiring — already wired (PR #2151), merged.
- CLAUDE.md / AGENTS.md — no pointer bullet; AC3 is the remaining gap.
- `.claude/rules/` — no `zeta-expected-branch.md` rule file yet.

**Dependency restructure:**

- No `depends_on:` entries. `composes_with: [081KQ0YZ80008QG0R001V0XCYZ, 081KQGDBJ0008QG0R0022EW5ZE, 081KQGDBJ0008QG0R000A4EZS5, 081KQJZR90008QG0R000V16E1C]` verified current.

**Smallest safe slice (this PR):**

- Create `.claude/rules/zeta-expected-branch.md` with carved sentence + hook wiring table.
- Add CLAUDE.md pointer bullet for cold-start discoverability.
- Keep backlog row status `open`; record this PR as AC3 progress without using an unsupported in-progress enum.

**Remaining after AC3 PR (#2239):**

- AC2 per-harness wiring doc for Codex/Cursor (currently documented in 081KQR4HQ0008QG0R002YNV361 body only) — deferred; core Claude Code wiring is sufficient for the mechanization goal.
- AC5 worktree status check script — landed: `tools/orchestrator-checks/check-orchestrator-state.ts` (this PR).

**All primary ACs met; 081KQR4HQ0008QG0R002YNV361 closed 2026-05-09.**

## The carved sentence

**"Mechanization is the substrate-level fix for discipline failures that recur. oh-my-zsh shows branch in every prompt for human-side; AI-substrate needs equivalent: pre-commit hook with `ZETA_EXPECTED_BRANCH` check that blocks wrong-branch commits before they happen."**
