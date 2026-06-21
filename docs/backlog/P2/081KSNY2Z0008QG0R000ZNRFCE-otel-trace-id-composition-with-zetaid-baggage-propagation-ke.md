---
id: 081KSNY2Z0008QG0R000ZNRFCE
priority: P2
status: open
title: OTel trace-ID composition with ZetaID — baggage propagation alongside W3C Trace Context for agent-loop events
effort: M
ask: kestrel via aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R000V24M7E
  - 081KSKBP80008QG0R000B3Y19A
composes_with:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R000V24M7E
  - 081KSNY2Z0008QG0R000HENSVM
tags:
  - opentelemetry
  - otel-baggage-propagation
  - w3c-trace-context
  - trace-id-128-bit
  - zetaid-otel-link
  - observability-layer
  - three-options-recommended-baggage
  - composes-with-zetaid-v2
  - composes-with-event-sourcing
  - potential-extension-not-committed
---

## What this row tracks

Wire OpenTelemetry trace-IDs through the agent-loop substrate so every state-machine transition + every WorkLifecycle event carries observability context. Per Kestrel 2026-05-28 ferry, three options were sketched:

| Option | Description | Tradeoff |
|---|---|---|
| **A** | ZetaID == OTel trace-ID (use trace-ID as ZetaID directly) | Composes natively with OTel tooling; loses queryable-structured-bits property |
| **B** (recommended) | ZetaID separate; propagate via OTel baggage alongside trace-ID | ZetaIDs queryable by structure; traces queryable by trace-ID; linked via baggage |
| **C** | Encode structured bits into W3C Trace Context trace-ID itself | Composes most cleanly; requires care around W3C validity (no all-zero, no all-ones) |

## Acceptance criteria

- `src/Core.TypeScript/workflow-engine/agent-loop/otel.ts` exposes `withTrace(zetaId, fn)` helper that:
  - Creates/joins a W3C Trace Context for the current operation
  - Sets baggage entries linking `zetaId` → current trace
  - Runs `fn` within the trace scope
- Every event emitted via `appendEvent` (081KSNY2Z0008QG0R001K6HJ7Z) carries both `zeta_id` AND `trace_id` + `span_id`
- `@opentelemetry/api` integrated as TS dependency; OTLP exporter configurable via env
- Tests cover: baggage propagation across async boundaries; trace-ID extraction from agent-loop events; round-trip ZetaID ↔ trace-ID linkage
- README documents the three options + why Option B was selected

## Scope

This row is the OTEL WIRING ONLY. ZetaID generation lives in 081KSNY2Z0008QG0R000V24M7E; event-sourcing in 081KSNY2Z0008QG0R001K6HJ7Z; observability backend selection is operator-decision.

## Substrate-honest framing

POTENTIAL extension per operator 2026-05-28 standing direction. Not committed; filed for prioritization.

## Full reasoning

`memory/kestrel/conversations/2026-05-28-kestrel-zetaid-128bit-structured-encoding-event-sourcing-without-pr-ceremony-otel-trace-composition-two-level-state-machine-aaron-forwarded.md` § "OTel trace IDs travelling along"
