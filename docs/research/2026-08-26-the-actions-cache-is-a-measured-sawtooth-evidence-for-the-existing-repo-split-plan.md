# The Actions cache is a measured sawtooth — the eviction round 3 could not instrument

**Date:** 2026-08-26 · **Author:** shadow · **Status:** measurement. Decides nothing, proposes no cut.
**Basis:** `origin/main` at `1277ee1331`. All figures from the GitHub Actions REST API,
timestamped, commands quoted.

**This supplies one missing number for an existing plan. It does not propose a new one.**
Aaron, 2026-08-26: *"we have a plan to split out to different repos based on our tool chain
splits so we can have different caches for different tooling, this is our multi repo plan, we
have a lot on this already and a plan that's gone through a few rounds."* The plan is
`docs/research/2026-08-19-repo-split-round-3-*` (the closure axis),
`-round-2-*` (the change-rate axis), `2026-08-01-multi-repo-split-design-*` (the four axes),
and `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`. Every candidate name used
below is theirs.

Round 3 §5.3 measured the ceiling and then said exactly what it had not done:

> **Register: the ceiling comparison is `metered`; the causal chain below is `consistent
> with`, not established. I did not instrument a cache miss.**

and listed as its first cheap action item:

> **1. Check the Actions cache ceiling.** Measured 11.57 GB against a documented 10 GB
> default. … One click in Actions settings.

Both are now measured. The eviction was instrumented, and the ceiling question is answered
from the eviction's own behaviour rather than from a settings page.

---

## 0. The four results, up front

1. **The cache is a sawtooth, caught live — twice.** In a 37-minute observation it climbed to
   **30.86 GiB**, then **41 entries / 23.06 GiB were deleted inside one 61-second window**,
   landing at **9.68 GiB** — and began refilling immediately at ~2.3 GiB/min. Five minutes
   later a second sweep deleted **24 entries / 10.32 GiB**, landing at **9.07 GiB**.
2. **The ceiling has NOT been raised, and this is now measured rather than assumed.** Both
   sweeps converged on ~9–9.7 GiB. A repo whose eviction target sits at ~10 GB is a repo on
   GitHub's documented 10 GB default. Round 3's open question #1 is closed.
3. **80% of the evicted bytes had never been read.** Of the 41 entries deleted, **28 (18.39
   GiB) had `last_accessed_at == created_at`** — written, never restored, deleted. That is not
   a cache; it is an upload tax.
4. **The restore side is instrumented (§9), and it changes two readings.** 500 restore
   attempts across 212 gate jobs: **84% hit, 75% excluding the two caches this repo does
   not key itself**. Two findings only the logs could reach, because a miss and a lost
   save-reservation create no cache entry and are invisible to the id-diffing above:
   the poisoned 172 KB `dotnet-Linux-X64` entry is restored on **6 of 6** gate runs
   (§6.3 saw two samples), and a cold `install-v2` key costs **12 simultaneous
   installs and ~11 wasted uploads**, not one rewrite (§9.4). A third, `nuget`/`elan`
   split across two key namespaces, is a genuine save-whose-restore-key-never-matches
   (§9.2) — the case §4.4's argument does not reach, because it is between workflows.
5. **The partition arithmetic does not close, and that is the finding.** Under round 3 §7's
   own candidate list, **`Zeta-core` alone measured 11.17 GiB charged at peak — over the
   ceiling by itself**, before it is given any share of the two union blobs. The split as drawn
   does not bring every partition under 10 GB. Reported for Aaron; no alternative cut proposed
   (see §7).

---

## 1. What was measured, and how to re-run it

Two endpoints, both read directly, exit codes read from `$?` and never through a pipe:

```bash
gh api repos/Lucent-Financial-Group/Zeta/actions/cache/usage
gh api "repos/Lucent-Financial-Group/Zeta/actions/caches?per_page=100&page=1"
```

`--paginate` is deliberately not used: `actions/cache/usage` returns a summary object and
`--paginate` prints it per page. `actions/caches` reported `total_count` 41 with 41 returned on
page 1; pages 2 and 3 returned `total_count: 0`, so one page is the whole set.

A sampler took both endpoints every 60 s for the observation window; snapshots are diffed by
cache `id`, which is what makes eviction observable — an `id` that disappears was deleted, and
one that reappears under the same `(key, ref)` with a **new** `id` was rewritten.

**The `usage` endpoint lags and must not be used alone.** Measured disagreement, same repo,
21 seconds apart:

| time (UTC) | endpoint | entries | size |
|---|---|---:|---:|
| 08:19:12 | `cache/usage` | 20 | 15.18 GB |
| 08:20:10 | `actions/caches` (itemised) | **41** | **22.08 GB** |
| 08:20:31 | `cache/usage` | 28 | 19.14 GB |

The `usage` endpoint then sat at `28 / 17.82 GiB` for three consecutive minutes while the
itemised list moved every sample. **All figures below come from the itemised endpoint.** The
prior agent's 16.75 GB and round 3's 11.57 GB both came from `usage`; they are not wrong, they
are a lagging scalar of a quantity that moves by gigabytes per minute.

---

## 2. The sawtooth

Itemised endpoint, one sample per minute, 2026-08-26:

