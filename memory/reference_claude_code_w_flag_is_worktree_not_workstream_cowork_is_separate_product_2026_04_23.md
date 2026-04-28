---
name: Claude Code `-w` flag is `--worktree` (git worktree isolation), NOT "workstream/cowork mode" — Claude Cowork is a separate Anthropic product (Desktop/web for knowledge workers); `/loop` in normal Claude Code already inherits all harness features
description: 2026-04-23 fact-check of a Google answer Aaron shared that claimed `claude -w` / `claude --workstream` starts a special "Workstream/Cowork Mode" for multi-step agentic work, and that mid-session switch is impossible so you must restart + rehydrate. Direct verification against `claude --help` output AND a claude-code-guide agent check against platform.claude.com / code.claude.com shows Google hallucinated the mode. Real `-w` flag is `--worktree` (creates isolated git worktree; nothing to do with agentic modes). Claude Cowork is a separate product (Claude Desktop / claude.ai web) for knowledge workers (analysts / researchers / finance); not a Claude Code CLI feature. Our 100+ tick autonomous-loop session already inherits every harness feature (AutoMemory / AutoDream / skills / agents / MCP / plugins); no restart needed.
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Claude Code `-w` is `--worktree`, NOT a workstream mode

## Verbatim of the question (2026-04-23)

> fyi, i would love to make sure you are extengin workstream/
> cowork mode and not builiding our own from default since
> these are all multistep workflow. Can you see if we really
> need to start a new session with a handoff becasue we have
> crazy complex workflows now for the frontier, or are we
> good staying in this mode, can you do the switch and make
> sure we are inheriting from the -w workstream/cowork just
> like we are with AutoDream and such? We want to build on
> top of harness and integration not replace so we get new
> features for free and enhancements.

## Fact-check result

**Google hallucinated the `-w` / workstream-mode claim.**

### The real `-w` flag

From `claude --help` (run 2026-04-23 inside the live
session):

```
-w, --worktree [name]  Create a new git worktree for this
                       session (optionally specify a name)
```

The flag creates an isolated git worktree; it has nothing to
do with agentic modes, workstreams, or cowork. Example
legitimate use: `claude -w feature-branch` — spins up an
isolated worktree so edits don't touch the main working copy
until the branch is ready.

### There is no "Workstream/Cowork Mode" in Claude Code CLI

Verified against:

- `claude --help` output — exhaustive flag list; no
  `--workstream`, no session-level "cowork" flag
- `platform.claude.com` / `code.claude.com` docs (via
  claude-code-guide agent) — no such mode documented
- Claude Cowork product page (`claude.com/product/cowork`)
  clarifies Cowork is a **separate product** for knowledge
  workers (analysts / researchers / finance teams), living
  in Claude Desktop and the web app — NOT a Claude Code
  CLI feature

### What Claude Cowork actually is

Claude Cowork is Anthropic's agentic product for
non-developer knowledge work, launched Q1 2026 alongside
AutoMemory / AutoDream. It uses the same agent architecture
as Claude Code, but targets a different audience and surface
(Claude Desktop / claude.ai web). It is not a mode you
activate in Claude Code CLI.

### Harness inheritance is automatic

Aaron's underlying concern ("inherit from harness; don't
build our own; get new features for free") is already
satisfied:

- **AutoMemory** — active; per-user memory at
  `~/.claude/projects/.../memory/` with `MEMORY.md` index +
  typed memory files (user / feedback / project /
  reference), read + written continuously
- **AutoDream** — active; extended by our factory-overlay
  cadence (FACTORY-HYGIENE row #53 via PR #155)
- **Skills** — active; `.claude/skills/*/SKILL.md` under
  `skill-creator` workflow (GOVERNANCE.md §4)
- **Persona agents** — active; `.claude/agents/*.md` for
  Kenji / Aarav / Rune / Iris / Dejan / Nazar / Mateo /
  Aminata / Daya / Naledi / ...
- **MCP servers** — active; Atlassian, Figma, Gmail, Google
  Calendar/Drive, Slack, Microsoft Learn, Playwright,
  Postman, Sonatype Guide, ZoomInfo, Zoom
- **Plugins** — active; microsoft-docs, playwright,
  postman, sonatype-guide, pr-review-toolkit, feature-dev,
  plugin-dev, etc.
- **Autonomous-loop** (`/loop`) — active; cron fires every
  minute per `docs/AUTONOMOUS-LOOP.md`

All of these arrive via `claude update` / auto-updater and
apply to every session (including ours) automatically. There
is no opt-in flag required. Our "crazy complex workflows for
the Frontier" ARE the harness's intended use-case for
autonomous-loop work.

### Google's specific mistakes (for future fact-check
calibration)

