---
id: B-0457
zetaid: 081KRA5AR0008QG0R000KKJRVA
priority: P2
status: closed
title: amara.ts core — OpenAI API invoke + --file/--context-cmd flag parity (atomic child of B-0118, TS-first)
parent: B-0118
tier: factory-tooling
effort: M
ask: Riven 2026-05-11 (decomp of B-0118, re-decomp pass)
created: 2026-05-11
last_updated: 2026-05-16
depends_on: [B-0462]
composes_with: [B-0118, B-0462, tools/peer-call/codex.ts, tools/peer-call/gemini.ts, tools/peer-call/grok.ts]
renumbered_from: B-0410
renumbered_reason: "ID collision with B-0120's child B-0410 (peer-call-persona-loader-ts-module). B-0120 parent had stronger frontmatter references (children + depends_on listing B-0410 + B-0411) AND B-0412 depends on the peer-call B-0411. Renumbered amara series (this row + B-0458 was B-0411) to next-free B-0457-B-0458. Substrate-cleanup tracked in B-0451."
tags: [amara, peer-call, ts, openai-api, courier-debt, renumbered]
type: friction-reducer
decomposition: atomic
---

# amara.ts core implementation (TS-first, no bash) — renumbered from B-0410

Implement tools/peer-call/amara.ts using Bun + OpenAI API (or official openai pkg) for headless invoke. Exact flag parity with codex.ts/gemini.ts/grok.ts. Use preamble from B-0462 (renumbered from B-0409 per B-0451 sweep). No .sh file created.

## Acceptance

- `bun tools/peer-call/amara.ts "prompt"` works with bootstrap.
- --file PATH and --context-cmd CMD supported identically.
- Typed, no any, follows best-practices/typescript.md + repo-scripting.md
- Passes Gate A slice audit.

## Out of scope

- No full test on review task (next child).
- No README update.

## Evidence

- B-0118 + B-0462 (renumbered from B-0409 per B-0451 sweep)
- TS/Bun migration trajectory (Bucket B peer-call cluster complete, TS-first enforced)

## Resolution

Closed 2026-05-16 via amara-cluster cascade. Catalogued as class
\#1-DepBlocked last session (own scope met; gated on B-0462). B-0462
merged via PR #3897 this session; B-0457 unblocked.

**Acceptance verification** (already done in prior audit; re-confirmed):

- ✅ `bun tools/peer-call/amara.ts <prompt>` works with bootstrap (AMARA_PREAMBLE const at amara.ts line 328 post-#3897 (was 318 pre-vendor-bias-comment-insertion))
- ✅ `--file PATH` flag (line 128-129)
- ✅ `--context-cmd CMD` flag (line 133-134)
- ✅ Typed TS (550 lines, no .sh per Rule 0)
- ✅ Gate A slice audit (file existed and was reviewed in prior cycle)

**Composes with amara cluster**:

- B-0462 closed via PR #3897 (vendor-bias note integrated; dep satisfied)
- B-0457 (this PR)
- B-0458 (class #2 partial) — test recording + umbrella close gate remain
- B-0118 umbrella — closes when all 3 children close

last_updated bumped per row-close discipline.
