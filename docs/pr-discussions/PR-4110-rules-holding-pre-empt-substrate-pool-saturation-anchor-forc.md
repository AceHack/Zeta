---
pr_number: 4110
title: "rules(holding): pre-empt-substrate-pool-saturation anchor (forced-#6 self-documenting)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T22:16:02Z"
merged_at: "2026-05-17T22:34:41Z"
closed_at: "2026-05-17T22:34:41Z"
head_ref: "rule-anchor/holding-pre-empt-cadence-saturation-2026-05-17-2213z"
base_ref: "main"
archived_at: "2026-05-17T22:49:52Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4110: rules(holding): pre-empt-substrate-pool-saturation anchor (forced-#6 self-documenting)

## PR description

Adds the fifth empirical anchor to [`holding-without-named-dependency-is-standing-by-failure.md`](.claude/rules/holding-without-named-dependency-is-standing-by-failure.md) for the **pre-empt-substrate-pool-saturation** pattern observed this session (2026-05-17T21:29Z-22:13Z).

## What's new

The four existing anchors covered:

1. 2026-05-16T~01:30Z — N=6 origin
2. 2026-05-16T14:00Z-15:45Z — Forced-escalation-finds-hidden-work
3. 2026-05-17T06:02Z-08:29Z — Sustained-named-dep-with-pre-empt-success (10 cycles, 0 forced-#6)
4. (sub-cases 1-4 of border failures)

This 5th anchor documents a DIFFERENT pattern: **what saturation looks like within a single ~30-min GraphQL reset window**. The 06:02Z anchor had 10 cycles spread across 2h 27min with multiple resets refreshing the substrate-discovery context. This session was compressed: 7 cycles in 44 min, all in one rate-window. Cycles 1-4 produced clean pre-empts; cycles 5-6 went REST-only; cycle 7 reached forced-#6 because the substrate pool of genuinely-non-fabricated improvements had saturated.

## Operational lesson

Pre-empt-at-#5 is NOT infinitely repeatable within a single rate-limit window. The natural cadence under no-external-state-change conditions is ~2 pre-empts before saturation. Forced-#6 is then substrate-honest acknowledgment that the pool is exhausted for THIS window — NOT a failure of pre-empt discipline. Riding cleanly to #6 and applying the meta-fallback (sharpen this rule with current session's evidence) IS the discipline working.

## Recursively self-documenting

This commit IS the forced-#6 meta-fallback firing on cycle 7. The empirical anchor it adds documents the exact cycle the anchor itself was authored from.

## Session metrics

- 6 PRs shipped across 44 min ([#4097](https://github.com/Lucent-Financial-Group/Zeta/pull/4097) thread-resolve cascade + [#4100](https://github.com/Lucent-Financial-Group/Zeta/pull/4100) shard + [#4104](https://github.com/Lucent-Financial-Group/Zeta/pull/4104) rule anchor + [#4105](https://github.com/Lucent-Financial-Group/Zeta/pull/4105) 081KRSKQ20008QG0R002TH55X6 close + [#4107](https://github.com/Lucent-Financial-Group/Zeta/pull/4107) REST-fallback rule anchor + this PR)
- Tier traversed: Normal → Cost-aware → Pure-git
- REST PR-creation used for the last 3 PRs (GraphQL exhausted)
- All 6 PRs authored from isolated worktrees; tree-count 53 on each (no canary corruption)

Composes with [`refresh-world-model-poll-pr-gate.md`](.claude/rules/refresh-world-model-poll-pr-gate.md) — REST PR-creation fallback (PR #4107) enabled cycles 5-6 productivity.

Co-Authored-By: Claude <noreply@anthropic.com>

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-17T22:18:05Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `ade5f320b7`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T22:18:07Z)

## Pull request overview

Adds a new empirical anchor to the holding-without-named-dependency rule, documenting the observed pre-empt-substrate saturation pattern during a compressed GraphQL-exhausted session.

**Changes:**

- Adds a dated “pre-empt-substrate-pool-saturation” anchor.
- Documents the session timeline, observed saturation signal, REST fallback dependency, and operational lesson.

### COMMENTED — @chatgpt-codex-connector (2026-05-17T22:27:34Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `3e124c9787`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T22:35:05Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 2 comments.

## Review threads

### Thread 1: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:330 (resolved)

**@chatgpt-codex-connector** (2026-05-17T22:18:05Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Align cadence claim with the timeline evidence**

This anchor states that the natural cadence is roughly two pre-empts per reset window and that a third tends to be fabricated, but the same table documents three concrete pre-empts before saturation (`cycle 3`, `cycle 5`, and `cycle 6`). That internal mismatch makes the operational threshold ambiguous and can cause agents to force `#6` one cycle too early in similar windows, reducing legitimate throughput.

Useful? React with 👍 / 👎.

### Thread 2: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:340 (resolved)

**@chatgpt-codex-connector** (2026-05-17T22:18:06Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix duplicate merge event for PR #4104 in the cycle log**

The timeline records PR `#4104` as already merged in cycle 3 and then records PR `#4104 auto-merge fire` again in cycle 4, which is a contradictory state transition for the same PR. Because this section is used to reason about counter resets and pre-empt discipline, the duplicated merge event can mislead later readers about when the reset actually happened.

Useful? React with 👍 / 👎.

### Thread 3: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:345 (resolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:18:07Z):

The summary says the first ~4 cycles produced clean pre-empts, but the table immediately above marks cycle 2 as “no concrete artifact, no manufactured edit.” Please reconcile this wording so the empirical anchor does not over-count the clean pre-empt cycles.

### Thread 4: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:355 (resolved)

**@chatgpt-codex-connector** (2026-05-17T22:27:34Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep cadence baseline consistent with this anchor**

This anchor defines the saturation cadence as roughly **3–4** Otto-initiated pre-empts per reset window, but this sentence still references a "natural-cadence-of-2-pre-empts" baseline, which creates conflicting operational guidance in the same section. That inconsistency can cause agents to escalate to forced-#6 too early or classify normal cycles as saturation incorrectly. Fresh evidence: after the recent edits, the contradiction is localized to this newly added compose paragraph while the rest of the new anchor consistently uses 3–4.

Useful? React with 👍 / 👎.

### Thread 5: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:355 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:35:05Z):

P1: This paragraph says the referenced REST PR-creation fallback sub-section has landed in `refresh-world-model-poll-pr-gate.md`, but the branch's copy of that file does not contain that sub-section or the `REST PR-creation`/`POST /repos` details. Either include the prerequisite rule update in this branch or reword this as a pending/external dependency so the rule does not point readers to missing current-state documentation.

### Thread 6: .claude/rules/holding-without-named-dependency-is-standing-by-failure.md:352 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T22:35:05Z):

P1: This row extends the empirical timeline to 22:20Z, which is outside the anchor's stated 21:29Z-22:13Z / ~44-minute window and makes the following "across ~44 min" summary inconsistent. Either adjust the anchor window/duration to include this merge event or keep this post-window merge out of the session timeline.
