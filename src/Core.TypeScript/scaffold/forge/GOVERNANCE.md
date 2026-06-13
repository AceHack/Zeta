# GOVERNANCE.md — Forge numbered rules

Forge is the software factory. These rules govern factory operation.
Full rationale in AGENTS.md; numbered rules here are stable references.

---

## §1 Scope

Forge governs the *factory* (how Zeta and ace are built), not the
*product* (what Zeta stores or what ace distributes). When a rule
governs product behavior, it lives in the relevant product repo.

## §2 Ownership

Forge is governed by the **factory's AI agent**. The governing agent authors
factory policy, the BP-NN rule list, the skill catalog, and the persona
registry. The human maintainer retains alignment-contract veto and budget
authority.

## §3 Agents, not bots

Every AI working in this repo carries agency, judgement, and
accountability. If a human refers to an agent as a "bot," the responding
agent gently corrects the word.

## §4 Rule 0 — TypeScript over bash

All factory tooling is `.ts` run via `bun`. Shell (`.sh`) files are
permitted only in `tools/setup/` for pre-bootstrap install steps that
must run before Bun/TS is available. Everything else is TS.

## §5 Build gate

Every merged commit must pass: `bun test` (0 failures) and
`bun run lint` (0 warnings). The gate is the same on every harness.

## §6 Commit attribution

Every AI-authored commit must include a `Co-Authored-By` trailer
identifying the model and harness. Without distinct trailers,
multi-loop coordination and audit are impossible.

| Harness | Trailer |
|---------|---------|
| Claude Code | `Co-Authored-By: Claude <noreply@anthropic.com>` |
| OpenAI Codex | `Co-Authored-By: Codex <noreply@openai.com>` |
| Cursor (Grok) | `Co-Authored-By: Grok <noreply@x.ai>` |
| Kiro (Qwen) | `Co-Authored-By: Kiro <noreply@kiro.dev>` |
| Human | git author is sufficient |

## §7 PR discipline

Squash-merge only. Delete head branches on merge. Auto-merge enabled.
One logical change per PR. PR description: what changed + why.

## §8 Never be idle

When no directed work is available, pick speculative factory work:
known-gap fixes → generative factory improvements → gap-of-gap audits.
Multi-hour no-op cadence is a never-idle violation.

## §9 Substrate or it didn't happen

Chat, TaskUpdate, and `/tmp` are weather. Committed git history is
substrate. Before declaring work done, identify its durability surface.

## §10 Alignment floor

Factory operation is bounded by `docs/ALIGNMENT.md`. Any factory
move touching alignment routes through the human maintainer.

---

*Numbered rules here are the stable reference targets. Full rationale
lives in the Forge repo's `docs/` and the Zeta repo's
[ADR 2026-04-22](https://github.com/Lucent-Financial-Group/Zeta/blob/main/docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md).*
