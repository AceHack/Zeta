# Compiled hidden-switch native pure boundary validation

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: initial implementation slice; runtime admission and study execution pending

This implements the pure boundary and build wiring from the
[registered protocol](../../2026-09-07-hidden-switch-compiled-protocol.md) and
[ownership plan](../../2026-09-07-hidden-switch-compiled-implementation-plan.md).
The executable presently returns exit 2 with an explicit refusal and has no
behavior/cost command, source generation, certificate initialization or policy
initialization. This is parked feature work, not a completed experiment.

## Concrete boundary

`HiddenSwitchCompiledReceipt.fs` defines the agreed no-Q episode/scalar records,
explicit nullable failure locations, exact uppercase binary64 encodings and the
shared 28-byte little-endian choice writer. The writer includes two reserved
zero bytes and six actual uint32 work counts. Invalid buffers/enums refuse
before writing. It allocates no output buffer itself; this is not a whole-call
zero-allocation claim.

`HiddenSwitchCompiledPolicy.fs` admits scalar beliefs/depth, calls the unchanged
native evaluator/selector, and returns its actual traversal work. Its immutable
adapter owns one belief and its own chronology/filter counts. Observation
copies the supplied projection before decoding; an action must be committed
before the next feedback frame. No environment/scorer/source capability enters
that policy state. The compiled guard service is still pending independently
checked numeric constants and runtime admission.

The new file-backed executable project explicitly links the unchanged archived
research sources and the new files, uses .NET 10.0.11 with roll-forward disabled,
and disables tiering/PGO/ReadyToRun publication. A later launch must also admit the
actual required environment, loaded runtime, FP mode and graph. These project
settings alone prove none of those observations. The test project links the two
new sources; the solution and derived build graph include the executable.

## Retained attempts and focused gates

The [manifest](native-pure/manifest.json) binds original and losslessly compressed
bytes for all 23 retained records. The [final snapshot](native-pure/final-snapshot.json)
binds the tested working source, project/configuration and observed built outputs.
Its checkout HEAD is the earlier co-claim, not a claim that the uncommitted files
were already present in that commit. No full-solution or registered study run is
claimed by this slice.

| Attempt | Outcome |
| --- | --- |
| CLI build 1 | 26.43 seconds, two F# private-record layout errors, zero warnings |
| CLI build 2 | 1.33 seconds, two remaining record layout errors, zero warnings |
| CLI build 3 | 2.70 seconds, zero warnings/errors |
| Test-project build 1 | 37.46 seconds, one F# named-argument parse error in `Assert.True`, zero warnings |
| Test-project build 2 | 29.33 seconds, zero warnings/errors after parenthesizing the equality |
| Test-project build 3 | 54.03 seconds, zero warnings/errors after narrowing the test name |
| Focused tests 2 | Four passed, zero failed/skipped under the narrowed name; complete TRX retained |
| Focused tests 1 | Four passed, zero failed/skipped; complete TRX retained |
| File-backed refusal | Exit 2 under all three required startup flags, stdout/stderr retained |

Both build targets used Release, `-m:1 -nr:false`,
`-p:ContinuousIntegrationBuild=true`, and the writer-to-`/_/` PathMap. The focused
command was `dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --no-build
--filter FullyQualifiedName~HiddenSwitchCompiledTests` with a unique TRX name.
The four tests cover the literal choice record/no-write refusal, signed zeros and
subnormals, actual native depth-three counters and input refusals, and copied-frame
chronology with the unchanged old filter as a hand comparison.

Two setup-check failures are preserved in a clearly labeled reconstructed account:
an incorrect `.fs` extension and unavailable local archive objects. Neither is
presented as a successful prelaunch scientific check. After fetching the immutable
old implementation archive, all 19 old scientific files were compared directly
against `4fc82b611012bd2620a26e02afe6baba491fe553`, before CLI build 2, and matched
exactly. No old scientific source was edited. The new-source snapshots preceding
the three CLI builds are separate from that later old-source check.

## Next bounded admission

The separate graph/hand process must establish actual callable/stub/body identities,
complete relevant closures/callers, independent machine-byte disassembly, FP mode,
and loaded-image/source/build binding. A function pointer or JitDisasm listing alone
is insufficient. The runtime reviewer has checked the initial file-backed/pure
shape but has not accepted an executable graph. The general source-to-binary and
non-atomic runtime observation limits in the
[runtime feasibility note](../../2026-09-07-hidden-switch-compiled-runtime-feasibility.md)
remain explicit. No registered seeds 9307/9409, tapes or timings were generated.

## Independent source review and assertion census

The independent protocol-review agent accepted the pure source, four hand tests
and retained report on 2026-09-07 without rerunning a build, test or graph. The
first quick gate passed 15 of 16 checks and flagged the new mutation-mediated
snapshot assertion for an explicit census row. The reviewer accepted that one row:
the two snapshot calls surround mutation of the caller's original frame cells.
The test name was narrowed to that observed scalar-snapshot property. The
assertion does not prove absence of an unexposed heap reference or distinguish
copying from immediate scalar decoding; the private policy field shape and source
review support the separate no-retained-frame boundary. This is an adjudicated
census addition, not a disabled rule.

The corrected quick preflight passed all 16 executed checks. Its complete output
is retained; the required push hook will independently repeat that gate.

The [separate graph prefix feasibility record](native-graph-feasibility.md)
continues this slice with explicit non-admission and independent review.
