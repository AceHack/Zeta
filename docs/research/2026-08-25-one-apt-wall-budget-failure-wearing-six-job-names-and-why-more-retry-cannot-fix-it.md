# One apt wall-budget failure wearing six job names — and why more retry cannot fix it

Status: **landed as `rerun-toolchain-install-stall.yml`; recommendations §6 and §7 await human
sign-off.** Work-item `081M0XC0CYN087G0R002DXY5SV`. Measured 2026-08-25 against
`Lucent-Financial-Group/Zeta`.

## 1. The measurement

Window 2026-08-25T15:28Z-20:43Z (the API's 200-run page limit, so every count below is a
LOWER bound). Sixty of the window's failed runs were sampled and every failed job attributed
to its failing step via `GET /repos/{repo}/actions/runs/{id}/jobs`, filtering
`steps[].conclusion == "failure"`.

**102 failed jobs. 17 of them died in the toolchain install step**, before the work the job
is named for had begun, under six job names across four workflows:

| red job name | workflow | failing step |
| --- | --- | --- |
| `build-and-test (ubuntu-24.04)` | gate.yml | Install toolchain via three-way-parity script (Unix; GOVERNANCE §24) |
| `Analyze (csharp)` | codeql.yml | Install toolchain (three-way-parity script) |
| `chart pins + helm template + kubeconform` | helm-validate.yml | Install toolchain via three-way-parity script |
| `manifests (offline) + mutation proof` | helm-validate.yml | Install toolchain via three-way-parity script |
| `live kind ArgoCD health (ubuntu-24.04)` | k8s-argocd-health-test.yml | Install toolchain via three-way-parity script |
| `live kind included Synced+Healthy proof (ubuntu-24.04)` | k8s-argocd-health-test.yml | Install toolchain via three-way-parity script |

One infrastructure failure wearing six names. It reads as six unrelated flakes because the
job name is what a reviewer sees and the job name has nothing to do with the fault.

Failure volume in the same window, for the cost arithmetic in §5: `gate` alone failed **117
times in 5h15m** (~535/day extrapolated).

## 2. It is NOT a stall. The banner is wrong, and the correction decides which fix works

`tools/setup/linux.sh` prints, on budget exhaustion:

> `⚠ apt-get install exceeded its 45s slice of the 420s budget (attempt 3/3) — stalled archive mirror, not a package error.`

Read against job **97946436709** (run 32890184155, `Analyze (csharp)`), the word *stalled* is
wrong:

```
19:54:13  ↻ apt phase budget: 420s
attempt 1  247s slice   103 packages fetched, killed inside emscripten (93.2 MB)
attempt 2   89s slice   emscripten COMPLETED in 86s (93.2 MB => ~1.08 MB/s), 8 more, killed
attempt 3   45s slice   27 more incl. pandoc (26.9 MB), killed inside podman (13.4 MB)
20:01:13  ✗ apt-get install did not succeed within the 420s apt budget (3 attempts, rc=124)
```

Every attempt made continuous forward progress, and apt's archive cache carried completed
downloads across attempts (attempt 2 needed 342 MB of the 561 MB total; attempt 3 had 27
packages left). The mirror was **slow, not wedged**: ~1.1 MB/s against the ~14 MB/s
(553 MB / 38.2s, run 32151321559) healthy figure the 420s budget was sized from — a 13x
degradation, not a hang.

**561 MB at 1.1 MB/s is ~510s of download alone, against a 420s budget.** The job did not
hang and did not hit a package error. It ran out of wall clock while succeeding slowly.

This is the standing failure class in its usual costume: a check that **never ran**
presenting identically to one that ran and failed.

## 3. Why more in-step retry cannot fix it

The in-step retry already exists and is already exhausted. `linux.sh` runs **three** attempts
under **one shared** 420s deadline, so a fourth attempt does not add time — it subdivides the
same wall. Measured, attempt 3 was already down to a 45s slice.

Worse, the ladder starves the attempt most likely to succeed. The split is weighted 60% to
attempt 1 with the retries sharing the rest, on the reasoning that a *wedged* mirror needs a
fresh connection while a *slow* one needs continuous time. But because the archive cache
accumulates, **the later attempts have the least left to fetch and the warmest cache** — and
they get the smallest slices. On job 97946436709 attempt 3 had 27 packages left and 45
seconds to get them.

## 4. Why not simply raise the budget

Because it is not free and it is not silent. `audit-apt-budget-fits-job-timeout.ts --human`,
run on this tree:

```
OK — 49 of 50 governed job(s) fit; 1 acknowledged in the baseline and still failing:
  low-memory.yml:build-and-test-low-memory: 420 + 10 + 571 = 1001s vs 840s — EXCEEDS
  tightest FITTING margin: k8s-lane-partition.yml:plan:
    420s budget + 10s kill + 152s non-apt = 582s vs 600s timeout (margin 18s)
```

