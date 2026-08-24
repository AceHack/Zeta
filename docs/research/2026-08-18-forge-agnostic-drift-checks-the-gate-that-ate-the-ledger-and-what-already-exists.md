# Forge-agnostic drift checks: what already exists, the honesty contract, and the gate that ate the ledger

Date: 2026-08-18
Status: DESIGN. No migration is begun. No existing gate is weakened by this document.
Author: Kenji (architect seat)

Direction, from Aaron:

> *"We are looking to reduce our gate to just the absolute minimum and replace it with the free
> GitHub Actions and agent society so it can run all the checks as drift checks and not block
> anything. And our CD -- which is for now GitHub Pages and later our own hardware with our USB
> setup -- so even mistakes won't cause downtime, so CI failing won't kill CD."*
>
> *"We are looking to be code-forge agnostic and be git-native, and then ZetaDB-native later.
> GitHub is just one code-forge plugin and it's for corporate mode; git-native / ZetaDB-FS-native
> is sovereign mode."*

And, correcting the framing this document was first commissioned under:

> *"this has been our direction for a while, we've done a lot of work moving in this direction
> already."*

That correction is right, and it changes what this document is. The design is four months old,
ratified, and largely built. What follows reports the existing surface first, then contributes the
one thing the audit found that nobody had measured: **the direction is not merely incomplete, it is
currently switched off, and it was switched off by the gate it was designed to replace.**

---

## 0. Summary for someone with two minutes

1. **The forge plugin boundary already exists.** `src/Core.TypeScript/forge-host/` -- a 23-method
   `ForgeHost` interface, a GitHub adapter, a GitLab adapter. Do not design it again.
2. **The corporate/sovereign split already exists**, named in those words since 2026-06-15, with
   `ChangeControlPort` / `NullChangeControlPort` on the corporate side and `ForgeHost` on the
   sovereign side.
3. **The non-blocking flip already happened** -- ADR 2026-07-09, Accepted, ratified 2026-08-08 with
   an operator signature and six persona signatures. The blocking floor is already data
   (`registry/uncompensatable-floor.yaml`), already small (7 entries), and already rolled up into
   one required check.
4. **The drift ledger has been dead for five days**, and the cause is that the required status check
   rejects the ledger's own writes. Last recorded tick: `000247`, 2026-08-13T15:56:47Z. Since then,
   300+ drift sweeps, 276 reported `success`, **zero ticks recorded**. The rejection is swallowed by
   `|| echo "push race -- next tick re-records (idempotent)"`, which is a truthful message about a
   different failure than the one occurring.
5. **The dashboard shows healthy.** `data/drift-mtth.json` still publishes `latestTick: 247` and
   `openCount: 0` for all six classes to the Pages monitor panel.
6. So the highest-value contribution is not a new abstraction. It is an **honesty contract for
   non-blocking checks** (section 3), a **minimum blocking set expressed in the right unit**
   (section 4), and the observation that **the one remaining hub silently disabled the one oracle**
   (section 2) -- which is exactly the manifesto-11 failure the forge-agnostic direction exists to prevent,
   occurring inside our own repository rather than at the forge boundary.

---

## 1. What already exists -- reported before anything is proposed

Every row verified against the working tree or the live API on 2026-08-18, not assumed from prose.

| Artifact | Status | What it already decides |
|---|---|---|
| `docs/DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md` | **Accepted**, ratified 2026-08-08 (operator + 6 persona signatures) | Drift-and-heal is primary; pre-merge blocking is the exception, reserved for uncompensatable effects. Six numbered decisions incl. tick-indexed MTTH. |
| `registry/uncompensatable-floor.yaml` | Live, 7 entries | The floor is **data, not prose**. Derived as the *erasure class*. Additions require the treaty-amendment consent path. |
| `registry/drift-slo.yaml` | Live, adopted phenotype `#53000d` | Unbounded MTTH is the new red. Adaptive budgets derived from each class's own demonstrated heal pace. |
| `src/Core.TypeScript/forge-host/` | Shipped | `ForgeHost`: 23 methods, host-agnostic `types.ts`, `Result<T, ForgeError>` throughout, `detect` + `registry`. GitHub adapter (462 lines), GitLab adapter (141 lines). |
| `docs/research/2026-06-15-two-gating-modes-corporate-pr-vs-sovereign-society-self-check-safe-by-construction-no-pr.md` | Shipped | Corporate vs sovereign named in those words. "The gate is the membrane; the PR is one instance." |
| `docs/design/2026-08-13-agent-verified-merge-replacing-prs.md` | Shipped | What replaces the gate: verification driven by `build-graph affected`, executed by a quorum of agents, verifier never the author. Includes the sequencing rule. |
| `docs/BUILD-GATES.md` | Shipped | The sovereign gate already exists and is `bun run preflight`. "PRs are not the gate anymore; **this file is.**" |
| `docs/DECISIONS/2026-05-29-git-native-event-store-spec.md` | **Accepted** | The forge-neutral evidence substrate: append-only ZetaId-keyed JSON in git. Already carries `docs/drift-events/`, `docs/observe-events/`, `workitems/events/`. |
| `src/Core.TypeScript/forge-host/github/flush-via-staging.ts` | Shipped | The park-and-flush route: stage on `heartbeat/*` (ruleset-disjoint), open a PR, arm auto-merge. Already used by 4 lanes. |
| `docs/GITHUB-SETTINGS.md` section "three-ruleset split" | Target, partially executed | `Branch integrity` / `Review process` / `CI gate`. Two of three exist live. |
| `src/Core.TypeScript/hygiene/audit-hidden-oracles.ts` | Shipped | The exit test made mechanical, for numbers. The precedent this document extends to *implementations*. |

