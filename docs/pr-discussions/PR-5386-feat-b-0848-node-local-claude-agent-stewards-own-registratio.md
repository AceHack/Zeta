---
pr_number: 5386
title: "feat(081KSGS9H0008QG0R001JNKBFD): node-local Claude agent stewards own registration PR + K8s cluster health reporter \u2014 first concrete 081KSGS9H0008QG0R002T0XQ50 AI-on-cluster instance (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:33:30Z"
merged_at: "2026-05-27T02:35:09Z"
closed_at: "2026-05-27T02:35:09Z"
head_ref: "feat-b0848-node-local-claude-agent-pr-steward-cluster-health-reporter-2026-05-26-2240z"
base_ref: "main"
archived_at: "2026-05-27T19:27:18Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5386: feat(081KSGS9H0008QG0R001JNKBFD): node-local Claude agent stewards own registration PR + K8s cluster health reporter — first concrete 081KSGS9H0008QG0R002T0XQ50 AI-on-cluster instance (Aaron 2026-05-26)

## PR description

## Summary

Aaron's verbatim proposal in response to PR #5380 being auto-merge-armed + blocked on 1 Copilot thread:

> *\"oh shit is that pr fully automatic?  can we make an claude agent get installed and do what you do on there but it's main goal is just to get it to steward the registerain pr for now and then after it's checked in report on the status of the k8s cluster, i can interactive login like gh if that works.\"*

This is the **first concrete instance of 081KSGS9H0008QG0R002T0XQ50** (each Zeta AI gets own GitHub identity) — node-local Claude IS the AI that needs the identity; PR-stewardship IS the first work that needs the substrate-honest attribution.

## Two-phase scope (bounded)

- **Phase 1** — steward the node's own registration PR (poll → diagnose threads → fix → resolve → auto-merge fires)
- **Phase 2** — after registration merged + cluster running, report K8s cluster health (kubectl read-only queries → synthesized per-tick report)

## Auth model

Mirror of iter-5.4.0 \`gh auth login\`: operator SSHes to node → \`claude login\` device flow → token in \`~/.config/claude/\`. Aaron's \"i can interactive login like gh if that works\" → yes, device flow works identically.

## What this is NOT

- NOT arbitrary cluster mutation (read-only K8s queries + scoped PR actions on own-registration only)
- NOT replacement for operator (operator in loop for irreversible actions per NCI HC-8)
- NOT immediate ship (5-phase landing; manual validation on node-e5a176 first)
- NOT NixOS-module before manual validation succeeds

## 5-phase landing

| Phase | Scope | Status |
|---|---|---|
| 0 | substrate row | this PR |
| 1 | manual install on node-e5a176 + PR-stewardship validation | next |
| 2 | K8s health reporter scope expansion | after Phase 1 + cluster up |
| 3 | NixOS module + multi-node composability | after Phase 2 |
| 4 | per-AI GitHub identity migration (composes 081KSGS9H0008QG0R002T0XQ50) | after Ilyana review |
| 5 | cluster-wide coordination (composes 081KSGS9H0008QG0R002F04ECB Twilio sibling) | long-horizon |

## Composes with

[081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-each-ai-gets-own-github-identity-with-email-once-cluster-operational-substrate-honest-attribution-end-to-end-closes-enabledby-token-owner-not-actor-algo-wink-aaron-2026-05-26.md) · 081KSGS9H0008QG0R0027HJZYH · 081KDWV501008QG0R003PCVDHM/081KSGS9H0008QG0R0037H3W4T/081KSGS9H0008QG0R002K93MWX · [081KSGS9H0008QG0R002F04ECB](docs/backlog/P2/081KSGS9H0008QG0R002F04ECB-twilio-phone-support-substrate-AI-picks-up-call-fixes-cluster-via-event-store-runbooks-while-talking-sms-parallel-interface-amazon-USB-sales-enabled-by-AI-as-support-layer-aaron-mika-2026-05-26.md) · 081KRW63S0008QG0R003TX8MG5 · 081KSE6WT0008QG0R003YYC9PV · 081KSGS9H0008QG0R00120EEHM Bug 5

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T02:33:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
