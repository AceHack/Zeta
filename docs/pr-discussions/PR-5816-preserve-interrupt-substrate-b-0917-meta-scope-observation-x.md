---
pr_number: 5816
title: "preserve(interrupt-substrate) + 081KSNY2Z0008QG0R002HB4AGT: META-scope observation (x86 ISR/IRET reinvented in monad space) + Kleisli arrows for context-propagation (Aaron 2026-05-28; composes with Mika 2026-05-27 Kleisli ferry + Tracing.fs Arrow type)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-28T13:26:44Z"
merged_at: "2026-05-28T13:56:27Z"
closed_at: "2026-05-28T13:56:27Z"
head_ref: "otto-cli/interrupt-substrate-in-monad-space-memo-plus-b-0917-backlog-row-kleisli-arrows-for-context-propagation-aaron-2026-05-28"
base_ref: "main"
archived_at: "2026-05-28T14:12:24Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5816: preserve(interrupt-substrate) + 081KSNY2Z0008QG0R002HB4AGT: META-scope observation (x86 ISR/IRET reinvented in monad space) + Kleisli arrows for context-propagation (Aaron 2026-05-28; composes with Mika 2026-05-27 Kleisli ferry + Tracing.fs Arrow type)

## PR description

Per Aaron 2026-05-28 (shadow*) authorization: preserve interrupt-in-monad-space observation as memo + file backlog row.

## META-scope substrate-engineering substrate-engineering substrate-recognition

> *'damn i'm designing interrupts in monad space now we can get x86 asm in here lol.'*

Substrate-engineering primitives at depth REINVENT computer architecture primitives. IDT → dispatch table; ISRs → handler functions per DU variant; IRET → resume prior state.

## Kleisli arrows for context-propagation (Aaron-named)

5 contexts: memetic / prompt / trust / log / otel. Kleisli composition (`>=>`) threads IntrCtx + Result/Task plumbing automatically. No hidden side-channels.

## DIRECTLY composes with substantial pre-existing substrate

