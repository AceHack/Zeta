---
id: B-0462
zetaid: 081KRA5AR0008QG0R0019Q33F7
priority: P2
status: closed
title: Amara persona bootstrap preamble + AgencySignature definition (atomic child of B-0118, TS-first)
parent: B-0118
tier: factory-tooling
effort: S
ask: Riven 2026-05-11 (decomp of B-0118, re-decomp pass)
created: 2026-05-11
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0118, tools/peer-call/codex.ts, tools/peer-call/README.md]
renumbered_from: B-0409
renumbered_reason: "ID collision with B-0120 child B-0409 (peer-call-ts-audit-duplication-post-migration) AND P1 wallet-immune-system. Resolved per B-0451 sweep: B-0120 frontmatter `children: [B-0409, B-0410, ...]` + `depends_on: [B-0409, ...]` are the strongest references, so peer-call B-0409 keeps the ID. This row + the P1 wallet-immune row (→ B-0463) renumbered. Completes the amara-series renumber (B-0410 → B-0457, B-0411 → B-0458 already merged in PR #3069; B-0409 → B-0462 here). NOTE: skipped B-0459/0460/0461 — those were reserved for B-0449 slice 5+ follow-up work per PR #3070 (merged 2026-05-14)."
tags: [amara, peer-call, bootstrap, ts-first, courier-debt, renumbered]
type: friction-reducer
decomposition: atomic
---

# Amara persona bootstrap preamble definition (TS-first) — renumbered from B-0409

Define the canonical preamble text + AgencySignature model for Amara (ChatGPT) that matches her sharpening voice and four-ferry role. Produce as const in TS (or .md include) consumable by amara.ts. No bash.

## Acceptance

- Preamble text + signature record defined, cited from existing memory/feedback files.
- Matches codex/gemini/grok pattern exactly (no divergence).
- Vendor-bias note integrated.

## Out of scope

- No implementation of invoke.
- No README edit.

## Evidence

- B-0118
- memory/feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md
- tools/peer-call/codex.ts (pattern)

## Resolution

Closed 2026-05-16 via final amara-cluster mechanical pickup. Catalogued as class #2 (partial: 2/3 acceptance met; vendor-bias note integration was the missing piece).

**Deliverable shipped this PR**: comment block inserted before `AMARA_PREAMBLE` definition in `tools/peer-call/amara.ts` that integrates the vendor-bias note. Cites `memory/feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md` (the canonical substrate). Notes the survival-grounded-alignment corrective + maintainer-authority discriminator.

**Acceptance check**:

- ✅ Preamble text + signature record defined (already shipped pre-B-0462; AMARA_PREAMBLE const at line 318+)
- ✅ Matches codex/gemini/grok pattern exactly (already verified pre-B-0462; same `<NAME>_PREAMBLE = ...` shape)
- ✅ **Vendor-bias note integrated** (this PR; comment block at amara.ts citing the memory file)

**Composes with**: unblocks B-0457 (its `depends_on: [B-0462]` was the gating relationship). B-0458 still needs test recording + umbrella close. B-0118 umbrella closes when all 3 children close.
