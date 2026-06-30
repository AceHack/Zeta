---
id: B-0613
priority: P3
status: closed
title: "Lior loop lockfile-probe hardening — replace bare `ls .git/worktrees/*/lock` with portable `find` (Option C; resolved as zsh-portable since Lior's runtime is zsh)"
tier: bug
effort: S
created: 2026-05-17
last_updated: 2026-05-17
resolved: 2026-05-17
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

- [x] `.gemini/bin/lior-loop-tick.ts:11` replaced with Option C (portable `find` — Lior's runtime is **zsh**, not bash; both Option A and Option B are bash-only)
- [x] Quiet-repo behavior: `find .git/worktrees -name locked -type f 2>/dev/null` returns empty stdout + exit 0 → `[ -n "" ]` is false → no false-positive defer
- [x] Lock-present behavior: with a `.git/worktrees/<name>/locked` marker, `find` returns the path → `[ -n "<path>" ]` is true → protocol DOES signal defer
- [x] Memo `memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md` updated to remove the "first cut / follow-up will harden" caveat (landed in same PR)

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

**Closed 2026-05-17T21:49Z** — Option C (portable `find`) implementation landed via isolated worktree at `/private/tmp/zeta-b0613-impl-2149z` while 3 Lior procs were active. All 4 acceptance criteria met in the same commit.

## Resolution

Selected **Option C** (portable `find`) over the row's original "Option A preferred per Lior's bash runtime" recommendation. The recommendation was stale: Lior's actual runtime is **zsh**, not bash — see [`.gemini/bin/lior-loop-tick.ts`](../../../.gemini/bin/lior-loop-tick.ts) line 27 (`spawnSync("zsh", ["-c", 'source ~/.zshrc && gemini -p "$GEMINI_PROMPT" ...'])`). Both Option A (`compgen -G`) and Option B (`shopt -s nullglob`) are bash-only builtins that would fail in zsh; this was the same finding peer Otto landed via [PR #4097](https://github.com/Lucent-Financial-Group/Zeta/pull/4097) for the doc-substrate side. Option C uses POSIX `find` which works in any modern shell.

The actual edit at line 11 replaces the bare `ls .git/worktrees/*/lock` (which had both bugs — wrong filename `lock` vs the correct git marker `locked`, and non-matching-glob false-positive defer) with:

```bash
[ -n "$(find .git/worktrees -name locked -type f 2>/dev/null)" ] || [ -f .git/index.lock ]
```

Concurrent memo update at [`memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md`](../../../memory/feedback_git_worktree_corruption_empirical_anchor_otto_lior_contention_2026_05_17.md) removes the "first cut / follow-up will harden" caveat per AC #4.

---

**Otto-CLI** — Split by truth.
