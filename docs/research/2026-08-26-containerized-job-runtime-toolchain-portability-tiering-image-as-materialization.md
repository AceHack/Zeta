# Containerized job runtime: toolchain portability as the tier discriminator, and the image as a materialization

**Date:** 2026-08-26
**Author:** shadow (autonomous tick)
**Status:** one job proven **green in CI** (run 32956629464, §5.0), fleet not migrated, nothing demoted
**Register:** every claim below is labelled `metered` (measured here, with the query stated), `consistent with` (observed, not isolated), or `speculative` (a projection nobody has run).

---

## 0. The direction, verbatim

Aaron, 2026-08-26:

> *"route the container-based job runtime, that could help everything"*

> *"we just still need raw os tests too but they can be demoted like windows and mac already are — anything that can't bring it's toolchain with it can run less often and be a drift check not a blocking gate"*

> *"yes exactly, there is only one ace and pre ace bootstrap"*

> *"manifest comparison is fine, don't chase bit-reproducibility"*

> *"we should investigate bit reproducability with other container toolchains other than docker but yes with docker i think bit-reproducibiity is very hard to come by when you can do apt update and upgrade"*

Two separable things are named there. The first is a **tiering rule** whose discriminator is *toolchain portability*, not importance. The second is a **layering claim** that decides what an image even is here — and it is the one that keeps this from rotting.

---

## 1. The layering: an image is OUTPUT, not a participant

The tempting framing — and the one I was handed first — is that a container image becomes a *fourth consumer* of `tools/setup/`, beside laptops, CI runners and devcontainers (`GOVERNANCE.md` §24). That framing creates a reconciliation problem: two definitions of the toolchain kept in agreement by a third mechanism that can itself go stale, silently, because the image is what CI runs while the script is what humans run.

Aaron's correction removes the problem instead of solving it. There are **two layers, one definition**:

| layer | what it is | where it lives |
|---|---|---|
| **1 — the seed** | the minimal, auditable set that gets a bare machine to the point where the repo's own installer can run | four apt packages: `ca-certificates curl git xz-utils` |
| **2 — everything after** | `tools/setup/install.sh` and the manifests it reads | `tools/setup/` |

An image is neither layer. It is **a materialization of having run both**, at a pin. Reproducible output.

The consequence that matters: **drift detection is just "does the output still match the definition"**, and it needs no new concept. `src/Core.TypeScript/ci/dockerfiles/ci-runtime/Dockerfile` therefore contains **zero package names other than the four seed packages**. If a future edit adds an `apt-get install` line naming a tool that also appears in `tools/setup/manifests/apt`, the second definition has reappeared and the whole argument of this document is void.

### 1.1 The prior art is already in this tree, and it is the right shape

`src/Core.TypeScript/ci/dockerfiles/ubuntu-install-sh-test/Dockerfile` has, since 2026-05-30, built an image by installing exactly those four seed packages and then running `./tools/setup/install.sh`. Its own header states the thesis: *"The build IS the test: a failing install.sh / assert fails the build."*

`metered` — that Dockerfile exists, does exactly that, and is driven by `.github/workflows/docker-ubuntu-install-sh-test.yml` via a plain `docker build`.

What it does **not** do is keep the result. The image is built, asserted against, and thrown away. This work is one change to that: **keep the image and let jobs run in it.** The Dockerfile added here is the same shape, minus ollama and the local-LLM validation (a CI runtime is not a dev laptop), plus a declared `ZETA_HOST_TIER=slim`.

### 1.2 Drift detection: manifest comparison, and why not bytes

Aaron ruled out chasing bit-reproducibility, and the reasoning that supports it is worth stating precisely because it corrects a common mis-attribution:

> **Reproducibility is a property of the package manager, not the container runtime.**

`apt` resolves version *ranges* against a mutable external mirror at build time. Podman and Buildah execute the same non-deterministic build Docker does, so "try a different container toolchain" buys nothing. Content-addressed package managers (Nix, Guix, apko) pin the whole closure by hash, which is what actually delivers reproducibility — and they emit ordinary OCI images. See §7.

So the check that ships is a **manifest comparison**:

```
TEXT EXPECTATION   .mise.toml  (already the repo's single declared source for tool versions)
ARTIFACT UNDER     what `mise ls --json` reports as INSTALLED inside the image
TEST
```

Same discipline as the multi-oracle golden vectors: the expectation is text a human reads in a diff, the thing being judged is not. Implemented in `src/Core.TypeScript/ci/toolchain-manifest.ts`, run **inside the image** on every build.

**It is falsifiable, and I ran both controls locally rather than asserting it** (`metered`, 2026-08-26, against a real mise-provisioned host):

| control | command | result |
|---|---|---|
| positive | `toolchain-manifest.ts --check --tier slim` | `EXIT 0 — every one of the 18 mise-managed pins is satisfied` |
| negative | same, `--root` pointed at a copy of `.mise.toml` with `bun = "1.3"` changed to `bun = "9.9"` | `EXIT 1 … bun declares 9.9 but the runtime has 1.3.12, 1.3.13, 1.3.14` |

Plus 16 unit falsifiers in `toolchain-manifest.test.ts`, three of which exist specifically because this check has three easy ways to be vacuous: a declared-but-absent tool silently skipped, a substring version match that accepts `1.30` for `1.3`, and `mise ls` failing to run being read as "nothing wrong". The third is guarded in the CLI (a failed `mise ls` returns 1 with `a check that did not run must not look like one that did`), not in the pure functions, and the test file says so rather than implying coverage it does not have.

**What the comparison is blind to, printed on every run and not buried here:** the apt layer, elan/Lean, the dotnet global tools, the zig and rust-wasm32 realizers that run outside mise, and the base image's own contents. `unmanagedSurfaces()` enumerates them, and a test pins that the list stays non-empty — an emptied list would turn a narrow pass into an implied full verification.

---

## 2. The tiering rule

| a job can bring its toolchain in an image | tier | cadence | blocks a merge |
|---|---|---|---|
| **yes** | blocking gate | per-PR | yes |
| **no** — raw OS, bare-metal installer, Windows/macOS | **drift check** | lower cadence | **no**, and loud |

