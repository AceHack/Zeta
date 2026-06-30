---
id: B-0690
renumbered_from: B-0677
priority: P1
status: open
title: "Manifesto citation counter script (mechanical adoption signals)"
tier: governance
effort: S
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [B-0525]
composes_with: []
tags: [manifesto, script, adoption-signal, hygiene]
type: script
---

# Manifesto citation counter script

## Origin

Decomposed from layer 1 of B-0525 (Manifesto constitutional-promotion readiness tracking).

## Goal

Define **mechanical adoption signals** — write a TS script that counts manifesto citations across the repo. This provides the internal measurement infrastructure to track critical-mass adoption.

## Steps

1. Create a script in `tools/hygiene/` (e.g. `audit-manifesto-citations.ts`).
2. Compose with `tools/hygiene/audit-rule-cross-refs.ts` pattern.
3. The script should search PR descriptions, commit messages, ADRs, and shadow logs for explicit citations of the manifesto.
4. Integrate this count into a regular tracking row or log.
