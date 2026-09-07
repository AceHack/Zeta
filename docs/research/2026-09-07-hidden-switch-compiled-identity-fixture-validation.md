# Guarded hidden-switch compilation: owned identity fixtures

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: repaired implementation validation; independent source rereview accepted

The [fixture runner](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_identity_fixtures.py)
implements the seven source and eight Python cases from the
[accepted coordinator design](2026-09-07-hidden-switch-compiled-outer-negative-design.md).
Its initial source/test commit is
`a7548b075b21b0c4fdc552844b66fac36789e305`. All thirty focused tests pass at
that pin, but independent review subsequently found two retention/resource
defects below. This initial record is preserved before their repair and is
not complete coordinator or runtime admission.

## Actual operation and retention boundary

The public `run_identity_fixture(case_id, case_root, python_sources=...)`
returns `FixtureReady` or `FixtureFailed`. Successful preparation supplies
the shared `NamedInput` pair `fixture, expected` and a `CallResult` with the
fixed operation name. Source cases call the actual `verify_source_files` on
retained Git repositories; they preserve their commits, blobs and altered
current files. Python cases use actual `python -m` children with a fixed tiny
fixture package, copied unchanged collector/IEEE bytes, and declared helpers.
They import no policy, source generator or recorder in the child.

The foreign-entry case routes only entry discovery through clone B and restores
clone A's package path before dependency imports. The foreign-helper case
routes only that helper through B. Actual metadata and refusal messages name
the intended foreign subject while all other module paths remain in A; an
earlier package refusal cannot substitute for the entry witness.

`CompletedOperation` is one for an actual returned source API result, or for
a normally closed Python child with exactly one collector return. Setup,
launch, crash, timeout and missing-result failures count zero. The parent
coordinator independently checks the expected semantic result. It receives
raw process observations, files and fixture inputs even when conformance is
incomplete. The process `Environment` field records explicit environment
overrides; the remaining ordinary ambient OS environment is inherited and
is not presented as an enumerated runtime closure.

Case roots and output files are created exclusively and retained in place.
The runner never reuses or deletes a failed case. A manifest indexes regular
file bytes; symlinks remain explicit owned fixture objects and event records.
Paths, process IDs, inode/timestamp observations and commit identities are
retained raw. Fresh replay must compare the declared stable semantics and
role/path association without rewriting the original observations.

## Initial checks and exact retained evidence

The [lossless inventory](hidden-switch-compiled-validation/2026-09-07/identity-fixtures/manifest.json)
binds ten source/helper files, twenty artifacts and the original validation
history. The final exact-pin suite passed **30 tests in 7.59 seconds**, followed
by clean strict source/test mypy, Ruff and format checks. The earlier suite
passed 24 tests in 5.77 seconds; the expanded suite passed 30 in 7.88 seconds.
Two local typing stages corrected a tuple annotation/reused variable name,
then an explicit test import. Their diagnostics remain retained. A first
preparation command used the wrong working directory and failed before pytest;
its disposition and the initial source snapshots are also retained.

The first quick preflight passed fifteen checks and failed auto-vivify on a
link introduced by the local dependency import. The isolated writer lacks
the coordinator's separate final-CI evidence directory. A later docs-only
commit uses the already merged prior-study PR link alongside the present
main-proof record. The original gate failure is preserved; it is not relabeled
as a source or test failure.

The final test fixture tree is retained as a tar byte stream inside one gzip
artifact, with its complete file inventory. It contains **715 regular files,
2,137,705 original file bytes and 13 symlink entries**, including Git objects,
child stdout/stderr, input/expected JSON and framework aliases. The preservation
script checked every tar member's bytes/hash and each symlink target without
extraction. Original absolute paths remain in the raw fixture records. This
is unit/implementation validation, not the final 92-case outer envelope.

## Material independent findings retained before repair

