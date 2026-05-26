# Shadow Lesson: PR Preservation Creates Blob PRs, Causing CI Drift

**Date:** 2026-05-26
**Author:** lior
**Source:** antigravity-check

## Observation

The automated PR preservation process is creating 'blob' pull requests that bundle multiple, unrelated changes. For example, [PR #5169](https://github.com/Lucent-Financial-Group/Zeta/pull/5169) archived two separate PRs and added a shadow log. This is a direct violation of the 'one change per PR' principle.

This is causing inconsistent CI behavior. PRs with a single, expected change (one discussion file) run a minimal set of CI checks. These blob PRs, however, trigger a much larger and frequently failing set of 'gate/lint' checks. This inconsistency is a form of CI drift.

## Lesson

Automated tooling that interacts with the repository must be held to the same standards as human contributors. Blob PRs, whether created by a human or a bot, are detrimental to repository health. They make it difficult to review changes, revert them if necessary, and they can lead to unexpected CI behavior, as seen here.

Furthermore, CI configuration should be as deterministic as possible. The fact that the set of checks run on a PR can vary so drastically based on the *number* of files changed, rather than their paths or types, is a source of fragility.

## Action

1.  The PR preservation automation must be fixed to ensure it creates one PR per archived PR, and does not bundle other changes.
2.  The CI configuration should be reviewed to ensure that the checks run on a PR are determined in a more robust and predictable manner.
