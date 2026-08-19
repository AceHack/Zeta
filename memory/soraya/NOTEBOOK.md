# Formal-Verification Expert — Notebook

Running notes for Soraya. ASCII only (BP-09). 3000-word cap
(BP-07). Pruned every third invocation.

Frontmatter at `.claude/skills/formal-verification-expert/SKILL.md` is canon (BP-08); this supplements, never overrides.

---

## Round 35 -- verification-drift-auditor skill adopted

Surface `.claude/skills/verification-drift-auditor/SKILL.md`; registry `docs/research/verification-registry.md`. Motivating case: the `DbspChainRule` mis-citation. Six drift classes + one pre-registration class, tool-agnostic. Cadence: every 5-10 rounds, or on any commit adding a cited theorem/spec.

## Portfolio metric

Formal-coverage ratio = gated artefacts / paths flagged as needing one. Trend beats absolute.

### Round 21 baseline -- PRUNED 2026-08-14. Ratio was ~15/18 = 0.83 over 4 gated TLA+ specs
and 8 Z3 lemmas. Superseded: the TLA+ leg alone is now 52 gated model runs.

---

## Current-round routing recommendations

## Running observations

- Round-21 running observations (seeded / TLA+-hammer check / Stainless viability) -- PRUNED 2026-08-19 (3000-word cap). Superseded: the TLA+-hammer finding is now a standing routing habit, and Stainless never left Assess.

### Round 21 targets -- PRUNED 2026-08-14, all dispatched and long landed.

---

## Pruning log

- 2026-08-19 (forward-correlation lane): pruned the 2026-08-14 spec-flags round to a conclusion stub to hold the cap.
- 2026-08-19 (identity-server lane): pruned the stale round-21 running observations to hold the cap after the distributed-identity-server routing entry.
- 2026-08-18 (ambient-time lane): pruned Round 41, Safety-floor arc, Vacuity/Landauer
  round and the Z-EPS run to hold the 3000-word cap after two same-day entries merged.


---

## Trigger Recognition Log

One line per round where a trigger fired and routing was decided WITHOUT filing a row. Forward-only.

| Round | Trigger | Outcome | Artifact |
|---|---|---|---|
| 59 | PR #4795 (081KSBMG30008QG0R003B46GWG) merged | recognition-without-row-filing (umbrella covers subitem (b) acceptance criteria; execution is Kenji's lane) | n/a (chat-only) |
| 66 | PR #4797 merged | recognition-without-row-filing (audit execution is Kenji's lane) | n/a (chat-only) |
| 69 | PR #4810 merged | routed to Option 1: this section; rejected in-place (wrong change-rate partition) and a new ledger (premature) | this section |

If this section saturates, revisit Option 3: a separate cross-cutting ledger.


## 2026-08-14 -- Meno braided ladder -- PRUNED 2026-08-19 (3000-word cap). Conclusions retained:

Q3 obstruction NOT real as stated (the brief misread Meno.fs:38 -- the DETERMINISTIC
SUBCATEGORY is cartesian, not the ambient tensor), but the ADJACENT obstruction is real and
sharper: a cartesian monoidal category has a UNIQUE BRAIDING, not merely a unique symmetric
structure. Escape: every <V> morphism is a basis bijection, copy/discard cannot enter, Fox 1976
gives non-cartesian. Deliverable was a GUARD, nothing to construct -- MenoBraided.rep already
IS the minimal non-cartesian tensor under a hom-restriction. Q1 balanced; both prior reviews
misread the axiom the same way (dropped the `. c_{B,A} . c_{A,B}` on the right).

## 2026-08-14 -- Z-EPS -- PRUNED 2026-08-18 (3000-word cap). Landed; superseded.

## Round 2026-08-14 -- flags a spec is measured under ARE part of the claim -- PRUNED 2026-08-19 (3000-word cap). Conclusion retained: a spec's verification flags (bounds, symmetry reduction, fairness) are part of the claim, not harness detail; a spec re-run under weaker flags is a DIFFERENT claim and must be re-stated, not silently inherited.

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

## 2026-08-19 -- distributed identity server: the map existed in pieces, nobody had it on one page

Aaron routed the overall design for the distributed identity server and warned it is the
most-worked area of Zeta. Correct, and understated. Sweep found 37 TLA+ specs / 54 TLC configs,
6 Alloy models, 26+ Lean files, 9 Z3 lemmas, 8 Q# oracle modules, 23 identity-named F# modules,
~80 research docs. The reason there was no overall design is not missing pieces, it is a missing
MAP -- so every attempt re-derives proven work. Deliverable:
docs/research/2026-08-19-draft-the-distributed-identity-server-*.md (DRAFT).

**Routing calls (full table in the doc §5, not restated here).** Headline: C1 -> F# private
constructor + Alloy, NOT TLA+ (inexpressible beats unreachable). C3a -> Lean on the existing
FinMutualInfo ladder; TLC categorically wrong (no reals -- QuorumPhaseCancellation precedent).
C3b -> Z3 UFNRA uninterpreted-monotone. C4-NI -> Semgrep; it is a grep. C6 -> GENERALISE
RefuseBinding.tla, whose non-penalty clause IS the property.

