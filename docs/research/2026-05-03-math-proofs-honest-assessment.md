# Math-Proofs Honest Assessment — 2026-05-03

Scope: every formal-verification artifact in the Zeta repo,
graded explicitly A / B / C against peer-review readiness.

Attribution: synthesis doc authored by the architect on the
human maintainer's 2026-05-03 ask: *"we have math proofs (some
good quality some back, we need an honest assesment of that,
but the core DBSP i've have verified like 100times now, we are
beyond cutting edge and mathecial formally verivied just not
peer reviowed until you email someone and them to peer review
you or invite you and your team to a conference."*

Operational status: research-grade

Non-fusion disclaimer: this is a self-authored audit by the
factory, not a courier-ferry import. It synthesises four
existing in-repo audit surfaces (verification-registry.md,
proof-tool-coverage.md, verification-drift-audit-2026-04-19.md,
chain-rule-proof-log.md) into a single peer-review-readiness
view. It is not an external review; it is the input an
external reviewer would need.

---

## Grading rubric

- **A — Peer-review citable.** Machine-checked end-to-end.
  Statement matches paper / spec verbatim (or via a registry-
  documented translation). Runs in CI on every commit. Drift-
  audited within the last 5-10 rounds.

- **B — Machine-checkable but not in CI.** Spec exists; tool
  can verify it on demand; but no automated gate guarantees
  the statement remains in sync with the implementation. Any
  reviewer would ask "but does it run on every change?"

- **C — Sketch / aspirational.** A spec file exists OR a
  property test approximates the claim, but no end-to-end
  machine check ties the artifact to the production code.
  Reviewer-fragile.

The grades apply per artifact, not per tool. A given tool can
have A-grade and C-grade artifacts side-by-side.

---

## A-grade artifacts (peer-review citable today)

### A1 — DBSP chain-rule: Proposition 3.2 (Lean 4 / Mathlib)

- **Artifact:** `tools/lean4/Lean4/DbspChainRule.lean:~695`
  (`chain_rule_proposition_3_2`)
- **Source:** Budiu, Chajed, McSherry, Ryzhyk, Tannen —
  *DBSP: Automatic Incremental View Maintenance for Rich Query
  Languages*, PVLDB Vol 16(7), 2023; preprint
  `arXiv:2203.16684v1`.
- **Claim:** `(Q1 ∘ Q2)^Δ = Q1^Δ ∘ Q2^Δ` with
  `Q^Δ := D ∘ Q ∘ I`, **no LTI precondition**.
- **Verification:** `lake env lean Lean4/DbspChainRule.lean`
  zero warnings / zero errors against Mathlib `v4.30.0-rc1`.
- **Drift status:** registry row in
  `docs/research/verification-registry.md`; last audit
  2026-04-19 — no drift after the round-35 rename.
- **CI status:** Lean toolchain installed; manual run today.
  Lake-build CI job listed in `ROADMAP.md` P2 — **gap.**
- **Why A despite no CI:** the proof body uses only Mathlib
  abelian-group lemmas and `I_D_eq`; statement-level drift is
  the bug-class the round-35 audit caught and fixed (P0
  before round 35; A-grade after).
- **Publishable claim:** *"Chain rule (Prop 3.2) is machine-
  checked in Lean 4 / Mathlib."* POPL / PLDI target per
  ROADMAP.

### A2 — DBSP `Dop_LTI_commute` (Theorem 3.3 corollary, Lean 4)

- **Artifact:** `tools/lean4/Lean4/DbspChainRule.lean:~595`
  (`Dop_LTI_commute`)
- **Source:** same as A1 (Budiu et al. 2023). This is a
  corollary of Theorem 3.3 (Linear): `Q^Δ = Q` for LTI Q.
- **Claim:** `Dop (f ∘ g) s = f (Dop g s)` for linear + time-
  invariant `f, g`, with `Dop f := f - f ∘ zInv`.
- **Verification:** same Lean-build as A1.
- **Drift status:** registry row; **P0 drift caught and fixed
  round 35** — formerly named `chain_rule`, was misrepresenting
  itself as Proposition 3.2; renamed and the actual Prop 3.2
  added alongside (A1).
