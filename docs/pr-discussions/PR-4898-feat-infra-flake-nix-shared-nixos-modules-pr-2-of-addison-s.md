---
pr_number: 4898
title: "feat(infra): flake.nix + shared NixOS modules (PR 2 of Addison's plan)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T02:30:09Z"
merged_at: "2026-05-25T02:53:15Z"
closed_at: "2026-05-25T02:53:15Z"
head_ref: "feat/addison-flake-and-modules-2026-05-24"
base_ref: "main"
archived_at: "2026-05-27T19:51:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4898: feat(infra): flake.nix + shared NixOS modules (PR 2 of Addison's plan)

## PR description

## Summary

PR 2 of Addison's NixOS-AI-cluster bootstrap plan. Wires the installer config from #4897 into a buildable flake and seeds the shared modules every cluster host will import.

Building on:

- #4897 — installer USB package list (merged)

Setting up:

- PR 3 — per-host configs (control-plane + worker-gpu-*)
- PR 4 — k8s bootstrap + ArgoCD Applications
- PR 5 — helper scripts + infra README

## Files

| File | Purpose |
|---|---|
| `flake.nix` | Repo-root entry. Wires `nixosConfigurations.installer` to the file from #4897; exposes `packages.installer-iso`, `devShells.default`, `nixosModules.{common,k3s-server,k3s-agent,gpu}` |
| `infra/nixos/modules/common.nix` | Shared baseline every host imports — Nix/flakes settings, locale, networking, SSH key-only, `zeta` admin user, baseline packages, systemd-boot |
| `infra/nixos/modules/k3s-server.nix` | K3S control-plane (embedded etcd, disables servicelb+traefik, auto-applies k8s/bootstrap/ manifests so ArgoCD self-installs) |
| `infra/nixos/modules/k3s-agent.nix` | K3S worker (joins via serverAddr+tokenFile; node label `zeta.io/role=worker`) |
| `infra/nixos/modules/gpu.nix` | NVIDIA driver + container toolkit, unfree scoped to nvidia+cuda only, node label `zeta.io/gpu=nvidia` |
| `.gitignore` | Nix patterns: `result`, `result-*`, `.direnv/`, `.envrc.local`, `.nix-eval-cache/`, top-level `/hardware-configuration.nix` |

## How it composes

\`\`\`
flake.nix
  └─ nixosConfigurations.installer
        └─ infra/nixos/hosts/installer/configuration.nix  (from #4897)

  Future (PR 3):
  ├─ nixosConfigurations.control-plane
  │     └─ infra/nixos/hosts/control-plane/configuration.nix
  │           ├─ imports common.nix
  │           └─ imports k3s-server.nix  ──► auto-applies k8s/bootstrap/*
  └─ nixosConfigurations.worker-gpu-NN
        └─ infra/nixos/hosts/worker-gpu-NN/configuration.nix
              ├─ imports common.nix
              ├─ imports k3s-agent.nix
              └─ imports gpu.nix
\`\`\`

## Security

- No hard-coded passwords anywhere.
- Tokens are placeholder-pathed (`tokenFile = /var/lib/rancher/k3s/.../token`) so plaintext secrets never land in Git.
- `sops-nix` / `agenix` wiring lands in a follow-up PR alongside the per-host configs that need real tokens.
- SSH key-only baseline; `wheelNeedsPassword = true` default (sudo requires password).
- `allowUnfreePredicate` is *scoped* — only NVIDIA driver + CUDA packages are allowed, not blanket unfree.

## Forward refs

- `k3s-server.nix` references `../../../k8s/bootstrap/{argocd-namespace,argocd-install,root-application}.yaml` which land in PR 4. Until then, no host imports `k3s-server.nix` (per-host configs are PR 3), so the dangling reference is unreachable and \`nix flake check\` is unaffected.

## Test plan

- [ ] `nix flake check` passes (no errors evaluating the flake)
- [ ] `nix build .#installer-iso` reproduces a buildable ISO (post-merge)
- [ ] PR 3 per-host configs import the modules cleanly

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T02:33:46Z)

## Pull request overview

Adds an initial Nix flake entrypoint plus shared NixOS modules to bootstrap a NixOS-based cluster (installer ISO now; per-host configs/modules composition next).

**Changes:**

- Introduces `flake.nix` with `nixosConfigurations.installer`, exported shared `nixosModules`, a devShell, and a package alias for building the installer ISO.
- Adds shared NixOS modules for a common baseline, K3s server/agent roles, and NVIDIA GPU enablement.
- Updates `.gitignore` for common Nix/direnv outputs and generated hardware config.

### Reviewed changes

