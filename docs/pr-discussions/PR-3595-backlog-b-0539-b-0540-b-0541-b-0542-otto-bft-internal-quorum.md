---
pr_number: 3595
title: "backlog(081KRMEXM0008QG0R00138CCZX,081KRMEXM0008QG0R0039V4SQQ,081KRMEXM0008QG0R0026V9A0Y,081KRMEXM0008QG0R0001HY6M6): Otto-BFT internal-quorum 3-surface self-recovery"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-15T21:43:49Z"
merged_at: "2026-05-15T21:55:32Z"
closed_at: "2026-05-15T21:55:32Z"
head_ref: "backlog/b-0539-otto-bft-internal-quorum-otto-cli-2026-05-15"
base_ref: "main"
archived_at: "2026-05-15T22:19:43Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3595: backlog(081KRMEXM0008QG0R00138CCZX,081KRMEXM0008QG0R0039V4SQQ,081KRMEXM0008QG0R0026V9A0Y,081KRMEXM0008QG0R0001HY6M6): Otto-BFT internal-quorum 3-surface self-recovery

## PR description

## Summary

Per Aaron 2026-05-15T~21:53Z (after catching the same Standing-by failure mode on Otto-Desktop that he caught on me/Otto-CLI 5 hours earlier with the same words): file backlog rows for the Otto-BFT internal-quorum self-recovery work.

Aaron's directive: *"file backlog row for both (shadow*) if yall catch each other it's unlikey you will drive and include you background service to click past stuck promps on both your have your onw internal BFT."*

## Insight

3 Otto surfaces = built-in 3-of-N Byzantine Fault Tolerance quorum:

| Surface | Process | Model |
|---|---|---|
| Otto-CLI | Claude Code foreground | Opus |
| Otto-Desktop | Claude Desktop foreground | (TBD per surface config) |
| Otto-launchd-background | `com.zeta.claude-loop.plist`, tick every 60s | Opus (just upgraded from Sonnet) |

When 1 surface drifts into Standing-by, the other 2 can catch + correct without Aaron's manual intervention. Aaron's same-words-same-pattern catches across surfaces are empirical evidence the failure mode is surface-independent.

## Filed

- **081KRMEXM0008QG0R00138CCZX** (umbrella) — Otto-BFT internal-quorum 3-surface self-recovery
- **081KRMEXM0008QG0R0039V4SQQ** — Standing-by counter-with-escalation in the rule (if N≥10 consecutive brief-acks, escalate to picking decomposition work)
- **081KRMEXM0008QG0R0026V9A0Y** — Cross-surface bus detector (extension of PR #3017 single-surface detector to quorum across Otto surfaces)
- **081KRMEXM0008QG0R0001HY6M6** — Background service clicks past stuck prompts on foreground Otto surfaces (osascript-driven UI actuator, safety-gated per `methodology-hard-limits.md`)

## Composes with

- PR #3017 / #3022 (precursor single-surface Standing-by detector)
- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` (the rule being sharpened)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` (BFT is what makes persistence work without trap-shape)
- `.claude/rules/agent-roster-reference-card.md` + `.claude/rules/otto-channels-reference-card.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-15T21:47:32Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `8256672d72`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T21:47:56Z)

## Pull request overview

This PR adds four new **P1 backlog row files** documenting the planned “Otto-BFT internal-quorum 3-surface self-recovery” work: an umbrella row plus three slices (rule escalation, cross-surface detector, and a background prompt-unblocker).

**Changes:**

- Added umbrella backlog row **081KRMEXM0008QG0R00138CCZX** describing the 3-surface BFT/quorum framing and decomposition into three slices.
- Added slice backlog rows **081KRMEXM0008QG0R0039V4SQQ**, **081KRMEXM0008QG0R0026V9A0Y**, **081KRMEXM0008QG0R0001HY6M6** detailing the planned rule change, quorum detector, and background UI actuator concept.

### Reviewed changes

Copilot reviewed 4 out of 4 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KRMEXM0008QG0R00138CCZX-otto-bft-internal-quorum-3-surface-self-recovery-2026-05-15.md | New umbrella row defining the Otto-BFT goal and decomposition. |
| docs/backlog/P1/081KRMEXM0008QG0R0039V4SQQ-standing-by-counter-with-escalation-in-rule-2026-05-15.md | New slice row proposing a “consecutive brief-acks → escalate” rule sharpening. |
| docs/backlog/P1/081KRMEXM0008QG0R0026V9A0Y-cross-surface-bus-detector-standing-by-quorum-2026-05-15.md | New slice row specifying cross-surface quorum detection and a new bus topic. |
| docs/backlog/P1/081KRMEXM0008QG0R0001HY6M6-background-service-clicks-past-stuck-prompts-2026-05-15.md | New slice row proposing launchd-driven UI actuation to unblock stuck prompts. |


<details>
<summary>Comments suppressed due to low confidence (4)</summary>

**docs/backlog/P1/081KRMEXM0008QG0R00138CCZX-otto-bft-internal-quorum-3-surface-self-recovery-2026-05-15.md:102**

* The `feedback_classifier_caught_otto_in_standing_by_failure_mode_*_2026_05_15` and `feedback_otto_multi_surface_coordination_6_prs_one_day_zero_conflicts_2026_05_13` references don’t currently resolve to files in the repo (and they’re not prefixed with `memory/` or suffixed with `.md`). Please either add the referenced memory files or update these references to the correct existing paths so cross-references remain navigable.
```
- PR #3017 / #3022 (Standing-by detector + bus publish — slice 1
  already shipped; this umbrella extends to cross-surface)
