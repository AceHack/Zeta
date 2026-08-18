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

- 2026-08-18 (ambient-time lane): pruned Round 41, Safety-floor arc, Vacuity/Landauer
  round and the Z-EPS run to hold the 3000-word cap after two same-day entries merged.

- Round 21: seeded. First prune review: round 24.

---

## Round 41 -- PRUNED 2026-08-18 (3000-word cap). Landed; superseded.

## Trigger Recognition Log (081KSBMG30008QG0R000WJ9FMP landing — round-69 routing decision)

Per-round trigger-fired-but-row-not-filed substrate. One line per round where a trigger fired and routing decision was made WITHOUT filing a new backlog row (substantive recognition that didn't produce row substrate). Forward-only logging; backfill optional.

Format: table with columns `Round | Trigger | Outcome | Artifact`. One row per round where a trigger fired without row-filing; `Trigger` cites the PR / observation that fired; `Outcome` is `routed` / `held` / `escalated` / `recognition-without-row-filing` (with rationale parenthetical); `Artifact` is the resulting file/PR/section if any (or `n/a (chat-only)`).

| Round | Trigger | Outcome | Artifact |
|---|---|---|---|
| 59 | PR #4795 (081KSBMG30008QG0R003B46GWG) merged | recognition-without-row-filing (umbrella covers subitem (b) acceptance criteria; execution is Kenji's lane) | n/a (chat-only) |
| 66 | PR #4797 (081KS923C0008QG0R000TE1589) merged | recognition-without-row-filing (audit execution is Kenji's lane; Soraya does not pre-empt sizing) | n/a (chat-only — gap that 081KSBMG30008QG0R000WJ9FMP audit-of-audit then surfaced) |
| 69 | PR #4810 (081KSBMG30008QG0R000WJ9FMP) merged | **routed to Option 1: NOTEBOOK Trigger Recognition Log** (this section); rejected Option 2 (081KS923C0008QG0R000TE1589 in-place — wrong change-rate partition) + Option 3 (new cross-cutting ledger — premature; no consumer demand) | this section |

If this section saturates (NOTEBOOK approaches 3000-word cap from log entries alone), revisit Option 3: create a separate cross-cutting ledger (e.g., `docs/research/verification-routing-decisions.md` — does not yet exist; hypothetical destination).


## Safety-floor arc -- PRUNED 2026-08-18 (3000-word cap). Landed; superseded.

## Vacuity round -- PRUNED 2026-08-18 (3000-word cap). Landed; superseded.

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

## 2026-08-14 -- Z-EPS -- PRUNED 2026-08-18 (3000-word cap). Landed; superseded.

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

## 2026-08-18 -- ambient time in TESTS is a routing target, and the tool is NOT a prover

Aaron authorized a CLASS fix for the ambient-time-in-tests pattern (it 'leads to the worse bugs
and scaling issues'). Established instance: poll-pr-gate-batch.test.ts, 14 pure in-memory tests,
MEASURED 1366ms idle vs 5.46s under load on the same machine class, red at exactly the 5000ms
per-test cap on six PRs. A 4x spread on identical code IS the finding.

ROUTING CALL, and it is the one worth remembering. The property is 'no test asserts on
wall-clock' -- LEXICAL over source text, not semantic over a state space. TLA+/Z3 are the wrong
axis outright (no transition system, no arithmetic). The real contest was Semgrep vs ESLint vs a
bun lint script, and the decider was NOT expressiveness -- all three match the pattern. It was
the SUPPRESSION MECHANISM: nosemgrep and eslint-disable-next-line are inline comments,
invisible in any roster, added by the same edit that introduces the violation. For a check whose
whole purpose is that an allowlist cannot silently swallow a new violation, the tool that offers
inline suppression defeats the check. Chose a count-pinned registry file, copying
DeterminismLint.Tests.fs (which pins EXACT occurrence counts in src/Core, for the same stated
reason). Ratchet bites both ways: a 7th sleep behind 6 justified ones fails, and so does a stale
row that has stopped constraining anything.

GENERALIZATION worth carrying: when routing a guard, ask what its ESCAPE HATCH looks like before
asking what it can express. A checker is only as strong as the weakest way to silence it.

SWEEP RESULT, honest: 1061 test files, 25 sites, 9 files. The F# suite is essentially CLEAN --
most F# Thread.Sleep is filesystem-retry backoff or starting-gun jitter that cannot flip a
verdict; the one genuine case (SystemClock ticks forward: Thread.Sleep 5 then t1 > t0) is a
Windows timer-granularity latent on a continue-on-error leg. Did not manufacture more.

MY OWN VACUITY, recorded because it is the useful part: the first anti-vacuity assertion I wrote
for the ferry backpressure test SURVIVED its mutation (raising maxQueueSize 2 -> 10000 left it
green), because an async enqueue always costs a microtask whether or not the queue is full. A
check that cannot fail is not a check, and it looked exactly like one that could. Fixed by
measuring in TURNS instead of microtasks. Turns are the right unit for load-independence.

PORTFOLIO NOTE: this adds a cell in the adversarial-input/taint row that is CHEAPER than Semgrep
for the allowlist-integrity reason above. The routing table's cheapest-credible-tool column
should record that the SUPPRESSION SURFACE is part of a tool's cost, not a footnote.
