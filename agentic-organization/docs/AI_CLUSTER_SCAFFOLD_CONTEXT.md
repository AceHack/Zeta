---
title: AI Cluster Scaffold Context
canonical_name: Agentic Organization
status: design
---

# AI Cluster Scaffold Context

This document captures repository and bootstrap context from the `ai-cluster-bootstrap` work so Organization implementation aligns with the actual cluster direction. It is not a deployment-manifest spec.

The broader vocabulary and original cluster mental model are captured in [Foundational Context and Language](./FOUNDATIONAL_CONTEXT_AND_LANGUAGE.md).

Current GitHub project:

- `https://github.com/Lucent-Financial-Group/Zeta`

## Repository Shape

The cluster scaffold is split into two top-level directories:

| Directory | Purpose |
|---|---|
| `usb-nixos-installer/` | USB-only installer bootstrap, intentionally minimal |
| `full-ai-cluster/` | End-to-end cluster scaffold, including installer copy, NixOS host configs, k3s bootstrap, and ArgoCD applications |

The full cluster layer includes:

- Nix flake for installer and per-host configs;
- NixOS modules for common host setup, k3s server/agent, Docker, local storage, GPU support, GPU passthrough, and GPU device plugins;
- host configs for control plane and GPU worker;
- k3s bootstrap manifests applied on first boot;
- ArgoCD App-of-Apps for cluster applications.

Important concrete directories:

| Path | Meaning |
|---|---|
| `full-ai-cluster/usb-nixos-installer/` | Byte-identical copy of the standalone USB installer |
| `full-ai-cluster/flake.nix` | Cluster flake for installer, hosts, and maintainer linux-builder support |
| `full-ai-cluster/nixos/modules/` | Host-level NixOS modules |
| `full-ai-cluster/nixos/hosts/control-plane/` | Control-plane host config |
| `full-ai-cluster/nixos/hosts/worker-gpu/` | GPU worker host config |
| `full-ai-cluster/k8s/bootstrap/` | K3S first-boot manifests, applied in dependency order |
| `full-ai-cluster/k8s/applications/` | ArgoCD-recognized platform applications |
| `full-ai-cluster/k8s/applications/hat-system/` | Cluster-native hat CRDs, OPA policies, seed hats, graph tooling, and operator implementations |
| `full-ai-cluster/k8s/applications/hat-system/crds/` | Canonical Hat, HatBinding, HatSwap, and HatPolicy schemas |
| `full-ai-cluster/k8s/applications/hat-system/operator/` | Go reference operator scaffold and reliability baseline |
| `full-ai-cluster/k8s/applications/hat-system/operator-ts/` | Future TypeScript operator implementation, if/when parity work starts |

## OS and Cluster Responsibilities

| Layer | Owns |
|---|---|
| NixOS host layer | k3s, Docker/rootless Docker posture, local storage, GPU drivers/toolkit/passthrough/device plugin support |
| k3s bootstrap layer | first-boot installation of Cilium, security substrate, ArgoCD, and root app |
| ArgoCD layer | ongoing reconciliation of platform applications |
| Organization layer | work, hats, tasks, assignments, approvals, signals, runs, memory attribution, and evidence |

The Organization should assume the cluster exists as the execution substrate. It should not duplicate host bootstrap logic.

## Two Reconcilers

The scaffold deliberately has two reconciliation domains:

| Reconciler | Scope | Update path |
|---|---|---|
| Nix / NixOS | Host OS, bootloader, kernel modules, K3S service, Docker, host storage, GPU drivers, passthrough, base packages | `nixos-install --flake` for first install, `nixos-rebuild switch --flake` for updates |
| ArgoCD | Cluster workloads and platform applications under `k8s/applications/` | Git commit and push, then ArgoCD reconciliation |

The Organization runtime should be a consumer of this substrate. It should create Organization records, request workload launches, watch health, and surface drift, but it should not become the host bootstrap system.

