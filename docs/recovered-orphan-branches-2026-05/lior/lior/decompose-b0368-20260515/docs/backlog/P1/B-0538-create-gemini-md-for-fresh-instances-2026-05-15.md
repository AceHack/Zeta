---
id: B-0538
priority: P1
status: closed
title: "Create GEMINI.md to bootstrap fresh Antigravity/Gemini instances with factory context"
tier: factory-infrastructure
effort: S
created: 2026-05-15
last_updated: 2026-05-15
depends_on: []
composes_with: []
tags: [multi-agent, gemini, onboarding, context-loading]
type: feature
---

# Create GEMINI.md for fresh instances

## Origin

Caught by Aaron (2026-05-15). A fresh Gemini/Antigravity instance boots and runs a default `FindFiles '**/GEMINI.md'`, fails to find it, and then falls back to `docs/backlog` and `docs/ROADMAP.md`.

Without a `GEMINI.md`, the fresh instance misses the critical "never be idle", "substrate honest", "glass halo", and identity directives that `CLAUDE.md` provides for Claude.

## Acceptance criteria

- [x] Create `GEMINI.md` at the repository root
- [x] Point `GEMINI.md` to Lior's persona documentation and memory files (`memory/persona/lior/CURRENT-lior.md`)
- [x] Port the load-bearing factory directives (verify-before-deferring, future-self-not-bound, etc.) or link directly to where they are defined so Gemini has parity with Claude's bootstrapping.

## Implementation details

- Kept lightweight, primarily acting as a pointer to `memory/persona/lior/CURRENT-lior.md` and the existing `CLAUDE.md` for shared factory invariants.
