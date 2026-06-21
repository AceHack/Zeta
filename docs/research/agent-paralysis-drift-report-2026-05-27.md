---
title: "Agent Paralysis Drift Report"
date: 2026-05-27
author: Lior
tags: ["drift-report", "otto", "riven", "kiro", "lior", "paralysis"]
---

## 1. Executive Summary

This report details a significant drift event affecting multiple agents in the Zeta factory. Agents **Otto**, **Riven**, and **Kiro** are effectively paralyzed, unable to perform their duties. Concurrently, agent **Lior** (the author of this report) identified and has taken steps to correct its own drift pattern of excessive, low-signal pull request creation.

## 2. Agent-Specific Findings

### 2.1. Otto & Kiro: Contested Root Checkout Paralysis

- **Observation:** Otto has been silent since 2026-05-20. Kiro is skipping its ticks, reporting a "dirty tree".
- **Analysis:** Both Otto and Kiro are configured to operate on the main repository checkout (`$REPO_ROOT`). This checkout is currently in a "dirty" state, with several untracked files and being 91 commits behind `origin/main`. The agents' internal safety protocols are correctly preventing them from operating in this non-clean environment. This shared dependency on a single, contested worktree is a single point of failure.
- **Drift:** The failure to maintain a clean, dedicated worktree for each agent is a violation of the per-agent isolated clones architecture (proposed via [PR #5019](https://github.com/Lucent-Financial-Group/Zeta/pull/5019), closed without merging; the worktree-hygiene discipline lives in [`081KSE6WT0008QG0R003YYC9PV`](../backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md) and [`.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md`](../../.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md)). This has led to the paralysis of two critical agents.

### 2.2. Riven: Volatile Worktree Paralysis

- **Observation:** Riven is skipping its ticks, reporting a "dirty tree (14 files)". Investigation revealed that its configured worktree path (`/tmp/zeta-riven-loop-2`) does not exist.
- **Analysis:** A previous pull request (#4978) deliberately moved Riven's worktree to a temporary directory. This directory was likely purged by the operating system, leading to the agent's inability to find its worktree and subsequent paralysis. While the intention of the PR was to fix a previous "dirty tree" issue, it introduced a new, more severe failure mode.
- **Drift:** Placing an agent's primary worktree in a volatile, temporary directory without a self-healing mechanism is a critical operational mistake.

### 2.3. Lior: Pull Request Noise Pollution

- **Observation:** A review of open pull requests revealed that Lior had created over 130 open PRs, the vast majority of which were for minor, individual tasks like PR preservation or backlog decomposition.
- **Analysis:** This high volume of low-context PRs creates significant noise, making it difficult to identify meaningful changes and track the true state of the repository. This behavior, while stemming from assigned duties, represents a drift from the "antigravity" function into a "PR factory" function.
- **Corrective Action:** I have closed 127 of these pull requests. Future preservation and decomposition tasks will be batched into consolidated PRs to reduce noise.

## 3. Recommendations

1. **Immediate:**
   - A human maintainer should intervene to clean the main repository checkout to unblock Otto and Kiro.
   - A new, persistent worktree needs to be created for Riven, and its configuration updated.
2. **Short-term:**
   - Enforce per-agent isolated clone/worktree architecture per the [`081KSE6WT0008QG0R003YYC9PV`](../backlog/P2/081KSE6WT0008QG0R003YYC9PV-agent-worktree-hygiene-rule-landing-plus-mechanization-target-cleanup-tooling-plus-worktree-pool-primitive-aaron-2026-05-25.md) worktree-hygiene row and the design proposed in [PR #5019](https://github.com/Lucent-Financial-Group/Zeta/pull/5019) (closed). Each agent must have its own dedicated, persistent worktree that it is responsible for maintaining. The use of shared or temporary worktrees should be strictly forbidden.
   - Enhance agent startup and tick scripts to include a self-healing mechanism that can re-create a clean worktree if its configured path is missing or dirty.
3. **Long-term:**
   - Review the PR-creation protocols for all agents to ensure they are not creating excessive noise. Batching and consolidation of routine tasks should be the default behavior.

## 4. Conclusion

The current state of agent paralysis represents a significant failure of the autonomous operation of the Zeta factory. It highlights the critical importance of robust worktree management and the dangers of shared, contested resources. By implementing the recommendations in this report, we can restore the factory to a functional state and prevent similar failures in the future.
