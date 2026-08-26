---
id: 081M100RB97087G0R0008EAAY7
type: task
state: backlog
priority: P1
slug: own-harness-paid-account-logins-for-grok-claude-openai-manus
title: "Own harness: paid-account logins for grok/claude/openai/manus/gemini/codex/kiro plus GitHub tokens without gh"
created: 2026-08-26T21:48:54.951Z
depends_on: []
composes_with: ["081M100RB9Z087G0R000GWY1MM", "081M100RH29087G0R0031HHGJ0", "081M100RH30087G0R003YXHQ12", "081M100RH3Q087G0R0018X4RSJ", "081M102M6X5087G0R001VWNYS2", "081M102M6Y2087G0R000407SW3"]
---

# Own harness (Harny): paid-account logins for grok/claude/openai/manus/gemini/codex/kiro plus GitHub tokens without gh

Umbrella. The custom agent harness is named **Harny**. Daily paid agents
still run on vendor CLIs. Harny is a library (OpenAI summon + GitHub
device login + Manus account API key + closed `fs_*`/`db_*`) not the
fleet runtime.

## Target

- Account login per AI (device-code / PKCE). API keys secondary **except
  Manus**, whose account login *is* an API key with no extra per-call
  billing and who always run remote — they may never fit the full local
  Ace/Zeta tool loop.
- Per-persona tokens under `~/.config/zeta/auth/`.
- Tools call Ace (deps) and Zeta (source control + filesystem + forge)
  CLIs only — never `bash` / `git` / `gh` / vendor CLIs as the model door.
- Full-duplex four-corner transport is the chat shape; chat-completions
  is the degenerate projection.
- `loop-tick` default is `mux-duplex`, not `spawnSync(claude|codex|kiro-cli|agy|cursor-agent|grok)`.
- Indexing is a Harny verb (`harny search`) so agents do not full-scan.
- After Phase A dogfood: Ace pre-bootstrap + extract Harny as the first
  isolated published package (Ace installs it).

## Children

| id | slice |
|---|---|
| `081M100RH29087G0R0031HHGJ0` | AuthProviders for claude/grok/gemini/kiro (Manus is wired as account-api-key) |
| `081M100RB9Z087G0R000GWY1MM` | ForgeHost uses stored GitHub token + REST, not `gh` |
| `081M100RH3Q087G0R0018X4RSJ` | Closed tools = Ace + Zeta verbs |
| `081M100RH30087G0R003YXHQ12` | loop-tick summons through Harny |
| `081M102M6X5087G0R001VWNYS2` | Ace pre-bootstrap (published binary or from-source seed) |
| `081M102M6Y2087G0R000407SW3` | Split Harny as first isolated published package |

## Slice 0 (this PR)

Provider roster as data + `harny` / `zeta-login` CLI
(`list`/`status`/`login`/`import`/`token`/`search`). Wired today:
`github`, `openai`/`codex` (device-code), `manus` (account API key,
remote-only). The rest fail closed naming the AuthProvider child, with
`harny import <id>` as the vendor-CLI fallback. Trajectory:
`docs/trajectories/own-ai-harness/RESUME.md`.

## Pointers

- `src/Core.TypeScript/harny/harny.ts` — in-tree CLI
- `src/Core.TypeScript/model-backend/` — harness library
- `docs/ROADMAP.md` item 1 NO GIT CLI + item 8/8b Ace+Harny
- `docs/trajectories/dogfooding-the-whole-stack/RESUME.md` Tier 0
