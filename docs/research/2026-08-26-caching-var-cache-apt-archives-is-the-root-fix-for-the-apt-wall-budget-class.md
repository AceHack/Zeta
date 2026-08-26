# Caching apt's archive directory is the root fix for the wall-budget class — the design, the key, and what apt actually verifies

Status: **implemented and measured on a live pull request (#15526).** Acts on recommendation §7.1 of
`docs/research/2026-08-25-one-apt-wall-budget-failure-wearing-six-job-names-and-why-more-retry-cannot-fix-it.md`,
which named this "the root fix, and the only one with *negative* CI cost", required a design
doc, and did not implement it. Measured 2026-08-26 against `Lucent-Financial-Group/Zeta`.

## 1. The fault, in one paragraph, because it decides the whole design

`tools/setup/install.sh` fetched **561 MB of `.deb` on every ubuntu job**. On 2026-08-25 the
archive mirror delivered **~1.1 MB/s** against the ~14 MB/s (553 MB / 38.2s) the installer's
**420s** apt budget was sized from. 561 MB at 1.1 MB/s is **~510s of download alone**, so the
step ran out of wall clock **while succeeding slowly** — every attempt made forward progress
— and exited 124. Seventeen jobs died that way in one five-hour window, under six different
red job names across four workflows.

Three levers exist and two of them are closed:

| lever | why it is closed |
| --- | --- |
| more retry | three attempts already share **one** 420s deadline. A fourth subdivides the same wall; measured, attempt 3 was already down to a 45s slice. |
| a bigger budget | `audit-apt-budget-fits-job-timeout.ts --human` reports the tightest **fitting** margin at **18 seconds** (`k8s-lane-partition.yml:plan`, 420 + 10 + 152 = 582 vs 600). §6 does the arithmetic. |
| **fetch the bytes once** | open. This is that. |

## 2. What was built

Three pieces, and the third is the one that keeps the first two from going quietly inert.

**`tools/setup/linux.sh`** gained one optional environment variable, `ZETA_APT_ARCHIVES_DIR`.
Set, it relocates apt's archive directory (`-o Dir::Cache::archives=…`) to a caller-owned
path, prunes superseded `.deb`s with `autoclean`, and hands the tree back to the
unprivileged user. Unset — a dev laptop, a devcontainer — every line behaves as it did.

**`.github/actions/apt-archive-cache`** is a composite action that derives the key, restores
the directory, exports `ZETA_APT_ARCHIVES_DIR` into `$GITHUB_ENV`, and saves in its post
step. Because the export goes to the job environment, **the install steps themselves needed
no edit**: the adoption is one additive step per job, and every existing `run:
./tools/setup/install.sh` is byte-identical.

**`src/Core.TypeScript/ci/apt-archive-cache.ts`** refuses a Linux job that runs `install.sh`
with no restore step, or one whose cache tier disagrees with its install tier. Adopted by
**48 jobs across 27 workflows**.

## 3. What apt actually does with a pre-populated archive directory — measured, not assumed

The correctness case rests on apt's behaviour toward files that are already in the archive
directory, so it was **run** rather than recalled. Six experiments against `ubuntu:24.04`
(arm64, podman), a five-`.deb` package set, a host directory bind-mounted at `/aptcache` so
state survived between fresh containers exactly as a cache restore does.

**E1 — the relocation works.** `apt-get install -o Dir::Cache::archives=/aptcache` fetched
`714 kB in 2s` and left all five `.deb`s in `/aptcache`. apt created `partial/` itself at
mode **0700 root** and a `lock` at 0640 root; the `.deb`s are **0644**.

**E2 — a warm directory eliminates the download.** Fresh container, same mount, same command:

```
0 upgraded, 5 newly installed, 0 to remove and 0 not upgraded.
Need to get 0 B/714 kB of archives.
```

No `Get:` lines, no `Fetched` line. This is the entire mechanism.

**E4 — a stale version cannot be substituted.** A planted `jq_0.0.1-1_arm64.deb` and a
wrong-arch `jq_1.7.1-3ubuntu0.24.04.2_amd64.deb` were both left **untouched** while the
resolved version installed from cache at `Need to get 0 B`. apt asks for exactly one filename
per package — `<name>_<version>_<arch>.deb` — so a superseded `.deb` is not *preferred*; it
is *never asked for*. `apt-get update` runs on every invocation, so resolution always comes
from a fresh index. **This is the load-bearing correctness property and it holds.**

**E3 — and here is the half that came out other than expected.** apt does **not** re-hash a
file that is already in the archive directory. It accepts it on **filename and size**.

- *Truncated* `.deb` (wrong size): apt noticed and re-downloaded —
  `Need to get 64.6 kB/714 kB` → `Get:1 … jq …` → cache file restored to its pristine md5.
- *Same-size* corruption (1024 random bytes at offset 30000, length preserved): apt reported
  `Need to get 0 B` and **passed the corrupt file to dpkg**. What refused it was dpkg's
  decompressor checksum:

```
dpkg-deb (subprocess): decompressing archive '…/jq_….deb' … member 'data.tar':
  zstd error: Restored data doesn't match checksum
dpkg: error processing archive …
```

apt exited **100** and `jq` was left unconfigured. So the property is **"a poisoned archive
cache cannot install silently"**, not "apt validates the cache". The first draft of this
change's code comments asserted the second, and the experiment is what corrected them — an
anchor cited is not an anchor checked.

**The residual risk, stated.** A same-size corruption landing where the compressor's internal
checksum does not effectively cover it. Not constructible within this budget, so it stays a
theoretical gap rather than an observed one. Two things bound it:

1. **GitHub's cache scoping is the containment, not apt.** A cache entry is scoped to the
   branch that wrote it; the default branch's entries are readable from other branches, never
   the reverse. **A pull request cannot write bytes that `main`, or any other pull request,
   will read.** What a pull request can poison is its own later runs — on a runner that is
   already executing that pull request's code, so the attacker gains nothing they did not
   have.
2. The write path is our own CI on our own runners. There is no third-party writer.

**E5 — `autoclean` prunes by version.** Seeded with the bogus `jq_0.0.1-1`, it printed
`Del jq 0.0.1-1 [23 B]` and kept the current files. Nuance worth knowing: it kept the
wrong-**arch** `…_amd64.deb` because its *version string* is current — the keep/drop test is
version-based, not arch- or content-validated. Harmless (E4: it is never asked for), and it
means `autoclean` bounds growth without guaranteeing zero junk.

**E6 — permissions.** `partial/` at 0700 root is exactly why `linux.sh` removes it and
`chown`s the tree before the post step tars it as the runner user. The `.deb`s at 0644 are
world-readable, which is what they are in `/var/cache/apt/archives` too.

## 4. The cache key, and why each component is in it

```
apt-archives-v1-<suite>-<arch>-<effective-tier>-<manifest-hash-16>-<iso-week>
```

| component | source | what breaks without it |
| --- | --- | --- |
| `suite` | `ID-VERSION_CODENAME` from `/etc/os-release` | a noble archive offered to a jammy job. The manifest already aliases `libicu74`→`libicu70` for 22.04; the `.deb`s are not interchangeable. |
| `arch` | `dpkg --print-architecture` | amd64 and arm64 archives are different files. |
| `effective-tier` | the declared tier, normalised (below) | the tier decides the package set: slim resolves 149 packages / 139.7 MiB, standard/full resolve 388 / 713.0 MiB. |
| `manifest-hash` | `sha256(manifests/apt ‖ common/host-tier.sh)`, first 16 hex | the package list **and** the filter that resolves it. Either changing means a different set. |
| `iso-week` | `date -u +%G-w%V` | **the rotation.** See below. |

**Why the tier is normalised.** `set(T)` is every manifest entry of rank ≤ T, so two tiers
resolve the *same* set whenever no entry sits between them — and today none does:
`manifests/apt` carries 22 untagged (slim) and 13 `tier=standard` entries and **not one
`tier=full`**. Keying on the requested tier would store an identical ~561 MB payload twice
under two names. The action walks the requested rank down to the highest rank actually
present in the manifest, **derived from the manifest at run time**, so the day a `tier=full`
entry is added the two keys separate again on their own — and the manifest hash moves in that
same commit, so no stale entry is inherited across the change.

**Why the key rotates weekly.** A cache entry is **immutable once written**. A fully
deterministic key would therefore freeze the archive at whatever versions existed the first
time it was populated and decay from there as Ubuntu published updates — the cache would
still be *correct* (E4), just progressively less useful, and nothing would say so. Weekly
rotation with a `restore-keys` fallback gives the rolling shape: restore last week's entry,
fetch only what changed, save the union under this week's key.

**The restore ladder**, most specific first:

```
apt-archives-v1-<suite>-<arch>-<tier>-<hash>-<week>   (exact)
apt-archives-v1-<suite>-<arch>-<tier>-<hash>-          (any week, same package set)
apt-archives-v1-<suite>-<arch>-<tier>-                 (any package set)
```

The third rung is deliberate. A one-line edit to `manifests/apt` must not cold-start 48 jobs
at once: the `.deb`s for the packages that did *not* change are still exactly the files apt
will ask for, and the ones that did are simply fetched.

## 5. Size — the 10 GB question

GitHub evicts at **10 GB per repository**, LRU, plus anything unread for seven days.

Steady state after normalisation is **two entries per week**, and both have now been
**measured** rather than estimated (from this change's own runs, `GET /actions/caches`):

| entry | `.deb` count | on disk | cache entry |
| --- | --- | --- | --- |
| `…-slim-…` | 42 | 38 MB | **37 MB** |
| `…-standard-…` (`full` normalises onto this) | 177 | 536 MB | **534 MB** |

**571 MB per epoch**, not the ~700 MB estimated before the first run — the slim tier fetches
far less than its 139.7 MiB resolved size because most of that set is already on the runner
image. Two epochs are typically live (the previous week's entry is *read* at the start of
each new week via the ladder, which refreshes its access time), so the expected footprint is
**~1.1 GB**. One `suite`/`arch` pair dominates today (`ubuntu-noble`/`amd64`); `gate`'s
`build-and-test (ubuntu-24.04-arm)` leg adds an `arm64` entry of its own when it runs.

**The honest comparison, also measured.** This is not free headroom in an empty budget. The
repository's total cache occupancy at the time of writing is **14.47 GB across 30 entries** —
already past the documented 10 GB, so eviction pressure is real and *pre-existing*. The
neighbours:

```
1858 MB  dotnet-macOS-ARM64-…
1318 MB  install-Linux-X64-full-…
1318 MB  install-Linux-X64-base-…
1292 MB  install-Linux-ARM64-full-…
1191 MB  install-v2-Linux-X64-…          <- key moves on every PR touching tools/setup/**
1191 MB  install-v2-Linux-X64-…
 534 MB  apt-archives-v1-ubuntu-noble-amd64-standard-…
```

The apt entries are the better-behaved neighbours: they rotate **weekly** rather than
per-branch or per-PR, and there are two of them rather than one per key variant. Auditing
that 14.47 GB against the ceiling is a real follow-up and is **not** done here.

## 6. What was NOT done, and the arithmetic for it

**`ZETA_APT_BUDGET_SECONDS` is not raised, and this change makes the case for raising it
weaker, not stronger.** Covering §1's cold path (561 MB at 1.1 MB/s ≈ 510s plus unpack) needs
roughly **+180s**. Against the measured fleet:

- The tightest **fitting** job has **18s** of margin (420 + 10 + 152 = 582 vs 600). +180s
  turns that audit red immediately, and clearing it means editing `timeout-minutes` across
  ~49 governed jobs.
- `low-memory.yml:build-and-test-low-memory` is **already** over — 420 + 10 + 571 = 1001s
  against an 840s timeout, carried as a reasoned exception in the audit baseline. +180s makes
  it 1181s, and its `ubuntu-slim` runner class caps at 15 minutes (900s). **There is no value
  of the budget that fits that lane.**

With a warm archive the apt phase is dpkg unpack with **zero** bytes fetched, so the correct
follow-up question inverts: once §7's measurement is in, the budget is a candidate to be
**lowered**, which would *widen* every margin above rather than consume it. That needs the
warm-path distribution first and a human's name on it either way.

**One interaction this creates, named rather than left to be discovered.** The restore step
is itself non-apt work, and `audit-apt-budget-fits-job-timeout.ts` models each job as
`budget + kill_grace + non-apt <= timeout`. It reads its non-apt figures from
`audit-apt-budget-fits-job-timeout.baseline.json`, so **nothing goes red today** — but the
next time someone re-measures that baseline, a restore costing more than **18s** will push
`k8s-lane-partition.yml:plan` out of its margin, and a few of the other tight lanes after it.
That model is a worst case (the budget is a cap, not a reservation, and the warm path spends
a small fraction of it), so the honest reading is that the *model* goes stale, not that the
jobs get slower — total job time goes **down**. The resolution is the same follow-up as
above: measure the warm apt phase and lower the budget, which widens every margin by more
than the restore consumes. Recorded here so the eventual red is recognised as this change
rather than re-diagnosed from scratch.

**The manifest itself is not questioned here** (§7.4 of the predecessor). 561 MB fetched /
2996 MB installed on every ubuntu job is a real question and not one to answer alone; the
tier gate already subtracts the worst of it for 30-odd jobs.

**One lane opts out**, visibly, in its YAML: `accelerator-local-llm-validate.yml` passes
`enabled: "false"`. Its stated subject is *"a **BARE** runner + `install.sh` ⇒ working
local-LLM substrate"*. Warming its cache would replace the thing under test with a constant —
the shield would stay green and stop being a shield.

## 7. Before and after

### 7a. The clean measurement: the fetch is gone

Everything else in this section is a step *total* that also contains mise, dotnet, elan and
the verifier jars, on runners whose own variance is large. This one is not — it is apt
reporting, in its own words, how many bytes it needed:

```
Restore apt archives   Cache restored from key: apt-archives-v1-ubuntu-noble-amd64-standard-87cfa8a084fb7524-2026-w35
Install toolchain      ↻ apt archive cache: /home/runner/.cache/zeta/apt-archives (177 .deb present before install)
Install toolchain      Need to get 0 B/561 MB of archives.
Install toolchain      ✓ apt archive cache: 177 .deb, 536M in /home/runner/.cache/zeta/apt-archives
```

**561 MB** is the same figure §1 opens with — the download that could not fit in 420s at the
mirror's measured rate. On a cache hit it is **0 B**. The slim tier shows the same shape at
its own size: `Need to get 0 B/39.0 MB`, from 42 restored `.deb`s.

That is the failure class removed at its cause rather than re-sampled: there is no
arithmetic under which zero bytes exceeds a 420-second budget.

### 7b. Step totals, with their noise stated

Install-step seconds. `main` is the median of the six most recent successful runs (all
2026-08-23 or later, i.e. after the tier gate landed, so the tier is not a confound). `warm`
is this change's own runs on a cache hit, with the restore step's own cost added rather than
hidden.

| job | tier | `main` median (recent 6) | this PR, warm | Δ |
| --- | --- | --- | --- | --- |
| `helm-validate` manifests (offline) + mutation proof | standard | 176s | 90s + 4s restore = **94s** | −47% |
| `helm-validate` chart pins + helm template | standard | 128s | 96s + 9s restore = **105s** | −18% |
| `memory-index-duplicate-lint` | slim | 135s | 65s + 2s = **67s** | −50% |
| `git-hotspot-cadence` detect git hotspots | slim | 130s | 40s + 1s = **41s** | −68% |
| `ci-cache-paths-lint` audit | slim | — (cold on this PR: 48s) | 40s + 1s = **41s** | −15% vs cold |
| `gate` lint (shell) | slim | 25s | ~40s (see below) | — |

**Two confounds, named rather than smoothed over.**

1. **Runner variance is large**, and larger than some of the deltas above. `main`'s own six
   samples for `manifests (offline)` span 110–244s, and for `duplicate link targets` 46–162s.
   Read the table as direction and rough magnitude, not as a precise speedup; §7a is the
   measurement that does not depend on it.
2. **The first wave on this branch is doubly cold.** The existing `install-v2` cache key
   hashes `tools/setup/**`, which this change edits, so the cold wave paid a cold *mise*
   cache too — which is why `gate`'s slim lint jobs read ~40s here against a 25s `main`
   median. That cost is a one-off consequence of touching `tools/setup/`, not of the apt
   cache, and it disappears once this lands on `main` and the `install-v2` key stabilises.

**The number that actually matters is not in this table.** On a healthy mirror the archive
cache saves the fetch time, which is tens of seconds. On a degraded one it is the difference
between a job that runs and a job that exits 124 with its work never started — and `main`'s
own history for `helm-validate:manifests (offline)` contains exactly that: a **420s FAILURE**
in the same six-run window sampled above (run 32850274047). That is the case this was built
for.
## 8. The banner was wrong, and the correction is a measurement

`linux.sh` printed, on budget exhaustion:

> `⚠ apt-get install exceeded its 45s slice of the 420s budget (attempt 3/3) — stalled archive mirror, not a package error.`

The predecessor established that "stalled" is usually **false**: bytes were flowing the whole
time. The word sent every reader at the wrong fix — a hang wants a retry, and this wanted
fewer bytes.

The replacement does not swap one assertion for another. It **measures** the archive
directory before and after each attempt and reports what it observed:

```
⚠ apt-get install ran out of wall clock: its 45s slice of the 420s budget expired
  (attempt 3/3, rc=124).
  MEASURED this attempt: 48 MB into the archive cache in 45s = 1092 kB/s. Bytes were
  still arriving, so this is a SLOW mirror against a fixed budget — not a hang and not
  a package error.
```

…and, when the delta really is zero, says so instead — *"NO bytes reached the archive cache
in 45s. That is the WEDGED case"*. The two causes want opposite remedies, so the banner now
lets the number distinguish them rather than guessing. The same correction is applied to the
`apt-get update` banner ("stalled mirror" → "ran out of wall clock") and to the final
`✗` message, which used to recommend raising `ZETA_APT_BUDGET_SECONDS` first — the one lever
§6 shows does not fit in CI.

## 9. The falsifier, and why the adoption needed one

48 jobs adopting a step by hand is 48 chances to leave one out, and both ways of getting it
wrong are **invisible**:

- **absent** — the job works, it is merely slow, and it re-enters the failure class alone.
  Nothing in the tree says so; it is green until the mirror is slow and then red for a reason
  that reads as its own. This is the tier gate's old shape before
  `audit-install-tier-declared.ts`: a mechanism that only the jobs which already opted in
  ever exercise.
- **miskeyed** — the cache step says `tier: slim`, the install step says `ZETA_HOST_TIER:
  full`. The tier is *in the key*, so a slim payload is stored under a full name and the next
  full-tier job gets a **cache hit** on a payload missing two thirds of what it needs. Never
  incorrect; silently worthless.

`apt-archive-cache.ts` reports both, plus `after-install` (a restore step ordered after the
fetch it was meant to serve — the vacuity class in its purest form). Its own falsifiers pin
five mutants, including *"a matrix `runs-on` stays in scope"*, without which `gate.yml`'s
`build-and-test` — the single biggest apt consumer in the tree — would silently leave the
audit's scope. Both run in `ci-cache-paths-lint.yml`, whose subject already is
actions/cache discipline; `.github/actions/**` was added to that workflow's path filter,
because a trigger that cannot see the composite action is a check that never runs on the
change most likely to break it.

## 10. Pointers

- `.github/actions/apt-archive-cache/action.yml` — the key derivation and the restore/save.
- `tools/setup/linux.sh` — `ZETA_APT_ARCHIVES_DIR`, the `autoclean`/`chown` handback, the measured banner.
- `src/Core.TypeScript/ci/apt-archive-cache.ts` (+ `.test.ts`) — the adoption falsifier.
- `docs/research/2026-08-25-one-apt-wall-budget-failure-wearing-six-job-names-and-why-more-retry-cannot-fix-it.md` — the diagnosis this acts on.
- `docs/research/2026-08-14-cancelled-gate-runs-are-apt-stalls-hitting-job-timeouts-not-concurrency-cancels.md` — the same fault when it still reported `cancelled`.
- `src/Core.TypeScript/hygiene/audit-apt-budget-fits-job-timeout.ts` — the 18-second margin.
- `src/Core.TypeScript/hygiene/audit-install-tier-declared.ts` — the sibling audit, and the shape this one copies.
