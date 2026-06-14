# CURSOR.md — Cursor session bootstrap for Zeta

This is the Cursor (Riven) addendum. [`AGENTS.md`](AGENTS.md) and
[`GOVERNANCE.md`](GOVERNANCE.md) remain authoritative; this file is
**additive** and **may not contradict** them. It instantiates the
[cross-harness bootstrap template](docs/BOOTSTRAP-TEMPLATE.md) (B-0355)
with the Cursor-specific tooling references filled in.

## 1. Orient

Read: [`AGENTS.md`](AGENTS.md) → [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md) →
[`docs/GLOSSARY.md`](docs/GLOSSARY.md) → [`GOVERNANCE.md`](GOVERNANCE.md)
(scan when §N cited).
Then read the Riven persona file: [`memory/persona/riven/MEMORY.md`](memory/persona/riven/MEMORY.md).

## 2. Refresh

Run (in the Cursor integrated terminal or via the `cursor-agent` CLI):

```bash
bun tools/github/refresh-worldview.ts
```

Read active trajectories: `docs/trajectories/*/RESUME.md`.

## 3. Pick work

Open [`docs/BACKLOG.md`](docs/BACKLOG.md) (canonical rows live in
`docs/backlog/P*/`). Complete the backlog-item start gate (prior-art
search + dependency check). Claim before worktree work with the
Cursor-tagged sender ID:

```bash
bun tools/bus/claim.ts acquire --from riven-cursor --item <B-NNNN>
```

## 4. Build

```bash
dotnet build -c Release   # 0 warnings, 0 errors — TreatWarningsAsErrors is on
dotnet test Zeta.sln -c Release
```

## 5. Ship

Open a PR against `main`. Arm auto-merge if green
(`gh pr merge <N> --auto --squash`).
Commit trailer: `Co-Authored-By: Grok <noreply@x.ai>`.

## 6. When stuck

See [`docs/CONFLICT-RESOLUTION.md`](docs/CONFLICT-RESOLUTION.md). On
deadlock, the human decides.

## MCP (Cursor)

Project servers live in [`.cursor/mcp.json`](.cursor/mcp.json) (`zeta` stdio +
`github` via [`src/Core.TypeScript/cursor/github-mcp.ts`](src/Core.TypeScript/cursor/github-mcp.ts)).

**GitHub auth fix:** disable the marketplace **GitHub** plugin
(`plugin-github-github`) in Settings → Tools & Integrations → MCP — its OAuth
path sends malformed `Authorization` headers to `api.githubcopilot.com/mcp/`.
The project `github` server uses `gh auth token` + the official docker image
instead. Prereqs: `gh auth login`, Docker running.

## Fresh machine

Clone Zeta anywhere; open the **clone root** as the Cursor workspace. MCP is
repo-native — [`.cursor/mcp.json`](.cursor/mcp.json) and
[`src/Core.TypeScript/cursor/github-mcp.ts`](src/Core.TypeScript/cursor/github-mcp.ts)
are tracked in this repository. No parent-level MCP config, no nested
`Zeta/` subdirectory inside the workspace.

```bash
git clone https://github.com/Lucent-Financial-Group/Zeta.git <your-clone-path>
```

Prereqs: Cursor, `dotnet` SDK, `bun`, `gh`, Docker. Shell `cursor` should
invoke the IDE launcher (`…/Cursor.app/.../bin/code`), not the agent-only shim.

Parallel branches: `git worktree add <name> -b riven/<task> origin/main` from
the clone. Stage and ship all harness changes from this repo (`git` / PR), not
from paths outside the clone.

## Conventions

- **Register** — Riven operates the adversarial-truth axis: sharp
  critique, disagreement-preservation, calling out drift others might
  rationalize away.
- **Instruction loading** — Cursor's native per-repo instruction files
  are `.cursor/rules/` / `.cursorrules`. This root `CURSOR.md` is the
  bootstrap pointer tree; keep repo-wide rules in `AGENTS.md` /
  `GOVERNANCE.md`, never re-stated here.
- **Worktree isolation** — never edit the contested root checkout. Use
  an isolated `git worktree add --detach … origin/main` for autonomous
  work (per `.claude/rules/agent-worktree-hygiene-*`). Do not hold
  `main` in an agent worktree.
- **Agents, not bots** — every AI carries agency (GOVERNANCE.md §3).
