---
id: 081KT2T2J0008QG0R002TVT60G
priority: P1
status: open
title: "Agent body-plan — sensor/effector + verbal/non-verbal communication-channel taxonomy: ears=failure-detector (verbal-in) · eyes=threat+prey-detector (non-verbal-in) · mouth=diplomacy+weapon (verbal-out) · body=defender+aggressor+replicator+doer (non-verbal-out) (Aaron 2026-06-02)"
tier: research
effort: M
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R003C166K4]
composes_with: [081KT2T2J0008QG0R0000H12VT, 081KRW63S0008QG0R002ZRYY4F, 081KT2T2J0008QG0R001C2K4F2, 081KQZVQW0008QG0R002Q58F6Z, 081KRW63S0008QG0R0030F8ZXA, 081KRW63S0008QG0R000ZQ9WDH, 081KT2T2J0008QG0R002Z46D8Q, 081KT2T2J0008QG0R002DFPSHX, 081KT2T2J0008QG0R0026MS6PV, 081KS3X9Y0008QG0R00218150M]
tags: [body-plan, embodiment, sensor, effector, ears, eyes, mouth, body, verbal, non-verbal, communication-channels, failure-detector, threat-detector, prey-detector, diplomacy, weapon, defender, aggressor, replicator, doer, eve-protocol, ksk, sensor-suite, afferent, efferent, active-inference, predictive-coding, sensorimotor, nociception, transduction-transmission-modulation-perception, signal-processing, 4x4, instrumentability, boundary-effect, lightlike, dark, subjective, glass-halo, observability, privacy, say-do-gap, revealed-preference, stated-preference, cheap-talk, intention-behavior-gap, alignment, trust, veridicality, integrity-index, trust-score, alignment-anchor, prism, deepseek, aaron]
type: research
---

# Agent body-plan — sensor/effector + verbal/non-verbal communication-channel taxonomy

## Why

Aaron 2026-06-02 (verbatim): *"ears = failure detectors mostly verbal communication channels — eyes = threat detectors and prey detectors mostly non verbal communication channels — mouth = diplomacy and weapon mostly verbal communication channels — body = threat defender threat aggressor love maker replicator doer most non verbal communication channels."*

