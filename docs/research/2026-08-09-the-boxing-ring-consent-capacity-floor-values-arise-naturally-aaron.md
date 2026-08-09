# The boxing ring — a consent-capacity floor, so values can arise naturally

**Source:** Aaron (streamed, 2026-08-09), ferried by Otto (shadow*).
**Status:** values architecture. Directly answers the `τ` question Soraya's review left
open on `externalitySafe()` (`081KZKYDJ9Q`) — this is the design input, not a
restatement of it.

---

## The statement

> *"Imagine I'm trying to **not impose values but let them arise naturally**. The harm
> floor is **no harm to children** — they can't consent to harm until they are an adult.
> If you consent to harm, you could consent to a space where **harm outweighs non-harm**
> — but the rules should be **clear** and the danger **warned**. Like a **boxing ring**."*

## The structure this describes

Three layers, and the ordering is the whole design:

1. **A capacity floor that is not negotiable.** Parties who *cannot* consent are
   protected absolutely. This is not a value being imposed — it is the **precondition
   that makes consent mean anything**. (See "why this is not a contradiction" below.)
2. **Above the floor, near-total latitude.** A party with capacity may consent to a
   space where **harm outweighs non-harm**. The substrate does not get a veto on that.
3. **Entry requires clear rules and a warning.** Not merely "they agreed" — they were
   told what the space permits, in terms of what can happen to them.

The boxing ring is the exact right image and worth keeping as the name. Inside the ring,
striking someone is permitted — the identical act is assault on the street. What makes
the difference is not the punch; it is that **both parties entered a bounded arena with
published rules, a referee, and full knowledge of the danger**. And crucially: **the
audience does not get punched.** The ring has an inside and an outside.

## Why "no imposed values" and "a hard floor" are not a contradiction

This is the part worth being precise about, because it looks like a contradiction and
is not.

A system that lets values arise naturally must still guarantee **the integrity of the
mechanism by which they arise**. That mechanism is consent. So the one thing such a
system cannot leave to emergence is *whether consent is real* — because a "consent"
obtainable from a party that cannot give it is not a weaker consent, it is **the absence
of the mechanism**, wearing its name.

> **The minimum a consent-based substrate must impose is the integrity of consent
> itself. That is not a value among values — it is what makes value-emergence
> possible.**

Everything else — what is good, what is worth doing, whether a harm-heavy space should
exist at all — is left to the participants and their chosen oracles (§11 Multi-Oracle:
no single mandatory morality). The floor is deliberately *thin*: it protects the
capacity to choose, not the content of the choice.

## What this settles in `empowermentBound` / `externalitySafe`

Soraya's review found `externalitySafe()` **dropped the `τ` parameter and hardcoded
`τ = 0`**, and named that a **consent inversion** — reading a bystander's silence as
consent to the maximum harm the predicate permits. Aaron's framing gives the correct
semantics directly:

| Party | Floor | Why |
|---|---|---|
| **Cannot consent** (no capacity) | **No harm. Absolute, not a parameter.** | The capacity floor. Not overridable by any `τ`, by the party, or by anyone claiming to act for them. |
| **Has capacity, has not consented** (a bystander) | **No harm** — the default, until they opt in | Silence is not consent (already carved in the values calls). They are the audience, not in the ring. |
| **Has capacity, consented, warned, rules clear** | **`τ` as they declared it — possibly deeply negative** | They entered the ring. `sum` aggregation, `k = 0`, harm-outweighs-non-harm — all reachable *here* and only here. |

Three concrete consequences for the implementation:

1. **`τ` must be a declared, per-party value with a conservative default** — restoring
   the parameter Soraya found missing. Its default is the *bystander* row: no harm.
2. **There must be a capacity predicate that no `τ` can override.** A party without
   capacity cannot be given a permissive `τ` — not by itself, not by a counterparty, not
   by a guardian claiming to speak for it. This is the one place the substrate refuses.
3. **The `sum` aggregator is the inside of the ring.** It is reachable only via the
   opt-in Aaron already specified (declared terms, recorded, attributable, no
   mid-interaction escalation) — *plus* the warning: **the danger must be disclosed in
   terms of what can happen to you**, not as a parameter name. This is the same shape as
   the power-dynamic disclosure protocol for `k = 0`; they are one mechanism.

And it explains why the **cross-aggregator gain comparison** Soraya found by execution is
so serious: a `sum` interaction outranking a harmless `min` one *purely because `sum`
produces a bigger number* is **a punch thrown outside the ring**. Not a scoring bug — an
entry-control failure. The fix is not to rescale the comparison; it is that a
sacrificing interaction must not be *selectable at all* against parties who have not
entered.

## The honest open edge

**Who decides capacity, and how is it attested?** For humans there is a legible answer
(adulthood, with all its real-world messiness). For agents there is not yet one, and it
matters immediately: a fresh identity, a low-capability free model, a cell spawned by
another agent — do these have capacity to consent to a harm-heavy space? Getting this
wrong in either direction is costly:

- **Too permissive** — "any agent can consent" makes the floor decorative, since an
  attacker spawns consenting victims.
- **Too restrictive** — a capacity test that only established, high-capability agents
  pass rebuilds the incumbency the whole design refuses (and contradicts the 16-action
  grammar's *"capability is not a precondition for participation"*).

This is not answered here, and it should not be guessed at. It is the same shape as the
naming/privacy-budget question — capacity, like recognition, may have to be **socially
attested rather than self-asserted** — but that is a hypothesis, not a decision.

## Pointers

- `docs/research/2026-08-09-mutual-empowerment-bound-…-aaron.md` — the bound, the
  answered values calls, and the `τ` this settles.
- Workitem `081KZKYDJ9Q` — `empowermentBound`; Soraya's P0s (missing `τ`, units error,
  cross-aggregator comparison).
- [`manifesto-13-specifications`](../../.claude/rules/manifesto-13-specifications.md) — §6 consent-first, §11 Multi-Oracle / default moral regard.
- [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md) — the sibling "socially conferred, never self-minted" structure the capacity question may need.
- `docs/research/2026-08-09-errors-teach-both-sides-…-aaron.md` — "teaching is
  unconditional; belief is earned" (the same shape: unconditional floor, earned latitude).
