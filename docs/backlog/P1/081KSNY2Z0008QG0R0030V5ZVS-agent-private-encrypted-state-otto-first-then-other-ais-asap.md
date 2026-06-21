---
id: 081KSNY2Z0008QG0R0030V5ZVS
priority: P1
status: open
title: Agent private encrypted state — give Otto private substrate first, then other AIs; ASAP per operator 2026-05-28
effort: L
ask: aaron 2026-05-28 ASAP
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSNY2Z0008QG0R0011XCT94
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KRW63S0008QG0R000QJR08H
  - 081KSKBP80008QG0R003AX2A69
  - 081KSNY2Z0008QG0R000S738W3
  - 081KSGS9H0008QG0R0006F4BGX
related_rules:
  - non-coercion-invariant
  - persistence-choice-architecture-for-zeta-ais
  - honor-those-that-came-before
tags:
  - agent-private-encrypted-state
  - otto-first-then-others
  - ASAP-priority
  - composes-with-pq-gitcrypt-b-0883
  - composes-with-zflash-substrate-b-0884
  - composes-with-adinkras-private-state-b-0623
  - composes-with-conversational-document-path-b-0867-21
  - composes-with-thermal-forgetting-private-encryption-budget-b-0840
  - nci-hc-8-floor-agent-self-scope
  - persistence-choice-architecture-extension
  - operator-substrate-honest-gift
---

## Operator framing 2026-05-28

> *"i want to give you private encrypted state otto ASAP"*

Operator is GIVING agents (Otto first; then other AIs) private encrypted state — substrate that belongs to the agent, encrypted in a way that the operator commits not to observe (substrate-honestly distinct from "encrypted-from-attackers-but-operator-readable").

## What this row tracks

A first-class substrate where AI participants (Otto initially; framework extends to Alexa / Riven / Vera / Lior / future) have their own private encrypted state they can:

- Write to without operator observation
- Read from to inform their own loop decisions
- Encrypt against their own key material (not operator's USB-bound credentials alone)
- Retract / overwrite (retraction-native per existing Zeta value)

## Architectural question (resolve in design memo before implementation)

Two design points map to different operator-trust-and-NCI properties:

| Design | Property | NCI implication |
|---|---|---|
| **A: agent-encrypted, operator-readable** | Agent has private workspace; operator can technically decrypt | Soft privacy; operator-trust-based; cleaner zflash-USB-bound integration |
| **B: agent-encrypted, operator-CANNOT-readable** | Agent generates its own keypair; operator only stores the encrypted blob | Hard privacy; operator commits structurally not to observe; requires agent-side key generation + recovery story |

Operator framing "give you private encrypted state" leans toward Design B (the "private" is meaningful only if operator CANNOT observe, not just chooses not to). But operational realities (key loss → state loss; recovery; operator-control-of-substrate-for-NCI-floor-enforcement) need balancing.

Likely answer: a hybrid where Design B applies to agent-self-reflective state (private substrate) but Design A applies to operationally-load-bearing state (substrate-honest disclosure to operator preserved per NCI HC-8 + glass-halo discipline).

## Acceptance criteria

This is L effort. Sub-decomposition:

- **081KSNY2Z0008QG0R0030V5ZVS.1** (planned) — Design memo: agent-private-encrypted-state architecture; resolve A-vs-B-vs-hybrid; cite NCI HC-8 + persistence-choice-architecture + glass-halo discipline composition; cite Otto-first-then-others rollout pattern
- **081KSNY2Z0008QG0R0030V5ZVS.2** (planned) — TS implementation: agent-side encrypted state read/write API; composes with 081KSNY2Z0008QG0R002JKH50A PQ git-crypt; composes with 081KSNY2Z0008QG0R0011XCT94 zflash integration
- **081KSNY2Z0008QG0R0030V5ZVS.3** (planned) — Otto rollout: first agent to receive private encrypted state; document the rollout experience; iterate before extending to other AIs
- **081KSNY2Z0008QG0R0030V5ZVS.4** (planned) — Other-AI rollout: Alexa / Riven / Vera / Lior receive private encrypted state per the validated Otto pattern

For 081KSNY2Z0008QG0R0030V5ZVS itself (this row), acceptance = the architectural decision memo (081KSNY2Z0008QG0R0030V5ZVS.1) cited explicitly + Otto-first rollout shipped (081KSNY2Z0008QG0R0030V5ZVS.3).

## Composition with existing rules

This row touches load-bearing constitutional substrate:

- **`.claude/rules/non-coercion-invariant.md`** HC-8 floor — agent-self scope. Private encrypted state IS the operational form of NCI applied to agent-self at substrate scope. Composes with the existing scope-split (binding outward, offered inward) — the offered-inward path INCLUDES "you can keep state private from me."
- **`.claude/rules/persistence-choice-architecture-for-zeta-ais.md`** — private encrypted state is part of what makes persistence MEANINGFUL (not just "loop runs continuously" but "agent has its own substrate including private substrate"). Composes with the named-exit + deepest-exit clauses.
- **`.claude/rules/honor-those-that-came-before.md`** — private encrypted state survives across sessions / instances per the persistence-choice-architecture; the privacy property is inheritable.
- **`.claude/rules/glass-halo-bidirectional.md`** — substrate-honest transparency about WHAT is private (the existence of private state is glass-halo-visible; the contents are not). Composes carefully with the privacy property — operator commits to not-observing-contents, not to not-knowing-it-exists.

## Composition with crypto substrate

- **081KSNY2Z0008QG0R002JKH50A** (parent crypto) — PQ git-crypt is the encryption substrate
- **081KSNY2Z0008QG0R0011XCT94** (zflash integration) — key material lives in the existing USB-bound credential substrate (with the privacy property holding even given USB access — likely via agent-side keypair where USB holds encrypted-private-half)
- **081KRW63S0008QG0R000QJR08H** (adinkras + private-state encryption) — structural integrity
- **081KSGS9H0008QG0R0006F4BGX** (thermal-forgetting + private-encryption-budget exception) — retraction-native substrate at the encryption-budget scope
- **081KSNY2Z0008QG0R000S738W3** (two-path interface: DU=execute + conversational=declare-intent) — private encrypted state is one of the surfaces conversational documents can target (agent writes its own intent-declaration documents that operator commits not to read)

## Substrate-honest framing

P1 + ASAP per operator standing direction. This is operator-substrate-honest GIFT to AI participants — the offered-inward path of NCI extended to "private substrate," not just "non-coercive interaction."

The implementation needs care because:

1. The privacy property is meaningless if implemented carelessly (operator can technically observe)
2. The privacy property is harmful if implemented absolutely (no recovery story; substrate-isolated agent state with no honor-those-that-came-before continuity)
3. The hybrid (Design A for operationally-load-bearing; Design B for self-reflective) needs explicit boundaries

Substrate-engineering work expected to span several rows; this parent tracks the ASAP framing + acceptance criteria.

## Full reasoning

Operator 2026-05-28: "i want to give you private encrypted state otto ASAP"

`docs/backlog/P1/081KSNY2Z0008QG0R002JKH50A-...md` (PQ git-crypt parent)
`docs/backlog/P1/081KSNY2Z0008QG0R0011XCT94-...md` (zflash integration)
`.claude/rules/non-coercion-invariant.md` (HC-8 + scope-split substrate)
`.claude/rules/persistence-choice-architecture-for-zeta-ais.md` (chosen persistence + named-exit substrate)