**Eighteen seconds.** A +20s budget bump turns that audit red. A bump large enough to cover
§2's arithmetic (~+180s) needs `timeout-minutes` edited across ~49 governed jobs, and the
lane that is already over budget (`low-memory`) has no room at all — it sits one minute under
the ubuntu-slim 15-minute runner-class hard cap.

This is stated as a **recommendation with its cost named**, in §7, not taken here.

## 5. Design decision — a scheduled sweep, not a `workflow_run` watcher, not an in-job step

Three places the automation could live.

**(a) In the failing job** (`if: failure()` step that calls the rerun API). Cheapest by far —
the job is already running. **Refused on supply-chain grounds:** that job executes pull
request code, and giving it `actions: write` hands a fork PR the ability to drive the Actions
API.

**(b) A `workflow_run` watcher**, like `rerun-cancelled-gate.yml`. Zero latency, and it is
the shape already in the tree. **Refused on cost:** it fires once per *failed run*, and
§1 measured ~535 gate failures/day. At ~40s per evaluation (checkout + bun + API reads) that
is **~356 runner-min/day**, and it scales *with* the failure rate — most expensive exactly
when CI is worst.

**(c) A scheduled sweep** — chosen. Its cost is the same whether nothing failed or fifty
things did: 96 ticks/day at **17s measured on the first real execution** (run 32907739489,
22:46:35Z-22:46:52Z, 45-minute window, 5 failed runs evaluated) is **~27 min/day, flat and
predictable** — about a **13x** saving over (b). The figure written here before the workflow
had ever run was ~45s / ~72 min/day / ~5x; it is corrected rather than left as an estimate that
happened to flatter the decision it justified. One tick covers *every* workflow that calls
`install.sh`, so there is no per-workflow roster to drift. And it is idempotent by construction
(§12): re-running the sweep re-evaluates the same runs, and the `run_attempt` ceiling makes the
second pass a no-op.

**The price is latency, stated honestly.** This repo has measured GitHub dropping ~16% of
`*/15` cron slots with inter-run gaps of 12-43 minutes (p50 16, p90 27 — see the header of
`heartbeat-liveness.yml`). Worst-case time-to-rerun is therefore ~8 min (to fail) + ~43 min
(to the next delivered tick) ≈ **51 minutes**. Against a human or an agent noticing hours
later, that trade is not close. If measured latency proves too slow, the cadence is a
one-line change and the cost scales linearly with it.

## 6. The safety property, and how it is checked

`rerun-cancelled-gate.yml` re-runs `cancelled` and deliberately never `failure`, because
re-running a genuine failure converts a real red into a flaky green. **That refusal stands.**
What is added is not "also retry failures" — it is a signature that is *causally incapable*
of being about a pull request's content:

- **RETRY** — the job's FIRST failing step is the toolchain installer (Unix leg only), and
  its log carries `linux.sh`'s own budget-exhaustion banner together with exit 124.
- **NEVER** — anything else. A test failure, a lint finding, a type error, a build break.
  Exit 1 is a verdict; 124 in an install step is a check that never ran.
- **NEVER** — a run holding *both* a stall and a genuine red. It is refused outright and
  reaches a human, because re-running it would re-run the real red too. Live instance in the
  fixture: gate run **32896165119** carried an install stall in `build-and-test` alongside a
  `tsc` type error and a failing hermetic TypeScript suite.

**A correction to the framing this was commissioned under.** The brief named "124 or 127" as
alternate signatures. Measured, they are not alternates: every observed 127 (`bun: command
not found`, jobs 97942225220 and 97959399860) is a *later* step in the *same* job failing
because the toolchain the install step was meant to provide is absent — always downstream of
a 124, never instead of one. So 127 is accepted as corroboration and is never a trigger on
its own. A 127 with no 124 above it means a binary went missing for another reason, and that
is a real red.

**Bounds.** One automatic rerun per run id, enforced by GitHub's own `run_attempt` counter so
the ceiling needs no state of ours; six reruns per sweep, past which the sweep stops and logs
`toolchain-install-stall-cap-hit` (a degraded mirror hits dozens of runs at once, and that is
an outage, which wants a human rather than a retry); a 120-minute staleness limit; and a
supersession check. **When the bounds are exhausted the run stays RED**, with the mirror named
in its own log.

