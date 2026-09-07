# Pagination repair main-publication proof

Date: 2026-09-07
Operational status: research-grade
Lifecycle: landed
Work item: 081M1Y58Y72087G0R003820K4Q
Author: Vera, OpenAI Codex using GPT-6 Astra

[PR #16949](https://github.com/Lucent-Financial-Group/Zeta/pull/16949) merged at
15:48:25 UTC as `7fafe1f883599840c5e65c08ce5ebcaec3a0365d` from reviewed head
`4f8cde2af19c5c3bc5960ebd253280088cb340a3`. The local writer refreshed
`origin/main` and verified ancestry, all 49 exact squash-changed file bytes against
that head, and the complete expected signed squash body against both Git and the
retained GitHub API response. The [proof](proof.json), [message](squash-message.txt)
and [remote archive identities](remote-archives.txt) preserve those checks.
Both immutable supplemental refs retain their original targets; no tag moved.

The independent protocol reviewer collected the complete final non-atomic snapshot
at 15:53:43 UTC: **97 contexts, 93 success, three skipped, one failure, zero pending**;
no review threads. The required `gate (required)` check reports success. The sole
failure is advisory `drift (loud)` job `101800111064`, run `34138408885`;
that workflow's aggregate conclusion is consequently failure despite its other
71 jobs succeeding. It is not described as an all-green workflow.

The retained drift log reports historical Windows main success at 53/59 (89.8%),
clean streak zero, and latest completed main run `34138437704`. This is its own
observation, not the earlier hidden-switch study's advisory snapshot. The complete
23,288-byte raw log has SHA256
`A42487ECCF7FF93396A757CBF2E4E09B17B50768E05481F23EC73A17EE947792`.
The first API log request refused terminal escape bytes; its exact stderr is
retained. The successful request explicitly allowed them only while writing bytes
directly to a lossless gzip artifact, without rendering the raw terminal sequences.

The [manifest](manifest.json) binds all 20 copied raw reviewer files, including
both capture attempts and the complete two-page check snapshot. Already compressed
files remain byte-identical to the reviewer copies; other files are losslessly
gzipped with their original byte counts/hashes. The reviewer's own nested manifest
also binds decompressed API/log bytes. This is source/hash/API evidence, not a new
execution of the helper or a live unsafe merge claim.

An initial publication-proof setup used the updated PR base against its older
head as a changed-file roster; that incorrectly included unrelated main history
and refused at `.github/workflows/interp-lane.yml`. The
[qualified setup account](proof-attempt-1-refusal.json) retains the failure.
The successful proof uses the exact squash-parent-to-squash changed paths.
No product or scientific source changed during this publication pass.

The [correction report](../../../2026-09-07-merge-observe-pagination-correction.md)
and [validation index](../README.md) retain the original truncation witness,
synthetic authorization discriminator, corrected old-source replay, initial type
failure, independent review, and both successful Bun-version gates. The final
review accepted source `e5b6bf5b1913f3df1cf55d1dd4c608fbfd5376fd` and corrected
evidence head `4f8cde2af19c5c3bc5960ebd253280088cb340a3` without rerunning them.
