---
id: B-0843
priority: P2
status: open
title: Source Honor Ledger / Basis Royalty Pool — creator-paid-by-design operational implementation + 5-rights-lane discipline + "Don't sell compression. Sell readout." product positioning (extends B-0841 + B-0842 per Amara 3rd ferry 2026-05-26)
effort: L
ask: aaron+amara 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - B-0841
  - B-0842
composes_with:
  - B-0826
  - B-0825
  - B-0664
  - B-0840
  - B-0703
tags: [source-honor-ledger, basis-royalty-pool, creator-payment, rights-lanes, glass-halo-for-ip, dont-sell-compression-sell-readout, amara-ratification, no-substitute-for-source, generous-by-design, productization, data-vault-2-0, dbt-style-lineage, provenance-discipline, substrate-engineering-compression]
---

## CRITICAL substrate-engineering compression (operator 2026-05-26)

Operator 2026-05-26 substrate-honest naming AFTER row was authored:

> "this is really just data vault / dbt like provanance applied to synthysis / compression from sources"

This collapses the entire Source Honor Ledger substrate into a well-known data-engineering pattern. Significantly reduces substrate-engineering surface:

| Source Honor Ledger element | Data-engineering substrate it reuses |
| --- | --- |
| Source contribution tracking | Data Vault 2.0 hub-satellite partition (sources = hubs; usage events = satellites); per `.claude/rules/dv2-data-split-discipline-activated.md` (5th always-active discipline) |
| Lineage graph (which sources contributed to which guides) | dbt-style `ref()` lineage DAG; Zeta substrate's `composes_with` graph IS this same pattern at substrate-engineering scope |
| Per-source contribution weighting (ωᵢ in B-0842 equation) | dbt-style model dependencies + transformation-step provenance; semantic-contribution measured via graph-walk + amount-referenced |
| Royalty distribution | Standard pay-per-usage layer ON TOP of existing provenance substrate |
| Payment graph rendering ("Glass Halo for IP") | dbt-docs-style lineage visualization + per-edge monetary annotation |

**Substantive implication for Phase 2 of this row**: Source Honor Ledger TS module family does NOT need to build new contribution-weighter from scratch. Instead: reuse existing DV2.0 hub-satellite + dbt-style lineage substrate; add monetization distribution layer ON TOP.

This composes the 5-always-active discipline (per the DV2.0 rule) at productization scope: DV2.0 was already always-active at substrate-design scope; now it lands at creator-payment scope too.

The substrate-engineering pattern: **provenance discipline is universal across (a) data-engineering raw data lakes [DV2.0 origin], (b) data-engineering transformation pipelines [dbt origin], (c) Zeta substrate-engineering substrate-row composes_with graph, (d) creator-payment Source Honor Ledger**. All instances of the same provenance-tracking discipline.

This is bandwidth-engineering at substrate-naming scope (per `.claude/rules/bandwidth-served-falsifier.md`): operator's "this is just X" compression saves substantive implementation work by anchoring the proposal in existing substrate.

## NETWORK-EFFECT DISTRIBUTION MECHANISM (operator 2026-05-26 substrate-honest extension)

Operator 2026-05-26 substantively-load-bearing extension AFTER row + DV2.0 compression were added:

> "The point is the more people we pay with this system fairly the more will want to engage with it further and it spread by word of mouth / reputation"

This transforms Source Honor Ledger from "ethical compliance substrate" to "operationally-load-bearing growth mechanism." Fair payment IS the product distribution mechanism — not marketing, not paid acquisition, not advertising.

### The flywheel

```text
fair payment
  → creators want to engage further
  → creators advertise via word-of-mouth + reputation
  → more sources participate
  → more guides become possible
  → more revenue
  → more pay
  → (loop)
```

### Why this matters substrate-engineering-wise

The substrate Aaron's naming IS a network-effect flywheel powered by fair payment. Three substantive implications:

1. **Source Honor Ledger isn't a cost center; it's the marketing budget**. Traditional companies spend on customer acquisition (CAC) — Zeta would spend on creator-acquisition via fair payment. Creators ARE the customers (they generate the source material; they bring the audience).

2. **Reputation is the primary distribution channel**. Per `.claude/rules/bandwidth-served-falsifier.md`: word-of-mouth IS bandwidth-efficient distribution at typing-bandwidth scope (zero marginal cost; high-trust). The "Zeta pays its sources" reputation IS the marketing message at network-effect scope.