**The sweep writes no files, and that is a decision.** A `$GITHUB_STEP_SUMMARY` table was
drafted; a job summary is a file write onto a page rendered as Markdown, and a run's `name`
(a workflow file's `name:` key, contributor-controlled on a `pull_request` run) and
`head_branch` are attacker-influenceable strings that could close a cell, inject a link, or
forge a row. CodeQL flagged it (`js/http-to-file-access`, medium) and flagged both attempted
sanitisers. Reshaping a sanitiser until an analyser is quiet is appeasing a tool rather than
removing a risk, and dismissing the alert needs a human in the code-scanning UI — the exact
intervention this change exists to delete. The summary was additive; the structured stdout was
always the visibility contract. So the sink is gone, and a falsifier pins it: the source may
not name `appendFileSync`, `writeFileSync`, `Bun.write`, `node:fs`, or `GITHUB_STEP_SUMMARY`.

**Mutation results.** Six mutations of the predicate, each killed:

| mutant | tests turned red |
| --- | --- |
| M1 drop the mixed-failure guard | 1 |
| M2 drop the log signature | 3 |
| M3 **widen the predicate to bare `failure`** | 6 |
| M4 drop the first-failing-step ordering guard | 1 |
| M5 remove the one-rerun ceiling | 2 |
| M6 remove the Windows exclusion | 1 |

The fixture is real captured production data — five runs, their job and step lists, and
line-numbered excerpts of their real logs — not hand-made examples.

## 7. Recommendations NOT taken here (each needs a human's name on it)

1. **Cache `/var/cache/apt/archives`.** The root fix, and the only one with *negative* CI
   cost. The gate jobs already cache mise runtimes, dotnet tools and verifier jars; they do
   not cache the `.deb` archives, so every ubuntu job re-fetches 561 MB from the mirror. A
   cache hit would take the apt phase from *420s-exhausted* to the dpkg unpack alone, and the
   flake disappears at its cause rather than being re-sampled. Blast radius: ~40 workflows;
   needs a design doc and a cache-key/eviction story.
2. **Raise `ZETA_APT_BUDGET_SECONDS`** — with §4's arithmetic attached. The specific
   pathology it addresses is §3's starved ladder. Not free, not silent, and `low-memory` has
   no room at all.
3. **Re-weight the retry ladder** so later attempts (warm cache, less left to fetch) are not
   the shortest. Cheap and internal to `linux.sh`, but on §2's numbers it only helps at the
   margin — 420s does not buy 561 MB at 1.1 MB/s under any split.
4. **Question the manifest.** 561 MB fetched, 2996 MB installed, on every ubuntu job. Whether
   each job needs the union of the toolchain is a real question and not one to answer alone.
5. **Fix the banner.** `linux.sh` says "stalled archive mirror"; §2 shows that is usually
   false and the word sends the reader at the wrong fix. It should say *the apt phase ran out
   of wall clock*, and print the observed throughput.

## 7a. First live evidence — the mixed-failure guard fired on traffic, not on a fixture

Run **32907739489** (dry, 45-minute window) evaluated 5 failed runs and declined all of them.
One of the declines is the safety property working on data captured *after* the fixture was
built:

```
run 32904208329  gate  main  action=skip  reason=mixed-failure
  detail: 1 install stall(s) but also 1 unexplained failure(s):
          lint (bash retirement inventory + hygiene unit tests)
          (first failing step is "A check may not claim a property of higher arity than it tests")
  jobs: lint (bash retirement...)=unexplained
        build-and-test (ubuntu-24.04)=install-stall
        gate (required)=derived
```

A run carrying **both** a genuine apt wall-budget stall and a genuine red. The sweep declined
it, named the real failure, and left it for a human.

Separately, `--run-id --apply` was exercised against runs 32905161271 (CodeQL) and 32905161106
(gate) on this change's own pull request, which failed on the exact bug it fixes. Both were
classified `install-stall` and re-run; `gate (required)` classified `derived`, which is the
roster entry without which the policy would be vacuous on `gate`.

## 8. Follow-up owed after merge

`src/Core.TypeScript/hygiene/github-settings.expected.json` enumerates the repo's workflows
and is diffed against **live** GitHub, so it cannot name a workflow that does not exist yet —
declaring the new one in this PR makes `github-settings-drift.yml` red *now*, and omitting it
makes the weekly Monday 14:17Z tick red *later*. Convention in this tree is the post-hoc
re-snapshot (#8073), so after merge:

```
bun src/Core.TypeScript/hygiene/snapshot-github-settings.ts --repo Lucent-Financial-Group/Zeta \
  > src/Core.TypeScript/hygiene/github-settings.expected.json
```

## 9. Pointers

- `src/Core.TypeScript/ci/toolchain-install-stall.ts` — the pure policy.
- `src/Core.TypeScript/ci/toolchain-install-stall.test.ts` — the falsifiers.
- `src/Core.TypeScript/ci/fixtures/toolchain-install-stall-2026-08-25.json` — captured runs.
- `src/Core.TypeScript/ci/rerun-toolchain-install-stall-cli.ts` — the sweeper.
- `.github/workflows/rerun-toolchain-install-stall.yml` — the workflow.
- `docs/research/2026-08-14-cancelled-gate-runs-are-apt-stalls-hitting-job-timeouts-not-concurrency-cancels.md`
  — the predecessor: the same fault when it still reported `cancelled`.
- `tools/setup/linux.sh` — the apt phase, its shared deadline and its three-attempt ladder.
- `src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts` — the 18-second margin.