| time (UTC) | entries | GiB |
|---|---:|---:|
| 08:20:10 | 41 | 20.56 |
| 08:20:46 | 45 | 24.36 |
| 08:21:47 | 52 | 28.35 |
| 08:22:47 | **62** | **30.86** ← peak, 3.3× the ceiling |
| 08:23:48 | **23** | **9.68** ← 41 entries / 23.06 GiB deleted in 61 s |
| 08:24:48 | 30 | 12.54 |
| 08:25:49 | 35 | 15.17 |
| 08:26:49 | 37 | 16.70 |
| 08:27:50 | 38 | 18.20 |
| 08:28:51 | **18** | **9.07** ← second sweep, 24 entries / 10.32 GiB deleted in 61 s |
| 08:29:51 | 21 | 9.22 |

Two things this settles that a scalar reading cannot.

**The eviction is a batched sweep, not a continuous LRU trim.** Usage was allowed to reach
3.3× the ceiling and was then cut in one step. So an instantaneous reading of `cache/usage`
tells you where in the sawtooth you sampled and nothing about the ceiling — which is why three
agents have now reported three different numbers (11.57, 14.47, 16.75 GB) and all three were
correct at the instant they were taken. Sweeps were ~5 minutes apart; between them the repo
oscillates roughly 9 → 31 GiB.

**The sweep target is the ceiling, and it is ~10 GB.** Two independent sweeps converged on
9.68 GiB and 9.07 GiB (10.39 and 9.74 GB decimal). GitHub's documented default is *"10 GB per
repository, but this limit can be increased by enterprise owners, organization owners, or
repository administrators"* (dependency-caching reference, read 2026-08-26). A raised ceiling
would sweep to the raised value. Both swept to ten.

*Honest limit:* this is an inference from where two sweeps stopped, not a read of the settings
page. `GET /repos/{owner}/{repo}/actions/cache/usage-policy` returns 404 at this credential, as
it did for round 3, so the direct read remains unavailable to an agent. Two independent sweeps
agreeing is what carries the claim.

Org-level control, `gh api orgs/Lucent-Financial-Group/actions/cache/usage` at 08:23Z:
`19,237,067,952` bytes across 37 caches. Zeta is effectively the entire organisation's cache.

---

## 3. What the caches are, grouped by toolchain

Snapshot 2026-08-26T08:20:10Z, 41 entries, 20.56 GiB charged / 13.13 GiB deduplicated by key.
"never-hit" = `created_at == last_accessed_at` at observation.

| toolchain group | charged GiB | entries | refs | never-hit |
|---|---:|---:|---:|---:|
| dotnet SDK (`~/.dotnet`) | 6.76 | 8 | 3 | 6 |
| **UNION blob** (`install-v2` / `install-*-full` / `install-*-base` / `full-verify-v2`) | 6.50 | 5 | 3 | 4 |
| **mise runtimes** (`~/.local/share/mise`, `~/.cache/mise`) | 4.48 | 6 | 4 | 5 |
| nuget (`~/.nuget/packages`) | 2.00 | 10 | 8 | 7 |
| apt archives (`/var/cache/apt`) | 0.56 | 2 | 1 | 1 |
| codeql (trap db + go deps) | 0.18 | 3 | 1 | 1 |
| bun (`node_modules`) | 0.07 | 2 | 2 | 0 |
| elan / Lean 4 (`~/.elan`) | 0.01 | 5 | 4 | 3 |

Across every sample, the **logical working set is 42 distinct keys / 21.27 GiB** — 2.3× the
ceiling *before* any duplication. Largest single entries:

```
1858 MB  dotnet-macOS-ARM64-4cf67312…
1537 MB  full-verify-v2-Linux-X64-2f9b105b…
1318 MB  install-Linux-X64-full-f89e5b0d…      (5 distinct hashes seen for install-Linux-X64-{base,full})
1292 MB  install-Linux-ARM64-full-f89e5b0d…
1191 MB  install-v2-Linux-X64-59a7a296…
1158 MB  interp-v1-Linux-X64-7649b1a7…        (python/uv, Interp.Python)
 822 MB  mise-Linux-X64-9847a5b8…
```

### 3.1 The two largest families are unions, literally

`install-v2` / `full-verify-v2` cache **one tar containing every toolchain at once**
(`gate.yml:660-678`):

```yaml
path: |
  ~/.local/bin/mise      ~/.local/share/mise   ~/.cache/mise
  ~/.dotnet/tools        ~/.elan               ~/.config/zeta
  ~/.rustup/toolchains/1.87.0-*  ~/.rustup/settings.toml  ~/.rustup/update-hashes
  ~/.cargo               ~/.cache/zeta/from-autotools-tarball/*.tgz
key: install-v2-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('.mise.toml', 'tools/setup/**', 'global.json') }}
```

`grep` over `.github/workflows/` counts **15 job definitions keyed on `install-v2-*` and 8 on
`install-*-full-*`** — 23 jobs restoring a 1.2–1.5 GB blob of every toolchain, against round 3
§4's finding that *"20 jobs run `Install toolchain`… Ten of them — half — need exactly one
component: `bun`, 178 MB."*

**This is round 3's union thesis in its most physical possible form.** The union is not an
abstraction over the dependency graph; it is a tar file, and it is the single largest object in
the cache budget. `mise-*` (739–822 MB) is the same shape one layer down: one blob holding
python, node, java, go, zig, bun, uv and the lint tier together.

---

## 4. The eviction evidence

### 4.1 What was deleted, and whether it was ever read

Diffing the 08:22:47 and 08:23:48 snapshots by cache `id`:

```
41 entries, 23.06 GiB evicted in 61 s
21 entries,  7.80 GiB survived
```

Of the 41 evicted entries, **28 (18.39 GiB, 80% of the evicted bytes) had never been
restored** — `last_accessed_at` equal to `created_at` at the moment of deletion. Those entries
are terminal: they were written, never read, and are now gone. This is not a sampling artefact
that a later hit could correct.