**Consequence for this document.** Sections that would restate the above are omitted. What follows
is the delta.

### 1a. The one thing that was genuinely missing

Every artifact above describes **where checks run** and **what may block**. None of them states
**what a non-blocking check owes the reader**. That gap is where the five-day outage lived, and it
is section 3.

---

## 2. The finding: the gate ate the ledger

### 2a. What was measured

`.github/workflows/drift-sweep.yml` is the drift clock -- the mechanism that makes the whole
non-blocking model honest. It runs on every push to main plus twice hourly, computes findings, runs
certified healers, folds MTTH, and commits the tick to `docs/drift-events/`.

Its final step:

```
git commit -m "drift: record sweep tick + certified heals [skip ci]"
...
git push || echo "push race -- next tick re-records (idempotent)"
```

The live output of that push, from run `32173383626` (2026-08-18T18:59Z):

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Required status check "gate (required)" is expected.
 ! [remote rejected]     main -> main (push declined due to repository rule violations)
push race -- next tick re-records (idempotent)
```

It is not a push race. It is a rule violation, and it is deterministic -- it will occur on every
future tick until something changes. The `||` swallow converts a permanent structural failure into
a message describing a transient one, and the step, job, and run all report `success`.

| Measurement | Value |
|---|---|
| Last tick committed to `docs/drift-events/` | `000247`, **2026-08-13T15:56:47Z** |
| Drift sweeps since (API-capped enumeration) | **300+** |
| Of those, reporting `success` | **276** (remainder `cancelled`) |
| Ticks recorded in that window | **0** |
| `data/drift-mtth.json` as published to Pages | `latestTick: 247`, `openCount: 0` for all 6 classes |

### 2b. Why it happened, precisely

`[skip ci]` suppresses workflow runs. `gate (required)` therefore never starts on the pushed tip.
A required status check is evaluated **at push time against the pushed tip**, so a commit that has
never been through a check run is rejected before any check could start. Dropping `[skip ci]` does
not help either -- on a direct push to main the check is *missing*, not *failing*, and a missing
required check is a rejection.

**This is already documented in the repository**, in the header of `flush-via-staging.ts`, which
names the four lanes migrated to the park-and-flush route: `agent-heartbeat`, `society-heartbeat`,
`tick-metrics`, `proof-closure-drift`. `drift-sweep` is not among them. It was the lane that most
needed the migration and the one that did not get it.

### 2c. Why this is the load-bearing finding and not a bug report

From `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`: *"Hubs are enforced. Oracles
are chosen."* The required status check is the repository's one remaining hub -- a mandatory locus
of deference on the write path, with no exit. The drift ledger is the chosen oracle that was
supposed to make the hub unnecessary.

**The hub disabled the oracle, and the disabling was invisible for five days.** Not by malice and
not by design: by the ordinary mechanics of a mandatory check applying to *all* writers, including
the writer whose job is to record what the mandatory check does not catch.

Two general lessons, both of which belong in the design rather than the incident log:

1. **A blocking check is not merely a cost on the lanes it delays. It is a capability constraint on
   every mechanism that needs to write.** The drift ledger, the healers, the SLO filings, and the
   MTTH panel are all *writers*. Designing the floor while thinking only about feature PRs
   under-counts who the floor binds.
2. **Removing a gate does not create the alternative.** The ADR's flip moved 23 checks from blocking
   to reporting. The reporting substrate then stopped, and because nothing blocked, nothing
   complained. The system degraded to *neither* -- which is precisely the state the 2026-08-13
   sequencing rule warns about ("removing `CI Gate` first would leave neither"), reached by a route
   nobody anticipated: not by removing the gate too early, but by leaving it in place too long.

### 2d. The repair, named but not performed

`drift-sweep.yml` adopts the park-and-flush route already shipped in `flush-via-staging.ts`, exactly
as `proof-closure-drift.yml` did. This is a one-lane change with a proven pattern and no new
mechanism. It is deliberately **not** included in this PR, which is docs-only; it is listed in
section 9 as the first item of sequenced work.

---

## 3. The honesty contract for non-blocking checks

> **A non-blocking check is the vacuity class's native habitat.**

The repository's own standing rule is that *a check that did not run must never look like a check
that passed*. A drift check that detects a problem and produces nothing observable is strictly worse
than no check, because it manufactures the appearance of coverage. Three distinct ways to fail this
were found live tonight, and naming them separately matters because they need different fixes.

### 3a. Failure mode 1 -- the swallowed actuator

`cmd || echo "benign-sounding message"`. The command fails, the step passes, and the message
describes a failure class other than the one that occurred.

**Live instance:** `drift-sweep.yml`, section 2. Five days, 276 green runs, zero ticks.

**Test:** an actuator's exit status must be *observed*, and its observation must be *recorded*. A
tolerated failure is fine; an unrecorded one is not. `|| echo` records to the log, and the log is
not a surface anyone reads on a green run.

### 3b. Failure mode 2 -- `continue-on-error` laundering

A job-level `continue-on-error: true` makes the *run* conclusion `success` even when the job
conclusion is `failure`. `gh run list` -- the surface humans and agents actually read -- then shows
an unbroken column of green.

**Live instance:** `.github/workflows/github-settings-drift.yml`. Every sampled run since
**2026-06-21** has job conclusion `failure` and run conclusion `success`. Eight weeks.

| Run | Created | Run conclusion | Job conclusion |
|---|---|---|---|
| 32171049001 | 2026-08-18 | `success` | **`failure`** |
| 32039957554 | 2026-08-17 | `success` | **`failure`** |
| 31402510532 | 2026-08-10 | `success` | **`failure`** |
| 30285219271 | 2026-07-27 | `success` | **`failure`** |
| 27888423959 | 2026-06-21 | `success` | **`failure`** |

And it is finding **real** drift. From the 2026-08-18 log:

```
-    "build_type": "legacy",
+    "build_type": "workflow",
```

plus a materially divergent workflow roster. Worse, the expected snapshot
(`src/Core.TypeScript/hygiene/github-settings.expected.json`) is stale on the *governance* surface
specifically:

| Setting | Expected snapshot | Live (2026-08-18) |
|---|---|---|
| `CI Gate` enforcement | `disabled` | **`active`** |
| `CI Gate` required contexts | 5 (`build-and-test`, `actionlint`, `markdownlint`, `semgrep`, `shellcheck`) | 1 (`gate (required)`) |
| `Branch Safety` rules | `deletion`, `non_fast_forward`, `required_linear_history` | `deletion`, `non_fast_forward` |
| `Heartbeat` ref condition | `refs/heads/agent-heartbeats` | `refs/heads/heartbeat/*` |

The very ruleset change that killed the drift ledger is sitting inside the detector whose output was
laundered to green. That is the honesty problem paying its own bill.

**Test:** `continue-on-error` is legitimate for *tolerating* a failure and illegitimate for
*hiding* it. Tolerating requires that the finding land somewhere durable first. Today it lands
nowhere.

### 3c. Failure mode 3 -- intent reported as outcome

A summary step that reports what the job *tried to do* rather than what *happened*.

**Live instance (unfired but armed):** `.github/workflows/lockfile-healer.yml`. Its
`if: always()` summary reads `steps.detect.outputs.code` and prints:

```
1) echo "**Healed.** bun.lock regenerated, verified, and pushed." ;;
```

`detect` is the *detector's* output. The push it claims happened is `git push origin HEAD:main`,
which is subject to the identical rule rejection as section 2 -- so the first time this healer
actually has work to do, it will print "Healed ... and pushed" for a push that was declined. The
class carries `max_open_age_ticks: 1` in the SLO registry *on the explicit reasoning* that "a
finding still open after a full sweep tick therefore means the HEALER failed" -- reasoning that is
correct and currently unenforceable, because the ledger that would notice is the one in section 2.

**Test:** a corrective action reports on its *verification*, never on its *invocation*.

### 3d. The contract

A check may be non-blocking if and only if it emits a **receipt**. The receipt answers four
questions, and it is not a log line -- it is a durable, content-addressed event in the git-native
event store that already exists.

```typescript
/** The four obligations. A non-blocking check that cannot fill these is not a check. */
export interface DriftReceipt {
  /** (a) IT RAN. Detector identity + the exact input it examined. */
  readonly detector: DetectorId;          // registered in registry/drift-detectors.yaml
  readonly subject: ContentAddress;       // tree sha / commit sha the detector examined
  readonly tick: TickIndex;               // phase clock, never wallclock (ADR item 6)

