---
name: Standard GitHub-hosted runners are FREE for public repositories — ALL of them (ubuntu, ubuntu-arm, macos incl macos-26 + Apple Silicon, windows, windows-arm, ubuntu-slim). Only "larger runners" and private-repo-runners are billed. Zeta is public since 2026-04-21 LFG transfer — standard runners cost $0. I have drifted on this at least 5 times per Aaron's count; pricing-table-vs-standard-runner-class ambiguity in GitHub docs keeps catching me. AUTHORITATIVE SOURCE: https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories . Aaron Otto-249 2026-04-24 "here is the page of free standard runners AGAIN for the 5th time to prove it's free"
description: Aaron Otto-249 5th correction: I keep treating macOS CI runners as "maybe billed" based on GitHub's pricing table (which shows per-minute rates), not realizing that table applies to PRIVATE repos or LARGER-runner tiers. For STANDARD runners on PUBLIC repos, ALL are free — including macos, macos-arm, windows, windows-arm. Zeta is public; this applies. Save as durable memory to stop the drift.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The rule

**Standard GitHub-hosted runners are 100% FREE for public
repositories. All of them. No exceptions.**

Direct Aaron quote (5th correction):

> *"here is the page of free standard runners AGAIN for the
> 5th time to prove it's free"*

Authoritative source (the one Aaron cited):
<https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories>

## What "standard" means and what's excluded

**Standard runners** (per that official page, as of 2026-04-24):

| Label | OS / arch | Free on public? |
|---|---|---|
| `ubuntu-latest`, `ubuntu-24.04`, `ubuntu-22.04` | Ubuntu x64 | **YES** |
| `ubuntu-24.04-arm`, `ubuntu-22.04-arm` | Ubuntu arm64 | **YES** |
| `ubuntu-slim` | Ubuntu x64 (1 CPU / 5 GB / 15-min timeout) | **YES** |
| `macos-latest`, `macos-26`, `macos-15`, `macos-14` | macOS Apple Silicon | **YES** |
| `macos-26-intel`, `macos-15-intel` | macOS Intel | **YES** |
| `windows-latest`, `windows-2025`, `windows-2025-vs2026`, `windows-2022` | Windows Server x64 | **YES** |
| `windows-11-arm` | Windows 11 arm64 | **YES** |

**What IS billed** (so I stop conflating):

- **Larger runners** — explicitly named with suffixes like
  `macos-latest-xlarge`, `ubuntu-latest-8-cores`,
  `windows-latest-16-cores`. These are opt-in paid tiers.
- **Private repositories** — standard runners are billed
  per minute with multipliers (Linux 1×, Windows 2×,
  macOS 10×). **Zeta is PUBLIC**, so this does not apply.
- **Self-hosted runners** — user-owned infra, out of scope.

## Why I keep drifting on this

GitHub's billing page displays a per-minute rate table
that includes macOS at $0.062/min. Reading that table
in isolation, without the "for private repositories or
larger runners" context, produces the wrong conclusion.

The public-repo-free-for-standard note is on a DIFFERENT
page (the runners reference) — not on the billing page.
Cross-page context is needed to avoid the drift.

**Mitigation for future-me**: when verifying a runner's
cost, go to the runners reference page FIRST
(`/actions/reference/runners/github-hosted-runners`), not
the billing page. If the runner is in the "Standard
GitHub-hosted runners for public repositories" section,
it is free on this repo. Full stop. No need to cross-
reference the pricing table.

## Specific drifts corrected 2026-04-24

1. **Otto-161 decline in PR #343** — I declined the
   "enable macOS everywhere" directive citing macOS as
   $0.062/min. Wrong. Reopened #343 with correction 2026-
   04-24.
2. **nightly-cross-platform.yml pricing comment** — the
   original workflow file carried a cost-hedge comment
   about macOS being expensive. Removed in PR #375 once I
   understood the free-for-public-repo rule.
3. **gate.yml fork/LFG matrix split** — the conditional
   keeping macOS off LFG "for cost" was based on the
   same wrong premise. Also addressed in PR #375.
4. (Earlier drifts captured by Aaron pre-dating this
   session; he's now at 5 total corrections.)

## What this memory does NOT say

- Does NOT claim *larger* runners are free. They're
  explicitly paid.
- Does NOT claim standard runners are free on *private*
  repos. They're billed with OS multipliers.
- Does NOT authorize unbounded CI cost. Public-repo-free
  applies; larger-runner opt-ins are a separate decision.
- Does NOT exempt me from the Otto-247 version-currency
  rule. Any runner-label claim still needs verification
  via `gh api .../releases` or official docs.

## Direct Aaron quote to preserve

> *"the no-cost claim does NOT apply to macOS runners.
> it does directly apply to macOS runners"*
>
> *"here is the page of free standard runners AGAIN for
> the 5th time to prove it's free"*
>
> URL cited:
> https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories

Future Otto: **stop drifting on this. Standard runners.
Public repo. Free. All of them. Including macOS. Including
arm. Including Windows. Including ubuntu-slim.** If you
catch yourself about to write "macOS might be billed," stop
and reread the URL above. The fifth correction is the one
that sticks.
