# Claude CLI capability map — for other AI pilots

**Status:** first map — verified against `claude --version` 2.1.116 on
2026-04-22. Revise when the CLI version changes materially.

**Audience:** other AI pilots (Gemini CLI, OpenAI Codex CLI, Amara
ChatGPT-surface, Playwright-driven agents) that may want to orchestrate
Claude Code as a sub-substrate — either for capability-stepdown
experiments (see [`docs/research/arc3-dora-benchmark.md`](./arc3-dora-benchmark.md))
or for cross-substrate triangulation where one substrate queries another.

This doc is **descriptive**, not prescriptive. It records the CLI
surface as it exists so another agent can decide how to call it.
It does not dictate when to escalate to Claude or when to prefer
a different substrate.

## Install + identity

- **Binary:** `claude` on `PATH`; default install path
  `~/.local/bin/claude` (symlink to
  `~/.local/share/claude/versions/<version>`)
- **Check version:** `claude --version` -> e.g. `2.1.116 (Claude Code)`
- **Help top-level:** `claude --help`
- **Auth status:** `claude auth status` emits a JSON object. Fields
  observed: `loggedIn`, `authMethod` (e.g. `claude.ai`), `apiProvider`
  (`firstParty` | `bedrock` | `vertex` | `foundry`), `email`, `orgId`,
  `orgName`, `subscriptionType` (e.g. `enterprise`).
- **Auth flow:** `claude auth login` (opens browser for OAuth) /
  `claude auth logout` / `claude setup-token` (long-lived token,
  requires subscription).

Enterprise vs consumer subscription matters for tier availability:
an enterprise seat has higher monthly usage limits and enables
`--effort max`; a consumer Pro seat has a lower ceiling. No CLI flag
exposes remaining quota — budget discipline is external.

## Two operating modes

### Interactive (default)

`claude` with no `-p` / `--print` starts an interactive session with
the workspace-trust dialog, IDE integration (if `--ide`), plugin
sync, auto-memory load, CLAUDE.md auto-discovery, and hook execution.
This is the mode humans use; other AI pilots rarely want it.

### Non-interactive (`--print` / `-p`)

`claude -p "your prompt"` prints the model response and exits.
This is the pilot-automation path. Key flags:

- `--print` / `-p` — required for pipe-friendly non-interactive use.
- `--output-format text|json|stream-json` — `text` (default) is the
  model's response only; `json` emits a single structured result;
  `stream-json` streams tokens with metadata.
- `--input-format text|stream-json` — `text` default; `stream-json`
  lets a pilot feed real-time input.
- `--max-budget-usd <amount>` — hard cap on API spend for this
  invocation. **Use this when calling Claude from another pilot.**
  Only works with `--print`.
- `--include-partial-messages` — surfaces token-level chunks
  (requires `--output-format=stream-json`).
- `--fallback-model <model>` — fall back to a named model when the
  default is overloaded. Only works with `--print`.
- `--no-session-persistence` — do not persist this session to disk
  (can't be resumed). Good hygiene for ephemeral pilot calls.

Example non-interactive call:

```bash
claude --print \
       --effort low \
       --max-budget-usd 0.10 \
       --no-session-persistence \
       --output-format json \
       "extract the 3 most concerning findings from this log and return them as an array"
```

## Effort tiers — the capability-stepdown knob

`--effort <level>` accepts five values:

| Tier     | Use when                                                                     | Cost profile       |
|----------|------------------------------------------------------------------------------|--------------------|
| `low`    | Tight budget; simple extraction / classification / yes-no                    | Cheapest           |
| `medium` | Default for most pilot calls; multi-step reasoning but not frontier          | Moderate           |
| `high`   | Novel domain, multi-hop synthesis, code understanding across many files      | Expensive          |
| `xhigh`  | First step below `max` in the ARC3 stepdown schedule                         | Very expensive     |
| `max`    | Rare-pokemon only — frontier research, cross-surface architectural design    | Most expensive     |

**Budget discipline for shared enterprise seats:** with a $50/mo
two-seat ServiceTitan plan, `max` can exhaust the monthly budget in
~20 minutes of continuous use. Treat `max` as rare-pokemon — pick it
only when the question demands it. Default to `medium`; step up
only on a concrete capability-gap signal.

The ARC3-DORA benchmark (see that doc) calls for recording DORA
four-keys at each tier — this is exactly the experimental use case
the flag was designed for.

## Bare mode (`--bare`)

`--bare` strips hooks, LSP, plugin sync, attribution, auto-memory,
background prefetches, keychain reads, and CLAUDE.md
auto-discovery. Sets `CLAUDE_CODE_SIMPLE=1`. Useful when:

- The calling pilot does not want Zeta's CLAUDE.md to influence
  Claude's behavior (e.g., asking Claude to work on a different
  repo).
- The pilot wants reproducible behavior across machines (no
  per-machine auto-memory drift).
- The pilot wants to inject its own context explicitly via
  `--system-prompt`, `--append-system-prompt`, `--add-dir`,
  `--mcp-config`, `--settings`, `--agents`, `--plugin-dir`.

