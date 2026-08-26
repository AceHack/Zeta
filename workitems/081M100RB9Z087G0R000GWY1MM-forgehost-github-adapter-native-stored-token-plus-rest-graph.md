---
id: 081M100RB9Z087G0R000GWY1MM
type: task
state: backlog
priority: P1
slug: forgehost-github-adapter-native-stored-token-plus-rest-graph
title: "ForgeHost GitHub adapter: native stored token plus REST/GraphQL, stop spawnSync gh"
created: 2026-08-26T21:48:54.975Z
depends_on: ["081M100RB97087G0R0008EAAY7"]
composes_with: []
---

# ForgeHost GitHub adapter: native stored token plus REST/GraphQL, stop spawnSync gh

`GitHubAdapter` and `gh-cli.ts` still `spawnSync("gh", ...)`. Login is already
ours (`github-auth.ts` → `~/.config/zeta/auth/github.json`). The factory
work (PR create/merge, checks, GraphQL threads, rest-push) still shells `gh`.

## Must

- Resolve token from OUR store first, then env (`GH_TOKEN` /
  `GITHUB_TOKEN`). Never `gh auth token` as the primary path.
- PR / issue / check / git-data mutations via injected `HttpTransport`
  (REST + GraphQL). `runGh` becomes a compatibility shim or dies.
- Three token *roles* stay (push vs PR-create vs telemetry) — that split
  is real (#15351). Roles are different stored identities, not `gh`.
- `GIT_ASKPASS` remains `github-login-cli.ts` for any leftover git HTTPS.

## Falsifier

A cell with only `~/.config/zeta/auth/github.json` (no `gh` on PATH)
can list PRs and create a PR. `spawnSync("gh"` in `src/Core.TypeScript`
goes to zero on the forge-host path, or each leftover is named and
allowlisted with a kill date.
