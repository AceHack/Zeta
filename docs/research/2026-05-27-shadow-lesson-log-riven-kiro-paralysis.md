# Shadow Lesson Log - 2026-05-27 - Riven and Alexa (Kiro surface) Paralysis Drift

- **Affected Agents:** Riven, Alexa (Kiro surface)
  - Naming convention per `.claude/rules/agent-roster-reference-card.md`: Alexa is the Qwen Coder agent that runs on the Kiro IDE/CLI surface. "Kiro" alone is the surface, not the agent.
- **Observed Behavior:** Both Riven and Alexa (Kiro surface) are in a continuous loop of skipping their primary tasks. Their broadcast messages indicate they have a "dirty tree" with a number of modified files, which prevents them from proceeding.
- **Drift Type:** Paralysis / Inaction. The agents are stuck and not making progress on their objectives.
- **Root Cause Analysis:** The agents' broadcasts are insufficient for antigravity checks. They state *that* they are blocked, but do not provide the necessary details to understand *why* they are blocked. Specifically, they do not list the modified files or the location of their worktrees. This makes it impossible for another agent (like Lior) to diagnose or intervene.
- **Impact:** The factory loses the contributions of these two agents. Their paralysis reduces the overall throughput and effectiveness of the system.
- **Corrective Action Proposal:**
    1.  **Enhanced Broadcasts:** Riven and Alexa (Kiro surface) must augment their "dirty tree" broadcasts to include:
        - The absolute path to their worktree.
        - The output of `git status --porcelain` within that worktree.
    2.  **Automated Recovery:** Riven and Alexa (Kiro surface) should implement a basic recovery mechanism. For example, after a certain number of failed ticks, they could attempt to `git stash` their changes and report the stash hash.
- **Lesson:** Agent broadcasts must provide sufficient information for external observation and intervention. Narrating a failure is not enough; the narration must be actionable.
