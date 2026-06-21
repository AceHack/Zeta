---
id: 081KQNJ500008QG0R003EKJ8B5
priority: P2
status: open
title: TLA+ / Alloy runners should be TS wrappers under tools/, not F# xunit tests — pure-shell-out, no F# operator-algebra logic involved
tier: ci-architecture
effort: L
ask: Aaron 2026-05-03 — *"f# does not need to run alloy under low mem, it seems like the fs should be a ts"*. Surfaced during 081KQNJ500008QG0R002QDZ0BG implementation as the strategic structural fix; 081KQNJ500008QG0R002QDZ0BG itself is the tactical band-aid (filter F# tests on CI by OS+runner-class).
created: 2026-05-03
last_updated: 2026-05-03
depends_on: [081KQNJ500008QG0R002QDZ0BG]
composes_with: [docs/research/2026-05-03-math-proofs-honest-assessment.md, docs/trajectories/typescript-bun-migration/RESUME.md]
tags: [ci-architecture, ts-migration, formal-verification, tlc, alloy, fsharp-out, structural-fix]
type: friction-reducer
---

# TLA+ / Alloy runners as TS wrappers, not F# xunit tests

## Problem

`tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs` and
`tests/Tests.FSharp/Formal/Alloy.Runner.Tests.fs` are F# xunit
test files that:

1. Detect java + jar availability via shell `which`
2. Shell out to `java -cp tla2tools.jar tlc2.TLC <SpecName>` or
   `java -cp alloy.jar:<classDir> AlloyRunner <SpecFile>`
3. Parse stdout for success markers
4. Surface success/failure to xunit

**No F# operator-algebra logic is involved.** The F# project is just
a wrapper for shelling out to JVM tools. The xunit test framework
is being used as a CLI runner.

## Side-effects of the current shape

- Tests are coupled to the F# build matrix (.NET SDK + dotnet test)
- 081KQNJ500008QG0R002QDZ0BG's dual-axis OS+runner-class filter exists to prevent
  duplicate runs across the matrix — that filter exists because the
  F# project happens to build/run on every matrix cell
- `toolchainReady()` exists as a guard against missing-jar/missing-
  java on CI runners that haven't run install.sh
- TLC trace-file cleanup logic mirrors what a shell wrapper would do
- The `[<Collection("TLC")>]` xunit-collection serialization works
  around xunit's parallelism — but a shell wrapper wouldn't have
  that problem

## Proposed shape (TS wrappers)

`tools/formal-verification/run-tlc.ts` and
`tools/formal-verification/run-alloy.ts` (or similar):

1. Direct invocation: `bun tools/formal-verification/run-tlc.ts <SpecName>`
2. Returns exit 0 on success / non-zero on failure
3. Stdout: pass-through TLC output
4. CI workflow `.github/workflows/formal-verification.yml` (Linux-only;
   no need for the `low-memory.yml`-not-included filter):
   - Runs on `pull_request` paths affecting `tools/tla/specs/**` +
     `tools/alloy/specs/**` + the wrappers + the workflow itself
   - For each spec: invokes the TS wrapper
   - Faster than rebuilding the entire F# test project + filtering
5. Dev ergonomics: `bun tools/formal-verification/run-tlc.ts SmokeCheck` is
   a 1-step verify, no `dotnet test --filter ...` needed

## Migration path

**Phase 1**: ship TS wrappers in parallel; keep F# tests; new
workflow file runs TS wrappers on Linux-only path-filtered triggers.

**Phase 2**: confirm parity (both surfaces report identical results
for each spec across N PRs).

**Phase 3**: retire F# test files; remove 081KQNJ500008QG0R002QDZ0BG's filter (it
becomes vestigial); reduce F# test project surface.

## Composes with

- 081KQNJ500008QG0R002QDZ0BG (the tactical band-aid this row strategically supersedes)
- `docs/trajectories/typescript-bun-migration/RESUME.md` (the broader
  .sh→.ts migration substrate; this row extends to F#-out as well)
- `docs/research/2026-05-03-math-proofs-honest-assessment.md` (the
  A-grade rubric requires "Runs in CI on every commit"; the TS
  wrapper makes that more direct than via xunit)

## Effort estimate

L (3-5 days):

- 1 day: TS wrapper for TLC (parse jar invocation; trace-file
  cleanup; output parsing)
- 1 day: TS wrapper for Alloy (compile AlloyRunner.java once at
  install.sh time; parse spec invocation; OK/FAIL parsing)
- 1 day: workflow file `.github/workflows/formal-verification.yml`
  with path-filtered triggers + per-spec invocations
- 1 day: parity verification across both runners + spec catalogue
- 1 day: F# test retirement + 081KQNJ500008QG0R002QDZ0BG filter removal + retro doc
  updates (math-proofs assessment + verification-registry pointers)

## Why P2

Strategic improvement; 081KQNJ500008QG0R002QDZ0BG's tactical filter handles the
immediate cost-optimization. This row is the architectural
follow-up.
