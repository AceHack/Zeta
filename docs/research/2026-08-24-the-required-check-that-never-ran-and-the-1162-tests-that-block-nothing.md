# The required check that never ran, and the 1,162 tests that block nothing

**Status:** DRAFT — awaiting human maintainer sign-off on the numbered questions in §6.
The code and workflow in the accompanying PR are landed as _detection only_; nothing in
them changes what blocks a merge. Work-item `081M0TK8DE8087G0R0001HSKHF`.

**Author:** Dejan (devops-engineer). **Measured:** 2026-08-24, against `origin/main` at
`708c391dfc3bfc81cd61c9bd72f72d419bee306c` and against the live forge.

---

## 1. The reported finding, and the correction

The finding routed to me was: PR #14858 reported `fail=0, pend=0` while
`bun test src/Core.TypeScript/ace/` was rc=1 with two DRIFT GATE failures, and therefore
"no job the PR surfaces ran that test" — i.e. a floor-scope hole.

**The floor-scope half is false, and I could not confirm it without disproving it.**
`bun test src/Core.TypeScript/ace/` is a step of the `cross-verify` job, and `cross-verify`
is named in `gate-required.needs`. It has no `if:` and no `continue-on-error`. The ace
drift gate has been inside the blocking floor since PR #7768.

**Sabotage control** — the same defect class, reconstructed, exit codes captured directly:

| step           | command                                                                                       | rc    | result                |
| -------------- | --------------------------------------------------------------------------------------------- | ----- | --------------------- |
| baseline       | `bun test src/Core.TypeScript/ace/`                                                           | 0     | 703 pass / 0 fail     |
| sabotage       | add `<ProjectReference>` to `clis/Zeta.Clis.fsproj`, do **not** regenerate `build-graph.json` | —     | —                     |
| under sabotage | `bun test src/Core.TypeScript/ace/`                                                           | **1** | **701 pass / 2 fail** |
| restored       | `bun test src/Core.TypeScript/ace/build-graph.test.ts`                                        | 0     | 84 pass / 0 fail      |

The two failures under sabotage are, by name, the two reported on #14858: `DRIFT GATE:
regenerating from the repo's manifests reproduces the checked-in graph` and its quorum
sibling. So the gate works, it is in the floor, and it would have gone red.

What actually happened on #14858 is worse, and it is §2.

One artefact of the false premise is fixed in the same PR: the `cross-verify` job header
carried a comment reading _"promoting this to a REQUIRED check (branch protection) is a
separate operator/devops step — until then it runs + shows on every PR but does not block
auto-merge."_ That has been untrue since the job entered the floor, and it is what a
reader finds first. A comment claiming a gate does not gate is the same defect as a gate
that does not run, pointed the other way.

## 2. What actually happened: the gate workflow produced zero runs

Measured on the live forge:

```
gh api .../actions/workflows/gate.yml/runs?branch=ouroboros-bootstrap --jq .total_count
=> 0
```

