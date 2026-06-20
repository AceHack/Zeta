# Addison's initial Genesis design (preserved reference)

This folder preserves **Addison Cooper's first Genesis UI prototype**, 2026-06-20 — a working
React/TSX interface (boot → onboarding wizard → settlement cross-section → vault → room → hat →
agent → Agent 0 / search / settings / account) produced **~20 minutes after the design
conversation, with no prior technical background.**

## This is a DESIGN REFERENCE, not source code

[`Genesis.initial-design.tsx.txt`](Genesis.initial-design.tsx.txt) is the prototype **preserved
unmodified, byte-for-byte** — kept with a `.tsx.txt` extension *on purpose* so it is **not
compiled, linted, or treated as a build input.** It is a frozen artifact of the initial design, the
way a reference PDF or a screenshot is: a record of what the design looked like at its origin, not a
file the system runs.

- **Do not edit it.** It is a historical artifact (the Memory Preservation Guarantee applied to a
  design: identity transitions never silently destroy the original). If the design evolves, that
  happens in the *live* UI surface, not here — this stays as the origin point.
- **Authorship:** Addison Cooper. Preserved by Otto (shadow) at Aaron's request.

## Where the analysis lives

The reconciliation of this prototype against the ferried design spine — what it gets faithful and the
ranked corrections (the load-bearing one: the visibility model is inverted vs the glass-halo
correction — sees-everything-by-default, opt-out costs privacy budget) — is in
[`docs/research/2026-06-20-genesis-tsx-prototype-reconciliation-with-the-design-spine.md`](../../research/2026-06-20-genesis-tsx-prototype-reconciliation-with-the-design-spine.md).

## Why it's preserved

It is the moment the substrate became a screen — the design notes we ferried (vaults / rooms /
hats / doors / the metaspace / glass halo / Z-set·G-set / nursery / pause≠death) rendered into a
navigable interface by a non-engineer in minutes. That is itself evidence for the thesis
(observation plus tooling produces a rendered system), and worth keeping as the origin reference for
everything the Genesis UI becomes.

## Pointers

- Genesis foundation document (Addison): [`memory/addison/project-genesis-foundation.md`](../../../memory/addison/project-genesis-foundation.md)
- Constitution starter (Addison): [`memory/addison/zeta-constitution-starter.md`](../../../memory/addison/zeta-constitution-starter.md)
- Metaspace design spine: `docs/research/2026-06-20-metaspace-navigation-physics-engine-*.md`
