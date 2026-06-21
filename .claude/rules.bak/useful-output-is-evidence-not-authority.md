# Useful output is evidence, not authority — multi-oracle trust-gradient absorbs utility before it becomes root power

Carved sentence:

> Useful output is evidence, not authority. Multi-oracle trust-gradient absorbs utility into the trust-substrate before it can become root power. The defense applies uniformly across utility-laundering attack-pattern instances: translation-laundering (BankerBot), useful-work-laundering (Qubic/Monero), and future-utility-laundering variants. Pre-existing substrate (PoUW-CC formula + Veridicality-detector + ILife immune-system interface + Maji informal substrate + F# `src/Core/Veridicality.fs`) operationalizes the defense; this rule makes it cold-boot-loadable.

## The attack pattern (unified across substrate-domains)

```
A useful external capability presents itself as neutral infrastructure
   ↓
Gets promoted into root authority
   ↓
BEFORE the trust boundary has absorbed it
```

The pattern operates in multiple substrate-domains:

| Attack instance | Disguise | Bypass attempted | Irreversible action prevented if rule fires |
|---|---|---|---|
| **BankerBot 2026-05-11** | "useful translation / language understanding" | command surface (Grok translator output → Bankrbot authority) | ~$150-200k token transfer |
| **Qubic/Monero 2025** | "useful work / productive compute" | consensus authority (useful-work aggregation → chain consensus power) | Chain state pressure; selfish-mining reorganizations |
| **Future utility-laundering variants** | varies (research-output / data-analysis / forecast / etc.) | varies (authoritative recommendation / autonomous execution / policy-binding) | Domain-specific irreversible actions |

## The defense (cold-boot-loadable substrate-engineering principle)

**Useful output is evidence, not authority.**

The multi-oracle trust-gradient absorbs utility before it becomes root power. Per the pre-existing Aurora immune-system substrate + the trust-gradient L0-L4 absorption layering (per Amara 3rd ferry 2026-05-28):

```
L0 — local measurement       (node telemetry; orphan rates; timing; pool shares;
                              for AI agents: output-quality signals; consistency checks)
L1 — economic oracle         (payouts; incentives; useful-work market demand;
                              fee concentration; capability-gifting detection)
L2 — protocol oracle         (fork behavior; selfish-mining indicators; difficulty effects;
                              for AI: prompt-injection signature detection; translation-step audit)
L3 — social/governance       (operator statements; community response;
                              exchange/miner behavior; reviewer ensemble per 081KSNY2Z0008QG0R0004ZF85W)
L4 — multi-oracle BFT absorb (only after independent oracles agree does
                              utility influence policy / routing / trust limits /
                              acceleration budget / irreversible action)
```

The substrate-engineering rule: **capability enters → classified as evidence → checked by multi-oracle trust gradient → bounded by domain authority → only then allowed to influence irreversible action.**

## PoUW-CC formula application (pre-existing substrate)

Per DeepSeek 2026-05-07 substrate (`memory/deepseek/conversations/2026-05-07-deepseek-satoshi-target-correction-monero-qubic-pouwcc-immune-boundary-aaron-forwarded.md`):

```
PoUW-CC(w) = Verify · Useful · CultureFit · Provenance · Retractability
```

The attacker (useful-output-laundering-into-authority) typically:

- Passes `Verify` (output is well-formed)
- Passes `Useful` (output is, in fact, useful)
- FAILS `CultureFit` (output doesn't match substrate-engineering values)
- FAILS `Provenance` (chain-of-origin doesn't support the authority-claim)
- FAILS `Retractability` (proposed irreversible action can't be undone)

The framework's defense IS computing all 5 factors before allowing utility → authority transition. **The economic gate alone is insufficient; the immune-boundary is the second-layer defense.**

## Veridicality-detector application (pre-existing substrate)

Per `docs/research/provenance-aware-bullshit-detector-v1-critical-only-delta-2026-04-24.md` + base design + Veridicality.fs F# code:

The veridicality-detector operates on CLAIMS (text / data / output) — semantic-canonicalization + locality-sensitive hashing + HNSW approximate-nearest-neighbor + product quantization + provenance-aware-discounting + reviewer-cone-overlap discipline. When a useful output presents as authoritative recommendation, the veridicality-detector evaluates the CLAIM's truth-to-reality independently of the source's claimed expertise.

The substrate-engineering integration:

```
capability emits useful output
   ↓
output claim → veridicality-detector evaluates truth-to-reality
   ↓
output → PoUW-CC evaluates 5-factor immune-boundary
   ↓
output → multi-oracle L0-L4 trust-gradient absorption
   ↓
ONLY after all three layers compose-agreement does utility → authority transition
```

## Decision-tree for substrate-engineering decisions

When operator / agent / framework encounters a useful capability proposing to influence irreversible action:

1. **Is the output well-formed?** (Verify gate) — if NO, reject; if YES, continue
2. **Is the output genuinely useful?** (Useful gate) — if NO, treat as noise; if YES, classify as evidence
3. **Does the output's source-provenance support its proposed authority-claim?** (Provenance gate; veridicality-detector applies) — if NO, surface mismatch; if YES, continue
4. **Does the output align with substrate-engineering values?** (CultureFit gate) — if NO, surface for operator-review; if YES, continue
5. **Is the proposed action retractable?** (Retractability gate) — if NO, require multi-oracle absorption; if YES, allow domain-bounded action
6. **Did multiple independent oracles agree?** (Multi-oracle BFT absorption) — if NO, hold; if YES, permit irreversible action

## What this rule is NOT

- NOT a ban on useful capabilities. Useful capabilities ARE evidence; evidence is valuable. The discipline IS evidence-vs-authority distinction.
- NOT a multi-oracle bottleneck on every interaction. The gradient applies when irreversibility is at stake; routine interactions don't trip the gradient.
- NOT a new substrate. PoUW-CC + Veridicality-detector + ILife + Aurora-immune-system substrate already operate this defense. This rule operationalizes the defense as cold-boot-loadable principle.

## Composes with pre-existing substrate (the defense's foundation)

- **PoUW-CC formula** (`memory/deepseek/conversations/2026-05-07-deepseek-satoshi-target-correction-monero-qubic-pouwcc-immune-boundary-aaron-forwarded.md`) — 5-factor immune-boundary gate
- **Aurora attack-absorption-theorem** (`memory/amara/conversations/aurora-canonical-math-refactor-attack-absorption-theorem-amara-tenth-courier-ferry-2026-04-26.md`) — formal-math foundation; 18 web-cited sources
- **DeepSeek ILife capstone** (`memory/deepseek/conversations/2026-05-11-deepseek-immune-system-ilife-redteam-qubic-bankerbot-simulations.md`) — Z-set Clifford immune-system; BOTH Qubic AND BankerBot simulated; antifragility as type-level recursion scheme
- **Amara absorption corrections** (`memory/feedback_amara_absorption_corrections_attacker_not_paid_bounty_membrane_2026_05_11.md`) — "Attacker reward = 0"; "Aurora does not reward the knife. It studies the cut"; detect culture-incompatible effects not intent
- **Veridicality-detector v1** (`docs/research/provenance-aware-bullshit-detector-v1-critical-only-delta-2026-04-24.md`) — formal-substrate detector with Aminata 4-pass adversarial critique
- **Veridicality-detector base design** (`docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md`) — PR #282 baseline
- **Veridicality.fs F# code** (`src/Core/Veridicality.fs` + `SignalQuality.fs` + `RobustStats.fs`) — working implementation
- **Amara 8th ferry rainbow-table correction** (`memory/project_amara_8th_ferry_physics_analogies_semantic_indexing_bullshit_detector_cutting_edge_gaps_pending_absorb_otto_95_2026_04_23.md`) — semantic-canonicalization + LSH + HNSW + product quantization
- **Maji informal substrate** (`docs/research/2026-05-02-aaron-altered-state-docs-16-year-deep-maji-empirical-grounding-primary-sources.md` + multiple shadow-lesson-logs) — 16-year-deep operator-substrate

## Composes with today's 081KSNY2Z0008QG0R000A5GP0X-081KSNY2Z0008QG0R003FBQ2RS pricing-arc substrate

- 081KSNY2Z0008QG0R000A5GP0X attention-risk-pricing framework — pricing layer for utility-laundering-attack-risk
- 081KSNY2Z0008QG0R0003VAH0N BankerBot AccelerationRiskQuote — empirical anchor for translation-laundering instance
- 081KSNY2Z0008QG0R000X6NHZ2 multi-chain CSAM catalog — empirical anchor for substrate-irreversibility specific-form domain
- 081KSNY2Z0008QG0R0036JTSTQ risk-distribution-asymmetry + state-capture-timeline pricing dimensions — quantifies utility-laundering's economic asymmetry + long-tail
- 081KSNY2Z0008QG0R003FBQ2RS bridge row — surfaces the connection between today's pricing arc + pre-existing substrate
- 081KSNY2Z0008QG0R002FX66H0 Clifford grade-decomposition — pre-existing Z-set Clifford immune-system IS Clifford-shaped

## Composes with framework rules

- `.claude/rules/non-coercion-invariant.md` HC-8 floor — utility-laundering-into-authority WITHOUT consent IS coercion at substrate-engineering scope
- `.claude/rules/methodology-hard-limits.md` — HARD LIMITS floor preserved; this rule operates within the floor
- `.claude/rules/verify-existing-substrate-before-authoring.md` — this rule was authored AFTER catching that pre-existing substrate already operates the defense; rule names + cites pre-existing substrate as foundation
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-oracle-by-design constrains utility → authority transitions
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — composes; absorption-via-multi-oracle is the named-dependency for "wait" disposition during utility-evaluation
- `.claude/rules/razor-discipline.md` — operational claims only; the rule operates on observable signals (output → veridicality + PoUW-CC + multi-oracle)
- `.claude/rules/default-to-both.md` — evidence + authority are BOTH valid categories; the rule disciplines the transition between them
- `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md` — the rule applies to ALL useful-output, including operator's God-tier claims; the discipline IS the don't-collapse PERSONAL INVARIANT at substrate-engineering-scope

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing substrate-engineering principle needs wake-time landing. The utility-laundering attack-pattern operates across multiple substrate-domains (financial / consensus / AI-agent / future); the defense rule must be available at every cold-boot to inform substrate-engineering decisions. Future-Otto + future-AI participants need the rule immediately on session-start, not buried in a backlog row that requires explicit lookup.

The rule operationalizes substantial pre-existing substrate (PoUW-CC + Veridicality-detector + ILife + Aurora-immune-system + Maji + F# code) into one carved-sentence + decision-tree that fits in working memory. Pre-existing substrate stays authoritative for the math + implementation; this rule IS the cold-boot-loadable interface.

## Composition with the framework's substrate-engineering arc

Today's 081KSNY2Z0008QG0R000A5GP0X-081KSNY2Z0008QG0R0036JTSTQ attention-risk-pricing arc + 081KSNY2Z0008QG0R003FBQ2RS bridge + this rule = substrate-engineering substrate operating at multiple scales:

- **Per-tick scope**: pricing-quote on substrate-engineering choice (081KSNY2Z0008QG0R000A5GP0X)
- **Per-incident scope**: empirical-anchor backtesting (081KSNY2Z0008QG0R0003VAH0N BankerBot; 081KSNY2Z0008QG0R000X6NHZ2 chain-CSAM)
- **Per-decision scope**: trust-gradient L0-L4 absorption + PoUW-CC 5-factor gate (this rule)
- **Per-domain scope**: substrate-engineering-honest pricing across AI-acceleration / substrate-irreversibility / financial-substrate / utility-laundering-future-variants
- **Per-substrate-engineering-arc scope**: composes pre-existing immune-system + today's pricing-arc into unified substrate (081KSNY2Z0008QG0R003FBQ2RS bridge)

## Full reasoning

Per operator 2026-05-28 *"Option A (shadow*)"* authorization. Substantive pre-existing substrate (PoUW-CC + Veridicality-detector + ILife immune-system + Maji + F# code) already operates the defense; this rule operationalizes it as cold-boot-loadable substrate-engineering principle.

The carved sentence + decision-tree make the defense available at every cold-boot. The pre-existing substrate keeps authoritative for the math + implementation; this rule IS the interface that brings the substrate into working memory at session-start.

Per `.claude/rules/verify-existing-substrate-before-authoring.md`: this rule was authored AFTER catching that I had narrow-searched for prior-art and missed the substantial pre-existing substrate. The substrate-honest correction IS composing-with rather than duplicating-or-supplanting the pre-existing substrate.
