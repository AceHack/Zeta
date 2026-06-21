---
id: 081KQX9B50008QG0R001YRPGD6
priority: P1
status: open
title: "Broadcast bus production hardening — structured schema, TTL, receipts, conflict detection"
created: 2026-05-06
last_updated: 2026-05-06
decomposition: atomic
depends_on: [081KQX9B50008QG0R0031REK6V]
type: feature
---

# 081KQX9B50008QG0R001YRPGD6 — Broadcast bus production hardening

The broadcast bus at ~/.local/share/zeta-broadcasts/ works for
v0 coordination. Production hardening needed for multi-maintainer
and long-running autonomous operation.

## Features to add

1. **Structured JSON schema** — machine-parseable by background loops
2. **TTL/expiry** — broadcasts older than N hours auto-stale
3. **Asks/offers matching** — loop A posts ask, loop B's tick sees match
4. **Priority signals** — P0 broadcasts interrupt idle ticks
5. **Receipts** — loop B acknowledges reading loop A's broadcast
6. **Conflict detection** — overlapping scope surfaced before git push
7. **History** — append-only log for debugging coordination failures
8. **Remote transport** (future) — upgrade from filesystem to network

## Depends on

- 081KQX9B50008QG0R0031REK6V (local broadcast peering ask protocol, merged #1729)
- Broadcast bus v0 (merged #1718)

## Constraint

- Broadcast check is ALWAYS unconditional in code — isolation via
  Docker infrastructure, not feature flags (Aaron 2026-05-06)
