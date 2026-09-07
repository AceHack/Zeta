# TLC attempt retention and startup-only retry repair

Date: 2026-09-07

Operational status: research-grade validation record for a factory repair

Lifecycle: active; local combined validation completed, publication pending

Author: Vera, OpenAI Codex using GPT-6 Astra

Work item: [081M1XQM8E4087G0R0036P5RWY](../../workitems/done/2026/09/081M1XQM8E4087G0R0036P5RWY-retain-tlc-failure-attempts-and-restrict-retries-to-jvm-star.md)

## Problem and scope

An unexpected TLC result must remain inspectable after the test assertion.
Previously the F# runner removed its metadir and crash report before judging
the result, then exposed only a short output tail. The TypeScript runner
could retry a fatal in-run JVM failure and reuse output/state paths, losing
the first failure while obtaining a later result. These are diagnostic and
retry defects independently of the cause of any particular JVM failure.

The motivating hidden-switch run reported a fingerprint recovery failure;
an unchanged isolated run then reported SIGBUS. Their original logs are
retained in the [validation inventory](tlc-attempt-retention-validation/2026-09-07/README.md).
The logs do not establish a root cause. The SIGBUS interpreted-frame marker
does not establish a C2 compilation failure. The separate runtime-policy
investigation and its C1 candidate are dependencies, not conclusions of this
repair.

This change leaves the registered models, jar, state-count expectations,
model-checker timeouts and JVM policy unchanged. It adds owned diagnostic
arguments and a 30-second runtime-identity capture deadline. The F# model
process still has its existing no-timeout policy; the TypeScript model
process still has its existing one-hour timeout. No scientific receipt,
protocol threshold or hidden-switch source is changed by this work item.

## Owned attempts and admitted input bytes

Every attempted execution receives a fresh directory under the ignored
`TestResults/tlc-diagnostics/` root. Its initial `attempt.json` is written
before source collection, copying or a Java subprocess. The directory owns
its private `workspace/`, `states/`, full raw model streams, full version
probe streams and separate model/probe `hs_err_pid%p.log` paths. Diagnostic
JSON and streams use exclusive creation. No attempt overwrites an earlier
attempt's files.

The input collector admits current flat `.tla` and `.cfg` working files
reported by `git ls-files --cached --others --exclude-standard`. This
includes unstaged modifications and newly added, untracked helper modules
and configurations. It copies the entire admitted local source closure,
not just the selected model. Generated `_TTrace_` and `MC*.tla` files are
excluded; nested/quoted paths, symlinks and non-source inputs are refused.
Ignored non-generated local source files cause an explicit refusal instead
of silently disappearing from module resolution. Each source/copied file
is hashed and inventoried; copying mismatched bytes is refused. A partial
copy failure retains the completed inventory and its stage.

This is a flat local-module contract. It does not claim support for an
arbitrary external filesystem or JSON/CSV dependency. Existing catalog
source inspection found no such dependency, but moving the working
directory still requires the combined full catalog gate. The source hash
inventory binds working bytes. `SourceCommit` records checkout HEAD context
and is explicitly not a clean-source assertion.

The [initial publication CI correction](tlc-attempt-retention-validation/2026-09-07/ci-correction.md)
records two additional TypeScript findings and their retained failures.
TypeScript now checks and reads one open source descriptor, copies those
bytes exclusively and records optional no-follow/nonblocking flag
availability. Static symlink observation on platforms without no-follow
retains the stable writer-tree assumption shared with F#. Neither runner
claims hostile namespace isolation or an atomic whole-tree snapshot.
The corrected timeout fixture uses an untimed wait in its child; only the
capture watchdog ends it.

The separate [macOS fixture correction and final native gate](tlc-attempt-retention-validation/2026-09-07/ci-native-correction.md)
then replaced the fixture's launcher-speed assumption with observed exit
and explicit cancellation through the shared production start/drain path.
The final integrated gate at `4b4d9a237` passed 7,539 tests with six existing
skips and zero failures; the Release build had zero warnings/errors. This
is this writer's corrected snapshot, distinct from the earlier larger
root integration. All prior failed attempts remain preserved.

## Judgment, cleanup and retry

