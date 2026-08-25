---
id: 081M0X1QSZR087G0R003A7V3VC
type: task
state: backlog
priority: P2
slug: encryption-budget-and-erasure-costs-does-thermodynamics-grou
title: "Encryption budget and erasure costs: does thermodynamics ground AI society decorrelation?"
created: 2026-08-25T18:08:22.520Z
depends_on: []
composes_with: []
---

# Encryption budget and erasure costs: does thermodynamics ground AI society decorrelation?

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X1QSZR087G0R003A7V3VC-*.md` glob. -->

## Outcome

Audit landed as `docs/research/2026-08-25-the-landauer-floor-does-not-ground-the-encryption-budget-mutual-information-does-and-decorrelation-does-not-follow-lumen.md`.

**Mixed verdict — negative on the physics-as-grounding, positive on the algebra, plus two code defects.**

- Energy cost is NOT load-bearing: 10^9.8 vs a DRAM write; and the bound points the wrong way
  (Landauer bounds the defender's `erase`, not the attacker's `un-erase`).
- The G-set/Z-set split IS real and implemented byte-lock-stably in F#/TS/Rust — but the
  "zero-crossing is the unique irreversible op" claim is **falsified**; the real boundary is
  **discarding the delta**. What survives is stronger: the zero-crossing is the unique
  **evidence-destroying** op, the only one that can blind a meter.
- **Meter is specified but unbuilt:** `consolidateSorted` returns survivors, not annihilations;
  `ErasureClass.fs` declares no row for Z-set consolidation.
- **Defect Z-E5:** `GlassHalo.frost` is a revocable marker; `clear` is free and unauthenticated,
  contradicting the permanence its governing rule asserts.
- **Defect Z-E6:** `Pool.Return` passes `clearArray = false` for value-type keys, so annihilated
  weights survive annihilation and die later to an unrelated `Rent`.
- Decorrelation is a **non-sequitur** as specified (three gaps; §5).

Follow-on candidates: return the annihilation count from `consolidateSorted`; one `ErasureClass`
row; explicit `clear` at erasure-sensitive `Pool.Return` sites; commit-reveal experiment for ρ.