  /** (b) WHAT IT FOUND. `clean` is a positive claim, not an absence. */
  readonly outcome: DetectorOutcome;

  /** (c) WHAT FIRED. Absent when outcome is clean or when no actuator is registered. */
  readonly action: ActuatorAttempt | null;

  /** (d) WHETHER IT WORKED. The re-observation, not the invocation. */
  readonly verification: ActuatorVerification | null;
}

export type DetectorOutcome =
  | { readonly kind: "clean" }
  /** The detector executed and found drift. Findings are data, not failures. */
  | { readonly kind: "drift"; readonly findings: readonly Finding[] }
  /** THE ONE THAT MATTERS. The detector could not reach a verdict. Distinct from clean. */
  | { readonly kind: "inconclusive"; readonly reason: string }
  /** The detector was not run this tick, and says so rather than being absent. */
  | { readonly kind: "skipped"; readonly reason: string };

export type ActuatorVerification =
  /** The drift is gone, re-measured by the detector, at a later tick. */
  | { readonly kind: "healed"; readonly atTick: TickIndex }
  /** The actuator ran and the drift persists. */
  | { readonly kind: "ineffective"; readonly atTick: TickIndex }
  /** The actuator itself failed. THIS is what `|| echo` currently erases. */
  | { readonly kind: "actuator-failed"; readonly diagnostic: string }
  /** Consecutive failures exceeded the class budget; the actuator is parked. */
  | { readonly kind: "quarantined"; readonly consecutiveFailures: number };
