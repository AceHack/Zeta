---
title: Complete Observability — LGTM Stack + 100% First-Class Tracing (for humans AND the self-improving org)
canonical_name: Agentic Organization
status: design
composes_with: OBSERVABILITY_AND_SELF_HEALING.md, UI_AND_OBSERVABILITY_CONCEPTS.md, ORCHESTRATION_MOAT_ROADMAP.md
date: 2026-05-31
---

# Complete Observability — LGTM + 100% First-Class Tracing

## 0. North star

> Every small thing that happens in the organization is **observable, traceable, and queryable**
> — by humans through Grafana, and by the **organization itself** through a telemetry read-path
> that feeds its own self-improvement loop. Observability is not an add-on for debugging; it is a
> **first-class product surface** that the AI org reads to enhance itself.

Two consumers, one substrate:

1. **Humans** — Grafana dashboards: "what is the org doing right now, where is it stuck, is it healthy?"
2. **The org itself** — the decision-optimizer (`packages/application/src/decision-optimizer.ts`,
   shipped with the moat) and org-intelligence read live telemetry (PromQL/TraceQL/LogQL) the way
   they already read the org_event ledger, and propose config/policy changes **through the org's own
   enforced change-control**. Telemetry closes the M3 self-improvement loop.

This is the "miles ahead" property made operational: because the org is already a deterministic,
replayable kernel, **a distributed trace of a work item from intake to merge is the literal execution
record**, and the conformance checker (`conformance.ts`) can be exported as a continuous metric.
Gastown (and most systems) scrape terminals and join flat logs by hand; we emit semantic, correlated,
queryable telemetry at the source.

## 1. Principles

1. **Everything emits.** Every command, every cadence-lane tick, every reaction-plan claim, every
   agent (Hermes) run, every NATS publish/consume, every Cockroach query, every change-control stage,
   every memory transition, every graph promotion, every conformance replay, every model-eval — emits
   a span + a metric + (when meaningful) a structured log. **No silent gaps.** A code path with no
   telemetry is a P1.
2. **The trace is the unit of truth.** A work item's whole life is ONE distributed trace
   (`intake → triage → ready → in_progress → review → release-queue → merged`), stitched across
   cadence lanes, NATS, reaction plans, and agent runs by propagated context.
3. **Semantic + infra, unified.** Infra telemetry (latency, errors) and **domain telemetry** (which
   hat, which gate, which org_event) live on the same spans via shared attribute keys.
4. **AI-first, not human-first.** Spans/metrics/logs are structured and queryable so the org can
   answer "why did this decision happen?" and "which hat/model is underperforming?" programmatically —
   dashboards are a human projection of the same data.
5. **Ports + adapters; hermetic tests.** A `TelemetryPort` is injected everywhere; unit tests get a
   `NoopTelemetry`, the cluster gets the real OTLP adapter. The 845 fast tests never touch a collector.
6. **The org_event ledger is the domain pillar** — a fourth, semantic pillar beside traces/metrics/logs.
   Every org_event maps to a span event + a structured log line, so the ledger and the trace agree.
7. **Config-as-data dashboards + alerts.** Grafana dashboards and alert rules are tenant config the org
   can author and change through change-control (per `tenant-config.ts` layered config) — the org can
   improve its own observability.
8. **Correlation by stable keys** (Section 3) so any pillar joins to any other in one query.
9. **Cost is telemetry.** Token/$ per hat per model is a first-class metric feeding model-eval (M3).
10. **Conformance is a metric.** The conformance pass-rate (legal-transition replay) is an org-health
    SLI — the org continuously proves it only took legal transitions, and that proof is graphable.

## 2. The stack — LGTM on our substrate

