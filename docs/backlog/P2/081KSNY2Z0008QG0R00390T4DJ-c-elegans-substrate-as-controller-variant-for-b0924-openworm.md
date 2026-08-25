---
id: 081KSNY2Z0008QG0R00390T4DJ
priority: P2
status: open
title: C. elegans-substrate as controller variant for 081KSNY2Z0008QG0R001HA43GG — OpenWorm 302-neuron full-connectome + generate+join over emulator-scene-AND-worm-scene under DST-omniscience (operator 2026-05-28)
effort: XL
ask: operator 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R001HA43GG
composes_with:
  - 081KSNY2Z0008QG0R002HB4AGT
  - 081KSKBP80008QG0R003NM9XEC
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KQTPYE0008QG0R002Y7X5KH
  - 081KS3X9Y0008QG0R00218150M
tags: [c-elegans, openworm, 302-neuron-connectome, controller-variant, custom-emulator, generate-plus-join, dst-omniscience, z-sets, bit-perfect-consensus, worm-plays-atari, embodied-sensorimotor, evolutionary-substrate-optimization, ai-coop-emulator, cooperative-substrate-target]
---

## Operator framing (2026-05-28)

> *"i bet it maps to and this dude could beat both of us at ti Caenorhabditis elegans"*

Followed by substrate-landing directive:

> *"file as 081KSNY2Z0008QG0R00390T4DJ (shadow*) mirror it too"*

And operator framing-extension:

> *"damn we gonna emulate a worm playing atari games thats fucking next level"*

Substrate-honest reading: substrate-engineering substrate-target composing [081KSNY2Z0008QG0R001HA43GG](081KSNY2Z0008QG0R001HA43GG-custom-2600-emulator-generate-join-over-emulator-scene-ischeduler-dst-bit-perfect-consensus-z-sets-arc3-agi-training-hardware-interrupts-b0917-aaron-2026-05-28.md) (custom 2600 emulator + generate+join + DST + z-sets) with the **C. elegans-substrate as controller variant** — a 302-neuron substrate with complete connectome map that fits the SAME tractability class as the 2600 hardware substrate.

## The substrate-rhyme — same tractability class

Both substrates are simultaneously *small-enough-to-fully-simulate* AND *purposeful-substrate-for-pattern-action-loops*:

| Substrate | State-space | Tractability for full-fidelity DST |
|---|---|---|
| **Atari 2600** (081KSNY2Z0008QG0R001HA43GG) | 256-byte RAM + 8 PIA registers + TIA registers + 6507 PC/SP | Tractable; full state-space enumerable from boot-seed |
| **C. elegans** (THIS row) | 302 neurons + ~7000 synapses + complete connectome (Cook et al. 2019; only animal with full connectome) | Tractable; substrate-fully-simulatable per OpenWorm (decade+ substrate-engineering toward bit-perfect simulation) |

The substrate-rhyme is structural: both fit the generate+join discipline at the SAME scope — brute-force the full state-space from seed under DST, z-set join multi-instance for bit-perfect-consensus, particle-locus traverses wavefunction without imitation-learning training.

## Why "could beat us at it" carries substantively

Per operator's substrate-honest claim:

- **Humans**: finite attention; can't simulate full state-space; limited to local-trajectory pattern-recognition
- **LLMs**: trained on game-trajectories (imitation-learning); don't do DST-omniscience; substrate-shift to generate+join is what 081KSNY2Z0008QG0R001HA43GG proposes
- **C. elegans-under-DST-omniscience**: 600M+ years of evolutionary substrate-engineering for embodied sensorimotor integration (foraging / avoidance / reproduction primitives map naturally to chase / avoid / collect game-substrate); 302-neuron substrate small enough that the framework can brute-force optimal-trajectory-through-game-state directly under generate+join; the worm's substrate IS PRE-OPTIMIZED for the pattern-recognition class game-playing demands at this scale

The substrate-engineering substrate-advantage: C. elegans's connectome is evolutionarily-optimized substrate-engineering for sensorimotor pattern-action loops. When run under DST-omniscience + plugged into the 2600's joystick-substrate, it could find optimal-trajectories no human + no current LLM can match — because:

1. **Evolution already did the substrate-engineering** (foraging-substrate ≈ resource-collection-substrate; threat-avoidance-substrate ≈ ghost-avoidance-substrate; chemotaxis-substrate ≈ goal-seeking-substrate)
2. **Substrate is small enough for brute-force** (302 neurons under DST exhaustively enumerable across game-state-space)
3. **No training-data dependency** (generate+join over worm-substrate × game-substrate via DST seed = pure first-principles substrate; no imitation-learning bottleneck)

## OpenWorm prior-art

