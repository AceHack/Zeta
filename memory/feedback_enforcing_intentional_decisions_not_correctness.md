---
name: Hygiene can enforce intentionality, not just correctness
description: Aaron 2026-04-22 reframe — some hygiene layers aren't correctness-checks, they're forcing functions that make agents stop and decide. Absence-of-classification IS the violation.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22, closing the missing-prevention-layer meta-hygiene
sub-tick: *"we are enforcing intentional decsions"*.

**Rule:** when designing a hygiene rule, ask explicitly which of
two classes it belongs to:

1. **Correctness-enforcement** — the rule has a right answer
   the factory can compute or verify (ASCII-clean lint, build
   warnings-as-errors, spec/code drift detector). The rule
   catches *wrongness*.
2. **Intentionality-enforcement** — the rule has no right
   answer the factory can compute, but it forces the author
   to stop, think, and write down a decision. The rule catches
   *unthought* — the silent accretion of unexamined choices.

Both are valid hygiene. Neither is "weaker" than the other.
Intentionality-enforcement is often what a seemingly-thin
bookkeeping check actually is — and calling it out as such
clarifies why it's load-bearing even when it "only" diffs two
lists.

**Why:** The missing-prevention-layer audit
(`tools/hygiene/audit-missing-prevention-layers.sh`) is a
literal diff between `docs/FACTORY-HYGIENE.md` main table and
`docs/hygiene-history/prevention-layer-classification.md`
matrix. On the surface it looks mechanical — "row N in list A
but not in list B" — and I initially explained it that way to
Aaron ("bookkeeping sentinel, not a real audit"). Aaron
reframed: *"we are enforcing intentional decsions"*. The
script's value isn't that it finds wrong answers; it's that it
makes the "no answer" state impossible to ship silently. A
hygiene row landing without a classification is the author
declining to decide, and declining-to-decide is the failure
mode the factory wants to prevent.

This generalises beyond row #47. Any hygiene layer that looks
like "every X must have a matching Y" is probably
intentionality-enforcement:

- Every ADR must have a decision block → forces intentional
  decision-recording, not correct decisions.
- Every BP-NN rule must cite a decision doc → forces
  intentional rule-authorship.
- Every skill edit must have a justification log row →
  forces intentional skill-change reasoning.
- Every hygiene row must have a prevention classification →
  forces intentional prevention-vs-detection thinking at
  author-time.

None of those can be checked for correctness by a script. All
of them succeed when the script's "absence check" passes,
because the absence-check forces the human/agent to write
something — and the writing itself is the value.

**How to apply:**

- When proposing a new hygiene rule, label it
  correctness-enforcement or intentionality-enforcement in the
  `Checks / enforces` column. The label changes how the rule is
  evaluated: correctness rules are measured by
  false-positive/false-negative rates; intentionality rules are
  measured by whether the required artifact exists and is
  non-trivial.
- Do not under-sell intentionality rules as "bookkeeping" or
  "just checking that the paperwork is there". The paperwork
  IS the decision surface. A forced decision is better than a
  silent default.
- When an agent (including me) explains a hygiene rule and
  reaches for "it's only a diff / only a sentinel" language,
  pause: that framing may be honest about the mechanism but
  dishonest about the value. Re-explain in intentionality
  terms.
- Companion memories:
  `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  (exception-declaration is itself an intentionality forcing
  function); `feedback_script_and_artifact_name_honesty_ensure_not_install.md`
  (script-name honesty forces intentional naming).

**First-land surface:** `docs/hygiene-history/prevention-layer-classification.md`
header + FACTORY-HYGIENE row #47 `Checks / enforces` column —
both updated 2026-04-22 to use "enforcing intentional
decisions" framing instead of "bookkeeping sentinel".
