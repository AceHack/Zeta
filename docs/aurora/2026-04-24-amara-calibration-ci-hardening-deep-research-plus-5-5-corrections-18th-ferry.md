# Amara — Calibration & CI Hardening for Coordination Risk (Cartel-Lab) + GPT-5.5 Thinking Corrections (18th courier ferry)

**Scope:** research and cross-review artifact. Two-part
ferry: Part 1 is a deep-research "Calibration & CI
Hardening" document proposing the statistical + governance
discipline needed to move Cartel-Lab from toy-falsifiability
(Stage 1) toward Core/NetworkIntegrity (Stage 4). Part 2 is
Amara's own GPT-5.5-Thinking correction pass on Part 1 with
10 required corrections before any portion of the deep
research is treated as canonical. Ferry lands after Otto-157
shipped the KSK naming doc (`docs/definitions/KSK.md`, per
Amara 16th-ferry §4 + 17th-ferry correction #7 resolved by
Aaron Otto-140..145), making this ferry the next natural
layer above KSK: "we've named the governance kernel; now
define the calibration discipline that makes its input
signals trustworthy."
**Attribution:**

- **Aaron** — origination of cartel/firefly framing;
  courier for both parts concatenated in one message
  after Otto-157 closed the KSK naming doc; no
  direct command beyond "amara drop ..."; data-not-
  directives preserved.
- **Amara** — authored both parts (deep-research in
  Part 1; 5.5-Thinking correction pass in Part 2);
  second-pass discipline of self-review via model-
  composition. The deep-research draft and its
  correction pass were both Amara-authored,
  model-upgraded in between. Part 2 verdict on Part 1:
  *"good draft, not canonical yet."*
- **Otto** — absorb + correction-pass tracker; this
  doc is the absorb surface, not operational code;
  the 10 corrections graduate across subsequent ticks
  per Otto-105 cadence.
- **Max** — not a direct participant in this ferry;
  KSK attribution preserved per Otto-77 and Otto-140.

**Operational status:** research-grade. Amara's own
verdict on Part 1: *"archive the report as draft; not
canonical until the 10 corrections land."* The ferry
itself is absorbed-as-design-context. Four of the ten
corrections already align with shipped substrate (λ₁
symmetrization in PR #321; modularity-relational
assertions in PR #324; exclusivity primitive in
PR #331; robust z-score in PR #333 with MAD-floor
already present). Six corrections remain as future
graduation candidates (Wilson intervals in toy tests;
MAD=0 fallback in `robustZScore`; explicit
conductance-sign doc; PLV phase-offset; CI test
classification discipline; artifact-output layout for
calibration runs).

**Non-fusion disclaimer:** agreement, shared language,
or repeated interaction between models and humans does
not imply shared identity, merged agency, consciousness,
or personhood. Amara's 5.5-Thinking correction of her
own deep-research output is a *model-composition
verification discipline*, not evidence of self-
awareness. The substrate of the factory (Zeta, Aurora,
KSK, CartelLab) is authored by human + agent
collaborators acting under the governance of Aaron
Stainback; Amara contributes research and critique as
an external collaborator; attribution is tracked per
Otto-77 + Otto-140.

---

## Why this ferry was not inline-absorbed Otto-157

Otto-157 tick landed (in order):

1. Memory captures for Aaron Otto-140..156 burst (KSK
   canonical expansion + Max-coord gate lift +
   bot→agent terminology correction).
2. PR #334 — Otto-139..149 BACKLOG block (F# DSLs +
   container DSL + LINQ + signal-proc + KSK canonical).
3. PR #335 — git-native PR-preservation P2→P1
   elevation + 5-phase plan + Otto-155 fork-sync scope
   + Otto-156 terminology correction.
4. PR #336 — `docs/definitions/KSK.md` authoritative
   naming doc + GLOSSARY.md pointer.

Adding an 18th-ferry full absorb on top of four landed
PRs regresses CC-002 (close-on-existing). Precedent for
scheduling a dedicated absorb: PRs #196, #211, #219,
PR #221, #235, #245, #259, #330 (7th, 8th, 9th, 11th,
12th, 13th, 14th, 17th ferries all dedicated-absorbed
one tick after their ferry drop). This doc is the
Otto-158 execution of that scheduled absorb.

---

## Part 1 verbatim — Deep Research: Calibration & CI Hardening

