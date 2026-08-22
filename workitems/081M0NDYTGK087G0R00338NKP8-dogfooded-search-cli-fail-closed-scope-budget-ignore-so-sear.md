---
id: 081M0NDYTGK087G0R00338NKP8
type: task
state: backlog
priority: P2
slug: dogfooded-search-cli-fail-closed-scope-budget-ignore-so-sear
title: "Dogfooded search CLI: fail-closed scope budget + .ignore so search constraints are carried by the tool, not by prose"
created: 2026-08-22T19:07:59.891Z
depends_on: []
composes_with: []
---

# Dogfooded search CLI: fail-closed scope budget + .ignore so search constraints are carried by the tool, not by prose

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0NDYTGK087G0R00338NKP8-*.md` glob. -->

## The occasion

`CLAUDE.md` has carried *"`references/prior-art` — explicit-target searches ONLY;
a naive `grep -r .` is a 2-hour runaway"* in **every** agent's startup context for
months. On 2026-08-22 an agent with that text resident opened its investigation
with an unconstrained `grep -rn ... .` from the repo root. Two background jobs ran
over an hour and burned host I/O.

The rule was written, correct, and loaded — and it still failed. **A constraint
that exists only as prose is a constraint that did not run**: the vacuity class
applied to guidance rather than to tests.

Aaron: *"this is one of the main reasons we want to dogfood our own clis and not
ever rely on bash or random clis from others, they don't have our constraints
built in to avoid things like this"*

## Prior-art search (start gate)

Explicit-target, per the rule this item is about:

- **`src/Core.TypeScript/search/grep.ts` already existed** (2026-05-31), built for
  this exact reason, with `references/prior-art` already excluded — and it did not
  prevent the incident. Two measured reasons, and they are the design input:
  1. **Unadvertised and unused** — nothing in the repo imports it but its own
     test; `CLAUDE.md` names the constraint and never names the tool.
  2. **It is itself a runaway** — no scope budget, no streaming output; over this
     tree it produced no output and did not finish in 300s.
- `src/Core.TypeScript/search/concept-index.ts` — a curated semantic index; a
  different job, not an ad-hoc content search.
- No `.ignore` / `.rgignore` existed anywhere in the tree.
- Nothing named search/grep/find under `src/Core.TypeScript/ace/` or `clis/`.
- `docs/WONT-DO.md` — nothing declining a search CLI.
- `prior-art` handling was duplicated across ~8 files, each with its own copy.

## Two measurements that changed the design

1. **The named directory is not the heavy one.** `references/prior-art` is
   **8.0K** — a `.gitignore` and a `README.md`. The 24G checkout is
   the generated `.lake` directory under `src/Core.Lean4` (6.9G), `.git` (4.1G),
   `src/Core.Rust.*/target` (~700M),
   `node_modules` (222M). An exclusion set naming only `prior-art` would have
   prevented nothing.
2. **The cost is per-file-OPEN.** `rg --files` walks 40,984 files in 0.33s;
   `rg -c` over the same tree did not finish in 180s at 3% CPU. Microsoft
   Defender's on-access scanner was at 464% CPU, load average 36.6. So the guard
   budgets *files opened*, and can check that budget with a walk ~1000x cheaper
   than the reads it is gating.

## Shipped

- `src/Core.TypeScript/search/exclusions.ts` — one place for the exclusion set;
  every entry carries a dated measurement (a test fails if one does not).
- `src/Core.TypeScript/search/search.ts` — fail-closed scope budget. Refuses an
  over-budget or excluded-tree search naming the flag that permits it; never
  narrows silently; exit `3` distinct from "no matches".
- `/.ignore` — generated from `exclusions.ts`, makes a bare `rg` safe for free.
- `search.test.ts` — 17 falsifiers; 7/7 verified mutants killed.

## Follow-ups (sized, deliberately NOT in this PR)

- **Advertise it in the startup surface.** The single highest-leverage change is
  one line in `CLAUDE.md` pointing at `search.ts`, since "unadvertised" is the
  measured reason the previous tool failed. Not done here: `CLAUDE.md` is
  configuration, and an agent's own say-so is not authorization to edit it. Needs
  a human. **~1 line.**
- **Migrate the ~8 call sites** that hand-roll `prior-art` handling onto
  `exclusions.ts` (`src/Core.TypeScript/ace/build-graph.ts`,
  `src/Core.TypeScript/algebra/entropy-tracker.ts`,
  `src/Core.TypeScript/algebra/key-erasure-meter.ts`,
  `src/Core.TypeScript/hygiene/audit-git-hotspots.ts`,
  `src/Core.TypeScript/hygiene/audit-hidden-oracles.ts`,
  `src/Core.TypeScript/lint/no-empty-dirs.ts`, and others). Each is
  a 1–3 line import swap; the risk is that some intend a *different* set, so each
  needs reading rather than a blind sed. **~1 focused PR, half a day.**
- **Retire or absorb `grep.ts`** once `search.ts` has usage. It is now a strictly
  worse tool for ad-hoc search; keeping both is a fork in the guidance.
