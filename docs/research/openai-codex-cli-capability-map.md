# OpenAI Codex CLI capability map — for other AI pilots

**Status:** first map — verified against `codex --version` 0.122.0
on 2026-04-22. Revise when the CLI version changes materially.

**Audience:** other AI pilots (Claude Code CLI, Gemini CLI, Amara
ChatGPT-surface, Playwright-driven agents) that may want to
orchestrate OpenAI's Codex agent as a sub-substrate — either for
capability-stepdown experiments (see
[`docs/research/arc3-dora-benchmark.md`](./arc3-dora-benchmark.md))
or cross-substrate triangulation where one substrate queries
another.

Companion to:

- [`docs/research/claude-cli-capability-map.md`](./claude-cli-capability-map.md)
  — the Claude Code CLI map (v2.1.116).

This doc is **descriptive**, not prescriptive.

## Install + identity

- **Install:** `npm install -g @openai/codex` (or
  `brew install --cask codex`).
- **Binary:** `codex` on `PATH`. Homebrew install puts it at
  `/opt/homebrew/bin/codex` on macOS (Apple Silicon).
- **Check version:** `codex --version` -> e.g. `codex-cli 0.122.0`.
- **Help top-level:** `codex --help`.
- **Auth:** `codex login` manages authentication.
  `codex login status` prints the current state (e.g.
  `Logged in using ChatGPT`). `codex logout` removes stored
  credentials. `codex login --with-api-key` reads from stdin for
  API-key-only flows. `codex login --device-auth` triggers the
  device-auth code-flow.
- **Auth sharing with ChatGPT:** the CLI detects an existing
  `claude.ai`-style ChatGPT login without needing a fresh
  browser popup. This is distinct from the Claude CLI, which uses
  its own OAuth against `claude.ai`.
- **Config home:** `$CODEX_HOME` (default `~/.codex/`);
  `config.toml` under that directory is the primary config file.

## Two operating modes

### Interactive (default)

`codex "your prompt"` (or just `codex` to start bare) launches an
interactive TUI. This is the mode humans use for pair-work.

### Non-interactive (`codex exec`, aliased `codex e`)

`codex exec "your prompt"` runs the agent non-interactively and
exits when the task is complete. This is the pilot-automation
path. Key flags:

- `--json` — print events to stdout as JSONL (machine-readable).
- `-o` / `--output-last-message <FILE>` — write the last agent
  message to a file.
- `--output-schema <FILE>` — constrain the model's final
  response to a JSON Schema.
- `--ephemeral` — do not persist the session to disk (good for
  one-off pilot calls).
- `-i` / `--image <FILE>` — attach image(s) to the initial
  prompt (multimodal).
- `-C` / `--cd <DIR>` — run with a different working root.
- `--skip-git-repo-check` — allow running outside a Git repo.
- `--add-dir <DIR>` — additional directories writable alongside
  primary workspace.

Example non-interactive call:

```bash
codex exec \
  --ephemeral \
  --json \
  --sandbox read-only \
  "summarize the 3 most concerning findings in this log"
```

## Model selection — the capability-stepdown knob

Codex uses `-m` / `--model <MODEL>` and config-driven profiles
instead of a discrete effort-tier enumeration. The help's own
example uses `-c model="o3"`; consult current OpenAI docs for the
live model roster.

Two levers for the ARC3-DORA stepdown mapping:

1. **Model tier** — swap the model via `-m` or
   `-c model="<name>"` for each stepdown step.
2. **Config profile** — `-p` / `--profile <NAME>` reads a named
   profile from `config.toml` that can pin model + sandbox +
   approvals + other defaults together.

**Budget discipline:** the current billing snapshot (shared
ServiceTitan $50/mo plan, two seats, "highest mode" exhausted in
~20 min of continuous use per maintainer) says: treat the top
model as rare-pokemon; default to a lower tier for routine pilot
calls.

There is no `--max-budget-usd` equivalent on Codex exec at this
version — budget enforcement is external (watch the OpenAI
dashboard or shut down the process).

## Sandbox + approval surface

Codex is stricter about shell execution than Claude; this is by
design and affects pilot calls:

- `-s` / `--sandbox <MODE>` — select sandbox policy:
  - `read-only` — model can read but not write.
  - `workspace-write` — model can write within the workspace
    (default for `--full-auto`).
  - `danger-full-access` — full shell access, no sandbox.
