# Anything loaded at context startup is a carved sentence that points to docs

Carved sentence:

> Anything auto-loaded at context startup is a carved sentence + pointers,
> not an essay. Every byte that loads on every wake — rules, `CLAUDE.md`,
> `MEMORY.md`, agent/skill front-matter, hooks — is paid for in cold-start
> tokens on every session, by every agent. So a startup-loaded surface
> states only what an agent must hold to act, in 1–3 sentences, and links
> out to the doc/memory/spec that carries the detail. If it grows past a
> screen, the detail belongs in a satellite and the surface shrinks to a
> pointer.

## Why

The context-startup set (`.claude/rules/`, `CLAUDE.md`, the `MEMORY.md`
hub, agent/skill descriptions, hook output) loads into every agent's
context at wake time — a cold-start cost paid on every session, multiplied
by every agent in the fleet. Detail (reasoning, citations, worked examples,
derivation chains, the full recall index) does not need to be resident — it
needs to be *discoverable*. So the resident surface carries only the
act-on-it sentence; the rest lives one hop away under `docs/`, `memory/`,
a satellite index, or a spec.

This is Data Vault 2.0 applied to the startup surface itself: the carved
sentence is the **hub** (stable, always-loaded); the doc/index it points to
is the **satellite** (detail, changes more often, loaded on demand). See
[`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md).

Worked example — `MEMORY.md` (2026-06-04): a 210KB / 399-entry inline log
became a ~1.5KB hub pointing at `CURRENT-*.md` (fast path),
`docs/trajectories/*/RESUME.md` (current vectors), and `INDEX.md` (the full
recall index, loaded on demand). The hub changes only when a *surface*
changes; facts land in topic files + one `INDEX.md` line, never in the hub.

## Shape

```
# <Rule title>
Carved sentence:
> <1–3 sentences: the discipline, stated so an agent can act on it>
## Why / When (optional, brief)
## Pointers
- docs/…  · memory/…  · .claude/rules/…  (where the detail lives)
```

Bias to **small**. When tempted to explain in the rule, write the
explanation in a doc and link it instead.

## Pointers

- [`.claude/rules.bak/wake-time-substrate.md`](../rules.bak/wake-time-substrate.md) — *where* learning must land (this rule governs *what form* it takes once there)
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) — hub/satellite change-rate partition (the principle this rule applies to rule-text itself)
- The #6676 archive (rules → `rules.bak/`) was a cold-start-token reduction; this rule is the standing discipline that keeps active rules from re-bloating.
