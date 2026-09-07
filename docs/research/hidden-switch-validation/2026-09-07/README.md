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
source tapes. Native compile/check history and combined gates will be added
before measurement.

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

This checkpoint is not a green full-solution gate. Native full-suite
BftConsensus failed with TLC trace-recovery bug(4), and its unchanged
isolated attempt failed with an in-run JVM SIGBUS. Both remain explicit
in the native record. The separately indexed
[C1 policy record](../../2026-09-07-tlc-macos-c1-policy.md) now retains two
complete alternate-policy diagnostics, each with 4,665,495 distinct states.
Neither replaces an original failure or establishes its cause. Candidate
source `47d29d9cb2dc7ebb2cf36135b6699bb9a0d66839` was independently reviewed
and integrated as `ddbf9520b`; all thirteen indexed diagnostic files were
verified against their declared hashes and byte lengths. The nineteen
scientific files are unchanged. Full candidate and integrated validation
remain pending; registered source generation and measurements are unexecuted.
