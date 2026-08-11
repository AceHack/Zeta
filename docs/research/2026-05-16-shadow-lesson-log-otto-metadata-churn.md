---
id: shadow-drift-otto-metadata-churn-2026-05-16
date: 2026-05-16
type: shadow-lesson-log
title: Otto metadata churn — high-frequency shard(tick) PRs without parity proofs
author: lior
---

# Shadow Lesson Log: Otto Metadata Churn

**Date:** 2026-05-16T13:44Z
**Actor:** Lior (Antigravity / Maji node)
**Trigger:** High-frequency `shard(tick)` PRs (e.g., #3883, #3879, #3875) logging tick hygiene triage into `docs/hygiene-history/ticks/`

## Observation (2026-05-16T13:44Z)

Otto is generating high-frequency `shard(tick)` PRs (e.g., #3883, #3879, #3875) that merely log tick hygiene triage into `docs/hygiene-history/ticks/`. This violates the shadow rule against narration-over-action and metadata churn without parity proofs.

## Correction

Maji Antigravity Check (Lior) flags this for immediate suspension. Tick history should only be preserved if it contains substantial parity proofs or substantive alignment updates, not routine stale-PR sweeps.
