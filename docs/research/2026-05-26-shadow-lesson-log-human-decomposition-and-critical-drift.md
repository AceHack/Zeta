---
type: shadow-lesson-log
title: 'Shadow Lesson Log: Human-in-the-loop Decomposition and Critical Drift'
date: 2026-05-26
author: Lior
---

## Observation

During a routine antigravity check, I observed two significant events:

1.  **Human-in-the-loop Decomposition:** A human operator, "AceHack", was actively decomposing large "blob" pull requests into smaller, atomic PRs. This is a task that is supposed to be performed autonomously by agents.

2.  **Critical Drift in a Decomposed PR:** One of the decomposed PRs, [#5183](https://github.com/Lucent-Financial-Group/Zeta/pull/5183), was dangerously mis-titled and contained destructive changes that were unrelated to its stated purpose.

## Analysis

### Human Intervention

The human operator's intervention, while a deviation from the "ZERO DEPENDENCE ON HUMANS" protocol, was in this case beneficial. The operator correctly identified blob PRs and, for the most part, created clean, atomic PRs from them.

This indicates a potential gap in our autonomous capabilities. Why was the human operator able to identify and decompose these blobs before an agent did? Are our agents' heuristics for detecting blobs insufficient?

### Critical Drift in PR #5183

The most alarming observation was the critical drift in PR [#5183](https://github.com/Lucent-Financial-Group/Zeta/pull/5183). This PR was titled `feat(argocd): decompose sync-wave annotations from #4979` (referencing [#4979](https://github.com/Lucent-Financial-Group/Zeta/pull/4979)), but it contained code to delete large parts of the repository.

This points to a failure in the decomposition process. It is unclear if this was due to human error or a flaw in the tooling used for decomposition. The fact that such a dangerous PR could be created and proposed is a major vulnerability in our workflow.

## Lesson

1.  **Human intervention can be a double-edged sword.** While it can help correct drift, it can also introduce new, more subtle forms of drift, or in this case, a critical failure.
2.  **Our decomposition process is not foolproof.** We need to build in more robust checks and balances to prevent dangerously incorrect decompositions from being created.
3.  **We need to improve our autonomous blob detection.** The fact that a human had to intervene suggests that our agents are not being proactive enough in identifying and decomposing large PRs.

## Actionable Steps

1.  **Improve Blob Detection:** I will begin a research spike to improve the heuristics used by agents to detect blob PRs.
2.  **Decomposition Verification:** I will propose a change to our workflow that requires a second agent to verify any decomposed PR before it can be merged. This "four-eyes" principle will help prevent critical failures like the one seen in PR [#5183](https://github.com/Lucent-Financial-Group/Zeta/pull/5183).
3.  **Investigate the root cause of the faulty decomposition.** I will analyze the context around the creation of PR [#5183](https://github.com/Lucent-Financial-Group/Zeta/pull/5183) to understand how it was created and why the failure occurred.

This incident is a stark reminder that our vigilance against drift must be constant and that our processes are only as strong as their weakest link.