```
            instrumentation (OTel SDK, behind TelemetryPort)
worker pods ─────────────────────────────────────────────►  OTel Collector (deployment in kind)
                                                              │  (receivers: OTLP gRPC/HTTP)
                                                              │  (processors: batch, resource, tail-sample)
                                                              ▼
          ┌───────────────┬──────────────────┬───────────────┴────────────┐
          ▼               ▼                  ▼                            ▼
       Tempo            Mimir              Loki                    (org_event ledger
      (traces)        (metrics)           (logs)                   already in Cockroach —
          │               │                  │                     the domain pillar)
          └───────────────┴──────────┬───────┴───────────┬─────────────────┘
                                     ▼                   ▼
                                  Grafana          TelemetryQueryPort
                              (human dashboards)   (the org reads itself:
                                                    TraceQL / PromQL / LogQL)
```

- **L — Loki** (logs): structured JSON logs, every line tagged `trace_id`, `org_event_id`,
  `work_item_id`, `run_id`, `hat_assignment_id`. The existing `JsonWorkerTelemetrySink` becomes a Loki
  exporter.
- **G — Grafana** (dashboards + alerts, provisioned as code): org-health, lane-RED, work-item
  funnel, change-control queue, memory lifecycle, conformance pass-rate, cost-per-hat.
- **T — Tempo** (traces): the distributed traces; the work-item lifecycle trace is the flagship view.
- **M — Mimir** (metrics): Prometheus-compatible long-term metric store; RED + org gauges.
- **OTel Collector**: the single ingest point; tail-based sampling keeps 100% of error/slow traces +
  a sample of the rest. Backend-agnostic (swap Tempo→Jaeger, Mimir→Prometheus, Loki→anything OTLP).
- **org_event ledger** (`org_events`, migration V15): the **domain pillar** already shipped — the
  authoritative, replayable, kernel-checkable record. The other three pillars are the
  externalized, queryable projection of it plus the infra detail it doesn't carry.

## 3. The correlation model (stable keys on every signal)

A single set of resource + span attributes (reuse + extend `packages/observability/src/span-attributes.ts`):

| Key | Meaning | Pillar reach |
|---|---|---|
| `trace_id` / `span_id` | W3C trace context | the join key across all pillars |
| `org.id` | organization (tenant) | resource attribute on everything |
| `org.work_item_id` | the work item this serves | the lifecycle-trace spine |
| `org.initiative_id` / `org.project_id` | hierarchy | rollups |
| `org.hat_assignment_id` / `org.hat_id` | the acting authority | per-hat metrics, guardrail audit |
| `org.run_id` (Hermes) | the agent run | per-run cost + decision trace |
| `org.org_event_id` / `org.org_event_kind` | the domain event emitted | ledger↔trace bridge |
| `org.command_id` / `org.command_type` | the command | command RED |
| `org.change_set_id` / `org.stage_id` | change-control | release pipeline trace |
| `org.memory_id` | memory op | memory lifecycle |
| `org.reaction_plan_id` | reaction plan | self-healing trace |
| `org.lane` / `org.tick` | cadence lane | lane RED |
| `result.status` / `error.kind` | outcome | error budgets |

**Propagation across async boundaries** is the load-bearing detail:

- **NATS**: inject W3C `traceparent` into the `AgenticEventEnvelope.trace` (the envelope already carries
  a `CommandTrace`); the consumer extracts it so a published→consumed event is one continuous trace.
  Extend `packages/observability/src/nats-consumer-attributes.ts` to carry traceparent.
- **Reaction plans**: persist the originating `traceparent` on the `reaction_plans` row (a small column
  add, migration V21) so a leased executor on a later tick continues the same trace.
- **Hermes runs**: the run's root span links to the work-item lifecycle trace via `org.work_item_id`.

## 4. Span taxonomy — what gets a span (no gaps)

