---
id: 081KR50HA0008QG0R002NZENZJ
priority: P3
status: open
title: MVP Operational Resonance Dashboard — first working "are things going as expected?" surface on GitHub Pages with tier grouping
tier: engineering
effort: L
ask: decomposition of 081KQ0YZ80008QG0R0003GAYYN
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, 081KR50HA0008QG0R003BM7FNK]
composes_with: [081KQ0YZ80008QG0R0003GAYYN, 081KR50HA0008QG0R002DR44J1, 081KR50HA0008QG0R000TQKYGM, 081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, 081KR50HA0008QG0R003BM7FNK, 081KR50HA0008QG0R001DX165X, 081KR50HA0008QG0R0019KYAAS]
parent: 081KQ0YZ80008QG0R0003GAYYN
tags: [frontier, mvp, dashboard, github-pages, tier-aware, operational-resonance, bulk-alignment]
type: feature
---

# 081KR50HA0008QG0R002NZENZJ — MVP Operational Resonance Dashboard surface

## What

Build the first working page of the Operational Resonance Dashboard
deployed to GitHub Pages that answers "are things going as expected?"

This is the **minimum viable surface** — the first delivery that
creates actual value for maintainers. It must satisfy the primary
metric (081KR50HA0008QG0R00223YZP8) and use the tier-aware grouping model (081KR50HA0008QG0R003BM7FNK).

### MVP surface requirements

**1. Factory status overview** (the primary "are things OK?" signal)

Real-time-as-possible signals (fetched client-side, git-native):

- Open PRs by status (CI green / CI failing / BLOCKED / draft)
- Active claim branches (count, age of oldest)
- Backlog health (open P0/P1 count, newly-closed items)
- Last tick timestamp (from latest tick shard in
  `docs/hygiene-history/ticks/`)
- Alignment audit status (from latest alignment-auditor output)

Each signal is one of: ✓ (expected) / ⚠ (degraded) / ✗ (unexpected).
The page answers the question in <5 seconds of scanning — pre-attentive
processing design per 081KR50HA0008QG0R000TQKYGM research scope.

**2. Tier-grouped review surface** (per 081KR50HA0008QG0R003BM7FNK model)

Shows pending review items grouped by tier:

- Tier 0 (mechanical): auto-merge ready, no reviewer attention needed
- Tier 1 (structured): fast-scan cards, bulk-approve button
- Tier 2 (judgment): individual cards requiring attention
- Tier 3 (architectural): flagged, requires explicit sign-off

Data source: GitHub API (authenticated client-side via GH token in
localStorage, OR public API for public repos, OR pre-generated JSON
committed to the repo on a cadence).

**3. Basic experiment wiring** (connects to 081KR50HA0008QG0R001DX165X infrastructure)

- Wire the first experiment: variant A (current layout) vs
  variant B (reordered tier groups)
- Capture time-to-answer proxy events per 081KR50HA0008QG0R00223YZP8 instrumented
  modality
- Experiment ID registered in `experiments/registry.json`

### Design constraints from 081KQ0YZ80008QG0R0003GAYYN principles

- **Minimise time-in-UI**: information density must allow answer
  in <30 seconds for a healthy factory; do not add elements that
  extend dwell time without reducing time-to-answer
- **No overcrowding**: max 7 top-level signal categories
  (Miller's 7±2 from 081KR50HA0008QG0R000TQKYGM)
- **Maintainer-never-writes-code**: maintainer uses dashboard,
  does not maintain it
- **Zero paid APIs**: GitHub public API + git file reads only

### Technology choices (for implementer)

Suggested: vanilla TypeScript + minimal bundler (Vite or esbuild) +
CSS-only styling (no heavy UI framework at MVP). The dashboard must
be readable and functional without JS enabled (progressive enhancement).

Rule 0: no `.sh` files; all build scripts are TypeScript via `bun`.

## Why after 081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, and 081KR50HA0008QG0R003BM7FNK

- **081KR50HA0008QG0R00223YZP8** (metric): the MVP's acceptance criterion is the
  time-to-answer metric; cannot declare MVP "done" without it.
- **081KR50HA0008QG0R0036HGEJ5** (host): the MVP deploys into the GH Pages shell;
  needs the deploy pipeline.
- **081KR50HA0008QG0R003BM7FNK** (tier model): the tier-grouped surface is the
  primary differentiated feature; needs the tier ADR committed.

081KR50HA0008QG0R001DX165X is a parallel dep — A/B wiring should be done, but if
081KR50HA0008QG0R001DX165X is still in-progress, MVP can ship with stub experiment
wiring and retroactively wire live infrastructure.

## Output artifacts

- `frontend/operational-resonance/src/` — TypeScript source
- Working GH Pages deployment (verify URL is live)
- `experiments/registry.json` — first registered experiment
- PR with screenshots of the deployed surface

## Focused check

```bash
curl -s "$(cat docs/dependency-status.md | grep operational-resonance | grep -o 'https://[^ ]*')" | head -5
```

Expected: GH Pages URL returns HTML with the dashboard.

(If URL not yet in dependency-status, manual verification:
open the GH Pages URL and confirm the dashboard loads.)

## Acceptance signal

- Dashboard is deployed and publicly accessible via GH Pages
- Factory status overview shows at least 5 signals
- Tier-grouped review surface shows open items by tier
- Page answers "are things going as expected?" in <30 seconds
  (verified by maintainer or timed usability test)
- First A/B experiment registered and event capture active
- No TypeScript errors in build

## Pre-start checklist

- [x] Prior-art search: no existing operational resonance dashboard
  surface found in `frontend/`, `docs/research/frontier/`, or GH
  Pages config. 081KQ0YZ80008QG0R0003GAYYN body describes the concept; no
  implementation exists.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R0036HGEJ5, 081KR50HA0008QG0R003BM7FNK]`.
  081KR50HA0008QG0R0019KYAAS depends on this row.

## Composes with

- 081KQ0YZ80008QG0R0003GAYYN (parent): implements "First dashboard surface ships
  (minimum-viable resonance dashboard)" milestone
- 081KR50HA0008QG0R00223YZP8 (dependency): acceptance criterion via time-to-answer metric
- 081KR50HA0008QG0R0036HGEJ5 (dependency): deploys into GH Pages shell
- 081KR50HA0008QG0R003BM7FNK (dependency): tier grouping model drives the primary surface
- 081KR50HA0008QG0R001DX165X (parallel): A/B infrastructure wired into MVP
- 081KR50HA0008QG0R0019KYAAS (downstream): conversation interface embeds in this surface
