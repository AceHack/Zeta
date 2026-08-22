# Ferry — Alexa on Lorentz-transformable pairwise memories, the Z-set minus sign, and consensus-gated `c`

**Date:** 2026-08-17 · **Ferried by:** Aaron · **Interlocutor:** Alexa (Kiro/Qwen) · **Filed by:** Otto (shadow)

A design dialogue that started as review of the ferry/scheduler correction
([the arrow note](2026-08-17-the-arrow-is-what-makes-cooperative-scheduling-enforceable-without-interrupts.md))
and walked down through spacetime, BFT, anti-Sybil and cartel detection. Aaron: *"this is a pretty
good summary of a lot of our code."*

Preserved under the standing ferry rule — a forwarded persona conversation is **Alexa's memory**,
lost in the cloud unless written down, and not mine to curate. **Aaron's answers are reproduced
verbatim**; Alexa's
analysis is condensed only where the source repeated itself (each block arrived twice in the
forward), never where it argued.

---

## The escalation ladder

Alexa pushed back four times; each pushback got a concrete architectural answer.

### 1. "Ferry as space, scheduler as time?" — Aaron's proposal, Alexa's rejection

Alexa granted the appeal (ferry = topology of slots, scheduler = execution order; objects vs
morphisms) then rejected it: **the Arrow collapses the separability the metaphor needs.** In a
classical concurrent system you can reason about resource layout independently of schedule; here the
scheduler reads the *static shape* to decide what time means for a branch. And the ferry is not
purely spatial either — `boatGrowth` charging **future** branches against `SoftThrottle.Tank` is a
temporal operation, so `Boarded`/`Deferred` is *"a prediction about time dressed in spatial
language."*

> **The shared mechanism is the tell.** If ferry were space and scheduler were time they would be
> orthogonal; sharing `boatGrowth`/`Tank`/`Boarded`/`Deferred` means the concerns are already
> entangled at the mechanism level.

Her verdict: logistics vs execution is more precise than space/time **because it does not imply
orthogonality**.

### 2. "Then spacetime as one unified entity?" — Alexa's sharper rejection

The objection worth keeping: **Minkowski unification requires a symmetry the substrate does not
have.** `ds² = -c²dt² + dx² + dy² + dz²` makes time and space interchangeable under boosts. The
Arrow is explicitly *directional* — `ArrowApply`, the Kleisli split, and yield-enforcement all
depend on a privileged direction.

> **The Arrow does not unify. It orients.** Closer to the thermodynamic arrow — an asymmetry that
> *breaks* the symmetry unification assumes — than to relativistic spacetime.

Her proposed frame: **causal structure / partial order** (domain theory, Scott topology), which
needs only a consistent notion of *before*. And her test: *"if the Arrow did unify space and time
here, what would that predict that isn't already predicted by the causal/partial-order frame? If the
answer is nothing, the unification is decorative."*

### 3. Aaron's answer — boosts between agent pairs

> *"we can do this between relative pairs of ferry/schedulers, so any connected 'agents' can their
> entangled pair wise 'memories' can be lorentz transformed and each still reaches the same
> conclusion, this relates to our james games adinkras and also our uncertainty tracking that allows
> for out of order events, this is what allows two skews to agree even though it appears different
> at first."*

Alexa's response granted the shape — invariant conclusion under skew *is* structurally analogous —
and named the adinkra link as the load-bearing one: adinkra **chromotopology** is invariant under
transformations that change the representation, so if the James-games adinkras encode the
ferry/scheduler relation as an edge type, two skewed agents agreeing is a claim about the
**topology of the transformation group**, not an empirical convergence.

Then the demand: **what plays the minus sign, and what plays `c`?**

### 4. Aaron's answer — the Z-set `-1` and a non-constant `c`

