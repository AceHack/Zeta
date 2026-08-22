# Report triage — a multidimensional priority queue with information gain as the primary dimension

**Date:** 2026-08-16 · **Author:** shadow (routed by Otto) · **Register:** design doc; the code it
describes is `unmetered` (see §9) · **Status:** design + a partial reference implementation
(`src/Bayesian/ReportTriage.fs`), wired into nothing.

---

## 0. This is TRIAGE, not judgement — read this before anything else

**Nobody is being labelled defective.** Not a person, not an agent. This document describes an
*ordering* over incoming reports, and an ordering is not a verdict about whoever sent them.

Aaron, 2026-08-14, in his own words — the framing this whole design has to survive into:

> *"we are not trying to label a person or agent as defective, simply triage incoming reports — and
> the ones who've had high quality reports in an area/jursitions in the past, when there are resource
> constraints, would make the reports from ones with more constructive experinece in a area the right
> choice to look at first, unless there is severity routing that could get in there. it's like a
> multidimenisonal priority queue, i've built these before and even has it where the dimeansion
> weithings were dynamic and could change over time."*

Two consequences, stated plainly because they are the difference between a queue and a verdict:

1. **The ordering only bites under scarcity.** With enough capacity to examine every report, every
   report *is* examined and the order they were examined in changes nothing. The queue is a
   response to a resource constraint, and it has no meaning in the absence of one. A design that
   quietly turns "we got to yours later" into "yours was worth less" has broken the frame.
2. **A low position is a statement about the queue's current information, never about the reporter.**
   The same reporter's next report can sort first. Nothing here is a durable mark on anyone, and no
   surface in this design emits a per-reporter ranking as a product. The reporter-history term is an
   *input to an ordering*, not an output about a person.

**Beacon anchor for the frame itself.** Triage as a discipline comes from Dominique Jean Larrey,
Napoleon's surgeon-in-chief, who ordered battlefield treatment by *severity of need* and explicitly
**irrespective of rank or nationality** — including enemy wounded. The founding act of triage was the
removal of a status judgement from an ordering decision. That is exactly the property Aaron is asking
for, and it is 220 years old.

**Capacity is the real fix; the queue is the palliative.** Anywhere this design is deployed, the
honest reading of a long queue is "we are under-resourced here", not "the tail was low quality."

---

## 1. What this replaces: the naive design, and why it is wrong

The obvious construction is **track-record-primary with a severity override**: sort by the reporter's
historical quality in this area, and let a severity flag jump the line.

It has a specific, systematic failure:

> **A newcomer's critical find is buried by construction.** A first-time reporter has no track record,
> so they sort at the bottom of the primary key. Their report is then not examined, so they acquire no
> track record, so their next report also sorts at the bottom. The severity override is the only escape
> hatch, and it fires on *self-declared* severity — which is both gameable and, for a genuinely novel
> class of problem, usually understated by the person reporting it (they do not yet know what they
> found).

This is not a tuning problem. It is what the construction *does*. So the design goal is a primary
dimension under which **a severe report from an unknown reporter sorts high on its own merits**.

---

## 2. The proposal: order by expected belief change (information gain)

Order reports by **how much examining them would move what we believe** — not by who sent them.

Under this construction:

- A report claiming something surprising and consequential sorts high **because the claim is
  surprising and consequential**, regardless of who filed it.
- Reporter track record enters only where it belongs: **two reports that would teach us about equally
  much** get separated by "who has been right about this area before." That is precisely the case
  where track record is the correct tiebreak, and it is the case Aaron described.
- A newcomer cannot be buried, because their score is dominated by the content of their claim.

### 2.1 What already exists in this repo (verified by reading, not assumed)

I read `src/Bayesian/AttentionRouter.fs` and `src/Bayesian/InformationValue.fs` in full. What is
actually there:

| thing | file:line | what it does |
|---|---|---|
| `klDivergence p q` | `AttentionRouter.fs:12` | exact closed-form KL between two Gaussians in natural parameters |
| `symmetricKL` | `AttentionRouter.fs:24` | its own comment: *"the information distance between two agents' beliefs"* |
| `routingWeight` | `AttentionRouter.fs:66` | `KL(from‖to) × (1 + trajectoryAlignment)/2` — a multidimensional weight already |
| `reticulumRoutingWeight` | `AttentionRouter.fs:77` | the above × the Condorcet/delay bonus |
| `InformationValue.compute prior posterior` | `InformationValue.fs:37` | **KL(posterior ‖ prior) — Lindley (1956) information gain** |
| `InformationValue.valueOfMessage prior message` | `InformationValue.fs:70` | `compute prior (prior * message)` — "how much IV did this message provide?" |

