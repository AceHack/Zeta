# PR 17027 main publication receipt

Date: 2026-09-08 UTC
Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1ZCHPWV087G0R002GG2PKY

[PR #17027](https://github.com/Lucent-Financial-Group/Zeta/pull/17027)
merged at 2026-09-08T03:49:05Z, head
`5cdd7a6568fcf250575a0d6d814434c3bc3c5214`, squash commit
`17f02127ebadd5cc76adc9428b9a2ac4df16aff0`.
The normal merge-commit request was refused because this repository permits
no merge commits. The subsequent ordinary squash request matched the same
head; no administrator override, force push or published-history rewrite occurred.

## Checks and actual merge policy

All 16 normal push checks passed. The final complete observation contains
90 successful checks, two skipped checks and one failed drift reporter.
The platform build/test jobs and gate (required) passed. The reporter's full
raw log is retained: it signals historical Windows failures in a bounded
60-run window and explicitly sits outside the required floor. Current branch
rules require gate (required), integration15368. GitHub status reported all
systems operational. The ordinary merge succeeded under those rules. This
is not an all-checks-green claim or a claim that historical Windows failures
were repaired by this PR.

## Exact publication, with concurrent composition retained

GitHub supplied284 displayed files over three pages, representing285 changed
tree paths when the old side of a rename is counted. All merged entries match
observed main `8818b4283d02e3dc5966d8da335c4c0192faeb96`; merge ancestry is
verified. The shared view was clean on main and refreshed with pull --ff-only
to that same commit.

284 paths are identical to the PR head. The remaining ROADMAP entry includes
an independent ZetaDB progress edit that landed on main while CI ran. An
initial proof asserted head equality for every path and correctly refused
that composition. Its actual generated streams and mismatch table remain.
The initial assertion stderr appeared only in the tool transcript and was
not captured as a file; no fabricated raw stderr is claimed here.
The corrected proof reconstructs the entire ordinary three-way merge from
parent `4fc95943deacf83646153cb2ef92122430299dd9` and the reviewed head.
Its tree equals the actual squash tree exactly:
`a7ae6f780af3c80fa998289bcc9b3800bd984db6`.
The concurrent ROADMAP diff is retained explicitly, rather than described as
byte equality. All five source/test files retain their reviewed identities.

The [manifest](manifest.json) indexes lossless gzip artifacts, with original
and stored byte hashes: raw observations, both merge attempts, rules/status,
all changed-tree entries, API file pages, proof streams, source publication
and work-item completion. The finite publication item is complete; parent
learning research remains active.
