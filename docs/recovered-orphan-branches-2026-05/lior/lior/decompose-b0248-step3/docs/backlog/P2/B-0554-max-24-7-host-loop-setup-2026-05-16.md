---
id: B-0554
priority: P2
status: open
title: "Host-loop setup for Max's 24/7 site using main-backed control clone"
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0248]
tags: [host-loop, 24-7, control-clone, infrastructure]
type: feature
---

# B-0554 — Host-loop setup for Max's 24/7 site

## Origin

Decomposed from B-0248 (Multi-site fork + GPU infrastructure redundancy).

## What

Setup the host-loop for Max's 24/7 site. This must use a main-backed control clone instead of a contested root checkout to ensure background loops don't collide with foreground development.

## Acceptance Criteria

- Max's site has a documented control-clone/launchd or equivalent host-loop setup.
- Health probe output is generated and reported to the bus.
- Control clone mechanism is cleanly separated from any foreground worktrees.