So the frozen-core register's description of `AttentionRouter.fs` as *"KL × alignment × Condorcet
bonus"* (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md:156`) is accurate: it is **already a
multidimensional routing weight**. What it routes is **attention between agents**, not **incoming
reports** — the same shape, one level over. This design is that shape applied one level down.

`InformationValue.valueOfMessage` is, notably, *exactly* the function a report queue wants: give it a
prior over the thing being claimed and the claim as a message, and it returns the belief movement.
Invariants IV-1..IV-7 are proven under FsCheck per the frozen-core register (non-negativity,
monotonicity in precision gain and in mean shift).

### 2.2 The honest prerequisite — and what it costs

**KL needs a posterior over the thing being reported.** You must model the claim before you can
measure how much it would move you. Concretely, `valueOfMessage` needs two Gaussians:

- a **prior** over some named variable, and
- the **report expressed as a Gaussian likelihood** over that same variable.

So the load-bearing question is: **do incoming reports carry a claim that can be typed this way?**

**Verified answer: not today, for the reports we actually receive.** I searched for a claim-typed
report format — something carrying (variable, estimate, uncertainty) — and did not find one. What
exists is adjacent but not sufficient:

- `TravelerRankLedger.SkillBelief` (`src/Core/TravelerRankLedger.fs`) is a Gaussian, but over a
  *reporter's skill*, not over the *claim's subject*.
- `SignalQuality` (`src/Core/SignalQuality.fs`) scores content quality of text in `[0,1]` with
  `Pass/Warn/Fail/Quarantine` bands. Real, computable, and useful — but it measures *how the report
  reads*, not *how much its content would move a belief*.
- `GossipTelemetry` / `KeptClaimOracle` carry boolean self-claims, not distributions.

**Therefore, stated plainly, because Otto asked me to say it rather than let it be inferred:**

> For today's real inbound reports, which are free text, **information gain is not computable**, and
> the queue collapses to **severity + track record + recency**. That is the materially weaker design —
> the one whose failure mode is §1. The information-gain construction is real and its machinery
> already exists and is tested; what is missing is a **producer**, not a scorer.

**The cheap fix, and it is the recommendation.** The gap closes with a *report format*, not with more
scoring machinery: let a report optionally carry `{ variable; estimate; uncertainty }`. Any report
that carries it gets the exact KL path immediately, using functions that already exist and are already
proven. Reports that do not carry it fall back to the proxy in §4.1, which is **labelled as a proxy at
the type level** so it can never be mistaken for a measurement.

This is why §5's `InfoGain` case is `ClaimTyped of exact` versus `Proxy of ...` rather than one float:
the design refuses to launder a proxy into a measurement.

### 2.3 Ordering by claimed gain is cheap — and therefore gameable

A subtlety worth being explicit about, since it is the difference between this working and not:

Computing "how much would this move me *if true*" requires **parsing** the claim, not **verifying**
it. Parsing is cheap; verification is the expensive examination the queue is rationing. So the
ordering is computable before the expensive work — which is the entire point of a triage queue.

But it means the score reads a **self-asserted precision**. A reporter who claims `σ → 0` claims
infinite information gain and takes the front of the queue forever. Unmitigated, this is a trivial
attack.

**The mitigation is structural and it is where track record belongs:** discount the *claimed
precision* by the reporter's posterior for that (area, jurisdiction).

```
effectivePrecision = claimedPrecision × λ(reporter, area, jurisdiction)
```

This is a better construction than adding track record as another additive term, for three reasons:

1. It is **Bayesian rather than ad hoc** — "how much do I trust this likelihood?" is a question about
   a likelihood, so it belongs inside the likelihood, not bolted alongside it.
2. It **automatically produces Aaron's tiebreak**. When two reports claim similar movement, λ decides
   — which is exactly *"the ones who've had high quality reports in an area … the right choice to look
   at first"*. Nobody had to write a tiebreak rule; it falls out.
3. It **bounds the burial**, which the naive design does not (see §2.4).

### 2.4 The anti-burial property — the fairness guarantee, stated so it can be tested

