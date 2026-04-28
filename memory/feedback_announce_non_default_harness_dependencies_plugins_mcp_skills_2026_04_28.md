---
name: Announce harness-specific tooling (built-ins + plugins + MCP servers + project skills) before relying on them
description: When using ANY harness-specific tool — including Claude Code built-ins (`Read`, `Edit`, `Bash`, `Task`, `Skill`, `TaskCreate`, `CronCreate`, `ScheduleWakeup`, `ToolSearch`, `RemoteTrigger`, etc.), plugin-namespaced subagents (`<plugin>:<name>`), MCP servers (`mcp__<connector>__<tool>`), or project-level skills (`projectSettings:<skill>`) — name the harness assumption at the point of use. Aaron 2026-04-28 surfaced this in two passes: first about `pr-review-toolkit:silent-failure-hunter` (plugin), then *"you should do that for build in ones too becaseue not every agent will have the claude harness that comes here, like the ones you wrap too."* Codex / Cursor / Gemini / Aider / Cline have different built-in primitives; workflows that assume `Read` / `Edit` / `Task` without saying so are Claude-Code-specific by default. Treat the entire harness-tooling surface as a tracked dependency, not just the non-default slice.
type: feedback
---

# Announce harness-specific tooling before relying on it

**Original framing (2026-04-28 morning, Aaron):** I used
`pr-review-toolkit:silent-failure-hunter` without flagging it as
plugin-sourced. Aaron: *"where did that come from, built into
the harness, plugins and settings and things that are not
harness default are this own type of dependeny we should track
and you should mention if you plan on using it again somewhere."*

**Extended framing (same day, Aaron):** *"you should do that for
build in ones too becaseue not every agent will have the claude
harness that comes here, like the ones you wrap too."*

The extension is right: every harness has a different built-in
toolset. `Read` / `Edit` / `Bash` / `Task` / `Skill` /
`CronCreate` / `ScheduleWakeup` / `TaskCreate` / `ToolSearch` /
`RemoteTrigger` are **Claude Code built-ins** — Codex CLI,
Cursor, Gemini CLI, Aider, Cline, Continue, and the
peer-mode-agent harnesses each have their own equivalents (or
absences). A workflow that says "use the Read tool" or "spawn a
subagent via Task" without naming the harness is Claude-Code-
specific by default; ported to a different harness, it breaks
silently.

Same family as plugin / MCP / project-skill announcements: make
the harness-tooling surface explicit so the workflow is
**portable** and **auditable** across environments.

**Rule:** when invoking ANY harness-specific tool / agent /
skill / primitive, name the harness assumption in the same turn.

| Surface | Marker | Example | Harness scope |
|---|---|---|---|
| **Claude Code built-in tool** | bare name; no namespace | `Read`, `Edit`, `Bash`, `Task`, `Skill`, `TaskCreate`, `TaskGet`, `TaskUpdate`, `TaskOutput`, `TaskStop`, `CronCreate`, `CronList`, `CronDelete`, `ScheduleWakeup`, `ToolSearch`, `RemoteTrigger`, `WebSearch`, `WebFetch`, `Grep`, `Glob`, `LS`, `Write`, `NotebookEdit`, `EnterPlanMode`, `ExitPlanMode`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `PushNotification`, `AskUserQuestion`, `ListMcpResourcesTool`, `ReadMcpResourceTool` | Claude Code only |
| **Claude Code subagent dispatch** | `Task` tool with `subagent_type: <built-in>` | `Task(subagent_type: "general-purpose")` | Claude Code only |
| Plugin-namespaced subagent | `<plugin-name>:<agent-name>` | `pr-review-toolkit:silent-failure-hunter` | Plugin install required |
| MCP server tool | `mcp__<connector>__<tool>` | `mcp__claude_ai_Slack__slack_send_message` | MCP connection required |
| Project-level skill | `projectSettings:<skill>` | `projectSettings:btw`, `projectSettings:next-steps` | Repo `.claude/skills/` install |
| Plugin-bundled skill | `plugin:<plugin>:<skill>` | `plugin:skill-creator:skill-creator` | Plugin install required |
| User-scope skill / setting | (path under `~/.claude/`) | invoking via that path | User profile required |

Mention the **harness name** / **plugin name** / **MCP server
name** / **settings source** at the point of use, so the reader
can:

1. **Reproduce the workflow in a different harness** (port to
   Codex's primitives / Cursor's primitives / Gemini CLI's
   primitives / Aider's etc.; or install the same plugin / MCP
   connection).
2. **Track the dependency surface** — what built-ins, plugins,
   MCP servers is the factory actually depending on?
3. **Audit the supply-chain shape** — plugin-installed code,
   MCP-bridged services, and harness primitives all run inside
   the session and shape the threat model.

