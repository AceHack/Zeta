---
id: 081KTGSBXDC08QG0R000JGHFPJ
type: task
state: done
priority: P1
slug: zeta-mcp-server-drive-the-command-verbs-as-native-tools-unbl
title: "zeta MCP server — drive the command verbs as native tools (UNBLOCKED: project-level .mcp.json, check it in); the step that flips Otto's loop off git"
created: 2026-06-07T10:17:00.076Z
completed: 2026-06-07T10:23:31.533Z
depends_on: []
composes_with: ["081KTGPC2XP08QG0R000X8X1M9"]
---

# zeta MCP server — drive the command verbs as native tools (UNBLOCKED: project-level .mcp.json, check it in); the step that flips Otto's loop off git

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGSBXDC08QG0R000JGHFPJ-*.md` glob. -->

## Unblocked (Aaron 2026-06-07)

> "with the MCP you can register it at the project level and check it in."

The MCP wrapper was held on "harness must wire it." Resolved: register via a **project-level `.mcp.json`
at the repo root**, checked in — Claude Code auto-loads project-scoped MCP servers. So Otto can deliver
AND register the server itself. This is the slice that flips Otto's own loop off `git` (drive the verbs
as native tools instead of `Bash git …`). Builds on the command core (`DbCommand` / `GitCommand` /
`CliParse`) + the runnable `zeta` CLI (#6779).

## Build plan

- **Server:** `tools/zeta-mcp` exposing the command verbs as MCP tools:
  - git-ref (over `GitCommand`): `zeta_status`, `zeta_log`, `zeta_branch`, `zeta_checkout`, `zeta_commit`.
  - data-plane (over `DbCommand`, later): `zeta_append`, `zeta_history`, `zeta_get`.
- **Transport:** MCP stdio (newline-delimited JSON-RPC 2.0). Two routes:
  - (a) **ModelContextProtocol .NET SDK** if available/addable (couldn't confirm nuget availability from
    the sandbox — verify on a networked run before adding to `Directory.Packages.props`).
  - (b) **From-scratch minimal server** (no external dep): a stdin loop handling `initialize` →
    `{protocolVersion, capabilities:{tools:{}}, serverInfo}`, `notifications/initialized` (ack), `tools/list`
    → the tool schemas, `tools/call` {name, arguments} → dispatch to GitCommand/DbCommand →
    `{content:[{type:"text", text}]}`. ~120 lines, System.Text.Json + stdin/stdout.
- **Registration:** a repo-root `.mcp.json` registering the server. Use `dotnet run --project
  tools/zeta-mcp` (builds-on-demand — no stale-binary footgun) OR a prebuilt path. **Blast-radius note:**
  a checked-in repo-root `.mcp.json` auto-starts for EVERY contributor session — make the server start
  fast + fail gracefully so it never degrades session startup.

## Verification

- **Smoke-test (in-loop):** pipe `initialize` + `tools/list` + a `tools/call` JSON-RPC to the server's
  stdin, assert well-formed responses (proves the server speaks the protocol).
- **Harness-acceptance (out-of-loop):** the Claude Code session must restart to load `.mcp.json` and show
  the `zeta_*` tools — the residual verification Otto can't do in-session. Recommend: land the server +
  smoke-test FIRST (no blast radius), then add `.mcp.json` as a small follow-up once smoke-test is green.

## Safety (Amara + the pointer-not-authority invariant)

- The MCP tools are an admission surface: each `tools/call` is a *proposal*, gated like any command
  (source ≠ authorization). Mutating verbs (commit/push) should be explicit, not silent.
- Ties: the determinism contract (081KTGEVV75), the secrets design (no raw private keys over the wire),
  the command core + CLI (#6773/#6774/#6776/#6779), push/sync (the other done-test gap — credential source).

## Anchors

- `src/Core/Command.fs` (DbCommand), `src/Core.Git/GitCommand.fs` + `CliParse.fs`, `tools/zeta-cli`
  (the CLI sibling). Roadmap #1 (no-git-CLI). Beacon: Model Context Protocol (Anthropic) — stdio JSON-RPC.

## DONE (2026-06-07)

Server delivered + smoke-tested + self-registered (#6782):
- `tools/zeta-mcp` — minimal from-scratch MCP stdio server (newline-delimited JSON-RPC 2.0; no external
  SDK). Tools over GitCommand: zeta_status/log/branch/checkout/commit. Smoke-tested end-to-end
  (initialize / tools/list / tools/call → real git output via libgit2, zero git CLI).
- `.mcp.json` (repo root) registers it (project-level check-in; blast radius cleared by Aaron).
- **Activation is out-of-loop:** `dotnet build tools/zeta-mcp -c Release` + restart the session → the
  `zeta_*` tools appear. (Otto can't self-restart, so the live "Otto drives via MCP" verification happens
  on Aaron's next session.)

Remaining (separate items, NOT this server): push/sync as a tool (credential source, Aaron's call) +
the data-plane db-verbs as tools (zeta_append/history/get over DbCommand, needs a configured Log target).
