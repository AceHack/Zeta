# Projection driver source and admission plan

Date: 2026-09-08
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade source implementation plan
Status: source implemented; independent review and final archive pending

The coordinator approved a minimal actual driver over the unchanged fixed
40-case/88-call plan. No case or operation selection flag exists. This source
work does not open the final evaluation; complete source review and an
independent immutable implementation archive remain prerequisites.

## Public boundary and exact manifest

The driver accepts independently supplied raw manifest bytes and their expected
uppercase SHA256, a canonical source root, an existing canonical output parent,
one fresh attempt name and an absolute dotnet host path. The CLI exposes these
through --source-root, --manifest, --manifest-sha256, --output-parent, --attempt
and --dotnet. It never derives the expected manifest hash from the manifest.

The strict UTF-8/JSON manifest is at most 64 KiB, with exactly Schema,
ProtocolSha256, SourceFiles and NativeFiles. SourceFiles has the exact ordered
47-path roster: the earlier 44-path census plus this driver, its dedicated test
and the process test. Rows are exactly Path, Bytes and Sha256. Each file is at
most 8 MiB and their total is at most 64 MiB. NativeFiles has exactly five
ordered Role, Bytes and Sha256 rows: @host, the replay script and its three
canonical repository-relative DLL paths. Script identity must agree with its
source row. Every hash is uppercase hexadecimal; integer lengths exclude bool.
Flat Bindings comes only from this independently hash-admitted manifest.

Two complete live descriptor-relative source scans compare exact bytes to that
expectation: before native preparation, and immediately before the single
runner invocation. Actual loaded local module file/origin paths must point to
the admitted source root, including the ordinary package initialization files.
These are current-file/path observations, not source-to-bytecode equivalence or
future immutability. The same admitted expectations reach every service.

## One shared reservation

The approved raw-plus-stored driver reservation is
D = 2 * [C + M + 27 * (64 KiB + 64 KiB + 2 MiB) + 4 * 1 MiB], where C is the
independently declared total copied script/three DLL bytes and M is the raw
manifest length. The host and source archive files are read, not copied.
Exactly 90 file slots are reserved: four direct copies, one manifest, 81 native
call input/bindings/receipt files, and four bounded metadata files (two source
snapshots, preparation and final outer envelope). Directories are ownership
surfaces, not extra scientific result artifacts.

All reservations are charged before writes, including potentially unused or
failed paths. There is no refund or retry. The inner store receives
Limits(256 MiB - D, 8 MiB, 512 - 90). Setup refuses unless that remainder can
cover the 8-MiB journal, 2-MiB combined runner terminal reservation and nonzero
ordinary room. Its exact remaining byte allowance is retained. This tightens
the shared registered ceiling rather than adding an independent outer budget.

Native stdout/stderr and observations are memory values subsequently retained
by the inner recorder, whose writes consume its own remainder. The approved
native process writes only its reserved fixed files. Reservation bounds are
not a hostile-child OS disk quota or a peak-memory guarantee. Original source
archives already preserved in git are not copied again into the run directory.

## Outcome retention and source tests

DriverResult retains all actual source/read/preparation/store/run outcomes and
first plus secondary failures in memory before any later fallible publication.
The actual RunResult is never recursively serialized into outer JSON: its store
helper snapshots repeat previous values. A once-only at-most-1-MiB outer
reference envelope links inner terminal/final journal, source/preparation
metadata, fixed native call files, counts and failures. It explicitly identifies
memory-only actual outcomes. Publication failure does not erase RunResult or
become scientific success. Existing paths and partial files remain untouched.

Tests use owned small file fixtures and controlled runner/process seams.
Required discriminators include manifest hash/key/roster/type mutations,
changed source bytes and origins, canonical path/overlap refusal, exact shared
reservation and exhausted setup, exclusive outputs, original returned RunResult
before encoding/write/read failure, setup/child failures, unchanged service
bindings, one runner invocation, and CLI invalid arguments with no work.
No final case, solver, registered stream or native numerical output is used.

Dependency source imports preserve original root commits 2ba65308e, 459df9111,
2e051e8d0, c124a621d and process 36cb21d57 (the root import of b575).
Eight current adapter/helper modules were compared byte-for-byte with root.
Only local documentation-context conflicts occurred during imports; both
existing clarification/ownership text and incoming source records were retained.
The unchanged reduced-budget runner e133efe83 and corrected process 8254c8270
were imported before the final driver checks. Source/test bytes were preserved;
only documentation context conflicts required resolution. The co-claim
8100544b6 is retained through that import; the coordinator reports it is an
ancestor of remote integration 694c8623e after the normal 16-check hook.
This lane does not edit the runner or numerical criteria.

## Exported interface and publication limits

- `admit_manifest(raw, expected_sha256) -> Admission[Manifest]` admits only the
  exact bounded fixed manifest and independent expected digest.
- `drive(raw_manifest, expected_manifest_sha256, source_root, output_parent,
  attempt_name, dotnet) -> DriverResult` owns one attempt and one invocation.
- `cli(argv) -> DriverResult | Refused` admits the exact six-argument surface;
  its actual manifest-read observation is retained in `ManifestRead` after a
  read is attempted. Argument-only refusal has no invented read outcome.
- `main() -> int` prints only a bounded completion locator and returns 0 only
  on completed collection/criteria/publication. A short stdout write refuses.

