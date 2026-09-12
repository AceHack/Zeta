# Deterministic verification is becoming a field — scored claims beat boolean, and nobody has measured the delta

**Date:** 2026-09-11 · **Register:** mixed, marked per section · **Ferry:**
[`docs/ip-questionable/2026-09-11-reverify-deterministic-verification-video-transcript.md`](../ip-questionable/2026-09-11-reverify-deterministic-verification-video-transcript.md)

> **Everything attributed to the tool below is a SECONDARY ACCOUNT.** The source is a
> video transcript, not the repository, its README, or its code. The transcript does not
> state the project's URL, owner, or licence. Nothing here has been verified by running
> it. Read every number in §2–§4 as *"the transcript reports"*, never as *"we measured"* —
> and the one place that distinction is load-bearing is §6, where the honest conclusion is
> that we cannot check most of it and should not pretend to.

Aaron, 2026-09-11:

> *"we are following what they do closely with the way we look for vacuous claims and
> other categories, some of the forward looking things in this area are around numeric
> scored based claims instead of just true false claims."*

## 1. The field exists, and it is mostly empty

The transcript names a GitHub topic — **`deterministic-verification`** — said to carry
**32 repositories**, of which two are named (`truth`, a deterministic fact-checker over git
diffs and logs; `ground rails`, for RAG) and both are said to have **one star each**. One
project is reported to have broken out: >1,000 stars, 217 forks, 83 commits, three
contributors, nine days old at the time of recording.

The useful reading is not "which tool won". It is that **the idea is widely agreed and
barely built**. A topic with 32 repositories and a one-star median is a field in its
pre-consensus phase, which is exactly when the vocabulary gets set — and the vocabulary is
the part we have a stake in.

## 2. The convergences — independently arrived at, which is the evidence

These are not things to adopt. They are things we already built, and finding them
reconstructed by someone with no contact with this repo is the useful signal:
**the shape is not idiosyncratic.**

| their mechanism (reported) | ours | where |
|---|---|---|
| a checker that always says "no" is a useless brick; the gate demands **both** zero false-accepts **and** that a known-true is never refused | a guard that refuses everything is the same vacuity as a guard that passes everything; every audit's exemption roster is checked in **both** directions | `ci/gate-leg-wiring.ts` `stale-exemption` / `legless-exemption` |
| `inconclusive` is flagged **separately**, never counted as a pass | exit code 2 is a check that never ran, not one that failed; `not-applicable` is a fourth verdict, not a pass | `ci/local-checks.ts` five outcomes |
| the model proposes, a **deterministic tool** decides | meters never judge, oracles do — and the meter's judgement is crystallised once, in a treaty | `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` |
| a claim borrowed from **one** external engine sits at a `derived` tier, below `verified`; promotion needs a **second independent engine** to agree, and disagreement → `inconclusive` | the four-oracle byte-lock; Knight–Leveson on correlated redundancy; one meter suffices for a fact and a second is the only way the first is known to be wrong | `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` §counts |
| results are **machine-readable JSON records**, not a README claim | verification artifacts are TEXT, hex-in-JSON, diffable in a `git` diff | `.claude/rules/no-binary-in-proof-lineage.md` |
| the benchmark moved off the author's machine onto CI across three OSes; one false-verify fails the build | the gate's floor is data (`registry/uncompensatable-floor.yaml`), and a skip that cannot be explained blocks | `ci/gate-skip-verdict.ts` |
| an outside contributor on **ARM64 hardware the author did not control** found a routing bug the author's setup could never show | decorrelation is the point; a diverged peer reconstructing your meaning is the anti-Babel falsifier | `.claude/rules/anti-babel-preserve-reconcilability.md` |

The last row is worth pausing on. The reported bug — ARM64 binaries routed into the x86
decoder — was **invisible to every number the project published**, because the guarantee it
was measuring (zero false-accepts) *still held* while the routing was broken. A check that
was right about its own question and blind to the question next to it. That is our
"a check that did not run looking like one that passed", one level up: **a check that ran,
passed, and was measuring the wrong thing.** We do not currently have a name for that.

