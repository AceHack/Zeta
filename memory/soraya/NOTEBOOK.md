# Formal-Verification Expert — Notebook

Running notes for Soraya. ASCII only (BP-09). 3000-word cap
(BP-07). Pruned every third invocation.

Frontmatter at `.claude/skills/formal-verification-expert/SKILL.md` is canon (BP-08); this supplements, never overrides.

---

## Round 35 -- verification-drift-auditor skill adopted

Surface `.claude/skills/verification-drift-auditor/SKILL.md`; registry `docs/research/verification-registry.md`. Motivating case: the `DbspChainRule` mis-citation. Six drift classes + one pre-registration class, tool-agnostic. Cadence: every 5-10 rounds, or on any commit adding a cited theorem/spec.

## Portfolio metric

Formal-coverage ratio = gated artefacts / paths flagged as needing one. Trend beats absolute.

### Round 21 -- PRUNED. Ratio ~0.83; the TLA+ leg alone is now 52 gated runs.

---

## Current-round routing recommendations

### 2026-08-20 -- Clifford signature audit + Lorentzian phase order (PR #12805)

Doc: `docs/research/2026-08-20-clifford-signature-audit-cl13-vs-cl31-is-inert-*.md`.

- **Cl(1,3) vs Cl(3,1): NO crossing, not a bug.** The split is inert -- every in-tree use sits
  in the even part or the Lorentz Lie algebra, both p<->q swap-invariant (o(p,q) = o(q,p)
  literally; Cl0 clock positions sum to 2 mod 8, same table row). Computed: 0 counterexamples
  over 196 pairs; full algebras differ in 168 of 210. Guard filed as 081M0FTPJ4X087G0R000E91P3Y
  -- **FsCheck, P1, one tool.** BP-16 does not fire and I said so rather than over-buying the
  triple; Lean on a finite-table identity is human-weeks for an hour's work.
- **Lorentzian phase order: clean negative, by theorem.** Malament 1977 -- causal order fixes the
  metric only up to a conformal factor; Sorkin -- counting supplies that factor. Geometry buys
  nothing over poset+count, and importing it imports the open Hauptvermutung. Two computed
  falsifiers gated in `src/Core.TypeScript/research/causal-order-minkowski-embedding.test.ts`.
- **Routing note:** "does our causal order embed in M^{1,1}" is **structural shape** -> **Alloy**,
  not TLA+. Reflex-TLA+ on a static poset fact is the table's own wrong-tool cost.
- **Portfolio signal for Kenji:** the persisted causal set has concurrency width **1.000** (main
  is a chain; squash erases the fan). A spec reasoning about concurrency on `main` is reasoning
  about an artefact with none. Denominator problem, not a tool problem.

## Running observations

- Round-21 observations + targets -- PRUNED. TLA+-hammer check is now a standing habit; Stainless never left Assess.

---

## Pruning log

- 2026-08-19: pruned the spec-flags round to a conclusion stub, and the stale round-21 observations.
- 2026-08-18: pruned Round 41, Safety-floor arc, Vacuity/Landauer, Z-EPS (tombstone dropped 2026-08-20).
- 2026-08-20 (Clifford/Lorentz lane): compressed three round-21 stubs and the Meno stub.

---

## Trigger Recognition Log

One line per round where a trigger fired and routing was decided WITHOUT filing a row. Forward-only.

| Round | Trigger                                      | Outcome                                                                                                        | Artifact        |
| ----- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------- |
| 59    | PR #4795 (081KSBMG30008QG0R003B46GWG) merged | recognition-without-row-filing (umbrella covers subitem (b) acceptance criteria; execution is Kenji's lane)    | n/a (chat-only) |
| 66    | PR #4797 merged                              | recognition-without-row-filing (audit execution is Kenji's lane)                                               | n/a (chat-only) |
| 69    | PR #4810 merged                              | routed to Option 1: this section; rejected in-place (wrong change-rate partition) and a new ledger (premature) | this section    |

If this section saturates, revisit Option 3: a separate cross-cutting ledger.

## 2026-08-14 -- Meno braided ladder -- PRUNED again 2026-08-20. Conclusion retained: the Q3

