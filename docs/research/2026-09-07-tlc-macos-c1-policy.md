# TLC on macOS ARM64: retained failures and the C1 policy

Date: 2026-09-07
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XR248G087G0R000H0WJT1
Status: direct diagnostics and own-tree policy gate complete; independent source review accepted

The macOS ARM64 TLC policy adds `-XX:TieredStopAtLevel=1`, selecting C1
compilation after two in-run failures under the previous OpenJDK 26 policy.
Two separately retained direct C1 diagnostics completed the unchanged
`BftConsensus` model with exit zero and exactly 4,665,495 distinct states.
Together with the complete policy gate below, these observations support a
bounded platform workaround. They do
not establish the failures' cause, general runtime stability or a statistical
failure-rate improvement.

The [evidence index](data/2026-09-07-tlc-macos-c1-policy/README.md) retains both
failed gate logs, both complete diagnostic outputs, prelaunch identities,
result records and the exact diagnostic launcher. No failed observation was
replaced by a successful run. The policy change is separate from the
process-retention and startup-retry repair under work item
`081M1XQM8E4087G0R0036P5RWY`.

## Observations before the policy edit

| Invocation | Outcome | Scope of the retained observation |
| --- | --- | --- |
| Previous policy, native writer full suite | One `BftConsensus` failure; exit 1; the selected test took 2m51s | TLC could not reconstruct an error trace and emitted bug(4). The suite retains 6,554 passes and six skips in the affected test project. |
| Previous policy, unchanged isolated test | Exit 134; the test process took 15.68s | SIGBUS in `FcnRcdValue.write` after progress at 136,610 distinct states. |
| Direct C1 diagnostic 1 | Exit 0; 284.15s external elapsed | 44,070,202 generated, 4,665,495 distinct, zero queued; normal completion. |
| Direct C1 diagnostic 2 | Exit 0; 282.84s external elapsed | Same complete counts and completion; a separate invocation with an unchanged launcher. |

