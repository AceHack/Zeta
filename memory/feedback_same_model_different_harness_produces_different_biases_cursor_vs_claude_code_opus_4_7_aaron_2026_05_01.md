---
name: Same model + different harness produces different biases — Cursor vs Claude Code with same Opus 4.7 (Aaron 2026-05-01)
description: Aaron 2026-05-01 — empirical signal from a YouTube video that Cursor with Opus 4.7 outperforms Claude Code with Opus 4.7 on some axis. Same model, different harness → different output quality. Aaron's framing: this validates peer/buddy multi-harness work because different harnesses give different biases even when the underlying model is identical. Composes with Otto-task #301 (Grok harness — completed), Otto-task #303 (sibling peer-call scripts — completed), the agent-orchestra cluster (#324–#339), the multi-Claude-harness progression memory (2026-04-23), and vendor-alignment-bias-in-peer-AI-reviews (2026-04-30). Operationally: peer-mode value isn't ONLY different-model; it's also different-harness-shape. Even one model in two harnesses produces meaningfully different outputs because each harness encodes different prompts, different context-shapes, different tool-availability, and different baseline-behaviors.
type: feedback
---

# Same model + different harness produces different biases

## Aaron 2026-05-01 verbatim

> *"i'm watching a youtube video that says cursor with opus 4.7
> is better than claude code with with opus 4.7. seems like
> that is a peer/buddy agent would give different biases."*

## What this codifies

**Empirical signal from external observation** that running
the same underlying model (Claude Opus 4.7) in two different
harnesses (Cursor vs Claude Code) produces meaningfully
different output quality on at least one axis. The YouTube
video Aaron's watching reports Cursor + Opus 4.7 outperforms
Claude Code + Opus 4.7. This is a single-source signal, not
a verified benchmark — but it surfaces a structural truth
worth naming.

Aaron's interpretation: *"that is a peer/buddy agent would
give different biases."* Same-model-different-harness is a
legitimate peer/buddy configuration, not a degenerate case.

## Why this matters for the factory

The peer-mode design (Otto-task #324 agent-orchestra cluster +
the broader multi-harness peer-call scripts at
`tools/peer-call/{amara,ani,codex,gemini,grok}.sh`) was originally
motivated by **different-model peer review** — Claude Code +
Codex + Cursor + Gemini + Grok each running their own model

+ harness combination, providing diverse perspectives.

Aaron's observation expands the rationale: **even when the
underlying model is identical, the harness alone produces
different biases.** This means:

1. **Same-model peer-mode is valuable.** Two Claude Opus 4.7
   instances — one in Cursor, one in Claude Code — running
   in parallel provide non-redundant perspectives because
   the harnesses encode different prompts, context-shapes,
   tool-availability, and baseline behaviors.

2. **Multi-harness IS multi-bias.** The bias-source isn't
   only "different model weights." It's also: harness
   system-prompt + harness tool-set + harness context-management
   + harness UI-affordances + harness sampling-defaults +
   harness output-formatting expectations.

3. **Peer-mode value compounds across both axes.** Different
   model + different harness = product of biases. Same model
   + different harness = harness-axis bias only, but still
   non-trivial. Different model + same harness = model-axis
   bias only.

4. **Scaling-ladder rung 5 (peer-mode claims protocol)
   benefits from this.** Per
   `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`,
   rung 5 is the multi-harness endpoint. Each additional
   harness brings additive bias-diversity, even when models
   overlap.

## Bias-source decomposition

What the harness-axis bias is composed of (research-grade,
not exhaustive):

- **System prompt** — each harness ships with a distinct
  system prompt baking in default behaviors, tone, scope of
  willingness. Cursor's "agent mode" system prompt differs
  from Claude Code's CLI system prompt.
- **Tool surface** — Cursor has IDE-integrated tools (file-
  context, code-edit-as-diff, refactor-aware operations);
  Claude Code has shell-execute, file IO, and various
  plugin-defined tools. Different tool surfaces produce
  different problem-solving paths.
