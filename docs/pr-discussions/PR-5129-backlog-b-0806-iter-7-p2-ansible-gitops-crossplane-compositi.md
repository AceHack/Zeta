---
pr_number: 5129
title: "backlog(081KSGS9H0008QG0R001Y9FB62 iter-7 P2): Ansible+GitOps + Crossplane composition \u2014 cross-OS declarative management for Windows + Macs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T08:19:23Z"
merged_at: "2026-05-26T08:23:11Z"
closed_at: "2026-05-26T08:23:11Z"
head_ref: "otto-cli/b0806-ansible-gitops-crossplane-cross-os-2026-05-26"
base_ref: "main"
archived_at: "2026-05-26T13:29:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5129: backlog(081KSGS9H0008QG0R001Y9FB62 iter-7 P2): Ansible+GitOps + Crossplane composition — cross-OS declarative management for Windows + Macs

## PR description

## Summary

Iter-7 capstone capturing the maintainer's 2026-05-26 substrate-engineering pull:

- *"This is good for declarative oses other than nix like id love to have it setup my windows machines and macs. ansible gitops"*
- *"it's like cross plane too kinda"*

## End-state architecture (4-reconciler shape)

```
git (single source of truth)
├── k8s/applications/    → ArgoCD pulls → applies to K8s            (exists)
├── nixos/flake.nix      → autoUpgrade pulls → nixos-rebuild switch (081KSGS9H0008QG0R002T6J6FS)
├── ansible/playbooks/   → ansible-pull cron pulls → applies to OS  (NEW — iter-7)
└── crossplane/          → Crossplane controller pulls → external APIs (NEW — iter-7)
```

Each substrate class has one reconciler; all share git as source of truth. Composes with `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` at substrate-class scope.

## Key recommendations captured

- **Pattern 3 (ansible-pull)** for OS substrate — rejects Pattern 1 Operator (K8s host required + network reachability concern) + Pattern 2 Webhook AAP (commercial cost). Pull-from-host matches NixOS autoUpgrade analog.
- **Crossplane** for cluster-external infra — extends existing ArgoCD substrate rather than adding a second control plane.

## 6 design questions for the maintainer (sub-target-blocking)

Pull cadence, branch model, secret handling, ansible-bootstrap, state observability, conflict handling — all documented in the row body as substrate-engineering decisions to land before iter-7 sub-target work begins.

## Composes with

- 081KSGS9H0008QG0R0027HJZYH (iter-5.4 homelab gh-auth — enables host→git auth for the pull side)
- 081KSGS9H0008QG0R001EKTS5A–081KSGS9H0008QG0R002BC2ZR7 (iter-6 cluster-update arc)
- 081KSGS9H0008QG0R002BC2ZR7 capstone (dep-pin discipline applies to ansible collections + Crossplane providers too)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T08:19:29Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
