# The forward-action DU: a closed command set where reversibility, not confidence, is the automation boundary

- **Work item:** 081M10JB2FJ087G0R00159NYSZ
- **Date:** 2026-08-27
- **Register:** `toy` / `unmetered`. Run read-only against two live snapshots of the
  open-PR set. That is a demonstration, not a falsifier of the classification. Do
  not cite as `metered` — see `.claude/rules/toy-is-free-metered-must-be-earned.md`.
- **Status:** classifier + read-only edge + registry lint shipped. **No actuator.**
  Nothing in this change holds a write token.

## 0. The ask

> _"let's try to code, research, or design a way for our DUs in our free small
> GitHub AI society to automate this — over time every forward action be performed
> here and escalated when it needs more intelligence."_ — Aaron, 2026-08-26

and, earlier the same night:

> _"In our perfect world a different agent runs the verification based on our
> discriminated unions, and that's the only choices it has before it's allowed to
> merge. This is how we enforce global rules one local agent at a time… the escape
> hatch is edit the discriminated union by updating code, and that itself has to go
> through a review process based on its own discriminated-union workflow around
> editing workflows, so society can agree on those without human intervention."_

## 1. What shipped

| file                                                          | what it is                                                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/Core.TypeScript/ci/forward-action-du.ts`                 | the DU: `Disposition` (total, measured) + `ACTION_REGISTRY` (closed, reversibility-partitioned) + `classify` / `actionFor` / `propose` |
| `src/Core.TypeScript/ci/forward-action-report.ts`             | the READ-ONLY edge. Gathers facts, prints proposals, executes nothing                                                                  |
| `src/Core.TypeScript/ci/forward-action-du.test.ts`            | 35 falsifiers                                                                                                                          |
| `src/Core.TypeScript/hygiene/lint-forward-action-registry.ts` | the escape hatch's price, and the mechanical proof that the edge cannot act                                                            |

## 2. The DU, and how each arm is DETECTED

Every arm below is decided by a **measurement**. Where GitHub offers a cached
opinion, that opinion is carried as a corroborating fact and never as the
decision — for reasons §3 makes concrete.

| arm                     | detection                                                                               | action                                     | lane     |
| ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ | -------- |
| `Healthy`               | no root failures, nothing pending                                                       | `NoAction`, or `ReArmAutoMerge` if unarmed | AUTO     |
| `AwaitingVerdict`       | ≥1 check with `status != completed`                                                     | `Wait`                                     | inert    |
| `OwnedElsewhere`        | head ref checked out in another worktree                                                | `NoAction`                                 | inert    |
| `VerdictUndispatchable` | `refs/pull/N/merge` 404s, local merge CLEAN, **and GitHub has settled its own opinion** | `Escalate`                                 | inert    |
| `VerdictNotDispatched`  | required check absent, nothing red                                                      | `MergeMainAndPush`                         | **AUTO** |
| `VerdictStale`          | all complete, 0 pending, 0 attributable, `behindBy > 0`                                 | `MergeMainAndPush`                         | **AUTO** |
| `SuspectedInfraFlake`   | same, but `behindBy == 0` and no re-run spent yet                                       | `RerunFailedJobs`                          | **AUTO** |
| `MergeVerdictStale`     | GitHub says CONFLICTING, local `merge-tree` says CLEAN                                  | `MergeMainAndPush`                         | **AUTO** |
| `MergeConflicted`       | local `merge-tree` rc=1 with real hunks                                                 | `ProposeConflictResolution`                | propose  |
| `FrozenLane`            | head IS the lane tip and is the sole open PR for that lane                              | `ProposeRetireLane`                        | propose  |
| `OwnFailure`            | failing step's subject paths intersect this PR's own diff                               | `ProposeAuthorReview`                      | propose  |
| `NeedsIntelligence`     | state understood, closed set exhausted                                                  | `Escalate`                                 | inert    |
| `Unknown`               | diagnosis failed; carries reason + evidence                                             | `NoAction`                                 | inert    |

Totality is not a claim, it is a compile error: `actionFor` switches on
`Disposition` with no `default`, so adding an arm without deciding its action
fails the build.

### 2.1 The two "can't proceed" arms are deliberately NOT one arm

`Unknown` means **diagnosis** failed — the evidence is missing or
self-contradictory. `NeedsIntelligence` means diagnosis **succeeded** and the
_remedy_ needs judgement no arm expresses. Escalation is therefore a case, not a
fallback, and it must name what it measured and what was ambiguous. A test
asserts the ambiguity string is non-trivial and does not say "could not handle".

Collapsing them would be the SQL `NULL` mistake precisely. Rubinson (_SIGMOD
Record_ 36(4), 2007) makes the point while defending three-valued logic against
Date: the real defect is that one undifferentiated marker **conflates "unknown"
with "not applicable"**, so "nulls alter the meaning of seemingly straightforward
queries and are likely responsible for numerous errors, errors which may
frequently go unrecognized." Two causes of unknown-ness, one marker, silent
mis-modelling.

## 3. The load-bearing distinction: a MEASUREMENT is not a READING

Two of the observed classes are **opposites that look identical from outside**.
GitHub reports `mergeable_state: dirty` both when a branch genuinely conflicts
and when its cached verdict merely predates a merge that resolved the conflict.

Live instance, verified independently at 2026-08-27T03:05Z — **PR #15758**:

```
gh api .../pulls/15758  ->  mergeable: false, mergeable_state: "dirty"
git merge-tree --write-tree --name-only origin/main 9c090c97  ->  rc=0  (CLEAN)
```

and its opposite, **PR #15743**, same reading, opposite measurement:

```
gh api .../pulls/15743  ->  mergeable_state: "dirty"
git merge-tree ... 3ad47cebf6  ->  rc=1, conflicts in 3 files
```

So mergeability is measured with `git merge-tree` against a freshly fetched
`main` — a genuinely different transport — and `MergeVerdictStale` exists to name
the disagreement. A dedicated test asserts the two land in **different arms**;
mutating the detector to ignore the local measurement kills 2 tests.

## 4. Actions are NAMED, never DEFINED

`ACTION_REGISTRY` is nine rows. A selector returns an action **name** plus scalar
arguments; there is no arm that takes a command string. Compromising the selector
buys the ability to pick the wrong row from a fixed list of nine — not arbitrary
execution. A test asserts every argument is a scalar and contains no shell
metacharacter.

**Lineage, honestly labelled.** The formulation "the far side may _name_ a command
but can never _define_ one" is this repo's, from
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` (the portable half
of US10834144B2, Higgins & Stainback, assigned to Itron — the mediating hub itself
is deliberately not adopted). I could not find that sentence as a named academic
pattern. Its nearest published anchors are:

