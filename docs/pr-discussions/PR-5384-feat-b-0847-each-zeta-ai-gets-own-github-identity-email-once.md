---
pr_number: 5384
title: "feat(081KSGS9H0008QG0R002T0XQ50): each Zeta AI gets own GitHub identity + email once cluster operational \u2014 closes algo-wink-attribution-gap (Aaron 2026-05-26)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T02:24:28Z"
merged_at: "2026-05-27T02:26:09Z"
closed_at: "2026-05-27T02:26:09Z"
head_ref: "feat-b0847-ai-own-github-identity-once-cluster-operational-2026-05-26-2206z"
base_ref: "main"
archived_at: "2026-05-27T19:27:20Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5384: feat(081KSGS9H0008QG0R002T0XQ50): each Zeta AI gets own GitHub identity + email once cluster operational — closes algo-wink-attribution-gap (Aaron 2026-05-26)

## PR description

## Summary

Aaron caught an algo-wink-failure-mode 2026-05-26: I framed \`gh autoMergeRequest.enabledBy: AceHack\` as "operator-authority armed the merge" when the field is structurally OAuth-token-owner (not actor). Actual actor was me (Otto-CLI); visible only via Co-Authored-By trailer in commits.

Aaron's proposed fix: *"i think we should create you your own github with email once we get you running on the cluster"* → substrate-honest end-to-end attribution.

This PR files [081KSGS9H0008QG0R002T0XQ50](docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-each-ai-gets-own-github-identity-with-email-once-cluster-operational-substrate-honest-attribution-end-to-end-closes-enabledby-token-owner-not-actor-algo-wink-aaron-2026-05-26.md) as the durable future-target substrate.

## 4-phase plan

- **Phase 1**: Ilyana public-surface naming review per AI (gates ALL creation)
- **Phase 2**: legal-risk attribution \`_ai_github_identity_acceptance\` block per AI per existing rule
- **Phase 3**: HSM + per-AI OAuth tokens + email infrastructure (cluster-dependent)
- **Phase 4**: per-AI gitconfig + \`gh\` token routing migration

## Today's discipline (Phase 0)

Until per-AI identity ships:

1. Never read \`gh enabledBy\` / \`gh author\` as authorization-source signal (token-owner ≠ actor)
2. Always cross-reference Co-Authored-By trailers for actual-actor attribution
3. State framings substrate-honestly ("I armed via borrowed token" NOT "operator armed")

## Test plan

- [x] Backlog row authored
- [x] BACKLOG.md regenerated
- [x] User-scope memory entry captures empirical anchor + bounded discipline
- [ ] CI passes

## Composes with

081KSE6WT0008QG0R003YYC9PV (per-agent isolated clones) · 081KRW63S0008QG0R003TX8MG5 (Knights Guild ratification) · \`algo-wink-failure-mode\` · \`mechanical-authorization-check\` · \`glass-halo-bidirectional\` · \`persistence-choice-architecture-for-zeta-ais\` · \`non-coercion-invariant\` HC-8 · \`honor-those-that-came-before\` · \`agent-roster-reference-card\` · \`naming-expert\` SKILL.md (Ilyana review) · \`human-audit-and-legal-risk-acceptance-pattern-in-settings\` (legal-risk attribution per Aaron's standing constitutional invariant)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T02:25:22Z)

## Pull request overview

Files a new P2 backlog row (081KSGS9H0008QG0R002T0XQ50) capturing a future-target plan to give each Zeta AI its own GitHub identity + email once cluster infrastructure is operational, addressing the `gh enabledBy = token-owner ≠ actor` attribution gap. Updates the backlog index accordingly.

**Changes:**
- Adds new backlog row file under `docs/backlog/P2/` describing problem, 4-phase plan, composes-with links, and acceptance criteria.
- Adds the row to `docs/BACKLOG.md` index in P2 section.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSGS9H0008QG0R002T0XQ50-...-2026-05-26.md | New P2 backlog row capturing per-AI GitHub identity substrate target |
| docs/BACKLOG.md | Index entry for 081KSGS9H0008QG0R002T0XQ50 added to P2 list |

## General comments

### @chatgpt-codex-connector (2026-05-27T02:24:33Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