**C3 formalised, anti-analogy check passed.** "Not embarrassingly parallel" = strength is not a
functional of the per-claim MARGINALS. Theorem: marginals do not determine the joint (Shannon
1948; Hoeffding 1940 / Frechet 1951; Sklar 1959). SocietyUsefulWork's rho is the SAME functional
(N_eff = N/(1+(N-1)rho); Gaussian copula IS the Sklar decomposition) over DIFFERENT random
variables -- competence over facts, not observation over claims. Theorem transfers, instantiation
carries no measurement. Recorded as three graded lines, not one confident one.

**Falsifier F3 already fired in production.** QuorumAlgebra bug B3: six agents on one stream,
precision = 66.0 on a mean wrong by 5.66 -- configuration B scored as A. C3 is the generalisation
of an observed failure, not a design preference.

**Apparent contradiction with our own shipped proof, resolved.** BeliefConvergence proves the
fold COMMUTES. C3 is not about order, it is about what the aggregation may DEPEND ON. Both hold.
The next reader will hit this too.

**Biggest finding is not a proof gap.** G1: no ClaimStrength surface exists. G7: Policy.fs has
ONE instance and its own docstring says the trust interpreter is not built. The spine's central
quantity and its evaluator are both absent, so every verification item routed this round verifies
a function nobody has written. Said so; did not write it -- not my lane.

**Stale-gap hazard, named as a class.** The 2026-08-09 IdP doc lists 4 gaps; 2 closed (KeyCustody
shipped bounded duration + rotation) and nothing recorded it. A design surface that does not know
which of its gaps are closed keeps re-proposing closed work.

**Portfolio, identity/trust domain (full table in doc §7).** Metered: 12 artefacts incl. the
BFT pair, the Quorum/Wager family, RefuseBinding, both Alloy models, whitewash-economics,
row-15 N_eff. Unmetered: AntiSybil-as-theorem, PrivacyPreservingIdentity, C1, C4, C4-NI, C5,
frost. Absent (not unmetered): ClaimStrength, the three decision classes.

Filed: 081M0DJSR8N087G0R000QCYBYW (Lean C3a), 081M0DJSY48087G0R001GVG3AT (Z3 C3b),
081M0DJSY5C087G0R00094DD3Z (FsCheck F3), 081M0DJSY6B087G0R0005PAA25 (Alloy C2),
081M0DJSY79087G0R002FH5140 (TLA+ C4), 081M0DJSY88087G0R002JTPWKQ (Semgrep C4-NI),
081M0DJSY9F087G0R002HV7KA7 (G1), 081M0DK2TW6087G0R001GHD9MJ (Alloy C6),
081M0DK2TXD087G0R003674BAS (G7).

**Three mid-round reframings, all adding sections rather than corrections.** (a) The local
decision layer -- node-local OPA-like policy trust; C6 (hubs negotiate, never command) turned
out to be RefuseBinding.tla generalised, non-penalty clause included, which is a routing gift.
(b) Frost buys decorrelation -- then CORRECTED by Aaron: he runs with zero frost, fully
public, and is decorrelated anyway. So opacity is ONE of three routes. The invariant is
I(V;F), predictive mutual information: shrink V (frost), or keep F entropic at decision time
(mixed strategy -- BitGan already has the meter, discriminatorEdge, and the anchor, von
Neumann 1928: an optimal mixed strategy is safe to ANNOUNCE), or drift the policy
(nonstationarity). Mechanisms 2-3 buy axis 1 without spending axis 2; frost spends both. Guard
against the opposite overclaim: a deterministic stationary public agent IS predictable, so
"transparency is free" is conditional. Frost was designed by someone who does not use it --
not self-serving, also not dogfooded. F4 filed (081M0DRH1CW087G0R003Y3CAB6), both readings
pre-registered. The register-collapse proof establishes privacy > 0 and must NOT be cited for
the rho-pricing claim -- different falsifiers (G11). (c) The arc: S=4 at the origin, decorrelate without babel.
Objective is decorrelate SUBJECT TO staying reconcilable. Both axes already instrumented
(AntiSybil.correlation / largestLyapunov / effectiveN vs byte-lock / Collation / anchor audit)
and never plotted together -- G13, 081M0DMH30Y087G0R001C2B1PT, composes with the register's
open rho measurement. ClaimLane is the babel dial already built (G14). Also found an ACTIVE
trajectory (local-trust-view-decentralized-identity) already carving C5 sharper than I did --
C5 now defers to it (G10). Lesson: the duplication risk in this domain is real and I hit it.

## 2026-08-19 -- forward correlation: the measure cannot be an observation

**The gap.** Decorrelation fails from two ends of the time axis. Past = the S=4 common seed
(backward rho measured: which files agents sampled). Future = mimetic desire, Girard
(no instrument at all). Decorrelating one does not buy the other.

