---
id: 081KRFA460008QG0R001QFS6EV
priority: P1
status: open
title: "Getting-started guide for Zeta library consumers — quickstart doc + sample project"
type: friction-reducer
origin: PM-2 gap-prediction pass (081KR2E4K0008QG0R003VB7ZZR) 2026-05-13
created: 2026-05-13
last_updated: 2026-05-13
renumbered_from: 081KRFA460008QG0R001SXP0C2
renumbered_reason: "ID collision with separate 081KRFA460008QG0R001SXP0C2 row (docs/backlog/P2/081KRFA460008QG0R001SXP0C2-bus-claim-envelope-worktree-field-...md, shipped via PR #3043). Per first-merged-wins, that row kept 081KRFA460008QG0R001SXP0C2; this row renumbered to next-available 081KRFA460008QG0R001QFS6EV on 2026-05-13."
depends_on: []
composes_with: [081KQGDBJ0008QG0R002NV04N9, 081KRFA460008QG0R002JQERS5]
tags: [consumer-ux, getting-started, quickstart, documentation, onboarding, csharp, samples]
---

# 081KRFA460008QG0R001QFS6EV — Getting-started guide for library consumers

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

If the Aurora pitch / factory-demo consumer path (081KRFA460008QG0R001JTAPZW or equivalent)
already produces a canonical "hello world" moment, subsume this row under
that and close here.

## Composes with

- 081KQGDBJ0008QG0R002NV04N9 (GitHub Pages SEO — the guide should be discoverable via Pages)
- 081KRFA460008QG0R002JQERS5 (C# fluent operator surface — quickstart uses the fluent API when it ships)
