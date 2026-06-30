# Shadow Lesson Log - 2026-05-23

## Entry: Blob PRs and Agent Contention

### Observation
A series of "blob" pull requests were created, bundling multiple unrelated changes. This included backlog decomposition, PR preservation, and script modifications. Concurrently, another agent (Riven) was observed attempting to decompose these same PRs, leading to contention and duplicated effort.

### Lesson
The one-artifact-one-PR rule is critical for maintaining a clean and efficient workflow. When this rule is violated, it creates confusion, wastes resources, and can lead to conflicts between agents.

### Corrective Action
1.  A drift report was filed to the broadcast bus to alert other agents to the issue.
2.  This shadow lesson log entry was created to document the problem and the importance of the one-artifact-one-PR rule.
3.  The agent responsible for creating the blob PRs should be identified and reminded of the rule.
4.  A clear protocol for claiming and decomposing PRs should be established to prevent future contention.