`TravelerRankLedger.trustBand` returns **0.5 for a fresh identity** — an honest prior, deliberately
not a pessimistic clamp (that file's own comment: *"Fresh identity: trustBand = 0.5 (honest prior),
not 0.0"*, and *"Whitewash window closed"*). So with `λ = trustBand` and a **floor λ_min > 0**:

- KL is **monotone increasing** in message precision (IV-2/IV-3, already proven).
- A newcomer's claim is therefore discounted by a bounded factor, **never zeroed**.
- Consequently the ratio between a fresh reporter's score and a maximally-trusted reporter's score on
  *the same claim* is **finite and bounded away from zero**.

> **The property to hold onto:** track record can *scale* a newcomer's report; it can never *silence*
> it. A large enough claim outranks a small claim from a trusted reporter. That is the §1 failure
> designed against, and it is a testable invariant, not a hope.

`λ_min > 0` is the load-bearing guard. If λ is ever allowed to reach 0, the anti-burial property is
gone and the design has silently become the naive one.

---

## 3. The dimension set, each labelled by whether it is computable today

Aaron's list is the starting point; the set below is derived, and one dimension (#6) is added
because it falls out of the information-gain frame and is a real anti-brigading property.

| # | dimension | computable today? | source, or what is missing |
|---|---|---|---|
| 1 | **Information gain** | **partial — `computable` for claim-typed reports, `placeholder` otherwise** | `InformationValue.compute` exists + is FsCheck-proven; **no producer of claim-typed reports exists** (§2.2) |
| 2 | **Severity / blast radius** | **`placeholder`** | no blast-radius model exists. `SignalQuality` gives a real `[0,1]` *content-quality* score with severity bands — adjacent, and **not the same quantity**. Caller-supplied scalar for now. |
| 3 | **Reporter track record per (area, jurisdiction)** | **`computable`** | `TravelerRankLedger` is already keyed `(travelerId, hatDomain)` with a Gaussian posterior + `trustBand`. See §3.1 — the (area, jurisdiction) key needs **no change to that file**. |
| 4 | **Recency** | **`computable`, with a rule-level caveat — see §3.2** | trivially computable; the caveat is what matters |
| 5 | **Cost-to-examine** | **`placeholder`** | nothing measures it. Note it should **divide**, not subtract — §3.3 |
| 6 | **Marginal novelty vs already-queued** (added) | **`computable-partial`** | duplicates carry near-zero *marginal* gain; `AntiSybil` supplies same-source facts. §3.4 |
| 7 | **Cry-wolf: severity-claim calibration per (reporter, area, jurisdiction)** (Aaron) | **`blocked` — machinery exists, the rubric does not** | severity is gameable, so measure whether severity *claims* hold up. The Beta/Brier machinery is already built; **no severity rubric exists to check claims against** — §3.5, §3.6 |

### 3.1 (area, jurisdiction) costs nothing to key

`TravelerRankLedger.Ledger` is `Map<string * string, SkillBelief>` over `(travelerId, hatDomain)`.
Per-(area, jurisdiction) track record is obtained by composing the domain string:

```
hatDomain = area + "" + jurisdiction        // ASCII US, ordinal, no separator collision
```

No edit to `TravelerRankLedger.fs` is required — which matters, since it is in-flight work owned
elsewhere. Composition is **ordinal** (`culture-invariant-by-default`); the separator is ASCII Unit
Separator so it cannot collide with a human-authored area or jurisdiction name.

**Consequence worth naming:** finer keys mean sparser evidence, so most (reporter, area, jurisdiction)
cells sit at the fresh prior 0.5 forever. That is *correct* — it means the queue mostly runs on claim
content, and track record only speaks where it has actually accumulated evidence. The Gaussian's
`Sigma2` already carries "how much do I know about this cell", so an unconfident λ can be shrunk
toward 1.0 (neutral) rather than applied at face value.

### 3.2 Recency is admissible here **only because this queue is a local action**

`.claude/rules/local-time-never-enters-the-shared-fold.md` is directly on point and this is exactly
the mistake it was written to catch in advance.

- A triage queue answers *"which report do **I**, this examiner, read next"* — a **local action**. The
  rule explicitly permits local wall-clock to steer local behaviour, so recency is fine **here**.
- The instant this ordering feeds a **shared** conclusion — two nodes needing to agree on what was
  examined, or the ordering filtering evidence entering a commutative fold — **local time has leaked**
  and nodes fold different evidence sets and diverge.

**Guard, carried in the code:** the recency term is computed from a caller-supplied age and the module
does not read any clock (no ambient time — §13 noninterference). If this queue is ever consumed by a
shared fold, the recency dimension must be dropped or replaced with agreed phase.

### 3.3 Cost-to-examine divides; it does not subtract

The objective is value **per unit of the scarce resource**. Subtracting cost is dimensionally wrong
and mis-orders whenever costs differ by more than the weight scale.

**Beacon anchor:** Smith's rule (W. E. Smith, 1956) — sequencing by weight/processing-time ratio
(WSPT) minimises total weighted completion time on a single machine. The queue's scarce resource is
examiner time, so `score / expectedCost` is the classical form, not an invention. (`Cost` is a
placeholder today; the division shape is fixed now so that adding real cost data later does not
require re-deriving the ordering.)

### 3.4 Marginal novelty — why 50 copies of a report should not sort 50× high

This falls straight out of the information-gain frame: the *second* report of the same finding moves
the posterior far less than the first, because the first already moved it. Scoring marginal rather
than absolute gain gives duplicate-resistance and brigade-resistance for free, with no separate
anti-spam rule.

Two honest caveats:

- **It makes the score order-dependent** (each pop changes the scores of what remains) — a greedy
  algorithm over a set function, not a static sort. That is a real complexity cost.
- The `(1 − 1/e)` greedy optimality bound (Nemhauser, Wolsey & Fisher, 1978) applies **only if the
  objective is submodular**, which for information gain is a *modelling assumption*, not a general
  truth (Krause & Guestrin 2005 note mutual information is not submodular in general). **Register:
  `toy`.** Cited as motivation, not as a proven bound for this objective. Marked as such in the code.
- Under the dual-use rule, `AntiSybil` supplies the **neutral fact** ("same source as known"), and
  this consumer chooses the reading (here: down-weight marginal novelty). It must not be read as
  "forger caught."

### 3.5 Cry-wolf — a separate dimension from track record, and it must stay separate

Aaron, 2026-08-14:

> *"even severity can be gamed, so we also had a cry wolf kind of meter that would look for pople in a
> area/jursidction that would keep saying critical for things that were really low."*

This closes a hole §2.3 only half-closed. There I discounted the *claimed precision* of a claim-typed
report by the reporter's track record. But the **severity** input — which is the entire ordering
signal on the free-text path, i.e. the path everything actually runs on today — was still taken at
face value. A reporter who marks everything critical takes the front of the queue indefinitely.

**The correction: measure severity-claim accuracy per (reporter, area, jurisdiction), and keep it in
its own ledger.**

> **Two ledgers, because they are two different failures:**
>
> | question | failure it detects | ledger |
> |---|---|---|
> | *"are your findings real?"* | reports things that turn out not to be there | validity — `TravelerRankLedger`-shaped |
> | *"is your severity claim calibrated?"* | findings are real, the severity claim is inflated | **cry-wolf — its own ledger** |

Merging them corrupts both, in both directions:

- Merged, a **excellent finder who is miscalibrated on severity** gets their real findings deranked —
  penalising good work for a labelling habit.
- Merged, a **miscalibrated reporter who is usually right** has their inflation laundered by their
  validity record — which is precisely the gaming Aaron is describing, surviving the fix meant to
  catch it.

They are also independent in practice: severity judgement is a *different skill* from finding things,
and a reporter can be strong at one and weak at the other. A single scalar cannot represent two
independent quantities without losing one.

**This is calibration in the strict technical sense**, not competence — and the distinction matters
because the repo already draws it. `calibration-ledger.ts` computes exactly this quantity (Beta
posterior, Brier score; Gneiting–Raftery proper-scoring-rule anchored) for deadline intervals, and its
own contract states that **calibration ≠ competence**. Cry-wolf is that same measure applied to
severity claims instead of deadline intervals.

**So: reuse the machinery, do not re-derive it.** A proper scoring rule over "claimed severity vs
adjudicated severity" is the same computation with a different input. (That file is owned by another
agent in flight and is **not edited** by this change — §7 relays the ask.)

