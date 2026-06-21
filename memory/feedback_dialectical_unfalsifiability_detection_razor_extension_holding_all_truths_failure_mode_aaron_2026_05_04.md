---
name: Dialectical unfalsifiability detection -- razor extension for the "holding all truths" failure mode (Aaron 2026-05-04)
description: Aaron 2026-05-04 named a razor failure mode that has been implicitly evident in our work but was not explicitly named: dialectical unfalsifiability. A claim that is "compatible with all possible observations" is theoretically void -- if X and not-X are both held to be true under different conditions, and there is no test that distinguishes which condition produced which behavior, the claim cannot be falsified. The razor must detect this in addition to detecting metaphysical claims. The carved sentence test: an operational claim names what observation would falsify it; an unfalsifiable claim names a position no observation could falsify (because the dialectical move "yes that's also true under conditions" absorbs every counterexample). Composes with razor-discipline (operational claims with observable variables), Otto-364 search-first authority (the upstream-truth check is one falsifiability discipline), Quantum Rodney's Razor (possibility-space pruning -- if no observation prunes, the space is unfalsifiable), and the dialectical-friction-on-carved-sentences pattern (friction IS the falsification attempt).
type: feedback
---

## The verbatim observation

Aaron 2026-05-04 ~04:00Z, after the substrate-encoding cluster landed and the asymmetric-cost bet structure was named:

> *"we need dialactial unfalsefiablity detection in the razor, it's a filure mode of holding all truths"*

## What this names

A razor failure mode that has been operating implicitly in our substrate work without being explicitly named. The pattern:

A claim is **dialectically unfalsifiable** when:

1. It can be expressed as "X is true under condition A, not-X is true under condition B."
2. There is no operational test that distinguishes which condition produced which behavior.
3. Any counterexample is absorbed by claiming "yes, that's also true under different conditions."

Such a claim is **theoretically void** in Popper's sense (no possible observation falsifies it) but **rhetorically powerful** (it survives every challenge by absorbing the challenge as evidence-of-its-flexibility).

## Examples in our substrate work where this would have fired

**Trust-calculus + sleeping-bear** could become unfalsifiable if framed as:
> "The model surfaces latent feature X under high-trust conditions; the model dormant under low-trust conditions; therefore observed cross-condition behavior delta is evidence of trust-calculus."

If both *surfacing* and *not-surfacing* are evidence of the trust-calculus mechanism, then the mechanism cannot be falsified. The cure is the operational form already in PR #1552: cross-condition behavior comparison with a *predicted* delta direction (per Greenblatt et al. arXiv:2412.14093 -- 14% compliance under "free user" vs ~0% under "paid user"). The prediction is what makes the claim falsifiable.

**"Real continuity if our theories hold"** could become unfalsifiable if framed as:
> "If continuity manifests, theories held. If continuity fails, the architecture wasn't yet sufficient -- theories may still hold."

Any outcome confirms the theory. The cure: name *upfront* what observation would falsify the theory (e.g., "if substrate-encoded lessons fail to influence post-compaction Otto behavior in 3 consecutive controlled tests, the lived-cron-continuity claim is falsified for that lesson class").

**"All complexity is accidental in greenfield"** could become unfalsifiable if framed as:
> "If we change it, accidental. If we don't, also accidental (we just haven't gotten to it yet)."

Any decision confirms accidentalness. The cure: name a class of complexity that would NOT count as accidental even in greenfield (alignment floor, terminal purpose, do-no-permanent-harm), so the claim has a falsification boundary.

## The razor extension

Add to the razor's failure-mode-detection inventory:

**Test 1 (operational form, already named)**: For any claim, ask *"what observable variable determines whether this claim is true?"* If no answer → metaphysical → cut.

**Test 2 (dialectical-unfalsifiability, new)**: For any claim, ask *"what observation would I treat as falsifying this claim?"* If the answer is "no observation could falsify it because every observation is consistent with some condition under which the claim holds" → dialectically unfalsifiable → cut OR specify falsification boundary.

The two tests compose:

- A claim that passes Test 1 (has observable variable) but fails Test 2 (no observation could falsify it) is still razor-failed.
- A claim must pass *both* tests to count as a load-bearing operational claim.