- `--full-auto` — convenience alias for `--sandbox
  workspace-write`.
- `--dangerously-bypass-approvals-and-sandbox` — skip all
  confirmations and sandboxing. **EXTREMELY DANGEROUS** per the
  CLI's own help; intended solely for externally-sandboxed
  environments.
- `sandbox_permissions` config-override — e.g.
  `-c 'sandbox_permissions=["disk-full-read-access"]'`.
- `shell_environment_policy.inherit` — e.g.
  `-c shell_environment_policy.inherit=all`.

For pilots, the safe default is `--sandbox read-only` unless
writes are intended. Use `--full-auto` for agentic-coding tasks.

## Sandbox subcommand

`codex sandbox` runs commands *within* a Codex-provided sandbox.
This is orthogonal to the agent — it's a utility for running
arbitrary commands through the same sandbox wrapper Codex uses
internally.

## Review surface

`codex review "instructions"` (and `codex exec review`) runs a
code review non-interactively. Useful for pilot code-review
automation. Pair with `--json` or `-o` for structured capture.

## MCP — tool-server integration

`codex mcp` is the MCP-server management surface for Codex's own
external-MCP-server use:

- `codex mcp` — manage external MCP servers Codex connects to.
- `codex mcp-server` — **start Codex as an MCP server (stdio)**.
  This is the pilot-bridge lever: Codex exposes its tools over
  MCP-stdio to another pilot.

Combined with Claude Code's `claude mcp serve`, three pilots
(Claude, Codex, one more) can be wired as MCP servers to each
other for bidirectional tool sharing.

## Plugin system

`codex plugin` — manage Codex plugins. Surface details at the
subcommand-help level (`codex plugin --help`); not mapped in
depth here.

## Apply — one-shot diff application

`codex apply` (aliased `codex a`) applies the latest diff
produced by the Codex agent as a `git apply` to your local
working tree. Useful when the agent produced changes you want to
stage explicitly instead of having it commit directly.

## Session control

- `codex resume` — resume a previous interactive session. Picker
  by default; `--last` to continue the most recent.
- `codex fork` — fork a previous session (picker; `--last`).
- `codex exec resume` — non-interactive resume variant.
- `--ephemeral` — skip persistence for a one-off call.
- `--ignore-user-config` — do not load `$CODEX_HOME/config.toml`
  (auth still uses `CODEX_HOME`).
- `--ignore-rules` — do not load user or project `.rules` files
  (execpolicy).

## Cloud + remote

- `codex cloud` — **EXPERIMENTAL** — browse tasks from Codex
  Cloud and apply changes locally.
- `codex app` — launches the Codex desktop app (opens the
  installer if missing).
- `codex app-server` — **experimental** app server / related
  tooling.
- `codex exec-server` — **EXPERIMENTAL** standalone exec-server
  service.
- `--remote <ADDR>` — connect TUI to a remote app server
  websocket (`ws://host:port` or `wss://host:port`).
- `--remote-auth-token-env <ENV_VAR>` — env var name holding the
  bearer token for the remote websocket.

## Feature flags

- `codex features` — inspect feature flags.
- `--enable <FEATURE>` / `--disable <FEATURE>` (repeatable) —
  toggle features per call. Equivalent to
  `-c features.<name>=true/false`.

## Completion, debug, completion

- `codex completion` — generate shell completion scripts.
- `codex debug` — debugging tools.

## Calling patterns for other AI pilots

**Pattern 1 — cross-substrate triangulation.** Claude, Codex,
and Gemini each asked the same question; pilot compares:

```bash
codex exec \
  --ephemeral \
  --sandbox read-only \
  --json \
  "does this regex have catastrophic-backtracking risk: $REGEX"
```

`--ephemeral` ensures no session state persists.

**Pattern 2 — ARC3-DORA capability stepdown.** Same prompt,
varying model tier via `-c model=`:

```bash
for model in o3 o3-mini gpt-4 gpt-3.5-turbo; do
  echo "=== model $model ==="
  time codex exec \
    --ephemeral \
    -c model="$model" \
    --sandbox read-only \
    "<task-prompt>" > out-"$model".txt
done
```

Measure DORA four-keys per tier per the ARC3-DORA benchmark.

