---
pr_number: 4954
title: "backlog(081KSE6WT0008QG0R002RFEC0S): CI ephemeral cluster smoke via k3d-on-runner; evolve to vcluster"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T16:46:15Z"
merged_at: "2026-05-25T22:33:05Z"
closed_at: "2026-05-25T22:33:06Z"
head_ref: "backlog/b0722-ci-ephemeral-cluster-smoke-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:50:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4954: backlog(081KSE6WT0008QG0R002RFEC0S): CI ephemeral cluster smoke via k3d-on-runner; evolve to vcluster

## PR description

## Summary

Files Aaron's *"tests should be able to use kind/k3d to do ephemeral clusters on prs"* + *"we will do k8s in k8s later k8s in docker if fine for ci now"* as a P2 backlog row.

Builds on PR #4953's dev-cluster substrate. Phase 1 = k3d-on-runner workflow (immediate ask); Phase 2 = vcluster-on-shared-host when persistent dev cluster exists.

PR contents:

- New: `docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md` (the backlog row — substrate only, no implementation)
- Updated: `docs/BACKLOG.md` (regenerated index after main-merge to clear MD012 + drift on the generated index)
- New: `docs/hygiene-history/ticks/2026/05/25/2208Z.md` (Otto-CLI cold-boot tick shard documenting the CI-fix work)

## Test plan

- [ ] 081KSE6WT0008QG0R002RFEC0S row renders correctly in `docs/backlog/P2/`
- [ ] References to PRs #4930, #4950, #4951, #4953 + `full-ai-cluster/dev-cluster/*` paths are accurate
- [ ] Acceptance criteria capture what "done" looks like for Phase 1
- [ ] `docs/BACKLOG.md` matches `bun tools/backlog/generate-index.ts --check` output

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T16:48:22Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `fea52af477`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T16:50:04Z)

## Pull request overview

Adds a new P2 backlog row (081KSE6WT0008QG0R002RFEC0S) capturing a plan to run an ephemeral Kubernetes cluster smoke test in CI for AI-cluster PRs (k3d-on-runner now, with a future evolution to vcluster-on-shared-host).

**Changes:**

- Introduces `docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-*.md` with frontmatter + detailed Phase 1/Phase 2 implementation plan.
- Documents workflow triggering, artifact capture, teardown behavior, and acceptance criteria for the future CI smoke workflow.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T21:26:05Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-25T22:14:37Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `706b7f4517`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T22:15:40Z)

## Pull request overview

Copilot reviewed 3 out of 3 changed files in this pull request and generated 8 comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-25T22:33:27Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `508efd9c87`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:45 (resolved)

