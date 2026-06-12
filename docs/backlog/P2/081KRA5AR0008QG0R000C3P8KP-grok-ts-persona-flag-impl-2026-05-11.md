---
id: B-0411
zetaid: 081KRA5AR0008QG0R000C3P8KP
priority: P2
status: open
title: grok.ts --persona flag — minimal integration of loader + deprecation note (B-0120 child)
parent: B-0120
tier: factory-tooling
effort: S
ask: In tools/peer-call/grok.ts add optional --persona <name> flag by extending the existing lightweight parseArgs pattern; do not add a new parser dependency. If present, call loadPersona and inject; else current bare behavior. Add comment for future amara/ani wrapper deprecation. One script only.
created: 2026-05-11
last_updated: 2026-05-11
depends_on:
  - B-0410
composes_with:
  - tools/peer-call/grok.ts
tags: [riven-2026-05-11, peer-call, ts-first, flag-impl]
type: implementation
decomposition: atomic
classification: blocked-on-B-0410
---

# B-0411 — grok.ts --persona flag (first script)

## Source

Depends on loader (B-0410). Scope-limited to grok.ts to keep atomic.

## What

Edit grok.ts (post #896):

- Parse --persona via the existing custom parser pattern (keep 4-shell compat; no new dependency)
- On flag: await loadPersona(name) then prepend to prompt
- No flag: unchanged behavior
- Add TODO comment for amara/ani wrapper retirement

## Acceptance criteria

- [ ] `bun tools/peer-call/grok.ts --persona ani "test"` succeeds (or errors clearly)
- [ ] Bare `bun ... "test"` unchanged
- [ ] Focused test in PR (manual or tsx)

## Out of scope

- No codex/gemini yet
- No wrapper scripts
- No README update

Keeps the step bounded; other scripts are siblings.
