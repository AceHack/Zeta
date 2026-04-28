# Session snapshots — Claude state pins

Durable record of Claude session state at session-open or at
per-decision pin-time. Addresses Amara's 4th-ferry concern
(PR #221) that "Claude is not a single stable operator unless
the actual snapshot, system-prompt bundle, and loaded memory
surfaces are all pinned and recorded."

## Why this file

Across Claude model versions (3.5 → 3.7 → 4 → 4.x), the
system-prompt bundle + knowledge cutoff + memory-retention
language shift materially. When a future session, external
reviewer, or tuning pipeline asks *"what did Kenji actually
know when this decision was made?"* this file answers.

Complements:

- [`loop-tick-history.md`](./loop-tick-history.md) — what
  happened each tick (action-summary)
- [`docs/decision-proxy-evidence/`](../decision-proxy-evidence/)
  — per-decision evidence records with their own `model`
  block (PR #222)

This file is **session-level + daily**, not per-tick. A new
row lands on session-open and on significant session
events (mid-session model swap, major memory migration,
compaction boundary). Per-tick snapshots live inline in
tick-history row `notes` if load-bearing for that tick.

## Capture helper

[`tools/hygiene/capture-tick-snapshot.sh`](../../tools/hygiene/capture-tick-snapshot.sh)
prints a YAML fragment covering what's mechanically
accessible. Agent fills in `model_snapshot` + (eventually)
`prompt_bundle_hash` from session context.

```bash
tools/hygiene/capture-tick-snapshot.sh       # YAML
tools/hygiene/capture-tick-snapshot.sh --json
```

## Row format

```yaml
- session_id: <session-boundary-slug>     # e.g., "2026-04-23-otto-long-session"
  captured_utc: 2026-04-24T00:00:00Z
  event: session-open | mid-session-pin | session-close | compaction
  agent: Otto                              # persona hat active; may change mid-session
  model_snapshot: claude-opus-4-7
  claude_cli_version: "2.1.118 (Claude Code)"
  head_sha: <git-sha>
  branch: <current-branch>
  repo: <owner>/<repo>
  files:
    claude_md_in_repo_sha: <sha>
    claude_md_home_sha: <sha-or-empty>
    agents_md_sha: <sha>
    memory_index_sha: <sha>
    memory_index_bytes: <int>
  notes: >
    Free-form context: session-boundary reason, model swap
    rationale, compaction trigger, etc.
  prompt_bundle_hash: null  # populate once a reconstruct-tool lands
```

Append-only. Rows stay forever.

## Seed entries

- session_id: 2026-04-23-otto-long-session-start
  captured_utc: 2026-04-24T00:28:28Z
  event: mid-session-pin
  agent: Otto
  model_snapshot: claude-opus-4-7
  claude_cli_version: "2.1.118 (Claude Code)"
  head_sha: 9752e475c2bb2624aaa1e8b85f1d917f23e21a9f
  branch: stabilize/snapshot-pinning-tick-history-amara-action-2
  repo: Lucent-Financial-Group/Zeta
  files:
    claude_md_in_repo_sha: d774531bf284437bbc0bf68133651bf72e300e44
    claude_md_home_sha: ""
    agents_md_sha: ea94fa680373715526ebb0d6ecdfbd31e25794ff
    memory_index_sha: f2799a35808f79ccb924641aaa1a04db73163be3
    memory_index_bytes: 58842
  notes: >
    First entry — captured at Otto-70 when snapshot-pinning
    scaffolding landed. This session has been running long
    (~70 Otto ticks); the actual session-open state is
    earlier and was not captured at that time. Memory index
    is currently 58842 bytes (over the FACTORY-HYGIENE row
    #11 24976-byte cap — known separately-tracked drift).
  prompt_bundle_hash: null

## What this file is NOT

- **Not per-tick** — the tick-history file covers that;
  this file is session-level + significant-event.
- **Not retroactive for prior sessions** — the record
  starts from when the capture tool landed. Prior sessions
  are unreachable for this fidelity.
- **Not CI-gated** — append on discipline; enforcement
  waits until the format stabilizes (Determinize-stage
  per Amara roadmap).
- **Not complete** — `model_snapshot` + `prompt_bundle_hash`
  are agent-filled / future-tool-filled respectively.
  What's captured is the floor, not the ceiling.
- **Not a replacement for `memory/CURRENT-*.md`** — those
  are running distillations; this file is point-in-time
  pins for audit.

## Composes with

- FACTORY-HYGIENE row #44 (cadence-history-tracking) —
  this file is the autonomous-loop's session-level
  fire-log, sibling to the tick-level `loop-tick-history.md`
- `docs/hygiene-history/loop-tick-history.md` — per-tick
  action-summary; this file is per-session-state
- `docs/decision-proxy-evidence/` — per-decision evidence
  (PR #222); can cite rows here via `model.loaded_memory_
  files` + snapshot refs
- `docs/aurora/2026-04-23-amara-memory-drift-alignment-
  claude-to-memories-drift.md` (PR #221) — Amara ferry
  that named snapshot-pinning as Stabilize-stage action
- `tools/hygiene/capture-tick-snapshot.sh` — capture helper
