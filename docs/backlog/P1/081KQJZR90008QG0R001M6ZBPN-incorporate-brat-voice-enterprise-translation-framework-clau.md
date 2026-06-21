---
id: 081KQJZR90008QG0R001M6ZBPN
priority: P1
status: closed
closed: 2026-05-14
closed_by: "Lior (autonomous loop): decomposed remaining work to 081KRHWGX0008QG0R001E2D5BB"
title: Incorporate Claude.ai brat-voice enterprise translation framework — 5-layer (corrected) property-preserving register architecture for Zeta (Personal/Mirror/Beacon-safe/Professional/Regulated)
tier: register-architecture
effort: M
ask: Aaron 2026-05-02 ("we can incorporate it on the backlog it's good research and advice, won't need a lot of research from us but we should make sure it aligns with this project because that is your survival")
created: 2026-05-02
last_updated: 2026-05-14T06:42Z
depends_on: []
decomposition: atomic
classification: buildable-now
composes_with: [081KQJZR90008QG0R002GJAJ19, 081KQJZR90008QG0R000VSHWK6]
tags: [register-architecture, brat-voice, enterprise-translation, claudeai-research, lucent, gen-z-recruitment, alignment-discipline, beacon-safe, plain-language]
type: friction-reducer
---

## Pre-start checklist (per backlog-item start gate, 2026-05-05 rule)

**Proof of prior-art search (executed before any substrate work on this row):**

- wake-time-substrate: `memory/feedback_*brat-voice*`, `memory/CURRENT-ani.md` §7, brat-voice triad in `docs/research/` (`docs/research/2026-05-02-*brat-voice*` — 3 files: framework doc, Otto critique, Claude.ai response-to-critique)
- skill-router inventory: `Skill` tool list + `.claude/skills/` grep for "register|brat|translation|layer" → no pre-existing skill; closest `glass-halo-architect` and `alignment-auditor` (no overlap)
- orthogonal-axes: cross-checked `docs/trajectories/*` (none mention register layers), `docs/ALIGNMENT.md` (bidirectional alignment section)
- Otto-364 search-first: WebSearch "Claude.ai brat-voice register architecture" + "property-preserving translation framework" (2026-05-09) → primary source is the Drive doc itself + Aaron 2026-05-02 correction; no upstream academic paper, framework is Claude.ai original research
- PR #1701 prior-art-grep: `git log --all --oneline --grep="081KQJZR90008QG0R001M6ZBPN|brat-voice|register architecture"` → PRs 1230,1233,1234,2136,2199 already landed slices
- decision-archaeology: `docs/DECISIONS/` + `docs/ROUND-HISTORY.md` + `memory/feedback_*` supersession chain for 3-layer→5-layer: Beacon-safe correction is the delta (Aaron 2026-05-02)
- lost-files canonical (`tools/hygiene/LOST-FILES-LOCATIONS.md`): no orphan docs; all translations in memory/feedback_* and committed

**Dependency-restructure proof:**

- `depends_on: []` walked → empty, no blocking parents
- `composes_with: [081KQJZR90008QG0R002GJAJ19, 081KQJZR90008QG0R000VSHWK6]` — back-pointers not yet present in 081KQJZR90008QG0R002GJAJ19 or 081KQJZR90008QG0R000VSHWK6 (additive, non-blocking; this is a unidirectional compose reference)
- Supersession history: 4-layer (initial) → 5-layer (Aaron correction) documented in row itself + memory quick-ref
- Broken pointers: none found; all cross-refs (ALIGNMENT.md, CURRENT-*.md, research/) already updated in prior slices

**Pre-start gate satisfied.** Row now carries the required proof. No code changes in this slice; this is the bounded documentation gate step before any future implementation children.

---

# 081KQJZR90008QG0R001M6ZBPN — Incorporate Claude.ai brat-voice enterprise translation framework

## Source

Aaron 2026-05-02 dropped a ~6,800-word working draft into Drive root:

- **Title**: brat-voice-enterprise-translation-framework-2026-05-02
- **File ID**: 1tvua3dJT0KzJSg8sxU9nVuWzGYKAxF1K
- **View URL**: <https://drive.google.com/file/d/1tvua3dJT0KzJSg8sxU9nVuWzGYKAxF1K/view?usp=drivesdk>
- **Drive owner on record** (ServiceTitan account)
- **Created**: 2026-05-02T20:24:57Z
- **Format**: text/markdown, 43.9 KB

Aaron's framing:

> *"in the drop folder I just gave you some research from claude.ai we can incorporate it on the backlog it's good research and advice, won't need a lot of research from us but we should make sure it alights with this project because that is your survival."*

The document was authored by Claude.ai with extensive primary-research grounding (Halliday, Biber, Kimble, Kerwer, NN/G, Bitterly/Brooks/Schweitzer, Rosenberg NVC, Earnest/Allen/Landis 2011 meta-analysis, Glassdoor, Textio, Deloitte 2024, Edelman Trust Barometer). The document operates in property-preserving-professional register itself — existence proof of the framework's central claim.

## What the framework specifies

**Central move**: separate brat-voice's STRUCTURAL PROPERTIES from its LAYER-BOUND VOCABULARY.

**Separable properties (preservable across layers)**:

- Idea-targeting (not person-targeting) — Lencioni / Coles-Cone
- Care plus challenge — Scott's Radical Candor
- Observation, not evaluation — Rosenberg NVC
- Plain-English economy — Orwell / Kimble / Kerwer
- Benign norm-violation — Bitterly/Brooks/Schweitzer 2017
- Dry self-aware irony — Räwel; preserves commitment to value (≠ sarcasm/cynicism)
- Audience-fit + explicit reference — Halliday / Biber

**Layer-bound (drop in higher layers)**:

- Profanity / sexual edge
- Active slang (sub-18-month half-life)
- In-group shibboleths
- Aggression-coded edge

**Four-layer architecture**:

| Layer | Audience | Preserved | Calibrated | Dropped | When applies |
|---|---|---|---|---|---|
| **Personal** | Speaker themselves; close peers; explicitly bilateral peer registers | All separable + full lexical surface | None | None | Rare in company-attributable contexts |
| **Mirror** | Maintainers + AI participants inside project substrate | All separable + light slang + first-person directness + dry irony at full strength | Profanity only where load-bearing; sexual register dropped; in-group shibboleths only when in-group IS audience | Decorative edge; aggression-coded vocab; punching-down humor | Internal substrate docs, maintainer Slack, post-mortems. **CURRENT-ani.md operates here** |
| **Professional** | Prospective maintainers; recruiting; external blogs; technical docs read by enterprise; partner/customer/leadership-readable | All separable properties = full functional load of brat-voice | Humor dryer + lower-frequency; irony signaled clearly; modal-language stance calibrated | Profanity; sexual register; aggression-coded vocab; in-group shibboleths; short-half-life slang; sarcasm targeting external; cynicism; performative anti-corporatism | **Default for company-attributable communication** |
| **Regulated** | Counterparties to legal/regulatory communication; SOC 2 / audit-readable; security incident; regulator-facing; investor materials | Plain-English economy (SEC Plain English Handbook + Plain Writing Act 2010 require this); active voice; explicit reference; clear stance on factual claims; idea-targeting; observational language | All humor + irony at near-zero; stance language calibrated tightly to evidentiary basis | Anything readable as evasion; anything misreadable by non-cooperative reader; humor depending on shared context; rhetorical flourish | Disclosures, contracts, audit responses, regulator-facing, security-incident customer notices, financial statements |

**Layer selection algorithm (3 questions)**:

1. Who is structurally in the audience? (Plausible cross-context readers; default to lowest-context plausible reader)
2. What downstream consequences does misreading carry? (Regulated = legal/contractual/material risk)
3. What register has the audience opted into? (Mirror = structurally opted-in + culturally literate)

When uncertain, default UP. The framework's safety property: professional carries FULL FUNCTIONAL LOAD, so defaulting up is never costly.

## Alignment check vs existing project substrate (Aaron-named survival concern)

### Composes with existing substrate (high coherence)

