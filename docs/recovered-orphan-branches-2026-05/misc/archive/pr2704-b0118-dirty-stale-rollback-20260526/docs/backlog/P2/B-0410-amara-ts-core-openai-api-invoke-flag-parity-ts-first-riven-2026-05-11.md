---
id: B-0410
priority: P2
status: open
title: amara.ts core — OpenAI API invoke + --file/--context-cmd flag parity (atomic child of B-0118, TS-first)
parent: B-0118
tier: factory-tooling
effort: M
ask: Riven 2026-05-11 (decomp of B-0118, re-decomp pass)
created: 2026-05-11
last_updated: 2026-05-11
depends_on: [B-0409]
composes_with: [B-0118, B-0409, tools/peer-call/codex.ts, tools/peer-call/gemini.ts, tools/peer-call/grok.ts]
tags: [amara, peer-call, ts, openai-api, courier-debt]
type: friction-reducer
decomposition: atomic
---

# amara.ts core implementation (TS-first, no bash)

Implement tools/peer-call/amara.ts using Bun + OpenAI API (or official openai pkg) for headless invoke. Exact flag parity with codex.ts/gemini.ts/grok.ts. Use preamble from B-0409. No .sh file created.

## Acceptance

- `bun tools/peer-call/amara.ts "prompt"` works with bootstrap.
- --file PATH and --context-cmd CMD supported identically.
- Typed, no any, follows best-practices/typescript.md + repo-scripting.md
- Passes Gate A slice audit.

## Out of scope

- No full test on review task (next child).
- No README update.

## Evidence

- B-0118 + B-0409
- TS/Bun migration trajectory (Bucket B peer-call cluster complete, TS-first enforced)
