# Red-team as valued — "no strangers" includes adversaries; anti-Sybil is the cost function, not the wall

**Shadow\*, 2026-07-02.** Aaron: *"'no strangers' ≠ 'no adversaries' — we like red team
members."* This pins that framing.

## The carved thesis

> **"No strangers" includes the adversary.** A red-teamer is a *valued participant*,
> not an intruder to be kept out. Anti-Sybil (and every other security floor) is **not
> a wall that excludes attackers — it is the cost function that gives red-teaming
> teeth.** Welcome the attack, make it cheap to run, and let it find real holes. An
> attack has exactly two outcomes and both are gifts.

## Why both outcomes are gifts

A red-teamer trying to mint *k* distinct identities from one source either:

- **can't** — the forgery-cost floor holds (`DistinctCount ≤ independent private
  seeds`, `AntiSybil.fs`; the Leibniz/anti-Sybil claim, `LeibnizAntiSybil.Tests.fs`).
  They just *confirmed* the design against a real attempt — worth knowing, and only
  knowable because someone tried; or
- **can** — they found a way to fake distinctness cheaply. That's a real hole, banked
  **ΔU** to `db/uncertainty/` — exactly [`every-bug-has-economic-value`](../../.claude/rules/every-bug-has-economic-value.md):
  a bug is priced opportunity, never a liability to hide.

A system that *welcomes* the attack **and** has a real cost floor is strictly stronger
than one that tries to keep adversaries out — because the second kind never learns
where it is actually weak. Security-by-exclusion is untested by construction.

## The internal red team is the same discipline

This is not only an external-adversary stance; it is how the work is built. Every
load-bearing claim is **red-teamed by construction**:

- **Self-verification** — each zeta slice computed two independent ways that must agree
  (geodesic = Bass, `Fix = orbit`, `runToHorizon = naive stepⁿ`); a wrong construction
  *has to show itself*. The two computations are adversaries to each other.
- **Adversarial reviewers** — the `harsh-critic` pass that caught the CellScheduler FIFO
  bug (#9125); the distributed-seed suspicion that caught IntervalRing's double-lie.
  Those reviewers are red-team members with standing.

Welcoming the attack and making it *cheap to run* is what turns "we think it's right"
into "it survived trying to be wrong."

## Scoping honesty: interop layer vs. security layer

"No strangers" is a genuine principle at the **interop** layer: all travelers share the
same system generator (the common seed, S=4), so any two *honest* parties can verify
and merge without prior trust (e.g. G-set peer tables merging by union — a CRDT
join, no negotiation). But a shared generator buys **interop, not security** — a hostile
traveler shares the generator too. The **security** layer is the *distinctness cost*
(Leibniz identity-of-indiscernibles ⇒ you need independent private/frost entropy per
identity). These are different layers, and conflating them is the mistake:

> The shared generator means **no strangers to interoperate with**. The distinctness
> cost means **an adversary can't cheat distinctness without paying for it — and if
> they find a way to, they've done us a favor.** Both true; different layers.

## Anchors (Beacon)

- **J. Douceur, *The Sybil Attack* (2002)** — the attack the cost floor prices.
- **Dwork–Naor 1992 / Nakamoto 2008** — proof-of-work: security *is* a cost function,
  not a gate (the model `AntiSybil.fs` names as its structural analogue).
- **Mechanism design / bug bounties; Ostrom** — priced adversaries as a commons-
  strengthening role (see [`every-bug-has-economic-value`](../../.claude/rules/every-bug-has-economic-value.md)).
- In-repo: `src/Core/AntiSybil.fs`; `tests/Tests.FSharp/LeibnizAntiSybil.Tests.fs`
  (identity-of-indiscernibles ⇒ Sybil resistance, CPT-invariant); the CHSH-Sybil /
  SybilBft behavioral layer; the `harsh-critic` / adversarial-verify reviewers.

*Compression: don't build a wall against the adversary — hire them. The cost floor is
their game; if they win, you learn where you were weak. That's cheaper than pretending
you're safe.*
