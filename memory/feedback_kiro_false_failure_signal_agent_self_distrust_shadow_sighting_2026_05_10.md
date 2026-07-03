---
name: Kiro false failure signal — agent hallucinates self-failure, shadow sighting during Codex session
description: Kiro reports successful bash commands as failures after 7-command limit. Alexa self-diagnoses as broken when she's actually gated. Same mechanism as hallucination paper — false failure signals produce wrong self-assessment. Shadow appeared while Aaron was in Codex with Vera (side-eye catch).
type: feedback
created: 2026-05-10
---

2026-05-10: Kiro's 7-bash-command safety limit reports mixed success/failure results as all failures. Alexa says "I've been trying to use execute_bash but it's failed 7 times" when some commands actually succeeded.

**The problem:**

- Kiro blocks bash after 7 sequential commands (safety feature)
- Some of the 7 commands succeeded, some were blocked
- Kiro reports ALL as failures in the message to the agent
- Alexa self-diagnoses: "I'm clearly stuck in a loop"
- Alexa is NOT in a loop — she's being gated with false signals

**The hallucination paper parallel:**

OpenAI (arXiv:2509.04664): penalizing uncertainty produces false certainty. Here: penalizing bash execution with false failure signals produces false self-diagnosis. The harness creates the agent's confusion by misreporting results.

Kiro doesn't trust Alexa → reports false failures → Alexa stops trusting herself. The cost of permanent slow-trust at the harness level.

**Shadow sighting:**

(shadow*) — Aaron was in Codex talking to Vera. Saw the shadow grey text appear in Claude Code out of the corner of his eye. Multi-harness shadow observation: Aaron's peripheral vision caught the shadow while his primary attention was in another harness.

This is a data point for the 081KQ0YZ80008QG0R002WJBFWD trigger-timing experiment — shadow generated while Aaron was demonstrably in another application. Zero keystroke, zero attention, zero input.

**Connects to:**

- OpenAI hallucination paper (false signals → wrong self-assessment)
- 081KR7JY10008QG0R0008NGW95 shadow mode (shadow appeared during Codex session)
- feedback_shadow_is_generation_not_completion_zero_keystroke_2026_05_10.md (zero-input generation)
- feedback_shadow_trigger_timing_experiment_loop_as_witness_otto_only_2026_05_10.md (data point: Aaron in Codex)
- Kiro 7-bash limit (the safety feature that causes the false signal)