Lifetimes of the evicted entries, shortest first:

| lifetime | status | size | key |
|---:|---|---:|---|
| **126 s** | NEVER-HIT | 1,158 MB | `interp-v1-Linux-X64-7649b1a7…` |
| 144 s | NEVER-HIT | 61 MB | `Linux-nuget-e9576baa…` |
| 147 s | NEVER-HIT | 1,191 MB | `install-v2-Linux-X64-59a7a296…` |
| 179 s | NEVER-HIT | 1,318 MB | `install-Linux-X64-base-a047921b…` |
| 239 s | NEVER-HIT | 1,858 MB | `dotnet-macOS-ARM64-4cf67312…` |
| 259 s | NEVER-HIT | 822 MB | `mise-Linux-X64-9847a5b8…` |
| 279 s | NEVER-HIT | 1,537 MB | `full-verify-v2-Linux-X64-2f9b105b…` |
| … | | | |
| 1,871 s | hit | 142 MB | `codeql-dependencies-1-Linux-go-2736af60…` |

Median lifetime ≈ 300 s. **A 1,158 MB Python toolchain cache lived 126 seconds and was never
read once.** Across all 79 entries observed, 54 (68%) holding 30.50 GiB (74%) were never-hit at
last observation.

### 4.2 The rewrite loop, directly observed

Two mechanisms both multiply the same logical cache, and they are different:

**True rewrite — same key, same ref, new cache id.** The prior copy was evicted, the next run
missed, and re-uploaded:

```
2x  1191 MB  install-v2-Linux-X64-59a7a296… | refs/heads/main
2x  1191 MB  install-v2-Linux-X64-59a7a296… | refs/pull/15533/merge
```

**Ref-scope duplication — same key, N refs.** `actions/cache` skips its save step on an exact
key hit, and a PR run *may* restore from its base branch. So a PR-scoped copy of a key `main`
already holds means the `main` copy was **not available at restore time**:

| refs | size each | key |
|---:|---:|---|
| 12 | 61 MB | `Linux-nuget-e9576baa…` |
| 4 | **1,858 MB** | `dotnet-macOS-ARM64-4cf67312…` |
| 4 | 1,191 MB | `install-v2-Linux-X64-59a7a296…` |
| 4 | 739 MB | `mise-macOS-ARM64-9847a5b8…` |
| 4 | 356 MB | `nuget-macOS-ARM64-c922cac0…` |
| 3 | 409 MB | `dotnet-Linux-ARM64-4cf67312…` |

`dotnet-macOS-ARM64` alone: **4 copies × 1,858 MB = 7.26 GiB of a 10 GB budget for one
toolchain on one OS/arch leg.** Timeline check on `nuget-macOS-ARM64`: PR 15305 wrote its copy
at 08:11:29, and `main` did not write its own until 08:16:44 — the base-branch copy was absent
when the PR looked, which is the eviction feeding the duplication.

### 4.3 Write volume

78 distinct cache entries created over the 34.3-minute window, **39.76 GiB written** —
≈ **69 GiB/hour of cache uploads against a 9.31 GiB ceiling**, a turnover of ~7.5× per hour.
This is a **lower bound**: entries created and evicted entirely between two 60-second samples
are invisible to this method.

GitHub's own name for this regime, quoted in their dependency-caching reference and already
cited by round 3: *"cache thrashing, where caches are created and deleted at a high
frequency."*

### 4.4 Two tempting explanations, tested and FALSIFIED

Both were plausible enough to act on, and both are wrong. Recorded because a falsified
hypothesis is the cheaper finding — acting on either would have changed code that is correct.

**"The never-read caches are a save-side / restore-side key mismatch."** Structurally
impossible almost everywhere here. A key mismatch requires `actions/cache/restore` and
`actions/cache/save` to be used as *separate* steps with independently-written key
expressions. Across every workflow and composite action in the repo there is exactly **one**
split usage — the deliberate restore-only mise step in `low-memory.yml`. Every other cache
uses the combined `actions/cache`, where the save reuses the restore's key **by
construction**. So the never-read bytes are not a mismatch. Three measured mechanisms
account for them instead:

1. **Key churn outrunning reuse** — the dominant one. The `install-*` family's key changed on
   **100 commits in 30 days** (§6.1); a cache whose key changes before the next run that
   needs it can never be hit, no matter how long it lives.
2. **Eviction before reuse** — median lifetime ≈300 s against sweeps every ≈5 minutes (§2).
3. **Keys that embed a per-commit value** — `codeql-trap-1-2.26.3-javascript-<40-hex>`, where
   the suffix is the **commit SHA**. Seven distinct such keys were observed, **162 MB** total,
   and by construction not one of them can ever be hit by a different commit. This is
   `github/codeql-action`'s own design (TRAP reuse *within* a commit), not repo code — named
   because it is a permanent never-hit class holding ~1.7% of the ceiling, not because it is
   ours to change.

**"The `install-v2` thrash loop is a save firing when a hit should have prevented it."** Also
wrong, and the sample data settles it directly. For every `(key, ref)` pair that showed two
cache ids, **the two ids never coexist in any sample**:

```
refs/heads/main        08:20:46 - 08:22:47  id 7007742770
                       08:23:48             (the sweep — absent)
                       08:24:48 - 08:27:50  id 7007873285   <- new id
refs/pull/15533/merge  id 7007773486  ->  (sweep)  ->  id 7007849463
```

