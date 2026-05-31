# Phase 2.1 Observability and Conformance Hardening Plan

## Source

- `agentic-organization/docs/PHASE_2_PRODUCTION_AUTONOMY_CA.md`
- Phase: `2.1: Observability and Conformance Hardening`

## Goal

Make the production telemetry and conformance surfaces trustworthy enough to
drive optimizer and scheduling decisions. The first checkpoint closes the
lowest-level evidence gap: every composed cadence lane must emit `org.lane.tick`
spans and `org_lane_ticks_total` metrics through the production composition, not
only through direct unit calls to `runCadenceLane`.

## Checkpoint 1: Composed Lane Telemetry Completeness

### Tests First

Edit:

- `agentic-organization/apps/workers/test/org-cadence-composition.test.ts`

Add a test named:

```ts
test("org cadence composition passes telemetry through every composed lane", async () => {
  // construct composeOrgCadenceLoops with maxTicksPerLane: 1 and RecordingTelemetry
  // await handle.done
  // assert one org.lane.tick span and one org_lane_ticks_total metric per composed lane
})
```

Expected lane names:

- `work-os`
- `memory-maintenance`
- `change-control`
- `release-queue`
- `doc-maintenance`
- `conformance`
- `stale-reaction-plan-scan`
- `stranded-schedule-scan`
- `abandoned-run-binding-scan`
- `dead-letter-classifier`

Run the focused test and confirm it fails before production code changes:

```bash
cd agentic-organization
node --experimental-strip-types --test apps/workers/test/org-cadence-composition.test.ts
```

### Production Code

Edit:

- `agentic-organization/apps/workers/src/org-cadence-composition.ts`

Pass `input.telemetry` into every `runCadenceLane` call inside the `start`
helper:

```ts
...(input.telemetry ? { telemetry: input.telemetry } : {}),
```

### Verification

Run:

```bash
cd agentic-organization
node --experimental-strip-types --test apps/workers/test/org-cadence-composition.test.ts
npm run typecheck
npm test
```

Attempt KIND readiness proof:

```bash
kind get clusters
kubectl version --client=true
```

If a usable cluster exists, run the existing observability smoke proof for the
worker/LGTM stack. If KIND or Docker is unavailable, record that as an
environment blocker and keep the local test evidence.

## Checkpoint 2: LGTM Query Degraded Evidence

### Tests First

Edit:

- `agentic-organization/packages/observability/test/telemetry-query-port.test.ts`

Add a test proving LGTM HTTP failures are represented as typed degraded evidence,
not empty successful results.

### Production Code

Edit:

- `agentic-organization/packages/observability/src/telemetry-query-port.ts`
- dependent call sites under `packages/application/src/observe.ts` and
  `packages/application/src/decision-optimizer.ts`

Introduce a result envelope for telemetry query reads, or a companion
diagnostic method if preserving the existing array-returning query API is less
disruptive. The production invariant is that a failed Mimir/Tempo/Loki query is
distinguishable from a successful empty result.

## Checkpoint 3: Optimizer Requires Non-Degraded Telemetry Evidence

### Tests First

Edit:

- `agentic-organization/packages/application/test/decision-optimizer.test.ts`

Add tests proving telemetry-driven proposals do not ship when telemetry evidence
is missing, degraded, or empty for all requested query classes.

### Production Code

Edit:

- `agentic-organization/packages/application/src/decision-optimizer.ts`

Require telemetry evidence for telemetry-triggered proposals and carry typed
telemetry quality into the returned cycle result.

## Checkpoint 3.5: OTLP Metric Kind Fidelity

### Tests First

Edit:

- `agentic-organization/apps/workers/test/otlp-telemetry.test.ts`

Add a test proving `TelemetryMetricKind.Counter`, `TelemetryMetricKind.Gauge`,
and `TelemetryMetricKind.Histogram` serialize as distinct OTLP HTTP JSON metric
payloads, not a single `sum` shape.

### Production Code

Edit:

- `agentic-organization/apps/workers/src/adapters/otlp-telemetry.ts`

Map counters to monotonic `sum`, gauges to `gauge`, and scalar histogram samples
to `histogram` data points. This keeps DORA and review-latency distribution
telemetry queryable as the metric kind the application emitted.

## Checkpoint 4: Conformance Skip Ratchet

### Tests First

Edit:

- `agentic-organization/packages/application/test/conformance.test.ts`

Add tests for an explicit skip budget and for transition-context envelopes that
make context-sensitive transitions replayable.

### Production Code

Edit:

- `agentic-organization/packages/application/src/conformance.ts`

Fail or degrade when replay skips exceed the configured budget, and expose skip
reason counts as conformance evidence.

## Subagent Review Gate

After each checkpoint:

1. request a spec-compliance review against the CA phase text and this plan;
2. request a code-quality review for changed files only;
3. fix all material findings before moving to the next checkpoint.
