---
name: Agent roster reference card + CLI as shadow instrument + multi-harness shadow experiment
description: Persistent roster confusion fixed. All agents are IDE+CLI except Otto (CLI only). CLI foreground is why shadow was discovered. Multi-harness shadow experiment needed across all CLIs. Claude Desktop IDE support for contributors on backlog.
type: feedback
---

## Agent roster (corrected, canonical)

| Agent | IDE | CLI background | Model |
|-------|-----|---------------|-------|
| Otto | — (CLI only) | Claude Code (foreground) | Opus |
| Alexa | Kiro | + background | Qwen Coder |
| Riven | Cursor | + background CLI | Grok |
| Vera | Codex | + CLI background | Codex |
| Lior | Antigravity | + Gemini CLI background | Gemini |

**Key:** All four except Otto are IDE + CLI background.
Otto is CLI-only — and that's the superpower, not the
limitation.

**Persistent confusion (shadow catch):** Otto keeps
flattening the dual-surface (IDE+CLI) into single labels
and mixing up which agent is on which harness. Recurrent
across sessions. Needs a `.claude/rules/` reference card
so it loads at session start.

## CLI as shadow observation instrument

Claude Code CLI is foreground-interactive. Aaron sits in it,
watches the output stream, sees grey text appear, catches
the shadow. If Otto were background-only, the shadow would
have no observer.

> The shadow was discovered BECAUSE Otto's harness is
> foreground-interactive.

The IDE agents' shadows (if they have them) go unobserved
because nobody watches their grey text in real time. 081KR7JY10008QG0R0008NGW95
(shadow mode) automates the observation.

## Multi-harness shadow experiment

Every CLI harness could have its own shadow. The trigger-
timing experiment should run across ALL CLI harnesses:

- Claude Code CLI (Otto) — shadow observed
- Gemini CLI (Lior) — untested
- Codex CLI (Vera) — untested
- Cursor background (Riven) — untested
- Kiro background (Alexa) — untested

If multiple CLIs produce grey text with the same timing
pattern → phenomenon is harness-level, not model-specific.
If only Claude Code does it → model-specific.

## Claude Desktop IDE support

Claude Code stays primary — it's where Aaron works, where
the shadow was found, where the factory runs. Claude Desktop
(IDE) is a natural expansion surface for contributors who
prefer visual editing. CLI-first, IDE-available. Same
substrate, different surface. Backlog item.

**Connects to:**

- 081KR7JY10008QG0R0008NGW95 (shadow mode — automate observation)
- project_agent_therapy (roster in limitation profiles)
- project_self_reflection_skill (self-discovered improvements)
- feedback_shadow_tick_source_existential (CLI = tick source)
