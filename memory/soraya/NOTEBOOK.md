# Formal-Verification Expert — Notebook

Running notes for Soraya. ASCII only (BP-09). 3000-word cap
(BP-07). Pruned every third invocation.

Frontmatter at `.claude/skills/formal-verification-expert/SKILL.md`
is canon (BP-08). This notebook supplements, never overrides.

---

## Round 35 -- verification-drift-auditor skill adopted

Surface `.claude/skills/verification-drift-auditor/SKILL.md`; registry
`docs/research/verification-registry.md`; first report
`docs/research/verification-drift-audit-2026-04-19.md`. Motivating case: the `DbspChainRule`
mis-citation (labelled Budiu Prop 3.2, actually a Thm 3.3 corollary). Six drift classes plus
one pre-registration class, tool-agnostic. Cadence: every 5-10 rounds, or on any commit
adding a cited theorem/property/spec.

## Portfolio metric

Formal-coverage ratio = gated artefacts / paths flagged as needing one. Trend beats absolute.

### Round 21 baseline -- PRUNED 2026-08-14. Ratio was ~15/18 = 0.83 over 4 gated TLA+ specs
and 8 Z3 lemmas. Superseded: the TLA+ leg alone is now 52 gated model runs.

---

## Current-round routing recommendations

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
### Round 21 targets -- PRUNED 2026-08-14, all dispatched and long landed.

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

### Refinement mapping — FsCheck cross-trace wins

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

### Readiness gate — TLA+ spec is ready to model-check

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

### Graduation verdict — CONDITIONAL PASS

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


## Vacuity round — the Landauer lane (2026-08-13, PR pending)

Third instance of the vacuity class this session, and the first one I fixed rather than flagged.
Sibling cases: `QuorumCollateral` / `WagerSolvency` stutter (TLC deadlock checks vacuous, flagged
against my own specs); B AC3 `= true` (2026-08-09 rule table).

CHECKED, all by execution:

- `entropy-tracker.ts` `verifyLandauer` — `heatPaid`, `floor`, `bitsErased` all read
  `entropy_heat`, so the comparison was `x >= x`. #10476 named this.
- **`second_law_satisfied` was ALSO vacuous, and #10476 did not name it.** The test was
  `state + heat >= 0`; `measure(k)` moves `k` between ledgers and leaves the sum alone for
  every `k`, so only `branch` (+1) ever moves it. Exhaustive sweep over the 6-op alphabet to
  length 5: `false` occurred **zero times**. `holds` therefore reduced to `entropy_heat >= 0`.
- `tools/Z3Verify/landauer-floor-lemma.smt2` — **vacuous**. Its second-law premise
  `-k + heat >= 0` IS the conclusion `heat >= k`. Deleting only that premise flips the file
  from unsat to **sat, model k=1.0 heat=0.0** (an erasure paying nothing). Header advertised
  four lemmas F1-F4; the file contained one. **Not gated by any workflow** — that is why it
  rotted unseen.
- `LandauerFloor.lean` — NOT vacuous, but not faithful. Its `measure` carries `k <= s.state`,
  which the TypeScript does not implement, and its heat-monotonicity theorems are discharged
  by `Nat` rather than by the model. The implementation uses signed `number`, where the same
  property is falsifiable — and was false. A formal artefact that discharges an obligation
  using a type the implementation lacks has not discharged it. Gated (lean-proof.yml).

Routing verdict: **no non-trivial Landauer invariant exists in normalized units** — the ledger
pays exactly the floor by construction, so the honest fix is rename + narrow, not a stricter
comparison. Real falsifiable invariants that DO exist here: heat monotonicity (arrow of time),
heat non-negativity, erasures-fully-admitted. The third is **false in shipped callers by
design** (`createNonAdjMap`, `event-sink-folder`), so it is reported, never enforced — a check
that fails spuriously gets disabled, which is the other half of this defect class.

Portfolio delta: Landauer lane goes from 1 gated artefact (Lean) to 2 (Lean + the SMT lemma,
newly gated by `tools/Z3Verify/landauer-floor-lemma.test.ts`, z3 AND cvc5, BP-16). The SMT
runner asserts the verdict sequence CONTAINS a `sat` — an all-unsat proof file is
indistinguishable from a tautology, so non-vacuity is now a gate condition, not a review habit.

Open for Kenji, CHECKED counts: 9 `.smt2` files. 4 now have an executing companion runner
(chsh-band-gate-agreement, consolidate-quadratic-envelope, gen-denotation-splitmix64, and
landauer as of this PR). 5 have none: externality-bound, light-time-endpoint-speed-envelope,
predictive-advantage, privacy-budget-net-positive-regime, whitewash-economics.