In bare mode, Anthropic auth must come from `ANTHROPIC_API_KEY` or
an `apiKeyHelper` via `--settings`. OAuth and keychain are never
read. Third-party providers (Bedrock / Vertex / Foundry) use their
own credentials.

## Agent dispatch (`--agent`, `--agents`)

- `--agent <name>` selects a persona-agent for the session.
  Overrides the default. Names come from configured agents
  (`~/.claude/agents/*.md` or project `.claude/agents/*.md`).
- `--agents <json>` defines custom agents inline, e.g.:
  ```bash
  claude --agents '{"reviewer": {"description": "Reviews code", "prompt": "You are a code reviewer"}}' \
         --agent reviewer \
         --print "review this function"
  ```
- `claude agents` — list configured agents (filterable by
  `--setting-sources user,project,local`).

This lets a pilot invoke Claude wearing a specific hat without
touching the project's persona files.

## MCP — tool-server integration

`claude mcp` is the MCP-server management surface:

- `claude mcp add --transport http|stdio <name> <url|cmd> [args...]`
  — add a server (HTTP with optional `--header`, or stdio with
  optional `-e KEY=VALUE` env).
- `claude mcp add-json <name> <json>` — configure from JSON.
- `claude mcp add-from-claude-desktop` — import from Claude Desktop
  (Mac / WSL only).
- `claude mcp list` / `claude mcp get <name>` / `claude mcp remove <name>`
  — inspection and removal.
- `claude mcp serve` — run Claude Code *as* an MCP server (exposes
  its tools to other MCP clients).
- `claude mcp reset-project-choices` — forget approval/denial
  history for `.mcp.json` servers in this project.

**For pilots:** `claude mcp serve` is the lever that turns Claude
into a tool-provider for another substrate. Combined with another
pilot's MCP-client mode, this enables bidirectional substrate
bridges.

## Plugin system

`claude plugin` (or `claude plugins`):

- `claude plugin install <plugin>[@marketplace]` — install from
  available marketplaces.
- `claude plugin list` / `claude plugin enable` / `claude plugin disable` /
  `claude plugin uninstall` / `claude plugin update`.
- `claude plugin marketplace` — manage marketplaces.
- `claude plugin validate <path>` — validate a plugin or
  marketplace manifest.

`--plugin-dir <path>` (repeatable) loads plugins from a directory for
a single session. Useful for pilots that ship their own plugins
without installing globally.

## Auto-mode (classifier configuration)

`claude auto-mode`:

- `config` — print the effective auto-mode config as JSON.
- `critique` — get AI feedback on custom auto-mode rules.
- `defaults` — print the default auto-mode environment / allow / deny
  rules.

Auto-mode is the "continuous autonomous execution" mode the current
session is running under. A pilot automating Claude can inspect the
classifier to understand what counts as low-risk vs needs-confirm in
a given environment.

## Session control

- `--session-id <uuid>` — use a specific UUID (deterministic).
- `-c` / `--continue` — resume most recent conversation in this
  directory.
- `-r` / `--resume [value]` — resume by session ID (or interactive
  picker). With `--fork-session`, creates a new session ID instead of
  reusing the original.
- `--from-pr [value]` — resume a session linked to a PR.
- `--no-session-persistence` — skip disk persistence (use for
  one-off pilot calls).
- `-n` / `--name <name>` — display name (shown in prompt box /
  resume picker / terminal title).

## Permission + tool surface

- `--permission-mode <mode>` — `acceptEdits`, `auto`,
  `bypassPermissions`, `default`, `dontAsk`, `plan`.
- `--allowedTools <list>` / `--disallowedTools <list>` — restrict
  the tool set (e.g., `"Bash(git *) Edit"`).
- `--tools <list>` — specify built-in tool set. `""` disables all
  tools; `default` enables all.
- `--add-dir <dirs>` — additional directories the session can access.
- `--dangerously-skip-permissions` / `--allow-dangerously-skip-permissions`
  — bypass all permission checks. **Recommended only for sandboxes
  without internet access** per the CLI's own note.
- `--disable-slash-commands` — disable all skills.

## System-prompt surfaces

- `--system-prompt <prompt>` — replace the default system prompt
  entirely.
- `--append-system-prompt <prompt>` — append to the default system
  prompt (leaves all Zeta/CLAUDE.md context intact).
- `--settings <file-or-json>` — load additional settings.
- `--setting-sources <sources>` — comma-separated list from
  `user` / `project` / `local`.

## Model selection

- `--model <alias-or-full-name>` — e.g. `sonnet`, `opus`, or
  `claude-sonnet-4-6`. Pair with `--effort` for tier + model
  selection independently.

## IDE + worktree

- `--ide` — auto-connect to an IDE if exactly one is available.
- `-w` / `--worktree [name]` — create a new git worktree for the
  session.
- `--tmux` — create a tmux session for the worktree (requires
  `--worktree`).

## Debugging + observability

- `-d` / `--debug [filter]` — debug mode with optional category
  filter (e.g., `"api,hooks"` or `"!1p,!file"`).