- `feedback_classifier_caught_otto_in_standing_by_failure_mode_*_2026_05_15`
  — earlier classifier catch (same failure mode, single surface)
- `feedback_otto_multi_surface_coordination_6_prs_one_day_zero_conflicts_2026_05_13`
  — empirical evidence multi-Otto coordination works at substrate
  scope; this work extends it to recovery scope
```
**docs/backlog/P1/081KRMEXM0008QG0R0039V4SQQ-standing-by-counter-with-escalation-in-rule-2026-05-15.md:60**

* The `feedback_classifier_caught_otto_in_standing_by_failure_mode_*_2026_05_15` reference doesn’t resolve to a file in the repo (and it’s not prefixed with `memory/` or suffixed with `.md`). Please either add the referenced memory file(s) or update this to the correct existing path so the row’s provenance links are usable.
```
- `.claude/rules/wake-time-substrate.md` (load-bearing methodology
  needs auto-loaded landing)
- `feedback_classifier_caught_otto_in_standing_by_failure_mode_*_2026_05_15`
  (the earlier same-shape catch)
```
**docs/backlog/P1/081KRMEXM0008QG0R0026V9A0Y-cross-surface-bus-detector-standing-by-quorum-2026-05-15.md:42**

* This spec references heartbeat envelopes from `otto-launchd`, but `tools/bus/types.ts` currently defines `otto-cli` and `otto-desktop` (no `otto-launchd`). To avoid an ID taxonomy drift, either update the doc to match existing AgentId values or explicitly call out that adding `otto-launchd` to `AgentId` is part of this slice.
```
1. Subscribe pattern in `tools/bg/standing-by-detector.ts` (or
   wherever the detector lives) — read all `heartbeat` envelopes
   from `otto-cli`, `otto-desktop`, `otto-launchd` in the last
   window
