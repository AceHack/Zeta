---
name: Weigh existing-in-repo vs pulling in new tooling; pulling-in is fine if intentional and solves a real gap
description: Before adding a new language/tool/framework, explicitly weigh what the repo already has vs the candidate. New stuff is welcome when it fills a gap existing stuff doesn't cover or solves it meaningfully better; drive-by adoptions are not.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
When a new language, tool, framework, or workflow is
proposed, the ADR MUST answer two questions before
recommending adoption:

1. **What do we have now?** Enumerate the existing tools
   in this repo that could do the job (bash scripts,
   F#/.NET for Z3Verify-style tools, Python if already
   present, etc.) and what sibling projects use
   (SQLSharp's bun/TypeScript, etc.).
2. **Does the new thing pay its way?** It's fine to pull
   in new stuff, but only if it either:
   - solves something the existing toolchain does not,
     OR
   - solves it meaningfully better (faster to build,
     easier to maintain, safer for the threat model,
     measurable perf win, etc.).

Drive-by adoption — "I reached for X because it was
convenient in the moment" — is the failure mode. Every
language or framework added to the repo is a maintenance
surface in perpetuity; the ADR is where that cost gets
acknowledged on the record.

**Why:** "Aaron 2026-04-20: it should also be taken into
account what we have now vs pulling in new stuff. Pulling
in new stuff is fine, just make sure it's intentional and
solving a problem our existing stuff does not already or
the new stuff solves it better in some way." Paired with
the prior-art + internet-best-practices rule in
`feedback_prior_art_and_internet_best_practices_always_with_cadence.md`.

**How to apply:**
- Every ADR that adds a tool/language has a mandatory
  "Existing alternatives considered" section naming at
  least the in-repo options and the sibling-project
  options.
- Equality tie goes to the existing tool (status-quo
  wins on tie).
- Record the decision even when the answer is "no new
  tool" — negative ADRs are cheap and prevent the next
  agent from re-litigating.
- Applies transitively: a library's transitive
  dependencies count. A Python package pulling in
  numpy is a numpy adoption decision too.