The discriminator is portability, not importance. A job is **not portable** when what it is testing *is the host* — the installer on a real Windows, the ISO on real firmware, a macOS-only code path. Putting those in a container does not make them portable; it makes them test the container instead, which is the same check wearing a costume.

### 2.1 This is the same rule the repo already runs, restated

`metered` — the repo has exactly **one** required status check: `gate (required)` (`src/Core.TypeScript/hygiene/github-settings.expected.json`, ruleset `CI Gate`, id 16134995). Everything else is non-blocking by construction. Windows and macOS were not moved to a separate cadence mechanism; they were classified inside `gate.yml` with one line:

```yaml
continue-on-error: ${{ startsWith(matrix.os, 'windows-') || startsWith(matrix.os, 'macos-') }}
```

above ~90 lines headed `THIS FLAG IS A CLASSIFICATION, NOT AN ACCOMMODATION. DO NOT "FIX" IT.` Windows additionally runs push-only; macOS still runs per-PR. The classification is pinned by a falsifier (`gate-scope-summary.test.ts`, *"the drift-check platform set is exactly what the maintainer classified"*), so a silent narrowing fails a test rather than being discovered by a merge.

**So the tiering rule proposed here is not new machinery.** It is the existing Windows/macOS classification generalised from *platform* to *toolchain portability*. Any demotion under it uses the existing mechanism — `continue-on-error` for a leg inside a floor job, or simply not being in `gate-required.needs` for a standalone workflow — and the existing loud surfaces.

### 2.2 The obligation that comes with "don't block"

`drift (loud)` (`src/Core.TypeScript/ci/drift-loud.ts`) is the repo's answer, and it is deliberately proportional rather than an alarm: `SUSTAINED` reddens, `FLAPPING` warns, `ONE_OFF` notices, `HEALED` reports, `UNOBSERVED` is explicitly *not* called healthy. It exits non-zero next to a green `gate (required)` and blocks nothing.

**A demotion that does not name its read surface is deletion with extra steps.** Every proposal in §4 names one.

---

## 3. The current job inventory, classified

`metered`, by parsing `.github/workflows/*.yml` on `main` at `f886e5af16` (2026-08-26):

| fact | value |
|---|---|
| workflows containing an `Install toolchain` step | **26** |
| total `Install toolchain` steps | **48** |
| `install.ps1` references (Windows path) | 40 |
| declared tiers across all workflows | `slim` **28**, `full` **16**, `standard` **3** |
| workflows using `container:` today | **0** |
| `.devcontainer/` | absent |

### 3.1 Portable — can bring its toolchain in an image

Everything below runs on `ubuntu-24.04`, installs via `tools/setup/install.sh`, and has a payload that is pure computation over the checked-out tree. These are the containerization candidates.

**Tier `slim` (the dominant class — one image covers all of them):**
`gate.yml`'s 22 install-carrying jobs · `backlog-index-integrity` · `budget-snapshot-cadence` · `chart-version-refresh` · `ci-cache-paths-lint` · `git-hotspot-cadence` · `installer-unit-tests` · `lint-autofix` · `manifesto-citation-snapshot-cadence` · `memory-index-drift` · `memory-index-duplicate-lint` · `memory-reference-existence-lint` · `search-index-cadence` · `agentic-organization-tests` · `agentic-organization-integration` · `scaffold-stage1-create-repos` · `low-memory` (see caveat below)

**Tier `standard`:** `stryker-mutation` · `tlaps-proof` · `interp-lane`

**Tier `full`:** `helm-validate` · `codeql` · `k8s-argocd-health-test` · `k8s-lane-partition` · `arc-lane` · `lean-proof` · `accelerator-local-llm-validate`

That every `gate.yml` install step declares `ZETA_HOST_TIER: slim` is the single most useful fact in this inventory: **one slim image covers the highest-volume 22 jobs per gate run.** A `full` image would be a second, much larger artifact serving seven low-frequency lanes, and it should not be built until the slim one has proved out.

### 3.2 Not portable — the drift-check tier

| job / workflow | why an image cannot carry it |
|---|---|
| `gate.yml` `build-and-test (windows-2025 / windows-11-arm)` | tests the Windows install path on real Windows; already non-blocking, already push-only |
| `gate.yml` `build-and-test (macos-26)` | macOS runners cannot be containerized at all; already non-blocking |
| `macos-install-sh-test` | the subject *is* a bare macOS host |
| `docker-windows-install-ps1-test` · `gitbash-install-routing-test` · `wsl-install-sh-test` | Windows-host semantics (`MAX_PATH`, PowerShell, WSL interop, Git Bash routing) |
| `docker-ubuntu-install-sh-test` · `docker-ubuntu-jammy-*` · `docker-nixos-install-sh-test` | these ARE the "bare machine plus install script" test. Running them in a pre-provisioned image would delete the experiment. |
| `build-ai-cluster-iso` · `multiboot-qemu-uefi-smoke` · `installer-repair-mode-existing-install` | firmware/boot/disk-level subjects |
| `low-memory` (`runs-on: ubuntu-slim`) | **uncertain, see below** |

Note the third row is the same distinction as `.claude/rules/no-binary-in-proof-lineage.md`'s one exception: **the thing under test is not evidence.** A job whose subject is "a bare machine plus the install script" cannot be handed a machine that already ran the install script.

### 3.3 Uncertain — I could not decide these from the tree

- **`low-memory`** (`runs-on: ubuntu-slim`). It is the single most expensive install in the fleet (`metered`: mean **298 s**, max **385 s**, n=6) against a hard 15-minute cap, and it deliberately never *saves* the toolchain cache, so the image would be pure win. But `ubuntu-slim` is a non-standard runner label and **I did not verify that a container runtime is available on it.** Do not migrate it until someone runs `docker version` there.
- **`codeql`**. CodeQL's own action does language autodetection and build-tracing; whether it tolerates a job-level `container:` is a question about the CodeQL action, not about this repo, and I did not test it.
- **`k8s-argocd-health-test` / `k8s-lane-partition`**. These start `k3d`/`kind` clusters, i.e. containers-inside-the-job. Nesting is possible but is a separate investigation.
- **`accelerator-local-llm-validate`**. Pulls a 398 MB model; an image that bakes it is huge, an image that does not saves little.

