# §6a measured: provisioning is 51% of the gate, and the counterfactual is already in the repo

**Verdict: §6a should be UPGRADED, not downgraded.** The install step is **not** dominated by
a fixed cost every surface needs. **99.4% of its apt payload and 100% of its second-largest
phase are toolchains most jobs never touch** — and the repo already contains a **measured
control** proving the saving is ~8x on the jobs that need only bun.

**Date:** 2026-08-20 · **Measures:** §6a of `2026-08-20-surface-declarations-are-data-*.md`
**Register:** the per-job and per-run figures are **metered** (n=176 runs, 5,604 jobs); the
per-month extrapolations are **modelled** and carry ±40%; the 12-job saving estimate is
explicitly a **model**, flagged as such at every mention.

## 1. Method

200 completed `gate` runs (workflow `262890041`), window **2026-08-20T14:58:31Z → 22:20:20Z
(7.36 h)** → **5,604 jobs**. Durations from per-step `started_at`/`completed_at` (1-second
granularity — the source of the `0s` payload figures, which mean *sub-second*). **35 raw job
logs** downloaded for millisecond timestamps and cut on `install.sh`'s own progress markers:
30 randomly sampled across 10 job names (seed 4), the 5 slowest successful install steps
deliberately, and one `exit 124` failure. Plus 60 CodeQL runs to check the `Analyze (…)` claim.

> **A first pass matched only two of the four `Install toolchain` naming variants and MISSED
> `full-verify`**, whose step is named `Install toolchain (all 7 languages + E-prover)`. Recorded
> because a job-name match that silently under-samples is the vacuity class in measurement clothing.

Repo is **public on GitHub-hosted standard runners** (5,531/5,604 jobs), so **the currency is
wall-clock, concurrency and failure exposure — not billed minutes.**

## 2. Wall-clock, n = 3,710 successful install steps

| | min | p10 | p25 | **median** | p75 | p90 | p95 | p99 | max | mean |
|---|---|---|---|---|---|---|---|---|---|---|
| seconds | 80 | 92 | 101 | **119** | 139 | 164 | 187 | 239 | **776** | 125.6 |

The install step is **not the whole provisioning cost.** Every job that runs it is preceded by
an `actions/cache` restore of the install outputs — **1,488 MB**, median **18 s**, p90 31 s,
max 248 s (n=3,312).

> **Per-job provisioning = 119 s install + 18 s cache restore ≈ 137 s (median).**

The mise-runtime phase is **bimodal**: 20 of 30 sampled logs restore in **0.2 s** (full hit),
10 take **27–38 s** (partial re-resolve). Cause is checkable — the cache API reports **12.88 GB
active across 22 caches**, with **two live 1,488 MB `install-v2` entries**. `gate.yml:1376`
already records it: *"the cache is already at 10.05GB of a 10GB ceiling."* **The union cache is
what pushes it over, and the eviction is measurable as the 30 s bimodal tail.**

## 3. Provisioning vs payload — the centrepiece

| job | n | provision | **payload** | total |
|---|---|---|---|---|
| `lint (archive header §33)` | 173 | 145 s | **0 s** | 175 s |
| `lint (no conflict markers)` | 169 | 137 s | **0 s** | 172 s |
| `lint (tick-history order)` | 174 | 136 s | **0 s** | 166 s |
| `lint (tick-shard relative-paths)` | 173 | 141 s | **0 s** | 167 s |
| `lint (§33 migration xrefs)` | 173 | 141 s | **0 s** | 168 s |
| `lint (Python)` | 173 | 140 s | 2 s | 175 s |
| `lint (shellcheck)` | 173 | 144 s | 2 s | 173 s |
| `lint (semgrep)` | 171 | 145 s | 8 s | 176 s |
| **`lint (Go)`** | 173 | **142 s** | **11 s** | 177 s |
| `lint (markdownlint)` | 173 | 143 s | 17 s | 187 s |
| `lint (TS)` | 172 | 140 s | 19 s | 182 s |
| `cross-verify` | 173 | 138 s | 23 s | 189 s |
| `lint (bash retirement inventory)` | 151 | 141 s | 37 s | 211 s |
| `full-verify (7-lang oracle)` | 103 | 161 s | 39 s | 217 s |
| `lint (F#)` | 172 | 144 s | 46 s | 212 s |
| `lint (C#)` | 172 | 138 s | 71 s | 240 s |
| `lint (Rust)` | 171 | 142 s | 71 s | 230 s |
| `build-and-test (ubuntu-24.04)` | 167 | 136 s | 509 s | 696 s |
| `test (TS hermetic)` | 146 | 150 s | 513 s | 676 s |

