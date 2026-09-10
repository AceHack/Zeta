# Native acting-carrier implementation review

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1W8T690087G0R002DJ91MJ

The subsequent [registered acting result](../../2026-09-06-rendered-catch-actions-results.md)
indexes all native, cost, full-replay and verdict receipts, publication logs
and the quiet window. The implementation review below retains its earlier
pre-measurement scope.

The later [CI fixture-path correction](ci-fixture-path-correction.md) retains
the three-platform publication failure and the test-only runtime path repair.

This record indexes native implementation/conformance evidence for the
[registered protocol](../../2026-09-06-rendered-catch-actions-protocol.md).
The [integrated validation and verdict review](integration-review.md) retains
the full native/Python gates, archive-admission refusal, and upstream gate repair.
It is not an experiment result or promotion. The registered source corpus,
return comparison, and resource measurement have not been run by this writer.
The coordinating contributor owns integrated archive publication, full gates,
independent replay, all measurement receipts, and the final verdict.

## Review scope and bounded findings

- The source/evaluator module owns ROMs, private source symbols, emulator state,
  feedback and conformance checks. `RenderedCatchPolicy.observe` accepts only a
  projected `GameEnvironment.Frame`; its decoder rejects lower-band information.
  All five arms use that path. Observation and action are distinct operations.
- A scored key enters the compact action trace before the adapter call. The
  persistent adapter constructs/copies its ROM and resets inside each episode.
  The independent source compiler remains outside the timed batch.
- Shadow traces come from separately executed `Chip8Cow.step` transitions,
  never generated from expected ROM bytes. The observed opcode is admitted
  before execution and the resulting PC checked afterward. Full record equality
  checks every adapter/shadow group end, including non-rendered registers.
- Counters advance at actual execution events. A wrong opcode can retain the
  already executed 17 primary steps while reporting zero shadow steps. The
  negative control verifies this partial-failure accounting and refusal.
- Each episode validates the actual fitted arrays retained by the policy.
  Order-two checks its 14-value fingerprint; bigram hashes its six retained
  values against the frozen six-value subset. Hashing only the original input
  `Counts` would miss a private-copy mutation and is not the complete witness.
- Top-band background reads are explicitly bounded to indices 0..1535.
  Binary lower-band substitutions preserve the projection result, including
  matching refusal for tied top bands. Successful byte equality applies to
  admitted projections. Fair-arm comparisons fork the RNG state and draw index
  along with bounded policy history. The original section E text is retained;
  the accepted interpretation is explicit in protocol section K.
- Native source admission requires current bytes to match both the declared
  `HEAD` source commit and the resolved immutable implementation archive. The
  mandatory file list includes the full protocol/addendum, frozen model input,
  native modules/runners, and independent Python sources. The cost reader also
  requires matching loaded assemblies, runtime and OS from behavior.
- Receipt digests stream underlying raw frame/projection/instruction bytes in
  execution order; aggregate hashes never concatenate hexadecimal digest text.
  Compact action/hit/observation strings retain complete episode traces. Cost
  episode indices remain corpus indices: warmup 0..7, timed 8..71. Per-path source
  draws are zero because the shared 72-row corpus is generated before timing.
- The allocation interval excludes constructing the measurement stopwatch and
  reading process CPU afterward. Adapter construction, both execution paths,
  policy validation, projection/feedback, and in-memory receipt accumulation
  remain uniformly inside the whole-episode interval. Timing is not yet run.

## Retained hand fixture

[`native-kernel.json`](native-kernel.json) contains 15 complete one-episode
fixtures: fixed dot, fixed bar, and odd-index complemented dot, each with all
five arms. Each episode uses the fixed 66-symbol repetition `[0,0,1,0,1,1]`.
The fair seed/domain are 19/29. This is a conformance fixture, not any
registered source stream or a sampled return estimate. Its exact-byte SHA-256 is
`A47DB1E0AC6FEC289D25402C2869BC2BCE4CF74647B4B511FD4CFA6CB74776CA`.

The coordinating independent Python implementation reported exact equality
for all 15 fixtures: actions, hits, observations, counters, emitted-frame
hashes, projection hashes, and observed shadow-trace hashes. The coordinating
writer retains its live cross-language test separately; this note does not
claim that the native shadow is an independent interpreter.

Native commands completed:

```bash
dotnet fsi src/Research.FSharp/check-rendered-catch-kernel.fsx
dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --filter FullyQualifiedName~RenderedCatch --no-restore
bun src/Core.TypeScript/lint/lint-fsharp.ts
```

The final focused compiled run passed 10 tests, zero failures or skips, with
no warning/error diagnostics. The F# lint/format gate passed. Both public
runners compile and print their usage without starting an experiment.
Early fixture compilation needed explicit F# record type annotations; no
registered measurement or threshold inspection preceded those fixes.

The retained fixture remained byte-identical after the final retained-model
and source-admission guards. Full build/test and build-graph regeneration are
coordinated at integrated publication, rather than represented by this focused
native gate.