---

## 4. Demotions — proposed, none implemented

Nothing in this change demotes anything, edits `gate.yml`, or touches `required_status_checks`. What follows is a proposal with its cost stated, per the discipline that a demotion must be *stated, not absorbed*.

**Honest finding first: under the tiering rule, almost nothing needs demoting, because it already happened.** The four install-shield workflows in §3.2 were never blocking — the repo has one required check and they are not it. Windows and macOS were classified in 2026-08-19. So the rule mostly *ratifies* the current state rather than changing it, and that is a result worth reporting rather than manufacturing work to fit the brief.

The two candidates the rule does identify:

### 4.1 `docker-ubuntu-install-sh-test` and siblings → explicit cadence

**Today:** path-filtered `pull_request` + `push:main`, no schedule. Already non-blocking.
**Proposed:** add a `schedule:` (e.g. daily), so the shield fires even in a week where nobody touches `tools/setup/**`.
**What stops being enforced at merge time:** nothing — it does not gate today.
**What this adds:** these are the *only* checks that the bare-machine install path still works, and today they are silent unless someone edits the installer. A mirror change, a base-image change, or an upstream tarball moving would not be noticed until the next installer edit. A schedule makes "nobody touched it" and "it still works" different statements.
**Read surface:** their own red X, plus `drift-loud.ts`'s window fold once they run on a cadence.

### 4.2 Windows legs → stay exactly as they are

Priced and declined already (`workitems/081M0BVAV2H087G0R000VXRYRQ-…`): ~355 PR gate runs/day × ~21 runner-minutes ≈ 124 runner-hours/day for a check that by decision cannot block. **Nothing here reopens that.**

### 4.3 What a containerized job would NOT stop enforcing — and the one thing it would

Moving a portable job into an image does **not** demote it. It stays blocking, stays per-PR, and checks the same thing.

The one real loss, stated plainly: **a containerized job no longer proves that `tools/setup/install.sh` works on a fresh hosted runner.**

**But that coverage was weaker than I first wrote, and the correction matters more than the original claim.** I said "48 install steps re-prove that incidentally on every run." `metered`, by parsing every install-carrying job on `main` at `f886e5af16`:

| | count |
|---|---|
| install steps total | 48 |
| **behind a restored toolchain cache** (`actions/cache` for mise runtimes / apt archives / the .NET SDK, in the same job, before the install step) | **33** |
| with no cache restore in the job | 15 |

**On a cache hit, a warm install step does not exercise the download path at all** — that is the entire purpose of the cache, and `apt-archive-cache.ts` exists precisely to make those hits reliable. So 33 of the 48 are not proving the fetch path on most runs; they are proving that a restored toolchain still works.

And the 15 "cold" ones are only cold relative to *our* caches. They still run on a hosted runner image that ships node, Python, Go, Java and .NET preinstalled, with a warm apt mirror inside the same datacentre. **None of the 48 is a bare-machine proof.**

The genuinely-bare-machine path — an empty `ubuntu:24.04` plus `install.sh` and nothing else — is proven by exactly one family: the `docker-*-install-sh-test` lanes, plus `macos-install-sh-test`, `wsl-install-sh-test` and `gitbash-install-routing-test` for their platforms. **And `metered`: none of those nine workflows has a `schedule:` trigger.** All are path-filtered `pull_request` + `push` only.

So the pre-existing gap is larger than the one containerization would open, and it exists today: the only checks that prove the installer works from bare metal fire **only when someone edits the installer**, and upstream drift never edits the installer. That is §4.1, and it is now a defect to close rather than a cost to pre-pay.

---

## 5. The proof: one job, executing

`.github/workflows/ci-runtime-image.yml`. It builds the image and then, on the same run:

1. **Negative control, run first and deliberately before the image exists.** Asserts `bun` is absent from the bare `ubuntu-24.04` runner, then runs `memory-reference-existence-lint`'s payload on the bare runner and requires it to **fail**. If `bun` ever turns out to be preinstalled, the step goes red with `vacuous control` rather than quietly passing — a control that cannot fail is not a control.
2. **The proof.** The *same* payload — `bun src/Core.TypeScript/hygiene/audit-memory-references.ts --enforce`, verbatim from `memory-reference-existence-lint.yml` — inside the image, with the install step **deleted rather than replaced**, workspace mounted. Must pass.
3. **Toolchain drift.** `toolchain-manifest.ts --check --tier slim` inside the image.
4. **The checker's own falsifiers**, run inside the image (which also proves the image can run the repo's test runner).
5. **Publish**, on `push:main` / dispatch only: `:sha-<12>` + `:slim` tags, cosign keyless signature over the **digest**, and the digest printed to the step summary as the thing consumers pin.

**Why the payload runs via `docker run` rather than a job-level `container:`.** A job-level `container:` needs a registry-resolvable image *before the job starts*, and no image is published yet — the first publish happens when this lands on `main`. Making the proof depend on that would be a check that cannot run on the PR that introduces it. `docker run` with the workspace mounted is operationally identical to what `container:` does (image carries the toolchain, job carries the source), so the proof transfers to the cutover without changing shape.

### 5.0 IT RAN, AND HERE IS WHAT IT SAID

`metered` — run **32956629464**, job `ci-runtime image (build + one-job proof + toolchain drift)`, **conclusion `success`**, 2026-08-26T10:07:54Z → 10:11:06Z:

| step | outcome | wall |
|---|---|---|
| negative control | `control: bun is absent from the bare runner, as required.` then `control: the payload failed on the bare runner.` | 1 s |
| image build, **cold and uncached** | success | **181 s** |
| the payload, inside the image, no install step | `proof: the payload is green inside the image and red outside it.` | **~1 s** |
| toolchain drift | `EXIT 0 — every one of the 18 mise-managed pins is satisfied by this runtime.` | <1 s |
| the checker's own 16 falsifiers, inside the image | success | <1 s |

