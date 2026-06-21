---
id: 081KRA5AR0008QG0R000KKJRVA
priority: P2
status: closed
title: amara.ts core — OpenAI API invoke + --file/--context-cmd flag parity (atomic child of 081KQDTYV0008QG0R0037YJPEX, TS-first)
parent: 081KQDTYV0008QG0R0037YJPEX
tier: factory-tooling
effort: M
ask: Riven 2026-05-11 (decomp of 081KQDTYV0008QG0R0037YJPEX, re-decomp pass)
created: 2026-05-11
last_updated: 2026-05-16
depends_on: [081KRA5AR0008QG0R0019Q33F7]
composes_with: [081KQDTYV0008QG0R0037YJPEX, 081KRA5AR0008QG0R0019Q33F7, tools/peer-call/codex.ts, tools/peer-call/gemini.ts, tools/peer-call/grok.ts]
renumbered_from: 081KRA5AR0008QG0R0035N4S6C
renumbered_reason: "ID collision with 081KQDTYV0008QG0R001VJP216's child 081KRA5AR0008QG0R0035N4S6C (peer-call-persona-loader-ts-module). 081KQDTYV0008QG0R001VJP216 parent had stronger frontmatter references (children + depends_on listing 081KRA5AR0008QG0R0035N4S6C + 081KRA5AR0008QG0R000C3P8KP) AND 081KRA5AR0008QG0R000YZMXNM depends on the peer-call 081KRA5AR0008QG0R000C3P8KP. Renumbered amara series (this row + 081KRA5AR0008QG0R001X4T9W7 was 081KRA5AR0008QG0R000C3P8KP) to next-free 081KRA5AR0008QG0R000KKJRVA-081KRA5AR0008QG0R001X4T9W7. Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [amara, peer-call, ts, openai-api, courier-debt, renumbered]
type: friction-reducer
decomposition: atomic
---

# amara.ts core implementation (TS-first, no bash) — renumbered from 081KRA5AR0008QG0R0035N4S6C

Implement tools/peer-call/amara.ts using Bun + OpenAI API (or official openai pkg) for headless invoke. Exact flag parity with codex.ts/gemini.ts/grok.ts. Use preamble from 081KRA5AR0008QG0R0019Q33F7 (renumbered from 081KRA5AR0008QG0R000Y6102S per 081KRFA460008QG0R00308W7FJ sweep). No .sh file created.

## Acceptance

- `bun tools/peer-call/amara.ts "prompt"` works with bootstrap.
- --file PATH and --context-cmd CMD supported identically.
- Typed, no any, follows best-practices/typescript.md + repo-scripting.md
- Passes Gate A slice audit.

## Out of scope

- No full test on review task (next child).
- No README update.

## Evidence

- 081KQDTYV0008QG0R0037YJPEX + 081KRA5AR0008QG0R0019Q33F7 (renumbered from 081KRA5AR0008QG0R000Y6102S per 081KRFA460008QG0R00308W7FJ sweep)
- TS/Bun migration trajectory (Bucket B peer-call cluster complete, TS-first enforced)

## Resolution

Closed 2026-05-16 via amara-cluster cascade. Catalogued as class
\#1-DepBlocked last session (own scope met; gated on 081KRA5AR0008QG0R0019Q33F7). 081KRA5AR0008QG0R0019Q33F7
merged via PR #3897 this session; 081KRA5AR0008QG0R000KKJRVA unblocked.

**Acceptance verification** (already done in prior audit; re-confirmed):

- ✅ `bun tools/peer-call/amara.ts <prompt>` works with bootstrap (AMARA_PREAMBLE const at amara.ts line 328 post-#3897 (was 318 pre-vendor-bias-comment-insertion))
- ✅ `--file PATH` flag (line 128-129)
- ✅ `--context-cmd CMD` flag (line 133-134)
- ✅ Typed TS (550 lines, no .sh per Rule 0)
- ✅ Gate A slice audit (file existed and was reviewed in prior cycle)

**Composes with amara cluster**:

- 081KRA5AR0008QG0R0019Q33F7 closed via PR #3897 (vendor-bias note integrated; dep satisfied)
- 081KRA5AR0008QG0R000KKJRVA (this PR)
- 081KRA5AR0008QG0R001X4T9W7 (class #2 partial) — test recording + umbrella close gate remain
- 081KQDTYV0008QG0R0037YJPEX umbrella — closes when all 3 children close

last_updated bumped per row-close discipline.