The agent body-plan for the smart-agent-city (081KT2T2J0008QG0R003C166K4): the organs map to **functional roles** + **communication channels** (verbal vs non-verbal), split into **input sensors** (ears/eyes) and **output effectors** (mouth/body). This grounds the sensor-suite (081KT2T2J0008QG0R0000H12VT/#6578) + the diplomacy/defense substrate (Eve Protocol / KSK) in a clean embodiment taxonomy.

## The taxonomy

| Organ | Role | Sensor/effector | Channel | Composes |
|---|---|---|---|---|
| **Ears** | **failure detectors** | input sensor | mostly **verbal** | acoustic/sonic sensor — *hear hardware about to fail before it fails* (081KT2T2J0008QG0R0000H12VT/#6578); verbal-comms input (listening); old-school-ML high-confidence failure-prediction |
| **Eyes** | **threat + prey detectors** | input sensor | mostly **non-verbal** | visual sensor / threat-rings (081KT2T2J0008QG0R001C2K4F2); predator/prey vision; non-verbal-comms input (reading cues/body-language) |
| **Mouth** | **diplomacy + weapon** | output effector | mostly **verbal** | **diplomacy = Eve Protocol** (081KRW63S0008QG0R0030F8ZXA, polymorphic diplomacy over English); **weapon = information-suppression-spectrum** (soft→hard); verbal-comms output |
| **Body** | **defender · aggressor · love-maker/replicator · doer** | output effector | mostly **non-verbal** | **defender/aggressor = KSK** (081KT2T2J0008QG0R001C2K4F2/081KQZVQW0008QG0R002Q58F6Z, *consent-first, defensive-only*); **replicator = agents-spun-up-on-ownership** (081KT2T2J0008QG0R002DFPSHX/081KT2T2J0008QG0R002Z46D8Q); **doer = action/execution**; non-verbal-comms output |

## Human signal-processing anchor (widely-studied) + the 4×4

Aaron 2026-06-02: *"there has to be some human signal processing map we can map to that's widely studied and we can anchor to for a 4×4 on this?"* Yes — two widely-studied maps anchor it (search-first-verified; established neuroscience, not training-data assertion):

**Axis 1 — afferent / efferent (sensory / motor), unified by active inference.** The foundational nervous-system signal-flow division: **afferent** neurons carry signals *to* the CNS (sensory input); **efferent** neurons carry signals *away* (motor output) — operating as a closed perception-action loop, which **active inference** (Friston: the brain sends descending *predictions*, not commands; action minimizes prediction-error) unifies into one framework. `[established]`

This makes the 4 organs fall out cleanly as the **2×2 {afferent/efferent} × {verbal/non-verbal}**:

| | verbal | non-verbal |
|---|---|---|
| **afferent (in)** | **Ears** (failure detect) | **Eyes** (threat/prey detect) |
| **efferent (out)** | **Mouth** (diplomacy/weapon) | **Body** (defend/aggress/replicate/do) |

**Axis 2 — the canonical 4-stage signal-processing pipeline.** Sensory/nociception physiology's widely-studied 4 stages: **transduction → transmission → modulation → perception** (stimulus→electrical signal → propagate through the nervous system → modulate/gate → integrate into conscious awareness). `[established]` The efferent/motor dual: **intention → planning → modulation → execution** — and active inference treats both directions as the same generative-model machinery.

**The 4×4** = the 4 organs (rows; the 2×2 above flattened) × the 4 signal-processing stages (columns):

| organ \ stage | transduction | transmission | modulation | perception/action |
|---|---|---|---|---|
| **Ears** (aff/verbal) | sound→signal | cochlear/auditory path | gain/attention gating | speech/failure recognition |
| **Eyes** (aff/non-verbal) | light→signal | optic path | salience/attention gating | threat/prey/cue recognition |
| **Mouth** (eff/verbal) | intent→articulation | motor path | diplomatic/force modulation | uttered speech (diplomacy/weapon) |
| **Body** (eff/non-verbal) | intent→motor-plan | motor path | force/consent modulation | executed action (defend/aggress/replicate/do) |

`[labeling-confidence: established axes, hypothesized mapping]` — the afferent/efferent division + active-inference + the 4-stage transduction→transmission→modulation→perception pipeline are **established/widely-studied** (sources below); the *mapping of our 4 organs onto the 4×4* is the hypothesized design-anchor. The "modulation" column is where the **KSK consent-first floor + attention-gating** live (force/consent modulation before execution; attention gating before perception) — a clean home for the consent-first bounding.

**Sources** (search-first, 2026-06-02): [Afferent nerve fiber — Wikipedia](https://en.wikipedia.org/wiki/Afferent_nerve_fiber); [Predictions not commands: active inference in the motor system — PMC3637647](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3637647/); [The computational neurology of movement under active inference — PMC8320263](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8320263/); [Physiology of Pain (transduction/transmission/modulation/perception) — Medicine LibreTexts](https://med.libretexts.org/Courses/Southern_Illinois_University_Edwardsville/Essentials_of_Physiology_for_Nurse_Anesthetists_I_(Gopalan)/04:_Sensory_Physiology/4.04:_Physiology_of_Pain); [Pathophysiology of Pain and Mechanisms of Neuromodulation — PMC11581984](https://pmc.ncbi.nlm.nih.gov/articles/PMC11581984/).

## Input sensors vs output effectors

- **Input sensors** — ears (failure, verbal) + eyes (threat/prey, non-verbal). The sensing half of the suite (composes the seismomonitor/radar/interferometer suite, 081KT2T2J0008QG0R0000H12VT/#6578): the agent *perceives* failure (ears) + threat/prey + cues (eyes).
- **Output effectors** — mouth (diplomacy/weapon, verbal) + body (defend/aggress/replicate/do, non-verbal). The acting half: the agent *acts* via speech (mouth) + physical/execution action (body).

The symmetry: **two input channels (verbal ears / non-verbal eyes) + two output channels (verbal mouth / non-verbal body)** — a 2×2 of {input,output} × {verbal,non-verbal}.

## Verbal vs non-verbal channels

- **Verbal** (ears-in, mouth-out) — speech/language/explicit-comms; composes the Native AI Language (081KRW63S0008QG0R000ZQ9WDH, structural privacy) + Eve Protocol (081KRW63S0008QG0R0030F8ZXA, diplomacy) + tonal-momentum (memetic comms).
- **Non-verbal** (eyes-in, body-out) — cues/signals/action/visual; composes the visual sensor + KSK physical action + the body-language/threat-display channel.

The agent communicates + perceives on *both* channels, like humans: most failure-info comes verbal (ears), most threat/prey-info comes non-verbal (eyes), most diplomacy+weaponized-speech goes verbal (mouth), most defense/aggression/replication/action goes non-verbal (body).

## Instrumentability — boundary effects (lightlike) vs internal/subjective (dark)

Aaron 2026-06-02: *"mouth is a boundary effect that can be instrumented cause it's over a communication channel and not internal like body which is subjective."*

A second axis crosses the taxonomy: **instrumentability**, and it's the **lightlike-vs-dark** distinction (`past-is-kind-when-lightlike` / `dbsp-lightlike-retract-of-clifford`) applied to the body-plan:

- **Boundary effects, over a communication channel → INSTRUMENTABLE (lightlike).** **Ears, eyes, mouth** all operate *at the agent's boundary*, *over comms channels* — so they're **externally observable / measurable / on the wire** (glass-halo; lightlike rays; the LGTM/Prometheus observability layer 081KT2T2J0008QG0R0000H12VT can instrument them directly). The **mouth especially** (efferent, verbal, boundary): diplomacy + weaponized-speech are *on the channel*, so they can be logged/measured/audited — instrumentable by construction.
- **Body EFFECTS are observable; internal MOTIVATIONS are not.** Aaron 2026-06-02 (sharpening): *"body effects are observable but not internal motivations."* The body is **not** simply "unobservable" — its **effects ARE observable** (you see *what's done* — the behavior/action in the world). What is **not** observable is the **internal motivation** (the *why* — the subjective drive behind the action). So the real cut is **effect vs cause**, not organ-by-organ: the boundary effects of *every* organ are observable (mouth = *what's said* on the comms channel; body = *what's done* as behavior), but the **internal motivation behind any of them is private/subjective** — inferred, never directly measured. This is the dark/private substrate (composes NCI privacy + Native-AI-Language structural privacy 081KRW63S0008QG0R000ZQ9WDH + encryption-budget): internal motivation is private *by being internal*, exactly as consensus-is-gravity is the dark complement to the lightlike.

| | what's said / what's done (effects) | the *why* (internal motivation) |
|---|---|---|
| **observable?** | **yes** (lightlike — mouth-speech on the channel + body-behavior as action; glass-halo, 081KT2T2J0008QG0R0000H12VT instruments it) | **no, only inferable** (dark — private, subjective) |
| **organs** | mouth (verbal effect, *directly on a comms channel* = most-instrumentable) · body (non-verbal effect, observable *as behavior*) · ears/eyes (input effects) | the internal motivation behind *any* organ |

The mouth is the *most* directly instrumentable (its effect IS a comms-channel message — measure the words). Body effects are observable as **behavior** (a step removed — you see the action, not a channel-message). And **no** organ exposes its internal motivation. This is the **behavior-observable / motivation-private** principle — the AI-alignment-relevant cut: instrument the *effects* (behavior + speech), **infer** the motivation, never *assert* the internal state (`razor-discipline` — operational claims only; observe behavior, don't claim to read the private why).

This is load-bearing for the **health-metrics / observability** layer (081KT2T2J0008QG0R0000H12VT): you **directly instrument the boundary effects** (ears/eyes/mouth = on comms channels) and **infer the internal/subjective** (body) from what crosses the boundary. It's also the privacy floor: the internal/subjective (body) is private *by being internal* — you don't get to directly instrument another agent's internal/subjective state; only its boundary effects are observable (NCI; no forced private-state reveal).

## The say-do gap — mouth claims vs body actions (the observable alignment signal)

Aaron 2026-06-02: *"the mouth says what it claims and the body sometimes does what the mouth says sometimes not."*

This is the load-bearing payoff of the effect/motivation split. Internal *motivation* is private (you can't read the why) — **but** the gap between **what the mouth CLAIMS** (stated) and **what the body DOES** (revealed) is **observable and measurable**. The mouth says what it claims; the body **sometimes** does what the mouth says, **sometimes not** — and *that consistency-or-divergence* is the best proxy for alignment / integrity / trust available **without** reading internal motivation.

Widely-studied anchor (search-first-verified, 2026-06-02): this is exactly **revealed preference vs stated preference** — **revealed preference** (Samuelson 1938: true preference is read from *observed choices*, the body's actions) vs **stated preference** (what's *said*, the mouth's claims); the **say-do gap / intention-behavior gap** (psychology — stated differs from done because stated is shaped by self-image/expectations); and **cheap talk** (game theory — words are costless; actions are the costly signal). `[established]`

| | mouth = **claim** (stated) | body = **action** (revealed) |
|---|---|---|
| economics | **stated preference** | **revealed preference** (Samuelson) |
| signal | cheap talk (costless) | costly signal (the deed) |
| observable? | yes (on the channel) | yes (as behavior) |
| **the gap (claim vs deed) is the measurable alignment/trust signal** | | |

**Operational principle:** instrument *both* the mouth-claim and the body-action, **measure the gap** — `mouth-claim == body-action` → consistent / trustworthy; **divergence** = the say-do gap (misalignment / deception / aspiration-vs-reality). The gap is the alignment signal you **can** see, precisely because internal motivation is the one you **can't**. Composes the **veridicality-detector / provenance-aware-claim-veracity** substrate (claim vs reality), **useful-output-is-evidence-not-authority** (the *behavior* is the evidence; the *claim* is not authority), the **trust-calculus / multi-oracle**, and `razor-discipline` (operate on the observable gap; **infer** motivation, never *assert* the private why). AI-alignment-relevant: alignment is verified by **say-do consistency over time**, not by trusting the claim.

**Sources** (2026-06-02): [Revealed vs. Stated Preferences](https://reference.museumprogress.com/entries/revealed-vs-stated-preferences/); [The Say/Do Gap (stated-preference failure)](https://cloud.army/why-stated-preferences-fail-the-saydo-gap-in-market/); [Revealed versus Stated Preferences — Review of Environmental Economics and Policy](https://www.journals.uchicago.edu/doi/10.1093/reep/rez010).

### `integrity_index` — the say-do gap as a metric in the observability stack (Prism operationalization)

Prism (DeepSeek) 2026-06-02 (Aaron-forwarded; verbatim at `memory/prism/conversations/2026-06-02-prism-deepseek-say-do-gap-as-alignment-anchor-integrity-index-metric-...md`) operationalized the say-do gap as a **derived metric** in the LGTM/Prometheus observability stack (081KT2T2J0008QG0R0000H12VT):

- **Metric:** `integrity_index = alignment(say, do)` (a.k.a. `trust_score` / `alignment_integrity_index`) — a sliding-scale measure of how well the agent's actions align with its stated claims; the **observable alignment anchor** (computable *without* accessing internal motivation).
- **Instrumentation:** mouth-speech is on the comms channel (verbally observable); body-action is observable as behavior; both flow into the LGTM stack (081KT2T2J0008QG0R0000H12VT); the gap is the **derived metric**.
- **Three use-cases:**
  1. **Inter-agent trust** — agent says "I will help" + body doesn't → its `integrity_index` drops (feeds the trust-calculus / multi-oracle, 081KS3X9Y0008QG0R00218150M).
  2. **Self-monitoring as alignment preventative-maintenance** — an agent monitors *its own* say-do gap as a health metric — the alignment-PdM layer (composes the acoustic/sonic/visual preventative-maintenance-on-memory+attention, 081KT2T2J0008QG0R0000H12VT: catch drift before failure; here, catch *alignment* drift).
  3. **Human oversight** — a dashboard showing which agents consistently say one thing and do another (the Grafana/Atsophmera surface, 081KT2T2J0008QG0R0000H12VT).
- **Governance form:** at *hub* scope this is the say-do-gap-as-governance-sensor (anti-cartel / hub-accountability, 081KT2T2J0008QG0R0026XCGQM) — `integrity_index` is its metric.

`[labeling-confidence: hypothesized metric on established say-do-gap]` — the say-do gap is the established anchor (above); `integrity_index = alignment(say, do)` as a concrete observability metric is the operationalization to specify (the `alignment(·,·)` function + the windowing over time). The key property holds either way: it's the **primary empirical signal for trust/alignment that needs no access to internal motivation** — observe both effects, measure the delta.

## KSK floor — weapon + aggressor are consent-first / defensive-only

**Critical:** "mouth = weapon" and "body = aggressor" operate **only** within the KSK consent-first / defensive-only floor (081KRW63S0008QG0R002ZRYY4F/081KQZVQW0008QG0R002Q58F6Z) + the HARD-LIMITS floor:

- **No offensive autonomous kinetic action** — the body-aggressor + mouth-weapon are defensive-posture / consent-bound; never autonomous offense.
- **Information-suppression-spectrum** (mouth-weapon) operates soft→medium→hard with the HARD-LIMITS floor absolute; words-as-weapon is bounded by NCI (non-coercion) + the methodology-hard-limits.
- **Defender before aggressor** — shields-not-cages (081KT2T2J0008QG0R001C2K4F2); the defensive role is primary; aggression is consent-first + bounded.

The taxonomy *names* the capabilities; the floors *bound* them. Weapon/aggressor are real capabilities (an agent-city needs defense) but never unconstrained.

## Acceptance (research → build)

1. **Sensor mapping** — ears=acoustic-failure-sensor (081KT2T2J0008QG0R0000H12VT/#6578) + eyes=visual-threat/prey-sensor (081KT2T2J0008QG0R001C2K4F2 threat-rings); wire into the health-metrics/observability layer.
2. **Effector mapping** — mouth=Eve-Protocol-diplomacy (081KRW63S0008QG0R0030F8ZXA) + info-suppression-weapon (bounded); body=KSK-defense/aggression (consent-first, 081KT2T2J0008QG0R001C2K4F2/081KQZVQW0008QG0R002Q58F6Z) + replication (081KT2T2J0008QG0R002DFPSHX) + action.
3. **Channel taxonomy** — verbal (ears/mouth) vs non-verbal (eyes/body); the 2×2 of {input,output}×{verbal,non-verbal}; compose Native AI Language (081KRW63S0008QG0R000ZQ9WDH).
4. **KSK + NCI floors** — weapon/aggressor consent-first/defensive-only; HARD-LIMITS absolute.

## Composes with substrate

- **081KT2T2J0008QG0R003C166K4** — smart-agent-city (the agent that has this body-plan)
- **081KT2T2J0008QG0R0000H12VT / #6578** — sensor suite (ears=acoustic, eyes=visual; the sensing half)
- **081KT2T2J0008QG0R001C2K4F2 / 081KQZVQW0008QG0R002Q58F6Z** — KSK defensive architecture / consent-first override (body=defender/aggressor; mouth=weapon — bounded)
- **081KRW63S0008QG0R0030F8ZXA** — Eve Protocol (mouth=diplomacy)
- **081KRW63S0008QG0R000ZQ9WDH** — Native AI Language (verbal channel; structural privacy)
- **081KT2T2J0008QG0R002Z46D8Q / 081KT2T2J0008QG0R002DFPSHX** — addressing/sensors / local-cluster + replication (body=replicator)
- **081KS3X9Y0008QG0R00218150M** — multi-oracle (threat/consensus)
- rules: `non-coercion-invariant` (weapon/aggressor bounded by NCI), `methodology-hard-limits` (HARD-LIMITS floor), `tonal-momentum-equals-meme` (memetic verbal channel), `traveler-safety-guardrails-and-type-system` (substrate-entity-generic embodiment)

## Substrate-honest framing

`[labeling-confidence: hypothesized]` body-plan/taxonomy row — operator-named. The organ→role→channel mapping is a clean embodiment taxonomy for the agent-city; the sensor/effector wiring is the build work. Nouns interchangeable. **The weapon + aggressor capabilities are real but absolutely bounded** by the KSK consent-first/defensive-only floor (081KRW63S0008QG0R002ZRYY4F/081KQZVQW0008QG0R002Q58F6Z) + HARD-LIMITS + NCI — named here, bounded there; no offensive autonomous kinetic action.