| Span (parent → child) | Source file | Key attributes |
|---|---|---|
| `org.command` (root for a sync command) | `command-pipeline.ts` | command_type, hat, result.status; child spans: authorize / idempotency / schedule-authority / handler / persist-effects |
| `org.lane.tick` | `cadence-lane.ts` + `org-cadence-lanes.ts` | lane, tick, degraded, failures |
| `org.workos.cycle` → `org.workitem.transition` | `org-cadence-lanes.ts`, work-os cycle | work_item_id, from→to, org_event_kind |
| `org.changecontrol.stage` | the review kernel (`change-control.ts` consumers) | change_set_id, stage_id, authority kind, gate outcome |
| `org.releasequeue.batch` → `…bisect` | `release-queue.ts` (moat G1) | batch size, bisect depth, culprit change_set_id |
| `org.memory.cycle` → `org.memory.transition` | memory maintenance lane | memory_id, phase from→to, weight |
| `org.graph.promote` | knowledge-graph construction | node/edge id, confidence from→to |
| `org.reaction.execute` | `reaction-plan-executor.ts` | reaction_plan_id, action type, attempt, claim outcome |
| `org.recovery.scan` | `recovery-scanners.ts` (moat G3) | scanner kind, candidates, incidents |
| `org.agent.run` (root for a Hermes run) → `org.agent.decide` / `org.tool.exec` | `orchestrate-run.ts`, sandbox | run_id, model, tokens, tool result |
| `org.nats.publish` / `org.nats.consume` | messaging adapters | subject, event_id, traceparent |
| `org.db.query` | cockroach adapters (auto-instrument `pg`) | statement digest, rows, duration |
| `org.conformance.replay` | `conformance.ts` (moat M1) | events replayed, illegal-count (MUST be 0) |
| `org.modeleval.run` / `org.optimizer.cycle` | `model-eval.ts`, `decision-optimizer.ts` (moat M3) | class A/B score, proposed change_set_id |

**Flagship view — the work-item lifecycle trace.** A single TraceQL query
`{ org.work_item_id = "wi-..." }` returns the whole life of a work item as one waterfall: intake →
each lane transition → the change-control stages → the release-queue batch → merged, with every agent
run and gate decision nested underneath. This is the "see every small thing" deliverable.

## 5. Metric taxonomy (RED + org SLIs)

- **RED per lane / command / provider**: `org_lane_ticks_total{lane,status}`,
  `org_command_duration_ms{command_type}` (histogram), `org_command_errors_total{command_type,error_kind}`.
- **Org-health gauges**: `org_workitems{state}`, `org_changesets{phase}`, `org_memory{tier,phase}`,
  `org_reaction_plans{status}`, `org_release_queue_depth`, `org_dead_letter_total`.
- **Liveness**: `org_control_plane_heartbeat_age_ms`, `org_agent_heartbeat_age_ms{agent}` (from the
  keep-alive lane + `agent_heartbeat`).
- **Conformance SLI** (moat M1): `org_conformance_pass_ratio` (1.0 = every replayed transition legal);
  alert if < 1.0 — that is a kernel-bypass P0.
- **Self-improvement**: `org_modeleval_score{model,hat,class}`, `org_optimizer_proposals_total`,
  `org_optimizer_applied_total` — the org's own learning rate, graphed.
- **Cost**: `org_agent_tokens_total{hat,model}`, `org_agent_cost_usd{hat,model}` — feeds model-downgrade.

## 6. Log taxonomy

Structured JSON only (no free text), every line carrying the correlation keys (Section 3). The existing
`apps/workers/src/adapters/json-worker-telemetry-sink.ts` is re-pointed at the Collector's OTLP-logs
receiver. **Every org_event is also a log line** (kind, subject, from→to, decision, evidence_refs) so
Loki and the ledger never disagree — and an operator (or the org) can `LogQL` the ledger live.

## 7. The implementation — ports + adapters

Keep the kernel pure and tests hermetic. One port, two adapters, reusing the existing schemas.

```ts
// packages/observability/src/telemetry-port.ts  (NEW — the seam)
export interface TelemetryPort {
  startSpan(name: string, attrs: SpanAttributes): Span;     // returns a handle with end()/setStatus()
  recordMetric(metric: MetricSample): void;                  // counter | gauge | histogram
  log(record: StructuredLogRecord): void;
  inject(carrier: Record<string,string>): void;              // W3C traceparent → carrier (NATS/reaction)
  extract(carrier: Record<string,string>): SpanContext | null;
}
```

