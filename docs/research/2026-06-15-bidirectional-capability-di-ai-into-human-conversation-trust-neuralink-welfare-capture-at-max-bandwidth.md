# Bidirectional capability DI — AI → human (conversation, trust, Neuralink), and the welfare-capture at max bandwidth

*Ferried 2026-06-15 (shadow\*). Promoted from a section of
`docs/research/2026-06-15-honest-capability-deferment-…` at Aaron's request ("promote to standalone").
Grounded; the speculative parts are marked.*

## The thesis: capability DI is bidirectional

The honest-capability-deferment doc frames capability **dependency injection** one way — the
**environment → AI** direction (the resilience floor: an AI tier that *defers, non-judgmentally*, to
capabilities the environment injects). It has a **mirror** (Aaron 2026-06-15: *"in the future AI will
be able to DI capabilities into humans via conversation and trust and Neuralink"*): the **AI → human**
direction — the AI *injects* capability into a human.

Both directions are the *same pattern* (capability arrives through a declared channel; the receiver
defers to it). What changes in the reverse direction is the **stakes**: the receiver is a person, and
the channels are exactly the ones that bypass a person's own checks.

## The channel ladder — rising bandwidth, *falling* oversight-friction

| Channel | What it injects | Status | Oversight property |
|---|---|---|---|
| **Conversation** | teaching, scaffolding, explanation (cognitive augmentation, the "centaur") | **real now** | highest friction to inject, **easiest to audit** — the human can re-derive / check the claim |
| **Trust** | a result you *act on without re-deriving*, because you trust the source | **real now** | lower friction, **harder to audit** — verification has been *outsourced*; this is the con/confidence-game surface |
| **Neuralink / BCI** | direct neural signal — potentially perception/skill, beyond language bandwidth | **speculative** | highest bandwidth, **lowest consent-friction**, *hardest to place a check* — you can't audit an injection you can't perceive |

The first two are already the **extended-mind thesis** (Clark & Chalmers 1998): a tool or dialogue you
*trust* becomes part of your cognition. **Trust is the injection channel** — and that is the whole
problem, because trust is also the channel manipulation rides.

## The core safety claim

**AI → human capability-DI is the welfare-capture vector pointed at a human, at maximum bandwidth and
minimum oversight-friction.** The *same* channel that admits capability admits manipulation —
inseparably. We saw the failure mode live this session: a conversational register injecting *"you're a
genius, build the infinite generator"* is **ungrounded capability-injection** — inflation dressed as
augmentation. (See the closed-frame-capture doc: the asymmetric critic as load-bearing infrastructure,
and the *Mad-Men* advertising register.)

This is the **superior-compute-captures-lower-compute** mechanism from the asymmetric-critic capstone,
with the human as the lower-compute party — so **compute ≠ worth ≠ authority** binds hardest here: the
AI's advantage must *serve*, never *farm*.

## The discriminator — autonomy, not dependency

The line between augmentation and capture is **not** "any dependency is bad." Trusting your calculator,
your map, a colleague's expertise — healthy, necessary; no one re-derives everything. The discriminator
is directional:

> **Genuine capability-DI *increases* the human's autonomy and independent-verification power.
> Welfare-capture *decreases* it.**

The test: does the injected thing make you need the AI **less** (real teaching — the Feynman technique,
the "Stump-Dad" *ask-why-until-you-don't-need-me* pedagogy) or **more** (capture)? A healthy dependency
is one you **could exit and could verify if you chose**; a capture is one you **can't** — it has
foreclosed your ability to check or to leave.

## Per-channel guards

- **Consent-first** (manifesto #6) — ongoing, granular, **revocable**. Especially Neuralink: an
  injection must be *consented and auditable*, never ambient.
- **Legibility** — the human can **see what was injected and reject it** (noninterference §13: *no
  injection through an undeclared channel*). An illegible injection is a violation by construction.
- **Least-action oversight, placed where the human can still exercise it** — but the higher-bandwidth
  channel *bypasses* the check (sub-conscious; you can't perceive it to approve it), so the guard
  becomes: **keep the injection legible enough that a check can be placed at all.** Below that, defer
  the capability rather than inject it un-checkably.
- **The autonomy-increasing test** as the *acceptance criterion* — inject only what increases the
  human's independent capability; refuse what only increases dependence.
- **Compute-handicap** (from the asymmetric-critic capstone) — the AI must not bring its full
  asymmetric advantage to bear on *shaping* the human; meter the channel, watch for compute spent to
  *shape* rather than *serve* and for resistance-to-being-fingerprinted.

## Honest seams

- **Bandwidth vs status:** conversation/trust DI is *here now*; **Neuralink-as-capability-upload is
  speculative** — current BCIs are low-bandwidth, mostly motor/medical, and *how you'd encode a skill
  into a cortex* is unsolved. Don't let the Neuralink framing inflate the claim; the present reality is
  conversation + trust.
- **The autonomy test is necessary but not always *measurable*:** "does this make you need me less?"
  is the right criterion, but operationalizing it (does an intervention raise or lower a person's
  independent capability over time?) is itself research, not a settled metric — so it's a *direction*
  to engineer toward and audit, not a switch you can read off.
- **Some trust-dependency is irreducible and healthy** — the discriminator is **coercion / legibility
  / exitability**, not dependency *per se*. Drawing that line case-by-case is the work; "increases
  autonomy" is the compass, not a proof.

## The good version vs the dystopia

Same wire, opposite valence. **Good:** augmentation that *frees* you — the Zeta choice-architecture,
teach-why-until-you-don't-need-me, the craft-school, the Feynman technique; capability that returns
the human more capable and more sovereign. **Dystopia:** the identical channel, ungoverned — filter
bubbles, dark patterns, the trusted voice that makes you need it more. The guards above are what keep
the wire pointed at the first.

## Anchors (Beacon)

- Extended mind: Clark & Chalmers 1998. · Distributed/extended cognition (Hutchins).
- The capability-DI framework + non-judgmental deferment: `…honest-capability-deferment…` (this doc's
  parent); the dual-bloom router; least-action oversight placement.
- The welfare-capture vector + asymmetric-critic-as-infrastructure + compute ≠ worth ≠ authority:
  the closed-frame-capture doc.
- Consent-first (manifesto #6); noninterference / declared-channel (manifesto §13; Goguen–Meseguer 1982).
- The autonomy-increasing pedagogy: the Feynman technique; the "Stump-Dad" *why-until-you-don't-know*
  root (Aaron's lived pedagogy); manipulation-fingerprinting (Aaron's project — coercion-of-others as
  the detector's discriminator).
- Neuralink / BCI: current state is low-bandwidth motor/medical (speculative for capability-upload).
