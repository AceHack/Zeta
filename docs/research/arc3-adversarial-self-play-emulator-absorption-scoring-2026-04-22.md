# ARC-3 adversarial self-play as emulator-absorption scoring

**Status:** directive absorbed, research doc — no implementation commitment.
**Source:** Aaron 2026-04-22 auto-loop-43 four-message burst during
drop-zone absorption of `deep-research-report.md`.

## The directive verbatim

Aaron, 2026-04-22 auto-loop-43, four messages in sequence:

> *"self directe play using arc3 type rules but in an advasarial
> level/game creator level/game player, this will let us score our
> absorption of emulators"*

> *"and a symmeritc quality loop"*

> *"they will naturally push the field forward through compitioon"*

> *"state of the art changes everyday"*

Four-message compression decompressed:

1. **Three-role ARC-3-style co-evolutionary setup** — level creator,
   adversarial attacker, player. All three are themselves
   learned/self-directed agents.
2. **Scoring mechanism for emulator absorption** — BACKLOG #249's
   emulator-substrate absorption (RetroArch / MAME / Dolphin) has
   had no concrete success signal until now. Aaron proposes this
   loop *as* the measurement.
3. **Symmetric quality loop** — all three roles advance each other;
   no one-sided advantage; the loop itself has a quality metric
   symmetric across the roles.
4. **Competition → field advancement** — inter-role competition
   naturally pushes the emulator-absorption field forward, without
   the factory needing top-down planning of what to improve next.
5. **Urgency: SOTA changes daily** — the emulator / self-directed
   play / ARC-AGI space is moving fast enough that the factory
   can't treat this as a multi-round R&D indulgence.

## What ARC-3 is

ARC-AGI-3 (François Chollet et al., 2025 timeline per ARC Prize
roadmap) is the third-generation Abstraction and Reasoning Corpus.
The shift from ARC-AGI-2 → ARC-AGI-3 is from **static puzzle
solving** to **interactive agentic play**: the benchmark presents
novel game environments the agent has never seen, with minimal
priors, and measures whether the agent can figure out the rules
by interacting and then play competently. The "self-directed
play" phrasing Aaron uses is the ARC-3 frame.

**Maintainer-honest caveat:** my knowledge of ARC-3 specifics as
of the assistant cutoff is incomplete. The frame is right; the
rule-details may differ from what's public at 2026-04-22. The
"ARC-3 type rules" framing in this doc should be verified against
the current ARC Prize publications before any implementation
lands. Treat the absorption here as *directional*, not literal.

## The three-role co-evolutionary loop

```
        generates novel scenarios
              │
              ▼
      ┌───────────────┐
      │ LEVEL CREATOR │  — rewarded for: creating levels that
      └───────────────┘    expose player weaknesses without
              │            being unsolvable
              │ scenarios
              ▼
      ┌───────────────┐
      │   PLAYER      │  — rewarded for: solving scenarios
      └───────────────┘    (absorbed emulator / agent)
              │
              │ solutions
              ▼
      ┌───────────────┐
      │  ADVERSARY    │  — rewarded for: finding holes in
      └───────────────┘    player's solutions (exploits,
              │            unstable strategies, brittle corner
              │ findings  cases)
              ▼
      (feeds back into level creator's training data)
```

**Key property — symmetric quality loop.** Any one of the three
getting better makes the other two's jobs harder, which pulls
them forward. If the player gets stronger, level creator has to
work harder to stump it → creator improves; adversary has more
surface to probe → adversary improves. Conversely, if the
creator gets better, player's coverage is tested harder →
player adapts. No one role is the "teacher" — all three are
co-evolutionary peers. This is the *symmetric* property Aaron
named: the loop's quality lifts symmetrically, not asymmetrically
toward one role.

Precedent literature (not a mandate to adopt — just
orientation):

- **AlphaGo / AlphaZero self-play** (DeepMind) — single-role
  self-play; not symmetric-three-role.
- **POET / Paired Open-Ended Trailblazer** (Wang et al. 2019)
  — closer to this: levels and agents co-evolve.
- **OMNI / Open-Endedness Is Essential** (Zhang et al. 2023)
  — extends POET with intelligent novelty filtering.
- **Adversarial robustness training** (Madry et al., Goodfellow
  et al.) — adversary role but not symmetric with
  level-creation.
- **ARC Prize** (arcprize.org) — the benchmark tradition Aaron
  is naming.

## Why this scores emulator absorption

BACKLOG #249 ("Start emulator substrate research") has the
problem that *"we absorbed RetroArch"* is not a measurable
claim. The three-role loop gives a concrete signal:

- **Player role** = our absorbed emulator running novel ROMs
  or game-rule configurations.
- **Level creator role** = an agent that generates novel
  game scenarios the emulator must handle (ROMs with edge-
  case timings, new input sequences, fault-injection
  scenarios).
