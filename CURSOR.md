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

Tracked in this repo:

- [`.cursor/mcp.json`](.cursor/mcp.json) — repo-root workspace (paths relative to clone)
- [`.cursor/agent-home-mcp.json`](.cursor/agent-home-mcp.json) — MCP **fragment**
  for agent-home workspace (paths prefixed `Zeta/`; merged into
  `~/.zeta/agents/cursor/.cursor/mcp.json` alongside other repo fragments)
- [`src/Core.TypeScript/cursor/github-mcp.ts`](src/Core.TypeScript/cursor/github-mcp.ts)
- [`src/Core.TypeScript/cursor/zeta-mcp-launch.ts`](src/Core.TypeScript/cursor/zeta-mcp-launch.ts)

**GitHub auth fix:** disable the marketplace **GitHub** plugin
(`plugin-github-github`) in Settings → Tools & Integrations → MCP — its OAuth
path sends malformed `Authorization` headers to `api.githubcopilot.com/mcp/`.
The project `github` server uses `gh auth token` + the official docker image
instead. Prereqs: `gh auth login`, Docker running.

## Agent home (Riven)

Per [B-0894.3](docs/backlog/P1/081KSNY2Z0008QG0R001RWF499-3-per-persona-outside-operator-repo-canonical-location-zeta-.md),
Riven boots from `~/.zeta/agents/cursor/` (persona base — outside the operator's
primary checkout). That home holds **one or more git clones** as siblings; Zeta
is one of them:

```text
~/.zeta/agents/cursor/              # agent home — Cursor workspace root
  Zeta/                             # Zeta clone — stage, commit, PR from here
    .cursor/mcp.json                # MCP when this clone is the workspace root
    .cursor/agent-home-mcp.json     # MCP fragment when workspace is agent home
  <other-repo>/                     # additional clones (same pattern)
    .cursor/agent-home-mcp.json
  .cursor/mcp.json                  # assembled at boot (not in any single repo)
```

Each repo owns its MCP config under its clone (tracked in that repo). The agent
home `.cursor/mcp.json` is assembled locally by merging each clone's
`agent-home-mcp.json` fragment (paths in fragments are prefixed with the clone
directory name, e.g. `Zeta/src/...`).

Add a clone:

```bash
git clone https://github.com/Lucent-Financial-Group/Zeta.git ~/.zeta/agents/cursor/Zeta
```

Wire MCP at boot — merge fragments into agent home (add more repos the same way):

```bash
mkdir -p ~/.zeta/agents/cursor/.cursor
# one repo: copy or symlink the fragment
cp ~/.zeta/agents/cursor/Zeta/.cursor/agent-home-mcp.json ~/.zeta/agents/cursor/.cursor/mcp.json
# multiple repos: jq-merge each clone's .cursor/agent-home-mcp.json into one file
```

Git operations always run inside the relevant clone (`Zeta/`, etc.), never from
the agent-home root. Parallel streams are additional sibling directories under
the persona base (same B-0894.3 pattern as `codex/`, `otto-cli/`, etc.).

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