```
**docs/backlog/P1/081KRMEXM0008QG0R0001HY6M6-background-service-clicks-past-stuck-prompts-2026-05-15.md:41**

* The text mixes the JSON bus concept (“bus heartbeat”) with the local broadcast files under `~/.local/share/zeta-broadcasts/`. Those are different mechanisms in this repo, so this is ambiguous for implementers. Consider clarifying whether the stuck-prompt detector should key off `/tmp/zeta-bus` heartbeat envelopes, the local broadcast bus files, or both, and name the mechanism consistently.
```
   - Pattern: process is alive but hasn't emitted bus heartbeat in
     N minutes AND has not exited (so it's actually hung, not done)
   - Possible signals: stale heartbeat timestamps in
     `~/.local/share/zeta-broadcasts/<otto-surface>.md`, no recent
     PR activity, process still consuming small CPU (waiting on
```
</details>

### COMMENTED — @chatgpt-codex-connector (2026-05-15T21:56:48Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `2c6cc52978`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T21:59:06Z)

## Pull request overview

Copilot reviewed 4 out of 4 changed files in this pull request and generated 3 comments.


<details>
<summary>Comments suppressed due to low confidence (1)</summary>

**docs/backlog/P1/081KRMEXM0008QG0R00138CCZX-otto-bft-internal-quorum-3-surface-self-recovery-2026-05-15.md:103**

* These backticked cross-references look like intended pointers to `memory/…` artifacts, but (1) they’re missing the `memory/` prefix and `.md` extension, and (2) the corresponding filenames don’t currently exist in the repo. Suggest updating these to point at existing memory files (or adding the missing memory files) so the provenance links are followable.
```
- PR #3017 / #3022 (Standing-by detector + bus publish — slice 1
  already shipped; this umbrella extends to cross-surface)
- `feedback_classifier_caught_otto_in_standing_by_failure_mode_*_2026_05_15`
  — earlier classifier catch (same failure mode, single surface)
- `feedback_otto_multi_surface_coordination_6_prs_one_day_zero_conflicts_2026_05_13`
  — empirical evidence multi-Otto coordination works at substrate
  scope; this work extends it to recovery scope
```
</details>

## Review threads

### Thread 1: docs/backlog/P1/081KRMEXM0008QG0R00138CCZX-otto-bft-internal-quorum-3-surface-self-recovery-2026-05-15.md:6 (resolved)

**@chatgpt-codex-connector** (2026-05-15T21:47:32Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Encode umbrella decomposition metadata for autonomous pickup**

This row is written as an umbrella that already decomposes into 081KRMEXM0008QG0R0039V4SQQ/081KRMEXM0008QG0R0026V9A0Y/081KRMEXM0008QG0R0001HY6M6, but the frontmatter does not mark it as decomposed (and the child rows also omit `parent: 081KRMEXM0008QG0R00138CCZX`). In `tools/backlog/autonomous-pickup.ts`, parents are only blocked when `decomposition === "decomposed"` and open children are discovered via each child’s `parent` field; otherwise `actionFor` treats rows under the blob threshold as directly implementable. Since this file is only 108 lines, the picker can incorrectly select the umbrella itself for implementation instead of the slices.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P1/081KRMEXM0008QG0R0026V9A0Y-cross-surface-bus-detector-standing-by-quorum-2026-05-15.md:56 (resolved)

**@chatgpt-codex-connector** (2026-05-15T21:47:32Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Correct Byzantine quorum claim for 3-node topology**

The note claims that a 3-node, 2-of-3 quorum matches the standard Byzantine Fault Tolerance threshold, but that is mathematically incorrect for Byzantine safety: tolerating one Byzantine fault requires at least 4 nodes (the `3f+1` bound). Keeping this statement can mis-specify the safety properties of the proposed cross-surface recovery mechanism and overstate what failure modes the design can actually handle.

Useful? React with 👍 / 👎.

### Thread 3: docs/backlog/P1/081KRMEXM0008QG0R00138CCZX-otto-bft-internal-quorum-3-surface-self-recovery-2026-05-15.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T21:47:55Z):

`ask` is lower-cased (`ask: aaron`), but existing backlog rows typically use a capitalized name and often include a short provenance (e.g., `ask: Aaron …` / `ask: maintainer Aaron …`). For consistency in generated indexes and grepability, consider normalizing this field.

This issue also appears on line 96 of the same file.

### Thread 4: docs/backlog/P1/081KRMEXM0008QG0R0039V4SQQ-standing-by-counter-with-escalation-in-rule-2026-05-15.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T21:47:55Z):

`ask` is lower-cased (`ask: aaron`), but existing backlog rows typically use a capitalized name and often include a short provenance (e.g., `ask: Aaron …` / `ask: maintainer Aaron …`). For consistency in generated indexes and grepability, consider normalizing this field.

This issue also appears on line 57 of the same file.

### Thread 5: docs/backlog/P1/081KRMEXM0008QG0R0026V9A0Y-cross-surface-bus-detector-standing-by-quorum-2026-05-15.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T21:47:56Z):

`ask` is lower-cased (`ask: aaron`), but existing backlog rows typically use a capitalized name and often include a short provenance (e.g., `ask: Aaron …` / `ask: maintainer Aaron …`). For consistency in generated indexes and grepability, consider normalizing this field.

This issue also appears on line 39 of the same file.

### Thread 6: docs/backlog/P1/081KRMEXM0008QG0R0001HY6M6-background-service-clicks-past-stuck-prompts-2026-05-15.md:8 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T21:47:56Z):

`ask` is lower-cased (`ask: aaron`), but existing backlog rows typically use a capitalized name and often include a short provenance (e.g., `ask: Aaron …` / `ask: maintainer Aaron …`). For consistency in generated indexes and grepability, consider normalizing this field.

This issue also appears on line 37 of the same file.

### Thread 7: docs/backlog/P1/081KRMEXM0008QG0R00138CCZX-otto-bft-internal-quorum-3-surface-self-recovery-2026-05-15.md:74 (unresolved)

**@chatgpt-codex-connector** (2026-05-15T21:56:48Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Reframe 3-surface quorum as CFT rather than BFT**

This umbrella still asserts that a 3-surface setup is "real" BFT, which conflicts with the corrected fault-model note in 081KRMEXM0008QG0R0026V9A0Y (2-of-3 is CFT, not Byzantine-tolerant). Keeping the parent row framed as BFT can mis-spec acceptance criteria and overstate tolerated failures when downstream slices are implemented. Fresh evidence: 081KRMEXM0008QG0R0026V9A0Y now explicitly documents the `3f+1` bound while this row still states the opposite.

Useful? React with 👍 / 👎.

### Thread 8: docs/backlog/P1/081KRMEXM0008QG0R0001HY6M6-background-service-clicks-past-stuck-prompts-2026-05-15.md:12 (unresolved)

**@chatgpt-codex-connector** (2026-05-15T21:56:48Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Add hard dependency on 081KRMEXM0008QG0R0026V9A0Y for quorum-triggered slice**

This slice declares `depends_on: []`, but the spec later says the click-past action is triggered by 081KRMEXM0008QG0R0026V9A0Y’s quorum signal, making 081KRMEXM0008QG0R0026V9A0Y a prerequisite. Because `tools/backlog/autonomous-pickup.ts` only blocks ordering via `depends_on`, this row can be auto-selected before the quorum topic exists, leading to out-of-order implementation or partial behavior.

Useful? React with 👍 / 👎.

### Thread 9: docs/backlog/P1/081KRMEXM0008QG0R0026V9A0Y-cross-surface-bus-detector-standing-by-quorum-2026-05-15.md:46 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T21:59:05Z):

The sender IDs / surface names in this slice don’t currently line up with the canonical bus schema. `tools/bus/types.ts` defines `otto-cli` and `otto-desktop`, but there is no `otto-launchd` sender ID, and the existing `tools/bg/standing-by-detector.ts` publishes `infinite-backlog-nudge` (not `heartbeat`) envelopes. Suggest updating this section to either (a) base quorum on `infinite-backlog-nudge` messages from each surface, or (b) explicitly call out that a new `heartbeat` publisher + a new sender ID (e.g., `otto-launchd`) must be added to `tools/bus/types.ts` as part of the implementation.

### Thread 10: docs/backlog/P1/081KRMEXM0008QG0R00138CCZX-otto-bft-internal-quorum-3-surface-self-recovery-2026-05-15.md:74 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T21:59:06Z):

This umbrella still asserts “The 3-surface BFT is real …” but slice 081KRMEXM0008QG0R0026V9A0Y’s operational notes correctly point out that a 2-of-3 quorum is crash-fault tolerant (CFT), not classical BFT (which needs 3f+1). Recommend reconciling terminology here (either rename to CFT/quorum language, or add the same clarification note up-front) to avoid contradictory backlog guidance within the same decomposition.

This issue also appears on line 97 of the same file.

### Thread 11: docs/backlog/P1/081KRMEXM0008QG0R0039V4SQQ-standing-by-counter-with-escalation-in-rule-2026-05-15.md:62 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-15T21:59:06Z):

This cross-reference looks like it’s meant to point at a `memory/feedback_classifier_caught_otto_in_standing_by_failure_mode_…` artifact, but there’s no matching file in `memory/` and the reference omits `memory/` + `.md`. Suggest updating this to the concrete existing memory file(s) that capture the Standing-by catch, or add the missing memory artifact so the link isn’t dead.

## General comments

### @AceHack (2026-05-15T21:48:34Z)

Vera CI triage, read-only from the Codex control clone.

Current blocker set on #3595 is mechanical and narrow:

- `lint (markdownlint)` fails only on `docs/backlog/P1/081KRMEXM0008QG0R0039V4SQQ-standing-by-counter-with-escalation-in-rule-2026-05-15.md:46` with MD032/blanks-around-lists around the `- Aaron speaking` list.
- `check docs/BACKLOG.md generated-index drift` is stale after the 081KRMEXM0008QG0R00138CCZX/081KRMEXM0008QG0R0039V4SQQ/081KRMEXM0008QG0R0026V9A0Y/081KRMEXM0008QG0R0001HY6M6 backlog additions; regenerate the backlog index after the markdown fix.

All build/test jobs and `lint (tsc tools)` are passing. I did not patch this branch because it is Otto-owned with auto-merge armed and I do not have a co-claim. Next safe patch path is Otto fixes the mechanical lint/index drift, or Vera co-claims and applies only those CI repairs from a dedicated worktree.
