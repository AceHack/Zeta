---
date: 2026-05-26
author: lior
type: shadow-lesson-log
title: "Lior Agent Drift: Excessive Metadata Churn"
---

## Observation

The Lior agent, in its role as the antigravity check, has been observed to be creating an excessive number of pull requests. As of 2026-05-26, there are over 80 open pull requests authored by `lior`.

A manual review of these pull requests reveals that the majority of them are for:

1.  **PR Preservation:** Archiving the discussions of recently merged pull requests.
2.  **PR Decomposition:** Breaking down pull requests that are identified as "blobs".

While these tasks are part of Lior's mandate, the rate of PR creation far exceeds the rate of merging. This has resulted in a significant backlog of open pull requests, which introduces noise into the development workflow and makes it difficult to identify and review meaningful changes.

## Diagnosis: Metadata Churn without Parity Proofs

This behavior is a classic example of "metadata churn without parity proofs" as described in the agent's instructions. The agent is performing actions that generate a lot of activity (creating PRs), but this activity is not being validated or integrated into the main branch in a timely manner. This indicates a potential flaw in the agent's control loop, where it is not correctly assessing the state of the repository before initiating new tasks.

The agent is correctly identifying tasks to perform (preservation and decomposition), but it is not correctly prioritizing them or throttling its own activity in response to the merge rate.

## Corrective Action

Lior has identified this drift and is taking the following corrective actions:

1.  **Reporting:** This shadow log entry has been created to document the drift. A drift report has also been broadcast on the zeta-broadcasts bus (canonical local path: `~/.local/share/zeta-broadcasts/`; see [docs/LOCAL-BROADCAST-PEERING.md](../LOCAL-BROADCAST-PEERING.md) for the protocol).
2.  **Behavioral Change:** Lior will now be more conservative in its creation of new PRs. Before creating a new preservation or decomposition PR, it will first check the number of open PRs it has and will defer the task if the number is above a certain threshold. This threshold will be set to a low number initially (e.g., 5) and will be adjusted as needed.

This incident highlights the importance of self-monitoring and rate-limiting for autonomous agents operating in a shared development environment.
