---
id: 081KRA5AR0008QG0R000YZMXNM
priority: P2
status: open
title: codex.ts + gemini.ts --persona flags — parallel sibling impl after grok (081KQDTYV0008QG0R001VJP216 child)
parent: 081KQDTYV0008QG0R001VJP216
tier: factory-tooling
effort: S
ask: After 081KRA5AR0008QG0R000C3P8KP lands, repeat the --persona integration in codex.ts and gemini.ts using the shared loader. Same semantics, same deprecation comment. Two scripts, one row for atomicity.
created: 2026-05-11
last_updated: 2026-05-11
depends_on:
  - 081KRA5AR0008QG0R000C3P8KP
composes_with:
  - tools/peer-call/codex.ts
  - tools/peer-call/gemini.ts
tags: [riven-2026-05-11, peer-call, ts-first, flag-impl]
type: implementation
decomposition: atomic
classification: blocked-on-081KRA5AR0008QG0R000C3P8KP
---

# 081KRA5AR0008QG0R000YZMXNM — codex.ts + gemini.ts --persona (siblings)

## Source

Depends on 081KRA5AR0008QG0R000C3P8KP (grok first to validate loader). Parallel because loader is shared.

## What

Apply identical pattern to the other two entrypoints.

## Acceptance criteria

- [ ] Both scripts accept --persona amara / --persona ani with clear error on missing
- [ ] Bare invocation unchanged
- [ ] No new deps

## Out of scope

- No amara.sh/ani.sh retirement (v2)
- No full README
- No 081KQDTYV0008QG0R003VB4K1V cross-harness yet

Completes the TS surface for the refactor.