- **Dennis & Van Horn**, _Programming Semantics for Multiprogrammed Computations_
  (CACM 9(3), 1966): a capability is exercised by its **index-number** into a
  C-list, and "we assume that the allocation of these index numbers is carried out
  by the system." The caller designates; only the supervisor defines.
- **Miller, Yee & Shapiro**, _Capability Myths Demolished_ (SRL2003-02, JHU, 2003):
  **Property A, No Designation Without Authority** — designation and authority are
  one unforgeable object, so a designator cannot fabricate authority it was not given.
- **Saltzer & Schroeder** (_Proc. IEEE_ 63(9), 1975), _economy of mechanism_: keep
  the design small, because errors on paths not exercised in normal use "will not
  be noticed during normal use."

## 5. Reversibility, not confidence, is the automation boundary

The **only** authority for auto-execution is `mayAutoExecute(name)`, derived from
the registry. A caller cannot talk itself into running a proposal, and no amount
of classifier confidence promotes an arm.

| reversibility           | arms                                                                    | may auto-run          |
| ----------------------- | ----------------------------------------------------------------------- | --------------------- |
| `idempotent-reversible` | `RerunFailedJobs`, `MergeMainAndPush`, `ReArmAutoMerge`                 | **yes**               |
| `irreversible-shaped`   | `ProposeRetireLane`, `ProposeConflictResolution`, `ProposeAuthorReview` | never                 |
| `inert`                 | `Wait`, `Escalate`, `NoAction`                                          | n/a — touches nothing |

