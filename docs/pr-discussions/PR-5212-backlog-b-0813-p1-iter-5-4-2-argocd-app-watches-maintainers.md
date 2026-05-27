---
pr_number: 5212
title: "backlog(B-0813 P1 iter-5.4.2): ArgoCD app watches maintainers/*/cluster-nodes \u2014 completes iter-5.4 arc"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:23:55Z"
merged_at: "2026-05-26T16:45:36Z"
closed_at: "2026-05-26T16:45:36Z"
head_ref: "otto-cli/b0813-iter-5-4-2-argocd-app-watches-cluster-nodes-tree-reconciles-on-pr-merge-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:39:23Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5212: backlog(B-0813 P1 iter-5.4.2): ArgoCD app watches maintainers/*/cluster-nodes — completes iter-5.4 arc

## PR description

Decomposes B-0794 sub-target 4. Closes iter-5.4 arc: 5.4.0 (gh-auth, PR #5210 building) → 5.4.1 (self-register, row #5211) → 5.4.2 (ArgoCD reconciles on PR-merge, THIS row).

After all 3 land + impl, full vision operational: zflash → boot → install → gh-auth → self-register → operator merges PR from phone → cluster auto-converges. Zero manual kubectl.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:27:13Z)

## Pull request overview

Adds a new P1 backlog row for iter-5.4.2 (B-0813), describing the ArgoCD GitOps reconciliation slice that watches `maintainers/*/cluster-nodes/**` and converges cluster state on registration-PR merge, and updates the generated backlog index to include the new row.

**Changes:**
- Adds `docs/backlog/P1/B-0813-…md` defining iter-5.4.2 scope, sub-targets, and acceptance criteria.
- Updates `docs/BACKLOG.md` to include the new B-0813 index entry.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/B-0813-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md | New backlog row detailing the iter-5.4.2 ArgoCD reconciliation work. |
| docs/BACKLOG.md | Adds the generated index entry for B-0813. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T16:41:58Z)

## Pull request overview

Copilot reviewed 2 out of 2 changed files in this pull request and generated 2 comments.

## Review threads

### Thread 1: docs/backlog/P1/B-0813-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md:146 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:27:12Z):

The link target `../P*/B-0776-*.md` won’t resolve on GitHub (wildcards aren’t supported in markdown links). Please replace it with the concrete relative path to the B-0776 row file under `docs/backlog/P1/`.

### Thread 2: docs/backlog/P1/B-0813-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md:145 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:27:13Z):

This row links to `B-0812-…` as a local file, but that per-row markdown file isn’t present in the repo in this PR. If this PR merges before the B-0812 row lands, the link (and the `depends_on: B-0812` reference) will be dangling. Consider either landing the B-0812 row first / in the same PR, or temporarily referencing the PR/issue instead of a file link until the row exists on main.

### Thread 3: docs/backlog/P1/B-0813-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md:42 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:41:57Z):

The doc describes node labels as `zeta.lcg/role=<role>`, but later sections assume per-role boolean labels like `zeta.lcg/role-control-plane=true` (needed for multi-role nodes and for K8s selectors; label values also can't contain commas). Please make the label/taint scheme consistent throughout (e.g., always use `zeta.lcg/role-<role>=true` for each role).

### Thread 4: docs/backlog/P1/B-0813-iter-5-4-2-argocd-app-watches-maintainers-cluster-nodes-tree-reconciles-on-pr-merge-completes-gh-auth-to-cluster-bringup-arc-aaron-2026-05-26.md:148 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T16:41:57Z):

The relative link for B-0790 appears to point to a non-existent filename (`B-0790-zero-dev-machines-cluster-native-architecture-all-prs-from-cluster-...`). The actual row file is `docs/backlog/P1/B-0790-zero-dev-machines-cluster-native-architecture-voice-as-primary-operator-surface-aaron-2026-05-26.md`, so this link will be broken until the target is renamed or the link is corrected.

## General comments

### @chatgpt-codex-connector (2026-05-26T16:24:00Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
