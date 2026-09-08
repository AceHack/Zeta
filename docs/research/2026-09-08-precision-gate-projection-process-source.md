# Precision projection native process custody

Date: 2026-09-08
Status: research-grade source and bounded fixture record
Operational status: research-grade
Author: Vera / OpenAI Codex / GPT-6 Astra
Scope: caller-bound file custody and command transport; no numerical certificate

## Contract and ownership

This module implements the coordinator-authorized process lane under the
[registered projection contract](2026-09-08-precision-gate-projection-proposed-contract.md),
its decimal and rendered-zero clarifications, and the
[distributional-learning co-claim](../claims/task-distributional-learning-20260908.md).
The [native implementation](2026-09-08-precision-gate-projection-native-implementation.md)
keeps the scientific contract. No final 40-subject / 88-call comparison has been
run by this launcher preparation, and no independent reference output was read.

[Source](../../src/Interp.Python/zeta_interp/precision_gate_projection_process.py)
and [dedicated tests](../../src/Interp.Python/tests/test_precision_gate_projection_process.py)
use two public, immutable dataclass results. Errors remain typed values even when
launch fails. Private control-flow exceptions do not cross the public boundary
under the ordinary finite-allocation/runtime premise.

`prepare_native(source_root, custody_root, host, expected)` returns
`PreparedNative`. The independent caller supplies exactly five `FileIdentity`
values (`Bytes:int`, `Sha256:str` uppercase 64): `@host`, the exact repo-relative
Replay script path, and its three actual literal `#r` DLL paths. The source parser
requires three unique DLL references, no `#load`/`#I` or nonliteral directives,
and paths within the declared source root. The admitted script's exact hash is
load-bearing: this parser is not a general F# source-security proof.

The actual script references Core, Core.Abstractions and Bayesian. All three are
copied, along with the script, preserving relative layout in an exclusively
created custody directory. The host is observed without copying. Each original
and copy identity is retained before the next fallible comparison/read. Four
exclusive files and their created-path prefix remain on failure; there is no
replacement or automatic retry. Failed preparation stays incomplete.

`PreparedNative` has exact fields `Complete:bool`, `Root:str`,
`Host:FileObservation|None`, `Script:FileObservation|None`,
`References:tuple[str,...]`, `Dependencies:tuple[DependencyObservation,...]`,
`CreatedFiles:tuple[str,...]`, `Failure:ProcessFailure|None`, and
`Cleanup:tuple[ProcessFailure,...]`. `FileObservation` is `Path,Bytes,Sha256`.
Each dependency has `Role` plus optional `Original,Copy,Before,Producer,After`.
The caller admits this returned preparation; the public dataclass is not an
unforgeable capability or an independently complete source/runtime theorem.

## One-command invocation and observations

`launch_native(prepared, raw_input, expected_input_sha256, expected_case_id,
expected_bindings, attempt_root, *, timeout_seconds=60.0)` returns a
`NativeObservation` directly. The expected flat binding map is supplied by the
coordinator; the producer does not select its own expectation. A finite timeout
in `(0,120]` seconds is required. Each attempt directory is exclusively created.
The exact argv order is:

```text
HOST fsi --exec COPIED_REPLAY INPUT_PATH EXPECTED_INPUT_SHA256 EXPECTED_SUBJECT_ID BINDINGS_JSON_PATH OUTPUT_PATH
```

The five native arguments together are bounded to 64 KiB UTF-8. The source and
binding files are exclusively written and re-read, all five directly used files
are checked before launch, and those same five files are checked afterward even
following a failed child. Only this directly owned child is polled/killed/joined.
Poll, kill, join and stream closure have separate guarded outcomes. A failed join
is retained; it is not descendant quiescence. Main and cleanup exit observations
remain separate, and disagreement refuses completion.

The child inherits the process environment with three recorded overrides:
`DOTNET_CLI_TELEMETRY_OPTOUT=1`, `DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1`, and
`DOTNET_NOLOGO=1`. Cwd is the custody root and stdin is DEVNULL. This is a declared
execution configuration, not a network sandbox or complete environment capture.