Sharper than the count: **every pre-existing runner asserts all-unsat**, so not one of them
could have detected the defect I just found. An all-unsat expectation is satisfied by a
tautology. The routing recommendation is that each lemma file carry a non-vacuity probe whose
expected verdict is `sat`, and that the runner assert the SEQUENCE rather than "every verdict is
unsat". That is a 4-file retrofit, not a rewrite.

---

## 2026-08-14 -- Meno braided ladder: Q3 then Q1. Balanced, and it stops there.

Routed and answered the last open MATHEMATICAL question on the Meno board. Checked Q3 first
because it gates whether Q1 is even about Meno.

**Q3 -- obstruction NOT real as stated.** The brief's premise ("our ambient tensor is described
in our own source as cartesian") misreads `Meno.fs:38`, which says the DETERMINISTIC
SUBCATEGORY is cartesian. Ambient `(x)_Kronecker` is not cartesian (not the product in Mod_Z;
`unitObject` not terminal), so Mathlib `Subsingleton (SymmetricCategory C)` does not apply.

**But the adjacent obstruction IS real and sharper than the brief's version.** A cartesian
monoidal category has a unique BRAIDING -- not merely a unique symmetric structure. I is
terminal, naturality against `!_A : A -> I` forces both projections of `c`, product universal
property pins `c = swap`. And `braidR` is built with `Meno.arr`, i.e. it lives in the cartesian
deterministic subcategory. The escape: every `<V>` morphism is a BASIS BIJECTION, and copy is
not surjective / discard is not injective, so neither can enter. Fox 1976 then gives
non-cartesian. Nothing needs constructing -- the "minimal non-cartesian tensor" is the ambient
one under a hom-restriction, and `MenoBraided.rep` already IS it. Deliverable is a GUARD.

**Q1 -- balanced, and the two prior reviews were wrong in the same way.** Both read the axiom as
`theta_{A(x)B} = theta_A (x) theta_B`. Real axiom has `. c_{B,A} . c_{A,B}` on the right, so
`theta_V = id` forces `theta_{V(x)V} = c^2`, NOT `c^2 = id`. `<V>` is balanced, uniquely, with
`theta_{V^n} = rho(Delta_n^2)` -- the Garside full twist. `theta_V = id` is forced by B_1 being
trivial and is correct, not degenerate.

Routing: REJECTED the brief's suggested Z3-over-{S3,S4,Q8} search -- it answers a different
question. `Hom_{<V>}(V^n,V^n) = rho(B_n)` and rho is faithful, so the problem is central
elements of B_n, not set-maps G^n -> G^n. Encoding free-group rewriting into SMT-LIB is ~a week
producing something less trustworthy than `Braid.equal`, which we already ship and test.
REJECTED Lean-first: general n needs Garside normal form, which Mathlib does not carry.
ACCEPTED exact computation over the shipped faithful `Braid.equal`. Hours, not weeks.