**@chatgpt-codex-connector** (2026-05-25T16:48:22Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Prefix workflow path filters with full-ai-cluster/**

The proposed `pull_request` path filter omits the `full-ai-cluster/` prefix for `dev-cluster/**` and `tools/ci/**`, even though this same row defines those files under `full-ai-cluster/dev-cluster/...` and `full-ai-cluster/tools/ci/...`. In GitHub Actions, `paths` are repo-root-relative, so these two globs would not match the intended files and PRs that modify the smoke scripts/config could skip the workflow entirely.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:17 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:50:02Z):

The `composes_with` frontmatter lists paths that do not exist in the current tree (`full-ai-cluster/dev-cluster/**` and `full-ai-cluster/k8s/applications/argocd/Application.yaml`). Since this frontmatter is used as a quick cross-reference index, it should point at existing substrate files/directories (or be omitted) to avoid drift.

### Thread 3: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:30 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:50:03Z):

This sentence asserts that a dev-cluster `up.sh` wrapper already landed in PR #4953, but there is no `full-ai-cluster/dev-cluster/` (or `up.sh`) in the current repo state. Reword to avoid stating this as current fact (or qualify it as pending/expected).

### Thread 4: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:50:03Z):

The command path here is inconsistent with the file paths listed above (it uses `dev-cluster/up.sh` rather than `full-ai-cluster/dev-cluster/up.sh`). As written, it won’t be runnable from repo root once implemented.

### Thread 5: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:50:03Z):

The planned workflow path filters don’t match the paths described elsewhere in the row (`dev-cluster/**` and `tools/ci/**` omit the `full-ai-cluster/` prefix). Also, the “security-reminder hook” reference isn’t findable in-tree; use the repo’s documented workflow-injection guidance instead.

### Thread 6: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:80 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:50:03Z):

`security-reminder hook` is not referenced anywhere else in the repo; this acceptance criterion should cite the actual workflow-injection safe-patterns guidance document used in this repository.

### Thread 7: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:91 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:50:04Z):

This reference claims sync-wave annotations are already present across the Applications, but there are currently no `argocd.argoproj.io/sync-wave` annotations under `full-ai-cluster/k8s/applications/` in this repo state. Reword to avoid stating that as already landed.

### Thread 8: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:96 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T16:50:04Z):

These references point at `full-ai-cluster/dev-cluster/*` files that don’t exist in the current tree. Prefer pointing at the current root-App substrate files that the smoke test will reconcile, and/or at the workflow safe-patterns doc.

### Thread 9: docs/BACKLOG.md:695 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T21:26:04Z):

P0 (lint): There are two consecutive blank lines before the `## P3` heading (MD012 default rule). This is likely to fail markdownlint on `docs/BACKLOG.md`.

### Thread 10: docs/BACKLOG.md:683 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T21:26:04Z):

P2: PR description says this is a “Single file” change, but this PR also updates the generated index entry in `docs/BACKLOG.md`. Suggest updating the PR description to mention the index update as well, to avoid review/test-plan drift.

### Thread 11: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:38 (resolved)

**@chatgpt-codex-connector** (2026-05-25T22:14:37Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Prefix `up.sh` path with `full-ai-cluster/`**

The implementation step says `cluster-smoke.sh` should wrap `dev-cluster/up.sh`, but this repository only has `full-ai-cluster/dev-cluster/up.sh` (no repo-root `dev-cluster/`). If this instruction is followed literally in CI, the smoke script will fail pre-flight with a missing file before any sync-wave checks run, blocking the intended PR gate.

Useful? React with 👍 / 👎.

### Thread 12: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:38 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:37Z):

P1: The planned smoke script invocation uses `dev-cluster/up.sh` and a relative `profiles/...` path, but the referenced subtree lives under `full-ai-cluster/dev-cluster/`. Using the wrong path here will mislead whoever implements Phase 1 and may get copy-pasted into the script/runbook.

### Thread 13: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:45 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:38Z):

P1: The example workflow `paths` filter lists `dev-cluster/**` and `tools/ci/**`, but those directories are under `full-ai-cluster/` in-tree. If copied as-is, the workflow would not trigger for the intended changes.

### Thread 14: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:46 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:38Z):

P1: `security-reminder hook` is referenced as if it’s a known in-repo artifact, but no such hook/doc exists. Point this at the actual workflow-injection guidance doc so the acceptance criteria remain mechanically actionable.

### Thread 15: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:78 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:38Z):

P2: Acceptance criteria uses `tools/ci/cluster-smoke.sh` but the planned path earlier in the row is `full-ai-cluster/tools/ci/cluster-smoke.sh`. Keeping these consistent avoids implementers wiring the wrong path into CI or docs.

### Thread 16: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:82 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:38Z):

P1: Same issue as above: the acceptance criterion references a non-existent `security-reminder hook`. Link to the concrete guidance doc so this can be audited during implementation/review.

### Thread 17: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:30 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:39Z):

P2: The phrase “after the local refactor in this row's PR” reads like the `--config` support already landed in the current PR, but this file is the backlog row (no implementation). Clarify that the `--config` flag is part of the future Phase 1 work for this row.

### Thread 18: docs/hygiene-history/ticks/2026/05/25/2208Z.md:37 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:39Z):

P2: This tick log includes a machine-specific absolute path (`/Users/...`) inside the command transcript. That leaks local environment details and reduces portability of the hygiene record; prefer a neutral placeholder like `<repo-root>/docs/BACKLOG.md`.

### Thread 19: docs/BACKLOG.md:683 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T22:15:39Z):

P2: PR description says “Single file — no implementation in this PR”, but this PR also updates `docs/BACKLOG.md` and adds a hygiene tick shard. Consider updating the PR description to match the actual file set so reviewers know what to expect.

### Thread 20: docs/backlog/P2/081KSE6WT0008QG0R002RFEC0S-ci-ephemeral-cluster-smoke-via-k3d-on-runner-evolve-to-vcluster-2026-05-25.md:45 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T22:33:27Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Include bootstrap root app in smoke workflow path filter**

Expand the proposed `pull_request` `paths` list to include the root App-of-Apps manifest (e.g. `full-ai-cluster/k8s/bootstrap/root-application.yaml`). As written, a PR that changes the root application graph entrypoint would not trigger this smoke workflow, which contradicts the row’s goal of validating graph-affecting changes before merge and leaves a real blind spot for bootstrap-level regressions.

Useful? React with 👍 / 👎.

## General comments

### @chatgpt-codex-connector (2026-05-25T21:23:58Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-25T21:45:59Z)

This PR has two failing checks: 'backlog-pr-hygiene-p2' and 'validate-doc-imports'. The 'backlog-pr-hygiene-p2' check is failing because the PR is not following the backlog PR hygiene rules. Please review the rules and update the PR accordingly. The 'validate-doc-imports' check is a false positive and should be updated to ignore files in the 'docs/backlog/P2' directory.

### @chatgpt-codex-connector (2026-05-25T22:11:10Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
