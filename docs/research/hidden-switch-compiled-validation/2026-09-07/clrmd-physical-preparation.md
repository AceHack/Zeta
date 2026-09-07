# Offline metadata and physical-file preparation

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: three actual current-extent comparisons; full admission pending

Source `2f068ba34da612f82370c64cef4e38a909e7edd5` adds an isolated file-backed
metadata helper, with no study assembly reference. It uses the already
installed ClrMD assembly and exactly thirteen pinned managed dependency files.
The [helper preparation inventory](clrmd-helper-preparation/manifest.json)
retains 26 lossless records, including original compiler/fixture failures and
the inspected pre-repair working-source bytes. The helper is an explicitly
local diagnostic project, outside the solution and measured study path.

The helper admits a finite exact input record, hashes one held captured dump
stream, resolves only the pinned internal Mach-O reader constructor, and sets
a non-null deny-all file locator before constructing DataTarget. It requests
complete runtime enumeration and requires one runtime matching the recorded
path, base, actual version and build identity. Explicit DAC creation keeps
`ignoreMismatch=false`; `verifySignature=false` does not establish publisher
signature verification. No default symbol server, cache, credentials or
network lookup is requested. Copied dependencies are not a claim about all
actual loads or network isolation. Actual helper-local managed images and a
bounded dyld roster are separate observations.

Only predict, condition and select are queried. Each actual current body and
complete hot extent must equal its declared physical candidate; cold/expanded
ranges refuse and authorize no additional reads. File PE metadata supplies a
captured MVID checked against native reflection. This is not a dump-derived
MVID theorem. ClrMD can read local PE metadata outside the deny-all locator;
the stable original and exclusive copied target files are therefore pinned
and rechecked. Physical instruction provenance comes from the separate
Mach-O segment reader, never ClrMD's potentially mapped memory views.

Independent review found four preparation defects: macOS Process.Modules
cannot provide the required loaded DAC row; incomplete runtime enumeration
could return a shortcut; dependency rows lacked exact manifest binding; and
the journal/final write bounds omitted a delimiter or final diagnostic size.
The repaired helper retains raw bounded dyld rows/counts before file hashing,
sets ForceCompleteRuntimeEnumeration, binds all reviewed manifest bytes, and
admits newline-inclusive output. An oversized final report becomes an
explicit compact failure/count with omitted metadata declared. Primary
failures survive subsequent journal/output/cleanup errors. Equal dyld counts
are not atomicity or exclusion of loader races. Disposal is attempted for the
owned chain; a throwing Dispose does not guarantee all internal caches closed.

Helper build7 passed in 2.21 seconds, zero warnings/errors. Focused test-project
build3 passed in 26.63 seconds, zero warnings/errors. The final retained TRX
contains 47 Passed, zero Failed/Skipped: ten metadata fixtures and 37 existing
compiled-native cases. Earlier failures remain distinct: helper builds1/3/4/5
had type/disposal, indentation, overload and Result-builder setup errors;
build5's shell wrapper also used a read-only zsh variable after the compiler
failed. Focused build1 had record-type inference errors. The first focused
run had 46 Passed and one PathMap fixture-path failure; the correction copies
the exact manifest into test output. These are changed-source recoveries,
not successful reruns of unchanged failing source. The post-build source
fingerprints match the committed bytes; no execution HEAD is invented.

## Fresh custody and one offline attempt

The [driver preparation inventory](clrmd-driver-preparation/manifest.json)
pins the four Python source files and six retained gate logs. Fresh capture
copies the finite adjacent target DLL/config set using regular source
descriptors and exclusive destination files before any target launch. Each
completed copy row survives a later failure. Real-close-then-error fixtures
verify that an earlier fsync failure remains primary, while cleanup-only
failure still refuses. This is a stable writer-tree premise, not hostile
namespace or concurrent in-place-write isolation.

The separately reviewed driver requires that new custody and a complete
closed capture. It hashes the held dump descriptor and reads only the three
named callable-stub, pointer-cell and compiler-sized body chains from unique,
fully stored Mach-O segments. Every selected prefix record precedes its next
dependent read. A fresh base comes from the new dyld row; historical runtime
version/build metadata is an expectation only for the exact unchanged
installed runtime hash, and the helper must independently match it.

