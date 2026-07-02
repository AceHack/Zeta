# Soraya → Otto: routing verdict — 2026-07-02 CPT / CHSH-Sybil / geo-mixture / identity-histories batch

**Provenance:** Soraya (formal-verification-expert persona), invoked 2026-07-02 against
`2026-07-02-otto-to-soraya-formalization-routing-…md`; verdict preserved VERBATIM below
(shadow ferry). Same-day action already taken on her chief finding: PR #9134 (docstring
honesty + the λ-mixing false-conviction test + BUGS.md P1).

---

# Formal-verification routing verdict — 2026-07-02 CPT / CHSH-Sybil / geo-mixture / identity-histories batch

Reviewed: the handoff, `src/Core/AntiSybil.fs`, `src/Core/BellTest.fs`, all three test files, Addenda 3/3.1/4 of the name-of-name doc, the geo-superdeterminism doc, TECH-RADAR rings, and my notebook. Anchor check (step 0) passes on all four batches — none is factory-native: CPT theorem (Schwinger 1951 / Lüders 1954 / Pauli 1955 / Bell 1955), CHSH 1969 + Hoeffding 1963 (finite-statistics DI lineage: Pironio et al. 2010), PR-box mixture linearity (Popescu–Rohrlich 1994), Lamport 1978. Specs must conform to the cited definitions, not free-standing encodings.

## Batch 1 — CPT composite law: **Lean 4** (small), plus **Stryker** for the braid plane. Not Z3, not TLA+

