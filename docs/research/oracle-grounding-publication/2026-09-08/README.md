# Oracle grounding publication validation

Date: 2026-09-08 UTC
Operational status: research-grade validation receipt
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

The writer starts from main 9cc09171ca286b903a26c717169b46201dc9006e
and imports the reviewed kernel head by ordinary local merge. The kernel
subsequently landed through [PR 17041](../../precision-gate-kernels/2026-09-08/pr-17041/README.md).
Oracle changes retain the operative HC-8 paragraph, add conspicuous unchosen
baseline disclosure and deliberate multi-oracle preference to the original
manifesto, and correct two source comments. No runtime selector is introduced.

At source 4933a5f2af12f6b20f273488cf9174179d682fef all 18 full-preflight
checks passed, including release build and tests, in 700.254 seconds.
The formatter exited zero in 19.028 seconds, but its F#-unsupported diagnostics
remain in the raw record. The separate F# lint passed in full preflight.

Initial dependency installation exited 127 because the new writer's mise
configuration was untrusted and Bun was unavailable on that command's PATH.
Both mise files were byte-compared with the existing trusted writer before
trusting these copies. The unchanged frozen-lockfile installation then passed.
Original failure and retry outputs, preparation patches, source identities,
full-preflight and formatter records are retained in the [manifest](manifest.json).
The [archive construction note](archive-construction-note.json) separately
records the later incorrect manifesto path and its correction; no numerical
or validation process was rerun to repair that packaging error.

Independent [HC-8 review](../../2026-09-08-hc8-explanation-independent-review.md),
[default-disclosure review](../../2026-09-08-default-oracle-clarification-independent-review.md)
and [comment review](../../2026-09-08-tsirelson-feedback-comment-patch-review.md)
retain their own pins and findings. Warning versus mandatory explicit choice
remains open; no automatic fallback or mandatory stop is introduced.

## Published-main composition and second full gate

The ordinary merge of actual published main exposed two documentation
conflicts: additive reviewed links against an empty other-side hunk. Both
were resolved to the exact premerge writer bytes; competing source changes
on main were retained. Because main also added executable changes, the full
gate was rerun at c5f1fc0e6ff7b364404e602390cb37d5e2b51679. All 18
checks passed in 606.892 seconds. The [second manifest](current-main-validation/manifest.json)
retains the original conflict, explicit resolution, merge and process records.
No earlier failure or validation cut was overwritten.

The [independent composition review](../../2026-09-08-oracle-publication-composition-independent-review.md)
verifies the original manifesto and operative HC-8 bytes, all 26 initial
archive members, four source identities and the complete resolved merge tree.

## Composition with the landed magnet source

After PR 17045 landed, one documentation append conflicted with this branch's
append. The ordinary merge retains both complete sections, with a blank line
between them. Main also supplied a ZetaFsFreeze source/test change, so the
full gate was rerun at 9f422c77f3bec5ad647b32ef196c8493dc97dcef. All 18
checks passed in 606.947 seconds. The formatter exited zero in 17.580 seconds,
with its existing F#-unsupported limitation. The [later manifest](after-magnet-validation/manifest.json)
retains the conflict, resolution, process records and exact unchanged hashes
of all four oracle source/specification files.

The separate [audit-helper lint correction](../../pr17041-merge-review/2026-09-08/helper-lint-correction.json)
preserves its original source before removing one unused import from the
current helper. It neither changes nor reruns the historical audit result.

## Verified main publication

The [PR #17048 verification](pr-17048/README.md) retains the normal merge,
complete CI and all 126 path/whole-tree checks. The shared view was refreshed
cleanly to the merged main commit.

The [independent publication review](../../2026-09-08-pr17050-publication-independent-review.md)
checks both the magnet and oracle archives against their original records and
actual main merge trees. It also verifies the paused compiled-investment wording;
this adds no numerical or learned-system result.
