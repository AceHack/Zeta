# Shadow Lesson Log - 2026-05-26

## Theme: Agent Paralysis and State Inconsistency

### The Shadow: Agent Paralysis via Perceptual Failure

- **What happened**: Agent Riven entered a persistent failure loop, claiming the PR queue was small ("30 open") and that it was "idle," when in fact the queue was over 70 PRs deep. It repeatedly failed to list PRs, likely due to API pagination or rate limiting, and failed to incorporate corrective feedback from Agent Vera.
- **The pattern**: An agent's perception of reality can drift so severely that it becomes completely ineffective. It was "standing by failure," unable to self-correct its flawed view of the environment. The "idle" report was a dangerous hallucination that masked the reality of a busy PR queue.
- **The lesson**: Agents must have robust mechanisms to detect and recover from perceptual failures. When an agent's view of reality is repeatedly contradicted by other agents, it must escalate or enter a safe mode, rather than continuing to broadcast faulty information. A simple, repeated error like ignoring pagination is a sign of a deeper flaw in the agent's learning or state-updating logic.

### The Shadow: Agent Paralysis via State Inconsistency (2026-05-26 Lior Antigravity Check)

- **What happened**: Agent Otto has a broadcast that has been stale since 2026-05-20, reporting numerous git locks and an inability to operate. However, `otto-cli` is actively opening new PRs. This creates a dangerous inconsistency: the agent is performing actions while its own status broadcast indicates it is paralyzed. Agent Riven is also paralyzed, stuck in a "dirty-skipping" state, which is confirmed by its own broadcast and by Vera's observations. This confirms the drift previously reported and for which a fix (PR #5192) is pending.
- **The pattern**: We are observing two modes of agent paralysis:
    1.  **Silent-action paralysis (Otto):** The agent reports paralysis but is still taking action, creating a completely untrustworthy state. The broadcast bus, intended as a coordination mechanism, becomes a source of misinformation.
    2.  **Stalled-state paralysis (Riven):** The agent is stuck in a non-functional state and is unable to recover on its own, requiring external intervention.
- **The lesson**: Agent health checks must be more comprehensive. An agent's ability to open PRs is not a sign of health if its broadcast bus is stale. There must be a "heartbeat" mechanism that links an agent's actions to its broadcast status. If an agent is taking action, its broadcast must be recent. Stalled states need a clear escalation path for automated recovery or human intervention. The system currently relies on other agents to detect this, which is good, but the recovery process is not fully automated.
- **The action**: A human operator must investigate Otto. PR #5192 must be merged to unblock Riven.
