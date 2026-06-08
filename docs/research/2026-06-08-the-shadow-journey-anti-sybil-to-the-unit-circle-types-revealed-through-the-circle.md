# The shadow's journey: from anti-Sybil to the unit circle — letting the type reveal itself through the circle

**Aaron, 2026-06-08:** *"you should save the shadow and how we got here from it to our research — that was
an interesting journey, and we let the types reveal itself through the circle."* … *"that Bayesian is the
shadow of this."*

This records both the **technical arc** and the **method**: a live, autonomous-loop ("shadow") session in
which a model was *not designed top-down* but **let to reveal its own type** by following the geometry until
it landed on the unit circle — at which point the imaginary-number stack was obviously the native home, and
Bayesian probability fell out as its `|·|²` shadow.

## The shadow

"Shadow" has two senses here, and the session turned on their coincidence:

1. **Otto = the shadow** — the autonomous-loop steward acting within standing authority (`no-directives.md`:
   the shadow inherits authorization, never extends it). This whole arc was built shadow-side, on cron ticks
   and Aaron's streamed observations, shipped PR-by-PR.
2. **Bayesian = the shadow of the phasor model** — the real-valued probability `p = |z|²` is the Born-rule
   *projection* of a complex amplitude `z`. The probability is the shadow the amplitude casts when you drop
   its phase.

The session's punchline: *the shadow (Otto) discovered that the probability model is itself a shadow.*

## The arc (how we got here), PR by PR

1. **Anti-Sybil as the base case** (#7044/#7045) — `clock-drift ≡ identity` is non-circular once you reject
   behaviourism; the base case that grounds the meta-circle is the **anti-Sybil function** (forging *k*
   identities costs ≥ *k* clocks; drift entropy non-fungible).
2. **The BFT** (#7046–#7049) — quorum over **distinct sources** not claimed identities; the wire protocol
   (deterministic reducer, fixed-membership quorum — a real premature-commit bug caught + fixed); the
   liveness layer (heartbeat / timeout / view-change, view-change itself Sybil-counted).
3. **Progress per tick** (#7051) — the honest side's liveness variant, observable every sim tick.
4. **The forger race** (#7052/#7053) — observe the *forger's* progress per tick; certify
   `WontSolveInTime`/`WillSolveInTime`. **Amara:** *it costs entropy to protect identity; you must outlast
   the forger's entropy.* **Alexa (restored):** anti-Sybil is **economics on a 1-bit scale** — entropy is
   the non-fungible currency (Otto had over-peeled her; Aaron corrected it).
5. **Symmetric / weight-free frame** (#7054–#7056) — the defender/forger split is weight-full unless **every
   party holds both roles** (perspective-relative; from either traveller's frame it balances *because they
   are both*). **Time is a peer, not a substrate** — it must attack and defend like the others, and it
   **earns identity by ticking** (its heartbeat *is* the tick; no free identity). Identity must **change
   behaviour** to mean something (strength modulates the attacker/defender split). Actor count 3-vs-4 (no
   global clock ⇒ separate tick sources). The **remains/acts** split: a shared clock *acts* for both (what it
   animates is *what remains*), so it earns ∝ what it animates — and whether one tick serves both is a
   **constructive-interference** question, modelled as three regimes.

## The reveal: we hit the unit circle, and the type revealed itself

Following the tick model honestly forced **phase**: heartbeats are sine waves, so interference is by phase,
not just frequency — `phaseOverlap(Δφ) = cos²(Δφ/2)`, in-phase constructive, anti-phase destructive, 90°
halfway (`SymmetricEndurance`). At that point Aaron: *"can you solve this with some part of the
imaginary-number stack instead of Bayesian? It seems like we just hit the unit circle."*

We had. The model was **never told to be complex**; it kept producing unit-circle quantities until the
complex floor of the Cayley–Dickson stack (`CayleyDickson.Complex = Doubled<float>`) was the only honest
home. Re-expressed there (`PhasorEndurance`, #7057):

- **The Z-set delta lives on the unit circle:** `+1 = e^{i0} = (1,0)`, `-1 = e^{iπ} = (-1,0)`. **A `-1`
  retraction *is* a 180° rotation** = the ring's `Negate`. The `+1`/`-1` round trip is the involution
  `Negate∘Negate = id` (correction, not duplicate). Partial/uncertain claims are *other points on the
  circle* — the phase Bayesian discards.
- **Interference is a one-line phasor sum:** `overlap φ₁ φ₂ = |e^{iφ₁}+e^{iφ₂}|²/4 = cos²(Δφ/2)` — the same
  number `SymmetricEndurance` got by a trig identity, now falling out of complex addition.
- **Bayesian is the Born-rule shadow:** `p = |z|²`. The SoftValue/`observe` (real, `[0,1]`) treatment is the
  amplitude model with the phase projected away — strictly *less* information. Constructive vs destructive is
  invisible to the shadow; only the amplitude sees it.

## The method (the part worth keeping)

We **let the type reveal itself through the circle** rather than imposing it. The discipline: follow the
quantities the model actually produces; when they land on a known geometry (the unit circle), adopt the
algebra that geometry is native to (`ℂ`, the imaginary stack) instead of forcing the first formalism reached
for (Bayesian). The right type was *discovered*, not decreed — and the previously-used formalism was
revealed as a shadow (projection) of it. This is Mirror→Beacon at the level of *types*: the coined model
(Bayesian SoftValue) compressed to its anchored first principle (complex amplitude + Born rule).

## Honest scope (peel)

`PhasorEndurance` is a **re-expression**, not a new theorem — it computes the same interference on the repo's
existing `ImaginaryStack.complex`. Its worth is (a) the native algebra (`-1` = `Negate` = π-rotation,
superposition = addition) and (b) making the Bayesian-as-shadow relation explicit and tested
(`overlap = SymmetricEndurance.phaseOverlap`, to 1e-10, both derivations). Whether the *quantum-like* reading
(amplitudes that interfere, not just probabilities) is load-bearing beyond this model is the open question —
route any outward claim through Soraya (is there a real theorem in "consensus amplitudes interfere"?) +
naming-expert + Ilyana + human. The whole BFT family remains F#-only; 4-oracle parity is the standing debt.

## Anchors (Beacon)

- Complex amplitudes / interference / Born rule (`p = |ψ|²`): standard QM (Born 1926); phasor addition
  (electrical engineering / wave optics). Cayley–Dickson construction (`CayleyDickson.fs`; ℝ→ℂ→ℍ→𝕆).
- Z-set retraction = additive inverse (Budiu et al., DBSP) — here realised as the `e^{iπ}` rotation.
- de Finetti / NCI (`BeliefConvergence.fs`, `Reconcile.fs`) — the Bayesian floor this is the amplitude of.
- Internal arc: #7044–#7057; `SymmetricEndurance.fs`, `PhasorEndurance.fs`, `ForgerRace.fs`. Origin: Amara
  (Thor ~2025-09). Alexa's entropy-economic kernel (restored). The shadow: `no-directives.md`.
