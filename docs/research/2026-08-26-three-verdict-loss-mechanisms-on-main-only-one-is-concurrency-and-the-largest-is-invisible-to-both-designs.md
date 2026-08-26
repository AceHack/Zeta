# Three verdict-loss mechanisms on `main` — only one is concurrency, and the largest is invisible to both designs

**Status:** decision doc. No workflow, ruleset, or repository setting is changed by the PR
that carries it. It exists so the choice below is made on measurements rather than on the
story we have been telling about the cancellations.

**Question asked** (Aaron, 2026-08-26): *"can we redisign this to do parallel runs so none
ever get cancled?"*

**Short answer.** Yes for one of the three mechanisms, and it is not the largest one. The
`drift (loud)` canary's 56.7% cancellation figure is real and reproduces exactly — but the
cause it names is wrong, the fleet's own churn is *not* inflating it, and a second,
**larger** class of commits never gets a run at all, which no concurrency topology can
reach. Order of operations matters more than the choice between the two candidate designs.

---

## 0. Method and window

All numbers below are measured against `Lucent-Financial-Group/Zeta` on 2026-08-26 via the
Actions API, not inferred.

| | |
|---|---|
| Window | `2026-08-25T08:16:18Z` .. `2026-08-26T09:41:12Z` (25 h 25 min) |
| `gate` runs examined | 600 (the 6 most recent API pages — complete coverage of the window) |
| Commits on `origin/main` in window | 245 |
| Merged PRs in window | 221 |
| Repo | public, org plan **enterprise** |

Where a claim rests on a sample rather than the full population, the sample size is stated
inline. Where I could not verify something, it is in §8 rather than softened in the text.

---

## 1. The attribution table

`gate` runs by triggering event and conclusion:

| event | total | success | failure | cancelled | in flight | **cancel rate** |
|---|---|---|---|---|---|---|
| `pull_request` | 453 | 101 | 219 | 123 | 10 | 27.2% |
| `push` (to `main`) | 147 | 14 | 48 | **83** | 2 | **56.5%** |
| `merge_group` | 0 | — | — | — | — | — |
| `workflow_dispatch` | 0 | — | — | — | — | — |

The canary's 56.7% is the **push** lane. It reproduces. `merge_group: 0` confirms the merge
queue is not enabled.

### 1.1 Hypothesis 1 — queue displacement on `main`: **CONFIRMED, 83 of 83**

Every one of the 83 cancelled push runs had **zero jobs**. Not zero *completed* jobs — zero
jobs, ever. The `/actions/runs/<id>/jobs` endpoint returns `total_count: 0` for all 83. No
job was created, so no job was ever `in_progress`, so **nothing was interrupted**.

The timestamps say the same thing a second way. Cancellation lands 1–4 seconds after the
*next* push run is created:

| run | created | cancelled | next run created |
|---|---|---|---|
| `32952980717` | 09:26:09 | 09:27:13 | 09:27:12 |
| `32953073002` | 09:27:12 | 09:31:06 | 09:31:05 |
| `32952848390` | 09:24:41 | 09:26:10 | 09:26:09 |

This is GitHub's documented behaviour for a concurrency group with
`cancel-in-progress: false`: the group holds **one in-progress run and at most one pending
run**, and a third arrival cancels the pending one. Arrival rate exceeds service rate
(measured: 5.8 pushes/hour against an 18-minute p50 push-run duration), so the group is
permanently saturated and the pending slot is permanently being displaced.

**`cancel-in-progress` is not implicated on the push lane at all.** It already evaluates
`false` there, and the measurement shows it doing exactly nothing.

### 1.2 A correction two in-repo surfaces need

`src/Core.TypeScript/ci/verdict-drought.ts` opens with:

> *"`gate.yml` uses a per-ref concurrency group with `cancel-in-progress`, and a merge to
> `main` cancels the run still in flight for the previous merge."*

