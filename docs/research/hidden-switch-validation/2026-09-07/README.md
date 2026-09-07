# Hidden switch validation records

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra

See the [implementation review](../../2026-09-07-hidden-switch-implementation-review.md)
and [frozen protocol](../../2026-09-07-hidden-switch-protocol.md).
These are deterministic hand checks and implementation validation records;
registered measurements are a separate phase after implementation archival.

- [First hand comparison](hand-comparison-attempt-1.json): ninety-six complete
  native/Python episodes plus exact grids and executable falsifiers.
- Focused Python initial and final logs retain commands and exit codes:
  [initial tests](python-focused-initial.log),
  [final tests](python-focused-final.log),
  [initial types](python-types-initial.log),
  [final types](python-types-final.log),
  [initial lint](python-lint-initial.log),
  [final lint](python-lint-final.log),
  [initial formatting](python-format-initial.log),
  [final formatting](python-format-final.log).

The initial captured suite passed 124 cases. The final captured suite adds
five metadata/overflow cases and passes 129. Neither run generates registered
source tapes. The later sections retain native compile/check history and combined gates.

Archive-ref admission parity was added before freezing implementation.
The [wrapper tests](python-archive-ref-tests.log) pass 64 cases and the
[four-file mypy check](python-archive-ref-types.log) passes. These checks
include both lightweight-tag replacement refusals and generate no source
stream. The separate reference index guard now has 68 focused cases.

## Concurrent CI pagination repair closure