**Pattern 3 — Codex as MCP tool-server.** Start Codex as a
stdio MCP server: `codex mcp-server`. Configure another pilot's
MCP-client to connect. The other pilot gains Codex's tools.

**Pattern 4 — structured-output extraction.** Use
`--output-schema` for strict JSON-shaped responses:

```bash
codex exec \
  --ephemeral \
  --sandbox read-only \
  --output-schema /tmp/findings-schema.json \
  --json \
  "return findings array for this log: $LOG"
```

**Pattern 5 — workspace-write agentic coding.** For the
ServiceTitan demo path or any agentic-write task:

```bash
codex exec --full-auto "refactor module X to use pattern Y"
```

Pair with `codex apply` if you prefer to stage before committing.

**Pattern 6 — non-interactive code review.** Analog to
`pr-review-toolkit:code-reviewer`:

```bash
codex review \
  -o /tmp/review-$(date +%s).md \
  "review the diff against origin/main"
```

## Codex vs Claude — quick comparison

| Concern                       | Claude Code                                   | OpenAI Codex                                      |
|-------------------------------|-----------------------------------------------|---------------------------------------------------|
| Non-interactive flag          | `--print` / `-p`                              | `codex exec` (subcommand, not flag)               |
| Effort/model lever            | `--effort low..max` (discrete tiers)          | `-m` / `-c model="..."` + `--profile`             |
| Budget ceiling flag           | `--max-budget-usd`                            | **None** — external dashboard tracks spend        |
| Ephemeral session             | `--no-session-persistence`                    | `--ephemeral`                                     |
| Structured output             | `--json-schema` + `--output-format=json`      | `--output-schema` + `--json`                      |
| Strip defaults (bare)         | `--bare`                                      | `--ignore-user-config` + `--ignore-rules`         |
| MCP serve (pilot bridge)      | `claude mcp serve`                            | `codex mcp-server`                                |
| Sandbox levels                | `--permission-mode ...`                       | `-s read-only / workspace-write / danger-full-access` |
| Diff apply (explicit)         | (implicit via edit tools)                     | `codex apply` / `codex a`                         |
| Session resume                | `-c` / `-r`                                   | `codex resume [--last]`                           |
| Session fork                  | `--fork-session`                              | `codex fork [--last]`                             |
| Image input (multimodal)      | (surface not separately flagged here)         | `-i` / `--image <FILE>`                           |
| Cloud integration             | `--from-pr`                                   | `codex cloud` (experimental)                      |

**Structural observation:** Claude's CLI leans
flag-centric-on-the-root-command (everything threads through
`claude --foo`); Codex leans subcommand-heavy (exec / login /
mcp / sandbox / review / apply / resume / fork as siblings).
Pilots orchestrating both should treat them as distinct calling
conventions, not variations of one.

## What this map does NOT say

- **When to call Codex vs Claude vs Gemini.** Routing is a
  separate decision.
- **How OpenAI's pricing works.** Consult OpenAI's billing docs;
  this map only notes that `--max-budget-usd` equivalent is
  absent.
- **Which model to pick.** Consult OpenAI's current model roster;
  this map records the `-m` / `-c model="..."` lever only.
- **Prompt engineering specifics.** Per-task concern.
- **Historical flags.** Only the current `0.122.0` surface is
  mapped; future pilots should re-run `codex --help`.
- **Security analysis of `danger-full-access` sandbox.** Use with
  the CLI's own warning in mind; treat as an
  externally-sandboxed-environment-only flag.

## How this doc composes with the factory

- [`docs/research/arc3-dora-benchmark.md`](./arc3-dora-benchmark.md)
  — Codex is a cross-provider substrate for the ARC3-DORA
  stepdown experiment.
- [`docs/research/claude-cli-capability-map.md`](./claude-cli-capability-map.md)
  — sibling map for the Claude CLI surface; the comparison table
  above points back to it.
- **Future:** `docs/research/gemini-cli-capability-map.md` when
  the Gemini substrate gets mapped with the same discipline.
  Three-substrate triangulation capability fully documented once
  that lands.

## Revision notes

- 2026-04-22 — first map (auto-loop-25). Verified against
  `codex --version` 0.122.0, `codex login status` reports
  *"Logged in using ChatGPT"* (shared ChatGPT auth). Subcommand
  enumeration is complete per `codex --help`.
  Experimental commands (`cloud`, `app-server`, `exec-server`)
  recorded as-declared; subject to change.
