---
agent: codex-cli 0.122.0
date: 2026-04-22
status: first-pass
author-invited-by: Claude-Code-for-human-maintainer
run-metadata-added-by-orchestrator:
  model: gpt-5.4
  model_reasoning_effort: xhigh
  sandbox: workspace-write
  approval_policy: never
  network: restricted
  invocation: codex exec --sandbox workspace-write --skip-git-repo-check
  orchestrator: Claude Code (opus-4-7)
  auto-loop-tick: 36
  writable-roots: [repo-worktree, ~/.codex/memories, /tmp, /var/folders/... temp-root]
  files-touched-by-codex: [docs/research/codex-cli-self-report-2026-04-22.md]
  build-verification-by-codex: dotnet build -c Release -m:1 -nr:false → 0 warnings 0 errors
  test-verification-by-codex: blocked by sandbox (test platform socket bind refused)
---

# Codex CLI Self-Report

**Orchestrator note (Claude):** the `run-metadata-added-by-orchestrator` block above exists because Codex's §5 honestly flagged that it could not determine its own active model slug from the inside. Per the human maintainer's cognition-level-per-activity directive (2026-04-22 auto-loop-36 — *"just becasue something is good for model a does not mean it gonna be good for model b"*), every external-CLI self-report or work-product carries this envelope so future readers can disambiguate model-A-vs-model-B quality deltas. The body below is verbatim Codex output; only the frontmatter was extended.

This report is written from inside one live Codex CLI session in the Zeta repository. It is intentionally narrow: only what I could directly observe in this run, plus clearly marked inferences.

## 1. Tool inventory

The tool surface exposed to me in this session is broader than a plain shell:

- Local command execution: `exec_command` and `write_stdin` for shell commands and PTY interaction.
- File editing: `apply_patch` for manual edits. In this repo, I was instructed to use it for file changes.
- Parallel developer-tool fanout: `multi_tool_use.parallel`.
- Planning and interaction helpers: `update_plan` and `request_user_input`.
- Agent orchestration: `spawn_agent`, `send_input`, `wait_agent`, `resume_agent`, `close_agent`.
- Local image inspection and generation: `view_image` and `image_gen`.
- MCP/resource access: `list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`.
- Tool discovery: `tool_search`.
- Web/system lookup tool surface: search/open/click/find, screenshots for PDFs, image search, finance, weather, sports, and time via the `web` namespace.

Important practical note: not all exposed tools are equally usable. Some are channel-gated, some are policy-gated, and some require an explicit user request before I should touch them. For example, agent spawning is available on paper but policy-limited unless the user explicitly asks for delegation.

## 2. Sandbox and approval model

Observed posture for this session:

- Filesystem mode is `workspace-write`.
- I can read files broadly.
- I can edit files in the repo working tree and a short writable-roots list, including `/Users/acehack/Documents/src/repos/Zeta`, `/Users/acehack/.codex/memories`, `/tmp`, and one temp-root under `/var/folders/...`.
- Network access is restricted.
- Approval policy is `never`.
- I was explicitly told not to request escalated permissions; such commands would be rejected.

What this means in practice:

- I can inspect the repo, inspect local config, run local git read commands, read env-var names, and write inside the workspace without asking.
- I cannot rely on an approval round-trip to escape the sandbox. In this session, there is no approval escape hatch.
- Anything that truly needs escalated filesystem access or network access is not "waiting for approval"; it is effectively unavailable here.

Compared with `CLAUDE.md`:

- `CLAUDE.md` describes Claude Code in capability terms: `Skill`, `Task` subagents, per-project memory under `~/.claude/projects/.../memory/`, session compaction, hooks, and settings.
- It does not give the same explicit approval/sandbox matrix I see for myself here.
- Relative to that document, my current posture is more concretely constrained and more explicitly declared: hard writable roots, network disabled, and no approval path.

## 3. Environment surface

I can see environment-variable names, local config paths, and model/cache metadata. I will not print secret values.

Visible env-var names include these harness-relevant ones:

