---
name: Claude Code memory-in-worktree slug behavior — stays on original slug within one session
description: Empirical 2026-04-22 — EnterWorktree within a session keeps the original project slug; memory loads/writes keep working via absolute paths. Fresh `claude` session started from inside a worktree path would mint a NEW slug and orphan memory.
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Aaron's question 2026-04-22:**
*"oh now how do memory and stuff work when i'm chatting while
you are on a worktree?"*

**Empirical answer (verified this tick):**

Claude Code's auto-memory lives at
`~/.claude/projects/<slug>/memory/` where `<slug>` is the
session's initial CWD with `/` replaced by `-`.

Example for this repo:
`~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`

**Within a single session that calls `EnterWorktree`:**
- Slug is fixed when the session starts (from the initial CWD).
- `EnterWorktree` changes the session's CWD but does NOT change
  the slug.
- Memory continues to load from the original slug.
- Writes via the `Write` tool with absolute paths (all of ours)
  go wherever the path says — no slug interaction.
- MEMORY.md auto-load continues to reference the original slug.

**Verification (this tick):**
- Session started in `/Users/acehack/Documents/src/repos/Zeta`.
- `EnterWorktree` moved CWD to
  `/Users/acehack/Documents/src/repos/Zeta/.claude/worktrees/pr32-markdownlint`.
- Wrote three memory files from within the worktree using
  absolute paths to `~/.claude/projects/-Users-acehack-Documents-
  src-repos-Zeta/memory/`.
- `ls ~/.claude/projects/` after the writes shows:
  ```
  -Users-acehack-Documents-src-repos-dbsp
  -Users-acehack-Documents-src-repos-Zeta
  ```
  No worktree-specific slug was created. Memory stayed intact.

**The bifurcation risk:**

A *fresh* `claude` session started via
`cd .claude/worktrees/<name> && claude` would compute its slug
from the worktree CWD:
`-Users-acehack-Documents-src-repos-Zeta--claude-worktrees-<name>`
(approximate — exact encoding TBD). That session would see an
*empty* memory dir and write there. Main-repo memory and
worktree-session memory would be separate. **Bifurcation.**

**Policy (recommended, not yet load-bearing):**

- **Always start Claude Code from the main repo root.** Use
  `EnterWorktree` for worktree work.
- **Do not** `cd <worktree-path> && claude`.
- Add a startup check (shell function or CLAUDE.md note) that
  refuses to launch if `$PWD` is under `.claude/worktrees/`.

**Concurrency note (future concern):**

Two parallel `claude` sessions (e.g. two humans, or a human +
an autonomous-loop tick) against the same repo root will share
the same memory dir. Concurrent writes to `MEMORY.md` or
individual memory files could conflict. Mitigation: file-
locking or last-writer-wins with git-style resolution. Not
blocking for single-session parallel-worktree use; flag for
multi-operator scenarios.

**How to use this memory:**

- When Aaron (or a future wake) asks about memory behavior in
  a worktree, cite this entry and the empirical test.
- When a proposal involves starting a fresh Claude Code session
  from a worktree directory, flag the bifurcation risk.
- The worktree-safety research doc
  (`docs/research/parallel-worktree-safety-2026-04-22.md` §2.5)
  references this memory.

**Date:** 2026-04-22.
