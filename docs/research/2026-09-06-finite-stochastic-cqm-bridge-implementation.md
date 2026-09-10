# Finite stochastic bridge: implementation and receipt boundary

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1WDDB6M087G0R002KN8DWQ
Status: implementation specification before finite witness execution

[Independent source review](2026-09-06-finite-stochastic-cqm-bridge-review.md)
accepted source commit `52b43d3e3fdb2916fc17096e9f003a478ba85eb4` for archival.
Execution and final validation remain separate, subsequent evidence.

This accompanies the immutable
[proof/witness contract](2026-09-06-finite-stochastic-cqm-bridge-protocol.md).
Its fourteen rows contain 957 cases. A case can compare several matrices;
the count is not a count of physical input states or independent samples.
No randomization, empirical threshold, or performance measurement is involved.

## Native and independent arithmetic

The [native module](../../src/Research.FSharp/FiniteStochasticBridge.fs) calls
the existing WSet `apply`, `consolidate`, `discard`, and `tensor`. Dense matrix
multiplication explicitly uses destination/source indices. It does not call
the probability module's row-vector `forwardStep`.

Existing `ProbabilitySemiring.add` and `mul` use unchecked int64 products.
A local witness instrument admits operands and normalized results only when
absolute numerator and positive denominator are at most 1,000,000. Products
are then at most 10^12; an addition's raw numerator magnitude is at most
2 times 10^12, below int64's maximum. A refused operand never reaches the
unchecked operation. A refused result becomes zero for continuation, increments
a refusal count, and invalidates the entire report even if some later equality
checks happen to coincide. The instrument records observed maxima. This does
not make the underlying core rational type generally overflow-safe.

The [Python reference](../../src/Interp.Python/zeta_interp/finite_stochastic_bridge.py)
uses arbitrary-precision `Fraction` and dense superoperators on row-major
matrix vectorizations. Its Choi construction reshapes the superoperator;
its Bell partial transpose sums transposed elementary tensor terms. It does
not import native output to construct expected values or emulate WSet lists.
Algorithms and arithmetic differ; authorship is shared. A separate contributor
reviews the mathematics, implementation, and retained results.

Both implementations operate on rational matrix-unit images. The maps have a
mathematically specified complex-linear extension; neither implementation
executes arbitrary complex inputs or tests complex-linearity of an unknown
map. A conjugating map could agree on all real matrix units. General CP follows
the contract's amplified-map/Kraus proof; finite CP certificates check exact
diagonal Choi structure before entrywise nonnegativity is used. Transpose's
positivity rests on the proof, not its three retained sample states.

## Exact receipt schema and admission

Native `Report` retains the ordered matrix roster and all fourteen `Checks`.
Each check has `Name`, `Cases`, and `Passed`; each case has `Id`, `Left`,
`Right`, and `Passed`. Every matrix string includes `rows x columns:` followed
by row-major, reduced `numerator/denominator` entries. Scalar rationals and
literal `true`/`false` evidence occupy separate string entries. The independent
reference compares the complete nested body, including types, order, counts,
all values and pass bits. It rejects duplicate JSON keys and nonfinite constants.

The native arithmetic ledger is checked for zero refusals and the fixed
operand ceiling. Claimed observed peaks must cover every retained coefficient.
The reference does not replay native operation order, so it does not claim
to reproduce internal peak counters exactly. Output lower bounds plus the
native guard proof are the stated cross-check.

Both CLIs resolve the immutable implementation archive
`archive/experiments/081M1WDDB6M087G0R002KN8DWQ` and require exact source-file
bytes to match that commit. `SourceCommit` names that admitted archive snapshot,
not necessarily the current checkout HEAD. The contract tag with suffix
`-contract` must be its ancestor, and original contract bytes must be unchanged.
The source manifest includes both runners, the native witness, WSet, rational
arithmetic, and semiring/ring interfaces. The executing file must be the
canonical admitted runner/reference path; a renamed copy cannot verify an
unrelated canonical file. Neither archive tag may move.

The native envelope also retains the actual loaded Core/Core.Abstractions
assembly SHA-256 and MVID, plus .NET/OS descriptions. Those identify binary
bytes used, but source-file hashes alone do not prove a source-to-binary build.
Build validation records and independent finite agreement are separate evidence.
Python retains its runtime/OS, its executing source hash, and the same admitted
source manifest. Its replay hashes exactly the native input bytes it checked.

Failures carry a stage and detail. A new `.partial` file is created exclusively
and the complete or failed receipt is published to a fresh destination without
overwrite. Native source-admission failures retain hashes already collected;
Python input-read/decode failures remain receipts, with an input hash once bytes
are available. Invalid command syntax or an unavailable/occupied output path
cannot promise publication at that path and exits without replacing anything.

## Execution after implementation archival

From a checkout containing the archived implementation and matching build:

```bash
dotnet build -c Release
dotnet fsi --exec src/Research.FSharp/run-finite-stochastic-bridge.fsx native.json
uv run --project src/Interp.Python python -m zeta_interp.finite_stochastic_bridge native.json replay.json
dotnet test Zeta.sln -c Release
dotnet format --verify-no-changes
bun run preflight:quick
```

The Python module invocation requires the project package on its environment's
import path, as supplied by `uv run --project`. Compilation and static checks
may run before archival; the frozen witnesses and tests that execute them may
run only after the implementation is remotely preserved. Coordinate with the
acting-carrier timing window before any build, test, lint, or witness execution.
