# Agentic Org LGTM Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `docs/OBSERVABILITY_LGTM_STACK_DESIGN.md` as first-class, correlated traces, metrics, logs, and query surfaces for the agentic organization runtime.

**Architecture:** Add a dependency-free `TelemetryPort` in `packages/observability`, then wire it through the command, cadence, NATS, worker-runtime, and org-event seams. Keep tests hermetic with `NoopTelemetry` and `RecordingTelemetry`; expose a worker-side OTLP HTTP adapter and deploy LGTM manifests for KIND.

**Tech Stack:** TypeScript, Node 22 built-in test runner, existing package boundaries, OTLP HTTP JSON, Kubernetes manifests for OTel Collector, Tempo, Mimir, Loki, and Grafana.

---

## File Structure

- Create `packages/observability/src/telemetry-port.ts`: telemetry contract, span handle, metric/log types, `NoopTelemetry`, `RecordingTelemetry`, W3C trace-context helpers.
- Create `packages/observability/test/telemetry-port.test.ts`: verifies no-op safety, recording semantics, traceparent injection/extraction.
- Modify `packages/observability/src/index.ts`: export telemetry contract and helpers.
- Modify `packages/application/src/command-pipeline.ts`: optional `telemetry` dependency wraps command execution in `org.command` span and RED metrics.
- Modify `packages/application/test/command-pipeline.test.ts`: asserts command spans and metrics for accepted, rejected, and replayed commands.
- Modify `apps/workers/src/cadence-lane.ts`: optional `telemetry` input wraps every tick in `org.lane.tick`.
- Modify `apps/workers/test/cadence-lane.test.ts`: asserts tick span/metric coverage for success, degraded, and thrown ticks.
- Modify `packages/messaging-nats/src/nats-jetstream-event-publisher.ts`: optional telemetry starts `org.nats.publish`, injects `traceparent`, and records publish metrics.
- Modify `packages/messaging-nats/src/nats-jetstream-event-consumer.ts`: optional telemetry extracts `traceparent`, starts `org.nats.consume`, and records outcome metrics/logs.
- Modify `packages/messaging-nats/test/*.test.ts`: asserts traceparent is carried and consume outcomes are observed.
- Create `apps/workers/src/adapters/otlp-telemetry.ts`: worker adapter that posts traces, metrics, and logs to OTLP HTTP endpoints using `fetch`.
- Create `apps/workers/test/otlp-telemetry.test.ts`: asserts the adapter emits valid OTLP JSON to `/v1/traces`, `/v1/metrics`, `/v1/logs`.
- Modify `apps/workers/src/config.ts`, `main.ts`, and `30-worker.yaml`: parse `OTEL_EXPORTER_OTLP_ENDPOINT`, create real telemetry when configured, otherwise use no-op/JSON fallback.
- Add `deploy/k8s/40-otel-collector.yaml`, `41-tempo.yaml`, `42-mimir.yaml`, `43-loki.yaml`, `44-grafana.yaml`: KIND-light LGTM stack.
- Add `deploy/run-observability-smoke.ts`: emits a probe span and checks collector/Tempo queryability when the stack is running.

## Task 1: Core Telemetry Port

- [x] **Step 1: Write failing telemetry-port tests**

Run: `node --experimental-strip-types --test packages/observability/test/telemetry-port.test.ts`

Expected before implementation: fails because `telemetry-port.ts` exports do not exist.

- [x] **Step 2: Implement `TelemetryPort`, `NoopTelemetry`, `RecordingTelemetry`, and W3C helpers**

The API must support `startSpan`, `recordMetric`, `log`, `inject`, and `extract`; `NoopTelemetry` must never throw; `RecordingTelemetry` must expose arrays for assertions.

- [x] **Step 3: Run focused tests**

Run: `node --experimental-strip-types --test packages/observability/test/telemetry-port.test.ts`

Expected after implementation: all tests pass.

## Task 2: Command Pipeline Telemetry

- [x] **Step 1: Write failing command-pipeline tests**

Add tests showing `createCommandPipeline({ telemetry })` records an `org.command` span, `org_command_duration_ms` histogram, and status/error attributes for accepted and rejected commands.

- [x] **Step 2: Add optional telemetry dependency**

Default to `NoopTelemetry`; wrap `executeCommand` at the public seam so every handler inherits command telemetry without per-handler instrumentation.

- [x] **Step 3: Run command-pipeline tests**

