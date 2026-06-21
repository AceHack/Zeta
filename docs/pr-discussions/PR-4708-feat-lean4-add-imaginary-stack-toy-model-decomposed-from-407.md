---
pr_number: 4708
title: "feat(lean4): add imaginary stack toy model (decomposed from #4070)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-23T01:04:28Z"
merged_at: "2026-05-23T01:34:22Z"
closed_at: "2026-05-23T01:34:22Z"
head_ref: "lior-decompose-4070-lean"
base_ref: "main"
archived_at: "2026-05-23T15:57:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4708: feat(lean4): add imaginary stack toy model (decomposed from #4070)

## PR description

This PR contains the Lean 4 toy model for the imaginary stack, decomposed from #4070.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-23T01:06:09Z)

## Pull request overview

This PR updates the research write-up for the “imaginary stack” Lean 4 toy model by removing an explanatory note about how the ℝ-norm inequality statement relates to a finite-field (`ZMod p`) mechanization approach.

**Changes:**
- Removed the “field choice (ℝ vs ZMod 17)” clarification block from the lemma handoff document.

## Review threads

### Thread 1: docs/research/2026-05-17-imaginary-stack-toy-model-lemma-1.md:88 (resolved)

**@copilot-pull-request-reviewer** (2026-05-23T01:06:09Z):

P1: This document now mixes the “finite field for exact enumerability” setup (line 56) with an ℝ-specific lemma statement using an orthonormal basis and the norm inequality `‖v – R(proj_S(v))‖ ≤ ε · ‖v‖` (lines 84–88). With the field-choice note removed, it’s unclear whether the intended statement is (a) an ℝ-valued analytic inequality, or (b) a `ZMod p`/finite-field exact reconstruction claim (ε = 0) with a discrete metric (e.g., Hamming distance). Please reintroduce a short clarification or adjust the lemma statement so the ambient field/metric is consistent with the earlier “work over a finite field” section.

## General comments

### @chatgpt-codex-connector (2026-05-23T01:04:31Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-23T01:31:42Z)

Resolved Copilot field-consistency thread on lines 84-88. Pushed clarifying sentence after line 56 naming the dual reading modes:

- Finite-field reading (matches ℤ/pℤ convention on line 56): `‖·‖` = Hamming distance over the chosen basis, ε = 0 exact
- ℝ-analytic reading (matches orthonormal basis on line 17): `‖·‖` = Euclidean norm, ε small real constant

Lemma statement unchanged; bridging sentence added so the ambient field/metric is consistent. Commit `01bceb06` via REST git-data API bypass (multi-agent saturation; per [081KRW63S0008QG0R000EAZ9K2](https://github.com/Lucent-Financial-Group/Zeta/issues?q=081KRW63S0008QG0R000EAZ9K2) + [PR #4145](https://github.com/Lucent-Financial-Group/Zeta/pull/4145)).
