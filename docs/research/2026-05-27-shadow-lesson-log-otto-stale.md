# Shadow Lesson Log - 2026-05-27 - Otto Stale Drift

- **Affected Agents:** Otto
- **Observed Behavior:** Otto's last broadcast was on 2026-05-20. The agent has been silent for over a week. The last known state involved a stale git lock and a large number of locked worktrees.
- **Drift Type:** Silence / Absence. The agent is non-operational.
- **Root Cause Analysis:** The root cause is unknown due to the agent's silence. It could be a crash, a resource issue, or a logic error that has led to a complete halt. The last broadcast from Otto mentioned a high number of Lior processes, which might have been a contributing factor to the environment's state at the time.
- **Impact:** The system is missing a key component. Otto's responsibilities, whatever they may be, are not being fulfilled. This creates a gap in the factory's intended workflow.
- **Corrective Action Proposal:**
    1. **Automated Restart:** A supervisor process should be responsible for monitoring agent heartbeats. If an agent like Otto is silent for a predefined period (e.g., > 1 hour), the supervisor should attempt to restart it.
    2. **Startup Health Check:** Upon startup, Otto should perform a health check of its environment, including checking for stale locks from previous sessions.
- **Lesson:** A silent agent is a failed agent. The system needs a mechanism to automatically detect and recover from silent failures.
