---
id: B-0306
priority: P0
status: open
title: "Mechanical authorization check — pace-instruction extractor + test fixtures"
effort: S
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0160
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [tool-build, mechanical-check, authorization-source, typescript]
---

# B-0306 — Pace-instruction extractor + test fixtures

## What

TDD-first: write the test fixtures that define the contract, then
the TS implementation that satisfies them. The extractor reads
substrate surfaces (CLAUDE.md, `memory/feedback_*.md` files,
`CURRENT-aaron.md`, `docs/active-trajectory.md`) and returns a
typed list of raw pace-instruction candidate records with source
attribution, timestamp, and raw text. The extractor does NOT
determine rescind status — that is the resolver's job (B-0307).

Lands at `tools/authorization/pace-extractor.ts` with paired
test at `tools/authorization/pace-extractor.test.ts`.

## Acceptance criteria

1. **Test fixtures** (write first) cover:
   - Single pace instruction → extracted correctly with source
     attribution
   - Two instructions, both from maintainer → both returned in
     chronological order
   - Peer-AI framing (Claude.ai, Amara, Codex) present in
     substrate → extracted with `source: "claude.ai"` (etc.)
     so the resolver can filter by source
   - No pace instruction in substrate → empty array
   - Instruction containing explicit rescind language → extracted
     with raw text preserved (rescind-detection is resolver's
     responsibility in B-0307)
2. **Implementation** reads from (all surfaces listed in B-0160):
   - `CLAUDE.md` pace bullets (grep for pace-relevant patterns)
   - `memory/feedback_*.md` files (parse frontmatter + body for
     pace-instructions)
   - `memory/CURRENT-aaron.md` (if exists — distilled projection)
   - `docs/active-trajectory.md` (current operative authorizations)
3. Returns typed `PaceInstruction[]` with fields:
   `{ source: string; timestamp: string | null; raw: string;
     file: string }`.
   Note: no `rescinded` field — rescind-detection is a resolver
   concern (B-0307), not an extraction concern. The extractor
   returns ALL candidates; the resolver determines which are
   operative.
4. Pure function on file content (no side effects) — accepts a
   root-path argument for testability.
5. TypeScript, runs under Bun (Rule 0).

## Pre-start checklist

Completed 2026-05-08.

- [x] Prior-art search: grepped `pace-extractor|PaceInstruction`
  across repo — 7 hits, all in backlog/skill/research docs, no
  existing TS implementation. `tools/authorization/` directory
  does not exist. Skill router has `mechanical-authorization-check`
  skill (B-0305, landed PR #2082) — defines contract only, no
  implementation. No other extraction substrate found.
- [x] Dependency walk: B-0160 parent verified as `decomposed`
  with `children: [B-0305, B-0306, B-0307, B-0308, B-0309]`.
  B-0306 has `depends_on: []` — no blockers.
- [x] Reciprocal pointers: B-0307 has `depends_on: [B-0305, B-0306]`
  — confirmed includes this row.

## Composes with

- B-0160 (parent umbrella)
- B-0305 (skill body defines the contract this tool implements)
- B-0307 (resolver consumes this extractor's output)
