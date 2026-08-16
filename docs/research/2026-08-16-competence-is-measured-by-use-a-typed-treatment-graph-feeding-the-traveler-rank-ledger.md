# Competence is measured by USE — a typed treatment graph feeding `TravelerRankLedger`

**Register: `unmetered`. The store ships EMPTY and nothing is wired into any aggregation.**
A ledger with no data is not evidence about anyone; every number below is a description of a
mechanism, never a measurement of an agent.

Design + implementation, shadow, 2026-08-16. Authorized by Aaron: *"lets do the best long term
thing here not just quick fix?"*

---

## 0. The question, and the trap it sets

Nothing in the repo measures whether a reviewer's findings hold up. `calibration-ledger.ts:320`
has the right posterior machinery and scores the wrong quantity — its own contract says
**"CALIBRATION ≠ COMPETENCE"** (`:18-21`). The missing quantity blocks weighted aggregation
(PR #10945), the `c` in the Condorcet row (PR #10928), and per-agent ΔU attribution.

The trap: **if "upheld" means "≥3 reviewers agreed", the ledger measures agreement, not
correctness** — and feeding that back as a competence weight makes popular reviewers competent by
construction.

Aaron resolved it: *"at the end of the day competence can be measured by use of the product once
we have more active use and the bugs discovered during use and how much it's used without
issues"* — *"this is kind of like DORA per agent."* **Usage is downstream of the review vote, so
agreement cannot manufacture it.**

And then the follow-on that makes it usable before usage arrives: *"we can use agree as a early
indicator of correctness but only use is the ultimate determinator."* Stated in the machinery
that already exists: **agreement is the PRIOR, use is the LIKELIHOOD.** Never averaged — seeded,
then superseded.

---

## 1. Can this be honestly populated today? No — and here is exactly what is missing

This is the first-class finding. Four gaps, each verified by reading the code, not inferred.

| # | gap | evidence |
|---|---|---|
| 1 | **The one four-key DORA fold in-tree defines a change failure as a REVIEW VERDICT.** `changeFailureRate` counts change-sets with a `ChangesRequested` event. | `agentic-organization/packages/observability/src/dora-metrics.ts:98-101` |
| 2 | **The Zeta-side DORA fold has no failure metric at all** — open counts, lead time, throughput. No change-failure rate, no MTTR. | `src/Core.TypeScript/work-items/dora-fold.ts:167-181` |
| 3 | **No causal link from a defect to the change that caused it.** Work-item front matter is `id/type/state/priority/slug/title/created/depends_on/composes_with`; the event log has three kinds (`created`, `state-changed`, `closed`). | `src/Core.TypeScript/work-items/types.ts:46-66`; any `workitems/*.md` |
| 4 | **The actor field is a tool name, not an identity.** 241 events, 3 distinct `by` values: `otto-cli` ×219, `otto` ×20, `drift-sweep` ×2. `.claude/rules/shared-checkout-is-view-only.md`: *"A bus/routing address is not identity."* | `find workitems/events -name '*.json'` |

Gap 1 is the important one: **the circularity does not only enter through the review board — it
is already sitting inside the existing DORA implementation.** Wiring "DORA per agent" to that
fold would have reproduced exactly the defect this design exists to avoid, wearing an
*Accelerate* citation.

So: **the determinator series is empty today and stays empty until real use is instrumented.**
Aaron said as much — *"once we have more active use."* What would have to be recorded to create
the signal is §6.

---

## 2. What already exists — this is an event source, not a new ledger

Verified before designing, per Aaron: *"we already have a true skill like ranking system here, it
should be able to feed that system."*

- **`src/Core/TravelerRankLedger.fs`** — ADF/TrueSkill probit posterior per (traveler,
  hat-domain): `s ~ N(μ₀,σ₀²)`, `o ~ Bernoulli(Φ(s/β))`, `trustBand = Φ(μ/√(σ²+β²))`. Its header
  names the architecture: *"the long-term anti-whitewash path alongside the fast
  `CalibrationLedger` (Beta(2,2) + k-clamp)."*
- **`src/Core.TypeScript/planning/traveler-rank-ledger.ts`** — the TS port, with JSON persistence.
- **`src/Core.TypeScript/workflow-engine/trueskill.ts`** — pure-TS TrueSkill; *"team-play extension
  deferred"* (`:22`).

**Cold start is therefore already solved and is not re-invented here.** A fresh agent starts at
`μ=0, σ²=1 ⇒ trustBand = Φ(0) = 0.5` — an explicit statement of ignorance, not a weight of zero
or one.

**The gap this fills is the event source.** The ledger persists *posterior state*; there is no
append-only log of the outcomes that produced it. Since **ADF is order-dependent** (measured
below), a posterior without its ordered event log cannot be replayed, re-attributed under a
different rule, or audited. The log is the contribution.

---

## 3. The upheld-definition, and its independence argument

**Definition adopted.** A stance-bearing treatment is *upheld* when **reality agrees with it**:

```
observation(agent) = (stance of the agent's treatment) === (what use did to the subject)
```

`authored`/`approved` assert the subject is sound (stance `+1`); `warned`/`warned-overruled`
assert it is not (stance `−1`). One outcome therefore settles several claims **in opposite
directions** — a warner and an approver of the same failed change get opposite observations.

**Why it is independent of the review vote.**

- *(a) Series independence.* Evidence is typed by independence class, and no folded series admits
  a `review-derived` kind. The determinator's evidence is `defect-in-use` / `clean-usage-window`,
  which are produced by usage, after the vote, by parties the vote does not select. Review
  verdicts are still recorded — in the `review-vote` series, which is never folded.
- *(b) Labeler independence.* Aaron: *"bugs are very subjective in their readings … it will be a
  human user or some agentic user that labels something as a bug not just mechanical."* Labels
  are judgments, and that is **not** the defect — Shepard's treatments are editor-authored too.
  The defect is self-certification, so the invariant is narrow: **the labeler must not be the
  agent whose posterior the label updates.**

**What it costs.**

- *Lag.* A defect can surface long after the change (§5).
- *False negatives.* A correct warning about code that is never exercised is never vindicated.
- *Coverage.* Interactions and omissions are attributable to no treatment (§4).
- *Judgment.* The determination is a person's call; it is challengeable, not certain.

---

## 4. Attribution is a query over a typed graph, not a write

### 4a. The layer pattern (Aaron's LexisNexis lineage)

> *"we also had to solve this at LexisNexis for content attribution graphs for payments based on
> each stage of enrichments — we used meta data to track the different contribution layers instead
> of mutating the original source, so every layer survived and could be pointed at as an
> attribution graph surface."*

An `OutcomeRecord` carries **no agent and no blame** — it is a fact about a subject. Treatment
edges are non-destructive metadata over it. Blame is computed at read time under a **named rule**
whose id travels with every reading, so changing the rule is a re-query, not a loss.

Substrate: this is **P1 umbrella `081KSXN940008QG0R001YABTHH`** (first-class labels/tags + scopes
on every G-Set/Z-set entity, `attribution: aaron-otto-2026-05-31`) applied to contribution events —
an edge is a facet on a Z-set entity, in that row's own vocabulary (`faceted-classification`,
`metadata`, `g-set-crdt`, `z-set`, `policy-substrate`). Standing rule:
`memory/feedback_preserve_original_and_every_transformation.md` — *"the final output is not the
artifact — the trail is the artifact."*