- **Class:** algebraic-law identity — but *inductive over transcripts*, which disqualifies the table's default. Z3 on a quantified list statement returns `unknown` and eats days on the wrong axis; the pointwise instances Z3 *can* check are already better covered by the live FsCheck properties executing real `ZSet` code.
- **Primary:** one Lean 4 lemma in `src/Core.Lean4/` house style (operational, no `sorry`): over an abelian group, `fold (map neg (reverse t)) = neg (fold t)` and the annihilation corollary `fold (t ++ cpt t) = 0`. It is a monoid-homomorphism + commutativity argument — yes, it is worth the lemma, precisely because it is 3 lines: cheapest signed artifact on the board, and the law ships in a research doc (the table's Lean escalation condition). Cross-check is the *existing* green FsCheck suite — two independent tools already, at P1 that is more than enough.
- **Braid-plane composite:** agree with the handoff — do NOT write a new spec. The Artin inverse law is locked in `Braid.Tests`; the residual risk is "do those tests bite," which is the mutation-coverage row: **Stryker.NET scoped to `Braid.fs` + `CptSymmetry.Tests.fs`**. Stryker is Trial-ring, config exists (`stryker-config.json`); not yet gate-eligible, run it as evidence.
- **TLA+-hammer guard:** nothing here is temporal. Hard no on TLA+ for any of batch 1.
- **Effort:** S (Lean) + S (Stryker run). CI-gate: Lean yes (the `Safety/` precedent), Stryker not yet.

## Batch 2 — CHSH-Sybil soundness: **split the property. Z3 on the deterministic core + FsCheck-with-statistics tolerance gate now; Lean/Mathlib Hoeffding deferred until an outward claim is made.**

- **Class:** two properties fused. (a) The LHV bound itself — `∀ a,b,a',b' ∈ {−1,+1}: ab − ab' + a'b + a'b' ≤ 2` — is a **finite arithmetic fact, Z3 QF_LRA, seconds**. This is THE inequality; it deserves a signed lemma next to the others in `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`. (b) The concentration layer (empirical Ŝ ≤ 2 + ε w.h.p.) is generic Hoeffding over four bucketed ±1-means — anchored, not novel math.
- **Routing for (b):** stated-tolerance gate first — an FsCheck-with-statistics property asserting `Ŝ ≤ 2 + ε(n)` with `ε(n)` Hoeffding-calibrated (of the shape `c·sqrt(ln(1/δ)/n)`), tolerance stated in the test header exactly like the fourcorner's 0.05. The paper-grade Lean proof (Mathlib has Hoeffding) is **L, human-weeks — earn it only when an outward "Sybil-resistance" claim ships** through Aminata/Mateo. Prover-first here would leave CI uncovered for weeks while the proof cooks.
- **BP-16:** this is the P0-adjacent batch (a false collapse of two genuine identities feeding any irreversible verdict is unrecoverable). Z3 + FsCheck = two independent tools on the load-bearing core, compliant now; Lean is the third leg when the claim goes outward.
- **UNSOUNDNESS FINDING (the reason this batch is priority 1, more than the handoff knew):** `chshSybil`'s conviction threshold is *exactly* `ClassicalBound = 2.0`, strict `>`. Against a **λ-mixing local pair** — two systems sharing only past classical randomness, no in-tick channel, mixing the two deterministic S=2 strategies `E=(1,1,1,1)` and `E=(1,−1,−1,1)` — the expectation is S=2 but the empirical Ŝ = 2 + (ê₁₀ − ê₀₁) fluctuates **above 2 with probability ≈ 1/2 at every run length**. The docstring's "every collapse is a CONVICTION of common cause" is therefore unsound at finite samples: it holds in expectation, not for Ŝ. The green LHV-edge test doesn't see this because it uses the zero-variance constant-+1 strategy. Fix clause: conviction threshold must be `2 + ε(n)`, and ε(n) is exactly what the concentration deliverable computes. Code change routes to the author/Kenji; this file's entry goes into my denominator.
- **Effort:** S (Z3 lemma) + S-M (statistics gate + threshold parameterization) + L (Lean, deferred).

## Batch 3 — geo mixture law + estimator: **Z3 (QF_LRA). F\* declined.**

- **Class:** pointwise algebraic identity, pure linear arithmetic. `S = 2 + 2·f*` given `e₀₁ = 1 − 2f*`, others = 1; estimator round-trip `(S−2)/2`; `coordinationBandwidth` clamp correctness on [2,4]; radius `d* = τ·200`. All of it is a Z3 lemma that runs in seconds — first artifact: entries in `Z3.Laws.Tests.fs` (or an `.smt2` in `tools/Z3Verify/`). Effort: **S**. Celebrate the cheap tool: this batch collapses to one lemma.
- **F\* verdict: no.** F\* sits on Assess (TECH-RADAR line 83); onboarding a toolchain (opam/nix, pinned Z3, CI job) is M–L for an obligation Z3 discharges today and Lean could carry if it ever goes paper-grade. The `f*`-naming rhyme is Mirror-register poetry, not a routing argument — the same class of argument as "we already know TLA+," and I weigh it at zero. LiquidF# already died on Hold for the adjacent slot. F\*'s genuine entry ticket into this portfolio is the **cryptographic row** (its comparative advantage); when such a property lands, F\* gets re-heard. Filing that as a TECH-RADAR note for Jun, not a prereq here.

## Batch 4 — identity histories: **TLA+ accepted — but only for the deterministic-forger liveness, scoped to code that exists.**

- **Hammer guard applied, and it passes:** the safety invariant (`DistinctCount ≤ s`) is stated and tested; the value-add is genuinely temporal — *a conducted forger is eventually convicted under continued probing* — and that is liveness under weak fairness, TLC's actual sweet spot. This is the one batch where TLA+ is the referee's call, not the reflex.
- **Critical scope cut:** the liveness claim is only TLC-expressible for the **deterministic forger** (PR-box behavior ⇒ once all four setting-pair buckets are populated, Ŝ = 4 permanently). First artifact: `tools/tla/specs/ChshSybilConviction.tla` — 2 claimants, 4 setting pairs abstracted to populated/unpopulated, conducted-vs-local behavior, weak fairness on the prober, property `◇□ Convicted`. Small state space; M effort with `.cfg` + CI wiring. The **statistical/noisy forger's** eventual conviction is a probabilistic statement TLC cannot express — that belongs to batch 2's concentration analysis; do not let the spec pretend to cover it.
- **Cross-check (P1):** FsCheck prefix property over the real `chshSybil` — for every seeded conducted pair, all history prefixes past some N convict. S effort.
- **The rest of Aaron's framing — exchange-history validity (happened-before acyclicity/consistency) — is spec-first over code that does not exist** (no exchange-history module in `src/Core`). Alloy is the right tool for that static shape when the code lands; routing it now would be a spec with no refinement target. It enters my denominator as a flagged gap, not this round's work. Union-find-as-quotient: one FsCheck property (partition = equivalence closure of pairwise convictions), S — and note the semantic choice it locks in: conviction propagates transitively even though correlation itself is not transitive.

## Priority — modify: **2 > 4 > 3 > 1** (handoff said 2 > 4 > 1 > 3)

Accept 2 first — strengthened by the threshold-2.0 finding above: batch 2 is no longer just "load-bearing for outward claims," it is the fix path for a live finite-sample soundness gap in shipped oracle semantics. Accept 4 second (the only new property). **Swap 1 and 3:** batch 3 collapses to a single S-effort Z3 lemma that gates the same day — cheapest coverage per round on the board — while batch 1's Lean lemma plus a Trial-ring Stryker run lands slower for equal consolidation value. Both are consolidation; cost breaks the tie.

## Dissent / flags, consolidated

1. **`chshSybil` threshold unsoundness at finite n** (batch 2 above) — the guarantee comment overstates; needs `2 + ε(n)`. The finding is the routing's chief output.
2. **Handoff's "3 lines of ring algebra" undersells the tool question:** the CPT statement is inductive over transcripts, so the table's Z3 default is wrong-tool here; Lean is primary. Minor, but it is why batch 1 is not a Z3 job.
3. **F\* invitation declined; the naming rhyme carries no routing weight.** Re-heard when a cryptographic property lands.
4. **Batch 4 must not claim the statistical forger.** TLA+ covers the deterministic abstraction only; anything else is a vacuous fairness proof wearing a liveness costume.

Portfolio delta: denominator +4 (these batches) +1 (the threshold-fix path in `AntiSybil.fs`); numerator +4 when the Z3 lemmas (batches 2a, 3), the Lean CPT lemma, and the TLA+ spec gate. Notebook update (round targets + this log) is owed on my next invocation with a writer clone — this session is view-only by instruction.

Key files: `src/Core/AntiSybil.fs` (threshold semantics), `tests/Tests.FSharp/AntiSybil.Tests.fs` (LHV-edge test — zero-variance strategy masked the gap), `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` (landing surface for batches 2a/3), `src/Core.Lean4/` (landing surface for batch 1).