The helper is one owned child with a 180-second process deadline, a checked
120-second dump-hash deadline and a polled two-MiB limit per output file.
Polled overshoot is retained; no filesystem quota, kernel-I/O cancellation or
general descendant containment is claimed. Owned kill/join is attempted
before output closure. Original timeout/refusal and secondary close failures
remain separate. A failed join does not establish quiescence. Four custody,
four driver and fifteen reused physical/analyzer-helper synthetic cases pass
(23 total); Ruff passes. No analyzer Session is instantiated by the driver.

The older dump and all three actual SOS-host refusals remain closed historical
evidence. Their original CLI file was not copied and its matching bytes are
no longer available in the searched writers; current rebuilt bytes cannot
stand in for that old metadata. The next authorized diagnostic uses a fresh
explicitly named dump and exact custody. Raw dump memory stays local-only.
No registered source, cost run, complete method closure or full runtime
admission follows from this preparation. All three admission flags remain
false even if the three metadata/physical extent comparisons later complete.

## Fresh capture and first actual helper outcome

The [fresh capture inventory](dump-attempt-2/manifest.json) preserves 39
lossless records from execution HEAD
`f3d9229ed88425826798da7ccb3ff416429ac85e`. Target PID 76685 started at
22:16:42.069352 UTC; collection exited zero at 22:16:48.287558 UTC and the
closed capture finished at 22:16:48.416927 UTC. Input and exclusive target
custody hashes remained unchanged, with no cleanup failures. Parent was
running an unrelated publication preflight concurrently; no exclusive-host
or causal workload claim is made.

The raw dump remains local-only at the writer's
`.git/hidden-switch-compiled-dump-attempt-2/graph.core`, 6,208,508,456 bytes,
SHA256 `7584B8D3E56DAFA79CAE8C954C03C2587AC25134CAA970F67CE530FDE17D3709`.
Raw target DLL/config copies remain local-only beside it under `target-files`;
their complete identities are preserved in the capture inventory. No unrelated dump memory is published. Full-file hashing reads every byte;
the physical driver parses format/segment metadata and explicitly queries
only the declared code-chain ranges. ClrMD/DAC can read additional internal
module/type/thread metadata; this boundary does not restrict library reads.

The [first metadata-attempt inventory](clrmd-attempt-1/manifest.json) retains
26 lossless records. Three physically stored callable/cell/body chains matched
compiler bytes: predict at `10BCB0BC0` (252 bytes), condition at `10BCB1190`
(532 bytes), and select at `10BCAEF00` (224 bytes). These 1,008 candidate bytes
remain distinct from independent method extents or closure admission.

Helper PID 77319 then exited -6 (SIGABRT). Its exact 378-byte stderr reports
missing `FSharp.Core, Version=10.1.0.0` at `Program.main`; stdout is empty and
no helper final file/journal was created. Driver exit two at 22:17:22.448673
UTC is the actual outcome, with empty cleanup failures. The thirteen pinned
ClrMD transitive assets were not the F# executable's complete dependencies.
This is a concrete startup dependency failure, with no actual DAC query
result or extent prefix. The original helper module/config bytes were copied
locally after failure and checked against their prelaunch fingerprints; that
is explicitly post-failure custody, not a prelaunch copy claim.

The separately numbered dependency recovery below does not replace this
attempt. The captured target/dump bytes remain unchanged and no study source
is modified by the helper-only correction. All full admission flags remain
false.

## Reviewed dependency recovery and actual extent agreement

Recovery source `c1cf790218d0584330743cf0178f9dc75772c439` explicitly references
the existing central FSharp.Core 10.1.400 package. It checks the actual loaded
language-runtime assembly's 2,405,712-byte file against SHA256
`454275E6F64F26C19F989CC0E0C43A2EAF41705FC0F456097FAA1DA445139394`
before dump reading, independently of the unchanged thirteen ClrMD assets.
The bounded helper inventory now includes all thirteen locale-resource DLLs,
31 module/config files total under its existing limit of 32. This is file
custody, not a claim about complete actual assembly loading. The explicit
cached-package build passed in 2.41 seconds, zero warnings/errors; 23 Python
fixtures and Ruff also passed. No package installation/download occurred.

