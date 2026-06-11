---
id: B-0450
zetaid: 081KRFA460008QG0R001QFS6EV
priority: P1
status: open
title: "Getting-started guide for Zeta library consumers — quickstart doc + sample project"
type: friction-reducer
origin: PM-2 gap-prediction pass (B-0271) 2026-05-13
created: 2026-05-13
last_updated: 2026-05-13
renumbered_from: B-0444
renumbered_reason: "ID collision with separate B-0444 row (docs/backlog/P2/B-0444-bus-claim-envelope-worktree-field-...md, shipped via PR #3043). Per first-merged-wins, that row kept B-0444; this row renumbered to next-available B-0450 on 2026-05-13."
depends_on: []
composes_with: [B-0154, B-0445]
tags: [consumer-ux, getting-started, quickstart, documentation, onboarding, csharp, samples]
---

# B-0450 — Getting-started guide for library consumers

## PM-2 signal

External .NET developers who land on the repo from NuGet or GitHub
encounter Budiu et al. VLDB'23 math in the second paragraph of the README.
No `docs/getting-started.md` exists. No "hello world" circuit example
appears before the operator catalogue.

## What

1. `docs/getting-started.md` — 5-step quickstart:
   install → create circuit → map → step/tick → inspect output.
   Target audience: C# developer unfamiliar with DBSP.
2. `samples/QuickStart/` — minimal standalone project (single `.csproj`)
   that mirrors the quickstart doc and builds with `dotnet run`.
3. README badge / top-10-lines link pointing to the guide.

## Why now

The library is production-ready (0 warnings, 470+ tests, 25-round
stability window on residuated lattices + FastCDC). The entry path is
research-paper difficulty. Every consumer who bounces in the first 5
minutes is a permanent loss.

## Non-goals

- Does not replace the operator catalogue.
- Does not add new operators.
- Does not touch the F# API surface.

## Acceptance criteria

- [ ] `docs/getting-started.md` exists with a working 5-step C# example.
- [ ] `samples/QuickStart/` builds and runs: `dotnet run --project samples/QuickStart`.
- [ ] README links to the guide within the first 10 lines.
- [ ] `dotnet build -c Release` 0 warnings after changes.

## Kill criteria

If the Aurora pitch / factory-demo consumer path (B-0437 or equivalent)
already produces a canonical "hello world" moment, subsume this row under
that and close here.

## Composes with

- B-0154 (GitHub Pages SEO — the guide should be discoverable via Pages)
- B-0445 (C# fluent operator surface — quickstart uses the fluent API when it ships)
