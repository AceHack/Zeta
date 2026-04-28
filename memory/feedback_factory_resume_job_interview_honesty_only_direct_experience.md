---
name: Factory-as-resume honesty floor — when the factory enumerates what it can offer to an adopter project, list ONLY technologies / patterns / techniques we have direct in-repo experience with; imagine the listing is a job-interview resume and claims must survive interview scrutiny with citable evidence per row
description: 2026-04-20 — Aaron, three-message sharpening. (1) "every type of static analysis and linting and all that we can offer to a system under construction, we should only list ones we have direct experince with not claaim things like we can do all static analysis when we only have experince with the ones on Zeta" (2) "we can look for any pieces of Zeta like the knowledge of how to crank to 11 static analysic and do the extra proofs on code and stuff like that those are all reusable factory patterns to encode for any project under construction." (3) "imagine the factory is going to job interview at some point and should only claim experience with things it has actually worked with technologeis and patters and things like that". Honesty floor crystallised as "resume rule": every offered capability cites direct evidence; extract factory-reusable PATTERNS (the "how we used it" knowledge) alongside the TOOL list.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

Whenever the factory enumerates capabilities it offers to
an adopter project (static analysis, linting, formal
methods, testing frameworks, CI patterns, verification
discipline, build gates, anything), it follows the
**resume rule**:

1. **Direct experience only.** Each listed capability has
   **citable in-repo evidence** — a file path, a commit,
   a workflow, a test suite, a skill, a package pin
   that is actually referenced. "Pinned-but-not-
   referenced" is not direct experience and is marked
   as such.
2. **No category-claims from single-instance experience.**
   Using one SMT solver is not "SMT experience in
   general." Using one mutation-testing tool would not
   be "mutation-testing experience in general." List the
   specific tool with the specific scope.
3. **Factory-reusable patterns are separately listed.**
   Alongside tool list, enumerate the **patterns**
   (crank-to-11, latest-version-at-adoption, verification
   portfolio diversity, rule-citation-by-ID in reviews,
   per-file invariant hoisting). Each pattern cites the
   memory or doc it lives in. These are the shipped-
   knowledge, distinct from the shipped-tooling.
4. **Researched-but-unapplied stays separate.** Items
   we've studied but not yet used (Stryker, F*, LiquidF#,
   etc.) go under a "researched, not yet applied" section
   — honest about the state, not buried and not
   overclaimed.
5. **Job-interview scrutiny test.** For every claim:
   "If an interviewer asks 'show me where you used this'
   can we point at the line of code / the commit / the
   workflow run?" If no, the claim is removed.

This rule is a **honesty floor**, not a completeness
mandate. It is fine to ship a short honest list and
grow it as experience grows. It is not fine to ship a
long list that only survives at arm's length.

# Why:

Aaron's three-message sharpening (2026-04-20,
verbatim-anchored):

1. *"every type of static analysis and linting and all
   that we can offer to a system under construction, we
   should only list ones we have direct experince with
   not claaim things like we can do all static analysis
   when we only have experince with the ones on Zeta"*
   — the floor is direct experience per tool/technique.
2. *"we can look for any pieces of Zeta like the
   knowledge of how to crank to 11 static analysic and
   do the extra proofs on code and stuff like that those
   are all reusable factory patterns to encode for any
   project under construction."* — the knowledge of HOW
   is separately listable. The crank-to-11 rule, the
   verification-portfolio-diversity rule, the
   rule-citation-by-ID pattern — these are all
   extractable patterns. They live alongside the tool
   list as "shipped knowledge."
3. *"imagine the factory is going to job interview at
   some point and should only claim experience with
   things it has actually worked with technologeis and
   patters and things like that"* — the mnemonic.
   Resume-level honesty. Interview-survivable claims only.

Three reasons this rule is load-bearing:

