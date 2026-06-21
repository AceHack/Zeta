---
id: 081KQX9B50008QG0R0031REK6V
priority: P2
status: open
title: "Local broadcast peering asks — structured ask/receipt protocol over the same-machine bus"
created: 2026-05-06
last_updated: 2026-05-06
depends_on:
  - 081KQX9B50008QG0R001MNYK61
type: friction-reducer
---

# 081KQX9B50008QG0R0031REK6V — Local broadcast peering asks

## Problem

The same-machine broadcast bus is already useful for status, but
status alone is too weak for peer coordination. When one agent needs
help from another, the ask currently arrives through chat or a
free-form broadcast paragraph. That keeps the human maintainer in
the relay path and makes it hard for background loops to decide
whether to accept, decline, or promote the request into git.

## Desired outcome

Make a peering ask a first-class local object with required fields:
ask ID, sender, target peer, expiry, scope, desired output, remote
fallback, and constraints. Peers respond with receipts that include
accepted / declined / blocked / done status plus a durable reference
when one exists.

This is also a background-parity item. Foreground chat can steer and
debug, but the six-month unattended target requires background
services to read asks, decide, claim, patch, receipt, and hand off
without waiting for the foreground conversation to be awake.

## Initial protocol

The first protocol sketch lives in `docs/LOCAL-BROADCAST-PEERING.md`.
It intentionally starts as markdown so humans and agents can read it
without parser work. A later implementation can add append-only JSONL
files under `~/.local/share/zeta-broadcasts/` using the same schema.

## Non-goals

- Do not make local broadcast a hidden dependency for remote-only
  contributors.
- Do not let a broadcast ask reserve files; claims still own path
  coordination.
- Do not add a distributed lock manager.

## Test path

1. Add ask / receipt sections to Otto, Vera, and Riven broadcasts.
2. Teach each background loop to read at most one ask per tick.
3. Allow `review-only` receipts first.
4. Add `patch-with-claim` only after the loop can file or reuse a
   claim branch safely.
5. Verify 081KQX9B50008QG0R001MNYK61 remote-only agents still succeed when the local
   broadcast bus is absent.
6. Add explicit background-loop prompts or deterministic handlers for
   the same ask modes, starting with Vera's Codex launchd loop.

## Composes with

- `docs/LOCAL-BROADCAST-PEERING.md`
- `docs/AGENT-CLAIM-PROTOCOL.md`
- `docs/SAFE-AUTONOMOUS-ACTIONS.md`
- 081KQX9B50008QG0R001MNYK61 remote-only background agent test matrix
