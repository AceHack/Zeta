# Mixed-message bridge: counter knowledge and binding admission corrections

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade implementation and development validation
Lifecycle: active
Disposition: corrected source checkpoint; independent assembled admission pending
Work item: 081M1Z63YMC087G0R003N5FH9X

## Source and retained findings

The [initial implementation](2026-09-08-mixed-message-epoch-bridge-implementation.md)
and its source `8e1fe19a074368c3fd48f5f6cb871b1ce5d6b141` remain in history.
Its report/custody commit `051d02c464e8927b868d158eb54d44f380767d22` was normally
pushed with all 16 checks passing and its exact remote head freshly verified.
This follow-up preserves two later source corrections, their original actual
observations, and the source-stable validation of each corrected cut. It is the
implementation owner's account, not independent final acceptance.

The original returned-result admission required equal core and coordinator
remote counts and completeness flags. Ten synthetic knowledge combinations were
passed through actual full returned-frame admission against the unchanged
initial bridge source: six incorrectly refused and four passed. The original
frames, source/test copies, commands, failures and outputs are retained.

The coordinator and core owners agreed to interpret each `Observed,Complete`
pair as the singleton containing Observed when complete, or the interval from
Observed upward when incomplete. The correction refuses disjoint intervals;
it preserves both observers' original knowledge and does not upgrade either
observer's completeness flag. Existing source, response, schema and budget
checks still apply. The complete actual EpochResult remains unchanged.

A separate discriminator then exercised a simulated closed refused session with
core count zero/incomplete and coordinator count one/complete. After the first
compatibility repair, PriorWork still copied the core's smaller observed count.
That actual failure binds the retained intermediate source snapshot, not the
original initial commit. PriorWork now accumulates coordinator-observed session
deltas for native launch, certificate entry and nested-reference entry, with
coordinator incompleteness retained separately in outer Remote. Incomplete
deltas are not described as exact hidden totals. Commit
`0e0369a22ca9bf1687addf2d328ef82b0d22bdf5` preserves both changes.

The second mismatch concerned path admission. The Python manifest admitted a
263-character source path, a newline-containing path and a DEL-containing path;
the compiled core and peer already require printable ASCII within 256
characters. A pure manifest probe against exact `0e0369` returned a complete
ServiceManifest for all three inputs. It performed no native launch, service
call or source-file read. The original manifest bytes, actual returned values,
source snapshots and failed probe exit are preserved.

Commit `4402be8a7121f2f1609d4a7213d7ba7d3e3e65ee` aligns source paths with that
existing printable-ASCII/256-character rule. Three refusal controls and an
accepted printable 256-character boundary control discriminate the repair.
There is no new frame, wire field, session, budget, reset, refund or retry.

## Exact source and checks

The final three source identities are:

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `src/Interp.Python/zeta_interp/mixed_message_epoch_bridge.py` | 198381 | `18A2E29434E528912B47D657B82CC75EF3FEC0AB7089E39C9E864ED6352267EB` |
| `src/Interp.Python/zeta_interp/mixed_message_epoch_controls.py` | 16771 | `03ED13D4D860D1E3B61B73AF265B7C65A8251B258623C16B1B1ED28EC6C51711` |
| `src/Interp.Python/tests/test_mixed_message_epoch_bridge.py` | 61841 | `09BB4C61741D4698085741F807CE5A6C0263B3219BD4C33E7613675255828298` |

The counter correction passed 96 dedicated fixtures, strict three-file mypy,
Ruff and format checks. Its full repository preflight passed all 18 checks in
609.43 seconds; the separate formatter exited zero in 17.85 seconds. Final
`4402be8` passed 100 dedicated fixtures in 4.86 seconds and the same strict
three-file checks. Its full repository preflight passed all 18 checks in
605.03 seconds; the separate formatter exited zero in 18.97 seconds.

Both repository gates captured the exact three source files before execution.
The preserver compared each capture to the corresponding immutable Git source
and the final dedicated test/style snapshots. The final source was unchanged
through its gate and committed while that gate ran; the runner does not retain
a HEAD observation or justify inventing one. These later report/archive paths
receive separate normal push checks. Formatter output records its C#/VB support,
unsupported F# projects and workspace-loading warning; zero exit is not F#
formatting coverage.

Repository gates run existing numerical unit/model tests. No registered M4/M5
route, separately registered frozen nested query, or standalone native numerical
producer was invoked in this correction work. The dedicated bridge controls use
inert plans, injected services, simulated sessions, real owned Store files and
small transport children. They are not the registered experimental results.

## Custody and remaining scope

The [correction custody](mixed-message-epoch-bridge-validation/2026-09-08/correction-1/README.md)
contains 858 regular original files, 4,783,518 original bytes, in a lossless
822,952-byte archive with SHA256
`9C9C3FCF79E4458CECC98E67B9AABCC32114F2ABDA182381FD2C8270439C197B`.
The preserver re-read every stored member and every local original without
extraction. Its explicit selected roster excludes its redirected stdout;
43 convenience symlinks are metadata only and are not followed. The initial
checkpoint archive and its earlier preservation failure remain unchanged.

The separate [peer foundation review](2026-09-08-mixed-message-epoch-peer-foundation-review.md)
is source-only and accepts no missing peer lifecycle. Complete peer/core source,
assembled source/service manifest admission, and the coordinator's fixed actual
controls remain separate requirements. Full BridgeResult stays honestly retained
in memory; existing durable originals and bounded summaries do not constitute a
serialized full result.

A later source-only discussion also identified that this cut does not enforce
training-withdrawal descendant invalidation. Retractions are structurally
admitted, but a selected artifact's TrainingCut hash alone does not reveal its
historic rows. Same-owner sealed sessions contain more local ancestry evidence;
that is not a general imported provenance contract. A conservative refusal of
learned-artifact reuse on a cut with retractions was proposed to the coordinator
as a separate follow-up. It is not implemented or validated by this checkpoint,
does not establish selective ancestry or revocation across independent owners,
and must not be described as inverse SGD.
