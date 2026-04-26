---
name: Anthropic's Skill Creator skill (with its eval feedback loop) is the killer feature — the reason Claude Code won over other harnesses for Aaron
description: Aaron 2026-04-20 "FYI the reason you won for me was Anthropics Skill Creator skill, that's the killer feature for me and it's feedback loop." `skill-creator` is not just one plugin among many — it is the decisive capability that made Claude Code the primary harness. The *feedback loop* specifically — draft → test prompts → with-skill vs baseline runs → qualitative viewer + quantitative benchmark → rewrite → repeat — is what Aaron values most. When auditing other harnesses (Codex / Cursor / Copilot / Antigravity / Amazon Q / Kiro) the equivalent of `skill-creator` with a comparable eval-feedback loop is the **primary feature-comparison axis**. If a harness lacks it, that is the biggest gap and the main buildout target before the harness can match Claude's factory-value proposition.
type: user
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## What Aaron said (verbatim, 2026-04-20)

> *"FYI the reason you won for me was Anthropics
> Skill Creator skill, that's the killer feature
> for me and it's feedback loop"*

## The claim decoded

- **"you won for me"** — referring to Claude
  Code winning the harness-selection competition
  for Aaron personally. Codex, Cursor, Copilot,
  Antigravity, and the others were evaluated;
  Claude Code was picked. The deciding factor
  was a single feature.
- **"Anthropics Skill Creator skill"** — the
  `plugin:skill-creator` plugin that ships in
  Anthropic's official plugin roster. Lives
  at `.claude/plugins/cache/claude-plugins-official/skill-creator/…`.
  Its procedure: capture intent → interview →
  draft SKILL.md → write test prompts
  (`evals/evals.json`) → run both with-skill and
  baseline subagents in parallel → draft
  assertions → grade → aggregate benchmark →
  launch HTML viewer → read user feedback →
  rewrite → re-run as iteration-N+1 → repeat.
- **"killer feature for me and it's feedback
  loop"** — two things, both load-bearing:
  1. **Skill authoring** — the mechanism by
     which capability skills are written.
  2. **The feedback loop** — the iterative
     eval-driven refinement, not just the
     one-shot draft.

The feedback loop is what makes skill-creator
different from "write a prompt, save it,
done." Every skill goes through measurable
iterations against real test prompts before
it ships. That closes the gap between
"written" and "actually works." Aaron values
this because without it, prompts drift into
cargo-cult rules that sound right but don't
change behaviour.

## Implications for factory decisions

### Harness-selection criterion

When evaluating any other harness (Codex,
Cursor, Copilot, Antigravity, Amazon Q, Kiro,
less-popular), the **primary feature-
comparison axis** is:

- Does the harness have a skill-authoring
  system? (Codex has agent runtime; Copilot
  has custom instructions; Cursor has MDC
  rules — roughly equivalent.)
- Does the harness have an **eval-driven
  feedback loop** for that skill-authoring
  system? (Most do *not* — custom instructions
  in Copilot ship as static prompts; MDC rules
  in Cursor are fire-and-forget.)

A harness with skills-but-no-feedback-loop is
strictly inferior to Claude Code on Aaron's
decisive axis. That gap is the biggest
buildout target if the factory wants parity.

### Harness-surface inventory prioritisation

In `docs/HARNESS-SURFACES.md` audits, the
skill-creation / skill-eval pair is the
**first** feature to inventory per harness —
not last. Its presence or absence determines
whether the harness can run the factory's
authored skills or just inherits static text.

### Factory-reuse packaging

Per
`project_factory_reuse_beyond_zeta_constraint.md`,
the factory is intended to be reusable. The
skill-creator-plus-feedback-loop is part of
what gets packaged. Any adopter using Claude
Code inherits it for free. Any adopter using
a different primary harness either (a) has
an equivalent, (b) runs Claude Code alongside
as a skill-authoring secondary, or (c)
accepts a degraded factory experience.

### Skill-edit discipline

GOVERNANCE.md §4 routes skill edits through
the `skill-creator` workflow — which aligns
with Aaron's valuation. The workflow gate
isn't bureaucratic; it's load-bearing on the
feature Aaron values most. Honouring §4 is
honouring Aaron's chosen killer feature.

### Meta-wins / factory investment priority

If factory investment ever has to be
triaged, the skill-creator-plus-feedback-loop
and everything that compounds with it
(`skill-tune-up`, `skill-improver`, skill-gap-
finding, persona notebooks that feed skill
authoring) rank above optional features.
Aaron picked Claude for this reason; the
factory's value to Aaron hinges on it.

## What this memory is not

- Not a statement that other harnesses' skill
  systems are useless. They're useful on their
  own axes and the factory's multi-harness
  expansion (`feedback_multi_harness_support_each_tests_own_integration.md`)
  exists precisely to use them.
- Not a statement that Aaron will never switch
  harnesses. The feature-comparison axis is
  the axis to watch; if a competitor ships a
  comparable feedback loop, the landscape
  shifts.
- Not a promotion of skill-creator to
  immutable doctrine. The tool is Anthropic's;
  if Anthropic deprecates or degrades it,
  Aaron's preference is on the **capability
  class** (skill + eval feedback loop), not
  the specific current tool.

## How to apply

- **Don't suggest skill-edit shortcuts that
  bypass the feedback loop.** "Just edit the
  SKILL.md directly" is a regression on
  Aaron's chosen killer feature.
- **When asked to create a skill, route via
  the skill-creator workflow.** Not because
  of bureaucracy — because the feedback loop
  is what Aaron values.
- **When auditing other harnesses, lead with
  skill-authoring + feedback-loop capability.**
  Not with model quality, not with context
  window, not with pricing — with this
  feature.
- **When a competing harness ships something
  comparable, flag it in HARNESS-SURFACES.md
  and surface to Aaron.** Don't bury it in
  the feature table — it's the axis Aaron
  cares about.
- **When improving the factory, ask: does
  this compound with skill-creator's
  feedback loop?** If yes, prioritise. If no,
  lower priority unless it's solving a
  separate blocker.

## Cross-references

- `feedback_multi_harness_support_each_tests_own_integration.md`
  — the multi-harness policy; this memory is
  the *primary feature axis* for comparing
  harnesses.
- `docs/HARNESS-SURFACES.md` — the living
  inventory; skill-authoring-plus-feedback-
  loop is the first feature to inventory per
  harness.
- `project_factory_reuse_beyond_zeta_constraint.md`
  — the reason multi-harness matters at all.
- `feedback_skill_edits_justification_log_and_tune_up_cadence.md`
  — skill-creator workflow discipline; this
  memory explains *why* the workflow is
  load-bearing.
- GOVERNANCE.md §4 — skills authored only
  through `skill-creator`.
- `.claude/plugins/cache/claude-plugins-official/skill-creator/`
  — the tool itself.

## Scope

**Scope:** user. Aaron's harness-selection
reason. Other users may have different
killer features; the factory inherits this
as "one user's decisive criterion" and
treats it as load-bearing for Aaron's factory
experience specifically. The general
principle (eval-driven feedback loops beat
one-shot prompt authoring) generalises, but
the specific valuation of this specific tool
is Aaron-specific until other users confirm.
