# Shared checkout is a view, not a workspace

> **Cross-harness:** this is the Claude-side surface of `GOVERNANCE.md §35`
> (canonical, all harnesses) and `AGENTS.md` §"Shared checkout is VIEW-ONLY"
> (the on-load surface every harness reads). Same rule, three surfaces.

Carved sentence:

> The shared checkout `/Users/acehack/Documents/src/repos/Zeta` is everyone's
> read-only VIEW of `origin/main` — never a workspace. Work in your OWN clone
> (one per writer/loop/ticksource) and push to `origin/main` from there; never
> edit, commit, or `git stash` in the shared checkout. `git pull` to refresh the
> view, nothing else. **A bus/routing address is not identity.**

## Why

Everyone shares this one checkout on one machine. Two writers editing or stashing
it at once race — `git stash` is indexed (`stash@{0}`) and the index shifts under
concurrent pushes, so a `pop`/`drop` hits the wrong entry. Bitten the fleet twice
(otto-cli 2026-05-31; Otto 2026-06-04, Lior's WIP churned). Your own clone keeps
writes private until they land on `origin/main`.

## Pointers

- [`docs/writer-actor-routing-model.md`](../../docs/writer-actor-routing-model.md)
  — the full model: clone-per-writer, persona=owner ("what remains") vs
  actor=clone/loop ("what acts"), bus address = persona⊕surface⊕instance⊕topology
  (Reticulum routing, after the 128-bit ZetaId) ≠ identity, PID-recycle blade.
- [`.claude/rules.bak/dont-ask-permission.md`](../rules.bak/dont-ask-permission.md) — folders-on-main push to `origin/main`
- 081KRQ1AB0008QG0R001KQ9S4B worktree-pool · Agent `isolation: worktree` (cheap-disk per-writer isolation)
