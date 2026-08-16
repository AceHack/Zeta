---
id: 081M05X87AJ087G0R003DPMYRK
type: bug
state: backlog
priority: P2
slug: f-has-no-culture-invariant-analyzer-coverage-and-invariantgl
title: "F# has no culture-invariant analyzer coverage and InvariantGlobalization is set on one project of many"
created: 2026-08-16T18:27:25.650Z
depends_on: []
composes_with: []
---

# F# has no culture-invariant analyzer coverage and InvariantGlobalization is set on one project of many

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M05X87AJ087G0R003DPMYRK-*.md` glob. -->

## The finding

`.claude/rules/culture-invariant-by-default.md` says its diagnostics are
*"enforced at compiler/analyzer level for all harnesses in the repository via
`.editorconfig`"*. **That sentence is not true**, and the gap is wider than the
TypeScript one that prompted the sweep.

Verified by reading `.editorconfig`: CA1304, CA1305, CA1307, CA1310 and CA2007 are
set to `error` under **`[*.{cs,csx}]` only**. The `[*.{fs,fsi,fsx}]` section
carries none of them.

And this is not an oversight that can be fixed by adding five lines: **.NET code
analysis (CA) rules are Roslyn analyzers and do not run on F# at all.** So F# —
the language `src/Core/` is written in, and the language the canonical live defect
(081KT07NV0008QG0R001YDB73K, `GCounter.Merge` ordinal vs `ZSet.ofSeq`
culture-sensitive) was written in — has **no analyzer coverage whatsoever**.

## The partial mitigation that exists, and how partial it is

`<InvariantGlobalization>true</InvariantGlobalization>` collapses culture-sensitive
comparison to ordinal at runtime. It is set on exactly **two** projects in the
repo: `src/Core/Core.fsproj` and `genesis/_src/auth-backend/GenesisAuth.csproj`.
Every other `.fsproj` runs with full globalization.

## What the survey found (so this is scoped, not alarmist)

F# is in genuinely good shape at the call-site level — the discipline has been
followed by hand:

| API | count in `src/**/*.fs` |
|---|---|
| `.ToLower()` / `.ToUpper()` | **0** |
| `String.Compare(` | 1 — and it passes `StringComparison.Ordinal` explicitly |
| `.EndsWith("` | 1 |
| `.StartsWith("` | 14, of which most pass `StringComparison.Ordinal` |

The unqualified `StartsWith` remainder is the live exposure, and the sharpest
instance is **`src/Core.FSharp.Yaml/Reader.fs`** (lines 310, 443, 462): a YAML
*parser* testing document markers with culture-sensitive `StartsWith`, in a
project that does **not** set `InvariantGlobalization`. YAML parsing feeds the
four-oracle byte-lock.

## Two candidate fixes, both needing a decision

1. **Repo-wide `<InvariantGlobalization>true</InvariantGlobalization>`** in
   `Directory.Build.props`. Cheap and total — but it is a **build-wide runtime
   behaviour change** affecting every project including UI surfaces, so it is a
   migration, not a sweep line.
2. **A hygiene linter for F#**, the same shape as
   `src/Core.TypeScript/hygiene/lint-no-culture-sensitive-collation.ts`, banning
   the unqualified overloads. Narrower, no runtime change, and dogfoods the
   pattern that just landed for TypeScript.

These are not exclusive; (2) is the one that composes with what already exists.
