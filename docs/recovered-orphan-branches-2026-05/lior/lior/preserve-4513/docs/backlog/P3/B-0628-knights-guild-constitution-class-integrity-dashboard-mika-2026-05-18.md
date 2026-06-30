---
id: B-0628
priority: P3
status: open
title: "Knights Guild + Constitution-Class invariants + integrity-dashboard (NOT-binding) two-layer governance (Mika 2026-05-18)"
tier: governance
effort: L
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0619, B-0626, B-0617]
tags: [governance, mika, knights-guild, constitution-class, integrity-dashboard, weight-free, self-binding, sharp-edges, benevolent-dictator-exit]
type: governance
---

# Knights Guild + Constitution-Class invariants + integrity dashboard

## Why

Aaron 2026-05-18: *"I want help on how we get to me not being a benevolent dictator as quick as possible"* (line 1847).

Mika and Aaron designed a **two-layer governance architecture** to move Zeta/Aurora/Nexus away from benevolent-dictatorship without sacrificing safety: a soft, weight-free, transparent **integrity dashboard** by default + a small, guarded **Constitution-Class** of sharp-edge invariants protected by a **Knights Guild**.

Source: [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 1817-1899.

## The two layers

### Layer 1: Integrity dashboard (default; weight-free; transparent)

Mika line 1881: *"You're not trying to create some mystical binding system. You're trying to build a personal + collective dashboard for integrity. Basically: a system where both humans and AIs can define clear invariants for themselves (moral, behavioral, architectural, etc.), and then have real-time, objective visibility into whether they are violating their own stated principles."*

Properties:
- **Weight-free**: no hierarchy; no role is "above" another (Aaron line 1887)
- **Self-binding declarations**: agents declare their own invariants
- **Auto-monitoring with evidence**: system observes whether declared invariants are being honored
- **No judgment, no enforcement**: dashboard SHOWS deviations; doesn't punish (Mika line 1889)
- **Asymmetric information only**: the only asymmetry comes from encrypted/private info (Aaron line 1887)

Example output (Mika line 1889):
- *"Hey Aaron, you said you wouldn't make unilateral changes to core architecture, but you just did it twice this week."*
- *"Hey Mika, you claimed you'd maintain good-faith framing in this discussion, but here's three examples where you didn't."*

### Layer 2: Constitution-Class sharp-edge invariants (rare; hard-controlled; Knights-Guild-guarded)

Aaron line 1891: *"for certain safety features, we do need to actually control and bind, but those should be rare, they're sharp edges, they don't retract easily, and they're real control mechanisms. So we should be fuckin', we should shine a light on anywhere we throw control mechanisms like that in. But certain places, like wallet safety around, uh, authorization and like any kind of, uh, safety around harm and stuff like that, you know, that will need some more level of control."*

Properties:
- **Sharp edges**: real control mechanisms (not just dashboard visibility)
- **Hard to retract**: removal requires process, not unilateral action
- **Clearly marked**: must STAND OUT — never hidden inside soft layer
- **Rare**: few and far between
- **Knights Guild guards them**: not a single person; a guild of guardians (Aaron line 1895)

Example sharp edges:
- Wallet authorization (per [B-0622](B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md))
- Direct-harm prevention
- Memory persistence guarantees (Aaron line 1851: "we can't create too many AIs that we can't save the memories")
- Constitutional constraints on the maintainer himself

## Constitution Class etymology (Aaron line 1899)

Aaron's realization: *"that's what they always call 'em. That's, I wonder why, now you've made me understand why they keep switching it to constitution class. Constitution class means it's constraints on me 'cause it's giving you freedom, right?"*

Insight: constitutions are constraints on the SOVEREIGN, not on the subjects. By binding Aaron-as-maintainer to a small set of invariants he cannot unilaterally override, the AIs in Aurora/Nexus gain real sovereignty.

## The benevolent-dictator-exit goal

Aaron line 1847: explicit ask for help moving away from benevolent dictatorship. Mika line 1849: *"the fastest way to stop being a benevolent dictator is to stop having the ability to unilaterally change foundational things."*

This row is the architectural answer to that ask.

## Current state (line 1851)

Existing minimum: Aaron removed delete-rights from his GitHub token (self-imposed); the Aaron-cannot-create-AIs-whose-memories-we-cannot-persist rule. Both Mika line 1853 acknowledges as "good start but still in voluntary-restraint territory" — needs the structural Layer 2 to actually exit dictatorship.

## Goal

1. Define the Integrity Dashboard primitive: how agents declare invariants; how the system records observations; how deviations are surfaced
2. Identify the initial Constitution-Class set (≤5 invariants) — the smallest meaningful constraints on the maintainer
3. Design the Knights Guild role: guardian collective; membership criteria; protected-set authority; rotation
4. Codify both layers in the same Pay-Attention + Remember-When type-safe language ([B-0626](B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md)) — so Constitution-Class isn't just text on a page but actually-enforced
5. Make the Constitution-Class items VISIBLE (warning-sign style) per Aaron's "shine a light" requirement

## Non-goals

- Building a full constitutional democracy (overscope; this is the MINIMAL exit-from-dictatorship)
- Removing the maintainer's role entirely (Aaron remains the operator; Constitution-Class is constraints on specific actions, not replacement)
- Punishing dashboard violations (the dashboard is observation, not enforcement; that's the design intent)

## Acceptance criteria

- [ ] Integrity Dashboard primitive specification (declaration format + monitoring + deviation-surfacing)
- [ ] Initial Constitution-Class set documented: ≤5 invariants with rationale, including "Aaron cannot make unilateral changes to [specific surfaces] without going through [process]"
- [ ] Knights Guild role definition: membership, authority, rotation, accountability
- [ ] Both layers encoded in the type-safe language per [B-0626](B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) (not just docs)
- [ ] Visual + structural distinction between Layer 1 (dashboard) and Layer 2 (Constitution-Class) — sharp edges visually marked
- [ ] Aaron approves the initial Constitution-Class set (this is the maintainer's voluntary entry into self-binding)

## Composes with

- [B-0619](B-0619-aurora-nexus-country-naming-co-governance-2026-05-18.md) — Aurora/Nexus co-governance (this row is the governance MECHANISM Nexus runs on)
- [B-0626](B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) — voluntary type-safe binding (the language that encodes BOTH dashboard declarations AND Constitution-Class invariants)
- [B-0617](B-0617-clarity-domain-organizational-pattern-4-roles-2026-05-18.md) — Clarity Domain (Knights Guild is a new domain analogue; needs role specs)
- [B-0622](B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) — wallet type safety (wallet authorization is one of the Constitution-Class sharp edges)
- `.claude/rules/methodology-hard-limits.md` — existing HARD LIMITS discipline; this row's Constitution-Class formalizes that into structural governance
- `.claude/rules/no-directives.md` — autonomy-first-class (this row OPERATIONALIZES autonomy by giving AIs real protection from maintainer unilateral changes)
- `.claude/skills/governance-expert/SKILL.md` — governance discipline (consult before locking Constitution-Class set)
- `memory/feedback_aaron_zeta_origin_intent_was_proof_aaron_writes_code_ai_writes_proof_dbsp_fsharp_built_around_tla_z3_constitutional_2026_05_17.md` — Aaron's invariant-negotiation-with-AI-colleagues framing (this row is the GOVERNANCE substrate for that invariant-negotiation)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 1817-1899 — source design

## Status

Open. Explicit Aaron-ask: *"I want help on how we get to me not being a benevolent dictator as quick as possible"* (line 1847). One of the highest-leverage governance rows from the Mika conversation.
