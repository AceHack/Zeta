# A semver range is a claim, not a guarantee — two neutral signals, and escalation that is recoverable

**Date:** 2026-08-26
**Status:** `toy` — per [`.claude/rules/toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md).
There is no measured adherence data in this repo, so every number the module produces is a number
about a fixture. The identifiers say so (`toyClassify`, `toyAdherenceScore`, `toy-adherence.ts`).
**Register:** the design claims below are `speculative` or `consistent with`; the two things that
are actually `metered` are the mutation kills in §6 and the absence measurements in §2.
**Origin:** Aaron — _"a semver range is a CLAIM, not a guarantee"_, and _"we never assume betrayal
unless it's self declared by the betrayer and even then the game continues we don't end playing."_

---

## 1. The claim

`^1.2.3` is not a fact about a package. It is the publisher **asserting** that minors will not
break you. Every tool in the ecosystem — Dependabot, Renovate, `npm update`, `cargo update` —
treats that assertion as **binding**: a minor is auto-mergeable _because it is labelled a minor_.

The assertion is checkable. A publisher either has, or has not, historically shipped minors that
broke consumers. So:

> **Measure whether each publisher's assertions have historically held, and let the measured
> record set the scrutiny.** More past violations, more scrutiny on minor and patch.

That is the first signal. It is not sufficient, and §4 is about why.

## 2. What exists today (measured 2026-08-26, not re-derived)

| surface                                           | state                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `.github/dependabot.yml`                          | **8 ecosystems** — nuget, github-actions, bun, npm, cargo, gomod, uv, dotnet-sdk. This is the real pipeline. |
| `src/Core.TypeScript/audit/audit-dep-currency.ts` | the only dependency tooling. Untouched by this change (another agent holds it).                              |
| `src/Core/TravelerRankLedger.fs`                  | 156 lines, TrueSkill-style ADF over (traveler × hat-domain).                                                 |

**The provenance measurement is the load-bearing one, and it is an absence.** Eight workflows
mention `attestation` / `provenance` / `cosign` / `sigstore`. Every one of them is about
**artifacts we produce**:

- `build-platform-images.yml`, `build-ai-cluster-iso.yml` — cosign keyless OIDC signing of _our_
  images and ISO.
- `cluster/image-source-provenance.ts` — gates _our_ container images as public-vs-private.
- `agent-heartbeat.yml`, `agent-reviewer.yml` — peer attestation between _our own agents_.

**Nothing verifies the provenance of an incoming dependency.** Not one of the eight ecosystems
checks npm provenance, a sigstore bundle, or reproducibility on a package it pulls in. The
`gate.yml` comment at line 1895 is precise about our own heartbeat lane and says nothing about
third-party artifacts. So the second signal below is not "improve an existing check" — it is a
surface that does not exist yet, and §7 says plainly that this change does not build it either.

## 3. Reusing `TravelerRankLedger.fs` — it generalises in shape, and the half that was asked for is missing

The brief said to reuse the estimator rather than invent one, and to say so if it does not
genuinely generalise. **It half does.**

**What transfers cleanly.** `(traveler × hat-domain) -> SkillBelief` becomes
`(publisher × ecosystem) -> ToyAdherenceBelief`, with the outcome bit reinterpreted: `hit` becomes
"this non-major release did not break its consumers". Three properties come along and all three
are wanted:

- **Domain isolation.** A publisher's record in `npm` says nothing about their record in `cargo`,
  exactly as standing as a verifier does not buy standing as a signer.
- **A rating _and_ an uncertainty**, so "no evidence" and "evidence of adherence" are
  distinguishable — which a scalar score cannot do.
- **The honest `0.5` prior.** A fresh publisher is not `0.0`. This closes the whitewash window:
  a publisher with a bad record cannot _improve_ it by republishing under a new name, only return
  to the prior — and the prior still trips `NewPublisher` below the observation floor.

**What does not transfer: the dynamics factor is not in that file.** The brief described
TrueSkill's τ inflating σ with time since last observation. `TravelerRankLedger.fs` has no τ. Its
own docstring states the opposite property —

> _"σ² is strictly decreasing with each observation (posterior concentrates)."_

A strictly-decreasing σ² **is** the swallowing Aaron named:

> _"based on a time weighed average not all history or else recent non adherence can get swallowed
> by lots of past adherence."_

After fifty clean releases σ² is tiny, so the fifty-first release breaking its consumers barely
moves μ. The score would be _rising_ through the window where the evidence turned.

So the ADF probit update in `toy-adherence.ts` is `TravelerRankLedger.update` transcribed, and
**τ is added** — TrueSkill's own dynamics factor between time slices (Herbrich, Minka & Graepel
2006), not an invented decay constant. If `TravelerRankLedger.fs` ever grows a τ, the transcription
should be deleted in favour of calling it.

**One defect found and fixed while building it, worth recording.** Uncapped inflation makes σ²
**diverge** on a long clean run. That is not a rounding artifact — it is the probit likelihood
saturating: once μ is large, `w(t) → 0`, so a further success carries almost no information while
inflation keeps adding τ² per step. The estimator then reports its _most consistent_ publishers as
its _least certain_ ones. Measured before the fix: 60 clean observations gave σ² = 0.91 and rising,
against σ₀² = 1.0. The fix is to cap inflation at the prior — **no amount of staleness can leave
you knowing less than you knew before any evidence existed** — so σ² ∈ (0, σ₀²] and a fully stale
record's score regresses toward 0.5 rather than toward nonsense.

**Time enters as a declared parameter.** `gap` is in release-interval units, never seconds.
Nothing in the module reads a clock, and a test greps the sources to keep it that way (§13
noninterference; also
[`local-time-never-enters-the-shared-fold.md`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
— a wall-clock read here would leak local time into a shared conclusion).

## 4. Two neutral signals — never one trust score, never an intent

| signal                      | asks                                   | source                                                                                                |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **semver adherence**        | did this publisher's PAST CLAIMS hold? | the registry                                                                                          |
| **provenance / continuity** | is this artifact WHAT IT SAYS IT IS?   | sigstore / in-toto / npm provenance, reproducible builds, maintainer-change + cadence-shift detection |

Verdict rows name **facts**: `MaintainerChanged`, `ProvenanceMissing`, `ProvenanceIdentityChanged`,
`BuildNotReproducible`, `SuddenReleaseCadenceShift`, `NewPublisher`, `AdherenceBelowFloor`,
`AdherenceStale`, `SemverMajorDeclared`.

There is no `Compromised`, no `Malicious`, no `Attacker`, no `Untrusted`.
[`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):
the mechanism reports the recognition, the caller's policy attaches the meaning. A test asserts the
absence in the shape a DU row would take, so reintroducing one fails the suite rather than passing
review. (This one is written down because I got it wrong in prose myself and Aaron corrected it.)