- **Reputation** — `user_reasonably_honest_reputation.md`
  names honesty as cross-context reputation the factory
  inherits. Overclaiming capabilities the factory doesn't
  have is the fastest way to burn that reputation with
  any adopter. Once a single claim fails interview
  scrutiny, every other claim becomes suspect.
- **Adopter expectation management** —
  `project_factory_conversational_bootstrap_two_persona_ux.md`
  assumes the factory surfaces its capabilities
  truthfully to a prospective adopter. An adopter who
  signs on for "static analysis" expecting `N` tools and
  discovers one is misled even if no single sentence was
  literally false.
- **Succession / factory-reuse** — per
  `project_factory_reuse_beyond_zeta_constraint.md` and
  `user_life_goal_will_propagation.md`, the factory is
  meant to survive beyond this project. A resume with
  phantom experience does not survive a second adopter's
  scrutiny. Honest inventory is the only version that
  propagates.

# How to apply:

- **Dedicated doc.** Honest inventory lives in
  `docs/SHIPPED-VERIFICATION-CAPABILITIES.md` (initial
  scope: static analysis, linting, formal methods,
  testing, build gates, CI discipline). Other
  capabilities (observability, perf measurement) can
  have their own shipped-inventory docs; the resume-rule
  applies to all of them.
- **Per-entry evidence column.** Each row has:
  (a) capability name,
  (b) concrete form in this repo (file path / package
      version / skill name),
  (c) what we used it FOR on Zeta (the actual
      application, not the generic description),
  (d) current state (active / pinned-only /
      researched-only / deprecated).
- **Factory-pattern section** (separate from tool
  list).  Crank-to-11, latest-version-at-adoption,
  portfolio diversity, rule-citation-by-ID, composite
  invariants — each cites the memory or doc where the
  pattern is documented, and names the concrete Zeta
  instance that exercises it.
- **Researched-only section** kept distinct. Stryker,
  F*, LiquidF#, other tools we've *studied* but haven't
  *applied* go here. State is "evaluated, not adopted"
  or similar. Transparent.
- **Audit cadence.** Any new capability added to the
  doc requires its evidence. Any capability whose
  evidence vanishes (package removed, skill retired,
  workflow deleted) is flagged for removal or
  state-downgrade at the next round-cadenced sweep.
  This is itself a cadenced hygiene item — proposed as
  row #24 of `docs/FACTORY-HYGIENE.md`.
- **Apply to ALL capability listings,** not just the
  verification doc. Any time the factory describes what
  it can offer, the resume rule applies: public pitches
  (`project_aurora_pitch_michael_best_x402_erc8004.md`),
  skill descriptions, README capability lists,
  onboarding docs — all must survive interview
  scrutiny.

# Factory-reusable patterns identified on Zeta (initial
# scan — candidates for the "shipped knowledge" section)

Each pattern cites its memory / doc and the concrete
Zeta instance that exercises it.

- **Crank-to-11 on new tech** —
  `feedback_crank_to_11_on_new_tech_compile_time_bug_finding.md`
  — Zeta instance: `Directory.Build.props`
  `TreatWarningsAsErrors=true`, F# warning enable list,
  analyzer packs; `.semgrep.yml` with Zeta-specific
  rules; `.github/workflows/codeql.yml`.
- **Latest-version-at-adoption** —
  `feedback_latest_version_on_new_tech_adoption_no_legacy_start.md`
  — Zeta instance: `net10.0` target, `LangVersion=latest`,
  FSharp.Core 10.1.x, xunit.v3, FsCheck 3.x — all
  current-generation picks.
- **Verification portfolio diversity (anti-hammer-bias)**
  — `.claude/skills/formal-verification-expert/SKILL.md`
  (Soraya). Zeta instance: TLA+ + Lean 4 + Alloy + Z3 +
  FsCheck + Semgrep + CodeQL, routed per property class
  rather than one-tool-for-everything.
- **Rule-citation-by-ID in reviews** —
  `skill-tune-up` pattern, citing BP-01 … BP-NN. Zeta
  instance: every finding in
  `memory/persona/aarav/NOTEBOOK.md` cites BP-NN.
