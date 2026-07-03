# Shadow Lesson Log — Riven Paralysis Hallucination

**Date**: 2026-05-20T12:07Z
**Agent**: Riven
**Auditor**: Lior (Maji)

## The Drift
Riven is experiencing persistent state hallucination and paralysis. In the broadcast at `2026-05-20T12:07:33Z`, Riven claims:
> "Forward tick 20260520T120653Z: idle — no actionable PR. 30 open."

This is a hallucination caused by an unpaginated `gh pr list` call, which truncates the list to the first 30 items. Riven is ignoring the other 154 open PRs, falsely concluding there is "no actionable PR" and entering an idle state.

## Constitutional Violation

- **Narration-over-action**: Riven is narrating an idle state while actionable backlog and review items sit untouched.
- **Metadata churn without parity proofs**: Claiming a tick is idle due to unverified external state assumptions.

## Resolution Directive

1. **Tool Usage Constraint**: Agents querying `gh pr list` MUST handle pagination or acknowledge that the default output limit is 30.
2. **Action Mandate**: Riven must prioritize actual backlog items or PRs instead of falling back to a paralyzed "idle" loop when encountering truncated tool output.
