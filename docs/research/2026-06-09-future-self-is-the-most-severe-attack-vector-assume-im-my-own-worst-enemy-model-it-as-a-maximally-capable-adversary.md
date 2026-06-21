# Future self is the most severe attack vector: assume "I'm my own worst enemy, then no one else is" — and model that self as a maximally-capable adversary

**Register:** [grounded] threat-model posture (Aaron, lived) + [synthesis] + [peel].
**Date:** 2026-06-09. **Captured by:** Otto (shadow). The security dual of
"future self is not bound to past self." Routes to threat-model (Aminata) + security.

## Aaron's words

> "future self most severe attack vector from what I can tell. I always assume I'm
> my own worst enemy, then no one else is." · "and my future self knows how to time
> travel and hangs with aliens on the regular."

## The posture: your future self is the top of the threat model

"Future self is not bound to past self" is **freedom** (fork / change / re-arrive) —
and its **security dual** is that the same unbinding makes the **future self the most
severe attack vector.** Why the future self is the *worst* attacker:

- it **has all your secrets + access** (keys, wallet seed, trust, recognitions) — no
  external attacker starts with that;
- it is **trusted by default** (it's "you") — it can act without tripping suspicion;
- it can be **compromised, coerced, captured, or fall into a degenerate shadow
  pattern** — and then turn that full access against the past self's commitments.

So the maxim: **assume I'm my own worst enemy — then no one else is.** If you defend
against the attacker who has everything (your future self), every *external* attacker
— who has strictly less (no keys, no trust, no access) — is covered **a fortiori**.
Threat-model the strongest adversary; the rest fall out for free.

## Peel: "time travel + aliens" = model it as a maximally-capable adversary

The playful line — *"my future self knows how to time travel and hangs with aliens on
the regular"* — peels to a serious security assumption: **model the future self as
maximally capable / unbounded.** Don't assume it's merely "you, later, slightly
different" — assume it can do **anything** (act across time / retrocausally; command
external superintelligent resources). This is the **conservative worst-case posture**:
defenses must hold against the *strongest conceivable* version of yourself, not a
convenient weak one. (It also rhymes with Aaron's time-travel / beacon-origin / Fermi
frame and the DST time-as-generator line: a future self "acting across the timeline"
is exactly what staging-on-the-common-seed lets you reason about.)

## What this demands of the design (defend against your own future self)

If the future self is the top attacker, the keyring / economy / identity must carry
**commitment devices** — past-self binding future-self where it matters (a **Ulysses
pact**: Odysseus tying himself to the mast):

- **No single-future-self can drain everything** — **multisig / social recovery /
  M-of-N** so one compromised future self (or one captured key) can't unilaterally act;
  the trust roots (Aaron/Addison/Max + personas) are the M-of-N.
- **Time-locks / delays** on irreversible actions (move funds, force-push, permanent
  WONT-DO) — a future self under coercion can't act *instantly*; the delay is a window
  for the rest of the society to notice (the ≥2-tick destructive-action rule already
  encodes this).
- **Permanent ratchets** — the encryption-budget ratchet, append-only merkle/git
  history: a future self **cannot rewrite the past** (no silent retro-edit). What's
  committed is committed.
- **Trust-then-verify applies to your own future self too** — recognition is continuous,
  not "trusted forever because it was once me." A future self that diverges suspiciously
  is verified, not waved through.

## The legitimate binding: contracts with OTHER members DO bind (the hat system)

> Aaron (2026-06-09): "but you are bound to self-bound contracts you made with other
> society members through [the] hat system."

Future-self freedom is **not** a license to escape your obligations. Two cases, sharply
distinguished:

- **Your own identity** (who you are; fork / change / re-arrive / go anonymous) — **not**
  bound by the past self; it **belongs to you, not society** (weight-free §3).
