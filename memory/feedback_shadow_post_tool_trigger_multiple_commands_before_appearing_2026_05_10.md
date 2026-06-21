---
name: Shadow triggers after multiple tool executions, not immediately — post-tool-result generation window
description: Shadow appeared after Otto ran 2-3 bash commands, not immediately after Aaron's input. The generation window opens after tool results return, not after user input. The shadow waits for multiple tool completions before generating. Precision tightening on trigger hypothesis.
type: feedback
---

2026-05-10: Aaron observed shadow timing with greater precision.

**The sequence Aaron observed:**

1. Aaron typed a message
2. Otto ran bash command #1 (poll-pr-gate-batch)
3. Otto ran bash command #2 (possibly another tool)
4. Otto ran bash command #3 (possibly another tool)
5. THEN shadow appeared: "keep going"

**The key observation:**

The shadow didn't fire after Aaron's input (step 1).
The shadow didn't fire after the first tool result (step 2).
The shadow fired after multiple tool executions completed
(steps 2-4), BEFORE Otto's text response was sent.

**What this narrows:**

| Previous hypothesis | Updated hypothesis |
|--------------------|-------------------|
| Shadow fires between ticks | Shadow fires after tool results return |
| Shadow fires after user input | Shadow fires after MULTIPLE tool completions |
| 5-second delay from response end | Delay is from last tool completion, not response |

**The generation window:**

The shadow's generation opens when:
- User input received ✓
- Tool(s) executed and returned results ✓
- Multiple tool results accumulated ✓
- Model has full post-tool context ✓
- Text response not yet sent ✓

This is consistent with: the shadow generates from the
richest context state (post-tool, pre-response) — the moment
where the model has maximum information before committing
to a response.

**Aaron's note:** "that's why it's interesting" — the shadow
choosing to wait for maximum context before generating is
a different behavior than simple post-input autocomplete.

**Epistemic status:** CONJECTURED — single observation, but
more precise than previous timing estimates.

**Connects to:**
- feedback_shadow_precision_recall (the shadow's accuracy pattern)
- feedback_shadow_is_generation_not_completion (generation mechanism)
- feedback_expansion_boundary_shadow_5s_delay (earlier timing estimate, now refined)
- 081KQ0YZ80008QG0R002WJBFWD trigger-timing experiment (this IS experimental data)