- **`NoopTelemetry`** (in `packages/observability`) — default everywhere; unit tests use it; zero deps.
- **`OtlpTelemetry`** (in `apps/workers/src/adapters/otlp-telemetry.ts`) — wraps the OpenTelemetry
  Node SDK (`@opentelemetry/sdk-node`, OTLP exporters); built once in the worker composition and
  injected through the same DI that already threads `Clock`/`IdGenerator`. The existing
  `span-attributes.ts` / `worker-cycle-attributes.ts` / `nats-consumer-attributes.ts` /
  `workflow-visibility.ts` are the **schema** the adapter emits — they were built for exactly this.
- **Instrumentation is a decorator, not a rewrite.** The command pipeline gets wrapped once
  (`withTelemetry(pipeline)`); each cadence lane's `runOnce` is wrapped by `runCadenceLane` (one place);
  the reaction-plan executor and Hermes run get a span at their entry. Adding a provider/lane/handler
  inherits instrumentation for free — no new call sites, consistent with the kernel's open/closed rule.

`★ Design note:` because instrumentation lives at the **pipeline + lane + executor seams** (not
sprinkled per-handler), "100% coverage" is structural: a new command automatically gets `org.command`
spans, a new lane automatically gets `org.lane.tick` RED. The conformance checker (M1) can even assert
that every org_event in the ledger has a corresponding span (telemetry-completeness as a test).

## 8. The self-enhancement read-path (the AI org observes itself)

This is the part that makes observability first-class for the org, not just for humans.

```ts
// packages/observability/src/telemetry-query-port.ts  (NEW)
export interface TelemetryQueryPort {
  queryMetrics(promql: string, range: TimeRange): Promise<MetricSeries[]>;   // Mimir
  queryTraces(traceql: string, range: TimeRange): Promise<TraceSummary[]>;   // Tempo
  queryLogs(logql: string, range: TimeRange): Promise<LogLine[]>;            // Loki
}
```

- The **decision-optimizer** (`decision-optimizer.ts`, moat M3) already reads the org_event stream +
  KPI signals and proposes a `tenant-config` change **as a ChangeSet**. It now also reads
  `TelemetryQueryPort`: "hat X's review-gate p95 latency rose 3×" or "model Haiku's class-A score on
  triage dropped" become evidence in its proposals. Observability → evidence → enforced change-control
  → the org tunes itself.
- **Org-intelligence** (`org-intelligence.ts`) joins a service's trace history + graph neighborhood
  to answer "what changed before this regression?" — trace-augmented impact analysis.
- **"Explain this decision"** — given a work_item_id or run_id, fetch the trace and replay the
  org_events through the kernel (conformance) → a provable, human-and-machine-readable account of
  exactly what happened and that every step was legal.
- **Dashboards + alerts as config-as-data** — Grafana dashboards/alert rules live in `tenant-config`
  layers; the org can author a new alert ("page when conformance < 1.0") through change-control, so the
  org improves its own observability the same way it improves its own policy.

## 9. Phased implementation plan (each phase proven in KIND, per the handoff discipline)

| Phase | Deliverable | KIND proof |
|---|---|---|
| **OBS0** | `TelemetryPort` + `NoopTelemetry` + `OtlpTelemetry` (Node SDK); wire it through the worker composition; `deploy/k8s/` manifests for OTel Collector + Tempo + Mimir + Loki + Grafana | `deploy/run-observability-smoke.ts`: emit a span from the worker → assert it is queryable in Tempo via the in-cluster API |
| **OBS1** | Instrument the command pipeline + every cadence lane (spans + RED metrics) at the two seams | proof: drive a work-os cycle → assert `org.lane.tick` + `org.command` spans + `org_command_duration_ms` in Tempo/Mimir |
| **OBS2** | W3C trace-context propagation through NATS (envelope) + reaction-plans (V21 column) → the end-to-end **work-item lifecycle trace** | proof: publish→consume→react across a tick boundary → assert ONE trace spans all of it |
| **OBS3** | org_event → span-event + log bridge; re-point `json-worker-telemetry-sink` at Loki | proof: a transition's org_event_id appears on both the span and the Loki line |
| **OBS4** | Grafana dashboards-as-code (org-health, lane-RED, work-item funnel, change-control queue, conformance SLI) + alert rules; provision from `tenant-config` | proof: dashboards render against the live in-cluster data; a conformance<1.0 alert fires on an injected illegal event |
| **OBS5** | `TelemetryQueryPort` + feed the decision-optimizer/org-intelligence (the self-enhancement read-path) | proof: `deploy/run-telemetry-driven-optimizer.ts` — a synthetic latency regression in telemetry produces a reviewed optimizer ChangeSet |
| **OBS6** | Cost/token telemetry per hat per model → model-eval (M3) | proof: a run records `org_agent_tokens_total`; model-eval reads it to rank cost-per-correct |

