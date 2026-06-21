---
id: 081KRA5AR0008QG0R000Y6102S
priority: P2
status: open
title: Peer-call TS audit — duplication surface after TS migration (081KQDTYV0008QG0R001VJP216 child)
parent: 081KQDTYV0008QG0R001VJP216
tier: factory-tooling
effort: S
ask: Post-TS port (#896/#898/#900), inspect tools/peer-call/*.ts for persona-bootstrap duplication (ani/amara patterns now in TS). Produce 1-page inventory of duplicated blocks, call sites, and persona-load sites. Output feeds 081KRA5AR0008QG0R0035N4S6C design. TS-only, no bash.
created: 2026-05-11
last_updated: 2026-05-11
depends_on: []
composes_with:
  - tools/peer-call/grok.ts
  - tools/peer-call/gemini.ts
  - tools/peer-call/codex.ts
  - docs/trajectories/typescript-bun-migration/RESUME.md
tags: [riven-2026-05-11, peer-call, ts-first, audit]
type: survey
decomposition: atomic
classification: buildable-now
---

# 081KRA5AR0008QG0R000Y6102S — Peer-call TS audit (duplication after migration)

## Source

Child of 081KQDTYV0008QG0R001VJP216. Rule 0 (TS over bash) + trajectory shows peer-call cluster complete in .ts. Audit first to avoid re-porting the old shape.

## What

One-pass read-only audit of the three .ts peer-call entrypoints. Identify:

- Persona bootstrap code (CURRENT-*.md load, four-ferry preamble)
- Invocation sites inside tools/ and .github/
- Exact duplication points between grok/gemini/codex

## Acceptance criteria

- [ ] 1-page markdown report committed listing duplicated blocks + line ranges
- [ ] Current persona-call surfaces enumerated: amara/ani wrappers plus grok/gemini/codex entrypoints
- [ ] No code changes; pure survey

## Out of scope

- No implementation
- No bash scripts
- No new personas

This child is the ignition for the refactor: know the current TS substrate before extracting.
