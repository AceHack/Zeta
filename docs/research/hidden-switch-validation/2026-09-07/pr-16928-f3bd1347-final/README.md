# PR #16928: completed superseded head and retained failures

Date: 2026-09-07
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05

This read-only publication record concerns only
`f3bd1347e490084f411198dc8abff197c817eb1b`. Its successor
`f99c9f4e2502263943d899ec7a506aa287f76558` requires separate checks.
No experiment, build, test, PR setting, review thread or CI job was
changed by this review. The completed study's released claim remains released.

## Complete fixed-commit snapshot

The [14:58:34–14:58:41 UTC snapshot](summary.json) has **173 contexts:
151 successful, four skipped, fourteen cancelled, four failed and none
pending**. The [full check connection](checks.json) required four pages
of at most fifty rows. The [executed collector](fixed-commit-collector.py.txt)
bound the queried commit and every CheckRun's check-suite commit to the
exact source above, checked stable declared count and unique IDs, and
verified the terminal count. Both gate runs and their complete job pages
are retained. This is a bounded non-atomic observation, not a promise
that hosting metadata can never change.

| Gate run | Created UTC | Final run conclusion | Job outcomes |
| --- | --- | --- | --- |
| `34133451374` | 14:31:51 | CANCELLED | 58 success, 12 cancelled, two failures |
| `34133618773` | 14:33:42 | FAILURE | 70 success, two failures |

The first run's failures are `gate (required)` job `101779454436` and
`drift (loud)` job `101779519401`. The replacement run's failures are
`lint (semgrep drift)` job `101780447107` and `drift (loud)` job
`101784615565`. All four remain failures in this record.

The replacement [required gate](job-101784516195.json) passed. Its
[full log](job-101784516195.log.gz) and the successful three native
platform logs plus TypeScript hermetic log are retained with original
byte identities. A passed required aggregate did not make this matrix
green; the two actual failures still caused the replacement workflow's
failure. The existing BOM [diagnosis and original failed log](../publication-json-bom-correction/README.md)
document the bounded lossless packaging repair separately.

| Replacement check | Job ID | Completed UTC | Conclusion |
| --- | --- | --- | --- |
| Linux ARM64 build and test | `101780533806` | 14:44:59 | SUCCESS |
| macOS build and test | `101780533664` | 14:47:22 | SUCCESS |
| TypeScript hermetic | `101780447339` | 14:50:22 | SUCCESS |
| Linux x64 build and test | `101780533634` | 14:51:31 | SUCCESS |

## Supersession evidence and its limits

The [ReadyForReview event](ready-events.json) records 14:33:39 UTC. The
coordinator reports its ready command completed at 14:33:40.91 UTC. The
replacement run was created at 14:33:42. The pinned
[gate workflow](gate.yml.txt.gz) and [policy excerpt](gate-policy.json)
include `ready_for_review` and cancel in-progress pull-request runs in
the same PR concurrency group. These observations support ready-event
supersession as an inference. The REST run metadata exposes the event
as `pull_request`; it does not independently identify the action that
caused cancellation. Neither the coordinator nor this reviewer cancelled
or reran CI.

The original [required-gate log](job-101779454436.log.gz) explicitly
fails for cancelled build/test, cross-verification, full-verification
and TypeScript dependencies. The representative cancelled native
[job metadata](job-101778894600.json) and
[full log](job-101778894600.log.gz) preserve the cancellation itself.
The fourteen cancelled contexts comprise twelve gate jobs and two
attribution jobs. Attribution run `34133617602` was cancelled; the
later run `34133618945` succeeded. One cancelled attribution
[job](job-101779346710.json) has no steps; its log endpoint returned
[HTTP 404](job-101779346710-log-unavailable.json). No missing log or
more precise cancellation cause is invented. The attribution
[workflow](agencysignature-enforcement.yml.txt.gz) and
[policy](agencysignature-enforcement-policy.json) are retained too.

## Separate historical drift readings

The original run's advisory [log](job-101779519401.log.gz) reports
54 failures in 59 recent executions for each Windows leg (91.5%, zero
clean streak). The replacement advisory [log](job-101784615565.log.gz)
reports 53/59 (89.8%, clean streak one). Both name recent-main run
`34131348700`; neither figure is substituted for the earlier
[`a2bf4225` reading](../pr-16928-a2bf4225-review/README.md) of 56/59.
Each advisory has a real exit-1 failure. The separate warning about the
dashboard frozen at `33238368515` is retained as a warning, not the
cause of exit 1. These bounded recent-main readings do not establish
that Windows jobs ran on this PR head.

## Capture boundaries and identities

The [last current-head snapshot](last-current-head-snapshot.json) at
14:50:19 UTC found one review thread and zero unresolved threads;
the [complete thread connection](last-current-head-threads.json)
retains both comments. This was observed while the PR still named
`f3bd1347`; it is not a review-state claim for the successor head.
After the PR advanced, the original
[head-bound collector](current-head-collector.py.txt) correctly
[refused the changed head](head-advanced-refusal.json). The subsequent
fixed-commit collector deliberately queries the historical commit and
makes no current-PR admission claim.

The [job capture source](job-capture.py.txt) and its
[observed identities](captured-job-identities.json) retain the original
API/log bytes. Raw logs are losslessly compressed; the
[37-record inventory](manifest.json) binds stored bytes and decompressed
originals. Its hashes do not establish source-to-binary correspondence
or rerun any scientific comparison. This record preserves completed
publication outcomes and their provenance; it does not certify the
successor's pending matrix or a future merge.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer.
