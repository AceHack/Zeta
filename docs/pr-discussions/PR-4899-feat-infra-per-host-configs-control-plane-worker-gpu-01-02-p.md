---
pr_number: 4899
title: "feat(infra): per-host configs control-plane + worker-gpu-01/02 (PR 3 of Addison's plan)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T02:32:30Z"
merged_at: "2026-05-25T02:32:35Z"
closed_at: "2026-05-25T02:32:35Z"
head_ref: "feat/addison-per-host-configs-2026-05-24"
base_ref: "feat/addison-flake-and-modules-2026-05-24"
archived_at: "2026-05-27T19:51:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4899: feat(infra): per-host configs control-plane + worker-gpu-01/02 (PR 3 of Addison's plan)

## PR description

## Summary

PR 3 of Addison's NixOS-AI-cluster bootstrap plan. Adds the three per-host configs that compose the shared modules from #4898.

**Base: #4898** (will rebase to main once #4898 merges).

## Files

| Host | Imports | Role |
|---|---|---|
| `control-plane` | `common` + `k3s-server` | API server + embedded etcd; auto-bootstraps ArgoCD |
| `worker-gpu-01` | `common` + `k3s-agent` + `gpu` | NVIDIA worker; joins control-plane.zeta.local:6443 |
| `worker-gpu-02` | `common` + `k3s-agent` + `gpu` | NVIDIA worker; identical shape to -01 |

Each host directory has:

- `configuration.nix` — host identity + module imports + per-host overrides
- `hardware-configuration.nix` — **placeholder stub** (replaced during real install by `nixos-generate-config --root /mnt`)
- `README.md` on control-plane — install runbook + post-install verification

`flake.nix` now exposes all four configs in `nixosConfigurations`: `installer`, `control-plane`, `worker-gpu-01`, `worker-gpu-02`.

## Hardware config placeholders

Real `hardware-configuration.nix` is generator output specific to each target machine. Placeholders ship as minimal valid stubs (`not-detected.nix` import + DHCP + ext4 by-label fileSystems) so:

- `nix flake check` passes in CI
- `nix build .#nixosConfigurations.control-plane` succeeds at evaluation
- Real install replaces them before first reboot

Each placeholder has a comment block naming the generator command.

## Test plan

- [ ] `nix flake check` passes
- [ ] `nix build .#nixosConfigurations.{control-plane,worker-gpu-01,worker-gpu-02}` succeed
- [ ] PR 4 (k8s bootstrap) can reference `services.k3s.manifests` paths cleanly

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T02:36:22Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `5ee011111c`


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

### Thread 1: infra/nixos/hosts/control-plane/README.md:27 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T02:36:22Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Add credential bootstrap before SSH verification**

Following this runbook verbatim on a fresh install will fail at the first verification step because `ssh zeta@control-plane` assumes remote auth is already configured, but this commit's host config leaves `users.users.zeta.openssh.authorizedKeys.keys` empty while the shared baseline uses key-only SSH and no initial password. In that state, operators cannot complete post-install verification remotely; add an explicit pre-SSH step to install a key (or set a password) before this command.

Useful? React with 👍 / 👎.
