# Nightly Cross-Platform Workflow — Design Proposal

**Status:** SUPERSEDED 2026-04-24. The factory decided
against a nightly scheduled cross-platform workflow:
standard GitHub-hosted runners are free for public
repositories, so the macOS-pricing concern that drove
the "scheduled, not per-PR" design no longer applies.
`gate.yml` runs the full active matrix per-PR (macos-26,
ubuntu-24.04, ubuntu-24.04-arm, ubuntu-slim
experimental) with Windows deferred to the peer-agent
milestone. See the CI matrix PR
[Lucent-Financial-Group/Zeta#375](https://github.com/Lucent-Financial-Group/Zeta/pull/375).
This doc is preserved for the reasoning trail; do not
revive it without re-evaluating the free-runner-for-
public-repos pricing context.

**Original status:** research-grade proposal (pre-v1). Scope:
design-only — no workflow file lands with this doc; the
shape exists on paper so the human maintainer (or
next-tick sign-off) can approve before anything touches
`.github/workflows/`. Authored by the architect role after
a macOS-enablement directive, a pricing-verification round,
and an "invert the cost risk" follow-up from the autonomous
loop.

## 1. Why this doc

The factory needs cross-platform build confidence (Linux +
Windows + macOS + WSL) per FACTORY-HYGIENE row #51. Current
CI runs only `ubuntu-22.04` on pull_request; the macOS
matrix leg is gated to contributor forks via the
`github.repository ==` conditional in `gate.yml` line 77.

Two competing pressures:

1. A prior maintainer directive (still cited in the
   workflow comment block): *"Mac is very very expensive
   to run."*
2. A later maintainer directive: *"we can enable mac
   everywhere now, since its no cost for open source
   projects if you are absoutly sure."*

A subsequent verification pass attempted to resolve the
contradiction but found genuine doc ambiguity (macOS-14
classified as a standard runner per
`about-github-hosted-runners`, but the billing page lists
macOS at $0.062/min in the same table as Linux/Windows
without marking that rate public-repo-private-only). That
pass declined the "everywhere" enablement and preserved
fork-only gating.

This proposal offers a **third path**: keep PR gate
Linux-only (unambiguously free), add a **nightly
cross-platform sweep** workflow that exercises macOS +
Windows on a cron schedule. This inverts the cost risk —
even in the worst case where docs are wrong and macOS is
billed on public repos, nightly cadence caps exposure at
~$30/month/repo instead of scaling with PR activity.

## 2. Cost model (transparent)

Four billing scenarios, capped worst-case assumed:

| Runner        | Public-repo (best case) | Public-repo (worst case) | Private-repo rate |
|---------------|-------------------------|--------------------------|-------------------|
| `ubuntu-22.04` | Free                    | Free                     | $0.002–0.006/min (1× multiplier) |
| `windows-latest` | Free (standard runner) | Free                    | $0.010/min (2× multiplier) |
| `macos-14`    | **Free (if standard)**  | **$0.062/min (if billed)** | $0.062/min (10× multiplier) |

Under the "worst case" interpretation (macOS billed on
public):

- PR-gate matrix (every PR × macOS leg): ~10-15 min ×
  $0.062 × N-PRs-per-day — unbounded cost scaling. **Bad.**
- Nightly matrix (once per 24h × macOS leg): ~10-15 min ×
  $0.062 = ~$0.93/day = **~$28/month/repo**. Predictable.

Under best case (macOS standard-runner-free-for-public):
both scenarios cost $0. Nightly still preferable because
fewer total CI minutes consumed overall.

**Asymmetric conclusion:** nightly cadence wins either way.
The workflow ships the "expensive interpretation is
possible" hedge without paying for it in the "free
interpretation is correct" universe.

## 3. Workflow design

```text
.github/workflows/nightly-cross-platform.yml
```

```yaml
name: nightly-cross-platform

# Cross-platform build confidence on a daily cadence.
# PR-gate workflow (gate.yml) stays Linux-only — unambiguously
# free on public repos. This workflow adds Windows + macOS
# coverage at controlled cost.
#
# Cost model (design-time analysis):
#   - windows-latest: standard runner, free on public repos
#   - macos-14: ambiguous per docs (standard by type;
#     billed per pricing table). Worst-case ~$28/month per
#     repo under this cadence (15 min * $0.062 * 30 days).
#     Best-case $0. Either way, cadence caps exposure.
#
# Rollback path: delete macos-14 from the matrix, leave
# windows-latest. One-line revert.
#
# Safe-pattern compliance (FACTORY-HYGIENE row #43):
#   - SHA-pinned action versions.
#   - Explicit minimal permissions.
#   - concurrency group + cancel-in-progress: true (nightly
#     only; cancelling in-progress run on re-trigger is safe).
#   - runs-on pinned per matrix leg, not -latest aliases, so
#     behavior is stable across GitHub runner rotations.

on:
  schedule:
    - cron: '7 9 * * *'  # 09:07 UTC daily (off the hour to dodge thundering herd)
  workflow_dispatch:      # manual trigger for on-demand runs
  pull_request:
    paths:
      - '.github/workflows/nightly-cross-platform.yml'
    # ^ only run on PR when this workflow itself changes;
    #   prevents arbitrary PRs from burning the cross-
    #   platform budget.

permissions:
  contents: read

concurrency:
  group: nightly-cross-platform-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-test:
    name: build-and-test (${{ matrix.os }})
    timeout-minutes: 60
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-22.04, windows-2022, macos-14]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout
        uses: actions/checkout@<SHA-pin>  # matches gate.yml's pin at landing time

      # Same cache shape as gate.yml — keeps nightly warm-hit the
      # canonical cache namespace and avoids a second cache pool:
      - name: Cache .NET SDK
        uses: actions/cache@<SHA-pin>
        with:
          path: ~/.dotnet
          key: dotnet-${{ runner.os }}-${{ hashFiles('global.json', 'tools/setup/common/dotnet.sh') }}

      - name: Cache mise runtimes
        uses: actions/cache@<SHA-pin>
        with:
          path: |
            ~/.local/share/mise
            ~/.cache/mise
          key: mise-${{ runner.os }}-${{ hashFiles('.mise.toml') }}

      - name: Cache NuGet packages
        uses: actions/cache@<SHA-pin>
        with:
          path: |
            ~/.nuget/packages
            ~/.local/share/NuGet
          key: nuget-${{ runner.os }}-${{ hashFiles('Directory.Packages.props') }}

      # Three-way-parity installer (GOVERNANCE §24). Single source of
      # truth for toolchain state across dev-laptop / CI / devcontainer.
      # shellenv.sh writes BASH_ENV into $GITHUB_ENV so every subsequent
      # bash `run:` step auto-sources the managed shellenv file.
      - name: Install toolchain via three-way-parity script
        run: ./tools/setup/install.sh

      - name: Build (0 Warning(s) / 0 Error(s) required)
        run: dotnet build Zeta.sln -c Release

      - name: Test
        run: dotnet test Zeta.sln -c Release --no-build --logger "trx;LogFileName=test-results-${{ matrix.os }}.trx"

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@<SHA-pin>
        with:
          name: test-results-${{ matrix.os }}
          path: '**/test-results-*.trx'
          retention-days: 7
```

The installer pattern above matches `.github/workflows/gate.yml`
exactly — same cache keys, same `./tools/setup/install.sh`
invocation, same build + test steps — so this workflow is
implementable without rework when Phase 2 lands the YAML.
Windows in the matrix is blocked on `tools/setup/install.sh`
growing Windows support (tracked in `docs/BACKLOG.md` under
the "Windows matrix in CI" row); until then the `windows-2022`
leg of this matrix is deferred and only `ubuntu-22.04` +
`macos-14` ship in the first cut.

Notable design choices:

- **`cron: '7 9 * * *'`** — 09:07 UTC daily. Deliberately
  off-the-hour (not `0 9 * * *`, not midnight `0 0 * * *`)
  because GitHub's scheduler sees a stampede of jobs at
  round-hour times; the `:07`-past-the-hour offset
  matches the factory's sibling scheduled workflow
  (`github-settings-drift.yml` fires at `17 14 * * 1`)
  and aligns with early-morning US-East times for
  investigation-friendly alert timing.
- **`workflow_dispatch`** — manual trigger for on-demand
  verification without waiting for the nightly tick.
- **`pull_request` path filter** — workflow only runs on
  PRs that touch the workflow file itself. Prevents
  arbitrary PRs from triggering the cross-platform matrix
  and burning the budget.
- **`concurrency: cancel-in-progress: true`** — if two
  scheduled runs queue up (e.g. nightly + manual dispatch
  within minutes), the older one is cancelled. Opposite
  of PR-gate's `cancel-in-progress: false` because PR
  runs must complete for merge decisions; nightly runs
  can safely be superseded.
- **`timeout-minutes: 60`** — macOS is ~2× slower than
  Linux for .NET builds; 60 min headroom.
- **Test results as artifacts** — 7-day retention.
  Consumed by follow-up workflows (e.g. a weekly
  digest emitter) or manually fetched for triage.
- **No auto-alerting** — first cut is observation-only.
  If a cross-platform regression lands, the nightly run
  fails quietly and the next PR-author / weekly-triage
  sweeper notices. Alerting can be added later (a
  workflow that opens an issue on red).

## 4. Not included (deliberately)

- **No `issues: write` permission.** First version is
  observation-only; issue-opening on red is a later
  enhancement.
- **No CodeQL / Semgrep legs.** The `gate.yml` PR-gate
  runs those on Linux; cross-platform coverage for
  static analysis is unnecessary (the tools run on
  one host and analyse source-independent-of-target-
  platform).
- **No submit-nuget / markdown-lint legs.** Those are
  PR-gate concerns, not cross-platform concerns.
- **No matrix branch for `windows-2019` or
  `macos-13`.** Older-OS support can be added when
  someone requests it; first cut is current-supported-
  OS-only.
- **No Linux-arm64 leg.** Additive later if we need
  arm64 validation; first cut is x64-only to keep the
  matrix small.

## 5. Rollback paths

- **Pure cost rollback:** delete `macos-14` from the
  matrix, leaving `ubuntu-22.04` + `windows-2022`. One-
  line diff, zero-risk.
- **Full disable rollback:** delete or rename the
  workflow file (GitHub stops scheduling it).
  Scheduled-trigger history is preserved in the Actions
  tab.
- **Permanent disable via deletion:** factory-hygiene
  row #51's detect-only cross-platform audit continues
  functioning as before; removal of this workflow does
  not leave the factory in a worse state than before.

## 6. Interaction with `gate.yml`

No change to `gate.yml`. PR gate stays
`ubuntu-22.04`-only. The nightly workflow is **additive**,
not replacement.

`gate.yml` line 77 conditional matrix expression (the
`github.repository ==` gating) remains correct under
this proposal:

- On canonical repo: PR-gate matrix = `[ubuntu-22.04]`
  (free); nightly matrix = `[ubuntu-22.04, windows-2022,
  macos-14]` (free + free + uncertain).
- On contributor forks: PR-gate matrix already includes
  `macos-14` per the existing fallthrough; nightly
  workflow runs on the fork too, which may result in
  billing against the fork owner's personal plan minutes.
  **Consideration:** consider adding
  `if: github.repository == 'Lucent-Financial-Group/Zeta'`
  to the nightly job to prevent the cron from firing on
  every fork. See §7.

## 7. Fork scoping

**GitHub's actual default:** scheduled workflows do **not**
fire on forks without explicit maintainer action. When a
repo is forked, GitHub disables all scheduled workflows on
the fork until the fork owner goes into the Actions tab
and manually enables them (per GitHub's *"Events that
trigger workflows — schedule"* documentation: *"The
schedule event only runs the workflow's default branch.
Running a workflow on a schedule will not work on forked
repositories unless the workflow has been enabled on the
fork."*). This matches the behavior of the repo's other
scheduled workflow, `.github/workflows/github-settings-drift.yml`
— which runs `cron: "17 14 * * 1"` with no fork-scoping
guard and causes no fork-runner billing precisely because
GitHub skips the schedule on forks by default.

Given that default, the `if: github.repository == ...`
guard on the job is **not** required for cost safety on
contributor forks. The scheduled trigger will not fire on
a fork until a fork owner opts in; `workflow_dispatch` and
`pull_request`-on-workflow-file already require explicit
user action anyway.

The guard is still useful for one narrow case — if a
fork owner *does* opt in to the schedule (e.g. to validate
a cross-platform change on their own fork before opening
a PR), it keeps the schedule from silently consuming the
fork owner's minutes on our cadence rather than theirs.
That's a weak-positive, not a blocker; the §7 guard is
**optional hygiene**, not a cost-safety requirement:

```yaml
jobs:
  build-and-test:
    if: github.repository == 'Lucent-Financial-Group/Zeta' || github.event_name == 'workflow_dispatch' || github.event_name == 'pull_request'
    ...
```

This evaluates true on:

- Canonical repo (any trigger)
- Any repo under manual dispatch (forks can opt in)
- Any repo under PR trigger to the workflow file
  (changes to the workflow itself get tested)

And false on:

- Scheduled trigger when run in a fork that has opted
  the workflow in (the rare case above).

One line; keeps the same workflow file byte-identical
everywhere; runtime gates the opt-in-scheduled firing
on forks as a courtesy to fork owners.

## 8. Apply to `lucent-ksk` too

Per the maintainer-granted rewrite authority on `lucent-ksk`
and same-policy-applies directives: when this lands on Zeta,
a parallel PR lands on `Lucent-Financial-Group/lucent-ksk`
with the identical workflow. Cross-repo coordination
expectations:

- Same workflow file shape (byte-identical if possible;
  repo-name substitution on the `if:` gate).
- Same cron time (`7 9 * * *`) so both repos' nightly
  runs land in the same operational window.
- Prior-contributor attribution preserved in the cross-repo
  commit message per the repo's upstream-credit norm.

## 9. Phased rollout

- **Phase 0 (now):** this design doc, no workflow file.
- **Phase 1:** the human maintainer signs off (or
  explicitly declines) on the cost tradeoff + fork-scoping
  choice.
- **Phase 2 (on sign-off):** land the workflow on Zeta
  with macOS in the matrix. First nightly run fires next
  day.
- **Phase 3:** observe first 7 nightly runs. If macOS
  leg reveals real cross-platform bugs, the ~$28/month
  worst-case cost is paid-for. If no divergence, consider
  dropping `macos-14` from the matrix at Phase 4.
- **Phase 4 (decision point after 30 days):**
  - If useful signal: land same workflow on
    `lucent-ksk`.
  - If low signal + worst-case billing holding: drop
    macOS from matrix; keep Windows.
  - If best-case billing confirmed (no bill seen): expand
    matrix to include more permutations (macos-13,
    windows-2019).

## 10. Cross-references

- `docs/FACTORY-HYGIENE.md` row #51 — cross-platform
  parity audit. This workflow is what unblocks the
  "Enforcement deferred" language toward `--enforce`
  mode.
- `docs/BACKLOG.md` — the Windows-matrix / CI-parity-swap
  cluster (grep for "Windows matrix in CI" and "Parity
  swap: CI's `actions/setup-dotnet`") tracks the path
  from current Linux-only PR gate toward a broader CI
  matrix once the install script grows Windows support.
  This workflow is the alternative path that delivers
  macOS + Windows signal at controlled cost without
  gating every PR on them.
- `docs/research/test-classification.md` (PR #339) —
  category-3 statistical smoke tests also live on
  nightly; this workflow could be the home for those
  when they graduate.
- `.github/workflows/gate.yml` — PR-gate workflow;
  untouched by this proposal.
- Cross-repo rewrite authority on `lucent-ksk`: a prior
  maintainer directive grants the agent team authority to
  rewrite cross-repo scaffolding without per-change
  pre-coordination, as long as prior-contributor
  attribution is preserved in commit messages. That
  directive is what makes the parallel `lucent-ksk`
  landing in §8 tractable without a blocking review
  from the initial-starting-point contributor on
  that repo.

## 11. What this doc does NOT do

- Does **not** ship the workflow file. Pure design; Phase
  2 lands the YAML after sign-off.
- Does **not** touch `gate.yml`. PR-gate stays
  unambiguous.
- Does **not** enable macOS enforcement in the FACTORY-
  HYGIENE audit. Enforcement mode switch is a separate
  follow-up once green across the matrix for N
  consecutive runs.
- Does **not** resolve the docs ambiguity about macOS
  billing. If the ambiguity resolves either way later,
  this design still holds (nightly cadence works best-
  case and worst-case alike).
- Does **not** obligate landing on `lucent-ksk`
  simultaneously. Phase 4 gates that on observed signal
  from Zeta first.
- Does **not** adopt a specific monthly-cost cap as a
  binding factory rule. The ~$28/month/repo worst case
  is a planning number, not a committed spend; the human
  maintainer's direction on budget discipline remains
  authoritative.
