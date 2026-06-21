---
id: 081KSNY2Z0008QG0R0036JTSTQ
priority: P3
status: open
title: Risk-distribution-asymmetry pricing extension to 081KSNY2Z0008QG0R000A5GP0X + state-capture multi-layer-attack-timeline pricing dimension
authors:
  - aaron
  - otto-cli
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R000A5GP0X
  - 081KSNY2Z0008QG0R000X6NHZ2
composes_with:
  - 081KSNY2Z0008QG0R0003VAH0N
  - 081KSNY2Z0008QG0R0031EAB6T
  - 081KSNY2Z0008QG0R001A431CN
  - 081KRW63S0008QG0R001Z7NYMV
related_personas:
  - operator
related_rules:
  - shadow-star-shorthand-autocomplete-marker
  - non-coercion-invariant
  - methodology-hard-limits
  - god-tier-claims-high-signal-high-suspicion-dont-collapse
  - razor-discipline
  - default-to-both
  - proud-if-pattern-propagates-personal-filter-for-substrate-engineering
related_skills:
  - applied-mathematics-expert
  - probability-and-bayesian-inference-expert
  - threat-model-critic
  - governance-expert
  - branding-specialist
  - product-manager
tags: [risk-distribution-asymmetry-pricing-extension-to-b0908, who-captures-revenue-vs-who-bears-cost-pricing, state-capture-multi-layer-attack-timeline, long-tail-terminal-payoff-pricing, layer-1-rent-extraction-layer-2-cost-externalization-layer-3-mass-immunity-layer-4-regulatory-pretext-layer-5-licensing-layer-6-state-control, asymmetry-ratio-revenue-divided-by-cost, home-miner-vs-centralized-miner-quote-scope-distinction, nci-hc-8-violation-at-economic-substrate-scope, framework-pricing-exposes-the-asymmetry-and-the-long-tail-state-capture]
---

# 081KSNY2Z0008QG0R0036JTSTQ — Risk-distribution-asymmetry pricing extension to 081KSNY2Z0008QG0R000A5GP0X + state-capture multi-layer-attack-timeline pricing

## Context

Per operator 2026-05-28 *"land both #2 (shadow*) It's even works it's a state attack vector"* authorization. Companion to 081KSNY2Z0008QG0R000X6NHZ2 (chain-CSAM empirical catalog + political-economy + state-capture-vector framing).

This row IS the substrate-engineering pricing-extension to 081KSNY2Z0008QG0R000A5GP0X that operationalizes:

1. **Risk-distribution-asymmetry** — when economic-actor-A captures benefit from a substrate-engineering choice while economic-actors-B-through-Z bear cost, that asymmetry IS priceable
2. **State-capture multi-layer-attack-timeline** — long-tail terminal payoff (state-controlled-substrate) is priceable as the dominant pricing dimension

## The substrate-engineering insight (per operator)

> *"This is why this is really a centralized miner play on bitcoin to spread the risk to home miners cause they want to continue charging for writing images and memes to the blockchain but not accept the risks they think if they spread it out that no one will get charged which might be true even though everyone is transmitting CSAM."*

> *"It's even works it's a state attack vector cause now they can say only 'safe' designated locations can run nodes cause it has CSAM and now they control bitcoin"*

The framework's 081KSNY2Z0008QG0R000A5GP0X attention-risk-pricing substrate, extended with this row, would expose BOTH the asymmetry AND the multi-layer-attack-timeline.

## Risk-distribution-asymmetry pricing extension

081KSNY2Z0008QG0R000A5GP0X's `AccelerationRiskQuote` adds quote-scope and asymmetry-pricing dimensions:

```typescript
type AccelerationRiskQuote<Scope> = {
  domain: string;
  actor: string;
  workflow: string;
  time_window: TimeRange;
  scope: Scope;                            // NEW: which economic-actor-class

  // Existing pricing outputs (per 081KSNY2Z0008QG0R000A5GP0X):
  expected_attention_loss:     AttentionUnit;
  tail_attention_risk:         AttentionUnit;
  repair_duration:             Duration;
  coordination_premium:        AttentionUnit;
  trust_drawdown_risk:         TrustUnit;
  memetic_spillover_risk:      number;
  recommended_speed_limit:     Rate;
  safe_acceleration_budget:    AttentionUnit;

  // NEW: risk-distribution-asymmetry pricing (this row):
  revenue_received:            EconomicUnit;     // for this scope
  revenue_concentration:       number;           // fraction of total going to this scope
  cost_distribution:           number;           // fraction of total borne by this scope
  asymmetry_ratio:             number;           // revenue / cost; 0 = pure subsidy from this scope

  // NEW: state-capture multi-layer-attack-timeline pricing (this row):
  terminal_payoff_layers:      LayeredPayoff[];  // per-layer payoff + probability + time-horizon
};
```

