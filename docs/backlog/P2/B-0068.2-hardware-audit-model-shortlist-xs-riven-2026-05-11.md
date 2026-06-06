---
id: B-0068.2
zetaid: 081KRA5AR0008QG0R002TPJ4NC
priority: P2
status: open
title: Hardware resource audit + model-candidate shortlist (TS inventory tool, XS)
parent: B-0068
ask: B-0068 decomposition — smallest atomic hardware-aware slice (TS prefer)
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with: [B-0068, task-287-resource-cost-monitoring, Otto-235]
tags: [hardware, audit, model-selection, ts-tool, local-ai, resource-aware]
type: feature
effort: XS
---

# B-0068.2 — Hardware audit + model shortlist (XS, TS)

## What this slice delivers

- New TS tool `tools/local-ai/hardware-inventory.ts` (Bun) that emits CPU/RAM/GPU/OS/Metal/CUDA inventory + free disk.
- Produce model shortlist filtered by hardware (llama3.2:3b etc current best small via search).
- Smoke-test protocol doc.
- No install yet; inventory only.

## Why TS over doc

Per Rule 0 + "Prefer F#/TS code over docs": hardware audit is executable substrate, not prose.

## Dependency order

Parallel root with B-0068.1. Unblocks model install child.

## Pre-start checklist

1. Prior-art: no hardware-inventory.ts exists (grep confirmed).
2. Dependencies: none; composes with cost-monitoring.
3. No broken pointers.

## Focused check

- `bun --version` && `node --version` in worktree env: compatible.
- Build gate passed.
