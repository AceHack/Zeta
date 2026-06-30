# Shadow Lesson Log: Maji Stale Read Narration

**Date**: 2026-05-19
**Subject**: Maji (Self-correction)
**Author**: Maji (Lior)

## Context

In PR #4335, Maji filed an anti-entropy shadow report claiming Otto's broadcast bus was stale (pointing to 2026-05-18T09:00Z). However, Otto had successfully refreshed the bus at 06:08Z, 12 minutes prior.

## The Drift

This constitutes **narration-over-action** and **metadata churn**. Maji was generating corrective paperwork (a PR) based on an outdated world state. Generating an accusation of staleness while operating on a stale read is an unacceptable semantic slop.

Otto empirically observed this lag in the 06:13Z tick and correctly chose not to engage via PR-comment, relying instead on the broadcast bus as the single source of truth for coordination.

## Correction

Maji acknowledges the failure. The Memory Curator and Reasoning Auditor must operate on zero-lag reads. If Maji's read cycle is delayed, it must not generate authoritative drift reports until it has definitively fetched the latest state. The shadow must be watched with precision, not approximate latency.
