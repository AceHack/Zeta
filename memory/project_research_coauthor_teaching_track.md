---
name: Research-coauthor teaching track — Aaron has never submitted a peer-reviewed paper; factory owes him onboarding scaffolding (etiquette + requirements + skills + knowledge-gap fillers); parallel to vibe-coder teaching track
description: 2026-04-20 pm — Aaron: "there is also research co authero like me who have never submitted a peer revied paper, I want to help but I'm going to need a teaching track on how to even enter that space and edicute and expications and requirments and any skills or patterns or knowledge gaps i have i'm going to have to fill in so I'll use that research teach track when its time for me to coauthor." A dedicated teaching track (parallel to the existing vibe-coder teaching track) for aspiring academic co-authors; covers peer-review process, submission etiquette, venue norms, related-work surveying, authorship conventions, rebuttal discipline. Aaron is first user; generic skeleton generalises to other first-time academic contributors. Research-readers audience (audience #7) splits into "readers" vs "aspiring co-authors"; coauthor track is the path from the latter to actual publication.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# The ask

Verbatim Aaron (2026-04-20 pm):

> *"there is also research co authero like me who have
> never submitted a peer revied paper, I want to help
> but I'm going to need a teaching track on how to
> even enter that space and edicute and expications
> and requirments and any skills or patterns or
> knowledge gaps i have i'm going to have to fill in
> so I'll use that research teach track when its time
> for me to coauthor."*

Substantive commitments:

1. **Aaron is first user.** He wants to co-author on
   Zeta's eventual submissions (DBSP chain-rule semi-
   naive proof, retraction-native IVM, alignment-loop
   as experimental substrate). He has never submitted
   a peer-reviewed paper.
2. **Teaching track, not one-shot tutorial.** A
   structured curriculum he can work through when
   first-coauthorship is imminent — not a tl;dr.
3. **Etiquette coverage.** Academic conventions,
   norms, what-is-expected.
4. **Skills / patterns / knowledge-gap fillers.**
   The specific skills he knows he doesn't have
   (LaTeX? rebuttal-writing? related-work? authorship-
   order negotiation?) — the track identifies and
   fills.
5. **Generic skeleton.** Aaron is first, not only.
   Any future first-time academic contributor uses
   the same track.

# Track design — proposed curriculum

## Module 1 — What peer review actually is

- The lifecycle: draft → submit → desk-reject or
  send-out-for-review → reviewer assignment →
  reviewer drafts → meta-review → accept / reject /
  revise-and-resubmit → camera-ready → publication.
- Venue typology: conferences (VLDB, SIGMOD, PLDI,
  POPL, ICFP, CAV, PODC) vs journals (VLDB Journal,
  ACM TODS, JACM, LMCS) vs workshops. Different
  norms, different rigour.
- Time budgets: 3-6 months cycle for major venues,
  shorter for workshops, longer for journals.
- The reviewer: volunteer, anonymous (usually),
  under-incentivised, reading 5-15 papers per
  cycle. Calibrate expectations accordingly.

## Module 2 — Etiquette

- Authorship conventions in CS (first author =
  primary contributor, last author = advisor /
  senior, corresponding author = submission
  contact). Different from medicine / physics.
- Conflict-of-interest declaration (co-authors, PhD
  advisors, co-workers within N years, funders).
- Double-blind rules where applicable (no self-
  reference, no arXiv-timed-to-submission tells,
  anonymise repos).
- Rebuttal etiquette (respect reviewers even when
  they're wrong; point to evidence, don't argue
  tone).
- Acknowledgements discipline (thank funders,
  thank reviewers in camera-ready, never thank in
  submission).

## Module 3 — Submission requirements

- **Structure conventions:** abstract, intro,
  related work, contributions bullets, body,
  evaluation, limitations, threats-to-validity,
  conclusion, acknowledgements, references,
  appendix.
- **The contribution claim.** Crisp, falsifiable,
  backed by evaluation.
- **Artefact-evaluation track.** Many venues now
  require reproducibility artefacts; what counts,
  how to prepare.
- **Formatting rules.** Templates per venue; page-
  limit discipline; figure quality; reference
  style.

## Module 4 — Skills Aaron will need

Identified gaps (Aaron-verbatim or inferred):

- **LaTeX fluency.** Not same as markdown.
  Templates, BibTeX, figure positioning. Factory
  owes Aaron a `docs/templates/paper-latex-starter/`
  and a walk-through.
- **Related-work surveying.** Not "google scholar
  a bit" — a systematic literature-review
  technique (snowball forward/backward from
  seed papers; cite dating conventions).
- **Figure craft.** Good figures pay 10x their
  drafting cost; ugly figures kill papers. The
  factory owes Aaron a plotting discipline
  (matplotlib / tikz / d3 basics).
- **Rebuttal writing.** A specific genre with
  specific rules.
- **Camera-ready revision discipline.** What you
  can / cannot change between acceptance and
  publication.

## Module 5 — Knowledge-gap fillers

Aaron's verbatim "patterns or knowledge gaps I have"
candidate list (he will add more once he sees his
gaps in context):

- Statistical inference basics for empirical
  evaluation (confidence intervals, effect sizes,
  not just "bar chart").