- **Adversary role** = an agent that exploits the player's
  strategies (finds games where the emulator's cycle-accuracy
  assumptions break, finds configurations where the
  absorbed algebra drops signal).

**Scoring output:** the delta between player-capability and
creator-capability at equilibrium. If player can solve
everything creator generates, creator is weak (or player is
exceptional — distinguish via cross-play against other
implementations). If creator generates scenarios player can't
solve, measure how quickly player adapts.

This converts "how well did we absorb the emulator" from
a vibes-based assessment into a quantitative co-evolution
trajectory.

## Composes with existing factory threads

- **#249 emulator substrate research.** This is the scoring
  mechanism that row was missing. If we run the three-role
  loop against our absorbed emulator, the BACKLOG row gains
  a success signal.
- **#242 UI-factory frontier-protection.** The same loop
  applies to UI-DSL absorption: level-creator generates
  novel UIs, player renders them, adversary finds visual /
  interaction holes. The UI-factory moat claim is
  measurable the same way.
- **#244 ServiceTitan CRM demo.** The demo's "0-to-prod-in-
  hours" claim is claimed-but-unmeasured. A three-role loop
  around CRM-shaped apps (creator generates CRM spec,
  factory builds app, adversary stress-tests) would be the
  demo's quantitative backbone.
- **Semiring-parameterized Zeta regime-change claim**
  (`memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`).
  The claim "one algebra to map the others" predicts that
  the three-role loop, implemented once, generalises across
  semirings — swap the semiring, the same loop works in a
  different algebra without new code.
- **Zeta-as-agent-coherence-substrate**
  (`memory/project_zeta_is_agent_coherence_substrate_all_physics_in_one_db_stabilization_goal_2026_04_22.md`).
  Three-role co-evolution is itself agentic; running it
  inside the Zeta substrate means the coherence
  stabilisation applies to the three-role agents too.
- **Absorb-and-contribute discipline.** The loop's
  quality-pushing property is exactly how the OSS field
  advances; plugging our factory into that loop is one
  form of contributing back.

## Open questions for Aaron — not self-resolved

1. **Is ARC-3 the literal framework to port, or the
   inspiration?** "ARC-3 type rules" could mean adopt the
   ARC-3 rule schema verbatim, OR it could mean adopt the
   general flavour (novel-scenarios + measure-agent-
   adaptation).
2. **Is the loop supposed to self-host inside the factory,
   or run externally and feed signals back?** Self-hosted
   is philosophically aligned with all-physics-in-one-DB;
   externally-hosted is simpler to bootstrap.
3. **Scope for emulator-only, or generalise to UI / CRM /
   everything the factory absorbs?** The directive said
   "score our absorption of emulators" — singular scope —
   but the pattern generalises. Confirm scope before
   over-building.
4. **What's the urgency embedded in "SOTA changes
   everyday"?** Is this "prioritise over current P0s" (then
   #244 ServiceTitan demo is at risk of slipping) or "this
   is a P1 in the generic sense and we plan around it"?
5. **Who's the adversary?** Level-creator and player are
   clearly our agents. Adversary can be (a) a third internal
   agent, (b) an external adversarial-substrate we plug in
   (existing red-team tooling), (c) literally the factory's
   existing security / threat-model personas (Aminata,
   Nazar, Nadia, Mateo) wearing an ARC-3 adversary hat.
6. **What's the "field" being pushed forward?** Aaron's
   phrasing "*they will naturally push the field forward
   through competition*" — the field of emulator absorption
   specifically, or emulation-and-self-play research
   broadly, or factory-quality generally? Scope decision.

## Implementation posture — NOT this round

- Not round-45 commitment (Aaron hasn't directed scope-to-
  binding).
- Not authorization to build the three-role loop
  speculatively.
- Not license to refactor #249 emulator work to
  scoring-first.
- Not a claim that the factory has ARC-3 expertise yet.

What *is* authorised this tick: capture the directive
verbatim + derived structure, file the BACKLOG row linking
it to #249 / #242 / #244, update the relevant memories,
and stop. Verification-before-deferral: all cross-references
named here exist at landing time.

## References

- Aaron's four-message burst, auto-loop-43, 2026-04-22
  (captured verbatim above).
- BACKLOG #249 — emulator substrate research, which this
  scores.
- BACKLOG #242 — UI-factory frontier-protection, same
  pattern.
- BACKLOG #244 — ServiceTitan CRM demo, measurability
  implication.
- `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
- `memory/project_zeta_is_agent_coherence_substrate_all_physics_in_one_db_stabilization_goal_2026_04_22.md`
- `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  — why four short Aaron messages get this much substrate
  landing.
- ARC Prize, arcprize.org — the benchmark tradition (verify
  specifics before implementation).
