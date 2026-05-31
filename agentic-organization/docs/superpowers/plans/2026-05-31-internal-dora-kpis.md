# Internal DORA KPIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add internal-only DORA metrics as first-class project and initiative KPIs derived from org-native work tracking and change-control events.

**Architecture:** Keep DORA as a pure observability fold over `ChangeSet`, `WorkItem`, and `OrgEvent` records. Integrate the resulting `DoraMetrics` into `WorkBatchMetrics`, `ScopeMetrics`, and `observeForHat` so project/initiative delivery health appears beside existing completion, QA, and churn KPIs. Emit DORA samples through the existing `TelemetryPort` so LGTM dashboards and decision optimizers can query the same facts.

**Tech Stack:** TypeScript, Node 22 built-in test runner, existing `packages/domain`, `packages/observability`, and `packages/application` boundaries.

---

## File Structure

- Create `packages/observability/src/dora-metrics.ts`: internal DORA types, pure rollups, project/initiative grouping, and telemetry emission.
- Create `packages/observability/test/dora-metrics.test.ts`: tests for deployment frequency, lead time, changes-requested failure rate, MTTR, and project/initiative grouping.
- Modify `packages/observability/src/work-batch-metrics.ts`: add optional change-set input and a `dora` block to batch/scope rollups.
- Modify `packages/observability/src/index.ts`: export DORA types and helpers.
- Modify `packages/application/src/observe-for-hat.ts`: accept optional change sets and telemetry in `OrgWorkState`, pass change sets into batch KPI rollups, and emit DORA telemetry when requested.
- Modify `packages/application/test/observe-for-hat.test.ts`: assert DORA appears in hat readouts, aggregates across in-scope batches, and exports through telemetry.
- Modify `deploy/k8s/44-grafana.yaml` and `apps/workers/test/observability-k8s-manifest.test.ts`: expose internal DORA panels in the default LGTM stack.

## Task 1: Pure Internal DORA Rollup

- [x] **Step 1: Write failing tests**

Add tests that call `rollUpDoraMetrics` and prove:

- `ChangeSetApplied` counts as an internal deployment.
- lead time is `ChangeSetOpened` to `ChangeSetApplied`.
- any `ChangesRequested` on that change set counts as a change failure.
- MTTR is first `ChangesRequested` to `ChangeSetApplied`.
- grouping separates project and initiative scopes through the work item join.

Run: `node --experimental-strip-types --test packages/observability/test/dora-metrics.test.ts`

Expected before implementation: fails because `dora-metrics.ts` exports do not exist.

- [x] **Step 2: Implement minimal DORA fold**

Create `rollUpDoraMetrics`, `rollUpDoraMetricsByProject`, and `rollUpDoraMetricsByInitiative`. Use only internal records; ignore external projection state.

- [x] **Step 3: Run focused tests**

Run: `node --experimental-strip-types --test packages/observability/test/dora-metrics.test.ts`

Expected after implementation: all DORA tests pass.

## Task 2: Work Tracking KPI Integration

- [x] **Step 1: Write failing readout tests**

Extend `observe-for-hat.test.ts` to show an executive readout includes DORA metrics for in-scope initiative batches.

- [x] **Step 2: Thread optional change sets through work metrics**

Add optional `changeSets` to `rollUpBatchMetrics` and `OrgWorkState`; aggregate `dora` into `ScopeMetrics`.

- [x] **Step 3: Run focused tests**

Run: `node --experimental-strip-types --test packages/application/test/observe-for-hat.test.ts`

Expected after implementation: all readout tests pass.

- [x] **Step 4: Emit readout DORA telemetry when requested**

Add optional `telemetry` to `OrgWorkState`; `observeForHat` records per-batch and scope-rollup DORA metrics when provided.

## Task 3: DORA Telemetry Export

- [x] **Step 1: Write failing telemetry tests**

Assert `recordDoraMetricsTelemetry` emits:

- `org_dora_deployments_total`
- `org_dora_lead_time_ms`
- `org_dora_change_failure_ratio`
- `org_dora_mttr_ms`

with `agentic.organization.id`, `agentic.project.id`, and optional `agentic.initiative.id`.

- [x] **Step 2: Implement telemetry helper**

Use existing `TelemetryPort.recordMetric`; no new dependencies.

- [x] **Step 3: Run observability tests**

Run: `node --experimental-strip-types --test packages/observability/test/dora-metrics.test.ts`

Expected after implementation: all DORA telemetry tests pass.

## Task 4: Verification

## Task 4: LGTM Dashboard Integration

- [x] **Step 1: Write failing manifest test**

Assert the Grafana manifest contains panels and queries for deployment frequency, lead time, change failure ratio, and MTTR.

- [x] **Step 2: Add DORA panels**

Add Mimir-backed dashboard panels for the four internal DORA metrics.

- [x] **Step 3: Run focused manifest test**

Run: `node --experimental-strip-types --test apps/workers/test/observability-k8s-manifest.test.ts`

Expected after implementation: manifest test passes.

## Task 5: Verification

- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `git diff --check`.
- [x] Run the repo .NET gate and report SDK blockers if SDK `10.0.203` is still unavailable.

## Self-Review

- Spec coverage: internal-only DORA, work-tracking KPIs, project and initiative rollups, changes-requested failure signal, telemetry export, and LGTM dashboard projection are covered.
- Placeholder scan: no placeholder implementation steps remain.
- Type consistency: `DoraMetrics`, `DoraScope`, `rollUpDoraMetrics`, and `recordDoraMetricsTelemetry` are used consistently across tasks.
