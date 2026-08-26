---
id: 081M100RB97087G0R0008EAAY7
type: task
state: backlog
priority: P1
slug: own-harness-paid-account-logins-for-grok-claude-openai-manus
title: "Own harness: paid-account logins for grok/claude/openai/manus/gemini/codex/kiro plus GitHub tokens without gh"
created: 2026-08-26T21:48:54.951Z
depends_on: []
composes_with: ["081M100RB9Z087G0R000GWY1MM", "081M100RH29087G0R0031HHGJ0", "081M100RH30087G0R003YXHQ12", "081M100RH3Q087G0R0018X4RSJ"]
---

# Own harness: paid-account logins for grok/claude/openai/manus/gemini/codex/kiro plus GitHub tokens without gh

Umbrella. Daily paid agents still run on vendor CLIs. Our harness is a
library (OpenAI summon + GitHub device login + closed `fs_*`/`db_*`)
not the fleet runtime.

## Target

- Account login per AI (device-code / PKCE). API keys secondary.
- Per-persona tokens under `~/.config/zeta/auth/`.
- Tools call Ace (deps) and Zeta (source control + filesystem + forge)
  CLIs only — never `bash` / `git` / `gh` / vendor CLIs as the model door.
- Full-duplex four-corner transport is the chat shape; chat-completions
  is the degenerate projection.
- `loop-tick` default is `mux-duplex`, not `spawnSync(claude|codex|kiro-cli|agy|cursor-agent|grok)`.

## Children

| id | slice |
|---|---|
| `081M100RH29087G0R0031HHGJ0` | AuthProviders for claude/grok/gemini/kiro/manus |
| `081M100RB9Z087G0R000GWY1MM` | ForgeHost uses stored GitHub token + REST, not `gh` |
| `081M100RH3Q087G0R0018X4RSJ` | Closed tools = Ace + Zeta verbs |
| `081M100RH30087G0R003YXHQ12` | loop-tick summons through our harness |

## Slice 0 (this PR)

Provider roster as data + `zeta-login` CLI (`list`/`status`/`login`/`token`).
Wired today: `github`, `openai`/`codex`. The rest fail closed naming the
AuthProvider child. Trajectory:
`docs/trajectories/own-ai-harness/RESUME.md`.

## Pointers

- `src/Core.TypeScript/model-backend/` — harness
- `docs/ROADMAP.md` item 1 NO GIT CLI
- `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` Tier 0
