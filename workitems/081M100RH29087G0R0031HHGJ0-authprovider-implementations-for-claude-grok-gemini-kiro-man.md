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
paid account that is `declared` or `api-key-only` on the roster.

**Until that lands:** `zeta-login import <id>` copies a session the vendor
CLI already minted. That is a fallback, not this workitem's done-test.

## Must

- Device-code (RFC 8628) and/or PKCE browser (RFC 7636). Same runner
  (`login-runner.ts`) and store (`~/.config/zeta/auth/<storeAs>.json`).
- Account login is primary. API keys remain a secondary path (Manus
  Keychain key stays until account OAuth exists).
- `zeta-login login <id>` flips the roster row from `declared` to `wired`
  only when a live device-flow round-trip has been proven (not docs-only).
- Per-persona files once `personaScoped` is wired through the store
  (today the store is per-provider, one identity).

## Honest starting points

| id | vendor session today |
|---|---|
| claude | `~/.config/claude/credentials.json` |
| gemini | `~/.gemini/oauth_creds.json` |
| grok | grok CLI / Cursor account — endpoints unconfirmed |
| kiro | kiro-cli session — endpoints unconfirmed |
| manus | Keychain `zeta-manus-api-key`; task API exists |

Do not scrape cookies as the long-term login. Browser extraction is
archive (save-ai-memory), not identity.

## Falsifier

`zeta-login login claude` (and siblings) persist a token; `status --json`
reports `loggedIn: true`; a dead token refreshes or asks for re-login.
Adding the row without a live round-trip must not mark `wired`.
