---
name: Document audience categories — "who is this for?" must be answerable for every doc; new-contributor-starts-here problem; multi-audience facets
description: 2026-04-20 — Aaron: "We need categories for our document based on who the intended audiance is, it's kind of all over the place right now. if i'm new on the project I would not know wehre to start." + "is this for the software factory developers us who are building the softeaer factory, is this for the pepolel who will reuse the software factory is this for the AI, someintes else. Is this for Zeta developers and zeta speicaally of that" + follow-up "oh we should likely have some audiance related to the resarch papers you want to submit and what audiance type is that". SEVEN proposed audiences (6 original + `research-readers` added 2026-04-20 pm). Each `docs/` file gets a primary + optional secondary audience. Navigation lands as `docs/README.md` after Aaron signs off. Same spirit as the scope tag (`factory`/`project`/`both`) but orthogonal — scope is about ownership, audience is about who reads.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# The ask

Aaron has named a discoverability problem: a new
contributor arriving at `docs/` does not know where to
start, because docs are *not organised by audience*.
They are organised by topic — which helps the author
who knows where to file, but fails the reader who does
not know what to ask.

The fix: **every `docs/` file declares who it is for**,
and `docs/README.md` organises the full tree by
audience.

# Proposed audience taxonomy — seven categories

Aaron's verbatim list ("software factory developers us",
"pepole who will reuse the software factory", "AI",
"Zeta developers", "zeta speicaally of that") maps to
four; I added two more (consumers, observers); Aaron
then added a seventh ("oh we should likely have some
audiance related to the resarch papers you want to
submit"). Current seven:

## 1. Factory builders (us)

**Who:** the people extending the software factory
substrate itself — adding hygiene rows, promoting BP-NN
rules, writing new skills, tuning the review-persona
roster, authoring round-history.

**Canonical question at cold-start:** *"what rules
govern how I extend the factory?"*

**Primary docs (today):**
- `AGENTS.md` (universal onboarding)
- `GOVERNANCE.md` (numbered repo-wide rules)
- `docs/AGENT-BEST-PRACTICES.md` (stable BP-NN registry)
- `docs/FACTORY-HYGIENE.md` (cadenced audits)
- `docs/SOFTWARE-FACTORY.md`
- `docs/CONFLICT-RESOLUTION.md`
- `docs/EXPERT-REGISTRY.md`
- `docs/ROUND-HISTORY.md`
- `docs/DECISIONS/` (ADRs)
- `docs/WONT-DO.md`
- `docs/GLOSSARY.md` (factory vocabulary)
- `docs/NAMING.md`
- `docs/REVIEW-AGENTS.md`
- `docs/ALIGNMENT.md`

## 2. Factory adopters

**Who:** teams or individuals starting a new project
on the factory substrate. They consume the factory as a
kit; they do not necessarily intend to contribute back
(until ace, at which point they become contributors by
default — see
`project_ace_package_manager_agent_negotiation_propagation.md`).

**Canonical question at cold-start:** *"how do I stand
up my own project on this factory?"*

**Primary docs (today / needed):**
- `AGENTS.md` (universal onboarding — shared with #1)
- Hygiene rows tagged `project` or `both` in
  `docs/FACTORY-HYGIENE.md` (adopter-facing subset)
- `docs/TECH-DEBT.md` (factory primer; shared with #3)
- `CONTRIBUTING.md` (installer + gate)
- **Gap (today):** no dedicated `docs/ADOPTER-GUIDE.md`
  (starter-kit walkthrough). Candidate P2.

## 3. AI agents

**Who:** AI contributors (Claude, Copilot, other
harnesses) that wake fresh and need to know the rules,
the skills, the personas, and the cross-wake
discipline.

**Canonical question at cold-start:** *"what do I load,
in what order, and what is non-negotiable?"*

**Primary docs (today):**
- `CLAUDE.md` (session bootstrap pointer tree)
- `AGENTS.md` (universal handbook)
- `docs/ALIGNMENT.md` (contract with Aaron)
- `docs/CONFLICT-RESOLUTION.md`
- `docs/AGENT-BEST-PRACTICES.md`
- `docs/TECH-DEBT.md` (§ How this doubles as AI
  instructions)
- `.claude/skills/` (capability registry)
- `.claude/agents/` (persona registry)
- `~/.claude/projects/…/memory/` (earned memory;
  CLAUDE-Code-specific)

## 4. Zeta contributors

**Who:** people contributing to Zeta-the-library (the
system-under-test), not the factory substrate. Shipping
DBSP operator algebra, perf tuning, Lean proofs, F#
code.

**Canonical question at cold-start:** *"what is Zeta,
what shape is its algebra, where do features land?"*

**Primary docs (today):**
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `docs/SYSTEM-UNDER-TEST-TECH-DEBT.md`
- `docs/SYSTEM-UNDER-TEST-GLOSSARY.md` (if landed;
  currently pending physical split per
  `feedback_glossary_split_factory_vs_system_under_test.md`)
- `docs/FORMAL-VERIFICATION.md`
- `docs/MATH-SPEC-TESTS.md`
- `docs/INVARIANT-SUBSTRATES.md`
- `docs/FEATURE-FLAGS.md`
- `docs/PLUGIN-AUTHOR.md`
- `docs/TECH-RADAR.md`
- `docs/BUGS.md`
- `docs/DEBT.md`
- `docs/INTENTIONAL-DEBT.md`
- `docs/SPEC-CAUGHT-A-BUG.md`
- `docs/BENCHMARKS.md`

## 5. Zeta consumers (library users)

**Who:** people who install the published NuGet
libraries (`Zeta.Core`, `Zeta.Core.CSharp`,
`Zeta.Bayesian`) as dependencies in their own
application. They never see `.claude/`, they may never
read `docs/`, they live in IntelliSense + README +
samples.

**Canonical question at cold-start:** *"how do I use
Zeta in five minutes?"*

**Primary docs (today / needed):**
- `README.md` (root — single most important surface)
- API docs (rendered from XML-doc comments)
- Sample projects (currently sparse — Iris UX
  territory)
- `docs/FEATURE-FLAGS.md` (preview-gate acknowledgement)
- **Gap:** no dedicated getting-started / samples
  directory. Iris (user-experience-engineer) already
  has this on her surface.

## 6. Observers / reviewers

**Who:** external readers who are not contributing
now but need to understand the project: prospective
employers evaluating the resume, journalists /
bloggers covering AI-native development, curious
strangers, people auditing the alignment-loop claim.

**Canonical question at cold-start:** *"what does this
project claim, and where is the evidence?"*

**Reading mode:** evaluate-to-decide (fit, resume,
character, posture).

**Primary docs (today):**
- `docs/FACTORY-RESUME.md` (job-interview honesty)
- `docs/ALIGNMENT.md`
- `docs/DEDICATION.md`
- `docs/pitch/` (sales-facing)

## 7. Research-paper readers (added 2026-04-20 pm per Aaron's follow-up)

**Who:** peer reviewers of submitted papers, academic
committee members, citation-chasers, authors of
related-work sections in adjacent papers, theorem-
prover researchers cross-checking Lean / TLA+ / Z3
scripts. Distinct reading mode from #6.

Aaron's verbatim trigger:
*"oh we should likely have some audiance related to
the resarch papers you want to submit and what
audiance type is that"* — 2026-04-20.

**Canonical question at cold-start:** *"what is the
claim, where is the proof or benchmark that supports
it, what is out of scope, and where is the comparison
vs prior work?"*

**Reading mode:** evaluate-to-verify (is the claim
true, is the proof sound, is the benchmark fair, is
the scope honest).

**Primary docs (today):**
- `docs/research/` (memos, the primary research surface)
- `docs/FORMAL-VERIFICATION.md` (what's shipped in
  Lean / TLA+ / Z3 / FsCheck)
- `docs/MATH-SPEC-TESTS.md` (algebraic laws wired
  through CI)
- `docs/BENCHMARKS.md` (perf claims with receipts)
- `docs/SHIPPED-VERIFICATION-CAPABILITIES.md`
- `docs/research/chain-rule-proof-log.md`
- `docs/research/proof-tool-coverage.md`
- `docs/research/verification-registry.md`
- `tools/lean4/`, `tools/tla/` (the actual proof
  scripts reviewers will want to read and run)

**Gaps (today):**
- No `docs/PAPER-DRAFTS/` directory. Drafts live in
  `docs/research/` ad-hoc today.
- No `docs/RELATED-WORK.md` canonical survey — per-
  topic bibliography is scattered across research
  memos.
- No `docs/THREATS-TO-VALIDITY.md` for self-honest
  negative-space disclosure.
- Reproducibility artefacts (seeds, datasets,
  exact-versions) not bundled per paper.

Paper readers cold-start cost: today ~high (they
have to spelunk `docs/research/` in reverse-chrono
order to piece together a narrative). Audience-
aware `docs/README.md` should give them a one-page
"for paper reviewers" entry that maps each
submitted claim → proof file → benchmark.

**Relationship to #6:** consumers of the factory
resume and observers of the alignment loop overlap
with paper readers on *some* docs (`ALIGNMENT.md`,
`FACTORY-RESUME.md`) but diverge on primary intent
— observers don't crack open Lean files; paper
reviewers do. Keep separate.

**Relationship to #4 (Zeta contributors):** paper
reviewers read the same `FORMAL-VERIFICATION.md`
and `MATH-SPEC-TESTS.md` that Zeta contributors
do, but ask different questions of them (review
vs extend). Same doc, two audience entries, two
navigation hooks.

# Why:

Verbatim Aaron:

> *"We need categories for our document based on who the
> intended audiance is, it's kind of all over the place
> right now. if i'm new on the project I would not know
> wehre to start."*

> *"is this for the software factory developers us who
> are building the softeaer factory, is this for the
> pepolel who will reuse the software factory is this
> for the AI, someintes else. Is this for Zeta
> developers and zeta speicaall of that"*

Substantive commitments:

1. **Audience is a first-class doc attribute.** Every
   `docs/` file must answer "who is this for?" Readers
   should be able to filter the tree by their own
   audience without asking.
2. **Multi-audience is OK but primary-audience is
   required.** A doc may serve two audiences (e.g.,
   `docs/TECH-DEBT.md` serves factory-builders +
   factory-adopters + AI agents) but one must be
   primary for navigation purposes.
3. **Navigation lands in `docs/README.md`.** Tree
   organised by audience; each audience section
   points at its primary docs; cross-audience docs
   appear once under primary + "also relevant" under
   secondary.
4. **Audience is ORTHOGONAL to scope tag.** Scope
   (`factory`/`project`/`both`) is about who owns the
   rule / artefact. Audience is about who reads the
   doc. They correlate but do not collapse — e.g., the
   factory primer is scope `factory` but serves three
   audiences.

# How to apply:

## Immediate next step (pending Aaron sign-off)

- **Validate the six-audience taxonomy.** Aaron can
  accept, add, merge, or reject categories.
- Once validated, land `docs/README.md` with the tree
  organisation. **LANDED round 44 (2026-04-20)** —
  `docs/README.md` now carries the 7-audience navigation
  with 55 internal pointers, all verified to resolve.
  Gaps (no `ADOPTER-GUIDE.md`, no
  `SYSTEM-UNDER-TEST-GLOSSARY.md`, no `PAPER-DRAFTS/`,
  no `RELATED-WORK.md`, no `THREATS-TO-VALIDITY.md`,
  sparse samples) called out in-line per audience.
- Add `audience:` frontmatter to any doc that lacks
  it, defaulting primary audience per the
  classification above. **Not yet done.** Mechanical
  pass; can be rolled out over subsequent rounds.
  Until then, navigation works off the per-section
  lists in the landed `docs/README.md`.

## Per-doc frontmatter proposal

```markdown
---
audience: factory-builders   # primary; one of:
                             # factory-builders, factory-adopters,
                             # ai-agents, zeta-contributors,
                             # zeta-consumers, observers,
                             # research-readers
also-relevant-to: [ai-agents, factory-adopters]
scope: factory               # orthogonal to audience
---
```

Docs without frontmatter today get the
frontmatter added in a mechanical pass per the
mapping in this memory.

## Relationship to the scope split

- `docs/GLOSSARY.md` scope `factory` — audience
  `factory-builders` primary.
- `docs/SYSTEM-UNDER-TEST-GLOSSARY.md` scope `project`
  — audience `zeta-contributors` primary.
- `docs/TECH-DEBT.md` scope `factory` — audience
  `factory-builders` primary (with `factory-adopters`
  + `ai-agents` also-relevant).
- `docs/SYSTEM-UNDER-TEST-TECH-DEBT.md` scope
  `project` — audience `zeta-contributors` primary.

Pattern: scope tells you who the rule belongs to,
audience tells you who needs to read the explanation.

# Open decisions

1. **Do we add `ace-maintainers` as an eighth
   audience?** (now eighth, with research-readers at
   seven). Per
   `project_ace_package_manager_agent_negotiation_propagation.md`,
   ace is a third scope. Name now picked (`ace`).
   If ace becomes a third docs tree, it may need
   its own audience too. Open until ace source-
   code home settles.
2. **Do Zeta consumers and observers merge?** Both
   are "don't contribute, just read." They separate
   cleanly on intent: consumers want to build with
   Zeta; observers want to understand it without
   building. Keep separate; inspect after one round.
3. **`ai-agents` — split into "contributors" vs
   "downstream users"?** If someone uses Zeta as an
   AI-research-primitive (per
   `project_zeta_as_primitive_for_ai_research.md`),
   their AI agent is a Zeta consumer, not a Zeta
   contributor. Probably a refinement for later;
   single `ai-agents` audience is good today.
4. **Spec-zealot question:** OpenSpec capability
   specs under `openspec/specs/**` — which audience?
   Probably `zeta-contributors` primary, but
   spec-zealot (Viktor) cares cross-cutting. Defer.
5. **Claude-Code-specific `.claude/` files — separate
   audience?** Today they live with `ai-agents`.
   Could split if `.claude/` content becomes
   harness-specific enough to confuse other-harness
   agents.
6. **Research-readers: paper-draft location?**
   Drafts currently ad-hoc in `docs/research/`.
   Candidate: `docs/PAPER-DRAFTS/<year>-<venue>/`
   with per-paper subtree (claim / proof / benchmark
   / related-work / threats-to-validity). Defer
   until first real submission target solidifies.
7. **Research-readers: do `tools/lean4/` +
   `tools/tla/` count as "docs" for navigation?**
   They are executable, not prose, but paper
   reviewers will want to run them. Probably
   cross-reference from `docs/README.md` under
   research-readers section even though the files
   are under `tools/`. Aesthetic tension with
   "audience is a docs/ attribute" — but paper
   reviewers genuinely need the pointer.

# What this memory does NOT do

- Does NOT land `docs/README.md` or add frontmatter to
  any doc yet. Those actions wait for Aaron's
  sign-off on the audience taxonomy.
- Does NOT reorganise directories. Audience is
  metadata + navigation, not filesystem structure.
  File-move refactors break links.
- Does NOT collapse the scope tag. Audience is
  orthogonal.
- Does NOT apply to `.claude/skills/` or
  `.claude/agents/` — those have their own registries
  and are AI-agent-native by construction.
- Does NOT change `memory/` conventions. Memory is
  future-me + Aaron; no audience category applies.