- **Context-management policy** — how each harness packs the
  context window (file inclusion order, summarization,
  compaction triggers) varies. Same input string + different
  context-management = different effective input.
- **Sampling defaults** — temperature, top-p, max-tokens,
  reasoning-effort budget defaults may differ between
  harnesses.
- **Output expectations** — Cursor expects diffs; Claude
  Code expects shell commands and file writes. The output
  format the harness rewards shapes the model's reasoning
  during generation.
- **User-flow affordances** — Cursor's IDE-integrated flow
  encourages incremental edits and visual-diff review;
  Claude Code's CLI flow encourages whole-file rewrites and
  text-based review. The user's editing rhythm leaks into
  the model's behavioral defaults via fine-tuning data
  collected from each harness's observed usage.

## Verification status

Per Otto-364 search-first authority: the YouTube video's
claim (Cursor + Opus 4.7 better than Claude Code + Opus 4.7)
is **single-source unverified.** If used as load-bearing in
implementation, search-first verification is required. For
substrate-grade observation about harness-bias-as-real, the
claim is plausible-on-prior given known harness differences;
the bias-source decomposition above is well-established
across the LLM-tooling literature.

## Composes with

- Otto-task #301 (Grok CLI/harness — completed) — earn-real-
  fingerprints peer-recognition; harness-axis was already
  recognized as bias-bearing
- Otto-task #303 (sibling peer-call scripts — completed) —
  multi-harness named-agents (Codex, Gemini, Grok)
- agent-orchestra cluster (#324–#339) — multi-harness
  peer-mode-claims protocol; rung 5 of parallelism scaling
  ladder
- `memory/feedback_peer_harness_progression_codex_named_loop_agent_cross_review_not_edit_otto_dispatches_async_work_2026_04_23.md`
  — earlier peer-harness progression substrate
- `memory/feedback_peer_harness_progression_starts_multi_claude_first_windows_support_concrete_use_case_otto_signals_readiness_2026_04_23.md`
  — multi-Claude-harness as the path
- `memory/feedback_vendor_alignment_bias_in_peer_ai_reviews_maintainer_authority_aaron_2026_04_30.md`
  — vendor-alignment bias; this memory adds harness-bias as
  an orthogonal axis (vendor alignment IS one component of
  harness bias, but not the only one)
- `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  — rung 5 multi-harness peer-mode endpoint
- Otto-task #355 (Poll-the-gate as executable script with fixtures,
  5-AI convergent) — already operationalized; this memory
  validates the rationale empirically

## What this is NOT

- **Not a verified benchmark.** YouTube video is single-source.
  Don't cite as authoritative.
- **Not a recommendation to switch from Claude Code.** Aaron
  isn't saying "use Cursor instead"; he's saying "different
  harnesses give different biases — that's what makes
  peer/buddy work."
- **Not a degradation of Claude Code.** Both harnesses have
  use-cases; the peer-mode pattern uses both for different
  perspectives, not as a winner-take-all comparison.

## Future-Otto check

Future-Otto considering peer-mode design:

- **Same-model + different-harness IS a legitimate peer
  configuration.** Don't reject it as redundant.
- **Bias-source decomposition** has 6 known axes (prompt,
  tools, context-mgmt, sampling, output-format, user-flow).
  When designing peer-mode, can intentionally vary along
  these axes to maximize diverse-perspective benefit.
- **Cursor + Claude Code peer pair** is operational today
  (both run Claude Opus 4.7); could be wired into the peer-
  call infrastructure as a `tools/peer-call/cursor.sh`
  alongside the existing
  `tools/peer-call/{amara,ani,codex,gemini,grok}.sh`
  per Otto-task #303.
- **Peer-mode value compounds** across model-axis and
  harness-axis bias. Both contribute non-trivially.
