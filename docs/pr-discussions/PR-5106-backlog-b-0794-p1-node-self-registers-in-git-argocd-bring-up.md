---
pr_number: 5106
title: "backlog(B-0794 P1): node self-registers in git \u2192 ArgoCD bring-up of K8s + apps/charts; GitOps-native cluster substrate (Aaron 2026-05-26 architectural addition)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:46:57Z"
merged_at: "2026-05-26T05:49:09Z"
closed_at: "2026-05-26T05:49:09Z"
head_ref: "otto-cli/b0794-node-self-registers-in-git-under-maintainers-dev-cluster-triggers-argocd-bringup-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:42:59Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5106: backlog(B-0794 P1): node self-registers in git → ArgoCD bring-up of K8s + apps/charts; GitOps-native cluster substrate (Aaron 2026-05-26 architectural addition)

## PR description

Aaron 2026-05-26: 'also the machine alt to register itself in git somewhere under the maintainers dev cluster node so it registers with it settings in git to complete node setup and start kubernetes / argocd / full node / cluster install and all apps / charts'. Depends on B-0789 iter-5+ node git-auth substrate. Composes with B-0792 + B-0793 + B-0776 + B-0782 + B-0790. Implementation deferred to follow-on; substrate target named NOW so iter-5.x work aligns. See row body for 6 sub-targets + end-state operator UX.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:49:50Z)

## Pull request overview

Adds a new P1 backlog row (B-0794) describing a GitOps-native Kubernetes cluster bring-up flow where nodes self-register into the repo and ArgoCD reconciles the cluster/apps from that registration.

**Changes:**
- Added new backlog row file for B-0794 with sub-target decomposition and acceptance criteria.
- Updated `docs/BACKLOG.md` to include the new B-0794 entry under P1.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/B-0794-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md | New P1 backlog row documenting the desired node self-registration → ArgoCD reconciliation end-state and sub-targets. |
| docs/BACKLOG.md | Adds the B-0794 index entry under the P1 section. |

## Review threads

### Thread 1: docs/backlog/P1/B-0794-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md:5 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:49:48Z):

The frontmatter `title` contains placeholders like `<name>` / `<node>`. In Markdown these can be parsed as HTML tags when the title is rendered into `docs/BACKLOG.md`, causing the placeholder text to disappear. Consider escaping the angle brackets (e.g., `&lt;name&gt;`) or formatting the placeholder as inline code so it renders literally.

### Thread 2: docs/backlog/P1/B-0794-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md:13 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:49:49Z):

`depends_on` includes `B-0793`, but there is no `docs/backlog/**` row file with `id: B-0793` in the repo. This leaves the dependency graph inconsistent; either add the missing B-0793 row in the same PR or change/remove this dependency to reference an existing row ID.

### Thread 3: docs/backlog/P1/B-0794-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md:107 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:49:49Z):

This section references `B-0793` (`/etc/zeta/cluster-node-roles` source), but there is no corresponding backlog row with `id: B-0793` in the repository. To keep cross-references resolvable, either add the missing row or replace the reference with the correct existing backlog ID.

### Thread 4: docs/backlog/P1/B-0794-node-self-registers-in-git-under-maintainers-cluster-nodes-triggers-argocd-full-bringup-of-k8s-apps-charts-gitops-native-cluster-substrate-aaron-2026-05-26.md:147 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:49:49Z):

This `Composes with substrate` list references `B-0793`, but there is no backlog row file with `id: B-0793` in the repo. Either add that missing row or update this cross-reference so it points at an existing backlog item.

### Thread 5: docs/BACKLOG.md:376 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T05:49:49Z):

This backlog index entry includes `maintainers/<name>/cluster-nodes/<node>/` as plain text. In Markdown, `<name>` / `<node>` may be treated as HTML tags and not render. Escape the angle brackets (e.g., `&lt;name&gt;`) or wrap the placeholder path in inline code so it renders literally.

## General comments

### @chatgpt-codex-connector (2026-05-26T05:47:02Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
