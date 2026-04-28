---
name: Substrate is currently optimized for single-agent speed; multi-agent/multi-fork hardening needs many rounds of iterative work over time (Aaron 2026-04-27)
description: Aaron 2026-04-27 substrate-level reframe of the factory's evolutionary trajectory. Today's substrate design is **optimized for single-agent speed** — fast iteration with one maintainer-agent pair (Aaron + Otto). Future operation requires **collaboration speed** — multi-agent + multi-fork hardening. The transition is **many rounds of iterative work over time**, not a one-shot fix. Frames the ROUND-HISTORY hotspot concern (and analogous concerns) as instances of a broader trajectory: "single-agent-speed substrate → collaboration-speed substrate" via progressive hardening. Critically, the single-agent-speed phase IS the right phase for now — collaboration-speed is post-starting-point work, not blocking, evolves over time.
type: feedback
---

# Substrate optimized for single-agent speed; collaboration-speed hardening is iterative future work

## Verbatim quote (Aaron 2026-04-27)

After Otto filed the ROUND-HISTORY hotspot concern as backlog research:

> "we are going to have to do many rounds of multiagent multifork hardening for our subsgtraight design, we've been really focused on single agent speed at this poing and not colloboration speed, we'll get to it and make it better over time"

## The two substrate optimization regimes

### Regime 1 (today): single-agent speed

What we have today:
- Single maintainer-agent pair (Aaron + Otto on AceHack)
- Single autonomous loop
- Single writer to most shared files (BACKLOG.md, ROUND-HISTORY.md, GLOSSARY.md, GOVERNANCE.md, CLAUDE.md, etc.)
- Mostly serial PR landings (no concurrent-conflict pressure)
- All work originates AceHack-side (homebase-first), syncs to LFG