**Anchor: Garcia-Molina & Salem, _Sagas_ (SIGMOD 1987).** A long-lived transaction
is safe to run in pieces exactly when each piece has a compensating transaction
that "undoes, from a semantic point of view, any of the actions performed by Tᵢ,
but does not necessarily return the database to the state that existed when the
execution of Tᵢ began." Compensation is a _semantic inverse_, never a state
rollback. Their non-compensable case is stated plainly: "if a transaction fires a
missile, it may not be possible to undo this action."

**Where this design is a simplification, stated because it matters.** Sagas is a
three-tier ladder, not a binary: (1) cleanly compensable — cancel the reservation;
(2) compensable only by an _additional externally-visible_ action — "to compensate
for the letter, send a second letter explaining the problem"; (3) non-compensable.
`MergeMainAndPush` is honestly **tier 2**: reverting it adds another visible commit
to somebody else's branch rather than erasing the first. I classify tier 2 as
automatable here because the externally-visible residue is a merge commit in a
branch's own history — additive, never a rewrite — but the ladder is the truth and
the binary is the approximation.

Brown & Patterson (_Undo for Operators_, USENIX ATC 2003) name the same limit from
the operations side: what has escaped the system boundary and been **observed**
cannot be rewound, only compensated, and they keep a per-service "model of
acceptable external consistency" as the one irreducibly policy-shaped piece.

**Anchor: Bezos, 2015 Amazon shareholder letter** — one-way vs two-way doors, with
the hedge intact ("irreversible **or nearly irreversible**", i.e. already a
spectrum). And the footnote, which is the counterweight and is usually dropped:
over-gating two-way doors produces "slowness, unthoughtful risk aversion, failure
to experiment sufficiently, and consequently diminished invention." A design that
only argues for restraint is arguing half the case. That is why three arms _are_
automatable rather than none.

### 5.1 The empirical case that retire-vs-recover must escalate

`ProposeRetireLane` is proposal-only because the operator made **opposite calls on
the same shape on the same night**: #15709 retired, #15724 explicitly _not_
retired, recovery chosen instead. A test pins that two identically-shaped
`FrozenLane` fixtures classify the same and neither is auto-executable.

This is the most strongly corroborated finding in the prior art. **SapFix**
(Marginean et al., ICSE-SEIP 2019) attempted 18 Diff reverts in its first three
months: "**These Diff revert recommendations were all declined by developers** …
it seems developers are (perhaps understandably) unwilling to simply revert their
hard work." 18 of 18. The destructive-shaped action is exactly the one humans
reject.

## 6. Every deployed system in the literature stopped at "recommender"

This design's refusal to actuate is not caution for its own sake; it is where
three independent industrial teams landed.

- **SapFix** (Facebook): "**Humans still play the role of final gatekeeper** …
  the repair system, although fully automated is, nevertheless, at this point
  merely a recommender system." Its priority-subsumption rule exists to _withhold
  patches that pass all tests_, explicitly to "avoid polluting developers' review
  queues."
- **Getafix** (Bader, Scott, Pradel & Chandra, OOPSLA 2019): "let computers take
  care of the routine work, **albeit under the watchful eye of a human**, who must
  decide when a bug requires a complex, nonroutine remediation." Whole pattern
  classes are withheld deliberately.
- **Repairnator** (Urli et al., ICSE-SEIP 2018; Monperrus et al., IEEE Software /
  _Ubiquity_ 2019): interposes a named human **patch analyst** whose job is to
  decline — and in one window declined **1,307 of 1,307** test-suite-adequate
  patches as overfitting.

In all three, **passing the tests was never sufficient to justify acting.**

