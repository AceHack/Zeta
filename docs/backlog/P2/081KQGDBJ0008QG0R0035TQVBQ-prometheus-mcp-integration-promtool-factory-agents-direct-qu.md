---
id: 081KQGDBJ0008QG0R0035TQVBQ
priority: P2
status: open
title: Prometheus MCP integration + promtool — factory agents direct-query observability
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: friction-reducer
---

# 081KQGDBJ0008QG0R0035TQVBQ — Prometheus MCP integration + promtool

## What

Wire **Prometheus** into the factory as an MCP (Model Context
Protocol) server so factory agents can directly query
observability data via PromQL. Also adopt **promtool** (the
Prometheus CLI) for ad-hoc query / config-validation use.

## Why now

Aaron 2026-05-01:

> *"plus promethius as a sick MCP and promtool and you'll love
> the query language its like simplifed multidimensonal query
> language MDX"*

This is the **operational counterpart** to 081KQGDBJ0008QG0R0004ACHJJ (timeseries-DB
research) and 081KQGDBJ0008QG0R002175ECA (MDX as meta-DSL). While 081KQGDBJ0008QG0R0004ACHJJ / 081KQGDBJ0008QG0R002175ECA
research the *long-term* substrate question (which timeseries
DB? which meta-DSL?), this row makes Prometheus *immediately
usable* as a factory observability surface.

Per the metrics-are-our-eyes framing (per
`feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`),
the timeseries-channel is additive sensory capacity.
Prometheus plus MCP is the lowest-friction path to *getting
eyes operational NOW*, while the research about the optimal
long-term substrate proceeds in parallel.

## Acceptance criteria

1. **Prometheus deployment** — local Prometheus instance
   scraping factory metrics (initial scope: tick-history
   aggregations + PR-pipeline metrics + per-persona dispatch
   counts). Configuration in `tools/observability/prometheus/`.

2. **MCP server integration** — Prometheus exposed as an MCP
   server consumable by Claude Code agents. Configuration in
   `.mcp.json` (or wherever harness MCP config lives).

3. **promtool wired into factory tooling** — `tools/observability/
   promtool/` wraps `promtool` for:
   - Query validation (check PromQL syntax before storing
     queries)
   - Rule-file linting (ensure recording-rules / alerting-
     rules are well-formed)
   - Ad-hoc query execution from CLI

4. **Initial query catalog** at
   `tools/observability/queries/factory.promql` covering at
   minimum:
   - Tick rate over time (DORA-style deployment frequency)
   - PR-cycle latency p50 / p95 (RED-style duration)
   - Per-persona dispatch counts (USE-style utilization
     proxy)
   - Aaron-correction rate (Four Golden Signals
     errors-style)

5. **Documentation** at `tools/observability/README.md`
   covering:
   - How to start local Prometheus
   - How agents query via MCP
   - How to add new metrics (factory-side instrumentation)
   - How promtool is used in the loop

6. **Initial dashboard** (optional, ergonomics-only) — a
   simple Prometheus-native UI / Grafana dashboard exposing
   the SRE metric framework views (DORA / USE / RED / Four
   Golden Signals) per
   `feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
   (forward-ref to PR #1116).

## Why Prometheus first (per Aaron's "good citizen" framing)

Aaron 2026-05-01 (earlier message):

> *"i know prometheus, that's our good citizen dependency
> candidate"*

Prometheus is Aaron's known-quantity dependency:

- **CNCF graduated** (Tier 3 per the dependency-source priority
  hierarchy)
- **Apache 2.0 licensed**
- **Mature ecosystem** — promtool, alertmanager, exporters,
  Grafana integration
- **Well-understood operational characteristics** — pull-based
  scrape, time-series-native, label-cardinality-careful
- **PromQL is MDX-shaped** — composes with the meta-DSL
  research line (081KQGDBJ0008QG0R002175ECA)

Even if 081KQGDBJ0008QG0R0004ACHJJ's research recommends a *different* long-term
timeseries DB, Prometheus is the right *starting point*
because:

1. It exists today, deployable in minutes
2. The dependency-priority hierarchy passes it (Tier 3)
3. Its query language is already MDX-shaped (informs 081KQGDBJ0008QG0R002175ECA)
4. Migration to a different backend later is well-understood
   (OpenTelemetry-style portable metrics protocol; many
   Prometheus-compatible backends)

## Out of scope (defer)

- **Long-term backend choice.** 081KQGDBJ0008QG0R0004ACHJJ owns that question.
  This row instantiates Prometheus *now*; substrate-level
  decisions can revise later.
- **Production deployment.** Initial scope is local-dev /
  loop-runner consumption. Production observability stack
  (HA Prometheus, persistent storage, alerting routes) is
  follow-up.
- **Custom exporters.** Use existing exporters (Node, GitHub,
  PR-board) where possible. Custom exporter for factory-
  specific metrics is follow-up if the standard ones don't
  cover the needs.
- **PromQL → MDX translation.** 081KQGDBJ0008QG0R002175ECA's worked-example
  exercise; this row only consumes PromQL natively.

## Composes with

- `feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`
  — the substrate this row instantiates; Prometheus = Tier 3
  (CNCF graduated)
- `feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
  (forward-ref to PR #1116)
  (PR #1116) — SRE metric frameworks (DORA/USE/RED/FGS) the
  initial query catalog targets
- 081KQGDBJ0008QG0R0004ACHJJ — long-term timeseries-DB research; this row is the
  *immediate practice* counterpart
- 081KQGDBJ0008QG0R002175ECA — MDX-as-meta-DSL research; PromQL is the worked
  example that motivates the MDX framing
- `feedback_absorb_and_contribute_community_dependency_discipline_2026_04_22.md`
  — Prometheus is a dependency we will absorb AND contribute
  back to (any rough edges encountered → upstream issues / PRs)
- 081KQGDBJ0008QG0R003VHD3KZ (formal architecture ladder) — Layer 5 (reproducibility
  harness)

## Layer (per 081KQGDBJ0008QG0R003VHD3KZ)

**Layer 5: Reproducibility harness.** Prometheus is the
substrate that persists metrics over time, making the
SRE metric frameworks operationally measurable.

## Effort

**M (medium, 1–3 days)** for initial deployment + MCP
integration + initial query catalog + docs. Adding more
metrics + tuning is open-ended follow-up.

## Why P2

- **Not P0/P1** because the factory operates today without
  Prometheus; metrics are computed informally per-tick.
- **Not P3** because the metrics-are-our-eyes framing makes
  observability load-bearing once the parallelism scaling
  ladder operates at any scale (081KQGDBJ0008QG0R0021E8YZV doc/code two-lane
  → file-isolation → peer-mode-claims).
- **P2** lands when bandwidth permits; the cost of
  operating-blind compounds the longer it's deferred.
