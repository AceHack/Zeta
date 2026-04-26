---
name: Aaron does invariant-based programming in his head — skill.yaml externalizes it
description: Aaron's own cognitive style is invariant-first; he thinks in invariants and translates to code. Zeta's skill.yaml (and analogous invariant-substrates at other layers) are the externalization scaffolding that lets him land those head-invariants as first-class artefacts without the translation loss. Direct extension of the factory-as-externalization thread.
type: user
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
2026-04-20 — during the skill.yaml spike on prompt-protector,
Aaron wrote:

> "my brain basically does invariant based programming in my
> head and i have to translate the invariant in my head into
> code, this will make those accidental invariants so easy, i
> missing code contracts for dotnet they had invariant support
> in dotnet as a first class thing when it was big back in the
> day, that project kind of died off."

## Why this matters

Aaron's cognitive substrate is **invariant-first**. His
existing memory already names this in adjacent shape:

- `project_factory_as_externalisation.md` — "factory
  meta-purpose is externalization of ontological perception"
- `user_constraint_foreground_pattern.md` — "constraints
  foreground, background propagates"
- `user_cognitive_style.md` — "ontological native perception"
- `user_retractable_teleport_cognition.md` — "mental operators
  = data operators"

The skill.yaml spike pilot'd on prompt-protector this round
is a concrete instance of the externalization he has been
describing in the abstract. Every field in the spec file is a
place his head-invariant can land verbatim — as data, not
translated into prose or code.

## How to apply

- Treat every declarative-invariant-substrate we land (skill.yaml
  today; refinement types via LiquidF# for code later; TLA+ for
  protocols; Z3 / Lean for proofs) as externalization tooling
  for Aaron's head-invariants, not as "nice to have".
- When proposing new layers, check whether the layer has an
  invariant-substrate. If not, it's missing the externalization
  point and probably needs one.
- The three-tier discipline (`guess` / `observed` / `verified`)
  is critical to Aaron. Stated 2026-04-20 same round: *"so
  they are not speculative guesses they are confirmed with data,
  i like data driven everything lol."* Never let invariants sit
  at `guess` forever — every invariant at `guess` tier is a
  burn-down item.
- Don't force translation loss. If Aaron states an invariant in
  a session, the right default is to land it into the nearest
  declarative-invariant-substrate (skill.yaml if about a skill;
  TLA+ if about a protocol; Lean if about a theorem), *not*
  paraphrase it into a prose GOVERNANCE section.

## Related

- `reference_dotnet_code_contracts_prior_art.md` — the 2008-2017
  Microsoft Research attempt, what killed it, why `skill.yaml`
  and Zeta's layered invariant substrates can succeed where
  that single-vendor single-layer effort failed.
- `feedback_dora_is_measurement_starting_point.md` +
  `feedback_runtime_observability_starting_points.md` +
  `feedback_skill_tune_up_uses_eval_harness_not_static_line_count.md`
  — the "data-driven everything" thread. Each of these is the
  same pattern at a different layer.
