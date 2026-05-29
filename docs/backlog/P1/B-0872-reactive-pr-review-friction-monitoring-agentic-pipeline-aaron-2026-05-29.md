---
id: B-0872
priority: P1
status: open
title: Reactive PR Review Friction Monitoring agentic pipeline — implements a push-based event observer stream in TypeScript that packages PR events into 128-bit ZetaID tokens for real-time Friction Coefficient (μ) calculation (operator 2026-05-29)
effort: L
ask: aaron 2026-05-29
created: 2026-05-29
last_updated: 2026-05-29
depends_on:
  - B-0858
  - B-0871
composes_with:
  - B-0159
  - B-0264
  - B-0570
tags: [telemetry, pr-reviews, observables, rxjs, 128-bit-id, zetaid, dbsp, dataflow, analytics]
---

## Operator framing 2026-05-29

> *"Can you writeup a friction report and ADR on how to monitor and reduce PR review friction over time with our gitnative lightlike 128 bit index ids and observables in ts?"*

## Existing substrate this composes with

### 1. V1 ZetaID Contract (`src/Core.TypeScript/zeta-id/zeta-id.ts`)

- 128-bit packed bit-vector generator.
- Category bits mapping defined in `registry/categories.yaml`.
- This row introduces Category `5` (FrictionTelemetry) and maps the location bits to specific friction types.

### 2. PR Gate Poller (`tools/github/poll-pr-gate.ts`)

- Scrapes checks, branch states, and review thread counts.
- This row wraps the poller's execution inside a push-based reactive stream.

### 3. Real-Time Telemetry Shards (`docs/agent-heartbeats/`)

- Lightweight, git-native, non-PR logs.
- This row uses a similar path-scoped direct-to-main push mechanism to record friction observations.

## Scope

### Sub-rows planned

- **B-0872.1** — Enlist Category `5` (FrictionTelemetry) in `registry/categories.yaml` and configure the TS `ZetaId` pack/unpack maps to support it.
- **B-0872.2** — Build the push-based PR event observer stream `fromPRWorldview()` in TypeScript (using RxJS or standard event-emitters) that listens to check-runs and review comment changes.
- **B-0872.3** — Implement the 128-bit `ZetaId` telemetry packer: maps raw PR event parameters (timestamp, severity, location, persona, categories) into a packed `ZetaId` observation.
- **B-0872.4** — Implement the Git-Native Telemetry Logger: writes these packed telemetry hex-tokens into `docs/agent-heartbeats/telemetry/` using direct-to-main path-scoped pushes to keep it out of the PR merge queue.
- **B-0872.5** — Build the Friction Coefficient ($\mu$) calculator: a pure TS utility that computes the dimensionless $\mu$ score for individual PRs by scanning these telemetry files.
- **B-0872.6** — Integrate with the local dashboard: exposes the computed real-time PR friction curves on the local HTML dashboard.

## Why P1

- Operator-directed explicitly 2026-05-29 ("lets write up and ADR")
- Essential diagnostic capability for a multi-agent software factory (we must measure friction to systematically reduce it)
- Leverages existing highly mature `ZetaId` and `agent-heartbeats` substrate with zero new heavy dependencies
