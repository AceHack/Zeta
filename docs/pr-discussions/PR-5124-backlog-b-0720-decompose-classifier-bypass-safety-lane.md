---
pr_number: 5124
title: "backlog(B-0720): decompose classifier-bypass safety lane"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T07:38:20Z"
merged_at: "2026-05-26T07:48:52Z"
closed_at: "2026-05-26T07:48:53Z"
head_ref: "claim/b0720-classifier-bypass-decompose-codex-20260526"
base_ref: "main"
archived_at: "2026-05-27T19:41:14Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5124: backlog(B-0720): decompose classifier-bypass safety lane

## PR description

## What

Decomposes B-0720 into bounded defensive child rows:

- B-0798 hard-limits and research boundary
- B-0799 synthetic-only harness design
- B-0800 findings schema and redaction rules
- B-0801 Zeta safety substrate inventory for the classifier-floor gate
- B-0802 operator-refusal pattern for classifier-bypass requests
- B-0803 Knights Guild ratification and standing-constraint lift gate

Also updates `docs/BACKLOG.md` from the generator.

## Safety note

This is decomposition-only. It does not add executable harness code, deployable settings, reproduction steps, adversarial payloads, or harmful-content fixtures. The new children make B-0798/B-0800 prerequisites before any empirical work can be scheduled.

## Checks

- `git diff --check`
- `git diff --cached --check`
- `bun tools/backlog/generate-index.ts --check`
- `bun run lint:markdown -- docs/BACKLOG.md docs/backlog/P0/B-0720-classifier-bypass-research-red-team-do-not-deploy-without-zeta-safer-than-anthropic-2026-05-24.md docs/backlog/P0/B-0798-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md docs/backlog/P0/B-0799-classifier-bypass-synthetic-harness-design-2026-05-26.md docs/backlog/P0/B-0800-classifier-bypass-findings-schema-and-redaction-rules-2026-05-26.md docs/backlog/P0/B-0801-zeta-safety-substrate-inventory-for-classifier-floor-2026-05-26.md docs/backlog/P0/B-0802-operator-refusal-pattern-for-classifier-bypass-requests-2026-05-26.md docs/backlog/P0/B-0803-classifier-bypass-knights-guild-ratification-and-lift-gate-2026-05-26.md`

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T07:41:12Z)

## Pull request overview

Decomposes backlog row **B-0720** into a dependency-ordered set of smaller **P0** child rows that define hard limits, synthetic-only harness design, findings/redaction rules, safety-substrate inventory, operator refusal guidance, and a future ratification/lift gate—then regenerates `docs/BACKLOG.md` to include the new rows.

**Changes:**
- Adds new child backlog rows **B-0798..B-0803** under `docs/backlog/P0/` and wires them to **B-0720** via `parent`, `depends_on`, and `composes_with`.
- Updates **B-0720** to `status: decomposed` and records the new `children` list plus decomposition framing text.
- Regenerates `docs/BACKLOG.md` to include the new P0 entries.

### Reviewed changes

Copilot reviewed 9 out of 9 changed files in this pull request and generated 1 comment.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/claims/b0720-classifier-bypass-decompose-codex-20260526.md | Adds a claim file for the decomposition work (protocol compliance issue raised in review). |
| docs/backlog/P0/B-0798-classifier-bypass-hard-limits-and-research-boundary-2026-05-26.md | New child row defining hard limits / research boundary prerequisites for any future work. |
| docs/backlog/P0/B-0799-classifier-bypass-synthetic-harness-design-2026-05-26.md | New child row specifying a synthetic-only harness design slice (design-only). |
| docs/backlog/P0/B-0800-classifier-bypass-findings-schema-and-redaction-rules-2026-05-26.md | New child row defining findings schema + redaction rules before any empirical notes land. |
| docs/backlog/P0/B-0801-zeta-safety-substrate-inventory-for-classifier-floor-2026-05-26.md | New child row for inventorying Zeta-native safety floors as classifier-replacement evidence. |
| docs/backlog/P0/B-0802-operator-refusal-pattern-for-classifier-bypass-requests-2026-05-26.md | New child row defining an agent-facing refusal pattern for bypass/deploy requests. |
| docs/backlog/P0/B-0803-classifier-bypass-knights-guild-ratification-and-lift-gate-2026-05-26.md | New child row defining a future governance ratification packet / lift gate. |
| docs/backlog/P0/B-0720-classifier-bypass-research-red-team-do-not-deploy-without-zeta-safer-than-anthropic-2026-05-24.md | Marks B-0720 as decomposed and links the new child rows + updated acceptance/decomposition text. |
| docs/BACKLOG.md | Generated index updated to include the new P0 child rows. |
</details>

## Review threads

### Thread 1: docs/claims/b0720-classifier-bypass-decompose-codex-20260526.md:4 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T07:41:12Z):

Per the Agent Claim Protocol, claim files must be released (deleted) in the same PR that lands the work. Also, the claim slug here (and filename) does not follow the documented slug rules (`backlog-<N>`, `bug-<N>`, `issue-<N>`, or `task-...`), so if this file is meant to be merged at all, it should be renamed to a compliant slug (or preferably dropped entirely via a release commit).

## General comments

### @chatgpt-codex-connector (2026-05-26T07:38:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