### The combinator is a JOIN, not a sum — and that is the whole design

```
transition = max(adherenceReading, provenanceReading)
```

Never added, averaged, or weighted into a single trust number. Under **any** weighted-sum
combinator a maximal adherence score _buys down_ a provenance discontinuity, and the better the
record the more it buys. That is backwards precisely in the case that matters (§5). A join has no
exchange rate, so there is nothing to buy with — and `toyProvenanceReading` is **not passed** the
adherence record, so the independence is enforced by parameter list rather than by discipline.

## 5. Falsifier 1 — adherence is never sufficient (xz-utils)

**xz-utils / CVE-2024-3094** had a spotless release record. A time-weighted adherence score would
have been _rising_ right up to the backdoor, because nothing about the semver claims had gone
wrong. What changed was **who was building it and how** — a provenance discontinuity, observable
with no claim about anyone's motives.

The test gives a publisher a _maximal_ adherence score (pinned > 0.95, and shown to be
`AutoEligible` with clean provenance, so the test cannot pass by everything escalating), then adds
a provenance discontinuity and requires escalation anyway. Each of the five provenance facts is
checked alone, and the patch-bump case is checked separately so the smallest claim is not an
exemption.

## 6. Falsifier 2 — escalation is recoverable

> Aaron: _"we never assume betrayal unless it's self declared by the betrayer and even then the
> game continues we don't end playing."_

**There is no permanent blocklist and no confiscation of accumulated standing.** This is
structural, not a policy note:

- `Transition` has **no** terminal row — no `Blocked`, no `Rejected`, no row carrying a publisher
  forward as flagged.
- `toyClassify` has **no memory**. Its inputs are the proposal, the current posterior, and the
  _current_ facts. There is no blocklist parameter and no "previously flagged" field.
