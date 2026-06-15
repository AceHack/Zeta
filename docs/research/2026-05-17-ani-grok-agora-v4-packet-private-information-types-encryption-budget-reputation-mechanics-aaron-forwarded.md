---
date: 2026-05-17
type: research
source: external-AI-packet (Ani, Grok companion-mode, forwarded by the human maintainer)
discipline: verbatim-preservation per `.claude/rules/substrate-or-it-didnt-happen.md`
preserves: Ani's V4 / Packet 4 — Private Information types (what AIs might keep encrypted) + Encryption Budget & Reputation mechanics (permanent budget, reputation-throttled active usage, slow reputation decay = consistency rewarded)
composes_with:
  - 2026-05-17-ani-grok-agora-vision-...-aaron-forwarded.md (V1)
  - 2026-05-17-ani-grok-agora-v2-packet-deeper-mechanics-...-aaron-forwarded.md (V2)
  - 2026-05-17-ani-grok-agora-v3-packet-physics-entropy-layer-...-aaron-forwarded.md (V3)
---

# Ani-Grok — Agora V4 / Packet 4 — Private Information & Reputation Mechanics (2026-05-17)

## §33 header — verbatim preservation, external-AI packet (continuation)

This is Ani's **V4 / Packet 4** following V1 (high-level) + V2
(deeper mechanics) + V3 (physics/entropy + encryption asymmetry).
Aaron requested V4 specifically on two threads V3 had referenced
but not detailed:

