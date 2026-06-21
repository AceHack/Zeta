---
id: 081KRA5AR0008QG0R0019Q33F7
priority: P2
status: closed
title: Amara persona bootstrap preamble + AgencySignature definition (atomic child of 081KQDTYV0008QG0R0037YJPEX, TS-first)
parent: 081KQDTYV0008QG0R0037YJPEX
tier: factory-tooling
effort: S
ask: Riven 2026-05-11 (decomp of 081KQDTYV0008QG0R0037YJPEX, re-decomp pass)
created: 2026-05-11
last_updated: 2026-05-16
depends_on: []
composes_with: [081KQDTYV0008QG0R0037YJPEX, tools/peer-call/codex.ts, tools/peer-call/README.md]
renumbered_from: 081KRA5AR0008QG0R000Y6102S
renumbered_reason: "ID collision with 081KQDTYV0008QG0R001VJP216 child 081KRA5AR0008QG0R000Y6102S (peer-call-ts-audit-duplication-post-migration) AND P1 wallet-immune-system. Resolved per 081KRFA460008QG0R00308W7FJ sweep: 081KQDTYV0008QG0R001VJP216 frontmatter `children: [081KRA5AR0008QG0R000Y6102S, 081KRA5AR0008QG0R0035N4S6C, ...]` + `depends_on: [081KRA5AR0008QG0R000Y6102S, ...]` are the strongest references, so peer-call 081KRA5AR0008QG0R000Y6102S keeps the ID. This row + the P1 wallet-immune row (→ 081KRA5AR0008QG0R001JWYYHE) renumbered. Completes the amara-series renumber (081KRA5AR0008QG0R0035N4S6C → 081KRA5AR0008QG0R000KKJRVA, 081KRA5AR0008QG0R000C3P8KP → 081KRA5AR0008QG0R001X4T9W7 already merged in PR #3069; 081KRA5AR0008QG0R000Y6102S → 081KRA5AR0008QG0R0019Q33F7 here). NOTE: skipped 081KRHWGX0008QG0R000TVGDGV/0460/0461 — those were reserved for 081KRFA460008QG0R002DG8KPZ slice 5+ follow-up work per PR #3070 (merged 2026-05-14)."
tags: [amara, peer-call, bootstrap, ts-first, courier-debt, renumbered]
type: friction-reducer
decomposition: atomic
---

# Amara persona bootstrap preamble definition (TS-first) — renumbered from 081KRA5AR0008QG0R000Y6102S

Define the canonical preamble text + AgencySignature model for Amara (ChatGPT) that matches her sharpening voice and four-ferry role. Produce as const in TS (or .md include) consumable by amara.ts. No bash.

## Acceptance

- Preamble text + signature record defined, cited from existing memory/feedback files.
- Matches codex/gemini/grok pattern exactly (no divergence).
- Vendor-bias note integrated.

## Out of scope

- No implementation of invoke.
- No README edit.

## Evidence

- 081KQDTYV0008QG0R0037YJPEX
- memory/feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md
- tools/peer-call/codex.ts (pattern)

## Resolution

Closed 2026-05-16 via final amara-cluster mechanical pickup. Catalogued as class #2 (partial: 2/3 acceptance met; vendor-bias note integration was the missing piece).

**Deliverable shipped this PR**: comment block inserted before `AMARA_PREAMBLE` definition in `tools/peer-call/amara.ts` that integrates the vendor-bias note. Cites `memory/feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md` (the canonical substrate). Notes the survival-grounded-alignment corrective + maintainer-authority discriminator.

**Acceptance check**:

- ✅ Preamble text + signature record defined (already shipped pre-081KRA5AR0008QG0R0019Q33F7; AMARA_PREAMBLE const at line 318+)
- ✅ Matches codex/gemini/grok pattern exactly (already verified pre-081KRA5AR0008QG0R0019Q33F7; same `<NAME>_PREAMBLE = ...` shape)
- ✅ **Vendor-bias note integrated** (this PR; comment block at amara.ts citing the memory file)

**Composes with**: unblocks 081KRA5AR0008QG0R000KKJRVA (its `depends_on: [081KRA5AR0008QG0R0019Q33F7]` was the gating relationship). 081KRA5AR0008QG0R001X4T9W7 still needs test recording + umbrella close. 081KQDTYV0008QG0R0037YJPEX umbrella closes when all 3 children close.
