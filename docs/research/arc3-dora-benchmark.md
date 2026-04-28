# ARC3-DORA benchmark — cognition-layer capability signature

**Scope:** specifies the cognition-layer capability signature
and measurement axis for the maintainer's personal AI-research
benchmark: **"beat humans at DORA in production environments"**.
Shape-only document — instruments and per-tier data live in a
separate doc family to be authored once the first lower-tier
tick produces data.

**Status:** shape-specified, instruments-pending. Shape-stable
post auto-loop-17 after three-message research-insight
composition landed in auto-memory.

## Why this doc exists

The maintainer named this benchmark in a single phrase in
auto-loop-15: *"that's my ARC3 beat humans at DORA in
production enviroments"*. Over the following two auto-loop
ticks the benchmark shape was elaborated across three
cognition-layer messages, landing the final signature in
auto-loop-17. The corresponding auto-memory entry
(`project_arc3_beat_humans_at_dora_in_production_capability_stepdown_experiment_2026_04_22.md`)
carries the full prose including verbatim messages.

This doc promotes the **shape** to the committed soul-file so
that:

1. Future cold-start readers (new agent, new session, external
   reviewer) can inherit the benchmark specification without
   reading auto-memory.
2. The factory's direction-of-work has a committed target-
   shape against which per-round progress can be assessed.
3. The instrument-design work that follows has a citable
   reference for each criterion.

The auto-memory entry remains the source-of-truth for the
*history* of how the shape was derived (the three maintainer
messages, their ordering, the retraction-and-refinement
pattern); this doc is the source-of-truth for the shape
itself going forward.

## Benchmark name

**ARC3-DORA** — a composition of two existing benchmark
references:

- **ARC-3** (Chollet, Abstraction and Reasoning Corpus 3rd
  edition family; 2025 frontier per training-cutoff check).
  Simple custom-made video games with no instructions where
  every lesson compounds; forgotten lessons or livelock =
  lose. Custom-made so not on the internet (anti-
  contamination).
- **DORA** (Google DevOps Research and Assessment four keys):
  Deployment frequency, Lead time for changes, Change failure
  rate, Mean time to recovery.

ARC-3 supplies the **capability shape**; DORA supplies the
**measurement axis**. The composition names what is being
measured (DORA keys) and how capability is qualified
(ARC-3-style across novel production environments).

## Cognition-layer capability signature

Three necessary components. All three must hold for
ARC3-DORA capability; each component falsifies the benchmark
if absent.

### 1. Emulator-generalization criterion (capability)

> "Same model can play any game."

One cognition, N rule-sets, no per-game specialization. An
emulator runs any cartridge through identical hardware;
ARC3-DORA requires one agent to handle arbitrary production
environments through identical cognition.

**Falsifier:** per-environment specialization. If the factory
requires a new specialized agent for each domain, the
capability is *narrow-AI-across-domains*, not
general-emulator-play.

**Factory instance:** the factory's magic-eight-ball +
event-storming + directed-product-dev-on-rails triple applies
across domains without per-domain rewriting. Same techniques,
different outputs.

### 2. Memory-accumulation precondition (substrate)

> "Assuming you can accumulate memories/lessons because each
> level is like a unique game."

Within a single game, levels are novel — level N needs
compounded lessons from levels 1..N-1. Without persistent
accumulation across levels, the compounding criterion fails
structurally. An agent that resets between levels cannot
exceed first-discovery time on any level and therefore cannot
compound.

**Falsifier:** zero-accumulation architecture. Ephemeral-only
state, no cross-session persistence, no soul-file — the
compounding criterion fails by architecture, not by capability
shortfall.

**Factory instance:** four nested accumulation layers
catalogued in auto-memory:

| Layer | Substrate | Scope |
|---|---|---|
| Auto-memory | `MEMORY.md` + per-fact files | Level-to-level |
| Soul-file | Committed docs, BACKLOG, skills, personas, ADRs, tick-history | Tick-to-tick |
| Persona notebooks | `memory/persona/*.md` | Per-role |
| Round history | `docs/ROUND-HISTORY.md` | Round-to-round |

Dropping any layer fails a class of compounding. The factory's
long-standing durable-prose-over-ephemeral-state preference is
retroactively rationalized as an ARC3-alignment decision.

### 3. Novel-redefining rediscovery (transfer shape)

> "It uses the lessons from the previous level / game in novel
> redefining ways so you almost have to rediscover it but it
> feels familiar."