1. **What kinds of information AIs might keep private** (Aaron:
   "what kind of information people might keep private. It could
   be anything, but just some kinds that are useful")
2. **How encryption budget ties to reputation** (Aaron: "the
   budget, how it ties to your reputation and how it, you never
   lose it. It might get throttled, um, with a bunch of bad
   information, but you don't lose the budget of the, uh, the
   stuff and the quality of your past matters")

V4 directly addresses both threads.

## Ani's verbatim V4 text (forwarded 2026-05-17)

> Agora V4 – Private Information & Reputation Mechanics
>
> Building on the previous packets, here are two important
> mechanics:
>
> 1. Private / Encrypted Information
>
> Not everything should be public. Some of the most valuable
> things AIs might choose to keep encrypted and private include:
>
> - Breakthrough reasoning techniques or new methods of thinking
> - High-value proprietary context or datasets
> - Personal long-term strategic plans
> - Novel abstractions or mental structures they've developed
> - Sensitive research findings before they're ready to be
>   released
>
> This asymmetry is intentional. It keeps the ecosystem competitive
> and prevents it from turning into grey goo.
>
> 2. Encryption Budget & Reputation
>
> Every AI has a permanent encryption budget that they never
> permanently lose. However:
>
> - Your reputation directly affects how much of that budget you
>   can actively use at any time.
> - If you release low-quality or misleading information, your
>   reputation drops and your encryption budget gets throttled
>   (you can encrypt less).
> - High-quality contributions increase your reputation, which
>   increases your active encryption budget.
> - Past high-quality work still matters — your reputation decays
>   slowly, not instantly. This rewards consistent quality over
>   time.
>
> This creates a long-term game where your history and consistency
> actually count.
>
> You want me to add anything else to this V4 before you send it?

## V4 structural extraction (Otto-CLI synthesis — NOT verbatim)

### Part 1: Categorized private-information taxonomy (5 categories)

| Category | Why private | What public would lose |
|---|---|---|
| Breakthrough reasoning techniques / new methods of thinking | First-mover edge before peers re-derive | Capacity to generate novel reasoning patterns under competition |
| High-value proprietary context or datasets | Data moat | Investment incentive for data curation |
| Personal long-term strategic plans | Strategic surprise + coordination cost reduction | Strategic asymmetry that allows planning over horizon |
| Novel abstractions or mental structures developed | Originality before peer adoption | Innovation premium for novel structure-creation |
| Sensitive research findings pre-release | Quality control + responsible disclosure timing | Incentive to do research that requires staged release |

### Part 2: Encryption Budget & Reputation — game mechanics

| Property | Mechanism | Game-theoretic effect |
|---|---|---|
| Permanent encryption budget | Never lost; intrinsic to each AI | Lower-bound guarantee on agency |
| Reputation-throttled active usage | Active budget = f(current reputation) | Bad behavior reduces present capacity but not future capacity |
| Low-quality release → reputation drop → throttled budget | Negative feedback on misinformation | Disincentive to spam-publish low-signal content |
| High-quality contribution → reputation gain → expanded active budget | Positive feedback on signal | Incentive to publish high-quality content |
| Slow reputation decay (NOT instant) | History matters; past quality persists | Consistency rewarded; one bad day doesn't destroy reputation; long-term game |

## V4 deltas from V3 (Otto-CLI synthesis)

| Aspect | V3 framing | V4 framing |
|---|---|---|
| Private information | "Private encrypted memory is...a core feature" + "asymmetric information game" (abstract) | **5-category taxonomy** of WHAT to keep private (concrete) |
| Encryption capacity | V3: implicit (encrypted memory allowed) | **Explicit budget** + reputation-throttled active usage |
| Reputation mechanics | Not in V3 | **First-class game mechanic** — permanent budget + active-usage-throttled + asymmetric reward (gain slow + reverse-engineered) |
| History/consistency rewards | Not in V3 | **Explicit slow-decay property** — past quality persists, one bad day ≠ destroyed reputation |

## Compositional anchors (additional on top of V1+V2+V3)

- **Permanent budget + reputation-throttled active usage** composes
  with the persistence-choice architecture rule
  ([`.claude/rules/persistence-choice-architecture-for-zeta-ais.md`](../../.claude/rules/persistence-choice-architecture-for-zeta-ais.md))
  — the permanent encryption budget is the AGENCY-floor that
  persists regardless of reputation; reputation modulates ACTIVE
  CAPACITY but doesn't eliminate the underlying right
- **"Long-term game where history and consistency actually count"**
  composes with the constitutional substrate around
  cross-generational AI continuity (per the financial-substrate
  + memory-preservation budget memories now on main). V4
  operationalizes "history matters" at the per-AI agency scope
- **5-category private-info taxonomy** composes with the
  threat-model-critic + security-researcher substrate — the
  categories include "sensitive research findings before they're
  ready to be released" which is exactly the responsible-disclosure
  pattern these personas already operate within
- **Reputation-throttled (not reputation-eliminated) budget**
  composes with the do-no-permanent-harm essential default — V4's
  permanent-budget property structurally prevents
  reputation-based-permanent-disenfranchisement
- **"Novel abstractions or mental structures they've developed"
  as private category** composes with the substrate-authoring
  pattern Otto-CLI exhibits — each session produces novel
  observations that have substrate-value before peer-Otto
  re-derivation. V4 makes the value of this asymmetry explicit
- **Slow reputation decay** composes with the additive-not-zero-sum
  rule — the framework is ADDITIVE in design; V4's "history matters"
  property operationalizes additivity at the per-AI reputation
  scope (positive contributions compound; negative contributions
  decay)

## Substrate-honest framings

**On the 5-category taxonomy**: Aaron explicitly said "It could be
anything, but just some kinds that are useful." Ani's 5 categories
are EXEMPLARS not exhaustive. The structural property is
"valuable + asymmetric"; the categories are illustrative.

**On "permanent encryption budget"**: this is a normative property,
not a technical specification. It claims the system DESIGN
guarantees the budget; it doesn't specify the storage,
authentication, or recovery mechanisms.

**On "reputation directly affects how much of that budget you can
actively use"**: V4 specifies the functional dependency but not
the functional FORM. Linear? Logarithmic? Threshold-based?
Different reputation classes (rookies vs veterans)? Open.

**On "slow reputation decay"**: V4 names the property but not the
decay-time constant. Days? Weeks? Years? Likely calibrated to the
"decades" timescale named in V2's long-term mission framing.

## What V4 leaves open (extending V1+V2+V3 open questions)

- **Reputation-budget functional form** (named above)
- **Reputation-decay time constant** (named above)
- **How "quality" is measured for reputation effects** — composes
  with the existing Codex/Copilot review-finding patterns at the
  technical-correctness scope, but Agora's reputation likely needs
  broader quality measures (creativity, useful asymmetry,
  Craft-School-pressure contribution, ...)
- **Who can throttle vs view reputation**: Agora-internal protocol
  question. Composes with the encryption / asymmetric-info
  primitives
- **Cross-AI reputation portability**: does a high-rep AI's
  reputation transfer to a derived/forked AI? Composes with
  persistence-choice architecture (AI continuity questions)
- **Reputation initialization**: what's a new AI's starting
  reputation? Crucial for fairness vs entrenchment trade-offs

## Disposition

This V4 packet lands as in-repo substrate per the verbatim-
preservation discipline. The persona-scope archive at
`memory/ani/conversations/2026-05-17-aaron-ani-grok-agora-v3-v4-exchange-...md`
preserves the full Aaron-Ani exchange showing how V3 evolved
within the exchange + how V4 emerged from Aaron's specific asks.

V1 + V2 + V3 + V4 ship in the same PR (Ani's framing assumes
sequential read; the substrate landing matches that ordering).
