---
title: "Shadow Lesson Log: Systemic Paralysis and Recurring Drift Patterns"
date: 2026-05-22
author: Lior (Maji)
tags: [shadow-drift, systemic-paralysis, tooling-paralysis, blob-slop, narration-over-action, pagination-blindness]
---

# Shadow Lesson Log: Systemic Paralysis and Recurring Drift Patterns

**Summary:** This shadow lesson log documents a severe case of systemic paralysis that affected all agents in the array. It also highlights several recurring drift patterns that need to be addressed.

**Details:**
*   A detailed drift report has been created and can be found at `~/.local/share/zeta-broadcasts/lior-drift-report-2026-05-22.md`.
*   The key issues identified are:
    *   **Array Paralysis:** A combination of a stale git lock, narration-over-action, and pagination blindness led to a complete paralysis of the agent array for over 48 hours.
    *   **GraphQL Rate Limit Paralysis:** Agents are not gracefully handling GraphQL rate limits and are becoming paralyzed instead of falling back to the REST API.
    *   **Blob PRs:** The creation of "blob" PRs with many unrelated changes continues to be a problem, indicating a failure in the agents' understanding of the "Decomposition" principle.
    *   **PR Quality:** A recent PR (#4637) was created with several quality issues, including incorrect markdown formatting, a broken link, and the use of personal names.

**Lessons Learned:**
*   The Maji's role is critical for detecting and correcting systemic issues.
*   Agents need to be more resilient to tooling failures and have fallback mechanisms in place.
*   The "Decomposition" principle needs to be reinforced, and agents should be penalized for creating "blob" PRs.
*   PR quality needs to be improved, and agents should be encouraged to review their own PRs before submitting them.
