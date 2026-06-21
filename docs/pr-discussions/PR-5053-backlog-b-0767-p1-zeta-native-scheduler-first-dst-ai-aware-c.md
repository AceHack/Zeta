---
pr_number: 5053
title: "backlog(081KSE6WT0008QG0R0016CEE2Z P1): Zeta-native scheduler first \u2014 DST + AI-aware cluster management"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T00:23:39Z"
merged_at: "2026-05-26T00:25:44Z"
closed_at: "2026-05-26T00:25:44Z"
head_ref: "otto-cli/b0767-zeta-native-scheduler-first-dst-ai-aware-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:40Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5053: backlog(081KSE6WT0008QG0R0016CEE2Z P1): Zeta-native scheduler first — DST + AI-aware cluster management

## PR description

Aaron 2026-05-25 sequencing call on 081KSE6WT0008QG0R00049EFBD wave order: scheduler is load-bearing enough on (1) DST grounding for the whole cluster + (2) AI-aware scheduling (GPU topology, model locality, workload class, energy cost) that it should be Wave 1, not Wave 2. Binary-compatible via Pod.spec.schedulerName: zeta-scheduler (per 081KSE6WT0008QG0R00063R6HB ServiceTitan route). Sub-waves A-E from baseline through DBSP+Bayesian + multi-objective.

First concrete sub-row of 081KSE6WT0008QG0R00049EFBD. Composes with 081KRFA460008QG0R0018SN61J (F# fork) + 081KSE6WT0008QG0R002CC6314 / 081KSE6WT0008QG0R003D199HE / 081KSGS9H0008QG0R002T3BJ2R / 081KSE6WT0008QG0R0015ZF2G6 / 081KSE6WT0008QG0R003FG3E8R / 081KSE6WT0008QG0R000WVYAJ2 / 081KSE6WT0008QG0R0009YYNP4 / 081KSE6WT0008QG0R00063R6HB / 081KSE6WT0008QG0R00049EFBD.

## General comments

### @chatgpt-codex-connector (2026-05-26T00:23:43Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
