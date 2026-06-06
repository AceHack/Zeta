---
id: B-0512
zetaid: 081KRHWGX0008QG0R003WEP6E9
priority: P1
status: open
title: "B-0448 slice 6 — Update tools/routines/README.md with 4-layer catch-43 table"
type: docs
origin: B-0448 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0448
depends_on:
  - B-0507
  - B-0511
composes_with:
  - B-0448
  - B-0507
  - B-0511
  - B-0513
tags: [routines, cloud-routines, docs, readme, catch-43]
---

# B-0512 — Update tools/routines/README.md with 4-layer catch-43 table

## Purpose

Replace the existing 2-row "CLI vs Desktop tick" table in
`tools/routines/README.md` with a 4-column table covering all catch-43
defence layers, including the new Cloud Routines layer added by B-0511.

**Depends on B-0507** for confirmed Cloud Routines characteristics and
**B-0511** for empirical registration details (endpoint, cost confirmed).
Can land at any point after B-0511 closes, but the table must reflect
confirmed — not speculative — characteristics.

## Current table (to be replaced)

```markdown
| Surface | Mechanism | Cadence sweet-spot | Cost per fire | Persistence |
|---|---|---|---|---|
| **CLI Claude Code** | `CronCreate` sentinel | `* * * * *` (every minute) | Cheap — re-prompts same session | Session-only |
| **Desktop Claude** | These routines | `0 */2 * * *` (every 2hr) | Full cold-boot | Persistent on disk |
```

## Replacement table (template — confirm values from B-0507 + B-0511)

```markdown
| Layer | Surface | Mechanism | Cadence | Cost per fire | Persistence | Failure-mode covered |
|---|---|---|---|---|---|---|
| **1** | CLI Claude Code | `CronCreate <<autonomous-loop>>` | `* * * * *` (every minute) | Cheap — re-prompts same session | Session-only; dies on exit | CLI session alive |
| **2** | Desktop Claude | `tools/routines/` scheduled task | `0 */2 * * *` (every 2hr) | Full cold-boot per fire | Persistent on disk; survives restart | Desktop app open |
| **3** | *(planned)* | `tools/routines/` source | git-tracked canonical | N/A (canonical only) | Forever in git | Drift detection / cross-machine |
| **4** | Cloud (Anthropic) | Cloud Routine API | Daily + GitHub events | TBD (confirmed by B-0507) | Anthropic-hosted; independent of local state | Desktop closed; local machine off |
```

## Additional sections to add

### Cost vs durability vs trigger-flexibility tradeoff matrix

```markdown
| | Layer 1 (CLI) | Layer 2 (Desktop) | Layer 4 (Cloud) |
|---|---|---|---|
| Cost | Lowest | Medium | TBD |
| Durability | Weakest | Strong | Strongest |
| Trigger flexibility | Cron only | Cron only | Cron + GitHub events + API |
| Fails when | Session exits | App closes | Anthropic infrastructure |
```

### Why 4 layers (not just Cloud)

Each layer covers a different failure mode:

- Layer 1 catches the gap between Desktop routine fires (the "working right now" layer)
- Layer 2 catches CLI session exit (persists when the CLI dies)
- Layer 4 catches Desktop close + local machine off + provides GitHub-event triggers

No single layer covers all failure modes. The layers are complementary.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] B-0507 research doc reviewed — fill in confirmed Cloud Routine cost per fire
- [ ] B-0511 registration confirmed — fill in actual trigger syntax + observed quotas
- [ ] Check for any other docs referencing the old 2-row table
  (`grep -ri "CLI Claude Code.*Desktop Claude" docs/ .claude/rules/`)
- [ ] Update `docs/AUTONOMOUS-LOOP.md` if it references the layer count

## Acceptance criteria

- [ ] `tools/routines/README.md` "CLI vs Desktop tick" section replaced with 4-layer table
- [ ] Cost-vs-durability matrix added
- [ ] "Why 4 layers" section added
- [ ] All values in the new table confirmed from B-0507 + B-0511 (no TBD placeholders)
- [ ] `docs/AUTONOMOUS-LOOP.md` layer count updated if needed
- [ ] B-0512 closed with PR link