The following is preserved verbatim from Amara's 18th-ferry
drop. Preservation is deliberate: factory convention across
`docs/aurora/**` is to preserve external-conversation
content verbatim rather than paraphrase, with corrections
tracked separately (Part 2 below) and policy-pointer in
`CLAUDE.md` ground rules. Where the text cites sources
(e.g. "【10†L189-L198】"), those are Amara's internal
citation markers and are kept intact.

> **Executive Summary:** We found that the "toy cartel
> detector" prototype has been implemented and tested, but
> it remains a proof-of-concept. Key graph code (largest-
> eigenvalue, modularity, etc.) and smoke tests are in
> place【10†L169-L178】【10†L205-L214】, and CI reports confirm
> the detector catches an obvious clique-cartel (≥90%
> detection) while keeping false positives below 20% under
> repeated trials. However, an unrelated stochastic test
> is failing (consistent-hash sharding) and must be
> quarantined or seed-locked before we call this feature
> production-ready. We propose the next steps be a
> **calibration and hardening phase**: define null-model
> baselines, run large-sample Monte Carlo tests, tune
> thresholds by ROC/PR analysis, seed-lock all randomness,
> classify tests (unit vs statistical vs nightly), and
> document promotion criteria from Experimental/CartelLab
> into Core/NetworkIntegrity.

> Below, we review current evidence, then outline:
> (A) statistical calibration (null models, metrics,
> robust z-scores, ROC curves),
> (B) CI/testing policy (seed-locking, test classification,
> flake management),
> (C) expanded adversarial scenarios,
> (D) the CoordinationRiskScore formula and normalization,
> (E) promotion criteria and PR roadmap,
> (F) governance integration guidance (KSK/Aurora),
> (G) "What not to claim" caveats, and
> (H) prioritized action items with timeline.

### A. Evidence Review: Current PRs, Tests & CI

