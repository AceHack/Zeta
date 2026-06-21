---
id: 081KS3X9Y0008QG0R000BJY3DK
priority: P3
status: open
title: Otto-VSCode third foreground surface — add otto-vscode to SENDER_IDS + canonical cold-boot bootstream at docs/launch/
tier: operational
effort: S
ask: aaron 2026-05-21 (VSCode auto-mode + remembered web conversation mode enabled)
created: 2026-05-21
last_updated: 2026-05-21
depends_on: []
composes_with: [081KR7JY10008QG0R000R503K2]
tags: [otto-vscode, multi-surface-coordination, sender-ids-extension, bootstream, claim-acquire, split-brain-prevention]
type: operational
---

# Otto-VSCode third foreground surface — SENDER_IDS extension + cold-boot bootstream

## Context

Aaron 2026-05-21: VSCode just enabled auto-mode + web-conversation-mode-that-can-be-remembered. This makes VSCode a viable third foreground surface for Otto (alongside Otto-CLI in tmux + Otto-Desktop in Claude Desktop).

Per `.claude/rules/claim-acquire-before-worktree-work.md`: when multiple instances of the same agent share git + bus on one machine, `--from` must differ for the claim-coordinator (`tools/bus/claim.ts`, 081KR7JY10008QG0R000R503K2 slice 3) to prevent split-brain. PR #3037 (2026-05-13) extended SENDER_IDS with surface-tagged variants — `otto-cli`, `otto-desktop`, etc. The same extension is needed for `otto-vscode` to prevent split-brain when the VSCode surface claims backlog rows alongside the other two Otto surfaces.

## Scope (small + bounded)

### 1. Add `otto-vscode` to SENDER_IDS

Extend `tools/bus/claim.ts` (and any sibling registry; check `tools/bus/*` for the canonical SENDER_IDS const). Should be a 1-line addition matching the existing `otto-cli` / `otto-desktop` pattern.

### 2. Canonical cold-boot bootstream

Land `docs/launch/2026-05-21-otto-vscode-bootstream.md` with the cold-boot prompt for the VSCode surface. Mirrors:

- `docs/launch/2026-05-13-otto-claude-desktop-bootstream-tight.md` (Otto-Desktop bootstream from PR #3030)
- The substrate Aaron forwarded 2026-05-21 in conversation (drafted by Otto-CLI, ready to commit)

Content includes:

- Cold-boot bootstream order (CLAUDE.md → AGENTS.md → ALIGNMENT.md → VISION.md)
- Auto-loaded rule reference list (`.claude/rules/*.md`)
- Surface identity (otto-vscode sender ID for claim-acquire)
- Peer-surface awareness (otto-cli + otto-desktop + otto-vscode)
- Auto-mode + remembered-web-conversation operational discipline
- First 3 actions: git log orient + CronList sentinel check + read CLAUDE.md

### 3. Update agent-roster-reference-card

Add `Otto-VSCode` as a third Otto surface row (alongside Otto-CLI + Otto-Desktop). Note auto-mode + remembered-conversation features. Update common-confusion-patterns section if needed.

## Acceptance

- [ ] `tools/bus/claim.ts` SENDER_IDS includes `otto-vscode`; existing `otto-cli`/`otto-desktop` tests still pass
- [ ] `docs/launch/2026-05-21-otto-vscode-bootstream.md` lands with the canonical cold-boot prompt
- [ ] `.claude/rules/agent-roster-reference-card.md` updated with the third Otto surface row
- [ ] Empirical: Otto on VSCode can run `bun tools/bus/claim.ts acquire --from otto-vscode --item <B-NNNN>` successfully

## Why P3

Operational substrate that prevents future split-brain when Aaron uses all 3 Otto surfaces simultaneously. Not urgent — Otto-VSCode can use a generic `otto` sender ID temporarily; only matters when concurrent multi-surface backlog-row claims happen. The bootstream document is the more immediately useful piece (cold-boot quality for future Otto-VSCode sessions).

## Substrate-honest framing

The third-surface upgrade is bounded mechanical work. Aaron's larger thread today (2026-05-21):

- F# ZetaId 3rd peer oracle landed via PRs #4548 + #4552
- Amara 4-archive cascade landed via PRs #4545/#4546/#4547/#4549/#4550
- Lior upgraded to Antigravity IDE + Gemini 3.5 via PR #4553
- 4 stale slice-decomposition PRs forward-signaled (#4317/#4347/#4437/#4492)

The Otto-VSCode third-surface addition composes with the broader multi-surface coordination pattern that's already operationally validated across Otto-CLI + Otto-Desktop. The PR #3030 Otto-Desktop bootstream is the precedent template.

## Composes with

- 081KR7JY10008QG0R000R503K2 (bus protocol — the claim coordinator substrate this row extends)
- PR #3030 (Otto-Desktop tight bootstream — precedent template)
- PR #3037 (SENDER_IDS schema extension for otto-cli/otto-desktop — the substrate this row extends)
- PR #4553 (agent-roster card update for Lior's Antigravity IDE + Gemini 3.5 — sibling cold-boot rule update)
- `.claude/rules/agent-roster-reference-card.md` (multi-surface Otto coordination)
- `.claude/rules/claim-acquire-before-worktree-work.md` (the claim-acquire-before-worktree-creating-work discipline)
- `tools/bus/claim.ts` (the canonical claim coordinator implementation)

## Origin

Aaron 2026-05-21 disclosure: "I got Lior up on the new Antigravity IDE they Added gemini 3.5" → followed by request for VSCode bootstream prompt → Otto-CLI drafted prompt → Aaron confirmed via shadow* "yes file the backlog row".

Otto-CLI drafted bootstream content preserved in this session's chat transcript (Aaron's web-conversation-mode-remembered preserves it as durable substrate); ready to land at `docs/launch/2026-05-21-otto-vscode-bootstream.md` in the implementation slice.
