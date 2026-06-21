---
id: 081KR7JY10008QG0R000HEPQ8Y
priority: P1
status: open
title: "Multi-loop tick-history tooling attribution (dual-loop AC #5)"
effort: S
created: 2026-05-10
last_updated: 2026-05-10
depends_on:
  - 081KQJZR90008QG0R0025WX5ZJ
parent: 081KQJZR90008QG0R002GJAJ19
classification: blocked
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [dual-loop, tick-history, tooling, attribution, b-0163]
---

# 081KR7JY10008QG0R000HEPQ8Y — Multi-loop tick-history tooling attribution

## Context

Extracted from 081KQJZR90008QG0R002GJAJ19 AC #5 during decomposition (2026-05-10).

081KQJZR90008QG0R002GJAJ19 AC #1 (per-loop attribution channel) is already satisfied by
existing substrate: tick shards under `docs/hygiene-history/ticks/**`
include a model-identifier column that can carry any loop's identity
(e.g., `opus-4-7 / autonomous-loop` or `gpt-5.5 / codex-loop`).

This child row is about the **tooling layer**: when 081KQJZR90008QG0R0025WX5ZJ retires
`tools/hygiene/append-tick-history-row.sh` and replaces it with a TS
successor, that successor must explicitly support multi-loop attribution
so both loops can write tick shards correctly without toil.

## What

Update the 081KQJZR90008QG0R0025WX5ZJ TS successor of `tools/hygiene/append-tick-history-row.sh`
to:

1. Accept a `--loop-id` (or `--model-id`) parameter that writes the
   model-identifier column in the tick shard frontmatter.
2. Default gracefully (e.g., to `unknown-loop`) if the parameter is omitted,
   preserving backward compatibility with single-loop invocations.
3. Document the multi-loop usage in the tool's `--help` output and
   `tools/hygiene/README.md`.

## Acceptance criteria

1. `bun tools/hygiene/<successor>.ts --loop-id "gpt-5.5/codex-loop" …` writes
   a tick shard with the correct model-identifier column.
2. Omitting `--loop-id` does not break existing single-loop tick writes.
3. The tool's `--help` output describes `--loop-id`.
4. `bun tools/hygiene/<successor>.ts --help` exits 0 with the updated docs.

## Blocker

Gated by 081KQJZR90008QG0R0025WX5ZJ (retire `append-tick-history-row.sh` and ship the TS
successor). Once 081KQJZR90008QG0R0025WX5ZJ lands, this row is unblocked: the TS successor is
the edit target, and the change is additive (one new optional parameter).

## Scope / out of scope

**In scope**: `--loop-id` parameter addition, `--help` update,
`tools/hygiene/README.md` note.

**Out of scope**: changing the divergence-shard tooling (separate surface);
changing the tick-shard schema (schema already accommodates multi-loop via
the existing model-identifier column).

## Composes with

- 081KQJZR90008QG0R0025WX5ZJ (tick tooling retirement — gating dependency)
- 081KQJZR90008QG0R002GJAJ19 (parent — divergence-shard schema, attribution protocol)
- 081KR7JY10008QG0R0035GWRQ0 (cron coordination — if loops run concurrently, the tool must be
  safe to call from two processes simultaneously; check for write-race)