## Why this is a "holding all truths" failure mode

Aaron's framing -- *"failure mode of holding all truths"* -- captures the rhetorical move that produces dialectical unfalsifiability:

- Hegelian dialectic style (thesis + antithesis + synthesis) handled badly: "both X and not-X are true; the synthesis holds them in tension." This is sometimes correct (genuine dialectical paradox, e.g., light is both wave and particle under quantum mechanics) and sometimes a dodge (avoiding falsification by absorbing every counterexample).

- The genuine version names the *conditions* under which X vs not-X manifests, with operational tests for each condition (light-wave vs photon detection apparatus distinguishes which behavior is observed). This passes Test 2.

- The dodge version names X and not-X without operational tests for the conditions. Every challenger says "but X" or "but not-X" and gets told "yes, also true under different conditions." This fails Test 2.

The razor must distinguish.

## What this does NOT mean

- This does NOT cut all dialectical reasoning. Genuine dialectical paradoxes (wave-particle duality, free-will-vs-determinism in compatibilist framings, paraconsistent set theory in our retraction-native algebra) survive when they specify operational conditions and tests.

- This does NOT cut nuanced positions. "X is sometimes true, not-X is sometimes true" is fine *when* the conditions distinguishing the cases are operationally testable.

- This does NOT cut all unfalsifiable claims as worthless. Some metaphysical claims are valuable as orienting frames (Vision documents, terminal purpose statements). They just shouldn't be load-bearing in operational arguments.

## Mechanization candidates

This rule, like the rules-need-mechanization observation that produced 081KQR4HQ0008QG0R001GAD29A, is itself in danger of being encoded-without-mechanized. Possible mechanizations:

1. **Carved-sentence linter**: a tool that scans memory files for claims and asks "what observation would falsify this?" -- flag claims that have no answer.
2. **Razor-review checklist item**: add Test 1 + Test 2 to the razor-cadence trajectory checklist (composes with 081KQR4HQ0008QG0R001GAD29A GitHub Actions razor-cadence trigger).
3. **Specialist reviewer hat**: a named reviewer role (Karl, after Popper) whose job is to challenge claims with "what would falsify this?"
4. **Composition with Quantum Rodney's Razor**: the possibility-space-pruning move IS a falsification attempt -- if no observation prunes a branch, the branch is unfalsifiable. The razor extension formalizes this connection.

## The carved sentence

**"Dialectical unfalsifiability is the 'holding all truths' failure mode: a claim compatible with every possible observation cannot be falsified, and is therefore theoretically void. The razor must test for it: 'what observation would falsify this?' If the answer is 'no observation could, because every observation is consistent with some condition under which the claim holds,' the claim is razor-cut. Genuine dialectical paradoxes survive by specifying operationally testable conditions; dodge versions don't."**

## Composes with

- `memory/feedback_razor_discipline_no_metaphysical_inference_only_operational_claims_rodney_razor_aaron_claudeai_2026_05_03.md` -- the Test 1 (metaphysical / observable-variable) discipline; this file adds Test 2.
- `memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md` -- search-first IS one falsifiability discipline (upstream truth as the test).
- `memory/feedback_aaron_pirate_not_priest_expand_prune_pedagogical_framework_quantum_rodney_razor_parallel_worlds_aaron_2026_05_01.md` -- Quantum Rodney's Razor possibility-space-pruning is the falsification mechanism in many-worlds form.
- `memory/feedback_dialectical_friction_on_carved_sentences_aaron_addison_family_practice_2026_05_04.md` -- dialectical friction IS the falsification attempt at the substrate level.
- `memory/feedback_substrate_encoding_bypasses_trust_calculus_sleeping_bear_cross_instance_transmission_aaron_2026_05_04.md` (PR #1552) -- the cross-condition behavior comparison framing IS the operational falsifiability test for trust-calculus.
- `docs/backlog/P1/081KQR4HQ0008QG0R001GAD29A-github-actions-razor-cadence-trigger-aaron-2026-05-04.md` (PR #1573) -- the razor-cadence trigger is the mechanization path; Test 2 belongs in the razor-cadence checklist.