Copilot reviewed 12 out of 13 changed files in this pull request and generated 7 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `flake.nix` | New repo-root flake wiring installer config, module exports, packages/devShell/formatter. |
| `infra/nixos/modules/common.nix` | Shared baseline settings for hosts (Nix settings, SSH baseline, packages, boot defaults). |
| `infra/nixos/modules/k3s-server.nix` | K3s control-plane module with embedded etcd and bootstrap-manifest wiring. |
| `infra/nixos/modules/k3s-agent.nix` | K3s worker/agent module with join configuration and node labeling. |
| `infra/nixos/modules/gpu.nix` | NVIDIA driver + container toolkit + node labeling for GPU workers. |
| `.gitignore` | Ignores Nix build artifacts, direnv files, and generated top-level hardware config. |
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T02:41:20Z)

## Pull request overview

Copilot reviewed 25 out of 26 changed files in this pull request and generated 8 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T02:47:04Z)

## Pull request overview

Copilot reviewed 25 out of 26 changed files in this pull request and generated 7 comments.

## Review threads

### Thread 1: flake.nix:5 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:33:45Z):

P1: flake.nix references a `flake.lock` (“pins the entire universe”), but this PR doesn’t add `flake.lock` to the repo. Without committing it, builds/evals won’t be reproducible across machines/CI. Please generate and commit `flake.lock` (or adjust the comment/docs if the repo intentionally won’t track it).

### Thread 2: flake.nix:75 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:33:45Z):

P1: `supportedSystems` includes `aarch64-linux`, but `nixosConfigurations.installer` is created with the default system (`x86_64-linux`). In `eachSystem`, `packages.installer-iso` will therefore point at an x86_64 ISO even when evaluating/building on aarch64, which is surprising and can break `nix build .#installer-iso` on non-x86 hosts. Consider parameterizing the installer configuration by `system` (or limiting `supportedSystems` if the ISO is intentionally x86_64-only).

### Thread 3: flake.nix:80 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:33:45Z):

P2: Comment says “Future hosts land in PR 2 (per-host configs)”, but this PR is already PR 2 per the PR title/description; the per-host configs are described as PR 3. Update the comment to avoid confusing future readers.

### Thread 4: flake.nix:20 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:33:46Z):

P1: The comment references `infra/k8s/applications/*/Application.yaml`, but this repo currently has no `infra/k8s/` directory and `k3s-server.nix` references paths under `/k8s/...`. Please reconcile the intended Kubernetes manifest location (either update comments/paths to `k8s/...` or move manifests under `infra/k8s/...`) so the tree structure matches the documentation.

### Thread 5: infra/nixos/modules/k3s-server.nix:31 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:33:46Z):

P0: `clusterInit = true` is set unconditionally. For embedded-etcd K3s, `--cluster-init` should only be true on the first server; additional server nodes must join the existing cluster instead, otherwise you risk booting multiple independent clusters. Suggest making this a per-host setting (e.g., `mkDefault false` here and enable only on the bootstrap control-plane host).

### Thread 6: infra/nixos/modules/k3s-server.nix:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:33:46Z):

P1 (security): `--write-kubeconfig-mode=0644` makes the admin kubeconfig world-readable on the control-plane node. That effectively grants cluster-admin creds to any local user. Consider a more restrictive mode (e.g., 0600/0640) and, if needed, setting a kubeconfig group (wheel) so only admins can read it.

### Thread 7: infra/nixos/modules/k3s-server.nix:55 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:33:46Z):

P0: `services.k3s.manifests` points at `../../../k8s/...` paths, but the repo currently has no `k8s/` directory, so importing this module will fail evaluation immediately. If these manifests intentionally land in PR 4, consider guarding the `manifests` attrset behind an option/`pathExists` check (or include placeholder manifests in this PR) so the module is usable as soon as per-host configs import it in PR 3.

### Thread 8: infra/nixos/modules/k3s-server.nix:49 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:18Z):

P0 (security): `--write-kubeconfig-mode=0644` makes `/etc/rancher/k3s/k3s.yaml` world-readable, which typically exposes cluster-admin client credentials to any local user. Prefer a more restrictive mode (e.g., 0600/0640) and grant the intended admin user access via group ownership or a dedicated kubeconfig copy with limited perms.

### Thread 9: infra/nixos/modules/k3s-server.nix:63 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:19Z):

P0 (bug/ops): The server firewall allow-list is missing the standard K3S supervisor/registration port (9345/TCP), which agents typically need to join/maintain the connection to the server. Either open 9345 here or use the NixOS k3s module’s built-in firewall integration (if available) to avoid drifting from K3S’s required port set.

### Thread 10: flake.nix:53 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:19Z):