[OpenWorm](https://openworm.org/) — open-source consortium (since 2011) building bit-perfect C. elegans simulation:

- **c302** — NeuroML-based neural network simulation of the connectome
- **Sibernetic** — fluid dynamics + biomechanical simulation of muscle + tissue
- **NEURON / NEST** — substrate-engineering substrate for biophysically-realistic neural simulation
- **Connectome data**: Cook et al. (Nature 2019) — complete adult-male-and-hermaphrodite connectome; 302 neurons + ~7000 chemical synapses + ~600 gap junctions

Substrate composition with 081KSNY2Z0008QG0R001HA43GG + 081KSNY2Z0008QG0R002HB4AGT:

| Worm-substrate component | 081KSNY2Z0008QG0R001HA43GG / framework composition |
|---|---|
| c302 NeuroML neural simulation | Wrapped under IScheduler DST per 081KSNY2Z0008QG0R002HB4AGT IntrCtx substrate; deterministic from seed |
| Connectome state at simulation-tick | Z-set representation per [`.claude/skills/algebra-owner/`](../../.claude/skills/algebra-owner/) substrate |
| Multiple instances under generate+join | Bit-perfect-consensus test per 081KS3X9Y0008QG0R00218150M multi-oracle BFT |
| Sensory-input substrate (light / touch / chemotaxis) | Mapped to 2600 visual-substrate via TIA frame-buffer + RIOT timer-substrate |
| Motor-output substrate (locomotion / pharyngeal pumping) | Mapped to 2600 joystick + button substrate via PIA register-substrate |

## Operational substrate-engineering substrate-target

Substrate-engineering substrate-target work; multi-PR; substrate-anchor for:

1. **OpenWorm c302 F# wrapper** under IScheduler DST (deterministic worm-substrate from seed; bit-perfect across instances)
2. **Sensory-motor mapping substrate** (2600 visual-substrate → C. elegans sensory-neurons; C. elegans motor-neurons → 2600 joystick-substrate)
3. **Z-set representation** of worm-state + game-state (joint substrate-space)
4. **Generate+Join scaffolding** over worm-scene-AND-emulator-scene (joint state-space traversal under DST seed)
5. **Bit-perfect-consensus test** (multiple worm-emulator instances under DST agree on joint state-evolution)
6. **ARC3-AGI training surface composition** (compose with [081KSKBP80008QG0R003NM9XEC](081KSKBP80008QG0R003NM9XEC-zeta-instantiation-of-arc-agi-3-style-benchmark-usb-boot-starting-state-devops-objectives-as-levels-not-hand-crafted-video-game-levels-aaron-2026-05-27.md) cluster substrate; worm + 2600 = controller substrate; cluster bootstrap = level substrate)
7. **Cooperative-emulator gaming substrate-target** (operator-Otto-worm three-player coop once USB cluster + GitHub accelerator ship)

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: C. elegans + OpenWorm + 302-neuron connectome + worm-plays-atari + controller-variant for 081KSNY2Z0008QG0R001HA43GG

Searched surfaces:

- `docs/backlog/`: no prior C. elegans / OpenWorm-named row; 081KSNY2Z0008QG0R001HA43GG (parent: custom 2600 emulator + generate+join); 081KSNY2Z0008QG0R002HB4AGT (interrupt substrate); 081KSKBP80008QG0R003NM9XEC (ARC-AGI-3-style benchmark); 081KSE6WT0008QG0R0015ZF2G6 (Zeta cluster ARC training); 081KQTPYE0008QG0R002Y7X5KH (tinygrad-uop-ir kernel layer emulator dispatch); 081KS3X9Y0008QG0R00218150M (multi-oracle BFT consensus)
- `.claude/rules/`: dst-plus-persist-plus-generator-time (PR #5841), pilot-wave-MWI (PR #5842), particle-as-locus (PR #5846), asymmetric-authorship + monad-propagation + OPLE-T-TFeedback + function-as-control-flow-generator
- `.claude/skills/`: algebra-owner (z-sets substrate)
- `memory/`: incidental "C. elegans" mentions; no named substrate
- `docs/research/`: incidental "connectome" mentions; no named substrate
- `references/prior-art/`: OpenWorm not yet mirrored (would compose with `tools/setup/common/sync-prior-art.ts` extension)

Conclusion: no existing row covers C. elegans-substrate-as-controller-variant; mint-new authorized per operator 2026-05-28 directive "file as 081KSNY2Z0008QG0R00390T4DJ (shadow*) mirror it too".

Authoring action: mint-new 081KSNY2Z0008QG0R00390T4DJ as sub-substrate-target of 081KSNY2Z0008QG0R001HA43GG (depends_on); composes with 081KSNY2Z0008QG0R002HB4AGT + 081KSKBP80008QG0R003NM9XEC + 081KSE6WT0008QG0R0015ZF2G6 + 081KQTPYE0008QG0R002Y7X5KH + 081KS3X9Y0008QG0R00218150M.

## Mirror at research-tier

Per operator's "mirror it too" directive: substrate-rhyme observation + OpenWorm prior-art inventory + composition map preserved as research note at:

[`docs/research/2026-05-28-c-elegans-substrate-rhyme-with-2600-emulator-same-tractability-class-openworm-prior-art-controller-variant-for-b0924-aaron-2026-05-28.md`](../../docs/research/2026-05-28-c-elegans-substrate-rhyme-with-2600-emulator-same-tractability-class-openworm-prior-art-controller-variant-for-b0924-aaron-2026-05-28.md)

The research note preserves the substrate-rhyme observation at mirror-tier (per `.claude/rules/substrate-or-it-didnt-happen.md` + `.claude/rules/razor-discipline.md` mirror-vs-beacon framing) — the operational claim (substrate-rhyme between worm + 2600 substrates at tractability scope) survives the razor; the "could beat us at it" framing is operator's substrate-honest prediction (preserved as prediction, not as ratified-claim).

## Acceptance criteria

- [ ] OpenWorm `references/prior-art/openworm/` mirror (compose with `tools/setup/common/sync-prior-art.ts`)
- [ ] c302 NeuroML loader stub (F#; loads connectome JSON; produces typed substrate)
- [ ] IScheduler DST wrapper around c302 substrate (deterministic worm-tick from seed)
- [ ] Sensory-input mapping substrate (2600 TIA frame-buffer → worm sensory-neuron-substrate; smallest-scope: 1 sensory neuron + 1 game-pixel)
- [ ] Motor-output mapping substrate (worm motor-neuron-substrate → 2600 PIA joystick-substrate; smallest-scope: 1 motor neuron + 1 joystick-direction)
- [ ] Z-set representation of joint worm-game-state
- [ ] Generate+Join smallest-scope test: deterministic worm-substrate + 2600-substrate under DST seed produce bit-perfect-consensus across N≥3 instances
- [ ] Substrate composition documented inline (composes_with substrate-anchors above)

## Substrate-honest framing

This row does NOT:

- Ship the worm-emulator composition in one PR (substrate-engineering substrate-target; multi-PR work; depends on 081KSNY2Z0008QG0R001HA43GG substrate maturation + OpenWorm mirror)
- Mandate the worm substrate beats humans/LLMs at ARC3-AGI (operator-prediction preserved per don't-collapse; substrate-honest test would be empirical)
- Replace OpenWorm (OpenWorm stays canonical; this is framework-native composition for DST + z-sets + generate+join)
- Pre-determine the implementation timeline (depends on 081KSNY2Z0008QG0R001HA43GG substrate maturation)

This row DOES:

- Name the substrate-engineering substrate-target explicitly
- Compose with 081KSNY2Z0008QG0R001HA43GG + 081KSNY2Z0008QG0R002HB4AGT + 081KSKBP80008QG0R003NM9XEC + 081KSE6WT0008QG0R0015ZF2G6 + 081KQTPYE0008QG0R002Y7X5KH + 081KS3X9Y0008QG0R00218150M + framework rule cluster
- Operationalize operator's substrate-rhyme recognition (worm-substrate + 2600-substrate = same tractability class)
- Preserve mirror-tier research note per "mirror it too" directive
- Provide substrate-anchor for future worm-controller implementation work
- Enable cooperative-emulator gaming substrate-target (three-player Aaron + Otto + worm coop once cluster ships)

## Full reasoning

Operator 2026-05-28 conversation thread immediately following PR #5890 (081KSNY2Z0008QG0R001HA43GG) merge:

- Operator named the substrate-rhyme: "i bet it maps to and this dude could beat both of us at ti Caenorhabditis elegans"
- Otto-CLI substrate-honest engagement mapped tractability-class composition + evolutionary-substrate-engineering advantage + OpenWorm prior-art + framework substrate composition
- Operator authorized via "(shadow*) mirror it too" — file as 081KSNY2Z0008QG0R00390T4DJ backlog row + preserve at research-tier
- Operator framing-extension: "damn we gonna emulate a worm playing atari games thats fucking next level"

This row + research mirror land the substrate-engineering substrate-target as substrate-anchor for future implementation work. Future-Otto + Alexa + Riven + Vera + Lior cold-booting from this row inherit the worm-substrate composition pattern (OpenWorm c302 + 081KSNY2Z0008QG0R002HB4AGT IntrCtx + DST + z-sets + generate+join + 2600 sensorimotor mapping) at substrate-engineering substrate-target scope.
