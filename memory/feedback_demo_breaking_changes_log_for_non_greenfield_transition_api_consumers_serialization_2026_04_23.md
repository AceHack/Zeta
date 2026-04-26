---
name: Keep a log of breaking changes in demos — learn from demo breaks to anticipate what we need to solve at non-greenfield transition; focus on API consumers + state serialization (things that survive code versions)
description: Aaron 2026-04-23 add-on to the greenfield-phases framing. Demos are Phase-1 (can break freely per the demos-are-greenfield carve-out) AND tracked-for-learning — keep a log of what broke, what the break looked like, what it would have cost at non-greenfield. Most real-infra breaking changes are around **API consumers** (clients depend on signatures / semantics) and **state serialization format** (persisted data that outlasts any single code version). Demos get to experiment on these exact surfaces so non-greenfield has a lessons-learned substrate.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Demo breaking-changes log — learn forward

## Verbatim (2026-04-23)

> we can learn from demos when we make breaking changes
> we can keep a log of them so we know all the problems
> we have to soves when we move to non-greenfield mode.
> Most breaking changes are around API consumers and
> state serilization format and things like that, things
> that survivie code versions.

## What this adds to greenfield-phases

The prior clarification
(`feedback_greenfield_until_deployed_then_backcompat_learning_mode_DORA_cost_2026_04_23.md`
+ demos-are-greenfield carve-out) establishes that demos
don't trigger Phase 1 → Phase 2. This memory adds: they
also don't go unobserved. Demo breaks get **logged** so
the transition-to-non-greenfield has a concrete
lessons-learned substrate.

## The two categories Aaron named

### 1. API consumers

Things a client / consumer depends on:

- Public method signatures + semantics
- Wire-protocol request / response shapes
- Error-code contracts
- Idempotency guarantees
- Ordering guarantees
- Rate-limit contracts
- Version negotiation
- Auth flow shapes
- Anything a non-code consumer has encoded against

Breaking changes here demand producer + consumer
coordination — exactly the "exercise or impossible
coordination" Aaron named for Phase 3.

### 2. State serialization format

Things persisted across code versions:

- On-disk database schemas (row layout, column types,
  constraints, FKs)
- Serialized file formats (Arrow IPC, Parquet, custom
  binary, JSON envelopes with schema versions)
- Wire format for cross-process state (e.g., inter-node
  replication blobs)
- Persistence of algebraic state (Z-set serialization,
  spine checkpoint formats)
- Anything that outlasts a single code deploy

Breaking changes here demand migration strategies —
direct data transformation, dual-read-compat windows,
SRE coordination. Lossy breaks permanently discard
information.

### Why these two specifically

Aaron called out *"things that survive code versions."*
The unifying property is **persistence across the code
deployment unit**:

- API consumers: their code runs independently of ours;
  our deploy doesn't atomically update theirs
- State serialization: the bytes sit in storage after
  our old code is gone; new code must interpret them

In-process / in-repo / per-deployment changes don't have
this property — they ship atomically with the code.

## The log itself

### Proposed surface (not landing this tick)

- **Location**: `docs/hygiene-history/demo-breaking-changes-log.md`
  — fits the fire-history row-#44 pattern; tracks a
  specific substrate (demo breaks) with a per-entry
  schema
- **Per-entry schema**:
  - Date
  - Demo affected (FactoryDemo.Api, FactoryDemo.Db,
    CrmKernel, ServiceTitan demo, ...)
  - Break category (API consumer / state-serialization
    format / both / other — noting "other" warrants
    adding to the taxonomy)
  - What changed (verbatim from the change)
  - What would have broken at non-greenfield (who /
    what / how)
  - Mitigation pattern we'd use if post-Phase-1 (the
    learning)
  - Cost estimate (coordination hours / migration
    complexity / rollback feasibility)

### Growth model

- Additive only — entries stay forever as lessons
- Candidate cadence: on-touch (every demo break logs an
  entry) + round-close audit (did we log all this round's
  demo breaks?)
- Cross-ref to ROUND-HISTORY rows that land the breaks

### Who authors

- The agent landing the breaking change authors the log
  entry in the same PR
- Per signal-in-signal-out discipline — don't lose the
  break's signal on ingest
- Self-administered; the backlog-refactor hygiene row
  #54 can sweep for missing entries

## How to apply

### Going forward (while still in Phase 1)

- When landing a demo break, author a log entry at
  `docs/hygiene-history/demo-breaking-changes-log.md`
  (create file on first entry).
- Classify the break (API / serialization / both / other).
- Name what would have broken for a non-greenfield
  consumer.
- Name the mitigation pattern that would apply
  post-Phase-1.

### At Phase-1 → Phase-2 transition

- **Read the entire log** as the "what are we
  committing to?" inventory.
- Each log entry becomes a backcompat concern to
  handle from that point forward.
- The log converts from "lessons learned" to
  "obligations inherited."

### Demos that do NOT touch API-consumer or
serialization surfaces

- Demo changes that are purely internal (refactor, code
  org, naming inside the demo) don't need a log entry.
- Only breaks that **survive code versions** count.
- In-process ephemeral changes are greenfield-free.

## What this is NOT

- **Not a requirement to log every demo change.** Only
  those that touch API consumers or serialization
  formats. Internal demo refactors don't count.
- **Not a replacement for ROUND-HISTORY.** The log is
  narrow (break-cost lessons); ROUND-HISTORY is broad
  (what landed each round). Both surfaces compose.
- **Not a license to break demos gratuitously to
  populate the log.** Aaron's frame is "when we make
  breaking changes, log them" — not "go make breaking
  changes for log entries." Log is a consequence, not a
  goal.
- **Not a log of Zeta library breaking changes.**
  Zeta-the-library's breaking-change discipline is its
  own substrate (once published consumers exist). This
  log is demo-specific.

## Composes with

- `feedback_greenfield_until_deployed_then_backcompat_learning_mode_DORA_cost_2026_04_23.md`
  (the three-phase trajectory; this memory is the
  between-phase learning loop)
- `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (logs preserve break-signal across the transition)
- `docs/FACTORY-HYGIENE.md` row #44 (cadenced fire-history
  pattern the log file inherits)
- `docs/hygiene-history/` (natural folder for the log)
- `docs/ROUND-HISTORY.md` (round-level narrative;
  cross-references the log when a round included a
  loggable break)
- `project_zeta_first_class_migrations_sql_linq_extension_post_greenfield_db_idea_2026_04_23.md`
  (serialization-break class specifically; migrations
  feature is the answer to the state-serialization side
  of the log's obligations)
