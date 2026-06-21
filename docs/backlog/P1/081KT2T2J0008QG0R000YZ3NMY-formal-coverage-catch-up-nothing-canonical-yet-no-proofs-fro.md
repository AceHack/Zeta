---
id: 081KT2T2J0008QG0R000YZ3NMY
priority: P1
status: open
title: "Formal-coverage catch-up — we have ~zero canonical items yet (no proofs-from-seed, no hex/4×4 connection); every 081KT2T2J0008QG0R000S7GHQ8 law is example-tested only; Soraya's prioritized proof backlog (C1–C14, P0–P2) (Aaron + Soraya 2026-06-02)"
tier: research
effort: XL
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R000S7GHQ8]
composes_with: [081KT2T2J0008QG0R0038CRFJM, 081KT2T2J0008QG0R0008TFHJT, 081KT2T2J0008QG0R0026XCGQM, 081KT2T2J0008QG0R003VK5GRX, 081KT2T2J0008QG0R0019YVX8M, 081KRFA460008QG0R0018SN61J]
tags: [formal-coverage, formal-proof-first, nothing-canonical-yet, proven-from-seed, homeostat, hex-4x4-connection, consensus-not-validation, asserted-vs-proven, z3, fscheck, tla-plus, bp-16, soraya, message-group-laws, bp-exact-on-trees, ep-moment-match, codec-functor-laws, tick-algebra-laws, infer-net, research, aaron, soraya]
type: research
---

# Formal-coverage catch-up — nothing is canonical yet

## The honest position (Aaron 2026-06-02)

> *"so we really have little/no canonical items yet cause we don't have any
> useful proofs or proofs and not 4×4 or hex connection."*

By our own bar (`canonical ⟺ homeostat proven-from-seed`, the formal-proof-first
discipline), **we have ~zero canonical items.** Two reasons, both true:

1. **No proofs.** Soraya's audit (below) confirms every algebraic law in the
   081KT2T2J0008QG0R000S7GHQ8 engine is `[<Fact>]` example-tested — `Bayesian.Tests` references no
   FsCheck at all. The tests *demonstrate* laws on hand-picked points; they do
   not *prove* them over the domain. The math is anchored (KFL/Minka/GPML/DBSP) —
   so it's not shaky *math*, it's **shaky evidence**.
2. **No hex/4×4 connection.** Even where a law holds, it isn't connected through
   the **proof lineage** to the seed — the hex core (Cl(1,3), the 6 bivectors /
   081KT2T2J0008QG0R0019YVX8M) and the 4×4 extensions (081KT2T2J0008QG0R003VK5GRX). Canonicity propagates *outward from
   proofs anchored in the seed*; without that edge, an item is at most *validated*.

**Consequence — re-tier almost everything we "landed":** cross-AI consensus is
not validation (it's a prompt to prove); example-tests are *validated* at best;
the 081KT2T2J0008QG0R0008TFHJT registry's **"promoted" entries (Z-set family, codec algebra, Tick
algebra) are promoted-by-argument, NOT proven** — they are *validated / proof-owed*,
not canonical, until C1–C14 close AND they connect to the hex/4×4/seed lineage.
This row is the catch-up that earns canonical status honestly.

## Soraya's coverage table (formal-verification-expert audit, 2026-06-02)

