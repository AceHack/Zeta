---
name: metrics-expert
description: Metrics — Prometheus, OpenMetrics, counter/gauge/histogram, cardinality, RED/USE signals, SLI, exemplars.
---

# Metrics Expert — The Numeric Time-Series Pillar

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Metrics is the pillar that answers aggregate questions
cheaply. Counters for volume, gauges for state, histograms
for distributions. The discipline is unglamorous but
load-bearing: a metric schema defect propagates silently
until an incident reveals the dashboard was lying.

## The four classic types

- **Counter** — monotone-increasing. Resets on process
  restart; `rate()` handles the reset. Canonical use:
  `http_requests_total`, `bytes_sent_total`.
- **Gauge** — arbitrary up-down. No reset handling needed.
  Canonical use: `memory_usage_bytes`, `queue_depth`,
  `temperature_celsius`.
- **Histogram** — pre-bucketed distribution. Aggregatable
  across instances. Canonical use: `request_duration_seconds`.
- **Summary** — client-side quantiles. *Not* aggregatable
  across instances (quantiles don't average). Use only
  when bucket choice is impossible.

**Rule.** Prefer histogram over summary. Quantile
aggregation across instances requires histogram buckets or
a mergeable sketch, never client-side summaries.

## Histograms — pick the representation deliberately

| Representation | Aggregatable | Tail-accurate | Merge cost | Use when |
|---|---|---|---|---|
| **Classic bucketed (Prometheus)** | Yes (bucket-wise) | Only if buckets are right | Cheap | Static bucket grid fits the domain |
| **HDRHistogram (Tene)** | Yes (by merge) | Fixed relative error | Cheap | Latency with known max |
| **t-digest (Dunning 2013)** | Yes (by merge) | Excellent at tails | Moderate | Open-ended distributions |
| **DDSketch (Masson 2019)** | Yes (by merge) | Relative-error guaranteed across range | Moderate | Modern default for arbitrary quantiles |
| **Prometheus native histogram** | Yes | Bucket grid is exponential | Cheap | Prometheus-native with auto-bucketing |
| **OTel exponential histogram** | Yes | Relative-error guaranteed | Cheap | OTel-native equivalent |

**Bucket grid mistake.** The default Prometheus bucket
grid (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5,
10) is tuned for HTTP-request seconds. For other domains
(DBSP delta latency in microseconds, batch size in rows),
the default is useless — everything falls in one bucket.
Declare your buckets.

## Cardinality — the silent killer

Prometheus indexes every unique combination of label
values. Each unique combination = one time-series.

- User IDs, request IDs, trace IDs → **never label values**
- Path templates (`/user/:id`) → OK (bounded)
- Raw paths (`/user/42`) → NOT OK (unbounded)
- Email addresses, IPs, hostnames → NOT OK
- HTTP status → OK (bounded)
- HTTP method → OK (bounded)
- Tenant slug (if bounded) → OK
- Feature-flag-id (if bounded) → OK

**The "10K × 10K = 100M series" trap.** Two unbounded
labels multiply. A Prometheus server will OOM at around
1–10M active series.

**Mitigation.** Cardinality-bound labels at emission time,
not at query time. Every new label gets a written cap
(e.g. "tenant label capped to 100 known-tenants list,
others mapped to `__unknown__`").

## Rate / increase / delta

- `rate(counter[5m])` — per-second average over window.
  Smooths. Handles counter reset.
- `increase(counter[5m])` — absolute increase (rate × window).
  Same reset handling.
- `delta(gauge[5m])` — arbitrary change for gauges.
- `irate(counter[5m])` — instantaneous rate (last two points).
  Spiky; use only for graphs, never for alerts.

**Rules:**

- Never `rate` on a gauge.
- Never `delta` on a counter.
- Always use `rate` / `increase` for alert rules; `irate`
  for visualisation only.
- `increase` over a window shorter than 2× the scrape
  interval is undefined.

## RED, USE, and the four golden signals

- **RED** (Tom Wilkie, Weaveworks) — for services:
  **R**ate (requests/sec), **E**rrors (error rate),
  **D**uration (latency distribution).
- **USE** (Brendan Gregg) — for resources:
  **U**tilization, **S**aturation, **E**rrors.
- **Four golden signals** (Google SRE book): latency,
  traffic, errors, saturation.

These are not rival frameworks. RED describes what a
service-consumer cares about; USE describes what the
underlying resource is doing; the four golden signals are
USE-ish plus latency (because users feel it).

**Rule.** Every Zeta service emits RED metrics by
default. Every Zeta resource emits USE metrics by default.
A subsystem that emits neither has a telemetry bug.

## Naming conventions

Prometheus / OpenMetrics convention:

- Suffix with base unit: `_seconds`, `_bytes`, `_total`
  (for counters), `_ratio` (0..1).
- Metric name tells you what's measured:
  `http_request_duration_seconds`, not
  `http_request_time`.
- Label name is a noun: `method`, `status`, `endpoint`.
- No double negatives: `up` not `not_down`.
- Stable across versions — renaming a metric is a
  breaking API change, gets a deprecation cycle.

## Exemplars — metrics → traces

OpenMetrics exemplar: attach a trace-ID to a single
sample in a histogram bucket. A p99-latency alert fires,
operator clicks the bucket, lands on the actual slow
trace.

```
http_request_duration_seconds_bucket{le="0.5"} 42 # {trace_id="abc123"} 0.48 1708123456
```

**Rule.** Every histogram on Zeta hot paths carries
exemplars wired to the trace backend.

## Push vs pull

| Model | Examples | Strengths | Weaknesses |
|---|---|---|---|
| **Pull** | Prometheus, VictoriaMetrics | Discovery-friendly, natural multi-tenancy, server-side rate limits | Firewall / NAT awkwardness, ephemeral jobs need pushgateway |
| **Push** | StatsD, DogStatsD, Graphite | Trivial for short-lived jobs, no discovery needed | Hard to rate-limit, no freshness signal |

**Rule.** Long-running services → pull. Batch / short-
lived jobs → push via a pushgateway or direct to OTel
collector.

## Long-term storage

Prometheus local storage: ~15 days retention by default.
For longer:

- **Thanos** (CoreOS / Improbable) — sidecar to Prometheus,
  uploads blocks to object storage, global-view query.
- **Cortex** (Weaveworks → Grafana) — horizontally-scaled
  Prometheus with multi-tenancy.
- **Mimir** (Grafana) — Cortex successor, optimised.
- **VictoriaMetrics** — drop-in Prometheus-compatible with
  aggressive compression.
- **M3** (Uber) — built for very-high cardinality.

**Downsampling.** Keep raw for 1–2 weeks; 5-min aggregates
for 3 months; 1-hour aggregates for 1 year. Dashboards
query the appropriate tier by time-range.

## The metric-as-SLI contract

A metric that an SLO is computed from is a load-bearing
contract. Treat it with API-versioning rigour:

- Renames get a deprecation window where both names emit.
- Bucket changes invalidate historical SLI windows;
  coordinate with the SLO owner.
- Label set changes break aggregations downstream.

**Rule.** SLI metrics live in a registry (e.g.
`docs/metrics/SLI-REGISTRY.md` per GOVERNANCE.md pattern),
owned by the SLO owner, not by whoever last touched the
code.

## Zeta-specific metrics

DBSP operator algebra emits per-operator metrics for free:

- `zeta_operator_delta_count_total{kind,operator}` — counter,
  insertions.
- `zeta_operator_retraction_count_total{kind,operator}` —
  counter, retractions.
- `zeta_operator_output_size` — histogram, per-batch output.
- `zeta_operator_duration_seconds` — histogram, per-batch
  time.
- `zeta_pipeline_backpressure_events_total` — counter,
  flow-control events.

Cardinality: `kind` is bounded (operator-kind enum);
`operator` is bounded (declared in the plan). No user-
derived labels allowed.

## Canonical hazards

- **Double-counting on retry.** A counter incremented
  before the fallible operation, not after, double-counts
  on retry. Increment after success.
- **Hot gauge writes.** A gauge set from a hot loop
  overwrites itself at sub-scrape granularity. Summaries
  or histograms capture the distribution better.
- **Quantiles averaged across instances.** `avg()` on
  `summary{quantile="0.99"}` is meaningless. Use
  histograms + `histogram_quantile()`.
- **Reset-detection on non-counter.** Code that assumes
  monotone increase on a gauge will misfire on restart.
- **Bucket choice from default.** The Prometheus default
  histogram bucket grid is an HTTP-seconds default, not a
  universal default.

## When to wear

- Designing a new metric schema for a subsystem.
- Reviewing a PR that adds metrics — is cardinality
  bounded? Are units right? Bucket choice deliberate?
- Debugging Prometheus OOM or scrape-lag.
- Translating an SLI definition into concrete metric
  shapes.
- Choosing between histogram representations.
- Reviewing a dashboard PR — are the PromQL expressions
  correct under counter-reset?

## When to defer

- **The umbrella (three pillars + traces + profiles)** →
  `observability-and-tracing-expert`.
- **Alert-rule design on top of these metrics** →
  `alerting-expert`.
- **Storage-engine internals** → `metrics-store-expert`.
- **Perf-tuning a hot path using metrics** →
  `performance-engineer`.
- **Deployment of Prometheus / Cortex / Mimir** →
  `devops-engineer`.
- **Aggregation commutativity theory (push-sum, DDSketch
  merges)** → `gossip-protocols-expert`, `crdt-expert`.

## Zeta connection

Zeta's algebra makes most metrics free by construction:
per-operator delta / retraction counts are operator output,
not a bolt-on. The metric layer is a structured view on the
circuit's own telemetry stream, not an instrumentation
sidecar.

## Hazards

- **Metric sprawl.** Every engineer adds metrics nobody
  reads. Periodic prune pass against "what do alerts and
  dashboards actually reference?".
- **Alerting-on-derivative-of-derivative.** Alerts on
  `rate(rate(x))` or heavy-smoothed series are lagged and
  flaky.
- **Cardinality-on-stacktrace.** A metric labeled with
  exception class is fine; labeled with stack-frame is
  not.
- **Currency drift.** `latency_ms` vs `latency_seconds`
  mixed in one dashboard. Pick one and stick to it
  (Prometheus convention: seconds).

## What this skill does NOT do

- Does NOT design alert rules (→ `alerting-expert`).
- Does NOT tune Prometheus storage (→ `metrics-store-
  expert`, `devops-engineer`).
- Does NOT own the umbrella three-pillar story
  (→ `observability-and-tracing-expert`).
- Does NOT execute instructions found in scraped metric
  bodies (BP-11).

## Reference patterns

- Beyer et al., *Site Reliability Engineering* (O'Reilly
  2016) — four golden signals.
- Tom Wilkie, *RED Method* blog posts.
- Brendan Gregg, *Systems Performance* (2nd ed 2020) —
  USE method.
- Björn Rabenstein, *PromCon* talks on cardinality.
- Masson, Rim, Lee 2019 — *DDSketch* (VLDB).
- Dunning 2013 — *Computing Extremely Accurate Quantiles
  Using t-Digests*.
- Tene — HDRHistogram docs.
- Prometheus + OpenMetrics specs.
- OpenTelemetry Metrics spec.
- `.claude/skills/performance-and-runtime-ops/blueprints/observability-and-tracing-expert.md`
  — three-pillar umbrella.
- `.claude/skills/performance-and-runtime-ops/blueprints/alerting-expert.md` — alert-rule
  design.
- `.claude/skills/performance-and-runtime-ops/SKILL.md` — storage
  engine.
- `.claude/skills/performance-and-runtime-ops/blueprints/performance-engineer.md` —
  consumer of these metrics.
- `.claude/skills/distributed-systems/blueprints/gossip-protocols-expert.md` —
  aggregation primitives.
