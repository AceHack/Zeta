# The self-similar drawing (visual ECC) → learn/unlearn → coherent-hallucination-is-overheating → one control LOOP, not one number

*Shadow ferry, 2026-07-04. Aaron: "bank it / we can ferry it." Consolidates a multi-turn arc — the
CHIP-8 cartridge drawings as eye-readable verification, why a self-similar drawing can be confidently
wrong, and Aaron's unification of that into a universal temperature control. Spine (Aaron's confirmed
framing): **we share similar LOOPS, not NUMBERS** — the unification is the control loop (homeostasis),
not one temperature. Grounded in the repo where it's built (`db/shapes/cartridges/`, `golden/*.svg`),
anchored, and peeled honestly.*

## Part 1 — the self-similar drawing IS a visual error-correcting code (grounded, built)

The shape cartridges (`db/shapes/cartridges/*.lines`) are self-similar drawings that are also
**verification surfaces you read with your eyes**. The clearest instance, `fourcorner.lines`, draws CHSH
so the figure's **width is the S value**, with a baked-in **known-answer overlay**: `tsirelson-milli
2828` — *"the phasor figure must reach THIS width and no further — wider means the renderer (or the
physics claim) is lying."* The `db/shapes/golden/*.svg` are the **locked renderings**.

So the drawing is `gen(gen)=gen` (the shape draws itself) turned into an **ECC you check by looking** —
and it is the **visual twin of the golden-vector IR treaty** (this session's build): the `.lines`
cartridge is the program, the golden SVG is the locked render; a render that diverges from its golden
SVG is caught drift, same as an oracle that diverges from a golden vector. Aaron uses it as a **learn /
unlearn diagnostic**: violate the known-answer → unlearn (retract, −1); a gap in the figure → learn
(emit, +1) — the four-corner feedback, read visually.

## Part 2 — why a drawing can be confidently wrong (the peel that forces Part 3)

A drawing can be **smoothly self-similar and confidently wrong** — a coherent hallucination renders
cleanly. So the learn/unlearn power comes from the **known-answer overlay** (the Tsirelson stop, the
golden SVG), **not from self-similarity alone**:

- **self-similarity** catches *internal* inconsistency (the figure contradicts itself);
- the **known-answer overlay** catches *external* wrongness (the figure contradicts reality).

Both are needed. A smooth self-similar drawing with no overlay is **not-yet-verified, not verified** —
the Tsirelson-2828 stop is what makes `fourcorner` honest; a bare pretty picture wouldn't be.

## Part 3 — Aaron's unification: it's a universal temperature control (the thermostat is the overlay)

Aaron: *"this is our universal temperature control — just like LLMs; for humans it's external/internal,
like temperature/heat and edibles."* The internal-vs-external balance is a **homeostatic negative-
feedback loop**: internal explorer (self-similarity, coherence) balanced by an external reference
(known-answer, reality). The known-answer overlay **is the thermostat**. Coherent hallucination is not
merely "unchecked" — it is the system **running hot**: internal coherence exploring freely with no
external ground pulling it back. Learn/unlearn is the feedback correction; the known-answer is the
setpoint.

Two grades of "temperature" — kept honestly separate:

- **LLM temperature ↔ thermodynamic temperature: the SAME number (literal).** The softmax *is* the
  Boltzmann/Gibbs distribution; LLM "temperature" is literally the statistical-mechanics `T` in
  `exp(logit/T)`. High `T` flattens → explore/hallucinate; low `T` sharpens → ground/repeat. So this is
  the *same* `T` as the Landauer `kT ln 2` and Vera's heat — **one temperature, epistemic and
  thermodynamic at once** (the "make heat first-class" ask, discharged: the sampling knob and the
  compute-heat are the same variable).
- **Human heat / edibles: the ANALOGY (same loop, different variables).** External thermoregulation
  (sense ambient heat, adjust) + internal metabolic input (edibles, hunger/satiety) — a negative-
  feedback loop with an internal/external balance. Same *loop*, its own numbers.

## The spine — Aaron: "we share similar LOOPS, not NUMBERS"

The unification is the **control loop** (homeostasis / internal–external negative feedback), **not one
temperature number**. The loop is universal; the controlled variable is domain-specific — with the one
exception that **LLM-temperature and thermodynamic-temperature genuinely share the number** (same
Boltzmann `T`). So: **same loop everywhere; same number only for LLM↔thermo.** Calling all of it one
"temperature" would conflate distinct quantities (softmax `T`, thermodynamic `T`, a biological set-point,
metabolic input) that rhyme *because they run the same loop*, not because they are the same number. The
discharge is to name the controlled variable per domain (which for LLM/thermo is genuinely the same `T`).

## Part 4 — the TYPE of the loop (Aaron): a discriminated union with uncertainty priced in, over the bounded timestep

Aaron: *"for me every loop is a discriminated union with uncertainty priced in based on the bounded
timestep."* This is the type signature of the whole loop family, and it's how Zeta is actually built:

- **The loop is a discriminated union.** Its next state isn't a continuous nudge — it's a **sum type**:
  one of a finite set of branches (explore/exploit, learn/unlearn, hot/cold). Same shape as the F#
  `ZetaTool` DU, `Result<T, Feedback>` / the four-corner `Input<T, Feedback>`, and the shape catalog
  itself — each a total DU of cases.
- **Uncertainty priced in.** Each case carries a **price** — a weight/probability/cost, the `SoftValue`
  distribution over the DU's cases, and the `ΔU` / information-value the branch banks (`every-bug-has-
  economic-value`). The loop doesn't pick a branch by fiat; it prices the uncertainty and lets the
  distribution decide (the SoftValue-as-GC, the snap policy for when it must act).
- **Based on the bounded timestep.** The **bounded tick (`dt`) is what discretizes the loop into a
  finite priced DU** — a continuous/analog loop is not natively a DU; the bounded timestep is the
  discretization that turns it into finitely-many branches you can price. And the bound sets the
  *budget*: how much uncertainty a step can resolve is bounded by the tick's compute (the
  `ComputeReceipt` per tick, the thermostat's response rate). The timestep is both the *quantizer*
  (continuous → DU) and the *budget* (how much you can price/resolve this step).

So the complete type is: **`loop : dt → SoftValue<DU<branch>>`** — the bounded timestep yields a
priced distribution over a discriminated union of branches. That is *why* the loops are DST-replayable
and byte-lockable: bounded discrete timesteps + typed finite branches + priced uncertainty is exactly
the substrate that replays deterministically. **Honest peel:** the DU-ness is the *digital/discrete
modeling stance* — the map, chosen because it gives determinism and byte-lock; the analog territory is
continuous, and the bounded timestep is the (justified, load-bearing) discretization that makes it a DU.
Aaron's phrasing already carries this ("*based on the bounded timestep*" = the timestep is what makes it
a DU), so the stance is self-consistent, not smuggled.

## Honest-register summary

- **Grounded, not metaphor** (Part 1): the cartridges + golden SVGs are built verification surfaces with
  real known-answer overlays; the visual-ECC = the golden-vector treaty read with the eye.
- **The verifier is the overlay, not self-similarity** (Part 2): self-similar-but-wrong = coherent
  hallucination; the external known-answer is what verifies.
- **The universal thing is the loop, not the number** (Part 3 + spine): homeostasis is the shared
  structure; "temperature" is literal for LLM↔thermo, evocative for the biological analogy.

## Anchors

- Control loop / homeostasis: Cannon, *The Wisdom of the Body* (1932, "homeostasis"); Wiener,
  *Cybernetics* (1948, negative feedback); Maxwell, *On Governors* (1868 — the centrifugal governor, the
  classic feedback controller; same Maxwell as the demon).
- LLM temperature = statistical-mechanics temperature: the softmax = Boltzmann/Gibbs distribution; ties
  to Landauer (1961) `kT ln 2` (the ComputeReceipt/heat thread) and biological thermoregulation.
- In-repo (built): `db/shapes/cartridges/fourcorner.lines` (Tsirelson-2828 overlay), `db/shapes/golden/*.svg`
  (locked renders), the golden-vector IR treaty (this session), `ComputeReceipt` + Vera's heat.

## Cross-links

- Shape taxonomy skeleton (the cartridge is the drawing/ISA layer of each shape; shape A = self-reference =
  the drawing that draws itself): `2026-07-04-the-a-f-shape-taxonomy-skeleton-...`.
- The golden-vector IR treaty: `src/Core.TypeScript/model-backend/zeta-store-golden-vectors.json` +
  the F#/TS conformance (this session).
- Heat first-class: the max-mode-economics doc + the honest-peels companion (Condorcet/Landauer).