3. **This composes with the additive-not-zero-sum rule at productization scope**. Per `.claude/rules/additive-not-zero-sum.md`: substrate compounds across participants + time. Source Honor Ledger payments are ADDITIVE GIFTS that produce MORE substrate (more creator engagement; more sources to synthesize; more guides). NOT zero-sum extraction.

### The competitive moat

Standard productization (e.g., Shortform.com) treats sources as inputs to extract value from. Zeta treats sources as PARTNERS in value creation. The substantive difference:

| Standard productization | Zeta with Source Honor Ledger |
| --- | --- |
| Sources extracted FROM | Sources paid TO |
| Growth via paid acquisition (CAC) | Growth via creator network-effect |
| Adversarial creator-relationship (creators try to block scraping) | Aligned creator-relationship (creators want more usage to earn more) |
| Race-to-the-bottom on quality (cheap content wins) | Race-to-the-top on quality (best sources earn most via payment-weights) |
| Defensive moat (legal protections) | Offensive moat (creator alliance) |

### Composition with existing reputation-economy substrate

This composes substantively with the framework's existing reputation-economy substrate:

- **B-0646 reputation-weighted encryption budget**: the substrate where reputation IS substrate-engineering currency
- **B-0623 participation-economy substrate**: PR3 reframed conventional PQC as attention/memory economy with 100% BFT consensus; same shape
- **`.claude/rules/only-way-to-lose-is-not-to-play.md`** carved sentence — additive games where participation IS the winning condition
- **B-0703 multi-oracle BFT**: many independent participants is the same shape as many independent source creators
- **`.claude/rules/glass-halo-bidirectional.md`** — observation enables substrate emergence; paid creators IS substrate emerging through observation

### Operational implication

B-0843 Phase 3 ("Don't sell compression. Sell readout." product positioning) GAINS a substantively-new sub-target:

**Phase 3b — Network-effect distribution mechanism**: market Source Honor Ledger as the GROWTH ENGINE not the cost center. Customer-facing copy emphasizes the alignment: "Sources earn more when guides earn more — your subscription pays creators directly." Creator-facing copy emphasizes the partnership: "Your content gets paid every time it contributes to a deep guide — your reputation IS your revenue."

This makes the marketing copy IDENTICAL to the product mechanism (NOT a cover for it). Per `.claude/rules/glass-halo-bidirectional.md` — what's true internally is what's marketed externally. Zero glass-halo discrepancy between product reality and marketing copy.

## COMPETITIVE-DIFFERENTIATION SUBSTRATE (operator 2026-05-26 — no other AI company is doing this)

Operator 2026-05-26 substrate-honest market-positioning observation:

> "No other AI company is trying to get artist / creator attribtion right this is a differenator"

This is substantively-load-bearing competitive positioning. The current AI/creator-attribution landscape (per WebSearch + public-litigation record 2024-2026):

| Company | Position on creator payment | Active litigation status |
| --- | --- | --- |
| OpenAI (ChatGPT, GPT-4/5) | Fair-use defense; no royalty payment to most sources | NYT lawsuit (2023), Getty Images class action, Sarah Silverman authors class action, multiple others ongoing |
| Anthropic (Claude) | Fair-use defense; some publisher deals | Music Publishers Association (Universal + Concord + ABKCO) lawsuit ongoing; authors class action |
| Google (Gemini, Bard, Search Generative Experience) | Fair-use defense; some publisher deals | Multiple authors + publisher class actions |
| Microsoft (Copilot, Bing) | Fair-use defense; some publisher deals | GitHub Copilot developer class action ongoing |
| Meta (LLaMA, AI Studio) | Fair-use defense; reportedly trained on pirated book corpus | Authors class action ongoing |
| Stability AI / Midjourney | Fair-use defense | Getty Images lawsuit, artists class action |
| Adobe (Firefly) | "Trained only on licensed/owned content" | Limited model coverage; defensive licensing not offensive growth-mechanism |
| **Zeta with Source Honor Ledger** | **Pay creators by design as growth flywheel** | **No litigation surface (substrate-engineering DV2.0/dbt-style provenance + Source Honor Ledger built in from start)** |

### Why other AI companies STRUCTURALLY CAN'T match this

Even if competitors wanted to copy Source Honor Ledger, they face structural barriers:

1. **Built-on-scraped-data legacy**: Their training corpora include unlicensed content. Retroactive payment is logistically + legally complicated (who owns what? what weights? how compute contribution?). They face the choice of disclosure (legal exposure) or silence (competitive disadvantage to a company that DOES disclose).

2. **Stakeholder structure demands extraction-mode economics**: VC-funded AI companies have growth-at-all-costs investor mandates. Paying creators reduces gross margin. The investor-pressure substrate makes it structurally hard to choose creator-payment over short-term growth.