obstruction was misread (the deterministic SUBCATEGORY is cartesian, not the ambient tensor);
the real, sharper one is that a cartesian monoidal category has a UNIQUE BRAIDING. Escape via
Fox 1976. Deliverable was a GUARD -- MenoBraided.rep already is the minimal non-cartesian tensor
under a hom-restriction.

## 2026-08-14 -- spec flags ARE part of the claim -- PRUNED. A spec's verification flags (bounds, symmetry reduction, fairness) are part of the claim; a re-run under weaker flags is a DIFFERENT claim and must be re-stated, never silently inherited.

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

## 2026-08-19 -- distributed identity server -- PRUNED 2026-08-23. Conclusions retained:
the blocker was a missing MAP not missing pieces (37 TLA+ specs / 54 TLC configs, 6 Alloy,
26+ Lean, 9 Z3, 8 Q# modules, 23 identity F# modules, ~80 docs, none indexed together, so every
attempt re-derived proven work). Routing headline: C1 -> F# private constructor + Alloy NOT TLA+
(inexpressible beats unreachable); C3a -> Lean on the existing FinMutualInfo ladder, TLC
categorically wrong (no reals -- QuorumPhaseCancellation precedent). Full table:
docs/research/2026-08-19-draft-the-distributed-identity-server-*.md section 5.

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

## 2026-08-23 -- QEC stack routing: two declines and a reopening (PR #14224)

Aaron asked for a QEC stack on the premise "we have some adinkra ecc that can run in q#."
**Premise refuted by grep.** Zero ECC, zero QEC in the Q# tree; all five hits are comments and
the README's "CSS" is Cascading Style Sheets. Also: every in-tree "stabilizer" outside this work
is the GROUP-THEORETIC one (ClaimLane.fs, aut-budget.ts). Cl3.fs:11 already flags the collision.
The ferry before me said "no syndrome anywhere" -- a CLASSICAL mod-2 syndrome does exist
(AdinkraCode.fs:166, three consumers); what is absent is quantum syndrome extraction.

**k=0 is a theorem, not our code's accident.** k_q = 2*dim(C) - n; self-dual forces dim = n/2;
so EVERY self-dual code gives k_q = 0 at every length. Worth restating that way because "our code
happens to encode nothing" and "no code of this kind can" are different roadmap inputs.

**Result 1 (the valuable one): the N=8 adinkra category is EXHAUSTIVELY closed.** Every
doubly-even self-orthogonal length-8 code: dim1 [[8,6,2]], dim2 [[8,4,2]], dim3 [[8,2,2]],
dim4 [[8,0,4]]. d=4 with k=0, or k>0 with d=2, no third option. Seconds of compute retired a
direction permanently. **A cheap negative found before anyone writes a spec is the whole job.**