**Provisioning is a near-constant 136–145 s regardless of what the job does.** The note asked
specifically about a Go lint: **`lint (Go)` spends 142 s provisioning to run an 11 s check — 80%
of its wall-clock.** Five hygiene lints spend ~140 s provisioning to run a check that **does not
register a single second**.

## 4. Per-PR tax

Median **23 jobs** pay the install step per push; **median 2,651 install-seconds/run** (p90
3,376), plus 23 × 18 s cache restore ≈ 414 s.

> **≈ 3,065 s = 51.1 minutes of provisioning per PR push — ~51% of the gate's job-seconds.**

At 23.9 gate runs/hour (574/day; independently, daily `total_count` for 08-16…08-20 =
782/946/788/578/449, mean 709): **488–603 runner-hours/day**. Free minutes, real latency.

## 5. Attribution — where install.sh's time goes (30 sampled logs)

| phase | median | max | % of total |
|---|---|---|---|
| **total** | 108.0 s | 194 s | 100% |
| **apt** | **54.6 s** | 111.5 s | **50.5%** |
| mise runtimes | 0.2 s *(bimodal: 0.2 / ~30)* | 38.0 s | 0.2% |
| **eprover build from tarball** | **29.1 s** | 45.7 s | **26.9%** |
| bun + uv + elan + 7 dotnet global tools | 5.6 s | 16.3 s | 5.2% |
| agda-cubical clone + typecheck | 2.8 s | 4.2 s | 2.6% |
| agent CLIs (claude-code + codex) | 2.8 s | 4.0 s | 2.6% |

Within apt: ~7 s resolve, **8 s fetch of 554 MB** at 65 MB/s, **20 s unpack, 12 s configure**.
The fetch is cheap; **dpkg is the cost, and it scales with the package set.**

### And the package set is where the union lives — 552.7 MB / 160 packages

| group | MB | share |
|---|---|---|
| proof stack: Agda + GHC | 252.1 | **45.6%** |
| WASM/LLVM (emscripten, llvm-15, clang, binaryen, wabt) | 173.4 | **31.4%** |
| R stats | 50.0 | 9.0% |
| pandoc | 26.9 | 4.9% |
| QEMU/ISO | 18.4 | 3.3% |
| proof stack: z3/cvc5/opam | 14.5 | 2.6% |
| podman | 13.5 | 2.4% |
| **base/other** | **3.1** | **0.6%** |
| Yubico/smartcard | 0.6 | 0.1% |

> **0.6% of the payload is base.** Per push: **554 MB × 23 jobs = 12.4 GB of apt downloads**;
> ×574 runs/day ≈ **7.0 TB/day** pulled from `azure.archive.ubuntu.com` by this repo.

And the second-largest phase is equally attributable: **the E theorem prover is compiled from an
autotools tarball, from scratch, in every single job** — 29 s median — *including in
`lint (markdownlint)` and `lint (no conflict markers)`*. **The tarball is cached; the `make` is not.**

## 6. The counterfactual is already measured, in this repo

`gate.yml` already carries **four jobs that opted out of `install.sh`** for `setup-bun`, with the
rationale written into the YAML at `gate.yml:1415-1417`: *"it needs one 178 MB runtime, and
`./tools/setup/install.sh` provisions the union of every toolchain in the repo."*

| job | n | median provisioning | total |
|---|---|---|---|
| `gate (required)` | 164 | **2.0 s** | 10 s |
| `lint (build-graph completeness)` | 179 | **2.0 s** | 20 s |
| `lint (no empty dirs)` | 180 | **2.0 s** | 19 s |
| `lint (structural hygiene)` | 176 | **2.0 s** | 35 s |

Like-for-like, same kind of work — run N bun hygiene scripts, no compiler needed:

- `lint (structural hygiene)` — 6 bun scripts + `fetch-depth: 0` — **35 s**
- `lint (bash retirement inventory)` — ~9 bun commands — **211 s** (141 s provisioning)
- `lint (no empty dirs)` — 4 bun scripts — **19 s**
- `lint (no conflict markers)` — 1 bun script — **172 s** (137 s provisioning)

> **Measured: 2 s vs 140 s of provisioning; ~8x on total job wall-clock.** Not an estimate —
> the same repo, the same day, the same runner image, two provisioning strategies.

**Counterfactual per push:** 6 jobs are **demonstrably** bun-only (verified from their `run:`
lines) → moving them to the measured 2 s path saves **828 s = 13.8 min/run, measured.** 12
further lints need exactly one language surface; at an **assumed** 15/30/45 s per-surface cost,
add 25.0 / 22.0 / 19.0 min → **33–39 of the 51 min. That half is a model, not a measurement.**
3 jobs genuinely want most of the union — and even they need no R, pandoc, QEMU or YubiKey stack.

## 7. The `exit 124` verdict: unlucky mirror, structurally amplified

