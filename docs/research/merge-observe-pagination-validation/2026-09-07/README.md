# Merge-observer pagination validation

The indexed [repair report](../../2026-09-07-merge-observe-pagination-correction.md)
and [work item](../../../../workitems/done/2026/09/081M1Y58Y72087G0R003820K4Q-reject-truncated-github-merge-receipts-and-page-every-blocke.md)
state the claim boundary. All API operations in this record were read-only.

## Retained evidence

[evidence-manifest.json](evidence-manifest.json) hashes every stored compressed
file and the exact bytes obtained by decompression. API responses and the
original audit output are compressed losslessly; no BOM or other raw
character was removed. The compressed files are ordinary gzip and can be
read with `gzip -dc <file.gz>`.

- `merge-observe-live-{first,second}.json.gz`: sequential 100+71 check-context
  diagnostic pages for PR #16928 at head `f3bd1347e490084f411198dc8abff197c817eb1b`.
- `merge-observe-audit.ts.gz` and `merge-observe-audit-result.json.gz`: the
  baseline pure mapper/authorizer fixtures. They ran before edits against
  `9fae5f8c3c499d424bc773fa4a13c057d7990495`. The script expects the original
  workspace-relative `.git` layout and original baseline implementation; it
  is an execution record, not a standalone current-source replay CLI.
- [baseline-witness-summary.json](baseline-witness-summary.json): the fixture
  outcomes and only the actually observed live count/state/action projection.
  The old raw audit's default `autoMerge`/`mergeCommit` fields are not live
  evidence, since that diagnostic query did not request them.
- `merge-observe-candidate-*` and `merge-observe-closed-candidate-*`: exact
  candidate requests, responses and metadata for the later live #16928 read
  and the two-request #16925 traversal. Native JSON summaries include the
  actual requested auto-merge and merge-commit fields.
- The enum lookup's initial three-field request was refused by GitHub's
  introspection field limit. The retained two subsequent lookups establish
  the admitted CheckStatusState, CheckConclusionState and StatusState values.
- The pre-write claim inventory and claim push log retain overlap checking
  and all 16 successful initial pre-push checks.

## Owner-run checks and failed attempts

| Record                | Outcome                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| focused-attempt-1     | 29 passed, one failed: old fixture requested PR 1 but answered PR 42; new identity check refused it |
| focused-attempt-2     | 80 passed, 240 assertions; fixture now requests its actual PR 42                                    |
| typecheck-attempt-1   | Ad-hoc command omitted `--allowImportingTsExtensions`; TS5097 import-option diagnostics retained    |
| typecheck-attempt-2   | Same targeted strict command with that repository-compatible option: exit 0, empty output           |
| forge-suite-attempt-1 | Final 25-file forge-host plus merge-receipt suite: 502 passed, 1,306 assertions, zero failures      |

The focused command is
`bun test src/Core.TypeScript/forge-host/ src/Core.TypeScript/observe/merge-receipt.test.ts`.
The targeted static command is `bunx tsc --ignoreConfig --noEmit
--skipLibCheck --module esnext --moduleResolution bundler --target esnext
--types bun --strict --allowImportingTsExtensions` followed by the five
changed source/test paths. The complete repository TypeScript/static and
quick-preflight outcomes are recorded below.
The `.NET` build/tests were not run for this TS-tooling-only change, under
`docs/BUILD-GATES.md`'s explicit scope-aware rule.

The independent source review and accepted mixed-field discriminator finding
are retained in the repair report. This is bounded source/log/API evidence;
it does not establish an atomic forge snapshot or a lock on a later merge.

## Final local source and gates

[source-snapshot.json](source-snapshot.json) identifies final source
`e5b6bf5b1913f3df1cf55d1dd4c608fbfd5376fd`, five changed source/test files
and six unchanged consumer/port files. It is a post-check byte comparison
against that commit, not a prelaunch process or source-to-binary attestation.
The final private discriminated-union type refinement erases at runtime.

The complete quick gate initially caught five `exactOptionalPropertyTypes`
diagnostics after normalization was corrected to use `__typename`: the
legacy name remained typed optional. Making the private input type an actual
discriminated union fixed the mismatch. The failed 15/16 gate is retained as
`merge-observe-quick-attempt-1.log.gz`; the unchanged gate command's second
attempt passes all 16 checks. Full `bun --bun tsc --noEmit -p tsconfig.json`
also exits 0 with empty output. The build-graph derivation changed no bytes.

The final forge/receipt suite also passes with the CI-pinned Bun 1.3.13:
502 tests, 1,306 assertions, zero failures. The local Bun 1.3.14 result is
retained separately. Tool versions are in the source snapshot. The complete
GitHub status response reports the relevant API Requests, Pull Requests,
Actions and Webhooks components operational at publication preparation.