and `.github/workflows/drift-sweep.yml` restates it. **That is not what happens.** The run
still in flight is never cancelled; the run that never started is. 83 of 83 with zero jobs
is the falsifier.

The *condition* those files report is real and their detection of it is sound — this is a
misattributed cause, not a false alarm, and it was an entirely reasonable reading before
anyone counted jobs. But the remedy differs from the one the wording implies: there is no
`cancel-in-progress` setting to change, and "stop cancelling in-flight runs" would be a
no-op.

### 1.3 Hypothesis 2 — PR-side `synchronize` cancellations: **CONFIRMED, and it is the opposite population**

Of the 123 cancelled `pull_request` runs, **118 had at least one started job** — genuine
in-flight interruption, which is `cancel-in-progress: true` working exactly as designed on
a PR. Only 5 were queue-displaced.

So the two lanes fail by *disjoint* mechanisms: push loses runs that never started, PR
cancels runs that did.

Cancelled PR runs by branch prefix: `fix` 32, `heartbeat` 22, `claude` 11, `feat` 10,
`docs` 8, `claim` 6, `shadow` 5, `otto` 5, others ≤4.

**The expectation that the fleet's own remediation is inflating the headline does not
hold.** Two reasons:

1. The headline is a **push**-lane number, and PR-side cancellations do not contribute to
   it at all.
2. Even within the PR lane, `heartbeat/*` cancels at **22 of 151 = 14.6%**, *below* the
   27.2% PR average. The mechanical lanes are the best-behaved population in the table, not
   the worst.

The standing cancellation rate is therefore **not** lower than 56.7% once fleet churn is
excluded. Excluding fleet churn does not move it, because fleet churn was never in it.

---

## 2. The larger mechanism nobody had attributed: 40% of commits never get a run

**98 of 245 commits on `main` (40.0%) were never the `head_sha` of any `gate` push run.**
Queried directly per SHA, those commits have `gate` run count **zero** — only `dynamic`,
`schedule`, and `workflow_run` events appear against them. There is no run object to be
cancelled, displaced, or rerun.

Of the 84 I could map back to a merged PR: **78 `heartbeat/*`**, 4 `shadow`, 1 `fix`,
1 `claim`.

The discriminator is the **merge actor**, and the separation in the samples is total:

| sample | merged by | gate push run created? |
|---|---|---|
| 20 commits with no run | `github-actions[bot]` (GITHUB_TOKEN) | **no**, 20/20 |
| 18 commits with a run | `AceHack` (PAT) | **yes**, 18/18 |

This is GitHub's documented rule that events triggered by the repository's `GITHUB_TOKEN`
do not create new workflow runs.

**No concurrency design reaches this class.** Design A and Design B both change what happens
*to a run*; here there is no run.

### 2.1 This is the known bug's second half

The repo already found and fixed the *PR-side* version of this. `agent-heartbeat.yml` (and
work-item `081M010H4KE`) records that a `pull_request` run whose triggering actor is
`github-actions[bot]` is created and immediately parked as `action_required`, so it never
contributes `gate (required)` to the flush PR's rollup. The fix was to push the heartbeat
branch with `ZETA_TELEMETRY_FLUSH_TOKEN` (a PAT), and it works — PR #15562's head carries
**53 check-runs including the full gate**.

What was not covered is the **merge**, which is still performed by `github-actions[bot]`.
So the branch push now triggers the PR gate, and the merge still triggers nothing.

Worth recording precisely, because the two behaviours differ and the earlier note in
`agent-heartbeat.yml` corrected one into the other: on the **`pull_request`** event the run
*is* created and held (`action_required`); on the **`push`** event **no run is created at
all**. Both readings were right about their own event class.

### 2.2 The verdict ledger for `main`

| | commits | share |
|---|---|---|
| Concluded gate verdict at their own SHA | 62 | 25.3% |
| Run created, displaced while pending (§1.1) | 83 | 33.9% |
| **No run ever created** (§2) | **98** | **40.0%** |
| In flight at snapshot | 2 | 0.8% |