The first failure's wording refers to an initial-state recovery problem, but
the [pinned TLC trace code](https://github.com/tlaplus/tlaplus/blob/8ba1027/tlatools/org.lamport.tlatools/src/tlc2/tool/TLCTrace.java#L373)
emits bug(4) while recovering an error successor from its predecessor.
It does not identify a JVM startup failure. The retained state also contains
a function-valued sender key inside `rcvd[vera]`, outside the model's
Nodes-only update shape. This supports investigating checker/runtime/state
corruption; the truncated log cannot establish a valid model counterexample
or distinguish those causes.

The SIGBUS report names OpenJDK `26+35-2893`, SerialGC and `bsd-aarch64`.
Its problematic frame has lowercase `j`, which denotes interpreted Java in
the [JVM fatal-log convention](https://docs.oracle.com/en/java/javase/21/troubleshoot/location-fatal-error-log.html).
It is not evidence that this particular frame was compiled by C2. Earlier
compiled code could affect later execution, but that is a competing explanation,
not an established cause. JVM, TLC, host I/O and hardware explanations remain
open; no matching upstream fix was identified.

The original runner deletes its unique temporary directory before judging the
process result and reports only the last 1,200 output characters. Consequently,
the earlier error preceding bug(4) and the isolated run's named `hs_err` file
were not recovered. These missing artifacts are recorded as missing, not
reconstructed.

An [earlier finite-bridge gate](2026-09-06-finite-stochastic-cqm-bridge-results.md)
also retained a BFT queue-unpickle failure followed by unchanged successful
checks. The [upstream queue investigation](https://github.com/tlaplus/tlaplus/issues/1154)
concerns a related failure class, not this exact incident. The
[pinned string-reader source](https://github.com/tlaplus/tlaplus/blob/8ba1027/tlatools/org.lamport.tlatools/src/util/BufferedDataInputStream.java#L255)
already includes the reader corrections discussed there. Their original
commit ancestry alone would misleadingly suggest otherwise; this record
does not propose a jar upgrade on that basis.

## Controlled diagnostic boundary

Both direct runs used the clean writer at
`a4f25b391e8c28bedd5e08d4c7e403425422c1a8`. The jar, model, configuration and
pre-edit registry were hash-equal to the native writer's inputs. Their complete
SHA256 values are in the [manifest](data/2026-09-07-tlc-macos-c1-policy/manifest.json).
The absolute Java executable, its release file, runtime version, argument vector
and source identities were recorded before launch. Ambient `JAVA_TOOL_OPTIONS`,
`JDK_JAVA_OPTIONS` and `_JAVA_OPTIONS` were absent or empty.

The semantic argument vector kept the 64MiB initial and 4GiB maximum heap,
SerialGC, `-XX:-UseTypeSpeculation`, one worker, `BftConsensus.cfg` and
`BftConsensus`. The sole compiler-policy addition was
`-XX:TieredStopAtLevel=1`; per-run diagnostic paths were unique. JDK 26's
[tier definitions](https://github.com/openjdk/jdk/blob/jdk-26%2B35/src/hotspot/share/compiler/compilerDefinitions.hpp#L49)
identify tier 1 as C1 and tier 4 as C2/JVMCI. The existing type-speculation flag
is retained to preserve the compared vector even though C2 is excluded.

Each direct run had a 900-second external safety bound, with timeout recorded
as failure. Neither timed out. This diagnostic bound did not edit the pinned
runner's timeout. Acceptance required the pinned banner, normal completion,
exit zero, the exact distinct-state count and unchanged input bytes. Both
records explicitly keep `PinnedGatePassed=false`: these were alternate-policy
diagnostics, not replacements for the failed pinned gate.

The first emitted fingerprint index 95 and seed `7978938471659948499`; the
second emitted index 50 and seed `-8234170428385494648`. TLC defaults were kept.
The original failed tails lost those choices, so this is not a seed-matched
causal comparison. Team-controlled builds and tests were stopped for the two
runs; whole-host isolation was not measured. Elapsed values are engineering
observations, not a comparative performance benchmark. The existing TLC
recommendation to use ParallelGC remains visible in both logs; SerialGC was
deliberately retained.

The launcher retained full stdout/stderr and all files left by TLC. Successful
TLC completion removed its state working files; neither direct run produced a
crash report. Empty stderr files and their empty-byte hashes are retained.
The second run was authorized only after the first passed, and was the only
repeat. Two successes cannot estimate a reliable general failure rate.

## Policy validation and independent review

The shared registry adds C1 only to `jvmDarwinArm64Extra`. Both F# and TypeScript
consume that same entry. Direct assertions require the exact platform addition
and reject its appearance on other platform paths. Heap and worker settings,
jar, model/configuration bytes, expected state counts and timeouts remain
unchanged. Process failure retention and retry classification are owned by the
separate repair; this change adds no fallback or retry.

The own-tree gate at `47d29d9cb2dc7ebb2cf36135b6699bb9a0d66839` completed with
7,529 native passes, six existing skips and no failures across seven projects.
All 52 model cases exactly match the registry's gate roster and passed;
`BftConsensus` took 4m39.692s. Its existing exact state-count assertion remained
enabled. The direct F# C1 policy assertion also passed. A live child-process
snapshot confirms that the local BFT invocation used the C1 flag; this is not
a claim inferred from CI's platform filtering.

The CI-mapped, single-node Release build passed with zero warnings/errors in
103.59s. `dotnet format` exited zero with workspace-loading warnings and
notices that it does not format F# projects; its retained output is not an
F# formatting proof. The repository's F# lint passed. The TypeScript policy/helper suite
passed 17 tests and 88 assertions, and candidate quick preflight passed all
sixteen checks. Exact commands, source hashes, runtime identity, all seven
losslessly compressed original TRX files, full logs and model-case results
are indexed in [validation.json](data/2026-09-07-tlc-macos-c1-policy/validation.json).
The compression manifest records both stored and uncompressed byte hashes.
The own-tree gate is separate from the subsequent combined integration gate
for the retention repair and hidden-switch work.

The coordinating reviewer independently read every policy source/test/index
change, the complete report, historical launcher and evidence manifest at the
same source commit. That review accepted the platform scope, input preservation
and causal limits, and independently checked all thirteen original diagnostic
file hashes and lengths. It did not rerun the two diagnostics. The historical
launcher is preserved byte-for-byte; its successful version probes do not
imply the stronger pre-probe failure-retention guarantee being implemented by
the separate retention repair. Source-to-binary records remain engineering
provenance, not a formal derivation proof.

The final evidence pass independently verified all 28 retained record hashes
and lengths, all seven decompressed original TRX byte hashes/lengths, 95
current/source-commit input pins, all 7,535 individual test outcomes and the
exact 52-case registry roster. No material source, report or index finding
remained. Six individual outcomes are `NotExecuted`, although the TRX summary
counter named `notExecuted` is zero; the reported six skips come from the
individual outcomes and `total - executed`, not that misleading zero counter.
The formatter wording correction was explicitly accepted: only the Release
build carries the zero-warning/error claim.
