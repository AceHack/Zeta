---
pr_number: 4910
title: "feat(ai-cluster-bootstrap): two-directory declarative AI cluster scaffold"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T05:44:22Z"
merged_at: "2026-05-25T06:40:16Z"
closed_at: "2026-05-25T06:40:16Z"
head_ref: "ai-cluster-bootstrap"
base_ref: "main"
archived_at: "2026-05-27T19:51:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4910: feat(ai-cluster-bootstrap): two-directory declarative AI cluster scaffold

## PR description

## Summary

Two clean separate top-level directories on branch \`ai-cluster-bootstrap\` per Addison/Aaron's spec.

### \`usb-nixos-installer/\` — USB-only, nothing extra

3 files:

| File | Purpose |
|---|---|
| \`README.md\` | Scope statement: USB bootstrap ONLY |
| \`flake.nix\` | Produces \`installer-iso\` |
| \`nixos/installer/configuration.nix\` | Single-file package list for the stick |

### \`full-ai-cluster/\` — end-to-end cluster

62 files. First, a byte-identical copy of the USB directory (the bootstrap snippet). Then the full stack:

**NixFlake layer (OS):**

- K3S server + K3S agent (Cilium takeover: \`--flannel-backend=none\`, \`--disable-kube-proxy\`, \`--disable-network-policy\`)
- Cilium-host-prep (firewall, trusted-interfaces)
- Docker via NixFlake (separate from K3S containerd)
- local-path storage class as a K3S auto-applied manifest
- NVIDIA driver + container toolkit
- GPU passthrough (VFIO) for VM workloads on the same hosts
- GPU device plugin for K8s — NVIDIA + AMD + Intel
- per-host \`configuration.nix\` for \`control-plane\` + \`worker-gpu\` (+ template for additional workers)

**ArgoCD layer (cluster — 30 Application.yamls):**

- Cilium (KPR + Hubble Relay + Hubble UI + BPF MASQUERADE per spec)
- Orleans, Temporal (TS), Dapr Actors — three distributed-cron substrates
- GitLab + Forgejo (both shipped, pick one)
- Argo Workflows + Argo Rollouts
- Longhorn (distributed block storage)
- CockroachDB (distributed SQL)
- Ollama + vLLM (LLM serving)
- Deepseek Coder + Qwen Coder (model deploys → Ollama or vLLM)
- kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
- NATS, Redis, Weaviate
- Loki, Tempo, Alloy, Mimir (Grafana observability stack)
- Istio, Open Policy Agent, Sealed Secrets, Vault
- **Hindsight, OZ, Hermes, Warp** — placeholder Application.yamls (see "Ambiguous components" below)

### Bootstrap flow

\`\`\`
nix build .#installer-iso  →  dd to USB  →  boot target  →  partition + clone Zeta  →
nixos-install --flake ...#control-plane  →  reboot
  ↓ K3S starts
  ↓ K3S auto-applies cilium-namespace.yaml + argocd-{namespace,install}.yaml + root-application.yaml
  ↓ ArgoCD starts
  ↓ ArgoCD reconciles every Application.yaml under k8s/applications/
  ↓ Cluster running every workload declared
\`\`\`

## Ambiguous components (need your confirmation)

These 4 components map to multiple possible upstreams. I shipped placeholder Application.yamls with \`TODO(aaron)\` markers — please confirm which upstream each refers to and I'll sharpen them:

| Component | Possibilities |
|---|---|
| **OZ** | OpenZiti (zero-trust networking) / Auth0 OZ / Aaron-specific component |
| **Hermes** | Cosmos IBC relayer / message broker / Aaron-AI-agent (the spec's "integrated with OZ" + "SOPS into Hermes Docker image" + "Hermes access to Ollama or vLLM" hints suggest an Aaron-built agent — the placeholder deployment.yaml wires the env-var structure for OZ + Ollama + vLLM endpoints) |
| **Warp** | Cloudflare Warp / Warp Terminal / Dagger Warp engine / Aaron-specific |
| **Hindsight** | Lockheed Martin OTel tail-sampling processor / Microsoft Hindsight / other |

## Build the USB (your Mac)

\`\`\`bash
# 1. Clone (one-time)
cd ~/Documents/src/repos/Zeta
git fetch origin
git checkout ai-cluster-bootstrap

# 2. (Apple Silicon only — one-time linux-builder setup)
nix run nix-darwin/nix-darwin-24.11#darwin-rebuild -- switch \
  --flake full-ai-cluster#zeta-mac

# 3. Build the installer ISO
cd full-ai-cluster
nix build .#installer-iso
ls -lh result/iso/zeta-installer-*.iso

# 4. Write to USB (macOS — replace diskN with YOUR USB device number from \`diskutil list\`)
diskutil unmountDisk /dev/diskN
sudo dd if=result/iso/zeta-installer-*.iso of=/dev/rdiskN bs=4m status=progress
diskutil eject /dev/diskN
\`\`\`

## Install on a target machine

\`\`\`bash
# Boot the target on the USB. At the console

# Network up
nmtui

# Partition (example: single ext4 + EFI — replace /dev/sda with your target disk)
sgdisk --zap-all /dev/sda
sgdisk -n 1:0:+512M -t 1:ef00 -c 1:boot /dev/sda
sgdisk -n 2:0:0     -t 2:8300 -c 2:nixos /dev/sda
mkfs.fat -F 32 -n boot /dev/sda1
mkfs.ext4 -L nixos /dev/sda2
mount /dev/disk/by-label/nixos /mnt
mkdir -p /mnt/boot && mount /dev/disk/by-label/boot /mnt/boot

# Clone cluster flake
git clone https://github.com/Lucent-Financial-Group/Zeta /mnt/etc/zeta

# Per-machine hardware config (must be copied into the host dir)
nixos-generate-config --root /mnt
cp /mnt/etc/nixos/hardware-configuration.nix \
   /mnt/etc/zeta/full-ai-cluster/nixos/hosts/<host>/hardware-configuration.nix

# K3S cluster token (control-plane only on first install — save the token for workers)
nixos-enter --root /mnt -- bash -c '
  mkdir -p /var/lib/rancher/k3s/server
  openssl rand -hex 64 > /var/lib/rancher/k3s/server/token
  chmod 600 /var/lib/rancher/k3s/server/token
'
cat /mnt/var/lib/rancher/k3s/server/token   # ← save this; needed on every worker

# Install
nixos-install --flake /mnt/etc/zeta/full-ai-cluster#<host>
# <host> = control-plane | worker-gpu | 

# Set zeta user password + reboot
nixos-enter --root /mnt -- passwd zeta
reboot
\`\`\`

For each worker, repeat — but instead of \`openssl rand\`, write the control-plane's token to \`/var/lib/rancher/k3s/agent/token\` (chmod 600).

## Verify after first reboot

\`\`\`bash
ssh zeta@control-plane.zeta.local
sudo kubectl get nodes
sudo kubectl -n kube-system get pods            # cilium pods
sudo kubectl -n argocd get pods
sudo kubectl -n argocd get applications         # all 30 should appear, gradually Healthy
sudo cilium status
sudo cilium hubble enable --ui
\`\`\`

## File structure summary

\`\`\`
usb-nixos-installer/             3 files
└── README + flake + installer config

full-ai-cluster/                 62 files
├── usb-nixos-installer/         (identical copy, 3 files)
├── README + flake + 2 hosts (6 files) + 8 modules + 4 bootstrap + 30 apps (+ supporting manifests for Orleans, Hermes, vLLM, model configmaps)
\`\`\`

## Test plan

- [ ] markdownlint passes
- [ ] \`nix flake check\` passes on both flakes
- [ ] Reviewer confirms ambiguous components or marks them OK to ship as placeholders
- [ ] Post-merge: build ISO, boot on a test machine, run through the install flow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T05:49:46Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `220a09b273`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T05:51:07Z)

## Pull request overview

Adds a two-directory, declarative Nix-based AI cluster scaffold: a minimal USB NixOS installer flake and a full end-to-end cluster flake that bootstraps K3S + ArgoCD and declaratively installs a broad set of workloads via ArgoCD Applications.

**Changes:**

- Introduces a standalone `usb-nixos-installer/` flake for building a bootable NixOS installer ISO.
- Adds `full-ai-cluster/` flake with NixOS host/modules for control-plane + GPU workers, plus K3S bootstrap manifests for Cilium/ArgoCD.
- Adds ArgoCD “App-of-Apps” structure with many workload `Application.yaml` definitions and a few placeholder/custom components.

### Reviewed changes

Copilot reviewed 65 out of 65 changed files in this pull request and generated 11 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| usb-nixos-installer/README.md | Documents the minimal USB installer flow and contents. |
| usb-nixos-installer/nixos/installer/configuration.nix | NixOS installer ISO configuration and package set. |
| usb-nixos-installer/flake.nix | Standalone flake producing `installer-iso` and a devshell. |
| full-ai-cluster/usb-nixos-installer/README.md | Copy of USB installer README bundled under full cluster. |
| full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix | Copy of installer ISO configuration under full cluster. |
| full-ai-cluster/usb-nixos-installer/flake.nix | Copy of USB installer flake under full cluster. |
| full-ai-cluster/README.md | End-to-end bootstrap and architecture documentation for the full cluster. |
| full-ai-cluster/nixos/modules/local-storage.nix | Declares local-path-provisioner storage class as a K3S manifest. |
| full-ai-cluster/nixos/modules/k3s-server.nix | K3S server configuration for Cilium takeover + bootstrap manifests. |
| full-ai-cluster/nixos/modules/k3s-agent.nix | K3S agent configuration aligned with Cilium takeover. |
| full-ai-cluster/nixos/modules/gpu.nix | NVIDIA driver + container toolkit + node labeling. |
| full-ai-cluster/nixos/modules/gpu-passthrough.nix | VFIO/libvirt/QEMU plumbing for optional GPU passthrough VMs. |
| full-ai-cluster/nixos/modules/gpu-device-plugin.nix | Installs vendor GPU device-plugin DaemonSets via K3S manifests. |
| full-ai-cluster/nixos/modules/docker.nix | Enables Docker (rootless) and related CLI tooling. |
| full-ai-cluster/nixos/modules/common.nix | Shared baseline configuration for all cluster hosts. |
| full-ai-cluster/nixos/hosts/worker-gpu/README.md | Worker template documentation and scaling instructions. |
| full-ai-cluster/nixos/hosts/worker-gpu/hardware-configuration.nix | Placeholder hardware config for worker template. |
| full-ai-cluster/nixos/hosts/worker-gpu/configuration.nix | Worker template host config wiring modules together. |
| full-ai-cluster/nixos/hosts/control-plane/README.md | Control-plane documentation and verification steps. |
| full-ai-cluster/nixos/hosts/control-plane/hardware-configuration.nix | Placeholder hardware config for control-plane. |
| full-ai-cluster/nixos/hosts/control-plane/configuration.nix | Control-plane host config wiring server/bootstrap modules. |
| full-ai-cluster/k8s/bootstrap/root-application.yaml | ArgoCD root Application (App-of-Apps) pointing at workload Applications. |
| full-ai-cluster/k8s/bootstrap/cilium-namespace.yaml | Ensures required namespace exists before Cilium app sync. |
| full-ai-cluster/k8s/bootstrap/argocd-namespace.yaml | Creates the ArgoCD namespace for bootstrap install. |
| full-ai-cluster/k8s/bootstrap/argocd-install.yaml | Bootstraps ArgoCD via pinned remote manifest reference. |
| full-ai-cluster/k8s/applications/weaviate/Application.yaml | Weaviate Helm install with Ollama integration values. |
| full-ai-cluster/k8s/applications/warp/Application.yaml | Placeholder ArgoCD app for ambiguous “Warp” component. |
| full-ai-cluster/k8s/applications/vllm/deployment.yaml | Hand-rolled vLLM deployment/PVC/service manifests (replicas default 0). |
| full-ai-cluster/k8s/applications/vllm/Application.yaml | ArgoCD app pointing at the vLLM hand-rolled manifests. |
| full-ai-cluster/k8s/applications/vault/Application.yaml | Vault Helm install configuration (HA + raft). |
| full-ai-cluster/k8s/applications/temporal/Application.yaml | Temporal Helm install with persistence wiring stubbed for CockroachDB. |
| full-ai-cluster/k8s/applications/tempo/Application.yaml | Tempo Helm install with Longhorn-backed persistence. |
| full-ai-cluster/k8s/applications/sealed-secrets/Application.yaml | Sealed Secrets controller Helm install. |
| full-ai-cluster/k8s/applications/redis/Application.yaml | Redis Helm install expecting an existing auth Secret. |
| full-ai-cluster/k8s/applications/qwen-coder/configmap.yaml | Model metadata ConfigMap for Qwen Coder in `models` namespace. |
| full-ai-cluster/k8s/applications/qwen-coder/Application.yaml | ArgoCD app for the Qwen Coder metadata manifests. |
| full-ai-cluster/k8s/applications/oz/Application.yaml | Placeholder ArgoCD app for ambiguous “OZ” component. |
| full-ai-cluster/k8s/applications/orleans/statefulset.yaml | Skeleton Orleans silo StatefulSet (replicas default 0). |
| full-ai-cluster/k8s/applications/orleans/service.yaml | Services for Orleans silo/gateway/dashboard. |
| full-ai-cluster/k8s/applications/orleans/rbac.yaml | RBAC for Orleans Kubernetes clustering provider. |
| full-ai-cluster/k8s/applications/orleans/namespace.yaml | Orleans namespace with cluster labeling. |
| full-ai-cluster/k8s/applications/orleans/configmap.yaml | Orleans cluster config ConfigMap. |
| full-ai-cluster/k8s/applications/orleans/Application.yaml | ArgoCD app pointing at Orleans manifests. |
| full-ai-cluster/k8s/applications/open-policy-agent/Application.yaml | Gatekeeper (OPA) Helm install configuration. |
| full-ai-cluster/k8s/applications/ollama/Application.yaml | Ollama Helm install configured for NVIDIA GPU scheduling. |
| full-ai-cluster/k8s/applications/nats/Application.yaml | NATS Helm install with JetStream persistence. |
| full-ai-cluster/k8s/applications/mimir/Application.yaml | Mimir distributed Helm install (bundled MinIO enabled). |
| full-ai-cluster/k8s/applications/longhorn/Application.yaml | Longhorn Helm install as distributed block storage. |
| full-ai-cluster/k8s/applications/loki/Application.yaml | Loki Helm install scaffold configured for S3 storage. |
| full-ai-cluster/k8s/applications/kube-prometheus-stack/Application.yaml | kube-prometheus-stack Helm install with persistence settings. |
| full-ai-cluster/k8s/applications/istio/Application.yaml | Istio base chart install (CRDs) with follow-up apps noted. |
| full-ai-cluster/k8s/applications/hindsight/Application.yaml | Placeholder ArgoCD app for ambiguous “Hindsight” component. |
| full-ai-cluster/k8s/applications/hermes/deployment.yaml | Hermes placeholder deployment/service with env wiring for OZ/Ollama/vLLM. |
| full-ai-cluster/k8s/applications/hermes/Application.yaml | ArgoCD app pointing at Hermes manifests. |
| full-ai-cluster/k8s/applications/gitlab/Application.yaml | GitLab chart install values scaffold (runner enabled). |
| full-ai-cluster/k8s/applications/forgejo/Application.yaml | Forgejo chart install values scaffold. |
| full-ai-cluster/k8s/applications/deepseek-coder/configmap.yaml | Creates `models` namespace + Deepseek Coder metadata ConfigMap. |
| full-ai-cluster/k8s/applications/deepseek-coder/Application.yaml | ArgoCD app for Deepseek Coder metadata manifests. |
| full-ai-cluster/k8s/applications/dapr/Application.yaml | Dapr Helm install values scaffold. |
| full-ai-cluster/k8s/applications/cockroachdb/Application.yaml | CockroachDB Helm install values scaffold (3 replicas, TLS). |
| full-ai-cluster/k8s/applications/cilium/Application.yaml | Cilium Helm install values for KPR/Hubble/BPF masquerade. |
| full-ai-cluster/k8s/applications/argo-workflows/Application.yaml | Argo Workflows Helm install values scaffold. |
| full-ai-cluster/k8s/applications/argo-rollouts/Application.yaml | Argo Rollouts Helm install values scaffold. |
| full-ai-cluster/k8s/applications/alloy/Application.yaml | Grafana Alloy Helm install with inline collector config. |
| full-ai-cluster/flake.nix | Full cluster flake: installer + host configs + reusable modules + darwin linux-builder. |
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-25T06:07:57Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `803fcbe07f`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T06:16:54Z)

## Pull request overview

Copilot reviewed 66 out of 66 changed files in this pull request and generated 5 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**full-ai-cluster/k8s/bootstrap/cilium-install.yaml:43**

* The comment says this bootstrap manifest is generated via `helm template` with specific settings (kube-proxy replacement, k8sServiceHost/Port, native routing, etc.), but the kustomize resource points at the upstream `templates.yaml` URL. To keep bootstrap behavior reproducible (and aligned with the required K3S flags like `--disable-kube-proxy`), either commit the rendered manifest that matches those values or update the comments/approach so it’s clear what configuration is actually being applied at bootstrap time.

</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-25T06:22:44Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `042997e45f`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-25T06:41:57Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `dc8d92a9b7`


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

### Thread 1: full-ai-cluster/nixos/modules/k3s-server.nix:26 (resolved)

**@chatgpt-codex-connector** (2026-05-25T05:49:46Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Bootstrap Cilium before disabling Flannel**

The server config disables Flannel and kube-proxy immediately, but the bootstrap manifests only install ArgoCD and the root `Application`; Cilium itself is installed later by ArgoCD (`full-ai-cluster/k8s/applications/cilium/Application.yaml`). On a fresh cluster this creates a bootstrap deadlock: pods need a CNI to start, but the controller that should install Cilium (ArgoCD) is itself a pod workload. Keep Flannel enabled until Cilium is applied out-of-band, or add a direct first-boot Cilium manifest in `services.k3s.manifests`.

Useful? React with 👍 / 👎.

### Thread 2: full-ai-cluster/nixos/modules/k3s-agent.nix:22 (resolved)

**@chatgpt-codex-connector** (2026-05-25T05:49:46Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove server-only disable flags from k3s agent config**

`services.k3s.role = "agent"` is passing `--disable-network-policy` and `--disable-kube-proxy` via `extraFlags`, but these are server component flags (the K3s agent CLI exposes `--kube-proxy-arg` for tuning, not `--disable-kube-proxy`). This can cause worker startup to fail with unknown flags or drift from intended behavior. Keep agent flags to agent-supported options and configure these disables on servers only.

Useful? React with 👍 / 👎.

### Thread 3: full-ai-cluster/usb-nixos-installer/README.md:28 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:05Z):

README uses `../full-ai-cluster/` as the location of the full stack, but inside `full-ai-cluster/usb-nixos-installer/` that relative path resolves to a non-existent `full-ai-cluster/full-ai-cluster/`. Update the wording/link to point to the parent directory (the actual full cluster) while keeping the intent clear.

### Thread 4: full-ai-cluster/README.md:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:05Z):

The tree view under `k8s/bootstrap/` is missing `cilium-namespace.yaml`, which is part of the bootstrap set applied by the NixOS K3S module. Either list it here or remove the file from the bootstrap set so the README matches the actual bootstrap artifacts.

### Thread 5: full-ai-cluster/README.md:71 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:05Z):

README references `./k8s/applications/root-application.yaml`, but the root Application in this directory lives at `./k8s/bootstrap/root-application.yaml` (and there is no `k8s/applications/root-application.yaml`). Update the path in the narrative so a reader can follow the bootstrap flow correctly.

### Thread 6: usb-nixos-installer/README.md:18 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:05Z):

This section claims inputs are pinned by revision, but this flake directory does not include a committed `flake.lock`, so builds will float to the current heads of the referenced branches. Either commit a lock file for reproducibility, or adjust the wording to avoid implying pinning.

### Thread 7: full-ai-cluster/k8s/applications/kube-prometheus-stack/Application.yaml:40 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:06Z):

Hardcoding `grafana.adminPassword: changeme` commits a known password into Git and will configure Grafana with that credential if the chart is applied. Prefer sourcing the admin password from an existing Secret (Sealed Secrets/Vault) or omit it entirely so it must be provided out-of-band.

### Thread 8: full-ai-cluster/nixos/modules/local-storage.nix:63 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:06Z):

In the local-path-provisioner `setup` script, `$VOL_DIR` is expanded unquoted. Quote the variable (and consider validating it's non-empty) to avoid path breakage if the directory contains spaces or other shell-sensitive characters.

### Thread 9: full-ai-cluster/nixos/modules/local-storage.nix:63 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:06Z):

The local-path-provisioner `teardown` script does `rm -rf $path` with an unquoted, unvalidated `$VOL_DIR`-derived value. Add quoting and a guard to prevent accidental deletion if the variable is empty or unexpected (this is a data-loss footgun).

### Thread 10: full-ai-cluster/nixos/modules/docker.nix:44 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:06Z):

This module enables rootless Docker but also adds the `zeta` user to the `docker` group. Membership in `docker` is effectively root-equivalent access to the host via the daemon socket, which undermines the “rootless-by-default” goal. Consider removing the group membership by default or gating it behind an explicit option for hosts that need rootful Docker access.

### Thread 11: full-ai-cluster/k8s/applications/warp/Application.yaml:24 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:07Z):

`TODO(aaron)` introduces named attribution in a current-state manifest. Repo convention is to avoid personal/persona names outside the approved history surfaces; use a role-ref like `TODO(human-maintainer)` / `TODO(cluster-maintainer)` instead (see .github/copilot-instructions.md:305-366).

### Thread 12: full-ai-cluster/nixos/modules/gpu-device-plugin.nix:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:07Z):

Comment claims ArgoCD will take ownership via `k8s/applications/gpu-device-plugin/Application.yaml`, but there is no `full-ai-cluster/k8s/applications/gpu-device-plugin/` directory in this tree. Either add the missing ArgoCD Application (and manifests) or update the comment/strategy so it doesn’t point to a non-existent reconciliation path.

### Thread 13: full-ai-cluster/usb-nixos-installer/flake.nix:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T05:51:07Z):

Comment references using the linux-builder pattern from `../full-ai-cluster/`, but within `full-ai-cluster/usb-nixos-installer/` that relative path points to a non-existent directory. Update the comment to reference the correct location (the parent `../` / `full-ai-cluster/` root) so maintainers following it aren’t sent to a dead path.

### Thread 14: full-ai-cluster/k8s/bootstrap/argocd-install.yaml:8 (resolved)

**@chatgpt-codex-connector** (2026-05-25T06:07:57Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Replace bootstrap Kustomization with plain resources**

Use a renderable manifest format in this bootstrap file. Files dropped into `services.k3s.manifests` are applied by K3s as Kubernetes resources, but `kustomize.config.k8s.io/v1beta1` `Kustomization` is not a built-in resource on a fresh K3s cluster. On first boot this means ArgoCD is never installed, so the root `Application` cannot reconcile anything else. Commit the rendered ArgoCD install YAML (or a K3s `HelmChart`) instead of a kustomize-only document.

Useful? React with 👍 / 👎.

### Thread 15: full-ai-cluster/k8s/applications/oz/Application.yaml:35 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T06:16:52Z):

Hardcoding the OpenZiti controller admin password in Git makes the cluster insecure by default (anyone who can reach the service can try the known credential). Prefer sourcing the password from a Kubernetes Secret (e.g., created via Sealed Secrets/Vault) or require it to be provided out-of-band rather than committing a default value.

### Thread 16: full-ai-cluster/k8s/applications/hindsight/Application.yaml:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T06:16:53Z):

This file includes direct named attribution / TODO markers (e.g., "per Aaron" / "TODO(aaron)"). Per the repo’s "No name attribution in code, docs, or skills" rule, current-state surfaces should use role references (e.g., "the human maintainer") and avoid personal-name TODO tags.

### Thread 17: full-ai-cluster/nixos/modules/k3s-server.nix:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T06:16:53Z):

These comments state that ArgoCD will install MetalLB + ingress-nginx (or an Istio gateway), but this PR doesn’t include corresponding Applications/manifests. Either add those cluster-layer apps or adjust the comments so readers don’t assume load-balancing/ingress will exist after bootstrap.

### Thread 18: full-ai-cluster/nixos/modules/k3s-server.nix:65 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T06:16:53Z):

Opening etcd client/peer ports (2379/2380) at the host firewall is risky: if embedded etcd is bound beyond loopback (or the config changes later), this can expose etcd to the LAN. Consider removing these ports from `allowedTCPPorts` (or restricting them to only the cluster internal interface/IP range) unless there is a confirmed need for remote etcd access.

### Thread 19: full-ai-cluster/k8s/applications/ollama/Application.yaml:30 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T06:16:54Z):

This Ollama Application will immediately pull and run large models (33B/32B) and request a GPU by default. That conflicts with the README’s stated “deferred local-models phase” and can create a very heavy default bootstrap. Consider defaulting this app to disabled/scaled-to-zero (or omitting model pulls/runs by default) so local models don’t start consuming GPU/Storage unless explicitly enabled.

### Thread 20: full-ai-cluster/k8s/applications/ollama/Application.yaml:29 (resolved)

**@chatgpt-codex-connector** (2026-05-25T06:22:44Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Disable Ollama auto-start in deferred local-model phase**

This app is configured to `pull` and `run` two very large models at startup, but it does not override `replicaCount`, so the chart default replica starts immediately once ArgoCD syncs it. That causes first-boot GPU scheduling and multi-GB model downloads in the bootstrap path, which conflicts with the stated deferred local-model phase and can stall smaller clusters during bring-up. Add an explicit disable/opt-in (for example `replicaCount: 0` until local models are intentionally enabled).

Useful? React with 👍 / 👎.

### Thread 21: full-ai-cluster/k8s/bootstrap/root-application.yaml:38 (resolved)

**@chatgpt-codex-connector** (2026-05-25T06:22:44Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Gate GitLab and Forgejo so only one reconciles**

The root app includes every `*/Application.yaml`, and both Git providers are marked `automated`, so GitLab and Forgejo will both reconcile by default even though each file says “pick one.” Deploying both stacks simultaneously adds avoidable storage/compute pressure and operational ambiguity in a fresh cluster. One of these should be explicitly gated/disabled in bootstrap rather than auto-enabled with the rest of the app set.

Useful? React with 👍 / 👎.

### Thread 22: full-ai-cluster/k8s/applications/gitlab/Application.yaml:25 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T06:41:57Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Provide GitLab root-password secret in bootstrap state**

On a fresh cluster bootstrap, this app is auto-synced by `k8s/bootstrap/root-application.yaml`, but `gitlab` is configured to read `global.initialRootPassword.secret` from `gitlab-initial-root-password` without any manifest in this commit creating that Secret. In that default path, the chart cannot fully reconcile until an operator manually creates the Secret, so the initial declarative bring-up is left degraded/non-reproducible. Either commit a SealedSecret/Vault-backed secret resource for this name or gate GitLab behind manual sync until credentials are provisioned.

Useful? React with 👍 / 👎.