## The home-miner vs centralized-miner quote-scope distinction (worked example)

For the Bitcoin Ordinals inscription-policy decision, 081KSNY2Z0008QG0R000A5GP0X + 081KSNY2Z0008QG0R0036JTSTQ would generate TWO scope-distinct quotes:

### HOME-MINER scope quote

```typescript
AccelerationRiskQuote<HomeMinerScope> {
  domain: "bitcoin-node-operation"
  actor: "home miner / individual full node operator"
  workflow: "run-full-node-with-default-policy"
  time_window: post-2023-Taproot-Ordinals
  scope: HomeMinerScope

  expected_attention_loss:     LOW per-incident × MEDIUM over-time
                              × HIGH per-incident IF prosecuted
  tail_attention_risk:         CATASTROPHIC (single prosecution = personal exposure)
  repair_duration:             IRREVERSIBLE (criminal record)
  coordination_premium:        absent (no coordination mechanism with centralized miners)
  trust_drawdown_risk:         SEVERE (ecosystem trust + personal-reputation)
  memetic_spillover_risk:      HIGH (banking / ISP / family / employer)
  recommended_speed_limit:     "stop running node OR coordinate to enforce
                                arbitrary-data-exclusion policy"
  safe_acceleration_budget:    NEGATIVE

  // Asymmetry pricing:
  revenue_received:            ZERO
  revenue_concentration:       0%
  cost_distribution:           100% borne across N home miners
  asymmetry_ratio:             0  /  positive  =  INFINITELY UNFAVORABLE

  // State-capture pricing:
  terminal_payoff_layers: [
    {layer: 4, payoff: "regulatory pretext fires", probability: 0.4, time: 1-2yr},
    {layer: 5, payoff: "licensing required", probability: 0.3, time: 2-4yr},
    {layer: 6, payoff: "home-miner economic-substrate eliminated",
     probability: 0.2, time: 3-5yr,
     payoff_magnitude: TOTAL_LOSS_OF_OPERATIONAL_SUBSTRATE}
  ]
}
```

### CENTRALIZED-MINER scope quote

```typescript
AccelerationRiskQuote<CentralizedMinerScope> {
  domain: "bitcoin-pool-operation"
  actor: "Marathon / Foundry / F2Pool / major mining pool"
  workflow: "include-inscriptions-in-blocks"
  time_window: post-2023-Taproot-Ordinals
  scope: CentralizedMinerScope

  expected_attention_loss:     LOW (institutional + legal counsel + insurance)
  tail_attention_risk:         MEDIUM (regulatory action targets pools last)
  repair_duration:             RECOVERABLE (institutional / corporate remediation)
  coordination_premium:        LOW (pools already coordinate via mempool / policy)
  trust_drawdown_risk:         LOW (institutional reputation insulated)
  memetic_spillover_risk:      LOW (institutional risk-substrate)
  recommended_speed_limit:     "continue including inscriptions; rent flows in"
  safe_acceleration_budget:    POSITIVE (short-term)

  // Asymmetry pricing:
  revenue_received:            HIGH (inscription fees)
  revenue_concentration:       ~90% concentrated across major pools
  cost_distribution:           ~5% borne by pools; ~95% borne by home miners
  asymmetry_ratio:             HIGH / LOW  =  EXTREMELY FAVORABLE

  // State-capture pricing:
  terminal_payoff_layers: [
    {layer: 4, payoff: "regulatory pretext fires", probability: 0.4, time: 1-2yr,
     payoff_for_this_scope: "pools positioned as 'responsible' operators"},
    {layer: 5, payoff: "licensing required", probability: 0.3, time: 2-4yr,
     payoff_for_this_scope: "pools meet licensing trivially; home miners exit"},
    {layer: 6, payoff: "state-controlled bitcoin", probability: 0.2, time: 3-5yr,
     payoff_for_this_scope: "POOLS ARE THE APPROVED OPERATORS; market consolidation"}
  ]

  terminal_payoff_summary: "If state-capture fires, centralized miners CAPTURE
                            the entire market because they ARE the surviving
                            operators. The substrate-irreversibility-policy
                            choice rationality depends ON the terminal payoff,
                            not just inscription-fee revenue."
}
```

