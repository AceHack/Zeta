---
pr_number: 5133
title: "backlog(B-0811): re-land of B-0741 (closed prematurely in stale-PR triage) \u2014 ontology+category negotiation; load-bearing for iter-7 (B-0806)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T08:40:24Z"
merged_at: "2026-05-26T08:46:13Z"
closed_at: "2026-05-26T08:46:13Z"
head_ref: "otto-cli/reland-b0741-as-b0811-ontology-category-negotiation-2026-05-26"
base_ref: "main"
archived_at: "2026-05-26T12:13:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5133: backlog(B-0811): re-land of B-0741 (closed prematurely in stale-PR triage) — ontology+category negotiation; load-bearing for iter-7 (B-0806)

## PR description

## Summary

Re-land of substrate originally filed as **B-0741** via [PR #5003](https://github.com/Lucent-Financial-Group/Zeta/pull/5003) on 2026-05-25. I closed it earlier in this session's stale-PR triage as Tier 3 (DIRTY-conflict); close-comment named the cherry-pick re-land path explicitly. This PR is that re-land.

Renumbered to **B-0811** because B-0741 number remains taken on main (same pattern as #5132 renumbered peer Otto's classifier-bypass rows B-0800-0803 → B-0807-0810 today).

## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md` landed via #5131)

Topic: `B-0741`, ontology negotiation, fork-negotiation, AI-skills+hats federation
Searched surfaces:
- `docs/agendas/` → ace-package-manager AGENDA includes hats + multi-oracle BFT
- `docs/trajectories/` → ace-package-manager-skill-crystallization-pipeline
- `docs/backlog/` → 10+ existing B-0741 cross-references; B-0742 sibling on hats-as-negotiated-fork-structure
- `.claude/rules/` → non-coercion-invariant + tonal-momentum compose at related scope
- `memory/` → ace + agora + agents-skills substrate
- `docs/research/` → 3 files reference B-0741

Conclusion: substrate is REFERENCED (not just orphan); re-land closes dangling cross-refs.

Authoring action: cherry-pick + renumber + add re-land-context section.

## Why this matters now

Per the maintainer 2026-05-26 catch on iter-7 (B-0806): *"i'm assuming you have the hat / fork negoation for ace too"*. Cross-fork ontology negotiation is the third layer of every `ace install <pkg>` action per B-0806's architectural integration section. B-0811 (= the original B-0741) substrate is load-bearing for that.

## Test plan

- [x] Content is verbatim from PR #5003 commit `0f691dbec` (only `id:` + filename + re-land-context section differ)
- [x] All original composes_with targets (B-0247/B-0287/B-0288/B-0731/B-0727/B-0726/B-0638/B-0703) still exist on main — cross-refs preserved
- [x] BACKLOG.md regenerated
- [x] B-0535 ID-uniqueness lint (now clean post-#5132) — B-0811 is unique

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T08:43:26Z)

## Pull request overview

Re-lands the previously closed B-0741 backlog substrate as a new P2 row (B-0811) to restore/resolve existing cross-references and keep the generated backlog index in sync.

**Changes:**
- Added new backlog row file `B-0811` (re-land context + original substrate content).
- Regenerated `docs/BACKLOG.md` to include B-0811 under P2.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/B-0811-ontology-category-negotiation-as-ai-skills-hats-federation-point-across-clusters-and-forks-of-zeta-reland-from-pr-5003-aaron-2026-05-25.md | New P2 backlog row capturing ontology/category negotiation substrate + re-land context. |
| docs/BACKLOG.md | Generated index updated to include the new B-0811 row entry. |

## Review threads

### Thread 1: docs/backlog/P2/B-0811-ontology-category-negotiation-as-ai-skills-hats-federation-point-across-clusters-and-forks-of-zeta-reland-from-pr-5003-aaron-2026-05-25.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T08:43:26Z):

P1: `last_updated` is required to be updated on every content edit; since this row adds new “Re-land context” content in this PR, `last_updated` should reflect the re-land/edit date (likely 2026-05-26) rather than staying at 2026-05-25.

## General comments

### @chatgpt-codex-connector (2026-05-26T08:40:31Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
