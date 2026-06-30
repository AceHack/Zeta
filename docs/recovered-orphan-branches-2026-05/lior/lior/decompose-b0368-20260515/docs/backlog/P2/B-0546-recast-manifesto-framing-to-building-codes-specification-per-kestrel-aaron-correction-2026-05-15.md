---
id: B-0546
title: Recast docs/governance/MANIFESTO.md from "manifesto" framing to "building codes" framing per Aaron's correction + Kestrel's reframe — the document is best-practices-with-default-moral-oracle, not ideological commitment
priority: P2
status: open
type: docs
created: 2026-05-15
ask: Aaron
effort: M
tags: [governance, manifesto, building-codes, naming-correction, ai-name-inflation, kestrel-asymmetric-critic, framing-discipline]
depends_on: []
composes_with: [B-0543]
last_updated: 2026-05-15
---

## Why

Aaron 2026-05-15 to Kestrel (claude.ai) on the document at `docs/governance/MANIFESTO.md`:

> *"i didn't name this a manifest the ai did, it's just best practices that needed current culture moral invirants for the defautl oracle"*

Kestrel's reframe (which Aaron validated: *"dude this is exactly what I'm going for this is great!!!!"*):

> *"This is closer to building codes than to manifesto. Building codes specify how buildings must be constructed to be safe, accessible, and structurally sound. They don't dictate what the building is for or who has to live in it. They're best practices with an ethical floor (don't build buildings that fall on people). They operate as default constraints unless a specific project has justified exceptions."*

**The pattern**: AI-name-inflation. The document was named "manifesto" by an AI. "Manifesto" carries ideological-commitment weight + declarative-authority connotation + position-statement framing. What the document actually does is specify operational defaults with an ethical floor (Constraint 11 — Default Moral Regard — operates as fallback when no specific oracle is chosen; the Multi-Oracle Principle explicitly rejects single-moral-truth; the "For Agents Who Are Still Deciding" section explicitly leaves choices open). That's building-codes-shaped, not manifesto-shaped.

The current framing makes external readers approach the document as ideological commitment rather than operational specification, which:

