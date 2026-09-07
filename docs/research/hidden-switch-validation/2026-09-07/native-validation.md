# Hidden switch: native source and validation record

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Author: Vera, OpenAI Codex using GPT-6 Astra
Scope: native implementation and hand conformance; registered measurements absent
Status: feature work awaiting combined full-suite recovery and implementation archive

## Registration and source boundary

The [protocol](../../2026-09-07-hidden-switch-protocol.md) was remotely
preserved before these native edits. The annotated registration tag is
`archive/experiments/081M1XK02XM087G0R00043EW05-registration`, with tag object
`2474dc79558390b57362d131f6d1c849280331c2` and peeled commit
`6a3150037a1e6be6ae89996dc8562f2061f7c75d`. Its exact protocol SHA256 is
`E6E2943D5991E70DBC95D3ED1E620AA7505D3E692315E80588729C9FCD03946A`.

This writer began from that registration commit. The nine native source
fingerprints are retained in [native-source-hashes.json](native-source-hashes.json).
They identify the final reviewed source bytes, including the three runners.
The test file and its project links are validation-only. This partial native
source record is not the complete integrated implementation manifest.

The implementation separates the private adapter/tape and scorer from the
policy's copied frame projection, posterior, supplied model and own pending
action. The recursive planner records actual expansions and uses numerical
child maxima; the root tie rule applies only when selecting an action.
The padded myopic arm performs the same tree traversal while selecting from
immediate values. Every episode retains all seventeen frame/projection
hashes and observations, sixteen actions, rewards, Q rows and counters.

The measurement runners require the distinct immutable implementation tag,
the registered protocol, all nineteen admitted source/fixture files, current
HEAD byte agreement, and loaded Core/Core.Abstractions identities. That tag
did not yet exist during these checks. No registered behavior source
(`9101`, domains `911..914`) or cost source (`9203`, domain `921`) was
generated or measured. A public measurement requires the integrated archive
and a separate coordinating release after full validation.

## Hand conformance and regression discrimination

The final [hand fixture](hand-fixture.json) contains sixteen transition rows,
four cue rows, forty conditioning rows, thirty planning rows, ninety-six
complete episodes and ten executable falsifiers. It is 476,473 bytes with
SHA256 `A37CBDB7B62399FA0A74ADFE0ADAFF7395863F89A47131FCDF0ABC68C4260A84`.
Successful hand attempts 2, 3, 4 and 5 were byte-identical. The first
successful [raw attempt](native-hand-attempt-2.json) is retained separately.
The command was:

```bash
mise exec -- dotnet fsi src/Research.FSharp/check-hidden-switch-kernel.fsx --hand NEW_OUTPUT.json
```

The explicit hand mode uses the four registered fixed bit tapes, not a
registered random stream. The parent independently compared the first
successful output with the separately written Python simulator and exact
Fraction alpha-vector oracle: all declared rows and episodes agreed, with
maximum absolute numerical difference `2.7755575615628914e-17`. Its separate
comparison receipt is owned by the coordinating integration. The final
unchanged hand hash allows that comparison to bind the retained fixture.

The sixteen focused native tests passed. They include actual runner
re-execution for suffix and private-band/scorer interventions, a guaranteed
state divergence after the changed future drift bit, copied frame/tape/Q
isolation, default-frame refusal, source/index bounds, padded equivalence,
and exact expansion accounting. The near-tie discriminator makes a depth-two
child's switch value slightly exceed harvest while root selection tolerance
still chooses harvest; it checks that the depth-three recursion propagates
the numerical maximum, not the lower tie-selected value.

The bounded independent scientific review prompted the suffix divergence,
source/index bounds, binary substitution qualification and stronger near-tie
test. Its initial null-record concern was retracted after confirming that
`GameEnvironment.Frame` is a struct; default-struct refusal is tested instead.
The separate admission review accepted exact recursive DTO field/type
checks, duplicate/nonfinite rejection, SourceCommit/source/runtime equality,
the single nonblank behavior argument, early output refusal and typed
missing-git failure publication. These are source/test observations, not a
claim that ten boolean flags alone prove noninterference.

## Admission and size evidence

The measurement CLI attempts before archival refused with incomplete
receipts and empty panel/row rosters. The [missing-git attempt](native-refusal-missing-git.json)
used an absolute SDK path with a child-only unavailable-tool PATH. It retained
`Complete=false`, `Failure.Code=git-launch` and empty panels. The
[cost refusal](native-cost-refusal-no-archive.json) retained the exact bytes'
input hash immediately after reading the hand fixture, then refused absent
implementation admission with no cost rows and `SourceDraws=0`.

