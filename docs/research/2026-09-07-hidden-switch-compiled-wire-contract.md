# Guarded hidden-switch compilation: evidence wire contract

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Status: implementation boundary under review; no implementation archive or registered run yet

The [frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md) governs
these implementation choices. Its counts, timing boundaries, error bounds
and decision thresholds are unchanged. The
[ownership plan](2026-09-07-hidden-switch-compiled-implementation-plan.md)
separates native work, independently implemented numerical truth, and
coordinator evidence admission. Implementation began only after prior-study
main proof and remotely published co-claim `d6ec464f4`.

## Numeric and episode records

Binary64 observations and scalar inputs use exactly sixteen uppercase
hexadecimal characters. Both zero encodings remain distinct. Beliefs admit
only finite values in `[0,1]`, including positive subnormals and negative
zero. Certificate rationals use canonical decimal numerator strings and
positive denominator strings. SHA256 values use sixty-four uppercase hex
characters; git object IDs are separately typed lowercase forty-character
identities. JSON booleans are never admitted as integer counters.

Every pure choice result has exactly eight integer fields: `Action`, `Path`,
`GuardComparisons`, `RecursiveCalls`, `Nodes`, `ActionValues`, `Predictions`,
`Updates`. Action is zero or one, path is zero through four, and the six work
counts are uint32. The registered binary service is exactly 28 bytes:
action, path, two zero reserved bytes, followed by those six counts as
little-endian uint32. Path order is native recursion, certified switch,
certified harvest, certified trivial harvest, fallback recursion. Structural
admission is separate from independently checking actual path/work against
the scalar input and model. No Q values enter the timed output service.

The native owner implements the new no-Q episode with `Index`, `Complete`,
`Failure`, `Cues`, `Actions`, `States`, `Reward4`, `BeliefBits`, `ChoiceWork`,
`FilterCounters`, `FrameSha256`, `ProjectionSha256`, `TotalReward4`.
Complete records have seventeen observation entries and sixteen action
entries, with actual chronology and work independently reconstructed.
Untimed old-runner controls retain the old DTO unchanged; additional bit
diagnostics wrap that record. The fixed scalar audit retains the ordered
222 positions and its separate native Q bit pairs.

## Primitive evidence admission

[The pure coordinator module](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_admission.py)
returns `Admitted.value` or `Refused(code,path,detail)`. It opens no files,
calls no policy, computes no guard and generates no source tape. Numerical
modules use their independently owned typed result, without an import cycle.

- JSON is strict UTF-8, with duplicate keys retained until explicit rejection.
  Nonfinite constants and exponent overflow refuse, as do unpaired surrogates,
  trailing data, malformed syntax and excessive nesting. The parser's declared
  256 MiB per-envelope admission cap is a refusal boundary, not permission to
  truncate a result. Large raw choice/code artifacts are separate files.
- Object validators require their exact field sets. An admitted primitive
  never substitutes for a complete phase-envelope or scientific replay.
- UTC timestamps retain up to nine fraction digits and explicit `Z` or
  `+00:00`. Integer calendar arithmetic preserves native 100 ns distinctions;
  reversed intervals cannot disappear through microsecond truncation.
- Timing records have exactly `WallNs`, `CpuNs`, `AllocatedBytes`, `GcBefore`,
  `GcAfter`, `GcDelta`. Ledgers are integers in `[0,2^63-1]`. Measured wall
  must be positive; setup wall, CPU and allocation may be zero. GC lists
  contain generations zero, one and two; each delta must be the nonnegative
  corresponding after-minus-before value.
- Five-row medians are exact integer order statistics. Required native
  denominators must be positive. The threshold is the unbounded integer
  comparison `2*compiled_median<=native_median`. An admitted zero numerator
  stays zero; neither rounding nor ratio pooling changes the test.

An artifact descriptor has exactly `File`, `Bytes`, `Sha256`, `Encoding`,
`StoredBytes`, `StoredSha256`. `File` is a canonical relative ASCII POSIX
path with no empty, dot or parent component. Encoding is `identity` or
`gzip`; gzip filenames end in `.gz`. Original and stored byte lengths and
hashes are both retained. Identity storage requires exact byte equality.
Gzip admission requires one complete member, no trailing/concatenated data,
bounded expansion, and exact equality to the retained original bytes.
Two separately correct hashes do not establish this lossless relation.
Filesystem containment, exclusive writes and archived-file admission are
additional coordinator obligations, not claims made by this pure function.

## Envelope ownership and remaining integration

The agreed top-level direction is exact keys `Schema`, `Version`, `Kind`,
`Attempt`, `Complete`, `Failure`, `ProtocolSha256`, `Provenance`, `Runtime`,
`Arguments`, `StartedAtUtc`, `FinishedAtUtc`, `Inputs`, `Artifacts`, `Payload`.
Failure fields are `Stage`, `Code`, `Detail`, `Panel`, `Mode`, `Strategy`,
`Replicate`, `Episode`, `Call`; unavailable locations are explicitly null.
Complete native/runtime/phase sub-schemas are closed and reviewed before
whole-envelope admission or implementation archival. The primitive module
does not yet expose a purported whole-envelope success function.

Numeric certificate keys are `Schema`, `Bindings`, `Model`, `ExpressionGraph`,
`Bounds`, `Models`, `Guards`, agreed with the independent certificate and
native owners. `Bindings` reserves `ProtocolSha256`; remaining keys name
the coordinator's finite, exact repository source/checker/helper/build-file
roster, with uppercase SHA256 values. The independent numeric verifier
compares that entire expected map and independently reconstructs all
candidate vectors, envelopes, margins, bounds and guard inequalities.
Nonemptiness or a supplied `Passed` field establishes no coverage.
Resolved archive commits and runtime/image identities are separately admitted.

Next integration closes actual runtime/code evidence and complete phase
schemas, tests nonvacuous hand replay and refusal mutations, and reviews the
source/runtime/certificate correspondence before any new registered stream.
Unknown arithmetic or runtime premises remain admission failures. This
implementation note cannot relax the frozen protocol.

## Initial boundary validation

The coordinator ran the focused evidence tests: **47 passed in 2.34 seconds**.
Strict mypy reported no issues in the module and its test file. The tests
include duplicate/nested JSON keys, invalid numeric domains, both zero and
subnormal encodings, submicrosecond chronology, unrelated gzip/raw bytes
with individually valid hashes, negative/fabricated GC deltas, all work
fields and both reserved bytes, and an integer threshold counterexample
that floating-point ratio rounding could hide.

An initial missing closing parenthesis caused parser/test collection failure
before any test ran; it was corrected before the reported test/type pass.
Import order and one unnecessary lint annotation were also corrected.
No native graph, certificate, behavior, cost or whole-phase admission success
is inferred from these evidence-only tests. Further scientific admission
and complete repository validation remain part of the open task.