1. The initial Python wrapper classified abnormal process exit before reading
   its child trace. A child that emitted collector entry/return and then
   crashed could be summarized as 0/0 with no result. The reviewer requires
   trace-prefix observations and any returned result to survive independently
   of `CompletedOperation=0`; absent/malformed trace must not imply zero.
2. File-backed output had a time deadline but no byte limit, and subsequent
   output/inventory reads used `read_bytes()` without a size bound. The
   reviewer requires declared output/trace/inventory limits, polling with
   explicit overshoot limits, and bounded same-file reads. The normal fixtures
   are small, but that does not establish the missing resource boundary.

Both findings are accepted and remain under repair at this initial checkpoint.
New real child failures after entry/return and small resource-bound witnesses
will discriminate the corrections. No registered behavior/cost stream, policy
episode, native target or scientific measurement was executed in this work.

## Repaired recorder and discriminating validation

The bounded repair is `0e0f8664765c7157b153bed86da217b8bf81a5e4`.
Its [separate lossless evidence](hidden-switch-compiled-validation/2026-09-07/identity-fixtures-repair/manifest.json)
preserves both 46-case passes (8.06 and 8.23 seconds), the initial test-only
unexported `os` typing diagnostic and its explicit-import correction, clean
final strict source/test mypy, Ruff and format logs, and ten exact source/helper
pins. The original implementation and original thirty-case evidence remain
unchanged above.

Python trace inspection now precedes abnormal-close classification. Valid
observed entry/return markers and any returned record survive a later crash,
even when a subsequent trace row is malformed. These are counts of observed
valid markers, not inferred total process work. Absent, unreadable or invalid
initial traces use null counts with `TraceStatus` and `TraceDetail`; they do
not fabricate zero collector calls. An abnormal child still has
`CompletedOperation=0`. Actual children that crash after the entry marker,
after the returned-result marker, or after an additional malformed trace row
discriminate this separation.

The declared output limits are 1 MiB each for stdout/stderr and 2 MiB for the
child trace. The parent polls their observed sizes every 20 milliseconds during
the existing 30-second deadline, refuses excess output and attempts to stop
its owned live launcher/process group. A child can overshoot between polls;
this is not an OS disk quota or a guarantee about arbitrary descendants after
the launcher exits. Raw output files remain intact. Fixed Git stdin now comes
from its already retained owned file, avoiding a separate pipe-write wait.
Each process record carries its limits, polling interval and resource-refusal
status separately from timeout status.

Reads admit a regular file's initial length against the declared bound, then
use the existing held-descriptor reader for at most that length plus one byte.
Regular fixture files are limited to 4 MiB each. Inventory traversal admits at
most 1,024 regular files, 32 MiB total file bytes, 4,096 directory entries and
32 directory levels, without following symlinks. A limit refusal retains the
owned root, first failure and bounded known file prefix; it cannot claim a
complete inventory. These are finite observation/read limits under the ordinary
owned-fixture filesystem assumptions, not protection from a hostile filesystem.

The new tests exercise real small stdout/stderr/trace overshoots, oversized
source admission before setup, an initial-file reader trap, a finite producing
reader that must stop at initial length plus one, and each inventory limit.
Existing close-after-success/error and returned-operation retention tests still
pass. The final test tree is retained as a verified tar byte stream in gzip:
1,067 regular files, 3,263,900 original bytes and 21 symlink entries across all
unit fixtures. These aggregate test-tree counts are not one fixture's inventory
and are not the final fifteen coordinator results.

Independent reviewer Vera, OpenAI Codex using GPT-6 Astra, accepted exact
`0e0f8664765c7157b153bed86da217b8bf81a5e4` by read-only source review. The
reviewer confirmed both repairs and the sixteen new discriminators, preserving
the polled-size/stable-tree limits and the requirement to supply independently
admitted collector/IEEE source bytes. The reviewer ran no fixture, test or
native code. All sixteen quick-preflight checks then passed on the preserved
repair/evidence tree; that raw gate log is appended to the repair manifest.
No policy, registered source stream, native target or scientific measurement
was executed by the fixture repair tests.