So the claim in the title of this section is not a design intention: the same command that **fails on a bare runner** **passes inside the image**, on the same commit, in the same job, ninety seconds apart. The negative control was not vacuous — `bun` is genuinely absent from `ubuntu-24.04`.

**And the number that matters most is the uncomfortable one.** `docker image inspect .Size` on the built image:

```
extracted_bytes = 6,253,608,609        (6.25 GB extracted)
```

That is the **slim** tier. It is not a small image, and it is exactly the figure §6.4 says is missing from the pull-cost arithmetic — except it is the *extracted* size, and what crosses the wire is the *compressed* size, which is still unmeasured because nothing has been pushed. **Do not divide 6.25 GB by a guessed compression ratio and call it a pull time.** This repo already has a doc-length note (`image-pull-measurement.yml`) about exactly that error: an aggregate ratio standing in for the decisive number. The first `main` publish produces the real one.

What 181 s of cold build does establish: rebuilding the image is cheap enough that a per-`main`-push rebuild on the input paths is not a cost worth optimising, and the drift check therefore runs against a genuinely fresh materialization rather than a stale one.

### 5.1 The cutover, for when a digest exists

Once `main` has published one, `memory-reference-existence-lint.yml` becomes:

```yaml
jobs:
  lint:
    runs-on: ubuntu-24.04
    container:
      image: ghcr.io/lucent-financial-group/zeta-ci-runtime@sha256:<digest-from-the-step-summary>
    env:
      MISE_TRUSTED_CONFIG_PATHS: /__w/Zeta/Zeta
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      # the `Install toolchain via three-way-parity script` step is DELETED, not replaced
      - run: bun src/Core.TypeScript/hygiene/audit-memory-references.ts --enforce
```

**Digest, never a tag.** A mutable tag in a build path is an unpinned dependency, which is the supply-chain shape this repo refuses elsewhere. The `:slim` tag exists for humans and for `docker pull` at a terminal; a workflow that pins it is a bug.

---

## 6. Costs — what is measured, and what is honestly not

### 6.1 Measured: what installation costs today

`metered`, GitHub Actions REST API, per-step timings, the most recent completed runs on `main` as of 2026-08-26T10:00Z (n=105 install steps sampled across 60 runs):

| lane | steps sampled | mean | max | total |
|---|---|---|---|---|
| `gate` | 88 (22 per run × 4 runs) | **115 s** | 465 s | 10,143 s |
| `low-memory` | 6 | **298 s** | 385 s | 1,788 s |
| `ci-cache-paths-lint` | 1 | 185 s | 185 s | 185 s |

**≈ 2,530 runner-seconds — about 42 runner-MINUTES — of toolchain installation per `gate` run**, before any of the actual work begins. The worst single leg measured 465 s (`lint (tick-shard relative-paths)`).

For the specific job proven here, the surrounding numbers are stark: `ci-cache-paths-lint` on 2026-08-26T09:45Z spent **38 s** installing and **under 1 s** on its entire payload.

### 6.2 Measured: install-step reliability in my window

`metered` — of the 105 sampled install steps: **97 success, 8 skipped, 0 failed.**

I was told three jobs died at `Install toolchain` with **exit 124** in one window tonight. **I could not reproduce that in the window I sampled**, and a sweep of the 25 most recent failed runs across all workflows surfaced no install-step failure at all. I have no reason to doubt the report — the `low-memory` and `gate.yml` comments both describe the exit-124 apt-mirror-stall class in detail, and `ZETA_HOST_TIER: slim` is described in-tree as *"a RELIABILITY fix before it is a cost one"* precisely because of it — but **I am not restating it as my own measurement.** It is `consistent with` the in-tree record; it is not `metered` here.

### 6.3 Measured: Actions cache pressure

`metered`, `GET /repos/Lucent-Financial-Group/Zeta/actions/cache/usage` at 2026-08-26T10:05Z:

```
active_caches_size_in_bytes: 22,336,320,534   (22.34 GB)
active_caches_count:         40
```

An image pull does **not** consume the Actions cache. Every containerized job is one fewer writer to that budget. The cache-key architecture is another agent's lane and I have deliberately touched no cache key expression; this number is stated as context, not as a proposal about caching.

### 6.4 The case is VARIANCE, not mean time — and one premise corrected

**The correction first.** I was told an image pull is "layer-cached on the runner". **On GitHub-hosted runners that is false.** Each job gets a fresh VM; no layer cache is carried between jobs or runs. Every containerized job pays a **full pull**. That stands.

**But I then over-corrected**, and the over-correction was the more damaging error. I wrote that the saving is `install − pull`, that `pull` is unmeasured, and therefore that the case rests on structural wins. That framing treats install-time and pull-time as **symmetric unknowns**. They are not, and Aaron's push-back is the correction — *"docker pulls are much more reliable to os or package manger installs and usually much faster."*

The asymmetry is structural and my own measurements show it:

| | a pull | an install |
|---|---|---|
| artifacts fetched | **one**, content-addressed | ~149 apt packages + the whole mise tool graph |
| origins | **one** registry, same infrastructure as the runner | a dozen upstreams: Ubuntu mirrors, GitHub releases, PyPI, npm, crates, CDNs |
| result of a repeat | **byte-identical**, by digest | whatever the mirror resolves to today |
| failure surface | registry down | any mirror slow, stale, rate-limited, moved, or down |
| measured spread here | **unknown** (§5.0 gives bytes, not seconds) | **mean 115 s, max 465 s — a 4× spread** |

So the claim this design is making is **not** "a pull is faster on average". It is:

> **A pull has a tighter distribution and a smaller failure surface than a multi-mirror package install. Eliminating the tail and the timeout class is the prize. Mean-time parity would already be a win.**

That is a sharper claim than the one I made, and — importantly — a falsifiable one.

**What would falsify it**, stated before the measurement rather than after:

1. a cold pull whose **p95 is comparable to the install's p95** (~465 s here) — i.e. the pull has a fat tail too;
2. a **registry failure class of similar frequency** to the mirror-stall class — GHCR outages, rate limits, or digest-resolution failures showing up at anything like the rate exit-124 does;
3. a pull whose **mean is materially worse** than the install's mean, which would mean the tail is being bought at a price the median pays every run.

Any one of those and the proposal should shrink to the lanes where reliability alone justifies it (`low-memory`, and anything under a hard cap). **If the measurement comes back bad it lands as loudly as if it came back good.** The instruments below are deliberately built to report the *worst* of several samples, not the best.

#### The two facts about install failures, neither cancelling the other

- `metered`: **0 failures in my 105-step sample** (§6.2). Real, and it means install failures are not constant.
- `consistent with` the in-tree record: the exit-124 mirror-stall class is documented at length in `low-memory.yml`, `gate.yml`, and `apt-archive-cache.ts`, the last of which records **"17 jobs died at exit 124 in the install step under six different job names"** in one five-hour window on 2026-08-25.

A 0/105 sample does not exclude a tail event that the tree records happening. **Both belong here.** The install is not usually broken; it is occasionally, expensively, and unpredictably broken — which is precisely a variance problem and precisely what a single mean would hide.

#### The strongest evidence for the variance thesis arrived by accident

While landing this work, a **YAML-only change** — seven `schedule:` keys added to install shields, not one line of code — went red on `build-and-test (ubuntu-24.04)`, which is in the `gate (required)` floor. The failing assertion:

```
Zeta.Tests.Storage.ColumnLinearOpsTests.ColumnLinear vectorized filter is measurably faster on unpredictable data [FAIL]
  vectorised filter should be >= 1.5x the scalar filter on 1000000 unpredictable keys at 50%
  selectivity, measured 0.93x (scalar 6.960 ms, vector 7.463 ms, Vector<int64>.Count = 4).
```

That is a **wall-clock ratio assertion inside the one blocking check**. Two things make it worth recording here rather than shrugging off as a flake:

**1. It is outside its author's own flake model.** The test's comment anticipates flaking and says where: *"the DEBUG margin is thinner … If this flakes on a loaded runner it will flake in Debug first, and the fix is to skip it in Debug rather than to lower it further — a gate below ~1.05 could not tell a vector path from a scalar one and would be a check that cannot fail."* This failed in **Release**, at **0.93x**, against a stated normal of 3.45x and a bypassed-path signature of ~1.02x. So the observation is neither "healthy" nor "vector path bypassed" — it is off the map the test was designed around, and **the test cannot distinguish a contended runner from a real regression.** A re-run is the only discriminator, which is the definition of a non-deterministic gate.

**2. The blocking leg is the noisiest thing in CI, and it is measured.** `data/platform-drift.json`, as of 2026-08-26T10:05Z, over 500 push runs (134 executed, 366 cancelled — 26.8% coverage):

| leg | classification | failures / executed | rate | last failure blocked a merge? |
|---|---|---|---|---|
| **`build-and-test (ubuntu-24.04)`** | **blocking** | **17 / 134** | **12.7%** | **yes** |
| `build-and-test (macos-26)` | non-blocking | 1 / 134 | 0.75% | no |

**The leg that blocks merges fails at roughly 17× the rate of the leg that was demoted for being "a quiet leg holding gate authority."** That inversion is the tiering rule's own argument turned on the floor: portability decided which jobs *may* be gates, and nobody has since asked whether the surviving gate is *reliable enough to be one*.

This is `consistent with` — not proof of — the thesis in this section: the expensive failures in this repo are variance, not means, and they land in the places that block. It is included because it is a measurement I did not go looking for, on a change that could not have caused it.

**Out of scope here, and named rather than fixed:** the timing assertion is not mine, `ColumnLinearOps.Tests.fs` is not touched by either PR, and re-running was the correct response to an unrelated red. Whether a wall-clock ratio belongs in the blocking floor at all is a floor question — §8.

#### What is now measured, and what still is not