The first entry was **deleted by the 08:23:48 sweep**, and a later run then found nothing to
restore. **The save fired because there was genuinely no entry to hit** — correct behaviour,
not a defect. The thrash loop is a *symptom* of total pressure, so it is addressed by removing
pressure (§6.1's key churn, §4.2's duplicate writers) and not by changing save logic.

---

## 5. The partition arithmetic

### 5.1 Attribution rule

Each measured cache key family is assigned to the round 3 §7 candidate that owns its
toolchain. Two families cannot be assigned and are labelled so rather than apportioned.

| key family | candidate (round 3 §7 names) |
|---|---|
| `dotnet-*`, `nuget-*`, `interp-v1-*` | `Zeta-core` |
| `elan-*`, `lake-*`, `opam-tlaps-*` | `zeta-formal` |
| `bun-*` | shared (7 candidates; round 3 §7) |
| `apt-archives-*` | shared base |
| `codeql-*` | whole-repo security scanning |
| `install-v2-*`, `install-*-{base,full}-*`, `full-verify-v2-*` | **UNATTRIBUTABLE — union blob** |
| `mise-*` | **UNATTRIBUTABLE — multi-toolchain blob** |

### 5.2 The peak sample, attributed

2026-08-26T08:22:47Z, 62 entries, 30.86 GiB — the moment before the sweep:

| candidate | charged GiB | entries | logical GiB | keys |
|---|---:|---:|---:|---:|
| **UNATTRIBUTABLE — union blob** | 12.69 | 10 | 10.24 | 8 |
| **`Zeta-core`** (dotnet + nuget) | 10.04 | 26 | 3.68 | 10 |
| **UNATTRIBUTABLE — mise blob** | 6.06 | 8 | 2.31 | 3 |
| `Zeta-core` (python/uv interp) | 1.13 | 1 | 1.13 | 1 |
| shared base (apt) | 0.56 | 2 | 0.56 | 2 |
| whole-repo security (codeql) | 0.23 | 5 | 0.23 | 5 |
| shared (bun) | 0.13 | 4 | 0.10 | 3 |
| **`zeta-formal`** (elan) | **0.02** | 6 | 0.01 | 3 |

### 5.3 The number the plan needs, and it does not close

**`Zeta-core` alone measured 11.17 GiB charged (10.04 + 1.13) at peak — above the 10 GB
ceiling by itself**, holding nothing but `~/.dotnet`, `~/.nuget/packages` and the Python
interp cache, and before it is allocated any share of the union or mise blobs that its own
jobs would still need.

Split into its two terms, because they behave differently under a split:

- **Logical footprint: 4.81 GiB.** Fits under the ceiling comfortably. This is the number a
  reader hoping for confirmation would stop at.
- **Ref multiplier: 2.6×** (26 entries over 10 keys). This is what carries it over — and it is
  the term a split does **not** reduce for this particular candidate. Round 3 §6 measured that
  one dotnet component absorbs **2,182 of 2,282 build-touching commits in 90 days (96%)**, so
  `Zeta-core` inherits essentially all of today's PR concurrency. Its ref multiplier travels
  with it.

**Three structural reasons the arithmetic does not close, all measured:**

1. **59% of the logical working set is in blobs that no candidate owns.** Union blob 10.24 GiB
   + mise blob 2.31 GiB = 12.55 GiB of the 21.27 GiB logical set. These shrink under a split —
   each repo's install would carry a smaller subset — but *by how much cannot be derived from
   cache data*, because today no artefact exists at the per-toolchain granularity. Realising
   any saving requires the per-leg install subset round 3 §13 already names as the work item;
   the split alone relocates the blob rather than shrinking it.
2. **The split partitions the toolchain axis and leaves the OS×arch axis untouched.**
   `dotnet-macOS-ARM64` is **1,858 MB — 20% of the entire ceiling for one leg of one
   toolchain**, and 4.5× the Linux-X64 entry (409 MB) for the same SDK. Every repo that builds
   .NET still needs all four legs. Measured per-leg: Linux-X64 409 MB · Linux-ARM64 409 MB ·
   Windows-ARM64 118 MB · macOS-ARM64 1,858 MB.
3. **`zeta-formal` — round 3's strongest closure cut at 2,977 MB / 26% of the union — costs
   0.02 GiB of cache.** Its `elan` entries are 1–4 MB. Round 3 saw the same thing and said so
   (*"the `elan` caches total 11 MB across 3 entries, i.e. effectively empty"*), and this
   measurement confirms it at a different hour. The Lean toolchain is not in the CI cache at
   all, so **splitting it out frees no cache**. That does not weaken the `zeta-formal` cut —
   its case is developer-clone bytes and closure disjointness, both of which stand — but the
   cache axis has no opinion on it, and should not be cited in its support.

**Which partitions land under 10 GB, measured:** every candidate except `Zeta-core` is far
under, most of them by two orders of magnitude. `Zeta-core` is over. Since `Zeta-core` is the
candidate that would keep the CI matrix, the PR volume and the .NET toolchain, **the split as
drawn moves the ceiling problem into one repo rather than dissolving it.**

---

## 6. What the union costs today — round 3's thesis, in cache bytes

Round 3's thesis is that the union is the bottleneck. Cache is a concrete instance, and the
numbers corroborate it on a second axis round 3 did not measure — **invalidation**, not size.

### 6.1 The union blob's cache key includes code that installs nothing

`hashFiles('.mise.toml', 'tools/setup/**', 'global.json')`. Measured over the last 30 days on
`origin/main`:

| key input | commits (30 d) |
|---|---:|
| **`tools/setup/**`** | **93** |
| `Directory.Packages.props` | 13 |
| `.mise.toml` | 9 |
| `global.json` | 6 |
| `.mise.full.toml` | 4 |
| `src/Interp.Python/uv.lock` | 1 |

`tools/setup/**` dominates by 7×. Classifying each of the 92 reachable commits by whether it
touched any toolchain-installation file at all:

```
only secrets/PKI (zero toolchain files):  38  (41%)
mixed:                                     7
genuinely toolchain:                      47
```

**38 of 92 commits — 41% — invalidated a 1.2–1.5 GB union blob on every OS×arch leg while
changing nothing any toolchain installs.** The path doing it is
`tools/setup/persona-keys/**`: FROST/Shamir/TPM/biometric TypeScript and its tests, which
churned hardest of anything under `tools/setup/` in the window (`frost-share-adapter.ts` 9
commits, `frost-hardware-probe.test.ts` 8, `ca.ts` 7, …).

**This is the union bottleneck stated as a cost function rather than a size.** A union blob is
invalidated by the union of its inputs' change rates, so the busiest unrelated file sets the
rewrite frequency for every toolchain in the tar. Five distinct `install-Linux-X64-{base,full}`
key hashes were observed inside one 35-minute window — 6.5 GB of mutually-unhittable blob.

It is also the DV2.0 discipline violated at the cache layer: a fast-changing satellite
(`persona-keys/`, PKI source under active development) is packed into the same key as a
slow-changing hub (pinned toolchain versions). `.claude/rules/dv2-data-split-discipline-activated.md`
predicts exactly this failure — *"cutting by topic rather than rate produces repos that must be
released in lockstep"* — here applied to a cache key rather than a repo.

### 6.2 Every toolchain competes for one budget, and the loser is whoever ran first

The eviction is LRU by last-access across the whole repo, so the families do not have separate
budgets — a burst of macOS .NET jobs evicts the Python interp cache. That is visible in the
sweep: **every family lost entries in the same 61 seconds** — dotnet, mise, nuget, the union
blob, interp-v1, codeql, elan and bun all appear in the evicted list. No toolchain has a floor.

This is the mechanism behind Aaron's framing (*"different caches for different tooling"*): N
repos give N independent LRU domains, so a .NET burst cannot evict Lean. **The measurement
supports that mechanism.** What it does not support is that the resulting domains are each
under 10 GB, which is §5.3.

### 6.3 One defect found while measuring

`dotnet-Linux-X64-4cf67312…` exists twice with the same key and wildly different content:

```
429,822,343 bytes  refs/pull/15532/merge   created 08:19:43
    172,367 bytes  refs/heads/main         created 08:08:32
```

A 172 KB entry under a key that should hold a ~410 MB SDK. Any job on `main` matching that key
gets `cache-hit: true` on a near-empty archive — so `actions/cache` skips its save step, the
job re-installs the SDK anyway, and the poisoned entry persists until LRU removes it. Reported,
not fixed: this document changes no workflow and no cache key. Named plainly and attributed to
ordinary error per `.claude/rules/never-assume-malice-where-mistake-is-possible.md`; the likely
cause is a save that ran before `~/.dotnet` was populated.

---

## 7. Findings for Aaron — discrepancies with the plan, not proposals

Per the brief, where the measurement disagrees with the plan the disagreement is reported and
no alternative cut is drawn.

**The destination is settled.** Aaron, 2026-08-26: *"i'd rather split out to multi repo than
try to purchase more cache, this is the long term plan."* So raising the ceiling is not an
option under consideration and is not priced here. Everything below is about what the split
needs in order to reach its cache goal.

1. **`Zeta-core` does not land under 10 GB.** §5.3. The plan's arithmetic assumes N repos × 10
   GB dissolves the ceiling; measured, the largest partition exceeds it alone. The decision this
   bears on is whether `Zeta-core` needs a further cut *on some axis the plan already has* — the
   Rust tier and the dotnet mega-component are both already named in round 3 §9 — or whether the
   per-leg install subset (round 3 §13) is the actual fix and the split is orthogonal. Not
   adjudicated here.

2. **The per-leg install subset looks like a PREREQUISITE for the split's cache goal, not a
   follow-up to it.** This is the sharpest consequence of §5.3(1) and it is checked, not
   inferred: `tools/setup/common/mise.sh` runs `mise install --yes` from the repo root, which
   provisions **everything `.mise.toml` declares**, and the only subsetting mechanism that
   exists anywhere in the tree is the slim/full tier merge (`MISE_ENV=full` pulling in
   `.mise.full.toml`). There is no per-toolchain or per-consumer subset. **So the union blob's
   size is a function of `.mise.toml`, not of which repository you are in** — a `zeta-formal`
   repo running today's install script would still provision dotnet, rust, go and the rest, and
   would carry a ~1.2 GB install blob for a component whose own toolchain cost is 0.02 GiB.
   A repo boundary relocates these blobs; it does not shrink them. Round 3 §13 already names
   the per-leg subset as work; this measurement says the ordering matters, because the split
   inherits the union unless the subset lands with it. **Named as a finding and handed back —
   not specified, not implemented, and not a proposal to re-cut anything.**

3. **The cache axis is silent on `zeta-formal`, round 3's strongest closure cut.** §5.3(3).
   Its cache cost is 0.02 GiB. If the cut is made, it should be made on the closure and
   developer-clone arguments round 3 gives it; citing cache pressure for it would be
   unsupported.

4. **41% of union-blob invalidations come from `tools/setup/persona-keys/**`.** §6.1. This is
   cheaper to address than a repo split and is independent of it — but it is a cache-key
   question, and this document deliberately changes no cache key.

