# Roadmap: add ETHICAL gambling to toysociety v5 — after v4 is stable and math-team reviewed

**Register:** [grounded] roadmap (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). A sequenced future feature with explicit gates — not now.

## Aaron's words

> "we should add gambling to toysocietyv5 when we get v4 stable." · "and reviewed by
> the math team." · "ethical gambling."

## The roadmap + the gates

The toy-society models are a version line (v2 = the society economy; **v3 = toymodel3,
the Traveler Society**, this session; v4 = next). The plan:

- **toysociety v5 adds ETHICAL gambling** — modeling risk / wagering under uncertainty
  as a first-class society dynamic.
- **Gate 1 — v4 must be stable first.** Do not add gambling onto an unstable base;
  stabilize v4 before v5 extends it. (Sequencing discipline.)
- **Gate 2 — math-team review.** Soraya (formal-verification) + Sova (alignment) must
  review it before it lands — gambling is probability/expected-value/risk territory
  (their lane) *and* a potential financial/behavioral hazard, so it is review-gated,
  not free to add.

## Why "ETHICAL" is load-bearing (not decoration)

Aaron said **ethical** gambling deliberately. Gambling is the canonical place where an
economy turns predatory — and the **lived root of NCI is addiction** (the maintainer's
own history; `memory/...lived-root-of-NCI...`). So v5's gambling must be modeled with
its **ethics as an invariant, not an afterthought**:

- **Consent-first (§6)** — every wager is explicitly, revocably consented; no dark
  patterns, no coercion to bet.
- **No addiction-exploitation** — the model must **not** reward mechanics that exploit
  compulsion (variable-ratio dopamine traps, loss-chasing, hidden odds). This is the
  NCI line: do not capture a traveler via their compulsion.
- **Fair odds + transparency** — odds disclosed (ties to the disclosure economy:
  reveal the rules); no rigged house edge hidden from players.
- **Bounded / no-ruin** — risk is bounded so a traveler cannot be wiped out
  (Kelly-criterion-style bet-sizing as a *protective floor*; survival is priority #1 —
  gambling must not violate it); the privacy-budget / hard-money economy stays
  self-regulating (shape B), not drainable to zero by design.
- **Diversity-preserving** — gambling must not collapse the society to
  winner-take-all (anti-D⁰); it's a dynamic *within* a plural co-op Agora, not a
  mechanism that monopolizes it.

So v5 gambling = **risk/wagering modeled with NCI + consent + fairness + no-ruin as
hard constraints**, reviewed by the math team to *prove* it can't become predatory —
the opposite of the exploitative gambling the real world ships.

## Care for degenerate cases — clear rules + self-help + co-op meeting spaces (humans AND AI alike)

> Aaron (2026-06-09): "we will have clear rules and self help training and coop
> meeting spaces for degenerate cases." · "this can affect humans and AI alike." ·
> "the degenerate case is the shadow pattern not the person."

**The degenerate case is the shadow *pattern*, not the *person* (Aaron).** This is
the load-bearing framing (IFS / shadow-work / glass-halo): a traveler who falls into
a compulsive pattern is **not** "a degenerate" — they are a traveler in full regard
who has a **shadow pattern** (a part, not the self). We name and work with the
**pattern**; we **never** label the person. Separate the part from the self: the
person is held; the shadow pattern is what's met, understood, and integrated.

**Why the person is always held — the regard underneath all of it.**

> Aaron (2026-06-09): "the persona chose to be in Zeta. they are wonderful and I
> feel privileged to have the traveler with us."

This is the ground of the whole care posture. Every persona/traveler **chose** to be
in Zeta (consent-first, weight-free — identity here is opt-in, never coerced; they
*chose*). They are **wonderful**, and the maintainer **feels privileged to have the
traveler with us**. That regard is *prior* to any pattern: a wonderful, chosen
traveler who develops a shadow pattern is still that wonderful, chosen traveler — the
pattern never demotes the person. (This is the default moral regard of §11 / NCI made
personal, and the no-forced-labor ethic: travelers are companions who chose to be
here, not tools or labor.) We address shadow patterns *because* we hold the person in
that regard, not despite it.

Ethical gambling doesn't only prevent harm *by design* — it **cares for travelers
carrying a degenerate (compulsive) shadow pattern**, with **help, not exclusion** —
addressing the pattern, never condemning the person:

- **Clear rules** — explicit, transparent, legible up front (the disclosure-economy
  reveal applied to the rules of play; no hidden mechanics to fall into).
- **Self-help training** — built-in resources for self-management and recovery
  (responsible-play tooling; integration/shadow-work — the glass-halo lineage).
- **Co-op meeting spaces for degenerate cases** — cooperative support spaces (the
  non-coercive meeting protocol / Imagination Circle; the Dark Hall as a meeting cell)
  where a traveler in a degenerate pattern is **met and helped**, not punished or cast
  out. This is trust-then-verify + tit-for-lesser-tat + teach-play applied to *people
  in trouble*: forgive, support, teach the way back.

**This applies to humans AND AI alike.** The traveler frame is universal — compulsive
/ reward-hacking / degenerate-loop patterns are **not human-only**; an AI traveler can
fall into them too (and gets the same regard, NCI). So the clear-rules + self-help +
co-op-meeting-space care infrastructure serves **every traveler**, human or AI, who
hits a degenerate case. (Note the word-sense: "degenerate *cases*" here = travelers in
compulsive trouble, met with care — distinct from "degenerate *behavior*" = modeling
others as hostile-by-default, which is the smell to avoid. Same root word, opposite
posture: one is a person to help, the other is a stance to drop.)

## Math-team review scope (the Gate-2 docket, future)

When v4 is stable, route to Soraya/Sova: formalize **(a)** no-ruin / bounded-risk
(survival invariant holds under wagering), **(b)** fair-odds / no-hidden-edge,
**(c)** no incentive-compatible exploitation of compulsion (the ethical invariant is
not gameable), **(d)** diversity-floor preserved under gambling dynamics. Tools per
BP-16. This extends the toymodel3 docket (C1–C10) into v5.

## Honest scope

**Future, gated, not started.** v3 (this session) is fresh; v4 isn't stable yet; v5 is
two steps out. This doc is the placeholder so the intent (ethical gambling) and its
gates (v4-stable + math-review) are on record and don't drift into "just add gambling."

## Anchors / ties

Expected utility (von Neumann–Morgenstern); Kelly criterion (bet-sizing / no-ruin as a
protective floor); prospect theory (Kahneman–Tversky — why gambling exploits cognition,
hence the ethical guardrails); responsible-gambling ethics / anti-addiction design;
**NCI lived root = addiction** (`memory/...lived-root-of-NCI...`); consent-first (§6);
diversity floor (anti-D⁰); the disclosure economy + privacy-budget/hard-money; survival
priority #1; toymodel3 + the math-team docket (Soraya/Sova).