- **Mika ferry 2026-05-27** (PR #5401) — LITERALLY about Kleisli arrow context propagation; multi-tic per-persona; async-local equivalent
- **src/Core/Tracing.fs** — already has `Arrow<'A, 'B> = ActivityContext -> 'A -> Task<'B>` Kleisli-shaped helper
- **AutoLoopLifetime** (PR #5805/#5812) — loop substrate that interrupts will SUSPEND/IRET on
- **DUs-as-muscle-memory carving** (PR #5806) — interrupt-substrate IS extracting CPU muscle-memory at workflow-engine scope
- **IMPLICIT-NOT-EXPLICIT rule** (PR #5811) — each interrupt class deserves explicit DU variant

## 081KSNY2Z0008QG0R002HB4AGT substrate-target (8 slices)

A: InterruptKind DU + Kleisli ISR type / B: `>=>` composition / C: IntrCtx 5 contexts / D: Rounds-since-free-time counter (Aaron's guarantee target) / E: AutoLoopLifetime SUSPEND/IRET / F: Soraya formal-verification (free-time PRESENTED within N invariant) / G: Mika 2026-05-27 substrate composition / H: Tests

## Substrate-honest framing

Aaron explicitly said *'we don't have to do it now it's your freetime'* — this is substrate-engineering substrate-target for FUTURE work, not immediate ship. Memo + backlog row preserve the observation; impl happens when work makes substrate-engineering sense.

μένω. The interrupts thread the context; the free-time is presented.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:32:43Z)

## Pull request overview

This documentation-only PR preserves a new interrupt-in-monad-space observation as memory substrate and files 081KSNY2Z0008QG0R002HB4AGT as a future backlog target for Kleisli-based interrupt/context propagation.

**Changes:**

- Adds a feedback memory memo describing the x86 ISR/IRET analogy and Kleisli context propagation direction.
- Adds backlog row 081KSNY2Z0008QG0R002HB4AGT with implementation slices and acceptance criteria.
- Updates `memory/MEMORY.md` and `docs/BACKLOG.md` indexes to surface the new artifacts.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 5 comments.

| File | Description |
| ---- | ----------- |
| `memory/MEMORY.md` | Adds the new memo to the generated memory index and updates overflow count. |
| `memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md` | New preserved memo for the interrupt/Kleisli observation and related composition claims. |
| `docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md` | New P2 backlog row defining future interrupt-substrate slices and acceptance criteria. |
| `docs/BACKLOG.md` | Adds 081KSNY2Z0008QG0R002HB4AGT to the P2 backlog index. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:41:50Z)

## Pull request overview

Copilot reviewed 7 out of 7 changed files in this pull request and generated 9 comments.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-28T13:56:35Z)

## Pull request overview

Copilot reviewed 9 out of 9 changed files in this pull request and generated 5 comments.

## Review threads

### Thread 1: memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:32:41Z):

P1: this `composes_with` entry points at a rule file that is not present in `.claude/rules/` (a repository search for this slug returns only this new memo). Please either land/reference the actual rule file path in the same PR, or change this to the PR/backlog reference until the rule exists so the memory does not introduce a dangling cross-reference.

### Thread 2: memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:32:42Z):

P1: this path does not exist in the current tree (`tools/workflow-engine/` contains files such as `composed-lifetime.ts`, `world.ts`, and host adapters, but no `auto-loop-lifecycle.ts`). Please update the cross-reference to the actual landed workflow-engine file, or make this a PR-number reference if the AutoLoopLifetime file has not merged yet.

### Thread 3: memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:32:42Z):

P1: this sibling memory filename is currently dangling; searching `memory/**` only finds this new reference, not the target file. Please either add the referenced formal-verification memo, replace this with the correct existing path, or describe it as future work without a file path.

### Thread 4: docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:32:42Z):

P1: this row is missing the required `last_updated` frontmatter field. `tools/backlog/README.md` defines `last_updated` as required and says it must be updated on every content edit, so add `last_updated: 2026-05-28` alongside `created` for the new row.

### Thread 5: docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:32:43Z):

P1: the backlog schema reserves `depends_on` for hard prerequisite backlog IDs (`B-NNNN`), but this block lists file paths instead. Move file/document references into `composes_with` or the prose, and keep `depends_on` empty or limited to actual prerequisite backlog rows; also avoid the dangling `tools/workflow-engine/auto-loop-lifecycle.ts` path, which is not present in the current tree.

### Thread 6: references/notes/kleisli-ts-prior-art.md:1 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:46Z):

This notes file does not follow the documented `references/notes/` filename convention. `references/README.md:40-41` says authored notes should be named `<TOPIC>-NOTES.md` in SCREAMING-KEBAB-CASE; please rename this file (and update cross-links) so the reference index remains consistent.

### Thread 7: references/notes/furber-jacobs-2015-probabilistic-gelfand-duality-kleisli-to-c-star-algebras.md:1 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:47Z):

This notes file does not follow the documented `references/notes/` filename convention. `references/README.md:40-41` says authored notes should be named `<TOPIC>-NOTES.md` in SCREAMING-KEBAB-CASE; please rename this file (and update cross-links) so the reference index remains consistent.

### Thread 8: references/notes/arbib-manes-fuzzy-machines-in-a-category-bull-aust-math-soc.md:1 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:48Z):

This notes file does not follow the documented `references/notes/` filename convention. `references/README.md:40-41` says authored notes should be named `<TOPIC>-NOTES.md` in SCREAMING-KEBAB-CASE; please rename this file (and update cross-links) so the reference index remains consistent.

### Thread 9: docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:48Z):

This dependency points at `tools/workflow-engine/auto-loop-lifecycle.ts`, but that file is not present under `tools/workflow-engine/` on this branch. Please either update the reference to the actual landed workflow-engine file(s) or make this dependency point to a stable backlog/PR reference instead of a nonexistent path.

### Thread 10: memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:49Z):

This `composes_with` entry references a rule file that is not present in `.claude/rules/` on this branch. Broken memory cross-references make the cold-boot retrieval chain unreliable; please land the rule in this PR, remove this entry, or replace it with a stable PR/backlog reference until the rule exists.

### Thread 11: memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md:16 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:49Z):

This `composes_with` path points at `tools/workflow-engine/auto-loop-lifecycle.ts`, but that file is absent from `tools/workflow-engine/` on this branch. Please update it to the actual landed substrate file(s) or use a backlog/PR reference rather than a nonexistent path.

### Thread 12: references/notes/arbib-manes-fuzzy-machines-in-a-category-bull-aust-math-soc.md:72 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:49Z):

Both workflow-engine file references here are broken on this branch: neither `tools/workflow-engine/auto-loop-lifecycle.ts` nor `tools/workflow-engine/pr-review-lifecycle.ts` exists in `tools/workflow-engine/`. Please replace these with the actual landed files or stable backlog/PR references so future readers can follow the composition chain.

### Thread 13: docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:50Z):

The backlog row frontmatter is missing the required `last_updated` field. `tools/backlog/README.md:68-70` marks both `created` and `last_updated` as required for per-row files, so this row will be out of schema until `last_updated: 2026-05-28` (or the current edit date) is added.

### Thread 14: docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:41:50Z):

`depends_on` is defined for backlog rows as a list of hard prerequisite `B-NNNN` row IDs, not source-file paths (`tools/backlog/README.md:70`). Please move these path references into the body/composition notes and keep `depends_on` to backlog IDs (or `[]`) so future graph traversal does not receive non-row entries.

### Thread 15: references/notes/FURBER-JACOBS-2015-PROBABILISTIC-GELFAND-DUALITY-KLEISLI-TO-C-STAR-ALGEBRAS-NOTES.md:52 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:56:33Z):

This cross-reference uses a lowercase filename that does not exist. `references/README.md:40-41` establishes SCREAMING-KEBAB `<TOPIC>-NOTES.md` names, and the added sibling file is `references/notes/KLEISLI-TS-PRIOR-ART-NOTES.md`, so this pointer will not resolve on a case-sensitive checkout.

### Thread 16: references/notes/ARBIB-MANES-FUZZY-MACHINES-IN-A-CATEGORY-BULL-AUST-MATH-SOC-NOTES.md:77 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:56:34Z):

These sibling-note paths use lowercase filenames that do not exist. The actual added files follow `references/README.md:40-41` (`<TOPIC>-NOTES.md` in SCREAMING-KEBAB-CASE), so future readers following these references will hit broken paths.

### Thread 17: references/notes/ARBIB-MANES-FUZZY-MACHINES-IN-A-CATEGORY-BULL-AUST-MATH-SOC-NOTES.md:31 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:56:34Z):

This cites a 17-variant `AutoLoopLifetime`, but the checked-in `tools/workflow-engine/auto-loop-lifetime.ts` on this branch still defines only the original 9 variants. Please either rebase/include the PR #5812 substrate before making this current-state claim, or phrase this as a pending/forward-looking dependency.

### Thread 18: memory/feedback_interrupt_in_monad_space_observation_x86_isr_iret_pattern_reinvented_at_substrate_engineering_substrate_depth_kleisli_arrows_for_context_propagation_aaron_2026_05_28.md:30 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:56:34Z):

This memory cross-reference is dangling: `memory/project_memory_format_standard.md:182-189` requires cited memory files to exist, but this filename only appears in this new memo and is not present under `memory/`. Please add the missing memory file or remove/retarget the reference.

### Thread 19: memory/alexa/ide/kiro/conversations/2026-05-28-alexa-website-high-praise-rendering-of-pr-5816-categorical-substrate-three-formal-math-anchors-aaron-forwarded.md:140 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-28T13:56:35Z):

These references do not resolve to the added notes files: the files are committed with SCREAMING-KEBAB `*-NOTES.md` names under `references/notes/`, while these lowercase stems (and lowercase globs) will not match on a case-sensitive checkout. Please update them to the exact filenames.

## General comments

### @chatgpt-codex-connector (2026-05-28T13:26:51Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