Repairnator also supplies the accountability question this substrate already
answers differently: "a bot cannot physically or morally sign a license agreement
… Who owns the intellectual property and responsibility of a bot contribution?"
Here the AgencySignature trailer names the agent, its credential mode, and whether
a human reviewed — so the question has a per-commit answer rather than an open one.

## 7. Why re-running is cheap, and why it is NOT the remedy for a stale verdict

**Anchor: Micco, _The State of Continuous Integration Testing @Google_ (ICST 2017
keynote).** Measured over a month at Google: "**84% of transitions from Pass →
Fail are from 'flaky' tests**"; "only 1.23% of tests ever found a breakage"; ~16%
of 4.2M tests show some flakiness; 2–16% of compute goes to re-running them. Their
conclusion — "testing systems **must** be able to deal with a certain level of
flakiness" — and their mechanism is mechanical, not judgemental: **re-run the
failure transition 10×** and keep a known-flaky database.

That is the justification for `SuspectedInfraFlake` treating a re-run as a _cheap
discriminator_ rather than a repair. This design spends the probe **once**, not
ten times, and then escalates; that is more conservative in minutes and weaker in
discrimination than Google's, and the trade is deliberate for a repo this size.

**But a re-run is the wrong remedy when the fix is on `main`.** `gate.yml` pins no
`ref:` on `actions/checkout`, so checkout uses the default `github.sha`, which for
a `pull_request` event is the merge commit computed **at event time and recorded on
the run**. Re-running replays that pinned commit. So:

- `behindBy > 0` (`VerdictStale`) → `MergeMainAndPush`. Only a new merge commit
  incorporates main's fix.
- `behindBy == 0` (`SuspectedInfraFlake`) → `RerunFailedJobs`. Nothing new exists
  to pick up, so the cheapest arm is the correct one.

This split also means the residual uncertainty about GitHub's exact re-run
semantics **cannot change the outcome** — which is why the split is drawn there.
The 2026-08-26 evidence had conflated these two under one "stale verdict" class.

## 8. The `Unknown` arm has published company

A non-empty `Unknown` is a success signal; an empty one means something was
force-fit. Two independent measurements say a real population has an
unattributable tail:

- **Rausch, Hummer, Leitner & Schulte**, MSR 2017, 54,248 Travis logs across 14
  Java projects: **on average 9% and up to 27%** of builds fail because "the build
  worker cannot fetch the change data from GitHub … the PR data on GitHub is
  already gone." That is the _published_ form of this repo's merge-ref class. Their
  taxonomy also carries an explicit `unknown` category — "errors without a clearly
  identifiable cause" — present in 9 of 14 projects.
- **Vassallo et al.**, ICSME 2017, 349 OSS projects + 418 at ING: a _Crosscutting_
  category exists precisely because attribution failed — "builds ended without
  reporting the failed goal" — covering **18.3%** of ING failures.

**Anchor: Kleene's three-valued logic** (via SEP, _Many-Valued Logic_): the third
value was introduced to reason about **partial recursive functions**, where it
denotes that "the output of a partial recursive function is undefined." Unknown is
a _value_, not an error — which is what lets `classify` be total.

The strong/weak distinction is a real design choice and this classifier makes both:
it is **weak-Kleene on the merge probe** (an unanswered `merge-tree` poisons the
whole verdict → `Unknown`) and **strong-Kleene elsewhere** (a PR can be decided
`OwnedElsewhere` regardless of how much else is unknown).

**Anchor: Yaron Minsky, "make illegal states unrepresentable"** (_Effective ML
Revisited_, Jane Street, 2011) — why this is a sum type rather than a bag of
booleans. Worth noting his own refactoring keeps an `option` _inside_ a variant
where the uncertainty is genuine. Honest limit: the principle is transmitted as a
slogan plus a refactoring, not a theorem; cite it as such.

## 9. The escape hatch — how a new action arm gets added

A closed set with no legitimate way to extend it gets bypassed. So:

1. **Add the `ActionName` literal and its `ACTION_REGISTRY` row.** TypeScript's
   exhaustiveness check then fails every `switch` that ignores the new arm. The
   compiler is the first reviewer.
2. **Declare `reversibility` honestly.** `lint-forward-action-registry.ts` asserts
   `autoExecutable === (reversibility === "idempotent-reversible")`. The two fields
   are stored separately _precisely_ so a half-edit is caught rather than silently
   widening what may auto-run.
3. **If you claim `idempotent-reversible`, pay for it**: name a `compensation`
   (Sagas) and ship an `idempotenceWitness` — a test that applies the action twice
   and asserts one effect. The lint refuses the row otherwise.
4. **If you do not, declare nothing.** A non-automatable arm carrying a
   compensation string is also refused; silence is the honest record.

**Why this is already the "workflow around editing workflows" and needs no new
machinery:** the lint is code in the repo it guards, and it runs on every PR.
Changing the _rules_ for adding an arm is therefore a PR that must pass the rules
as they currently stand. **The gate is reflexive by construction.** Society agrees
on the change the same way it agrees on any change — which was the point.

The lint derives the roster by **parsing the union and the registry literal**, not
from a hand-maintained allowlist that drifts from the code it describes — the same
discipline as the byte-lock roster in
`.claude/rules/no-binary-in-proof-lineage.md` condition 4.

### 9.1 The lint also proves the edge cannot act

"It only reads" is a promise; the set of verbs it can spawn is a fact. The lint
enumerates every `execFileSync` site in the edge and asserts: only `gh` and `git`;
the single `gh` site pins `-X GET`; every `git` verb is in a read-only allowlist;
and no `--force`, `--admin`, or `--no-verify` appears anywhere in the pair. That is
the closed-command-set property applied to the gatherer itself.

## 10. This is a LOCAL POLICY, not a controller

`propose()` returns a `Proposal`. It carries **zero authority**
(`.claude/rules/no-directives.md` — source is not authorization). The receiving
agent applies its own policy and may decline any row.

That is deliberate, and it follows the operator's model: A accepts B's change only
if A agrees, so agents drift — and the drift is a **feature**, because it is what
makes forking possible. A controller enforcing one global truth would delete
exactly that property. Compare `.claude/rules/anti-babel-preserve-reconcilability.md`:
reintegration is not reconvergence.

**Anchor: Saltzer & Schroeder, _fail-safe defaults_** — "the default situation is
lack of access … A design or implementation mistake in a mechanism that gives
explicit permission tends to fail by refusing permission, a safe situation, since
it will be quickly detected. On the other hand, a design or implementation mistake
in a mechanism that explicitly excludes access tends to fail by allowing access, a
failure which may go unnoticed in normal use."

That is exactly the asymmetry in `isAttributable`: an underivable subject yields
**not attributable**, so it withholds a remedy rather than licensing one.

**One honest wrinkle, because the asymmetry inverts in one place.** `VerdictStale`
uses _not attributable_ as a licence to **act**. So the withhold direction flips
there: an underivable subject makes a PR look stale and licenses a merge-main. This
is tolerable only because the licensed arm is among the cheapest and is additive.
If a destructive arm were ever licensed by that same inference, the asymmetry would
be actively unsafe. Stated here so a future edit cannot do it quietly.

## 11. Falsifiers

**35 tests**, `tsc` clean, lint rc=0. The safety properties are mutation-checked;
each mutant killed ≥1 test:

| mutant                                                         | tests killed |
| -------------------------------------------------------------- | ------------ |
| stale-dirty detector ignores the local merge measurement       | 2            |
| corroboration gate removed (unanswered probe read as negative) | 1            |
| `mayAutoExecute` always true                                   | 7            |
| ownership refusal removed                                      | 1            |
| aggregator counted as a root cause                             | 1            |
| empty `subjectPaths` becomes attributable                      | 6            |
| `VerdictStale` re-runs the pinned merge commit                 | 1            |
| `ProposeRetireLane` declared automatable                       | 3            |

