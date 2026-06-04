# Shared checkout is a view, not a workspace

Carved sentence:

> The shared checkout `/Users/acehack/Documents/src/repos/Zeta` is everyone's
> read-only VIEW of `origin/main` — never a workspace. Work in your OWN clone +
> branch and push to `origin/main` from there; never edit, commit, or `git stash`
> in the shared checkout. Concurrent writers + shifting shared-stash indices
> corrupt each other's work; `git pull` to refresh the view, nothing else.

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
