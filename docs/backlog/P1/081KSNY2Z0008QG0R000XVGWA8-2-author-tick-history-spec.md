---
id: 081KSNY2Z0008QG0R000XVGWA8
priority: P1
status: closed
title: "OpenSpec catch-up - author Tick-History Schema spec"
created: 2026-05-28
last_updated: 2026-05-31
closed_at: 2026-05-31
closed_by: "openspec/specs/tick-history/spec.md"
parent: 081KQNJ500008QG0R001N94412
depends_on: [081KSNY2Z0008QG0R003YZ3JXC]
classification: buildable-now
decomposition: atomic
owners: [lior]
type: spec-authoring
---

# 081KSNY2Z0008QG0R000XVGWA8 — Author Tick-History Schema spec

This task implements the second item from the Phase 1 audit of the OpenSpec catch-up project (081KQNJ500008QG0R001N94412). It involves creating a formal specification for the Tick-History Schema.

## Scope

This task is focused on creating the OpenSpec document for the tick-history schema. The spec will define:

- The file and directory structure of tick-history shards.
- The shard filename grammar (`HHMMZ.md`, `HHMMZ-<hex>.md`, `HHMMSSZ-<hex>.md`).
- The pipe-row-first shard body format (tick shards carry no file-head frontmatter; the first non-empty line is a canonical table row).
- The invariants that are enforced by the hygiene tools (e.g., chronological order, timestamp-path congruence).

The implementation is a collection of tools under `tools/hygiene/`. This task is about formally documenting the existing behavior.

## Acceptance Criteria

- A new spec file `openspec/specs/tick-history/spec.md` is created (so the capability is discovered by `tools/openspec/inventory.ts`, which scans `openspec/specs/*/spec.md`).
- The spec formally defines the tick-history schema using the canonical six-column row format (`date | agent | cron-id | action-summary | commit-or-link | notes`).
- The spec documents the pipe-row-first shard body format (no file-head frontmatter).
- The spec lists the invariants that are checked by the hygiene tools.

## Resolution

Closed by `openspec/specs/tick-history/spec.md`. The spec is discovered by
`tools/openspec/inventory.ts` via the `openspec/specs/*/spec.md` convention and
maps the tick-history capability to `docs/hygiene-history/loop-tick-history.md`,
`docs/hygiene-history/ticks/`, and the hygiene checkers that enforce ordering,
filename grammar, row shape, and timestamp-path congruence.