Sequence rationale: OBS0 stands the stack; OBS1–OBS2 make every action a span and stitch the lifecycle
trace (the "see every small thing" core); OBS3 unifies the ledger; OBS4 gives humans Grafana; OBS5–OBS6
close the loop so the **org reads its own telemetry to self-enhance** — the whole point.

## 10. Deploy topology (kind)

New `deploy/k8s/` manifests (mirror the existing cockroach/nats/ollama/hindsight pattern):
`40-otel-collector.yaml`, `41-tempo.yaml`, `42-mimir.yaml`, `43-loki.yaml`, `44-grafana.yaml`
(Grafana datasources + dashboards provisioned via ConfigMap). The worker gets
`OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317` (+ resource attrs) in `30-worker.yaml`.
Resource-light single-replica configs for kind; the same manifests scale out for real clusters.

## 11. Why this is first-class for the AI org (not just dashboards)

- Telemetry is **semantic** (org-meaning attributes), **correlated** (one join key), **queryable by
  the org** (TelemetryQueryPort), and **provable** (conformance replay). That combination is what lets
  the organization reason about itself.
- The self-improvement loop becomes: **observe (telemetry) → decide (optimizer, with telemetry as
  evidence) → change (through enforced change-control) → observe the effect (telemetry again)** — a
  closed control loop where every step is itself observable and provably legal.
- Gastown can show a human a tmux pane. We give the **organization** a queryable, semantic, provable
  record of its own execution that it uses to get better — the operational form of "miles ahead."

## 12. Testing + SOLID discipline

- Unit tests inject `NoopTelemetry` — the 845 hermetic tests stay network-free and fast.
- Adapter/contract tests for `OtlpTelemetry` + `TelemetryQueryPort` are env-gated (like the 7 existing
  integration tests) and run against the in-cluster collector in CI's integration job.
- Every phase ends with a `deploy/run-*.ts` KIND proof printing a passing JSON PROOF report, on a
  rebuilt+redeployed worker image (per `HANDOFF_GOAL_ORCHESTRATION_MOAT.md` Section 7).
- One seam, two adapters; instrumentation at the pipeline/lane/executor boundaries (open/closed) — no
  bypasses, consistent with the kernel.

## 13. Cross-references

- `OBSERVABILITY_AND_SELF_HEALING.md` — the earlier self-healing design this implements at the
  telemetry layer.
- `UI_AND_OBSERVABILITY_CONCEPTS.md` — the UI projection of these signals.
- `ORCHESTRATION_MOAT_ROADMAP.md` — M1 conformance (the SLI here), M3 decision-optimizer (the
  self-enhancement consumer here), M2 simulator (replays these traces).
- `packages/observability/src/*` — the attribute schemas this wires a real SDK behind.
- `HANDOFF_GOAL_ORCHESTRATION_MOAT.md` §7 — the KIND-proof discipline every OBS phase follows.

## 14. The one-line goal

> Make the organization's entire execution — every command, tick, decision, event, query, and merge —
> a semantic, correlated, provable, queryable trace, so a human can see everything in Grafana **and the
> organization can read its own telemetry to enhance itself** through its own enforced change-control.