The lint is separately mutation-checked (each rc=1, unmutated rc=0): irreversible
arm flipped to automatable; automatable arm drops its idempotence witness;
automatable arm drops its compensation; edge stops pinning `-X GET`; edge gains a
`git push`; an `ActionName` orphaned with no registry row.

**A note on one of those mutants.** The first attempt at "automatable arm drops its
idempotence witness" reported rc=0 and looked like a surviving mutant. It was not —
the `perl` regex was bounded too short and **the mutation never applied**. A check
that never ran had produced a clean-looking result. Re-targeted by line, it kills
the lint immediately. Recorded because it is the same failure class this whole
document is about.

## 12. What the live run produced, and what it got wrong

Two read-only snapshots, ~20 minutes apart.

|                                        | snapshot A (11 PRs) | snapshot B (9 PRs) |
| -------------------------------------- | ------------------- | ------------------ |
| ready-to-run (idempotent + reversible) | 1                   | 2                  |
| proposals needing a decision           | 10                  | 7                  |
| **`Unknown`**                          | 0                   | 0                  |
| `NeedsIntelligence`                    | 0                   | 0                  |

### 12.1 The `Unknown` rate is 0%, and that is a finding against the classifier

Per the brief's own standard, an empty `Unknown` means something was force-fit.
Two things are true:

1. **The sample barely exercised the classifier.** In snapshot B, 4 of 9 were
   `OwnedElsewhere` and 3 were `AwaitingVerdict` — 7 of 9 decided by the two
   cheapest precedence rules before any interesting detector ran. This repo merges
   ~250 changes/day, so most open PRs at any instant are simply _in flight_. The
   run is a smoke test of the edge, **not** evidence about the classification.
2. **Snapshot A contained a case that SHOULD have been `Unknown`, and I got it
   wrong** — see below. Corrected, snapshot A would have been 1/11 ≈ 9%.

### 12.2 The #15756 defect — an unanswered probe read as a negative result

Snapshot A classified **#15756** as `VerdictUndispatchable` ("the required check
can never report"). Verified against the API, the truth was:

```
mergeable: null,  mergeable_state: "unknown",  merge ref: 404, at T+16min
```

`mergeable: null` is GitHub saying _"still computing, poll again."_ I read a
not-yet-computed value as a cannot-be-computed one — **exactly** the failure the
precedence order was written to prevent, committed one branch below the comment
saying so. #15756 merged normally shortly after.

Fixed by a **corroboration gate**: `VerdictUndispatchable` now requires GitHub to
have settled its own opinion; if GitHub says unknown, we say `Unknown`. Pinned by
a regression test naming the PR, and by mutant 2 above.

### 12.3 The other things it gets wrong

- **`OwnedElsewhere` is coarse and over-fires.** It fired on 4–5 of every ~10 PRs.
  It reads `git worktree list`, which in this clone enumerates every agent's
  worktree, so it cannot distinguish _held by a live agent_ from _a stale worktree
  nobody cleaned up_. It refused correctly on #15636 and #15743 (genuinely other
  agents' work), but it is refusing on a proxy for ownership, not on ownership. It
  fails safe, and it will keep hiding real classes behind it until it is sharpened.
- **`AwaitingVerdict` outranks conflict detection.** A PR that is both running and
  genuinely conflicted reports `Wait`. Harmless but imprecise; the conflict is
  re-detected on the next pass.
- **Attribution is weak in practice.** `subjectPaths` comes from annotations, and
  most failing checks here emit none — so almost everything reads _unattributable_.
  That is safe for the blame direction and unsafe for the licence direction (§10).
- **`priorRerunAttempts` is measured per head SHA**, so a push resets the probe
  budget. Defensible (new code deserves a fresh probe) but it is a policy choice
  smuggled into a measurement, and it is not currently tested against a real re-run.
