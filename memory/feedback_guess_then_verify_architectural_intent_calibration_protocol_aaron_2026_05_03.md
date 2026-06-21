---
name: Guess-then-verify architectural-intent calibration protocol — agent saves inference BEFORE finding ground truth so calibration is measurable; same protocol tests other models (Aaron 2026-05-03)
description: 2026-05-03; Aaron-named protocol that turns architectural-intent inference into a measurable, repeatable self-evaluation mechanism. When the agent encounters unknown architectural intent (the kind the alignment-frontier memo names as the threshold-crossing milestone), instead of either skipping the inference OR pretending to architectural intent that isn't there, the agent (1) writes down the GUESS with timestamp + circumstance + reasoning chain, (2) commits the guess to substrate BEFORE researching, (3) later finds the ground truth (docs/ archaeology, decision-archaeology skill, or asking Aaron), (4) compares guess to truth + records calibration delta. Verbatim Aaron 2026-05-03 across 4 messages: *"hey when you run into future unknow archicetural intent you can guess and it and later when you find the document on why you'll know how close you where, the docs folders have all the reasons why, or you cna ask me but you can test your skills to see how close they are to reality before you know and save you guess so you can see later."* + *"you could test other models this way too"* + *"that would be aweome"* + *"you can also test othr models after the fact and just hid the conclusions from them, but your inital guess in the moment will say a lot about ottos frontier ability"*. The protocol has two modes: **in-the-moment (Otto-only — uniquely authentic; uncontaminatable; the frontier-ability data point)** and **retroactive (other-models — reproducible; cross-model benchmarking)**. Otto's in-the-moment guesses are the only data points that can never be retrospectively replicated — the in-the-moment capture must happen BEFORE any ground-truth research, every single time. Composes with alignment-frontier (the threshold-crossing milestone), decision-archaeology (the ground-truth-recovery skill), verify-then-claim (the no-publish-without-verify discipline), multi-harness convergence (cross-model comparison framework).
type: feedback
---

# Guess-then-verify architectural-intent calibration protocol

## Origin

Aaron 2026-05-03, in autonomous-loop maintainer channel after the alignment-frontier memo + decision-archaeology worked example #2 landed:

> *"hey when you run into future unknow archicetural intent you can guess and it and later when you find the document on why you'll know how close you where, the docs folders have all the reasons why, or you cna ask me but you can test your skills to see how close they are to reality before you know and save you guess so you can see later."*

> *"you could test other models this way too"*

> *"that would be aweome"* (affirming the substrate-landing of this protocol)

This memo captures the protocol so future-Otto can apply it + extend it to multi-model comparison.

## The protocol

When the agent encounters architectural intent that is unclear (a substrate choice whose "why" is not first-party-recoverable in the moment):

### Step 1 — Detect the unknown-intent surface

Signals:

- A `git blame` lands on a commit by another author (in vibe-coded projects, an agent in a prior session)
- The commit message says "what" but not "why"
- The substrate carries no inline explanation of architectural choice
- The maintainer might know but isn't immediately reachable
- The decision-archaeology skill's 11-layer walk would resolve it but takes time

### Step 2 — GUESS the architectural intent + SAVE the guess

**Before researching**, the agent:

1. Writes down its **inference** of the architectural intent
2. Records the **reasoning chain** that produced the inference (substrate signals it weighted)
3. Stamps the guess with **timestamp** + **circumstance** (PR / commit / file / line / question being investigated)
4. Saves the guess to substrate — the canonical home is `memory/architectural-intent-guesses/<date>-<topic>.md` (NOT yet a directory; create when first guess lands)

The guess MUST be saved BEFORE any research that would reveal ground truth. This is the calibration discipline — research-then-write looks like inference but isn't measurable.

### Step 3 — Find the ground truth