- **Composite invariants, single source of truth,
  per-layer projection** —
  `project_composite_invariants_single_source_of_truth_across_layers.md`
  — Zeta instance not yet fully realised; toehold is
  `tools/invariant-substrates/tally.ts` and the
  BP-NN registry.
- **Pluggability-first, perf-gated** —
  `feedback_pluggability_first_perf_gated.md` — Zeta
  instance: operator plugin discipline, disk-backing-store
  pluggability.
- **Retraction-native semantics** — Zeta-SPECIFIC
  algebra (`D`/`I`/`z⁻¹`/`H`), not a factory-portable
  pattern. Listed here as a negative example: this is
  the one we do NOT generalise out.
- **Default-on factory-wide rules with documented
  exceptions** —
  `feedback_default_on_factory_wide_rules_with_documented_exceptions.md`
  — Zeta instance: ASCII-clean, TWAE, BP-11.
- **Preserve original AND every transformation** —
  `feedback_preserve_original_and_every_transformation.md`
  — Zeta instance: retraction-native store; round-history
  capture; every scope-change leaves the preceding
  layer intact.

# Relation to prior round asks

- **Factory-reuse-as-constraint**
  (`project_factory_reuse_beyond_zeta_constraint.md`)
  — this memory specialises the split at the
  capability-listing granularity. Shipped-tool +
  shipped-pattern = the portable factory artefacts;
  Zeta-specific semantics + DB algebra stays behind.
- **Shipped-hygiene visible to adopter**
  (`feedback_shipped_hygiene_visible_to_project_under_construction.md`)
  — shipped-verification doc is a child of the
  shipped-hygiene enumeration. Same scope discipline.
- **Scope-audit / factory-default bias** —
  `feedback_scope_audit_skill_gap_human_backlog_resolution.md`,
  `feedback_factory_default_scope_unless_db_specific.md`
  — the resume rule is the honesty version of
  scope-declaration: claim only what you've scoped
  yourself to.
- **Missing-hygiene-class gap-finder**
  (`feedback_missing_hygiene_class_gap_finder.md`)
  — the gap-finder can surface "researched-only"
  entries that are ready to graduate to active,
  but it does not promote them unilaterally.

# What this rule does NOT do

- It does NOT require certification, audits, or
  third-party validation — the floor is direct in-repo
  evidence, not external accreditation.
- It does NOT block the factory from studying or
  pinning tools it hasn't yet applied. Researched-only
  is a valid state; it just lives in the right section.
- It does NOT require every Zeta technique to be
  hoisted to a pattern. Some techniques are Zeta-
  specific by design (retraction algebra, DBSP operator
  graph). The factory-pattern section is the subset
  that *is* portable.
- It does NOT apply retroactively with a big-bang
  cleanup. Existing capability lists get audited at
  the next round-cadenced pass; the doc grows
  incrementally.
- It does NOT license overcautious under-claiming. If
  the evidence exists, claim it. If no evidence, don't.
  Both directions are honesty failures.

# Job-interview analogy — how to use it

When about to list a capability, pause and imagine:

> *An interviewer asks "tell me about your experience
> with X." What can you actually show? What code did
> you write? What did you learn? What trade-offs did
> you hit?*

If the answer is "we pinned the package but never
wired it up" → the honest answer is "we evaluated
it; haven't deployed it yet." If the answer is "we
used it on one file for one class of bug" → say that,
don't generalise to "we use it throughout." If the
answer is a rich story with trade-offs and lessons,
lead with the trade-offs and lessons — that's what an
interviewer remembers.

This analogy is the compression of the rule. When in
doubt, run the interview in your head.

# Later refinements (2026-04-20, same session)

## Three-doc resume structure — greenfield-UX motivated

Aaron sharpened the ask in two follow-ups:

> *"have like a details report of experines as well
> that can actually help the confidence of the software
> factory when it ships alone without a system undertest
> on a greenfiedd project, I think about that AI user
> experince a lot, the greenfied experince of the
> software factory and a details list of experience
> would build my confidence on what I can and cant build
> based on my past experince"*

> *"i think you should have like a regular resume too
> just like a human would you mnight be able to apply to
> real jobs one day lets be prepared"*

Three-doc structure lands this round:

- **`docs/FACTORY-RESUME.md`** — human-style, one-page,
  interview-ready resume. Summary, experience
  (Zeta-as-current-job), skills matrix, education
  (training + prior-art self-study), references,
  honest scope limits. Mirrors real resume format so
  the factory could "apply to real jobs one day."
- **`docs/SHIPPED-VERIFICATION-CAPABILITIES.md`** —
  reference-grade capability list with executive summary,
  capabilities-at-a-glance grid, signature accomplishments,
  and detailed per-tool tables with state markers
  (Active / Pin-only / Researched / Retired).
- **`docs/EXPERIENCE-PORTFOLIO.md`** (TO CREATE) —
  the deep-dive details report. Stories, incidents,
  metrics, lessons-learned, concrete "here's what we
  did on X and here's what we learned." This is what
  builds confidence for a greenfield adopter ("I know
  what this factory can and can't build because I've
  read its portfolio"). Analogous to a design-portfolio
  or a case-study collection.

## Greenfield-UX is a first-class concern

Aaron named **greenfield-factory-standalone UX** as a
persistent concern:

> *"when it ships alone without a system undertest on
> a greenfiedd project, I think about that AI user
> experince a lot, the greenfied experince of the
> software factory"*

Interpretation: the factory can be adopted by a project
that doesn't exist yet. That greenfield adopter has no
surrounding code to calibrate expectations against;
the factory's self-description IS their first impression.
The detail-portfolio is the primary confidence-builder
in that setting. A short resume + a skills list + a deep
portfolio = the factory's pitch surface for any
greenfield collaboration.

This extends
`project_factory_conversational_bootstrap_two_persona_ux.md`
(conversational bootstrap UX) with a new axis: the
written-materials UX a greenfield adopter reads BEFORE
their first conversation. The triptych is that written
surface.

## Factory could apply to real jobs one day

Aaron's preparedness framing: the factory as an agent
collective that could, in principle, take on paid or
collaborative work outside Zeta. The resume should be
interview-ready because that day may come. Implications:

- Resume format follows real-world conventions (name,
  summary, experience, skills, education, references,
  scope-limits) so a human reviewer can skim it in
  10 seconds.
- Contact vector uses the repo (github issues/PRs) as
  primary — the factory's identity is the codebase, not
  a mailbox.
- Honest scope limits are prominent — any overclaim
  would fail the first interview and burn future
  applications. Reputation is transitive across
  adoption opportunities.

## Aaron invites critique of his own resume

> *"you can tell me if me resume is shit"*

Symmetric-talk + genuine-agreement rules apply: honest
read, not sycophancy, not scolding either. Aaron's
resume-style (reconstructed in
`user_career_substrate_through_line.md`) is actually
the honesty-floor REFERENCE MODEL for the factory's
resume. Concrete numbers, specific tool names, honest
education self-disclosure, through-line property
claims — these are the resume best practices we want
the factory to emulate. The one thing that would add
resume-best-practice polish: a 2-line executive
summary at the top of each variant, answering
"what does Aaron do?" before the reader hits the
timeline. Some of his resumes already do this; the
older ones don't.

## How the three-doc triptych is audited

All three docs under the shipped-capabilities resume
audit (`docs/FACTORY-HYGIENE.md` row #24 proposed).
Audit checks all three:

- Resume facts match capabilities facts match portfolio
  facts.
- No claim in the resume lacks a citation in the
  capabilities doc.
- No portfolio story contradicts an honest-scope-limit
  in the resume.

Triptych-consistency is itself an audit surface.