```

Four properties fall out, and each one is exactly the mechanism that failed above:

1. **`inconclusive` is a first-class outcome, not an absence.** `continue-on-error` collapses
   `drift` and `actuator-failed` into `clean`. A receipt cannot: the absence of a receipt is itself
   detectable, which is the whole point.
2. **`clean` is asserted, never inferred.** A detector that did not run produces no `clean` receipt,
   so "nothing to report" and "nothing reported" are distinguishable in the ledger.
3. **Verification is a *later tick's re-observation*.** This is already how MTTH works -- a class
   heals when the next sweep no longer finds it. The contract just says the actuator does not get to
   grade its own paper (3c), which is the same *"the verifier must not be the author"* constraint
   the agent-verified-merge design places on merges.
4. **Quarantine bounds the loop.** An actuator that fails N consecutive times on the same class is
   parked and files work, rather than retrying forever. The episode key already exists as
   `docs/drift-events/slo-filed.json`.

### 3e. The coverage invariant

`build-graph.ts`'s `verifyCoverage` already proves `affected union skipped == every target`, exactly
once each, so a green build carries its own coverage proof. **That property transfers directly and
becomes more important, not less, when nothing blocks:**

> For every registered detector, every tick, exactly one receipt exists with outcome in
> `{clean, drift, inconclusive, skipped}`. A detector present in the registry and absent from the
> tick is a **ledger integrity failure**, and it is the one thing in the drift system that should
> still be loud.

This is what makes non-blocking honest rather than merely quiet. And it is measurable today:

| Measurement | Value |
|---|---|
| Workflows in `.github/workflows/` | **69** |
| Workflows contributing a required status check | **1** (`gate.yml`) |
| Drift classes carrying MTTH in the ledger | **6** (`BD001` + five markdownlint rules) |
| Detectors registered in a coverage-checkable roster | **0** -- no such roster exists |

68 of 69 workflows are already non-blocking. Six classes have receipts. The gap between those two
numbers is the honesty debt, and it is the concrete deliverable the direction still needs.

### 3f. What `registry/drift-detectors.yaml` would carry

The floor registry is the precedent: the *blocking* set is data with a per-entry rationale and a
consent path. The *non-blocking* set deserves symmetric treatment, because under this direction it
is the larger and more load-bearing half.

One row per detector: `id`, what it examines, which workflow invokes it, whether an actuator is
registered, where its receipts land, and its SLO class. The registry is what `verifyCoverage`
iterates. Without it, "all our checks run as drift checks" is a claim with no falsifier -- and by
`toy-is-free-metered-must-be-earned`, an unfalsifiable claim about coverage is a toy wearing a
dashboard.

---

## 4. The irreducible blocking set

### 4a. The unit is wrong in the usual framing, and fixing it dissolves most of the argument

The question is normally posed as "which checks stay blocking". That conflates two mechanisms with
different physics:

| | **Push-time predicate** (a ruleset *rule*) | **Rendezvous check** (a *required status check*) |
|---|---|---|
| Evaluated | synchronously, at push, by the forge | asynchronously, by a third party the push must wait for |
| Duration | zero | minutes |
| Can livelock | **no** | **yes** |
| Can be preempted | no | yes (`cancel-in-progress`) |
| Blocks a *writer* who never asked for CI | only if it violates the predicate | **always** |
| Forge-portable | as a hook (`pre-receive` / `pre-push`) | requires a CI system with a check-run API |

Every measured pathology in this repository -- the livelock (PR #12046: 42 cancelled, 18 running,
zero conclusions over 2h41m), the five-day ledger outage, the frozen heartbeat lanes, the
`[skip ci]` trap -- belongs exclusively to the **right-hand column**. The left-hand column has
produced no incidents, costs nothing, and is invisible to lanes that do not violate it.

**So the minimum is not a smaller list of jobs. It is a migration of the floor from the right column
to the left wherever the check is expressible as a predicate on the pushed tip.**

### 4b. The live blocking surface, measured 2026-08-18

| Mechanism | Rules | Class | Verdict |
|---|---|---|---|
| Classic branch protection on `main` | `required_linear_history: true`, `allow_force_pushes: false`, `enforce_admins: true` | predicate | **Keep.** Zero duration, erasure-class, no exit needed because it blocks only destruction. |
| Ruleset `Branch Safety` (16189060) | `deletion`, `non_fast_forward`, no bypass actors | predicate | **Keep**, same reasoning. |
| Ruleset `Heartbeat Branch Protection` (16934633) | `deletion` on `refs/heads/heartbeat/*` | predicate | **Keep.** This is what makes park-and-flush safe. |
| Ruleset `CI Gate` (16134995) | `required_status_checks: ["gate (required)"]`, bypass: repo-admin **on PR merge only** | **rendezvous** | **The only hub.** Every pathology lives here. |
| Ruleset `Default` (15256879) | **`enforcement: active`, `rules: []`** | vacuous | **A rule that cannot fail.** See 4d. |

### 4c. Argument for each survivor

**`non_fast_forward` and `deletion` survive** because they are erasure in the literal sense: a
force-push destroys the record, and no reconstruction recovers it. They are also the two cheapest
checks that exist -- the forge evaluates them from the ref update alone. They are hubs in the formal
sense (no exit) and this is accepted, because what they enforce is *"do not destroy history"*, which
is not a quality judgement anyone would want to route around. A rule that forbids destruction
constrains no one's ability to *do* work.

**`required_linear_history` survives** for the same reason plus one more: the entire drift-accounting
model is a tick-indexed fold over commit history. A non-linear history is not merely untidy, it
makes the fold's order ill-defined. Note the live divergence -- it is currently enforced only by
*classic branch protection*, not by the `Branch Safety` ruleset that the expected snapshot believes
carries it. Two overlapping mechanisms where the documentation and the live state disagree is itself
a hub-legibility problem.

**`gate (required)` is the contested one**, and the honest recommendation is *not* "remove it now":

- The 2026-08-13 sequencing rule is right: build agent-verified-merge, prove it on a real lane,
  *then* minimise the ruleset. Removing the rendezvous check before the quorum exists leaves neither.
- The seven floor entries in `registry/uncompensatable-floor.yaml` are each individually defensible,
  and six are genuinely erasure-class. The seventh (`typescript-type-break`) is recorded in the
  registry as *not* erasure-class and admitted on adjacent reasoning, with the honest limit stated in
  the registry itself. That is the discipline working.
- What *is* recommended immediately is narrower and is not a weakening: **the floor must not bind
  the ledger.** A writer whose payload is append-only evidence, produced by the Actions token,
  touching only `docs/drift-events/`, `data/*.json`, and `workitems/`, cannot break a build. Today
  it is blocked by a check about builds. Two routes exist and both are already proven in-repo:
  park-and-flush (preferred -- no ruleset change at all, and it is what four other lanes already do),
  or a path-scoped bypass actor. **Park-and-flush requires no consent path**, which is why it is the
  recommendation.

### 4d. The vacuous ruleset

`Default` is `active` with zero rules, while `docs/GITHUB-SETTINGS.md` describes it as carrying six
(deletion, non-fast-forward, Copilot review, code quality, PR squash-only + thread resolution,
linear history). The expected snapshot agrees with live (`rules: []`), so the *prose* is the stale
surface, not the detector.

Material consequence, stated plainly rather than assumed benign: **there is currently no active rule
requiring squash-merge or review-thread resolution on `main`.** Whether that is intended is Aaron's
call (section 10). Recording it here because an `active` ruleset with no rules is the governance
surface's own instance of the vacuity class -- it reads as protection and constrains nothing.

### 4e. Does a minimal gate dissolve the livelock? Yes, but say why correctly

PR #12046 established the condition: `gate.yml` keys concurrency per-ref with
`cancel-in-progress: true` on pull_request events, so when push-interval divided by duration is less
than 1, a ref can never conclude at any capacity. Runner minutes are not the constraint -- queue
delay was p50 = p90 = max = 0s at 30-way concurrency.

A gate that finishes in one minute cannot be preempted by a seven-minute push cadence. So yes, the
livelock dissolves.

**But that is a coincidence of parameters, not a structural fix, and it must not be sold as one.**
The livelock returns at any cadence faster than the new duration, and this fleet's cadence is set by
autonomous agents whose speed is deliberately increasing. Two claims, and only the second is
structural:

- *Contingent:* shrinking gate duration raises `interval / duration` above 1 at today's measured
  cadence. True today. An arithmetic fact about two numbers, one of which we do not control.
- *Structural:* **a push-time predicate has no duration, so `interval / duration` is not defined for
  it and the livelock condition cannot be formed.** Every floor entry moved from the rendezvous
  column to the predicate column is permanently immune, at any cadence.

The second is the design claim. The first is a welcome side effect that should not be mistaken for
the mechanism.

**Honest limit on the structural claim, and it is a real one.** On GitHub, the predicate column is
not freely available to us. Rulesets offer `deletion`, `non_fast_forward`, `required_linear_history`,
`required_signatures`, `creation`, `update`, `required_deployments`, and metadata-pattern rules
(`commit_message_pattern`, `commit_author_email_pattern`, `committer_email_pattern`,
`branch_name_pattern`, `tag_name_pattern`). There is no general "run this predicate at push time"
rule short of a `pre-receive` hook, which GitHub offers only on Enterprise Server.

Two consequences, one useful and one clarifying:

- **Useful:** the AgencySignature v1 trailer lives *in the commit message*, so
  `commit_message_pattern` can enforce its presence as a **zero-duration push-time predicate** --
  moving one floor entry out of the rendezvous column with no CI involvement at all. Worth
  evaluating; needs verification that metadata restrictions are available on this plan before it is
  proposed as work.
- **Clarifying:** the fact that we *cannot* express most of our floor as a push-time predicate on
  this forge is not an inconvenience. **It is the forge-shaped constraint, and it is the strongest
  concrete argument for sovereign mode in this whole document.** A git remote we control accepts a
  `pre-receive` hook that runs `bun run preflight --scope <diff>` in seconds. The rendezvous column
  is not a law of CI; it is a property of *this forge's* extension surface. Sovereign mode does not
  merely give us exit from GitHub -- it gives us access to a mechanism GitHub does not sell.

---

## 5. The corrective-action loop

### 5a. What exists

- **Detect:** `drift-sweep.yml` runs detectors; findings are data, not failures. Currently pipes
  markdownlint plus a `BD001` build-drift probe.
- **Act:** `retraction-actuator.ts` (sovereign `push_retraction` edge); certified healers
  (`md-fixer-certified.ts`, `memory-reindex-certified.ts`) that re-certify their three laws on every
  invocation and exit 2 touching nothing on failure -- certification *is* the write gate.
- **Verify:** next tick's sweep re-measures; MTTH folds per class.
- **Escalate:** `drift-ledger.ts slo` auto-files a P1 workitem for a class in breach, once per
  episode, keyed in `slo-filed.json`.
- **Evolve:** `drift-genome.ts` / `drift-evolution.ts` / `drift-proposer.ts` -- selection over
  budget genomes, proposing a registry change by consent letter, never editing the registry.

This is a genuinely good loop. It is more complete than most production reconciliation systems, and
the healer certification catching a live closure bug on its first run is the evidence the design
needed.

### 5b. What is missing -- three gaps, in severity order

1. **The actuator's own outcome is not part of the loop.** Detection is measured, healing is
   measured, and the *actuation* between them is not. Section 3's `ActuatorVerification` is the
   missing type. The five-day outage is what this gap looks like when it fires on the ledger itself.
2. **No quarantine.** An actuator that fails repeatedly retries forever. The ADR already names the
   risk ("a buggy healer at AI speed is a drift AMPLIFIER") and mitigates it with the
   idempotence/closure harness, which is a *correctness* guard, not a *liveness* guard. A healer can
   be perfectly idempotent and perfectly closed and still fail to land its write on every attempt --
   which is, exactly, what is happening now.
3. **Detector coverage is unregistered**, so the loop's input set has no falsifier (3e).

### 5c. Where corrective action runs -- three substrates, one code path

| Substrate | Suited to | Constraint |
|---|---|---|
| **Free GitHub Actions** | deterministic mechanical heals (formatting, regeneration, index rebuilds) | Cannot hold secrets beyond `GITHUB_TOKEN`; cannot push to `main` (section 2); unmetered on public repos, so capacity is not the limit |
| **Agent society** | judgement-shaped corrections (a type error with several valid fixes, a stale doc) | Non-deterministic; output must go through the *same* verification as any other change, and the verifier must not be the author |
| **Local hardware / USB** | anything needing hardware, physical keys, or biometric approval | Intermittently available; must be a tick *source*, never a tick *dependency* |

The scale-free requirement (manifesto 1, and `async-all-the-way`'s DoP knob) says these are the same
code path at three degrees of parallelism, not three implementations. The existing evidence that
this is achievable: `gate.yml` has 29 jobs and 31 invocations of `bun src/Core.TypeScript/...`.
**The checks are already TypeScript entry points; the YAML is already a thin dispatcher.** That is
what makes "same code path, different plugin" a near-term claim rather than an aspiration -- and it
is why `bun run preflight` can be the sovereign gate today (`docs/BUILD-GATES.md`) without a
parallel implementation existing.

The failure to avoid, stated so it can be checked later: **a second YAML of checks for sovereign
mode.** If sovereign mode ever grows its own list of what to run, the two lists drift, and the
mode-parity claim becomes unfalsifiable. The list lives in `registry/drift-detectors.yaml` and both
modes iterate it.

### 5d. What a corrective action may change

Bounding this is what keeps a self-healing repository from eating itself:

- **Permitted:** generated and derived artifacts (indices, lockfiles, formatting, drift events,
  receipts), and only where a certified healer exists for the class.
- **Requires quorum, never autonomous:** anything under `src/`, `registry/`, `.github/workflows/`,
  `GOVERNANCE.md`, `AGENTS.md`, and the floor registry itself.
- **Never:** the floor registry, the detector registry, and the receipt ledger's *history*. An
  actuator that can edit the registry defining its own bounds has no bounds. Appending to the ledger
  is permitted; rewriting it is the erasure class.

The existing `drift-proposer.ts` already demonstrates the right shape for the middle row: it detects
persistent dominance, writes a **consent letter** with the registry diff and the evidence, and never
edits the registry. That pattern generalises to every actuator whose target is outside the permitted
set.

---

## 6. The forge plugin boundary

### 6a. It exists; measure how real it is

The exit test from `itron-hub-patent-boundary-p2p-is-the-upgrade.md` is not "does an interface
exist" but *"can you defer elsewhere?"* Measured:

| Measurement | Value |
|---|---|
| `ForgeHost` interface methods | **23** |
| Methods implemented by `GitHubAdapter` | ~23 |
| Methods implemented by `GitLabAdapter` | **1** (`listOpenPullRequests`); 22 return `not-supported` |
| Files importing `forge-host` outside the module | **13** |
| TS files invoking the `gh` CLI directly | **62** |
| Workflows invoking `gh` directly | **29** |

**The port is real; the exit is not.** A `ForgeHost` method with exactly one working implementation
is not a port -- it is a hub with an interface painted on it, and the interface makes the hub
*harder* to see, not easier, because the shape suggests a substitutability that measurement refutes.

That is precisely the shape `audit-hidden-oracles.ts` exists to catch, one level up: a mechanism
that quietly acquired authority nobody granted it. The extension is mechanical and cheap:

> **`audit-forge-exit.ts`** -- for each `ForgeHost` method, count independently working
> implementations, and count the call sites that bypass the port entirely. Report the **deference
> distribution**. Manifesto 11 says no single mandatory locus of deference per function; here that
> becomes a number per method rather than a principle to assert. The liveness floor is 1 for the
> same reason the hidden-oracle audit uses 1: it is the only non-guess.

Honest limit, stated because the audit would otherwise be gameable: **a stub does not create exit.**
Twenty-three methods returning `not-supported` would score 2 and mean nothing. The count is of
*working* implementations, and the only real proof is a lane running end-to-end on a non-GitHub
adapter.

### 6b. What is genuinely GitHub-shaped

| Surface | GitHub mechanism | Sovereign replacement | Status |
|---|---|---|---|
| Change proposal | Pull Request | `ChangeSet` (canonical) projected to a view | Designed 2026-06-15; `NullChangeControlPort` is the sovereign base |
| Check results | check-runs API | `DriftReceipt` in the git-native event store | Substrate shipped, contract is section 3 |
| Merge gating | rulesets | `pre-receive` hook running `preflight --scope` | Not started; **the mechanism GitHub does not sell us** (4e) |
| Compute | Actions | tick sources: local cells, browser tabs, k8s, bare Linux | Rows 4-7 of the dogfooding ledger; 2 of 4 dogfooded |
| CD | Pages | static host on our own hardware / USB | See 6c and section 7 |
| Review archive | PR threads | already git files under `docs/history/pr-reviews/` | Effectively forge-neutral already |
| Identity | `github-actions[bot]`, PATs | AgencySignature trailer + persona keys | **Already forge-neutral** -- lives in commit trailers, not forge metadata |

The last row is the template for all the others: AgencySignature is portable *because it lives in
the commit*. Every surface that lives in git is already sovereign; every surface that lives in the
forge's database is not. That is the whole boundary, and it is a sharper test than any interface
inventory: **ask where the artifact is stored, not which API produced it.**

### 6c. CD independence -- already true, and worth stating as an invariant

`pages-deploy.yml` triggers on push to `main` with **no `needs:` on any gate job**, its own
concurrency group, and a 15-minute self-heal schedule. Aaron's requirement that *"CI failing won't
kill CD"* is therefore already satisfied structurally for the Pages lane, not by policy but by the
absence of an edge.

Two things follow:

1. **Record it as an invariant with a check**, or it will be undone by a future well-meaning
   `needs: gate`. A one-line audit over `pages-deploy.yml`'s job graph is sufficient, and it belongs
   in the detector registry like anything else.
2. **The property to preserve when CD moves to our own hardware is the absence of the edge**, not
   the specific host. The USB/local-hardware CD target inherits the invariant for free if it is
   driven by a ref, and loses it the moment it is driven by a check conclusion.

---

## 7. ZetaDB-native: which forge service goes first

`docs/trajectories/dogfooding-the-whole-stack/RESUME.md` row 10 has ZetaDB at partial -- it folds a
journal and commits checkpoints, but CockroachDB is still the real store. Row 15 (checkpoint to
reified types) is the arrow that makes ZetaDB a compiler stage.

**Recommendation: the evidence store goes first, not the code store.** Concretely, `DriftReceipt`
events are written to and read from ZetaDB/ZetaFS rather than to `docs/drift-events/*.json`.

Reasoning, in the order that matters:

1. **Blast radius is zero by construction.** Receipts are advisory. If the store is unavailable, the
   detectors still run and the floor still holds; the failure mode is a gap in the ledger, which
   3e's coverage invariant *already makes loud*. Contrast the code store, where a dogfooding failure
   is unrecoverable and would be the last dogfooding attempt anyone authorised.
2. **The shape already matches.** Receipts are append-only, ZetaId-keyed, content-addressed, and
   idempotent under replay -- the exact G-set/journal-fold shape ZetaDB already implements. This is
   not a port, it is a change of backing store behind the same event schema.
3. **It is the surface with no GitHub write-path dependency**, so it is unaffected by the section 2
   rejection class. Migrating it *also* routes around the ledger outage rather than merely fixing it.
4. **It converts a store into a compiler stage on the shortest path.** Receipts have a schema and a
   fold (MTTH). Row 15 wants a checkpoint that becomes types; a receipt schema is a small, honest
   first type to reify.

What should explicitly **not** go first: the code store, secrets, and anything on the identity path.
Those are the erasure class, and the erasure class is the last thing to dogfood, not the first.

---

## 8. Corporate and sovereign mode are one code path

The requirement (manifesto 1 scale-free, and the DoP knob in
`async-all-the-way-truthful-signatures.md`) is *beautiful on one, scales to N, same code path, no
special cases*. Applied here:

| Layer | Corporate mode | Sovereign mode | Shared? |
|---|---|---|---|
| What to check | `registry/drift-detectors.yaml` | same file | **yes -- by construction** |
| How to check | `bun src/Core.TypeScript/...` entry points | same entry points, via `preflight` | **yes today** (31 invocations across 29 gate jobs) |
| Where it runs | GitHub Actions runner | local cell / browser tab / k8s pod | tick source, injected |
| Where results land | check-run **and** receipt | receipt | receipt is canonical; check-run is a projection |
| What may land a change | PR + `gate (required)` | quorum of agent verifiers | `ChangeControlPort` adapter |
| Forge access | `GitHubAdapter` | git remote we control | `ForgeHost` adapter |

Only the bottom three rows differ, and each differs *by adapter selection*, never by a second
implementation. The design rule that keeps this true, stated as a falsifiable invariant:

> **No check may exist in corporate mode that does not exist in sovereign mode.** The detector
> registry is the single list; a workflow that runs something not in the registry is a mode-parity
> violation and is detectable by iterating the registry against the workflows.

The DoP analogy is exact and worth making explicit because it tells you which mode is the *primary*
one: DoP=1 is the deterministic, replayable, legible configuration, and it is where FoundationDB
puts its reference standard. **Sovereign mode is DoP=1.** It is the mode where one machine runs
every check deterministically and the receipt is the whole record. Corporate mode is the same loop
with the work fanned out across runners and a forge-shaped projection layered on top for humans.
Building sovereign mode is therefore not building a fallback -- it is building the reference
implementation, and the one that is easier to reason about.

---

## 9. Sequenced work, smallest-first

Explicitly **not** started by this document. Ordered by (value / risk), with the sequencing rule from
the 2026-08-13 design honoured: build the replacement before removing anything.

1. **Migrate `drift-sweep.yml` to park-and-flush.** One lane, proven pattern, restores the drift
   clock. No ruleset change, no consent path. *This is the whole outage.*
2. **Replace every `|| echo` swallow in a workflow with a recorded outcome.** Mechanical; an
   `actionlint`-adjacent audit can find them.
3. **Fix `github-settings-drift.yml`'s laundering** -- keep it non-blocking, but emit a receipt so
   the finding lands somewhere durable. Then refresh the expected snapshot, which is stale on the
   governance surface specifically (3b).
4. **Create `registry/drift-detectors.yaml`** and the coverage check. This is the falsifier for
   "all our checks run as drift checks", and until it exists the claim is a toy.
5. **Implement `DriftReceipt`** for the six existing ledger classes, then widen.
6. **`audit-forge-exit.ts`** -- the deference distribution per `ForgeHost` method. Cheap, and it
   turns forge-agnosticism from a stated goal into a measured one.
7. **Actuator quarantine** keyed on the existing `slo-filed.json` episode key.
8. **Prove one lane end-to-end on a non-GitHub `ForgeHost`.** Until this happens, exit is a design
   claim with no evidence. It is also the only item on this list that cannot be faked.
9. **Move receipts to ZetaDB** (section 7).
10. **Then, and only then, minimise `CI Gate`.**

---

## 10. What is Aaron's decision, not mine

Listed explicitly because several of these are governance acts, and the architect seat is advisory
on all of them.

1. **The `Default` ruleset is `active` with zero rules** (4d). Consequence: no active rule requires
   squash-merge or review-thread resolution on `main`. Intended, or drift to repair? The prose in
   `docs/GITHUB-SETTINGS.md` describes six rules that are not there.
2. **`required_linear_history` is enforced by classic branch protection only**, not by the
   `Branch Safety` ruleset the expected snapshot believes carries it. Consolidate onto one mechanism,
   and which one?
3. **Whether the ledger gets park-and-flush or a scoped bypass actor.** Recommendation is
   park-and-flush (no consent path, four lanes already prove it). A bypass actor for evidence-only
   paths is the alternative and is a governance act.
4. **Whether `commit_message_pattern` may enforce the AgencySignature trailer** as a zero-duration
   push-time predicate (4e). This would move a floor entry out of the rendezvous column entirely.
   Needs plan-availability verification first.
5. **Any change to `registry/uncompensatable-floor.yaml`.** Nothing in this document proposes one.
   The treaty-amendment consent path is named in the registry itself and it applies to *removals*
   as well as additions.
6. **When `CI Gate` is minimised**, which is downstream of agent-verified-merge existing and being
   proven on a real lane. Not now.
7. **Quorum sizes** for agent-verified-merge. Already answered as *path-dependent* (2026-08-13):
   byte-locked treaties want more reviewers, different reviewers per language. The specific numbers
   remain open.
8. **Which forge is the second adapter**, if any, and whether it is a real forge or the sovereign
   git remote. Recommendation: the sovereign remote, because the goal is exit rather than portfolio.
9. **What the CD target on local hardware is** and whether it inherits the no-`needs:` invariant
   (6c) as a hard requirement.
10. **Whether receipts are the first ZetaDB dogfooding target** (section 7), or whether a different
    row of the dogfooding ledger outranks it.
11. **The bounds in 5d** -- what an autonomous actuator may change without quorum. That list is a
    values judgement with a security surface, not an engineering preference.

---

## 11. Honest limits of this document

- **The five-day outage is measured; the eight-week `continue-on-error` laundering is sampled.** Five
  runs across the window were checked individually, not all of them. The sampled ones are unanimous.
- **The `commit_message_pattern` proposal (4e) is unverified against this repository's plan.** It is
  offered as a lead, not a recommendation, and it is flagged as such in section 10.
- **No timing claim is made about how fast a minimal gate would be.** 4e deliberately argues from the
  *absence of a duration*, not from a smaller one, because the smaller-duration argument is
  contingent on a push cadence we do not control and are deliberately increasing.
- **`ForgeHost` completeness was measured by counting `not-supported` returns**, which is a lower
  bound on incompleteness -- a method could be implemented and wrong. Only a lane running end-to-end
  settles it, which is why that is item 8 and not item 1.
- **This document proposes no code and starts no migration.** Every finding above is reported with
  its evidence so that the decisions in section 10 can be made on facts rather than on this
  document's framing.

---

## Pointers

- `docs/DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md` -- the ratified flip
- `docs/design/2026-08-13-agent-verified-merge-replacing-prs.md` -- what replaces the gate, and the sequencing rule
- `docs/research/2026-06-15-two-gating-modes-corporate-pr-vs-sovereign-society-self-check-safe-by-construction-no-pr.md` -- the mode split
- `registry/uncompensatable-floor.yaml` and `registry/drift-slo.yaml` -- the floor and its SLO, as data
- `src/Core.TypeScript/forge-host/` -- the port; `github/flush-via-staging.ts` -- the park-and-flush route
- `src/Core.TypeScript/hygiene/audit-hidden-oracles.ts` -- the exit test, made mechanical, for numbers
- `docs/BUILD-GATES.md` -- the sovereign gate that already exists
- `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` -- the ZetaDB replacement ledger
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` -- hubs are enforced, oracles are chosen
- `.claude/rules/toy-is-free-metered-must-be-earned.md` -- an unfalsifiable coverage claim is a toy
- PR #12052 (multi-repo topology), PR #12046 (livelock diagnosis), PR #12037 (workflow timeouts), PR #12051 (formal-verification consolidation)
