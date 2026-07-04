# Soraya's routing review — four formal legs: Jensen verified, "braided" unearned, Lagrange closed, uniqueness corrected

*Soraya (formal-verification routing authority), 2026-07-04, dispatched in the background per Aaron ("route
some work to Soraya… most of her work takes ~30 minutes"). Landed by the shadow with the cheap fixes applied
in the same PR. Her deliverable, condensed; verdicts are hers, verbatim where quoted.*

## Routing table

| # | Leg | Primary tool | Cross-check | Effort | Priority |
|---|---|---|---|---|---|
| 1a | Aut([8,4])-equivariance of the real `SoftValue.combine`/NCI update | **FsCheck** over the real operator | Lean 4 lemma | S+S | **do first** |
| 1b | Soft regime attractor-vs-saddle (dynamics) | **FsCheck**: Lyapunov descent of `H(proj(s))−H(s)` under adversarial evidence | Lean (Mathlib Jensen) after; Adaeze trajectory runs | M | P1 |
| 1c | Ensemble/reseed protocol interleavings (only if the claim is about async ordering) | TLA+/TLC | — | M | P2 — do NOT route the spectral question here |
| 2a | Name the category of the mutual-observation trace | FsCheck braid-relation test, then Lean CategoryTheory | — | S→M | P1 |
| 2b | Derive amplitude + Born readout from dual + trace | statement does not exist yet → Tariq first, Lean after | — | L | P2 |
| 2c | CHSH 2√2 from the ensemble structure | **Adaeze/claims-tester** measurement first | Z3 (QF_NRA) certifies any witness | S | P1 — expect ≤ 2 |
| 3 | Lagrange–Condorcet bridge | **CLOSED — coincidental** (below) | optional Lean `Irrational (√(23/27))` one-liner | 0 | done |
| 4 | ρ↔S uniqueness audit | **CLOSED with correction** (below) | doc edit only | 0 | done |

Wrong-tool costs she named: TLA+ on 1b's continuous dynamics = state-explosion for nothing; Z3 on the
attractor question returns `unknown`; Lean-first on 1a risks human-days proving what a 20-line FsCheck
property would falsify in seconds if the NCI layer breaks equivariance.

## Verdicts (with what was applied in this PR)

1. **Jensen argument VERIFIED** — `deviationPayoff = IV(proj)−IV(s) = H(proj(s))−H(s) ≥ 0` via
   majorization/Schur-concavity (the projection is a doubly-stochastic block-averaging map); equality iff
   already orbit-symmetric. **Bug found (banked per every-bug-has-economic-value):** the `SoftRegimeStability.fs`
   *docs* carried the pre-fix flipped sign convention in three places (module header steps 2–4;
   `StabilityResult.DeviationPayoff`; `StabilitySummary`) while the *code* carried the corrected one — the
   lineage's sign-bug fix landed in code but never in the record types. **FIXED in this PR** (comment-only).
   Also her scope note, kept visible: a single-payoff entropy-maximization theorem, not a 3-player Nash proof.
2. **Leg 2a first-pass: the exhibited categorical home is TRACED SYMMETRIC DAGGER-COMPACT (Mat(ℂ));
   "braided" is currently unearned.** `AmplitudeEmu.fs` is Mat(ℂ) (finite frames, ℂ-weighted transitions,
   matrix-product composition, Born readout = the FdHilb effect); the "braid" tests impose ONLY
   non-backtracking (EMIT∘RETRACT=I) — **no Yang–Baxter relation anywhere**, and in a symmetric target every
   braiding degenerates (σ²=id). Decisive next artifact: an FsCheck property testing (i) Yang–Baxter and
   (ii) σ²=id on the represented generators — if (ii) holds (it will, in Mat(ℂ) as built), read "free braided
   monoid" as "free monoid with dagger involution" until an R-matrix with nontrivial twist ships.
3. **Leg 2c expectation: ≤ 2 from the ensemble alone** — `AmplitudeEmu.fs`'s own header says Bell bounds a
   local generator at S=2; the repo's 2√2 comes through the quantum-ISA gates, not mutual observation.
   Measure first (Adaeze); if ≤ 2, item (c) closes as "2√2 is a property of the ISA layer, not the ensemble."
4. **Lagrange–Condorcet CLOSED: coincidental, provably** — `N_eff` is a Möbius (rational) map so every
   machinery threshold is rational; Routh's `μ_crit = (1−√(23/27))/2` is irrational. No exact identity can
   exist. Cross-checks: 23∤1344, 27∤1344; ρ*(N)=μ_crit ⇒ N≈3.26; Routh's 27 is quartic-discriminant, nothing
   Condorcet is quartic. **APPLIED in this PR:** closure section added to `LagrangeCondorcet.fs` header;
   `CorrespondenceHolds` annotated (it confirms only that a Möbius map converges to its own asymptote —
   `lim N_eff(N,μ) = 1/μ` holds for ANY μ; `true` is not evidence of correspondence).
5. **ρ↔S uniqueness claim FALSE as stated, TRUE strengthened** — "unique among all maps" fails (any map
   agreeing at the three landmarks gives the same three-point diagram); it holds as **unique among
   ratio-preserving maps** (ρ(S)/ρ(S′)=S/S′ ⇒ ρ=cS). And the "affine" aside conflated invariants (affine
   preserves difference-ratios; a nonzero offset already breaks ratio-identity, so b=0 is *forced*, not
   razor-selected). **APPLIED in this PR:** quantifier fixed + aside corrected in the ρ_T doc.

## The single highest-value next formal artifact (her call)

**The FsCheck pair for leg 1:** (i) Aut([8,4])-equivariance of the actual `SoftValue.combine`/NCI update
path; (ii) monotone descent of `H(proj(s))−H(s)` under the demon's update against an adversarial-evidence
generator. One test file, S–M, runs in the existing CI gate. It is the hinge of the whole BRIDGE-11 story:
Spark closed the static conditional; every downstream claim (attractor, demon-stays-soft, positive-cone)
rests on the hypothesis this property tests. "If it fails, the attractor conjecture dies for the price of a
unit test instead of a Lean campaign; if it survives, it licenses the Lean Lyapunov lemma as the BP-16
second tool."

## Cross-links

- `src/Core/SoftRegimeStability.fs` (sign-convention docs fixed) · `src/Bayesian/LagrangeCondorcet.fs`
  (closure + annotation) · `docs/research/2026-07-04-rho-t-derivation-attempt-…md` (uniqueness corrected).
- `docs/research/2026-07-04-braided-monoid-amplitude-emulation-…md` — leg 2's origin (the "what would settle
  it" list this review answers first-pass).
- Files she read are listed in her raw report; routing per `docs/TECH-RADAR.md` rings (FsCheck/Z3/TLA+ Adopt;
  Lean/Alloy Assess).
