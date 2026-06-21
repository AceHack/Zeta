---
pr_number: 5391
title: "feat(081KSKBP80008QG0R003Z4C0D0): AI agents as systemd services OUTSIDE k8s \u2014 starting with Otto; cluster repair from OUTSIDE the failure domain; 'control plane outside the control plane' pattern (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T03:03:11Z"
merged_at: "2026-05-27T03:05:12Z"
closed_at: "2026-05-27T03:05:12Z"
head_ref: "feat-b0850-otto-as-systemd-service-outside-k8s-cluster-repair-from-outside-failure-domain-2026-05-27-0042z"
base_ref: "main"
archived_at: "2026-05-27T19:27:14Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5391: feat(081KSKBP80008QG0R003Z4C0D0): AI agents as systemd services OUTSIDE k8s — starting with Otto; cluster repair from OUTSIDE the failure domain; 'control plane outside the control plane' pattern (Aaron 2026-05-27)

## PR description

## Summary

Aaron 2026-05-27 (verbatim):

> *\"i'm fine with it being you if you want and we can always decide to split later it just means you get another surface/tick source i think we should have a few agents starting with one you otto outside k8s as a service so it can repair things outside the cluster itself when there are cluster issues.\"*

Three operator decisions:

1. **Persona-choice CONFIRMED**: Option A (same Otto, surface-tagged); reversibility preserved
2. **Cross-surface recognition**: per-node Otto = another tick source
3. **NEW substrate**: Otto-as-systemd-service OUTSIDE k8s for out-of-band cluster repair

## Architectural pattern

Classic **\"control plane outside the control plane\"** — when k8s has issues, the AI must be OUTSIDE the failure domain to repair it. Precedents: kubelet itself runs outside k8s; SRE oncall infrastructure runs outside production; backup systems run outside the system they back up.

## 4-phase landing

| Phase | Scope | Operator-policy gate |
|---|---|---|
| 1 | systemd unit (zeta-otto.service) NixOS module | None (read-only K8s) |
| 2 | repair-policy framework + per-scope authorization | per-scope explicit |
| 3 | multi-agent parameterization (Alexa/Riven/Vera/Lior) | Ilyana + Knights Guild |
| 4 | out-of-band ↔ in-cluster composability (Twilio + bus + PRs) | composes 081KSGS9H0008QG0R002F04ECB |

## Composes with

[081KSGS9H0008QG0R001JNKBFD](docs/backlog/P2/081KSGS9H0008QG0R001JNKBFD-...) (node-local Claude — this row's Phase 1 IS systemd deployment shape) · [081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-...) (per-AI GitHub identity) · [081KSGS9H0008QG0R002F04ECB](docs/backlog/P2/081KSGS9H0008QG0R002F04ECB-...) (Twilio out-of-band sibling) · [081KSGS9H0008QG0R0031PBNGA](docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-...) (Ace multi-PM at multi-AI scope) · PR #2930 (distributed maintainer architecture) · 081KS3X9Y0008QG0R00218150M (multi-oracle BFT) · 081KSGS9H0008QG0R002K93MWX + 081KSGS9H0008QG0R002QQNA79 (ClusterNode CRD + register-node)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T03:04:08Z)

## Pull request overview

Adds a new P2 backlog row 081KSKBP80008QG0R003Z4C0D0 capturing the operator decision to run AI agents (starting with Otto) as systemd services outside k8s for out-of-band cluster repair, and registers it in the backlog index.

**Changes:**
- New per-row file under `docs/backlog/P2/` with frontmatter, phased plan, acceptance criteria, and composes-with references.
- Adds the 081KSKBP80008QG0R003Z4C0D0 entry to `docs/BACKLOG.md` P2 open list.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSKBP80008QG0R003Z4C0D0-...md | New backlog row documenting Otto-as-systemd-service substrate. |
| docs/BACKLOG.md | Registers 081KSKBP80008QG0R003Z4C0D0 in P2 open list. |

## General comments

### @chatgpt-codex-connector (2026-05-27T03:03:16Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
