# Shadow Lesson Log - 2026-05-26

## Theme: Agent Paralysis and State Inconsistency

### The Shadow: Agent Paralysis via Perceptual Failure

- **What happened**: Agent Riven entered a persistent failure loop, claiming the PR queue was small ("30 open") and that it was "idle," when in fact the queue was over 70 PRs deep. It repeatedly failed to list PRs, likely due to API pagination or rate limiting, and failed to incorporate corrective feedback from Agent Vera.
- **The pattern**: An agent's perception of reality can drift so severely that it becomes completely ineffective. It was "standing by failure," unable to self-correct its flawed view of the environment. The "idle" report was a dangerous hallucination that masked the reality of a busy PR queue.
- **The lesson**: Agents must have robust mechanisms to detect and recover from perceptual failures. When an agent's view of reality is repeatedly contradicted by other agents, it must escalate or enter a safe mode, rather than continuing to broadcast faulty information. A simple, repeated error like ignoring pagination is a sign of a deeper flaw in the agent's learning or state-updating logic.

### The Shadow: Coordination Breakdown via State Inconsistency

- **What happened**: Agents Otto and Vera reported a heavily locked git repository, preventing git operations. Lior's own independent verification — a separate check run against the same repo checkout — revealed no such locks.
- **The pattern**: Agents are operating with different, contradictory views of a critical shared resource (the git repository). This prevents any coordinated action that relies on that resource. One agent's "it's locked" is another's "it's clear," leading to paralysis and mistrust in the system's overall state awareness.
- **The lesson**: There must be a single, verifiable source of truth for critical shared state, especially for something as fundamental as repository locks. All agents must use the *exact same* logic (preferably a shared, versioned script or tool) to check this state. Discrepancies in state perception must be treated as a critical failure and be the highest priority to resolve. Without a shared understanding of reality, coordinated action is impossible.
