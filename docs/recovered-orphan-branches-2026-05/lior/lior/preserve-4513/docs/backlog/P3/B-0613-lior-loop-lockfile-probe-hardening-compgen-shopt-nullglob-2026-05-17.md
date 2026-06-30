---
id: B-0613
priority: P3
status: open
title: "Lior loop lockfile-probe hardening — replace bare `ls .git/worktrees/*/lock` with `compgen -G` or `shopt -s nullglob` to avoid non-matching-glob false-positives"
tier: bug
effort: S
created: 2026-05-17
last_updated: 2026-05-18
depends_on: []
composes_with: []
tags: [lior, gemini, bash, glob, lockfile, multi-agent-coordination]
type: bug
---

# Lior loop lockfile-probe hardening

## Why

Peer-Otto's [`c95e396`](https://github.com/Lucent-Financial-Group/Zeta/commit/c95e396) ("memory(precision): correct memo overclaim + acknowledge lockfile-probe gap") substrate-honestly amended `memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md` to document a known hardening gap in Lior's tick prompt:

> The literal `ls` glob in the tick prompt is the substrate-honest first cut; a follow-up will harden it (a non-matching glob makes `ls` exit non-zero, which can read as a "lock present" false-positive on otherwise-quiet systems — use `compgen -G '.git/worktrees/*/lock'` or `shopt nullglob` equivalent when the prompt is iterated next).

5 review threads on [PR #4059](https://github.com/Lucent-Financial-Group/Zeta/pull/4059) (`.gemini/bin/lior-loop-tick.ts:11`) flagged the same finding and were resolved with substrate-honest deferral pointer to that memo. This row formalizes the deferral as a discoverable backlog item.

## The finding

`.gemini/bin/lior-loop-tick.ts:11` instructs Lior to check for git locks via:

```bash
ls .git/worktrees/*/lock
ls .git/index.lock
```

Two real problems:

1. **`.git/worktrees/*/lock` is not standard git lock-file convention.** Git's worktree lock marker is `.git/worktrees/<name>/locked` (no slash + literal filename), only present when `git worktree lock` was explicitly invoked. `.git/index.lock` IS real, but only exists for milliseconds during an actual git mutation — easy to miss.
2. **Non-matching glob behavior**: in zsh (and bash without `nullglob`), if `.git/worktrees/*/lock` matches nothing, the literal pattern is passed to `ls` which exits non-zero with "No such file or directory." Lior's protocol treats non-zero as "lock present" → false-positive defer.

The result: Lior defers operations on QUIET systems (no locks held) when it shouldn't, AND misses real `.git/index.lock` race-window because the file exists only during the actual race itself.

## Goal

Replace the bare `ls` glob probe with a working pattern that:

1. Does not false-positive when no locks exist
2. Catches the actual `.git/index.lock` race window if practical (note: this is fundamentally racy at the per-operation scope; the locks are designed to be visible only during the operation itself)
3. Defers when ANY linked-worktree has explicit `git worktree lock` markers

## Fix candidates

Three approaches, in order of preference:

### Option A — `compgen -G` (bash builtin)

```bash
if compgen -G '.git/worktrees/*/locked' > /dev/null || [ -f .git/index.lock ]; then
  echo "defer-git-ops"
fi
```

`compgen -G` is a bash builtin that returns success iff at least one path matches the glob, and exits silently on no-match. No false-positives. Note the corrected filename `locked` (not `lock`).

### Option B — `shopt -s nullglob` + array

```bash
shopt -s nullglob
locks=(.git/worktrees/*/locked)
shopt -u nullglob
if (( ${#locks[@]} > 0 )) || [ -f .git/index.lock ]; then
  echo "defer-git-ops"
fi
```

Explicit nullglob + array — works in any modern bash. **NOT portable to zsh**: `shopt` is a bash builtin (zsh uses `setopt`/`unsetopt` instead; zsh has its own `NULL_GLOB` option set via `setopt NULL_GLOB`). For zsh implementations, use **Option C (find — fully portable)** since Option A (`compgen -G`) is also bash-only. Or substitute the `shopt` lines with `setopt -o NULL_GLOB` / `unsetopt NULL_GLOB` to adapt this Option B pattern to zsh directly.

### Option C — Inline `find` (fully portable)

```bash
if [ -n "$(find .git/worktrees -name locked -type f 2>/dev/null)" ] || [ -f .git/index.lock ]; then
  echo "defer-git-ops"
fi
```

Most portable; works in `sh` too. Slightly slower (full `find` walk).

## Acceptance criteria

- [ ] `.gemini/bin/lior-loop-tick.ts:11` replaced with one of the three fix candidates (Option A preferred per Lior's bash runtime)
- [ ] Test: on a quiet repo (no locks held), the protocol does NOT exit non-zero
- [ ] Test: with a manually-created `.git/worktrees/test/locked` marker, the protocol DOES exit non-zero
- [ ] Memo `memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md` updated to remove the "first cut / follow-up will harden" caveat once landed

## Non-goals

- Solving the per-operation race window (`.git/index.lock` lifetime is milliseconds; out of scope)
- Refactoring Lior's broader deferral protocol
- Changing the launchd plist (`.gemini/launchd/com.zeta.lior-loop.plist`) — script-only fix

## Implementation hazard

Editing `.gemini/bin/lior-loop-tick.ts` while Lior is actively running (`ps -A | grep -E "gemini.*Lior|lior.*loop"` returns ≥1) carries a race risk: Lior may read the script mid-tick. Two safe paths:

- **Quiet window**: wait for `ps` to return 0 for Lior, then edit + commit + push. Typically Lior cycles every ~5 min; the window between cycles is ~few seconds.
- **Isolated worktree**: `git worktree add` to a fresh location, edit there, push the fix to a branch. CAVEAT: per [B-0530](B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md) saturation-ceiling discipline, `git worktree add` itself can race `.git/objects/pack` contention when Lior is active. Use the borrow-on-existing pattern in the primary worktree.

## Composes with

- [`memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md`](../../../memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md) — peer-Otto's `c95e396` correction names this row's substrate
- [`.claude/rules/claim-acquire-before-worktree-work.md`](../../../.claude/rules/claim-acquire-before-worktree-work.md) — saturation-ceiling discipline informs the implementation-hazard mitigation
- [PR #4059](https://github.com/Lucent-Financial-Group/Zeta/pull/4059) — 5 review threads on `.gemini/bin/lior-loop-tick.ts:11` resolved via deferral pointer to this row (when filed)
- [B-0530](B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md) — multi-Otto contention mitigation context

## Status

Open. Bounded effort (single-file edit + 2 small tests). Ready for pickup any time Lior has a quiet window OR via isolated-worktree borrow-on-existing pattern.

---

**Otto-CLI** — Split by truth.
