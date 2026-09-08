# PR 16999: exact main publication proof

Date: 2026-09-08 UTC
Operational status: research-grade
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z5ZW1T087G0R0002KPWJ8

[PR #16999](https://github.com/Lucent-Financial-Group/Zeta/pull/16999)
merged at 01:47:50 UTC through ordinary squash merge, matching reviewed head
`d4a0fc6a2e3d316eeac9c2688b3a159177b41dfc`. Merge commit
`470b435565f698180ae37898cc2d4025d65876e5` is an ancestor of observed main
`d2b1af4be9d72b02c5b324b8b0c9de0ce390bf77`. All 2,332 changed paths,
collected over 24 API pages, have exactly equal Git tree entries at reviewed
head, merge and observed main. No inherited-path exception is needed. The
shared view was refreshed to that clean main and ancestry checked.

The [manifest](manifest.json) binds complete raw and stored hashes for every
retained artifact, including the full path proof, bounded GraphQL responses,
file inventories, workflow results, merge and shared-view receipts.

## Gate correction and limits

The initial PR description omitted the full AgencySignature trailer block.
Workflow 34175484324 correctly failed. The original description and failure
log remain retained. The description was corrected without changing the source
head; replacement workflow 34175795632 passed. Full CI workflow 34175484307
completed successfully across 72 jobs, and the required gate passed. The final
complete observation retained 96 contexts: 92 successes, three skips and the
one historical description failure, with no pending contexts or unresolved
review threads. The conservative adapter still included that historical failure;
the actual current required gate, replacement attribution run and normal merge
result are preserved separately. No administrative override was used.

GitHub API, Pull Requests and Actions status was checked before the merge.
An earlier direct adapter call lacked its configured credential; that local
refusal is retained and is not evidence of a GitHub outage. The authenticated
bounded observer used the existing gh API path without exposing credentials.

This publishes reviewed replay and finite native custody prerequisites. It
does not admit full runtime closure, create an implementation archive, generate
registered 9307/9409 streams or report a scientific cost result.
