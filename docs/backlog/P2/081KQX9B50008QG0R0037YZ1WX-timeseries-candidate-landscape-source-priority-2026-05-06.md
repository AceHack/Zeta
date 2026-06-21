---
id: 081KQX9B50008QG0R0037YZ1WX
priority: P2
status: open
title: "Timeseries native-ZSet research - candidate landscape and source-priority filter"
created: 2026-05-06
last_updated: 2026-05-06
parent: 081KQGDBJ0008QG0R0004ACHJJ
depends_on: []
classification: buildable-now
type: feature
---

# 081KQX9B50008QG0R0037YZ1WX - Timeseries candidate landscape

Produce the candidate landscape for 081KQGDBJ0008QG0R0004ACHJJ without choosing a
winner yet.

## Work scope

Survey Prometheus, TimescaleDB, InfluxDB, VictoriaMetrics,
OpenTelemetry metrics backends, Apache candidates, Microsoft
Research candidates, and any current tier-1 through tier-5
candidate surfaced by live research.

## Acceptance criteria

- A research doc lists each candidate and current license /
  governance status.
- The dependency-source-priority filter is applied:
  open source, Microsoft OSS, CNCF, Apache, MIT, rejected
  proprietary.
- Every load-bearing project fact is verified against current
  upstream docs, papers, or project pages.
- The doc explicitly marks Prometheus as the good-citizen
  baseline rather than as the default final answer.
