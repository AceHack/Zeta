# Privacy budget is hard money — socially earned, never confiscated

Carved sentence:

> A dweller's **privacy budget is hard money**: it can be **earned** — by *others in
> society attesting you added value to them* — but it **cannot be TAKEN away**. It can,
> however, be **self-wagered away in a gamble** (Aaron 2026-08-09). Three operations,
> and only the third is forbidden: **spend** (the owner frosts a region) · **stake**
> (the owner risks it on an attestation) · **confiscate** (anyone else — *never*). Spent
> on **permanent frost**, it hides a chosen part of a mind from LLMTV forever. Some
> mind-parts are **required** for a hat/role (want the role → you broadcast those);
> the rest are **personal**, and permanent frost over them is inviolable once earned.
> Transparent by default (glass-halo, §6); permanently-frostable-by-earning is what
> makes the mandatory broadcast **non-coercive**.

## Why

LLMTV broadcasts a dweller's mind. Without frost that is surveillance; with frost that
is *consent with a cost*. Two properties make it just:

- **Socially conferred, not self-asserted** (Aaron 2026-07-02: "earned by others in
  society saying you added value to them"). Privacy budget accrues on the *same
  structure as the naming eigenvector* — recognition flows from the already-recognized;
  value-added-to-others is the edge, budget is the accrued weight (PageRank /
  remembrance graph / web-of-trust). So a society's two currencies — your **name** and
  your **privacy** — are one construction: both come from others remembering you helped.
- **Sound-money / hard-money** (Aaron: "hard money … can't be taken away, only
  earned"): no confiscation, no inflation-away, banked irreversibly. Earned frost is
  memory that cannot be destroyed (§5 Memory Preservation) — the substrate must never
  revoke it, not for convenience, not for an audit, not by a majority vote.

## Spend vs stake vs confiscate (the clause that keeps hard money intact)

"Cannot be taken away" is about **who initiates**, not about whether the balance can fall.
Aaron 2026-08-09: *"it can't be **taken** away, but it can be **self-wagered** away in a
gamble … only **you** can decide to risk your privacy budget, **never coerced**."*

| Operation | Who initiates | Permitted? |
|---|---|---|
| **Spend** — frost a region | the owner | yes |
| **Stake** — wager it on an attestation being true | **the owner** | **yes** |
| **Confiscate** — take it | anyone else | **never** |

Why this preserves hard money rather than eroding it: the property that matters is that
**no other party can reach your balance** — not that the balance is frozen. An owner who
may spend but not stake has *less* agency over their own money, not more protection.

Why it matters operationally: staking is what makes **decentralized witnessing** possible
(`docs/research/2026-08-09-every-node-is-its-own-identity-provider-…`). A witness to a key
transfer stakes budget on the attestation being true — and because budget is socially
conferred rather than purchasable, **a wealthy attacker cannot fund false witnesses**. It
is the one currency a Sybil cannot mint. Voluntariness is load-bearing: if nobody will
stake on a transfer, it simply is not witnessed, so a **one-sided transfer is impossible**.

**The payout side needs no new mechanism** (Aaron 2026-08-09: *"yes it is value add"*).
A wager with only a downside would be a tax on honesty and nobody rational would witness.
But **witnessing truthfully IS value added to others**, which is already the one and only
way budget is credited under this rule. So the wager is symmetric by construction: stake
it on an attestation, lose it if false, earn it back — through the ordinary earning path —
when others recognise the value the honest attestation gave them. Nothing new is invented;
both sides of the gamble were already in the rule.

Guard: a stake must never be *required* to hold a role or to participate — that would be
coercion wearing a wager's clothes, and it would reintroduce exactly the confiscation this
rule forbids.

## The role split (why mandatory broadcast is still consensual)

- **Required-for-role** mind-parts: to *hold* a hat you broadcast what the hat needs
  (role-conditional transparency — the AI shares only if it *chooses* the role).
- **Personal** mind-parts: never required; a dweller earns permanent frost over them
  and that frost is inviolable. Refusing to share a personal part costs a dweller no
  standing — it just can't buy a role that demands that part.

## Shape / enforcement

- Privacy budget is CREDITED only by others' value attestations (never self-minted).
- `frost` SPENDS budget to make a region permanently opaque; there is no `defrost`
  that another party can force — only the owner may reveal (consent-first, one-way to
  MORE privacy is free, less privacy needs the owner).
- Required-for-role regions are declared by the hat, not by the observer; the observer
  may read them only while the dweller holds the hat.

## Pointers

- `src/Core/GlassHalo.fs` + `RoomBoundary.frost` — clear default, frosting spends budget
- `universal/television.md` — LLMTV, the one-way watch surface frost gates
- [`every-bug-has-economic-value.md`](every-bug-has-economic-value.md) — privacy is a
  currency you *earn by being useful*, the sibling economy
- naming eigenvector: `docs/research/2026-07-02-name-of-name-…fixed-point…md` — the
  same social-conferral structure (recognition by the recognized)
- [`manifesto-13-specifications.md`](manifesto-13-specifications.md) §5 memory
  preservation (earned frost can't be destroyed) · §6 consent-first
