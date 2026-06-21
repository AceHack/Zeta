---
id: 081KSNY2Z0008QG0R001K6HJ7Z
priority: P2
status: open
title: Git append-only state-persist TypeScript tool — event-sourcing layer for agent-loop substrate (per parent 081KSKBP80008QG0R000B3Y19A allocation)
effort: M
ask: aaron 2026-05-27 (parent allocation) + kestrel 2026-05-28 (architectural detail)
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSKBP80008QG0R001KK9WV6
  - 081KSNY2Z0008QG0R000V24M7E
  - 081KSNY2Z0008QG0R000ZNRFCE
  - 081KSKBP80008QG0R000B3Y19A.14
tags:
  - event-sourcing
  - append-only-git-persistence
  - agent-state-branches
  - no-pr-ceremony
  - lifecycle-reconstruction-via-left-fold
  - cqrs-pattern
  - zetaid-named-files-no-conflict
  - parent-allocated-subdecimal
  - potential-extension-not-committed
---

## What this row tracks

The 081KSNY2Z0008QG0R001K6HJ7Z slot allocated by the parent workflow-engine row. Kestrel 2026-05-28 ferry sketched the architectural detail.

Branch convention:

```text
main                                    — PR required, full review
release/*                               — PR required
agent-state/{persona}/{trajectory}/...  — direct push, no PR
agent-events/{date}/...                 — direct push, no PR
```

Event file path: `agent-state/{persona}/{trajectory}/events/YYYY/MM/DD/{zetaId}.json`

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/events/append.ts` exposes `appendEvent(event)` that:
  - Computes branch + path from event's persona + trajectory + ZetaID
  - Direct-pushes new file to the agent-state branch (no PR)
  - Returns the resulting commit SHA + push receipt
- `src/Core.TypeScript/workflow-engine/agent-loop/events/read.ts` exposes:
  - `readEventsForLifecycle(zetaId)` — walks the previous_zeta_id chain backward to reconstruct full history
  - `readEventsForTrajectory(trajectoryId)` — reads all events under a trajectory's branch in time order
  - `readEventsForPersona(persona, sinceIso)` — reads all events authored by a persona
- `src/Core.TypeScript/workflow-engine/agent-loop/events/reconstruct.ts` exposes `reconstructLifecycle(events)` — left-fold over events producing current WorkLifecycle state
- Event schema validated in pre-receive hook (cheap defense per good-actor model)
- Tests cover: append-read round-trip, chain reconstruction, concurrent writes via ZetaID-named files, schema validation rejection of malformed events

## Composes with

- 081KSKBP80008QG0R000B3Y19A.14 (branch protection: path-scoped append-only carve-out) — required for direct-push semantics
- 081KSNY2Z0008QG0R000V24M7E (ZetaID v2) — events use ZetaIDs as primary keys + filenames
- 081KSNY2Z0008QG0R000ZNRFCE (OTel composition) — events carry trace_id + span_id
- 081KSKBP80008QG0R001KK9WV6 (heartbeat folder substrate) — heartbeat events are one event_type; this layer generalizes the pattern

## Substrate-honest framing

POTENTIAL extension per operator 2026-05-28 standing direction. Filed for prioritization; the parent 081KSKBP80008QG0R000B3Y19A row pre-allocated this slot but the row file did not exist until this filing.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` § "The state storage pattern" + § "Reconstructing lifecycle state from events"