| # | Claim (file:line) | Evidence now | Owed proof | Tool (BP-16) | Anchor |
|---|---|---|---|---|---|
| C1 | Gaussian product = commutative group, id=uniform, inv via `/` (`Message.fs:73-86`) | unit, 1 triple | assoc/commut/identity/inverse/closure | **Z3** + FsCheck | KFL 2001 |
| C2 | Beta product group, id=`Beta(1,1)`, naturals `(α−1,β−1)` (`Message.fs:153-165`) | unit, example | group laws on shifted naturals | **Z3** + FsCheck | PRML ch.2 |
| C3 | Bernoulli product group via log-odds add (`Message.fs:242-252`) | unit, example | group laws on log-odds (finite only for p∈(0,1)) | **Z3** + FsCheck | exp-family |
| C4 | `Message.marginal` = product-fold, generic (`Message.fs:308`) | unit | fold-homomorphism; identity on empty | **FsCheck** | KFL 2001 |
| C5 | BP `runToFixpoint` exact-on-trees + termination (`FactorGraph.fs:177-191`) | unit (chain) | exact-on-tree marginal; termination under cap | **TLA+/TLC** (3-var tree × bounded rounds) | KFL 2001 (theorem) |
| C6 | NaN-safe `moved`: divergent never reports converged (`FactorGraph.fs:148-163`) | unit, 1 case | residual-monotonicity + NaN→moved invariant | **Z3** + FsCheck | factory-native |
| C7 | EP probit moment-match (`Ep.fs:78-90`) | unit, good quadrature cross-check, 4 pts | accuracy over cavity domain (generate cavities) | **FsCheck** (quadrature oracle) | Minka 2001 / GPML 3.58 |
| C8 | inverse-Mills asymptotic **error bound** (`Ep.fs:63-71`) | unit, finiteness-only | the O(1/z⁵) error bound (asserted in comment, untested) | **Z3/interval** or analytic bound + FsCheck band | Mills series |
| C9 | v² overflow-safety in `vHat` (`Ep.fs:89`) | unit, 1 broad-cavity | `v/(1+v)≤1` keeps intermediate finite ∀ valid v | **Z3** (QF_LRA) | factory-native |
| C10 | MessageBatch round-trip `ofMessages∘toMessages=id` (`MessageBatch.fs:88-91`) | unit | round-trip identity per family; **Bernoulli lossy at p→0/1** | **FsCheck** | factory-native |
| C11 | Batch product = scalar element-wise, **"bit-exact, proven in tests"** (`MessageBatch.fs:20,96`) | unit, 2 pts | **CLAIM IS FALSE AS WRITTEN** — example-tested, not proven; Bernoulli only bit-exact up to log-odds round-off | **FsCheck** + fix the prose | factory-native |
| C12 | Codec = invariant functor, `decode∘encode=id`, closed product/sum/id (081KT2T2J0008QG0R0008TFHJT) | **asserted-in-prose** | functor laws + round-trip + closure | **FsCheck** | functor laws |
| C13 | Tick = `(ℕ,+,0)` monoid + `z⁻¹/I/D` linear-operator algebra (081KT2T2J0008QG0R0008TFHJT) | **asserted-in-prose**; row flags gate NOT-WRITTEN | monoid laws; `z⁻¹` linearity; `I=Σz⁻ⁿ`, `D=1−z⁻¹` | **FsCheck** + **Z3** (operator identities) | DBSP/Budiu |
| C14 | ±1 Z-set abelian group + earn-its-keep auto-prune (081KT2T2J0008QG0R0008TFHJT) | asserted; partial code grounding | abelian-group laws; prune preserves semantics | **FsCheck** | Shapiro CRDTs |

## Prioritized math backlog (by "how dangerous is consensus-without-math here")

**P0 — silent-corruption class, ≥2 tools each (BP-16 cross-check):**

1. **C1/C2/C3 message group laws → Z3 + FsCheck.** The kernel. If `( * )` isn't
   actually associative/commutative over the domain, BP marginals are
   order-dependent garbage and every downstream answer is wrong-but-plausible. Z3
   proves symbolically (already live + affordable: `Z3.Laws.Tests.fs:235` proves a
   max-monoid adjunction); FsCheck catches a float impl diverging from the model.
   **Close this first — it's the foundation, currently one triple.**
2. **C11/C10 batch↔scalar + round-trip → FsCheck.** `MessageBatch.fs:20` claims
   "bit-exact, proven in tests" — **false as written** (example-tested; Bernoulli
   log-odds lossy at p→0/1). Production hot path; silent divergence from scalar
   while scalar tests stay green. Fix the prose + add the property.
3. **C6 NaN-safe `moved` → Z3 + FsCheck.** Convergence-detection correctness rests
   on `not (d <= tol)` (NaN counts as moved). Wrong → divergent run reports
   converged → ships garbage marginal. Pure boolean arithmetic = Z3's sweet spot.

**P1 — 1 primary tool:**

1. **C5 BP-exact-on-trees + termination → TLA+/TLC** (the one genuine
   state-machine/fixpoint property — TLA+ right, not hammer-bias; 3-var tree ×
   capped rounds).
2. **C7 EP moment-match → lift the quadrature cross-check (`Ep.Tests.fs:49`) from
   4 fixed points to FsCheck-generated cavities** (keep quadrature as oracle).
3. **C13/C12/C14 registry codec/Tick/Z-set laws → FsCheck.** Writing these IS the
   081KT2T2J0008QG0R0008TFHJT admission gate the row says is unwritten — the **Tick primitive cannot
   promote until its correctness gate exists.** Unblocks the registry ship gate.

**P2 — accuracy-bound, documented:**

1. **C8/C9 inverse-Mills error bound + v² overflow → Z3/interval or documented
   analytic bound.** Lower urgency (only bites at extreme tails).

## Cross-check triage (BP-16) + wrong-tool guards (Soraya)