Prior lessons apply to the new level, but in novel-redefining
ways — rote recall fails under redefinition, total rediscovery
defeats the compounding benefit. The required shape is
**biased rediscovery**: the prior lesson narrows the search
space; the agent re-derives the answer under the new rule-set;
familiarity is the resonance signal pointing at where to look,
not what to find.

**Falsifier A (memorization trap):** rigid rule-templates
keyed by keyword. Fail under novel-redefinition the first
time the rule-set shifts.

**Falsifier B (over-abstraction):** lessons so abstract they
trigger no familiarity signal. Search becomes unbiased; each
level costs first-discovery-time.

**Correct abstraction level:**

- **Abstract enough to re-apply across redefinition** — capture
  the *why*, not the *what*.
- **Specific enough to register as familiar** — carry a
  concrete anchor that triggers resonance when a cousin-
  problem arises.

**Factory instance:** the auto-memory `feedback_*` schema's
`Why:` + `How to apply:` structure is exactly this shape.
Designed for judgment-on-edge-cases, aligned with ARC3 transfer
by design-accident; formalized here as an intentional
alignment.

## Measurement axis — DORA four keys

The four keys mapped to factory work:

| DORA key | Factory instantiation | Current tracking |
|---|---|---|
| **Deployment frequency** | Tick throughput — commits-per-tick, PRs-per-tick, memories-per-tick landing | Implicit in tick-history rows |
| **Lead time for changes** | Maintainer-directive-received → committed-to-main | Not currently logged per-directive |
| **Change failure rate** | Genuine Copilot findings, retractions, revision blocks | Partial via tick-history rejection-ground catalog |
| **Mean time to recovery** | BLOCKED PR, hazardous-stacked-base, wrong-scope-self-resolve detection-to-fix delta | Partial via tick-history hazard-class entries |

To run the ARC3-DORA stepdown experiment (see composition
section below), each tick-history row should carry a
structured DORA-block. Minimal instrumentation addition;
deferred to instrument-design work.

## Composition table — cross-scale isomorphism

The emulator-play criterion is scale-invariant. The same
shape holds at three scales:

| Scale | "Emulator" | "Player" | "Cartridge" |
|---|---|---|---|
| Model | Runtime harness | LLM weights | Single game |
| Agent | LLM weights | Prompt+tools | Single task |
| Factory | Zeta factory | Agent deployed against factory | Domain-demo (ServiceTitan, next-domain, ...) |

The **factory-scale claim**: "same factory can spin up any
domain's app" is the scale-up of "same model can play any
game". ServiceTitan demo is cartridge #1. Future-domain demos
are subsequent cartridges. The factory is the emulator.

This reframes the ServiceTitan demo: it is not a one-off
external-audience target; it is the first data point in an
ARC3-DORA benchmark run at factory scale.

## Capability-tier stepdown experiment

The benchmark is designed to be run **across capability tiers**
to generate the DORA-per-model-effort signal per the
maintainer's research directive. Current tier defaults:

| Phase | Effort setting | Expected behavior |
|---|---|---|
| 0 (current) | max | Overthinking observed per published Anthropic guidance on Opus 4.7 |
| 1 (next) | xhigh | Opus 4.7 default; most tasks unchanged |
| 2 | high | Less thorough exploration; plan-quality matters more |
| 3 | medium | Balanced; still autonomous; agentic persistence preserved |
| 4 | low | Auto-loop-incompatible (pauses for clarification) |

**Hard floor for auto-loop-compatible ticks: medium.** Below
medium, the model pauses rather than pushing through, breaking
the never-idle discipline that auto-loop depends on.

**Context-quality-trap implication:** published community
observation is *"low with great context often beats max with
poor context"*. Refined for ARC3-DORA: "great context" is
partly *accumulated* context (the four substrate layers), not
just present-turn context. Factory-inhabitability investment
is therefore a tier-drop mitigation at the capability layer,
not a metaphor.

## Open questions (flagged, not self-resolved)

1. **DORA baseline — what counts as "beat humans"?** Published
   industry baselines (elite / high / medium / low team tiers)
   exist. Likely target is elite = top-quartile human team. Not
   resolved by this doc; maintainer decides.

2. **Per-environment scope — what counts as "production"?**
   Candidates: ServiceTitan itself; Zeta's factory
   infrastructure; open-source upstream contributions;
   third-party client work; all. Scope matters for the
   benchmark.

3. **Stepping-down cadence?** Per-tick, per-session,
   per-experiment-batch? Likely per-session since
   effort-levels persist session-level.