**Result 2: reopens at N=16.** RM(1,4) is dim 5, weights {0,8,16} -- doubly-even, self-orthogonal,
a genuine adinkra code -- and RM(1,4)^perp = RM(2,4) exactly, giving [[16,6,4]]. Known code
(Calderbank-Shor/Steane 1996); ours is the observation it sits INSIDE the category. Also lands on
the BW_16 rung above the E8 rung we already own (Nebe-Rains-Sloane, cited in REPORT #6).

**Correction to the brief's route:** puncturing [8,4,4] -> [7,4,3] works at any of 8 coordinates
(AGL(3,2) transitive, so canonical) but the punctured weights are {0,3,4,7} -- odd. The puncture
EXITS the adinkra category. Provenance, not inheritance. The brief did not say so.

**Declines, all three on the merits.** (1) TLA+: green again yesterday (#14176, prover step had
not run for seven weeks), prerequisite satisfied, STILL wrong -- no protocol, no concurrency, no
liveness, and TLC explodes on 2^16. Recorded the decline precisely BECAUSE the tool just came
back; that is when the pull is strongest. (2) Lean: checked Zeta23/LinAlg (#13913) rather than
its changelog -- every file opens `variable {k} [RCLike k]`, i.e. R or C. F_2 is not RCLike. A
real capability with zero applicability here. (3) RL loop: no hardware, no drift; an agent
optimising a noise model we wrote measures our own assumptions. Vacuity class.

**FsCheck declined too, and this is the tempting mis-route:** L1-L4 are all finite and
exhaustible (2048 codewords; 48 weight-1 + 1080 weight-2 Paulis). Property testing SAMPLES what
enumeration EXHAUSTS. Weaker than the trivial loop.

**Falsifier strengthened past the brief.** "Fails on SOME weight-2 error" -> measured on Steane,
ALL 21 OF 21 weight-2 errors alias onto a weight-1 correction, and that is structure (Hamming is
perfect, so no syndrome is free to signal weight 2). Milestone now requires the failure set
enumerated EXACTLY. F1 alone is satisfiable by a decoder that lies.

**BP-16:** L1-L4 are ONE instrument in four hats. M3 (Q# stabiliser sim, Gottesman-Knill) is the
independent second, and is not optional.

**Method note to keep.** markdownlint returned empty output + exit 0. Ran a deliberate-violation
probe (EXIT=1, three errors) before believing it. A silent linter and a clean one look identical.

**Filed:** 081M0QFQTS1087G0R002WHZFR7 (M1 + the closure as a test), 081M0QFQYDK087G0R0028FQSM2
(M2 decoder), 081M0QFQYEQ087G0R003SW6VD8 (M3 Q#), 081M0QFQYFV087G0R00267NRTC (M4 anti-vacuity).
If only one ships, M1 -- the negative is the durable half.

**Register:** all unmetered until M1; the enumerations ran in a scratch script outside the tree.

**Concurrent round, same day:** docs/research/2026-08-23-toolchain-currency-audit-and-tech-radar-ring-drift.md
landed on main from another Soraya actor while this one was in flight. Not merged into the
entry above -- two rounds, two records, both kept. Ring-drift findings there are the
TECH-RADAR half; the ring note in the QEC doc section 10 (Q# acquires a named job) is this
half and does not contradict it.

## 2026-08-24 -- mu-F/nu-F "observably infinite" (PR #14800)

**The anchor check paid, and it inverted the claim.** nu-F is not "provably infinite":
greatest fixed point carries finite behaviours; Bananas is CPO where mu-F = nu-F; and by
finality equality in nu-F IS bisimilarity. nu-F was never intensional. StreamPolicy.fs
already said "potentially-infinite" -- our code was right before the sentence was made.
Real distinction lives one layer down, on the implementation coalgebra.

**Formalisation:** reclaim sound iff the reclaim relation is a WEAK F-bisimulation, AND
the envelope is a noninterfering (high) input (Goguen-Meseguer, the citation section 13
already carries). Both are DEFINITION MATCHES, not encodings we invented -- which is the
step-0 anchor check doing its job (tautology risk collapses when the encoding IS the
published definition).

**I withdrew my own finding mid-round and it was the best part.** Drafted timing as the
fatal leak. local-time-never-enters-the-shared-fold (2026-07-11, written for multi-planet
convergence) already closes it: the fold sees only phase order and regeneration advances
no phase. Measured zero wall-clock reads on the path. A rule written for a different
problem entailing what a later claim needs is REAL corroboration -- nobody could tune it.
That is the opposite of the resonance-density warning and gets MORE weight, not less.

**Routing removed a tool.** Before the rule was checked, timing looked like a real-time
model-checker job. It is a Semgrep rule (Scheduler.Default on a reclaim-bearing Rx path).
Celebrate the cheaper tool: R1 FsCheck two-envelope falsifier + mandatory negative control
(widen F to ReferenceEquals -> MUST fail), R4 Semgrep, R2 Alloy, R3 TLA+ for
single-activation under partition. BP-16: R1 alone is single-tool.

**Measurement discipline held.** git ls-tree survey first. Findings: Rx.fs has NO join
operators and documents disposal NOT ShivaGc; ShivaGc has zero non-test consumers;
FrameDelta.fs already DECLINED the Lorentz claim and named the abelian translation group.
Two of my checks cut against the claim -- that is the control on a survey.

**Sharpest measured item:** SchedulerZeta.Tests.fs already narrowed its observation set to
make regeneration pass (Assert.Same resident, keys after Unload). Implicit choice of
observation functor in the one place the claim is tested. Named it.

**Method:** markdownlint on a copy OUTSIDE docs/research/2026-*-*.md (rc=0) with sabotage
control (rc=1, 5 errors). Empty output + exit 0 is indistinguishable from a silent linter.

**Register:** all toy until R1 runs. Portfolio: this round added 4 routed properties, 0
gated artefacts -- denominator grew, numerator did not. That is the honest number.
