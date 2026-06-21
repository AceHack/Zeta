---
id: 081KSGS9H0008QG0R001876MP6
priority: P2
status: open
title: Zeta could offer Shortform.com-like features (in-depth book/article/YouTube guides with cross-substrate-engineering composition map) — productize what the framework already does internally for itself (Aaron 2026-05-26)
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002F1G7ER
  - 081KSGS9H0008QG0R0006F4BGX
composes_with:
  - 081KSGS9H0008QG0R002PT5C7J
  - 081KSGS9H0008QG0R001K8VPV4
  - 081KRW63S0008QG0R0025E4PH6
tags: [product-feature, shortform-equivalent, deep-guides, cross-substrate-composition, content-capture, external-publishing, browser-extension-target, monetization-substrate, productize-internal-discipline]
---

## Problem

Operator 2026-05-26: *"we should offer shortform.com like features"*

Empirical anchor: today's 5 PRs (#5364-#5368) across the Kirsanov YouTube channel substrate-capture (081KSGS9H0008QG0R002F1G7ER + 081KSGS9H0008QG0R0006F4BGX) are a working demonstration of Shortform-equivalent features applied to substrate-engineering work:

- Verbatim transcript preservation (mirror-tier per `.claude/rules/substrate-or-it-didnt-happen.md`)
- Composition map ("what this means in the framework substrate context")
- Cross-substrate linkage (composes_with graph)
- Substrate-honest synthesis sections
- Per-source companion backlog rows