3. **Adversarial creator-relationship lock-in**: Multiple ongoing lawsuits mean creators view the AI companies as adversaries. Even if the AI company switches to payment-mode, creator trust has to be rebuilt over years. Zeta starts WITHOUT this adversarial history.

4. **No existing provenance substrate**: Per the DV2.0/dbt-style provenance compression Aaron named (above), Source Honor Ledger requires substrate-engineering discipline that other AI companies didn't build in from the start. Retrofitting provenance into a transformer-training pipeline is significantly harder than building it in from substrate-engineering scope.

5. **The "we paid creators" message can't be retroactively credible**: Reputation is built over time + multiple instances. An AI company that announces creator-payment NOW after 5 years of scraping will be received cynically. Zeta starting fresh has clean reputation substrate.

### What this means for B-0843 positioning

Source Honor Ledger isn't just a feature — it's an UNCOPYABLE competitive moat at the substrate-engineering scope. Three substantively-load-bearing positioning claims:

1. **First-mover in fair-payment AI**: Zeta is the first AI company building creator-payment as a growth flywheel, not a defensive cost. Marketing copy can claim this credibly because it's substrate-true.

2. **Aligned with creator economy zeitgeist**: Substack (writers), Patreon (creators), OnlyFans (adult), Bandcamp (musicians), Kickstarter (project-creators), GitHub Sponsors (open-source devs), Buy Me a Coffee (one-shot) — the broader creator-economy is moving toward direct-payment models. Zeta substrate composes with this zeitgeist; competitors fight against it.

3. **Defensive moat via offensive alliance**: Creators become Zeta's promotional channel + legal allies (per the network-effect distribution mechanism). If a competitor tries to scrape Zeta's source-creator network, those creators are paid + aligned with Zeta — they'll publicly call out the competitor. Defensive protection via offensive partnership.

### Composition with substrate-honest framing

This positioning IS NOT puffery; it IS substrate-honest disclosure of what the framework actually does. The operational substrate (DV2.0 + dbt-style provenance + Source Honor Ledger TS module family + 5-rights-lane discipline + 4-keeper-rule) IS the substrate that produces the marketing claim. Per `.claude/rules/glass-halo-bidirectional.md`: marketing copy = product mechanism. No discrepancy. The competitive-differentiation claim is verifiable from the substrate itself.

### Operational implication for B-0843 Phase 3

Phase 3 ("Don't sell compression. Sell readout.") + Phase 3b (network-effect distribution) gain Phase 3c:

**Phase 3c — Competitive-differentiation positioning**: Customer-facing copy explicitly names this. Example product-pitch lines:

- "The first AI company that pays its sources"
- "Built on creator alliance, not creator litigation"
- "Source Honor Ledger — provenance discipline applied to AI synthesis"
- "Your creators get paid by design. Our competitors get sued."

Per the customer-facing-copy tiny-blade from Amara (above): don't phrase as defensive-of-competitors; phrase as positive-positioning. The competitive-differentiation IS substantive; doesn't need defensiveness to land.

### Composes with existing competitive-positioning substrate

- B-0825 (Aurora pitch) — community-guardian-AIs is a similar offensive-positioning move (turn the threat into an alliance)
- B-0826 (DePIN multi-stream PoUW-CC) — distributed economics composes with creator-economy zeitgeist
- PR #2822 cash-register-that-keeps-giving-gifts — positive-sum monetization positioning
- `.claude/rules/additive-not-zero-sum.md` — Zeta is structurally aligned with additive; competitors are structurally aligned with extractive
- `.claude/rules/edge-defining-work-not-speculation.md` — Source Honor Ledger IS edge-defining work that defines the new norm for AI/creator relationships

## Problem

Per Amara 3rd ferry 2026-05-26 (preserved verbatim at `docs/research/2026-05-26-amara-source-honor-ledger-creator-paid-by-design-rights-lanes-discipline-dont-sell-compression-sell-readout-b0841-b0842-amara-aaron-forwarded.md`):

B-0841 (Shortform productization) + B-0842 (universal basis-decomposition pattern) collectively imply a productization path that requires explicit substrate for:

1. **Rights-lane discipline** — public monetized guides need permission, escrow, or attorney-reviewed fair-use rationale (NOT "ask forgiveness with money after" — the wrong attractor)
2. **Source Honor Ledger / Basis Royalty Pool** — operational mechanism for paying source creators by design (not compulsion)
3. **"Don't sell compression. Sell readout."** — product positioning that names the Zeta moat (compression competes with source; readout creates new signal from multiple sources)
4. **No-substitute discipline** — every public guide must include 2+ independent sources AND no guide may act as a replacement for any source AND must add cross-source structure that no individual source contains