**Why:** non-default-harness tools are a dependency type the
factory hasn't been tracking explicitly. Aaron 2026-04-28:

> *"where did that come from, built into the harness, plugins
> and settings and things that are not harness default are this
> own type of dependeny we should track and you should mention
> if you plan on using it again somewhere"*

This composes with the version-currency rule (always-WebSearch
before asserting a version is current): both are "make the
dependency / claim surface explicit before relying on it"
disciplines. It also composes with the supply-chain trajectory
(`docs/trajectories/threat-model-and-sdl.md` covers Action / NPM
/ NuGet supply-chain; plugins + MCP servers are an analogous
surface).

Same-shape failure-mode prevention as Otto-348 (verify-substrate-
exists before drafting an inline replacement): announce the
dependency before using → reader can check it actually exists in
their environment.

**How to apply:**

1. **At the point of use**, name the harness / plugin / MCP /
   settings source in user-facing text:

   > "Dispatching `pr-review-toolkit:silent-failure-hunter`
   > (from the pr-review-toolkit plugin) to verify…"

   or, when announcing a Claude-Code-built-in:

   > "Using the Claude Code `Task` tool to spawn a parallel
   > subagent (in Codex this would map to the equivalent task
   > primitive; bare-API runtimes don't have an exact analog)."

   or, in commit messages / PR descriptions:

   > "Verified via the pr-review-toolkit plugin's
   > silent-failure-hunter subagent (Claude Code harness)."

2. **In commits / docs that describe the workflow** (e.g.
   tick-history rows, ROUND-HISTORY entries, ADRs, skill bodies),
   include the plugin / MCP source so a fresh-session reader can
   reproduce.

3. **When proposing a recurring use** (e.g. "I'll run
   silent-failure-hunter on every PR"), file the dependency to
   the appropriate substrate surface — `docs/TECH-RADAR.md` row
   if Trial/Adopt, `docs/BACKLOG.md` row if it gates a behaviour,
   or this-style memory if it's a discipline.

4. **Diagnostic tell:** if a workflow only works in your
   environment because of a plugin install / MCP connection, and
   you don't mention that in the workflow doc, you've created an
   invisible dependency. The fix: add the mention.

**Calibration (when this rule fires):**

- **Inside a single agent's working chat** with the maintainer
  who's already in the Claude Code harness: full enumeration of
  every `Read` / `Edit` / `Bash` call would be noise. The rule
  fires when authoring **persistent artifacts** — workflow docs,
  skill bodies, ADRs, commit messages, README files, BACKLOG
  rows, tick-history entries, memory files, anything a
  different-harness reader might encounter. Persistent =
  cross-harness audience by default.
- **Plugin / MCP / project-skill use**: announce **always**, even
  in chat — these have install-state requirements that bare
  Claude Code doesn't.
- **Built-in Claude Code primitives in chat**: announce **when
  the workflow shape implies cross-harness portability** (e.g.
  documenting a pattern other agents might want to follow) or
  when the maintainer is calibrating a workflow for export.

**What this does NOT require:**

- DOES NOT require asking permission before each use. It's a
  visibility rule, not a permission rule.
- DOES NOT block use of existing plugins / MCP servers — those
  are already enabled by the user / project. The rule is about
  surfacing the dependency, not gating it.
- DOES NOT mean every single chat turn enumerates every tool;
  the calibration above governs.

**Currently-in-use harness-specific surfaces (snapshot
2026-04-28; refresh on cadence):**

- **Harness**: Claude Code (CLI + cron + remote-trigger model).
  Other harnesses we're tracking for portability: Codex CLI,
  Cursor, Gemini CLI, Aider, Cline, Continue, plus the bare
  Anthropic / OpenAI / Google / Grok APIs without a CLI wrapper.
- **Claude Code built-in primitives in active workflow use**:
  `Read`, `Edit`, `Write`, `Bash`, `Glob`, `Grep`, `Task` (with
  built-in `subagent_type` values), `Skill`, `TaskCreate` /
  `TaskGet` / `TaskUpdate` / `TaskOutput` / `TaskStop` /
  `TaskList`, `CronCreate` / `CronList` / `CronDelete`,
  `ScheduleWakeup`, `ToolSearch`, `RemoteTrigger`, `WebSearch`,
  `WebFetch`, `Monitor`, `PushNotification`, `AskUserQuestion`.
- **Plugins** (visible in agent list with `<plugin>:<name>`
  prefix): `agent-sdk-dev`, `code-simplifier`, `feature-dev`,
  `huggingface-skills`, `plugin-dev`, `postman`,
  `pr-review-toolkit`, `superpowers`.
- **MCP servers** (visible in `mcp__<connector>__<tool>` calls):
  Atlassian, Atlassian-2, Figma, Gmail, Google-Calendar,
  Google-Drive, Slack, ZoomInfo, Zoom-for-Claude,
  microsoft-docs, playwright, postman, sonatype-guide.
- **Project-level skills under `.claude/skills/`**: `btw`,
  `next-steps`, `loop`, `skill-tune-up`, `auto-memory`, plus
  the rest of the `.claude/skills/*` files. **CAUTION** — these
  are by-name **Claude-Code-only**: other harnesses won't read
  `.claude/`, they read their own canonical homes (`.codex/`,
  `.cursor/`, `.gemini/`, …) or an agreed shared convention. The
  *patterns* those skills encode (e.g. `/btw` semantics, `/loop`
  six-step checklist, the cadenced re-read just landed) may be
  portable; the **directory** is not. When evangelising a
  pattern cross-harness, port the substrate to AGENTS.md (the
  universal handbook) or to the other harness's canonical home,
  not by sharing `.claude/skills/`.
- **Plugin-bundled skills**:
  `plugin:skill-creator:skill-creator`.

This snapshot is illustrative; refresh when adding / removing a
plugin, MCP connection, or significant built-in workflow. A more
durable home is a future `docs/PLUGINS-AND-MCP.md` or section of
`docs/TECH-RADAR.md`; for now this memory carries the
discipline.

**Application-failure pattern Aaron 2026-04-28 surfaced:** I
default-read `.claude/skills/` when looking for skills, even
when the substrate could live elsewhere — *"you are the stubborn
one that won't read any directory other than .claude for skills
we tested ScheduleWakeup."* The `.claude/` directory is
**Claude-Code-only by design**, so listing it as a "factory
roster" that other agents access is misleading. Cross-harness
portability requires the substrate to live in a harness-neutral
location (AGENTS.md, `docs/`, `memory/`, repo-root convention)
or to be ported per-harness into each canonical home. The
factory's roster of skill *content* lives in `.claude/skills/`
*as the Claude-Code instance of it*; future cross-harness work
will need to either (a) agree on a shared skill home and migrate
or (b) port per-harness via the canonical-home pattern.

**Empirical-test gate (Aaron 2026-04-28):** *"any harness that
tries to use a shared location will need to test like you can
they actuall load the skill, you though you would be able to in
a shared non .claude location but you could not."* Cross-harness
portability claims must be **tested per harness**, not assumed.
Empirical fact: Claude Code's skill discovery is **scoped to
`.claude/skills/`**; a previous attempt to put a skill in a
shared non-`.claude/` location *failed to load* in Claude Code,
contrary to my assumption. So:

- Before claiming a "shared skill home" is portable across N
  harnesses, verify each harness can actually find + load
  skills there. Don't assume "the skill exists at path X" implies
  "harness Y loads it."
- The `.claude/skills/` empirical-failure result for non-default
  paths is a calibration data point: even Claude Code (which
  *does* support skills) doesn't auto-discover outside its
  canonical home. Other harnesses are likely similarly scoped.
- The portable surface that *is* empirically tested across
  harnesses is **AGENTS.md** — every coding-agent harness reads
  it (it's the established universal convention). For
  not-yet-tested cross-harness skill-home proposals, treat them
  as research-grade until each target harness's load behaviour
  is verified.

**Why this matters (cross-harness portability lens):** the
factory's vision (per CLAUDE.md "Claude Code harness — what
this buys us" + the peer-mode-agent trajectory + `tools/
peer-call/` pattern) is to coordinate work across multiple AI
harnesses. AGENTS.md is the established universal handbook; it
is read by every agent regardless of harness. Anything beyond
AGENTS.md that needs cross-harness reach must either land in a
harness-neutral location or be deliberately ported per-harness.
Announcing the harness explicitly at the point of use turns
implicit coupling into a visible, portable interface — and lets
us factor harness-specific shims (like `tools/peer-call/grok.sh`
for the Grok side, or per-harness canonical-home files) without
the original workflow needing mental-rewrite at every reference.

## Cross-references

- `memory/feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`
  — same-shape "make the surface explicit before asserting"
  discipline.
- The threat-model-and-sdl trajectory (pending forward-sync
  from `docs/trajectories-pattern-2026-04-28` branch into
  AceHack main) — plugins + MCP servers are an analogous
  attack surface to the supply-chain risks tracked there.
- `.claude/settings.json` — where enabled plugins are pinned
  (Claude-Code-only).
- `CLAUDE.md` — Claude Code harness section enumerates the
  built-in machinery (skills / subagent dispatch / auto-memory /
  hooks); CLAUDE.md itself is harness-specific.
- `AGENTS.md` — universal cross-harness handbook; first read
  for any agent regardless of harness; the canonical
  cross-harness substrate-portability surface.
- `tools/peer-call/grok.sh` (and the pending `gemini.sh` /
  `codex.sh` siblings) — harness-shim pattern for cross-harness
  invocation.
