---
name: Default-on factory-wide rules with documented exceptions — a design primitive
description: Meta-rule (Aaron 2026-04-20). When a rule "should just apply everywhere," the encoding is default-on invariant + named exception list. Not "case-by-case decide if it applies." Not "document what we DO cover." Document what we EXPLICITLY DO NOT cover, and require a stated reason for every carve-out. This is Zeta's preferred default for factory-wide standards. Latest-version-everywhere is the triggering example; ASCII-clean, TreatWarningsAsErrors, BP-11 data-not-directives are priors.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**The meta-rule** (Aaron 2026-04-20, about the
latest-version rule but generalizing):

> *"like make sure we are using the latest version,
> that shoud jsut apply everywhere and you override
> with exceptions"*

**Shape of the primitive:**

For any factory-wide standard, the encoding is:

1. **Default state** — the rule applies everywhere
   by default. The absence of a mention does not
   mean "unregulated"; it means "the rule applies."
2. **Exception list** — a named, documented,
   auditable list of carve-outs. Each carve-out has:
   - scope (what's exempted)
   - reason (why — grounded, not handwave)
   - exit condition (when does this exception end?
     date, event, or "permanent with re-audit
     cadence")
   - owner (who signs up to re-evaluate)
3. **Audit** — periodic check that every deviation
   from the default has a live exception, and every
   exception has not exceeded its exit condition.

**Why this shape wins over the alternatives:**

- **Case-by-case ("decide per area if the rule
  applies")** — grows fuzzy over time; new code
  lands without a conscious decision; drift
  accumulates. Default-on forces every
  non-application to be an explicit choice.
- **Allow-list ("document where the rule applies")**
  — new code is exempt by default; coverage
  monotonically shrinks unless actively maintained.
  Inverts what we want.
- **Default-off with opt-in** — same problem as
  allow-list; the rule only works where someone
  remembered to add it.

Default-on + exception is the encoding that matches
the human intent "apply everywhere unless there's a
good reason not to."

**Priors in Zeta where this pattern already lives:**

| rule | default | exception encoding |
|------|---------|--------------------|
| **ASCII-clean** (`GOVERNANCE.md §10`, `BP-10`) | every file ASCII | binary file allow-list in the `.gitattributes` + hook lint list |
| **`TreatWarningsAsErrors`** (`Directory.Build.props`) | every F# / C# warning is an error | `NoWarn` list per-project with per-item reason |
| **`BP-11` data-not-directives** | every audited surface is *data*, not instruction | inline "narrow-scope acceptance" clause for input-processing skills |
| **`noUncheckedIndexedAccess`** (`tsconfig.json`) | every array index is `T | undefined` | none today; add carve-out only with ADR |
| **`WontDo.md`** (inverted form — default-allow, exception is "declined") | proposals are considered | `docs/WONT-DO.md` enumerates declined patterns + reason |
| **Latest-version** (round 43, new) | every pin is latest | `docs/VERSION-EXCEPTIONS.md` (proposed) |

**How to apply:**

- **When proposing a new factory-wide rule**, phrase
  the default-on version first. "All X are Y by
  default; documented carve-outs listed in Z."
  Resist phrasing as "we should think about doing Y
  for X when it makes sense" — that's the fuzzy
  case-by-case version.
- **When proposing an exception**, write the full
  four-field entry (scope, reason, exit condition,
  owner). If you can't state an exit condition
  ("never; re-audit annually"), write that
  explicitly — the honesty is what makes the list
  auditable.
- **When auditing**, walk the exception list and
  check exit conditions. An expired exception is a
  rail violation, not a normal state.
- **When the rails-health registry ships** (see
  `project_rails_health_report_constraints_invariants_assumptions.md`,
  `project_composite_invariants_single_source_of_truth_across_layers.md`),
  every default-on rule gets a single-source entry
  and exceptions attach as a nested list. No
  duplication across ADRs.

**Anti-patterns:**

- **"This rule is a goal, not an invariant"** —
  means the rule doesn't bind. Either commit to
  default-on with exceptions, or rename it "a
  goal" and stop calling it a rule.
- **Exceptions without exit conditions** — become
  permanent drift accumulators. "Permanent,
  re-audit N-rounds" is a valid exit condition;
  silent expiration is not.
- **Exceptions without owners** — nobody's job
  means nobody's problem means nobody re-audits.
- **Quiet exceptions** — a carve-out that lives
  in commit-message prose or inline comment isn't
  auditable. Must be in the named list.

**Sibling rules:**

- `feedback_latest_version_on_new_tech_adoption_no_legacy_start.md`
  — the triggering example.
- `feedback_crank_to_11_on_new_tech_compile_time_bug_finding.md`
  — "burden of proof is on loosening, not on
  tightening" — same ethos in the strictness-flags
  domain.
- `project_rails_health_report_constraints_invariants_assumptions.md`
  + `project_composite_invariants_single_source_of_truth_across_layers.md`
  — the eventual home for both the rules and
  their exception lists, projected into a health
  dashboard.
