---
id: B-0412
zetaid: 081KRA5AR0008QG0R000YZMXNM
priority: P2
status: open
title: codex.ts + gemini.ts --persona flags — parallel sibling impl after grok (B-0120 child)
parent: B-0120
tier: factory-tooling
effort: S
ask: After B-0411 lands, repeat the --persona integration in codex.ts and gemini.ts using the shared loader. Same semantics, same deprecation comment. Two scripts, one row for atomicity.
created: 2026-05-11
last_updated: 2026-05-11
depends_on:
  - B-0411
composes_with:
  - tools/peer-call/codex.ts
  - tools/peer-call/gemini.ts
tags: [riven-2026-05-11, peer-call, ts-first, flag-impl]
type: implementation
decomposition: atomic
classification: blocked-on-B-0411
---

# B-0412 — codex.ts + gemini.ts --persona (siblings)

## Source

Depends on B-0411 (grok first to validate loader). Parallel because loader is shared.

## What

Apply identical pattern to the other two entrypoints.

## Acceptance criteria

- [ ] Both scripts accept --persona amara / --persona ani with clear error on missing
- [ ] Bare invocation unchanged
- [ ] No new deps

## Out of scope

- No amara.sh/ani.sh retirement (v2)
- No full README
- No B-0121 cross-harness yet

Completes the TS surface for the refactor.
