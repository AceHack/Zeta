# Research-Coauthor Teaching Track

**Audience:** first-time academic co-authors —
contributors (human or agent) who have never submitted
a peer-reviewed paper and want to help Zeta land its
research contributions in refereed venues.
Aaron is the first named user; the track is generic.

**Status:** skeleton. Content lands just-in-time as
Aaron (or another first-time co-author) approaches a
concrete submission. The module outline below is the
committed shape; bodies are stubs until needed.

**Parallel to:** the vibe-coder teaching track
(contributor-onboarding for humans new to Zeta's
toolchain). That track turns new coders into
committers; this one turns new readers into co-authors.

**Primary-audience tag:** `research-readers (coauthor
variant)`. This track lives inside the `research-
readers` audience (category #7 in
`docs/README.md` when that ships), specifically
serving the *inside* path — turning paper readers into
paper authors.

---

## How to use this track

1. **When a submission target is imminent** (venue
   chosen, draft in progress), the primary co-author
   walks the modules in order with the first-time
   co-author.
2. **When no submission is imminent**, the track is
   reference material — read a module when curiosity
   strikes.
3. **Module bodies land just-in-time.** If Module 4
   (skills) is currently stubbed and the submission
   needs LaTeX fluency now, the skill lands now, not
   before.
4. **Pair with factory reviewers.** Modules 4 and 6
   dispatch to existing factory personas
   (Samir for docs, Soraya for formal-verification
   sections, Rune for readability). The track names
   the pairing but does not duplicate the reviewer
   content.

---

## Module 1 — What peer review actually is

**Status:** stub. Expand when first submission is
within 90 days.

**Intended scope:**

- The lifecycle: draft → submit → desk-reject vs
  send-out-for-review → reviewer drafts → meta-review
  → accept / reject / revise-and-resubmit → camera-
  ready → publication.
- Venue typology: conferences (VLDB, SIGMOD, PLDI,
  POPL, ICFP, CAV, PODC) vs journals (VLDB Journal,
  ACM TODS, JACM, LMCS) vs workshops. Different
  norms, different rigour, different time budgets.
- Time expectations: 3-6 months cycle for major
  venues, shorter for workshops, longer for journals.
- The reviewer's reality: volunteer, anonymous
  (usually), under-incentivised, reading 5-15 papers
  per cycle. Calibrate prose and evidence density
  accordingly.

**Expands into:** module body + venue-specific
sub-pages when targets firm up.

---

## Module 2 — Etiquette

**Status:** stub. Candidate new skill:
`academic-paper-etiquette`.

**Intended scope:**

- Authorship conventions in CS: first author =
  primary contributor, last author = senior /
  advisor, corresponding author = submission
  contact. Different from medicine / physics / bio.
- Conflict-of-interest declaration (co-authors, PhD
  advisors, co-workers within N years, funders).
- Double-blind rules where applicable — no self-
  reference, no arXiv-timed-to-submission tells,
  anonymise repos.
- Rebuttal etiquette — respect reviewers even when
  they are wrong; point to evidence, don't argue
  tone or motive.
- Acknowledgements discipline — thank funders in
  camera-ready; thank reviewers in camera-ready (not
  submission); never thank in submission body.

---

## Module 3 — Submission requirements

**Status:** stub. Expands per venue choice.

**Intended scope:**

- **Structural conventions:** abstract, intro,
  related work, contributions bullets, body,
  evaluation, limitations, threats-to-validity,
  conclusion, acknowledgements, references,
  appendix.
- **The contribution claim** — crisp, falsifiable,
  backed by evaluation. Every paper answers: *what is
  new, how do we know, and why does it matter?*
- **Artefact-evaluation track** — most top venues
  now require a reproducibility artefact; what
  counts, how to prepare, what the badge levels mean.
- **Formatting rules** — templates per venue; page-
  limit discipline; figure quality bars; reference
  style (ACM / IEEE / Springer LNCS / etc.).

---

## Module 4 — Skills a first-time co-author needs

**Status:** stub. Each skill below is a candidate
`skill-creator` landing.

Candidate skills (not yet landed):

- **`academic-paper-etiquette`** — covers Module 2
  as a reusable skill.
- **`related-work-surveyor`** — systematic
  literature-review technique; snowball forward /
  backward from seed papers; citation dating
  conventions; conflict-of-interest-in-citation
  handling.
- **`figure-craft`** — plotting discipline:
  matplotlib / tikz / d3 basics; colour-blind safe
  palettes; caption craft; the difference between a
  figure that aids a reviewer and one that is merely
  decorative.