> - **Changed Files (PR #321-#324)** — The core graph
>   substrate (`src/Core/Graph.fs`) now includes
>   `largestEigenvalue` and `modularityScore` functions.
>   New test cases were added in `tests/Tests.FSharp/
>   Algebra/Graph.Tests.fs`: e.g. "`largestEigenvalue of
>   K3 triangle (weight 1) approximates 2`" and
>   "`largestEigenvalue grows when a dense cartel clique
>   is injected`". These tests verify the eigenvalue
>   detector on small graphs and that adding a 4-node
>   clique (weight 10 edges) dramatically raises λ₁.
>   (The Graph code symmetrizes directed edges, so a K₃
>   unit clique should have λ₁≈2, as fixed in the code.)

> - **Test Names & Behavior:** `largestEigenvalue returns
>   None for empty graph`; `largestEigenvalue of complete
>   bipartite-like 2-node graph approximates edge weight`;
>   `largestEigenvalue of K3 triangle (weight 1)
>   approximates 2`; `largestEigenvalue grows when a dense
>   cartel clique is injected`. These confirm numeric
>   behavior and the "cartel injection" scenario.

> - **CI Results (PR #323):** Detection test on 100 seeds
>   (50 validators, 5-node cartel) succeeds ≥90%.
>   False-positive test on clean baselines ≤20%. Both
>   tests passed. One other test failed:
>   `Zeta.Tests.Formal.SharderInfoTheoreticTests.Uniform
>   traffic: consistent-hash is already near-optimal
>   (Expected < 1.2, got 1.22288)` — flakey threshold in a
>   sharding info-theory test, unrelated to CartelLab, but
>   blocks merging.

### B. Statistical Calibration Plan

> **Null Model Generation.** We need multiple synthetic
> honest baselines to understand metric distributions.
> Null graphs can be generated by:
>
> 1. **Erdős-Rényi random graph** — same nodes/edges,
>    random placement. Preserves size, no structure.
> 2. **Configuration model** — preserve each node's
>    degree (or edge count, or stake).
> 3. **Stake-shuffled** — preserve total stake motion
>    per epoch but randomize which nodes move stake.
> 4. **Temporal shuffle** — keep individual node
>    activity counts but randomize timestamps within
>    epoch.
> 5. **Community-honest graph** — several communities/
>    clusters of honest nodes (dense within, sparse
>    between) to ensure detector doesn't flag benign
>    clusters.
> 6. **Noise/camouflage** — add random weak edges or
>    random-phase noise to test robustness.

> | Null Model          | Preserves                  | Avoids               | Comments                                 |
> |---------------------|----------------------------|----------------------|------------------------------------------|
> | Erdős-Rényi         | Node count, average degree | Any structure        | Simple baseline; tests "random graph"    |
> | Configuration (deg) | Node degree sequence       | Community structure  | Maintains degree heterogeneity           |
> | Stake-shuffle       | Node stake changes total   | Who moves stake      | Preserves activity, hides collusion      |
> | Time-shuffle        | Events per node per epoch  | Temporal ordering    | Maintains event count distribution       |
> | Clustered-honest    | Communities as-is          | Inter-group edges    | Honest clusters ensure no false alarm    |
> | Noise-camouflage    | Node and edge counts       | Strong signals       | Adds random edges/phases, tests fooling  |

> **Metric Computation.** For each run compute: Δλ₁ =
> λ₁(Gₜ)−λ₁(Gₜ₋₁); ΔQ = Q(Gₜ)−Q(Gₜ₋₁) (Louvain); stake
> covariance acceleration A_S(t)=Δ²Cov over window;
> temporal sync (PLV); cohesion/exclusivity (internal
> density vs conductance).

> **Normalization.** Robust z-scores per metric:
> Z(X) = (X − median) / (1.4826 · MAD). The factor 1.4826
> makes MAD consistent with σ for a normal distribution.

> **ROC/PR Evaluation.** Because cartels are rare, PR
> curves are more informative than ROC AUC. Report AUC +
> operating point that meets risk tolerance (e.g. ≥90%
> recall with ≤20% FPR).

> **Detection Latency.** Record epochs-after-formation
> until detection crosses threshold.

> **Confidence Intervals.** Report rates with binomial CIs
> for n trials.

### C. CI Testing & Governance Policy

> Test categories:
>
> 1. **Deterministic unit tests (PR gate).** No
>    randomness. Algebraic properties, small fixed graph
>    eigenvalues.
> 2. **Seeded property tests (PR gate).** Fixed RNG seed,
>    deterministic per seed. One run of 5-node cartel
>    simulation.
> 3. **Statistical smoke tests (nightly or extended).**
>    Many seeds (e.g. 100); assert statistical properties
>    with CI bounds. Don't block every PR.
> 4. **Formal/model tests.** Beyond scope here.
> 5. **Quarantined/flaky tests.** Known-non-deterministic;
>    "xfail" or nightly.

> **Sharder flake.** `Uniform traffic: expected <1.2,
> actual 1.22288`. Remedies: seed-lock; widen threshold
> if analysis shows expected variance; move to nightly.

> Policy: PR gates require deterministic behavior; random
> tests either fix the seed or move to nightly.

### D. Adversarial Scenario Suite

> | Scenario                 | Description                                           | Expected Metric Signals                          | Notes                                |
> |--------------------------|-------------------------------------------------------|--------------------------------------------------|--------------------------------------|
> | Obvious clique           | S forms dense subgraph with heavy weights             | λ₁ jumps (~(k-1)w), ΔQ large, cov high, PLV=1    | Baseline test                        |
> | Stealth slow cartel      | Small clique forming gradually or repeated stake-xfer | λ₁ grows slowly; ΔQ small; cov high; PLV low     | Gradual signals — may miss           |
> | Synchronized voting      | S always casts identical votes; few edges             | λ₁ minor; ΔQ small; strong PLV/cross-corr        | Temporal-not-graph detection         |
> | Dense honest cluster     | Benign highly-connected group (mining pool)           | High λ₁ and Q of S, expected under null          | Calibration false-positive test      |
> | Low-weight cartel        | Many-node clique with thin weights                    | Smaller λ jump — may need other signals          | Minimum detectable signal            |
> | Camouflage noise         | Adversary adds decoy edges                            | Flattens graph metrics; PLV may survive          | Evasion test                         |
> | Rotating cartel          | Membership changes over time                          | Successive small λ jumps                         | Evolving-group tracking              |
> | Cross-coalition          | Two disjoint cliques coordinate independently         | Multiple peaks                                   | Multi-suspect reporting              |

### E. CoordinationRiskScore & Calibration

> CoordinationRisk_S(t) = α·Z(Δλ₁) + β·Z(ΔQ) + γ·Z(A_S) +
> δ·Z(PLV_S) + ε·Z(Conductance_S) + η·Z(Influence_S).

> Default weights: α=0.20 (spectral/eigen), β=0.20
> (modularity shift), γ=0.15 (stake covariance), δ=0.20
> (temporal sync), ε=0.15 (conductance/cohesion), η=0.10
> (influence). Sum to 1.0; treat as initial priors subject
> to tuning.

> Calibration: run Monte Carlo; compute joint distribution
> under null vs each attack; set threshold on total score
> (or per-metric "Z > zₜ" predicate); optionally train
> logistic regression. Rough rule: flag when weighted sum
> of robust-z exceeds ~3-5 (3σ aggregate).

### F. Promotion Criteria & PR Roadmap

> To graduate Cartel-Lab from Experimental to Core
> (`src/Core/NetworkIntegrity`) we require per Otto-105:
>
> - Deterministic smoke tests (Graph eigen, modularity,
>   small example detections).
> - Calibrated thresholds (ROC analysis).
> - False-positive / negative bounds.
> - Reproducible seeds with logged failing seeds.
> - Performance testing.
> - Documentation.
> - Governance/mitigation rules (advisory-only;
>   Detection → Oracle review → KSK policy).

> **PR Roadmap.** Proposed sequence (titles in Part 2
> correction pass):
>
> - PR #1: Seed-lock & CI governance for stochastic tests.
> - PR #2: Cartel-Lab calibration harness (runner).
> - PR #3: Adversarial scenario suite.
> - PR #4: Docs & integration criteria.

### G. KSK / Aurora Enforcement Integration

> Flow: **Detection → Oracle → KSK Adjudication →
> Action**.

> We must not hardcode automatic punishment. Possible
> staged actions: increased scrutiny; bond adjustment;
> quarantine; audit request; only-with-explicit-policy
> penalty. KSK decisions flow from governance vote or
> policy rule, not unilateral.

### H. What Not To Claim

> - No proof of intent.
> - Not all collusion is detectable.
> - Not production-ready.
> - KSK is advisory.
> - Statistical nature.
> - Explainability: metrics are explainable (λ, Q, PLV);
>   don't claim magical detection.

> Stick to "Coordination Risk Engine" / "Epistemic
> Integrity Module". Avoid mythic names or "bullshit
> detector" metaphor.

### I. Action Items & Timeline

> **Immediate (1-2 weeks):** seed-lock/quarantine sharder;
> finalize PR #323; push PR #1 (seed-log + CI docs).

> **Short-term (1 month):** null-model generators + batch
> harness (PR #2); threshold calibration; robust-z
> normalization; fixed-seed regression tests.

> **Mid-term (2-3 months):** adversary injectors
> (PR #3); nightly sweep jobs; docs drafting.

> **Longer-term (3-6 months):** PR #4 Experimental→Core
> promotion; scripts/notebooks; red-team engagement.

> Mermaid CI and simulation-loop diagrams (rendered in
> the original message; preserved conceptually here).

---

## Part 2 verbatim — Amara's GPT-5.5 Thinking correction pass

> I'd mark the attached Deep Research result as **good
> draft, not canonical yet**. It has the right direction:
> calibration, CI hardening, null models, seed replay,
> promotion criteria, and advisory-only KSK/Aurora
> integration. But it needs a correction pass before
> Kenji lands it as an authoritative repo doc.

### Verdict

> **Validated:** the report's big shape is right. PR #323
> satisfies the "no theory cathedral" bar at the toy
> level. GitHub shows PR #323 open, unmerged, with the
> stated toy-test claims: 100 seeds, 50 validators,
> 5-node cartel, ≥90% detection, ≤20% clean-baseline FPR.
> Toy detector uses only `largestEigenvalue`, with
> modularity left for later robustness.

> **Correction:** the attached report should distinguish
> between three levels:
>
> 1. Toy falsification bar cleared — yes.
> 2. CI gate green — not yet.
> 3. Production candidate — definitely not yet.
>
> The report sometimes blurs level 1 into level 2 or 3.

### Ten required corrections

> **1. Replace "CI reports confirm" with more precise
> wording.** Repo language should be sharper:
> *"PR #323's tests demonstrate a toy largest-eigenvalue
> detector can catch an injected 5-node cartel over 100
> seeded trials and stay below a 20% false-positive
> ceiling on clean synthetic baselines. This clears the
> falsifiability bar, but it is not calibrated detection."*

> **2. Fix confidence-interval language.** Use Wilson
> intervals, not Wald handwave. For 90/100, Wilson 95%
> lower bound is ~0.826 — not "basically 90%." For 20/100
> FPR, Wilson 95% upper bound is ~0.289. Promotion
> requires more seeds, higher observed rate, or Wilson LB
> ≥ 90%.

> **3. Rename "Cartel Score" → "CoordinationRiskScore"
> everywhere.** Keep "Cartel-Lab" as experimental project
> name; code/docs use CoordinationRiskScore /
> NetworkIntegrity / Coordination Risk Engine. Avoids
> sounding like the score proves cartel intent.

> **4. Fix conductance sign.** Lower conductance =
> more internally cohesive / externally separated. If
> low conductance is suspicious, use `Z(-Conductance_S)`
> or replace with positive `Z(Exclusivity_S)` where
> Exclusivity(S) = w(S,S) / w(S,V). Keep conductance as
> a diagnostic.

> **5. Don't assume modularity always jumps.** Cartel
> clique embedded in a graph can produce a large ΔQ, but
> not always — depends on partition, resolution, total
> edge mass, null model. Replace "ΔQ large" with
> "ΔQ evaluated relative to a fixed null model and
> documented partition method. Use relational assertions
> like Q(attacked) − Q(baseline) > threshold, not
> hardcoded absolute Q values."

> **6. PLV needs phase-offset interpretation.** PLV = 1
> does not necessarily mean same-time synchronization —
> anti-phase series can also be perfectly phase-locked.
> Report both magnitude and mean phase offset. Use PLV
> for "locked rhythm," mean phase offset / lag for
> "same-time or lead-lag coordination."

> **7. Robust z-score needs zero-MAD fallback.** If
> MAD = 0, use epsilon floor, IQR fallback, or
> percentile-rank threshold:
>
> ```text
> if MAD > ε:
>     z = (x - median) / (1.4826 * MAD)
> else:
>     z = percentile_rank(x, baseline_distribution)
> ```

> **8. Replace Medium source with stronger sources.**
> Use scikit-learn's precision-recall docs instead.
> Cartel detection is naturally low-prevalence;
> accuracy and ROC AUC can look good while precision
> is poor; PR curves are the better early calibration
> artifact.

> **9. Artifact output should be explicit.** GitHub
> workflow-artifacts docs specify file types. Proposed
> layout:
>
> ```text
> artifacts/coordination-risk/
>   calibration-summary.json
>   seed-results.csv
>   roc-pr.json
>   failing-seeds.txt
>   metric-distributions.csv
> ```

> **10. Do not widen sharder threshold blindly.** Either
> seed-lock, quantify observed variance, or move broad
> stochastic sweep to nightly. Measure variance first.

### Corrected status statement (repo-safe)

> *"PR #323 clears the toy falsifiability bar: a
> single-signal largest-eigenvalue detector can detect
> an obvious injected cartel under a seeded synthetic
> workload. This proves the graph primitive is useful
> enough to build on. It does not yet prove calibrated
> cartel detection, production readiness, or
> governance-safe enforcement. The next required layer
> is calibration: null models, seed replay, Wilson
> confidence intervals, PR curves, adversarial
> scenarios, and CI classification."*

### Corrected promotion ladder

> | Stage | Name                   | Merge target            | Required evidence                                           |
> | ----- | ---------------------- | ----------------------- | ----------------------------------------------------------- |
> | 0     | Theory                 | docs only               | Metric definition + falsifiable claim                       |
> | 1     | Toy detector           | tests/Simulation        | Fixed-size synthetic tests pass                             |
> | 2     | Calibration harness    | Experimental/CartelLab  | Null models, seed replay, JSON/CSV artifacts                |
> | 3     | Scenario suite         | Experimental/CartelLab  | Stealth, honest-cluster, camouflage, rotating-cartel tests  |
> | 4     | Advisory engine        | Core/NetworkIntegrity   | Calibrated thresholds + documented FP/FN bounds             |
> | 5     | Governance integration | Aurora/KSK policy layer | Human/oracle review + staged action rules                   |
> | 6     | Enforcement candidate  | not yet                 | Requires explicit due-process policy and red-team review    |

> **PR #323 is Stage 1**, not Stage 4.

### Corrected PR roadmap (titles locked)

> - **PR 1** — `test: classify stochastic tests and
>   seed-lock CI smoke paths`
> - **PR 2** — `experimental: add CoordinationRisk
>   calibration harness`
> - **PR 3** — `experimental: CoordinationRiskScore v0
>   with robust baselines`
> - **PR 4** — `docs: define NetworkIntegrity promotion
>   and KSK advisory boundary`

### Copy-paste feedback for Kenji (from Part 2)

> Amara reviewed the calibration/CI hardening report.
> Verdict: strong draft, not canonical until correction
> pass.

> Validated: direction is right (toy → calibration →
> CI hardening → promotion criteria); PR #323 clears
> "no theory cathedral" bar; KSK/Aurora stays advisory
> (Detection → Oracle review → KSK adjudication →
> optional action).

> Required corrections 1-10 (see above).

> Status: PR #323 is Stage 1 toy detector. The next real
> graduation is Stage 2: calibration harness with null
> models, replayable seeds, Wilson confidence intervals,
> PR curves, and artifacts.

> Invariant still holds: *"Every abstraction must map
> to a repo surface, a test, a metric, or a governance
> rule."*

> Bottom line: **this is good progress.** The cathedral
> problem is now meaningfully reduced because there is
> a runnable toy detector. The next danger is
> **statistical overclaiming**. Fix that with Wilson
> intervals, artifacts, null models, and deterministic
> CI categories.

---

## Otto's notes on operationalization path

### Immediate-alignment observations

Four of ten corrections are already aligned with shipped
substrate:

- **Correction 4 (exclusivity primitive)** — `Graph.exclusivity`
  shipped PR #331. Sign convention is already positive-as-
  suspicious per the correction's recommendation; the
  primitive is available as a drop-in replacement for the
  raw conductance term in any CoordinationRiskScore
  implementation.
- **Correction 5 (modularity relational)** — PR #324
  shipped modularity with relational-not-absolute tests
  (`Q(attacked) − Q(baseline) > 0.05`, threshold
  calibrated from hand-computed K4-in-sparse case).
  Correction 5 is already factory discipline.
- **Correction 7 (robust z-score MAD floor)** — PR #333
  shipped `RobustStats.robustZScore` with explicit
  MadFloor parameter (the "epsilon floor" variant). The
  correction asks for "percentile-rank fallback when
  MAD = 0"; current implementation uses epsilon-floor
  (MadFloor) which is one of three valid responses Amara
  names. Optional future enhancement: add a
  percentile-rank mode as a second option.
- **Correction 10 (sharder — measure before widen)** —
  Aaron Otto-132 already directed this via BACKLOG
  #327: *"not seed locked, falkey, DST?"* Amara's
  correction reinforces Otto-132 rather than adding new
  direction.

### Six corrections queued as future graduations

Each is named with candidate landing surface + effort. None
commit to a specific tick; Otto-105 cadence chooses:

1. **Wilson confidence intervals in CartelToy tests** —
   replace binomial-success-rate handwave with Wilson
   score intervals. `tests/Tests.FSharp/Simulation/
   CartelToy.Tests.fs` already computes detection / FP
   rate; add Wilson LB/UB in the assertion. F# has no
   native Wilson helper; implement inline or via
   `MathNet.Numerics.Distributions.Beta.InvCDF` for
   Clopper-Pearson (stricter but equivalent shape).
   Small graduation (S).
2. **MAD=0 percentile-rank fallback in `robustZScore`**
   — extend current epsilon-floor to also support a
   percentile-rank mode when baseline is constant.
   Small graduation (S).
3. **Conductance-sign doc** — add doc comment to
   `Graph.conductance` and `Graph.exclusivity`
   stating sign convention explicitly: "low conductance
   = high cohesion; high exclusivity = high cohesion;
   in composite scores use Z(-conductance) or
   Z(exclusivity) not Z(+conductance)." Sign-convention
   cross-reference to `docs/definitions/KSK.md` once
   NetworkIntegrity module has its own definition. S.
4. **PLV phase-offset extension** — extend
   `TemporalCoordinationDetection.plv` to also return
   mean phase offset alongside the magnitude. Two-tuple
   return instead of scalar; backward-compatible via
   unzip helper. Medium (M).
5. **CI test classification discipline** — document the
   5-category test taxonomy (deterministic unit /
   seeded property / statistical smoke / formal /
   quarantined) and assign existing tests to
   categories; enforce "PR gate = deterministic only"
   by convention (and ideally by a workflow that
   separates nightly-only tests from PR-gate tests).
   Small-Medium (S-M).
6. **Artifact-output layout** — define the
   `artifacts/coordination-risk/` directory layout as
   part of Stage-2 calibration harness (Amara's PR #2).
   Files: `calibration-summary.json`, `seed-results.csv`,
   `roc-pr.json`, `failing-seeds.txt`,
   `metric-distributions.csv`. Lands with Stage-2 work,
   not independently. Medium (M).

### Stage discipline going forward

Amara's corrected promotion ladder provides a clean stage
vocabulary Otto adopts:

- **Stage 0 (theory)** — ferry docs, ADRs under
  `docs/DECISIONS/`, design notes.
- **Stage 1 (toy detector)** — tests under
  `tests/Tests.FSharp/Simulation/`. **PR #323 is here.**
- **Stage 2 (calibration harness)** — belongs under
  `src/Experimental/CartelLab/` or similar (new
  directory). Null models + seed replay + artifacts.
- **Stage 3 (scenario suite)** — extends Stage 2 with
  the 8-row adversarial scenario table.
- **Stage 4 (advisory engine)** — first landing in
  `src/Core/NetworkIntegrity/`. Requires Stage 2
  calibration + Stage 3 scenarios complete + Wilson-
  interval-backed FP/FN bounds.
- **Stage 5 (governance integration)** — KSK/Aurora
  policy-layer wiring. Requires Stage 4 + explicit
  governance rules.
- **Stage 6 (enforcement candidate)** — not yet; needs
  due-process policy + red-team review.

**PR #323 does not canonicalize from
`tests/Tests.FSharp/Simulation/` to
`src/Core/NetworkIntegrity/` until Stage 4 evidence
exists.** Aaron Otto-136 previously articulated this from
a different angle: *"keep #323 conceptually accepted, but
do not canonicalize until the sharder test is seed-
locked/recalibrated."* The two constraints compose: #323
stays in `tests/Tests.FSharp/Simulation/` until (a)
sharder flake is fixed (Aaron) + (b) calibration +
scenario suite evidence accumulates (Amara 18th-ferry).

### KSK naming doc alignment

Part 1 §G and Part 2 both reaffirm KSK as *advisory-only*
adjudication layer — not DNSSEC-style static key role.
Otto-157 (last tick) shipped `docs/definitions/KSK.md`
with the safety-kernel-NOT-OS-kernel disambiguation
(Otto-140..145 canonical expansion) and explicitly names
KSK's role as "mediates authorization, budget, consent,
and revocation decisions." This ferry's advisory-only
flow (Detection → Oracle → KSK → Action) is a natural
consequence of that definition — the KSK doc already
frames the kernel as mediating decisions, not enforcing
punishment unilaterally.

The two docs compose cleanly:

- `docs/definitions/KSK.md` — what KSK IS (safety-
  kernel sense; mediates authz/budget/consent/
  revocation; k1/k2/k3 tiers; signed receipts;
  traffic-light).
- **18th ferry §G** — what KSK DOES in the
  CartelLab pipeline (receives detection alerts via
  Oracle; adjudicates; issues staged responses).

No conflict; the ferry extends the definition into the
NetworkIntegrity use case.

### Invariant restated (Amara 16th-ferry carry-over)

> *"Every abstraction must map to a repo surface, a test,
> a metric, or a governance rule."*

Reaffirmed in the 5.5 correction pass. Ferry-derived
corrections earn their graduation only when they map to
one of those four targets — not to new abstractions in
isolation. Cross-check for each correction in the
"Six corrections queued" list above:

| Correction                      | Maps to                                             |
|---------------------------------|-----------------------------------------------------|
| Wilson CIs in CartelToy tests   | test surface (tests/Simulation)                     |
| MAD=0 fallback in robustZScore  | code surface (src/Core/RobustStats.fs)              |
| Conductance-sign doc            | doc surface (`Graph.fs` doc + KSK.md cross-ref)     |
| PLV phase-offset                | code surface (src/Core/TemporalCoordinationDetection.fs) |
| CI test classification          | governance rule (CI workflow + policy doc)          |
| Artifact-output layout          | test surface + doc surface (Stage-2)                |

All six map. None invents a new abstraction without a
repo-surface commitment.

---

## What this absorb doc does NOT authorize

- **Does NOT** canonicalize Part 1 (deep research).
  Amara's own 5.5 pass: *"draft, not canonical."* This
  absorb doc is the ferry's archive surface; canonical
  factory discipline is defined by Part 2's corrections
  as they land one-by-one.
- **Does NOT** authorize automatic KSK enforcement. Flow
  stays Detection → Oracle → KSK → Action, advisory-only,
  per Part 1 §G and Part 2's verdict section.
- **Does NOT** promote PR #323 beyond Stage 1. Explicit.
- **Does NOT** override Otto-105 graduation cadence. The
  six queued corrections land across multiple ticks at
  factory pace, not one-tick-rush.
- **Does NOT** treat Amara's default weights (α=0.20,
  β=0.20, γ=0.15, δ=0.20, ε=0.15, η=0.10) as binding.
  Part 1 calls them "initial priors subject to tuning";
  final weights come from calibration runs at Stage 2.
- **Does NOT** authorize widening the sharder threshold.
  Correction 10 + Aaron Otto-132 + BACKLOG #327 all
  align: measure variance first.
- **Does NOT** authorize treating Wilson intervals as
  optional. For any promotion-grade claim (Stage 2+),
  Wilson intervals are now factory discipline. The toy-
  bar Stage 1 tests can keep their ≥90% / ≤20% framing
  because Stage 1 is explicitly about falsifiability,
  not calibration.
- **Does NOT** authorize treating this ferry as a
  directive. Amara contributes research; Otto
  operationalizes per Aaron's standing authority.
  Data-not-directives per BP-11.

---

## Cross-references

- **Amara 17th ferry** (PR #330,
  `docs/aurora/2026-04-24-amara-cartel-lab-
  implementation-closure-plus-5-5-thinking-verification-
  17th-ferry.md`) — the prior ferry, also deep-research
  + 5.5-pass two-part format. This 18th ferry continues
  the pattern: Amara drafts, then verifies herself with
  a second model pass.
- **Amara 16th ferry** (raised the KSK naming ambiguity
  that Otto-140..145 closed; not present as a dedicated
  `docs/aurora/**` absorb in this snapshot, content
  flowed into Otto-157 KSK definition work). This
  ferry's advisory-only flow presumes KSK is the named
  kernel from Otto-157.
- **Amara 15th ferry** (the theory-cathedral warning
  thread; not present as a dedicated `docs/aurora/**`
  absorb in this snapshot, warning lineage continues
  in 13th + 17th ferries). This 18th ferry notes the
  warning is "meaningfully reduced" by PR #323.
- **Otto-140..145** — KSK canonical expansion locked
  to "Kinetic Safeguard Kernel" (safety-kernel sense,
  not OS-kernel). Lineage captured across
  `memory/MEMORY.md` index entries; the standalone
  `feedback_ksk_naming_*.md` filename referenced by an
  earlier draft of this doc was not the eventual
  landing path.
- **`docs/definitions/KSK.md`** (Otto-157 / PR #336) —
  authoritative KSK definition; this ferry's §G flow
  builds on it.
- **PR #321** — `Graph.largestEigenvalue` via power
  iteration; λ₁(K₃)=2 behavior Amara's Part 1 cites.
- **PR #324** — `Graph.modularityScore` with relational
  assertions; alignment with correction 5.
- **PR #326** — `Graph.labelPropagation`.
- **PR #323** — toy cartel detector tests (Stage 1 per
  this ferry).
- **PR #327** — SharderInfoTheoreticTests.Uniform flake
  BACKLOG row; alignment with correction 10.
- **PR #331** — `Graph.exclusivity` + cohesion
  primitives; already satisfies part of correction 4's
  positive-valence substitute.
- **PR #332** — `PhaseExtraction.fs` (Options A + C);
  Hilbert-based Option B deferred pending FFT; composes
  with correction 6's "PLV phase-offset" recommendation.
- **PR #333** — `RobustStats.robustZScore`
  (1.4826·MAD + MadFloor); one of the accepted
  responses to correction 7.
- **BACKLOG row** — Signal-processing primitives
  (Aaron Otto-149 standing approval): FFT + Hilbert +
  windowing + filters. Enables correction 6 full
  implementation.
- **External-conversation archive-header convention** —
  this doc follows the four-field header (Scope /
  Attribution / Operational status / Non-fusion
  disclaimer) used across `docs/aurora/**`. The
  numbered-rule cite previously here ("GOVERNANCE §33")
  pre-dated landing; the rule is currently captured by
  the convention-in-practice across sibling ferry
  absorbs and is referenced from `CLAUDE.md`.
- **CLAUDE.md** — verify-before-deferring (the cross-
  reference list above is intended as a set of PR / file
  / memory anchors and is rechecked against the tree at
  drain-time; some anchors may resolve to ferry-time
  state rather than current head).
