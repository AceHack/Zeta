---
pr_number: 5074
title: "docs(persona/max): add tier-2 Docker Desktop dev-experience workstream"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T03:16:05Z"
merged_at: "2026-05-26T03:17:46Z"
closed_at: "2026-05-26T03:17:46Z"
head_ref: "otto-cli/max-persona-tier2-docker-desktop-workstream-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5074: docs(persona/max): add tier-2 Docker Desktop dev-experience workstream

## PR description

## Summary

Adds Max's near-term primary workstream — **owning the tier-2 Docker Desktop + Kubernetes dev-experience** for the Zeta cluster substrate — to his persona files.

Aaron 2026-05-25: *"okay can you make a pr and up maxes persona with this updated responsiblity and i'll send him a link once it's on master."* This PR puts the updated persona on `main` so Aaron can send Max a permanent URL.

## Workstream scope (added to PERSONA.md + STARTING-POINT.md)

- **Tier-2 in the three-tier testing story** (081KSE6WT0008QG0R000RH1526): middle tier between Aaron+Otto's pure-code F# Local Loop (tier-1) and the full real cluster (tier-3 already shipping per 081KSGS9H0008QG0R002T3BJ2R)
- **Sub-scopes**: Argo CD sync-wave debugging; OTel observability matching CNI mesh shape; 30+ chart coverage matrix; CI testing on kind/k3d + GitHub workflows; `zeta dev up` developer-facing surface
- **Topology**: Docker Desktop ships native multi-node kind (1–10 node slider; default 3 for consensus-quorum testing); multi-cluster federation lives in CI, not always-on locally
- **Touch ID / biometrics**: Max gets the zflash Touch ID + PAM pattern for all privileged macOS operations; never types passwords for admin
- **Skills-and-scripts encoding contract**: every Docker Desktop UX interaction ends as TS script (per Rule 0), Claude Code skill, or backlog row — nothing lost in chat

## Files changed

- `memory/max/PERSONA.md` — new "Current focus" section with workstream contract + 5 sub-scopes + topology substrate + Touch ID integration + skills-and-scripts contract + composes-with cluster
- `memory/max/STARTING-POINT.md` — new "Current focus" section with 8-file cold-boot reading list + applicable disciplines + 5 concrete first deliverables + updated 30-day success metrics

`NOTEBOOK.md` not modified — Max's own running notes surface.

## Test plan

- [x] markdownlint clean
- [x] No new files (only edits to existing persona files)
- [x] Cross-references resolve (081KSE6WT0008QG0R000RH1526, 081KSE6WT0008QG0R003G0Y62D, 081KSE6WT0008QG0R0029S1D5Z, 081KSE6WT0008QG0R002275NDE, 081KSE6WT0008QG0R000C18G5D, zflash-setup.ts, zeta-install.sh, .claude/rules/*)
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T03:16:59Z)

## Pull request overview

Documentation-only PR adding Max's near-term workstream (tier-2 Docker Desktop + Kubernetes dev-experience) to his persona files under `memory/max/`. Both files are on the history-surface allowlist (`memory/**`), so persona name attribution is in-policy.

**Changes:**
- Adds "Current focus" section to `PERSONA.md` describing the tier-2 workstream, sub-scopes, topology, Touch ID integration, and skills/scripts encoding contract
- Adds matching "Current focus" section to `STARTING-POINT.md` with cold-boot reading list, applicable disciplines, first deliverables, and updated 30-day success metrics

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| memory/max/PERSONA.md | New "Current focus — tier-2 Docker Desktop dev-experience workstream" section with tier table, sub-scopes, topology, Touch ID pattern, encoding contract, and composes-with links |
| memory/max/STARTING-POINT.md | New "Current focus" section with cold-boot reading list, disciplines, concrete first deliverables, and 30-day success metrics |

## General comments

### @chatgpt-codex-connector (2026-05-26T03:16:10Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