5. **A poisoned 172 KB `dotnet-Linux-X64` entry is live on `main`.** §6.3. Root cause found
   after this document was first written: `gate.yml` (`ubuntu-24.04`) and `low-memory.yml`
   (`ubuntu-slim`) write the **byte-identical** `dotnet-{os}-{arch}-{hash}` key on the same
   `push: [main]` trigger from two different runner images. The repo had already diagnosed this
   exact "two writers, one key" condition for the *mise* cache in that same lane and fixed it
   with a restore-only step; the fix was never extended to the .NET SDK cache four lines above
   it.

**Status of the fixes.** Findings 4 and 5 are now implemented, since Aaron authorised cache
fixes directly (2026-08-26): the `persona-keys` key narrowing and the restore-only `dotnet`
step ship as their own PRs, each measured the way the defect was found. Findings 1, 2 and 3
remain open questions for Aaron and are deliberately not acted on here.

---

## 8. Register, and what could not be verified

| claim | register |
|---|---|
| sizes, entry counts, timestamps, eviction diff, lifetimes, never-hit counts | **metered** — itemised API, diffed by cache id |
| commit counts on cache-key inputs and their classification | **metered** — `git log` on `origin/main`, reproducible |
| the ceiling has not been raised | **metered** — two independent sweeps converged on 9.68 and 9.07 GiB; still not read from settings, which stay 404 |
| never-hit ⇒ the entry was useless | **metered for the 28 evicted** (terminal); `consistent with` for live entries, which may still be hit |
| ref-scope duplication ⇒ a base-branch miss | **consistent with** — follows from `actions/cache` skipping save on an exact hit; not instrumented at the job level |
| per-repo footprint after a split | **bounded, not predicted** — §5.3(1); the union blobs cannot be apportioned from cache data |

**Could not verify:**

- `GET /repos/{owner}/{repo}/actions/cache/usage-policy` → 404 at this credential, as for
  round 3. The organisation-level equivalent is also 404. The direct ceiling read remains
  unavailable to an agent.