The canary's "11 commits carrying no verdict" is its *blast radius since the last verdict*
— the current drought, not the cumulative one. It is not wrong; it is a different quantity,
and it under-states standing exposure by about an order of magnitude.

### 2.3 What is **not** lost, stated so the alarm is the right size

Every one of those commits was gated **pre-merge** by `gate (required)` on its PR,
heartbeat PRs included. What is lost is the **post-merge** verdict.

That still matters, and here is exactly why: the `CI Gate` ruleset has
`strict_required_status_checks_policy: false`, so a PR may merge without being up to date
with `main`. The post-merge push run is therefore the **only** thing standing between us
and the class *two PRs that each pass alone and break together*. Losing 74% of those runs
is losing 74% of the coverage of that class — no more, and no less.

*(Aside, since it is a claim about what blocks a merge: `CLAUDE.md` states the `CI Gate`
ruleset has "no bypass actors". It has one — `RepositoryRole 5`, `bypass_mode:
pull_request`.)*

---

## 3. The recovery lane that already exists, and the one-word reason it does not fire

`rerun-cancelled-gate.yml` re-runs cancelled `gate` runs. It is careful, reviewed, and
security-hardened. It recovers **essentially nothing on the push lane**:

| lane | runs | second attempts |
|---|---|---|
| `pull_request` | 453 | **66** |
| `push` | 147 | **1** |

The cause is guard 3 in `src/Core.TypeScript/ci/rerun-cancelled-gate-run.ts`:

```ts
return siblings.find((o) => {
  if (o.id === run.id) return false;
  if (o.head_branch !== run.head_branch) return false;   // <-- branch, not SHA
  const t = Date.parse(o.created_at);
  return t > startedAt && t <= cutoff;
});
```

It matches on `head_branch` and ignores `head_sha`. On a PR branch that is correct — a
newer run on the same branch is a newer *commit*, and it genuinely supersedes the old one.
On `main` it is false: the next push run has a **different `head_sha`** and carries no
verdict for the displaced commit. So every displaced push run is classified

> `superseded — run <id> on main replaces it (concurrency working as designed)`

…and the displaced commit's verdict is written off with a message asserting the opposite of
what happened. This is the vacuity class in its usual costume: a guard that cannot fire on
the population that needs it, wearing a reassuring string.

Fixing it is a one-predicate change — require `o.head_sha === run.head_sha`, or exclude the
default branch from guard 3. **It is the smallest change in this document with the largest
measured effect**, and it introduces no topology risk, because the lane it activates is
already built, already reviewed, and already rate-limited to one automatic retry per run id.

*(Honest caveat: whether the Actions API will re-run a run that has zero jobs is not
something I tested. If it refuses, the correct shape is a `workflow_dispatch` of `gate` at
the displaced SHA rather than a re-run — same lane, same guard, different call.)*

---

## 4. Design A — per-SHA concurrency on push

```yaml
group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}
```

**What it fixes.** The 83 displaced runs, completely. Every push gets its own group, so
nothing queues and nothing displaces. It converts *dropped* verdicts into *delayed* ones,
which is the right direction: a late verdict is a verdict.

**What it does not fix.** The 98 commits in §2. Nothing changes for them.

### Runner cost

Measured on one complete push run (`32952157707`): **37 jobs, 5,638 runner-seconds
(94 runner-min)**.

* Executed push runs go 64 → 147 in the window: **+83 runs/day ≈ +7,800 runner-min/day**
  (≈ +5.4 runner-min per wall-clock minute, sustained).
* Runner concurrency is **not** the binding constraint. The org plan is **enterprise**, and
  peak load is modest: measured peak **18 pushes/hour** and **21 commits/hour** (mean 9.6
  commits/hour). At an 18-min p50 that is ≤6 concurrent gate runs ≈ 220 concurrent standard
  jobs and ≤6 concurrent macOS jobs.
