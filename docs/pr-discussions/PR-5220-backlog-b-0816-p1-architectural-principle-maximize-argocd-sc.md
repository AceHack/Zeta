---
pr_number: 5220
title: "backlog(B-0816 P1 architectural-principle): maximize ArgoCD scope; minimize NixOS-native lock-in for cross-cluster portability"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T16:49:19Z"
merged_at: "2026-05-26T16:51:01Z"
closed_at: "2026-05-26T16:51:01Z"
head_ref: "otto-cli/b0816-principle-maximize-argocd-scope-portability-leverage-aaron-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:44Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5220: backlog(B-0816 P1 architectural-principle): maximize ArgoCD scope; minimize NixOS-native lock-in for cross-cluster portability

## PR description

## Summary

Lands the architectural principle the maintainer 2026-05-26 named immediately after the iter-6.0 nixpkgs bump merge:

> *"nice also ArgoCD is ususaly be anyone with k8s too not just nixos so antoher reason to push as much as possible into argocd."*

## Carved sentence

ArgoCD is used by ANYONE running Kubernetes (not just NixOS users); substrate-in-ArgoCD ports across every K8s cluster + every K8s distribution. NixOS-native substrate is load-bearing for the BOOT + OS layer, but BEYOND THAT every substrate-engineering decision should default to ArgoCD-managed for cross-cluster portability leverage.

## What changes for existing substrate

| Existing row | Status under principle |
|---|---|
| B-0813 iter-5.4.2 cluster-nodes-reconciler | ✅ ArgoCD-managed — reinforced |
| B-0802 kured | ✅ ArgoCD-managed — reinforced |
| B-0806 sub-target 3 Crossplane | ✅ ArgoCD-managed — reinforced |
| B-0800 nixpkgs bump | NixOS-only (boot+OS layer; no portable alternative) |
| B-0801 system.autoUpgrade | NixOS-only (Nix flake update is NixOS-specific) |
| B-0803 deploy-rs | NixOS-only — **flagged** as not cross-distro-portable |

## Implication for B-0782 cluster-IS-DIO

DIO lives in 4 layers, each with its own reconciler:
1. Boot+OS = NixOS substrate (DIO via nixos-rebuild)
2. K8s+workload = ArgoCD (DIO via ArgoCD sync)
3. External-infra = Crossplane via ArgoCD (DIO via CR reconciliation)
4. Heterogeneous-OS = Ansible+Ace bridge (B-0806 substrate)

## Implication for cross-distro adoption

Operators on K3S-on-Ubuntu / Talos / RKE2 / EKS / GKE / AKS / OpenShift can adopt iter-5.4.x substrate by:
1. Skip NixOS install.sh (use their own bootstrap)
2. Adopt the `maintainers/<op>/cluster-nodes/<host>/` tree shape
3. Point their ArgoCD at the tree
4. Run a future `register-node.ts` equivalent for their distro

NixOS becomes ONE of N possible host substrates. Zeta substrate stays portable.

## Composes with

12 existing rows (B-0782, B-0790, B-0794, B-0800–B-0806, B-0811, B-0813, B-0814) — full cross-reference table in the row body.

## Substrate-inventory pass

Per `.claude/rules/verify-existing-substrate-before-authoring.md` (#5131): no existing principle row on this topic; ID B-0816 next-free; principle generalizes the discipline existing rows already partially encode.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T16:49:25Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
