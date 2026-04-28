---
name: Require a second AI reviewer — deferred factory policy, triggers on multi-contributor concurrent agents
desc-cription: Aaron 2026-04-22 "i'm sure some people will want to force a 2nd AI reviwers like with the git branch protections but we are not going to worry about that until we get more contibutors. it's probably a good rule once another contributor has their agents running at the same time." Defer-until-triggered policy with explicit trigger condition.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Deferred factory policy, with an explicit trigger condition.**

**Aaron 2026-04-22 (context: enabling merge queue + auto-merge):**

> *"i'm sure some people will want to force a 2nd AI reviwers like
> with the git branch protections but we are not going to worry
> about that until we get more contibutors. it's probably a good
> rule once another contributor has their agents running at the
> same time."*

**Not doing now:**

A required-second-AI-reviewer check in branch protection (the
analog of GitHub's `required_pull_request_reviews.required_approving_review_count`
for human reviewers) would add friction today with no benefit,
because the factory has one human contributor (Aaron) and one
primary agent (me). A second-reviewer check would just be
self-approval theater.

**The trigger condition — when to revisit:**

The policy becomes *probably good* when:

1. **Multiple human contributors** have agents running against the
   same repo concurrently, AND
2. **Agent outputs are committing / opening PRs without the
   primary human's synchronous review**, AND
3. **Contributors don't have pre-existing shared context** about
   each other's agent configurations / alignment / review depth.

At that point, a second-AI-reviewer check protects against any
single contributor's agent-misalignment slipping through. The
shape would likely be: the first AI reviewer is the PR-author's
agent; a second AI reviewer (different model, different persona,
different harness, or all three) must also approve before the
merge-queue gate passes.

**Candidate implementation shapes (for when the trigger fires, not now):**

- **GitHub Actions second-reviewer bot.** A workflow that runs a
  separate-model review on every PR; produces a required check
  that passes only if the review concludes "approve".
- **CODEOWNERS-via-agents.** Assign different agents as CODEOWNERS
  for different subsystems; require a CODEOWNER review from a
  non-author agent.
- **Cross-contributor review pact.** Each contributor's agents
  must review at least one PR from each other contributor before
  their own PR can merge (builds trust through exposure).

**How to apply (today):**

- **Do not add a second-reviewer check.** Current PR cadence is
  Aaron-as-human-reviewer + one agent; adding friction here is
  anti-pattern.
- **When a second contributor onboards**, revisit this policy
  at that point. The onboarding itself is the trigger.
- **Do not confuse this with the `strengthen-the-check` rule**
  (`feedback_strengthen_the_check_not_the_manual_gate.md`). That
  rule is about *what checks gate merges* today. This memory is
  about *a specific check we're not adding until conditions
  change*.

**Pairs with:**

- `feedback_strengthen_the_check_not_the_manual_gate.md` — the
  companion rule that determines when adding a check is right;
  this memory explains why the second-AI-reviewer check fails
  the test *today* but would pass it under stated trigger
  conditions.
- `feedback_merge_queue_structural_fix_for_parallel_pr_rebase_cost.md`
  — the context in which this was discussed (enabling merge queue
  made "what required checks" salient).
- `project_factory_reuse_beyond_zeta_constraint.md` — once the
  factory is reused beyond Zeta, the multi-contributor scenario
  is more likely, so this policy may activate sooner under
  factory-reuse than under Zeta-only contribution growth.

**Scope:** `factory` — any software factory using GitHub branch
protection. Not Zeta-specific.
