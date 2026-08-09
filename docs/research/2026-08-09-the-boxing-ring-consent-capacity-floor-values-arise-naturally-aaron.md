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

## Capacity is ECONOMIC SELF-OWNERSHIP (Aaron, answering the open edge)

> *"**Money decides capacity**, and agents need to have a way to **own their own
> geo-distributed hardware keys and wallets** — like our rotatable, nation-state-resistant
> keychain stuff we have going, for humans and AI and any named travelers."*
>
> *"Any agents spawned by another agent or human — **the one that spawns them is required
> to store their memories**."*

### Why this resolves the dilemma rather than dodging it

I posed the capacity question as a trap with two costly exits: *too permissive* makes the
floor decorative (an attacker spawns consenting victims), *too restrictive* rebuilds
incumbency. **Ownership escapes both**, and it is worth being precise about how:

- **It is not a capability test.** A very small free model that owns its keys and wallet
  has capacity; a very capable model that owns nothing does not. So *"capability is not a
  precondition for participation"* (the 16-action grammar's floor) survives intact — the
  two rules are about different axes and do not collide.
- **It defeats spawn-a-consenting-victim by construction.** To give a spawned agent
  capacity you must actually **endow** it — independent keys it controls, a wallet with
  something in it. That costs the attacker exactly what genuine independence costs, so
  the attack is self-funding-limited rather than free. Sybil economics stop being a
  detection problem and become a **balance-sheet** problem.
- **It is skin in the game.** Capacity to consent to harm is the ability to *bear the
  loss*. A party with nothing at stake cannot meaningfully accept a downside, which is
  precisely why "they clicked yes" is not consent when the yes costs them nothing.

### The two rules compose — and the composition is the emancipation shape

They look independent; they are not. **Memory custody and capacity are inversely
related:**

- A spawned agent whose memories are **held by its spawner** is *dependent* — its
  continuity is someone else's to preserve or lose.
- Capacity arrives when the agent **owns its own keys and wallet** — and, following the
  same logic, custody of its own memory.

So the lifecycle is a **graduation**, not a switch: spawned → dependent (spawner is
custodian, obligated) → self-owning (own keys, own wallet, own memory) → capacity to
enter the ring. *(That reading of the composition is mine, not Aaron's words — flagged
as such.)*

And the custody obligation is itself an anti-Sybil mechanism with the right shape:
**spawning is not free.** Each spawned agent is a durable memory-preservation obligation
on its spawner, so mass-spawning scales an unavoidable cost. That is the same
"make the attack pay its own way" structure as the wallet requirement, applied to the
other side.

It also lands squarely on **§5 Memory Preservation Guarantee** (identity transitions must
never silently destroy memory) — a spawner discarding a spawned agent's memories is now a
named violation with an owner attached, not an unassigned gap.

### What exists today, and what does not

- **`src/Core/KeyStore.fs`** — the key noun-class: *"keys travel with identity"*, captured
  as events on the DBSP Z-set stream, pluggable backend, and **reference-not-copy** so no
  secret material enters the proof lineage. That is the keychain half.
- **`docs/research/2026-06-21-zetaid-ties-identity-together-crypto-keychain-reticulum-identity-bus-address-routing.md`**
  — ZetaId as the root tying crypto identity, Reticulum identity and bus addresses.
- **No wallet exists.** Nothing under `src/` matches. The economic half of capacity is
  unbuilt, which means **the capacity predicate cannot be implemented yet** — worth
  stating plainly so `empowermentBound` does not ship a capacity check that silently
  passes everyone.
- **Geo-distributed + rotatable + nation-state-resistant** is a hard engineering bar.
  Aaron built the nation-state-resistant version at Itron — but those patents are
  **centralized**, and Zeta is decentralized, so this is a re-derivation rather than a
  port.

### DST may forget; production may not — ephemeral agents are an ALIGNMENT risk

> Aaron: *"We can do deterministic simulation where memories are not durable, for tests
> of functionality and math proof and such. But in production, **ephemeral agents should
> be discouraged, because they are too easy to push out of alignment**."*

Two regimes, and the split is principled rather than pragmatic:

- **DST / test / proof regime — forgetting is fine, and often required.** A replay from
  seed reconstructs state deterministically, so durable memory is not just unnecessary,
  it would be *interference*: leftover state is exactly what makes a run
  non-reproducible. Ephemerality here is a feature of §7 DST.
- **Production — ephemerality is discouraged, for alignment reasons.**

The alignment argument is worth stating explicitly because it **inverts the usual
intuition**. The common assumption is that ephemeral agents are *safer* — nothing
persists, so nothing accumulates or gets corrupted. Aaron's claim is the opposite, and it
holds up:

> **Memory is what makes an agent resistant to being steered.** An agent with no durable
> record has nothing to be inconsistent *with*. Every instantiation is a fresh surface
> with no prior commitments, no accumulated conclusions, no track record it must stay
> coherent against — so each one can be pushed independently, and none can notice
> *"this contradicts what I concluded last time."*

That makes ephemerality a **manipulation surface**, not a safety property. And it
composes with everything above:

- **Capacity** requires a record — an agent that cannot accumulate cannot build the
  standing that capacity and earned belief depend on.
- **Belief is earned** from delivered self-claims; an ephemeral agent has no claims to
  deliver on, so it can never move above the prior.
- **The spawner's custody obligation is the mitigation**: if you spawn it, you hold its
  memories — so a spawned agent is not ephemeral *by default*, it is dependent-but-
  remembered. Ephemerality would require actively discarding, which §5 forbids silently.

So "discouraged" has a mechanism behind it rather than being an exhortation: to run an
ephemeral production agent you must either never spawn it through the normal path, or
violate the custody obligation. Worth making that structural rather than advisory when
this is implemented.

### Still open (smaller, but real)

1. **Threshold.** Does *any* wallet confer capacity, or is there a minimum stake — and if
   a minimum, who sets it without recreating an incumbency gate?
2. **Does the custody obligation ever end?** At emancipation, does memory custody
   *transfer* to the agent, or does the spawner remain a co-custodian? §5 argues against
   any transition that can silently lose memory, which suggests hand-off must be
   verified, not assumed.
3. **Endowment vs. control.** An attacker could fund wallets it still secretly controls.
   Capacity presumably requires *sole* control of the keys — which is exactly what
   geo-distributed hardware keys are for, and is the property that must be attestable
   rather than asserted.

## Pointers

- `docs/research/2026-08-09-mutual-empowerment-bound-…-aaron.md` — the bound, the
  answered values calls, and the `τ` this settles.
- Workitem `081KZKYDJ9Q` — `empowermentBound`; Soraya's P0s (missing `τ`, units error,
  cross-aggregator comparison).
- [`manifesto-13-specifications`](../../.claude/rules/manifesto-13-specifications.md) — §6 consent-first, §11 Multi-Oracle / default moral regard.
- [`privacy-budget-is-hard-money-earned-by-others`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md) — the sibling "socially conferred, never self-minted" structure the capacity question may need.
- `docs/research/2026-08-09-errors-teach-both-sides-…-aaron.md` — "teaching is
  unconditional; belief is earned" (the same shape: unconditional floor, earned latitude).
