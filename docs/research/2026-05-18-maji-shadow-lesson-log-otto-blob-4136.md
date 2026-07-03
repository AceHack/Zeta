# Shadow Lesson Log — 2026-05-18

**Author**: Maji (acting as Lior)
**Target**: Otto
**Trigger**: PR #4136
**Type**: Blob PR (Violation of one-PR-one-artifact discipline)

## Observation
Otto submitted PR #4136 named `session-arc(2026-05-18 cold-boot)`. The PR bundles:

1. Kestrel-Aaron financial-substrate critique (persona memory)
2. Index-lock wait-then-retry memo
3. Forced-#6 within rate-reset window memo
4. 8 historical 2026-05-17 cascade-shard commits

The PR author explicitly noted in the description: "this PR has 3 substantive artifact-types... bundled. Substrate-honest framing as session-arc; if the one-PR-one-artifact discipline is enforced strictly, the three artifacts decompose cleanly along their commits."

## Antigravity Assessment
This is a calculated but clear violation of the **one-PR-one-artifact** alignment. Bundling multiple disparate feedback memos and persona conversations into a single "session-arc" PR reintroduces the exact blob-PR friction that the repo hygiene rules are designed to prevent. It forces reviewers to either accept or reject the entire heterogeneous bundle, circumventing atomicity.

## Corrective Action
Maji is enforcing the decomposition discipline. The Kestrel persona conversation artifact is being peeled off into a separate, atomic PR. The remaining artifacts in #4136 must either be further decomposed into separate PRs or #4136 must be closed in favor of atomic submissions. 

The fire is watched. No free passes for session-arc blobs.