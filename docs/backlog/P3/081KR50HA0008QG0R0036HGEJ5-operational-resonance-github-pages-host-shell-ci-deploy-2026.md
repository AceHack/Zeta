---
id: 081KR50HA0008QG0R0036HGEJ5
priority: P3
status: open
title: GitHub Pages static shell for Operational Resonance Dashboard — index page, nav shell, CI deploy config
tier: engineering
effort: S
ask: decomposition of 081KQ0YZ80008QG0R0003GAYYN
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R002DR44J1]
composes_with: [081KQ0YZ80008QG0R0003GAYYN, 081KR50HA0008QG0R002DR44J1, 081KR50HA0008QG0R000TQKYGM, 081KR50HA0008QG0R00223YZP8, 081KR50HA0008QG0R003BM7FNK, 081KR50HA0008QG0R001DX165X, 081KR50HA0008QG0R002NZENZJ, 081KR50HA0008QG0R0019KYAAS]
parent: 081KQ0YZ80008QG0R0003GAYYN
tags: [frontier, github-pages, dashboard, ci-deploy, host-shell, operational-resonance]
type: friction-reducer
---

# 081KR50HA0008QG0R0036HGEJ5 — GitHub Pages static shell for Operational Resonance Dashboard

## What

Create the minimal GitHub Pages static-site shell that will host
the Operational Resonance Dashboard:

1. **Directory structure** — `frontend/operational-resonance/`
   (or a dedicated `gh-pages` branch structure — design decision
   for the implementer, but must be git-native).

2. **Index page** — bare bones: locked name (from 081KR50HA0008QG0R002DR44J1),
   placeholder "Under construction" content, correct meta tags,
   no content beyond the shell. TypeScript + a minimal
   static-site builder (no full framework needed at shell stage).

3. **Navigation shell** — top-level nav matching the planned
   surface areas (Overview / Tier Review / Experiments / Settings);
   all links are dead stubs at this stage.

4. **CI deploy config** — GitHub Actions workflow that:
   - Builds the static site (TypeScript + bundler)
   - Deploys to GitHub Pages on every merge to `main`
   - Passes build with 0 TypeScript errors + 0 warnings
   - Self-documents what URL the dashboard is accessible at

5. **README pointer** — update the relevant README or
   `docs/dependency-status.md` with the GH Pages URL.

## Constraints

- **Rule 0**: no new `.sh` files; build + deploy scripts are
  TypeScript or GH Actions YAML only.
- **Zero paid APIs**: no external services invoked at shell stage.
- **Maintainer-never-writes-code**: shell must be buildable
  by agents without maintainer code authorship (vibe-coded
  hypothesis per AGENTS.md).
- **Build gate**: `dotnet build -c Release` (project's own gate)
  must still pass after adding this directory — don't break the
  existing build.

## Why after 081KR50HA0008QG0R002DR44J1

The shell uses the locked name for the page `<title>`, URL slug,
and component naming. Building the shell before naming is locked
produces rework (URL slug rename propagates everywhere).

## Output artifact

- `frontend/operational-resonance/` (or equivalent) with shell
  structure committed
- `.github/workflows/deploy-operational-resonance.yml` CI workflow
- GH Pages URL documented in `docs/dependency-status.md`

## Focused check

```bash
ls frontend/operational-resonance/  # or equivalent path
cat .github/workflows/deploy-operational-resonance.yml | head -10
```

Expected: directory exists, workflow file present.

## Acceptance signal

- Static site builds without errors
- GH Actions workflow deploys successfully to GH Pages
- Deployed URL is accessible (returns 200)
- Page shows locked name from 081KR50HA0008QG0R002DR44J1
- No TypeScript errors in the build
- `dotnet build -c Release` still passes

## Pre-start checklist

- [x] Prior-art search: no existing GH Pages host for this
  dashboard found. `frontend/` directory may have other surfaces;
  check before creating conflicting structure. No existing
  deploy workflow for the dashboard found in `.github/workflows/`.
- [x] Dependency-restructure: `depends_on: [081KR50HA0008QG0R002DR44J1]` — needs
  locked name for title/slug. 081KR50HA0008QG0R002NZENZJ depends on this shell.

## Composes with

- 081KQ0YZ80008QG0R0003GAYYN (parent): implements "GitHub Pages as host" architectural
  extension (2026-05-04 section)
- 081KR50HA0008QG0R002DR44J1 (dependency): locked name used in page title + URL
- 081KR50HA0008QG0R002NZENZJ (downstream): MVP surface lands in this shell
- 081KR50HA0008QG0R0019KYAAS (downstream): conversation interface embeds in this shell
