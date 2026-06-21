---
id: 081KQJZR90008QG0R0025WX5ZJ
priority: P3
status: open
title: Retire or fix `tools/hygiene/append-tick-history-row.sh` — routes post-2026-04-29 ticks to legacy surface (canonical write is per-tick shards) — Otto 2026-05-02
created: 2026-05-02
last_updated: 2026-05-02
depends_on: []
type: friction-reducer
---

# 081KQJZR90008QG0R0025WX5ZJ — Retire or fix `append-tick-history-row.sh` (Otto 2026-05-02)

## Origin

PR #1202 Copilot thread H5vc (commit 26e71c1 of substrate
branch `substrate/aaron-2026-05-02-superfluid-cluster-authority-rules`)
caught a substantive routing bug:

> *"Per docs/hygiene-history/ticks/README.md, post-2026-04-29
> tick history should be written as per-tick shard files under
> docs/hygiene-history/ticks/**(canonical write surface)
> rather than appending new rows to this legacy table. Please
> move these new tick entries into shard files and keep
> loop-tick-history.md as the read/projection surface to avoid
> the EOF append hotspot coming back."*

I (Otto in this branch's autonomous loop) used
`bash tools/hygiene/append-tick-history-row.sh "..."` 6 times
during ticks 2-6, each time writing to the LEGACY
`docs/hygiene-history/loop-tick-history.md` table — the wrong
surface for post-2026-04-29 ticks. The migration tick (Tick-7,
commit 48b0a79) moved those 6 rows to per-tick shards. But the
script remains a footgun for future-Otto.

## First-principles trace

1. Per `docs/hygiene-history/ticks/README.md`, the
   architectural reason for shards is to avoid the
   "Append-Hotspot Merge Friction" failure mode (named by
   the deep-research external-AI reviewer 2026-04-29).
2. The legacy table is the READ / projection surface; per-tick
   shards are the WRITE surface.
3. `tools/hygiene/append-tick-history-row.sh` writes to the
   legacy table. Header comment cites "wraps the correct pattern
   (cat >> file) so the bug shape can't occur via this
   entrypoint" — solving a DIFFERENT bug (reverse-chronological
   insertion by Edit tool with old_string-before-match).
4. The script's bug-fix is correct for its claimed scope but
   the surface it writes to is now wrong post-shard-transport.
5. Therefore: future-Otto running the script silently routes
   to the wrong surface; the only catches are Copilot review
   AFTER the commit lands.

## Acceptance criteria

Pick ONE of these resolutions (cooling-period-graded; not
forcing a particular choice):

### Option A — Retire the script

1. Delete `tools/hygiene/append-tick-history-row.sh` and the
   `.ts` companion if it exists.
2. Update any documentation that references the script
   (CLAUDE.md, AGENTS.md, AUTONOMOUS-LOOP.md, persona
   notebooks) to point to direct shard-write pattern.
3. Future-Otto writes shards via `Write` tool directly:
   `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md` or
   `HHMMSSZ.md` (with body being the legacy-table row format).

### Option B — Repurpose the script to write shards

1. Rewrite the script to:
   - Parse the row's timestamp
   - Compute the shard path
     (`docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`)
   - Write the row to that shard file (single-row body)
   - Reject if shard already exists (collision check)
2. Keep the chronological-order check (still useful — prevents
   writing a shard with timestamp earlier than an existing
   shard for the same day).
3. Update header comment + usage examples.

### Option C — Hybrid: keep script as legacy-only deprecated tool

1. Add deprecation warning to script header: *"DEPRECATED
   2026-05-02 — use direct shard write under
   docs/hygiene-history/ticks/**. This script writes to the
   read/projection surface; for new ticks use Option A or
   Option B."*
2. Make the script print warning on each invocation.
3. Eventual deletion after a soak period (e.g., 30 days).

## Composes with

- `docs/hygiene-history/ticks/README.md` — the architectural
  contract being violated by the current script
- Otto-372 (cron-mechanism-unreliable, this same branch) —
  composes; both are tooling-discipline corrections
- Otto-352 manufactured-patience cousin (recurrence threshold)
  — this is single-recurrence-this-session (only Otto-this-
  branch was using the script), but the script could trip
  future agents the same way; mechanization wins on cost
  asymmetry
- Largest-mechanizable-backlog-wins (PR #1202) — the
  retirement/fix IS mechanization-work
- First-principles trust calculus (PR #1202) — the trace
  above IS the rule applied to its own surface

## Effort

S — single file delete (Option A) or single file rewrite
(Option B). Documentation updates are minor. ~30-60 minutes.

## Notes

P3 priority because the manual workaround (direct shard-write
via `Write` tool) works fine and the legacy table is still
read-by-projection; nothing is broken in the read-pipeline.
The script is just a footgun rather than an active fault. If
recurrence happens (another agent uses it incorrectly), promote
to P2.

Per Aaron's largest-mechanizable-backlog-wins rule + scope-
creep-is-feature: filing the row preserves the finding even
if it never gets implemented; future-Otto inheriting can pick
this up if/when the legacy-table-read-projection becomes a
problem OR when a different agent trips the same bug.
