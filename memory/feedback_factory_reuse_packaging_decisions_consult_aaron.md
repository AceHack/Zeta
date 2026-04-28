---
name: Consult Aaron on factory-reuse packaging decisions — co-define best practices (prior art exists; best practices don't)
description: Aaron 2026-04-20 — on deciding how to package Zeta's software factory for reuse across projects, Aaron wants to be involved in the decisions because there is some prior art (Claude Code plugins, Anthropic skills, etc.) but no established best practices. We will be helping define them. Aaron's cognitive style enjoys best-practice thinking, so this is a direction he wants to co-drive rather than delegate.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Rule.** Do not make factory-reuse packaging decisions
unilaterally. When the factory is being packaged for reuse
across projects (the constraint recorded in
`project_factory_reuse_beyond_zeta_constraint.md`), surface
the decision to Aaron and co-design.

**Why.** Aaron, 2026-04-20:

> "We we decide how to start packaging up our software factory
> for reuse i want to be involved in the decision there are no
> real best practices yet and we will be helping to define them,
> i want to be part of that"

Then the correction one turn later:

> "there is some prior art i would just say no best practices"

And the reason, plainly stated:

> "my brain personally loves thinking about best practices that
> exercises my brain in just the way i like"

Prior art that exists (not exhaustive): Claude Code's plugin
system, Anthropic's skill packaging, OpenAI Agents SDK's
session / agent scaffolding patterns, Microsoft Semantic Kernel
skill packaging, standard .NET / npm / cargo template-repo
patterns, OSS cookiecutter ecosystems. **What is missing is
codified best practices for AI-software-factory reuse
specifically** — how to split generic agent/skill/governance
infrastructure from project-specific overlays when the factory
itself is the product.

**How to apply.**

- When a packaging decision is on the table (extraction shape,
  dependency model, overlay mechanism, governance split,
  persona-reuse policy, living-best-practices refresh shape),
  bring the decision to Aaron with:
  - The observed prior art (cite it honestly).
  - Two or three candidate packaging approaches.
  - The trade-offs on each.
  - Your recommendation, with reasoning.
- Avoid the "I'll just pick the obvious one and move on"
  shortcut. Aaron enjoys this kind of thinking; his
  participation is a feature, not friction.
- Small, reversible factoring moves (mark a skill `project:
  zeta` that was already Zeta-specific; pull a helper into a
  generic location when it was already generic) do NOT need
  consultation — they are executions of the constraint, not
  packaging decisions.
- Big, shaping decisions (extract a template-repo; define the
  overlay system; pick a plugin loader; design the
  living-best-practices refresh cadence) DO need
  consultation.

**What this is not.** This is not a deferral rule across
factory work generally — Aaron's `feedback_fix_factory_when_blocked_post_hoc_notify.md`
still stands for blockers. This rule is specifically about
*packaging for cross-project reuse* where the best-practice
surface itself is being defined.

**Related memory.**

- `project_factory_reuse_beyond_zeta_constraint.md` — the
  constraint this rule governs.
- `user_aaron_enjoys_defining_best_practices.md` — the
  cognitive-style signal that motivates the involvement rule.
- `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  — the living-best-practices discipline that factory-reuse
  packaging has to satisfy.
- `feedback_durable_policy_beats_behavioural_inference.md` —
  why this is codified as a feedback memory rather than
  inferred from "Aaron is involved in big decisions" vibes.
