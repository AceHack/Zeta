---
id: 081KQZVQW0008QG0R001FG05RZ
priority: P1
status: open
title: "Coincidence detection as Rx join — DORA mechanism for detecting correlated events across trajectories"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [081KQZVQW0008QG0R002QZAFB2, 081KQZVQW0008QG0R000C35RNY]
decomposition: atomic
owners: [architect, performance-engineer]
type: feature
---

# 081KQZVQW0008QG0R001FG05RZ — Coincidence detection as Rx join (DORA mechanism)

## What

Build a coincidence detector that identifies when two or
more independent trajectories produce output simultaneously.
This is an Rx join operator (window + count) applied to the
factory's event stream. Coincidence = possible shared
upstream cause. DORA mechanism for detecting correlated
events.

Aaron 2026-05-07: "Both merged is an rx join that detects
coincidence" + "backlog that as your DORA mechanisms"

## The shape

```
Trajectory A produces event at time T
Trajectory B produces event at time T ± window
    ↓
Coincidence detected (join fired)
    ↓
Investigate: random timing or shared upstream cause?
    ↓
If shared cause → the trajectories have a hidden join
```

## Rx operator mapping

- `window(timeSpan)` — group events by time window
- `count` — how many events in each window
- Threshold: count > expected = coincidence signal
- Same operator Itron metering uses for grid event detection
  (two meters report anomalies simultaneously = shared grid event)

## DORA metrics this enables

- **Deployment frequency** — how often do trajectory outputs
  land simultaneously (coordinated or accidental?)
- **Lead time** — time between coincidence detection and
  cause identification
- **Change failure rate** — how often does coincidence detection
  produce false positives
- **MTTR** — how fast do we resolve the shared upstream cause

## Composes with

- 081KQZVQW0008QG0R002QZAFB2 (structure recognizer) — fingerprint the coincidence shape
- 081KQZVQW0008QG0R000C35RNY (backlog runner) — the runner's own event stream is input
- Reaqtor (reaqtive.net) — the Rx-at-scale framework this uses
- Itron metering — the concrete ancestor (grid event detection)
- DBSP D operator — coincidence IS differentiation on the joint stream