## 3. The genuine addition: a claim's verdict carries a WEIGHT, not just a sign

This is Aaron's forward-looking point, and it is the part we do not have.

Reported mechanism: every verified claim carries a **weight measured from how much
information it actually says**.

- *"a binary starts with `MZ`"* is trivially reachable, so it scores near zero — passing it
  is not evidence of anything.
- A model echoing **the tool's own previous output** is registered as **self-referential,
  weight exactly zero**.
- A run counts as *grounded* only if it clears a **minimum weight threshold with no
  refutations** — the worked example reports an information score of **1.236** rather than
  a generic pass.

**Why this matters to us specifically.** Our vacuity discipline is *binary*: a check that
cannot fail is not a check. It is stated as a predicate and enforced by mutation — a test
that survives a mutant is not a falsifier. That works, and it is why `mutation-runner.ts`
exists. But it has two known weaknesses that a scalar fixes:

1. **It is all-or-nothing.** A test that survives mutation is condemned; a test that kills
   one mutant of forty is not distinguished from one that kills all forty. Mutation *score*
   is the obvious existing answer and we compute it — but we do not carry it on the claim.
2. **It cannot price a claim that is technically falsifiable and practically empty.** The
   `MZ` case is exactly this: a real check, over real bytes, that no plausible world fails.
   Our vocabulary calls that "passing", and a reviewer has to notice by hand.

And the **self-referential weight-zero rule is the sharpest single idea in the transcript
for us.** We have the failure — a guard whose assertion is satisfied by the very comment
explaining it, which happened three times in one session and again today (a comment
quoting `setTimeout(..., 60000)` tripped the ambient-time guard). We catch it by grepping
the CALL rather than the identifier. *Scoring* it zero is a better mechanism than
excluding it, because exclusion needs a rule per shape and scoring needs one rule.

**Register: `toy`.** No such scalar exists in this repo, no threshold has been calibrated,
and the transcript gives one worked number (1.236) with no units, no definition of the
occurrence-frequency measure behind it, and no calibration study. Adopting the *number*
would be numerology — a count with no structure behind it
(`.claude/rules/numerology-vs-number-theory.md`). Adopting the *principle* — that a passing
claim carries an information weight, and self-reference weighs zero — is a design direction
we can build and falsify ourselves.

**The nearest thing we already have** is the ΔU ledger: a bug-fix's price is **ordinal +
witnessed**, deliberately never a cardinal, because no metering discipline in the repo can
produce a cardinal price and a fabricated one corrupts the only thing the ledger is for
(`.claude/rules/every-bug-has-economic-value.md`). A claim-weight scalar would be the first
honest cardinal on this substrate **if and only if** it comes with a metering discipline —
which means the work is the meter, not the number.

## 4. The second addition: a ledger of what was REFUTED

Reported: grounded results are written to disk as they happen, checkpointed every round,
and — the part we lack — **rejected hypotheses are explicitly saved as known-false**, so a
fresh context is told *what not to propose*. Unverified claims are not stored at all.

We have memory, `db/uncertainty/`, and the work-item ledger. All of them record what **is**.
Nothing systematically records what was **tried and refuted**, which means every context
reset re-opens the same dead ends. Instances from this session alone, each of which cost
real turns and none of which is written down as a refutation:

- `process.stdin.resume()` cannot keep a child alive under `stdio: "ignore"` — measured,
  then used, then not recorded as a negative result anywhere a future agent would find it.
- Reading through a file handle does **not** close the `js/file-system-race` window on a
  lock's contended path — reasoned out twice in one day, on two different PRs.
- A wrong AgencySignature **key name** is reported as a *placement* error. That one *was*
  written down, into memory, only because it cost eight turns the second time.

The pattern is clear and it is ours: **refutations are the expensive knowledge and the
least-preserved.** Memory captures them only when an agent happens to judge them worth a
file. A ledger would make it structural.

**Register: argued, not measured.** The claim "a refutation ledger reduces repeat
exploration" is falsifiable — count repeat dead-ends before and after — and unmeasured here.

## 5. The boundary, which they state better than we do