Shortform.com offers (per Kirsanov's sponsor read in 081KSGS9H0008QG0R002F1G7ER.3):

> "in-depth book guides that go way beyond simple summaries. They unpack the key ideas and weave in related insights from other books and research papers which really helps to see the big picture... browser extension that can generate similar in-depth guides for articles and YouTube videos you encounter online."

The framework ALREADY does this work for itself across substrate-engineering substrate. Externalizing it as a product/service would compose with the existing Aurora (081KSGS9H0008QG0R002PT5C7J), DePIN (081KSGS9H0008QG0R001K8VPV4), and additive-cash-register substrate (per `.claude/rules/additive-not-zero-sum.md` + PR #2822 cash-register-that-keeps-giving-gifts).

## Target

Substrate-engineering work landing across 4 phases:

### Phase 1 — Catalog the framework's existing Shortform-equivalent substrate

Demonstrate that the framework already produces Shortform-equivalent output by cataloging:

- All `docs/research/*.md` files where verbatim preservation + composition map landed
- All `docs/research/ip-questionable/*.md` files where third-party content was preserved with substrate-engineering integration
- The 5-PR Kirsanov work today (#5364-#5368) as a working demonstration of the discipline
- The substrate-engineering rule-cluster that enables this (substrate-or-it-didnt-happen + wake-time-substrate + verify-existing-substrate-before-authoring + glass-halo-bidirectional + ...)

Output: `docs/research/shortform-equivalent-discipline-catalog.md` enumerating the substrate + the discipline that produces it.

### Phase 2 — Generalize beyond substrate-engineering scope

The framework's current Shortform-equivalent work is scoped to ZETA SUBSTRATE-ENGINEERING. Generalizing requires:

- Authoring discipline that works on arbitrary topics (not just framework-internal substrate)
- Composition-map generation against external knowledge graphs (not just internal substrate-row graph)
- Cross-reference discovery via WebSearch + bandwidth-served-falsifier discipline (per `.claude/rules/dep-pin-search-first-authority.md` + `.claude/rules/bandwidth-served-falsifier.md`)
- Substrate-honest framing transferable beyond Zeta-specific context

Output: `tools/shortform/generate-deep-guide.ts` — TS CLI that takes a source URL (book, article, YouTube video) + a topic + a set of related sources, emits a deep guide with composition map.

### Phase 3 — Browser-extension equivalent

Shortform's browser extension generates deep guides for any article / YouTube video the user encounters. Zeta's equivalent path:

- Compose with existing peer-call infrastructure (per `.claude/rules/peer-call-infrastructure.md`)
- `bun tools/peer-call/shortform-guide.ts <URL>` invokes the deep-guide-generation pipeline against external content
- Output lands in `docs/research/external/` (or `docs/research/ip-questionable/` if substantial verbatim is needed)
- Composes with the existing claude.ts / kiro.ts / amara.ts / etc. peer-call wrappers

### Phase 4 — Monetization / external-publishing substrate

**TWO scopes per operator 2026-05-26 follow-on** (*"we can sell that too to others eventually"*):

#### Phase 4a — Sell the OUTPUT (consumer-scope; Shortform-equivalent)

Hosted deep-guide service for consumers. Per Aurora (081KSGS9H0008QG0R002PT5C7J) + DePIN (081KSGS9H0008QG0R001K8VPV4) + additive-cash-register (PR #2822) once Phase 1-3 substrate lands:

- Free tier: substrate-engineering discipline + tooling open-sourced
- Paid tier: hosted deep-guide service with curated external content + composition graph
- Community-contribution tier: external authors contribute deep-guides composing with their own substrate-engineering work
- Composition with `_ip_risk_acceptance` pattern at scale for verbatim third-party content handling

#### Phase 4b — Sell the SUBSTRATE-ENGINEERING DISCIPLINE itself (B2B-scope)

The discipline that PRODUCES these deep-guides is itself sellable to other companies / projects / individuals who want to do substrate-engineering on THEIR OWN substrate (internal docs, research corpora, codebase + decisions substrate, organizational memory).

Customer-facing offering shape:

- Zeta runtime + skill catalog (per `.claude/rules/zeta-ships-with-skills-immediate-value.md`)
- Substrate-engineering discipline training (rules + memory + research + cross-substrate-triangulation methodology)
- Customer-owned `_*_acceptance` blocks + customer-owned ip-questionable-equivalent folders + customer-owned composes_with graph
- Periodic Zeta substrate-engineering audits (similar shape to security audits but for substrate-engineering hygiene)
- Multi-AI substrate-engineering cluster (operator-customer + customer's chosen AI participants + Zeta substrate as discipline-substrate-provider)

Phases 4a and 4b are NOT mutually exclusive. 4a is consumer-scope productization of OUTPUTS; 4b is B2B productization of the DISCIPLINE itself. The framework's substrate-engineering work IS the moat; the OUTPUTS are downstream. Both ship in parallel as substrate-engineering bandwidth allows.

Substrate-honest framing per `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`: monetization layer remains end-user-invariant-set; Zeta substrate provides the discipline + tooling; consumers pick their own monetization model AND their own substrate-engineering invariants.

## Acceptance

**Phase 1 acceptance**: catalog landed at `docs/research/shortform-equivalent-discipline-catalog.md`; 5 documented examples (e.g., the 5 Kirsanov PRs today)

**Phase 2 acceptance**: `tools/shortform/generate-deep-guide.ts` produces a deep-guide for at least one external source; output passes substrate-engineering review (composition map present, cross-references navigable)

**Phase 3 acceptance**: `bun tools/peer-call/shortform-guide.ts <URL>` runs end-to-end against at least one YouTube video + one article + one PDF

**Phase 4 acceptance**: external-publishing substrate documented (monetization options enumerated + end-user-invariant scoping preserved); operator decides which path to pursue

## Substrate-honest framing

P2 priority because:

- Operator-suggestion (Aaron 2026-05-26) — substantively valuable but NOT immediately tractable as single-PR work
- The framework ALREADY does the work internally; productization is forward-facing
- Multiple existing substrate clusters (Aurora, DePIN, additive-cash-register, ip-questionable, peer-call) compose at the productization layer
- The 5-PR demonstration today (081KSGS9H0008QG0R002F1G7ER Kirsanov channel) is the empirical proof that the discipline produces useful outputs

NOT immediately tractable as single-PR work. Phased to allow incremental landing per "you can always commit backlog rows immediately they get decomposed later" discipline.

## Demonstrated substrate from this session (working examples)

Five Shortform-equivalent deep guides landed today across the Kirsanov channel substrate-capture:

1. **081KSGS9H0008QG0R002F1G7ER.1 — Boltzmann Machines from first principles** (verbatim transcript + composition map with 11 Zeta substrate-row mappings + Hopfield → Boltzmann → RBM lineage framing)
2. **081KSGS9H0008QG0R002F1G7ER.2 — RNN / LSTM / GRU gated memory** (verbatim transcript + 14 Zeta substrate-row mappings + α=1 hoarding failure mode named)
3. **081KSGS9H0008QG0R002F1G7ER.3 — Reservoir Computing** (verbatim transcript + 16 Zeta substrate-row mappings + EXPLICIT Hawkins Thousand Brains anchor at 5:42 + 4 archetype-naming sections: walls-of-pool, entanglements-as-joins, multi-z(t), critical-archetype)
4. **081KSGS9H0008QG0R0006F4BGX substrate (this session)** — Amara ferry preservation + thermal-forgetting / root-axiom-update substrate-engineering work + 4-keeper-rule final form
5. **081KSGS9H0008QG0R001876MP6 (this row)** — productization opportunity recognition

Each is structurally identical to what Shortform produces (verbatim third-party content + in-depth synthesis + cross-references + composition with related substrate). The difference: Zeta does it for substrate-engineering work; Shortform does it for self-improvement / pop-knowledge. Same discipline; different scope.

## Composes with

- 081KSGS9H0008QG0R002F1G7ER (parent — Kirsanov channel substrate-capture; demonstrates the discipline)
- 081KSGS9H0008QG0R0006F4BGX (thermal-forgetting / root-axiom-update substrate — applies to deep-guide retention)
- 081KSGS9H0008QG0R002PT5C7J (Aurora pitch — community guardian AIs; productization composes here)
- 081KSGS9H0008QG0R001K8VPV4 (DePIN play — multi-stream PoUW-CC; distributed productization)
- 081KRW63S0008QG0R0025E4PH6 (cross-substrate-triangulation — multi-AI deep-guide synthesis)
- `.claude/rules/substrate-or-it-didnt-happen.md` (mirror-tier preservation discipline)
- `.claude/rules/wake-time-substrate.md` (substrate landing discipline)
- `.claude/rules/verify-existing-substrate-before-authoring.md` (composition discovery)
- `.claude/rules/peer-call-infrastructure.md` (peer-call wrapper extension point for Phase 3 browser-extension equivalent)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (`_ip_risk_acceptance` pattern composes at scale for Phase 4)
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` (end-user-invariant-set discipline applies to monetization layer)
- `.claude/rules/additive-not-zero-sum.md` (cash-register-that-keeps-giving-gifts framing — Phase 4)
- `.claude/rules/bandwidth-served-falsifier.md` (deep-guides serve readers' bandwidth at typing-bandwidth scope)
- `.claude/rules/glass-halo-bidirectional.md` (substrate-honest framing for external publication)
- PR #2822 (cash-register-that-keeps-giving-gifts — positive-sum monetization not zero-sum extraction)
- The 5 PRs from this session (#5364-#5368 + #5369 pending) as working examples

## Origin

Aaron-forwarded 2026-05-26 substrate-honest observation during the Kirsanov channel substrate-capture work. The framework's 5-PR session was structurally identical to what Shortform offers as a paid service; operator recognized the productization opportunity.

Per Aaron's "you can always commit backlog rows immediately they get decomposed later" discipline + the additive-not-zero-sum framework. Future sub-rows (081KSGS9H0008QG0R001876MP6.1 through 081KSGS9H0008QG0R001876MP6.N) decompose Phase 1/2/3/4 independently as scope tightens.
