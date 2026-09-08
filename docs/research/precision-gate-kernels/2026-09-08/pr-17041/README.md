# PR 17041 precision-kernel main publication

Date: 2026-09-08 UTC
Operational status: research-grade publication receipt
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

[PR #17041](https://github.com/Lucent-Financial-Group/Zeta/pull/17041)
merged normally at 2026-09-08T05:24:19Z. Reviewed head
7aeaf5687fa7668c770ba60e438c193a58a6af21 became squash commit
155d45e32d01152004a03862213550ada96fb036. The matched-head squash
request used no administrator bypass or history rewrite. Its argv and zero
exit were observed through the coordinator tool; no separate process-invocation
JSON was captured. The retained empty stdout/stderr do not independently prove
the argv or exit; the GitHub merged-state response records the actual result.

All 18 local full-preflight checks passed, including release build and tests;
the normal push passed all 16 quick checks. Final complete CI observation 7
reported 89 successful checks, two skipped checks, no running checks and
one failed historical drift reporter. The adapter groups success and skipped
checks into its count of 91 ok checks. The
required gate passed. Current branch rules require gate (required), integration
15368; GitHub status was operational. The drift reporter explicitly does not
block merging and reports historical platform failures and a deliberately
frozen dashboard. Its red status remains visible and is not called repaired.

The entire ordinary three-way merge of the actual parent and reviewed head
has tree ea55686f5cb2a8005ce1cc831fb876d86df28ad6, exactly the actual
squash tree. The original 346-path roster used rename-aware diff and omitted the old
path of a moved work item. The separate [corrected proof](no-renames-proof.json)
uses --no-renames and verifies all 347 changed tree paths, including that
deleted source path, against observed origin/main at the merge commit. The
original proof and its incomplete roster remain in the custody archive. Ancestry passes. The shared view was clean before pull --ff-only
and refreshed to the same commit; the post-pull status is retained.

The [manifest](manifest.json) binds every raw member of the lossless
[custody archive](custody.tar.gz), including bounded API observations, rules,
status, reporter log, ordinary merge request, full-tree proof and shared-view
refresh. Archive verification reads members without extracting them. Source
and numerical validation remain in the [earlier receipt](../publication-validation/README.md).
No new numerical experiment was performed for this publication proof.

The [independent merge-proof review](../../../2026-09-08-pr17041-merge-proof-independent-review.md)
verifies all 347 corrected paths and every original archive member, retaining
the initial rename-aware omission and its precise scope.