`NativeObservation` retains these exact public fields:

- `Complete:bool`, `Receipt:bytes|None`, `Argv:tuple[str,...]`;
- `StartedAtUtc:str`, `FinishedAtUtc:str`, `LaunchAttempted:bool`,
  `LaunchStartedAtUtc:str|None`, `ChildPid:int|None`;
- `ExitCode:int|None`, `CleanupExitCode:int|None`,
  `DirectChildClosed:bool`, `ReadersClosed:bool`;
- `Stdout:bytes`, `Stderr:bytes`, `StdoutEof:bool`, `StderrEof:bool`,
  `StdoutLimitExceeded:bool`, `StderrLimitExceeded:bool`,
  `StdoutFailure:ProcessFailure|None`, `StderrFailure:ProcessFailure|None`;
- `Failure:ProcessFailure|None`, `Cleanup:tuple[ProcessFailure,...]`,
  `InputFiles:tuple[FileObservation,...]`, `Output:FileObservation|None`,
  `Producer:dict[str,object]|None`;
- `Dependencies:tuple[DependencyObservation,...]`, `CreatedFiles:tuple[str,...]`,
  `EnvironmentOverrides:tuple[tuple[str,str],...]`.

ProcessFailure is exactly `Stage,Code,Message`, with message capped at 1,024
characters. It is a transport failure, distinct from the registered native
numerical Failure embedded in the returned bytes. The coordinator retains the
actual dataclass immediately, stores raw Receipt separately, and encodes process
metadata with a receipt descriptor. This module writes no substitute numerical
receipt on process failure.

## Finite reads and command admission

Raw input is bytes within 64 KiB before hashing. Caller binding JSON is sized
character by character for its exact ASCII-escaped encoding before serialization,
then checked against the 64 KiB cap. The roster has at most 1,024 members. This
counts quote/control/surrogate/astral expansion, not merely string lengths.

Every observed file is opened nonblocking/no-follow where those OS flags exist,
then admitted as regular using that same descriptor before reading. Reads consume
only initial size in bounded chunks plus at most one extra byte, check a 10-second
deadline between reads, and compare descriptor identity/size/timestamps afterward.
Input/script caps are 64 KiB, receipt cap 2 MiB, host/DLL caps 128 MiB each. Writes
are exclusive finite chunks with fsync and guarded close. The initial failure
survives secondary close errors. This stable owned-tree scope does not guarantee
kernel-I/O cancellation, hostile namespace isolation, aggregate OS memory quotas
or all possible mutation-race detection.

Two reader threads use nonblocking descriptors, 50-millisecond readiness waits
and an explicit cancellation event. They retain at most 128 KiB stdout / 64 KiB
stderr plus one observed byte each as an explicit overflow witness. They have no unbounded queue. Overflow,
read failure, timeout, missing EOF or unjoined readers refuse completion. An
incomplete reader can yield only its observed prefix. Cleanup first attempts a
one-second join, then cancellation and another one-second join if still alive.
A reader-owned pipe is closed only after its reader is observed finished; a
still-live reader retains ownership and a typed refusal. This is Unix pipe
transport on the verified host, not portable Windows pipe-readiness admission. Finite data serialization
and file operations remain separate from the child deadline; no universal wall
time or memory-allocation cancellation is claimed.

Complete transport requires closed exit 0, complete bounded stdout and receipt
bytes, exact newline-terminated command schema, actual file hash/length equality,
exact caller identity/bindings, bounded nonboolean counters, and returned-kind /
trace-length correspondence. Duplicate properties, nonfinite/floating JSON
numbers and malformed UTF-8 refuse. Full trace grammar, dyadic mathematics,
interval certification and final comparison remain separate checker obligations.
A transport-complete synthetic fixture is intentionally not a scientific receipt.