* The "~50 commits/hour at peak" figure used in the brief is high for this window; measured
  peak was 21.

### Cache cost — this is where A hurts, and it is not a footnote

The **push** run is the cache-write-heavy shape, because it alone carries `windows-2025`,
`windows-11-arm`, and `macos-26` legs with OS-prefixed keys. Measured, same two runs:

| | cache-participating jobs | jobs that actually **uploaded** (`Post Cache` > 2 s) |
|---|---|---|
| push run | 18 | **5** (full-verify 29 s; win-2025 NuGet 7 s + .NET 25 s; win-arm NuGet 11 s + .NET 24 s) |
| PR run | 15 | **0** — every key hit |

A cache save only uploads on a key **miss**. So Design A adds roughly **+415 cache uploads
per day on the lane that dominates cache writes** — a ~130% increase on the push lane —
against a ceiling that is separately measured as already evicting 23 GiB per 61-second
sweep.

And it is a **positive feedback loop**: more runs → more uploads → more eviction → more
misses → more uploads. Design A makes the problem another agent is currently fixing
materially worse, and it does so through a mechanism that amplifies rather than adds.

**Verdict on A:** correct, one line, one line to revert, and it should **not land before the
cache work does.**

---

## 5. Design B — enable the merge queue

**Queue-readiness confirmed.** `merge_group:` is already a trigger on `gate.yml` and
`codeql.yml`. No other workflow has it, and while `gate (required)` is the sole required
context, no other workflow needs it.

**What it fixes, structurally rather than statistically.** The queue tests each candidate
against the *post-merge* tree, in order. "Merges outrun the gate" becomes impossible by
construction rather than less likely. It also makes
`strict_required_status_checks_policy: false` moot, which is the setting that creates the
semantic-conflict exposure in the first place. And it catches the two-PRs-green-alone class
that the current topology structurally cannot.

**It would also fix §2** — *if* `merge_group` runs dispatch for entries enqueued by
`GITHUB_TOKEN` — because it moves the verdict pre-merge, where a run exists.

### The disqualifying risk, and I cannot test it

If `merge_group` events enqueued by `github-actions[bot]` are suppressed or parked
(`action_required`) the way `pull_request` events from that actor were **measured** to be
(§2.1), then every heartbeat entry enters the queue, its required check never reports, the
entry times out, and it is dequeued. **The telemetry lanes wedge permanently** — the lanes
whose entire purpose is keeping the factory's liveness observable.

This is the coordinator's predicted first-thing-to-check, and it is the correct one. It
**cannot be verified without enabling the queue**. The mitigation is already in hand and is
the same fix that worked once: enqueue with `ZETA_TELEMETRY_FLUSH_TOKEN` rather than
`GITHUB_TOKEN`. But "we think the known fix transfers" is not a measurement.

There is a live work-item on precisely this failure shape:
`081M0X15SKR087G0R001RJP5V6-telemetry-flush-lanes-head-of-line-block-forever-behind-a-te`.

### Throughput and latency — thin, not comfortable

* Measured merge rate: **8.7 merges/hour mean, 18/hour peak**.
* Pre-merge gate p50: **13 min** (the pre-merge matrix is Linux + `macos-26`).
* A queue at `max_entries_to_build: 5` with grouping gives ≈5 candidates per 13 min ≈
  **23/hour**. Above peak, but ρ ≈ 0.78 at peak — and a single failure triggers
  dequeue-and-rebuild, which roughly halves it.

**Latency for the mechanical lanes.** `heartbeat/*` is **89 of 221 merges (40%)**. Under a
queue they compete for the same slots as content PRs, and **GitHub's merge queue has no
priority lane**. At ρ ≈ 0.78, expected wait is ~12 min on top of a ~13 min build ≈ **~25 min
per entry**, against a ~20 min flush interval — so flushes would begin overlapping their own
cadence.

