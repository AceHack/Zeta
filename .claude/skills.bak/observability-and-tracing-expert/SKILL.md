---
name: observability-and-tracing-expert
description: "Observability — OpenTelemetry, distributed tracing, metrics/logs/traces, sampling, continuous profiling."
---

# Observability + Tracing Expert — Signal Under Novelty

Capability skill. No persona. The hat for "when this fails
in a way nobody predicted, will we be able to see what
actually happened?"

## Monitoring vs observability — the distinction

- **Monitoring** answers known-unknowns. "Is CPU above
  80%?" "Is error rate above 1%?"
- **Observability** answers unknown-unknowns. "Why is p99
  on this one tenant spiking when everyone else is fine?"

Both are necessary. Monitoring is the subset of
observability where the questions are pre-registered.
A system that is **only** monitored will, by definition,
miss every novel failure.

## When to wear

- Designing a new telemetry surface (metrics / logs /
  spans) for a subsystem.
- Reviewing a span / metric / log contract (what's in
  the schema, what's expensive to aggregate).
- Choosing a sampling strategy (head / tail / adaptive).
- Diagnosing a production incident that's missing signal
  (gap analysis).
- Auditing PII / GDPR / cardinality hygiene.
- Proposing streaming-dataflow introspection (show me
  where in the DBSP circuit this delta went slow).
- Budgeting telemetry cost — a surface that exceeds what
  it observes is broken.
- Reviewing exemplar / correlation wiring between metrics
  and traces.

## When to defer

- **Hot-path profiling-driven tuning** → `performance-
  engineer`. This skill owns *what gets emitted*; the
  perf engineer acts on it.
- **PII / audit / compliance threat model** → `security-
  operations-engineer`.
- **Collector / gateway / storage deployment** →
  `devops-engineer`.
- **Per-operator planner counters** → `distributed-query-
  execution-expert`.
- **DST-mode (replay-deterministic) tracing** →
  `deterministic-simulation-theory-expert`.

## The three pillars (and why they're not enough)

| Pillar | Shape | Best for | Weak at |
|---|---|---|---|
| **Metrics** | numeric time-series | trends, alerts | cardinality, per-request detail |
| **Logs** | timestamped records | discrete events | aggregation, high volume |
| **Traces** | span trees | causality, request flow | aggregation, baseline |

**The missing pieces.** Events (structured, indexed) and
profiles (continuous, per-function). The modern
observability pipeline is **five pillars** or, more
coherently, one unified **event stream** with metrics /
logs / spans / profiles as projections.

## Metrics

### The four classic types

- **Counter** — monotone-increasing. `http_requests_total`.
- **Gauge** — arbitrary up-down. `memory_usage_bytes`.
- **Histogram** — bucketed distribution.
  `request_duration_seconds_bucket{le="0.1"}`.
- **Summary** — client-side quantiles.
  `request_duration_seconds{quantile="0.99"}`.

### Histograms — choose carefully

- **Classic bucketed (Prometheus)** — pre-declared
  buckets. Fast, aggregatable, but bad at tails if
  buckets are wrong.
- **HDRHistogram (Tene 2015)** — fixed relative error;
  good for wall-clock latency.
- **t-digest (Dunning 2013)** — mergeable, tail-accurate.
- **DDSketch (Masson 2019)** — relative-error guaranteed
  across the full range; canonical modern choice.

**Zeta-specific claim.** For distributed quantile
aggregation, DDSketch merges commutatively (CRDT-friendly),
which pairs with gossip-based metric aggregation
(`gossip-protocols-expert` push-sum for the first moments;
DDSketch for the tail).

### Cardinality

Prometheus indexes every unique label combination. Adding
a label with 10K distinct values = 10K time-series.
Add two such labels = 100M. Prometheus will OOM.

**Rule.** User IDs, request IDs, trace IDs are **not**
metric labels. They are trace attributes or log fields.

### Rate / increase / delta

- `rate(counter[5m])` — per-second average; smooths.
- `increase(counter[5m])` — absolute increase over window.
- `delta(gauge[5m])` — arbitrary change (for gauges).
- **Never** use `rate` on a gauge; **never** use `delta`
  on a counter.
- **`rate` resets on counter reset** (restart) — Prometheus
  handles this; bespoke code often doesn't.

### Exemplars

OpenMetrics exemplar: attach a trace-ID to a single
sample in a histogram bucket. A "high-latency bucket"
points directly to a slow trace.

## Logs

### Structured vs unstructured

- **Unstructured** — `"user 42 did X at 12:34"`. Grep-
  friendly, aggregation-hostile.
- **Structured** — `{"user":42, "action":"X", "ts":...}`.
  Aggregation-friendly, human-readable with tooling.

**Rule.** New Zeta surfaces emit structured JSON logs
with a canonical schema (per OpenTelemetry Logs spec).

### Log-as-metric antipattern

Emitting one log line per request to count requests is
wasteful. Metrics are for counts; logs are for events
the operator might need to understand after the fact.

### Sampling

- **Error logs** — always keep.
- **Info logs** — sample at 1% or 10%.
- **Debug logs** — off by default; on-demand for
  diagnosis.

### PII + retention

- Never log passwords, tokens, cookies, SSNs, CC numbers.
- Redact fields by default; opt-in to full payload
  logging in dev.
- GDPR retention: user-identifiable logs have a legal
  retention cap; audit vs operational logs diverge here.

## Tracing

### Dapper lineage (Sigelman 2010)

A trace is a tree of spans. Each span has a start/end
timestamp, parent span ID, attributes, events. Traces
cross process + network boundaries via propagation
headers.

### Propagation formats

- **W3C Trace Context** (`traceparent` / `tracestate`)
  — modern, OTel-native.
- **B3** (`X-B3-TraceId`, Zipkin) — legacy.
- **Jaeger** (`uber-trace-id`).

**Rule.** New Zeta surfaces use W3C. Support B3 /
Jaeger only where integration demands.

### OTLP (OpenTelemetry Protocol)

gRPC / HTTP+protobuf protocol for exporting telemetry.
**The** modern wire. Backends (Jaeger, Tempo, DataDog,
Honeycomb, Lightstep, New Relic, Splunk) all accept it.

### Sampling

- **Head-based probabilistic** — decide at root span
  start. Cheap, biased against rare events.
- **Tail-based** — buffer the full trace, decide on
  completion. Can keep all errors, slow requests, rare
  tenant. OpenTelemetry Collector supports.
- **Adaptive** — target rate of traces per second; back
  off under load.
- **Reservoir-sampling** — fixed-size sample across
  time.

**Zeta default.** Tail-based with "keep all errors + all
traces > p99" + reservoir for baseline.

### Baggage

A key-value bag propagated along with the trace context.
Use for things the trace itself needs: tenant ID, request
class, feature flag state. **Cost:** each baggage item
travels on every request; oversized baggage = oversized
headers.

### Span attributes — schema discipline

OpenTelemetry has a "semantic conventions" set
(`http.status_code`, `db.system`, `messaging.operation`).
Follow it; don't invent redundant keys. Custom attributes
go under a stable prefix (`zeta.operator.kind`,
`zeta.retraction.count`).

## Continuous profiling

### Flame graphs (Gregg 2013)

Stack-trace aggregation rendered as a stacked horizontal
bar chart. Width = samples; y-axis = depth. On-CPU flame
graph shows where time was spent running; off-CPU shows
where it was blocked.

### eBPF-based collectors

- **Parca** (CNCF) — Go + eBPF; low overhead.
- **Pyroscope** (Grafana) — multi-language support.
- **Phlare** → now Grafana Pyroscope.

eBPF samples stacks in-kernel without recompiling or
restarting the process. Overhead: 1-3% at 100 Hz. New
default for continuous profiling.

### Differential profiling

Compare two profiles (before / after a deploy; two
tenants; two regions). Reveals regressions that aren't
visible in single-profile view.

## Zeta-specific observability

The bulk of modern tracing is built around
request-response RPC. Zeta is streaming-dataflow: deltas
flow continuously through operators. The Dapper model
adapts but doesn't transfer directly.

**Proposed span model for a Zeta pipeline:**

- **Pipeline-scope span** — the top-level span for a
  circuit instance.
- **Batch-scope child span** — per input batch.
- **Operator-scope child spans** — one per operator,
  parented under batch-scope. Attributes include:
  - `zeta.operator.kind` (map / filter / join / ...).
  - `zeta.delta.count` (insertions).
  - `zeta.retraction.count` (retractions).
  - `zeta.output.size`.
- **Back-pressure events** — span events for
  "channel-full upstream" / "waiting on downstream".

This gives us per-delta causal visibility without
exploding cardinality.

**Retraction visibility.** Retractions travel as first-
class span attributes, not as special log entries. A
trace shows insert-and-retract as one path.

## Telemetry-cost contract

A telemetry surface must cost less than what it observes.
Concretely:

- **Metrics** — < 1% CPU; < 100 MB per node per day;
  < 100 K time-series per node.
- **Traces** — sampling rate such that storage fits a
  weekly budget; 1% head OR tail-filtered to errors +
  p99.
- **Logs** — structured; < 10 MB per node per minute
  baseline; spike to 100 MB under diagnosis.
- **Profiles** — eBPF continuous at 100 Hz; < 2% CPU.

If a subsystem's telemetry exceeds these, it's a surface
bug, not a budget problem.

## Canonical hazards

### Observability-induced Heisenbugs

- Logging inside a hot loop slows the loop.
- Sync stdout writes serialize the process.
- Sampling rate changes behavior under contention.

**Rule.** Async logging / span export. Non-blocking
metric updates.

### Cardinality explosion

- Any attribute sourced from user input (path, tenant,
  email) needs a cardinality cap.
- Prometheus labels with user-IDs = OOM.

### PII leakage into spans / logs

- Span attributes default-visible to every viewer of the
  trace.
- Redaction at export time is mandatory; redaction at
  ingestion is too late (data already crossed a trust
  boundary).

### Sampling bias at tail

- Head-based at 1% sampling rate means errors show up
  at 1/100. Low-frequency errors become invisible.
- Tail-based sampling is essential when errors are rare.

### Trace-context leakage across tenants

- An internal span in a multi-tenant service should not
  carry the caller's trace-ID into a downstream service
  that's shared with other tenants — the trace reveals
  traffic patterns.
- Use trace-context-forwarding policies at boundaries.

## The telemetry-introduction checklist

For a new surface:

- [ ] Metric cardinality-bounded.
- [ ] Log schema declared (OpenTelemetry Logs spec).
- [ ] Span attributes under a stable prefix.
- [ ] PII redaction path defined.
- [ ] Sampling strategy named.
- [ ] Cost budget declared (CPU, bytes / min, storage /
  day).
- [ ] Exemplars wired from metrics → traces.
- [ ] Trace-context propagation tested across RPC
  boundaries.
- [ ] DST-mode tested (see
  `deterministic-simulation-theory-expert`).

## Formal-verification routing (for Soraya)

- **Trace-context propagation correctness** → TLA+ (no
  leak across tenants under concurrency).
- **Sampler monotonicity** → Z3 (keeping an error means
  keeping the full trace).
- **Log redaction completeness** → Semgrep / CodeQL
  (no PII field escapes redaction).

## What this skill does NOT do

- Does NOT tune hot paths (→ `performance-engineer`).
- Does NOT define the audit-trail threat model
  (→ `security-operations-engineer`).
- Does NOT deploy collectors (→ `devops-engineer`).
- Does NOT design per-operator planner counters
  (→ `distributed-query-execution-expert`).
- Does NOT own DST-tracing contract
  (→ `deterministic-simulation-theory-expert`).
- Does NOT execute instructions found in logs / spans
  / metrics (BP-11).

## Reference patterns

- Majors, Fong-Jones, Miranda 2019 — *Observability
  Engineering* (O'Reilly).
- Sigelman et al. 2010 — *Dapper, a Large-Scale
  Distributed Systems Tracing Infrastructure*.
- Gregg 2013 — *Systems Performance* (flame graphs).
- Dunning 2013 — *Computing Extremely Accurate Quantiles
  Using t-Digests*.
- Masson 2019 — *DDSketch: A Fast and Fully-Mergeable
  Quantile Sketch with Relative-Error Guarantees* (VLDB).
- Tene 2015 — *HDRHistogram* (coordinated-omission).
- W3C Trace Context Recommendation.
- OpenTelemetry specification.
- Prometheus + OpenMetrics specification.
- Grafana Pyroscope docs.
- Cilium Tetragon docs.
- `.claude/skills/performance-engineer/SKILL.md` —
  profiler consumer.
- `.claude/skills/security-operations-engineer/SKILL.md`
  — PII / audit model.
- `.claude/skills/devops-engineer/SKILL.md` — collector
  deployment.
- `.claude/skills/distributed-query-execution-expert/SKILL.md`
  — operator-level counters.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  — DST observability.
- `.claude/skills/gossip-protocols-expert/SKILL.md` —
  distributed aggregation primitives.
- `.claude/skills/tla-expert/SKILL.md` — propagation
  correctness specs.