[PR #16912](https://github.com/Lucent-Financial-Group/Zeta/pull/16912)
merged at 10:11:15 UTC as `a97d61b78c73e2366b16d6c54662a94ca688740d`,
from checked head `a4f25b391e8c28bedd5e08d4c7e403425422c1a8`.
The owner verified main ancestry, all seven reviewed implementation/evidence
files and the complete signed squash body. The root integrated that main
commit before hidden-switch implementation archival.

The final matrix was 89 successes, two skips and one advisory failure,
with no pending checks. Required gates, all current platform tests and
current drift-canary jobs passed. The
[retained advisory output](pagination-final-advisory.log) for job
101703975046 reports historical Windows ARM and Windows2025 rows with
39 failures in 59 runs (66.1%), last run 34081134674. It explicitly identifies
a manually disabled publisher and frozen ledger. This historical aggregate
is not presented as a current pagination-test regression or a fully green
matrix. The separate [repair record](../../2026-09-07-required-check-pagination-correction.md)
retains the omitted-page witness, implementation and 36-test/67-assertion gate.

## Integrated native and Python checkpoint

[Native validation](native-validation.md) retains all compile fixes, hand
and admission attempts, the successful native build, and both unresolved
TLC failures. Native source commit `31ee67f9b4ed68ce6d0b52d1bdeb223c48d57dbb`
was integrated as `6e43857a0a536c88f64cffdb72708840114857e8`.
The [nineteen-file manifest](implementation-source-manifest.json) verifies
all scientific files against that declared commit before archival.

The root's first [Core build](root-core-build.log) failed with MSB4166
because two worker nodes exited prematurely. The reported diagnostic
directory was absent at inspection; the
[retained observation](root-core-diagnostic-attempt-1.json) establishes
no cause. An unchanged-source [single-node recovery](root-core-build-recovery.log)
passed in 24.26 seconds with zero warnings/errors. It used `-m:1 -nr:false`
and an explicit diagnostic directory; no diagnostic file was emitted.

The subsequent [combined mapped Release build](root-build-combined.log)
passed in 106.07 seconds with zero warnings/errors. All
[sixteen hidden-switch native tests](root-hidden-focused.log) passed.
The fresh [root hand run](root-hand.log) produced
[root-hand-fixture.json](root-hand-fixture.json), byte-identical to the
[archived candidate fixture](hand-fixture.json). Its
[final independent comparison](hand-comparison-final.json) passes all
sixteen transitions, four cues, forty conditioning rows, thirty planning
rows, ninety-six episodes and ten executable falsifiers. Maximum absolute
numerical error remains `2.7755575615628914e-17`.

The combined Python [collection](python-combined-collection.log) and
[full test run](python-combined-tests.log) both contain 431 cases. All 431
passed in 111.31 seconds with one existing HookedTransformer deprecation
warning. [Mypy](python-combined-types.log) passed 39 source files;
[Ruff](python-combined-lint.log) and [format verification](python-combined-format.log)
passed, with 40 formatted files. The Interp workflow floor is raised from
299 to the actually collected 431; targeted actionlint also passed.

At that earlier checkpoint, the full-solution gate was not green. Native full-suite
BftConsensus failed with TLC trace-recovery bug(4), and its unchanged
isolated attempt failed with an in-run JVM SIGBUS. Both remain explicit
in the native record. The separately indexed
[C1 policy record](../../2026-09-07-tlc-macos-c1-policy.md) now retains two
complete alternate-policy diagnostics, each with 4,665,495 distinct states.
Neither replaces an original failure or establishes its cause. Candidate
source `47d29d9cb2dc7ebb2cf36135b6699bb9a0d66839` was independently reviewed
and integrated as `ddbf9520b`; all thirteen indexed diagnostic files were
verified against their declared hashes and byte lengths. The nineteen
scientific files are unchanged. Candidate and integrated validation were still pending at that checkpoint;
the later combined-gate section records their completion.

## Combined gate after the two TLC repairs

The root integrated the reviewed C1 policy and attempt-retention/capture
repairs without changing any of the nineteen scientific files. The exact
combined source commit is `457bdf094f368eb9e6f2b359b72e5677fd015eb3`.
The [prelaunch inventory](root-final-gate-attempt-1.json) identifies every
admitted runner, registry, jar and local model/configuration input before
execution. The [derived result index](root-final-gate-results.json) records
all seven project outcomes and hashes of the losslessly retained original
TRX archives. Individual test outcomes, rather than the TRX summary's unused
`notExecuted` counter, establish the six existing skipped cases.

The [mapped Release build](root-final-build-attempt-1.log) passed with zero
warnings/errors in 101.75 seconds. The [full solution test](root-final-tests-attempt-1.log)
completed at 11:44:01 UTC with 7,552 passes, six existing skips and no
failures. All 52 model IDs exactly match the registry's gate roster and
passed; all eighteen TLC synthetic/metadata checks and all sixteen
hidden-switch native tests passed. Every prelaunch input hash remained
unchanged, and no unexpected attempt directory remained after completion.

The [live BFT observation](root-final-bft-observation.json) retains its
[invocation](root-final-bft-invocation-live.json) and
[runtime identity](root-final-bft-runtime-live.json). It verifies use of the
new private input workspace, admitted source commit and C1 argument during
this gate. That active snapshot was not itself a completed result; the
subsequent TRX outcome supplies completion. The
[team activity record](root-final-team-activity.json) discloses a pre-existing
quick-preflight overlap at build launch and makes no whole-host isolation
or causal claim about earlier failures.

This successful combined native gate does not replace either earlier TLC
failure or the compiler failures. The Interp 431-case gate above concerns
unchanged Python/scientific source. A separately discovered CI failure in
historical NCI receipt tests requires an explicit historical registry
fixture and current-registry refusal checks; that Python/TypeScript
correction has now completed the separate validation recorded below.
Registered hidden-switch source streams and costs remain unexecuted.

Original combined test records, losslessly compressed:
[Bayesian.Tests](root-final-Bayesian.Tests.trx.gz),
[Core.CSharp.Mediator.Tests](root-final-Core.CSharp.Mediator.Tests.trx.gz),
[Core.CSharp.Tests](root-final-Core.CSharp.Tests.trx.gz),
[Tests.CSharp](root-final-Tests.CSharp.trx.gz),
[Tests.CSharp.TypeProvider](root-final-Tests.CSharp.TypeProvider.trx.gz),
[Tests.FSharp](root-final-Tests.FSharp.trx.gz),
[Tests.FSharp.Git](root-final-Tests.FSharp.Git.trx.gz).

## Final receipt integration before archival

The historical NCI correction was independently reviewed and integrated from
`e2a11ebc9ca5e94c02656e904ddef9ba1b4f32f5` as `7882a31f0`. Its
[policy and fixture record](../../2026-09-07-tlc-macos-c1-policy.md) preserves
the original failed CI outputs, unchanged historical receipt/pins, explicit
current-registry refusal and corrected exception propagation. The original
source and evidence history remain under its separate annotated final tag.

Current main `cd9c44c20290a366415f946c000b39fad64ccf21` then integrated as
`7e9b8681c2e619316ed2439fd313cb8ae3d5f42e`. The resulting complete
[Core.Python suite](root-final-core-python.log) passed 63 cases in 77.63s.
The affected [TypeScript receipt suites](root-final-nci-ts.log) passed 26
cases and 54 assertions on CI's Bun 1.3.13. The
[scope record](root-final-scope.json) binds both exact commands and full logs
to the integrated source. All 98 prelaunch native/TLC inputs and nineteen
scientific files still match the completed combined native gate. That
unchanged-source gate was not repeated for the Python/TypeScript integration.

The final [quick preflight](root-final-prearchive-quick.log) passed all sixteen
checks and is retained separately from the mandatory subsequent push hook. Implementation archival
and registered measurement follow these checks; these validation results
are not behavioral or cost observations.

The [prepared measurement launcher](measurement-launcher.py.txt) checks the
remote annotated implementation archive, current HEAD, nineteen source hashes
and two loaded-DLL byte hashes before invoking the registered CLIs. It retains
phase commands, process-name snapshots without arguments, exit codes and
before/after source and binary identities. It adds no warmup, retry, row
replacement or scientific policy. Preparing this wrapper generates no source
tape; its later invocation and outputs belong to the measurement record.

## C1 publication review disposition

At C1 PR #16917 head `e2a11ebc9ca5e94c02656e904ddef9ba1b4f32f5`,
CodeQL classified the two assertions after the nested context-manager test
as unreachable. The outer `pytest.raises` suppresses the expected original
exception after the inner context manager propagates it, so execution resumes
at both assertions. Root and the independent-reference writer accepted this
source-level interpretation. The author then retained an
[executed line-trace witness](c1-codeql-reachability.json) with assertions
enabled and explicit line events for 85 and 86; it returned normally on the
exact checked source. The [executed script](c1-codeql-reachability.py.txt)
and [empty stderr](c1-codeql-reachability.stderr) are original bytes. The
review disposition requires no source mutation or new scientific run.

The [C1 advisory drift output](c1-final-advisory-drift.log) records the
separate nonblocking historical Windows rows: 43 failures in 59 runs
(72.9%), last main run 34118407589. It explicitly reports the manually
disabled publisher/frozen ledger. Current required/platform tests passed;
the matrix with this advisory failure must not be described as all-green.
Final merge ancestry remains a separate publication check.