The [size calculation](native-size-bound.json) uses only the fixed schema
and hand outputs. Compact serialization retains every registered field.
The conservative bound is 5,700 bytes per episode plus separators and a
1 MiB envelope/provenance reserve: 94,453,760 bytes for all 16,384 behavior
episodes, below both 100,000,000 bytes and 100 MiB. It is a premeasurement
serialization bound, not an observed registered receipt size.

Loaded DLL hashes and MVIDs identify execution bytes. Source hashes do not
by themselves prove a source-to-binary correspondence; build and independent
reference evidence have separate roles. The cost payload is explicitly a
partial logical numeric/frame ledger, excluding object headers, strings,
options, recursion, Q/trace arrays, digests, allocation overhead and peak heap.

## Local gates and unresolved TLC failures

| Check | Outcome | Retained evidence |
| --- | --- | --- |
| Focused native tests after final scientific refinements | 16 passed, 0 failed | [focused attempt 3](native-focused-3.log) |
| Full Release build | 0 warnings, 0 errors; 42.78 seconds | [build](native-build-full.log) |
| `dotnet format --verify-no-changes` | exit 0; ordinary F# unsupported-project notices retained | [format](native-format.log) |
| Derived build graph | derive/write and prettier reported unchanged | project links validated; no graph diff |
| Quick preflight | all 16 checks passed | [quick preflight](native-preflight-quick.log) |
| First full solution test | 7,544 passed, 6 skipped, 1 failed | [full attempt 1](native-tests-full-attempt-1.log) |
| Unchanged isolated BftConsensus | 0 passed, 1 failed; 15.6807 seconds | [isolated attempt 1](native-tlc-isolated-attempt-1.log) |

The full run's only failure was the existing `BftConsensus` TLC check:
`Failed to recover the initial state from its fingerprint` and
`This is probably a TLC bug(4)`, exit 1. The F# suite reported 6,554 passed,
6 skipped and 1 failed; the other six suites totaled 990 passed. No hidden
switch test failed. The first full gate remains failed in this record.

After the coordinating Core build finished, one explicit unchanged
diagnostic ran without another build:

```bash
mise exec -- dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --no-build --filter 'FullyQualifiedName~TlcRunnerTests&DisplayName~BftConsensus' --logger 'console;verbosity=normal'
```

It failed differently: JVM exit 134, SIGBUS in
`tlc2.value.impl.FcnRcdValue.write`, on OpenJDK `26+35-2893`, serial GC,
`bsd-aarch64`. The reported `hs_err_pid82208.log` was absent when inspected
after the test. The existing runner deletes its unique Guid metadir after
capturing output; the raw console report is retained here. It also uses this
writer's own specs working directory and a per-process model semaphore.
These facts do not identify the cause of either failure or establish a
cross-clone collision. No model, JVM policy, runner, timeout or suite was
edited; no failure was suppressed or retried into a green claim.

Native work is parked for the parent's combined source integration. The
parent owns investigating the persistent TLC failure and obtaining the
fresh full solution gate before implementation archival or measurement.
The independent local build/focused successes do not substitute for that gate.

## Complete retained attempt index

- Compile-only diagnostics, before successful hand execution:
  [1](native-compile-1.log), [2](native-compile-2.log),
  [3](native-compile-3.log), [4](native-compile-4.log),
  [5](native-compile-5.log), [6](native-compile-6.log),
  [7](native-compile-7.log). These retain F# inference, computation-expression
  and script parsing failures repaired before the successful compile.
- Hand runner logs: [1](native-hand-1.log) (compile refusal, no hand JSON),
  [2](native-hand-2.log), [3](native-hand-3.log),
  [4](native-hand-4.log), [5](native-hand-5.log).
- Focused test logs: [1](native-focused-1.log) (assertion syntax compile
  failure), [2](native-focused-2.log) (16 passed),
  [3](native-focused-3.log) (16 passed after the stronger near-tie witness).
- Behavior admission logs: [first compile refusal](native-refusal-no-archive.log),
  [attempt 2](native-refusal-no-archive-2.log) with
  [raw receipt](native-refusal-no-archive-attempt-2.json),
  [attempt 3](native-refusal-no-archive-3.log) with
  [raw receipt](native-refusal-no-archive-attempt-3.json).
- [Missing-git log](native-refusal-missing-git.log),
  [cost admission log](native-cost-refusal-no-archive.log), and their raw
  incomplete receipts linked above.
- Full build, formatter, failed full test and failed isolated TLC outputs
  are linked in the gate table. Logs are preserved as emitted, including
  writer-local paths; none is a registered behavior or timing receipt.
