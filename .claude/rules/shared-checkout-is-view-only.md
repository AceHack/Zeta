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

**The globally-unique writer ADDRESS (for the message bus) = persona ⊕ surface/loop
⊕ instance ⊕ machine/node/cluster.** Persona alone isn't unique; neither is
persona+surface — you can run many same-kind loops (e.g. several `otto-cli-bg`) on
one machine, across machines, and in-cluster. The **instance** part is a concrete
locally-stored discriminator the writer keeps + reuses. Stability differs: service
name (across restarts) > container id (container lifetime) > raw process id (process
lifetime only — **PIDs recycle**). **Blade (Amara): never use raw PID alone as the
durable discriminator** — use a durable `instanceToken`, or compose
`instanceToken + processId + boot/session epoch` so the same persona+surface+loop
can run multiple writers on one machine without address collision. **Instance
discriminator + network topology is sufficient** for global uniqueness on the bus.

**This is bus-uniqueness (addressing/routing a writer endpoint), NOT identity.**
Identity in this system is a *combination of multiple unique things*, of which the
bus address is only one facet — do not conflate "uniquely addressable on the bus"
with "who this is." A writer address is enough to route a message; identity is the
richer composite.

Concretely: this composite is our **traveler-bus / Reticulum message-core routing
uniqueness**, layered **after** the 128-bit ZetaId. ZetaId is the identity-core key;
the Reticulum-style routing address (persona ⊕ surface/loop ⊕ instance ⊕ topology)
rides on top for mesh delivery between traveler frames. So: ZetaId = key/identity
facet; routing address = bus reachability — related, not the same.

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
