---
pr_number: 5227
title: "feat(081KSGS9H0008QG0R00352WW0V): file Flux-as-second-engine row with flag-toggle + multi-cluster A/B substrate"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:10:44Z"
merged_at: "2026-05-26T17:12:10Z"
closed_at: "2026-05-26T17:12:10Z"
head_ref: "otto-cli/b0820-flux-engine-second-engine-flag-toggle-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:37:39Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5227: feat(081KSGS9H0008QG0R00352WW0V): file Flux-as-second-engine row with flag-toggle + multi-cluster A/B substrate

## PR description

## Summary

Files [081KSGS9H0008QG0R00352WW0V](https://github.com/Lucent-Financial-Group/Zeta/blob/otto-cli/b0820-flux-engine-second-engine-flag-toggle-2026-05-26/docs/backlog/P2/081KSGS9H0008QG0R00352WW0V-flux-engine-second-engine-support-flag-toggle-multi-cluster-experimentation-aaron-2026-05-26.md) per the maintainer 2026-05-26: *"backlog flux over argocd so we can have a flag and support both eventually"*.

Composes with:

- **081KSGS9H0008QG0R003A37Z65** (Helm-as-convergence-point + multi-engine substrate framing) — this row IS the concrete Flux-second-engine implementation of that architectural principle
- **081KSGS9H0008QG0R0005P83AP** (AI-runbook substrate / conversation-as-UI) — long-term engine-UI-parity matters less; the AI-runbook layer is the actual operator surface
- **081KSGS9H0008QG0R002K93MWX** (ClusterNode CRD) — gets \`engine\` field extension
- **081KSGS9H0008QG0R0027HJZYH** (cluster-bring-up substrate) — extends to flux-engine install path

Six sub-targets named (engine flag in CRD; Helm-charts-first layout; Flux install; dependsOn↔sync-wave translation; UI considerations including Weave GitOps OSS / Capacitor / Headlamp; multi-cluster A/B runbook).

Filed P2 — additive to ArgoCD-default per 081KSGS9H0008QG0R003A37Z65; gated on multi-cluster substrate to be operational first.

## Test plan

- [ ] Markdown lint clean
- [ ] BACKLOG.md drift check clean (regenerated)
- [ ] Cross-links to 081KSGS9H0008QG0R002K93MWX / 081KSGS9H0008QG0R0027HJZYH / 081KSGS9H0008QG0R003A37Z65 / 081KSGS9H0008QG0R0005P83AP resolve

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T17:10:49Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
