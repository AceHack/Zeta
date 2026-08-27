---
id: 081M10CBYF9087G0R003GWBNHG
type: task
state: in-progress
priority: P1
slug: fourcornertrace-value-needs-istarring-c4-compass-is-not-cl-p
title: "FourCornerTrace VALUE needs IStarRing; C4 compass is not Cl(p,q)"
created: 2026-08-27T01:11:51.529Z
depends_on: []
composes_with: ["081KYXE4W8808QG0R0011X8S70", "081M10AZ6KS087G0R0000SSFMH"]
---

# FourCornerTrace VALUE needs IStarRing; C4 compass is not Cl(p,q)

Aaron 2026-08-26: FourCornerTrace VALUE (WSet ping-return; −1 = i² is a
ring identity) needs IStarRing. Clifford ±1 / C₄ compass on FourCorner
are related; they are **not** “it is Cl(p,q)”.

## This increment

- `src/Core/FourCornerC4.fs` — C₄ phase group; ℂ `i² = Negate(One)`;
  even-subalgebra embedding `e₁₂`; vector-square discriminator
  `e₁² = +1`; Cl(0,1) ≅ ℂ vs Cl(3,0) ≅ M₂(ℂ)
- Laws tests: group, ring witness, even embedding, discriminator,
  FourCornerTrace over `Cl3.Mv` weights; TRACE vs C₄ on existing
  `IStarRing` instances; law packs consume `IntegerRing.Star`;
  `e^{iπ} = i² = Negate(One)` (Euler = same C₄ point, analysis not ring);
  spin-½ `R(2π)=−1`; Pauli Z = multiply-by-e^{iπ}; two NSEW compasses compose
  at Meijer's missing feedback (2-corner duals traded for `OnError`;
  feedback product is reversible, error sum is erasing); FourCorner is
  **not** a fermion — Adinkra connection is Q-odd dashing = C₄ south;
  coded `[8,4]` 8B+8F vs uncoded `Cl(0,8)` halves; E8 roots+algebra
  metered, compact group still a substitute
- ROADMAP item 1 / P1 / shipped / continuous / research #8
- Research absorb: `docs/research/2026-08-26-fourcorner-c4-istarring-not-clpq.md`

## Remaining

- Product path may weight a live trace by `Cl3.Mv` without promoting
  FourCorner to Cl(p,q)
- Do not identify the I/O record with a Clifford algebra **or a fermion**
- Conformal CGA Cl(4,1) stays the Sequoia distance slice
- Compact Lie group E8 as a *manifold* (exp of the compact real
  form) — split Chevalley root groups `x_α(t)` now have multiply
  (`E8ChevalleyGroup`); that is the algebraic group, not the
  compact manifold
