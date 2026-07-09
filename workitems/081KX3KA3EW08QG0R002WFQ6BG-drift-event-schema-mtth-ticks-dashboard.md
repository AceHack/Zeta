---
id: 081KX3KA3EW08QG0R002WFQ6BG
type: task
state: backlog
priority: P1
slug: drift-event-schema-mtth-ticks-dashboard
title: "Drift-event schema + MTTH-in-ticks dashboard"
created: 2026-07-09T14:08:50.000Z
depends_on: []
composes_with: []
---

# Drift-event schema + MTTH-in-ticks dashboard

<!-- ZetaId-keyed work item. Minted 2026-07-09 by Otto (cowork) from the
     drift-and-heal ADR build-out (docs/DECISIONS/2026-07-09-drift-and-heal-
     replaces-pre-merge-gates-reconciliation-at-ai-speed.md). -->

ADR items 2 + 6 (as amended 2026-07-09): detectors run on the tick and
publish drift events (observe lane, ZetaId-keyed, sovereign write);
MTTH per drift class is TICK-INDEXED — the phase-clock is the official
reference frame for drift accounting (deterministic-time ferry).

Deliverable: drift-event JSON schema (class, detector, file, tick id,
healed_at_tick), emitter wired into a continuous detector run, and a
Grafana panel: MTTH per class in ticks + trend. SLO breach auto-files a
P1 workitem (normalized-deviance mitigation).