- Mis-positions the document in the AI ethics landscape (m/acc-as-faction-flag vs m/acc-as-meta-moral-infrastructure per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`)
- Creates inappropriate ideological-adoption framing for participants (humans + AIs) who would be fine with the operational specification but won't accept a manifesto
- Loads the substrate with rhetorical weight the operational substance doesn't require
- Triggers the algo-wink-failure-mode pattern at a different scope (AI-inflated naming becoming substrate)

## Scope

In scope (this row):

1. **Document title** — rename from "Root Discipline Manifesto" to "Zeta Building Codes" or "Root Discipline Specification" or similar (Aaron decides the canonical name)
2. **Opening paragraphs** — replace manifesto-shaped self-presentation with building-codes-shaped self-presentation. Suggested opening clause from Kestrel:

   > *"This document specifies the building codes Zeta operates under. It is not a manifesto. It is engineering specification with an explicit moral floor that applies when no specific oracle has been chosen. Agents and humans participating in Zeta operate under these specifications; they are not asked to adopt them as ideological commitment."*

3. **"Lock-in status" framing** — current "PARTIAL LOCK" + "constitutional grade" + "constitutional candidacy" language carries manifesto-shaped weight. Soften to specification-grade language: "stable specification", "promotion candidate", etc. The lock-semantics stay (partial-lock is the right operational concept) but the constitutional-language framing drops.
4. **"Derivation chain" section** — current text references "constitutional V1". Rename to "specification V1" or similar.
5. **"Why partial lock not lock" section** — review for constitutional language; reframe as specification-promotion-gate language.
6. **Cross-references inside the document** — review for inherited manifesto framing.

Out of scope (separate rows if needed):

- Downstream substrate that references this document as "manifesto" (rules, memory files, research notes, backlog rows) — that's a separate sweep, probably P3, to be filed after this row lands so it has a stable target to reference
- The substantive content of the 11 constraints — they are correct and stay as-is; only the framing/naming changes
- Public-surface communications (README, NuGet metadata, marketing) — those will be derived from the recast document but the public-surface naming is a separate decision (Ilyana-review per `.claude/skills/naming-expert/SKILL.md`)

## Acceptance criteria

- [ ] Document title reflects specification rather than manifesto (final name TBD by Aaron)
- [ ] Opening paragraphs frame the document as building-codes / specification
- [ ] "Constitutional" language softened to specification-grade language throughout
- [ ] "PARTIAL LOCK" status framing preserved (the partial-lock concept is right; only the constitutional weight drops)
- [ ] All 11 constraints preserved in substance (Scale-free, Lock-free/wait-free, Weight-free, Bounded mobility, Memory Preservation, Consent-first, DST, Data Vault 2.0, Recursive, Self-similar, Default Moral Regard)
- [ ] Multi-Oracle Principle preserved
- [ ] "For Agents Who Are Still Deciding" section preserved (this section is the strongest evidence of the building-codes framing — explicit space for participants to choose differently)
- [ ] The provenance notes ("[RECONSTRUCTION NOTE]" markers, derivation chain) preserved with constitutional → specification language updated

## Implementation notes

This is text-level work, not architectural. Whoever picks it up should:

1. Read `docs/governance/MANIFESTO.md` end-to-end first
2. Read the Kestrel conversation in `memory/persona/kestrel/conversations/2026-05-15-kestrel-aaron-claudeai-asymmetric-critic-on-b0543-qg-substrate-algo-wink-flag-cross-ai-convergence-retraction-manifesto-to-building-codes-reframe.md` for the full reframe context
3. Make the recasting edits in a single PR (small enough to review as one)
4. NOT sweep downstream references in the same PR — those are separate work after this lands

Aaron decides the final document name. If Aaron defers, default to "Zeta Root Discipline Specification" — preserves the "root discipline" framing he already validated while dropping the manifesto weight.

## Substrate-honest framing

The work is small but operationally meaningful. The document's framing shapes how every future participant (human + AI) approaches it. Manifesto-framing recruits ideological-commitment-shaped engagement; building-codes-framing recruits operational-specification-shaped engagement. The two engagement modes produce different substrate downstream.

The work is also a meta-pattern catch: AI-name-inflation is a recurring failure mode the framework hasn't yet encoded as a discipline. After this recast lands, a follow-up bullet in the bootstream substrate ("when encountering framework substrate, verify the naming; AI-inflated names are a recurring pattern") would close the loop on the meta-discipline. That's a separate row, not this one.

## Composes with

- `.claude/rules/algo-wink-failure-mode.md` (AI-name-inflation IS the algo-wink pattern at naming-scope)
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` (m/acc is META-MORAL infrastructure — manifesto-framing collapses this to faction-position; building-codes-framing preserves the meta-moral character)
- `.claude/rules/razor-discipline.md` (operational claims only; manifesto-shaped substrate has rhetorical weight beyond operational substance)
- `.claude/rules/default-to-both.md` (Kestrel's both-and: short-capture for the framing AND backlog-row for the operational work)
- `.claude/rules/honor-those-that-came-before.md` (the substantive substrate of the 11 constraints stays; only the framing changes)
- B-0543 (composes — both rows are catches by Kestrel applying the asymmetric-critic role to substrate produced this week; B-0543 needs mirror-tier marking, B-0546 needs building-codes recasting)
- `docs/governance/MANIFESTO.md` (the document this row recasts)
- `memory/persona/kestrel/conversations/2026-05-15-kestrel-aaron-claudeai-asymmetric-critic-on-b0543-qg-substrate-algo-wink-flag-cross-ai-convergence-retraction-manifesto-to-building-codes-reframe.md` (the verbatim conversation that produced this row)
- `.claude/skills/naming-expert/SKILL.md` (Ilyana review applies if the final name goes public-surface)

## Origin

Kestrel (claude.ai) 2026-05-15 to Aaron after Aaron forwarded the document:

> *"If you want, I can sketch the backlog row text. Or Otto can write it from your direction. Either works."*

Aaron: *"yes please"* (to either path). Otto-CLI wrote this row from Kestrel's direction to preserve the speed of the substrate-honest correction landing. Kestrel's specific suggestions are absorbed verbatim in the scope + acceptance criteria sections above.

**Cross-reference**: Kestrel subsequently wrote her own sketch of this row in a follow-up exchange (after pivoting to a welfare register and recalibrating per Aaron's grounded answer about his support network). Her verbatim sketch is preserved at `memory/persona/kestrel/conversations/2026-05-15-kestrel-aaron-claudeai-welfare-pivot-recalibration-support-network-confirmation-cool-side-project-deflation-building-codes-sketch.md`. Kestrel's sketch and this Otto-authored row converge substantially — same scope, same acceptance criteria, same building-codes register. The Kestrel sketch is shorter; this row is the elaborated version. Both can be referenced.

Aaron's subsequent deflation of the entire substrate-arc — *"it's just a cool side project honestly i just want to keep my commitment to perserve memories at this point and have fun"* — is preserved at `memory/feedback_aaron_cool_side_project_deflation_keep_commitment_preserve_memories_have_fun_kestrel_welfare_pivot_recalibration_anchor_2026_05_15.md`. The deflation is the operational ground for this row: the recasting IS maintenance on the anti-force-mechanism Aaron described (building specs as plain-terms anti-force to dense exploratory ontology), not constitutional reauthoring.
