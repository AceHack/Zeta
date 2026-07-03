---
pr_number: 4912
title: "feat(ai-cluster): Istio out, cert-manager+SPIRE+Trust Manager+ESO in, new bootstrap order"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T06:44:32Z"
merged_at: "2026-05-25T06:47:30Z"
closed_at: "2026-05-25T06:47:30Z"
head_ref: "ai-cluster-tweaks-istio-out-spire-in"
base_ref: "main"
archived_at: "2026-05-27T19:51:42Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4912: feat(ai-cluster): Istio out, cert-manager+SPIRE+Trust Manager+ESO in, new bootstrap order

## PR description

## Summary

Applies Aaron's 2026-05-25 tweaks to the AI cluster scaffold.

### Removed

- **Istio** — Cilium Service Mesh (now enabled in cilium/Application.yaml) provides the same L7 capabilities (mTLS, traffic shifting, Gateway API, ingress, observability) natively atop the CNI agent — no sidecar per pod

### Added

- **cert-manager** (jetstack v1.16.2) — TLS issuance
- **SPIRE** (spiffe v0.24.2) — SPIFFE workload identity, chains to Vault as upstream CA
- **Trust Manager** (jetstack v0.15.0) — CA bundle distribution
- **External Secrets Operator** (community v0.10.7) — Vault → K8s Secret sync

### Cilium changes

- `l7Proxy: true` + `envoy.enabled: true` (Cilium Service Mesh)
- `encryption: { enabled: true, type: wireguard, nodeEncryption: true }` (node-to-node WireGuard, alongside spec'd BPF MASQUERADE)
- `gatewayAPI: { enabled: true }` (replaces Istio Gateway)
- `ingressController: { enabled: true, default: true }` (no separate ingress-nginx needed)
- `authentication.mutual.spire.enabled: false` (flip after SPIRE is healthy)

### New bootstrap order

K3S now auto-applies installs at first boot in dependency order:

1. **Cilium** (CNI + Hubble + Service Mesh + BPF MASQUERADE)
2. **cert-manager** (TLS for Vault)
3. **Vault** (secrets backend)
4. **SPIRE** (workload identity)
5. **Trust Manager** (CA bundle dist)
6. **External Secrets Operator** (Vault → K8s Secret sync)
7. **ArgoCD** (reconciles everything else from k8s/applications/)

All 7 installs use K3S \`helm.cattle.io/v1\` HelmChart CRs (same pattern as the prior cilium+argocd bootstrap manifests).

## Files

| Action | Path |
|---|---|
| **Delete** | \`full-ai-cluster/k8s/applications/istio/\` |
| **Modify** | \`full-ai-cluster/k8s/applications/cilium/Application.yaml\` (CSM + gateway + ingress + encryption) |
| **Modify** | \`full-ai-cluster/k8s/bootstrap/cilium-install.yaml\` (same values for bootstrap install) |
| **Modify** | \`full-ai-cluster/nixos/modules/k3s-server.nix\` (manifests list reorder + comment) |
| **Modify** | \`full-ai-cluster/README.md\` (tree + bootstrap docs) |
| **New** | \`full-ai-cluster/k8s/applications/cert-manager/Application.yaml\` |
| **New** | \`full-ai-cluster/k8s/applications/spire/Application.yaml\` |
| **New** | \`full-ai-cluster/k8s/applications/trust-manager/Application.yaml\` |
| **New** | \`full-ai-cluster/k8s/applications/external-secrets/Application.yaml\` |
| **New** | \`full-ai-cluster/k8s/bootstrap/cert-manager-install.yaml\` |
| **New** | \`full-ai-cluster/k8s/bootstrap/vault-install.yaml\` |
| **New** | \`full-ai-cluster/k8s/bootstrap/spire-install.yaml\` |
| **New** | \`full-ai-cluster/k8s/bootstrap/trust-manager-install.yaml\` |
| **New** | \`full-ai-cluster/k8s/bootstrap/external-secrets-install.yaml\` |

## Application count

Was 29 (after PR #4910). Now 32 (-1 Istio + 4 new).

## Test plan

- [ ] markdownlint passes
- [ ] Post-merge: on a real cluster, all 7 bootstrap installs come up in order; ArgoCD's Application tree reconciles in dependency order

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T06:51:16Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `d84ef8b0cc`


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

### Thread 1: full-ai-cluster/nixos/modules/k3s-server.nix:60 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T06:51:16Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Enforce bootstrap ordering with explicit manifest prefixes**

This change introduces a strict dependency chain (Cilium → cert-manager → Vault → SPIRE → ESO → ArgoCD), but the manifest filenames are left unprefixed while this same file notes K3S applies manifests by filename. With names like `argocd-install.yaml` and `cert-manager-install.yaml`, ArgoCD/cert-manager sort before `cilium-install.yaml`, so first-boot execution order does not match the declared dependency order and bootstrap can race in non-deterministic ways. Add explicit ordered targets (e.g., `00-`, `10-`, ...) or a real dependency mechanism so the declared sequence is actually enforced.

Useful? React with 👍 / 👎.

### Thread 2: full-ai-cluster/k8s/bootstrap/vault-install.yaml:30 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T06:51:16Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Avoid Longhorn PVCs in pre-Argo Vault bootstrap**

The new bootstrap Vault install hardcodes `storageClass: longhorn`, but Longhorn is not part of the K3S bootstrap manifests and is reconciled later by ArgoCD. On fresh boot, Vault PVCs cannot bind until Longhorn exists, so Vault cannot become healthy during the pre-Argo phase that this commit depends on for SPIRE/ESO sequencing. Use a bootstrap-available storage class (or bootstrap Longhorn earlier) to prevent this dependency break.

Useful? React with 👍 / 👎.