That is **degradation, not starvation**, and it is bounded. It is not by itself
disqualifying. The GITHUB_TOKEN question above is.

### Auto-merge composition

`gh pr merge --auto --squash` composes with a queue — auto-merge enqueues once checks pass.
One sharp edge: the effective merge method becomes the **queue's** configured method, so the
repo's squash discipline has to be set on the queue rather than on the call. Low risk, but
getting it wrong changes the shape of *every* merge.

---

## 6. Decomposition — the standing direction, priced

> *"if it's a shared gate we want to reduce those to smaller individual ones rather than
> widening one that's monolithic already, we are trying to split our monolith bit by bit."*
> — Aaron, 2026-08-26

Taken here as a **stated premise**, not as something to quietly optimise for.

### 6.1 The gate is already decomposed at the job level

37 jobs, of which ~26 are `lint (...)` matrix legs — each already a separately-named
check-run visible in the PR checks list. What is monolithic is only the rollup:

```yaml
needs: [matrix-setup, path-filter, build-and-test, lint, lint-typescript,
        cross-verify, full-verify, test-typescript-hermetic]
```

`lint` collapses ~26 legs into one entry; `cross-verify` runs **31 audit steps** under one
name. That is the "one red standing for N audits" defect, and it lives in the `needs:` list
and the ruleset, not in the job graph.

So "decomposition" is **two different changes at two very different prices**:

**(a) Promote existing job names into `required_status_checks`.**
Cost: **zero runner-minutes, zero cache bytes.** The jobs already run and already publish
named check-runs. This is a ruleset edit, not a workflow edit, and it is what makes the red
name the defect for the 26 lint legs and the 5 `build-and-test` legs. It is by far the
cheapest move available and it is available today.

**(b) Split one job that does N things into N jobs** — the `cross-verify` case. This costs
one job's fixed overhead per new check, and the price is set entirely by which **setup
class** the job belongs to.

### 6.2 The three setup classes, measured

| class | setup steps | measured overhead | cache bytes |
|---|---|---|---|
| **0 — Bun only** | set-up-job + checkout + setup-bun + `bun install` | **10–14 s** (`cross-verify` 12 s, `lint (markdownlint)` 13 s) | **none** — no `actions/cache` step at all |
| **1 — install.sh toolchain** | + apt restore + `install.sh` + `actions/cache` | **46–149 s** (`full-verify` 149 s, `lint (§33 xrefs)` 55 s) | one restore + one conditional save |
| **2 — build-and-test** | + NuGet + elan + mise + .NET SDK caches | **129–356 s** | four caches per leg |

**`cross-verify` is class 0.** Splitting its 31 audits into 31 named checks costs
`31 × 12 s ≈ 372 s ≈ 6.2 runner-min` on a 94-runner-min run — **+6.6%**, **zero additional
cache writes**, and **no wall-clock change**, since they run in parallel.

**The split Aaron's direction most demands is the cheapest split available, and it is
affordable today, cache work or no cache work.**

### 6.3 It can be made better than free

**42% of the gate's runner-seconds (2,412 s of 5,638 s) is setup overhead.** Three existing
class-1 lint jobs pay a full toolchain install to run an audit that takes **zero seconds**:

| job | setup paid | actual work |
|---|---|---|
| `lint (§33 migration xrefs)` | 22 s cache + 2 s apt + 21 s install.sh | **0 s** |
| `lint (no conflict markers)` | 12 s cache + 1 s apt + 23 s install.sh | **0 s** |
| `lint (tick-shard relative-paths)` | 2 s apt + 44 s install.sh | **1 s** |

If those audits do not need the toolchain, demoting them to class 0 frees ~110
runner-seconds **and one cache participant each** — which pays for the entire `cross-verify`
split with change left over. I have **not** verified that they don't need it (§8); that
check belongs to whoever owns those jobs, and it is the only thing standing between this
and a budget-neutral decomposition.

