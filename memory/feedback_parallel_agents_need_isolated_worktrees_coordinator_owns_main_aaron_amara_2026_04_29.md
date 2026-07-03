---
name: Parallel agents need isolated worktrees — coordinator owns main (Aaron + Amara, 2026-04-29)
description: When dispatching multiple background subagents in parallel, each needs an ISOLATED git worktree (not the coordinator's working tree). Sharing one working tree causes branch-switch collisions, stash confusion, orphan files, and out-of-scope formatter side-effects. Hard rule, mechanical (not vigilance-based) — coordinator must allocate worktrees BEFORE allocating agents.
type: feedback
---

# Parallel agents need parallel worktrees — coordinator owns main

## The carved sentence

*"Parallel agents may inspect broadly, but mutate narrowly."* (Amara)

Or operationally: *"The coordinator must allocate worktrees BEFORE allocating agents."* (Amara)

## What this codifies

Parallel-PR mode (per Amara 2026-04-29 prior packet) requires file-disjoint
lanes. But "file-disjoint" alone is not enough if multiple subagents share a
single git checkout: branch-switching collides, stashes capture other lanes'
work, and tool side-effects (e.g., `prettier --write`, `bun install`) bleed
across lanes. The 2026-04-29 incident:

- Subagent A on `ts-port-hygiene-*` branch, writing `tools/hygiene/*.ts`
- Subagent B on `docs-best-practices-substrate-*` branch, writing `docs/best-practices/**`
- Both ran in the same working directory (`/Users/acehack/Documents/src/repos/Zeta`)
- Subagent B's `git checkout` stashed Subagent A's untracked work
- Subagent A's `prettier`-via-eslint side-effect modified `docs/GLOSSARY.md`
  + `memory/CURRENT-aaron.md` outside its allowlist
- One TS file appeared "lost" — actually preserved in the WIP stash
- Coordinator (Otto) had to STOP both agents and consolidate state

Branch-disjoint + file-allowlist-disjoint is necessary but not sufficient.
**Worktree-disjoint is the additional invariant.**

## The rule

```text
Parallel agents require isolated worktrees.
No background subagent may run in the coordinator's working tree.
```

For every subagent lane:

1. Coordinator creates a dedicated git worktree (`git worktree add <path> <branch>`).
2. Coordinator creates the dedicated branch up front.
3. Coordinator declares the lane's file allowlist + denylist explicitly.
4. Subagent operates ONLY in its worktree path — never `cd ..` or `cd /Users/.../Zeta` (the coordinator path).
5. Subagent mutates ONLY within its allowlist.
6. Subagent does NOT run repo-wide formatters/linters (e.g. `prettier --write`, `bun run format:write`) — only check-mode commands or scoped `--write` paths.
7. Subagent does NOT switch branches in another agent's worktree.
8. Subagent does NOT stash another lane's work.
9. Subagent reports outputs as a patch / branch / PR only — coordinator merges.

## Coordinator vs worker responsibilities

**Coordinator owns** (main working tree at `/Users/acehack/Documents/src/repos/Zeta`):

- Main working tree
- Merge / rebase coordination
- PR board (which lane → which branch → which file allowlist)
- Conflict resolution
- Stopping agents that violate allowlist
- Allocating worktrees before allocating agents

**Worker agents own** (each in its own worktree under `worktrees/<lane>/`):

- One worktree
- One branch
- One lane
- One file allowlist
- Producing a clean patch / PR

## Worktree allocation pattern

Convention: top-level `worktrees/` directory (gitignored), with one
subdirectory per active lane:

```text
worktrees/ts-port/                ← worktree on branch ts-port-hygiene-*
worktrees/best-practices/         ← worktree on branch docs-best-practices-*
worktrees/recovery-cleanup/       ← worktree on branch recovery-cleanup-*
```

Setup commands (coordinator runs these BEFORE dispatching subagent):

```bash
git worktree add -b <branch-name> worktrees/<lane-name> origin/main
# verify the worktree:
git worktree list
ls worktrees/<lane-name>
# only THEN dispatch the subagent with cwd = worktrees/<lane-name>
```

Cleanup after lane closes (PR merged):

```bash
git worktree remove worktrees/<lane-name>
git branch -D <branch-name>  # if branch is now reachable from main
```

## Subagent brief addition (mechanical guard)

Every subagent dispatch brief MUST include:

```markdown
**Working directory**: `/Users/acehack/Documents/src/repos/Zeta/worktrees/<lane>` (an ISOLATED git worktree pre-allocated by the coordinator).

**Do NOT**:
- `cd` outside this worktree path
- Run repo-wide formatters (`prettier --write`, `bun run format:write`, `eslint --fix .`)
- Modify files outside the file allowlist
- Switch branches
- Stash work
```

If the subagent violates ANY of these, coordinator stops the agent (`TaskStop`)
and audits before continuing. Don't "just fix" the violation — investigate
why the brief failed to constrain.

## Why this matters (the load-bearing failure mode)

Without worktree isolation:

1. **Branch-switch collisions**: Subagent B's `git checkout main` resets the
   working tree state, and Subagent A's untracked files get either stashed
   away or carried into the wrong branch.
2. **Stash confusion**: When `git stash -u` captures untracked files, the
   stash includes work from both lanes (since both lanes' files coexist in
   the same untracked set).
3. **Orphan files**: A subagent's writes during another's branch-switch can
   land on an unintended branch, or be lost when the branch is reset.
4. **Formatter side-effects**: `prettier --write **/*.md` or `eslint --fix .`
   mutates the entire repo, including out-of-scope files. Allowlist
   enforcement fails because the file modification didn't go through a
   subagent's explicit edit — it was a tool side-effect.
5. **`bun install` regenerates lockfiles** that conflict if two lanes both
   touch dependencies.

Worktree isolation eliminates all five at the operating-system level,
not at the discipline level. Mechanism over vigilance (Otto-341).

## Composes with

- LFG-only topology directive (2026-04-29) — same family of mechanism-over-
  vigilance rules: don't optimize for the hard case, eliminate the conflict
  surface
- Bash-compatibility 4-shell target (Otto-235) — file-system-level
  isolation, not discipline-level
- `verify-before-deferring` (CLAUDE.md) — apply to subagent dispatch:
  verify the worktree exists + isolation holds before dispatch

## Trigger memory

2026-04-29 incident. Three subagents dispatched in close succession on the
same git checkout:

1. TS port subagent (`tools/hygiene/*.ts`)
2. TS refactor subagent (`tools/hygiene/*.ts`)
3. Best-practices substrate subagent (`docs/best-practices/**`)

By round 3, branch-switch collisions had stashed lane 1's work, lane 2's
output overlapped lane 1's files, and lane 1 had triggered a prettier
side-effect on `docs/GLOSSARY.md` + `memory/CURRENT-aaron.md` outside its
allowlist. Coordinator (Otto) had to `TaskStop` lanes 2 + 3 and consolidate
state via stash-pop.

The damage was recoverable (no lost work, no merged corruption), but the
collision was structural — same root cause regardless of how careful
each individual subagent was.

Aaron + Amara correction (verbatim):

> *"Parallel agents need parallel worktrees."*
>
> *"The issue is not 'parallel agents are bad.' The issue is that parallel
> agents were allowed to share one working tree / branch surface. That
> caused branch-switch collisions, stash confusion, orphan files, and
> out-of-scope formatter edits."*
>
> *"the coordinator must allocate worktrees before allocating agents."*