- **Publishable claim:** corollary, citable as supporting
  result. Not the headline.

### A3 — Z3 / SMT pointwise axioms (8 theorems)

- **Artifact:** `tools/Z3Verify/Program.fs` +
  `tests/Tests.FSharp/FormalVerificationTests.fs`
- **Verification:** runs in every `dotnet test` (skip-graceful
  if `z3` binary absent).
- **Coverage:** associativity / commutativity / additive
  identity / additive inverse / double negation / negation-
  distributes-over-+ / `distinct` idempotence / H function
  for incremental distinct.
- **CI status:** in CI via `dotnet test` (the `[<Fact>]`
  encoding).
- **Publishable claim:** *"Z-set algebra axioms are SMT-
  verified over unbounded `Int`."*

### A4 — TLA+ specs in CI (5 specs)

- **Artifacts:** `tools/tla/specs/{TwoPCSink,
  TransactionInterleaving, OperatorLifecycleRace,
  TickMonotonicity, SmokeCheck}.tla` + matching `.cfg`
- **Verification:** `tests/Tests.FSharp/TlcRunnerTests.fs`
  shells out to TLC; runs in `dotnet test`.
- **Drift status:** no registry rows yet — A-grade for the
  *spec runs* claim; would be A-grade for *spec matches paper*
  claim only after registry rows land. Currently grade-A on
  internal-correctness, grade-B on external-citation fidelity.
- **Publishable claim:** *"5 TLA+ specs model-checked in CI
  on every commit."*

---

## B-grade artifacts (machine-checkable, not in CI)

### B1 — TLA+ specs with `.cfg` but not in CI (4 specs)

- **Artifacts:** `tools/tla/specs/{DbspSpec, SpineAsyncProtocol,
  CircuitRegistration, SpineMergeInvariants}.tla`
- **Status:** runnable today via TLC manually. Deliberately
  skipped pending re-verification pass per
  `proof-tool-coverage.md` §2.
- **Path to A:** add the four specs to `TlcRunnerTests.fs`
  invocation set after a round of re-verification.
- **Effort:** ~2 days per `proof-tool-coverage.md` budget.

### B2 — Alloy LSM-spine spec

- **Artifact:** `tools/alloy/specs/Spine.als`
- **Status:** checks LSM size-doubling invariant + batch-
  level-ownership over bound 4 batches × 4 levels.
  `tools/setup/install.sh` downloads `alloy.jar` but no CI job
  runs it.
- **TECH-RADAR:** rated **Assess**.
- **Path to A:** add a CI hook mirroring `TlcRunnerTests.fs`
  but shelling to `java -jar alloy.jar`.
- **Effort:** ~0.5 day.

### B3 — Stryker.NET mutation testing

- **Artifact:** `stryker-config.json` exists.
- **Status:** configured, **never run in CI**, no published
  kill-rate. Whether the 471 tests survive a realistic mutant
  set is unknown.
- **Path to A:** add CI job; publish HTML report to GitHub
  Pages or a release artifact; track kill-rate as a metric.
- **Effort:** ~1 day.

### B4 — Semgrep pattern rules (14+ rules) → **A-grade (verified post-assessment)**

- **Artifact:** `.semgrep.yml`
- **Status correction (2026-05-03 verify-then-claim sweep):**
  Semgrep is ALREADY in CI via `.github/workflows/gate.yml`
  job `lint (semgrep)` (line ~422 in gate.yml). The original
  B4 grading was incorrect — verified by grep against
  `.github/workflows/gate.yml`. The job runs every rule via
  `semgrep --config .semgrep.yml --error --metrics=off`
  with hard-fail on any match.
- **Effective grade: A.** No work owed; the assessment's
  outstanding-work matrix originally listed "Semgrep CI"
  as a P1 item but that item is already complete. This
  illustrates the verify-then-claim discipline (check actual
  CI workflow before grading).

---

## C-grade artifacts (sketch / aspirational)

### C1 — TLA+ specs without `.cfg` (4 specs)

