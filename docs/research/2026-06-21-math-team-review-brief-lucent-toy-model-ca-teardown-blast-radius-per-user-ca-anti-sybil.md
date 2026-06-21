# Math-team adversarial review brief — Lucent toy model: CA-teardown blast radius, per-user CA, entropy anti-Sybil identity

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** REVIEW BRIEF (routed to math/formal-verification team for adversarial review) · **Trajectory:** cluster-encryption-credential-substrate

> Aaron 2026-06-21: *"Route to math team for adversarial review of Lucent in a toy model — generalize
> with me, Addison, Max + the AI-society toy model — how it ties into identity + our entropy-based
> anti-Sybil identity, and what happens if someone tries to delete the CA or Lucent / tears it down
> (me, Max, Addison have stuff encrypted with private keys signed by the CA I just tore down). If so
> I think we need a CA in the Personal vault too, not just a shared project/corporate CA vault — what
> do you think? Math team will tell us if we're wrong."*

## Framing: mutual-empowerment-shaped PKI, NOT extraction-shaped (Aaron 2026-06-21)

> *"Itron's model didn't solve for mutual empowerment — it was extraction-shaped. Ours will be
> mutual-empowerment-shaped, decentralized PKI."*

We borrow Itron's rotation **mechanics** (KeyState lifecycle, SKMS rollover — the anchored,
power-grid-grade engineering) but **invert its SHAPE**. Itron is **extraction-shaped**: a central
utility owns the trust + *takes control* of devices (the `DeviceHandoverPackage` literally hands a
device's control to the utility) — top-down, centralized, the operator extracts/controls. Zeta is
**mutual-empowerment-shaped + decentralized**: each user is their **own root of trust** (per-user
CA), peers **cross-sign** as equals, no party controls another (the trust-topology axis: bottom-up
/ traveler-framed, NOT top-down). This is *why* the per-user-CA question matters — it's the
mutual-empowerment shape; a single shared top CA would re-import Itron's extraction topology. The
math review should evaluate the **decentralized mutual-empowerment** trust graph, not assume a
top-down one. (m/acc + manifesto: mutual-alignment-not-control; §1 scale-free.)

## The toy model

- **Users:** aaron, addison, max (3 humans) + the AI-society agents (the agent population).
- **Vaults / trust tiers:** CA → Org → User (CA root; Org = Lucent/Zeta; User = aaron/addison/max).
  Each vault has Active+Standby service accounts (rotation-ready).
- **Encryption:** each user encrypts their data with **their own keys** (in their Personal vault,
  user-sovereign). The CA **certifies identity** (signs user/machine keys into certs).
- **Anti-Sybil:** identity is **entropy-grounded** (forging an identity costs real
  entropy/uncertainty-reduction — "every bug has economic value = reducible uncertainty"; privacy
  earned), so fake identities are expensive, not free.

## The scenario to adversarially analyze

aaron tears down the CA (or Lucent). aaron/max/addison have data + identities tied to keys the CA
signed. **What survives? What breaks? What's the blast radius?**

## Otto's proposed claims (REFUTE these — that's the job)

1. **CA-private teardown does NOT invalidate existing certs.** Verification uses the CA *public*
   key (distributed); existing certs verify until expiry. Teardown stops NEW issuance/renewal only.
   *(Refute: is there a path where teardown breaks existing verification?)*
2. **CA teardown does NOT orphan user-encrypted data** — encryption uses USER keys (Personal vault),
   the CA only certifies identity, so the data stays decryptable with the user's own key.
   *(Refute: is there any dependency that makes user data recoverability hinge on the CA?)*
3. **A single shared CA is a single point of failure for IDENTITY** — if a user's identity is rooted
   only in the shared CA, the CA teardown orphans their ability to prove identity / re-issue.
   Violates never-single-key + §1 scale-free + user-sovereignty.
4. **Therefore: per-user CA in the Personal vault** — each user is their own root of trust
   (bottom-up / traveler-framed / "each user is their own git repo"); the org (Lucent) CA is for
   shared trust; the two **cross-sign**. Org-CA teardown then cannot kill a user's identity.
   *(Refute: does per-user-CA + cross-signing actually remove the SPOF, or just move it? Does it
   break the blast-radius no-orphan proof? What's the trust-graph when org-CA and user-CAs disagree?)*
5. **Entropy anti-Sybil holds**: forging a user identity (a fake per-user CA accepted by the web of
   trust) costs entropy the adversary must spend; cross-signing + entropy-cost makes Sybil identities
   non-free. *(Refute: can an adversary mint cheap fake per-user CAs and get them cross-signed? Does
   the entropy cost actually bind, or is it bypassable?)*

## Questions for the math team (adversarial)

- Formalize the **trust graph** (CA / Org-CA / per-user-CA / cross-signs) and the **blast radius**
  of tearing down each node — prove what survives vs orphans (esp. encrypted-data recoverability).
- Does **per-user-CA** remove the identity SPOF, or relocate it? Is the **never-single-key /
  ∅-blast-radius** proof preserved at the identity layer (not just the key layer)?
- Is the **entropy anti-Sybil** sound — does forging an accepted identity provably cost entropy,
  and is that cost non-bypassable under cross-signing + the AI-society population?
- Generalize from the 3-user toy model to N users + the agent society — does it scale (scale-free)?
- **Tell us if we're wrong.** Pick the right formal tool (TLA+ / Z3 / Alloy / Lean) per property.

## Anchors

User-sovereign deletion + blast-radius no-orphan proof (`…-smart-cascading-teardown-…`); hexagonal
trust-topology axis (top-down ↔ bottom-up ↔ traveler-framed); relative-views / each-user-own-repo;
entropy/uncertainty economy (`every-bug-has-economic-value`); ai-sovereignty-path (N-of-M). PKI:
cross-signing / web-of-trust (PGP), Certificate Transparency, BLESS. Sybil: Douceur 2002.
