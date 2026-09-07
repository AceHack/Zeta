# Guarded hidden-switch compilation: loaded Python identity admission

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra
Artifact status: finite Python identity collector; whole-phase admission pending

## Source and purpose

This is an implementation boundary under the unchanged
[frozen protocol](2026-09-07-hidden-switch-compiled-protocol.md), following
the [numerical](2026-09-07-hidden-switch-compiled-numerical-validation.md)
and [pure replay](2026-09-07-hidden-switch-compiled-pure-replay-validation.md)
boundaries. Source commit `9116bd54603c3d484f8ec3c5ed5e0e701736f1bf`
adds only `hidden_switch_compiled_python_identity.py` and its matching test
file under `src/Interp.Python`. The writer uses the existing co-claimed
session `codex/20260907-c7b2a403` and isolated publication branch
`codex/hidden-switch-compiled-reference-20260907`.

Two separately committed review repairs preserve that initial source:
`da8b48c5216481017de6269321906922ed9bac12` adds nonblocking open for
FIFO refusal; final source `e2c7c046660729bea8cf433c60a62456c0bb8297`
bounds reads to initial file size plus one byte. No source history is rewritten.

The [source/log manifest](hidden-switch-compiled-validation/2026-09-07/python-identity/manifest.json)
binds both final files and the unchanged IEEE Result helper to the final source
commit, with each test/publication log assigned its own source-history pin.
Retained logs are losslessly compressed, with separate stored/decompressed
lengths and SHA256. No raw log is stripped or normalized.

The coordinator approved the finite roster and entry-point interface before
implementation. The caller supplies reviewed expected source identities;
the collector inspects the actual loaded objects and reads current source
files. Self-reported expected hashes alone cannot substitute for that read,
and an otherwise identical module from another checkout refuses.

## Exact public contract

`admit_python_identity(clone_root, modules, *, entry_module=None)` returns
the independent numerical `Success.value` or `Failure.Code` / `Failure.Message`.
It imports no coordinator evidence modules. `clone_root` names an existing
absolute clone directory with no resolved symlink alias. `modules` is an
exact dictionary from logical Python module names to rows with exactly:

- `Path`: canonical repository-relative POSIX `.py` path.
- `Bytes`: nonnegative integer, excluding booleans.
- `Sha256`: 64 uppercase hexadecimal characters.

Duplicate source paths, noncanonical paths, traversal, malformed hashes,
extra keys and missing mandatory modules refuse. The package `zeta_interp`,
this actual executing collector and its actual IEEE Result helper must be
listed. Every loaded name beginning `zeta_interp.hidden_switch` must be
listed; additional reviewed direct helpers are checked in the same way.
The caller owns review of that finite helper roster. This does not infer
or certify an unspecified transitive import closure.

Every listed module must be an actual `sys.modules` `ModuleType` object
with an ordinary `ModuleSpec` and exact `SourceFileLoader` type, rather
than a custom subclass. Module name, package, `__file__`, spec origin,
loader identity/name/path/`get_filename`, package search paths and cache
metadata must agree. Source paths resolve to the admitted clone's exact
expected paths. Package/source symlink substitutions refuse. Actual byte
length and SHA256 must match the reviewed row.

When `entry_module` is supplied, it names a required logical roster row
bound to the actual `sys.modules['__main__']` object. The runtime name is
`__main__`, while spec/loader names are the requested logical name. Ordinary
`python -m` execution does not require a separately imported logical copy.
A logical duplicate, another alias of the entry object or an alternate
loaded object carrying that logical entry spec refuses. An omitted entry
normally returns `EntryAdmitted=false` and a reason; an already loaded task
entry cannot silently escape explicit entry admission. The coordinator's
whole-phase caller must require true entry admission.

Successful output schema is `zeta.hidden-switch.compiled.python-identity.v1`,
with exact top-level fields `Schema`, `CloneRoot`, `Modules`, `EntryAdmitted`,
`EntryModule`, `EntryReason`, `Interpreter`, `SnapshotAgreement`, `Scope`
and `Limitations`. `Modules` is sorted by logical name. Each module record
contains `Name`, `RuntimeName`, `Path`, `AbsolutePath`, `Bytes`, `Sha256`,
`File`, `SpecOrigin`, `LoaderName`, `LoaderPath`, `LoaderType`, `IsPackage`
and `CachedPath`.

`Interpreter` reports actual executable reported/resolved paths and byte
length/SHA256, `sys.version`, version components, implementation name/version,
cache tag, byte order, platform and current/base prefixes. The executable
may legitimately resolve through a virtual environment symlink outside the
clone. These are observed identities for separate expected-runtime admission,
not evidence that the caller's runtime requirements are satisfied.

## Read ownership and snapshot limits

