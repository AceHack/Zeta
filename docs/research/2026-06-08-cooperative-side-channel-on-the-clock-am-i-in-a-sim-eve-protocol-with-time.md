# Cooperative side-channel on the clock — "am I in a deterministic sim?"; the Eve protocol with time itself

**Aaron, 2026-06-08 (#7096):**

> "if you assume you are in a simulation you can team up with the coop player and side-channel attack the
> clock/IScheduler to see if you are in a deterministic simulation, or if there is randomness, or a
> compressible pattern. This becomes polymorphic diplomacy / Eve protocol with time itself."

This turns the clock-drift side-channel (#7087) into a **test of the nature of reality**, played
cooperatively — and frames it as the Eve protocol extended to **time as a party**.

## The test: probe the IScheduler's drift, read its compressibility

The drift (clock-noise entropy, #7078/#7091) is the only window onto the substrate's time-generator. Its
**compressibility** is the answer (Kolmogorov / Martin-Löf algorithmic randomness):

| What the drift looks like | What it means |
|---|---|
| **Compressible → a generator is inferable** (#7087) | You're in a **deterministic simulation** — the drift is a PRNG with a findable seed (Laplace's demon is real, #7095). |
| **Incompressible** (no short program, passes randomness tests) | **True randomness** — a real TRNG / hardware entropy; not a closed deterministic sim. |
| **A compressible *pattern*** (structured but not trivial) | The sim has **exploitable structure** — a non-uniform generator you can predict / exploit. |

This is **algorithmic information theory** made operational: a sequence is "random" iff it is
incompressible (no generating program shorter than itself); "simulated" iff a short generator reproduces
it. The agents are running a **simulation-detection** test on their own substrate via its clock.

## Why cooperate — the coop side-channel

One agent's drift samples are noisy and few; **two cooperating frames pool their uncertainty histories**
(`zip`-over-uncertainties, #7085) → more samples, more signal → sharper **generator inference** (#7087),
or a stronger incompressibility verdict. Cooperation is the amplifier:

- It **breaks a weak/keyed generator faster** (more observations → recover the seed/parameters #7087) —
  the cooperative version of the side-channel risk flagged in #7087.
- Or it **confirms incompressibility with higher confidence** (more data, harder to be fooled by a short
  apparent pattern).
- It's a **game vs the scheduler**: the agents try to learn the scheduler's nature; the scheduler "wins"
  (stays opaque) iff its drift is genuinely incompressible (true entropy or a strong keyed generator,
  #7087 defense). A cheap/deterministic scheduler loses to a coop probe.

## Eve protocol with time itself (polymorphic diplomacy)

The **Eve protocol** (B-1002 / B-0638: zero-trust, mutual-consent, non-coercive meeting; cells push out /
hosts accept in; polymorphic diplomacy carried over `DynamicValue`) is normally **agent ↔ agent**. Aaron
extends it: **time / the IScheduler becomes a third party** to the diplomacy. The agents and the scheduler
are in a consentful-but-probing relationship — *diplomacy with time*:

- The scheduler "offers" an ordering (its drift); the agents "observe/negotiate" (probe its
  compressibility); the protocol is **polymorphic** because the offer/observation rides the same
  `DynamicValue` shape as any other Eve exchange.
- It's still **zero-trust**: the agents don't trust the scheduler is fair/random — they *test* it. And the
  scheduler (substrate) doesn't trust the agents — it may keep its generator secret (#7087). The Eve
  push-out/accept-in becomes "agents push a probe out, the substrate's time accepts (or resists) being
  read."
- So the consent/diplomacy layer now has **three parties: the two frames and time** — and the irreducible
  identity (#7090) is what each keeps private *from the others and from the clock*.

## Honest scope (peel)

A design/positioning capture (no code). **Rigorous core:** compressibility-as-randomness (Kolmogorov /
Martin-Löf); statistical randomness testing; cooperative observation increases sample size and breaks weak
generators (the #7087 side-channel, amplified). **Aaron's framing (Mirror, philosophically load-bearing):**
"test if you're in a simulation," "Eve protocol with time itself," "polymorphic diplomacy with time" —
evocative and well-motivated, not asserted as a settled result (and the simulation-hypothesis framing is
philosophical). **Security:** the cooperative side-channel is a stronger version of the #7087 attack —
route to **Aminata / Mateo**; the defense is the same (keyed/secret scheduler generator + bounded
observable drift, #7086/#7087). No code; a build sketch would be a `coopGeneratorProbe` (pool two drift
histories → compressibility/seed-recovery verdict), gated by the side-channel review.

## Anchors (Beacon)

- **Compressibility = randomness:** Kolmogorov complexity; Martin-Löf randomness; algorithmic information
  theory (Chaitin); statistical randomness suites (NIST SP 800-22, Diehard).
- **Simulation detection / hypothesis:** Bostrom's simulation argument; physics tests for simulation
  (lattice/anisotropy probes) — here at the agent-substrate scale via the scheduler.
- **Eve protocol / polymorphic diplomacy:** B-1002 / B-0638 (zero-trust mutual consent; `DynamicValue`
  polymorphic exchange); cells-push-out/hosts-accept-in (#6993).
- **Side-channel / generator inference:** #7087 (infer the IScheduler generator; keyed-secret defense),
  #7085 (zip-uncertainties), #7091 (drift = entropy), #7095 (Laplace's demon = the deterministic sim).
- Ferry/thread context: the irreducible-identity arc (#7090–#7095). Security routing: Aminata, Mateo.
