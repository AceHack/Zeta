# PR #16928: checked-head CI and separate partial local gate

Date: 2026-09-07
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05

This read-only publication review checks PR #16928 at
`a2bf4225cef685ff9c67037d8dbcf7e19b9704cb`. It does not reopen the
completed study's claim or rerun any experiment, build or test. The later
local checkout and its failed gate are separately identified below.

## Exact-head remote snapshot

Between 14:11:35 and 14:11:42 UTC, the [snapshot](snapshot.json) found
**92 successful checks, three skipped, one failed and none pending**.
The [full check connection](check-pages.json) required four pages of at
most 25 rows. All 96 are CheckRuns, and every recorded check-suite commit
equals the requested head. The collector verified the PR head and last
commit on every page, stable declared count, unique IDs/cursors, and the
terminal page's complete count. A before/after PR read also found the
same head. This is a bounded non-atomic snapshot of mutable hosting state,
not a claim that later observations or a different head have the same result.

| Check | Job ID | Observed result |
| --- | --- | --- |
| Linux x64 build and test | `101762604360` | SUCCESS |
| Linux ARM64 build and test | `101762604423` | SUCCESS |
| macOS build and test | `101762604357` | SUCCESS |
| `gate (required)` | `101768168025` | SUCCESS |
| CodeQL | `101762892011` | SUCCESS |
| `drift (loud)` | `101768218792` | FAILURE |

The [required-check command](required-checks.json) exited zero. Live
[CI Gate ruleset 16134995](ruleset-16134995.json) requires only
`gate (required)` from integration 15368. The retained
[exact-head workflow](gate-workflow-at-head.yml.txt.gz) gives the advisory
job a dependency on the required gate; the required gate does not depend
on the advisory. Thus the required check passed while the advisory and
aggregate [workflow run 34128437843](failed-run-34128437843.json) failed.
Calling the whole matrix green would be false. The PR remained open;
its REST `merge_commit_sha` field is a prospective merge, not a landed proof.

The [complete review-thread connection](review-thread-pages.json) has one
thread, both comments retained, and zero unresolved threads. The thread
about `hidden_switch_reference.py`'s public `PANELS` roster is resolved.
Its existing disposition names the test consumer and separate production
replay roster. This pass neither changes that source nor creates a new
source review, dismissal, comment or thread mutation.

## The failed advisory remains failed

The [original job log](failed-job-101768218792.log),
[job metadata](failed-job-101768218792.json),
[check metadata](failed-check-101768218792.json) and all four
[annotations](failed-check-annotations.json) remain available.
The raw log is 23,092 bytes, SHA256
`21a255d551252dbe0fae00a3aa6b42f78af55cbae8d7092cb7b39b7993b092d1`.
Its terminal escape sequences are retained as bytes, not executed.

The reporter's bounded recent-main window reports 56 failures in 59
executions for each of `windows-11-arm` and `windows-2025` (94.9%, zero
clean streak, last run `34127678235`). Those sustained-drift annotations
and the process exit 1 are the failure evidence. A separate warning says
the publication dashboard is intentionally frozen at run `33238368515`.
The warning is not the cause of exit 1, and the recent-window counts are
not presented as that frozen dashboard's values. The earlier advisory's
46/59 count does not describe this run. These historical-window readings
also do not imply that either Windows leg ran on this PR head.

## Separate incomplete local F# run

The [local gate comparison](local-gate-comparison.json) independently
checks all seven compressed TRX files and their losslessly decompressed
originals against the owner's retained inventory, then parses individual
outcomes and ResultSummary attributes. The source is
`4d7b13947bef9b53a65c043885971ceefa168e87`, distinct from the remote CI
head above. The owner's [initial result inventory](../root-main-gate-attempt-1-result.json)
records build exit zero, test-command exit 1 and F# test-process exit 139.

There are 1,204 completed passing F# outcomes and 990 passing outcomes in
the other six projects. The F# TRX **ResultSummary is Failed**. The
misleading console `Passed` line and the absence of failed individual
test rows do not establish completion: **this was not a passing full
suite**. This pass makes no crash-cause diagnosis and does not call the
test-host failure a compiler failure. It does not substitute remote
success at `a2bf4225` for a complete local gate at `4d7b1394`.

## Capture and preservation limits

The [executed collector](capture-script.py.txt) made only read requests.
Its [completion record](capture-completion.json) distinguishes two local
capture issues from the remote check results: the
[first partial capture](../pr-16928-a2bf4225-capture-1-incomplete/refusal.json)
stopped when GitHub CLI refused a log containing escape sequences. The
second capture retained the requested raw log and every API record, then
its final inventory step encountered the first capture's directory.
The already-written snapshot remained valid; a separate subsequent
inventory hashes the files. Neither collector process is reported as
an unqualified successful execution. No original failed CI log was replaced.

The [file inventory](capture-manifest.json) binds the retained records and
the first partial capture. The workflow's decompressed hash is in the
completion record. No scientific source, original result record, archive
tag, PR setting or external actor's work was changed. The required next
publication checks belong to the eventual new PR head; this fixed-head
review cannot certify them in advance.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer.