The collector performs two module/source and interpreter collections and
requires matching object/spec/loader identities, metadata and file hashes.
The loaded task-name roster must also remain unchanged. Each individual file
read uses a no-follow, nonblocking descriptor, verifies regular-file status and compares
descriptor/path device, inode, mode, size and change metadata around the read.
It reads at most the initial `fstat` size plus one byte; a reviewed source
length mismatch refuses before hashing. FIFO replacement therefore reaches
the regular-file refusal without a writer, and continued regular-file growth
cannot extend the read loop indefinitely. The candidate uses the host's
`O_NOFOLLOW` and `O_NONBLOCK` capabilities; an unavailable or failed identity
read returns a typed refusal rather than admitted evidence. These byte bounds
are not a hard deadline for an unresponsive filesystem or OS.

The descriptor is owned before stream construction and remains owned by
the collector (`closefd=False`). It gets exactly one close attempt even if
stream creation fails or close actually succeeds and then reports an error.
An earlier refusal remains primary, with a cleanup failure retained as a
note in the returned message. A cleanup-only failure returns `IdentityCleanup`.

Matching snapshots are observations. They are not atomic across files,
do not prevent later mutation, and do not prove that function objects or
bytecode were never changed in memory. File-backed loader metadata does not
prove which source/cache bytes produced the current executing functions.
`CachedPath` is metadata only; actual cache use is not established. The
interpreter, standard library, ordinary loader and OS are trusted here.
Generated framework code, loaded native-library closure, hostile interpreter
state and a source-to-bytecode derivation theorem are outside this boundary.

## Executed fixture validation

The [focused log](hidden-switch-compiled-validation/2026-09-07/python-identity/focused-python.log.gz)
records the initial **50 passing Python tests** in 0.77 seconds.
The [FIFO repair log](hidden-switch-compiled-validation/2026-09-07/python-identity/fifo-python.log.gz)
records 51 passes in 0.92 seconds, and the
[bounded-read repair log](hidden-switch-compiled-validation/2026-09-07/python-identity/bounded-python.log.gz)
records the final **53 passing tests** in 0.94 seconds. Ruff, format checking,
mypy and diff checks passed for each source pass. The
[publication log](hidden-switch-compiled-validation/2026-09-07/python-identity/source-publication.log.gz)
retains the initial source's normal sixteen-check push hook and isolated publication;
the [repair publication log](hidden-switch-compiled-validation/2026-09-07/python-identity/repair-publication.log.gz)
retains the final source's normal sixteen-check hook.

The tests load actual small file-backed modules from two owned temporary
clones. Each clone contains copied collector/Result source, an empty fixture
package and tiny owned subject/helper files. The temporary module namespace
is restored afterward. One fixture loads byte-identical source from the
second clone and demonstrates refusal despite identical expected hashes.

Other cases cover missing/unlisted/dynamic modules; file/spec/loader/name/
package/cache substitutions; changed bytes; symlink substitution; a copied
metadata dictionary placed on a different collector/helper object; malformed
rosters and embedded-NUL roots; changed source/object/task roster/interpreter
between snapshots; and actual-close-then-error injection with first-refusal
preservation and no retry.

Seven metadata-only child fixtures execute ordinary `python -m` with an owned
tiny entry source. The positive case admits the real `__main__` object without
a logical import. Logical duplicate, alias, alternate load, changed entry
name and omitted task-entry admission cases refuse. The seventh imports the
owned fixture and then replaces its source with a real FIFO without a writer,
returning typed `FileIdentity` refusal under the parent test's bounded timeout.
The separate finite producing-stream witness checks requests totaling exactly
initial size plus one byte and closure of its real owned descriptor. It would
trip a finite assertion under the earlier read-until-EOF loop rather than hang
the test process. An injected hash trap checks early reviewed-length refusal.
These fixtures execute no task
policy, certificate/guard computation, registered source stream, native
runtime probe or cost measurement.

This validates the collector's bounded fixture behavior. It does not admit
the eventual task CLI, complete source/helper roster, Python interpreter
requirements, native graph, behavior/cost chronology or full experiment
receipts. Those remain separate coordinator/reviewer obligations. The current
protocol, tags, seeds and promotion thresholds are unchanged.

## Independent review findings and disposition

The independently co-claimed reviewer, Vera using OpenAI Codex / GPT-6
Astra in session `codex/20260907-c7b2a404`, read source `9116bd546`
without executing task code or tests. The review identified the FIFO hazard:
the former blocking open could wait before the regular-file check. The writer
accepted it and preserved repair `da8b48c52` with a real no-writer FIFO fixture.

The reviewer then identified the related read-until-EOF hazard for a growing
regular file. The writer accepted it and preserved repair `e2c7c0466`, the
finite producing-stream witness and the reviewed-length-before-hash check.
The reviewer accepted final immutable source
`e2c7c046660729bea8cf433c60a62456c0bb8297` with no remaining material
module/spec/loader/package/entry/interpreter or first-failure/descriptor
ownership finding in the bounded metadata/current-byte scope. The review
confirmed that the FIFO, producing-stream and hash-trap regressions
discriminate both failures without hanging.

The reviewer ran no tests, task-module imports, target executable, policy,
source stream or measurement. Source-to-bytecode derivation, unspecified
dependency closure and future immutability remain expressly unproved by
this read-only acceptance.
