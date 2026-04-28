---
name: Announce non-default-harness dependencies (plugins, MCP servers, project skills) before relying on them
description: When using a plugin-namespaced subagent, an MCP server, a project-level skill (`projectSettings:`), or any tool that isn't built into the bare Claude Code harness, ANNOUNCE the dependency at the point of use — name the plugin, MCP server, or settings source so a reader / future-self / different-environment-Claude knows the workflow has a non-default-harness prerequisite. Aaron 2026-04-28 surfaced this when I used `pr-review-toolkit:silent-failure-hunter` without flagging it as plugin-sourced: *"where did that come from, built into the harness, plugins and settings and things that are not harness default are this own type of dependeny we should track and you should mention if you plan on using it again somewhere."* Treat the plugin / MCP / project-skill set as a first-class dependency surface — not just enabled tools, but tracked tools.
type: feedback
---

# Announce non-default-harness dependencies before relying on them

**Rule:** when invoking a tool / agent / skill that isn't built
into the bare Claude Code harness, name the dependency in the
same turn. Specifically:

| Surface | Marker | Example |
|---|---|---|
| Plugin-namespaced subagent | `<plugin-name>:<agent-name>` | `pr-review-toolkit:silent-failure-hunter` |
| MCP server tool | `mcp__<connector>__<tool>` | `mcp__claude_ai_Slack__slack_send_message` |
| Project-level skill | `projectSettings:<skill>` | `projectSettings:btw`, `projectSettings:next-steps` |
| Plugin-bundled skill | `plugin:<plugin>:<skill>` | `plugin:skill-creator:skill-creator` |
| User-scope skill / setting | (path under `~/.claude/`) | invoking via that path |

If the marker is present in the agent / tool name, the
dependency is non-default-harness. Mention the **plugin name** /
**MCP server name** / **settings source** at the point of use, so
the reader can:

1. Reproduce the workflow in a different environment (install the
   same plugin / connect the same MCP server).
2. Track the dependency surface — what plugins is the factory
   actually depending on?
3. Audit the supply-chain shape — plugin-installed code runs
   inside this session.

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

1. **At the point of use**, name the plugin / MCP / settings
   source in user-facing text:

   > "Dispatching `pr-review-toolkit:silent-failure-hunter`
   > (from the pr-review-toolkit plugin) to verify…"

   or, in commit messages / PR descriptions:

   > "Verified via the pr-review-toolkit plugin's
   > silent-failure-hunter subagent."

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

**What this does NOT require:**

- DOES NOT require enumerating every default-harness tool
  (Read, Edit, Bash, etc.). The rule is "non-default" — markers
  listed above are the trigger.
- DOES NOT require asking permission before each use. It's a
  visibility rule, not a permission rule.
- DOES NOT block use of existing plugins / MCP servers — those
  are already enabled by the user / project. The rule is about
  surfacing the dependency, not gating it.

**Currently-in-use non-default-harness surfaces (snapshot
2026-04-28; refresh on cadence):**

- **Plugins** (visible in agent list with `<plugin>:<name>`
  prefix): `agent-sdk-dev`, `code-simplifier`, `feature-dev`,
  `huggingface-skills`, `plugin-dev`, `postman`,
  `pr-review-toolkit`, `superpowers`.
- **MCP servers** (visible in `mcp__<connector>__<tool>` calls):
  Atlassian, Atlassian-2, Figma, Gmail, Google-Calendar,
  Google-Drive, Slack, ZoomInfo, Zoom-for-Claude,
  microsoft-docs, playwright, postman, sonatype-guide.
- **Project-level skills** (in `.claude/skills/` or
  `projectSettings:` namespace): `btw`, `next-steps`,
  `loop`, `skill-tune-up`, `auto-memory`, plus the entire
  `.claude/skills/*` factory roster.
- **Plugin-bundled skills**:
  `plugin:skill-creator:skill-creator`.

This snapshot is illustrative; refresh when adding / removing a
plugin or MCP connection. A more durable home is a future
`docs/PLUGINS-AND-MCP.md` or section of `docs/TECH-RADAR.md`;
for now this memory carries the discipline.

## Cross-references

- `memory/feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`
  — same-shape "make the surface explicit before asserting"
  discipline.
- `docs/trajectories/threat-model-and-sdl.md` — supply-chain
  trajectory; plugins + MCP servers are an analogous attack
  surface.
- `.claude/settings.json` — where enabled plugins are pinned.
- `CLAUDE.md` — Claude Code harness section enumerates the
  built-in machinery (skills / subagent dispatch / auto-memory /
  hooks). Anything beyond that list is non-default.
