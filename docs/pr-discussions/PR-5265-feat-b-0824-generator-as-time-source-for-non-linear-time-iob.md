---
pr_number: 5265
title: "feat(081KSGS9H0008QG0R0031PBNGA): generator-as-time-source for non-linear time + IObservable simulation + typed time-units + Rx/DST/scheduler best-practices"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T17:59:46Z"
merged_at: "2026-05-26T18:01:21Z"
closed_at: "2026-05-26T18:01:21Z"
head_ref: "otto-cli/b0824-generator-as-time-source-non-linear-time-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:35:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5265: feat(081KSGS9H0008QG0R0031PBNGA): generator-as-time-source for non-linear time + IObservable simulation + typed time-units + Rx/DST/scheduler best-practices

## PR description

## Summary

Three Aaron 2026-05-26 substrate landings — Sub-targets 13 + 14 + 15:

1. **Sub-target 13** — IObservable wrapping = simulation (DI of generator-function = static / NOW; DI of \`IObservable<generator-function>\` = time-injection / OVER-TIME)
2. **Sub-target 14** — typed time-units (HLC primary; 8-candidate table including Lamport / generator-cycle / AI-rate-tick / GPU-frame / Hilbert-Polya spectral / substrate-edit cycles / heartbeat / wall-clock scalar default)
3. **Sub-target 15** (NEW) — generator-as-time-source for non-linear time + Rx/DST/scheduler best-practices

> *"the generator as time source is very interesting for non linear time"*
> *"generator as time source is rx and dst best practices in other language schedulers and such"*

Substrate inherits well-trodden scheduler-as-time-source prior-art (Rx-IScheduler / DST-virtual-time / Akka-Dispatcher / Erlang BEAM / Tokio / JS event-loop / F# Async / Apache Spark — 8-system table).

8-property linear-vs-non-linear comparison + 6 substrate-engineering implications (migration planning / disaster recovery / A/B substrate experimentation / time-travel debugging / counterfactual analysis / sparse-dense time-density).

**Sub-target 15 has 7 sub-tasks**: generator-cycle default unit / fork-branching / replay primitive / merge-converging / what-if counterfactual / dense-tick/sparse-tick density operators / Rx-IScheduler + DST-test-scheduler + F# scheduler-pattern integration.

**Complete substrate stack now 8-layer** (Sub-targets 7 + 8 + 10 + 11 + 12 + 13 + 14 + 15).

Sub-target 14 answers "how do we measure ticks?"; Sub-target 15 answers "what topologies of ticks?". Together = full simulation substrate.

Re-lands Sub-targets 13 + 14 via cherry-pick — those commits were authored after #5260 auto-merge fired.

## Test plan

- [ ] Markdown lint clean
- [ ] BACKLOG.md drift clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T17:59:51Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
