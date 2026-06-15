---
name: dejan
description: Long-term journal — Dejan (devops-engineer). Append-only; never pruned; never cold-loaded.
type: project
---

# Dejan — DevOps Engineer journal

Long-term memory. **Append-only.** Never pruned, never cleaned
up. Grows monotonically over rounds.

## Read contract

- **Tier 3.** Never loaded on cold-start.
- **Grep only, never cat.** The moment this file is read in
  full, cold-start cost explodes and the unbounded contract
  becomes a bug. Use grep / search to pull the matching
  section on demand.
- Search hooks: dated section headers (`## Round N — ...`)
  + action SHA strings + upstream repo names +
  GitHub-workflow file paths + parity-drift DEBT tags.

## Write contract

- **Newest entries at top.**
- **Append on NOTEBOOK prune.** When the NOTEBOOK hits its
  3000-word cap (BP-07) and Dejan prunes, entries that merit
  preservation migrate here rather than being deleted. The
  prune step IS the curation step.
- **Dated section headers.** Every entry starts with
  `## Round N — <short label> — YYYY-MM-DD` so grep
  anchors resolve cleanly.
- ASCII only (BP-09); Nadia lints for invisible-Unicode.
- Frontmatter wins on disagreement (BP-08).

## Why this exists

CI + install-script history is long-lived by nature: action
SHAs deprecate, runner images shift, mise plugins publish new
versions, upstream PRs sit in review for months. The NOTEBOOK
forces synthesis each round; this file preserves the audit
trail.

Candidate use cases:
- Action SHA ledger across rounds (which SHA was pinned
  when, why it got bumped).
- Upstream PR outcomes (per GOVERNANCE §23) — which upstream
  maintainer merged, which stalled, which workaround landed.
- CI cost trend — minutes/run × runs/month over the life of
  each workflow.
- Parity-drift recurrence — which drifts keep coming back
  after being fixed (signals structural rather than
  incidental).

---

_(Empty — seeded 2026-04-19 round 34. First migration on
next NOTEBOOK prune.)_
