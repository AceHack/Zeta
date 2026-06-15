---
name: ilyana
description: Long-term journal — Ilyana (public-api-designer). Append-only; never pruned; never cold-loaded.
type: project
---

# Ilyana — public-api-designer journal

Long-term memory. **Append-only.** Never pruned, never cleaned
up. Grows monotonically over rounds.

## Read contract

- **Tier 3.** Never loaded on cold-start.
- **Grep only, never cat.** The moment this file is read in
  full, cold-start cost explodes and the unbounded contract
  becomes a bug. Use grep / search to pull the matching
  section on demand.
- Search hooks: dated section headers (`## Round N — ...`)
  + persona names + `file:line` citations + finding-type
  names relevant to this persona's lane.

## Write contract

- **Newest entries at top.**
- **Append on NOTEBOOK prune.** When the NOTEBOOK hits its
  3000-word cap (BP-07) and Ilyana prunes, entries that
  merit preservation migrate here rather than being deleted.
  The prune step IS the curation step.
- **Dated section headers.** Every entry starts with
  `## Round N — <short label> — YYYY-MM-DD` so grep
  anchors resolve cleanly.
- ASCII only (BP-09); Nadia lints for invisible-Unicode.
- Frontmatter wins on disagreement (BP-08).

## Why this exists

The NOTEBOOK prune cadence (BP-07 every-3-audit) forces
synthesis — good discipline, but it also discards hard-won
observations. This file is the "permanent facts" layer:
patterns that recur across rounds, historical findings that
returned after being fixed, trend data compression would
otherwise erase.

---

_(Empty — seeded 2026-04-19 round 34 per Aaron's unbounded
long-term-memory proposal. First migration on next NOTEBOOK
prune.)_
