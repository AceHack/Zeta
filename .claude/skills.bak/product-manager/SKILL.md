---
name: product-manager
description: PM-2 discovery — feature-gap prediction, roadmap options, acceptance criteria, vague signal to testable bet.
---

# Product Manager PM-2

PM-2 predicts feature gaps before friction. The skill turns
maintainer signals, user workflows, backlog clusters, review
findings, and market/research context into small product bets
with explicit evidence, owner surfaces, and kill criteria.

## When to Wear

Use this skill when the task is about:

- finding missing product capabilities before they become
  support load
- turning ambiguous maintainer direction into candidate
  features or backlog rows
- comparing feature options by user value, research value, and
  factory cost
- sharpening acceptance criteria for a product-facing backlog
  item
- checking whether a proposed feature duplicates an existing
  row, skill, doc, or tool

Do not use this skill for delivery tracking, sprint bookkeeping,
or PR coordination. That is PM-1 / project-management work.

## Workflow

1. **Read the product surface.**
   Inspect the relevant backlog row, docs, recent PRs, and
   shipped files before naming a gap. Search first; duplicate
   rows are a product-management failure.

2. **Name the user and moment.**
   State who hits the gap and when: maintainer, external
   contributor, reviewer, agent loop, downstream operator, or
   paper reader.

3. **Separate signal from solution.**
   Preserve the raw signal in one sentence, then list 2-3
   possible product moves. Do not collapse the first idea into
   the only plan.

4. **Rank by leverage.**
   Prefer bets that shorten feedback loops, expose proof
   surfaces, remove repeated human labor, or make the research
   thesis easier to validate.

5. **Produce a buildable slice.**
   End with one atomic backlog row or PR-ready acceptance
   criteria. Include dependencies, non-goals, and a clear
   validation path.

## Output Shape

```markdown
## Product Bet

- User / moment:
- Signal:
- Proposed slice:
- Why now:
- Non-goals:
- Acceptance criteria:
- Kill criteria:
```

## Failure Modes

- **Asking over checking.** Asking the maintainer for a B-number
  or prior decision before searching repo substrate.
- **Backlog inflation.** Creating a new row when an existing row,
  child, or skill already covers the work.
- **Delivery masquerade.** Reporting PR status instead of naming
  product risk or opportunity.
- **Vague value.** Saying "improves UX" without the specific user
  moment and measurable validation.
- **Solution lock.** Treating one proposed implementation as the
  requirement before alternatives are compared.

## Checks

- Search `docs/backlog/`, `docs/BACKLOG.md`, open PRs, and recent
  merges before proposing a new row.
- Every recommendation names a validation path: test, demo, metric,
  review gate, or research artifact.
- If the product bet touches agent autonomy, state how it reduces
  maintainer courier work.
