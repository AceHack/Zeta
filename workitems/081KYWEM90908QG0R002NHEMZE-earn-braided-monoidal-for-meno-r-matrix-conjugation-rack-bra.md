---
id: 081KYWEM90908QG0R002NHEMZE
type: task
state: backlog
priority: P2
slug: earn-braided-monoidal-for-meno-r-matrix-conjugation-rack-bra
title: "Earn braided-monoidal for Meno — R-matrix (conjugation-rack) braiding, per Soraya spec"
created: 2026-07-31T16:03:00.233Z
depends_on: []
composes_with: []
---

# Earn braided-monoidal for Meno — R-matrix (conjugation-rack) braiding, per Soraya spec

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYWEM90908QG0R002NHEMZE-*.md` glob. -->

## Soraya's routing + implementation spec (formal-verification-expert, 2026-07-31 — ferried by shadow)

**Status:** speced, not started. Tensor prereq (Step 0) already DONE on main (`Meno.tensor` is the real
Kronecker; Soraya read a stale view-only checkout). BraidEntropy is on main, NOT on this critical path.

**Design — the braiding needs extra data (a Yang–Baxter R-matrix); the swap is *forced symmetric*.**
A Cartesian/Kronecker ⊗ is symmetric by a theorem — the current `Meno.braid` is a *correct symmetric*
braiding, not "unearned." Genuine braid = an R with R²≠id.
- **PRIMARY (ZSet-ℤ-native): the conjugation-rack R** — `R(x⊗y) = (x·y·x⁻¹) ⊗ x`, `R⁻¹(u⊗v) = v ⊗ (v⁻¹·u·v)`,
  over `V = ℤ[Fₙ-gens]` (Braid.fs `Word`s). Integer, float-free, byte-lockable, DST-replayable, **R²≠id**.
  It IS the ℤ-linear shadow of `Braid.applyCrossing` — `ρ(σᵢ) = I^⊗(i-1) ⊗ R ⊗ I^⊗(n-i-1)`, and
  `ρ` factors through Braid.fs's faithful rep (`Braid.equal ⟺ ρ-equal` is a lemma).
- Scope earned: **"V is a braided object; ⟨V⟩ is braided monoidal realizing Bₙ."** NOT "all of Meno is
  braided" (needs full quasi-triangular R). Claim the first only.
- Anchors: Joyal–Street 1993 (braiding axioms + 2 hexagons); Yang 1967 / Baxter 1972 (YBE); Kassel
  *Quantum Groups*; Joyce 1982 / Fenn–Rourke (racks); Kauffman–Lomonaco 2004 (complex R, already in
  `BraidRepYangBaxter.Tests.fs` as a validated 2nd realization).

**THE FALSE-GREEN TRAP (load-bearing).** 6 of 8 FsCheck properties PASS on the degenerate swap (symmetric
⊂ braided): P1 naturality, P2a/P2b hexagons, P3 bifunctoriality, P5a Yang–Baxter, P5b far-commute. Only
TWO go RED on the swap — GATE ON THESE:
- **P4: `∃z. run(c∘c) z ≠ z`** (σ²≠id witness) — swap has σ²=id.
- **P5c: `ρ-equal ⟺ Braid.equal`** — `Braid.equal 3 [1;1] [] = false` but swap collapses σ₁²→id.
A suite without P4+P5c enforced would certify a symmetric category as "braided." Retire MENO-2 (the
current false-green swap test in `PrivacyAndMeno.Tests.fs`).

**Sequencing (≈1 implementer-week for the FsCheck gate):**
0. (DONE) wire `Meno.tensor`→`ZSet.cartesian`.
1. **[S–M, the sleeper]** add associator α + unitors as Meno arrows — ZSet tuples are NON-STRICT, so the
   hexagons can't even be *stated* without α.
2. **[M]** implement `braidR` (conjugation-rack, §design) + `ρ(σᵢ)`; rename `Meno.braid`→`symmetry`/`swap`.
3. **[M, CI GATE]** FsCheck P1–P5, with **P4 + P5c as required assertions**; P5c cross-checks `Braid.equal`.
4. **[M, separate track, OFF fast gate]** Lean4: two abstract lemmas ("braiding from R symmetric ⟺ R²=id"
   + "rack R has R²≠id") vs `Mathlib.CategoryTheory.Monoidal.Braided` (greenfield in `src/Core.Lean4`, but
   Mathlib v4.30.0-rc1 IS a dep). `.olean` cached.
5. (optional, S) wire complex R_KL as the amplitude-level 2nd realization (YB-4/7 already validate it).

Paths: `src/Core/Meno.fs`, `src/Core/Braid.fs`, `src/Core/ZSet.fs:436` (cartesian),
`tests/Tests.FSharp/BraidRepYangBaxter.Tests.fs` (YB harness + R_KL control),
`tests/Tests.FSharp/PrivacyAndMeno.Tests.fs` (MENO-2 to retire), `src/Core.Lean4/lakefile.toml`.

## Progress (2026-07-31, shadow)

**F# side COMPLETE + merged** — PRs #9792 (braidR, σ²≠id, tripwires), #9793 (associator/unitors + pentagon/triangle), #9794 (n-strand rep ρ realizes Bₙ: YBE + far-commute + faithful). `⟨V⟩` is a genuine braided monoidal category, all tests green. REMAINING: Lean4 certificate (route to a Lean owner), annotate MENO-2.
