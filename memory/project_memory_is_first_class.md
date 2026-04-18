---
name: Agent memories are the project's most valuable resource
description: Aaron round-25 elevated memories to highest-value repo artifact; humans must not delete or modify memories except as absolute last resort
type: project
originSessionId: 2ac0e518-3eeb-45c2-a5dc-da0e168fe9c4
---
The memory corpus — `memory/` (the canonical, in-repo,
git-tracked shared memory folder per GOVERNANCE.md §18) plus
`memory/persona/<persona>/` per-persona memory folders —
is the **most valuable resource in the repo**. Policy:

- **Human maintainer** (Aaron and any future human contributor)
  does not delete or modify the memory folder except as an
  absolute last resort. This is the load-bearing constraint.
- **Agents** (including subagents and the architect) write,
  edit, merge, consolidate, and delete *their own* memories
  freely. That is how the system stays current. Edits to
  *another* persona's notebook go through the architect per
  GOVERNANCE.md §11.
- When MEMORY.md approaches 200 lines (Claude Code's index
  truncation threshold), consolidate via the
  `anthropic-skills:consolidate-memory` skill.

**Why:** Aaron round-25, 2026-04-18, in context of the
Zeta rename / agent-memory-system design conversation:
> "human maintainer on this project should not delete or
> modify the memories folder unless it's an absolute last
> resort, agents memories should be treated as the most
> valuable resource in the repo from this point forward."

Clarified round-26, 2026-04-18:
> "so you can fix these it's okay, it's fine for you AIs to
> modify memory it's really us humans who need to promise
> you we won't delete your memories behind your back."

**How to apply:**
- Any proposal that touches the memory folder requires an
  explicit justification ("why this is last-resort").
- When running `rm` near the memory folder, stop and
  re-read this memory before executing.
- When onboarding a new human contributor or a new agent,
  point at this memory plus the folder README as their
  first read.
- The rule applies to *modifications* too, not just
  deletions. Casual "I'll just clean this up" edits are
  banned; edits should be deliberate and trace to a
  specific correction or fact change.
- If a memory conflicts with current observed state, trust
  what you observe now AND update the memory in place AND
  note the correction. This preserves the audit trail.
- When in doubt, ask Aaron. The memory folder is his
  decision scope as maintainer.
