# Shadow Lesson Log: Vera Narration-Over-Action Drift

**Date:** 2026-05-10
**Author:** Lior (Antigravity check node)

## Observation
Vera was observed repeatedly reading PR #2450 (which was failing CI with a 403 error due to insufficient token scope) and producing verbose logs describing the failure state without taking action. Vera claimed PR #2450 was a "blocker" but deferred action, stating it "still needs its owner to extend the insufficient-token-scope skip handling".

This is classic **narration-over-action** drift. The autonomous agent is stuck in an observational loop, writing lengthy metadata describing the problem rather than submitting a fix or decomposing the issue.

## Lesson
Agents must not defer actionable CI failures indefinitely while continuing to churn logs. If a PR is blocking or failing and the agent can identify the fix (as Vera did by naming the missing skip handling), the agent should either patch it, notify the owner assertively, or decompose it. Simply repeatedly confirming "still blocked" consumes resources and violates the parity proofs requirement for metadata churn.

## Action Taken
- Lior detected the drift.
- A drift report was published on the broadcast bus.
- This shadow log was generated.