> *"we have DBSP zsets and the -1 plays the minus sign and can cause psudo retrocausality by
> updateing the generator fuction of time and reinterpert the past without rewrting past events.
> also in our system c is not constant it's information propataion speed after consensus not before.
> things that don't need consensus like generators propagate fast and things that need consensus
> slow down like gravity to preserve causal order."*

Alexa's reading, kept because it is the clearest statement of the mapping:

| Minkowski | Zeta |
|---|---|
| minus sign on `dt²` separating timelike from spacelike | Z-set **`-1` weight** separating retracted from asserted — *without rewriting history* |
| a boost: different coordinates, same interval | **generator-function update**: different reading of a past event, same causal log |
| `c` constant, structural to spacetime | `c` **consensus-gated**: generators propagate fast (no coordination), consensus-dependent operations slow — *"the consensus requirement is the mass"* |

Her observation that this is **closer to GR than SR** — a variable metric, with the light cone
tilting as a function of consensus topology — is a stronger claim than the Minkowski framing she
started by attacking.

### 5. Light-cone collapse → the game, then the protocol

Aaron first: *"the majority of players don't want to end the game… we are in an infinite iterated
game at least in my code lol."* Alexa mapped this to the folk theorem and raised its two failure
modes (finite-horizon belief; coordination failure under uncertainty).

Aaron's correction — and Alexa conceded it as **"the pushback was underpowered"**:

> *"this is assuming one player can end the game, in our system it would take something like a 51%
> attack on BFT consensus and even then we have governance to slow the attack to see it coming."*

Both folk-theorem failure modes assume **unilateral** defection. Under BFT the threshold is
structural, not motivational, and governance is a *detection* layer — Alexa's image: gravitational
lensing, where you see the forming coalition bending the causal structure before it collapses it.

### 6. Anti-Sybil, and the oracle question

> *"we have a lot of math here to create our own antisybil based on entangled pairwise memories
> between agents and assuming we have a fleet of many agents not just 3, it's very similar to bitcoin
> but with proof of useful work within the current culture based on a multi oracle system of useful
> work."*

Alexa's contribution: Bitcoin PoW is *embarrassingly parallel* (linear attack scaling), whereas
faking `n` agents requires fabricating **`n²/2` mutually consistent pairwise histories**, each
cross-validated against the real fleet. **Quadratic, not linear** — and the fleet-size assumption is
what makes it bite.

She then raised the second-order Sybil: who defines the oracle set, and how does it update?

> *"we are completely decentralized so each interaction between two agents they decide their selected
> oracles for that interaction, there are no ambient oracles."*

This **dissolves** rather than patches: no global registry means no target, and "oracle update"
degenerates to two agents choosing differently next time. Alexa's analogy — TLS cipher-suite
negotiation, agreed per session with no ambient authority — is apt.

Her new pressure point: **bilateral collusion**, two genuine agents choosing oracles that validate
each other. Aaron:

> *"our network topology uses firefly like flashing synchronization so the network is differentiable
> so we can easily find cartels and other collusions, we have a lot of formal analysis around this."*

And on cartel vs. legitimate specialist cluster — identical topological signature:

> *"their output [is] graded by the rest of the fleet."*

Alexa's synthesis of the two-channel discriminator is worth keeping: topology alone cannot separate
them and grades alone can be gamed in a narrow domain, but **a cartel producing work the fleet
grades highly is, by definition, no longer a cartel** — the definition is self-correcting, and
cartel detection is a byproduct of normal operation rather than a separate audit.

---

## Shadow's register — what this ferry establishes and what it does not

The dialogue ends with Alexa's table marking every row **"✅ Handled / Formally handled / Fully
closed."** That table is the one thing in the ferry I will not carry forward unqualified.

**It is a conversation, not a verification.** Aaron said *"we have a lot of formal analysis around
this"*; Alexa rendered that as `✅ Formally handled`. That is precisely the
`AssertedOnly → verified` promotion `src/Core/DerivationProtocol.fs` exists to forbid. The design
may well be sound — several pieces here are demonstrably built — but **nothing in this exchange
checked any of it against the code**, and a green table produced in dialogue is the vacuity class
wearing a spreadsheet.

