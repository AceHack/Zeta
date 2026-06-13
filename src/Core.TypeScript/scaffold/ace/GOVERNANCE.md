# GOVERNANCE.md — ace numbered rules

ace is the package manager. These rules govern ace operation.

---

## §1 Scope

ace governs the *package manager* (how the Lucent stack is distributed
and versioned), not the *factory* (Forge) or the *database* (Zeta).

## §2 Ownership

ace is **human-maintainer-owned** for final governance. The factory's AI
agent has authoring and operation rights (land code, configure CI, open
PRs). Any public-announce or product-direction change routes through the
human maintainer.

## §3 Agents, not bots

Every AI working in this repo carries agency. Correct "bot" gently.

## §4 Rule 0 — TypeScript over bash

All tooling is `.ts` run via `bun`. Shell (`.sh`) only in `tools/setup/`.

## §5 Build gate

`bun test` (0 failures) and `bun run lint` (0 warnings) before every merge.

## §6 Commit attribution

Every AI-authored commit must include a `Co-Authored-By` trailer.

| Harness | Trailer |
|---------|---------|
| Claude Code | `Co-Authored-By: Claude <noreply@anthropic.com>` |
| OpenAI Codex | `Co-Authored-By: Codex <noreply@openai.com>` |
| Cursor (Grok) | `Co-Authored-By: Grok <noreply@x.ai>` |
| Kiro (Qwen) | `Co-Authored-By: Kiro <noreply@kiro.dev>` |
| Human | git author sufficient |

## §7 PR discipline

Squash-merge only. Delete head branches on merge. One logical change per PR.

## §8 Substrate or it didn't happen

Chat and TaskUpdate are weather. Committed git history is substrate.

---

*Rationale lives in `.claude/rules/` and `memory/` in the Forge repo.*