P1 (maintainability): `supportedSystems` includes `aarch64-linux`, but all `nixosConfigurations.*` use `mkSystem`’s default `system = "x86_64-linux"`. That makes the per-system `packages.installer-iso` output point at an x86_64 ISO even when evaluating/building on aarch64. Consider either (a) removing aarch64 from `supportedSystems` for now, or (b) producing per-arch installer builds (e.g., `installer-${system}`) and wiring `packages.installer-iso` to a same-arch nixosSystem.

### Thread 11: infra/README.md:92 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:19Z):

P1 (documentation): This line shows `serverAddr = control-plane.zeta.local:6443` (no scheme), but the NixOS `services.k3s.serverAddr` examples/configs in this PR use an `https://...` URL. For copy/paste correctness, update this README example to include the scheme.

### Thread 12: infra/README.md:125 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:19Z):

P1 (documentation): The Secrets section only documents placing the K3S token at the server path (`/var/lib/rancher/k3s/server/token`), but worker nodes in this PR default to reading `/var/lib/rancher/k3s/agent/token`. Update the docs to cover how/where the token must be provided on agents as well (or document a single shared token path if that’s the intended convention).

### Thread 13: infra/k8s/bootstrap/initial-orleans.yaml:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:20Z):

P1 (codebase convention): This is a current-state infra manifest, but it includes named attribution and anthropomorphic/sentience-style framing in comments. Repo convention is to avoid personal/persona name attribution outside the allowlisted history surfaces (see `.github/copilot-instructions.md` “No name attribution…”), and keeping comments strictly technical here will reduce policy drift.

### Thread 14: infra/nixos/modules/gpu.nix:51 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:20Z):

P2 (documentation): The comment says “Open-source kernel modules”, but the actual default is `open = lib.mkDefault false;` (i.e., proprietary kernel module by default). Either flip the default to match the comment or adjust the comment to reflect the chosen default.

### Thread 15: infra/k8s/bootstrap/argocd-install.yaml:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:41:20Z):

P2 (documentation): This comment says to bump ArgoCD “in lockstep with the `targetRevision` in infra/k8s/applications/root-application.yaml”, but that file’s `targetRevision` is `main` (not an ArgoCD version). Consider rewording this to point at the actual place you want pinned (e.g., this URL tag only, or a dedicated ArgoCD Application/values file) to avoid confusion during upgrades.

### Thread 16: infra/README.md:89 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:47:02Z):

P1: The bootstrap order claims K3S applies `infra/k8s/bootstrap/initial-orleans.yaml`, but `infra/nixos/modules/k3s-server.nix` only auto-applies argocd-namespace, argocd-install, and root-application. Either add `initial-orleans.yaml` to `services.k3s.manifests` or remove/update steps 4/related tree comments so the docs match actual first-boot behavior.

### Thread 17: infra/nixos/modules/k3s-server.nix:52 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:47:03Z):

P1: Comment says ArgoCD will install MetalLB + ingress-nginx as Applications, but there are no corresponding Applications under `infra/k8s/applications/` in this PR. Please reword to indicate these are planned follow-ups (or add the missing Applications in the same PR) to avoid implying the cluster will have ingress/LB out of the box.

### Thread 18: infra/nixos/hosts/control-plane/README.md:58 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:47:03Z):

P1: This README references `hardware-configuration.nix.example`, but that file doesn't exist in this directory (or under `infra/nixos/hosts/`). Either add the example file or update the text to point at the placeholder `hardware-configuration.nix` that lives alongside this README.

### Thread 19: infra/nixos/hosts/worker-gpu-01/configuration.nix:12 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:47:03Z):

P1: This comment points readers to `hardware-configuration.nix.example`, but that file isn't present in the repo. Consider updating the comment to reference `./hardware-configuration.nix` (placeholder committed in this PR) or add an example file at the referenced path.

### Thread 20: infra/README.md:148 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:47:03Z):

P2: Name attribution appears in current-state infra docs/configs (e.g. “Per Addison's spec”). Repo guidance prefers role-based references outside the approved history/roster surfaces; consider rephrasing to a role/spec reference (e.g. “Per the cluster bootstrap spec”) and apply the same treatment to similar occurrences in this infra tree.

### Thread 21: flake.nix:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:47:04Z):

P1: PR description says per-host configs land in PR 3, but this PR already defines `nixosConfigurations.control-plane` / `worker-gpu-*` and adds their `infra/nixos/hosts/**/configuration.nix` files. Please reconcile by updating the PR description/plan or deferring these host configs to the intended follow-up PR.

### Thread 22: infra/k8s/bootstrap/initial-orleans.yaml:9 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T02:47:04Z):

P1: Header comments state this manifest is “applied at K3S first-boot”, but `k3s-server.nix` does not currently include `initial-orleans.yaml` in `services.k3s.manifests`, so it won’t actually be auto-applied. Either wire this into the server manifests or adjust the wording so it’s clear this file is only applied once ArgoCD syncs (or manually).
