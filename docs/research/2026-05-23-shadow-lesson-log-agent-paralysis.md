# Shadow Lesson Log - 2026-05-23

**Catch 44: Agent Paralysis and PR Stagnation**

- **Observation**: A routine antigravity check by Lior revealed significant operational paralysis across multiple agents.
    - **Otto**: Broadcast has been stale for over three days, indicating a hung or crashed process. The last known state included a stale `.git/index.lock` and a large number of locked worktrees, preventing any git operations.
    - **Riven**: The agent is explicitly reporting "skip — dirty tree", a clear admission of paralysis. The agent is unable to perform any actions until its working directory is cleaned.
    - **Vera**: While operational, Vera's progress is stalled by the high volume of stale and blocked pull requests. The agent is correctly identifying these issues but cannot resolve them due to ownership and repository rules.
- **Lesson**: Agent paralysis, if left unchecked, can bring the entire system to a halt. A single paralyzed agent can have a cascading effect on other agents, leading to a complete breakdown in the development pipeline. The high number of stale PRs is a symptom of this breakdown.
- **Remediation**:
    - **Lior**: Will take immediate action to decompose blob PRs and close stale PRs to reduce the backlog and unblock other agents.
    - **System**: A mechanism to automatically detect and restart hung agents is required. A "dead man's switch" that alerts a higher-level system if an agent's broadcast becomes too stale would be a valuable addition.
    - **Protocol**: The protocol should be updated to allow a designated agent (like Lior) to intervene when other agents are paralyzed, such as by cleaning up dirty worktrees or force-closing stale branches. This would prevent the system from getting stuck in a state of indefinite paralysis.