Kubernetes operators are ArgoCD-managed workload controllers inside the cluster layer. They are not a third source of truth beside Nix and ArgoCD. The hat-system operator reconciles hat CRDs; the Organization records why hats exist and when assignments are approved.

## Cilium Bootstrap Constraint

Cilium must exist before ArgoCD can schedule reliably when k3s disables its default networking.

The k3s server configuration disables default networking pieces so Cilium owns networking end to end:

- no flannel;
- no kube-proxy;
- no k3s network policy;
- Cilium owns CNI, KPR, and policy.

That means Cilium cannot be installed only later by ArgoCD. The first-boot k3s Helm Controller needs to install Cilium before ArgoCD.

Current theoretical first-boot ordering:

1. Cilium;
2. cert-manager;
3. Vault;
4. SPIRE;
5. Trust Manager;
6. External Secrets Operator;
7. ArgoCD;
8. Root App-of-Apps.

The Organization runtime should treat this as a dependency reality: agent workloads should not launch until the cluster security/network substrate is healthy.

The concrete bootstrap directory currently represents this order with:

- `cilium-namespace.yaml`;
- `cilium-install.yaml`;
- `cert-manager-install.yaml`;
- `vault-install.yaml`;
- `spire-install.yaml`;
- `trust-manager-install.yaml`;
- `external-secrets-install.yaml`;
- `argocd-namespace.yaml`;
- `argocd-install.yaml`;
- `root-application.yaml`.

## Confirmed Component Direction

| Component | Direction |
|---|---|
| Cilium | CNI, KPR, L7 policy, Hubble, Gateway API, ingress, BPF masquerade, encryption |
| cert-manager | TLS issuance |
| Vault | Secrets backend |
| SPIRE | Workload identity |
| Trust Manager | CA bundle distribution |
| External Secrets Operator | Vault-to-Kubernetes Secret sync |
| ArgoCD | App-of-Apps reconciliation |
| Open Policy Agent / Gatekeeper | Cluster policy constraints |
| Sealed Secrets | Encrypted low-churn Git-stored secrets |
| Longhorn | Persistent storage |
| CockroachDB | Distributed SQL source of truth for Organization-owned critical state |
| Temporal TS | Durable workflow/process rail |
| Dapr Actors | Entity-local actor/concurrency rail |
| Orleans | Cluster-resident .NET virtual actor/silo capability; NestJS composes with it through adapters when .NET grain semantics are needed |
| Argo Workflows / Rollouts | DAG jobs and progressive delivery |
| Hindsight | Hermes persistent memory |
| OpenZiti / Ziti | Secure transport/connectivity layer |
| Hermes | Custom cloud-oriented agent runtime |
| NATS | Event/status/inbox transport |
| Redis | Cache or short-lived coordination support, not Organization truth |
| Weaviate | Vector database option; Hindsight remains Hermes memory integration |
| Loki / Tempo / Alloy / Mimir / Prometheus / Grafana | Observability stack |
| GitLab | Default-on forge/service platform |
| Forgejo | Manual-sync alternative |
| Ollama / vLLM / local coder models | Deferred/manual local-model phase |
| Oz / Warp | Agent/session orchestration layer; distinct from OpenZiti transport |
| Warp as separate app | Removed as a standalone component if Oz owns this orchestration role |

The pasted scaffold status still mentions Istio in one historical component-status line. Treat that as stale. The active direction is: Istio is removed, and Cilium Service Mesh owns L7 policy, mTLS-capable service mesh behavior, Gateway API, ingress, traffic handling, and observability without per-pod sidecars.

## Oz, Warp, and OpenZiti Clarification

Oz should be treated as the Warp-style orchestration layer for Hermes agent/session runs.

OpenZiti should be treated as the zero-trust transport/connectivity layer.

Implications for the Organization:

- use `OpenZiti` terminology where precision matters;
- use `Oz` for the agent run orchestrator;
- use `Warp` only as the orchestration concept Oz provides, not as a separate active app unless that decision changes;
- avoid conflating OpenZiti transport with Organization workflow orchestration;
- Credential Proxy and Cilium/SPIRE still enforce Organization authority even when transport is OpenZiti-backed.