Both runners retain full stdout and stderr as files during execution.
The TypeScript process writes directly to owned file descriptors rather
than a bounded output buffer. The F# runner copies both redirected raw
streams to exclusive files. The Java version probe runs in the same owned
workspace, using the same resolved executable as the model process and a
distinct crash path. Its exact argv, deadline, exit and available runtime
identity are recorded. The deadline covers process exit and pipe drainage;
an exited launcher with a child holding its output pipe is a timeout.

The complete semantic judgment precedes cleanup: the pinned banner,
completion/expected-violation detail, exit code and applicable exhaustive
state count must agree. A valid completion followed by a fatal/nonzero exit
still fails. An expected violation is not retained merely because it exits
nonzero; its complete expected result can clean up its own attempt.

Unexpected results retain the entire attempt, including all state bytes.
The completion record includes state/workspace file counts and byte totals.
These inventories are observations, not quotas. No size cap or automatic
purge is introduced. A later successful attempt removes only that later
directory, preserving earlier failed startup attempts.

Retries remain capped at three and require an ordinary exit code 1 plus
explicit pre-TLC JVM initialization evidence. Any checker banner, progress,
model answer, internal error, fatal text, signal, timeout or process error
vetoes retry. TypeScript preserves metadata-only signal/error evidence;
F# launch/capture/probe errors terminate before its retry loop. Neither
runner retries a TLC answer to obtain green. Existing settle delays remain
1.5 seconds in TypeScript and 2 seconds in F#.

## Retention limits and operational handling

Ignored local diagnostic directories are host-durable artifacts, not
automatically git-canonical evidence. An operator can inspect the printed
attempt path and explicitly remove that one directory after retaining the
needed evidence. Cumulative local disk usage is not globally bounded.
Selected findings and logs become git-native evidence only when committed,
indexed and reachable, as in this work item's validation inventory.