Run: `node --experimental-strip-types --test packages/application/test/command-pipeline.test.ts`

Expected after implementation: all command-pipeline tests pass.

## Task 3: Cadence Lane Telemetry

- [x] **Step 1: Write failing cadence-lane tests**

Assert every tick records one `org.lane.tick` span and one `org_lane_ticks_total` counter with lane, tick, status, and failure count.

- [x] **Step 2: Instrument `runCadenceLane`**

Add optional telemetry to `RunCadenceLaneInput`; preserve failure isolation and ensure thrown ticks still end spans with error status.

- [x] **Step 3: Run cadence tests**

Run: `node --experimental-strip-types --test apps/workers/test/cadence-lane.test.ts`

Expected after implementation: all cadence-lane tests pass.

## Task 4: NATS Trace Propagation

- [x] **Step 1: Write failing publish/consume tests**

Assert publisher headers include W3C `traceparent`; assert consumer extracts it and records `org.nats.consume` spans for processed, duplicate, invalid, payload-conflict, and failure paths.

- [x] **Step 2: Add optional telemetry to publisher and consumer**

Inject/extract through message headers while preserving existing `Nats-Msg-*` headers and dead-letter behavior.

- [x] **Step 3: Run messaging tests**

Run: `node --experimental-strip-types --test packages/messaging-nats/test/*.test.ts`

Expected after implementation: all messaging-nats tests pass.

## Task 5: OTLP Worker Adapter

- [x] **Step 1: Write failing adapter tests**

Use a fake `fetch` function and assert spans, metrics, and logs post to the correct OTLP HTTP JSON endpoints with resource attributes.

- [x] **Step 2: Implement `createOtlpTelemetry`**

Use Node 22 `fetch`; do not add npm dependencies. Adapter failures must be swallowed and observable through an internal failed-export counter/log record, never crash worker code.

- [x] **Step 3: Run adapter tests**

Run: `node --experimental-strip-types --test apps/workers/test/otlp-telemetry.test.ts`

Expected after implementation: all adapter tests pass.

## Task 6: Worker Composition and Config

- [x] **Step 1: Write failing config/main tests**

Assert `OTEL_EXPORTER_OTLP_ENDPOINT` is optional; when present, worker composition receives an OTLP-backed telemetry sink/port.

- [x] **Step 2: Wire telemetry through worker main**

Parse the endpoint and set `OTEL_SERVICE_NAME=agentic-org-worker` resource attributes in deployment config.

- [x] **Step 3: Run worker tests**

Run: `node --experimental-strip-types --test apps/workers/test/main.test.ts apps/workers/test/worker-runtime.test.ts`

Expected after implementation: all worker tests pass.

## Task 7: KIND LGTM Stack and Smoke Proof

- [x] **Step 1: Add Kubernetes manifests**

Deploy single-replica OTel Collector, Tempo, Mimir, Loki, Grafana, Grafana datasources, and a minimal org-health dashboard ConfigMap.

- [x] **Step 2: Add smoke runner**

`deploy/run-observability-smoke.ts` emits a probe span through the configured endpoint and prints a JSON proof with `spanExported`, `traceQueryable`, and `dashboardConfigured`.

- [x] **Step 3: Run static checks**

Run: `node --experimental-strip-types --test packages/*/test/**/*.test.ts apps/*/test/**/*.test.ts`

Run: `npm run typecheck`

Expected after implementation: test suite and typecheck pass.

## Self-Review

- Spec coverage: OBS0 through OBS4 are covered directly. Additional OBS2/OBS6 coverage landed for durable reaction-plan traceparent continuity, `org_event` projection telemetry, `org.db.query` spans, `org.hermes.run` spans, `org_conformance_pass_ratio`, and agent model token/cost metrics. OBS5 has a `TelemetryQueryPort`, a recording adapter used by the decision optimizer, and a live Tempo/Mimir/Loki HTTP query adapter; cluster-backed smoke still requires running KIND/LGTM services.
- Placeholder scan: no `TODO`, `TBD`, or vague error-handling steps remain.
- Type consistency: the same `TelemetryPort`, `TelemetrySpan`, `MetricSample`, and `StructuredLogRecord` names are used throughout the plan.
- Verification: `npm run typecheck` passes; `npm test` passes with live Cockroach/NATS tests skipped when env vars are unset. The repo-level .NET gate is currently blocked by missing SDK `10.0.203` on this machine.