Substrate-design choices that fit this regime:
- Big shared single-writer files (low coordination cost when there's one writer)
- Memory-as-flat-files (one writer, no merge concerns)
- ROUND-HISTORY as project-wide single file (single pair = single voice)
- Tick-history as single shared file (single pair tickrate)
- Manual hand-coordination of cross-fork sync (low frequency, hand-doable)

This regime **prioritizes iteration speed for one pair over coordination scale across many pairs**. It's the right choice for the bootstrap phase — getting the factory operational with one pair before scaling to many.

### Regime 2 (future): collaboration speed

What we'll need:
- Multiple maintainer-agent pairs (Aaron+Otto, Bob+Gemini, Carol+Codex, etc.)
- Multiple autonomous agents running concurrently within each pair
- Multiple forks, each contributing back to LFG
- Concurrent PR landings on LFG with merge contention
- Cross-fork data collection on LFG (per fork-storage taxonomy)

Substrate-design choices that fit this regime:
- Per-row / per-partition files instead of big shared singletons (e.g., `docs/backlog/**` already; same pattern for other big files)
- CRDT-style or append-only formats for inherently shared narratives
- Per-pair partitioning for per-pair data (PR archives, cost data, tick history, persona notebooks)
- Project-wide synthesis files compiled from per-pair sources (e.g., round-of-rounds rather than ROUND-HISTORY)
- Automated cross-fork sync with conflict-resolution discipline
- Multi-tenant fork-storage architecture (already substrate per Aaron's two-message disclosure)

## Why this matters as a substrate-level reframe

This isn't just a list of future concerns — it's a **frame** for how to evaluate today's substrate-design choices:

- A choice that's **optimal for single-agent speed** but **suboptimal for collaboration speed** is acceptable today, but flag it for hardening when collaboration arrives.
- A choice that **already serves collaboration speed** is ahead of its time but not wrong — the cost is paid early; benefit comes later.
- A choice that's **suboptimal for both** is just bad design; refactor.

Today's known single-agent-speed choices that need future hardening:
- ROUND-HISTORY.md as single shared file → multi-fork hotspot (memory file `feedback_round_history_md_git_hotspot_*` flags this)
- Big shared GLOSSARY/CLAUDE/GOVERNANCE files → similar contention under multi-agent
- Per-pair memory files in `memory/` mixed with project-wide ones → no clean partitioning
- Manual paired-sync flow (Otto cherry-picks AceHack content into LFG branches) → doesn't scale to N forks

Today's known collaboration-speed-aware choices already in place:
- `docs/backlog/**` per-row files (Otto-181) — already partitioned
- `docs/pr-preservation/` drain-log discipline — already designed for multi-PR archive
- Multi-tenant fork-storage architecture (post-Aaron's disclosure today) — explicitly multi-fork
- Otto-279 + follow-on closed-list history-surface rule — already understands per-surface partitioning

## Critical framing: this is iterative, NOT a blocking concern

Aaron's *"we'll get to it and make it better over time"* is load-bearing.

Multi-agent/multi-fork hardening is:
- **Many rounds of work** — not a single-PR fix.
- **Iterative** — each round addresses one or two pressure points; full hardening compounds over time.
- **Triggered by real pressure** — premature hardening is wasted effort; wait for the second pair / second autonomous agent / second fork to surface real contention before designing the fix.
- **Not blocking 0/0/0 starting point** — getting the factory operational with one pair is the priority.

The single-agent-speed phase IS the right phase for now. Acknowledging the transition exists doesn't mean accelerating it.

## How to apply going forward

When evaluating a substrate-design choice (today, while in single-agent-speed regime):

1. **Will it work for single-agent speed today?** If yes, ship it.
2. **Will it break under multi-agent/multi-fork pressure?** If yes, flag the breaking-point in a memory file (like the ROUND-HISTORY hotspot memory).
3. **Is the breaking-point pressure imminent?** If yes (e.g., second pair joining this month), harden now. If no (e.g., theoretical future state), defer with the flag.

The flag-and-defer pattern keeps the substrate honest about its limits without blocking iteration speed.

## Composes with

- `feedback_round_history_md_git_hotspot_concern_multi_fork_multi_agent_backlog_research_2026_04_27.md` — first instance of this trajectory (ROUND-HISTORY hotspot as single-agent-speed choice that breaks under collaboration-speed pressure). This memory frames it as one of many.
- `feedback_acehack_pre_reset_sha_loss_acceptable_lfg_is_preservation_layer_fork_storage_for_data_collection_2026_04_27.md` — multi-tenant fork-storage architecture is already collaboration-speed-aware.
- `feedback_zero_diff_means_both_content_and_commits_cognitive_load_for_future_changes_2026_04_27.md` — 0/0/0 invariant is the starting point; collaboration-speed work begins after.
- Otto-181 per-row BACKLOG restructure — already collaboration-speed-aware substrate work; was triggered by real pressure (BACKLOG.md getting unwieldy).
- The factory's broader trajectory — bootstrap (single-agent-speed) → operational with collaboration-speed (where this work goes) → mature (where the substrate just-works at scale).

## Backlog: trajectory-registry — index all the directional vectors the factory is on

Aaron 2026-04-27 follow-up: *"it probalby would help future you to know all our trajectories we have many and i forget too all we have in progress, backlog trajectory"*

Single-agent-speed → collaboration-speed is **one trajectory among many**. Aaron and Otto both lose track of which trajectories are in flight, what the current state is, and where the milestones lie. A single registry — `docs/TRAJECTORIES.md` or similar — would help.

### Sample of trajectories in flight (seed list, not exhaustive)

- **Substrate optimization**: single-agent-speed → collaboration-speed (this memory).
- **Factory phase**: bootstrap → operational → mature.
- **Versioning**: pre-v1 → v1 (Zeta versioning).
- **Code maturity**: greenfield → backcompat-bound (Otto-266).
- **Sync model**: manual paired-sync → automated 0-diff verification (`tools/sync/`).
- **Topology**: parallel-SHA-history (Option C) → dev-mirror / project-trunk + 0/0/0 invariant (today's reframe).
- **Install-script language**: bash pre-install + TypeScript post-install + Python AI-ML.
- **Fork-storage**: single-fork → multi-tenant fork-storage on LFG.
- **Vocabulary**: Mirror-register (Aaron's internal) → Beacon-register (externally-anchored).
- **Harness coverage**: single-Claude-harness → multi-harness (Gemini, Codex, Copilot, Cursor).
- **Pre-start → 0/0/0 starting point** (today's path-to-start work; AceHack-LFG drift currently 10 files).
- **AceHack absorption from upstream sources**: `../scratch` + `../SQLSharp` features → in-repo or design-doc'd (HIGH PRIORITY backlog).
- **Aurora research**: single-AI synthesis → multi-AI courier-ferry chain (cross-AI math review etc.).
- **Demo target**: factory-demo 0-to-production-ready app path (P0 backlog).
- **Cost-monitoring**: per-tick cost data → cost-trajectory dashboards.
- **Cryptographic identity**: shared-credentials → separate-cryptographic-identity (Otto-353).
- **AgencySignature**: pre-merge validator + post-merge auditor + squash-survival design.

The list is partial — Aaron's "I forget too" is honest signal that no one has the full set in active memory. The registry would be the discoverable index.

### Registry should capture per-trajectory:
- **Name** (the vector being followed)
- **Current state** (where we are today)
- **Target state** (what done looks like)
- **Status** (active / paused / blocked / not-yet-started)
- **Key milestones** (recent + next)
- **Composes-with** (other trajectories that interact)
- **Pointer to substrate** (memory files / BACKLOG rows / ADRs that drive the work)

### Why this is a separate trajectory itself

Building the trajectory-registry IS itself a trajectory: "no shared trajectory index → comprehensive trajectory registry that future-Otto and Aaron can both grep and re-orient from in 30 seconds."

It's load-bearing because:
- Future-Otto (next session) starts with the registry, finds active trajectories, makes decisions in context
- Aaron forgets too — registry is the shared remember-for-both
- New contributors (human or AI) get a single-file orientation surface
- Cross-trajectory composition becomes legible (which trajectories interact?)

### Forward-action

Backlog item, post-0/0/0 starting point. After we hit the line:

1. Survey memory files + BACKLOG + ADRs + CURRENT-aaron.md / CURRENT-amara.md for in-flight trajectories.
2. Draft `docs/TRAJECTORIES.md` (or `memory/TRAJECTORIES.md` if trajectory-registry is per-pair-context rather than project-wide).
3. Land + iterate; treat as living document updated each round.

## What this does NOT mean

- Does NOT mean today's substrate is wrong. It's optimized for the right phase.
- Does NOT mean every choice gets reviewed for collaboration-speed implications now. Most don't matter until the pressure arrives.
- Does NOT mean rushing the transition. Aaron's *"we'll get to it"* is patient framing — natural pace, not forced.
- Does NOT block the 0/0/0 starting point. Collaboration-speed hardening (and trajectory-registry building) starts AFTER we cross that line.