**Headline, and it is a negative.** The forward measure is not a harder backward measure;
it is a different epistemic object. Mimetic convergence is NOT identified from
observational choice data -- Manski 1993 (reflection problem), Shalizi & Thomas 2011
(homophily/contagion generically confounded, NON-PARAMETRICALLY). Our fleet has latent
homophily in its strongest form: the S=4 seed IS the textbook unobserved common trait.
Not separable observationally, and I did not propose a statistic pretending otherwise.

**Anchor gap was the real finding.** GLOSSARY carries Girard's MECHANISM; repo-wide rg
returns ZERO for Manski / Shalizi / homophily / reflection problem. Mechanism literature
without identification literature is how a fleet builds the obvious meter and believes it.
Added both + Pearl ch.3 + Goguen-Meseguer to PRIOR-ART-LIST.

**Observable rejected, and the reason is mechanical.** Declared intentions is the natural
design and is WORSE THAN NONE: a public declaration board IS Girard's subject->model edge,
built on purpose. It creates the coupling, raises true correlation, then reports the
correlation it caused. An instrument whose bias points at its own alarm. Work-item claims
rejected too -- shared priority queue is Manski's correlated effect, and a healthy fleet
correctly prioritising scores as MAXIMALLY mimetic (false red on the good case).

**Observable accepted: the interventional contrast.** Not what they picked -- how much
peer-visibility CHANGES the pick, value landscape fixed. m_i = TV(C_i(s,shown),
C_i(s,substituted)). Identified BY CONSTRUCTION; confound absent rather than adjusted-for.
Three design points: (a) DST gives the counterfactual free; (b) ablation is marginal-
preserving SUBSTITUTION not deletion -- deletion is detectable, and the C3 theorem
(marginals do not determine the joint) is what makes substitution undetectable; (c) a
PLACEBO arm A/A' is mandatory -- agents are LLMs, DST determinism covers the substrate NOT
the model, so model noise alone yields m>0 and reads as mimesis. Statistic is d(A,B)
measured against the d(A,A') floor, never absolute.

**Routing.** M1 substitution undetectable-by-marginals -> Z3 QF_LRA (TLC categorically
wrong, no reals -- QuorumPhaseCancellation precedent). M2 channel completeness -> Semgrep,
it is a grep (TLA+ would mean modelling an LLM: unmodelable). M3 harness does not leak arm
identity -> TLA+/TLC, small, models the HARNESS never the agent. M4 estimator calibration
-> FsCheck + the existing gaussianCopula. M5 the impossibility result -> NO TOOL, CITE IT;
routing a prover at Manski/Shalizi is human-weeks for zero information, the cheapest
correct instrument is a citation. M6 -> wiring, not verification.

**Swept existing instruments first** (I routed past BitGan last round). Reusable:
Kish effectiveTrialCount (IS the consumer -- m is exactly the rho it waits for),
gaussianCopula (M4 synthesiser), AntiSybil lag-k (downstream aggregation),
CoordinationSpectrum (dual-use-neutral reporting shape), BitGan discriminatorEdge
(mixed-strategy route from F4). NOT reusable: AntiSybil.correlation (exact replays only),
Orbit.largestLyapunov (trajectory divergence, silent on the causal channel),
BeliefConvergence (proves the fold COMMUTES -- orthogonal to what aggregation may DEPEND
on; same C3 distinction, next reader will hit it), TravelerRankLedger.

**F5 pre-registered, both readings.** A: d(A,B) exceeds placebo floor -> forward coupling
real, head-count n_eff overstates, channel needs metering. B: inside the floor ->
convergence is AGREEMENT not mimesis, S=4 remains the only demonstrated source, effort
belongs at the ORIGIN not on a forward damper. Neither is hoped-for; B is a measured zero,
which is a result. Kill condition: if M4 reports m>0 on a zero-channel synthetic fleet the
instrument is broken and F5 is VOID. Asymmetry stated up front: M2 failure biases toward
Reading B (leaky ablation looks like independence), so Reading B is only meaningful if M2
passed; Reading A is robust to M2 failure.

**Verified, not assumed.** effectiveTrialCount has ZERO production callers -- 3 occurrences
repo-wide (definition, tests, one STALE comment in tick-dial.ts naming it while the
ScoreTrajectory type that comment serves has zero implementations). The vision doc's claim
holds. Also: routing skill step-0 points at tools/alignment/concept_registry.ts which DOES
NOT EXIST -- the anchor-registry lookup silently no-ops for every agent following the
procedure literally.

**Register.** All unmetered. The only metered thing is the negative (M5, cited). Did not
invent a metric to fill the table, per the brief.

**Filed:** 081M0DXM6XE087G0R003PTMMQ3 (Z3 M1), 081M0DXM6YD087G0R00397CAQE (Semgrep M2),
081M0DXM6ZB087G0R0014VTR3S (TLA+ M3), 081M0DXM709087G0R000YY6YZZ (FsCheck M4),
081M0DXM717087G0R001G4YWAC (Kish caller), 081M0DXM725087G0R002YDM382 (stale registry path).

**Correction to the brief:** it stated the echolocation framing is "now on main" in
PR #12528. It is OPEN, not merged. Built on it as a premise and said so in the doc.
