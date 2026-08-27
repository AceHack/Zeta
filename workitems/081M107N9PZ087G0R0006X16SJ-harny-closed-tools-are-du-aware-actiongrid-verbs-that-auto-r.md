---
id: 081M107N9PZ087G0R0006X16SJ
type: task
state: backlog
priority: P1
slug: harny-closed-tools-are-du-aware-actiongrid-verbs-that-auto-r
title: "Harny closed tools are DU-aware ActionGrid verbs that auto-refresh, not ad-hoc agent poll"
created: 2026-08-26T23:49:35.071Z
depends_on: ["081M100RH3Q087G0R0018X4RSJ"]
composes_with: ["081M107N9P4087G0R0002G5SR0", "081M100RH30087G0R003YXHQ12"]
---

# Harny closed tools are DU-aware ActionGrid verbs that auto-refresh, not ad-hoc agent poll

Ad-hoc tools (`gh pr checks`, `git status`, "search the repo") are
how an agent burns quota and still works on a stale world: **refresh
is a choice**. Closed tools should be **context/DU-aware commands**:
the verb *is* the observation of the current discriminated state, so
the agent cannot skip the refresh.

The grammar is the Xbox-controller 4×4 (`ActionGrid.fs` + observe
`grammar-16.ts`): layout fixed, labels per-context. Same controller
for human and agent. **`observe.ts` is already that controller**;
Harny must not grow a parallel one. Vendor harnesses are executors
plugged into observe (kiro-executor, subscription-executor). Harny
becomes the executor that speaks Ace/Zeta/ForgeHost, and wires World
channels (cheap `observeMerge` / `observeOpenPullRequests`) so
refresh is the snapshot.

Meijer μF/νF + Rx: World is μ; webhook/subscription is ν. Reservoir
(Jaeger/Maass): walls = DU grammar, readout = `observe()`.

## Must

- Tool list is a DU of verbs, not a bag of strings the model invents.
- Each verb returns the current state (or a refusal), never "maybe poll".
- Controller grammar (`ControlScheme.Action`) owns meanings; Harny is
  one *scheme* mapping into it, not a second grammar.

## Pointers

- `src/Core/ActionGrid.fs`
- `docs/research/2026-06-07-universal-action-grammar-xbox-controller-*`
- `src/Core.TypeScript/forge-host/github/github-merge-observe.ts`
