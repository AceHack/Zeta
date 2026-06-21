---
id: 081KSBMG30008QG0R002WAR0WH
priority: P2
title: Move docs/BACKLOG.md generated-index drift check off per-PR gate onto scheduled cadence
created: 2026-05-24
last_updated: 2026-05-24
origin: Aaron 2026-05-24 observation during PR #4816 — "that backlog.md seems like it could be a hotspot, any index files like that should probably be done on schedule not every pr"
status: open
classification: P2-developer-experience
tags:
  - developer-experience
  - ci-hygiene
  - generated-indexes
  - hotspot-reduction
composes_with:
  - .claude/rules/blocked-green-ci-investigate-threads.md (BACKLOG drift fires on every backlog PR; investigation discipline kicks in for what should be hands-free regen)
  - .claude/rules/all-complexity-is-accidental-in-greenfield.md (per-PR drift-check is accidental complexity vs scheduled regen)
  - tools/backlog/generate-index.ts (the regenerator)
  - tools/backlog/README.md (documents the BACKLOG_WRITE_FORCE=1 guard)
  - PR #4816 (empirical anchor — BACKLOG.md drift check blocked the PR after adding 081KSBMG30008QG0R00201X7EJ)
---

## Substrate-honest origin

Aaron 2026-05-24, during PR #4816 reviewer-thread cleanup:

> *"that backlog.md seems like it could be a hotspot, any index files like
> that should probaboy be done on schedule not ever pr."*

The current `check docs/BACKLOG.md generated-index drift` CI check fires
on every PR that touches a `docs/backlog/P*/B-NNNN-*.md` file. The
required fix is mechanical (regenerate the index + commit), but the
mechanism couples generated-index freshness to every-PR work, creating
friction for backlog PRs and conflict-risk for parallel agents
incrementing different backlog rows.

This is **accidental complexity** per
[`.claude/rules/all-complexity-is-accidental-in-greenfield.md`](../../.claude/rules/all-complexity-is-accidental-in-greenfield.md)
— the generated-index doesn't need to be perfectly fresh at every PR
merge; periodic regeneration (e.g., on a scheduled cron + at
round-close) is sufficient for the consuming use case (the
human-readable backlog overview).

## Proposed refactor

Move the BACKLOG.md generation from per-PR-gating to scheduled cadence:

1. **Remove the `check docs/BACKLOG.md generated-index drift` CI gate**
   from the per-PR required-check set
2. **Add a scheduled GitHub Action** (e.g., every 6 hours, or hourly during
   active development windows) that:
   - Runs `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts`
   - Commits the regenerated `docs/BACKLOG.md` if changed
   - Pushes to `main` directly (or opens a PR per repo policy)
3. **Add an opt-in pre-commit hook** for contributors who WANT to keep
   BACKLOG.md fresh in their PR (zero-friction; doesn't gate merges)
4. **Document the cadence** in `tools/backlog/README.md` so contributors
   know the index lag-time SLO

## Composes with other generated-index files (if any)

Audit `tools/hygiene/` + `tools/` for other generated-index files that
have similar per-PR-gate vs scheduled-cadence tradeoffs. Examples to
check:

- `docs/SKILLS-INDEX.md` (if it exists; or similar)
- `docs/AGENT-INDEX.md` (if similar)
- Any other auto-generated docs under `docs/`

Each generated-index that consumes "freshness ≤ 6h is fine" can move to
scheduled cadence. Each generated-index that consumes "must be
byte-identical to source-of-truth at merge time" stays per-PR.

## Acceptance criteria

- [ ] Remove BACKLOG.md drift from per-PR required-check set
- [ ] Scheduled GitHub Action regenerates BACKLOG.md periodically
- [ ] Documented SLO for index freshness in `tools/backlog/README.md`
- [ ] Audit other generated indexes for similar refactor opportunities
- [ ] Empirical validation: at least one round of backlog PRs lands without
      hitting the drift check (confirming the refactor works in practice)

## Why P2

P2 (developer-experience) because:

- Not blocking any current work (the BACKLOG_WRITE_FORCE=1 escape hatch
  exists)
- Quality-of-life improvement for every future backlog PR
- Reduces multi-agent coordination friction (parallel PRs no longer race
  on BACKLOG.md regen)
- Not safety-relevant (no risk if deferred)

Eligible for promotion to P1 if the hotspot recurs frequently across
multiple PRs in a single round.