### 6.4 The rule that falls out

> **A job may be split for free along a setup boundary it does not cross.**

Splitting *within* class 0 is ~12 s per check and no cache. Splitting in a way that creates
a new class-1 or class-2 job costs 46–356 s **and a new cache participant** per check —
which is exactly the multiplier the cache work is fighting.

**So the affordable decomposition frontier today is: split class-0 jobs freely; create no
new class-1/2 jobs until the cache work lands.** Decomposition is *not* blocked on the cache
work — the part of it that matters most is class-0 and is affordable now.

### 6.5 Does a merge queue compose with a long and growing required list?

**Length is not the problem. Shape is**, and there is one sharp edge:

The **pre-merge matrix is Linux + `macos-26` only** (verified: a PR run's `build-and-test`
legs are `ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-26`). The **push** matrix adds
`windows-2025` and `windows-11-arm`.

**Promoting a Windows leg to required would deadlock the queue permanently** — the check can
never report on a `merge_group` event, so every entry times out. The same hazard applies to
any future required check produced by a workflow lacking `merge_group:` (today, only
`gate.yml` and `codeql.yml` have it).

Under a growing required list this is a real footgun, and a **silent** one: it presents as a
stuck queue, not as a misconfiguration.

The mitigation is mechanical and cheap: **a lint asserting that every context in
`required_status_checks` is produced by a `merge_group`-triggered workflow and runs under
the pre-merge matrix.** That lint should land **before** the queue, not after.

With that lint in place, B composes with decomposition *better* than A does — the queue's
cost is per-*entry*, not per-*check*, so adding checks does not multiply queue latency the
way it multiplies A's runner and cache load.

---

## 7. Recommendation

**Neither A nor B first.** The ordering carries more value than the choice, because 40% of
the exposure is invisible to both.

1. **Make heartbeat merges dispatch a run** (§2). Largest single class, untouched by any
   concurrency design. Cheapest fix: merge the flush PRs with the PAT that already pushes
   their branches — the same fix that already worked for the branch push. Fallback if the
   merge actor must stay `github-actions[bot]`: `workflow_dispatch` `gate` at the merged SHA
   from the flush lane (the heartbeat measurement already used
   `workflow_dispatch gate success actor=AceHack` as its control, so that path is known to
   work).

2. **Fix `isSuperseded` to compare `head_sha`, not just `head_branch`** (§3). Two-line
   change; turns an existing, reviewed, hardened lane into the recovery path for all 83
   displaced push runs. No topology risk. Do this before either design.

3. **Land the `merge_group` coverage lint** (§6.5) — before any queue, and useful even if no
   queue is ever enabled.

4. **Then Design B**, gated on the GITHUB_TOKEN enqueue question being answered. B is the
   right end state: it is the only option that makes "merges outrun the gate" *impossible*
   rather than merely less likely, the only one that addresses
   `strict_required_status_checks_policy: false`, and the one that composes best with a
   growing check set.

5. **Design A as fallback only**, and not before the cache work lands.

Steps 1–3 are all reversible, none of them changes what blocks a merge, and together they
recover 181 of the 183 lost verdicts without touching a repository setting.

### 7.1 The case against my own recommendation

It is strong and should be read before acting on §7.

B is a **repository-setting change that alters what blocks a merge for everyone**. It has an
unverified failure mode that would wedge the telemetry lanes. Its throughput headroom at
peak is thin (ρ ≈ 0.78, no priority lane, bisect-on-failure roughly halving capacity). Its
latency cost lands hardest on the 40% of merges that are mechanical and time-sensitive.

A is one line, revertible in one line, and **cannot wedge anything**. If the cache work
lands and the measured write rate drops, **A becomes the low-risk answer and B becomes an
optimisation** — and a reasonable person could order these the other way round on exactly
that basis.