> *"The property that decides it comes down to whether something other than a model can be
> wrong in a way you can actually detect regardless of model quality."*

That is a cleaner statement of our meter/oracle split than we have written down. And the
corollary is stated equally well: *the same assumptions that produced an answer will always
produce the review of it*, so a second pass by the same model is **a second opinion, not a
check**. This is Knight–Leveson in one sentence, applied to agents instead of N-version
programs.

Their practical test — *which claims have a physical artifact behind them* (a test suite
that passes, a git diff that exists, a non-zero exit code) versus which have no adjudicator
but another model (*"will this database design scale", "is this refactor elegant"*) — is a
usable sorting rule, and it is the same line our `toy` / `unmetered` / `metered` ladder
draws.

## 6. The honest gap, and it is OURS TOO

The transcript's most valuable passage is the one criticising its own subject:

> *"every single number we've looked at has measured the checker in total isolation,
> leaving the one figure you'd actually buy this tool for completely missing."*

The 97% hallucination rate measures **the model**. The zero false-accepts measures **the
checker**. The two never met under a single test, so there is no measurement of whether an
agent working under the judge ends up better off than one working without it. Their roadmap
carries it as an unticked box labelled *baseline deltas*.

**We have the identical gap, and it is larger.** This repo is built out of falsifiers —
`gate-leg-wiring`, `audit-build-graph-completeness`, `audit-single-file-rewrite-churn`, the
mutation runner, the four-oracle byte-lock — and every one of them measures *itself*. Not
one measures **the delta**: does an agent operating under these guards produce work that is
better, by any independent measure, than the same agent without them?

That is precisely the quantity Aaron's own definition of a superagent demands:

> *"superagent to me is one who every time it works decides how to route the next same task
> to an agent with less experience or intelligence."*

A routing decision that honestly lowers what the next run needs **is** a baseline delta. We
have the definition and the artifacts; we do not have the measurement. Naming it here as an
open, falsifiable quantity rather than a solved one.

**Also worth importing: their statistical honesty.** 0 out of 71 does **not** license "zero
false-accept rate" — the project itself states the sample puts the upper bound below **5%
at 95% confidence**. And they refuse credit for the model's round-two recovery, noting the
loop is *restating what the verifier already reported*, not reasoning independently. Both
are the same discipline as *the meter buys the demarcation, not the claim*.

## 7. What we would build, if this is worth building

Stated as options with costs, not as a plan:

1. **A claim-weight scalar on audit output.** Each check emits not just pass/fail but a
   weight: how reachable was the passing state? Self-referential input (a check satisfied by
   text that exists to describe it) scores zero **by construction** rather than by a
   per-shape grep. Cost: every audit needs a weight function, and the threshold needs
   calibration or it is numerology.
2. **A refutation ledger.** `db/refuted/`, keyed like `db/uncertainty/`, holding hypotheses
   tried and disproven with their evidence. Read at wake. Cost: another unbounded-growth row
   that must arrive with a model (`registry/unbounded-growth-register.json`).
3. **A baseline-delta harness.** The measurement neither project has. Cost: highest, value
   highest, and it is the only one that would let us say the guards are worth their price
   rather than assert it.

## Anchors (Beacon)

- **Knight & Leveson (1986)**, *An Experimental Evaluation of the Assumption of Independence
  in Multiversion Programming* — independently written versions fail in correlated ways.
  The reason a second engine must be *independent* before a `derived` claim is promoted, and
  the reason a model reviewing itself is not a check.
- **Goguen & Meseguer (1982)**, noninterference — the declared-channel discipline a
  self-referential claim violates: the model's own prior output is an undeclared channel
  into its next claim.
- **Clopper–Pearson** — the interval behind "0/71 bounds the rate below 5% at 95%", and the
  standard answer to reading a zero-count sample as a zero rate.
- **Shannon (1948)** — "how much information does this claim actually carry" is
  self-information, `-log p`; the transcript's occurrence-frequency weighting is that idea
  applied to a byte pattern's reachability. Named because it is the honest lineage of the
  scalar in §3, **not** because the transcript's 1.236 has been shown to be one.
