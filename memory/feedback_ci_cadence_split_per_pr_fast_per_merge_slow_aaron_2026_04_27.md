---
name: CI cadence split — per-PR fast (lint + Linux build) / per-merge slow (Analyze matrix + macOS + Windows experimental) per maintainer 2026-04-27
description: Maintainer 2026-04-27 reframe of CI gating — keep PR cycles fast (~3-5 min total) by moving slow checks (Analyze csharp/python/javascript-typescript/actions matrix + macos-26 build-and-test + Windows experimental legs) to per-push-to-main / schedule / workflow_dispatch. Same pattern as the existing low-memory.yml. Drift on slow legs detected post-merge instead of pre-merge; revert-on-break is the mitigation. Standard GitHub-hosted runners are free for public repos so per-merge runs have no cost downside. Composes with the three-way-parity invariant (gate.yml dynamic matrix-setup keeps the cadence policy in one place) and the Windows peer-mode milestone (Windows legs seed now, peer-agent polishes later).
type: feedback
---

# CI cadence split — per-PR fast / per-merge slow (Aaron 2026-04-27)

## Verbatim quotes (Aaron 2026-04-27)

After Otto reported a 25-min Analyze (csharp) bottleneck on PR #651:

> "if so we need to move to a per push to main/merge to main like the low memory, per pr is too much? We just need some cadens of checking those and the low memovery every so often for issue and fixing them."

Then on the macOS leg:

> "we can move this one to a mac per pr too to be honest, it's just testing our mac support for devloper experience not prod code build-and-test macos-26"

Plus a clarifying follow-up (had said "per pr" the first time, meant the inverse):

> "macos-26  i was trying to say per push to main / merge main, i didn't say it right the frist time i said per pr, hope you understood"

Plus the Windows seeding:

> "we might as well got ahead and start the windows one as a per push to main too/merge to main, you can start slowly building that out befroe i get my windows laptop running the peer-mode agent, windows will be mostly raeady and they can just clean it up. not rush on this."

## The cadence

**Per-PR (fast — target ~3-5 min wall clock, gates merge):**

- Path gate (with empty-SARIF baseline upload satisfying aggregate `CodeQL`)
- Lint matrix (semgrep, shellcheck, actionlint, markdownlint)
- `build-and-test (ubuntu-24.04)` + `build-and-test (ubuntu-24.04-arm)` — production build path
- Memory + path-existence lints

**Per-merge (slow, runs on push-to-main / schedule / workflow_dispatch — does NOT gate PR merge):**

- `Analyze (csharp)` — 10-25 min, was the per-PR bottleneck
- `Analyze (python / javascript-typescript / actions)` — 2-5 min each
- `build-and-test (macos-26)` — developer-experience verification, not prod (~5-8 min)
- `build-and-test (windows-2025)` + `build-and-test (windows-11-arm)` — experimental, `continue-on-error: true` (no `tools/setup/install.ps1` yet; peer-agent will polish). Aaron 2026-04-27: *"failures on the windows mode for now are fine untill we pass have the agent running on windows in peer-mode then we will want that working all the time"* — flip `continue-on-error` to `false` once the Windows peer-mode agent is online and `tools/setup/install.ps1` is mature enough that the legs land green.
- `low-memory.yml` (`build-and-test ubuntu-slim`) — per the prior 2026-04-27 cadence move

## Trade-off (acknowledged)

- **Pro:** PR landing speed dramatically improves. The 25-min bottleneck on `Analyze (csharp)` no longer gates each PR; only the ~3-min Linux build does.
- **Pro:** GitHub billing reduced (less CI minutes per PR), though standard runners are free for public repos so this is mostly moot for Zeta today.
- **Con:** Drift on slow legs is detected post-merge, not pre-merge.
- **Mitigation:** per-merge cadence catches drift quickly (within one merge); nightly schedule backstops weekend / missed-merge gaps; revert-on-break is the response. Same pattern `low-memory.yml` uses.

## Implementation

`.github/workflows/gate.yml`:
- New `matrix-setup` job emits dynamic OS list per `github.event_name`:
  - `pull_request` → `["ubuntu-24.04","ubuntu-24.04-arm"]`
  - all other events → `["ubuntu-24.04","ubuntu-24.04-arm","macos-26","windows-2025","windows-11-arm"]`
- `build-and-test` job depends on `matrix-setup` and reads its OS list via `fromJson`.
- `continue-on-error: ${{ startsWith(matrix.os, 'windows-') }}` makes Windows non-blocking.

`.github/workflows/codeql.yml`:
- `analyze` matrix gated with `if: github.event_name != 'pull_request' && needs.path-gate.outputs.code_changed == 'true'`.
- `path-gate` keeps running on every event; its empty-SARIF baseline uploads satisfy the aggregate `CodeQL` check on PRs without running the slow matrix.

## Composes with

- `low-memory.yml` already uses the per-merge + nightly + workflow_dispatch trigger pattern; this commit extends it to Analyze + macOS + Windows.
- The three-way-parity invariant (GOVERNANCE §24) — install path stays the same; only the cadence of running it changes.
- The Windows peer-mode milestone — this commit seeds the Windows legs in CI so when Aaron's Windows peer-agent comes online the infrastructure is mostly-ready.

## What this rule does NOT mean

- Does NOT mean "slow checks are skipped" — they still run on every merge + nightly + on-demand.
- Does NOT mean "PR feedback is silent on slow-check failures" — drift surfaces in main's CI history within minutes of merge; revert-on-break is fast.
- Does NOT remove Linux build-and-test from PR — the production build path (Linux x64 + arm64) still gates each PR. macOS/Windows are dev-experience and peer-mode legs.
