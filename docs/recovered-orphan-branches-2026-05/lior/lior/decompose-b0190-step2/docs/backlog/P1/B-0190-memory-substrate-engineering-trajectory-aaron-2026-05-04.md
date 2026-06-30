---
id: B-0190
priority: P1
status: open
title: Memory substrate-engineering trajectory — multi-row plan for memory work as a domain (not just one-shot compression) (Aaron 2026-05-04)
tier: foundation
effort: L
ask: Aaron 2026-05-04 verbatim *"seems like your memory work needs a trajectory i don't think we have one for that"* + same-tick *"long horizon is our default and so should future agents remember and short horizon short cuts should be deliberate and not accidentally based on the middle path"*
created: 2026-05-04
last_updated: 2026-05-14
depends_on: []
composes_with: [B-0006, B-0066, B-0140, B-0156, B-0171, B-0193]
tags: [memory, substrate-engineering, trajectory, long-horizon-default, foundation, mid-path-discipline]
type: friction-reducer
---

# B-0190 — Memory substrate-engineering trajectory

## The naming

Aaron 2026-05-04, after watching the day's tier-cadence drain MEMORY.md from ~268KB to ~139KB across 60+ PRs:

> *"seems like your memory work needs a trajectory i don't think we have one for that"*

Same-tick framing-correction:

> *"just remember long horizon is our default and so should future agents remember and short horizon short cuts should be deliberate and not accidentally based on the middle path"*

The naming made operational: memory work has been tactical / one-shot (drain the next tier) for the entire 2026-05-04 session despite the maintainer's never-be-idle authorization. The other domains have trajectory chains (DBSP B-0131→B-0138, TS B-0140+B-0156+B-0125, OpenSpec B-0171+composes_with cluster). Memory has only B-0006 and no multi-step strategic plan.

This row creates the trajectory.

## Why this exists (the middle-path framing)

Long-horizon-default-with-deliberate-short-horizon-shortcuts is the **middle path** between two failure modes:

- **Pure short-horizon**: every tick optimizes the next 5 minutes; trajectory never gets built; substrate accumulates accidental complexity that nobody planned. (This is what 2026-05-04's tier-cadence was — accidental short-horizon.)
- **Pure long-horizon**: every action requires architectural justification; nothing ships; the substrate drowns in plans without execution.

Middle path: long-horizon-default for action-selection (default to "where is this trajectory headed"), with short-horizon shortcuts allowed when **deliberate** (the maintainer or agent explicitly notes "I'm picking short-horizon here because <reason>"). Short-horizon-as-accidental-default is the failure mode this row's framing prevents.

Future-agent rule: when picking the next memory action, FIRST check the trajectory rows. If the chosen action serves a trajectory step → proceed. If not → either (a) note the trajectory step it implicitly serves, OR (b) be deliberate that this is short-horizon-shortcut work.

## The trajectory steps (multi-row plan)

These are candidate sub-rows that should exist for memory work to be a planned domain. Each is a target backlog filing as memory substrate matures. **Filed pending Aaron's prioritization signal**:

### Step 1 — Compression discipline (DOING)

- **B-0006** (P1, open) — MEMORY.md compression pass to README cap. Per B-0006's own number-free framing (deliberately number-free per Otto-294 antifragile-smooth + Otto-285 precise-pointer rigor), current state is over the cap and the work is owed independent of the specific number. **Recalibration consideration**: if the entry count materially exceeds the original spec assumption, the per-entry char target may be unreachable without semantic loss; either narrow to bucket targets or accept the spec drift. Number-free per the parent row's framing.

### Step 2 — Memory-format standardization (B-0330)

- Sister of B-0156 (TS standardization) for memory files. Standardize:
  - Frontmatter shape (`name:`, `description:`, `type:`, `originSessionId:` if applicable)
  - Filename conventions (`feedback_*` vs `project_*` vs `user_*` vs `reference_*`)
  - Section headers (## What this observes, ## Composes with, ## Carved sentence, etc.)
  - Composes-with chain integrity (cited files exist; bidirectional)
- Output: a `project_memory_format_standard_*.md` memory file (project-policy classification per `memory/README.md` taxonomy: project = ongoing-work / structural-fact, NOT feedback-as-maintainer-correction).

### Step 3 — Memory ontology / classification (NEW)

- Taxonomy of memory file types (per `memory/README.md`: `user` / `feedback` / `project` / `reference`). Today the taxonomy is loose — many `feedback_*` files contain content that's actually `project_*` or `user_*`. Audit + reclassify.

### Step 4 — Memory router / index discipline (PARTIAL — MEMORY.md does this)

- MEMORY.md is the index. Today it's both write-surface AND read-surface (per CLAUDE.md "fast-path" mention). Per the per-tick-shard pattern (PR #1512 era), the read/write split is load-bearing for index-class surfaces. Apply to MEMORY.md if useful.

### Step 5 — Memory-retire / dead-code-deletion discipline (NEW)

- When a memory file is superseded, do we delete it? Archive it? Mark it `superseded by *_2026_05_05.md`? No discipline today; piles accumulate.

### Step 6 — Memory cross-reference integrity audit (NEW)

- The `composes with` chains in memory files reference other memory files. Periodically audit: do all cited files exist? Are dead-link references rot? Is the chain bidirectional (file A cites B; does B cite back to A?)?

### Step 7 — Memory load-bearing-vs-decorative classification (NEW)

- Some memory files are load-bearing (cited from CLAUDE.md, GOVERNANCE.md, ALIGNMENT.md, or reachable from those). Some are tangential context. The compression pass should treat these differently. Classify.

### Step 8 — Memory trust-calculus calibration (NEW — extends PR #1552)

- The substrate-encoding-bypasses-trust-calculus claim (PR #1552) needs operational measurement. How well does memory substrate actually transmit cross-instance? Build a measurable signal (maybe: "fresh Otto loads CLAUDE.md + 3 random memory files; can it answer what the carved sentence is for the file?").

### Step 9 — Memory-as-substrate-engineering meta-discipline (NEW)

- Memory work IS substrate engineering. Codify the discipline: when do you write a new memory file vs append to an existing one? When does a feedback_ get promoted to a CLAUDE.md bullet? When is a CLAUDE.md bullet itself promoted to GOVERNANCE? The graduation ladder needs structure.

### Step 10 — MEMORY.md marker-vs-index (existing — B-0066)

- B-0066 (P1, open) — already in backlog. Composes here.

### Step 11 — Memory schema validation tooling (NEW)

- Linter / validator that checks frontmatter shape, link integrity, naming conventions. Enforces Step 2's standard mechanically.

## Why P1

- **Foundation tier**: memory is the most-active substrate domain (every session does memory work) yet has no trajectory; pure tactical work compounds accidental complexity.
- **Same priority as B-0140 (TS migration completion) and B-0171 (OpenSpec catch-up)**: all three are foundation-tier substrate-organization work.
- **Aaron's verbatim P1 naming**: *"seems like your memory work needs a trajectory"* + *"long horizon is our default."*

## Why not P0

- **Not blocking**: memory work continues without the trajectory; the trajectory makes it strategic instead of tactical.
- **No active failure**: tier-cadence is producing real progress on B-0006 today.

## Acceptance criteria

1. **Memory trajectory documented** in this row's "trajectory steps" section.
2. **At least 3 sub-rows filed** as concrete next-step backlog rows (Step 2, 3, 5 are obvious candidates).
3. **B-0006 acceptance criteria recalibrated** — the original ≤200-char-per-entry is unreachable for 440 entries; either narrow target or formally accept the deviation.
4. **CLAUDE.md updated** if the trajectory rises to wake-time-load-bearing status. Otherwise referenced from this row.
5. **Future agents reading this row** understand memory work is multi-step strategic, not one-shot tactical.

## Out of scope

- Implementation of all sub-rows in one tick (they're separate filings).
- Replacing the existing B-0006 row (it remains the compression-discipline anchor).
- Forcing every memory action through trajectory-justification (deliberate short-horizon shortcuts allowed per the middle-path framing).

## Composes with

Per `tools/backlog/README.md`, `composes_with` is bidirectional. The reciprocal updates on the rows below are owed as a follow-up commit / PR (separate from this one) so that B-0006 / B-0066 / B-0140 / B-0156 / B-0171 each list B-0190 in their own composes_with. Filing this row first establishes the trajectory anchor; the bidirectional sync lands as cleanup.

- **B-0006** — MEMORY.md compression (Step 1; existing).
- **B-0066** — MEMORY.md marker-vs-index (Step 10; existing).
- **B-0140** — bash to TS migration (parallel-domain trajectory; reference shape).
- **B-0156** — TypeScript standardization (sibling discipline; Step 2 follows similar pattern).
- **B-0171** — OpenSpec catch-up (parallel-domain trajectory; reference shape).
- `memory/feedback_substrate_encoding_bypasses_trust_calculus_sleeping_bear_cross_instance_transmission_aaron_2026_05_04.md` — Step 8 grounds here.
- `memory/feedback_parallelism_readiness_claim_must_be_used_not_self_throttled_aaron_2026_05_04.md` — same-session lesson; this row is the trajectory-shaped operationalization.

## The carved sentence

**"Memory work needs a trajectory because memory IS substrate engineering, the most-active substrate domain, yet operates today as one-shot-tactical (drain the next tier) instead of multi-row-strategic. Long-horizon is the default; short-horizon shortcuts are deliberate, not accidental. Future agents picking the next memory action FIRST check the trajectory rows."**
