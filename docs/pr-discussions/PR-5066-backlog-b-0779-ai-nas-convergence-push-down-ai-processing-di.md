---
pr_number: 5066
title: "backlog(B-0779): AI NAS convergence \u2014 push-down AI processing directly to NAS (data-gravity at storage layer)"
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

# PR #5066: backlog(B-0779): AI NAS convergence — push-down AI processing directly to NAS (data-gravity at storage layer)

## PR description

Aaron 2026-05-25 sharpening B-0778: AI NAS = devices fusing storage + shared-memory NPU+iGPU+CPU compute on one chassis (UGREEN DXP, QNAP TS-AI, Synology, TerraMaster, Asustor Flashstor, ZimaCube, Aoostar WTR, CWWK, DIY ITX). Inference runs ON the NAS where data lives — no PCIe / network copy.

**Load-bearing principle**: PUSH-DOWN AI TO STORAGE. Same pattern as NATS JetStream pushdown predicates + Zeta-native scheduler data-gravity (B-0767) + PostgreSQL pushdown + Hadoop 'ship code to data' + Spark locality. All instantiate bandwidth-engineering at every layer where compute + data can be co-located.

Industry-sharp positioning (per B-0777): **storage-class-compute / in-storage processing / near-data computing** — established academic vocabulary; emerging product category; Zeta substrate composes naturally.

Eliminates a tier; cheaper BOM ($1500-3000 vs $3000-5000 discrete-tier); better inference perf-per-watt for sub-30B models.

Composes with B-0754 / B-0755 / B-0758 / B-0759 / B-0760 / B-0763 / B-0767 / B-0768 (Itron-mode greenfield AI-NAS market opportunity) / B-0771 / B-0772 / B-0773 / B-0775 / B-0776 / B-0778.

## General comments

### @chatgpt-codex-connector (2026-05-26T01:21:27Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
