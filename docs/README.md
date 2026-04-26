# docs/ — audience-first navigation

This directory holds every prose document in the Zeta
repository. It is indexed by **who reads the doc**, not by
topic. If you are new to the project, find the audience
category that fits you below and start from that section.

If you are not sure which audience you are, read
[Quick-start](#quick-start) first.

---

## Quick-start

| I am a ... | Start here |
|---|---|
| **Factory builder** (extending the software-factory substrate itself) | [`../AGENTS.md`](../AGENTS.md) -> [1. Factory builders](#1-factory-builders) |
| **Factory adopter** (starting a new project on the factory kit) | [`../AGENTS.md`](../AGENTS.md) + [`../CONTRIBUTING.md`](../CONTRIBUTING.md) -> [2. Factory adopters](#2-factory-adopters) |
| **AI agent** (fresh wake, need rules + skills + personas) | [`../CLAUDE.md`](../CLAUDE.md) -> [`../AGENTS.md`](../AGENTS.md) -> [3. AI agents](#3-ai-agents) |
| **Zeta contributor** (shipping DBSP algebra, proofs, F# code) | [`ARCHITECTURE.md`](ARCHITECTURE.md) -> [4. Zeta contributors](#4-zeta-contributors) |
| **Zeta consumer** (installing the NuGet libraries in my app) | [`../README.md`](../README.md) -> [5. Zeta consumers](#5-zeta-consumers) |
| **Observer / reviewer** (not contributing; evaluating the project) | [`FACTORY-RESUME.md`](FACTORY-RESUME.md) -> [6. Observers / reviewers](#6-observers--reviewers) |
| **Research-paper reader** (peer review, citation, verification) | [`research/`](research/) -> [7. Research-paper readers](#7-research-paper-readers) |

**Notes.** Audience is **orthogonal to the scope tag**. A
doc's scope (`factory` / `project` / `both`) says who
*owns* the rule; the audience says who *reads* the
explanation. A doc can have one primary audience and one or
more secondary audiences — the doc appears in its primary
section below, and is cross-referenced from the secondary
sections under "Also relevant."

The seven audiences were named by Aaron on 2026-04-20. The
full taxonomy is tracked in the auto-memory entry
`project_document_audience_categories.md` (not in-repo;
agent-only).

---

## 1. Factory builders

**You are:** extending the software-factory substrate
itself — adding hygiene rows, promoting `BP-NN` rules,
writing new skills, tuning the review-persona roster,
authoring round-history.

**Canonical question at cold-start:** *"what rules govern
how I extend the factory?"*

### Start here

- [`../AGENTS.md`](../AGENTS.md) — universal onboarding
  handbook. The entry point for every session.
- [`../GOVERNANCE.md`](../GOVERNANCE.md) — numbered
  repo-wide rules.
- [`AGENT-BEST-PRACTICES.md`](AGENT-BEST-PRACTICES.md) —
  stable `BP-NN` registry the skill system cites.

### Cadenced hygiene + governance

- [`FACTORY-HYGIENE.md`](FACTORY-HYGIENE.md) — the
  audit rows that run on a schedule.
- [`RULE-OF-BALANCE.md`](RULE-OF-BALANCE.md) — the
  counterweight-filing discipline (Otto-264) that
  stabilises operational resonance; how every mistake-
  class triggers a counterweight.
- [`CONFLICT-RESOLUTION.md`](CONFLICT-RESOLUTION.md) —
  the conference protocol for the reviewer roster.
- [`EXPERT-REGISTRY.md`](EXPERT-REGISTRY.md) — the
  reviewer roster + diversity notes.
- [`REVIEW-AGENTS.md`](REVIEW-AGENTS.md) — what each
  review agent guards.
- [`WONT-DO.md`](WONT-DO.md) — explicitly-declined
  features so debates don't re-litigate.
- [`NAMING.md`](NAMING.md) — module + artefact naming
  rules.
- [`SOFTWARE-FACTORY.md`](SOFTWARE-FACTORY.md) — how
  the factory works as a system.

### History + decisions

- [`ROUND-HISTORY.md`](ROUND-HISTORY.md) — append-only
  round log (narrative belongs here, not scattered
  through current docs).
- [`DECISIONS/`](DECISIONS/) — ADRs for factory-wide
  decisions.
- [`skill-edit-justification-log.md`](skill-edit-justification-log.md)
  — every `skill-creator` edit's rationale.

### Vocabulary + alignment

- [`GLOSSARY.md`](GLOSSARY.md) — factory vocabulary.
  (A physical split into `SYSTEM-UNDER-TEST-GLOSSARY.md`
  is pending; see gaps below.)
- [`ALIGNMENT.md`](ALIGNMENT.md) — the alignment
  contract between Aaron and the agents.

### Also relevant for factory builders

- [`TECH-DEBT.md`](TECH-DEBT.md) — factory primer (also
  primary for adopters + AI agents).
- [`MISSED-ITEMS-AUDIT.md`](MISSED-ITEMS-AUDIT.md) —
  what the factory has failed to surface.
- [`copilot-wins.md`](copilot-wins.md),
  [`WINS.md`](WINS.md) — factory-efficacy evidence.

---

## 2. Factory adopters

**You are:** standing up a new project on the factory
substrate. You consume the factory as a kit; you may or
may not contribute back.

**Canonical question at cold-start:** *"how do I stand up
my own project on this factory?"*

### Start here

- [`../AGENTS.md`](../AGENTS.md) — universal onboarding
  (shared with factory builders).
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — installer
  + build + test gate.
- [`TECH-DEBT.md`](TECH-DEBT.md) — primer on the
  factory's idea of tech-debt bookkeeping.

### Adopter-facing subsets of shared docs

- [`FACTORY-HYGIENE.md`](FACTORY-HYGIENE.md) — rows
  tagged `project` or `both` are adopter-relevant.
- [`AGENT-BEST-PRACTICES.md`](AGENT-BEST-PRACTICES.md) —
  the `BP-NN` rules are factory-wide and transfer to
  any adopter project.

### Gaps (not yet landed)

- **No `ADOPTER-GUIDE.md`** — a dedicated starter-kit
  walkthrough for first-time adopters. Tracked as a P2
  row in [`BACKLOG.md`](BACKLOG.md).

---

## 3. AI agents

**You are:** a fresh-waking AI contributor — Claude,
Copilot, or another harness — that needs to know the
rules, the skills, the personas, and the cross-wake
discipline.

**Canonical question at cold-start:** *"what do I load,
in what order, and what is non-negotiable?"*

### Start here

- [`../CLAUDE.md`](../CLAUDE.md) — Claude-Code session
  bootstrap pointer tree (harness-specific to Claude
  Code but well-structured).
- [`../AGENTS.md`](../AGENTS.md) — universal handbook.
- [`WAKE-UP.md`](WAKE-UP.md) — explicit Tier 0 / Tier 1
  load order and cold-start budget.

### Load-bearing rules

- [`ALIGNMENT.md`](ALIGNMENT.md) — alignment contract
  with the human maintainer.
- [`CONFLICT-RESOLUTION.md`](CONFLICT-RESOLUTION.md) —
  reviewer-roster conference protocol.
- [`AGENT-BEST-PRACTICES.md`](AGENT-BEST-PRACTICES.md) —
  stable `BP-NN` rules cited in skill bodies.
- [`TECH-DEBT.md`](TECH-DEBT.md) — § "How this doubles
  as AI instructions" is load-bearing.

### Skills + personas (outside `docs/`)

- `.claude/skills/` — capability registry (the *how*
  of each job).
- `.claude/agents/` — persona registry (the *who*
  wearing each hat).
- `memory/` (per-repo) and `~/.claude/projects/.../memory/`
  (per-agent) — earned memory across sessions.

### Also relevant for AI agents

- [`NAMING.md`](NAMING.md) — affects every code or doc
  name you propose.
- [`GLOSSARY.md`](GLOSSARY.md) — Zeta's overloaded
  terms.
- [`ROUND-HISTORY.md`](ROUND-HISTORY.md) — the
  narrative record; never rewrite, only append.

---

## 4. Zeta contributors

**You are:** contributing to Zeta-the-library (the
system-under-test) — shipping DBSP operator algebra, perf
work, Lean proofs, F# code. Distinct from factory
builders: you extend *the library*, not *the factory*.

**Canonical question at cold-start:** *"what is Zeta,
what shape is its algebra, where do features land?"*

### Start here

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — library
  architecture.
- [`ROADMAP.md`](ROADMAP.md) — shipped vs planned.
- [`BACKLOG.md`](BACKLOG.md) — the P0..P3 backlog.
- [`CURRENT-ROUND.md`](CURRENT-ROUND.md) — what is
  actively being worked on.

### Algebra + specs

- [`DSL.md`](DSL.md) — the Zeta DSL.
- [`FORMAL-VERIFICATION.md`](FORMAL-VERIFICATION.md) —
  Lean / TLA+ / Z3 / FsCheck coverage.
- [`MATH-SPEC-TESTS.md`](MATH-SPEC-TESTS.md) — algebraic
  laws wired through CI.
- [`INVARIANT-SUBSTRATES.md`](INVARIANT-SUBSTRATES.md) —
  where invariants live.
- [`SPEC-CAUGHT-A-BUG.md`](SPEC-CAUGHT-A-BUG.md) — specs
  paying back.

### Debt + bugs + research

- [`BUGS.md`](BUGS.md) — open bug roster.
- [`DEBT.md`](DEBT.md) — system-under-test debt.
- [`INTENTIONAL-DEBT.md`](INTENTIONAL-DEBT.md) — debt
  we took on purpose.
- [`SYSTEM-UNDER-TEST-TECH-DEBT.md`](SYSTEM-UNDER-TEST-TECH-DEBT.md)
  — primer on SUT-scope debt.
- [`TECH-RADAR.md`](TECH-RADAR.md) — tech-choice
  trajectory.

### Performance + benchmarks

- [`BENCHMARKS.md`](BENCHMARKS.md) — perf numbers with
  receipts.
- [`LOCKS.md`](LOCKS.md) — concurrency primitives
  audit.

### Plugin + extensibility

- [`PLUGIN-AUTHOR.md`](PLUGIN-AUTHOR.md) — writing a
  custom operator against the public surface.
- [`FEATURE-FLAGS.md`](FEATURE-FLAGS.md) — preview-gate
  flags and their acknowledgements.

### Research pointers (shared with research-paper readers)

- [`research/`](research/) — design memos and research
  logs.
- [`SHIPPED-VERIFICATION-CAPABILITIES.md`](SHIPPED-VERIFICATION-CAPABILITIES.md)
  — what verification is landed and demonstrable.

### Gaps (not yet landed)

- **No `SYSTEM-UNDER-TEST-GLOSSARY.md`** — pending the
  physical split of `GLOSSARY.md` into factory vs
  system-under-test vocabulary. Until then, the
  system-under-test terms live in
  [`GLOSSARY.md`](GLOSSARY.md) alongside factory terms.

---

## 5. Zeta consumers

**You are:** installing the published NuGet libraries
(`Zeta.Core`, `Zeta.Core.CSharp`, `Zeta.Bayesian`) as
dependencies in your own application. You never see
`.claude/`, you may never read `docs/` — you live in
IntelliSense + README + samples.

**Canonical question at cold-start:** *"how do I use
Zeta in five minutes?"*

### Start here

- [`../README.md`](../README.md) — root README is your
  primary surface. Quick tour + NuGet install + minimal
  circuit example.
- [`../samples/`](../samples/) — runnable sample
  projects.

### Also relevant for consumers

- [`FEATURE-FLAGS.md`](FEATURE-FLAGS.md) — which
  features are preview-gated (you must acknowledge the
  flag to use them).
- [`PLUGIN-AUTHOR.md`](PLUGIN-AUTHOR.md) — only if you
  are writing a custom operator.

### Gaps (not yet landed)

- **Samples directory is sparse.** Iris
  (user-experience-engineer) has consumer-UX expansion
  on her surface.

---

## 6. Observers / reviewers

**You are:** an external reader — not contributing now,
but needing to understand the project. Prospective
employer, journalist, curious stranger, or someone
auditing the alignment-loop claim.

**Reading mode:** evaluate-to-decide (fit, resume,
character, posture).

**Canonical question at cold-start:** *"what does this
project claim, and where is the evidence?"*

### Start here

- [`FACTORY-RESUME.md`](FACTORY-RESUME.md) —
  job-interview-honest description of what the factory
  has actually shipped.
- [`ALIGNMENT.md`](ALIGNMENT.md) — the alignment
  contract (central to the project's claim).
- [`DEDICATION.md`](DEDICATION.md) — why the project
  exists.

### Pitch + positioning

- [`pitch/`](pitch/) — sales-facing materials
  including [`pitch/factory-diagram.md`](pitch/factory-diagram.md)
  and [`pitch/not-theatre.md`](pitch/not-theatre.md).
- [`VISION.md`](VISION.md) — longer-horizon direction.
- [`WINS.md`](WINS.md) — factory-efficacy evidence
  observers can check.

### Also relevant for observers

- [`ROUND-HISTORY.md`](ROUND-HISTORY.md) — how the
  project has evolved round by round.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — if you want
  the technical shape, not just the claim.

---

## 7. Research-paper readers

**You are:** a peer reviewer of a submitted paper, an
academic committee member, a citation-chaser, an author
of an adjacent related-work section, or a theorem-prover
researcher cross-checking Lean / TLA+ / Z3 / FsCheck
scripts.

**Reading mode:** evaluate-to-verify (is the claim true,
is the proof sound, is the benchmark fair, is the scope
honest).

**Canonical question at cold-start:** *"what is the
claim, where is the proof or benchmark that supports it,
what is out of scope, and where is the comparison vs
prior work?"*

### Start here

- [`research/`](research/) — the primary research
  surface. Memos, evaluations, and claim logs.
- [`FORMAL-VERIFICATION.md`](FORMAL-VERIFICATION.md) —
  what is shipped in Lean / TLA+ / Z3 / FsCheck.
- [`SHIPPED-VERIFICATION-CAPABILITIES.md`](SHIPPED-VERIFICATION-CAPABILITIES.md)
  — executable-today receipts.

### Proof + verification records

- [`research/chain-rule-proof-log.md`](research/chain-rule-proof-log.md)
  — incremental proof progress on the DBSP chain rule.
- [`research/proof-tool-coverage.md`](research/proof-tool-coverage.md)
  — which tool covers which property class.
- [`research/verification-registry.md`](research/verification-registry.md)
  — what has been verified, where, and by whom.
- [`MATH-SPEC-TESTS.md`](MATH-SPEC-TESTS.md) — algebraic
  laws checked in CI (the spec-as-executable-test
  surface).
- [`BENCHMARKS.md`](BENCHMARKS.md) — perf claims with
  reproducible receipts.

### Co-authoring + etiquette

- [`RESEARCH-COAUTHOR-TRACK.md`](RESEARCH-COAUTHOR-TRACK.md)
  — teaching track for human coauthors.

### Executable artefacts (outside `docs/`)

Paper reviewers who want to *run* proofs or benchmarks
should read these despite their non-`docs/` location:

- `tools/lean4/` — Lean proof scripts.
- `tools/tla/` — TLA+ specs.
- `src/` + `tests/` — the F# code the proofs discuss.
- `bench/` — runnable benchmarks.

### Gaps (not yet landed)

- **No `PAPER-DRAFTS/` directory.** Drafts live
  ad-hoc in `research/` today. A canonical per-paper
  subtree (claim / proof / benchmark / related-work /
  threats-to-validity) is on the backlog.
- **No `RELATED-WORK.md` canonical survey.** Per-topic
  bibliographies are scattered across research memos.
- **No `THREATS-TO-VALIDITY.md`** for negative-space
  disclosure. Candidate alongside the first paper
  submission.
- **Reproducibility artefacts** (seeds, datasets,
  exact-versions) are not bundled per paper.

---

## Relationship to the scope tag

Audience and scope are **orthogonal attributes** of
every `docs/` file:

- **Scope** (`factory` / `project` / `both`) answers *who
  owns the rule or artefact*.
- **Audience** (`factory-builders` / `factory-adopters`
  / `ai-agents` / `zeta-contributors` / `zeta-consumers`
  / `observers` / `research-readers`) answers *who reads
  the explanation*.

They correlate but do not collapse. Examples:

| Doc | Scope | Primary audience |
|---|---|---|
| [`GLOSSARY.md`](GLOSSARY.md) | `factory` | factory-builders |
| `SYSTEM-UNDER-TEST-GLOSSARY.md` (pending) | `project` | zeta-contributors |
| [`TECH-DEBT.md`](TECH-DEBT.md) | `factory` | factory-builders (+ adopters + AI agents also-relevant) |
| [`SYSTEM-UNDER-TEST-TECH-DEBT.md`](SYSTEM-UNDER-TEST-TECH-DEBT.md) | `project` | zeta-contributors |
| [`FACTORY-HYGIENE.md`](FACTORY-HYGIENE.md) | `both` | factory-builders |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | `project` | zeta-contributors |

The scope tag travels with the rule; the audience
travels with the doc.

---

## Maintenance

This file is the single source of truth for audience
navigation. The taxonomy itself (the seven audiences and
their canonical questions) is tracked in the auto-memory
entry `project_document_audience_categories.md` so it
survives across agent sessions.

**Changes that require re-indexing here:**

1. A new doc lands under `docs/` — add it to the primary
   audience's section, and cross-reference from
   secondary sections under "Also relevant."
2. A doc's audience changes — move the link. The doc's
   own frontmatter should also reflect the change (see
   "Per-doc frontmatter" below).
3. A gap closes (e.g., `SYSTEM-UNDER-TEST-GLOSSARY.md`
   lands) — move it from the gaps block to the body
   list and drop the gap note.
4. A new audience is added (e.g., `ace-maintainers`
   when the ace package manager becomes a separate
   scope) — add a new top-level section; Aaron must
   sign off first.

**Per-doc frontmatter convention** (being rolled out):

```markdown
---
audience: factory-builders          # primary; one of the seven
also-relevant-to: [ai-agents, factory-adopters]
scope: factory                      # orthogonal to audience
---
```

Docs without this frontmatter yet can be classified by
matching them against the per-section lists above.

---

## Open taxonomy decisions

These are Aaron-open (not factory-closed); none block
navigation:

1. **ace-maintainers as an eighth audience?** The `ace`
   package manager (name picked 2026-04-20) may become
   a third scope with its own doc tree. Decision
   deferred until ace source-code home settles.
2. **Merge Zeta consumers and observers?** Both are
   "don't contribute, just read." Kept separate on
   intent: consumers want to build *with* Zeta,
   observers want to understand *about* Zeta.
3. **Split AI agents into contributors vs downstream
   users?** Becomes relevant when a downstream
   application uses Zeta as an AI-research primitive.
4. **OpenSpec capability specs** under `openspec/specs/**`
   — audience is probably `zeta-contributors` but
   spec-zealot (Viktor) cares cross-cutting. Deferred.
