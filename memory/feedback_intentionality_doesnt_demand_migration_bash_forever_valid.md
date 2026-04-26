---
name: Intentionality-enforcement demands a recorded decision, not migration — "stay bash forever" is a valid answer
description: Factory hygiene rules that force a decision at landing (intentionality-enforcement class) accept any answer if the reasoning holds up, including the null-action "stay as-is forever"; what they reject is silence.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22: *"The intentionality-enforcement reframe
doesn't demand migration; it demands a recorded decision. A
'this should stay bash forever' is a valid answer if the reason
holds up."*

**Why:** I over-corrected on the post-setup script stack audit.
When labeling 8 pre-existing bash scripts I defaulted 7 of them
to "bun+TS migration candidate" as if the migration were the
only non-violation outcome. Aaron surfaced that I had collapsed
two distinct dimensions:

1. **Intentionality-enforcement** (the rule): force a decision.
2. **Migration preference** (a policy): default to bun+TS.

The rule is about the *decision being recorded*. The policy is
a default for *which way the decision usually goes*. A recorded
"we considered bun+TS and chose to stay bash because X" fully
satisfies the rule — it does not violate intentionality, it
exercises it.

**How to apply:**

- When a factory rule is classified as intentionality-enforcement
  (per `memory/feedback_enforcing_intentional_decisions_not_correctness.md`),
  the allowed answer set is always "{all the preferred options}
  + {the status quo with a recorded rationale}". Never collapse
  the answer set to only-the-preferred options.
- In particular: post-setup bash scripts that fall under an
  exception category may be "stay bash forever (recorded
  decision)" — the header comment block states the rationale
  ("typed parse would increase friction without correctness
  gain", "data volume tiny", "no maintenance pressure") and
  that IS the artifact. No BACKLOG migration row required.
- The migration-candidate label remains valid when migration
  WILL happen eventually, but it is not the forced outcome.
- Re-examine existing migration-candidate labels periodically:
  is the reason for migrating still load-bearing, or has this
  script quietly become "stay bash forever" without anyone
  updating the label?
- Generalises to any intentionality-enforcement rule: the
  factory rule asks "decide", not "decide the preferred way".
  Decisions against the default are first-class answers when
  backed by rationale.

**Contrast with "undersell as bookkeeping":** the prior memory
(`feedback_enforcing_intentional_decisions_not_correctness.md`)
corrected me from underselling the audit as "bookkeeping
sentinel". This memory corrects me from the opposite failure
mode — overselling the default option as the only option.
Both failures stem from collapsing a decision-forcing rule into
a decision-prescribing rule. They are symmetric wrong turns;
the correct posture is between them.

**Applies to this session directly:** the 7 "migration candidate"
labels on `tools/audit-packages.sh`, `tools/lint/no-empty-dirs.sh`,
`tools/lint/safety-clause-audit.sh`, `tools/alignment/audit_commit.sh`,
`tools/alignment/audit_personas.sh`, `tools/alignment/audit_skills.sh`,
`tools/alignment/citations.sh` were not wrong — they recorded a
decision — but the answer set they implicitly offered was too
narrow. A future re-examination pass can flip any of them to
"stay bash forever" if the bun+TS upside no longer holds up.
The BACKLOG row for the consolidated migration is the default
path; it is not a verdict.
