# Guarded hidden-switch compilation: owned identity replay

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Author: Vera, OpenAI Codex using GPT-6 Astra, independent reference writer
Artifact status: bounded implementation validation; independent source review accepted

The [identity replay module](../../src/Interp.Python/zeta_interp/hidden_switch_compiled_identity_replay.py)
executes the seven fixed source and eight fixed Python fixtures afresh and
compares their complete recorded operation results. It uses the unchanged
[owned fixture runner](2026-09-07-hidden-switch-compiled-identity-fixture-validation.md)
and the [accepted coordinator case design](2026-09-07-hidden-switch-compiled-outer-negative-design.md).
This closes a bounded replay implementation slice; it does not complete the
92-case coordinator, admit source/runtime closure, launch native code, or
generate or measure a registered policy stream.

## Fixed callers, owned roots and actual returns

The complete replay API, replay_identity_cases, runs the ordered fifteen-case
roster in fresh case-00 through case-14 roots under an existing caller-owned
parent. Its independent inputs include records, producer_roots and
python_sources. The replay_identity_case API exposes the same implementation
for one separately caller-fixed allowed ID. Its success scope is explicitly
one-fixed-identity-case-only; complete ordered success instead reports
fifteen-fixed-identity-cases-only.

The producer never selects a mutation or executable function. Each
RecordedIdentityCase carries the fixed ID, exact ordered fixture/expected input
bytes, fixed operation/role names, original result JSON bytes and, for Python
cases, exactly three ordered child artifacts: stdout, stderr and trace. The
caller independently supplies the original root map and the exact admitted
collector/IEEE helper source pair. Those source bytes are inputs to the reviewed
tiny fixture package; this replay does not certify their source or runtime
provenance.

Every generated target is lexically checked against **every** independently
supplied producer root before any fixture call, rejecting equality and both
ancestor directions. Original root labels are never resolved, opened or
executed. The existing fixture runner retains canonical checks on its own
actual target and parent before creating files. Its exclusive creation refuses
existing roots; no original tree is regenerated, adopted, retried or removed.
The tests include an original directory moved away before replay, its now-absent
old name as an overlapping target, and an overlap with a different later case.

The complete actual FixtureReady or FixtureFailed return is retained before
recorded-input comparison, result parsing, encoding or later child-file reads.
A raised ordinary exception is retained separately and never relabeled as a
returned result. Counts distinguish fixture starts, fixture returns, completed
operations and matched cases. An abnormal child remains incomplete even when
its valid collector entry/return prefix survives. A later encoder/read failure
can therefore retain one completed operation and zero matched cases. Earlier
fixture outcomes, raw caller records and owned files remain available.

## Exact comparison and permitted associations

Producer input bytes are reconstructed using the existing fixed serializer
after changing only the explicit root fields below. All other input fields,
source bytes, roster order, source SHA256 values, Git blobs and commits remain
exact. Fixed Git author/committer dates make identical commits expected; a
different environment may conservatively refuse instead of relaxing identity.

| Surface | Permitted root or process association |
| --- | --- |
| Source fixture input | The declared Repository is original root plus /repository. |
| Python fixture inputs | Clones.A, Clones.B and CloneRoot retain their exact A/B roles. |
| Python process result | Directory and the named PYTHONPATH, ZETA_IDENTITY_ROOT, ZETA_IDENTITY_B_PACKAGE values retain their fixed suffixes. |
| Python process identifier | The original and replay PIDs must each be positive integers; both raw values are retained in Association. |
| Successful collector result | CloneRoot and each fixed module's AbsolutePath, File, SpecOrigin and LoaderPath retain the admitted relative module path. |
| Module cache metadata | A non-null CachedPath must match the exact module stem, interpreter cache tag and __pycache__ location. |

There is no generic recursive path replacement, omitted-field list or
producer-named type instantiation. All interpreter identities, version data,
source bytes/hashes, result types, refusal codes/messages, flags, counts and
other metadata remain exact. Different interpreter or virtual-environment
identities can conservatively refuse. Complete result trees use the unchanged
bounded encoder and strict JSON decoder; harmless result JSON whitespace is
allowed while bool/int, integer/float and signed-zero distinctions remain.

Before comparing across roots, original stdout must agree with its own recorded
collector result, and its trace must contain exactly the corresponding entry
and return rows. The independently constructed before/after module tables
name the one foreign entry/helper in B, the missing or dynamic helper, the
changed origin in B, the changed helper-byte hash and the one extra module
where required. Every other module remains in A. These checks also run against
the actual fresh child output. A correct refusal code without its matching
child output and path discriminator does not earn a match.

