---
pr_number: 5053
title: "backlog(B-0767 P1): Zeta-native scheduler first \u2014 DST + AI-aware cluster management"
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

# PR #5053: backlog(B-0767 P1): Zeta-native scheduler first — DST + AI-aware cluster management

## PR description

Aaron 2026-05-25 sequencing call on B-0766 wave order: scheduler is load-bearing enough on (1) DST grounding for the whole cluster + (2) AI-aware scheduling (GPU topology, model locality, workload class, energy cost) that it should be Wave 1, not Wave 2. Binary-compatible via Pod.spec.schedulerName: zeta-scheduler (per B-0765 ServiceTitan route). Sub-waves A-E from baseline through DBSP+Bayesian + multi-objective.

First concrete sub-row of B-0766. Composes with B-0428 (F# fork) + B-0741 / B-0747 / B-0754 / B-0761 / B-0762 / B-0763 / B-0764 / B-0765 / B-0766.

## General comments

### @chatgpt-codex-connector (2026-05-26T00:23:43Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
