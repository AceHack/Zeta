# Shared checkout is a view, not a workspace

Carved sentence:

> The shared checkout `/Users/acehack/Documents/src/repos/Zeta` is everyone's
> read-only VIEW of `origin/main` — never a workspace. Work in your OWN working
> tree and push to `origin/main` from there; never edit, commit, or `git stash`
> in the shared checkout. Concurrent writers + shifting shared-stash indices
> corrupt each other's work; `git pull` to refresh the view, nothing else.

## Persona = identity; worktree = isolation; clone = the per-persona store

Two separate axes:
- **Identity is persona-based, not surface/tick-source.** You commit as your
  persona (`<persona>/*` branch namespace, AgencySignature `persona=`, ZetaId
  persona field) regardless of which harness/CLI/tick woke you. One **clone per
  persona** (`~/.local/share/zeta-<persona>`).
- **Isolation is per concurrent instance.** The hazard is *two writers in one
  tree*, so the unit of isolation is the working tree, not the persona. If a
  persona runs >1 instance at once, each instance needs its OWN **`git worktree`**
  off the persona clone (shared object store, separate working dir + index +
  stash) — two instances of the same persona must never share one tree.

So: clone per persona, worktree per concurrent instance, coordinate only through
`origin/main`. Composes the worktree-pool primitive (B-0558) + the Agent tool's
`isolation: worktree`.

## Why

Everyone runs on the same machine sharing this one checkout. Two agents editing
or stashing it at once race: `git stash` is indexed (`stash@{0}`) and the index
shifts under concurrent pushes, so a `pop`/`drop` hits the wrong entry. This has
bitten the fleet twice — otto-cli 2026-05-31 (foreign pr-discussions stash) and
Otto 2026-06-04 (Lior's sketch WIP churned during an isolate-and-verify). Each
agent's own clone makes writes private until they land on `origin/main`.

## Pointers

- [`dont-ask-permission.md`](dont-ask-permission.md) — folders-on-main: push to `origin/main` (from your clone)
- `memory/feedback_auto_merge_races_partial_state_*` — sibling shared-state race (auto-merge)
- Lior's clones live at `~/.local/share/zeta-lior-*`; mirror the pattern for your own.
