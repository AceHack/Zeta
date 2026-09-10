# TLC retention publication proof

Date: 2026-09-07

Operational status: research-grade validation record

Author: Vera, OpenAI Codex using GPT-6 Astra

Work item: 081M1XQM8E4087G0R0036P5RWY

## Merge and source identity

[PR #16925](https://github.com/Lucent-Financial-Group/Zeta/pull/16925)
merged at 13:48:38 UTC from checked head
`038ff0e3c854d6757dce08252ee9c15e5105429c` as
`c36ac21bf1c561ad0726d4dceb027d3c3cff823e`. The
[merge proof](publication/tlc-ci-merge-proof.json) records refreshed-main
ancestry, exact equality of the final visible PR body and signed squash
body, and equality of all eight changed source/workflow files between the
checked head and merge. The [project delta](publication/tlc-ci-merge-project.diff)
contains only concurrently landed `ZetaFsCollator.Tests.fs` and
`ZetaFsPosixNode.Tests.fs` links; the TLC helper link remains present.
This is not a claim that the complete project file or all merge-ref inputs
equal the earlier local test snapshot.

Both [remote archive identities](publication/tlc-ci-remote-archives.txt)
were verified. The original annotated archive object
`5b3663eb5bd0ddc4b8038ab05a6b2d7de70772e9` still peels to
`c247403be5d6320b74903e5562b36f55d6884d6f`; supplemental correction object
`7c0ea54e97886ac726bd6277253f1362a89fe9d7` peels to checked head `038ff0e3c`.
Neither tag moved. The [initial failures](ci-correction.md) and
[corrected local gate](ci-native-correction.md) retain their distinct
outcomes and execution scopes.

## Specific code-scanning disposition

CodeQL check `101761137412` initially failed with two
`js/file-system-race` alerts, [895](publication/tlc-ci-codeql-alert-895.json)
and [896](publication/tlc-ci-codeql-alert-896.json). The
[failed check](publication/tlc-ci-codeql-check.json) names actual PR head
`038ff0e3c`; the alert instances name synthetic merge
`3241bfa5628cb30076b1d51fc05fbbe624cc5592`. Both identities are retained.
Its then-missing C# configuration warning was a separate analysis
completeness issue, not explained by the test-alert disposition.

The alerts identify `tlc-attempts.test.ts` lines 56 and 59. The fixture
opens an original descriptor, renames its pathname away, and creates a
different file at that pathname. Reading the replacement establishes
that the adversarial substitution occurred. Those pathname operations
do not use the earlier open as continuing pathname authorization.
The actual production helper receives the retained descriptor, fstats
and reads that same descriptor, and writes captured bytes exclusively.
Assertions require original contents and digest in the copy while the
old pathname contains replacement bytes. The duplicate-destination
assertion also requires refusal without changing the existing copy.

Root and Vera's independent protocol-review agent each read these exact
source paths and accepted the test-only disposition. The independent
reviewer verified that both TS files remain identical to reviewed
`91baf83d79`, and specifically concluded that replacing the fixture's
pathname operations with descriptor operations would remove the
regression discriminator. The scratch directory belongs to the fixture;
no hostile namespace or concurrent in-place-write isolation guarantee
follows. This was source/alert inspection, not a new test or build.

The explanations were posted to
[the first thread](https://github.com/Lucent-Financial-Group/Zeta/pull/16925#discussion_r3950272441)
and [the second thread](https://github.com/Lucent-Financial-Group/Zeta/pull/16925#discussion_r3950272737),
then both were resolved. Only alerts 895 and 896 were dismissed, using
GitHub's supported `used in tests` reason. The first triage attempt was
rejected with HTTP 422 because the comment exceeded 280 characters;
its request and both failure responses are retained. A shorter request
succeeded at 13:42:57/58 UTC. No source bytes, audit baseline, unrelated
alert or general suppression changed.

The [subsequent check](publication/tlc-ci-codeql-check-after-triage.json)
reports success and no new alerts, after both C# analysis jobs also
completed. The original failed check snapshot remains failed evidence.
Raw requests, replies, resolutions, triage responses and their exact
byte fingerprints are indexed in [the publication manifest](publication/file-hashes.json).

Independent review attribution: Vera, OpenAI Codex using GPT-6 Astra,
independent protocol-review agent. The reviewer did not execute a test,
build, JVM, or scientific experiment for this disposition.

## Remote validation

All three native platform jobs, the complete TypeScript suite, full-verify,
and the required aggregate passed at the checked head. The
[complete corrected macOS log](publication/corrected-macos.log.gz) retains
the actual inherited-pipe fixture pass at 435 ms and seven successful
project summaries: 7,546 passed and six skipped. That duration is a
reported execution, not a new latency threshold. Its merge-ref scope
differs from the earlier local `4b4d9a237` gate of 7,539 passed and six
skipped; neither count overwrites the other. Compressed and uncompressed
log fingerprints appear in the publication manifest.

The first log-download attempt returned GitHub CLI's escape-sequence
refusal and no bytes. The second explicitly allowed escape sequences
into the retained file; the original log bytes were not rendered to the
terminal or rewritten. No CI job was rerun or cancelled to obtain these
outcomes.

The [final check rollup](publication/final-check-rollup.json) contains
95 successes, nine skips, two superseded attribution cancellations, one
nonblocking drift failure and no pending check. Both cancelled attribution
checks have successful replacement executions. The
[actual drift log](publication/tlc-ci-final-drift.log) reports historical
Windows ARM and Windows 2025 failures, each 56 of 59 executions with last
main run `34126895868`; the separate verdict-drought step passed. This
remains a failure signal and is not described as all checks being green.
The final [source/archive push log](publication/tlc-ci-publication-push.log)
retains all sixteen successful pre-push checks and the new immutable
correction tag publication.

## Lossless packaging of the raw merge response

A later hidden-switch publication check at `f3bd1347e` found three literal
U+FEFF characters in the raw merge-commit API response. Its `files` array
contains old log patches, including their original BOM characters. The
[raw response is now losslessly compressed](publication/tlc-ci-merge-commit.json.gz);
its [manifest](publication/file-hashes.json) records both compressed identity
and the unchanged 711,308-byte original, SHA256
`040B64E0A36A7935F28ABA75DC825040A1552910E47E3A3A10D2D61E44950205`.
The [packaging record](../../hidden-switch-validation/2026-09-07/root-final-api-bom-packaging.json)
retains exact byte offsets and JSON paths. Decompression recovers the full
original response; no character was stripped, no raw JSON was reserialized,
and no lint rule or scientific artifact changed.
