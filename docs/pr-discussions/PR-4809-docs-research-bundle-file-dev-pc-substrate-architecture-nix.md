---
pr_number: 4809
title: "docs(research): bundle-file dev-PC substrate architecture (Nix + Home Manager + k3d + Headscale + lend-resources pattern)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T02:04:57Z"
merged_at: "2026-05-24T02:16:19Z"
closed_at: "2026-05-24T02:16:19Z"
head_ref: "otto/research-dev-pc-substrate-nix-home-manager-k3d-headscale-2026-05-24"
base_ref: "main"
archived_at: "2026-05-24T14:24:50Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4809: docs(research): bundle-file dev-PC substrate architecture (Nix + Home Manager + k3d + Headscale + lend-resources pattern)

## PR description

## Summary

Aaron 2026-05-24T~03:30Z: *"yes bundle-file it (shadow*)"* + additions:

- **Tailscale is good but we also want Headscale** (self-hosted control plane)
- **Lightweight-first principle** captured verbatim
- **Dev boxes as lending-resources** to cluster (opt-in pattern, not first-class k8s nodes)

Sibling to **PR #4808** (cluster substrate). Combined, the two archives describe the full ecosystem (cluster + dev PCs) as one declarative substrate.

## Bundle-file term disambiguation (per Aaron's question)

"Bundle-file" = file all related decisions as ONE comprehensive archive rather than N narrow ones. Single source of truth; cross-references are internal; easier to find later.

## Decided primary stack (lightweight-first)

| Layer | Choice |
|---|---|
| Per-OS reproducibility | Nix package manager + Home Manager (macOS: nix-darwin; Windows: WSL2) |
| Local k8s testing | k3d (lighter than kind) |
| Cluster-workload-lending | Lightweight Bun/Node daemon polling NATS queue |
| Network overlay | Tailscale clients + **self-hosted Headscale control plane** |

## Sovereignty preserved

Headscale > pure Tailscale managed: control plane is yours; no commercial dependency; free at any node count; framework discipline match.

## Lending-resources pattern (per Aaron's framing)

Dev PCs are NOT first-class k8s nodes (trust boundary + reliability). They run a lightweight background daemon that polls cluster work-queue for opt-in workloads. Owner can pause/resume/revoke any time (NCI floor at dev-PC scope).

## Deferred (ease-into-later)

Liqo / KubeFed v2 / k3s agent per dev PC / custom DERP / native-Nix-on-Windows / full NixOS desktop.

## Addison's preferences

Explicitly absent from this archive pending her direct articulation. Per consent-discipline: observation-not-fact; declarative claims about Addison's preferences would violate the discipline.

## Composes with

- PR #4808 — sibling cluster substrate archive
- Addison consent archive (PR #4794)
- 9 framework rules (DST, glass-halo, NCI floor, m/acc-multi-oracle, bandwidth-served, additive, Aaron lightweight-first, Addison observation-not-fact, shadow-star)

## Test plan

- [ ] CI green (lint only — no source changes)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-24T02:06:20Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `8ac596d289`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T02:07:31Z)

## Pull request overview

Adds a research archive documenting the decided dev-PC substrate architecture that complements the sibling cluster-substrate archive (PR #4808), capturing a lightweight-first stack (Nix + Home Manager, local k8s via kind/k3d, Headscale/Tailscale overlay, and an opt-in “lend resources” daemon pattern).

**Changes:**

- Adds a comprehensive dev-PC substrate decision archive under `docs/research/`.
- Documents the primary choices plus deferred “ease-into-later” options and open questions.
- Cross-links the dev-PC archive to the sibling cluster archive and relevant framework rules.

## Review threads

### Thread 1: docs/research/2026-05-24-dev-pc-substrate-architecture-nix-home-manager-kind-k3d-headscale-lend-pattern-aaron-otto.md:3 (resolved)

**@chatgpt-codex-connector** (2026-05-24T02:06:20Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct impossible decision timestamp**

The archive states `Date decided: 2026-05-24 (~03:30Z)`, but this commit is timestamped `2026-05-24 02:05:19 +0000`, so the documented decision time is in the future relative to when the record was created. For GOVERNANCE-style provenance/audit trails, this ordering ambiguity can break trust in chronology; either adjust the decision time or explicitly mark that the file was updated after the decision was made.

Useful? React with 👍 / 👎.

### Thread 2: docs/research/2026-05-24-dev-pc-substrate-architecture-nix-home-manager-kind-k3d-headscale-lend-pattern-aaron-otto.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-24T02:07:31Z):

The consent-file reference in `Participants` doesn’t match the actual date-prefixed filename used elsewhere (and in the linked file list below). As written, this backticked filename won’t resolve to an existing doc; update it to the correct `2026-05-24-...` name for xref integrity.