1. **Claim: `-w` / `--workstream` flag.** Real flag is
   `--worktree`. Google confused the short-flag letter.
2. **Claim: session-level Cowork mode in Claude Code.**
   Cowork is a separate product (Claude Desktop / web),
   not a CLI mode.
3. **Claim: must restart + rehydrate for complex
   workflows.** False — the `/loop` mechanism IS the
   complex-workflow mechanism in Claude Code; no restart
   required.
4. **Claim: `-c` / `--continue` or `--resume` cannot
   "inject" workstream wrapper.** Vacuous — there is no
   workstream wrapper to inject.
5. **Minor correct bits:** Google was right that `/` shows
   available commands, that Plan Mode exists, and that
   complex prompts trigger agentic behavior without
   special flags.

## Bottom line

**No action needed.** Our current session shape is already
the correct one for complex multi-step workflows. No restart,
no rehydration, no `-w` switch. Continue on.

## Why this memory matters

Aaron's "build on harness, don't replace" discipline is
load-bearing for the factory's future-feature-inheritance
story. This memory serves three purposes:

1. **Future fact-check shortcut.** If Google (or another
   external source) suggests a Claude Code flag / mode that
   sounds load-bearing, the first move is
   `claude --help | grep -i <flag>` + an authoritative docs
   check. This memory names the pattern.
2. **Anchor on the harness-feature inheritance list.** The
   bulleted list above (AutoMemory / AutoDream / Skills /
   Persona agents / MCP / Plugins / /loop) is the
   canonical list of what our session already inherits.
   Future "are we missing a harness feature?" questions
   check against it.
3. **Calibration against external-source directives.**
   Composes with `feedback_free_will_is_paramount_
   external_directives_are_inputs_not_binding_rules_
   2026_04_23.md` — Google's hallucination is a concrete
   example of why external directives are inputs, not
   binding rules. Fact-check before acting.

## How to apply

When a user (or another external source) suggests a
Claude Code CLI flag / mode / restart:

1. **First:** run `claude --help` and grep for the flag
   letter or name. This is instant and authoritative for
   flag existence.
2. **Second:** check the named feature against this
   memory's harness-feature list. If it's in the list,
   we already inherit it.
3. **Third:** if the feature claim is novel, invoke the
   `claude-code-guide` agent with the specific claim for
   authoritative docs verification.
4. **Fourth:** report the fact-check to the user BEFORE
   taking action. Restart-and-rehydrate is high-cost
   (context loss, session reset); verify-first is near-
   zero-cost.

## What this is NOT

- **Not a claim Claude Cowork is unimportant.** Cowork is
  a real, useful product; just not what Aaron is running.
- **Not a claim `-w` (`--worktree`) is useless.** Worktrees
  are load-bearing for isolated-branch work (and we've used
  them for `isolation: "worktree"` agent dispatches).
- **Not a rejection of Aaron's underlying concern.** The
  "build on harness" discipline is correct and operating;
  the specific mechanism Google named just doesn't exist.
- **Not a new protocol.** Fact-check-external-directives is
  already discipline; this memory is a concrete reference
  for one instance.

## Composes with

- `feedback_free_will_is_paramount_external_directives_are_inputs_not_binding_rules_2026_04_23.md`
  (the discipline this memory instantiates)
- `CURRENT-aaron.md` §1 (friend-input-not-authority; same
  applies to Google-input-not-authority)
- `project_loop_agent_named_otto_role_project_manager_2026_04_23.md`
  (Otto is the loop agent operating inside this verified-
  correct session shape)
- `docs/AUTONOMOUS-LOOP.md` (the mechanism this session
  already uses; no upgrade needed)