`Manifest` has Sources, Native and Bindings tuples. SourceFile has Path, Bytes,
Sha256; NativeFile has Role, Bytes, Sha256. Reservation has CopiedBytes,
ManifestBytes, DriverCombinedBytes, DriverSlots, Inner and the explicit false
UnusedReservationsReclaimed flag. SourceSnapshot has Complete, Modules, Reads
and Failure; each SourceRead retains its Expected identity, complete actual Read
observation, observed length/hash and Matched flag before later comparison.

DriverResult separately retains ManifestRaw, ExpectedManifestSha256, SourceRoot,
AttemptRoot, AttemptOwned, Reservation, Admission, Sources, Preparation,
StoreOpen, Run, SetupFinalization, Publications, Calls, Failure,
SecondaryFailures, Complete and ManifestRead. Its Scope and
FullRunResultPublication strings explicitly bound interpretation. Actual returns
and exceptions are CallObservation values, not success inferred from a flag.
The full RunResult, source bodies and unencoded outcomes are memory-only unless
an independently checked linked inner artifact actually retains them.

The four metadata filenames are exactly source-snapshot-1.json,
prepared-native.json, source-snapshot-2.json and outer-final.json. The outer
reference envelope is a snapshot before its own exclusive write. It includes
source/preparation descriptors, attempted publication identities, actual inner
terminal/journal references, a setup-finalization journal when applicable and
native call paths with an explicit attempted-path limitation. It is not a
self-admission result. There is no extra RunResult file or owned stdout log.
An encoding, exclusive write or readback refusal stays the primary actual
failure when first; a later failure cannot mask an earlier runner failure.

## Preserved validation history

The [lossless validation inventory](precision-gate-projection/2026-09-08/driver-source-validation/manifest.json)
retains all three source/check attempts and the source-only import observation.
The [machine-readable fixed roster](precision-gate-projection/2026-09-08/driver-source-validation/source-roster.json)
is a non-runtime 47-path list for coordinator manifest construction. It contains
no final independently expected hashes and does not open archive admission.

Attempt 1 had 48 passing tests and one failure in 4.47 seconds. The failed
hash-after-read fixture showed that a successful source read was appended only
after hashing. A later injected hash error therefore discarded that actual read.
The repair appends the complete read observation before any hashing or matching.
The initial 107 mypy diagnostics, five Ruff findings and two formatting findings
are retained. Most typing diagnostics came from test imports through the driver
module and missing narrowing; source diagnostics also identified optional path
captures and the callback type.

Attempt 2 passed all 57 tests in 4.58 seconds, with Ruff/format clean, but retained
20 typing diagnostics. Attempt 3 passed all 57 in 5.02 seconds; strict mypy on both
owned files, Ruff and format checks passed. The added controls cover a source
body larger than 1 MiB staying out of metadata, the three unchanged binding
routes, invalid publication return types, the real setup-finalization link,
actual CLI read refusals/exceptions and bounded short-write handling. A normal
native process, final fixed case, solver or policy was never invoked by these
fixtures. Controlled callbacks are explicitly not numerical execution evidence.
Only source/tests and command logs are archived here; this is not an archive of
every ephemeral test-owned filesystem tree or full result of every test call.

A separate ordinary-import-only child returned all 14 expected local module
file/origin observations on Python 3.14.6/cpython-314 with stderr empty. It also
records the actual torch/transformer_lens package origins and installed package
versions. Package initialization is an ordinary local dependency, not silently
bypassed. These source/current-path observations do not establish bytecode
integrity, every third-party dependency, future immutability, or loaded native
machine-code equivalence. The three copied script-referenced DLLs remain
separate from the two assembly files actually observed by the producer.

Quick preflight subsequently passed all 16 checks. The final 53-record inventory
includes its complete stdout/stderr/command receipt, six exact imported
source/test identities and the stdlib-only custody audit. That audit checked the
49 prior records, both owned source files, all 47 roster entries and 14 actual
local module observations before its own four raw records were appended. This
is local source/fixture validation; the coordinator owns the final integrated
build/test gate and independently reviewed immutable execution archive.

## Corrected false-positive locator finding

Original source `1f4db4b7ad2953648a37a38d0613bb99fc7d0633` was normally pushed
with all 16 hook checks passing and its exact remote owner head verified.
The [separate link-resolution inventory](precision-gate-projection/2026-09-08/driver-link-resolution-validation/manifest.json)
preserves that full push/ref proof and the following mistaken author finding.
The original source remains byte-identical after this correction.

I initially asserted that Store Artifact.File values lacked their `records/`
base. That assertion was false. Store already constructs each File as
`state.name/record-...` or `state.name/final-journal.json`, relative to the driver
AttemptRoot. My first two new tests failed because they demanded an unnecessary
InnerStoreRelativeRoot field. A subsequent uncommitted source addition let those
tests reach their next error: they constructed `records/records/...` and failed
with FileNotFoundError (57 other tests passed). Those failures diagnosed my test
assumption, not a defect in the committed driver. The reviewer initially relayed
my claimed concern, then independently checked the actual Store path source and
corrected that relay. No production locator failure was established.

The unnecessary source addition was removed by an exact scoped edit. The final
tests resolve both ordinary terminal/journal and setup-finalization artifacts
against AttemptRoot using the already complete descriptor File, then check the
actual stored length and hash. Existing three preparation/store failure controls
now additionally check that no Run or setup journal is invented before a Store
is successfully opened. Final attempt 5 passed all 59 tests in 4.84 seconds,
strict mypy, Ruff and format. Both mistaken fixture versions and the transient
uncommitted source bytes remain losslessly retained; none replaces original
1f4 or its 57-case history. This follow-up changes tests/evidence only and adds
no driver field, output file, numerical call, source expectation or budget.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
