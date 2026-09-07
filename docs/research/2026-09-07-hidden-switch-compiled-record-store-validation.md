# Guarded hidden-switch compilation: exclusive recorder store

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: bounded implementation validation and independent source acceptance

The [new record store](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_record_store.py)
retains sequential recorder artifacts using the existing reviewed exclusive
storage and bounded result encoder. It does not execute a supplied operation,
replay a receipt, launch native code or admit a scientific phase. This is an
implementation prerequisite for the [outer-negative recorder](2026-09-07-hidden-switch-compiled-outer-negative-design.md),
separate from the frozen scientific protocol and per-envelope parser limits.

## Public interface and ownership

`open_store(root, attempt_name, limits)` attempts exactly one actual
`storage.create_directory` call. The root must be a caller-admitted absolute
`Path`; the name is one bounded path component. Success returns an issued
`Store` and its initial `Snapshot`. An `OpenFailed` retains the known root,
attempted path and actual creation observation. Refusal after mkdir, fsync or
close never becomes a successful ownership claim; existing directories are
never adopted or cleaned up.

An issued store supports `append_bytes`, `append_result`, `snapshot` and
`finalize`. Normal files use sequential `record-000000.bin` or `.json` names;
roles do not select filesystem paths. The reserved final name is
`final-journal.json`. No failed path is retried, overwritten or deleted. The
coordinator separately handles the returned opaque store; it records the
public snapshots and results, not the private handle state.

Each `RecordAttempt` retains the supplied actual value, path, expected
six-field identity descriptor when known, and each actual encoder/write/read
observation. `CallObservation` distinguishes a returned object from a raised
helper exception. The small exception boundary intentionally captures ordinary
`Exception` values with their type and message; control-flow `BaseException`
subclasses are outside that boundary. It never fabricates a returned admission
from a raised exception.

`Stored` requires the real exclusive write and subsequent descriptor-bound
read to succeed with exact bytes. A `StoreFailed` retains the first refusal,
current attempted metadata, supplied actual return and immutable prefix tuples.
Caller-owned values are observed by reference, not deep copied: stable values
and sequential calls are explicit premises. Unissued or copied handles refuse;
issuance is an ordinary same-process boundary, not a hostile-Python sandbox.

## Reservations and finalization

The default **256 MiB combined raw-plus-stored ceiling** is an implementation
retention bound. All current artifacts use identity encoding, so each output
byte charges both counters. At opening, **8 MiB combined** is reserved for the
final journal: 4 MiB raw and 4 MiB stored. Its slot is included in the total
4,096-artifact limit. Tests may lower the even byte budgets and count, but
cannot raise any implementation maximum.

Before result expansion, the actual encoder receives at most half the remaining
normal combined quota. Before a fallible write, the full known raw and stored
lengths and file slot are charged. A partial write, fsync failure, cleanup
refusal or late read error never refunds those reservations. A failed quota
attempt can retain metadata without consuming an unavailable slot; attempts
and reserved artifacts are therefore distinct counts. Empty files still need
slots. Caller-supplied objects and external fixture writes are outside these
controlled-write reservations. The bound does not promise exact process peak
memory, a filesystem quota, or isolation against other writers.

The first refusal stops normal writes. `finalize` can then use only its
pre-reserved slot and budget, once. Its journal is a metadata snapshot taken
before that final encoding/write/read attempt; successful byte outcomes appear
there as explicit length/hash observations and artifact links. Complete actual
helper returns remain in the public result DTOs. Values that could not be
encoded remain in the returned failure, with no claim that this journal made
those values durable. A separate outside recorder may retain them if possible.

`FinalizationFailed` keeps the journal failure separately from the earlier
primary failure. There are no recursive rewrites or retries. The snapshot does
not certify its own final write, subsequent path stability or the complete
outer evidence envelope. Finite encoder limits still apply: a reserved budget
makes a bounded final attempt possible, not a guarantee that every metadata
snapshot can be encoded or that the operating system will accept the write.

## Source, tests and retained capture

Source/test pin: `f45a7aca501e2dc5125b5f3863ecb83862780eb0`.
The existing encoder was imported unchanged from coordinator
`ba5359b726b10521f5573b09d5ad73bcdfd7f668`; this writer's dependency cherry is
`3edc927` and should not be reimported into the coordinator. Encoder, storage
and admission bytes were checked against that coordinator source before work.

The [lossless validation manifest](hidden-switch-compiled-validation/2026-09-07/record-store-attempt-1/manifest.json)
binds the four loaded task modules plus the new test file, the exact capture
harness, diagnostics, public result records and retained owned filesystem
bytes. The first focused run passed 39 of 40 tests: its close witness incorrectly
counted earlier reuse of the same numeric descriptor during directory traversal
as a second close of the later file. The corrected witness begins tracking
repeated closes only after the actual file close and injected refusal. Original
source and failure output remain preserved. This was a test-instrumentation
correction, not an observed duplicate close in the storage helper.

After the remaining type/style corrections and additional boundary cases,
**47 focused tests passed in 4.09 seconds**. Strict source/test mypy, Ruff and
format checks passed. Tests execute real exclusive files, partial writes,
fsync failure, actual close followed by an error, changed read-back bytes,
preserved earlier failures, input/encoding/count/byte refusals and once-only
finalization. They also retain deliberately unexpected helper return types and
raised errors without relabeling them as successful calls.

The separate five-case filesystem capture retains a success path, a four-byte
partial prefix, an encoding-quota refusal after an actual value was supplied,
a preexisting final-file collision, and an ambiguous setup refusal after mkdir.
It retains nine files and five owned directory observations, including the
empty ambiguously created directory. Seventeen capture artifacts include the
validation record itself. This harness separately encodes returned DTOs outside
each tested store's quota; its deliberate collision file is also an explicit
fixture write outside the store. Those observations do not claim that a failed
store secretly retained unencodable values within its own reservation.

All native launch, policy-call and registered-source-generation counts remain
zero. The capture records interpreter/current module-file observations; full
module/runtime admission, the final outer recorder and complete scientific
evidence chain remain separate pending obligations.

## Independent review disposition

Vera, OpenAI Codex using GPT-6 Astra, independently accepted exact source
`f45a7aca501e2dc5125b5f3863ecb83862780eb0`; signed review commit
`07afa43ecd52212cdce5acac9f9603f33b52aa39` preserves the disposition in the
review writer for coordinator integration. The reviewer read the complete source,
tests and report, checked the source bytes, all 46 lossless manifest entries,
five source pins, sixteen public-result references and nine owned-file
references. The review confirmed reservation arithmetic, separate slot counts,
no refunds/retries, actual raised-versus-returned observations and preservation
of the first failure. The original fixture failure and final 47-pass/type/style
logs were inspected. No additional material finding remained. The reviewer
performed no test, native, policy or source execution; this acceptance retains
the implementation scope and outstanding outer/runtime obligations above.

After that review, all 16 quick-preflight checks passed. The complete raw gate
log is the manifest's 47th retained artifact; the 46 reviewed records remain
unchanged. Full integration and solution gates remain the coordinator's work.