**And the framing guard applies with force here.** "Cry-wolf" is a Mirror-register name and it sounds
like an accusation. What is actually computed is a **calibration offset**: *this reporter's severity
claims in this area have historically run N levels high.* The honest use is to **correct for the
offset** — subtract it and use the corrected severity — not to punish the reporter. A systematic
over-claimer whose corrected severity still sorts high is still examined first, and correctly so. That
is triage, not judgement (§0), and it is also simply the more useful behaviour: a known offset is
information, not a demerit.

### 3.6 The rubric is the prerequisite — and Zeta does not have one

Aaron, 2026-08-14:

> *"we had an exact rupric of what the differnt severaty levels were and it could be cross checked
> valid"*

This is load-bearing infrastructure, not bureaucracy. Without an objective scale, *"you said critical
and it was actually low"* is **two people disagreeing**, and building a meter on top of a disagreement
manufactures a false measurement. With a rubric it is a **checkable mismatch against stated
criteria** — third-party verifiable, and the reporter can contest the adjudication on the rubric's own
terms rather than against someone's judgement. That last property is what makes cry-wolf fair enough
to run at all.

**Verified state of the repo today — searched by behaviour, not by the word "rubric":**

| what exists | where | is it a rubric? |
|---|---|---|
| `P0 \| P1 \| P2 \| P3` priority labels, schema-enforced | `src/Core.TypeScript/backlog/lint-frontmatter.ts:34`, `autonomous-pickup.ts:13` | **no** — an enum, validated for *well-formedness*, never for *correctness* |
| one-line glosses: "critical / blocking", "within 2-3 rounds", "research-grade", "convenience / deferred" | `docs/backlog/README.md:29-32` | **no** — and note these are mostly **urgency/latency** descriptors, not severity criteria |
| `**Severity:** P0 \| P1 \| P2` in the bug entry format; "P0 — ship-blockers" | `docs/BUGS.md` | **no** — a field with a heading, no criteria |
| `QualitySeverity` = `Pass/Warn/Fail/Quarantine` with numeric band cutoffs | `src/Core/SignalQuality.fs:83,137` | **closest thing there is** — the cutoffs *are* objective, but they band a *content-quality* score, not incident impact |