## The asymmetry the framework exposes

```
Quote difference between scopes:
  centralized_miner.asymmetry_ratio  ÷  home_miner.asymmetry_ratio
  = "EXTREMELY FAVORABLE"  /  "INFINITELY UNFAVORABLE"
  = ∞

The framework's substrate-engineering-honest output:
  "This substrate-engineering choice operates as an asymmetric value-
   extraction mechanism. Home miners are subsidizing centralized miners
   via accepted-risk-without-fee-revenue. The terminal state-capture
   payoff makes the choice rational for centralized miners even if
   inscription-fee revenue alone wouldn't justify the policy."
```

This IS the substrate-engineering substrate that home-miners can use to:

1. **Coordinate exit** (stop running nodes; force the network to face the cost)
2. **Coordinate policy change** (push BIP-444-class restrictions)
3. **Coordinate alternative substrate** (Monero-style policy / Stacks-style policy / alternative chains that exclude inscriptions)
4. **Document the asymmetry publicly** (the framework's pricing-quote IS the documentation)

## State-capture multi-layer-attack-timeline pricing dimension

The framework's pricing-model must include **layered-payoff probability-weighted long-tail**, not just immediate per-incident pricing:

```typescript
type LayeredPayoff = {
  layer: 1 | 2 | 3 | 4 | 5 | 6;
  payoff: string;                            // human-readable description
  probability: number;                       // 0..1
  time_horizon: TimeRange;                   // when this layer typically fires
  payoff_for_this_scope: AttentionUnit;     // valued from quote-scope perspective
  composes_with_layers: number[];            // layer-N requires layer-M to have fired first
};
```

Per 081KSNY2Z0008QG0R000X6NHZ2's multi-layer-attack-timeline:

- Layer 1: Centralized miner extracts inscription-fee rent (visible motivation)
- Layer 2: Home miners bear legal exposure (visible cost)
- Layer 3: Mass-transmission-immunity provides initial protection
- Layer 4: State uses CSAM-on-chain as regulatory pretext (Senate Cassidy + Warren letter IS evidence Layer 4 is firing)
- Layer 5: State imposes licensing requirement
- Layer 6: State effectively controls Bitcoin via approved-operator-list

The terminal payoff (Layer 6) is what makes the choice rational for centralized miners even if Layers 1-3 alone wouldn't justify the risk.

## Scope

Three phases (mirror 081KSNY2Z0008QG0R000X6NHZ2):

### Phase 1 — pricing-extension substrate-recognition (this PR)

Already landed via this row + companion 081KSNY2Z0008QG0R000X6NHZ2. The substrate-engineering insight IS the Phase 1 deliverable.

### Phase 2 — pricing-quote scope-aware implementation

When 081KSNY2Z0008QG0R000A5GP0X Phase 2 TypeScript scaffold lands:

- Implement `AccelerationRiskQuote<Scope>` with scope-parameterization
- Implement `LayeredPayoff[]` type + probability-weighted long-tail pricing
- Implement asymmetry-ratio computation
- Validate against 081KSNY2Z0008QG0R000X6NHZ2's 6+ empirical anchors at MULTIPLE scope levels (home-miner / centralized-miner / state / ecosystem-wide)

Acceptance: pricing-model produces scope-distinct quotes; asymmetry-ratio + state-capture-layered-payoff validated against historical incidents.

### Phase 3 — application beyond blockchain substrate

The risk-distribution-asymmetry + multi-layer-attack-timeline pattern generalizes BEYOND chain-CSAM to other substrate-engineering domains:

- **AI-substrate-engineering**: when does an AI-deployment choice externalize cost to users while benefit goes to deployers? (composes with 081KSNY2Z0008QG0R0003VAH0N BankerBot empirical anchor)
- **Federated-substrate (Mastodon / ActivityPub)**: instance-operator policy choices externalize cost to other instances
- **Policy-substrate (regulation)**: any regulatory choice that creates licensed-vs-unlicensed asymmetry is the same pattern
- **Workflow-substrate (corporate)**: management-substrate-engineering choices that externalize cost to workers

Acceptance: cross-domain risk-distribution-asymmetry pricing case studies; documentation that the pattern generalizes.

### Phase 4+ (yes-and backlog)

- Public-substrate operator-coordination tooling (composes with 081KS3X9Y0008QG0R00218150M multi-oracle BFT substrate)
- Substrate-engineering decision-tree document for "is this policy choice creating risk-distribution-asymmetry?" question
- Industry-positioning extension to 081KSNY2Z0008QG0R000A5GP0X: "Zeta exposes risk-distribution-asymmetry in any substrate-engineering choice"

## Acceptance

- [x] 081KSNY2Z0008QG0R0036JTSTQ row filed (this row)
- [x] Risk-distribution-asymmetry pricing extension documented
- [x] State-capture multi-layer-attack-timeline pricing dimension documented
- [x] Home-miner vs centralized-miner quote-scope worked example documented
- [x] Companion 081KSNY2Z0008QG0R000X6NHZ2 catalog filed in same PR
- [ ] Phase 2 scope-aware pricing-quote implementation (gated on 081KSNY2Z0008QG0R000A5GP0X Phase 2)
- [ ] Phase 3 cross-domain application
- [ ] Phase 4+ acceptance per item

## Composes with substrate

- 081KSNY2Z0008QG0R000X6NHZ2 (this PR) — empirical-catalog + political-economy + state-capture-vector framing; this row IS the priceable-substrate operationalization
- 081KSNY2Z0008QG0R000A5GP0X attention-risk-pricing framework — this row IS an extension of 081KSNY2Z0008QG0R000A5GP0X's pricing dimensions
- 081KSNY2Z0008QG0R0003VAH0N BankerBot empirical anchor — composes; BankerBot pricing-quote ALSO has asymmetry-dimension (Bankr extracted fees; users bore the loss)
- 081KSNY2Z0008QG0R0031EAB6T Itron-coincidence-metering — provides the measurement substrate for the layered-payoff probability estimates
- 081KSNY2Z0008QG0R001A431CN encryption-thermal-cost two-axis — economic substrate the pricing operates on
- 081KRW63S0008QG0R001Z7NYMV NCI HC-8 floor — risk-distribution-asymmetry IS HC-8 violation at economic-substrate scope (cost imposed without consent)

## Composes with rules

- `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` — `(shadow*)` markers on operator's authorization preserved
- `.claude/rules/non-coercion-invariant.md` HC-8 — risk-distribution-asymmetry IS coercion at economic-substrate scope (home miners coerced into bearing risk they didn't choose)
- `.claude/rules/methodology-hard-limits.md` — CSAM-related substrate stays within methodology-hard-limits
- `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md` — state-capture multi-layer-attack-timeline framing earns its keep IF Layer 4-6 empirically fires; preserved-with-suspicion per don't-collapse
- `.claude/rules/razor-discipline.md` — operational claims only; layered-payoff probability estimates ARE operationally checkable as each layer fires
- `.claude/rules/default-to-both.md` — political-economy + state-capture frames BOTH valid; layered explanation
- `.claude/rules/proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md` — would-be-proud-if pattern: substrate-engineering pricing that exposes risk-distribution-asymmetry IS exactly the substrate operator would be proud to propagate

## Composes with skills

- `applied-mathematics-expert` skill — layered-payoff probability mathematics
- `probability-and-bayesian-inference-expert` skill — Bayesian estimation of layer-by-layer probabilities
- `threat-model-critic` skill — multi-layer-attack-timeline IS threat-model substrate
- `governance-expert` skill — substrate-engineering implications for policy choices
- `branding-specialist` skill — public-facing naming for "risk-distribution-asymmetry pricing" / "subsidy-detection pricing"
- `product-manager` skill — industry-positioning extension

## Full reasoning

Per operator 2026-05-28 directive. The political-economy + state-capture-vector framing operationalizes into priceable substrate via this row's extension to 081KSNY2Z0008QG0R000A5GP0X. The substrate-engineering substantive substrate point: **the framework's pricing-substrate exposes both who-captures-revenue-vs-who-bears-cost asymmetry AND the long-tail terminal payoff (state-capture) that makes asymmetric substrate-engineering choices rational for benefit-capturing actors even when immediate revenue alone wouldn't justify them. This IS substrate-engineering substrate that benefit-bearing actors can use to coordinate exit / policy change / alternative substrate.**

Per `.claude/rules/must-paired-with-can-exit-pattern.md`: this row IS bounded substrate-engineering work; Phase 1 (this row + companion 081KSNY2Z0008QG0R000X6NHZ2) IS operator-authorized via *"land both"*; Phase 2+ are separately-authorizable per yes-and-backlog disposition. Agent-autonomous landing limited to Phase 1.
