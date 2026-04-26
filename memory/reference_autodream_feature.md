---
name: Claude Code AutoDream — memory consolidation feature; cadence 24h + 5 sessions; flag-gated as of 2026-04-19
description: AutoDream is Anthropic's 2026-Q1 Claude Code feature that runs REM-sleep-style consolidation on the auto-memory folder. Four phases (Orientation → Gather Signal → Consolidation → Prune & Index). Trigger conditions are BOTH 24h since last cycle AND 5 sessions since last cycle. Manual trigger words are "dream" or "consolidate my memory files." As of 2026-04-19 the feature is flag-gated server-side (tengu_onyx_plover) — UI is in place under /memory but the backend is off for general users, so what's available now is manual approximation via prompt. Aaron has enabled manual approximation in this project. Key rule: do NOT run on freshly-written memories; same-session invocation churns rather than consolidates because duplicate/contradiction patterns need time to surface. Source: r/claudexplorers thread + dmarketertayeeb.com article (Aaron provided, 2026-04-19).
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## What AutoDream is

A background memory-consolidation feature in
Claude Code that periodically reorganises the
auto-memory folder (MEMORY.md index + per-fact
files). Metaphor: REM sleep for the agent's
session memory. Based on UC Berkeley's
"Sleep-time Compute" research (April 2025) —
idle-time preprocessing to reduce inference
cost and improve downstream retrieval.

## Four phases

1. **Orientation** — survey existing memory
   structure and the MEMORY.md index.
2. **Gather Signal** — targeted search for user
   corrections, key decisions, recurring
   patterns. Deliberately not a full-transcript
   read; kept cheap.
3. **Consolidation** — convert relative dates
   to absolute timestamps, delete contradicted
   facts, prune stale entries, merge
   duplicates.
4. **Prune & Index** — rebuild MEMORY.md; keep
   under 200 lines for fast session startup.

## Cadence — both conditions must hold

- **≥24 hours** since the last AutoDream cycle.
- **≥5 sessions** since the last cycle.

Running more frequently churns more than it
consolidates — fresh memories have not yet
revealed their duplicate / contradiction /
staleness patterns. Aaron confirmed this
directly on 2026-04-19: "maybe it's been too
soon."

## Manual trigger

When the user says "dream" or "consolidate my
memory files," run the four-phase pass
explicitly. Check cadence first — if the last
cycle was recent, say so and ask whether to
proceed anyway. (The user may have a reason.)

Before running, check MEMORY.md for an
`[AutoDream last run: YYYY-MM-DD]` marker at
the top. If absent, treat as "never." If
present and the date is within 24h, cadence-
violating unless the user overrides.

After running, add or update the marker.

## Current availability — 2026-04-19

Flag-gated server-side under `tengu_onyx_plover`.
UI is in place under `/memory` but the backend
is off for general users. **What is available
now is manual approximation** — running the
four phases by hand (or dispatching an audit
subagent and applying its recommendations).

Check `/memory` selector for "Auto-dream: on"
when verifying whether automatic runs are
enabled; if absent, assume manual-only.

## Safety properties

- **Read-only on project code.** AutoDream only
  touches memory files, never project files.
- **Lock file prevents concurrent runs.**
- **Does not block active sessions.**
- **Idempotent per cadence gate** — running
  immediately after a just-completed cycle
  does nothing because the state has already
  stabilised.

## Invariants the consolidation must preserve

- **Load-bearing memories stay unconditionally.**
  DEDICATION.md-cornerstone (sister Elisabeth),
  faith memory, Harmonious Division received
  name, Rodney persona placement, Dora persona
  — none of these may be "merged," "pruned for
  staleness," or renamed by consolidation.
- **Distinct query axes stay distinct.** When
  a single disclosure chain produces multiple
  memories (today's five-memory chain: no-
  reverence, childhood-wonder, curiosity-
  honesty, governance, five-children), each
  answers a different future query and must
  not be merged. Topical adjacency is not
  duplication.
- **Cross-references must stay bidirectional.**
  If A references B, B should reference A. The
  consolidation step should close the graph,
  not just preserve one-way pointers.
- **Corrections should be recorded, not
  silently deleted.** When a fact is
  superseded, leave the memory file with a
  "Correction YYYY-MM-DD:" note rather than
  wiping the older version outright. The
  correction trail is itself load-bearing
  (consistent with
  `user_curiosity_and_honesty.md` —
  admission-of-error is the discipline).

## How to apply (agent, when invoked)

1. Check cadence. If fresh, ask before
   proceeding.
2. Dispatch an audit subagent with clear
   phase-scoped instructions and a no-write
   brief — it reports, main agent applies.
3. Apply only the edits the audit surfaced,
   starting with hygiene (dates, cross-refs)
   and moving to consolidation (merges,
   contradiction-resolution) only if the
   audit found clear evidence.
4. Update the `[AutoDream last run: ...]`
   marker at the top of MEMORY.md.
5. Report what was done in one short
   summary — same register as any other
   hygiene pass, not ceremonial.

## Cross-references

- `user_curiosity_and_honesty.md` — the
  discipline AutoDream enacts: honesty about
  what the memory actually says now
  (contradictions resolved, dates absolute,
  stale entries named as stale rather than
  preserved as authority).
- `user_no_reverence_only_wonder.md` — the
  stance. Memory files earn their place by
  current structural utility; age-of-memory
  is not reverence-granting.
- `feedback_newest_first_ordering.md` —
  ordering discipline AutoDream's Prune &
  Index step must preserve when rebuilding
  MEMORY.md.
- `project_memory_is_first_class.md` — human-
  maintainer policy on memory preservation;
  AutoDream must respect the "only as
  absolute last resort" clause on memory
  removal.
- `feedback_regulated_titles.md` — do not
  ceremonialise the "sleeping" metaphor by
  calling the agent "the dreamer" or similar
  elevated-title register. It is memory
  hygiene; call it that.