If the current cluster scaffold uses an `oz/` application directory for OpenZiti, that should be treated as a naming conflict. Prefer renaming the transport application to `openziti/` or documenting it as OpenZiti transport, while reserving Oz for orchestration.

## Hermes Clarification

Hermes is custom and cloud-oriented for the current phase.

Implications:

- do not assume local Ollama/vLLM endpoints are available in v0;
- cloud provider keys are expected to be supplied through secure build/runtime secret handling;
- local model environment variables can remain future-facing but should not drive MVP design;
- Hermes should integrate with Hindsight memory, Oz orchestration, and OpenZiti transport according to the active cluster configuration.

## Hindsight Clarification

Hindsight is the persistent memory system for Hermes.

The active direction is a standalone Helm chart via ArgoCD, later clarified as the real `vectorize-io/hindsight` OCI chart.

Implications:

- design memory as durable and precious;
- do not prune memory by default;
- expose memory health and recall latency to Organization observability;
- enforce hat-scoped retain/recall/reflect through Organization policy or an adapter.

## Secrets Model

The scaffold intentionally keeps multiple secret mechanisms because the secrets have different lifetimes and access patterns:

| Mechanism | Use |
|---|---|
| Sealed Secrets | Encrypted Git-stored secrets for low-churn configuration |
| Vault | Runtime secrets backend, rotation, and audit |
| External Secrets Operator | Vault-to-Kubernetes Secret synchronization |
| SOPS | File-level encryption, including Hermes image-time secrets where required by the current spec |

Organization implication: agents should never receive broad raw secrets. They should request actions through the MCP Gateway and Credential Proxy, which resolve approved scopes against Vault/External Secrets-backed references.

## Deferred Local Models

Local model serving is deferred.

Deferred components include:

- Ollama;
- vLLM;
- Deepseek Coder local serving;
- Qwen Coder local serving.

The Organization should be LLM-provider-neutral, but v0 should not depend on local GPU model availability. GPU infrastructure can exist for future phases.

## Cluster Update Model

OS changes belong under `full-ai-cluster/nixos/` and land through NixOS rebuilds.

Cluster workload changes belong under `full-ai-cluster/k8s/applications/` and land through ArgoCD.

Organization product changes should be packaged as one or more ArgoCD-managed applications once the app exists. The Organization should expose its own higher-level change lifecycle for agents, but the physical cluster reconciliation contract remains GitOps through ArgoCD.

## Git Forge Gating

GitLab is the default-on forge in the cluster scaffold.

Forgejo is a manual-sync alternative.

Implications:

- Credential Proxy should support a forge abstraction;
- first implementation can target GitLab;
- Forgejo support should be a capability expansion item unless required earlier.

## Security Posture Lessons

The scaffold review history includes important security lessons the Organization should inherit:

- do not hardcode admin passwords;
- use existing secrets or sealed/external secret patterns;
- avoid plaintext API keys in Git;
- do not add users to the Docker group by default;
- quote and constrain destructive filesystem paths;
- avoid opening etcd ports broadly;
- gate deferred heavy workloads so they do not auto-start;
- avoid auto-reconciling mutually exclusive heavy services;
- make bootstrap ordering explicit when components depend on each other.

These lessons should become Organization platform review criteria for internal infrastructure work.

## Organization Implementation Implications

Before implementation, define:

- whether the Oz/Warp run adapter and OpenZiti transport adapter are separate interfaces or composed behind one higher-level launch path;
- how Hermes session containers receive OpenZiti transport configuration;
- how Cilium and SPIRE identity is represented in `AgentSessionActor`;
- how Vault/External Secrets references are represented in Credential Proxy requests;
- which components are required for the first local/cloud MVP;
- which components are deferred and must not auto-start;
- how the UI distinguishes active, deferred, manual-sync, and unavailable cluster capabilities.