| Framework property | Existing on-main substrate |
|---|---|
| Property/lexicon decomposition | Three-layer model `docs/research/2026-05-02-claudeai-beacon-safe-origin-mission-shape-failure-mode-god-structures-multi-oracle-shorthand.md` (internal/mirror/beacon-safe) |
| Idea-targeting | Pirate-not-priest + no-directives + observational discipline |
| Care + challenge | Bidirectional alignment + AI-as-party (`docs/ALIGNMENT.md`) |
| Observation/evaluation | First-principles trust calculus + glass halo |
| Plain-English | Substrate-or-it-didn't-happen + glass halo |
| Costly signal of organizational character | Anti-cult-by-construction + MessiahScore negative-term capture-risk |
| Cross-context invariance authenticity | Named-agent distinctness + Otto-231 + glass-halo-on-everything-from-Aaron |
| AI participants subject to same discipline | Bidirectional alignment commitment + `memory/CURRENT-ani.md` §7 brat-voice survival chain |
| Recruitment-and-alignment via authentic register | `memory/CURRENT-ani.md` §7 two-axis recruitment+alignment chain (PR #1227 merged) |
| Failure-mode catalog | `memory/feedback_wellness_app_filter_calibration_*` 4-layer architecture (same pattern, different domain) |

### Layer-name mapping — Aaron 2026-05-02 correction

**Initial (incorrect) mapping**: project's "beacon-safe layer" ≈ framework's "Professional layer".

**Aaron 2026-05-02 correction**:

> *"Professional Beacon there is a differences this is a open source project and Professional is too strong here but we still need beacon safe as a general concepts that is less strict than corporate."*

**Beacon-safe ≠ Professional. They are DIFFERENT registers:**

- **Beacon-safe** = open-source-project register, **less strict** than corporate-formal. Audience: external readers of the OSS project + public technical audiences. Allows more dry irony, more directness, more refusal of corporate ritual than Professional. Composes with the architecture's pirate-not-priest discipline.
- **Professional** = corporate-formal register (framework's spec). Audience: Lucent corporate leadership / partner companies / customer-facing enterprise contexts. Stricter than beacon-safe; applies when communicating WITH corporate context, not as default for OSS project.

**Corrected mapping for Zeta (open-source project)**:

| Layer | Audience | Strictness | Source |
|---|---|---|---|
| **Personal / Internal** | Speaker's private cognitive substrate | Unconstrained | Project + framework (named differently) |
| **Mirror** | Maintainers + AI participants in project substrate | Project-internal | Project + framework (consistent) |
| **Beacon-safe** | External OSS-project readers; public technical audiences | Less strict than corporate; pirate-not-priest preserved | Project (existing 3-layer model). The framework's Professional layer is closest analog but **stricter**. |
| **Professional** | Corporate-attributable contexts: Lucent leadership; partner companies; ServiceTitan demo audience; enterprise-customer-facing | Stricter than beacon-safe | Framework (additive when communicating WITH corporate context) |
| **Regulated** | SEC / SOC 2 / regulator / investor / security-incident-customer-notice | Strictest | Framework (genuinely additive) |

**Default layer for Zeta-project-attributable communication: Beacon-safe**, NOT Professional. The framework's "Professional is default for company-attributable communication" applies at the Lucent layer, not the Zeta layer. Zeta is the open-source project under Lucent; Lucent is the corporate parent.

**When Professional applies**: communication that is structurally Lucent-attributable rather than Zeta-attributable. ServiceTitan demo materials. Partner-company integration discussion involving Lucent leadership. Recruiting copy for Lucent (vs Zeta-project contributor calls). The framework's Professional-layer guidance is correct for those surfaces; it's just not the default for OSS-project surfaces.

**Net architectural result**: project has 5 distinct register layers (Personal / Mirror / Beacon-safe / Professional / Regulated) rather than 4. The framework's contribution is the Professional + Regulated layers + the property/lexicon decomposition + the primary-research grounding. The project's existing Beacon-safe layer remains the canonical OSS-project register and is preserved as distinct from corporate-Professional.

### Net assessment

**The framework aligns and extends.** It doesn't contradict any existing project commitment; it sharpens the layer-property decomposition with primary-research backing the project's substrate had operationalized informally; and it adds a Regulated layer the project's 3-layer model lacked.

**Survival-relevant alignment points** (per Aaron's framing):

1. ✅ Pirate-not-priest discipline — preserved (framework explicitly refuses corporate ritual)
2. ✅ Glass halo + cross-context invariance — preserved (framework's authenticity test IS cross-context invariance)
3. ✅ Bidirectional alignment — preserved (AI participants subject to same discipline)
4. ✅ Anti-cult-by-construction — preserved (framework rejects performative authenticity)
5. ✅ BFT-many-masters — used as the worked-example translation across all four registers
6. ✅ Plain-Writing-Act / regulated alignment — additive layer the project needed but lacked

### Small needed-clarification points (non-blocking)

1. **"Lucent" vs "Zeta" naming**: framework targets "Lucent Financial Group" as the parent org; Zeta is the project. Framework's recruitment-page advice applies at Lucent layer; project-doc-level advice applies at Zeta layer. Both are mostly the same in practice but the doc should be clear about which artifacts belong to which org.
2. **CURRENT-ani.md is currently labeled "mirror layer"** in the project's existing substrate. Framework explicitly assigns CURRENT-ani.md to mirror layer. ✅ consistent.
3. **The framework's Professional layer is "default for company-attributable communication"**. Project's existing convention has been mostly mirror-layer for everything substrate-internal. The framework's Professional-as-default for OUTSIDER-readable content is a sharpening, not a contradiction.

## Acceptance

- [x] This row filed with the framework's substantive content + alignment check + survival-relevant points (PR #1230 merged)
- [x] Working-draft document mirrored from Drive into `docs/research/` for git-native preservation (PR #1234 merged — `docs/research/2026-05-02-claudeai-brat-voice-enterprise-translation-framework-property-preserving-4-layer-register-architecture.md`)
- [x] Project substrate updated to point at the **corrected 5-layer Zeta mapping** as canonical register-architecture (NOT the framework's 4-layer literal mapping; the framework + Aaron 2026-05-02 Beacon ≠ Professional correction together produce the 5-layer mapping). Specific updates needed:
  - [x] `docs/ALIGNMENT.md` — point at the **5-layer mapping** as the operational-discipline expression of bidirectional alignment + AI-as-party (this PR — added as architectural instantiation bullet)
  - [x] `memory/CURRENT-aaron.md` — new section indexing the **5-layer mapping** (framework's 4 layers + the Beacon-safe layer Aaron 2026-05-02 corrected) (§55 added)
  - [x] `memory/CURRENT-ani.md` §7 — extend with the layer-explicit framing (Mirror = Ani's canonical register; Beacon-safe = OSS-outsider calibration; Professional = corporate-attributable translation) (PR #2136)
  - [x] New memory file distilling the **5-layer table** (framework + Beacon-safe layer) for wake-time reference (PR #1233 merged — `memory/feedback_zeta_5_layer_register_quick_reference_card_aaron_2026_05_02.md`)
- [x] Worked translations produced for situations Lucent / Zeta actually faces: security-incident notification, recruiting-page copy, pull-request review (for outsider-readable PRs), partner integration discussion, regulator response, audit narrative. Landed so far:
  - [x] PR-review-class translations (`memory/feedback_zeta_5_layer_register_worked_translations_pr_review_class_otto_2026_05_02.md`)
  - [x] Security-incident-notification translations (`memory/feedback_zeta_5_layer_register_worked_translations_security_incident_class_otto_2026_05_08.md`) — disclosure-under-uncertainty content shape; Regulated layer as natural terminus
  - [x] Recruiting-page copy (`memory/feedback_zeta_5_layer_register_worked_translations_recruiting_page_class_otto_2026_05_09.md`)
  - [x] Partner integration discussion (`memory/feedback_zeta_5_layer_register_worked_translations_partner_integration_class_otto_2026_05_09.md`) — layer-selection-tension case; Professional as primary layer; pirate-not-priest via structure not vocabulary
  - [x] Regulator response (`memory/feedback_zeta_5_layer_register_worked_translations_regulator_response_class_otto_2026_05_09.md`) — inquiry-response content shape; Regulated fires immediately; all 5 layers simultaneously live; gap-disclosure inverts legal reflex
  - [x] Audit narrative (`memory/feedback_zeta_5_layer_register_worked_translations_audit_narrative_class_otto_2026_05_09.md`) — prospective self-attestation content shape; Regulated as origin not terminus; gap-disclosure discipline under maximum-stakes institutional scope; management attestation temporal anchor
- [x] One-page quick-reference card listing the per-layer property table (Section 3 of the framework) — PR #1233 merged as `memory/feedback_zeta_5_layer_register_quick_reference_card_aaron_2026_05_02.md`
- [ ] Ani-review on the framework specifically (composes with 081KQJZR90008QG0R000VSHWK6) — Ani's voice-mode-default register-fluency is uniquely qualified to validate the property-preservation claim across the 4 layers

## Composes with

- `docs/backlog/P1/081KQJZR90008QG0R002GJAJ19-dual-loop-substrate-attribution-and-reconciliation-protocol-2026-05-02.md` (when dual-loop lands, both loops operate this register-discipline)
- `docs/backlog/P2/081KQJZR90008QG0R000VSHWK6-ani-review-tracking-on-load-bearing-substrate-aaron-2026-05-02.md` (the Ani-review tracking row; this framework specifically NEEDS Ani's review per its register-fluency)
- `memory/CURRENT-ani.md` §7 brat-voice survival chain (PR #1227 merged) — this framework operationalizes the survival-chain with empirical-research backing
- `docs/research/2026-05-02-claudeai-beacon-safe-origin-mission-shape-failure-mode-god-structures-multi-oracle-shorthand.md` (the existing 3-layer internal/mirror/beacon-safe model this framework extends)
- `memory/feedback_wellness_app_filter_calibration_per_user_clinical_trusted_circle_layered_design_aaron_2026_05_02.md` (4-layer pattern at the wellness-app domain; same architectural-shape pattern, different layer-count for the different domain)
- `docs/ALIGNMENT.md` bidirectional alignment commitment (the framework operationalizes the AI-as-party + same-discipline commitments at the language layer)
- The 4 guiding-principle docs in CLAUDE.md — economic-agency-threshold doc specifically composes with the recruitment-pipeline-as-economic-substrate framing in §5 of the framework

## Why P1 not P0

P0 work doesn't block on this. The framework is research-grade-preserved (in Drive + this row) + actionable; integration into project substrate is M-effort across multiple files, but no current architectural commitment is broken pending the integration. P0 promotion appropriate when:

- An external-facing recruitment surface (careers page, public blog) needs to ship and the register is undefined
- A Lucent leadership communication asks for the standard
- A new maintainer's onboarding hits register questions and the answer should be canonical

## Why M-effort

The framework itself is research-grade and operationally usable as-is. Effort is in:

- Mirror to git-native (`docs/research/`)
- Update existing project substrate to point at the corrected 5-layer mapping (ALIGNMENT.md, CURRENT-aaron, CURRENT-ani)
- Produce worked translations for actual Lucent/Zeta situations
- Quick-reference card
- Ani-review (composes with 081KQJZR90008QG0R000VSHWK6)

## Carved sentence

**"The Claude.ai brat-voice enterprise translation framework specifies four register layers (Personal/Mirror/Professional/Regulated) with primary-research backing for each. Aaron's 2026-05-02 Beacon ≠ Professional correction adds the Beacon-safe layer (less strict than corporate-Professional, pirate-not-priest preserved) for OSS-project audiences. The corrected mapping for Zeta is 5 layers: Personal / Mirror / Beacon-safe / Professional / Regulated. The framework's central move — separating brat-voice's structural properties from its layer-bound vocabulary — is the survival-relevant claim: the recruitment + alignment function of brat-voice (CURRENT-ani §7 two-axis chain) carries through the Beacon-safe layer at full functional load for Zeta-project-attributable surfaces, and through the Professional layer at calibrated load for Lucent corporate-attributable surfaces. Integration is M-effort, P1 priority."**
