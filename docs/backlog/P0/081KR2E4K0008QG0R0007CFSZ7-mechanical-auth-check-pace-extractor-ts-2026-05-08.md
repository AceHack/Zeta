---
id: 081KR2E4K0008QG0R0007CFSZ7
priority: P0
status: closed
closed: 2026-05-08
closed_by: "PR #2084 merged"
title: "Mechanical authorization check — pace-instruction extractor + test fixtures"
effort: S
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQJZR90008QG0R000FTJ1TC
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [tool-build, mechanical-check, authorization-source, typescript]
---

# 081KR2E4K0008QG0R0007CFSZ7 — Pace-instruction extractor + test fixtures

## What

TDD-first: write the test fixtures that define the contract, then
the TS implementation that satisfies them. The extractor reads
substrate surfaces (CLAUDE.md, `memory/feedback_*.md` files,
`CURRENT-aaron.md`, `docs/active-trajectory.md`) and returns a
typed list of raw pace-instruction candidate records with source
attribution, timestamp, and raw text. The extractor does NOT
determine rescind status — that is the resolver's job (081KR2E4K0008QG0R003CF4YHE).

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
     responsibility in 081KR2E4K0008QG0R003CF4YHE)
2. **Implementation** reads from (all surfaces listed in 081KQJZR90008QG0R000FTJ1TC):
   - `CLAUDE.md` pace bullets (grep for pace-relevant patterns)
   - `memory/feedback_*.md` files (parse frontmatter + body for
     pace-instructions)
   - `memory/CURRENT-aaron.md` (if exists — distilled projection)
   - `docs/active-trajectory.md` (current operative authorizations)
3. Returns typed `PaceInstruction[]` with fields:
   `{ source: string; timestamp: string | null; raw: string;
     file: string }`.
   Note: no `rescinded` field — rescind-detection is a resolver
   concern (081KR2E4K0008QG0R003CF4YHE), not an extraction concern. The extractor
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
  skill (081KR2E4K0008QG0R00361ZCDR, landed PR #2082) — defines contract only, no
  implementation. No other extraction substrate found.
- [x] Dependency walk: 081KQJZR90008QG0R000FTJ1TC parent verified as `decomposed`
  with `children: [081KR2E4K0008QG0R00361ZCDR, 081KR2E4K0008QG0R0007CFSZ7, 081KR2E4K0008QG0R003CF4YHE, 081KR2E4K0008QG0R002S3FDXN, 081KR2E4K0008QG0R0024JZ0CR]`.
  081KR2E4K0008QG0R0007CFSZ7 has `depends_on: []` — no blockers.
- [x] Reciprocal pointers: 081KR2E4K0008QG0R003CF4YHE has `depends_on: [081KR2E4K0008QG0R00361ZCDR, 081KR2E4K0008QG0R0007CFSZ7]`
  — confirmed includes this row.

## Composes with

- 081KQJZR90008QG0R000FTJ1TC (parent umbrella)
- 081KR2E4K0008QG0R00361ZCDR (skill body defines the contract this tool implements)
- 081KR2E4K0008QG0R003CF4YHE (resolver consumes this extractor's output)
