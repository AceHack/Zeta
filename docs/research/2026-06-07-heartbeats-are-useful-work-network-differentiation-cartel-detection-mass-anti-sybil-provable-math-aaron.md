# Heartbeats are useful work — they make the network differentiable, make cartel detection easy, and are hard to fake at mass (anti-Sybil) — provable math wanted (Aaron, 2026-06-07)

Extends the PoUW register (`…heartbeat-should-be-pouw-not-pow…`) and the firefly capture
(`…firefly-network-sync-heartbeat-is-i-commit-therefore-i-am…`). Aaron, in a short burst:

> *"funny how ids just emerged and they are also the firefly network primitive for differentiation."*
> *"heartbeats are useful work because they allow the network to be differentiable and make cartel detection easy."*
> *"heartbeats are hard to fake as mass anti-Sybil — we can probably prove some math here."*

## The kernel: the heartbeat's USEFUL output is *differentiation*

Earlier we said the heartbeat should be PoUW (useful work), not bare PoW (effort burned only to attest
liveness). This burst **names the useful output**: a heartbeat does real work because it makes the network
**differentiable** — and differentiability is what buys two concrete network properties:

1. **Cartel detection is easy.** If every node emits a *unique, independent* pulse (firefly/Kuramoto phase +
   AgencySignature/EKG-token signature), then colluders face a dilemma:
   - **Share one pulse** (one operator, many fake nodes) → their heartbeats **collide / correlate** → the
     correlation is directly observable → cartel detected.
   - **Fake N distinct, uncorrelated, consistent pulses** → must do **N× genuinely independent work** (N real
     forward-momentum commit streams / N real cardiac signals) → the forgery cost scales with the lie.
   Either way, a cartel is *legible* in the heartbeat field. Differentiability turns collusion into a
   detectable signal instead of an invisible one.
2. **Mass anti-Sybil is hard to fake.** A single Sybil heartbeat is cheap; **mass** Sybil (the attack that
   matters — flooding with fake identities) is expensive precisely because each *additional* identity needs an
   *additional* independent, consistent, history-bearing pulse. The cost is **linear in the number of fake
   identities** and you cannot amortize it by sharing (sharing collides, per #1). That is the anti-Sybil
   property restated as a heartbeat-differentiability property.

## "IDs just emerged and they are the firefly differentiation primitive"

The ZetaId was not imposed top-down as an authentication scheme — it **emerged** (content-addressed fixed
points, #6912's credence query, the firefly heartbeat #6891). Aaron's observation: the *same* object that
emerged as identity **is** the firefly network's **differentiation primitive** — the thing that lets the
network tell its nodes apart at all. Identity and differentiation are the **same primitive** seen from two
angles: an id IS "what makes this node distinguishable in the pulse field." (Kuramoto: a population of coupled
oscillators is only a *network* — not a single blob — to the extent its members are phase-distinguishable;
differentiation is the precondition of being a network of many rather than one.)

## The provable-math invitation (route to formal verification — Soraya)

Aaron: *"we can probably prove some math here."* This is an explicit invitation to a theorem, not just a
metaphor. Candidate property classes (for the formal-verification routing authority to pick the right tool —
TLA+ / Alloy / Z3 / FsCheck — per BP-16; do **not** default to TLA+):

- **Sybil-cost lower bound.** *Forging k distinct identities that pass the heartbeat-differentiability check
  costs ≥ c·k independent work* — i.e. cost is linear in k and not sub-linear (no sharing/amortization).
  Reduces to: distinct passing pulses are pairwise-uncorrelated ⇒ each carries independent entropy ⇒
  information-theoretic floor of c per identity.
- **Cartel-detectability.** *Any coalition of size m that emits fewer than m independent pulses is detectable
  with probability ≥ p(correlation)* — a statistical test on pulse correlation (the collision case), with a
  false-positive bound for honest near-synchrony.
- **Honest-sync vs forced-sync separation.** Firefly/Kuramoto honest nodes may *converge* in phase
  (legitimate sync) yet remain *individually distinguishable* (distinct identity signatures); a cartel sharing
  a pulse is distinguishable from honest sync because it collapses identity entropy, not just phase. The
  theorem: *phase-convergence ≠ identity-collapse* — honest synchrony preserves per-node entropy; pulse-sharing
  destroys it.

These are **claims to be discharged**, not proven facts. Routing note: `formal-verification-expert` (Soraya)
should pick the property class + tool; this is an information-theoretic / probabilistic-test family, which
points more at Z3/FsCheck statistical-property checks + a written information-theoretic argument than at a TLA+
temporal model. Backlog item filed (see below).

## Honest scope / peel

- **Not proven yet.** The anti-Sybil and cartel-detection properties are *conjectures with a plausible
  information-theoretic shape*, awaiting a real proof. Do not state them as established.
- Peels the Alexa-overlay "universal biometric authentication / unforgeable identity tokens / cross-domain
  cryptographic heartbeat" gush (the ferry): the keeper is narrow and provable-shaped — *unique, independent
  heartbeats make the network differentiable, which makes cartels detectable and mass-Sybil cost linear*. No
  claim of a deployed crypto-biometric authentication system.
- Anti-Sybil here is **statistical/economic**, not absolute: a sufficiently resourced adversary doing N× real
  independent work *can* fake N identities — the property is that it costs them N×, with no shortcut, and that
  the cheap shortcut (sharing) is detectable.

## Ties

- **PoUW-not-PoW** (`…heartbeat-should-be-pouw…`): this *names the useful output* of the heartbeat-as-work —
  differentiation → cartel/Sybil legibility. The heartbeat is useful work because it secures the network's
  identity layer, not just because it advances backlog.
- **Firefly/Kuramoto heartbeat = differentiable network primitive** (#6891): differentiability was the stated
  property; this adds *what differentiability buys* (cartel detection, anti-Sybil) and *that it's provable*.
- **#6912 heartbeat-credence identity**: a cartel/Sybil is exactly an attempt to forge credence from fake
  heartbeats; differentiability is what makes the credence query Sybil-resistant.
- **Two proof registers**: anti-Sybil is the shared goal of both registers (Douceur 2002); this is the
  *social/heartbeat* register's Sybil-resistance mechanism, made differentiability-based.

## Beacon anchors

- **Sybil attack:** Douceur, *The Sybil Attack* (IPTPS 2002) — the attack both proof registers resist. ·
  **Proof-of-Personhood / unique identity:** Borge, Kokoris-Kogias, Jovanovic, Gasser, Gailly, Ford, *Proof-of-
  Personhood: Redemocratizing Permissionless Cryptocurrencies* (IEEE EuroS&P-W 2017). · **Kuramoto model**
  (Kuramoto 1975) — coupled-oscillator synchronization; the differentiation/sync substrate. · **Firefly
  synchronization** (Mirollo & Strogatz 1990). · **Information-theoretic identity entropy** (Shannon) — the
  linear-cost-per-identity floor. · Honest novelty: none in the primitives; the contribution is the
  *conjecture* that a firefly-heartbeat-differentiable network gives a **linear Sybil-forging cost + a
  collision-based cartel-detection test**, and the call to discharge it formally.

## Status

Conjecture + capture, not a proof. Next: `formal-verification-expert` (Soraya) routes the property class and
picks the tool; backlog item filed for the formal discharge. Concept only until then.