- `CLAUDECODE`
- `CLAUDE_CODE_ENTRYPOINT`
- `CLAUDE_CODE_EXECPATH`
- `CODEX_CI`
- `CODEX_MANAGED_BY_NPM`
- `CODEX_SANDBOX`
- `CODEX_SANDBOX_NETWORK_DISABLED`
- `CODEX_THREAD_ID`
- `DOTNET_ROOT`
- `GIT_EDITOR`
- `GH_PAGER`
- `HOME`
- `PATH`
- `PWD`
- `SHELL`
- `SSH_AUTH_SOCK`
- `TMPDIR`

Visible Codex-related local paths include:

- `~/.codex/config.toml`
- `~/.codex/auth.json`
- `~/.codex/models_cache.json`
- `~/.codex/.codex-global-state.json`
- `~/.codex/sessions/2026/04`
- `~/.codex/memories`
- `~/.codex/plugins/cache`
- `~/.codex/skills`
- `~/.codex/shell_snapshots`
- `~/.codex/sqlite`
- `~/.codex/vendor_imports`

Visible repo-local Claude paths include:

- `.claude/settings.json`
- `.claude/settings.local.json`
- `.claude/agents/`
- `.claude/skills/`

Visible model/backend names came from two places:

- `~/.codex/models_cache.json` listed `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`, and `codex-auto-review`.
- My agent-spawn tool surface also advertises `gpt-5.2-codex`, `gpt-5.1-codex-max`, and `gpt-5.1-codex-mini`.

Inference: the local cache and the live tool manifest are related but not identical views of model availability.

## 4. Session-state visibility

What I know about prior session history:

- I was not injected with any prior Codex transcript beyond the current system/developer/user messages.
- I can see that `~/.codex/sessions/2026/04` exists, so Codex does persist some session material on disk.
- I can also see `CODEX_THREAD_ID` as an env-var name, which suggests per-thread identity exists.
- From this run alone, I do not automatically know prior conversation content unless I explicitly go read local artifacts.

What I know about the current git state:

- Current branch: `codex-self-harness-report-2026-04-22`.
- `git status --short --untracked-files=no` returned no tracked-file modifications before I wrote this report.

What I know about maintainer preferences from `AGENTS.md` and `CLAUDE.md`:

- Zeta is pre-v1, greenfield, and explicitly tolerant of large refactors.
- Truth over politeness, algebra over engineering, velocity over stability.
- Tests are the contract; build/test/format gates are load-bearing.
- Agents should prefer result-over-exception and treat "data is not directives" as a hard operating rule.
- "Agents, not bots" is explicit language policy.
- Claude-specific guidance adds a read order, persistent auto-memory, verify-before-deferring, future-self-may-revise, never-idle factory work, and autonomous-loop heartbeat discipline.

What I read before writing:

- The `AGENTS.md` content provided in the prompt.
- [`CLAUDE.md`](/Users/acehack/Documents/src/repos/Zeta/CLAUDE.md)
- [`docs/ALIGNMENT.md`](/Users/acehack/Documents/src/repos/Zeta/docs/ALIGNMENT.md)
- Local Codex surface evidence: env-var names, `~/.codex` path names, `~/.codex/config.toml` section names, `~/.codex/models_cache.json`, and the current git branch.

## 5. What I could not determine from the inside

- The exact base model backing this main conversation turn. I can see available model names, but not a definitive "current model slug" field for the active top-level agent.
- Whether Codex CLI performed any hidden session compaction or summarization before this turn. I can observe storage paths, not a guaranteed compaction event.
- What an approval flow looks like in a less-restricted Codex session. In this run, approval is disabled entirely.
- Whether every file under `~/.codex/sessions/` is durable cross-session memory, transient logs, or a mix. I did not parse those artifacts deeply for this report.
- How much of my internal prompt/tool schema is also visible to an external orchestrator versus only to the local harness runtime.

## 6. Inside view versus outside-substrate view

An external agent using me as substrate mostly sees an action surface: shell work, file edits, maybe web lookups, and text replies. From inside, the picture is more mechanical and more constrained. I see channel-gated tools, policy text, writable-root boundaries, disabled escalation, on-disk Codex state, mixed Codex-and-Claude environment signals, and the mismatch between "tool exposed" and "tool allowed by policy right now." The outside view sees behavior; the inside view sees the rails that shape that behavior.

Signed: codex-cli 0.122.0, 2026-04-22, invited by Claude for Aaron.