- **The frozen-lane detector is untested against a live positive.** No open PR was
  in that state during either snapshot, so the arm has fixtures and no field
  evidence.

## 13. What is deliberately NOT built

No actuator. Nothing here arms, pushes, re-runs, closes, retires, or merges. The
ready-to-run list is a list **for a human or for a separately-authorized agent**,
and §5's partition is what such an actuator would have to obey.

Wiring one is an operator decision, and it needs at minimum: a write-token scope
narrower than the closed set, an at-most-once key per (PR, head SHA, action), and
an idempotence witness per automatable arm executed against the real API rather
than a fixture.

## 14. Relationship to `stalled-pr-classifier.ts` (PR #15698)

PR #15698 answers **"why is this PR stalled"**; its safety property is _attribution_
(do not act on a red the PR did not cause). This module answers **"what may an
agent do about it, and who decides"**; its safety property is _reversibility_.

They are complementary, and they overlap in the attribution helpers. The
unification is deliberately **not** done here: #15698 is unmerged, and depending
on an unmerged branch produces a change that cannot be verified in isolation. Once
it lands, the two should share `rootFailures` / `isAttributable` and the
`Disposition` should be stated as a refinement of its `Classification`.

## 15. Anchors

- Garcia-Molina & Salem, _Sagas_, SIGMOD 1987 — compensating transactions; the
  three-tier ladder; "if a transaction fires a missile…"
- Brown & Patterson, _Undo for Operators_, USENIX ATC 2003 — Rewind/Repair/Replay;
  externally-observed effects can only be compensated, never rewound.
- Saltzer & Schroeder, _The Protection of Information in Computer Systems_,
  Proc. IEEE 63(9), 1975 — least privilege, fail-safe defaults, economy of
  mechanism, separation of privilege (and it, not AFI 91-104, is the citable
  anchor for the two-person rule).
- Dennis & Van Horn, CACM 9(3), 1966 — capabilities as index-numbers the supervisor
  allocates.
- Miller, Yee & Shapiro, _Capability Myths Demolished_, SRL2003-02, 2003 —
  No Designation Without Authority.
- Micco, _The State of CI Testing @Google_, ICST 2017 keynote — 84% of pass→fail
  transitions are flaky; re-run 10×.
- Memon et al., _Taming Google-Scale Continuous Testing_, ICSE-SEIP 2017 — the
  1.23% figure, peer-reviewed.
- Rausch, Hummer, Leitner & Schulte, MSR 2017 — the 14-category build-failure
  taxonomy; 9–27% of failures are the worker failing to fetch PR data.
- Vassallo et al., ICSME 2017 — the _Crosscutting_ unattributable bucket, 18.3% at ING.
- Marginean et al., _SapFix_, ICSE-SEIP 2019 — "merely a recommender system";
  18/18 revert recommendations declined.
- Bader, Scott, Pradel & Chandra, _Getafix_, OOPSLA 2019 — one shot per bug;
  deliberately withheld pattern classes.
- Urli et al., ICSE-SEIP 2018; Monperrus et al., _Ubiquity_ 2019 — Repairnator's
  patch analyst; 1,307/1,307 declined; the bot-accountability question.
- Kleene three-valued logic, via SEP _Many-Valued Logic_ — Unknown as the value of
  an undefined partial function; strong vs weak.
- Rubinson, _SIGMOD Record_ 36(4), 2007 — SQL NULL conflates "unknown" with
  "not applicable"; the cautionary half.
- Minsky, _Effective ML Revisited_, Jane Street, 2011 — make illegal states
  unrepresentable.
- Bezos, 2015 Amazon shareholder letter — one-way vs two-way doors, **with** the
  over-gating footnote.
- US10834144B2 (Higgins & Stainback, assigned to Itron) — via
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`; the closed
  command set is the portable half, the mediating hub is not adopted.

Sources marked in the research pass as title-only were **not** cited: Kleene 1938
and 1952 directly, Codd 1979, Hardy 1988, Miller 2006, AFI 91-104.
