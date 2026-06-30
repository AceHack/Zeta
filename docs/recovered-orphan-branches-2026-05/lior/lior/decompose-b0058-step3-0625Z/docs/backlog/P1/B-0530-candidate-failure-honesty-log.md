---
id: B-0530
priority: P1
status: open
title: Candidate-failure honesty log
tier: substrate-foundational-discipline
effort: S
ask: Aaron 2026-04-21 (decomposed from B-0058)
created: 2026-05-15
last_updated: 2026-05-15
decomposition: clean
parent: B-0058
children: []
depends_on: []
composes_with: []
tags: [ai-ethics, ai-safety, alignment, honesty-log, transparency]
type: friction-reducer
---

# B-0530 — Candidate-failure honesty log

Decomposed from B-0058 to allow atomic mechanization of the honesty log surface.

Candidates that fail the ethics+safety gate are recorded as failure-data on the honesty dashboard, NOT silently dropped. Rubber-stamping is the exact failure-mode the three-filter discipline exists to prevent — this gate extends that discipline into the ethics axis.

## Implementation Plan

- Create an honesty log template or use existing telemetry.
- Integrate the failure case into the candidate-adoption skill or gate.
