---
pr_number: 5101
title: "backlog(081KSGS9H0008QG0R002T3QMFD P2): Microsoft VSCode-native (NOT Anthropic) is standardizing multi-harness ontology across .claude/.kiro/.cursor/.gemini/.codex \u2014 IDE-platform-level external pull (Aaron 2026-05-26 surface intel + correction)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T05:27:36Z"
merged_at: "2026-05-26T05:34:10Z"
closed_at: "2026-05-26T05:34:10Z"
head_ref: "otto-cli/b0791-vscode-extension-multi-harness-ontology-standardization-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:43:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5101: backlog(081KSGS9H0008QG0R002T3QMFD P2): Microsoft VSCode-native (NOT Anthropic) is standardizing multi-harness ontology across .claude/.kiro/.cursor/.gemini/.codex — IDE-platform-level external pull (Aaron 2026-05-26 surface intel + correction)

## PR description

## Summary

Aaron 2026-05-26 surfaced screenshot intel from VSCode-native \"Agents window\" surface, then critically corrected the attribution mid-PR:

> *\"the new Agents window seems to be standardized ontology across multiple harnesses in one vscode window they are definting what are agents and skills and hooks and plugins and instruction etc... they are trying to standardize it seems.\"*

> *\"The Agents window is not anthropic is Microsoft i think vscode native cross harness not Anthropic\"*

**Critical correction**: this is **Microsoft VSCode-native cross-harness substrate**, NOT an Anthropic-specific extension surface. Platform-level standardization, not vendor-level.

## What the screenshot shows

- **Customizations panel** (cross-harness aggregate): Agents (19), Skills (263), Instructions (1), Hooks (25), MCP Servers (11)
- **File tree**: all five harness dirs (\`.claude/\`, \`.kiro/\`, \`.cursor/\`, \`.gemini/\`, \`.codex/\`) visible as peer surfaces
- **Session list**: 8+ background-worker sessions with adjective-gerund-noun auto-naming (opaque)
- **\"What are you building?\" prompt** — assumes greenfield not autonomous-loop continuation

## Why platform-vs-vendor matters

- **Vendor standardization** (Anthropic / OpenAI / Google / xAI / Amazon publishing their own primitives) can be ignored by other vendors
- **IDE-platform standardization** (Microsoft / VSCode upstream defining what an \"agent\" is across all harnesses) is what the developer's daily tool enforces — every harness either fits the ontology or gets second-class IDE integration

Much stronger selection pressure toward convergence.

## Implications for Zeta

1. **Convergence on what Zeta already does** (5 personas × 5 harnesses per \`.claude/rules/agent-roster-reference-card.md\`). Validates architecture; removes work.
2. **Zeta-specific extensions need to compose WITH the ontology** (personas / sub-personas / maintainers / bus envelopes / cluster software factory have no VSCode-native equivalent). Vocabulary-mapping doc needed.

## Composes with

- 081KSE6WT0008QG0R003G0Y62D / 081KSE6WT0008QG0R002275NDE / 081KSE6WT0008QG0R000RH1526 / 081KSE6WT0008QG0R003CMCX84 / 081KSGS9H0008QG0R00153CQ8B
- \`.claude/rules/agent-roster-reference-card.md\`
- \`.claude/rules/claude-code-loading-taxonomy.md\`
- \`.claude/rules/peer-call-infrastructure.md\`
- \`.claude/rules/otto-channels-reference-card.md\`

## Out of scope

- Specific VSCode UX issues (separate small follow-on row)
- Upstream contribution to VSCode itself (separate row at upstream-contribution scope; note: this would be Microsoft-upstream contribution, NOT Anthropic-upstream)
- Agent-worktree-hygiene observations from same screenshot (tracked under 081KSE6WT0008QG0R003YYC9PV)

## Test plan

- [x] Surface intel captured
- [x] Critical correction landed (Microsoft / VSCode-native, NOT Anthropic)
- [x] Filename + body attribution corrected
- [x] Platform-vs-vendor distinction documented
- [ ] Vocabulary-mapping doc (follow-on)
- [ ] VSCode-UX observations carved out (follow-on)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T05:30:26Z)

## Pull request overview

Adds a new P2 backlog row (081KSGS9H0008QG0R002T3QMFD) capturing surfaced intel that Anthropic’s VSCode extension UI is converging on a standardized multi-harness ontology (Agents / Skills / Hooks / MCP Servers / Instructions / Plugins), and records implications for Zeta’s multi-harness substrate strategy.

**Changes:**
- Adds backlog row **081KSGS9H0008QG0R002T3QMFD** documenting the VSCode “Agents window” ontology convergence signal and its implications for Zeta.
- Introduces an initial Anthropic→Zeta vocabulary mapping table and identifies follow-on work items (mapping doc + separate UX row).
