---
id: 081M100RH29087G0R0031HHGJ0
type: task
state: backlog
priority: P1
slug: authprovider-implementations-for-claude-grok-gemini-kiro-man
title: "AuthProvider implementations for claude, grok, gemini, kiro, manus account login"
created: 2026-08-26T21:49:00.873Z
depends_on: ["081M100RB97087G0R0008EAAY7"]
composes_with: []
---

# AuthProvider implementations for claude, grok, gemini, kiro, manus account login

Implement the hexagonal `AuthProvider` port (`auth-provider.ts`) for every
**local** paid account that is still `declared` on the roster.

**Until that lands:** `harny import <id>` copies a session the vendor
CLI already minted. That is a fallback, not this workitem's done-test.

**Manus is out of this workitem.** Wired 2026-08-26 as `account-api-key`
+ `execution: remote-only` (`harny login manus --from-file`). Their
account login *is* the key (no extra per-call billing) and they always
run on Manus cloud — there is no local OAuth to reverse.

## Must

- Device-code (RFC 8628) and/or PKCE browser (RFC 7636). Same runner
  (`login-runner.ts`) and store (`~/.config/zeta/auth/<storeAs>.json`).
- Account login is primary. API keys remain a secondary path for local
  vendors.
- `harny login <id>` flips the roster row from `declared` to `wired`
  only when a live device-flow round-trip has been proven (not docs-only).
- Per-persona files once `personaScoped` is wired through the store
  (today the store is per-provider, one identity).

## Honest starting points

| id | vendor session today |
|---|---|
| claude | `~/.config/claude/credentials.json` — paste-code, no RFC 8628 |
| gemini | `~/.gemini/oauth_creds.json` — localhost PKCE |
| grok | `~/.grok/auth.json` — `auth.x.ai` advertises device_authorization_endpoint; we lack a public client_id so today `grok login --device-auth` then import |
| kiro | `~/.aws/sso/cache/kiro-auth-token.json` — `kiro-cli login --use-device-flow` for SSH |

Do not scrape cookies as the long-term login. Browser extraction is
archive (save-ai-memory), not identity.

## Falsifier

`harny login claude` (and siblings) persist a token; `harny status --json`
reports `loggedIn: true`; a dead token refreshes or asks for re-login.
Adding the row without a live round-trip must not mark `wired`.