- C1–C3: **Z3 (symbolic over ideal reals) ∧ FsCheck (real F# float code)** — disagreement IS the finding; do not relax FsCheck tolerance.
- C11: FsCheck primary; it will EXPOSE the false "bit-exact proven" prose (Gaussian/Beta genuinely exact; Bernoulli exact-up-to-log-odds-round-off) → prose fix owed.
- C5/C6: **TLA+ (schedule/termination) ∧ FsCheck (NaN residual on real overflow).**
- **Do NOT** TLA+ the pointwise group laws (Z3) · **do NOT** Lean the 3-line identities (Z3, seconds vs human-weeks; Lean reserved for the BP-exact theorem only if paper-grade ever wanted; TECH-RADAR has Lean at Assess/stub) · **do NOT** LiquidF# the refinements (TECH-RADAR Hold round-35; route to FsCheck+Z3).

## The canonical bar this row enforces

An item becomes **canonical** only when: (a) its homeostat (equilibrium —
`runToFixpoint` convergence / jelly→spine / EP fixed point) is **proven from the
seed**, AND (b) it connects through the proof lineage to the **hex core**
(Cl(1,3), 6 bivectors — 081KT2T2J0008QG0R0019YVX8M) and the **4×4 extensions** (081KT2T2J0008QG0R003VK5GRX). Soraya's
proofs (C1–C14) close (a); the hex/4×4 lineage edges close (b). Until both, the
item is *validated* (tested) or *hypothesized* (asserted) — never canonical.

## Acceptance

1. **P0 closed**: C1/C2/C3 (Z3+FsCheck), C11/C10 (FsCheck + prose fix), C6 (Z3+FsCheck).
2. **P1 closed**: C5 (TLA+), C7 (FsCheck cavities), C13/C12/C14 (FsCheck) — unblocks 081KT2T2J0008QG0R0008TFHJT Tick promotion.
3. **P2 closed**: C8/C9.
4. **hex/4×4 lineage edges** authored for each proven law (081KT2T2J0008QG0R0019YVX8M / 081KT2T2J0008QG0R003VK5GRX connection) — the second half of canonical.
5. **re-tier 081KT2T2J0008QG0R0008TFHJT** registry entries to *validated / proof-owed* until their laws close; promote to canonical only with proof + lineage edge.
6. **Soraya on a standing cadence** working this backlog (not one-shot) — the durable formal-coverage loop.

## Composes with substrate

- **081KT2T2J0008QG0R000S7GHQ8** (the engine being proven) · **081KT2T2J0008QG0R0008TFHJT** (registry entries to re-tier + the Tick gate this unblocks) · **081KT2T2J0008QG0R0038CRFJM** (minimal vocabulary) · **081KT2T2J0008QG0R0026XCGQM** (referee principle / say-do-gap) · **081KT2T2J0008QG0R003VK5GRX** (4×4 / vectors-before-trajectories — the lineage target) · **081KT2T2J0008QG0R0019YVX8M** (hex core Cl(1,3) — the lineage target) · **081KRFA460008QG0R0018SN61J** (F# HKT)
- `references/notes/2026-06-02-infer-net-lineage-cleanroom-spec-sources-formal-proof-first.md` (the proof sources: Minka-2005 unified math + Ścibior-2018 denotational validation)
- `memory/soraya/NOTEBOOK.md` round-70 (Soraya's seed; advisory, local branch `otto-cli/soraya-b1000-formal-coverage-audit-2026-06-02` commit `fa528917a`, unpushed — Kenji integrates)
- rules: `fsharp-anchor-dotnet-build-sanity-check` (compiler = asymmetric critic), `razor-discipline`, `premise-flagged-unverified-stays-unverified-downstream`, `labeling-confidence-...` (the canonical-tier bar this raises), `algebra-first-admission-...` (the registry gate)
- `docs/TECH-RADAR.md` (FsCheck/Z3/TLA+ Adopt; Lean Assess; LiquidF# Hold) — the tool-ring constraints

## Routed in: Lior external review 2026-06-04 — gap #4 (convergence metric)

The BP/EP **convergence metric is scale-sensitive**: `Message.fs` uses max-abs-diff
of natural parameters (`max (abs (a.PrecisionMean - b.PrecisionMean)) (abs
(a.Precision - b.Precision))`). Absolute difference on natural params is
scale-dependent — precision 0.1→1.1 vs 10000.1→10001.1 both register distance 1.0,
so a fixed `tol` can oscillate forever (large values) or falsely converge (small
values). **Fix:** KL-divergence (the sound metric for distribution movement in BP),
or — if keeping abs-diff for perf — scale `tol` relative to parameter magnitude.
Sibling of the C6 "NaN-safe `moved`" row (same `runToFixpoint` path). Owner:
Soraya cadence. (Other Lior gaps handled by Otto 2026-06-04: #1 Z3-overflow
boundary, #2 scalar→map Z3 lift, #3 sketch dimensionality guard — fixed; #5 ZetaId
within-version ordering — documented. #4 here needs the inference-engine proof lane.)

## Substrate-honest framing

`[labeling-confidence: this row is itself observed/established (Soraya's audit is empirical — file:line cited; the example-only test state is a fact). The CLAIM that "nothing is canonical yet" is established under our own canonical bar. The proofs themselves are the owed work — none done yet (numerator +0 this round, denominator +7; the ratio dropped — engine shipped faster than its formal coverage).]` This row does not make anything canonical; it names the gap honestly and routes the proofs that will. Formal proof first; consensus is not validation; the math is.