**Not structurally near the budget.** 7 install steps failed of 3,717 non-skipped — **0.19% per
job** — every one at **exactly the 420 s apt budget** (`linux.sh:180`). Healthy apt phase is
**54.6 s median, 111.5 s worst observed**: **3.8–7.7x headroom. The budget is not tight.** The
failure log shows the deadline machinery behaving exactly as documented — attempt 1 got **247 s**
and could not finish work that normally takes ~40 s of dpkg. **A >6x slowdown that never
completed is a stalled mirror, not a tight budget.**

**And the incident is repo-wide, not PR-specific**: the 6 failures at 16:30–16:52 span four
unrelated branches — including `vision/declared-vs-discovered`, which is **PR #12859**.

**But the union amplifies the exposure, and that half is real and quantified.**
P(≥1 of 23 jobs hits a stall) = `1 − (1−0.0019)²³` = **4.2%**; observed **6 of 176 = 3.4%**. The
model matches. Per-surface installs would not fix the mirror — they would shrink the exposed
bytes by ~99% for bun-only jobs and **remove those jobs from the exposure count entirely**.

> So §6a's honest limit is **resolved in both directions**: the timeouts *were* a mirror stall
> (the note's caution was right), **and** a per-surface install would have prevented these
> specific ones for the ~11 of 13 jobs on #12361's wall that need no apt package at all.

## 8. Corrections the note needs

1. **§6a overstates the roster.** *"Every one of those per-language jobs runs the same shared
   install step"* is **false for the CodeQL legs**: `codeql.yml:650` gates it
   `matrix.language == 'csharp' && has_source == 'true'`. Measured across 60 runs: **1 of 5
   `Analyze` legs** ran install.sh. Also 59 of 60 CodeQL runs were path-gated out entirely.
2. **§6a's cost claim is UNDERSTATED, not overstated.** It names only the install step. The
   18 s / 1.49 GB cache restore is a second per-job union cost; the 12.88 GB cache overrun is a
   third, converting ~1/3 of jobs into a 30 s partial re-resolve.
3. **§4's "a surface set is a dependency closure" now has a price tag:** 51 min/push, 51% of
   gate job-seconds, 12.4 GB apt/push.

## 9. Side finding — the escape hatch that saved 8x also dropped the pin

The four `setup-bun` jobs pin the **action** by full SHA (correct) but pass **no
`bun-version:`** — **five call sites** in `gate.yml` (lines 753, 1427, 1480, 1552, 2638). So they
run whatever `setup-bun` calls latest, while `.mise.toml` pins `bun = "1.3"`.

**This is exactly the §1 "fork because there was no seam" pattern — and it is the argument FOR
declared surfaces rather than against.** Reported rather than fixed here: the fix is one
`bun-version` line per call site, but it changes the resolved runtime on every gate job and is
not testable from a laptop. Belongs as a paired DEBT row against a runnable CI verification.

## 10. Recommendation, with its limits

**Build the per-surface declaration. It earns its slot** — the saving is neither marginal nor
modelled: **the repo already ran the experiment three times and got 2 s vs 140 s.**

The cheapest honest first move is **not a manifest format**. It is to **declare one surface
(`bun-only`) as data and route the 6 already-verified bun-only lints through it** — banking 13.8
measured minutes per push and **giving the declaration format a falsifier before anyone designs it.**

**Honest limits, stated so they cannot be rounded off:**

- The **13.8 min is measured; the further 19–25 min is modelled** on an assumed 15–45 s
  single-language surface. **Nobody has measured a "Go surface" in this repo.** That is the next
  measurement, not a claim.
- **CI minutes are free here** (public repo, standard runners). The value is latency, concurrency
  headroom and mirror-stall exposure. **If someone prices this in money, they are inventing a number.**
- **One 7.36-hour window**, dominated by heartbeat PRs. Daily counts vary 449–946, so aggregate
  extrapolations carry **±40%**. Per-job and per-run figures are stable across 176 runs; per-month
  figures are not.
- **Parity is the real risk, not the saving.** Every surface that opts out of `install.sh` is a
  place the pin can drift — §9 is the live proof. **A surface layer must be DATA READ BY
  `install.sh`, not a second installer**; otherwise this measurement will have bought speed with
  the §24 invariant, which is a bad trade.
- **macOS and Windows are unmeasured.** `build-and-test (macos-26)` shows the highest provisioning
  at 194 s; the Windows legs ran 14 times. **A surface design that only fits Linux is parity drift
  by construction.**

**Reproduction IDs:** healthy warm `lint (Go)` = run `32383325680` / job `96471623274` · cold mise
miss = run `32415536443` / job `96575710563` · exit-124 on #12859 = run `32393581052` / job
`96505410364` · exit-124 with full retry trace = run `32392340811` / job `96501179173` ·
setup-bun control = any `lint (no empty dirs)` in run `32421091711`.