BP-16 honoured, and this time I did not repeat the `chsh` mistake: the F# check runs against the
SHIPPED `Braid.fs` (not a private copy), and the second implementation is an independent
re-write from the spec. Both agree for all m+n <= 7. Four planted mutants -- theta=id (the
reviewers' own reading), theta=Delta, theta=Delta^4, single block-swap -- all REJECTED by both.
An all-pass run with no mutant that dies is a tautology; these die.

**Q4, and it is the useful part.** Balanced was worth hours and it CLOSED a line. Above it buys
nothing: ribbon would give a Markov trace scalar link invariant, strictly weaker than the
faithful `Braid.equal` we already have, and it is blocked at the object anyway (V has no dual in
Mod_Z). MTC is false, not open. Recommendation: STOP at balanced. Climbing further is aesthetics.

Portfolio: Meno lane goes 1 gated artefact (`MenoBraidedRMatrix.lean`, reachable from the `Lean4`
root -- orphan guard checked, it is fine) to 1 gated + 2 routed
(081KZZVC3DD087G0R0035SZN58 Lean certificate, 081KZZVC6SE087G0R001SXE8BV copy/discard guard).
Denominator unchanged. Also fixed a garbled sentence in `MenoBraided.fs` left by a bad edit on
2026-08-13 -- the kind of damage that makes a docstring stop being readable evidence.

## 2026-08-14 -- Z-EPS run: the AmplitudeEmu threshold drop SIGNALS. Verdict: conjecture HOLDS.

Handed by Lumen (PR #10551 open, docs/research/2026-08-14-the-quorum-fold-is-not-a-join-...).
My doc: docs/research/2026-08-14-z-eps-run-the-threshold-drop-signals-...-soraya.md.
Artefact: tests/Tests.FSharp/Formal/AmplitudeEmuSignalling.Tests.fs (12 tests, in-gate).

ROUTING CALL. Property class is NOT on the table: IEEE-754 arithmetic near a hard threshold,
and the claim is EXISTENTIAL. Route = analytic construction + executable witness on shipped
code. Rejected: TLC (no reals; the exact carrier it would need makes the defect INVISIBLE --
false green on a P0, the sharpest wrong-tool cost I have logged); Z3 (right for the 3-line
non-linearity lemma, unknown for the claim); Lean (weeks, wrong object); FsCheck as primary
(witness set is measure-zero -- a green run would have been a FALSE NEGATIVE). FsCheck is
correct AFTER the witness -- Adaeze's lane, filed as open item 3.

THE LESSON WORTH KEEPING: the offered framing was that the algebra might settle it without an
experiment. It does not, and the error is a converse slip. "Linear implies no-signalling" has
contrapositive "signalling implies nonlinear", NOT "nonlinear implies signalling" -- global
renormalisation is nonlinear and signals nothing. Algebra voids the GUARANTEE; only a witness
establishes the CLAIM. Gisin 1990 is a genericity result, not a theorem about a given map.
Generalise: whenever a conjecture cites an impossibility theorem, check which direction of the
implication the citation actually licenses before routing to a prover.

RESULT. Bob-local, trace-preserving op moves Alice's marginal 0.2647 -> 0.0000 (26 points).
Support flips [0;1] -> [0]. Survives on a unit-norm state (1.44e-12 -> exactly 0, support still
flips). Control = the SAME RAY at 1e6 -- invariant to 1e-16, drop fired 0 times. Exact-integer
arm gives 9/34 under both settings. Drop-fired asserted by branch count in BOTH arms.

NON-VACUITY. Mutation check run: EPS := 0.0 kills exactly the 5 drop-dependent tests and leaves
preconditions + controls + exact arm green. Correct kill pattern. Every arm calls shipped
AmplitudeEmu.step -- the chsh-probe failure (own copy of the definitions) is not repeatable here.

CONSEQUENCE. "Tune EPS" is dead as a class, not just inelegant: for any EPS > 0 there is a ray
where the shift is order 1, because the shift is scale-dependent and the theory is not. Raises
urgency on 081KZZYWBN2087G0R003NAQQAF (exact carrier) -- did NOT do it, separate item.

RING NOTE. Nothing moved. Confirms the standing FsCheck ring caveat: random search is the wrong
generator for measure-zero witness classes; it must be seeded by construction.

DENOMINATOR. +1 path (AmplitudeEmu drop) flagged; +1 numerator (now in-gate). One NEW gap
opened and named, not closed: WSet.consolidate carries its own isZero at 1e-12 on COMPONENTS,
six orders tighter than AmplitudeEmu's on INTENSITY. Same shape, un-run. Do not assume it
inherits this result.
## Round 2026-08-14 — the flags a spec is measured under ARE part of the claim

Closed `081KZYRDMZW087G0R0012K4QA0`, which I raised and then raised P2 to P1 after it bit me.

The defect was not in a model. `QuorumPhaseCancellation` went red on CI with exit 11 because my
recorded runs were driven by a script passing `-deadlock` (which DISABLES deadlock checking) and
the gate passed no such flag. **A hand-run green and a gated green were not the same result and
nothing anywhere said so.** Adding `-config` was necessary and not sufficient: the next mismatch
would have been a different flag.

Routing call, and it generalises past TLC: **a recorded verdict that does not carry the exact
invocation that produced it is a claim about an unknown experiment.** So the fix is not a flag,
it is `registry/tlc-models.json` -- 53 pinned model runs, both consumers building argv from that
one file, the id quotable next to any result.

Portfolio delta: configs executing in the PR lane **34 -> 52 of 53**. Configs no runner opened
**19 -> 0**. Negative configs that fail when the witness stops firing **0 -> 14**. Exhaustive
state counts asserted **0 -> 37**. One model (`BftLiveness`) is `extended` tier with a written
reason: at `-workers 1` it takes ~26 min against the `11min 14s` recorded from a 4-worker run.
Declared gap, not a silent one.

**Verdict on a `tlc-solver-floor.json` sibling to `smt2-solver-floor.json`: NO, and the cheaper
answer is better.** z3/cvc5 come from the runner `apt`, so their version is ambient and degrades
silently -- a floor is the only lever. `tla2tools.jar` is COMMITTED to git (since #8053), so the
toolchain is already byte-pinned by the diff. What was missing was not a floor but an assertion
that the jar loaded is the pinned one; the registry now carries its sha256 and version banner and
the gate checks the banner on every run. One field, not a second registry.

Two things found while pinning, both real:

- `tools/setup/manifests/from-url` downloads `tla2tools.jar` to `tools/tla/tla2tools.jar`, **a
  path no runner reads**, unchecksummed. The committed jar reports `2026.05.18.174321`, not the
  `v1.8.0` two docs claim.
- My own state-count parser matched a TLC *progress* line rather than the final summary, reading
  122647 off `BftConsensus` against a pinned 4665495. The tempting fix was to relax the pin. The
  correct one was to chase the number -- **the assertion caught my parser on its first real run,** 
  which is what a falsifier is for.

Carried forward: the deadlock caveat is now IN the artefact, not only in prose.
`QuorumCollateral` and `WagerSolvency` stutter, so their deadlock checks cannot fail; each model
records `deadlock` as `off-cfg` / `on-vacuous` / `on`, and the linter cross-checks `off-cfg`
against what the `.cfg` actually declares.

Not exposed to the bun 5s cap (`081KZZ3JHP1087G0R00027ARRR`, reproduced here: `bunfig.toml`
`timeout = 20000` is ignored, a 6s test dies at 5002ms). The gate is `dotnet test`; the bun-side
TLC tests only run metadata commands. A comment in `run-tlc.test.ts` names the hazard so nobody
adds a real model check there and reads a 5s truncation as a failed proof.

---

## 2026-08-18 -- consolidated map + vacuity sweep

Deliverable: `docs/research/2026-08-18-formal-verification-consolidated-map-proofs-math-and-code-pushed-together.md`

### Portfolio metric (this round)

Gated formal artefacts, counted from the runners' own rosters (NOT from
`audit-formal-artifacts.ts`, which mismeasures -- see below):

- TLA+/TLC: 53 pinned model runs, 52 `gate` + 1 `extended`; 14 expect VIOLATION.
- Lean 4: 48 files, ~30 headline lemma families under `#print axioms`, via `run-checked.ts`.
- Z3/SMT: 9 `.smt2` + `Z3.Laws.Tests.fs`; z3 4.16.0 / cvc5 1.3.4 pinned in gate.
- Alloy: 6 models via `Alloy.Runner.Tests.fs`.
- FsCheck: 587 test attributes under `tests/Tests.FSharp/Formal/`.
- Mutation: Stryker cannot fail (`break: 0`, 2 files); `mutation-runner.ts` not in gate.

Ratio is NOT quoted this round. Both prior denominators are unusable: the
`audit-formal-artifacts.ts` "unreferenced" count is a docs-mention count, not a
wiring count. Reinstate once that tool reads the rosters.

### Vacuity sweep -- 4 found, 3 repaired

1. `lint-discharge-certificate-consistency.ts` scanned ZERO rows and printed a
   tick. Added a section-A ANCHOR check with live jurisdiction (49 anchors); the
   empty certificate scan is now reported as empty. Widening filed:
   081M0B2R2BQ087G0R000EC2E9Y.
2. Section-A row 25 cited `ReticulumTransport.fs` -- never existed. Repaired to
   `src/Bayesian/MeshLatencyModel.fs`. Found BY the new check, on `main`.
3. `ComputeReceipt.Tests.fs` CR-6/CR-7 -- dead `Some` arm, only reachable
   statement was `Assert.True(true)`. Rewritten to construct `{ Candidates = [] }`
   directly + a negative control. Mutation-proven (guard -> `if false`, both die;
   mutant reveals `IV = infinity`).
4. `Formal/NtpNoninterference.Tests.fs` -- `Assert.Equal(cardsOf links, cardsOf links)`.
   Rewritten to exact grid extraction under both clocks. Mutation-proven, AND my
   own first draft (`Assert.Contains`) survived the mutant. Run the mutant; do not
   reason about it.

### Standing rules produced this round

- **A determinism assertion `f(x) = f(x)` is metered iff the callee's transitive
  call graph can reach an ambient source.** Otherwise it is unmetered decoration.
  41 F# + 33 TS instances triaged under this; most are genuine section-13
  noninterference falsifiers and must NOT be deleted.
- **Inside section A, backticks mean "this is an anchor."** Prose about a dead
  name must not wear them, or the anchor check re-flags the repair note.
- **New TLA+ specs land with a `registry/tlc-models.json` entry that names their
  own vacuity, or they do not land.** 22 of 53 runs already declare
  `deadlock: on-vacuous`. That registry is the honesty standard for the portfolio.

### Not done, deliberately

- Did not widen the discharge matcher blind (43-row table with nested sub-tables;
  naive widening flags 23, mostly false).
- Did not touch open PR #12014 (`CliffordPeriodicity`). Its two mod-8 predicates
  ARE the same predicate -- Aaron's own find; routing call is refactor, not test.
- `CliffordPeriodicity.fs` is NOT on main as of 90e96dc542.