`metered` — the **wire size** is no longer a guess. `image-wire-size.ts` pushes the built image to a throwaway local `registry:2` and reads the manifest the registry itself produces, summing `config.size + layers[].size`. That is the exact byte count a `docker pull` moves. It is not the 6.25 GB extracted figure divided by a ratio, and the script **refuses** an OCI index rather than summing it to zero — the repo has been bitten before by an aggregate compression ratio standing in for the decisive number (`image-pull-measurement.yml`'s own header says so).

`metered` — **GHCR-to-hosted-runner throughput** is measured on a genuinely cold pull of `ghcr.io/lucent-financial-group/zeta-portal`, an image this org already publishes and this runner has never seen. Its wire size is read from the GHCR manifest, the pull is timed, and the two give MiB/s. The workflow then prints an estimate for our own image that multiplies **two measured numbers and guesses neither** — still a derivation, and labelled as one, because a different image has a different layer count and parallelism profile.

`speculative` until publish — **wall-clock pull time of our own digest.** The artifact is not in a registry until this lands on `main`, so the honest answer today is that it has not been measured. What ships with this change is the instrument: a `pull-measure` job that fires on publish, runs **three legs on three fresh runners**, asserts each runner is cold before timing anything (a warm runner fails the leg rather than reporting a fast pull), and reports every leg so the **worst** is visible. Three samples is not a distribution, but it is the difference between "40 s" and "40 s, 41 s, 380 s", which is the whole question.

**And the cold-runner assertion was itself vacuous when first written — caught by the repo, not by me.** `lint-no-decide-by-grep` refused `docker image ls --format '{{.Repository}}' | grep -q 'zeta-ci-runtime'`: a pipeline's status is the LAST command's, so if `docker image ls` died on a signal it would print nothing, the grep would match nothing, and the "this runner is cold" assertion would **pass having checked nothing** — letting a warm runner report a fast pull into the very measurement this section depends on. Fixed by checking the producer's status first and grepping a file. Worth recording plainly: the measurement built to price the tail nearly shipped with a guard that could not fail, and the thing that caught it was one of this repo's own falsifiers.

Two things that remain structurally true regardless of how the pull times land:

- **Cache-budget relief** (§6.3) — an image pull writes nothing to the Actions cache.
- **Determinism** — a digest resolves to the same bytes forever; `apt-get install` resolves against a mirror that moves under you.

### 6.4a Costed on BOTH runner types — and the second runner type does not currently exist

Everything above prices containerization against **GitHub-hosted** runners. That is the *worse* of the two runner types this org has declared, and the better one is sitting in the tree unused. I was asked to cost both. Checking it first changed the answer twice, so the corrections lead.

#### What is declared

`metered` — `full-ai-cluster/k8s/applications/arc-runner-set/Application.yaml` exists and declares an org-wide Actions Runner Controller scale set:

```
chart: gha-runner-scale-set   targetRevision: 0.12.1
githubConfigUrl: https://github.com/Lucent-Financial-Group
runnerScaleSetName: zeta-self-hosted
minRunners: 1   maxRunners: 6
containerMode: { type: dind }
syncPolicy.automated: { prune: false, selfHeal: true }
```

`metered` — and **nothing routes to it**: 0 workflows name `zeta-self-hosted`, 0 name `self-hosted` at all, across 132 `runs-on` declarations. Control, so the null is real: 75 workflows match `ubuntu-24.04`.

#### CORRECTION 1 — it is not running, and has never run

The framing I was handed was that a warm ARC runner is idling with jobs never routed to it. **It is not idling. It is not there.**

`metered`, GitHub REST API:

```
GET /orgs/Lucent-Financial-Group/actions/runners            -> total_count: 0
GET /orgs/.../actions/runner-groups/1/runners               -> total_count: 0
GET /orgs/.../actions/runner-groups/3/runners               -> total_count: 0
```

**Permission control, because a zero from an endpoint you cannot read is not a zero:** the same token returns `GET /orgs/.../actions/runner-groups -> total_count: 2` and carries `admin:org`. The endpoint works; the zero is real.

`minRunners: 1` means a runner should be **registered and idle at all times** — the manifest's own comment says it exists so "the cadence measurement is not re-imported as cold-start latency". No such runner is visible to GitHub.

**And the reason is already filed.** Open P2 bug `081M0JM6SSG087G0R0029X3F6Z` (2026-08-21) reports that the runner pod mounts PVC `arc-model-cache`, which **nothing applies**: the Application sources a *remote OCI Helm chart*, not its own git directory, so it cannot apply its sibling `model-cache-pvc.yaml`, and the root app-of-apps glob `{*/Application.yaml,Application.yaml}` does not match a bare `model-cache-pvc.yaml` either. Its own words: *"A pod mounting a PVC that does not exist does not start. This is not a future risk; it is the current state whenever the runner set is synced."* `infra/k8s/tests/FULL-AI-CLUSTER-FAILURE-BASELINE.md` separately records `arc-runner-set` among Applications that would not *render* at all until fixes landed on 2026-08-22.

So the three unverified items I was asked to state come back: the app is declared, `selfHeal: true` would keep re-applying it, and **it still is not registered** — which is consistent with the filed defect and is *not* deliberate staging. I cannot see the cluster; I can see that GitHub has no runner.

#### CORRECTION 2 — even running, this manifest would not give a warm layer cache

The premise for costing ARC favourably is that the container layer cache survives between jobs on a persistent node. **That does not follow from this configuration.**

`containerMode: { type: dind }` runs Docker-in-Docker: each runner pod gets its **own dind daemon with its own ephemeral image store**. The layer cache lives in that daemon's data root, and `metered` — the manifest declares exactly **one** volume, `model-cache` at `/home/runner/.cache/models`; there is no `dindVolumeClaimTemplate` and nothing mounted at `/var/lib/docker` (grep count: 0).

So with ARC as declared, **every job would still pay a full pull**, exactly like a hosted runner. Getting the warm-cache benefit needs an additional persistent volume for the dind data root — a change nobody has made, with its own concurrency questions (six runners sharing one image store is not free).

`containerMode: dind` **does** answer the third unverified item favourably: the scale set is *configured* to support job-level `container:` and `docker build`. Configured, not demonstrated — it has never run.

#### The comparison, with each number's provenance

| | GitHub-hosted | ARC `zeta-self-hosted` |
|---|---|---|
| available today | **yes** — every number in §6 measured here | **no** — 0 runners registered, open P2 blocker |
| layer cache between jobs | **no**, fresh VM (`metered`) | **no**, as declared — ephemeral dind store (`metered` from the manifest) |
| can run `container:` jobs | **yes** (`metered` — the proof job ran) | configured for it (`dind`), never exercised |
| Actions cache ceiling | a **GitHub product limit**, not physical | would not apply; needs an in-cluster cache backend that does not exist yet |
| pull source | GHCR over WAN | GHCR over WAN today; an in-cluster registry would change this, and none is deployed |

**The honest conclusion is narrower than the question implied.** Containerization should be costed against hosted runners, because that is the only runner type that exists. The ARC path *could* dominate it — same-cluster registry, persistent dind store, no Actions-cache ceiling — but each of those is a change nobody has made on top of a deployment that is not running.

**And the finding is worth more than the section**, which is why it is written this way: **a declared, self-healing, org-wide runner scale set has been in the tree since at least 2026-08-22 and has never registered a single runner.** Nothing was going to notice, because the thing that would have noticed — a workflow routed to it — does not exist either. That is the `mirror-to-fork.yml` lesson recorded in this same repo, in new clothes: *"an unprovisioned side-effect should be a red run somebody sees, not a green one nobody does."* Here there is no run at all.

**Explicitly out of scope and not done:** migrating any workflow to `zeta-self-hosted`, fixing the PVC, or touching the cluster. That is infrastructure and it is Aaron's call; the blocker already has a work item.

### 6.5 A cost this change accepts and states

The image `COPY . /zeta`s the build context so `install.sh` has the repo it needs, then removes it. That does not shrink the image — the layer remains — and the `rm` is a **correctness** measure, not a size one: without it, a job that forgot to check out would silently read a stale tree that looks exactly like a fresh one. Narrowing the build context to just the install inputs is a measured follow-up, not done here.

---

## 7. Second deliverable: is Nix already close enough to emit the image?

Scoping read only. **No migration to Nix is proposed and none was performed.**

### 7.1 The finding that is independent of containers entirely

`metered`, at `f886e5af16`:

```
flake.nix    present, 239 lines
flake.lock   ABSENT
```

`grep -n "dockerTools\|streamLayeredImage\|buildLayeredImage" flake.nix` → **no matches** (exit 1).

**Already being fixed, independently, by someone else** — PR **#15573**, *"build(nix): commit a flake.lock for the root flake — four of six inputs were floating"*, open at the time of writing. That is a better outcome than this document proposing it: two agents reached the same gap from opposite directions on the same day, which is the kind of independent corroboration the repo's decorrelation argument is actually about. **Recorded, not claimed.** The paragraph below stands as the reasoning; the action is theirs.

**`flake.lock` being absent is the highest-leverage reproducibility gap in the repo, and it has nothing to do with containers.** Without a lock, the flake resolves `nixpkgs` at evaluation time, so the dev shell it produces is a function of *when you ran it*. That is the same mutable-upstream problem `apt` has, in the one part of the tree that exists to not have it. `flake.nix` is referenced by `gate.yml` and `build-ai-cluster-iso.yml`, so this is not a dormant file.

Committing a lock is a small, self-contained change that improves determinism whether or not anything is ever containerized. I did not do it here — it belongs in its own PR with its own evaluation, not smuggled into a container change.

### 7.2 Could `dockerTools.streamLayeredImage` emit the CI image?

**Not today, and the gap is large.** The honest fraction: `flake.nix` builds dev shells, and the toolchain those shells provide is a *subset* of what `tools/setup/` installs. `.mise.toml` alone declares 18 tools at slim tier — including several (`pipx:semgrep`, `pipx:ruff`, `pipx:mypy`, `npm:markdownlint-cli2`, `github:yannh/kubeconform`, `1password-cli`) whose exact pinned versions would each need a nixpkgs pin or an override — and that is before `manifests/apt`'s 149 slim packages, elan/Lean, the dotnet global tools, and the zig / rust-wasm32 realizers. **I did not evaluate the flake** (no Nix on this host), so I cannot state the covered fraction as a number, and I am not going to estimate one.

What is worth recording is the shape, because it composes unusually well with Aaron's layering:

> If Nix emitted the image, **the seed layer becomes "get Nix"**, and everything above it is content-addressed rather than mirror-dependent.

That is a genuinely cleaner seed than a shell script that apt-installs, and it would make byte-level reproducibility *achievable* rather than merely aspirational. It is also a large project that would put a second toolchain definition in the tree during the transition — exactly the failure mode §1 exists to prevent. **Finding, not direction.**

Ordering, if it is ever pursued: (1) commit `flake.lock`; (2) measure what fraction of the declared toolchain the flake actually covers; (3) only then ask about images.

---

## 8. What Aaron must decide

1. **Publish the image at all?** Nothing consumes it until you say so. The build is proven; the cutover is one `container:` line.
2. **`slim` only, or `full` too?** Recommendation: slim only until the pull cost is measured. `full` serves seven low-frequency lanes and would be a much larger artifact.
3. **§4.1 — put the install shields on a schedule?** This is the half that pays for containerizing the portable jobs. Without it, the incidental "install.sh still works on a fresh runner" coverage that 48 install steps provide today goes away with nothing replacing it.
4. **Is `ubuntu-slim` container-capable?** `low-memory` is the highest-value single target measured (298 s mean install against a 15-minute cap, and it deliberately never saves a toolchain cache). Someone with access needs to run `docker version` on that runner class.
5. **`flake.lock` (§7.1)** — already in flight as **#15573**. Nothing to decide unless you want it prioritised.
6. **The `lint-clone-at-tag-is-sufficient.ts` collision.** Its `RESOLVER_INVOCATION` regex matches `ace\s+bootstrap`, and `-` is a word boundary — so the phrase **"pre-ace bootstrap"**, which is now the repo's own name for the seed layer, reads as a resolver invocation on any non-comment line of a bootstrap surface. I hit this and worked around it by rewording a step name rather than weakening the lint. The vocabulary and the guard now collide; that is worth a decision rather than a series of quiet rewordings.
7. **The ARC runner scale set is declared and has never run** (§6.4a). `zeta-self-hosted` is org-wide, self-healing, `minRunners: 1` — and **0 runners are registered with GitHub**, blocked by an already-filed P2 (`081M0JM6SSG087G0R0029X3F6Z`: the runner pod mounts a PVC nothing applies). Separately, as declared it would **not** give a warm layer cache: `containerMode: dind` with no persistent docker data root means every job still pays a full pull. Whether to fix and adopt it is infrastructure and yours; nothing here touches it.
8. **A wall-clock ratio assertion sits in the blocking floor** (§6.4). `build-and-test (ubuntu-24.04)` fails at **12.7%** (17/134 executed runs) — **17× the demoted macOS leg's 0.75%** — and at least one contributor is a SIMD speedup test that asserts `>= 1.5x` measured wall time. It went red on a YAML-only change during this work. Options: skip it under contention, move it to a benchmark lane, or accept the rate. Not fixed here; not my file.
9. **Two apt audits classify by string, one by structure — for the cache lane's owner.** Adding this workflow turned three audits red, and the three behaved differently in a way worth recording:

   | audit | how it decided this job was in scope | verdict |
   |---|---|---|
   | `apt-archive-cache.ts` | any line of the job body containing `tools/setup/install.sh` — **step names included** | false positive |
   | `audit-install-tier-declared.ts` | same | false positive |
   | `audit-apt-budget-fits-job-timeout.ts` | follows the `dockerfiles/*/Dockerfile` reference in the `run:` block, **reads the Dockerfile**, finds the installer inside it, and correctly sets `kind = "local"` because `docker build` passes no `GITHUB_ACTIONS` into the container | **correct** |

   The third one is a genuinely good detector and it was right about this job, so it got the sanctioned treatment: an entry in `apt-job-timings.measured.json`'s `unmeasured` list carrying the real measurement (181 s cold build against a 2700 s cap).

   The first two matched a **step name**. Their own header says the regex is applied to `run:` invocations; it is applied to the whole job body. The correct fix here was a step name that does not restate a path this step never invokes — **not** an inert cache step (the runner's apt archives are invisible to a `docker build`; restoring them would be the vacuity class exactly) and **not** a lint exemption. But as more jobs become containerized, "mentions the installer" and "runs the installer on this runner" diverge further, and the third audit already shows what the right predicate looks like. Not fixed here — it is the cache lane's file and I stayed off it.

---

## 9. What I could not verify

Stated so a green here is not read as coverage it does not have:

- **The exit-124 reports.** Not reproduced in my 105-step sample (§6.2), and the tree records 17 such deaths in one window on 2026-08-25 (`apt-archive-cache.ts`). Both facts are kept in §6.4; neither cancels the other, and the 0/105 does **not** exclude the tail.
- **Wall-clock pull of our own digest.** Not measurable before publish — the artifact is not in a registry yet. What is now measured: the **exact wire size** (local-registry manifest, not a ratio) and **GHCR-to-runner throughput** on a real cold pull (§6.4). What ships: `pull-measure`, three cold legs on three fresh runners against the published digest, each asserting the runner is cold before timing. `speculative` until it fires; the worst leg is what gets quoted.
- **Variance of the pull.** Three legs is not a distribution. It distinguishes "40 s every time" from "40 s, 41 s, 380 s", which is the question, but it will not give a real p95. If the pull turns out to matter, `image-pull-measurement.yml` is the instrument for a proper sample.
- **Whether `ubuntu-slim` has a container runtime.**
- **Whether CodeQL's action tolerates a job-level `container:`.**
- **The state of the cluster itself.** I can see that GitHub has **no registered runner** and that a P2 explains why; I cannot see whether the cluster is up, whether ArgoCD reports the app healthy, or whether `selfHeal` is looping. An `Application.yaml` in the tree is not proof of a deployment, and my zero is evidence about *GitHub's* view, not about Kubernetes'.
- **That ARC could host `container:` jobs in practice.** `containerMode: dind` is the right configuration for it; it has never executed a job, so this is configured-not-demonstrated.
- **The "~69 GiB/hour of writes against a 9.31 GiB ceiling, 23 GiB evicted in 61-second sweeps, 80% of evicted bytes never read" cache figures** I was handed. I measured the *standing* number instead (22.34 GB active across 40 caches, §6.3). The rate figures are another agent's lane and I did not re-derive them.
- **The covered fraction of `flake.nix`** (§7.2). No Nix on this host.
- **`markdownlint` on this file.** `.markdownlint-cli2.jsonc` excludes `docs/research/2026-*-*.md`, so an rc=0 from it here would be a check that did not run, and is not quoted as a pass.

---

## 10. Anchors (Beacon)

- **Hermetic builds / reproducible builds** — Bazel's hermeticity model and the Reproducible Builds project (Lamb & Zacchiroli, *Reproducible Builds: Increasing the Integrity of Software Supply Chains*, IEEE Software 2022) are the tradition this sits in. The claim taken from it here is narrow and the one that is actually true of apt-based images: **hermeticity is a property of dependency resolution, not of the isolation boundary.**
- **Content-addressed package management** — Dolstra, *The Purely Functional Software Deployment Model* (PhD, 2006), and Dolstra & Löh, *NixOS: A Purely Functional Linux Distribution* (ICFP 2008). This is the anchor for §7's claim that Nix/Guix deliver what a container runtime cannot.
- **Supply-chain pinning by digest** — SLSA, and Sigstore/cosign keyless signing (Newman, Meyers, Torres-Arias et al., *Sigstore: Software Signing for Everybody*, CCS 2022). The repo already practises both in `build-platform-images.yml`; this reuses that path rather than inventing a second one.
- **Exit as the discriminator** — Hirschman, *Exit, Voice, and Loyalty* (1970), via `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`. It is why the image must remain an accelerant over a `git clone`-at-a-tag path and never a replacement for it: a registry you *must* route through is a hub, however convenient.

---

## 11. Pointers

- `src/Core.TypeScript/ci/dockerfiles/ci-runtime/Dockerfile` — the materialization. Two layers, four package names, no third definition.
- `src/Core.TypeScript/ci/toolchain-manifest.ts` (+ `.test.ts`) — the drift check and its 16 falsifiers.
- `.github/workflows/ci-runtime-image.yml` — build, the one-job proof with its negative control, the drift check, and the digest-pinned publish.
- `src/Core.TypeScript/ci/dockerfiles/ubuntu-install-sh-test/Dockerfile` — the prior art this is one change away from.
- `.github/workflows/build-platform-images.yml` — the proven GHCR publish + cosign path, reused verbatim in shape.
- `.github/workflows/image-pull-measurement.yml` — the instrument for §6.4's missing number.
- `GOVERNANCE.md` §24 — one install script, and why the image is its output rather than another mouth on it.
- `.claude/rules/clone-at-tag-stays-sufficient.md` · `src/Core.TypeScript/hygiene/lint-clone-at-tag-is-sufficient.ts` — the guard this design is checked against (and §8.6's collision with it).
- `.claude/rules/no-binary-in-proof-lineage.md` — *the thing under test is not evidence*, the rule §3.2's third row is an instance of.
- `workitems/081M0BVAV2H087G0R000VXRYRQ-decide-whether-the-windows-build-and-test-legs-should-block.md` · `workitems/done/2026/08/081M0CPEH40087G0R0016GDSB6-make-the-macos-build-and-test-leg-non-blocking-floor-amendme.md` — the demotion precedent this rule generalises.
- `docs/DECISIONS/2026-07-09-drift-and-heal-replaces-pre-merge-gates-reconciliation-at-ai-speed.md` · `registry/uncompensatable-floor.yaml` — blocking vs drift, and the floor as data.