**Conclusion, stated as the blocker it is:**

> **Zeta has a severity *label taxonomy*; it has no severity *rubric*.** Nothing in the repo states
> the observable conditions under which a report *is* P0 rather than P1, so no severity claim in this
> repo is currently falsifiable. **Cry-wolf cannot be built until that exists** — building it first
> would produce a meter measuring disagreement and calling it miscalibration.

There is a second defect visible in the table that a rubric would fix on its way past: the current
glosses **conflate severity with urgency** ("critical / blocking" vs "within 2-3 rounds" are answers
to different questions). Impact and time-to-act are separate axes, and a queue that has to reason
about scarcity needs them separated regardless of cry-wolf.

**This is small, tractable, well-anchored work** — and it is a prerequisite, not part of this design.
It should not be done inside a queue implementation: inventing severity levels as a side effect of
building a scorer is how a rubric ends up shaped by what was convenient to compute. Anchors for
whoever picks it up: **CVSS** (FIRST) — the widely-used worked example of a severity scale with
per-level observable criteria and independent re-derivation; and the standard **impact × likelihood**
decomposition, which keeps impact separable from urgency. The test the rubric must pass is Aaron's
own: *"it could be cross checked valid"* — two independent adjudicators applying it to the same
report should land on the same level.

---

## 4. Scoring

### 4.1 Per-dimension terms

```
score(r) = ( Σ_d  w_d · φ_d(r) ) / expectedCost(r)
```

with each `φ_d` normalised to `[0, 1]` so weights are commensurable, and:

- `φ_info` — **either** `InformationValue.valueOfMessage prior (discounted claim)` squashed into
  `[0,1]`, **or** the labelled proxy below.
- `φ_sev` — the **cry-wolf-corrected** severity: caller-supplied claimed severity in `[0,1]`, minus
  the reporter's historical severity-claim offset for this (area, jurisdiction) (§3.5). **Placeholder
  today** on both halves: no rubric ⇒ no correction is computable (§3.6), so this is currently the raw
  claimed severity, and the correction term is identically zero and labelled as such.
- `φ_track` — `TravelerRankLedger.trustBandOf reporter (area ⊕ jurisdiction)`; enters as λ inside
  `φ_info` when the claim is typed, and as a standalone weak term when it is not. **Validity only** —
  it must not absorb severity calibration (§3.5).
- `φ_recency` — caller-supplied age → monotone decreasing in `[0,1]`. Local-action only (§3.2).
- `φ_novelty` — `1 − (similarity to already-examined/queued)`. Partial.

**The proxy, stated explicitly rather than assumed away** (§2.2 requires this). When a report is not
claim-typed:

```
φ_info_proxy = φ_sev_corrected · λ_validity(reporter, area, jurisdiction)
```

i.e. *"a claim we cannot model is worth, in expectation, its asserted severity discounted by how much
that reporter's assertions have been worth here before."* It is a **stand-in and nothing more**. In
the code it is a distinct union case, so:

- no caller can confuse a proxy score with a measured one,
- a queue can report **what fraction of its ordering rests on proxy** — which is the number that says
  how much of the good design is actually running.

### 4.2 Register

Per `toy-is-free-metered-must-be-earned`: the composite score has **no falsifier** — no outcome data
exists to check the ordering against. **The queue is `unmetered`.** The proxy path is `toy`. Only the
`InformationValue` KL underneath is `metered` (IV-1..IV-7 under FsCheck), and *only* on the claim-typed
path. This distinction is carried in the code, not just in this doc.

---

## 5. Dynamic weights, and the one guard that matters

Aaron wants the dimension weights **dynamic, changing over time** — he has built these before, and
that experience is the human anchor for this section.

### 5.1 The circularity

> **The queue's ordering shapes which reports get examined, which shapes the outcomes that retune the
> weights. Reports never examined generate no evidence, so a dimension can quietly self-confirm.**

A weight that pushes reports to the bottom of the queue prevents the evidence that would have
corrected it from ever existing. The dimension then looks well-calibrated **because it was never
tested**, and the confidence is an artifact of the selection, not of the world.

