---
id: 081M0AHW6CH087G0R001F1V9RY
type: task
state: backlog
priority: P2
slug: correct-factually-wrong-claims-in-context-startup-loaded-cla
title: "Correct factually wrong claims in context-startup-loaded .claude/rules surfaces"
created: 2026-08-18T13:44:49.297Z
depends_on: []
composes_with: []
---

# Correct factually wrong claims in context-startup-loaded .claude/rules surfaces

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0AHW6CH087G0R001F1V9RY-*.md` glob. -->

## What was wrong, and the check that proved it

Three factually-false or unresolvable claims in `.claude/rules/` — the surface every agent
pays for on every wake. Scope was narrow: **only what is verifiably false**; no emphasis,
ordering, or doctrine touched.

### 1. `.claude/rules/every-bug-has-economic-value.md` — `sim` called an "unwired interface stub"

**False since PR #11679** (merged 2026-08-17T22:59:53Z, work item
`081M08VM385087G0R001DTM0K6`). Checks:

- `ls clis/` → `Zeta.Clis.fsproj` exists beside `Verbs.fs`.
- `grep -n Clis Zeta.sln` → line 172, the project is in the solution, so CI's
  `dotnet build Zeta.sln -c Release` reads the file.
- `ls tests/Tests.FSharp/Clis/` → `Verbs.Tests.fs`, the composition witness.

"Working" would be equally wrong. `clis/Verbs.fs` declares `ISimVerb.Sim: ISeed * TimeSpan -> unit`
and `IMeaVerb.Mea<'a>: IEffects * ISim<'a> -> IMeasurement`, and `ICutVerb.Cut<'a>: TimeSpan * ISim<'a>`
consumes the sim rather than the measurement — two independent breaks, so no member anywhere
introduces an `ISim<'a>`. The satellite (`db/uncertainty/README.md` §Status) had already been
corrected; the hub had not. New text names the mechanical fact: compiled, no introduction form,
pipe does not typecheck.

### 2. `.claude/rules/async-all-the-way-truthful-signatures.md` — named two live `Task.Run` sites that no longer exist

**False.** `grep -nE "Task\.(Run|Factory)" src/Core/Runtime.fs src/Core/SpineAsync.fs` → **no matches**
(exit 1). Both files are on the ferry: `src/Core/Runtime.fs:48` `MaxDegreeOfParallelism = shardCount`

- `:68` `new FerryThrottler<int, unit>`, `src/Core/SpineAsync.fs:28` `MaxDegreeOfParallelism = 1`
- `:42` `new FerryThrottler<ZSet<'K>>`. `git log -S 'Task.Run'` on those two paths names the migration:
  `1e012b7273` _"Migrate raw Task.Run sites in DbspRuntime and SpineAsync to FerryThrottler"_.
  The rule was pointing at its own worked instance as if it were outstanding work.

### 3. `.claude/rules/toy-is-free-metered-must-be-earned.md` — `LagrangeCondorcet.fs` had no resolvable path

`find . -name 'LagrangeCondorcet*'` → `src/Bayesian/LagrangeCondorcet.fs`. The rule cited the bare
filename, which `audit-rule-cross-refs.ts` cannot resolve (it was one of that audit's 14 candidates).
The metered claims themselves check out and were not touched: `src/Bayesian/LagrangeCondorcet.fs:32`
carries `μ_crit = (1 - √(23/27)) / 2`, and `tests/Bayesian.Tests/LagrangeCondorcet.Tests.fs:17` pins
`abs (jurySize - 25.96) < 0.1`.

**Measured effect:** `audit-rule-cross-refs.ts` resolved 113/127 before, 114/127 after.

## Swept and found sound (checked, not assumed)

All 9 ZetaIds cited across `.claude/rules/` resolve to real rows. All 11 `rules.bak/` pointers exist.
`GOVERNANCE.md` §35 exists (line 903) and `AGENTS.md` line 25 carries the matching section.
`audit-proof-lineage-binaries.ts` really does run inside the `cross-verify` job (`gate.yml:1720` job
header, `:1810` the step). The six `.wasm` files, `run-bytelock-ci.mjs`, and `bytelock.yml` all exist.
`lint-no-new-bnnnn.ts` / `lint-b-refs-resolve.ts` are wired in `backlog-index-integrity.yml`.
Symbols verified live: `GlassHalo.frost`, `RoomBoundary.frost`, `BeliefConvergence.observeAll` (and its
in-file invariant comment), `CoordinationSpectrum.SpectrumMatch`/`SameSourceAsKnown`, `AntiSybil.SourceOf`

- `DistinctCount`, `DerivationProtocol.AssertedOnly`/`supportsClaim`/`Wall.Whitebox`/`whiteboxPermitted`,
  `Collation.binary`, RC-2/RC-3 in `CliffordE8BladeMask.Tests.fs`, and `TravelerRankLedger.fs`'s `0.5`
  prior / `≈0.35` whitewash value (TRL-13 pins it). The five `.editorconfig` CA severities are `error`.
  `human-anchor`, `glossary-anchor-keeper`, `missing-citations` exist as `.claude/skills/governance/blueprints/`.

## Left alone deliberately (listed, not guessed)

- **`.claude/rules/culture-invariant-by-default.md`: "Implemented as `Collation.binary` in all four oracles."**
  F#/C#/TS have a named `binary` collation (`src/Core/Collation.fs:83`, `src/Core.CSharp/Collation.cs:115`,
  `src/Core.TypeScript/collation/collation.ts:41`). No Rust collation module exists — but
  `tests/Tests.FSharp/Collation.CrossOracleTreaty.Tests.fs:115` says the canonical relation _is_ what
  Rust's native `Ord for String` already gives. Whether "implemented" means a named module or the
  relation is a judgement call, not a fact check.
- **13 remaining bare-filename pointers** flagged by `audit-rule-cross-refs.ts` (`new-workitem.ts`,
  `dora-metrics.ts`, `CURRENT-*.md`, …). Each resolves uniquely by `find`; none is _wrong_, only
  path-less. Adding paths is a size decision on a cold-start surface, not a correction.
- **Two work-item state inconsistencies.** `081KTF10R0108QG0R003P44BA2` sits in `workitems/done/2026/06/`
  with `state: backlog` in its frontmatter; `081M08VM385087G0R001DTM0K6` is `state: backlog` while its
  body reads "What this item shipped". Lifecycle bookkeeping, not rule text.
- **`.claude/rules/dv2-data-split-discipline-activated.md` ordering** — it leads with change-rate partitioning, while
  Aaron holds that **disagreement preservation** is what is unique to DV2. That is an emphasis call and
  his to make; untouched, and recorded here so it is not lost.