Fresh stdout/stderr/trace reads use the reviewed bounded storage reader on
the fixed owned names. Each actual read outcome is retained. Recorded result
bytes are limited to 1 MiB; fixture input files use the runner's 4 MiB bound,
stdout and stderr are each limited to 1 MiB, and the trace to 2 MiB. These are
implementation retention/read bounds, not a scientific threshold or process
peak-memory guarantee. Caller-held objects, raw rejected values and repeated
canonical copies remain outside a claimed aggregate memory ceiling. Sequential
calls, stable values and the ordinary owned-filesystem premises remain explicit.

## Pinned source and validation history

Source/test commit: d3bd541e1d043e199c4b54b5390450028473c1cd.
Only the two new replay files changed. The existing fixture, source, storage,
encoder, admission and numerical-result helpers remain unchanged.

The first focused suite passed **51 cases in 19.11 seconds**. One reused local
variable typing diagnostic and two style findings were corrected. The expanded
suite then passed 54 of 55 cases: the added moved-original witness correctly
refused overlap and preserved the file, but its final assertion expected a
literal backslash-plus-n instead of the actual newline. Original source and
failure output remain retained. The corrected suite passed **55 cases in
17.63 seconds**; strict source/test mypy, Ruff and format checks passed.

The tests execute actual Git repositories and tiny python -m children,
including real child crashes before and after collector return. They cover
complete ordered replay, late missing/extra/malformed rows, wrong refusal or
success, changed blob/count types, producer-selected mutation/operation labels,
missing or substituted child artifacts, wrong foreign paths, false PID/path
associations and internally consistent false interpreter metadata. They also
exercise late actual encoder/read refusals and verify that a complete
fifteen-case returned DTO passes the unchanged bounded public-result encoder;
private Path values do not appear in that valid public result.

Independent reviewer Vera, OpenAI Codex using GPT-6 Astra, accepted exact
d3bd541e1d043e199c4b54b5390450028473c1cd after reading both files and checking
committed/current source hashes and the final test/type/style logs. The reviewer
confirmed the fixed dispatch, all-target/all-original overlap checks, complete
result and child-trace comparisons, exact associations and retained failure
prefixes. No material source finding remained. The reviewer did not execute
tests, fixtures, native code, policies or registered sources. Signed source
review 98ffea01958e9eaf273aa5803f6f782a5d8749e1 was provided to the coordinator;
the actual capture inventory is a separate preservation step.

## Retained raw evidence

The [lossless manifest](hidden-switch-compiled-validation/2026-09-07/identity-replay-attempt-1/manifest.json)
binds twelve source/helper/test files and 68 artifacts containing 74,728,326
original bytes. Four streaming tar/gzip archives retain the complete original
owned trees. Every archived member was checked against its original file
length/hash or symlink target without extraction, and the complete decompressed
tar byte stream has its own SHA256.

| Owned tree | Regular files | Original file bytes | Symlinks |
| --- | ---: | ---: | ---: |
| First 51-case run | 3,689 | 10,068,327 | 21 |
| Expanded run with newline assertion failure | 3,730 | 10,088,110 | 23 |
| Final 55-case run | 3,730 | 10,088,110 | 23 |
| Separate actual producer/replay capture | 976 | 2,452,262 | 2 |

Those are aggregate implementation-fixture inventories, not one fixture's
resource limits or scientific sample counts. Original paths, process
observations, Git objects, child files and failure traces remain unchanged.
An initial source-writing tool request failed during JavaScript argument
parsing before a shell or file mutation; its disposition is retained separately.

The standalone capture executes and records all fifteen producer fixture
returns, then all fifteen fresh replay operations. The final replay counts are
15/15/15/15: started fixtures, returned fixtures, completed operations and
matched cases. It retains 32 public-result artifacts: fifteen producer returns,
the recorded fixture tuple, the full replay result and fifteen fresh fixture
returns. The capture uses exclusive external evidence files alongside the
fixture runner's retained owned trees.

Ten loaded task module paths/current source hashes and the two supplied child
source hashes are observations in the capture record. They do not admit a
complete parent Python entry/module/runtime roster or prove source-to-bytecode
correspondence. Raw artifact/source admission, expected original-root custody,
remaining coordinator cases and the final linked-envelope replay remain
separate obligations.

Focused Markdown validation and all sixteen quick-preflight checks passed after
the evidence and index were written. Their exact output is retained in the
manifest; this scoped publication check does not replace a whole-repository
native gate or the separate final coordinator admission.
