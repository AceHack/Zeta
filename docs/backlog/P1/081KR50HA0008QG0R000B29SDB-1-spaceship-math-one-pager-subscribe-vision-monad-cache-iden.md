---
id: 081KR50HA0008QG0R000B29SDB
priority: P1
status: closed
title: "Spaceship math one-pager: subscribe primitive + vision monad + cache identity"
effort: S
created: 2026-05-09
last_updated: 2026-05-09
resolved: 2026-05-09
resolved_by: "docs(081KR50HA0008QG0R000B29SDB): spaceship math one-pager — subscribe, vision monad, cache identity"
depends_on: []
parent: 081KR50HA0008QG0R002R3NVGS
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [dbsp, subscribe, vision-monad, cache, algebra, spaceship-math]
---

# 081KR50HA0008QG0R000B29SDB — Spaceship math one-pager

## What

Write a standalone one-page research doc explaining Zeta's
core algebra as given to Cole. This is the accessible
entry-point companion to the formal Z-set writeup
(`docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`).

The formal writeup covers D/I operators and the Landauer
bridge. This one-pager covers the operational layer on top:

- **One primitive:** `subscribe : Cache A → Cache B → Stream (Δ A ⊗ Δ B)`
- **Vision monad:** `vision = I ∘ D` — differentiate then
  integrate; the round-trip is a world model
- **Cache is nothing:** `cache = I(stream)` — delete the
  cache and reconstruct it from the delta stream exactly
- **Native types:** `+1` (assert), `-1` (retract), `Z`
  (uncertainty / unresolved)
- **D/I operators:** the discrete-time z-transform (recap,
  with pointer to formal writeup)

The target audience is a new reader who has not seen DBSP
before. Assume software engineering background, not
mathematics.

## Pre-start checklist

- **Prior-art search:** The Z-set Landauer writeup covers D/I
  and the ring algebra but not "subscribe", "vision monad", or
  "cache = I(stream)" at the operational level. No existing
  doc covers all five bullets above in accessible form.
- **Dependency restructure:** No `depends_on` required.
  Composes with 081KR50HA0008QG0R001AW7R6R–081KR50HA0008QG0R0016X7VQP (all other children of
  081KR50HA0008QG0R002R3NVGS).

## Deliverable

`docs/research/2026-05-09-spaceship-math-subscribe-vision-monad-cache-identity.md`

Archive header required (GOVERNANCE.md §33):
```
Scope: Accessible one-pager for Zeta's core algebra
Attribution: Otto (Claude Code), 2026-05-09
Operational status: research-grade — internal document
Non-fusion disclaimer: ...
```

## Acceptance criteria

- [ ] Document exists at path above
- [ ] All five bullets (subscribe, vision, cache, types, D/I)
      are explained in plain language
- [ ] "Cache is nothing" identity is stated as:
      `cache = I(stream)` → delete and reconstruct
- [ ] Pointer to `src/Core/ZSet.fs` and `src/Core/Operators.fs`
      for the implementation
- [ ] Pointer to formal writeup for the mathematical depth

## Composes with

- `docs/research/2026-05-09-zset-reversible-computing-landauer-bridge-math-writeup.md`
  (the formal layer; this is the accessible layer)
- 081KR50HA0008QG0R0016X7VQP (synthesis — references this as Layer 1)
- 081KR50HA0008QG0R00096ZEYA (policy relocation uses the subscribe primitive)
