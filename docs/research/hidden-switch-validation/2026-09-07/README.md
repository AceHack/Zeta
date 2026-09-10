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
At that checkpoint, registered hidden-switch source streams and costs were
still unexecuted. The later [result record](../../2026-09-07-hidden-switch-results.md)
retains their completed first attempts after implementation archival.

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
The [publication proof](c1-final-publication.json) now verifies PR #16917
merged as `536570576cfb980f6303be2040d8d3034b2ac13d` at 12:28:36 UTC,
main ancestry and all eight changed source/test files against the exact
checked head. The owner verified the complete signed squash body. Final
expanded rollup: 93 successes, six skips and one nonblocking historical
drift failure, with no pending checks; the earlier premerge snapshot was
91 successes and four skips plus that same advisory failure.

## Initial publication checks and retained failures

Draft [PR #16928](https://github.com/Lucent-Financial-Group/Zeta/pull/16928)
at `f52b00065eb8055a32aea4bd93628df7537f4949` completed its initial
[expanded check snapshot](root-ci-initial-checks.json) with 86 successes,
four skips and six failures. None remained pending at that observation.
These publication failures do not replace the earlier native gate or the
archived scientific outcomes.

The original failed-job outputs are losslessly retained, with retrieval
commands, source head, byte lengths and hashes in each adjacent record:

| Job | Original output | Retrieval record |
| --- | --- | --- |
| Hygiene | [Log](root-ci-hygiene-failure.log.gz) | [Identity](root-ci-hygiene-failure.json) |
| File-copy race audit | [Log](root-ci-toctou-failure.log.gz) | [Identity](root-ci-toctou-failure.json) |
| TypeScript hermetic tests | [Log](root-ci-ts-hermetic-failure.log.gz) | [Identity](root-ci-ts-hermetic-failure.json) |
| macOS build/tests | [Log](root-ci-macos-failure.log.gz) | [Identity](root-ci-macos-failure.json) |
| Required aggregate gate | [Log](root-ci-gate-failure.log.gz) | [Identity](root-ci-gate-failure.json) |
| Historical drift advisory | [Log](root-ci-drift-failure.log.gz) | [Identity](root-ci-drift-failure.json) |

Hygiene identified the TypeScript fixture's `setTimeout(...,10000)`;
the race audit identified path inspection followed by reopening/copying the
path. The hermetic suite failed the corresponding two live-tree assertions.
The macOS build succeeded, but the inherited-pipe fixture expected a launcher
exit of zero and observed 137: its 500 ms deadline had not established the
intended exited-launcher state. The required gate reflected the TypeScript
failures; macOS was separately marked nonblocking in that workflow. These
are actual tooling/test failures, not a fully green matrix.

The drift advisory separately reports historical Windows rows with 46
failures in 59 executions (78.0%), last run 34122703611, and the deliberately
disabled publisher/frozen ledger. It is not a new hidden-switch test result.
The corrective dependency is
[PR #16925](https://github.com/Lucent-Financial-Group/Zeta/pull/16925).
Its reviewed descriptor-based TypeScript copy and observed-exit F# fixture
are validated separately before integration; no original scientific source,
receipt, measurement or archive is changed to resolve these findings.

## Public reference roster review

CodeQL reported the reference module's `PANELS` global unused. The existing
test `test_registered_constants_and_hand_tapes_are_complete_and_immutable`
reads `ref.PANELS` and asserts its ordered names. The
[targeted existing test](root-codeql-panel-roster-test.log) passed once;
its [execution/source record](root-codeql-panel-roster-test.json) identifies
the unchanged publication head and exact files. This is a test consumer,
not a claim that production replay imports that roster: replay deliberately
defines its own independent roster. The
[review disposition](../../2026-09-07-hidden-switch-result-review.md)
records independent source review and preserves the frozen module unchanged.

## Corrected publication integration

The independently reviewed TypeScript correction
`91baf83d79c146367b8183c58732bb8f437eb55b` and F# correction
`3149e2596fb12935ceb3c27568da7b16d405b548` were integrated through the
source owner's `4b4d9a237b23e53a4b297af72eb2053f3c51c8b6` as root
merge `76d2a58`. The owner's full mapped gate on that source passed a
105.43-second Release build with zero warnings/errors and 7,539 tests,
six existing skips and no failures; all 52 formal models and eighteen
synthetic cases passed. Its original records belong to the
[tooling correction](../../2026-09-07-tlc-attempt-retention.md).
This is its smaller integration's actual count, distinct from the older
root gate's 7,552 passes.

Root then integrated current main `a3926e6b2` as `b3b120a` and compared
all 103 of the owner's selected prelaunch inputs. The only difference is
six additional hidden-switch source/test links in the F# test project;
the [prelaunch record](root-publication-integration-attempt-1.json)
retains that exact diff and all actual hashes. The
[fresh mapped F# test-project build](root-publication-build-attempt-1.log)
passed in 77.86 seconds with zero warnings/errors, and the
[sixteen additional hidden-switch tests](root-publication-focused-attempt-1.log)
passed. Their [original TRX](root-publication-focused.trx.gz) and
[derived execution/hash record](root-publication-integration-results.json)
are retained. All 103 local input hashes and nineteen scientific source
hashes remained unchanged across this check.

Root did not repeat the full formal-model gate or collect new scientific
measurements for this integration. The source comparison plus targeted
additional tests establishes the stated coverage; it is not whole-tree
identity, a newly executed combined test count or source-to-binary proof.
Final publication-head CI and main ancestry remain separate requirements.

The [independent publication-integration review](../../2026-09-07-hidden-switch-publication-integration-review.md)
accepted those exact source/hash/log/TRX correspondences, unchanged original
receipts, retained failed CI outcomes and the separately registered next-study
pointer. It performed no new test or scientific execution. The completed
[quick preflight](root-publication-integration-quick.log) passed all sixteen
checks before publication's separate mandatory push hook.

The [remote archive verification](root-tlc-correction-archives.json) preserves
both the unchanged original TLC tag at `c247403be` and the supplemental
correction tag at `038ff0e3c`, whose source/evidence was imported as
`ac00602`. The supplemental tag does not replace the failed original version.

## Final main integration and local test-host crash

PR #16925 merged as `c36ac21bf1c561ad0726d4dceb027d3c3cff823e`.
Root integrated that main state as
`4d7b13947bef9b53a65c043885971ceefa168e87`. Concurrent main changes
included native filesystem code and tests, so this integration received a
fresh full native gate. The [prelaunch inventory](root-main-gate-attempt-1.json)
pins 1,955 selected native/build/TLC inputs plus the nineteen original
scientific files. This selected inventory is not a complete transitive
runtime dependency or source-to-binary proof.

The [mapped Release build](root-main-build-attempt-1.log) passed in 96.29
seconds with zero warnings and errors. The [original full-solution test
command](root-main-tests-attempt-1.log) returned exit 1 at 13:57:11 UTC.
Its F# test process reported a catastrophic exit 139. Six other projects
completed with 990 passes; the F# TRX retained 1,204 completed passes but a
failed result summary. The console's partial `Passed!` line therefore does
not establish completion. The [derived failed-run index](root-main-gate-attempt-1-result.json)
binds all seven losslessly compressed original TRX files and the original
sequence record: 1,228 tests started, 1,204 completed and 24 were in flight.
All 1,955 selected input hashes were unchanged after the failed command.

The [original launcher](root-main-gate-launcher.py.txt) exits on command
failure and emits its completion JSON only on success. That success-only
file was therefore absent; the separately named failed-run index records
the actual failed outcome rather than inventing a successful completion.
No archived behavior or cost experiment was rerun or replaced.

The affected TypeScript suites independently passed 73 tests and 265
assertions on CI's Bun 1.3.13. Their [full log](root-main-typescript-tests.log)
and [source/command identity](root-main-typescript-tests.json) are retained.
This check ran concurrently with native tests; no exclusive-host or
performance claim follows from these validation runs.

The [bounded crash-location review](root-main-crash-review.md) matches the
faulting process to a background server-GC stack in `libcoreclr.dylib`.
The current runtime file has the same Mach-O UUID as the loaded faulting
image. That identifies a location, not a cause: a runtime defect and prior
memory corruption are not distinguished. The original process-memory dump
and full macOS report remain local only; their identities and a bounded
extract are retained, without claiming git-canonical custody of raw memory.
No GC, JVM, source or runtime policy changed to obtain a passing run.

The [single unchanged-source recovery](root-main-tests-attempt-2.log) ran
from 14:09:31 to 14:17:03 UTC with the same full-solution command except a
fresh TRX output prefix. The [prelaunch record](root-main-gate-attempt-2.json)
checks all original selected inputs and additionally fingerprints selected
test-output DLLs. The [completion record](root-main-gate-attempt-2-completion.json)
records exit zero, all 1,955 selected inputs unchanged and all selected DLLs
unchanged. All seven projects completed: **7,568 passes, six existing skips
and no failures**. The [original TRX archive index](root-main-gate-attempt-2-result.json)
and [executed indexer](root-main-result-indexer.py.txt) retain individual
outcomes, all 52 exact registry model IDs, eighteen synthetic/metadata cases
and sixteen hidden-switch cases. No unexpected TLC attempt directory remained.
The [live BFT snapshot](root-main-attempt-2-bft-observation.json) independently
retains its source/argument and runtime identity during this recovery; the
completed TRX provides its outcome. The [recovery launcher](root-main-recovery-launcher.py.txt)
records both command failure and success without replacing an earlier attempt.
This completed recovery does not establish the first crash's cause or erase it.

The [independent prior-head CI review](pr-16928-a2bf4225-review/README.md)
retains four complete pages at exact published head `a2bf4225`: 92 successes,
three skips, one failed historical-drift advisory and no pending checks.
The required gate and all three native platforms passed; its sole review
thread was resolved. That review also independently confirms the first
local run's incomplete TRX outcome. The final publication head still requires
its own current check and ancestry verification.

The [TLC dependency publication proof](../../tlc-attempt-retention-validation/2026-09-07/publication-proof.md)
retains merge `c36ac21bf`, its actual source correspondence, both unchanged
archive identities, scoped CodeQL test-alert dispositions and original
failed/recovery CI outputs. Neither these tooling records nor the later
[descriptive figure](../../hidden-switch-results/2026-09-07/descriptive-figure/README.md)
changes a scientific source or original result receipt.

The [first final-publication quick preflight](root-main-publication-quick-attempt-1.log)
passed fifteen checks and failed Markdown's MD012 rule on three extra blank
lines in the two edited record indexes. Removing those blank lines passed
targeted Markdown verification. Original logs and structured evidence were
not reformatted to make the documentation check pass.

The [corrected final quick preflight](root-main-publication-quick-attempt-2.log)
passed all sixteen checks. The publication push additionally runs the mandatory
pre-push hook on the exact committed head.

The [independent final recovery review](../../2026-09-07-hidden-switch-final-recovery-review.md)
accepts the full seven-project XML outcomes, 1,955 selected source bindings,
81 selected DLL fingerprints, unchanged original study records and figure.
It preserves each tested/reviewed head and the first failed attempt as
separate evidence; it performs no new test or scientific execution.

## Later publication scan and lossless API packaging

The replacement CI run at published head `f3bd1347e` found three literal
U+FEFF BOMs in a retained GitHub merge-response JSON file. These were within
embedded old log patches, not scientific source. The [focused packaging
record](root-final-api-bom-packaging.json) binds the exact original and its
lossless gzip replacement. The original 711,308 bytes recover exactly;
the twenty-four-record tooling publication manifest now records both forms.
No broad rule exclusion, character stripping, raw-response reserialization,
scientific criterion change or experiment rerun was used. The earlier native
recovery and all nineteen scientific source hashes retain their stated scope.

The [independent finding and original failed CI output](publication-json-bom-correction/README.md)
retain replacement run `34133618773`, failed job `101780447107`, exact
BOM locations and the original response/log identities. The diagnosis did
not replace the failed check or mutate a CI run.

The independent reviewer accepted the actual gzip correction: all twenty-four
current tooling-manifest entries match their bytes, the other twenty-three
entries remain identical to published `f3bd1347e`, and decompression exactly
recovers the original response. The changed manifest and packaging record
agree with the separately retained finding.

Both [full local Semgrep scans](root-final-api-semgrep-validation.json) passed
with zero findings using both exact CI configurations and Semgrep 1.174.0.
The original compressed logs retain warnings and all scanner exclusions,
including oversized and ignored files; zero findings is not a claim that
excluded files were scanned. These are validation runs on the corrected
working tree, not registered experiments or a new native gate.

The [packaging correction quick preflight](root-final-api-gzip-quick.log.gz)
passed all sixteen checks before its separate mandatory push hook. The
native build/test gate was not repeated for this evidence-only packaging
change; the nineteen scientific files and original result records are unchanged.

## Main publication prerequisite verified

The [coordinator main publication proof](main-publication/README.md) verifies
PR #16928 merge `1193d505d`, full signed body, refreshed main ancestry and
all nineteen scientific/eighteen original result records. Final paginated
CI outcomes remain separately recorded. No original experiment was rerun.