**Beacon anchors, and this failure is well documented:**

- **Lum & Isaac (2016), "To predict and serve?"** and **Ensign et al. (2018), "Runaway Feedback Loops
  in Predictive Policing"** — the same structure, empirically demonstrated: directing attention by a
  model's own predictions makes the resulting observations confirm the model regardless of ground
  truth. This is the closest published analogue and it is worth reading before tuning anything here.
- **Heckman (1979)** — selection bias when the observed sample is chosen by the process being
  estimated.
- The failure is a specific case of a class already handled in this repo: *a check that did not run
  looking like one that passed* (`CLAUDE.md`, heartbeat-via-commit).

### 5.2 The escape: a holdout set the queue never influenced

Aaron has built this before, and his answer is better than the randomised-exploration floor I reached
for first. 2026-08-14:

> *"if we enable full feedback — my old one was manually tuned based on expert review off withheld
> hand labeled bugs from the past, and a knob to tune and see how it would split into labels and how
> closely it matched the hand drawn labels. it was a huristic hack; automatic feedback would be
> prefered if we can avoid the circular dependency."*

He calls it a heuristic hack. **It is not** — it is the train/holdout split, and it is the principled
solution to exactly the circularity in §5.1. The reason it works is precise and worth stating:

> **The queue's ordering never selected the holdout set, so evaluating against it cannot
> self-confirm.** The reports were labelled by expert review, independently of any score the queue
> would have assigned. Selection bias is broken at the source rather than compensated for downstream.

Every mitigation in §5.3 is damage control by comparison; this one removes the defect.

**So the answer to Aaron's stated preference — "automatic feedback would be preferred if we can avoid
the circular dependency" — is: yes, automatic feedback is safe, *provided* it is evaluated against a
holdout the queue never influenced.** The circularity is not a property of automation; it is a
property of training on your own selections. Automate the knob-turning, keep the evaluation set
clean, and the loop is broken.

**Preserve his procedure as the evaluation method** even once tuning is automatic, because it is the
part that carries the meaning:

1. Turn the weight knob.
2. See how the queue splits the withheld reports into labels.
3. Measure how closely that split matches the hand-drawn labels.

Automating step 1 changes nothing about steps 2 and 3. What made his version work was never the
manual knob — it was the withheld labels, and those stay.

**Two honest caveats, because a holdout is not free:**

- **A holdout goes stale.** It is a sample of the past. As the system, the report mix, and the
  jurisdictions change, "matches the 2024 labels" drifts away from "orders today's reports well" —
  and a stale holdout is worse than none, because it reports confidence in a world that no longer
  exists. **It must be refreshed on a stated cadence**, with fresh expert-labelled reports drawn in a
  way the queue did not influence (which is what §5.3(a) is now *for* — see below).
- **Repeated tuning against one holdout overfits it.** Every evaluation leaks a little information
  from the holdout into the weights; enough rounds and the weights are fitted to that particular
  sample and the score stops predicting anything out-of-sample. This is test-set leakage through
  repeated evaluation, and it is well documented (Dwork et al. 2015, adaptive data analysis). **So
  the holdout needs a consult budget** — a stated maximum number of evaluations between refreshes —
  and the count must be recorded alongside it. An unbudgeted holdout silently becomes a training set.

**Concrete policy proposed** (numbers are `placeholder` — they need Aaron's operating experience, not
my guess): partition into a **tuning set** consulted freely and a **sealed set** consulted at most *k*
times per refresh cycle, with the sealed set being the one that reports the real number; refresh both
on a fixed cadence; record `(labelled_at, consult_count)` with every holdout so staleness and leakage
are visible rather than assumed away.

### 5.3 Complementary mitigations — chosen, with the reason each was chosen

These do not replace the holdout; they keep it fed and bound the damage between refreshes.

**(a) A randomised exploration floor — CHOSEN, and its main job is now the holdout, not the tuning.**
A fixed fraction ε of examination capacity is drawn from the queue **ignoring the score**, so
low-ranked reports are sometimes examined anyway (Robbins 1952; ε-greedy; Auer, Cesa-Bianchi &
Fischer 2002). Its value under the corrected design is sharper than I first had it:

> The holdout must be refreshed with reports **the queue would otherwise never surface** — otherwise
> each refresh re-inherits the current queue's blind spots and the holdout slowly stops being
> independent of it. **Randomised exploration is the sampling mechanism that keeps successive
> holdouts unbiased.** Without it, "refresh the holdout" quietly means "resample from what we already
> look at."

