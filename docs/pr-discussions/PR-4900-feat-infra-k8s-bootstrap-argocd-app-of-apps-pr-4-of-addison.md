---
pr_number: 4900
title: "feat(infra): k8s bootstrap + ArgoCD App-of-Apps (PR 4 of Addison's plan)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T02:35:18Z"
merged_at: "2026-05-25T02:35:23Z"
closed_at: "2026-05-25T02:35:23Z"
head_ref: "feat/addison-k8s-bootstrap-argo-apps-2026-05-24"
base_ref: "feat/addison-flake-and-modules-2026-05-24"
archived_at: "2026-05-27T19:51:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4900: feat(infra): k8s bootstrap + ArgoCD App-of-Apps (PR 4 of Addison's plan)

## PR description

## Summary

PR 4 of Addison's NixOS-AI-cluster bootstrap plan. Lands the Kubernetes substrate that K3S auto-applies on first boot, then hands off to ArgoCD which reconciles everything else from this same Git repo.

**Base: #4898** (stacked on flake.nix + modules + per-host configs).

## File map

### `infra/k8s/bootstrap/` — K3S auto-applies (via `services.k3s.manifests`)
| File | Purpose |
|---|---|
| `argocd-namespace.yaml` | Namespace `argocd` |
| `argocd-install.yaml` | Kustomize ref → ArgoCD v2.13.2 upstream manifest (pinned) |
| `initial-orleans.yaml` | Minimal Orleans StatefulSet (`replicas: 0` until silo image published); namespace + RBAC + headless silo svc + client gateway svc |

### `infra/k8s/applications/` — ArgoCD watches recursively
| File | Purpose |
|---|---|
| `root-application.yaml` | App-of-Apps root; selects `Application.yaml` at any depth |
| `orleans/Application.yaml` | ArgoCD-managed Orleans (supersedes bootstrap) |
| `orleans/deployment.yaml` | Full Orleans StatefulSet with topology-spread + probes |
| `orleans/service.yaml` | Headless silo + client gateway + dashboard services |
| `orleans/rbac.yaml` | ServiceAccount + Role + RoleBinding for K8s clustering |
| `orleans/configmap.yaml` | Orleans cluster config (serviceId=zeta, clusterId=zeta-prod) |
| `gitlab/Application.yaml` | GitLab CE Helm chart (8.7.0); bundled cert-manager/nginx/prometheus DISABLED; runners ENABLED |
| `argoworkflows/Application.yaml` | Argo Workflows 3.6 family; 7-day retention; parallelism 50 |
| `argorollouts/Application.yaml` | Argo Rollouts 1.8 family with dashboard |

## Bootstrap sequence (when control-plane boots)

1. K3S starts
2. K3S applies `bootstrap/argocd-namespace.yaml` → `bootstrap/argocd-install.yaml` (ArgoCD pods come up)
3. K3S applies `bootstrap/initial-orleans.yaml` (Orleans namespace + scaled-to-0 StatefulSet)
4. K3S applies `applications/root-application.yaml` (App-of-Apps root)
5. ArgoCD finishes installing → reads root Application → discovers child Applications via include glob
6. ArgoCD reconciles orleans/, gitlab/, argoworkflows/, argorollouts/ in parallel
7. Orleans bootstrap StatefulSet is reconciled in-place by the ArgoCD-managed spec

## Add-a-workload flow

```bash
mkdir infra/k8s/applications/<name>/
$EDITOR infra/k8s/applications/<name>/Application.yaml
git commit + push to main
# ArgoCD picks it up on next sync (~3 min)
```

## Image placeholders

- `ghcr.io/lucent-financial-group/zeta-orleans-silo:{bootstrap,latest}` doesn't exist yet — bootstrap + ArgoCD-managed StatefulSets both have `replicas: 0` so nothing tries to pull. Bump replicas once an image is published.
- GitLab `initialRootPassword` references a Secret named `gitlab-initial-root-password` that must be created out-of-band (sops-nix / agenix decrypt) before GitLab installs cleanly.

## Test plan

- [ ] All YAML parses (markdownlint won't catch this; YAML lint if configured will)
- [ ] On a real cluster: `kubectl apply --dry-run=server -f infra/k8s/bootstrap/` succeeds
- [ ] ArgoCD picks up `root-application.yaml` and discovers all 4 child apps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T02:39:03Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `93bad84192`


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

### Thread 1: infra/k8s/bootstrap/argocd-install.yaml:18 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T02:39:03Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Replace Kustomization AddOn with an applyable manifest**

`services.k3s.manifests` files are applied by K3S similarly to `kubectl apply`, but this entry is a `kustomize.config.k8s.io` `Kustomization` object that is not rendered client-side and is not a built-in Kubernetes kind. On a fresh cluster this means the Argo CD install payload is never created, so the bootstrap chain stalls before any `Application` resources can reconcile.

Useful? React with 👍 / 👎.

### Thread 2: infra/k8s/bootstrap/initial-orleans.yaml:6 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T02:39:03Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Wire initial Orleans bootstrap into K3S manifests**

This file is documented as a first-boot bootstrap manifest, but it is not referenced by `services.k3s.manifests` (the current list in `infra/nixos/modules/k3s-server.nix` only registers `argocd-namespace`, `argocd-install`, and `root-application`). As a result, none of the namespace/RBAC/StatefulSet resources defined here are ever applied during bootstrap, so the stated startup sequence is incomplete.

Useful? React with 👍 / 👎.