A successful command may carry an actual typed numerical refusal. Nonempty stderr
is retained and does not by itself exclude a successful command. The native
command currently reports two actual assembly witnesses (Core and Bayesian).
These must equal their copied identities. Core.Abstractions has before/after
custody with no invented producer observation. This five-file scope does not
establish transitive dependency/runtime closure or prove actual machine execution
from byte equality alone.

Receipt bytes and parsed command metadata are independently retained when
available, including exit 2 or receipt-read refusal. Available raw stdout remains
retained if parsing fails. A failed/oversized publication is never truncated into
a complete numerical result. Native in-memory values lost when its process dies
cannot be recovered by this file-only launcher.

## Bounded validation

Initial 13 fixtures passed; an expanded 17-fixture run also passed. The final
20-fixture run adds independent receipt-type/read refusal retention and exclusive
directory preservation. These use real temporary files, small owned Python
children for stream/timeout behavior, and explicit synthetic Popen/command seams
for failure combinations. No F# final subject or reference solver was called.

The fixtures discriminate byte-cap-before-hash, binding-size-before-serialization,
nonblocking FIFO refusal, changed copied DLL admission, actual fsync plus secondary
close failure, original wait observation versus cleanup failure, bounded streams,
actual failed executable launch, stdout/stderr retention, two producer witnesses
versus three copied references, and boolean counters. The synthetic receipts are
labeled as transport-only and do not substitute for independent numerical tests.

First Ruff/strict-mypy findings and intermediate source snapshots are retained:
explicit broad-catch boundary explanations, BinaryIO typing, redundant casts,
optional-observation narrowing, typed reader-join closure, test import ordering
and explicit test-owned stream cleanup. No initial failed log is rewritten as a
pass. Final immutable source/evidence and independent review are prerequisites
to coordinator integration. Full corrected-source gate remains separately logged.

The [immutable preparation inventory](precision-gate-projection/2026-09-08/process-preparation-1/manifest.json)
binds source `b575e34bd5cda05176ee14f89aedb2fa10edbb96`, all 66 retained
records (266,984 raw / 70,582 stored bytes) and 14 source/contract/wiring pins.
The first diagnostic logs without a separate command-completion JSON remain raw
tool-output records; later invocations retain their actual exit codes explicitly.
All stored and decompressed bytes were checked against the available originals.

## Reader ownership and available-byte corrections

Independent review of b575 identified a pipe-ownership race: its bounded join
could leave a reader alive, after which cleanup still closed that reader's pipe.
The author separately identified that a receipt-read close failure retained the
output hash but lost already-read receipt bytes because assignment followed the
fallible return. Both have retained failing fixtures against exact copied b575
source; neither is a numerical solver or final comparison observation.

The correction uses cancellable nonblocking readers and closes only a
known-finished reader's pipe. A real pipe with a still-open owned writer tests
cancellation without waiting for EOF or spawning an unowned descendant. A
synthetic failed-join seam with real files checks that unresolved reader ownership
leaves its pipe open, with a failure. The test owns the separate final cleanup.

An output-only available-bytes callback now retains the complete bytes before
fallible identity observation or close; the original close failure remains primary.
A real-close-then-error fixture preserves Receipt, Output and parsed Producer while
refusing completion. No dataclass field, argv, numeric rule or native source changes.

The initial copied correction ran 23 fixtures successfully. That intermediate
pre-formatter source preimage was not separately retained, so its log is an author
observation rather than an exact executed-source archive. Later formatted source,
strict-typing fixture correction and final repository-source checks are retained
separately. The previously retained 13/17/20 outcomes remain unchanged.

The final repository correction passed all 23 dedicated transport fixtures, Ruff
and strict mypy. Full preflight on the preceding b575 source completed with all
18 checks passed and source unchanged during execution. That result is historical
to the reader/receipt correction; the final source gate is recorded separately.

The [correction inventory](precision-gate-projection/2026-09-08/process-correction-1/manifest.json)
binds source `8254c827044100df1646369f1b0143ec994d5a07`, the two actual
pre-correction failing fixtures, exact final 23-pass source/results, intermediate
limitations and the historical all-18 gate. The final source gate remains a
separate observation. No final comparison was opened.
