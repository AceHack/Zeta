# DMAIC factory-improvement proposal — template

Fill this template when proposing a **factory improvement**
— a new `docs/FACTORY-HYGIENE.md` row, a new BP-NN rule,
a change to `GOVERNANCE.md`, or any process change affecting
how the factory operates. Feature ADRs (code changes, public
API, etc.) keep their existing format.

**Why this template:** the factory's methodology of record
for improvements is Six Sigma's DMAIC cycle (see
`docs/FACTORY-METHODOLOGIES.md`). Filling the five sections
is the discipline — it forces the proposer to baseline
before intervening.

**Usage:** copy this file to `docs/DECISIONS/YYYY-MM-DD-<slug>.md`
(or include inline in a larger ADR) and replace the `{{…}}`
placeholders.

---

# {{Proposal title — short, outcome-framed}}

**Date:** {{YYYY-MM-DD}}
**Proposer:** {{agent / persona name, or human}}
**Status:** proposed | accepted | rejected | superseded
**Scope:** factory | project | both

---

## D — Define

**What exact problem does this address?**

{{Describe the observed drift, variance, or gap in one
paragraph. Cite specific evidence — a round-close
finding, a harsh-critic report, a retrospective audit
row, a user directive, a memory file.}}

**Who is affected?**

{{Named personas, skills, agents, or humans that feel
the problem today. If "every agent," say so and explain.}}

**Why now?**

{{Prompt-cost — is this blocking work? Is it
compounding? Is there a deadline-shaped constraint
driving it?}}

---

## M — Measure

**Current-state baseline (what does the problem measure today?)**

{{Quantitative where possible. Examples:

- "X of Y memories have no scope declaration (87%)"
- "Architect reviews block for a median of N rounds"
- "Z rows of FACTORY-HYGIENE have TBD owners"

If no baseline exists, say so explicitly — the first
Improve step is often "establish baseline."}}

**How will we know the Improve worked?**

{{Pre-specified success criterion. If the metric
doesn't move, the Improve didn't work. Examples:

- "Drop X/Y to below 20%"
- "Architect review median drops to 1 round"
- "All FACTORY-HYGIENE rows have named owners"}}

**Measurement cadence?**

{{How often do we re-measure to know the Control
phase is holding? Examples: every round close, every
5-10 rounds alongside agent-QOL audit, pre-commit.}}

---

## A — Analyze

**Root cause — why does the variance exist?**

{{One to three sentences. Resist the urge to jump to
the fix; the Analyze phase's purpose is to rule out
wrong fixes.}}

**Alternatives considered?**

{{List 2-3 candidate Improves with a one-line
trade-off for each. The one you're proposing should
win on explicit grounds — not default.}}

**Why this Improve over the alternatives?**

{{One paragraph. Reference Rodney's Razor if accidental
complexity is a factor. Reference factory-scope-vs-
project-scope if reuse is a factor.}}

---

## I — Improve

**What changes?**

{{Concrete list of edits: "Add row N to FACTORY-HYGIENE",
"Add BP-NN to AGENT-BEST-PRACTICES", "Land SKILL.md at
path X", etc. This is the part that would be a normal
BACKLOG checklist.}}

**Effort size (S/M/L per `next-steps` convention)?**

{{S = under a day. M = 1-3 days. L = 3+ days or
paper-grade.}}

**Tier (per `docs/research/skill-edit-gating-tiers.md`)?**

{{Tier 0 / 1 / 2 / 3 if this touches a SKILL.md.
N/A otherwise.}}

**Expected quantitative impact (tied to the Measure
success criterion)?**

{{Example: "Drops missing-scope rate from 87% → 20%
after back-fill cadence of 10/round for 9 rounds."}}

---

## C — Control

**What cadenced hygiene row or BP-NN rule prevents
regression?**

{{Every Improve must nominate a Control artifact. If
the Improve lands but no Control prevents regression,
the variance will return. Common Controls:

- New FACTORY-HYGIENE row (cadenced check)
- New BP-NN rule (always-on discipline)
- Absorb-time filter in a skill's procedure
- Pre-commit hook
- Round-close Architect sweep}}

**Cadence of the Control?**

{{Every commit / session-open / round-close / every
5-10 rounds / absorb-time on ingestion.}}

**Who owns the Control?**

{{Named persona, skill, or CI step. "TBD" is a yellow
flag — un-owned controls decay.}}

**Retrospective-measurement counterpart?**

{{Per `memory/user_absorb_time_filter_always_wanted.md`:
every Control (absorb-time preventive) pairs with a
Measure-phase retrospective audit that baselines the
Control's error rate. Name the retrospective audit or
cite "covered by existing row N of FACTORY-HYGIENE."}}

---

## Dependencies / cross-references

{{List other open research, ADRs, BACKLOG rows, or
memories this proposal depends on or interacts with.}}

## Open questions

{{Things the proposer has identified as needing human
or Architect resolution before landing.}}

---

## References

- `docs/FACTORY-METHODOLOGIES.md` — Kanban + Six Sigma
  as factory methodologies of record.
- `docs/FACTORY-HYGIENE.md` — where Control rows live.
- `docs/AGENT-BEST-PRACTICES.md` — where BP-NN rules
  live.
- `memory/user_absorb_time_filter_always_wanted.md` —
  the Control-vs-Measure pairing Aaron prefers.
- `memory/user_kanban_six_sigma_process_preference.md`
  — the source preference this template operationalises.