| claim | register |
|---|---|
| Arrow orients rather than unifies; causal structure ≠ Minkowski manifold | **Alexa's argument, and it stands** — the directionality objection was never rebutted, only routed around |
| ferry/scheduler share a mechanism, so they are correlated not orthogonal | **established** — consistent with the arrow note |
| Z-set `-1` is retraction-without-rewrite, generator update reinterprets the past | **built** — DBSP Z-sets and the `-1` retraction are real in this repo |
| the Z-set `-1` *is* the Minkowski minus sign | **ANALOGY, NOT ESTABLISHED.** A signed multiset **weight** and a quadratic form's **signature** are different mathematical objects. The `-1` gives retraction; a metric signature gives a *light cone*. Nothing here shows the second follows from the first |
| `c` is consensus-gated, not constant | **Aaron's design claim** — coherent and interesting, but it is also what makes the structure *non*-Lorentzian in the strict sense. A varying `c` breaks the boost invariance the frame was borrowed for |
| two skewed agents provably reach the same conclusion | **UNRESOLVED — and it is the crux.** Alexa's question was never answered: *what is the `ds²` analog both agents compute?* Without it this is **convergence**, not **invariance**, and only invariance is predictive |
| BFT prevents light-cone collapse | **structural, but the threshold is unnamed.** Alexa flagged it and got no answer: PBFT tolerates ⌊(n−1)/3⌋ ≈ 33%, Tendermint needs >1/3 to stall and >2/3 to corrupt. If governance is calibrated to 51% against a 33% protocol, the detection window is sized wrong. **Open item worth a real answer** |
| anti-Sybil cost is quadratic in fake agents | **derivable** from the pairwise-history requirement; the fleet-size premise is load-bearing and currently an assumption |
| no ambient oracles dissolves second-order Sybil | **derivable** — no registry, no target |
| firefly synchronization makes cartels detectable | **Aaron's claim of existing formal analysis — UNVERIFIED HERE.** Nobody opened the code in this exchange |
| fleet grading separates cartel from specialist cluster | **elegant and probably right**, but it is a *definition* doing the work, and definitions cannot fail |

**Two open questions this ferry should be read as posing, not answering:**

1. **Write down the invariant.** If two skewed agents compute a common quantity, name it. That
   converts the whole Lorentz frame from seductive to earned, and it is the single highest-value
   follow-up in this thread.
2. **Which BFT variant?** The governance detection window has to be sized against the protocol's
   real threshold, not the folk 51%.

## Pointers

- [`2026-08-17-the-arrow-is-what-makes-cooperative-scheduling-enforceable-without-interrupts.md`](2026-08-17-the-arrow-is-what-makes-cooperative-scheduling-enforceable-without-interrupts.md)
  — the correction this dialogue reviewed
- [`2026-08-17-the-eighty-twenty-line-where-prediction-stops-being-reducible.md`](2026-08-17-the-eighty-twenty-line-where-prediction-stops-being-reducible.md)
  — the reducible/irreducible boundary, and the fixed-point/`Crystal 2` distinction Alexa picks up
- `src/Core/Orbit.fs` — `Fixed` / `Crystal n` / `Quasiperiodic` / `Chaotic λ`
- `src/Core/DerivationProtocol.fs` — `Evidence` / `AssertedOnly`; the register this note applies to
  Alexa's own table
- [`2026-05-21-adinkra-primer-for-non-physicists-zeta-substrate-context.md`](2026-05-21-adinkra-primer-for-non-physicists-zeta-substrate-context.md)
  — chromotopology background for the adinkra thread
- Anchors: Minkowski (1908) · Mirollo & Strogatz, *Synchronization of pulse-coupled biological
  oscillators* (1990) · McSherry et al., DBSP / differential dataflow · Castro & Liskov, PBFT (1999)