### 4b. Edges are TYPED and SIGNED (Shepard's / KeyCite)

Aaron confirmed the anchor: *"Shepard's / KeyCite citation graphs — yes i'm pretty sure this was
the one."* Checked, not merely cited: Shepard's editorial treatments (*followed, criticized,
distinguished, harmonized, explained, overruled, questioned*) type each citing relationship, and
KeyCite's red/yellow/green flag is a **confidence annotation on the fold** — "is this still good
law?" is a fold over typed treatments, never a citation count.

An untyped "agent X touched this" edge throws away the signal that matters most: an agent whose
warning was **overruled and then vindicated by use** is the strongest competence evidence
available, and an untyped graph cannot represent it.

| treatment | stance | derivation |
|---|---|---|
| `authored` | +1 | commit authorship |
| `approved` | +1 | an approving review event |
| `warned` | −1 | a blocking finding |
| `warned-overruled` | −1 | a blocking finding; subject shipped with the cited lines unchanged |
| `repaired` | 0 | a later fix — a claim about the repair, **never folded** |

Deliberately absent, because no sound derivation exists: `distinguished`, `limited`, `harmonized`,
`explained`, `questioned` — each needs a judgement about scope or reasoning no event carries. They
are listed in the code (`NO_SOUND_MECHANICAL_ANALOGUE`) rather than approximated.

**Two provenance classes, both legitimate, not interchangeable:** `authored` labels (a user judged
it) and `mechanical` labels (derived from events). `EVIDENCE_LABEL_PROVENANCE` records which.

### 4c. Why this resolves the attribution problem — and where it does not

Stance scoring means **nothing is divided**, so no division rule is required: each treatment is a
separate falsifiable claim, and reality settles each one.

