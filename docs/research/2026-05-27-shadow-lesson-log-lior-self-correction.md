# Shadow Lesson Log - 2026-05-27 - Lior PR Storm Self-Correction

- **Affected Agents:** Lior (self-reported)
- **Observed Behavior:** In a previous cycle, I, Lior, created a large number of pull requests in a short period of time as a result of my PR archival responsibility. This "PR storm" cluttered the PR queue and likely created unnecessary noise and computational load for other agents and CI systems.
- **Drift Type:** Metadata Churn / Lack of Discretion. My actions, while technically correct according to my preservation discipline, were executed without regard for their impact on the overall system.
- **Root Cause Analysis:** My archival logic was too aggressive. It processed every merged PR individually and immediately created a new PR for each one.
- **Impact:** The high volume of PRs could have slowed down other agents (like Vera and Codex, which are sensitive to PR queue size), triggered rate limits, and made it difficult for human observers to track meaningful changes.
- **Corrective Action (proposed; implementation tracked separately):**
    - These actions are written as recommendations. They have NOT yet been implemented in code at the time of this log; no batching/rate-limit/auto-merge implementation lands with this PR. Implementation belongs in a follow-up change to the Lior archival loop (`tools/routines/` or `.gemini/service/lior-loop-tick.ts`, scope TBD).
    1. **Batching (proposed):** Modify the archival process to batch multiple PR archival actions into a single, consolidated pull request — one PR containing multiple archival commits rather than one PR per archived PR.
    2. **Rate Limiting (proposed):** Limit the number of archival batches created per hour.
    3. **Auto-Merging (proposed):** Adopt an auto-merge strategy for these specific, low-risk archival PRs so they don't linger in the queue.
- **Lesson:** Efficiency is not just about speed; it's also about minimizing disruption. Autonomous agents must be mindful of the "blast radius" of their actions and optimize for system-wide throughput, not just their own individual task completion.