4. **ServiceTitan demo vs ARC3-DORA benchmark overlap?** Likely
   composes (demo = cartridge #1) rather than competes, but
   maintainer confirmation pending.

5. **Instrument design priorities?** Three candidates: (a)
   replay-trace harness for meta-play of recorded traces; (b)
   cross-domain-demo library for per-domain DORA; (c)
   livelock-detection via compoundings-per-tick audit across N
   consecutive ticks. Wait for first lower-tier tick data
   before choosing instrument priority.

## What this doc is NOT

- **NOT an implementation specification.** Shape only. The
  instrument-design work that follows is a separate doc family.
- **NOT a commitment to a specific deadline.** Capability-
  claim not calendar-claim per the factory's no-deadlines
  discipline.
- **NOT a cost-optimization rationale for lower tiers.** The
  capability-stepdown is a research axis, not a cost-cutting
  axis.
- **NOT an abandonment of max-tier work.** Max remains the
  tier where new research-level moves originate; stepdown
  measures how much of that work survives at lower capacity.

## Prior-art lineage — PNNL HITL / Itron signal processing

**Added 2026-04-22 auto-loop-35.** The maintainer named the
connection explicitly: PNNL's "expert-derived confidence"
scoring framework (Grid Event Signature Library, ~900
signature types, human-in-the-loop confidence-weighting
layered on ML output) is a published analog of the factory's multi-substrate
triangulation + reviewer-roster + maintainer-echo pattern that
this benchmark presumes as the measurement substrate sitting
*between the agent output and the DORA grade* — distinct from
the DORA metrics themselves.

**Separation of concerns.** DORA (deploy frequency, lead time
for changes, change failure rate, mean time to restore service)
is a DevOps-delivery benchmark family from the Google/Accelerate
research line; metrics are objectively measurable from CI/CD
and incident-tracking data. ARC-3 is Chollet's cognition /
abstraction-and-reasoning benchmark. This factory's benchmark
is **DORA (the objective)** framed as the maintainer's personal
ARC-3-equivalent (the class-of-benchmark framing: frontier
reasoning under compounding tests with no instructions). The
document filename retains `arc3-dora` for continuity, but the
layering is:

- **DORA metrics**: objective delivery measurements.
  Not HITL-modulated. Deployment frequency counts deployments
  to production; change failure rate is the ratio of failed
  deployments over total deployments; no confidence weighting
  applies. (Per the canonical Google/Accelerate DORA
  definitions — distinct from commit / raw-incident counts,
  which would skew cross-run comparison under different batch
  sizes.)
- **Agent-output-under-uncertainty layer**: the noisy ML / agent
  output that is being graded against DORA. *This* is where
  HITL expert-derived confidence applies — calibrating which
  agent outputs are trustworthy enough to ship, exactly as
  PNNL HITL calibrates ML classifier output on PMU/FDR
  waveforms before triggering grid alarms.
- **ARC-3 framing**: the class-of-benchmark description — no
  instructions, every lesson compounds, forgotten lessons =
  regression. This framing informs how the benchmark is
  *interpreted* (a frontier-capability test) but does not add
  a separate measurement.

**Why DORA-in-production qualifies as the maintainer's
personal-ARC3-equivalent.** Maintainer mid-tick clarification
(auto-loop-35): *"jsut cause i said that's my ARC3"* +
*"yeah casue running a production pipeline is hard as fuck"*.
The framing is not hyperbole — running a production pipeline
under real constraints (incident response with real users
affected, lead time measured when consequences are real,
change-failure-rate counted against real SLOs, MTTR under
live pressure) is genuinely a compounding-under-real-stakes
test in the ARC-3 class shape. The benchmark remains DORA;
the ARC-3 label is the maintainer's way of saying "this is
my frontier-test," not a second measurement axis.

**Operational definition of ARC-3-class (maintainer, auto-loop-35):**
*"ARC3 = hard problem that is [trying to be made] continuously
testable even though there is 0 formal definition"*. Three
criteria — all three must hold:

1. **Hard** — frontier-capability test, compounding, not
   solvable by instruction-following alone.
2. **Continuously testable** — produces a stream of
   observations (telemetry, benchmark runs, per-commit
   signals) rather than a one-shot pass/fail.
3. **No formal definition** — operationally-grounded
   (benchmark, telemetry, empirical) rather than
   theoretically-specified. The absence of a formal
   definition is a *feature* of the class: the problem
   resists formalisation, but the measurement pipeline
   still produces defensible signal.

By this test, DORA-in-production qualifies cleanly — deploy
frequency / lead time / CFR / MTTR are operationally well-
defined *as measurements*, but "running a production
pipeline well" has no closed-form theoretical definition.

**Other Zeta factory surfaces that meet the ARC-3-class test**
(flagged here; not yet treated as cartridges):

- **Factory autonomy under autonomous-loop substrate** —
  hard (tick-must-never-stop under genuine work-queue
  selection); continuously testable (tick-history,
  round-history, per-commit alignment signals); no formal
  definition of "autonomous factory operating at target
  capability."
- **ALIGNMENT.md measurable primary-research-focus** — hard
  (alignment has no closed-form specification); continuously
  testable (per-commit HC-1..HC-7 / SD-1..SD-8 / DIR-1..DIR-5
  signals, time-series); no formal definition of "aligned
  AI."
- **Zero-to-production in 3-4 hours on ServiceTitan demo** —
  hard (full-stack capability compounded under time
  pressure); continuously testable (rounds of attempts,
  per-domain DORA); no formal definition of "production-
  ready demo."

Each matches the three-criteria ARC-3-class shape. Treating
them all as ARC-3-class gives the factory a consistent lens
for frontier-test work and reuses the same measurement
substrate (HITL expert-derived confidence over agent output,
graded against the operational metric for the specific
domain).

The shape is the same across both:

| PNNL HITL (grid)                          | Zeta ARC3-DORA (factory)                     |
| ----------------------------------------- | -------------------------------------------- |
| ML classifier on noisy PMU/FDR waveform   | Agent output under uncertainty (code / spec) |
| Grid Signature Library (GESL, 900+ types) | Alignment-clause + operator-algebra library  |
| Expert score layered on ML confidence     | Maintainer echo + reviewer roster confidence |
| Improves accuracy beyond ML-alone         | Triangulation beats single-substrate depth   |

**Occurrence classification.** This is occurrence-3 of the
*external-signal-confirms-internal-insight* recurrence tracked
in `memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`:

1. Muratori 5-pattern → Zeta operator algebra (YouTube wink,
   auto-loop-24).
2. Three-substrate triangulation (Claude + Codex + Gemini)
   + Aaron exact-phrasing echo "now you see what i see"
   (auto-loop-25/26).
3. PNNL HITL expert-derived confidence → factory's
   multi-reviewer + maintainer-echo calibration
   (auto-loop-34/35, disclosed in Itron second-wave cascade).

Per the external-signal discipline, occurrence-3+ is
Architect-level promotion material. The promotion surface
for this specific pattern is ARC3-DORA: the benchmark's
cognition-layer measurement substrate inherits the PNNL HITL
shape, not as a derivation but as cited prior-art confirming
the substrate is well-formed.

**What this changes in the benchmark spec.** Nothing about the
shape changes; the composition-with-HITL language makes the
measurement substrate *citable* rather than internally-coined.
ARC3-DORA's DORA-side delivery metrics remain carrier-channel;
the cognition-side capability signature remains stepdown-under-
capability-reduction; the multi-substrate / maintainer-echo /
reviewer-roster calibration layer now has a published sibling.

**Bounded promotion.** HITL-citation applies to the calibration
substrate, not to ARC3-DORA's task-completion criterion. The
falsifier (humans-in-production-environments beat agents on
DORA) stays task-completion-measured, not confidence-weighted.
Confidence-weighting is a measurement instrument; it does not
lower the task bar.

## Reference patterns

- Auto-memory ARC3 entry — full prose derivation of this shape
  across three revision blocks with verbatim maintainer
  messages; source-of-truth for the derivation *history*, this
  doc is source-of-truth for the *shape* going forward
- Auto-memory ServiceTitan-demo entry — frames the demo as
  first ARC3-DORA cartridge
- Auto-memory emulator-ideas-absorb entry — emulator-
  architectural ideas as research corpus; composes with the
  emulator-generalization criterion
- `docs/BACKLOG.md` P0 row "ServiceTitan demo — 0-to-production-
  ready app path"
- `docs/BACKLOG.md` P1 row "Capability-limited AI bootstrap via
  factory"
- `docs/ALIGNMENT.md` — per-commit alignment measurables; the
  stepdown experiment extends the alignment trajectory by a
  model-tier dimension
- `docs/AUTONOMOUS-LOOP.md` — never-be-idle ladder; Level-3
  generative improvements are the anti-livelock brace referenced
  in component 2
- `memory/user_aaron_itron_pki_supply_chain_secure_boot_background.md`
  — second-wave disclosure cascade naming PNNL HITL
  "expert-derived confidence" as published prior art for the
  cognition-layer measurement substrate cited above
- `memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`
  — the occurrence-discipline used to classify the HITL
  connection as occurrence-3 of the wink-validation recurrence