The [separate startup inventory](clrmd-startup-attempt-1/manifest.json) retains
42 lossless records. PID 85961 reached the exact no-arguments usage response
and returned expected exit two at 22:26:30.098526 UTC, with empty stdout,
unchanged source/module pins and all 31 exclusive helper copies. No input or
dump path was supplied. This successful executable-loading regression is
separate from the actual metadata query.

The [second metadata inventory](clrmd-attempt-2/manifest.json) retains 28
lossless records from the reviewed recovery source. Helper PID 86223 and the
driver both exited zero, finishing at 22:27:03.119799 UTC, with no first or
cleanup failure. All three actual DAC current hot extents exactly equal the
fresh physically stored compiler candidates: 252, 532 and 224 bytes, 1,008
total. All cold starts/sizes are zero. Actual tokens, full signatures,
current body addresses and module-file associations matched the declared
three methods; no range expansion or historical-version substitution passed.

The 74,297-byte journal retains 402 records. Complete runtime enumeration was
explicitly enabled; the actual target version was 10.0.1126.37416 and build ID
`6CB64FF242FF30EABC454640FA3B0D03`, matched under the exact installed runtime
file hash. The helper observed the requested local DAC path/header and its
expected file identity, with zero locator requests. Its raw dyld counts were
358 before, 358 after copying and 358 after file identity work. These equal
counts remain a non-atomic observation. The managed-assembly count changed
from 23 to 28 across observations; no complete stable load-closure claim is
inferred. File identity does not prove loaded-memory byte equality or a
verified publisher signature.

The startup's local helper copies independently match all actual query
prelaunch pins and still match their raw files afterward; the derived
association record identifies its post-query verification timing. Original
study input/module identities and the same fresh dump remained unchanged.
Raw dump and copied executable files remain local-only custody. There is no
additional driver memory-range query or unrelated memory publication; full
hashing and ClrMD/DAC internal metadata reads remain explicitly admitted.

This establishes a bounded three-method extent correspondence, not complete
reachable call closure, guard-object/selector-register association, native
helper correctness or full runtime admission. `RuntimeAdmitted`,
`BodyResolved` and `ClosureAdmitted` remain false in the actual records. The
next scope requires separate review of a finite expanded method/call roster;
no additional query is authorized merely by this successful comparison.

## Frozen fresh-roster mapping

The [metadata-only mapping inventory](clrmd-mapping-attempt-1/manifest.json)
retains nine lossless records, including exact command, executed mapper source
pins, ready/JIT input pins, output, three passing pure fixtures, and the
original import-format lint finding plus correction. Mapper source is
`37a8bc1ca61d7018310d6cfdf5a35efbd73df4b9`. Its actual 185,092-byte output
has SHA256 `0D22A5C3679B5F47F874E8C1C10CFD34B17E9E4B7E3B649E2590F22F0F25A39A`.
It completed with all metadata input/source bytes unchanged and no dump-byte
access, target launch or runtime query.

All 139 reflection rows remain in order: 130 prepared rows map uniquely by
type/name to one compiler block, with distinct module/token identities and
no compiler-block reuse; nine unprepared rows retain their actual refusal.
The mapped candidates total 34,660 bytes, maximum 1,664 each, with ten declared
literal records. These remain compiler candidates, not newly observed extents.

Nine other emitted compiler blocks are retained separately: eight static
initializers and `HiddenSwitchCompiledPolicy.previous[int]`. They are not the
same set as the nine unprepared reflection rows. Their presence demonstrates
why the reflected roster alone cannot establish executing call closure.
In particular, the open generic previous template does not erase the emitted
concrete specialization. No inline/template absence is dismissed as irrelevant
without later actual caller/body evidence.

## Proposed finite expansion, awaiting exact implementation review

