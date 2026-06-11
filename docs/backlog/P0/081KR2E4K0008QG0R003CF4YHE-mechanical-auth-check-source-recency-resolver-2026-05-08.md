---
id: B-0307
zetaid: 081KR2E4K0008QG0R003CF4YHE
priority: P0
status: closed
title: "Mechanical authorization check — source-filter + recency resolver"
effort: S
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0160
depends_on: [B-0305, B-0306]
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [tool-build, mechanical-check, authorization-source, typescript]
---

# B-0307 — Source-filter + recency resolver

## What

The core algorithm: given the `PaceInstruction[]` from B-0306's
extractor, apply the three-stage mechanical filter defined by the
skill body (B-0305): source-filter → rescind-detection →
recency-filter → return the single operative authorization.

Depends on B-0305 (skill body defines the source-filter rules and
rescind semantics this tool implements) AND B-0306 (extractor
provides the `PaceInstruction[]` input type).

Lands at `tools/authorization/resolve-authorization.ts` with
paired test at `tools/authorization/resolve-authorization.test.ts`.

## Acceptance criteria

1. **Source filter** — keeps only instructions where `source`
   matches the authorized source for the pace-instruction class
   (human maintainer only). Peer-AI, Claude.ai, Amara framings
   are discarded.
2. **Rescind detection** — an instruction is rescinded if a later
   instruction from the same authorized source explicitly replaces
   or revokes it. Implicit displacement (later instruction on a
   different topic) does NOT rescind. This is the resolver's
   responsibility — the extractor (B-0306) returns raw candidates
   without rescind tags.
3. **Recency filter** — among source-authorized, non-rescinded
   instructions, returns the most recent.
4. **Output shape**: `{ operative: PaceInstruction | null;
   reason: string; allCandidates: PaceInstruction[];
   filteredOut: PaceInstruction[] }`.
5. **Test fixtures** (write first) cover:
   - Cross-instance absorption (Claude.ai "cooling-period"
     alongside maintainer "go-hard") → only maintainer surfaces
   - Most-recent explicitly rescinded by a later instruction →
     prior instruction wins
   - Implicit displacement (later instruction on different topic)
     → does NOT rescind the pace instruction
   - No maintainer instruction → `operative: null` with
     reason "no operative pace authorization found; default to
     never-idle floor per CLAUDE.md"
   - Multiple maintainer instructions, none rescinded → most
     recent wins
6. Composes: the resolver is a pure function over
   `PaceInstruction[]` — no file I/O.
7. TypeScript, runs under Bun (Rule 0).

## Pre-start checklist

Completed 2026-05-08.

- [x] Prior-art search: grepped `resolve-authorization|resolveAuthorization|AuthorizationResult`
  across repo — 1 hit (this backlog row only). Grepped `source.?filter|recency.?filter|rescind`
  under `tools/` — 2 hits (pace-extractor.ts and its test, which mention "rescind" in
  comments only). Skill router listing confirmed `mechanical-authorization-check` skill
  exists (B-0305, PR #2082) — defines contract only, no resolver implementation.
  No overlapping scope found.
- [x] Dependency walk: B-0305 (skill body) closed via PR #2082 — source-filter rules
  defined. B-0306 (extractor) closed via PR #2084 — `PaceInstruction` type exported
  from `tools/authorization/pace-extractor.ts`. Both dependencies satisfied.
- [x] Reciprocal pointers: B-0308 has `depends_on: [B-0305, B-0307]` — confirmed
  includes this row.

## Composes with

- B-0160 (parent umbrella)
- B-0305 (skill body defines the contract this tool implements)
- B-0306 (extractor provides the input type)
- B-0308 (autonomous-loop wiring calls extractor → resolver)