- **`rebuttal-writer`** — the specific genre of
  conference-rebuttal writing; word-budget
  discipline; priority-order for reviewer concerns;
  when to concede gracefully vs push back.
- **`camera-ready-reviser`** — what you can and
  cannot change between acceptance and publication;
  reviewer-comment integration; final-polish
  checklist.

Not a skill, but a tooling dependency:

- **LaTeX fluency** — template `docs/templates/
  paper-latex-starter/` to land when first
  submission venue is picked (different venues,
  different templates). Includes BibTeX workflow
  and figure-positioning patterns.

`paper-peer-reviewer` skill already exists — that
covers the *inbound* direction (reviewing other
people's papers). This track is the *outbound*
direction (submitting our own).

---

## Module 5 — Knowledge-gap fillers

**Status:** stub. Candidate fillers below will
graduate to skills or reading-lists as gaps surface.

Candidate gap areas (Aaron-verbatim or inferred):

- **Statistical inference for empirical evaluation**
  — confidence intervals, effect sizes, appropriate
  tests for the distribution you actually have. Not
  just "bar chart with error bars".
- **Formal-proof reading literacy** — how to parse
  Lean / Coq / TLA+ / Alloy in a paper appendix; when
  to trust the proof and when to flag the proof
  obligation as unclear.
- **Theorem-statement craft** — the art of the
  precise theorem; the difference between a
  theorem that constrains the proof and one that
  admits trivial counterexamples.
- **Benchmarking ethics** — cherry-picking, hardware
  disclosure, reproducibility claims, the honest
  reporting of baselines you lose against.

---

## Module 6 — When it is time to coauthor

**Status:** stub. Procedural; firm up when first
submission target picked.

Proposed pass order:

1. **First pass** — first-time co-author drafts
   contributions bullets, motivation passage, their
   own voice sections of the body.
2. **Second pass** — factory reviewers critique with
   `harsh-critic` / `spec-zealot` discipline.
3. **Third pass** — first-time co-author revises
   with factory skill support (Rune for readability,
   Samir for documentation shape).
4. **Fourth pass** — formal-verification coverage
   check (Soraya's lane).
5. **Fifth pass** — submission-etiquette sanity
   check (this track's Module 2 checklist).
6. **Submit.**
7. **Rebuttal** (if sent to rebuttal) — Module 4
   `rebuttal-writer` skill.
8. **Camera-ready** (if accepted) — Module 4
   `camera-ready-reviser` skill.

---

## What this track does NOT do

- Does **not** substitute for a human mentor with
  publication history. A senior co-author with venue
  experience is higher-leverage than any factory
  track; if one is available, use them.
- Does **not** pick the venue. That is the senior
  author's call, made when the research is ready.
- Does **not** claim Aaron (or any first-time co-
  author) is ready to co-author *now*. The track is
  scaffolding for *when* the time comes.
- Does **not** duplicate existing factory reviewer
  content. Modules 4 and 6 dispatch to existing
  personas; the track names the pairing.
- Does **not** appropriate the vibe-coder teaching
  track. It sits beside, not on top of.

---

## Open decisions (for when module bodies land)

1. **Module granularity.** Six is an outline, not a
   commitment. Collapse to four or expand to eight
   when bodies land.
2. **First target venue.** Unspecified. Probably DBSP
   chain-rule semi-naive (if the Lean proof
   completes) targeting ICFP / POPL / VLDB, or
   retraction-native IVM targeting SIGMOD / VLDB,
   depending on paper framing.
3. **Teaching modality.** Reading-only? Exercises?
   Mock submissions? Probably a mix; empirical
   tuning after the first first-time co-author has
   walked Module 1.
4. **Audience crossover.** Does the same track serve
   agent co-authors (factory agents drafting paper
   passages)? Probably yes; structurally generic.

---

## References

- `memory/project_research_coauthor_teaching_track.md`
  — the durable memory that seeded this file.
- `memory/project_document_audience_categories.md` —
  audience #7 (research-readers) is where this track
  lives.
- `.claude/skills/paper-peer-reviewer/SKILL.md` — the
  inbound peer-review skill (reviewing others' work).
- `docs/research/` — Zeta's research reports; the
  raw material any future paper draws from.
- `docs/FORMAL-VERIFICATION.md`,
  `docs/SHIPPED-VERIFICATION-CAPABILITIES.md`,
  `docs/research/proof-tool-coverage.md` — the
  verification spine any Zeta paper will reference.
