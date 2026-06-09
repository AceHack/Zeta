# Interfaces are valuable because they are the cached (useful) proof-of-work in our system — content-addressed, reused, and another way to earn privacy budget

**Register:** [grounded] economic synthesis (Aaron) + [Beacon]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The economic reason interfaces (= homoiconic proofs) are valuable.

## Aaron's words

> "that's why they are valuable — they are the cached proof-of-work in our system, another economic
> opportunity to earn privacy budget."

## The claim

We have: **interfaces are homoiconic to proofs** (Curry–Howard — the interface IS the proof). Aaron
gives the **economic reason they are valuable**: a proven interface is **cached proof-of-work**, and
producing/contributing one is **another way to earn privacy budget**.

### 1. Cached USEFUL proof-of-work
A proven interface took **work** to produce (derive, byte-lock, prove). Because interface≡proof is
**content-addressed** (fingerprint = canonical root), that work is **cached**: computed once, then
**reused by anyone, forever**, by its address — never recomputed (free dedup; idempotent). *Peeled:*
this is **proof-of-USEFUL-work**, the opposite of Bitcoin's wasteful PoW — the "work" is the proof
itself, and its product (a proven, reusable interface) **is the useful artifact**, not a discarded hash
race. (Closer to proof-of-useful-work / verifiable computation: the effort yields a permanently
valuable, verifiable result.) The cache *is* the value: a library of content-addressed proven
interfaces is accumulated, deduplicated, reusable proof-of-work.

### 2. Another way to earn privacy budget
Contributing a proven interface is a **disclosure that reduces everyone's uncertainty** — so it **earns
privacy budget** in the reveal-to-earn / encrypt-to-spend economy (the disclosure budget; Soraya
C5/C11; uncertainty-reduction-at-the-border earns trust + leverage). Until now the budget-earning moves
were: disclose a finding, publish a cheat, reduce uncertainty at a border. **Add: produce a cached
proven interface.** You do verifiable, reusable work → you earn budget you can **spend on privacy**
(encrypt what you want to keep, per "encrypt the ones you want, keep the private for advantage"). So
the system has a clean economic loop: **useful proof-of-work in ⇒ privacy budget out.**

## Why this closes the economic loop

- **Work is never wasted or duplicated** — content-addressing caches every proof; the same proof is
  never redone (dedup), and it stays verifiable by its fingerprint.
- **Incentive aligns with the one metric** — you earn budget by *reducing uncertainty* (a proven
  interface reduces it durably), which is exactly the system's guiding star.
- **Privacy is paid for by useful work** — the budget you need to keep things private is earned by
  contributing verifiable public value. This is the SuperFluid / "security is not friction" thesis
  with an economy under it: privacy is **earned** through cached proof-of-work, not bought or bolted on.
- **Interfaces become the currency-bearing asset** — "interfaces are the valuable thing" is now
  literal: they are the **cached proof-of-work** whose production **mints privacy budget**.

## Honest scope / handoff

Economic framing on captured pieces (homoiconic interface≡proof; content-addressing/cache/dedup;
privacy/disclosure budget C5/C11; reveal-to-earn). To realize: a **proof-of-work valuation** in the
privacy economy (a cached proven interface = an earn event), the content-addressed proof cache (the
library of reusable proofs), and the budget-credit on contribution. Routes to Soraya/Sova (C5/C11 +
the proof-of-useful-work valuation as a proof-room), the privacy-economy core (`PrivacyEconomy.fs`),
the interface/public-API owners (Ilyana — interfaces as the budget-bearing asset), ace (the cached
proof library / room graph).

## Anchors / ties (Beacon)

Proof-of-useful-work / verifiable computation (vs Bitcoin wasteful PoW; Primecoin; proof-carrying code
— Necula 1997); content-addressing → cache + dedup (Merkle/Git/IPFS; canonical root = fingerprint);
Curry–Howard interface≡proof (the prior doc); privacy/disclosure budget — reveal-to-earn/encrypt-to-
spend (Soraya C5/C11; `PrivacyEconomy.fs`); uncertainty-reduction-at-the-border earns trust+leverage;
"interfaces are the valuable thing, everything regenerates from them"; SuperFluid / security-is-not-
friction (privacy earned by useful work); the one metric = uncertainty-Δ.