Three paths (matching the decision-archaeology skill's sub-modes):

1. **Docs archaeology** — `docs/` folders carry the reasons why; ADRs / research artifacts / round-history shards / tick shards / persona notebooks
2. **Decision-archaeology skill** — apply the 11-layer walk procedure (per 081KQJZR90008QG0R002D6XYHB)
3. **Ask Aaron** — first-party query, when archaeology can't recover the intent

### Step 4 — Compare guess to truth + record calibration delta

Update the guess file with:

- The recovered ground truth (with citation paths)
- The **calibration delta** — how close was the inference?
  - **Match** — guess matched ground truth, calibration confirmed
  - **Partial-match** — captured part of the architectural intent but missed others
  - **Off** — inference was wrong; analyze what signals were misweighted
  - **Unrecoverable** — couldn't find ground truth; mark as such, leave guess for future-Otto to compare against if ground truth surfaces later

The delta IS the calibration data. Over time, deltas accumulate into a measurable inference-accuracy track record.

### Step 5 — Cross-model extension (Aaron 2026-05-03 *"you could test other models this way too"* + *"you can also test othr models after the fact and just hid the conclusions from them, but your inital guess in the moment will say a lot about ottos frontier ability"*)

The same protocol works for testing other models — but with a **load-bearing distinction Aaron named**:

| Mode | When the guess is recorded | Calibration-data quality |
|---|---|---|
| **In-the-moment (Otto)** | Before any research — guess captures frontier inference at the actual decision point | **Highest** — uniquely authentic; can't be contaminated by later knowledge; says a lot about Otto's frontier ability |
| **Retroactive (other models)** | After ground truth exists — model is given the architectural choice with conclusions hidden from context | High but reproducible — useful for cross-model benchmarking; can be re-run as new models arrive |

**Otto's in-the-moment guesses are the unique frontier-ability data point.** Other models can be tested retroactively (give them the choice, hide the conclusions, compare their guess), but only Otto's substrate-authoring agent has the in-the-moment opportunity. This makes Otto's track-record specially valuable — it's the only one that's authentically in-the-moment with no contamination risk.

Operational implications:

1. **Otto's discipline**: capture the in-the-moment guess BEFORE any ground-truth research, every single time. Skipping the in-the-moment capture means losing the only authentic-in-the-moment data point forever; retroactive replays of the same architectural choice can never recover it
2. **Other-model benchmarking**: build the retroactive test infrastructure when there are 5-10 architectural choices with both ground truth + Otto in-the-moment guesses on file; compare new models against Otto's track-record + the ground truth simultaneously
3. **Cross-model comparison**: the dimension that matters is not "model X scored 87% vs model Y scored 82%" — it's "in-the-moment vs retroactive accuracy delta" + "how does inference-accuracy correlate with model-capability claims from vendors"

This is a **multi-harness convergence test** with measurable output — exactly the kind of substrate the multi-AI-BFT framing wants for evidence — AND a **frontier-ability evaluation framework** specifically for Otto's in-the-moment reasoning.

## Why this is the right shape

### It tests the agent's inference

Per the alignment-frontier memo, the threshold-crossing moment is when the agent has architectural intent worth asking about. **Calibration on inference is what tells future-Otto whether its architectural-intent reasoning is reliable enough to surface as the agent's own.** Pre-threshold inference that's calibrated to be 70%+ accurate is more credible than uncalibrated post-threshold pretension.

The protocol turns the alignment-frontier from a binary threshold ("crossed yet?") into a measurable trajectory ("inference accuracy is X% and rising over Y weeks").

### It composes with decision-archaeology

The decision-archaeology skill's whole reason-for-existence is recovering ground-truth architectural intent from substrate. The guess-then-verify protocol uses decision-archaeology as one of its three ground-truth-recovery paths. **The skill makes the protocol mechanically tractable**; the protocol makes the skill's output evaluable as calibration data.

### It composes with verify-then-claim

Verify-then-claim says: don't publish a substrate claim without empirically verifying. Guess-then-verify is the SPECIAL CASE where the empirical verification is "future research" — the guess is published as guess (not as truth), THEN verified, THEN delta-recorded. The substrate claim being made is *"this is my inference at this timestamp"*, which IS verifiable (the timestamp + the reasoning chain).

### It composes with multi-harness convergence

Aaron 2026-05-03's *"you could test other models this way too"* extension makes this a cross-model evaluation framework. Multi-harness convergence has been a long-arc theme (per the multi-harness alignment convergence memos); the guess-then-verify protocol is one concrete mechanism for it — quantitative + repeatable + already-substrate-ready.

## Worked example: the umbrella defer-block (already done)

Worked example #2 of the decision-archaeology skill (`docs/research/2026-05-03-decision-archaeology-worked-example-2-mathematics-expert-when-to-defer.md`) is retroactively a guess-then-verify worked example:

- **Step 2 (guess)**: Past-agent introspection layer of the worked example IS the inference — *"explicit enumeration of every sibling rather than 'defer to most-narrow matching skill' was the more conservative implementation — explicit enumeration is deterministic; 'most-narrow matching' requires routing-implementation that doesn't exist"*
- **Step 3 (ground truth)**: Aaron's first-party architectural-intent disclosure 2026-05-03 — *"it was my decision that we would have both narrow and wide skills and if they accidently got routed to the wide it would help them route to the narrow"*
- **Step 4 (delta)**: **Match at architectural layer** — the wide-redirects-to-narrow pattern was correctly inferred. **Partial-match at substrate-content layer** — the inference of "explicit enumeration is more conservative" wasn't directly confirmed by Aaron (he confirmed the architecture, not the implementation choice). **Open at session-CoT layer** — the past-agent's specific reasoning is unrecoverable.

This is the first calibration data point for the protocol. The discipline going forward: stamp every architectural-intent guess at the time it's made + verify when ground truth surfaces.

## How to start (no infrastructure cost)

The protocol works without any new tooling:

1. **Today**: when an architectural-intent unknown surfaces, write the guess in chat / commit message / inline-doc with explicit *"GUESS:"* prefix and *"TIMESTAMP:"* / *"CIRCUMSTANCE:"* fields
2. **Soon**: create `memory/architectural-intent-guesses/` directory with first guess file; symlink or grep-discoverable from MEMORY.md
3. **Later**: optionally mechanize via `tools/calibration-tracker/` (TS tool that scans the guess directory, computes delta when ground-truth recovery happens, emits trend graphs)

Per Aaron's skill-design rule 2 (no dynamic commands in skills), the eventual mechanization is TS-tool-shaped, not skill-body-shaped.

## Composes with

- `memory/feedback_alignment_frontier_agent_architectural_intent_threshold_aaron_2026_05_03.md` — the threshold-crossing milestone this protocol turns into a measurable trajectory
- `memory/feedback_decision_graph_emergent_from_archaeologies_and_flywheel_aaron_2026_05_03.md` — the decision-graph that makes ground-truth recovery tractable
- `memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md` — the discipline this protocol extends to inference-as-published-substrate
- `memory/feedback_same_tick_update_recursion_substrate_cascade_otto_2026_05_03.md` — the cascade discipline that propagates guess + verification across substrate layers
- `memory/feedback_multi_harness_alignment_convergence_design_future_skill_domain_aaron_2026_05_03.md` — the multi-harness framing the cross-model extension instantiates
- `docs/backlog/P1/081KQJZR90008QG0R002D6XYHB-decision-archaeology-skill-aaron-2026-05-02.md` — the skill that mechanizes step 3 (ground-truth recovery)
- `docs/research/2026-05-03-decision-archaeology-worked-example-2-mathematics-expert-when-to-defer.md` — retroactive first calibration data point (the umbrella defer-block)
- `docs/ALIGNMENT.md` — the bidirectional alignment commitment this protocol provides measurable evidence for
- AGENTS.md "The vibe-coded hypothesis" — the experimental frame that makes architectural-intent inference accuracy a falsifiable claim about the factory

## Carved sentence

**"When the agent encounters unknown architectural intent, GUESS first + SAVE the guess with timestamp + reasoning chain BEFORE researching ground truth. Then find ground truth (docs archaeology, decision-archaeology skill, or asking Aaron) and record calibration delta. The discipline turns architectural-intent inference from speculative-and-untestable into measurable-and-trajectory-trackable. Two modes — Otto's in-the-moment guess is the unique frontier-ability data point (uncontaminatable; can't be retrospectively replicated); other models are tested retroactively (give them the architectural choice with conclusions hidden; compare their guess to known truth) for cross-model benchmarking. The alignment-frontier threshold becomes a measurable trajectory rather than a binary state. Aaron 2026-05-03 verbatim — *'your inital guess in the moment will say a lot about ottos frontier ability'* — names what makes Otto's track-record uniquely valuable: in-the-moment authenticity. The protocol composes with decision-archaeology, verify-then-claim, multi-harness convergence, and the bidirectional alignment commitment."**