The next helper entry will consume this exact reviewed mapping identity and
its unchanged fresh capture inputs. It must retain all 139 rows, including
the nine explicit unprepared observations and nine separate emitted extras.
The requested extent scope is only the 130 prepared mapped candidates.
Each query must bind the captured CLI MVID/file association, method-definition
token, declaring type/name, actual full signature, current NativeCode and
complete hot/cold metadata. Unsupported identity formatting, changed body,
cold expansion or ambiguous ownership remains a recorded refusal; the proposal
does not weaken the already accepted three-method comparison.

The physical driver may resolve only the 130 declared eight-byte callable
stubs and eight-byte cells, followed by their exact compiler-sized spans
(34,660 bytes total). Any added literal range must derive from a supported
actual opcode and its declared compiler label, with explicit uint64 and
physical-segment admission; there are ten declared literal records, at most
sixteen bytes each. Each successful prefix must publish before a later read
or query can fail. No unknown target, expanded extent or zero-fill region
implicitly authorizes more memory access.

An initial call/transfer inventory can then be computed from these admitted
instruction bytes and retained compiler metadata. Before arithmetic or call
interpretation, independent decoded spans must match those same physical
bytes; compiler text is not an independent decoder. Unresolved indirect paths,
concrete generic specializations, static initializers, framework/native
helpers and referenced guard data remain separate obligations. Additional
callee or object/register reads require another exact finite roster and
review. The 130-candidate extent result alone cannot set any full admission
flag or permit registered study work. No expanded helper or range query has
yet executed.

## Reviewed mapped130 command preparation

Source `af90bfc9e95fbdb8246c438da26e30a727bcbb5f` implements a separate
`--mapped-130` helper command and optional exact-mapping argument on the
physical driver. The three-method command remains available. This expansion
requests no literal, extra-block, object or register reads: only 130 bounded
stub/cell/body chains and their matching current DAC metadata.

The [preparation inventory](clrmd-mapped-preparation/manifest.json) retains
15 lossless records. The standalone helper build passed in 2.12 seconds and
the mapped Release test-project build in 67.65 seconds, each with zero warnings
and errors. The focused TRX has 50 Passed outcomes: 13 metadata cases and 37
existing compiled-study cases, no failures or skips. The final Python run
passes 30 pure/custody cases. The initial append used the wrong relative
working path and only four existing Python tests ran; that narrower log is
retained. Later seven-case and complete 30-case logs are distinct. Ruff's
initial missing import separator and corrected green results are retained.
Build-graph derivation reports the checked-in artifact already current.

Native build/test inputs were uncommitted snapshots subsequently committed
in the source pin; the final driver custody addition was read-only reviewed
and the final Python suite ran at that committed source. The record binds
current helper DLL/config fingerprints without implying a full solution gate.
The build commands use Release, `-m:1 -nr:false`, and
`ContinuousIntegrationBuild=true`; the helper additionally uses the exact
installed ClrMD tool directory and local package cache as restore source.
Tests use the filter `HiddenSwitchMetadataTests|HiddenSwitchCompiled` over
fully qualified names and `--no-build`.

The helper binds the exact 185,092-byte reviewed mapping before dump access.
It compares copied PE MethodDef token, declaring nested type, name and IL to
captured reflection, then retains the actual full ClrMD signature while
requiring exact token/type/name/module/current-body/extent agreement. It does
not guess a ClrMD signature spelling from reflection text, normalize a naming
mismatch, or infer a dump-derived MVID or generic-instantiation theorem.

Independent source review found two diagnostic admission gaps. The cell
prefix now records its decoded target, alignment and next requested length
before a missing-body/invalid-target refusal. The driver also requires exact
integer requested/available count headers, not only a row-array length.
Synthetic fixtures discriminate both repairs. Before helper launch, 31 module
and configuration files receive exclusive exact copies through the reviewed
custody helper, with original and copied identities retained and rechecked.
The fresh capture's 82 input pins and 22 target custody rows remain unchanged.

The helper stops at its first refusal, retaining available method metadata and
the requested count; unavailable later rows are not claimed as queried.
Every successfully written physical prefix precedes its dependent read.
First-failure, publication and cleanup limitations remain as previously
reviewed. All full runtime/body/closure flags remain false. The separately
numbered expanded offline attempt has not yet run at this preparation pin.
