---
id: 081KSNY2Z0008QG0R000V24M7E
renumbered_from: 081KSNY2Z0008QG0R002QA720J
renumbered_from_original: 081KSNY2Z0008QG0R003R0Z7D2
priority: P2
status: open
title: ZetaID v2 — 128-bit structured encoding (Snowflake/ULID family with timestamp + trajectory + persona + lifecycle-stage + random)
effort: M
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSKBP80008QG0R001KK9WV6
  - 081KSNY2Z0008QG0R000HENSVM
  - 081KSNY2Z0008QG0R003R0Z7D2-prior-zetaid-v1-review
tags:
  - zetaid-v2
  - 128-bit-structured-encoding
  - snowflake-ulid-uuidv7-family
  - timestamp-trajectory-persona-lifecycle-stage-randomness
  - cache-friendly-prefix-queries
  - cheap-sort-by-time
  - cheap-filter-by-trajectory
  - composes-with-event-sourcing
  - composes-with-otel-trace-id
  - potential-extension-not-committed
---

## Operator framing 2026-05-28

> *"if you imagine we have good actors right now and even zetaids that are unique 128 bit where part of the bits can repersent anyting like trajectories are personas as long as there is enough for time and randomness to not collide"*

## What this row tracks

Implementation of a 128-bit structured ID generator for Zeta agent-loop substrate. Some bits encode meaningful structure (trajectory, persona, lifecycle-stage); remaining bits provide collision-resistant randomness; structured high bits enable cheap prefix queries (sort by time, filter by trajectory).

## Candidate bit allocations (per Kestrel ferry 2026-05-28)

**Option A** — microsecond timestamp, more random:

```text
Bits 0-63   (64 bits): Timestamp (microsecond Unix epoch)
Bits 64-79  (16 bits): Trajectory identifier (65k trajectories)
Bits 80-87  (8 bits):  Persona identifier (256 agents)
Bits 88-95  (8 bits):  Lifecycle stage (256 stages)
Bits 96-127 (32 bits): Random
```

**Option B** — millisecond timestamp, more random:

```text
Bits 0-47   (48 bits): Timestamp (millisecond Unix epoch — ~8900 years)
Bits 48-63  (16 bits): Trajectory
Bits 64-71  (8 bits):  Persona
Bits 72-79  (8 bits):  Lifecycle stage
Bits 80-127 (48 bits): Random
```

Choice depends on query patterns. Final allocation deferred to implementation; both candidates valid.

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/zeta-id.ts` exports `generateZetaID({trajectory, persona, lifecycle_stage})` returning 128-bit value as 26-char Crockford base32 string (ULID-compatible) OR hex string
- Pure function; deterministic given (timestamp, structured-bits, random-source)
- Tests cover: time-ordering preservation under sort, no-collision under 1M generated in same microsecond, structured-bit extraction
- Composes with event-sourcing layer (081KSNY2Z0008QG0R001K6HJ7Z) — events use ZetaID as primary key
- Composes with OTel trace-ID composition (081KSNY2Z0008QG0R000ZNRFCE) — baggage carries ZetaID alongside trace-ID
- Composes with prior ZetaID v1 review work preserved at `memory/kestrel/conversations/2026-05-21-aaron-kestrel-claudeai-zeta-id-v1-review-...md` — this row is the v2 extension

## Scope

This row is the GENERATOR ONLY. The branch-protection rules, agent-state branch convention, and event-sourcing read/write layer are tracked in sibling rows (081KSNY2Z0008QG0R001K6HJ7Z, 081KSKBP80008QG0R000B3Y19A.14 from parent 081KSKBP80008QG0R000B3Y19A).

## Substrate-honest framing

POTENTIAL extension per operator 2026-05-28: *"all extension should be backloged and looked at as potential."* Not committed; not yet picked up. Filed for prioritization.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` (verbatim ferry; PR #5674)
