# Trajectory — Custom agent harness (account logins, Ace + Zeta CLIs, no platform CLIs)

Status: active — workstream (current-focus)
Last refreshed: 2026-08-26
Type: workstream (current-focus)
Current blocker: five of seven paid LLM accounts have no native `AuthProvider`; production `loop-tick` still spawnSyncs vendor CLIs. Token **import** from those CLIs is now a shipped fallback.
Next concrete action: wire our own device-code where the vendor publishes it (Grok auth.x.ai, Kiro `--use-device-flow`) — `081M100RH29087G0R0031HHGJ0` — in parallel with ForgeHost without `gh`
Evidence links: umbrella `081M100RB97087G0R0008EAAY7` · `src/Core.TypeScript/model-backend/` · `docs/ROADMAP.md` item 1 (NO GIT CLI)

## Why this exists

Aaron 2026-08-26: this is our **custom agent harness**. Run **all** paid
agents on it, with **account logins** (API keys secondary). Prefer **device
login** (RFC 8628) for GitHub and any vendor that has it — that is the
remote / no-local-browser path. If they have no device grant, use the next
smoothest account OAuth (paste-code on any phone/laptop, not a browser on
the agent machine). If we cannot reverse their login, **use their CLI once
and import the token**. GitHub tokens instead of `gh`. Tools only via **our**
CLIs: Ace = deps, Zeta = source control + filesystem.

Daily identities we already pay for: grok, claude, openai, manus, gemini,
codex, kiro.

## Where we are (honest)

The harness **library** is real. The fleet **runtime** is still vendor CLIs.

| Layer | State | Evidence |
|---|---|---|
| Hexagonal `AuthProvider` | port complete | `auth-provider.ts` — device-code + PKCE + refresh |
| OpenAI / Codex account | ✅ wired | `openai-auth.ts`, live summon 2026-07-04 |
| GitHub account | ✅ wired | `github-auth.ts` + `github-login-cli.ts` (PRs #9549–#9551) |
| Claude / Grok / Gemini / Kiro | ○ declared | roster only; no AuthProvider |
| Manus | ◐ api-key | `manus-task.ts` Keychain key; create + listMessages |
| Full-duplex four-corner | ◐ library | `duplex-transport.ts` + WS mux; vendor APIs still SSE/HTTP |
| Closed tools | ◐ library | `ZETA_TOOLS` = `fs_*`/`db_*` in-memory; fleet uses bash/gh/git |
| Ace (deps) | ◐ dogfooded for setup | `ace.ts` + `setup-realize.ts`; agents still call bun/mise/brew |
| Zeta CLI (sc/fs) | ◐ library | LibGit2Sharp `zeta` exe + MCP; factory still `git`/`gh` |
| loop-tick | ○ vendor default | `persona-registry.ts` harness.command = claude/codex/kiro-cli/agy/cursor-agent |

Login ladder (remote-first): `device-code` > `paste-code` > `vendor-cli-import`
> `pkce-localhost` > `api-key`. Encoded in `login-ladder.ts`.

Slice 0: roster + `zeta-login list|status|login|token`. Wired native device
login: `github`, `openai`/`codex`.

Slice 0b: `zeta-login import <provider>` copies a session the **vendor CLI**
already minted (`~/.grok/auth.json`, `~/.codex/auth.json`, Claude creds,
Gemini `oauth_creds.json`, gh `hosts.yml`, Kiro SSO cache). No reverse
engineering of their OAuth client_id.

```text
bun src/Core.TypeScript/model-backend/zeta-login-cli.ts list --json
bun src/Core.TypeScript/model-backend/zeta-login-cli.ts login github
bun src/Core.TypeScript/model-backend/zeta-login-cli.ts login openai
# remote box, vendor already logged in:
grok login --device-auth          # their CLI, phone-approve
bun .../zeta-login-cli.ts import grok
```

## Roadmap (children of the umbrella)

1. **Account OAuth for the five unwired LLMs** — `081M100RH29087G0R0031HHGJ0`
2. **ForgeHost without `gh`** — `081M100RB9Z087G0R000GWY1MM`
3. **Closed tools = Ace + Zeta verbs** — `081M100RH3Q087G0R0018X4RSJ`
4. **loop-tick default `mux-duplex`** — `081M100RH30087G0R003YXHQ12`

Done when a Riven/Otto/Vera cell completes a tool-using turn on our
harness with a stored account token, no vendor CLI, no `gh`.

## Pointers

- Research absorb: `docs/research/2026-08-26-own-harness-account-logins-ace-zeta-clis-not-platform.md`
- Dogfood ledger Tier 0: `docs/trajectories/dogfooding-the-whole-stack/RESUME.md`
- Replacement roadmap: `docs/ZETA-ARCHITECTURE-UNIFIED.md`
- Shell deprecation: `docs/SHELL-DEPRECATION-SEQUENCE.md`