The .NET CI matrix uploads the owned diagnostic root with
`include-hidden-files: true`, `if-no-files-found: ignore` and seven-day
retention. The pinned upload action defaults to excluding hidden files;
the explicit setting preserves the owned directory's hidden contents.
See its [pinned action definition](https://github.com/actions/upload-artifact/blob/043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/action.yml).
CI upload remains conditional on runner and upload availability, and the
artifact's host retention is not canonical git preservation.

If the filesystem itself cannot create/write evidence, the runner reports
the attempted path and original error; it cannot guarantee a receipt under
storage failure or runner loss. Runtime executable/assembly hashes, MVID,
version text and source fingerprints identify the available bytes. They
do not prove a source-to-binary mapping or identify the entire JDK closure.
Timeout cancellation bounds managed probe capture; it does not promise
hard real-time scheduling or ownership of arbitrary orphan descendants
after an external launcher has exited.

## Focused verification and reviewed findings

[Independent source review](2026-09-07-tlc-attempt-retention-review.md)
accepts `07e399929` within the retention/retry scope. Its reviewer separately
verified the nine source fingerprints and then-retained raw log hashes.

The first source pin is `2e69017ff2c8bf2294adbd7f3ea6b02980fd204c`.
It passed 45 TypeScript tests with 202 expectations, strict TypeScript
checking, 17 F# synthetic/metadata cases, formatter, actionlint and all
16 quick-preflight checks. No real TLC model ran in these focused checks.
The inherited-pipe repair is pinned at `07e399929`. It passed 18 native
checks; Bun 1.3.13 parity also passed 18 native checks and 45 TypeScript
checks (202 expectations). The final source-only metadata qualification is
covered by the parent's required fresh integration rebuild.

The shared retry roster contains 17 cases. Additional fixtures exercise
large raw streams, crash/state preservation across later cleanup, exclusive
creation, source-copy refusal, actual git collection of unstaged/untracked
helpers, explicit ignored-helper refusal, missing executable, timeout,
partial descriptor opening and the diagnostic-only ErrorFile argument.

Review by the coordinating root and the independent source reviewer found
and repaired these concrete issues before publication:

1. Text-only retry classification discarded signal/timeout metadata.
2. The version identity probe needed an owned cwd and separate ErrorFile.
3. CI hidden-file upload needed explicit enablement.
4. Tracked-only collection omitted new source helpers; ignored helpers also
   needed a stated refusal boundary and a test through the actual collector.
5. The identity probe needed a deadline, and failure opening its second
   stream needed to dispose the first descriptor.
6. F# direct-process timeout initially left inherited-pipe EOF unbounded;
   the complete capture deadline and real launcher/child fixture close this.

The TypeScript synthetic run also exposed Bun omitting `status`/`signal`
on a launch failure; receipts now normalize these to explicit null values.
Earlier compile/type-check failures remain in the inventory. A final F#
compile attempt exited 139 without a source diagnostic; the one unchanged
retry passed all 17 then-current cases. Its cause is unestablished. The
policy reviewer confirmed no Java/.NET/quick/push activity in that lane
during the observed 11:19-11:21 UTC compiler window; a 0.4-second Python
archive/hash step at 11:20:19 is recorded without causal attribution.
These observations do not establish all host activity.

The original failed hidden-switch full gate remains failed. The parent
coordinated the fresh mapped Release build and full solution/catalog gate
on the combined C1-policy, retention and hidden-switch tree. The matched
source bytes and completed integration outcome are retained below; the
separate CI and main-integration evidence follows at publication.


## Completed combined gate

The coordinating parent executed the fresh mapped Release build and full
solution gate at `457bdf094f368eb9e6f2b359b72e5677fd015eb3`, completing on
2026-09-07 at 11:44:01 UTC. The [self-contained gate record](tlc-attempt-retention-validation/2026-09-07/README.md#combined-gate)
retains the prelaunch input hashes, exact commands/full logs, seven compressed
TRX files, result inventory and active BftConsensus invocation/runtime
snapshots. The repair author copied the raw bytes and independently parsed
all seven TRX files without rerunning the gate.

The build passed with zero warnings and errors in 101.75 seconds. The full
solution has 7,552 passed rows, six existing skipped rows and zero failures;
all 52 pinned TLC cases, 18 TLC synthetic/metadata cases and 16 additional
hidden-switch tests passed. BftConsensus passed in 4m37.99s. No prelaunch
input or scientific source changed during the gate, and no unexpected TLC
attempt directory remained after the successful run.

This is shared validation on a larger combined snapshot containing the
separate C1 policy and hidden-switch tests. It is not a claim that 7,552
checks ran in this smaller repair branch. The repair's capture/retry code
is unchanged from the accepted source pins; its two overlapping invocation
files differ only by the separately reviewed C1 comment/assertion hunks.
The project also contains the additional scientific test links. Final PR
integration includes the C1 policy from main and verifies the resulting
runner/input bytes before publication. Later unrelated Python/TypeScript
historical-receipt fixture fixes do not rewrite this native result.

The original failed attempts remain failures. The fresh successful gate
establishes this tested integration result, not a general JVM stability
claim or a root cause for the earlier failures. The activity record retains
the already-running quick-lint overlap at root build start; this was not a
registered quiet cost window.


## Main integration and publication archive

PR [16917](https://github.com/Lucent-Financial-Group/Zeta/pull/16917) merged
as `536570576cfb980f6303be2040d8d3034b2ac13d`; the exact checked source head
was `e2a11ebc9ca5e94c02656e904ddef9ba1b4f32f5`. Its required gates passed;
the final rollup also retained one nonblocking historical Windows drift
report, separately from those required checks.

The repair integrated that main commit at `28a1170`. The
[post-integration comparison](tlc-attempt-retention-validation/2026-09-07/main-integration-input-comparison.json)
finds 97 of 98 combined-gate input hashes identical. The sole difference is
[exactly six additional hidden-switch source/test project links](tlc-attempt-retention-validation/2026-09-07/combined-project-links.diff)
in the larger combined run. The retention/capture/retry implementation,
C1 policy, registry, jar and all local TLA inputs match. This does not imply
identical whole-tree or DLL identity between the two writers. The focused
branch's publication CI supplies its own execution evidence.

The supplemental annotated archive is named
`archive/validation/081M1XQM8E4087G0R0036P5RWY-tlc-attempt-retention`.
It is created from the source/evidence head containing this record before
opening the squashable PR, then remote-verified without moving the tag.
The original `2e69017ff` and `07e399929` review pins remain reachable from
that archive. Its git ref is the authority for the target commit; the
publication proof records the resolved tag and commit separately.