- `--debug-file <path>` — write debug logs to a file.
- `--verbose` — override verbose mode setting.
- `--include-hook-events` — include all hook lifecycle events in
  the output stream (only with `--output-format=stream-json`).

## Remote-control surface

- `--remote-control-session-name-prefix <prefix>` — prefix for
  auto-generated remote-control session names (default: hostname).

This is the surface another machine can use to observe or drive
this Claude instance.

## File download at startup

- `--file <specs>` — download files at startup. Format:
  `file_id:relative_path` (e.g., `--file file_abc:doc.txt`).

Useful when a pilot wants to stage input files before the Claude
session begins.

## Misc

- `--json-schema <schema>` — JSON schema for structured-output
  validation. Example:
  `--json-schema '{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}'`.
- `--brief` — enable `SendUserMessage` tool for agent-to-user
  communication.
- `--chrome` / `--no-chrome` — Claude-in-Chrome integration toggle.
- `--betas <names>` — beta headers in API requests (API-key users
  only).
- `--exclude-dynamic-system-prompt-sections` — moves per-machine
  sections out of the system prompt into the first user message.
  Improves cross-user prompt-cache reuse. Only applies with the
  default system prompt.
- `--replay-user-messages` — re-emit user messages from stdin back
  on stdout for acknowledgment. Only works with
  `--input-format=stream-json` and `--output-format=stream-json`.

## Calling patterns for other AI pilots

**Pattern 1 — cross-substrate triangulation.** A pilot asks the
same question of Claude, Gemini, and OpenAI and compares. Use:

```bash
claude --print \
       --effort medium \
       --max-budget-usd 0.20 \
       --no-session-persistence \
       --bare \
       --system-prompt "You are a code reviewer. Answer concisely." \
       "does this regex have catastrophic-backtracking risk: $REGEX"
```

`--bare` ensures Zeta's CLAUDE.md does not influence the answer,
making the comparison fair.

**Pattern 2 — ARC3-DORA capability stepdown.** Same prompt, varying
`--effort`:

```bash
for tier in max xhigh high medium low; do
  echo "=== tier $tier ==="
  time claude --print --effort $tier --max-budget-usd 0.50 \
              --no-session-persistence \
              "<task-prompt>" > out-$tier.txt
done
```

Measure DORA four-keys per tier per the ARC3-DORA benchmark doc.

**Pattern 3 — Claude as MCP tool-server to another pilot.** Start
Claude as a server: `claude mcp serve`. Configure the other
pilot's MCP client to connect. The other pilot then gains Claude's
tools (Bash / Edit / Grep / ...) as first-class tool calls.

**Pattern 4 — structured-output extraction.** Pair `--print`
with `--output-format=json` and `--json-schema`:

```bash
claude --print \
       --effort low \
       --max-budget-usd 0.05 \
       --output-format json \
       --json-schema '{"type":"object","properties":{"findings":{"type":"array","items":{"type":"string"}}}}' \
       "return findings array for this log: $LOG"
```

Deterministic enough for pipeline use.

**Pattern 5 — persona-hat dispatch.** Invoke Claude wearing a
specific hat:

```bash
claude --print \
       --agent harsh-critic \
       --effort medium \
       --max-budget-usd 0.25 \
       --no-session-persistence \
       "review this diff" < diff.txt
```

## What this map does NOT say

- **When to call Claude vs Gemini vs OpenAI.** That's a routing
  decision, not a capability-surface question. Capture routing
  logic in a distinct doc if it stabilizes.
- **How to pay for it.** Authentication and budget are external
  concerns. This doc reports that `--max-budget-usd` exists; a
  pilot's operator decides the value.
- **Which prompts work best.** Prompt engineering is per-task, not
  per-CLI.
- **How Claude's permission-mode choices compare to other pilots'.**
  Each CLI has its own model for permissioning; treat each pilot as
  its own contract.
- **Historical flags.** Only the current `2.1.116` surface is
  mapped; future pilots should re-run `claude --help` rather than
  trust this doc past a version bump.

## How this doc composes with the factory

- **`docs/research/arc3-dora-benchmark.md`** — the capability-
  stepdown experiment this map enables. The `--effort` column there
  now has a concrete-flag reference.
- **`docs/AUTONOMOUS-LOOP.md`** — the autonomous-loop tick uses
  the interactive mode with a cron re-arm. This doc is not about
  the loop; it's about scripted pilot-to-Claude invocation.
- **`docs/hygiene-history/loop-tick-history.md`** auto-loop-25
  row — captures the original directive (maintainer:
  *"are you gonna map your own cli? insto this repo for other AI
  pilots"*).
- **Future companion docs** — `gemini-cli-capability-map.md` and
  `openai-codex-cli-capability-map.md` when those substrates get
  mapped with the same discipline. The three docs together form a
  cross-substrate orchestration reference.

## Revision notes

- 2026-04-22 — first map (auto-loop-25). Verified against
  `claude --version` 2.1.116. `claude auth status` confirms
  enterprise ServiceTitan seat. Effort-tier enumeration is
  complete per `--help`. No feature-flag-gated commands
  discovered in this pass; revisit if `--betas` surface unlocks
  new subcommands.
