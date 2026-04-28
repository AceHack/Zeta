---
name: Prior-art + internet best-practices check ALWAYS happen, with cadence re-review
description: Before proposing any new pattern/tool/language/library, run a prior-art check (sibling projects, in-repo) AND an internet best-practices sweep; re-review on a cadence because tech/recommendations evolve.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Every net-new technical pattern, tool, language, library, or
workflow proposal MUST include two upfront checks, and MUST
be re-checked on a cadence thereafter:

1. **Prior-art check** — look at what sibling projects and
   the existing repo already do. Name the options concretely,
   not just "we could use X" in the abstract.
2. **Internet best-practices sweep** — run live web searches
   for current (this year's) guidance on the pattern class.
   Training data stales; official recommendations evolve.

These are not optional or "nice to have". They are the
architect's first move on any new-pattern decision. Skipping
them is the accidental-debt miss Aaron flagged when
`tools/invariant-substrates/tally.py` landed in Python
without comparing against SQLSharp's tooling choices.

**Cadence re-review** — findings from the sweep get logged
to `memory/persona/best-practices-scratch.md` and promoted
to stable `BP-NN` rules via ADR. The living-best-practices
discipline already captured in
`feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
now extends one tier higher: not just per-technology expert
skills, but every architect-level pattern decision.

**Why:** "Aaron 2026-04-20: prior art checks and best
practices check on the internet should always happen and
they should get re-review on a cadence because technology
and recommendations change over time based on learnings."
Same failure class as the .NET Code Contracts death — a
once-good choice that rotted because the checker didn't
keep pace with Roslyn.

**How to apply:**
- Any ADR that introduces a new tool / language / library
  MUST cite both (a) prior art inspected and (b) dated
  internet-best-practices findings. Undated findings are
  expired by default.
- Re-review stale decisions on the tech-radar cadence
  (every 5-10 rounds per `docs/TECH-RADAR.md`).
- Decisions without a cadence entry become tech debt
  automatically.
- The `skill-tune-up` / `skill-expert` live-search step
  is the prototype; other expert skills inherit the
  same pattern.
