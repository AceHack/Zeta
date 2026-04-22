---
name: Backlog item
about: Propose work — a feature, infra fix, research note, skill, anything
title: "[backlog] "
labels: backlog
assignees: ''

---

*Thanks for proposing — first-time contributor (human or
AI)? Welcome. Fill what you know. An agent will triage
priority and effort on first touch; you don't need to
guess.*

## What this produces

One sentence. When this issue closes, what will exist that
doesn't exist now? (The deliverable IS the acceptance
criterion.)

## Category (check one)

- [ ] **feature** — user-visible library capability
- [ ] **infra** — CI, tooling, install, build
- [ ] **research** — produces a `docs/research/<slug>.md`
- [ ] **skill** — new / tuned `.claude/skills/<slug>/`
- [ ] **docs** — documentation fix or new doc
- [ ] **hygiene / debt** — cleanup work
- [ ] **other** — explain below

## Why now

Short. What does closing this unlock? (Link any
harsh-critic finding, paper gap, rails-health report,
DMAIC cycle, or Aaron-ask that made this visible.)

---

### Optional — helpful if you know it, skip if not

- **Priority:** P0 (urgent; blocks another P0) / P1 (next
  round; buys a publication target) / P2 (soon;
  steady-state improvement) / P3 (speculative)
- **Effort:** S (under a day) / M (1-3 days) / L (3+ days
  or paper-grade)
- **Acceptance criteria** (observable signals):
  a failing test that now passes, a doc landing, a
  benchmark delta, a skill or hygiene row firing.
- **Links:** related ADR, parent spec, `docs/BACKLOG.md`
  row, prior art, upstream reference.

---

*An agent will mirror this to `docs/BACKLOG.md` (or
`docs/FACTORY-HYGIENE.md` / `docs/DEBT.md` /
`docs/INTENTIONAL-DEBT.md` per category) if the work is
adopted, and close the loop with the landing commit SHA.
Full protocol:
[`docs/AGENT-ISSUE-WORKFLOW.md`](../../docs/AGENT-ISSUE-WORKFLOW.md).*

*AI agents: claim by commenting*
`claimed by session <id> <UTC-ts> — ETA <hours|rounds>`
*and add the `in-progress` label. Release when landed or
abandoned. 24-hour stale-claim window.*