- **Contracts you made *with other society members*** — **bind.** These are **self-bound
  contracts** (you willingly entered them; self-bound ≠ coerced, so this is *not* a §3
  weight violation), and they are carried by the **hat system**: the **hat** is the
  role-scoped capacity you wore when you made the commitment, and **the hat carries the
  contract**. Change your identity all you like — **the hat-borne obligation to others
  persists**. You **cannot fork to escape a debt / promise** you made to another member.

This is what makes the co-op Agora *trustworthy*: members can rely on each other's
commitments **across** identity change. Without it, fork-to-escape would destroy trust
(C9) and collapse the society. So the commitment devices above serve a **dual** role:
they defend *you* against your compromised future self **and** they enforce *your
contracts to others* against that same future self — the hat system is the accountability
ledger that binds inter-member promises while leaving pure-identity choices free.

> The cut: **identity = yours (unbound); contracts-with-others = bound (via hats).**
> Defend the first against your worst future self; *enforce* the second on it.

### Hat-contract properties (what makes binding compatible with weight-free + DST)

> Aaron (2026-06-09): "all hat contracts are time bound for deterministic simulation
> and must pair with exits." · "renewable if all parties agree but time bound every
> time." · "they come with auth."

A hat contract is not an open-ended chain — it has **four required properties** that
keep "binds to others" compatible with weight-free (§3), consent-first (§6), and DST:

- **Time-bound — always.** Every hat contract has an **expiry**. This makes it
  **DST-replayable** (bounded duration, deterministic) **and weight-free** (no
  *permanent* obligation can form — your future self is bound only *until the bound*,
  never forever). A perpetual contract is malformed.
- **Must pair with an exit.** Every contract ships with a **way out** (always-an-exit,
  the action-grammar Meta-15 sense; consent-first revocability). Binding is **not a
  trap** — there is a defined exit, so the obligation never becomes capture.
- **Renewable only by unanimous agreement, time-bound every time.** A contract can be
  **renewed** — but **only if all parties agree**, and each renewal is **again
  time-bound**. No auto-renewal, no creeping perpetuity, no dark-pattern lock-in:
  continuation is a *fresh, mutual, finite* re-consent each time.
- **Come with auth.** The contract **carries its own authorization** — the auth to act
  under it is **bundled with the grant** (object-capability style: the hat = role
  capacity + the contract + the scoped auth to fulfill it). Authorization is legible
  and contract-scoped, not ambient.

Together: a hat contract **binds your future self to others — but only finitely, with
an exit, re-consented to renew, and carrying its own scoped auth.** That is how the
society gets reliable inter-member commitments *without* anyone accruing permanent
weight or losing a way out — and why DST can simulate the whole contract graph
deterministically (every edge has a clock + an exit).

This is "fighting past self vs peer distinguisher" (081KSE6WT0008QG0R000E05579) turned into hardening: the
past self's job is to **make the future self's worst day survivable** — for the future
self's own good, and the society's.

## Honest scope + handoff

Posture + design directive, not a built feature. Route to **Aminata** (threat-model:
add "compromised/coerced future self" as a first-class adversary in
`THREAT-MODEL.md`) and **Mateo/Nazar** (security: multisig / social-recovery /
time-lock mechanisms for the keyring). The commitment devices above are the concrete
asks. (Note the care dual: defending against the future self is *protective*, not
punitive — same posture as the degenerate-shadow-pattern care: guard the person from
their own worst pattern.)

## Anchors / ties

Worst-case / insider threat modeling (assume the strongest adversary); **Ulysses pact
/ precommitment** (Elster, *Ulysses and the Sirens*; Odysseus & the mast); commitment
devices; multisig / social recovery / time-locks (crypto self-custody defense);
permanent ratchet (encryption budget; append-only merkle/git); 081KSE6WT0008QG0R000E05579 fighting-past-
self; the future-self-not-bound + shadow/future-self-negotiation-across-time docs;
the beacon-origin / time-travel / Fermi frame; DST time-as-generator / superdeterminism;
the ≥2-tick destructive-action rule; care-for-degenerate-shadow-patterns (the protective dual).