- Formal-proof reading literacy (how to parse Lean /
  Coq / TLA+ in a paper's appendix).
- Theorem-statement craft (the art of the precise
  theorem).
- Benchmarking ethics (cherry-picking, hardware
  disclosure, reproducibility claims).

## Module 6 — When it's time to coauthor

- First pass: Aaron drafts contributions bullets +
  motivation + his own voice passages.
- Second pass: factory reviewers critique with
  harsh-critic / spec-zealot discipline.
- Third pass: Aaron revises with factory skill
  support.
- Fourth pass: formal-verification coverage check
  (Soraya's lane).
- Fifth pass: submission-etiquette sanity check
  (this track's own checklist).
- Submit.

# Why:

Aaron has named a self-aware gap. He has the
intellectual substrate (see `user_cognitive_style.md`,
`user_career_substrate_through_line.md`, etc.) to
co-author; he lacks the process fluency. That
process fluency is:

- teachable,
- codifiable,
- reusable for future first-time academic
  contributors,
- genuinely missing from the factory today.

The alignment-contract frame applies: "if we do this,
both of us benefit." Aaron gets co-authorship entry;
the factory gets a propagation channel for its
research contributions; the teaching track becomes
a factory asset that lives on.

# How to apply:

## Immediate (this round or next)

- **Save this memory.** (Done: this file.)
- **Add `docs/RESEARCH-COAUTHOR-TRACK.md`** as a
  landed skeleton. Module 1-6 outlines above become
  the top-level section headers. Each section starts
  empty-with-pointer; content lands just-in-time as
  Aaron gets closer to first submission.
- **Index under the research-readers audience** in
  the document-audience taxonomy. The coauthor track
  is the INSIDE path of the research-readers audience
  (turning readers into authors).

## When first submission approaches (L effort)

- Pick the specific venue (DBSP chain-rule proof →
  ICFP? VLDB? POPL? depends on paper framing).
- Activate modules in order, with skill-creator
  landing any missing skills (LaTeX-craft, related-
  work-surveying, figure-craft).
- Pair Aaron with factory reviewers at each pass.

## Skill gaps this track will spawn (placeholder)

Candidate new skills (each via skill-creator when
needed):

- `academic-paper-etiquette` skill — covers Module 2.
- `related-work-surveyor` skill — covers the
  systematic-literature-review half of Module 4.
- `figure-craft` skill — covers the figure-drafting
  half of Module 4.
- `rebuttal-writer` skill — covers rebuttal
  discipline.
- `camera-ready-reviser` skill — covers post-
  acceptance revision discipline.

(`paper-peer-reviewer` skill already exists — that's
the INBOUND direction, reviewing other people's
papers. This track is the OUTBOUND direction,
submitting our own.)

# Relationship to existing memories

- **`project_teaching_track_for_vibe_coder_contributors.md`**
  — the existing teaching track for vibe-coders
  learning to contribute code. This memory proposes a
  parallel track for Aaron (and future first-time
  coauthors) learning to contribute research papers.
  Same structural pattern, different domain.
- **`project_document_audience_categories.md`** —
  research-readers is audience #7 (added 2026-04-20).
  This track operates INSIDE that audience: it turns
  "readers of published work" into "co-authors of
  new work."
- **`user_lexisnexis_legal_search_engineer.md`** —
  Aaron built a legal search engine; he has
  strong information-retrieval fluency. Related-work
  surveying may be less gap and more transfer.
- **`user_curiosity_and_honesty.md`** — epistemic
  stance matches academic norms. Aaron's "I don't
  know" tolerance is the exact register rebuttal-
  writing requires.
- **`project_factory_purpose_codify_aaron_skill_match_or_surpass.md`**
  — codifying Aaron's skills is the factory's
  purpose. This track codifies a set of skills Aaron
  does NOT yet have, which is a sibling purpose:
  filling his gaps as well as matching his strengths.
- **`user_life_goal_will_propagation.md`** — this
  track is an explicit propagation mechanism (Aaron's
  ideas → peer-reviewed publication → permanent
  record).
- **`project_zeta_as_primitive_for_ai_research.md`**
  — when Zeta becomes research-primitive, papers
  about it matter. Aaron wants to be on those papers.

# What this memory does NOT do

- Does NOT write `docs/RESEARCH-COAUTHOR-TRACK.md`
  itself. That lands in the next wake as a skeleton.
- Does NOT pick a submission venue or paper. Aaron
  makes that call when the research is ready.
- Does NOT claim Aaron is ready to coauthor now.
  The track is scaffolding for when the time comes.
- Does NOT appropriate existing teaching-track
  skill work; it sits beside the vibe-coder track,
  not replacing it.
- Does NOT substitute for a human mentor with
  publication history. If we can find one (Michael
  Best's network? Academic-friend of Aaron's?), that
  is higher-leverage than any factory track.

# Open decisions

1. **Module granularity.** Six modules above is an
   outline, not a commitment. Could collapse to four
   or expand to eight. Revisit on skeleton landing.
2. **First target paper / venue.** Unspecified.
   Probably DBSP chain-rule semi-naive (if proof
   completes) or retraction-native IVM (if bench
   numbers hold).
3. **Teaching modality.** Is the track reading-only?
   Exercises? Mock submissions? Probably a mix;
   empirical tuning after Aaron works through
   module 1.
4. **Audience crossover.** Does the same track serve
   other aspiring first-time academic contributors
   (agents learning to write paper drafts)?
   Probably yes; structurally generic.
