# Offline metadata and physical-file preparation

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: reviewed source and synthetic preparation; query pending

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
