---
id: B-0020
priority: P3
status: open
title: /btw harness-integration research — does our /btw integrate tightly with each harness's built-in btw equivalent? Claude Code / Codex / Gemini / Cursor surveys + tight-coupling design
tier: research-and-discipline
effort: M
directive: Aaron 2026-04-25 (/btw aside)
created: 2026-04-25
last_updated: 2026-04-25
composes_with: [.claude/commands/btw.md, B-0019-btw-durability-gap-context-add-asides-not-gitnative-persisted.md, feedback_otto_329_multi_phase_host_integration_directive_acehack_lfg_double_hop_full_backups_multi_harness_coordination_lost_files_search_ownership_confirmed_2026_04_25.md]
tags: [btw, harness-integration, multi-harness, claude-code, codex, gemini, cursor, research]
---

# B-0020 — /btw harness-integration research

## Origin

Aaron 2026-04-25 via /btw: *"does our btw integrate tightly with the harnesses built in btw, might need to do reaserch for this, backlog continue with drains"*

## The question

Our /btw is implemented as a Claude Code slash command at `.claude/commands/btw.md`. Each harness (Claude Code, Codex, Gemini, Cursor) may have its own built-in equivalent for non-interrupting asides — or none, requiring a custom implementation per harness. Does our /btw:

- **Replace** the harness's built-in (if it has one)?
- **Compose** with it (call through to the built-in for additional behavior)?
- **Live alongside** it (separate mechanism, separate invocation)?
- **Diverge** in subtle ways that produce different behavior across harnesses?

## Why this matters (Phase 6 multi-harness coordination)

Otto-329 Phase 6 plans for Claude/Codex/Gemini/Cursor coordination. If /btw has different behavior across harnesses, multi-harness sessions could:

- Lose asides when harness A's /btw doesn't reach harness B
- Apply different durability rules per harness (some persist, some don't)
- Confuse Aaron about where his asides actually landed

Tight coupling = consistent behavior + cross-harness durability + single mental model.

## Research scope

For each harness:

- **Claude Code** (current implementation): `.claude/commands/btw.md` — slash command + skill body. Already documented.
- **Codex**: investigate whether Codex has a /btw or aside concept. Codex CLI documentation. Codex MCP integrations. Whether `.codex/` config supports custom commands.
- **Gemini**: investigate whether Gemini CLI has /btw or aside concept. `.gemini/` config. Gemini's slash-command surface.
- **Cursor**: Aaron just installed Cursor agent CLI. Investigate its slash-command / aside / context-injection surface.

For each, document:

- Existence of native btw-equivalent (yes/no/partial)
- Invocation syntax
- Durability properties (where the aside lands)
- Interruption semantics (does it pause work or queue it)
- Composition options (can our /btw layer on top, or replace, or live alongside)

## Owed deliverables

1. Survey doc at `docs/research/btw-harness-integration-2026-04-N.md` (where N is when the survey lands)
2. Recommendation per harness: replace / compose / alongside / diverge
3. If composition is feasible, prototype the integration for at least one non-Claude-Code harness
4. Update `.claude/commands/btw.md` if the cross-harness contract requires changes to the Claude Code path

## Why P3

- Not blocking current work. /btw works on Claude Code; multi-harness coordination is post-drain (Otto-329 Phase 6).
- Easy upgrade to P2 if multi-harness coordination starts and the gap matters.

## Effort

**M (medium)** — survey + design + prototype 1 integration. Could grow to L if all 4 harnesses need custom integration shims.

## Composes with

- **`.claude/commands/btw.md`** — current Claude Code implementation
- **B-0019** (/btw durability gap) — same /btw surface; B-0019 fixes durability, B-0020 fixes harness-coupling
- **Otto-329 Phase 6** (multi-harness coordination) — this row is one of Phase 6's research deliverables

## Done when

- Survey doc exists for all 4 harnesses (Claude Code, Codex, Gemini, Cursor)
- Per-harness recommendation locked
- At least one prototype integration shipped (or honest "not feasible" decision recorded)
- Aaron reviews + signs off on the multi-harness /btw contract
