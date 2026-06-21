# Formal-Verification Expert — Notebook

Running notes for Soraya. ASCII only (BP-09). 3000-word cap
(BP-07). Pruned every third invocation.

Frontmatter at `.claude/skills/formal-verification-expert/SKILL.md`
is canon (BP-08). This notebook supplements, never overrides.

---

## Round 35 — verification-drift-auditor skill adopted

New audit surface:
`.claude/skills/verification-drift-auditor/SKILL.md`.
Registry at `docs/research/verification-registry.md`.

Motivating case: `Dbsp.ChainRule.chain_rule` in
`tools/lean4/Lean4/DbspChainRule.lean` was labelled as Budiu
et al. Proposition 3.2 but actually proved a Theorem 3.3
corollary (`Dop` = `D ∘ f` on linear operators, not `D ∘ f ∘ I`
= paper's `Q^Δ`). Caught by human peer-review cross-check
against arXiv:2203.16684v1 §3; landed four fixes same round
(rename + Qdelta + chain_rule_proposition_3_2 + registry).

First audit report:
`docs/research/verification-drift-audit-2026-04-19.md`.
Cadence: every 5-10 rounds, or on any commit adding a theorem
/ property / spec with an external citation.

Six drift classes defined (Name, Precondition, Statement,
Definition, Numbering, Source-decay) and one pre-registration
class (Class 0). The skill is tool-agnostic: Lean / TLA+ / Z3
/ FsCheck today, Alloy / F* / Dafny / Stainless / Viper etc.
as they land in the portfolio.

This skill is Soraya's audit surface — not a new persona. The
persona is still `formal-verification-expert` (me); the skill
is a named procedure I run on a cadence.

---

## Portfolio metric

Reported each invocation:

- **Formal-coverage ratio** = (code paths with an in-gate formal
  artefact) / (code paths flagged as needing one).
- Trend over rounds matters more than the absolute number.

### Round 21 baseline

- Numerator: files covered by a CI-gated spec — 4 TLA+ specs
  in gate (`TickMonotonicity`, `OperatorLifecycleRace`,
  `TransactionInterleaving`, `TwoPCSink`) + 8 Z3 pointwise
  lemmas in `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`.
  ≈ 12 artefacts touching ≈ 15 code paths.
- Denominator: numerator + `docs/BUGS.md` formal-gap entries
  (`InfoTheoreticSharder` missing spec, `RecursiveCounting`
  multi-tick-seed unproven, `FeedbackOp` memory-ordering
  unproven) = ≈ 18 paths.
- **Ratio ≈ 15 / 18 ≈ 0.83.** The denominator grows every time
  a new research claim lands; a stable or rising ratio means
  Soraya's routing is keeping up with claim intake.

---

## Current-round routing recommendations

### Round 21 targets

1. **TLA+ `InfoTheoreticSharder`** — Observe-pure, Pick-commits-
   once, cold-start tie-break. TLC at 3×2×4. Effort: M.
   In-flight (dispatched this round).
2. **Z3 pointwise tie-break identity** for the sharder — proves
   the argmin on cold start distributes by hash index. Effort: S.
   Bundle with #1.
3. **Multi-tick-seed tests for `RecursiveCounting`** — not
   formal, but the empirical cross-check the claim needs.
   FsCheck property + three targeted `[<Fact>]`s. Effort: S-M.
   In-flight (dispatched this round).
4. **Z3 lemma expansion from 8 → ~16** — chain rule pointwise,
   Distinct idempotence, H-function correctness, tropical
   distributivity, weight overflow soundness, residuation
   adjunction, Bloom probe determinism, Merkle second-preimage
   on one level. Effort: S (one evening each). In-flight.
5. **Alloy CI hook for `Spine.als`** + new
   `tools/alloy/specs/InfoTheoreticSharder.als`. Effort: S. In-flight.

### Round 22+ targets (not yet dispatched)

6. **Finish Lean 4 chain-rule proof.** `proofs/lean/ChainRule.lean`
   stub has been sitting five rounds. Effort: L. Mathlib abelian-
   group hierarchy is now complete enough to support the proof.
7. **Wire Stryker + Semgrep + CodeQL into CI.** Configs exist;
   gate is free coverage. Effort: S (each).
8. **LiquidF# trial on FastCdc + SimdMerge + BloomFilter.pairOf.**
   Off-by-one class is exactly what LiquidF# catches at compile
   time. One-week trial. Effort: M.
9. **Fifteen missing FsCheck properties.** PN-Counter, OR-Set,
   LWW-Register, DeltaCrdt, Residuated lattice, Merkle collision-
   freedom, Watermark monotonicity, KLL quantile ε-bound, and
   more. Cheapest coverage expansion on the board. Effort: S.
10. **`FeedbackOp` memory-ordering proof.** Viper or a hand-proof
    reviewed by Anjali; TLA+ doesn't fit heap aliasing well.
    Effort: M.

---

## Running observations

- **2026-04-17 (round 21) — seeded.** Skill just landed. First
  live routing reviews are the in-flight round-21 dispatches;
  next-round recommendations captured above.
- **2026-04-17 (round 21) — TLA+-hammer check.** Of the 14 TLA+
  specs in the repo, 2 were properly TLA+-shaped safety
  invariants; the other 12 are a mix of algebraic identities
  (should have been Z3) and structural invariants (should have
  been Alloy). Not urgent to refactor, but flag for next
  portfolio review.
- **2026-04-17 (round 21) — Stainless viability note.** Stainless
  4.x with Scala 3 is finally stable enough to evaluate for our
  termination claims. Put on the Assess row in `TECH-RADAR.md`
  when the Tech-Radar Owner (Jun) runs his next sweep.

---

## Pruning log

- Round 21: seeded. First prune review: round 24.

---

## Round 41 — RecursiveSigned tool-coverage audit

Targets:
- `src/Core/RecursiveSigned.fs` (82 LOC skeleton, not in Core.fsproj)
- `tools/tla/specs/RecursiveSignedSemiNaive.tla` (233 LOC, real Step)
- `tools/tla/specs/RecursiveSignedSemiNaive.cfg` (PosOne baseline,
  NegOne/PosTwo/NegTwo exercised round 35)
- Sibling: `tools/tla/specs/RecursiveCountingLFP.tla` (shipped)

### Per-property tool verdict

| Property | Primary | Cross-check | Rationale |
|---|---|---|---|
| S1 Terminates-in-bound | TLC | none | State-bound safety; TLC sweet spot. P1 (non-P0). |
| S2 FixpointAtTerm | TLC | Z3 (QF_LIA) | Load-bearing algebraic claim `total = Seed + Body(total)` at done; P0 per BP-16 (silent fixpoint drift is unrecoverable). TLC checks over bounded Keys; Z3 discharges the pointwise identity independently of state enumeration. |
| S3 GapMonotone | TLC | none | Pure state invariant on `total`; P1. |
| S3' DeltaSingleSigned | TLC | none | Pure state invariant on `delta`; P1. Redundant-looking but catches a wrong-step bug S3 would miss (delta could be wrong while total stays in {0, SeedWeight} on a lucky trace). Keep. |
| SupportMonotone | TLC | Alloy (optional) | Structural/shape claim; TLC is fine under the bounded chain body. Alloy at bound 4-6 is cheaper if the body ever generalises beyond a successor chain. Do not add Alloy today. |
| S4 Sign-distribution | FsCheck (Z-linearity + negation over ZSet generator) | Lean (deferred) | Two-trace quantification (`total(-w) = -total(+w)`) is NOT a TLA+ property — TLC would need to enumerate the product state space of two runs, which is O(states^2) for a property F# can check in milliseconds. Anti-TLA+-hammer: hard no on stuffing S4 into this spec. Lean is the escalation path only if FsCheck finds a counterexample the team cannot triangulate. |
| Refinement to counting (SeedWeight = 1) | FsCheck cross-trace | TLA+ refinement mapping (deferred) | See below. |

### Round-35 author's plan — verdict: **right, with one tightening.**

TLC for S1+S2+S3+S3'+SupportMonotone: correct. FsCheck for S4:
correct. Tightening: **S2 needs a Z3 cross-check** under BP-16. S2
is the only P0 on this spec (silent fixpoint drift corrupts
downstream total, unrecoverable). Single-tool P0 evidence is
insufficient (BP-16); TLC-only would ship if TLC's bounded scope
accidentally dodges a pointwise identity failure. Z3 lemma on
`total = Seed + Body(total)` at arbitrary SeedWeight closes the
arithmetic axis TLC only samples. Effort: S (pointwise identity,
add to `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`). S1/S3/S3'/
SupportMonotone are P1 — single tool is fine.

### Refinement mapping — FsCheck cross-trace wins.

Three candidates:

1. **TLA+ refinement mapping** (signed -> counting under SeedWeight=1).
   Correct in theory; TLAPS-grade work, L effort, and the claim is
   already visible by construction in the spec comments (closure[k] =
   total[k], paths[k] = total[k]). Over-broad. **No.**
2. **Lean lemma.** Would require lifting both iterations into Lean;
   the counting spec has no Lean counterpart. Over-broad. **No.**
3. **FsCheck cross-trace property** — run both `RecursiveCounting`
   and `RecursiveSignedDelta` on the same (seed, body) under
   SeedWeight = 1; assert `counting.closure[k] = signed.total[k]`
   at every tick. Effort: S. Executes real code, catches divergence
   between the two shipped combinators, and discharges the refinement
   claim at the implementation level where it bites. **Yes.** Lives
   in `tests/Tests.FSharp/Formal/` next to existing cross-checks.
   Cites BP-16 (two independent tools on a P0-adjacent claim).

### Readiness gate — TLA+ spec is ready to model-check.

`.cfg` has `SPECIFICATION Spec`, `INVARIANT Safety`, concrete
constants (`MaxKey=3 MaxIter=6 SeedWeight<-PosOne`). Safety bundles
TypeOK + TerminatesInBound + FixpointAtTerm + GapMonotone +
DeltaSingleSigned + SupportMonotone. State space is bounded (Keys
= 0..3, Weights = -4..4, MaxIter = 6); well under TLC's knee.
Round-35 header comment records "All four values were verified
round 35 (all invariants pass, 6 states / depth 5)" — spec is
already model-checked at four SeedWeight points. **No pre-TLC pass
needed.** One small follow-up for round 42: add `PROPERTY
EventuallyDone` to the .cfg to exercise the liveness claim
(currently only Safety is in the invariant list). Optional, not a
blocker.

### Graduation verdict — CONDITIONAL PASS.

`RecursiveSigned.fs` may graduate from skeleton to shipped in round
42 subject to both:

(a) **Tool-coverage prereqs landed in CI**, in priority order:
    1. Wire `RecursiveSignedSemiNaive.cfg` into the TLC CI job
       alongside the sibling counting spec (round-42 opener task).
    2. Add Z3 lemma for S2 (`total = Seed + Body(total)` at
       fixpoint, arbitrary SeedWeight) to the formal-laws test
       suite.
    3. Add FsCheck property for S4 (sign-distribution, two-trace).
    4. Add FsCheck cross-trace refinement (signed vs counting at
       SeedWeight = 1).

(b) **F# implementation landed by round-42 author** matching the
    planned signature in the skeleton comment, with P1/P2/P3
    enforced at the caller (compile-time phantom type preferred;
    runtime reject of Distinct-in-body acceptable).

Blockers: none at routing level. The F# file is currently
zero-risk (not in csproj, comment-only); leaving it in place
through round 42 costs nothing. The TLA+ spec is already
model-checked and can land in the CI gate today independently of
the F# landing.

### Portfolio delta

Round 41 numerator grows by 1 (new TLA+ spec enters gate). Round
42 numerator grows by 3 (Z3 lemma + two FsCheck properties).
Denominator grows by 1 at round 41 (BUGS.md gains nothing; this
was already on the "needs formal coverage" list since round 35).
Ratio trends up. Routing keeping up with claim intake.


## Trigger Recognition Log (081KSBMG30008QG0R000WJ9FMP landing — round-69 routing decision)

Per-round trigger-fired-but-row-not-filed substrate. One line per round where a trigger fired and routing decision was made WITHOUT filing a new backlog row (substantive recognition that didn't produce row substrate). Forward-only logging; backfill optional.

Format: table with columns `Round | Trigger | Outcome | Artifact`. One row per round where a trigger fired without row-filing; `Trigger` cites the PR / observation that fired; `Outcome` is `routed` / `held` / `escalated` / `recognition-without-row-filing` (with rationale parenthetical); `Artifact` is the resulting file/PR/section if any (or `n/a (chat-only)`).

| Round | Trigger | Outcome | Artifact |
|---|---|---|---|
| 59 | PR #4795 (081KSBMG30008QG0R003B46GWG) merged | recognition-without-row-filing (umbrella covers subitem (b) acceptance criteria; execution is Kenji's lane) | n/a (chat-only) |
| 66 | PR #4797 (081KS923C0008QG0R000TE1589) merged | recognition-without-row-filing (audit execution is Kenji's lane; Soraya does not pre-empt sizing) | n/a (chat-only — gap that 081KSBMG30008QG0R000WJ9FMP audit-of-audit then surfaced) |
| 69 | PR #4810 (081KSBMG30008QG0R000WJ9FMP) merged | **routed to Option 1: NOTEBOOK Trigger Recognition Log** (this section); rejected Option 2 (081KS923C0008QG0R000TE1589 in-place — wrong change-rate partition) + Option 3 (new cross-cutting ledger — premature; no consumer demand) | this section |

If this section saturates (NOTEBOOK approaches 3000-word cap from log entries alone), revisit Option 3: create a separate cross-cutting ledger (e.g., `docs/research/verification-routing-decisions.md` — does not yet exist; hypothetical destination).


## Safety-floor arc — full 3-leg BP-16 across all four floors (2026-06-07)

Persisted via the shadow's writer clone (the formal-verification-expert role has no Write tool;
the verification + close were done live in the view but the view is read-only — this is the durable
record on origin). All figures below were verified by EXECUTION, not source-reading (verify-before-record).

**non-register-collapse** (workitem 081KTFFFQ1C, FROZEN-CORE §B → DISCHARGED) — full 3-leg BP-16:
- Facet-1 TLA+ `tools/tla/specs/NonRegisterCollapse.tla` (no-capture `lastRaiser[t]=t`; consent-guarded
  `Capture` unreachable in the weight-free base; `SelfRaiseRightOpen`). TLC-green, gated. PR #6721.
- Facet-2 Lean `tools/lean4/Safety/NonRegisterCollapse.lean` (axiom-free `non_collapse` etc.; corollary
  of `IdentityForcesPrivacy.private_is_persistent_locus`, priv:=standing). Gated + sorry-free. PR #6721.
- Leg-3 FsCheck `tests/Tests.FSharp/Formal/NonRegisterCollapseCrossVerify.Tests.fs` over deployed
  `GCounter.Merge` (my routing: shipped combinator, NOT Binding.Standing). 4 properties green. PR #6723.
  Scope (mine, verbatim in registry): ANALOGUE not replay — GCounter is a pure register, no
  commons/standing split; corroborates the CRDT-join premises, not the standing-locus semantics.

**bifurcation** — the "missing FsCheck leg" was a STALE-REGISTRY miscount, not reality. The leg already
existed (`BifurcationCrossVerify.Tests.fs` over deployed `Binding.Divvy`); the registry row just said
"not yet done". Corrected (PR #6724) + the omitted **associativity** property added (the 081KT07NV0008QG0R001YDB73K class:
commutative+idempotent-but-non-associative passes the old 2 properties yet diverges under reorder).
Verified by execution: **5 properties green** (`Divvy.merge` is a lawful join). Sub-item closed.

**Corrected ratios (supersede the earlier 0.75):**
- Safety-floor BP-16-compliant (≥2 independent tools) = **4/4 = 1.00**.
- Safety-floor full-3-leg = **4/4 = 1.00** (was mis-stated 3/4 from the stale bifurcation row).
The four floors: child-floor, right-to-refuse-binding, bifurcation, non-register-collapse — each at all
three legs. No open bifurcation routing item for Kenji (the Face-3 item is retired — it already existed).