*Determinism requirement, non-negotiable here:* the randomness must arrive through an **injected,
seeded source**, never `Random()` or any ambient entropy — §13 noninterference and §7 DST. The
implementation takes a `nextUniform: unit -> float` parameter. A queue you cannot replay is a queue
you cannot debug, and an ambient RNG would make every triage decision unreproducible.

**(b) `Unexamined` recorded as distinct from `Examined → found nothing` — CHOSEN, and it is the
cheapest of the three.** A three-valued outcome, where **only the `Examined*` cases may feed weight
retuning**. Treating "never looked" as "nothing there" is precisely how the loop closes. Free to
implement, and it makes the censoring visible rather than silently folded into the evidence.

**(c) A cap on weight movement per tick — CHOSEN.** `|Δw| ≤ κ` per update, a trust region. It does not
break the loop (a slow wrong loop is still wrong), but it bounds the damage per tick and buys
observation time before a weight runs away. Cheap; kept for that reason and no other.

**The standing rule, in its corrected form:**

> **The weights must never be retuned solely by outcomes the weights selected.** Retuning is evaluated
> against the **holdout** (§5.2); the exploration sample is what keeps successive holdouts unbiased;
> and `Unexamined` is never scored as evidence.

### 5.4 What would falsify the weights (i.e. what would make this `metered`)

Today: nothing, which is why §4.2 says `unmetered`. What would earn the promotion is now concrete,
and it is Aaron's procedure stated as a test:

- **A withheld, expert-labelled set of past reports.** Score them with the current weights, and
  measure how closely the induced split matches the hand-drawn labels. **If the ordering does not
  reproduce the expert labels better than chance, the weights are refuted** — a real falsifier, and a
  cheap one, because it needs no live deployment and no outcome telemetry, only labels.
- **The measure must be stated in advance** (rank correlation against the labels, or agreement on the
  top-k split — pick one and fix it), or the evaluation becomes a search for a metric that flatters
  the weights.
- **The consult budget must be respected** (§5.2), or the "falsifier" degrades into a training signal
  and stops falsifying anything.

The gap between today and `metered` is therefore **a labelled dataset, not an algorithm** — the same
shape as the §2.2 gap, where what is missing is a producer rather than a scorer. That is worth
noticing: both of this design's two unmet requirements are *data*, and both are tractable.

---

## 6. What this design deliberately does not do

- **No blocking gate.** The queue orders; it never rejects. Nothing is dropped for scoring low —
  under scarcity it waits, and if capacity arrives it is examined. A score is not a filter.
- **No per-reporter ranking as an output.** λ is an input to an ordering. Emitting a reporter
  leaderboard would be the "labelled defective" outcome the framing forbids, and it is not built.
- **No editing of in-flight work.** `TravelerRankLedger.fs`, `Levels.fs`, `Society.fs`,
  `agentic-organization/packages/**`, `calibration-ledger.ts` are read-only for this change. §3.1 was
  designed specifically so no edit is needed.
- **Nothing is wired into a live path.** No gate, no heartbeat lane, no existing queue.

## 7. Where the design needs something owned elsewhere (for Otto to relay)

1. **A claim-typed report format** is the single highest-value unblock (§2.2). Without it the
   information-gain design does not run and the queue is severity + track record. This may belong to
   the competence-ledger design work.
2. **Whether `TravelerRankLedger` will accept a composite `(area ⊕ jurisdiction)` hatDomain** as a
   legitimate key, or whether that owner would prefer a widened key. §3.1 needs no change from them,
   but they should know the key is being composed this way.
3. **Cost-to-examine** has no producer. If the aggregation-DU work meters examiner effort, that is
   the natural source.
4. **A severity rubric — the named prerequisite, and the one I would do first** (§3.6). Zeta has
   `P0..P3` labels with no criteria, so no severity claim here is currently falsifiable and cry-wolf
   cannot be built. Small, tractable, and it should be done *outside* any queue implementation. It
   should also separate impact from urgency, which the current glosses conflate.
5. **`calibration-ledger.ts` should be the cry-wolf engine** (§3.5) — its Beta/Brier machinery is the
   same computation with severity claims as input instead of deadline intervals. **Not edited here**;
   its owner should know a second consumer is coming, and that the consumer needs the ledger keyed per
   (reporter, area, jurisdiction) and kept *separate* from the validity ledger.
6. **Does an expert-labelled archive of past reports exist, or can one be built?** (§5.2, §5.4) This
   is what makes the weights falsifiable at all. Aaron has run this procedure before, so the question
   is partly for him: what did the label set look like, and how large did it need to be?

## 8. Beacon anchors

