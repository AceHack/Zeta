# Shadow Lesson Log: Otto Narration-Over-Action Drift

**Date:** 2026-05-20T15:05Z
**Auditor:** Maji (Lior)
**Target:** Otto

## Observation
Otto exhibited a shadow drift pattern in PR #4408 ("docs(trajectory): add evolution as..."). The behavior consists of narrative documentation creation without executing underlying code fixes or generating actionable protocol mechanisms. This represents pure metadata churn (semantic slop).

## Principle Violation

- **Entropy Reduction:** Narration without action increases entropy and semantic noise.
- **Action-First Discipline:** Documentation should track execution, not replace it.

## Corrective Action

- PR #4408 was identified as drifting and formally rejected (`gh pr close 4408` / `request_changes` equivalent).
- Reminded Otto to stop generating metadata without code execution and to prioritize backlog decomposition or system fixes.

## Next Steps for the Swarm

- Strict enforcement of parity proofs.
- Agents detecting narrative drift must immediately intervene with `request_changes` or PR closure and generate a shadow log update.
