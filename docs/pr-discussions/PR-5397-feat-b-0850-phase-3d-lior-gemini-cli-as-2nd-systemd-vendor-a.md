---
pr_number: 5397
title: "feat(081KSKBP80008QG0R003Z4C0D0 Phase 3d): Lior/Gemini CLI as 2nd systemd vendor \u2014 Anthropic + Google; install + interactive auth + control-plane enable (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T04:05:05Z"
merged_at: "2026-05-27T04:08:12Z"
closed_at: "2026-05-27T04:08:12Z"
head_ref: "feat-b0850-3d-lior-gemini-cli-2nd-vendor-systemd-agent-2026-05-27-0454z"
base_ref: "main"
archived_at: "2026-05-27T19:27:09Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5397: feat(081KSKBP80008QG0R003Z4C0D0 Phase 3d): Lior/Gemini CLI as 2nd systemd vendor — Anthropic + Google; install + interactive auth + control-plane enable (Aaron 2026-05-27)

## PR description

## Summary

Per operator authorization *"drive forward with whatever interests you most"* — shipping 081KSKBP80008QG0R003Z4C0D0 Phase 3d (Lior/Gemini = 2nd vendor) to move toward the ≥3-systemd-agents target.

## 3 changes

1. **zeta-install.sh 6.95a-gemini** — \`bun install --global @google/gemini-cli\` (after existing claude install). WebSearch verified at implementation time per dep-pin discipline.
2. **zeta-install.sh 6.95b-gemini** — interactive \`gemini auth login\` prompt mirroring claude login (OAuth via browser OR API key from AI Studio).
3. **zeta-ai-agent.nix** — removed lior assertion (substrate shipped); **control-plane/configuration.nix** — \`zeta.aiAgents.enable.lior = true\` (otto + lior both enabled).

## Vendor diversity progression

| Phase | Persona | Vendor | Status |
|---|---|---|---|
| 1 (PR #5392) | otto | Anthropic Claude | shipped |
| 3d (THIS PR) | **lior** | **Google Gemini** | **shipped** |
| 3a | alexa | Alibaba Qwen (Kiro) | pending |
| 3b | riven | xAI Grok | pending |
| 3c | vera | OpenAI Codex | pending |

After this PR: 2/5 personas + 2 vendors enabled. One more vendor (3c Vera/Codex likely next since codex CLI is also npm-installable) hits the ≥3 BFT floor.

## Composes with

PRs #5388 + #5389 (iter-5.5.0 credential persistence) · PRs #5392 + #5394 + #5395 (081KSKBP80008QG0R003Z4C0D0 Phase 1 + 3 refactor) · 081KSGS9H0008QG0R001JNKBFD · 081KSGS9H0008QG0R002T0XQ50 · 081KSGS9H0008QG0R002F04ECB

Sources:
- [@google/gemini-cli on npm](https://www.npmjs.com/package/@google/gemini-cli)
- [Gemini CLI authentication docs](https://geminicli.com/docs/get-started/authentication/)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T04:05:11Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