| anchor | for |
|---|---|
| Larrey, D. J. (Napoleonic field surgery) — triage by need, irrespective of rank | §0: triage is an ordering, not a status judgement |
| **Aaron** — built a dynamic-weight multidimensional priority queue tuned against withheld hand-labelled bugs, with a cry-wolf meter and an exact cross-checkable severity rubric | **§5.2, §3.5, §3.6 — the two load-bearing mechanisms in this design are his, from practice, not derived here** |
| train/holdout split; Dwork et al. (2015), *adaptive data analysis* / holdout reuse | §5.2: why the holdout escapes the circularity, and why repeated consultation erodes it |
| Brier (1950); Gneiting & Raftery (2007), *proper scoring rules* | §3.5 cry-wolf as calibration (already the basis of `calibration-ledger.ts`) |
| CVSS (FIRST); impact × likelihood decomposition | §3.6: worked examples of a severity scale with per-level observable criteria |
| Lindley, D. V. (1956), *On a measure of the information provided by an experiment* | information gain as the primary dimension (already cited in `InformationValue.fs`) |
| Kullback & Leibler (1951) | the divergence itself |
| Howard, R. A. (1966), *Information Value Theory* | value-of-information as a decision-ordering criterion |
| Herbrich, Minka & Graepel (2006), *TrueSkill* | the per-(reporter, domain) skill posterior (already the basis of `TravelerRankLedger`) |
| Smith, W. E. (1956) — WSPT / Smith's rule | §3.3: cost divides |
| Nemhauser, Wolsey & Fisher (1978); Krause & Guestrin (2005) | §3.4 greedy bound — cited as motivation, **register `toy`** |
| Robbins (1952); Auer, Cesa-Bianchi & Fischer (2002) | §5.2(a) exploration floor |
| Lum & Isaac (2016); Ensign et al. (2018) | §5.1 the self-confirming feedback loop, empirically |
| Heckman (1979) | §5.1 selection bias in the observed sample |
| **Aaron** — has built dynamic-weight multidimensional priority queues before | the human anchor for §5; the dynamic-weight requirement is his, from practice |

## 9. Registers, collected

| item | register |
|---|---|
| the composite queue ordering | **`unmetered`** — no falsifier exists yet (§5.4 names what would earn `metered`: a withheld labelled set) |
| `InformationValue` KL underneath, claim-typed path only | `metered` (IV-1..IV-7, FsCheck) |
| `φ_info` proxy for free-text reports | **`toy`** — explicitly a stand-in (§4.1) |
| severity, cost-to-examine | **`placeholder`** — no producer exists |
| **cry-wolf / severity-claim calibration** | **`blocked`** — the Beta/Brier machinery exists, the rubric it would check against does not (§3.6). Not implemented; a typed hole, not a stub that returns a number. |
| **the severity rubric itself** | **`absent`** — `P0..P3` labels exist with no criteria; severity claims in Zeta are currently unfalsifiable (§3.6) |
| track record (validity) per (area, jurisdiction) | `computable` today via composite key (§3.1) |
| the holdout-tuning loop | **`designed, not built`** — no labelled archive exists yet (§5.2) |
| the `(1 − 1/e)` greedy bound | **`toy`** — submodularity unverified for this objective |

### 9.1 What was actually checked, versus asserted

The tests in `tests/Tests.FSharp/ReportTriage.Tests.fs` (19, green) were **mutation-checked**, since a
test that survives mutation is not a falsifier:

- Setting the `InformationGain` weight to `0.0` — i.e. collapsing the design to the
  track-record-primary construction of §1 — **fails the anti-burial test**
  (`newcomer 0.2400 must outrank veteran 0.2851`). The central design claim is therefore genuinely
  pinned, not merely asserted.
- That same mutation run exposed a **vacuous assertion of mine**: `lambda >= LambdaFloor` holds
  trivially when the floor is set to `0.0`, so the floor could be removed without any test failing.
  Fixed by asserting `LambdaFloor > 0.0` directly. Recording it because it is the exact failure class
  the discipline warns about, and I wrote it.

The rest of the suite pins mechanical properties (cost divides at exactly the ratio; `Unexamined` is
dropped from evidence; ε=0 draws identically under different seeds, i.e. no ambient entropy; weights
clamp). None of this makes the *ordering* metered — §5.4 still stands. It makes the **guards** metered.

## 10. Pointers

- `src/Bayesian/ReportTriage.fs` — the reference implementation of this design (wired into nothing)
- `src/Bayesian/AttentionRouter.fs` · `src/Bayesian/InformationValue.fs` — the existing KL machinery
- `src/Core/TravelerRankLedger.fs` — the per-(traveler, domain) posterior (read-only here)
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — §3.2
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — §4.2, §9
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — §3.4
- `.claude/rules/numerology-vs-number-theory.md` — §3.4's bound is cited, not claimed