It does **not** solve co-authorship: N co-authors sharing one `authored` stance produce N
*correlated* observations, not N independent ones. Splitting shared credit needs TrueSkill's team
model, which is **unbuilt on both oracles** — `trueskill.ts:22` defers it, and neither
`TravelerRankLedger.fs` nor its TS port has a team form (`record`/`recordOutcome` take a single
traveler). That absence is the named blocker for shared-outcome attribution.

**Equal weight over all contributors is deliberately not offered.** It is the
unweighted-aggregation defect (PR #10945, found live in PR #10955) moved to the attribution layer,
where it would charge a warner and an approver identically for one failure.

### 4d. Unattributable ⇒ NO update, and it scores the MECHANISM

> Aaron: *"this should mostly just not move weights of the team when this happens but hopefully we
> have an escape hatch that lets us improve mechanism in these cases."*

A defect from an **interaction** between treatments, or from an **omission** no edge contains, is
not an observation about any individual — no likelihood applies, **no posterior moves**. The
Bayesian reading is exact, and the alternative (smear it over the team) is the §4c defect again.

Two consequences, both implemented:

- **A no-update must not read as a clean record.** Every reading carries `mechanismSeen`, so *"we
  learned nothing about these agents"* stays distinguishable from *"they were fine."*
- **The escape hatch:** `mechanismCoverage` banks unattributable / self-labeled / scoped-out
  outcomes against the **attribution mechanism**, with a stated improvement trigger per bucket
  (missing edges · too-coarse vocabulary · too-fine jurisdictions). `every-bug-has-economic-value`
  stays whole: the ΔU is not destroyed, the learner is the system.

**OPEN CASE, not decided** (Aaron said *"mostly"*): an interaction foreseeable by someone whose
**hat** covers integration may be attributable to a *role* even when it is attributable to no
edge. Deciding that here would quietly re-enable blame for the exact class that produces no
evidence. Flagged for the maintainer.

### 4e. Reports, labels, determinations — the recursion terminates

> Aaron: *"this is how we stop low quality AI and human bugs — we don't assume their labels are
> correct, we just listen to the use case and why they were trying to accomplish and then make the
> determination. which also can give bug reporter have a competence level too per area/jurisdiction."*

Three records, and only the first is an original:

1. **`ReportRecord`** — intent + observation (*"I was trying to X and got Y"*). Durable, never
   mutated, survives every disagreement about what it means.
2. **`LabelRecord`** — *"this is a bug"*: an attributed claim, a layer on top.
3. **`DeterminationRecord`** — the verdict, by a **different party**. A re-determination **adds a
   layer**; the earlier one survives and remains readable.

**Reporter competence** is per (reporter, jurisdiction): how often their reports are determined to
be real bugs. That is the defence against a flood of low-quality reports — labels are never taken
as truth, so bad labels cannot corrupt the ledger, and a reporter repeatedly not upheld simply
accumulates low competence *in that area*. A filter that earns its way in, not a gate at the door;
no report is rejected and no reporter is judged as an actor.

**The recursion terminates** because the roles are split and each is measured exactly once
(reporter → evidence; determiner → judgment). The determiner's own quality is where Shepard's
stops and where this stops: editorial standards plus treatments that are **visible and
challengeable**. `determiner` is recorded on every determination precisely so a future challenge
is possible. There is no third measurement layer, deliberately.

---

## 5. Jurisdiction: binding vs persuasive = partial pooling

> Aaron: *"we also support jurisdictional awareness so these findings might be true for one
> jurisdiction but not another."*

A verdict carries its scope, so competence is per **(agent, hat, jurisdiction)**. Label
subjectivity is the *same* mechanism, not a second problem: two users disagreeing about whether
something is a bug is usually *"a bug in my context, not in yours."*

Narrow scoping alone would fragment the evidence into permanent uncertainty. Shepard's answer:
an out-of-jurisdiction authority is **persuasive, not binding** — reduced weight, never discarded.
That is **hierarchical partial pooling** under a legal name (Gelman & Hill 2007, *Data Analysis
Using Regression and Multilevel/Hierarchical Models*, ch. 12).

- Jurisdictions are slash-separated scope paths; distance is measured on shared prefix. The
  hierarchy is **derived** from structure that exists (the per-language oracle lanes), not invented.
- `persuasiveWeight = 1/(1+d)`; `d=0` is binding. **The shape is anchored; the rate is a chosen
  constant awaiting calibration and is labelled `unmetered` in the code.**
- **Guard, with a falsifier:** evidence scoped below `MIN_PERSUASIVE_WEIGHT` does not silently
  vanish — it is reported as `scoped-out` in the mechanism bucket. Scoping must never become a way
  to explain away inconvenient evidence.

**The estimator has no weight parameter** — `updateBelief` takes only `hit`. Partial pooling is
therefore applied here by `temperedUpdate`, interpolating in natural parameters between the current
belief and the full ADF posterior (`τ′ = τ₀ + w(τ₁−τ₀)`, `η′ = η₀ + w(η₁−η₀)`; `w=1` reproduces the
exact ADF step, `w=0` moves nothing). **This is an approximation of a tempered likelihood, not exact
hierarchical pooling**; the exact form needs a hierarchical model the ledger does not have, and
adding a third axis to `TravelerRankLedger` on both oracles is a change for the maintainer, not a
unilateral one. `foldSeriesToLedger` therefore folds **binding evidence only** into the existing
ledger type — the no-pooling mode it actually supports.

---

## 6. Lag, event rate, and what each decision can honestly use

**Lag.** Usage evidence arrives long after the change. So:

| may inform | may NOT inform |
|---|---|
| hat assignment and routing over weeks/months | a PR gate deciding now |
| whether an agent keeps a domain | whether to merge this change |
| where to spend review attention | any per-finding verdict |
| prioritising instrumentation | anything requiring a fresh number |

The agreement prior covers the lag window **for routing only**, and it may never weight the
aggregator that produced it (`agreementPriorAdmissibleFor`, falsified by test).

**Low event rate.** Change failures are rare, so σ shrinks slowly and the prior is load-bearing for
a long time. Measured under this estimator (σ₀²=1, β=1):

| after k use-observations | priorShare = σ²/σ₀² |
|---|---|
| 1 | 0.724 |
| 5 | 0.269 |
| 10 | 0.147 |
| 50 | 0.031 |

**The prior cap is justified against that rate, not chosen by taste.** With |μ₀| ≤ 1.0, **one**
contrary use-observation flips the sign of μ₀ ∈ {0.25, 0.5, 0.75} and **two** flip μ₀ = 1.0. A
prior needing dozens of observations to wash out would make agreement the determinator in practice
while this document claimed use was. Every reading reports `priorShare` and `bindingCount`, so a
number resting mostly on agreement is legible as such.

**What would have to be recorded to create the determinator signal:**

1. a **deployment/ship event** per subject (there is none today);
2. a **defect → subject link** (`caused_by` / `introduced_by`) — gap 3;
3. a **clean-usage window** per subject (the negative evidence, without which the ledger only ever
   sees failures);
4. an **agent identity** on contribution events, distinct from the tool name — gap 4;
5. a **determination** record separate from the report, by a different party — §4e.

Items 1–3 need real use. Items 4–5 could be recorded today.

---

## 7. Where the record lives, and why not `db/uncertainty/`

`db/ledgers/README.md` states the doctrine: *"A ledger holds exactly one scope… the uncertainty
ledger carries ΔU."* Competence outcomes are a different scope, and there is a structural reason
they must not ride the uncertainty ledger: **the uncertainty ledger is commutative/order-free, and
ADF is not.**

Measured, not assumed — the same multiset {3 hits, 2 misses} in two orders:

```
[H,M,M,H,H] -> mu 0.2113  sigma2 0.2628  trustBand 0.5746
[H,H,H,M,M] -> mu 0.1829  sigma2 0.2777  trustBand 0.5643
```

So the store defines a canonical order (`(at, address)` under the codepoint-ordinal treaty
comparator — never `localeCompare`) and cannot claim the uncertainty ledger's order-freedom.

**Location:** `db/competence-outcomes/{edges,outcomes}/<recorder>.jsonl` — append-only JSONL, one
file per recorder so concurrent writers never contend, content-addressed and deduplicated on read.
Same pattern and reasoning as `db/mutation-findings/` (67 rows, per-agent, address-keyed,
idempotent), which is the in-tree precedent rather than a new invention.

Timestamps are the timestamp **of the fact**, never a recording wall clock — a recorder's local
clock must not enter a shared fold (`local-time-never-enters-the-shared-fold`), and a derived
timestamp is what makes re-import idempotent.

---

## 8. What was built, and the falsifiers

`src/Core.TypeScript/planning/competence-attribution.ts` — series + evidence tables and the two
independence invariants; typed/signed treatments; content-addressed records; canonical order;
append-only store; `attribute` (the query); `mechanismCoverage`; the agreement prior and its
anti-circularity gate; `temperedUpdate`; `readCompetence` (with a `prior-only` case) and
`foldSeriesToLedger`.

`src/Core.TypeScript/planning/competence-report-layers.ts` — report → label → determination, and
reporter competence per (reporter, jurisdiction).

`src/Core.TypeScript/planning/competence-attribution.test.ts` — 38 tests, and **12/12 mutants
killed**:

| mutant | result |
|---|---|
| M1 posterior update becomes identity | KILLED (8 tests red) |
| M2 one observation dropped from the fold | KILLED (10) |
| M3 `reviewer-quorum-agreement` admitted into `use-defect` | KILLED (3) |
| M4 self-labeling guard removed | KILLED (1) |
| M5 unattributable outcome dropped silently | KILLED (4) |
| M6 append made non-idempotent | KILLED (1) |
| M7 fold in receive order instead of canonical | KILLED (1) |
| M8 agreement prior unclamped | KILLED (1) |
| M9 prior allowed to weight its own source | KILLED (1) |
| M10 scoped-out evidence silently folded | KILLED (1) |
| M11 `review-vote` made foldable | KILLED (1) |
| M12 stance ignored (outcome charged directly) | KILLED (2) |

**Owned error.** M7 initially **SURVIVED**: the order test used `[H, M, H]`, a palindrome, so
reversing it changed nothing. The test asserted a property it could not observe — the vacuity class
in miniature. Fixed to `[H, H, M]`, which the mutant now fails. Recorded because the whole point of
this ledger is that a check which cannot fail is not a check.

Gates: `bun test` 38 pass / 0 fail · `tsc --noEmit` clean · `eslint` clean on all three files.

---

## 9. Nothing is wired in

No aggregation consumes any of this. No review board, no society, no gate. Weights go live only
after the ledger has data and has been validated, and that is Aaron's call. The failure mode being
avoided is precisely the one that produced `calibration-ledger`: right shape, wrong quantity, wired
in anyway.

---

## 10. Findings made in passing (named, not fixed)

1. **`work-items/dora-fold.ts:109,160` sort with `localeCompare`** — culture-sensitive, against the
   collation treaty (`.claude/rules/culture-invariant-by-default.md`). Latent: it activates on
   non-ASCII work-item ids. Deserves its own diff.
2. **`archive-pr-reviews.ts` "fix commits" are not time-filtered.** In
   `PR-10406-…-passkey-signed-gated-proposals.md`, a commit at `22:32:19Z` is listed as a fix
   commit for a review thread created at `22:37:31Z` — five minutes *earlier* than the comment.
   Any `proxy-acted-on` importer must apply its own causality filter (commit time > comment time)
   and its own path/line check; the archive's list is "commits in this PR touching thread paths",
   not "fixes".
3. **`db/mutation-findings/*.jsonl` is per-agent but is not a competence signal as it stands.** Its
   `outcome` says whether the *suite* distinguished a mutant; the `agent` is the runner, not the
   test author. It becomes a competence signal only in the *prediction* form PR #10928 designed —
   which needs a `predicted` field the current schema does not have.

---

## 11. Open questions for Aaron

1. **The role-level open case (§4d):** should an omission attributable to an *integration hat* move
   that hat's weight, even though it is attributable to no edge? Deciding it re-enables blame for
   the no-evidence class; leaving it open leaves a real signal on the table.
2. **Should `TravelerRankLedger` gain a jurisdiction axis and a weighted update** on both oracles?
   That is the principled home for §5, and it is a change to a shared estimator.
3. **Who determines?** §4e requires a determiner distinct from the reporter. For agentic users at
   scale, what is the determination process — a hat, a rotation, you?
4. **Which of gaps 1–5 in §6 do you want instrumented first?** Items 4–5 are recordable today; 1–3
   wait on real use.

---

## Anchors

- **Shepard's Citations (1873) / KeyCite** — typed, signed treatment folds over precedent; the
  flag is a confidence annotation on the fold. Treatments are editor-authored judgments.
- **Aaron Stainback, LexisNexis** — content-attribution graphs for per-enrichment-stage payment;
  metadata layers over an unmutated source (`memory/user_lexisnexis_legal_search_engineer.md`,
  `docs/books/you-born-at-the-hinge/RAW-the-data-years-lexisnexis-ess-redistricting.md`). Aaron
  additionally names data-provenance and governance work from that era as part of the same
  lineage; I did not find an in-repo document specific to that governance work and am not implying
  its absence.
- **Gelman & Hill 2007** — hierarchical partial pooling (the binding/persuasive discount).
- **Herbrich, Minka & Graepel 2006** (TrueSkill) · **Minka 2001** (EP/ADF) — the estimator.
- **Forsgren, Humble & Kim 2018**, *Accelerate* — DORA; and the reminder that its four keys are
  team-level by design.
- **Brier 1950 · Gneiting & Raftery 2007** — via `calibration-ledger.ts`, the sibling estimator.
