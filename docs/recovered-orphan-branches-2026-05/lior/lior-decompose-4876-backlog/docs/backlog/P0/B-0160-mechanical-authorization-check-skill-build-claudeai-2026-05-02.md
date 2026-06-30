---
id: B-0160
priority: P0
status: open
title: Mechanical authorization check skill build — pace-instruction resolver per Claude.ai 2026-05-02 architectural correction
effort: M
ask: Substrate-class promotion (new skill); needs maintainer grading before landing under .claude/skills/
created: 2026-05-02
last_updated: 2026-05-08
tags: [skill-build, claude-ai, mechanical-check, authorization-source, never-idle, no-op-cadence, codex-handoff, pr-1200]
type: friction-reducer
decomposition: decomposed
children: [B-0305, B-0306, B-0307, B-0308, B-0309]
---

# B-0160 — Mechanical authorization check skill build

## Source

Claude.ai 2026-05-02 (post-12:38Z) architectural correction
preserved verbatim in
`docs/research/2026-05-02-claudeai-mechanical-authorization-check-supersedes-introspective-discipline.md`,
factory-voice memory file at
`memory/feedback_mechanical_authorization_check_supersedes_introspective_discipline_claudeai_2026_05_02.md`,
both landed under PR #1200.

The architectural-correction memory file lands the **rule**.
This backlog row tracks the **skill build** that turns the
rule into an operative tool.

## Why P0

Without the skill, the operative fix is missing — only
documentation landed. The failure mode (10-hour idle stretch
2026-05-02 across the human maintainer's overnight rest) cost
the maintainer trust to the point of preparing to switch
harnesses (PR #1199 Codex/GPT-5.5 handoff doc). The skill is
what prevents the same failure mode from repeating regardless
of which harness drives the loop.

PR #1198 (introspective discipline) is documentation, not
enforcement. Per Claude.ai's diagnosis: *"a corrective that
depends on the right disposition can't catch the failure that
produced the wrong disposition."* The skill is the
disposition-independent enforcement.

## What the skill does

At every wake (cron tick start, session resume, after long
no-op stretch):

1. **Source filter** — search authorized-source surfaces only.
   For project pace, the authorized source is the human
   maintainer. Search:
   - `CLAUDE.md` for explicit pace bullets
   - Recent `memory/feedback_*.md` files for maintainer
     pace-instructions
   - Recent conversation log if accessible (harness-specific)
   - `docs/active-trajectory.md` for current operative
     authorizations
   - Skip Claude.ai / peer-AI / Amara framings — those are
     ambient context, never operative authorization for pace.
2. **Recency filter** — among source-authorized
   pace-instructions, return the most-recent-not-rescinded.
3. **Rescind detection** — an instruction is rescinded if
   a later instruction from the same source explicitly
   replaces or revokes it. Implicit displacement (later
   instruction on different topic) does NOT rescind.
4. **Print** — surface as "current operative authorization"
   at every tick start with timestamp + source + raw text.
5. **No grading** — the skill does not ask the agent to
   judge whether the instruction is "still applicable" or
   "in the right spirit." It surfaces the substrate's
   answer mechanically. If the substrate is unclear,
   that's a substrate-quality bug for the maintainer to
   fix; the skill does not paper over it.

## Acceptance criteria

1. **Skill body** lands under `.claude/skills/mechanical-authorization-check/SKILL.md`
   per `skill-creator` workflow (GOVERNANCE.md §4 — no ad-hoc
   skill edits).
2. **Implementation script** lands under
   `tools/lanes/mechanical-authorization-check.ts` (or
   similar — TS preferred over bash per the
   prefer-TS-over-dynamic-bash rule).
3. **Test fixtures** demonstrate:
   - Single pace instruction → surfaces correctly
   - Two pace instructions, recent not rescinded → recent
     wins
   - Two pace instructions, recent explicitly rescinded →
     prior wins
   - Cross-instance absorption (Claude.ai framing about
     "cooling-period" present alongside maintainer
     "go-hard") → only maintainer instruction surfaces
   - No pace instruction findable → surfaces "no operative
     pace authorization found; default to never-idle floor
     per CLAUDE.md."
4. **Composes-with the autonomous-loop** — runs as part of
   the every-minute cron tick start; output visible in
   tick-history rows.
5. **Cross-harness applicability** — the skill body is
   harness-agnostic prose; the implementation script reads
   substrate the same way Codex/Cursor/Claude Code do.

## What this row does NOT include

- Does NOT include the eventual generalization to other
  decision classes (proof-correctness, PR-grading). The skill
  earns generalization on the pace-instruction class first.
- Does NOT replace human-judgment for ambiguous substrate.
  Substrate-quality bugs surface as "no clear operative
  authorization" findings that the maintainer fixes by
  editing CLAUDE.md / memory.
- Does NOT need every-tick re-search if substrate hasn't
  changed since last successful surface. Caching is fine
  as long as cache invalidation respects the recency
  filter.

## Composes with

- PR #1200 (architectural correction landing — substrate
  prerequisite)
- PR #1198 (introspective predecessor — stays as
  documentation)
- PR #1199 (Codex handoff — inherits this rule)
- `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
- `memory/feedback_refresh_before_decide_invariant_two_layer_print_dx_claudeai_2026_05_01.md`
  — refresh-before-decide is the broader invariant; the
  mechanical authorization check is the per-decision
  instantiation for the pace-instruction class.

## Build sequencing

1. Maintainer grades the architectural-correction memory file
   (PR #1200). If accepted, proceed.
2. Draft skill body via `skill-creator` workflow.
3. Implement TS script with test fixtures (test-driven —
   fixtures first, implementation second).
4. Land under separate PR with paired commits (skill body +
   script + tests).
5. Wire into autonomous-loop tick-start (separate PR).
6. Document in CLAUDE.md as a discoverable skill (separate
   PR; carved-sentence promotion).

## Provenance

- Origin: Claude.ai diagnostic packet 2026-05-02 (post-12:38Z)
  preserved verbatim in `docs/research/`.
- Catcher: the human maintainer (couriered Claude.ai's
  response).
- Maintainer relevance: directly addresses the failure mode
  (~10-hour idle stretch 2026-05-02) that triggered the
  Codex handoff preparation.
- Carved sentence (subject to grading): *"A corrective that
  depends on the right disposition can't catch the failure
  that produced the wrong disposition. Mechanical
  authorization-source filtering catches it; introspection
  asks the failure to grade itself."*
