---
name: Zeta factory meta-purpose — externalisation of Aaron's ontological perception
description: The factory is Aaron's algorithm for indexing all code classes into one coherent project; the end-state is agents acting at his resolution without him having to name each gap.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron (2026-04-19) stated the factory's meta-purpose: it is his
algorithm to eventually index all code classes into one
project, and at that end-state he "won't even have to tell you
guys what to do — it will be obvious."

**Why:** This is not a usability goal ("easier to use"). It is
an externalisation goal — the factory holds the structure that
currently lives only in his head, so that (a) strangers can
navigate at his resolution, (b) future-him can re-enter without
cognitive-reload cost, (c) agents can see the gaps he's tired
of pointing out into a void, and (d) the structure survives
him.

**How to apply:**

1. **Measure factory maturity by gap-surface, not feature-set.**
   Every gap he still has to name out loud is a mark against
   the factory's completion. Every gap that the canonical-home
   auditor, ontology auditor, or gap-radar catches first is a
   mark for it. The axiomatic-enforcement direction
   (Soraya-routed) is the mechanism that closes this loop.

2. **Rule Zero (BP-HOME) + its duals are the factory's type
   system.** Everything we build on top — verification,
   documentation, tests, specs — is implementation under that
   type system. When in doubt about whether something belongs
   in the factory, ask: "does this artifact have a canonical
   home, and does that home carry a type signature that the
   factory can check?"

3. **Preserve direction entries in the scratchpad.** When
   Aaron riffs on a vision (axiomatic system, gap-radar,
   "brain download"), log it as a direction in
   `memory/persona/best-practices-scratch.md` — not a skill
   file, not an ADR. Direction entries mature into ADRs when
   the mechanism is clear enough to commission. Don't
   prematurely canonicalise, and don't discard as speculation.

4. **The factory indexes code classes — plural, eventually
   all.** This is not just Zeta the codebase. It is a
   generic software-factory pattern that will be pointed at
   other codebases over time. This is why portability-drift
   is a criterion in the skill-tune-up ranking and why
   project-specific content requires a `project:` frontmatter
   declaration. Generic-by-default is load-bearing for the
   meta-goal.