- **Artifacts:** `tools/tla/specs/{ChaosEnvDeterminism,
  ConsistentHashRebalance, DictionaryStripedCAS,
  AsyncStreamEnumerator}.tla`
- **Status:** specs exist but no `.cfg` means TLC cannot run
  them. They are documentation-as-pseudocode at this stage,
  not model-checked artifacts.
- **Path to B:** author the `.cfg` (model + invariants); the
  spec text is already there.
- **Effort:** ~0.5 day per spec.

### C2 — Code paths without TLA+ models

- **Surfaces:** `src/Core/Recursive.fs` (semi-naïve LFP
  fixpoint convergence), `src/Core/SpineAsync.fs` graceful-
  drain-on-stop, `src/Core/WorkStealingRuntime.fs` (TPL-
  dataflow scheduler), `src/Core/MailboxRuntime.fs`,
  `src/Core/Durability.fs` (WDC protocol — TECH-RADAR Assess),
  `src/Core/Hierarchy.fs` (closure-table recursive-join
  retraction-native fixpoint).
- **Status:** correctness claims live in code comments, prose,
  property tests. No formal model.
- **Path to B:** author `.tla` + `.cfg`; verify locally.
- **Effort:** 2-5 days per surface, depending on protocol
  depth.

### C3 — FsCheck properties on algebras without proofs

- **Surfaces:** `Crdt.fs` PN-Counter / OR-Set / LWW-Register
  (only G-Counter has the three semilattice properties
  tested), `DeltaCrdt.fs` anti-entropy merge laws,
  `Residuated.fs` Galois-connection axiom, `Recursive.fs`
  fixpoint monotonicity, Merkle-tree collision-freedom,
  watermark monotonicity, SpeculativeWatermark retraction-
  native correctness, `NovelMath.fs` KLL quantile ε-bound.
- **Status:** algebras carry laws but no property tests
  encode them. Reviewer-fragile.
- **Path to B:** add ~15 FsCheck properties.
- **Effort:** ~3 days for the full set.

### C4 — `chain_rule_poly` (genuine three-group bilinear chain rule)

- **Status:** future-round target per
  `chain-rule-proof-log.md`. The current Lean proofs (A1, A2)
  are over endomorphisms (single group); the polymorphic form
  over three distinct groups is the genuine bilinear chain
  rule.
- **Effort:** unknown — paper-grade research item.

---

## Cross-cutting claims (status)

### "Core DBSP is verified" (the human maintainer 2026-05-03)

- **What's verified at A-grade:** Proposition 3.2 (chain rule)
  + Theorem 3.3 corollary + 8 Z-set algebra axioms over
  unbounded `Int` + 5 TLA+ specs covering distributed-protocol
  liveness / safety in CI.
- **What's adjacent:** ~32 FsCheck properties covering Z-set
  algebra, tropical semiring, G-Counter, serializer round-
  trip, Beam retraction modes, chain-rule pipeline. These are
  rigorous finite-sample evidence, not formal proofs — but
  they catch bug-classes formal proofs miss (concurrency
  schedules, real-world boundary cases).
- **What's NOT verified:** the C-grade list above
  (semi-naïve LFP, runtime schedulers, WDC durability,
  hierarchical retraction-native fixpoint).

The maintainer's claim *"core DBSP I've verified ~100 times"*
is consistent with this assessment for the chain-rule + Z-set
axiom + LTI-commutation core. The "~100 times" likely refers
to repeated property-test runs + Lean rebuild + manual TLC
runs across rounds — the kind of repeated-verification habit
that makes A-grade artifacts trustworthy. The B-and-C grade
list shows where that habit hasn't yet reached.

### "Beyond cutting edge, formally verified just not peer reviewed"

This assessment supports the claim *with caveat*. A-grade
artifacts ARE machine-checked formal proofs; the gap is
peer-review citation, not technical correctness. To take this
to publishable form:

1. **Lean proof CI job** — close the A1 / A2 gap. *"Runs in
   CI"* is the line a reviewer expects. Effort: 1 day.

