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

The independent protocol reviewer read source `35c12618f` and these tests,
accepting the primitive boundary without a material finding. That review
reconciled duplicate/nonfinite admission, signed-zero bits, nanosecond
chronology, all 28 service bytes, exact gzip relation, GC deltas and median
thresholds. The reviewer ran no test or scientific execution and explicitly
did not infer filesystem, numerical, runtime or whole-phase admission.

## Descriptor-relative storage implementation

[The storage helper](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_storage.py)
resolves the caller-admitted root once, then opens each artifact directory
component relative to a held descriptor without following symlinks. The
trusted-root resolution is explicit; it does not claim to forbid symlinks in
the caller's original root spelling. Required no-follow, directory, nonblocking
and descriptor-relative capabilities are checked before access.

Each read uses one regular-file descriptor, exact declared length and bounded
bytes, comparing device/inode/size/mtime/ctime before and after. FIFO inputs
refuse without a blocking read. Artifact admission then checks the exact
stored/original hashes and lossless gzip relation. These are observations
about the bytes read, not a future pathname lock or hostile-kernel guarantee.

Directory creation is atomic and refuses an existing name. File writes use
exclusive creation, preserve partial files on failure and sync successful
file/directory operations. Existing directories, files and symlink destinations
are never reused or overwritten. The helper creates no missing parents behind
the caller's back; phase orchestration must record its actual setup sequence.

The initial storage suite had **nine tests passed in 4.48 seconds**, plus strict
mypy and Ruff passes. An earlier eight-test version passed before the explicit
unsupported-capability check and its ninth witness were added. Tests include
existing-output preservation, an actual interrupted write with retained prefix,
parent/leaf symlink refusal, FIFO and length refusal, changed in-place read
metadata, complete hash-bound identity/gzip storage, bounded expansion,
trailing gzip members and missing no-follow capability. These calls use owned
temporary test files; they generate no registered source and execute no policy.

Independent review of `c0e975fd8` found that an `os.close` failure could escape
an unguarded `finally`, mask a primary refusal or lose track of a newly opened
child during directory ownership transfer. The correction records each child
before closing its parent, removes descriptor ownership before attempting a
close, and attempts cleanup once for every still-owned descriptor. The first
operation failure is preserved; cleanup alone failing returns a typed
`descriptor-cleanup` refusal. An uncertain close is not retried, because its
descriptor may already have been released. This promises neither successful
kernel cleanup after an OS failure nor a lock on descriptor reuse by unrelated
code. Embedded-NUL root paths also refuse before resolution.

The corrected storage suite has **18 tests passed in 3.89 seconds**, with strict
mypy and Ruff passes. Added witnesses perform the real close and then inject
an `OSError`, covering read/write/mkdir success and primary failure, both root
and artifact-parent transfers, closure of the already opened child, no repeated
close, preservation of output bytes and malformed root input. During correction,
Ruff first reported import spacing and mypy reported a reused loop-variable
annotation plus a mixed-result test annotation; both were fixed before this
passing run. These tests remain filesystem-only and generate no study streams.

Native phase setup needs the same exclusive-attempt property. Microsoft's
[Directory.CreateDirectory contract](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.createdirectory?view=net-10.0)
returns existing directories too, so an existence check followed by that call
does not establish exclusive ownership. The native owner will separately
declare/review its actual mechanism before implementation archival. Cost
stage-one counters must start before native attempt creation; coordinator
precreation cannot replace that registered step.

## Archive-to-file correspondence

[The source helper](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_sources.py)
requires a caller-reviewed full commit and complete ordered file roster. Every
row has exactly `File`, `Bytes`, `Sha256`. It checks the real commit object's
type, exact regular-file tree entry and blob length/hash, then compares those
immutable bytes with an actual descriptor-relative read from the caller's clone.
Symlinks, ref expressions, missing/duplicate/reordered files, changed current
bytes and a descriptor hash changed to match unarchived bytes all refuse.

Git reads use an explicit clone metadata/work-tree path, no replacement objects,
literal pathspecs, explicit `--no-lazy-fetch`, and no inherited `GIT_*` routing
variables. They invoke no shell, hooks, filters,
checkout, object writes or network. The installed Git executable/object database
and caller-admitted clone root remain trusted. Admission covers only the finite
supplied roster: it neither discovers an unspecified dependency closure nor
admits a tag, loaded module, runtime or whole phase. Full old/new source rosters,
resolved archives and executing Python/native module identities remain separate
integration obligations. The explicit limits are 256 files and 32 MiB per source
file; exceeding a bound refuses rather than truncating evidence.

Twenty focused tests passed in **6.65 seconds**, with strict mypy and Ruff passes
under the Interp project's own configuration. Tests create owned temporary Git
objects and files, including an actual replacement ref plus conflicting ambient
object routing; the checked source still comes from the named immutable commit.
Other witnesses cover forged live/archived hashes, noncommit objects, regular-file
mode, symlinks and unavailable Git. An initial Ruff invocation from the repository
root used a different import-spacing configuration; the applicable Interp checks
above pass. No task source stream, policy or measurement executes in these tests.

Independent review of initial source `dfb015252` found that a local partial clone
can fetch missing promisor objects during an otherwise ordinary `cat-file` read.
The initial no-network/object-write statement therefore lacked a required guard.
The correction explicitly uses [Git's documented `--no-lazy-fetch`](https://git-scm.com/docs/git#Documentation/git.txt---no-lazy-fetch),
verified available in the installed Git 2.54.0. An unsupported Git refuses through
the existing command-error boundary; there is no fallback that permits fetching.

The corrected suite passed **22 tests in 8.47 seconds**, with strict mypy/Ruff
passes. A real local promisor fixture first demonstrates that the unguarded read
invokes a controlled remote helper; the helper only writes a test marker and exits.
The corrected helper admits already-local objects, refuses a missing object,
does not invoke that remote helper and leaves every object-file byte unchanged.
An additional pathspec test initially expected an out-of-domain bracketed path to
admit; it was corrected to assert the existing canonical-path refusal, without
widening the source path contract. The initial corrected run retained 21 passes
and that one test-author failure before the final 22-case pass.

## Signed-zero token correction before old-control replay

The old native DTO stores its Q and belief diagnostics as JSON numbers.
During integration, default integer-token decoding was found to turn the
lexical token `-0` into integer zero, erasing its sign before independent
bit-level replay. The strict decoder now preserves this token as binary64
negative zero; decimal/exponent negative-zero tokens retain the same sign.
Ordinary `0` remains an integer. Integer-only counters refuse the preserved
negative-zero float rather than silently coercing it. No old source, archived
receipt or registered protocol was edited.

The corrected primitive suite passed **51 tests in 4.19 seconds**, with strict
mypy and Ruff passes. Four added token witnesses check both top-level and
nested decoding, exact `8000000000000000` bits, integer-counter refusal and
ordinary integer-zero admission. The first Ruff command identified an
existing missing separator between third-party and project imports under
the Interp configuration; the separator was corrected before the passing
checks. These tests execute no policy or study source.