Zero `gate.yml` runs for that branch, ever — not cancelled, not failed, not queued. Every
check the PR carries comes from GitHub-managed _default setup_ (CodeQL, dependency
submission) plus `mirror-to-fork`. The `gate` workflow ran normally on other PRs in the
same minutes (51 gate runs in the 40-minute window around the PR's creation), so this is
not an outage. Root cause of the non-firing is **not established** and is Q1 in §6.

`CI Gate` is the only ruleset with a `required_status_checks` rule and it names exactly
one context, `gate (required)`. With zero gate runs there are zero required checks, and:

```
gh pr checks 14858            -> rc=0   6 pass / 0 fail / 0 pending
gh pr checks 14858 --required -> rc=1   "no required checks reported on the branch"
```

Both captured directly, not through a pipe. **The bare form answers a different question
than the one being asked** — "did everything that reported, pass" rather than "did
everything that must report, pass" — and with nothing required reported the two answers
diverge completely, with the wrong one green.

**Population, not anecdote.** Of the 42 open PRs on 2026-08-24, **four carry no
`gate (required)` at all**: #12058, #12066, #12321, #14858. Three of them have zero
`gate.yml` runs for their head SHA; #12321 has a run that has not published the name yet
(queued, not stalled — the distinction `required-check-started.ts` already draws).

## 3. The survey: which tests does CI run, and which of those block anything

Two different questions, and only the second one was open.

**Q: which test files does no CI job run at all?**
Already answered by an existing, sound checker: `hygiene/unexecuted-test-files.ts`, which
derives the executed set by parsing every `bun test` invocation in every workflow and
applying bun's own substring-filter semantics. Live: `rc=0`,

```
tracked/hidden-from-bun/invocations/pr-lane-invocations/executed/unexecuted
= 1242   0   62   57   1219   23
```

**23** files are executed by nothing, and all 23 are declared with a written reason in
`registry/unexecuted-test-files.json` (6 entries: recovered-branch archive, a network
probe, agent-CLI-on-PATH tests, a macOS-only `osascript` path, a live-PR-queue suite, and
a PKCS#11/TPM hardware lane). That surface is healthy. It is not the finding.

**Q: which test files run in CI but cannot block a merge?**
This one had no checker. `scratch/blocking-coverage.ts` (method in §4) derives the floor
from `gate-required.needs` in the file itself and attributes every `bun test` invocation
in `gate.yml` to its enclosing job:

| class                                                   | files                             | share |
| ------------------------------------------------------- | --------------------------------- | ----- |
| **BLOCKING** — executed inside a floor job              | **57**                            | 4.7%  |
| **NON-BLOCKING** — executed on every PR, blocks nothing | **1,162**                         | 95.3% |
| **UNRUN** — no PR-lane invocation                       | 0 (+23 bun-ignored, all declared) | —     |

The 13 floor invocations, in full:

- `cross-verify`: `src/Core.TypeScript/ace/` · four Q# reference oracles ·
  `image-source-provenance` · `audit-tech-radar-claims` · the five algebra-tower
  drift-check files
- `full-verify`: `cross-verify-ir` · `ir-vs-handwritten` · `cross-verify-interfaces` ·
  `law-proof-gate` · `cost-counter` / `cost-envelope` / `cost-growth-property` ·
  `codegen-clifford`

Every other `bun test` in `gate.yml` sits in `build-graph-completeness`,
`lint-bash-retirement-inventory`, `lint-structural-hygiene`, `lint-yaml-k8s`,
`test-typescript-hermetic` or `test-typescript-environment` — none of them in the floor —
and every `bun test` in every _other_ workflow is non-blocking by construction, because
`gate (required)` is the only required context.

**The single largest absorber is `test (TS hermetic)`**, whose bare `bun test` executes all
1,219 discoverable files and gates nothing. The census already committed at
`src/Core.TypeScript/ci/fixtures/absorbed-failure-census-2026-08-23.json` measured **47**
of its failures sitting beside a green `gate (required)` over 5.5 days — the largest single
contributor to the 124 absorbed job failures in that window.

Adjacent, from a different auditor and reported here because it is the same shape:
`audit-lean-ci-coverage.ts` exits 0 while printing _"54 sorry-free file(s) are not
type-checked."_ Fifty-four Lean files whose freedom from `sorry` is asserted by a lane that
does not compile them.

## 4. Method, and what the numbers do not say

`scratch/blocking-coverage.ts` reuses `hygiene/unexecuted-test-files.ts` for file discovery
(`git ls-files`, not a working-tree walk), for bunfig ignore semantics, and for bun's
substring-filter semantics. It adds two things: it parses `gate-required.needs` out of
`gate.yml` rather than carrying a second copy of the floor, and it attributes each
invocation to its enclosing job by line range. **0 of 62 invocations were unattributed**,
which is the check that keeps the classification from silently under-counting.

Honest limits:

- **File granularity, not test granularity.** A file in the BLOCKING column may contain
  tests that are themselves vacuous. This measures reachability, not strength.
- **`bun test` only.** `dotnet test` runs in `build-and-test`, which _is_ in the floor, so
  the F#/C# suites are gated; they are simply outside this count. Lean, Rust, Go and Python
  lanes are not counted here either.
- **Pre-merge only.** A two-PR semantic collision is out of reach of any per-branch floor
  by construction, as the `gate-required` header already states.
- The script lives in `scratch/` and is **not** committed. It is a measurement, not a
  control. Whether it should become a committed checker is Q4.

## 5. The tradeoff I am not entitled to decide

Widening the floor is the obvious move and it is the one I am least confident in.

**What a bigger floor costs.** `test (TS hermetic)` is ~9 minutes per run and ~2,250
runner-minutes/month. Promoting it would put ~1,162 long-unrun files on the blocking path
on day one; the drift-and-heal ADR (2026-08-01) narrowed the floor precisely because a
broad blocking floor produced a priority inversion — unrelated lanes blocked by unrelated
hygiene. **A bigger floor that people start bypassing is worse than a smaller one they
respect**, and this repo has the receipts for both failure directions.

**What the status quo costs.** 124 job failures beside a green gate in 5.5 days, only 26%
of which reach any rate surface. `lint-bash-retirement-inventory` and
`test-typescript-hermetic` are red on `main` regularly and block nothing. Five repo-wide
reds were fixed on 2026-08-24 (#14807, #14843, #14861, #14868, #14884, #14887) and in every
case the red had sat _because_ it did not gate. **A permanently-red non-required check
trains everyone to read red as noise**, which is the mechanism by which a real failure gets
waved through — and it is a strictly worse failure than a slow floor, because it is
invisible.

Those two are in genuine tension and the resolution is a governance call, not a devops one.
What I will say from the cost lens: the cheapest move that is not a floor change is to make
_permanently red_ impossible — a non-required check is allowed to be red **transiently**, and
a check that is red on `main` for more than N ticks is either fixed or retired. That
converts "red means noise" into "red means new" without adding a single required minute.
It is Q3.

## 6. Open questions for the maintainer

Answer shapes given so the reply can be short.

1. **Root cause of the missing gate runs.** Three branches have zero `gate.yml` runs, ever,
   while gate ran on 51 other refs in the same window. Do you want this chased to a cause
   (candidates: workflow-run creation rate limiting under this repo's churn; an event
   dropped at the forge), or is the detector in §7 sufficient? _Shape: `chase` | `detector
is enough` | `chase, but not now`._
2. **Remediation for a stalled PR.** A `workflow_dispatch` gate run's checks do not enter a
   PR rollup (measured, PR #11182), so the only acts that make gate report are close/reopen
   or a push — both writes to somebody else's branch. Should anything perform them
   automatically? _Shape: `report only` | `auto close/reopen for heartbeat lanes only` |
   `auto for all`._
3. **The permanently-red policy.** Adopt a rule that a non-required check red on `main` for
   more than N consecutive main-tip runs is fixed or retired? _Shape: `yes, N=<number>` |
   `no` | `yes but advisory`._
4. **Should `blocking-coverage` become a committed checker** with a registry, in the shape
   of `unexecuted-test-files.ts` — so the 57/1,162 split is a number that moves under
   review rather than a one-off measurement? _Shape: `yes` | `no` | `yes, non-blocking
only`._ My recommendation: yes, non-blocking, because the number is only useful as a
   trend.
5. **Floor scope.** Given §5, do you want any promotion to the floor now? The candidate the
   `test-typescript-hermetic` header itself names is `- test-typescript-hermetic` in
   `gate-required.needs` — one line, ~9 min added to every PR's critical path, ~2,250
   min/month, and ~1,162 files that become blocking on day one. _Shape: `not now` | `yes,
promote` | `promote a named subset`._ My recommendation: **not now** — first make the
   job green and _keep_ it green for a fortnight under Q3, then promote. Promoting a job
   that is presently red is how a floor gets bypassed.
6. **Cadence of the new watchdog.** Hourly at `:23` was chosen off a measured 8.7s runtime
   and this repo's demonstrated 16% scheduled-run drop rate. Faster costs queue, not money
   (public repo). _Shape: `hourly is right` | `every 15m` | `every 6h`._

## 7. What the accompanying PR actually lands

Detection only. Nothing in it changes what blocks a merge.

- **`required-check-started.ts` widened from `heartbeat/` to any ref prefix.** The repo
  already had exactly the right detector, built for the same class in August, and scoped by
  a hard-coded `headRef.startsWith("heartbeat/")` so it was blind to every ordinary PR.
  `prsMissingRequiredCheck(..., refPrefix)` generalises it; `heartbeatPrsMissingRequiredCheck`
  remains as the heartbeat lane's entry point so that lane's verdict cannot move by
  accident. Verified live: heartbeat scope rc=0, repo-wide scope rc=1 naming #14858, #12066,
  #12058 as stalled and #12321 as queued, in 8.7s.
- **The listing became its own falsifier.** `gh pr list --limit 50` against 42 open PRs was
  eight PRs away from silently measuring a subset and reporting a clean sheet — the vacuity
  class, committed inside the detector written to name it. A full page now exits **2**
  (unmeasured), distinct from 1 (measured absence) and 0 (clean).
- **`pr-gate-presence.yml`** — hourly, level-triggered, least-privilege, SHA-pinned,
  5-minute runaway cap, ~730 free runner-minutes/month, **absent from the floor**. It
  re-runs nothing.
- **The stale `cross-verify` comment corrected** (§1).

Falsifiers, all present and mutation-checked: reverting the ref-prefix generalisation to
the hard-coded `heartbeat/` turns `an ordinary PR with six green checks and no gate is
FOUND at repo-wide scope` red (measured: 18 pass / 1 fail). The heartbeat-scope test is
written as the _defect stated as a test_ — it asserts the ordinary PR is invisible at the
old scope — so deleting the widening cannot leave the suite green.

## Pointers

- `src/Core.TypeScript/forge-host/github/required-check-started.ts` — the detector
- `.github/workflows/pr-gate-presence.yml` — the lane
- `src/Core.TypeScript/hygiene/unexecuted-test-files.ts` · `registry/unexecuted-test-files.json`
  — the 23 declared, and the derivation this survey reuses
- `src/Core.TypeScript/ci/fixtures/absorbed-failure-census-2026-08-23.json` — 124 absorbed
  failures, 47 of them `test (TS hermetic)`
- `registry/uncompensatable-floor.yaml` · `.github/workflows/gate.yml` `gate-required` — the floor
- `docs/history/pr-reviews/PR-11182-*` — why a dispatch belt cannot satisfy `gate (required)`
- `docs/research/ci-workflow-design.md` · `docs/research/ci-gate-inventory.md` — the standing design rationale