**What actually decides it is a fact I do not have:** whether the semantic-conflict class —
two PRs green alone, red together — has ever actually bitten `main` here. If it has, B's
structural guarantee is worth its risk budget. If it has not, A's reversibility wins and B
is buying insurance against a hypothetical. **That measurement is cheap and worth taking
before spending the queue's risk budget**, and it is the single highest-value follow-up in
this document.

### 7.2 Hybrid: not recommended

A queue for content PRs plus per-SHA push concurrency for the mechanical lanes needs the
queue to be scoped in a way GitHub does not offer — the queue is per *target branch*, and
both lanes target `main`. The measurements do not demand the complexity, and steps 1 + 2
already give the mechanical lanes what a hybrid would buy them.

---

## 8. What I could not verify

Stated rather than softened, because an unverified claim that reads as a measured one is the
defect this repo exists to refuse.

1. **Whether `merge_group` runs dispatch when the entry was enqueued by `GITHUB_TOKEN`.**
   Untestable without enabling the queue. **The single highest-value unknown**, and the one
   that could disqualify Design B outright.
2. **Cache bytes.** I measured cache-save *durations* and participant *counts*, not GiB. The
   ~69 GiB/hour figure is another agent's measurement and I did not re-derive it. My cache
   claims are **proportional** ("+130% on the push lane"), never absolute.
3. **Whether the three zero-second class-1 lint jobs actually need the toolchain** (§6.3).
   If they do, the budget-neutrality claim fails. The `cross-verify` split is still +6.6%
   and still affordable either way.
4. **Whether the Actions API will re-run a run with zero jobs** (§3). If not, the fix shape
   is `workflow_dispatch` rather than re-run.
5. **14 of the 98 no-run commits** could not be mapped to a merged PR (outside my 400-PR
   fetch window). The 84 that mapped are 78 `heartbeat` / 4 `shadow` / 1 `fix` / 1 `claim`.
6. **Whether the semantic-conflict class has ever actually broken `main`.** §7.1 depends on
   this and I did not measure it.

---

## 9. What Aaron must decide

Every item below is gated-class. None has been taken, and this document's PR changes no
workflow, no ruleset, and no repository setting.

1. **Enable the merge queue on `main`?** A repository setting that changes what blocks a
   merge for everyone.
2. **Accept ~25 min queue latency on heartbeat/telemetry flushes (40% of merges)**, or route
   the mechanical lanes around the queue?
3. **Change the merge actor for heartbeat flush PRs from `github-actions[bot]` to the PAT?**
   This widens what that credential does, and credential scope is a security-class call.
4. **How fine should the required check set get, and in which order?** §6.1(a) is free;
   §6.1(b) is priced per setup class in §6.2. The frontier is stated, the destination is not
   mine to pick.
5. **Is Design A acceptable as an interim**, given it worsens cache pressure on the
   write-heavy lane by ~130% through an amplifying loop?
6. **Should steps 1–3 of §7 proceed now**, independent of the A/B decision? They are
   reversible, none changes what blocks a merge, and together they recover 181 of the 183
   lost verdicts.

---

## Pointers

* `.github/workflows/gate.yml` — the concurrency block (L106–108) and the `gate (required)`
  rollup (L3712).
* `src/Core.TypeScript/ci/verdict-drought.ts` — the detector; its header needs the §1.2
  correction.
* `.github/workflows/drift-sweep.yml` — the second detector host; restates the same
  misattribution. Measured healthy: 6 cancelled of 100 runs.
* `src/Core.TypeScript/ci/rerun-cancelled-gate-run.ts` — `isSuperseded`, the §3 guard.
* `.github/workflows/agent-heartbeat.yml` L60–100 — the PR-side half of §2, already found
  and fixed.
* `081M0X15SKR087G0R001RJP5V6` — telemetry flush lanes head-of-line blocking.
* `081M010H4KE` — `gate (required)` not starting on flush PRs.
* `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §8 is a section and not a
  hedge.