2. **Registry rows for TLA+ specs** — A4 specs have *internal*
   correctness in CI; *external-citation fidelity* requires
   registry rows mapping each spec to its source paper /
   protocol-design reference. Effort: 1 day for the 5 in-CI
   specs.

3. **POPL / PLDI / OOPSLA paper** — chain-rule + Z-set
   axiom + retraction-native LFP semantics is a publishable
   contribution. Per `proof-tool-coverage.md`, this target was
   set after the round-35 Lean closure. Effort: paper-grade
   write-up time, separate from the verification work.

4. **External peer reviewer** — POPL Program Committee, PLDI
   Artifact Evaluation Committee, IEEE CSF, FMCAD, CAV.
   Outreach is administrative — draft an email + send to
   author contacts (Budiu / Tannen / McSherry are obvious
   candidates given the DBSP paper authorship). Effort: 1-2
   hours drafting.

---

## Outstanding-work matrix (post-this-assessment, with status updates 2026-05-03 EOD)

| Work item | Grade upgrade | Effort | Priority | Status |
|---|---|---|---|---|
| Lean lake-build CI job | A1, A2 → A-with-CI | 1 day | P0 | **Done (PR #1394, 2026-05-03 — `.github/workflows/lean-proof.yml` shipped; runs on `tools/lean4/**` changes; `lake exe cache get` for Mathlib oleans + `lake env lean` type-check)** |
| Stryker CI + kill-rate publish | B3 → A | 1 day | P0 | **Done (PR #1395 fixed `stryker-config.json` paths; this PR adds `.github/workflows/stryker-mutation.yml` with src/Core/** path-filter trigger, threshold-break gate at 50%, and HTML+json reports uploaded as 90-day artifacts — kill-rate metric verifiable from every CI run page)** |
| Semgrep CI | B4 → A | 0.5 day | P1 | **Already done (verify-then-claim correction; see B4 section)** |
| 4 deferred TLA+ specs into CI | B1 → A | 2 days | P1 | **Done (4 of 4): DbspSpec ✓ #1397; CircuitRegistration ✓ #1401 (081KQNJ500008QG0R0001QHA1J Safety operator); SpineAsyncProtocol ✓ #1411 (081KQNJ500008QG0R000S68KDE CHECK_DEADLOCK FALSE for bounded-protocol terminal state); SpineMergeInvariants ✓ this PR (081KQNJ500008QG0R003DMVGZB Cascade downstream-room precondition + state constraint + WF on Cascade)** |
| Alloy CI hook | B2 → A | 0.5 day | P1 | **Done (PR #1396, 2026-05-03 — `tests/Tests.FSharp/Formal/Alloy.Runner.Tests.fs` spec-path fixed; Spine + InfoTheoreticSharder specs now actually validate, not silent-no-op)** |
| `.cfg` for 4 C1 specs | C1 → B | 2 days | P2 | **Partial (1 of 4): ChaosEnvDeterminism ✓ this PR (cfg + atomized DelayCritical so Atomic invariant holds across the splitMix+AdvanceTime critical section; 2043 distinct states / depth 26). Remaining 3: ConsistentHashRebalance + DictionaryStripedCAS + AsyncStreamEnumerator (each needs more than just a cfg — structural spec issues)** |
| TLA+ spec for `Recursive.fs` LFP | C2 → B | 2-3 days | P2 | open |
| TLA+ spec for WDC protocol | C2 → B | 3-5 days | P1 | open |
| 15 FsCheck properties (C3) | C3 → B | 3 days | P2 | **Partial (3 of 15): PN-counter merge commutative + idempotent + associative ✓ this PR (mirrors G-counter pattern in `Math.Invariants.Tests.fs`). Remaining ~12 properties: OR-Set + LWW-Register + DeltaCrdt + Residuated lattice + Recursive fixpoint + Merkle + Watermark + KLL** |
| `chain_rule_poly` (3-group) | C4 → A | research | P3 | open |
| Registry rows for A4 specs | external-fidelity claim | 1 day | P0 | **Done (PR #1393, 2026-05-03)** |
| Peer-review email draft | publishability | 2 hours | P0 | **Done (PR #1387, 2026-05-03)** |
| Phase 0 PoC (substrate-discovery toolchain) | substrate-discovery | 2-3 ticks | (sibling) | **Done (PR #1392, 2026-05-03 — 4.0 MB single AOT binary on osx-arm64; full IVM tick path validates; cross-platform CI matrix runs)** |
| 3 broken-spec follow-ups (081KQNJ500008QG0R000S68KDE + 081KQNJ500008QG0R0001QHA1J + 081KQNJ500008QG0R003DMVGZB) | spec-fix tracking | varies | P2/P1 | **All 3 closed: 081KQNJ500008QG0R0001QHA1J ✓ #1401 (Safety operator); 081KQNJ500008QG0R000S68KDE ✓ #1411 (CHECK_DEADLOCK FALSE); 081KQNJ500008QG0R003DMVGZB ✓ this PR (Cascade downstream-room precondition; promoted P2→P1 — same author-time class as 081KQNJ500008QG0R001N1AAJ9 Spine.als under-specified action)** |
| `.ts/.sh` parity bug in `tools/backlog/generate-index.ts` | substrate-tooling-debt | <1 day | P2 | **Done (PR #1400, 2026-05-03 — both generators now byte-identical)** |

**Net P0 progress:** Lean CI ✓, A4 registry rows ✓, peer-review email ✓, Stryker B3 ✓ (4 of 4 P0 items closed).

**Net P1 progress:** Alloy B2 ✓, Semgrep B4 ✓ (correction), B1 ✓ (all 4 deferred TLA+ specs in CI). WDC protocol spec + Recursive.fs LFP spec remain open (substantial multi-day each).

---

## Recommendation

**Short-term (next 1-2 weeks):**

1. Land the Lean lake-build CI job. This is the single
   highest-leverage upgrade — it converts A1 + A2 from "A-
   grade today, hand-run" to "A-grade-with-CI" — the form
   reviewers expect.
2. Land Stryker.NET CI + Semgrep CI. Both are 0.5-1 day each;
   they retire B3 + B4 and produce a publishable mutation
   kill-rate metric.
3. Author registry rows for the 5 in-CI TLA+ specs. Closes
   the external-citation-fidelity gap on A4.
4. Draft the peer-review email. Two hours of writing; gates
   nothing else; you decide who to send to.

**Medium-term (next 1-2 months):**

5. Author `.cfg` for the 4 C1 specs (spec text already
   exists).
6. Author TLA+ specs for `Recursive.fs` LFP and WDC protocol
   — the two highest-leverage C2 surfaces.
7. Expand FsCheck property set per C3 list.

**Long-term (research):**

8. `chain_rule_poly` over three distinct groups — genuine
   bilinear chain rule. Paper-grade research item.
9. F* extraction-to-F# trial for refinement-type bugs (per
   `proof-tool-coverage.md` §7 #2 successor path).

This assessment can be re-graded after each work item lands.
The dated filename convention preserves snapshots for trend
analysis.

---

## Composes with

- `docs/research/verification-registry.md` — per-artifact
  registry rows (ground truth)
- `docs/research/proof-tool-coverage.md` — per-tool coverage
  + expansion plan
- `docs/research/verification-drift-audit-2026-04-19.md` —
  round-35 audit (the audit cadence)
- `docs/research/chain-rule-proof-log.md` — chain-rule-
  specific proof history
- `docs/ROADMAP.md` P2 row — Lean 4 chain-rule with Mathlib
  (closed; CI gap remaining)
- `docs/TECH-RADAR.md` — Adopt / Trial / Assess / Hold
  classification per tool
- `.claude/skills/verification-drift-auditor/SKILL.md` — the
  audit skill that produces these grades

## Audit trail

- Assessment doc authored: 2026-05-03
- Triggered by: human maintainer 2026-05-03 ask for honest
  assessment + peer-review readiness map
- Next re-grade: opportunistic when work-items land; full
  re-sweep cadenced every 5-10 rounds per
  `verification-drift-auditor` skill