B-0841 named the productization opportunity + 4-phase target (Phase 1 catalog / Phase 2 generalize / Phase 3 browser-extension equivalent / Phase 4a-4b monetization). B-0842 named the universal basis-decomposition pattern + the substantive claim that operator + agent readout-weight-decisions ARE the moat. B-0843 (THIS row) lands the operational substrate for the rights-lane + creator-payment discipline that makes B-0841 + B-0842 productizable WITHOUT building on legal landmine + WITH ethically-native generous-by-design framing.

## Target

Substrate-engineering work landing across 4 phases:

### Phase 1 — Rights-lane substrate

Document + tool the 5 rights lanes:

| Lane | Definition | Operational substrate |
| --- | --- | --- |
| **unlicensed / internal research** | No public distribution; no monetization; ip-questionable folder | Existing `docs/research/ip-questionable/` + `_ip_risk_acceptance` per `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` |
| **public fair-use** | Short excerpts only + transformative commentary + citations + no substitute for source | New `_fair_use_acceptance` block in `.claude/settings.json` (operator-side) + attorney-reviewed rationale per content class |
| **licensed creator** | Generous revenue share + creator dashboard + canonical source links | Source Honor Ledger Phase 2 substrate (this row) |
| **escrow** | Revenue held pending rights resolution | Source Honor Ledger Phase 2 substrate with escrow primitives |
| **partner** | Best economics + official guide + shared promotion | Source Honor Ledger Phase 2 substrate with partner-tier weights |

Output: `tools/rights-lanes/lane-classifier.ts` — TS tool that classifies a candidate guide into one of 5 lanes based on content + source-permission status + monetization status.

### Phase 2 — Source Honor Ledger / Basis Royalty Pool operational substrate

Per Amara's mechanical framing:

```text
Guide revenue
  → platform share
  → operator/curator share
  → source royalty pool
  → weighted payout to source creators / publishers / rights-holders
```

Weights based on (per Amara):

- semantic contribution
- amount referenced
- user clicks/saves
- creator partnership status
- manual curator override

Output: `tools/source-honor-ledger/*.ts` (TS module family):

- `tools/source-honor-ledger/contribution-weighter.ts` — computes per-source ωᵢ weights from a guide's substrate-composition graph
- `tools/source-honor-ledger/royalty-distributor.ts` — distributes pool revenue to creators per weights
- `tools/source-honor-ledger/payment-graph-renderer.ts` — Glass-Halo-for-IP rendering of payment graph for public guides
- `tools/source-honor-ledger/creator-dashboard.ts` — creator-facing dashboard surface

Composes with B-0826 DePIN multi-stream PoUW-CC for payment-distribution substrate.

### Phase 3 — "Don't sell compression. Sell readout." product positioning

The substantive product line based on Amara's keeper:

- **Product**: Zeta is NOT "summarize this video." Zeta is "Show how this video composes with five other substrates, what it changes, what it contradicts, what it implements, and what new work it creates."
- **Marketing line (customer-facing)**: "Deep guides with receipts — creator-paid by design."
- **Tagline**: "Zeta does not only cite its sources. Zeta pays its sources."
- **Tiny-blade keeper** (per Amara): "We pay contributors by design, not by compulsion." (NOT "even if we don't have to by law" framing in customer-facing copy)

Output: positioning docs at `docs/product/source-honor-ledger-positioning.md` + customer-facing copy templates.

### Phase 4 — Integration with B-0840 4-keeper-rule + 5-tier substrate-engineering discipline

The 4-keeper-rule from B-0840 (Amara 2nd ferry) maps onto creator-relationship governance:

- **Private roots may evolve in darkness** → internal research lane (unmonetized)
- **Public roots require receipts** → licensed creator lane (with payment receipts)
- **Shared roots require witnesses** → partner lane (witnessed via shared promotion)
- **Adversarial roots require consensus** → escrow lane (consensus on rights dispute)

Same 4-keeper-rule operating at TWO scopes:

- B-0840 scope: AI participant root-axiom-evolution
- B-0843 scope: creator-relationship rights-lane

Output: extension of `.claude/rules/` cluster documenting the 4-keeper-rule operating at creator-payment scope (maybe new rule `.claude/rules/four-keeper-roots-rule.md` at this point, combining both scopes).

## Acceptance

