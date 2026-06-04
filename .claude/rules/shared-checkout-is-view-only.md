# Shared checkout is a view, not a workspace

Carved sentence:

> The shared checkout `/Users/acehack/Documents/src/repos/Zeta` is everyone's
> read-only VIEW of `origin/main` — never a workspace. Work in your OWN working
> tree and push to `origin/main` from there; never edit, commit, or `git stash`
> in the shared checkout. Concurrent writers + shifting shared-stash indices
> corrupt each other's work; `git pull` to refresh the view, nothing else.

## Clone = per writer/loop/ticksource; persona = its owner

Two separate axes:
- **The clone is per writer/loop/ticksource** — the unit that actually writes
  concurrently. Each loop/ticksource gets its OWN clone (its private working tree).
  Two writers never share a tree (that's the shared-stash race). Coordinate only
  through `origin/main`.
- **The persona is the OWNER/identity** of that writer — you commit as your
  persona (`<persona>/*` branch namespace, AgencySignature `persona=`, ZetaId
  persona field) regardless of which harness/CLI woke the writer. Identity is
  persona-based; the clone is writer-based.

So **one persona owns MANY clones** — one per loop/ticksource it runs. Live
example: persona Lior owns `~/.local/share/zeta-lior-control` +
`~/.local/share/zeta-lior-loop` (two writers, two clones). Otto's first writer
clone is `~/.local/share/zeta-otto`. Composes the worktree-pool primitive (B-0558)
+ the Agent tool's `isolation: worktree` (worktrees are the cheap-disk variant of
the same per-writer isolation).

**The globally-unique writer signature = persona ⊕ surface/loop ⊕ instance ⊕
machine/node/cluster.** Persona alone isn't unique; neither is persona+surface —
you can run many same-kind loops (e.g. several `otto-cli-bg`) on one machine,
across machines, and in-cluster. The **instance** part is a concrete locally-stored
discriminator the writer keeps + reuses — a Windows **service name**, a **process
id**, a **container id** — whatever distinguishes same-type instances. **Instance
discriminator + network topology is sufficient** for global uniqueness. This is
exactly the system's shape: AgencySignature (`persona=` + `Agent-Runtime` + host +
instance token) and ZetaId (Persona + Location/node + Randomness/instance +
Timestamp) encode the same composite, globally-unique in the 128-bit key — so the
clock-embedded key IS the writer signature, and each writer is its own frame
(no global causal order; reconcile only through `origin/main` + the bus).

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