- **Whether a specific CI job failed because of a cache miss.** The correlation between
  eviction and the install-step failures round 3 attributed (*"28 of 34 real job failures — 82%
  — died provisioning the toolchain"*) is plausible and is **not** established here. A restore
  that misses costs time, and a job that then exceeds its budget fails; joining the two requires
  per-job `cache-hit` outputs, which this note did not collect.
- **Cache write volume is a lower bound** (§4.3) — 60-second sampling cannot see entries born
  and evicted between samples.
- Whether the four-ref duplication would persist after a split. Argued in §5.3 from round 3's
  96%-of-build-commits figure; not measured on a split repo, which does not exist.

---

## 9. The RESTORE side, instrumented — the ingredient §8 lacked, and what it does NOT settle

§8 listed as unverified: *"Whether a specific CI job failed because of a cache miss …
joining the two requires per-job `cache-hit` outputs, which this note did not
collect."* **The per-job outputs are collected here. The causal join is still not
made**, and this section does not claim it: knowing a restore missed does not
establish that any job then failed *because* it missed, which would need the miss
timed against that job's budget and its failure mode. What follows is the missing
ingredient, not the conclusion it was wanted for — §8's bullet stays open. Every figure below comes from **job logs**
(`gh api …/actions/jobs/<id>/logs`, ANSI-stripped), counting the four lines
`actions/cache` emits: `Cache restored from key`, `Cache not found for input keys`,
`Cache saved with key`, `Failed to save: Unable to reserve cache`.

This instrument sees a class the §2–§4 sampler **structurally cannot**. Diffing the
itemised endpoint by cache `id` can only observe entries that *exist*; a restore that
misses and a save that loses a reservation race both create **no entry and no id**, so
they are invisible to it at any sampling rate. §4.4's conclusions are not wrong — they
are blind to this half, and §9.3 is what that blindness was hiding.

### 9.1 gate.yml — 84% hit, and the number is less comfortable than it looks

6 completed `gate.yml` runs, **212 jobs, 0 skipped for missing logs**, 2026-08-26
08:42Z–08:56Z. 176 jobs had cache activity; the 36 without are the 6 non-installing
jobs × 6 runs.

| family | hit | miss | saved | hit rate |
|---|---:|---:|---:|---:|
| `apt-archives-v1` | 158 | 17 | 6 | 90.3% |
| `bun` (setup-bun's own) | 72 | 0 | 0 | 100.0% |
| `mise` | 36 | 2 | 0 | 94.7% |
| `dotnet` | 28 | 6 | 6 | 82.4% |
| `elan` | 26 | 7 | 5 | 78.8% |
| `nuget` | 26 | 7 | 7 | 78.8% |
| `install-v2` | 72 | 36 | 5 | 66.7% |
| `full-verify-v2` | 2 | 5 | 5 | 28.6% |
| **total** | **420** | **80** | **34** | **84.0%** |

Excluding `apt-archives`: **80.6%**. Excluding `apt-archives` *and* `bun` — i.e. the
caches this repo actually keys itself — **75.1%** (190/253).

`full-verify-v2`'s 28.6% is a 7-attempt sample and must not be read as a steady-state
rate; it is reported because it is the same shape as `install-v2` at n=1 per run.

### 9.2 The slim lane is far worse, and the cause is a key-namespace split

Same method, 7 consecutive `low-memory.yml` runs on `main`, 08:31Z–09:01Z:

| key | hit | miss |
|---|---:|---:|
| `apt-archives-v1-…-slim-…-2026-w35` | 7 | 0 |
| `dotnet-Linux-X64-<hash>` | 3 | 4 |
| `mise-Linux-X64-<hash>` | 1 | 6 |
| `nuget-Linux-<hash>` | **2** | **5** |
| `elan-Linux-<hash>` | **2** | **5** |

**`nuget` and `elan` hit 28.6% here against 78.8% in gate.yml — the same content, the
same hash inputs, half the hit rate.** The cause is not churn: the
`hashFiles('Directory.Packages.props')` digest was **constant at `c922cac0…` for the
whole window**. It is that the two lanes were writing into **different key
namespaces**:

```
gate.yml / lean-proof.yml   nuget-${{ runner.os }}-${{ runner.arch }}-<hash>   ->  nuget-Linux-X64-<hash>
low-memory.yml / codeql.yml nuget-${{ runner.os }}-<hash>                      ->  nuget-Linux-<hash>
```

Confirmed on the storage side in the same window — the **same digest charged twice**:

```
357 MB  nuget-Linux-c922cac0…        refs/pull/15541/merge, refs/pull/15552/merge
358 MB  nuget-Linux-ARM64-c922cac0…  refs/heads/main
```

**This is the mechanism the brief called "a save whose restore key never matches", and
it is a genuine instance** — but note it is *not* a counter-example to §4.4. §4.4
asked whether `actions/cache/restore` and `.../save` were split within a step with
divergent keys, and correctly answered no. The divergence is **between workflows**:
the combined action guarantees save-key ≡ restore-key *within one job*, and a cache
only ever pays off *across* jobs. §4.4's argument does not reach that case.

Fixed by making the two lanes join gate.yml's namespace, restore-only where the
runner tier differs — and by a falsifier,
`src/Core.TypeScript/hygiene/audit-cache-key-namespace-parity.ts`, which refuses a key
family carrying two expressions. **It goes red on the `origin/main` this document
measured**, naming exactly `nuget` and `elan`.

### 9.3 The poisoned `dotnet-Linux-X64` entry is being restored on EVERY gate run

§6.3 reported this as a two-sample curiosity ("reported, not fixed"). Instrumented, it
is worse: the 172 KB entry was **restored in 6 of 6 sampled gate runs**, every time on
`build-and-test (ubuntu-24.04)`.

```
Cache Size: ~0 MB (172876 B)     dotnet-Linux-X64-4cf67312…
                429,688,927 B    dotnet-Linux-ARM64-4cf67312…   <- same hash, other arch
              1,948,464,753 B    dotnet-macOS-ARM64-4cf67312…   <- same hash, other arch
```

Every one of those jobs also logs `Cache hit occurred on the primary key … not saving
cache`, so `actions/cache` will never overwrite it. **`~/.dotnet` is being
re-installed by `tools/setup/install.sh` on every ubuntu-24.04 gate run while the
cache reports a hit.** That is the vacuity class in its purest operational form — a
green `cache-hit: true` in front of a cache that contains nothing — and it is the
defect the restore-only change ships against.

*Register:* **metered** for the restore and the sizes; the **writer is still not
identified** (§6.3's honest limit stands — that needs the run that originally saved
it, outside this window).

### 9.4 `install-v2` is a cold-key STAMPEDE, not a thrash loop — refining §4.4

§4.4 falsified *"the save fires when a hit should have prevented it"* by showing the
two cache ids never coexist, and that holds. But it left the multiplication
unexplained, and the logs give it directly:

| run (08:xxZ) | hit | miss | saved | **lost the reservation race** |
|---|---:|---:|---:|---:|
| 32949103222 (42, main) | 0 | 12 | 1 | **11** |
| 32949466257 (46) | 0 | 12 | 2 | **10** |
| 32949544401 (47) | 0 | 12 | 2 | **10** |
| 32949777673 (49) | 12 | 0 | 0 | 0 |
| 32950041429 (52) | 12 | 0 | 0 | 0 |
| 32950340877 (56) | 12 | 0 | 0 | 0 |

```
31×  Failed to save: Unable to reserve cache with key install-v2-Linux-X64-5dc85527…,
     another job may be creating this cache.
```

The key hash is **identical across all six runs and all six branches**, so this is a
**time boundary, not a content difference** — `main` saved `install-v2` at 08:51:26 and
every run starting after it hits. And the pattern is **all-or-nothing per run**: the
same 12 jobs (the ten `lint (…)` legs, `test (TS environment-dependent)`) miss
together, all 12 then attempt to upload the same ~1.19 GB blob, and 10–11 lose the
race.

So the cost of one cold `install-v2` key is **12 simultaneous full toolchain installs
plus ~11 wasted upload attempts**, not one rewrite. That reframes the fix: the lever is
**how often the key goes cold**, which is exactly what the `persona-keys` narrowing
addresses (§6.1) — and it explains why §4.3's 69 GiB/hour write volume is a lower
bound in a second, larger way than §4.3 states, since a lost reservation transfers
bytes and stores nothing.

*Register:* **metered** for the counts. **Not established:** whether the cold window is
GitHub's branch-scoped cache visibility (feature branches read own ref + default branch
only). The timing is consistent with it; scope was not independently confirmed.

### 9.5 The union-blob prerequisite (§7 item 2) — CONFIRMED, on a new axis

§7 item 2 argued the per-leg install subset is a **prerequisite** for the split's cache
goal rather than a follow-up, from the install script's shape (`mise install --yes`
provisions everything `.mise.toml` declares; the only subsetting that exists is the
slim/full tier merge). This measurement confirms it **operationally**, which is a
different kind of evidence than the source reading:

**Twelve job definitions inside a single workflow independently raced to write the same
`install-v2` tar.** Not twelve jobs *reading* a shared cache — twelve jobs that each
determined they needed it, missed, and each began uploading ~1.19 GB of *every*
toolchain. Those twelve are ten `lint (…)` legs plus `test (TS environment-dependent)`:
work that, under round 3 §7's candidate list, would **not all live in the same
repository**. The union blob is not an accounting artifact of how the cache is grouped;
it is a single physical artifact that 23 job definitions genuinely share, and the
reservation conflicts are that sharing made visible.

A repo boundary drawn today therefore **relocates** this blob into whichever repo keeps
the install script, and every other repo still provisions the same tar because its size
is a function of `.mise.toml`, not of the repository. **The per-leg install subset has
to land with the split, not after it.**

**Stated precisely, and NOT more than was measured:** this confirms the *union-blob*
half of §7 item 2. It does **not** re-measure the `Zeta-core` = 11.17 GiB figure or the
59% union share from §5 — those remain as §5 reported them, at their own register
(`bounded, not predicted`). Nothing here contradicts them; nothing here independently
re-derives them either.

### 9.6 Two smaller findings, named and not acted on

- **`apt-archives-v1-…-slim-…-2026-w35` restored three different payload sizes under
  one key** — 38,897,504 / 38,897,547 / 40,706,971 B. Not poisoned (all plausible), but
  **the key does not determine the content**, which is the same class as §6.3 one
  severity lower. Named for the owner of that composite action; not changed here.
- **`Linux-nuget-<hash>`** (5 entries, 308 MB, 3 never-hit) is written by GitHub's
  managed `dynamic/dependency-graph/auto-submission` workflow, which is **not in the
  repo**. Same permanent-never-hit class as the `codeql-trap-*` SHA-suffixed keys in
  §4.4(3): named because it holds ~3% of the ceiling, not because it is ours to change.

### 9.7 Register for this section

| claim | register |
|---|---|
| all hit/miss/save/reserve counts, sizes, run and job ids | **metered** — job logs, 212 + 49 jobs, 0 skipped |
| `nuget`/`elan` namespace split, and the same digest charged twice | **metered** — key expressions in-tree + itemised endpoint |
| the split *causes* the slim lane's 28.6% hit rate | **metered for the churn alternative being excluded** (digest constant at `c922cac0…` all window); the causal step is otherwise `consistent with` |
| poisoned `dotnet-Linux-X64` restored on every gate run | **metered** — 6 of 6 runs, job ids recorded |
| the writer of the poisoned entry | **not established** — outside the sampled window |
| `install-v2` cold-key stampede | **metered** — 31 reservation failures, per-run breakdown |
| cause of the cold window (branch-scoped visibility) | **consistent with** — timing only, scope not confirmed |
| union blob is a prerequisite for the split's cache goal | **metered for the sharing mechanism** (12 concurrent writers of one tar); §5's GiB figures unchanged and not re-derived |
| Windows steady-state (`mise`/`elan` never saved on Windows legs) | **n=1, not established** — Windows legs appear in one sampled run only |

---

## Pointers

- `docs/research/2026-08-19-repo-split-round-3-the-union-is-the-bottleneck-*.md` — §5.3 (the
  11.57 GB reading and the "I did not instrument a cache miss" admission this closes), §7 (the
  candidate closures used in §5), §13 action item 1 (the ceiling question answered in §2).
- `docs/research/2026-08-19-repo-split-round-2-*.md` — the change-rate axis; §5.3(3) here is a
  case where the two axes disagree and the cache axis abstains.
- `docs/research/2026-08-01-multi-repo-split-design-*-why-cache-quota-is-the-wrong-forcing-function.md`
  — §0, whose "not purchasable" premise §7(2) reports as stale.
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — Stage 0, still `Proposed`.
- Backlog `081KRFA460008QG0R001H98EXJ` (substrate) · `-003JQ46J4` (product, closed 2026-05-14)
  · `-0007RWSN1` (Mirror/Beacon) · `-000VKJF0H` (code/English).
- `.github/workflows/gate.yml` — the union-blob cache blocks (`install-v2` at ~660,
  `full-verify-v2` at ~3381) and the per-toolchain blocks at ~526-558.
- `.claude/rules/dv2-data-split-discipline-activated.md` — §6.1 is change-rate partitioning
  violated inside a cache key.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register tables in §8 and §9.7.
- `src/Core.TypeScript/hygiene/audit-cache-key-namespace-parity.ts` — the falsifier for
  §9.2, wired into `ci-cache-paths-lint.yml`. It goes RED on the `origin/main` this
  document measured, naming exactly the `nuget` and `elan` families.
- **Anchors (Beacon).** GitHub Actions dependency-caching reference (read 2026-08-26) — the
  10 GB default, the raise-by-admin clause, LRU-by-last-access eviction, the 7-day unused
  retention, and GitHub's own term *cache thrashing*. Denning, *The Working Set Model for
  Program Behavior* (CACM 1968) — a cache smaller than the working set thrashes; §3's 21.27 GiB
  logical working set against a 9.31 GiB ceiling is that condition stated in its original terms,
  and Denning's point that the failure is a *property of the ratio*, not of the replacement
  policy, is why tuning LRU cannot fix this. Belady, Nelson & Shedler (CACM 1969) — anomalous
  behaviour under replacement policies, the reason §2 measures the sweep rather than reasoning
  about it. Martin, REP/CCP/CRP (*Granularity*, C++ Report 1996) — round 3's axes, unchanged
  here.