- `toyClassify` never returns a modified belief, so passing through an escalation costs a publisher
  nothing. Standing is earned by observation and spent by nobody — the same
  spend/stake/**never-confiscate** shape as
  [`privacy-budget-is-hard-money-earned-by-others.md`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md).

Recovery is tested on **both** axes: a provenance discontinuity that resolves returns to
`AutoEligible` byte-identically, and a publisher whose _adherence_ was the problem recovers by
accumulating new observations — the ordinary way, not by petition.

This is also correct on the base rate. Most maintainer changes are people changing jobs; most
provenance gaps are a CI migration; most cadence shifts are a release train.
[`never-assume-malice-where-mistake-is-possible.md`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md)
supplies the threshold, and note it is **conjunctive** — repeated _and_ irreversible _and_ harming
other travelers. A single discontinuity meets none of the three.

### The falsifiers were mutation-checked, and this is the part that is `metered`

A test that cannot fail is decoration, so each was run against the mutant it claims to catch:

| mutant | what it changes                                                       | result                                        |
| ------ | --------------------------------------------------------------------- | --------------------------------------------- |
| **A**  | join → weighted sum (`rank(prov) × (1 − score) + rank(adh)`)          | **5 fail**, incl. all three FALSIFIER 1 tests |
| **B**  | dynamics factor removed (`TravelerRankLedger.fs` as it stands)        | **3 fail**, incl. the swallowing test         |
| **C**  | escalation made sticky via a module-level `flagged` set (a blocklist) | **5 fail**, incl. both FALSIFIER 2 tests      |

Restored: **21 pass, 0 fail**. Mutant B is the interesting one — it is not a strawman, it is
literally the current F# estimator, and it fails the property Aaron asked for.

## 7. What is NOT built

Stated plainly, because an unenforced exception looks like a guarantee and carries none.

- **Nothing calls `toyClassify`.** Not CI, not a workflow, not a merge queue. This is the typed
  core plus its falsifiers, and a decision function nobody calls yet is honest; a half-wired
  auto-updater is not.
- **`.github/dependabot.yml` is unchanged.** Nothing auto-merges on the basis of this.
- **There is no persistence layer.** No adherence ledger is stored, loaded, or keyed. `AdherenceRecord`
  is a value the caller constructs; where it would come from is not designed here.
- **No registry is queried.** There is no code that reads npm/crates.io/NuGet release history, and
  therefore **no measured adherence data exists** — which is exactly why the whole thing is `toy`.
- **No provenance is fetched or verified.** `ProvenanceFact` values are constructed by the caller.
  Producing them for real means sigstore bundle verification, npm provenance attestation checks,
  and reproducible-build comparison — none of which exist in this repo for _incoming_ dependencies
  (§2), and none of which are built here.
- **The thresholds in `defaultToyPolicy` are unmetered guesses.** `0.6` / `0.4` / `5` / `10` are
  placeholders with no calibration behind them. They are declared parameters precisely so a caller
  can supply their own oracle (§11) rather than inherit mine.
- **`SuddenReleaseCadenceShift` has no detector.** The fact row exists; nothing computes it.
- **τ = 0.2 is not calibrated.** It is a plausible value that makes the dynamics factor visibly
  non-zero. What it should be is an empirical question against real registry history.
- **The `major`-bump rule is asserted, not measured.** "A major makes no compatibility claim, so
  adherence does not underwrite it" is reasoning, not evidence.

**What would shed `toy`:** fold real registry history for a real publisher set into the estimator,
and show the score discriminates — publishers with known breaking minors scoring below publishers
without. Until that comparison runs, the estimator is a well-typed opinion.

## 8. Anchors (Beacon)

- **Herbrich, Minka & Graepel (2006), _TrueSkill™: A Bayesian Skill Rating System_, NIPS.** The
  estimator, and specifically the **dynamics factor** between time slices — the mechanism that
  makes "time-weighted" mean _confidence decays_ rather than _evidence is discarded_.
- **Minka (2001), _Expectation Propagation for Approximate Bayesian Inference_, UAI.** The ADF
  update `TravelerRankLedger.fs` implements and this transcribes.
- **Abramowitz & Stegun 7.1.26.** The Φ approximation, kept identical to the F# so the two agree.
- **CVE-2024-3094 (xz-utils, 2024).** The falsifier's source: a spotless release record and a
  provenance discontinuity, in the same package at the same time.
- **SLSA / in-toto (Torres-Arias et al., _in-toto: Providing farm-to-table guarantees for bits and
  bytes_, USENIX Security 2019); Sigstore (Newman et al., _Sigstore: Software Signing for
  Everybody_, CCS 2022).** The provenance signal's actual sources — cited as where the facts would
  come from, **not** as something this change verifies.
- **Preston-Werner, _Semantic Versioning 2.0.0_.** The claim whose adherence is being measured.
  Worth reading as what it is: a social contract, phrased throughout in MUST/SHOULD directed at
  publishers, with no verification mechanism attached.
- **Hirschman, _Exit, Voice, and Loyalty_ (1970).** Why escalation must stay recoverable: a
  publisher who can never return has no path back, and a concentration you cannot exit is a hub
  rather than an oracle.

## 9. Pointers

- `src/Core.TypeScript/dep-update/types.ts` — the DU of transitions and the two neutral fact unions.
- `src/Core.TypeScript/dep-update/toy-adherence.ts` — the estimator, with the τ that `TravelerRankLedger.fs` lacks.
- `src/Core.TypeScript/dep-update/toy-classify.ts` — the pure decision function and the join.
- `src/Core.TypeScript/dep-update/toy-classify.test.ts` — the falsifiers, each with its mutation named.
- `src/Core/TravelerRankLedger.fs` — the estimator this reuses, and the one that needs a τ.
- [`2026-08-24-the-etymology-attack-and-the-supply-chain-substitution-are-one-attack-and-only-a-metric-catches-drift.md`](2026-08-24-the-etymology-attack-and-the-supply-chain-substitution-are-one-attack-and-only-a-metric-catches-drift.md)
  — the same attack one layer down. Its point that **a hash cannot accumulate across revisions** is
  why the adherence signal has to be a posterior over history rather than a per-release check, and
  its exact/distance split is the same two-signal shape: provenance is the exact tier (_is this the
  artifact we recorded_), adherence is the accumulating one.
