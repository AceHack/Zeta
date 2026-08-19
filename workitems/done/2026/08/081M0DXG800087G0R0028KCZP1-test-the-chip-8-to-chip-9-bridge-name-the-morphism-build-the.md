---
id: 081M0DXG800087G0R0028KCZP1
type: task
state: done
priority: P2
slug: test-the-chip-8-to-chip-9-bridge-name-the-morphism-build-the
title: "Test the CHIP-8 to CHIP-9 bridge: name the morphism, build the non-morphism control, measure lesson transfer"
created: 2026-08-19T21:05:43.936Z
completed: 2026-08-19T21:15:02.180Z
depends_on: []
composes_with: []
---

# Test the CHIP-8 to CHIP-9 bridge: name the morphism, build the non-morphism control, measure lesson transfer

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DXG800087G0R0028KCZP1-*.md` glob. -->

## What was asked

Test the cheapest bridge in the ladder `CHIP-8 → CHIP-9 → Atari (ALE) → ARC-AGI-3 →
decorrelated human measurement` before the expensive rungs get built. Name the morphism, build
a non-morphism control (without which a positive is unfalsifiable), define "a lesson"
operationally, and pre-register both readings.

## What was found

CHIP-9 **exists** as an implemented target — one opcode of ISA delta (`Fn01` plane select) over
CHIP-8, locked across four language oracles by `src/Core.TypeScript/chip9/golden-vectors.lines`.
So the honest deliverable was the experiment itself, not a spec for one.

- **The morphism** is the inclusion `ι(s) = s with plane := 1, extra := ∅`, and the law
  `step₉ ∘ ι = ι ∘ step₈` on `Fn01`-free programs — a functional bisimulation, i.e. CHIP-9 is a
  **conservative extension** of CHIP-8. Checked step-by-step, not asserted.
- **A lesson** is a text artifact: seeded memory + ROM + trace assertions in a plane-agnostic
  predicate vocabulary + the name of the structural axis that should falsify it.
- **The control family** destroys one named structure each (`or-draw`, `no-clip`,
  `no-origin-wrap`, `vf-sticky`), built as one parameterised interpreter so complexity matching is
  structural rather than claimed.
- **Result (pre-registered positive):** all four lessons survive the lift into the plane region
  CHIP-9 adds; each control breaks exactly the lesson naming it — a clean 4/16 diagonal.

## The finding that matters

**Rung 1 is a conservative extension; rung 2 is not a morphism of any kind.** There is no
inclusion CHIP-9 → Atari 2600. The ladder equivocates on "morphism", so link-one success carries
no information about link two. Recommendation: the next rung is **CHIP-8 → 6502 via `IsaSpec.fs`**
(which already carries a 6502-shaped second witness), not Atari.

Two anchors were checked and did not survive: **Futamura** (no specialiser in this experiment, so
partial evaluation entails nothing here) and **Bellemare et al. 2013** (a platform paper — the
documented Atari negative-transfer result is Parisotto/Ba/Salakhutdinov 2016 and Rusu et al. 2016).

## Artifacts

- `docs/research/2026-08-19-the-first-rung-is-a-conservative-extension-and-the-second-is-not-a-morphism-at-all.md`
- `src/Core.TypeScript/bridge-transfer/` — dialects, lessons, runner, pre-registered test
