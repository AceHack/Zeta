---
pr_number: 5066
title: "backlog(081KSE6WT0008QG0R003X967A0): AI NAS convergence \u2014 push-down AI processing directly to NAS (data-gravity at storage layer)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T01:21:23Z"
merged_at: "2026-05-26T01:22:53Z"
closed_at: "2026-05-26T01:22:53Z"
head_ref: "otto-cli/b0779-ai-nas-convergence-pushdown-ai-to-storage-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:35Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5066: backlog(081KSE6WT0008QG0R003X967A0): AI NAS convergence — push-down AI processing directly to NAS (data-gravity at storage layer)

## PR description

Aaron 2026-05-25 sharpening 081KSE6WT0008QG0R0004AP0ZA: AI NAS = devices fusing storage + shared-memory NPU+iGPU+CPU compute on one chassis (UGREEN DXP, QNAP TS-AI, Synology, TerraMaster, Asustor Flashstor, ZimaCube, Aoostar WTR, CWWK, DIY ITX). Inference runs ON the NAS where data lives — no PCIe / network copy.

**Load-bearing principle**: PUSH-DOWN AI TO STORAGE. Same pattern as NATS JetStream pushdown predicates + Zeta-native scheduler data-gravity (081KSE6WT0008QG0R0016CEE2Z) + PostgreSQL pushdown + Hadoop 'ship code to data' + Spark locality. All instantiate bandwidth-engineering at every layer where compute + data can be co-located.

Industry-sharp positioning (per 081KSE6WT0008QG0R000JSJ3SR): **storage-class-compute / in-storage processing / near-data computing** — established academic vocabulary; emerging product category; Zeta substrate composes naturally.

Eliminates a tier; cheaper BOM ($1500-3000 vs $3000-5000 discrete-tier); better inference perf-per-watt for sub-30B models.

Composes with 081KSGS9H0008QG0R002T3BJ2R / 081KSE6WT0008QG0R003612WGJ / 081KSE6WT0008QG0R00021PPX1 / 081KSE6WT0008QG0R003G0Y62D / 081KSE6WT0008QG0R003WG0V6P / 081KSE6WT0008QG0R000WVYAJ2 / 081KSE6WT0008QG0R0016CEE2Z / 081KSE6WT0008QG0R0004ZPPRP (Itron-mode greenfield AI-NAS market opportunity) / 081KSE6WT0008QG0R0022D6GN8 / 081KSE6WT0008QG0R003WMG4XV / 081KSE6WT0008QG0R0008483B2 / 081KSE6WT0008QG0R000QXSG91 / 081KSE6WT0008QG0R002275NDE / 081KSE6WT0008QG0R0004AP0ZA.

## General comments

### @chatgpt-codex-connector (2026-05-26T01:21:27Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