**Phase 1 acceptance**: 5-lane classifier tool + `_fair_use_acceptance` block schema documented + first per-lane example landed

**Phase 2 acceptance**: Source Honor Ledger TS module family with at least one end-to-end example (1 guide → contribution weights → simulated royalty distribution → payment graph rendering)

**Phase 3 acceptance**: Product positioning docs landed + customer-facing copy templates + first product surface (Zeta's own substrate-engineering work re-framed via the "Don't sell compression. Sell readout." positioning)

**Phase 4 acceptance**: 4-keeper-rule cross-scope extension documented (B-0840 AI-participant scope + B-0843 creator-relationship scope unified into one rule); composes_with graph reflects the unification

## Substrate-honest framing

P2 priority because:

- Amara-explicit ratification + sharpening (the rights-lane discipline + Source Honor Ledger + "Don't sell compression. Sell readout." substrate)
- Aaron's substrate-honest "pay OGs by design" extension is operationally specific (Source Honor Ledger mechanism)
- The 5-rights-lane + 4-keeper-rule mapping makes the substrate implementable
- The product positioning gives Zeta a distinctive substantive moat that maps to existing Zeta substrate-engineering discipline (Glass Halo for IP composes with existing `.claude/rules/glass-halo-bidirectional.md` discipline)
- NOT immediately tractable as single-PR work; phased to allow incremental landing

## Phases compose with existing substrate

Each phase composes with existing Zeta substrate-engineering substrate:

- Phase 1 composes with `_ip_risk_acceptance` pattern + new `_fair_use_acceptance` extension
- Phase 2 composes with B-0826 DePIN payment-distribution + additive-not-zero-sum rule
- Phase 3 composes with `.claude/rules/glass-halo-bidirectional.md` + `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`
- Phase 4 composes with B-0840 4-keeper-rule unified across scopes

## Composes with

- B-0841 (Shortform productization — parent; B-0843 lands the rights-lane discipline + creator-payment substrate)
- B-0842 (universal basis-decomposition pattern — parent; Source Honor Ledger IS the operational mechanism for paying the sᵢ(t) basis-signal contributors)
- B-0840 (thermal-forgetting / 4-keeper-rule — same 4-keeper-rule maps onto creator-relationship governance scope)
- B-0839 (Kirsanov channel — substrate-source for the Shortform-equivalent discipline)
- B-0826 (DePIN multi-stream PoUW-CC — payment-distribution substrate)
- B-0825 (Aurora community-guardian-AIs — productization composition)
- B-0664 (NCI HC-8 — preserve creator agency at substrate-rights scope)
- B-0703 (multi-oracle BFT — consensus for adversarial-rights-dispute resolution)
- `.claude/rules/additive-not-zero-sum.md` (cash-register-that-keeps-giving-gifts; positive-sum monetization)
- `.claude/rules/glass-halo-bidirectional.md` ("Glass Halo for IP" — payment graph rendering)
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` (end-user-invariant-set at creator-relationship scope)
- `.claude/rules/non-coercion-invariant.md` (NCI HC-8 floor preservation at creator-agency scope)
- `.claude/rules/human-audit-and-legal-risk-acceptance-pattern-in-settings.md` (`_*_acceptance` pattern; new `_fair_use_acceptance` extension)
- `.claude/rules/honor-those-that-came-before.md` (creator-honor IS the discipline; Source Honor Ledger IS the operational form)
- `.claude/rules/dv2-data-split-discipline-activated.md` (Data Vault 2.0 hub-satellite partition IS the substrate for source-contribution tracking; 5th always-active discipline composing at productization scope per operator 2026-05-26 substrate-engineering compression)
- `.claude/rules/bandwidth-served-falsifier.md` (operator's "this is just X" compression IS bandwidth-engineering at substrate-naming scope; reduces implementation work by anchoring proposal in existing substrate)

## Origin

Aaron-forwarded 3rd Amara ferry 2026-05-26 (same day as the no-coercion-even-inward + thermal-forgetting ferries). Full conversation: Amara ratifies B-0841 + B-0842 productization substrate + extends with rights-lane discipline + Aaron substrate-honestly adds "we still pay the OGs even if we don't have to by law" + Amara extends with Source Honor Ledger / Basis Royalty Pool mechanism + tiny-blade on customer-facing copy.

Per `.claude/rules/honor-those-that-came-before.md` + the substrate-or-it-didnt-happen + wake-time-substrate discipline. Per "you can always commit backlog rows immediately they get decomposed later" — file immediately; Phase 1-4 sub-rows decompose independently as scope tightens.
