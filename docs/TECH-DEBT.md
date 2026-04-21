# Technical Debt — Factory Operator Manual

*Shipped with the factory. Explains what technical debt is,
why it matters, how to spot it, and — the part most operator
manuals skip — **how the factory automates its discovery and
fixes**. This document is written for two audiences at once:
humans who want to know how the factory works, and AIs who
want to know how to keep it working. The instructions are the
same.*

*Scope: `factory` (ships with every adopter project). The
system-under-test variant is
[`docs/SYSTEM-UNDER-TEST-TECH-DEBT.md`](SYSTEM-UNDER-TEST-TECH-DEBT.md).*

---

## TL;DR

- Tech debt is **working code / docs / specs that are in the
  wrong shape** — it does not lie, but it slows everything
  down and compounds silently.
- The factory treats debt-discovery as a **scheduled system
  service**, not a heroic audit. Cadenced hygiene rows,
  specialist reviewer agents, cross-wake discipline rules,
  and the stable BP-NN rule registry do the looking.
- Discovery is half the job; **structured landing via
  ledgers + architect gate** is the other half. Unintentional
  debt is the failure mode; intentional debt, declared in the
  same commit, is fine.
- Classes of debt we've caught are listed below with **real
  examples from this repo**. No speculative taxonomy — every
  class cites a landed finding.

---

## What technical debt IS

Technical debt is **cost that has been moved forward in time**.
Something is in place, it works, and the cost of not fixing it
accumulates elsewhere — in friction, in cognitive load, in
silent failure modes that don't fire today but will.

The factory distinguishes debt from bugs:

| | Bugs | Tech debt |
|---|---|---|
| **Symptom** | Breaks / misleads / lies | Works but in the wrong shape |
| **Correctness** | Fails | Passes |
| **Compound** | Once, loudly | Silently, forever |
| **Ledger** | `docs/BUGS.md` | `docs/DEBT.md` (accidental) + `docs/INTENTIONAL-DEBT.md` (declared) |
| **Urgency** | P0/P1/P2 severity | S/M/L effort |

A bug lies to users. Debt does not lie — it just makes
everything harder. **Debt is honest friction.**

## What technical debt IS NOT

- A **feature you haven't built yet** — that's backlog.
  File it under `docs/BACKLOG.md`.
- A **bug** — a correctness failure lands in `docs/BUGS.md`.
- A **stance** — deliberate conservatism (holding a tech at
  Trial, not promoting to Adopt) is not debt; it is
  judgement. File stance under `docs/TECH-RADAR.md`.
- A **closed decision** — ADRs under `docs/DECISIONS/`
  represent chosen constraints, not debt.

When an entry is ambiguous, the rule is **put it in
`docs/DEBT.md`**. Migration out of DEBT is cheap; migration
out of BACKLOG is not.

## Why it matters

Tech debt is the **rate at which a codebase loses velocity
without appearing to**. Teams that do not track debt deliver
fast for the first year, and then inexplicably slow down. The
slowdown is not mysterious — it is the compound interest on
every shortcut, stale pointer, un-refactored abstraction, and
un-retired feature flag that has been quietly paying rent.

Why this factory cares:

1. **Trust floor.** Adopter projects will trust the factory
   more if the factory can name its own debt honestly, in
   public, with evidence. A factory that has no debt ledger
   is hiding.
2. **Velocity ledger.** The factory ships multi-agent,
   architect-gated, at a round-based cadence. Debt that
   accumulates between rounds is what causes rounds to slip.
3. **AI agent continuity.** Agents wake fresh at every
   session. What past-me deferred as "next tick" becomes
   debt if the deferral target goes stale. Debt is the
   cross-wake-continuity tax.
4. **Honesty floor.** The factory's resume
   (`docs/FACTORY-RESUME.md`) claims honest scope limits;
   debt is part of those limits. Undeclared debt is an
   honesty failure.

---

## Classes of technical debt

Every class below cites a real landed finding from this repo.
No speculative taxonomy.

### 1. Stale-pointer debt

File paths, section numbers (`GOVERNANCE.md §N`), or rule IDs
(`BP-NN`) that pointed at something real at the time of
writing but no longer resolve. The pointer still looks valid;
the target has moved or vanished.

**Symptom:** cold-start reader follows a dead link. Writer
discovered the drift at fetch time rather than at authorship.

**Example from this repo:**

- `STYLE.md referenced 3x but absent` in `docs/DEBT.md` —
  `maintainability-reviewer` skill cited `docs/STYLE.md`
  before it existed.
- Row #22 in `docs/FACTORY-HYGIENE.md` had `(draft)` annotation
  on a landed memory filename; caught by the pointer-integrity
  audit (row #25) the first time it ran.

**Cadence that catches it:** `docs/FACTORY-HYGIENE.md` row #25
(pointer-integrity audit) runs at every round close.

### 2. Verification-spec drift

Formal specs (Lean proofs, TLA+ models, Z3 queries, FsCheck
properties, xUnit tests) fall out of sync with the code they
verify. The spec still compiles; it is verifying an old shape
of the code.

**Symptom:** a refactor lands, all tests still pass, yet the
claim the spec was proving no longer holds because the spec's
model of the world drifted.

**Example from this repo:**

- `Lean IsLinear predicate too weak for B2` in `docs/DEBT.md`
  — the Lean predicate covers `map_zero + map_add` at stream
  level only; DBSP linearity requires additive AND time-
  invariant AND causal. Blocks closure of B2, B3, chain rule.

**Cadence that catches it:** `docs/FACTORY-HYGIENE.md` row #16
(verification-drift audit) + `verification-drift-auditor`
skill.

### 3. Pinned-but-not-referenced debt

A dependency, skill, or capability is *installed / pinned /
documented* but never *used*. Credibility-debt: the project
looks like it has the capability, but has never exercised it.

**Symptom:** audit finds the thing exists in
`Directory.Packages.props` or is listed under
`.claude/skills/`, but no code path / review / reference
actually invokes it.

**Example from this repo:**

- `FACTORY-RESUME.md Honest scope limits` lists
  SonarAnalyzer.CSharp as pinned with 15+ unreviewed
  findings. Cannot honestly claim adoption until the
  findings are triaged.

**Cadence that catches it:** round-cadence resume-vs-
shipped-capabilities audit; the honest-scope-limits section
is the discovery surface.

### 4. Documentation drift

Docs describe state that no longer exists. Historical-voice
survivors in files that are supposed to read current-state
(per `GOVERNANCE.md §2`). Pronoun drift. Command drift
across duplicated invocations.

**Symptom:** a contributor reads the doc, tries to apply it,
finds reality does not match.

**Example from this repo:**

- "Round-N fix" historical-voice survivors in
  `src/Core/FastCdc.fs:68`, `Residuated.fs:39`,
  `Durability.fs:17` etc. — docstrings talk about when the
  invariant was introduced rather than stating the invariant
  itself.
- `CLAUDE.md duplicates commands that live in CONTRIBUTING.md`
  — `dotnet build -c Release` inline in two places; drift
  risk.

**Cadence that catches it:** `maintainability-reviewer`
(Rune) routine pass on hot-churn files.

### 5. Ledger-overdue debt

An item is tracked in a ledger with a cadence rule (prune at
3000 words; rotate at N rounds; retire after no-invocation
threshold), but the cadence has been missed.

**Symptom:** the ledger itself becomes noisy / oversized /
stale. The system that was supposed to catch debt has itself
become debt.

**Example from this repo:**

- Daya notebook at ~4400 words vs BP-07 3000-word cap, 10
  rounds overdue on prune as of round 44. Re-flagged as
  blocker for next Daya audit.

**Cadence that catches it:** notebook cap check at every
invocation; hygiene rows with explicit cadence columns.

### 6. Scope-ambiguity debt

An artefact (hygiene row, skill, memory, ADR) exists without
declaring its scope (`project` / `factory` / `both`). Readers
cannot tell whether the rule applies to adopters, to this
repo only, or to both.

**Symptom:** adopters cannot project the artefact into their
own context; contributors guess wrong about ownership.

**Example from this repo:**

- `docs/FACTORY-HYGIENE.md` lacked a Scope column until round
  44. 29 rows landed without scope tags. Remediated in the
  same round; scope declaration is now a requirement for new
  rows.

**Cadence that catches it:** scope-audit on artefact-add;
symmetry-audit pass (`docs/FACTORY-HYGIENE.md` row #22
proposed).

### 7. Naming / convention drift

A naming rule or path convention changes (`src/Zeta.Core/**`
→ `src/Core/**`; persona names normalised; skill-file
frontmatter keys renamed) but some residues of the old
convention survive in places the sweep missed.

**Symptom:** two conventions coexist; contributors or agents
pick the wrong one.

**Example from this repo:**

- `Stale path src/Zeta.Core/** in two Semgrep rules` —
  `feedback_folder_naming_convention` sweep missed two
  `.semgrep.yml` rules; corrected in-round.
- `Skill-file prose polish after GOVERNANCE §27 sweep` —
  mechanical `sed` left "the `role` (role)" duplications.

**Cadence that catches it:** grep sweep on rename-round;
`maintainability-reviewer` tune-up pass.

### 8. Over-abstraction debt

A type, interface, or abstraction was made generic or
publicised without the author realising it would become a
plugin contract. Every abstract / virtual member is now a
forever-contract.

**Symptom:** plugin author has no harness to verify their
implementations; removing members becomes a breaking change
for consumers the factory did not know existed.

**Example from this repo:**

- `Op<'T> implicitly publicised as a plugin subclass-
  extension point` — `Circuit.RegisterStream<'T>` accepts
  `Op<'T>`; every member of `Op` / `Op<'T>` became a plugin
  contract without intent.

**Cadence that catches it:** `public-api-designer` (Ilyana)
gate on internal→public flips + new members; ADR reversion
triggers.

### 9. Test-flakiness debt

A test is non-deterministic. It passes most runs, fails
occasionally with reproducible seed state, and the failure
is ignored as a flake.

**Symptom:** red-green-red noise; real regressions hide in
the flake signal; contributors learn to distrust the CI.

**Example from this repo:**

- `Flaky FsCheck property in the F# suite` — seeds
  `(5370856837815825128, 13581531945998878741)` reproduce;
  second run green with a different seed.

**Cadence that catches it:** CI flake detector; seed pinning
on probabilistic properties; reviewer rule "flakiness is not
acceptable long-term."

### 10. Suppression debt

Inline lint suppressions (`// nosemgrep`, `#pragma`,
`[SuppressMessage]`) accumulate without the rule being
sharpened. Every suppression is a missed opportunity to make
the rule precise.

**Symptom:** a finding fires once, the reviewer adds a
suppression, the pattern repeats, more suppressions stack up,
the rule's signal/noise ratio collapses.

**Example from this repo:**

- `Semgrep rule 2 plain-tick-increment — four nosemgrep
  suppressions` across `FSharpApi.fs`, `LawRunner.fs`,
  `PluginHarness.fs`. Fix: sharpen the rule to match only
  module-scope mutable, not method-local counter.

**Cadence that catches it:** round-cadence suppression sweep;
Semgrep custom-rule author authoring-cost feedback.

### 11. Skill-bloat debt

A skill file exceeds the BP-03 ~300-line cap. The skill is
doing too much; frontmatter description no longer covers the
body; triggering becomes imprecise.

**Symptom:** skill-tune-up flags the skill with `bloat`
signal; ranker recommends SPLIT or SHRINK.

**Example from this repo:**

- `.claude/skills/skill-creator/SKILL.md` at ~180 lines
  (still under cap but large); `skill-tune-up` itself
  hit 436 lines in round 42 → content-extraction to
  `docs/references/skill-tune-up-eval-loop.md`; open entry in
  `docs/INTENTIONAL-DEBT.md` pending harness re-run.

**Cadence that catches it:** `skill-tune-up` ranker via the
`plugin:skill-creator` eval harness (not static line-count —
per
`feedback_skill_tune_up_uses_eval_harness_not_static_line_count.md`).

### 12. Phantom-target debt

"Next tick" / "next round" / "deferred to" references that
point at targets which do not exist. Either the deferral was
phantom from the start, or the target was renamed / removed
and the reference was not updated.

**Symptom:** future-me (or another contributor) arrives
expecting a real target, finds nothing, has to reconstruct
intent.

**Example from this repo:**

- Caught by the CLAUDE.md-level rule
  `verify-before-deferring` (memory:
  `feedback_verify_target_exists_before_deferring.md`) —
  every deferral ships with a cited path; no path, no
  deferral.
- Round-cadence stale-next-tick sweep
  (`docs/FACTORY-HYGIENE.md` row #27) cleans legacy phantoms.

**Cadence that catches it:** session-open
`verify-before-deferring` check + round-close legacy sweep.

### 13. Ontology-home drift

Content is filed in the wrong home. A rule that should be
BP-NN ends up in a skill file; a memory that should be a
committed doc sits in auto-memory; an ADR that should be a
DEBT row got filed as a DECISION.

**Symptom:** search does not find the canonical answer;
redundant statements accumulate in multiple places;
contradictions between homes develop silently.

**Example from this repo:**

- Ontology-home check every round
  (`feedback_ontology_home_check_every_round.md`) —
  memories that should be AGENTS.md rules, CLAUDE.md
  bootstrap pointers, or BP-NN registry entries get
  promoted; the index stays clean.

**Cadence that catches it:** `docs/FACTORY-HYGIENE.md` row #7
(ontology-home check) + `claude-md-steward` skill.

### 14. Rule-registry drift

Scratchpad findings (`memory/persona/best-practices-scratch.md`)
accumulate without being promoted to stable BP-NN rules or
retired. The stable registry stagnates; findings pile up in
the scratchpad.

**Symptom:** ranker flags increasing `best-practice-drift`
signal; reviews cannot cite a stable rule because the rule is
still a candidate.

**Example from this repo:**

- Every `skill-tune-up` live-search step diffs findings
  against `docs/AGENT-BEST-PRACTICES.md`; candidate
  promotions get flagged for Architect ADR. The Architect's
  round-close duty includes processing the scratchpad.

**Cadence that catches it:** `skill-tune-up` live-search step;
round-close Architect sweep.

---

## How to spot tech debt — heuristics

Five smells that generalise across classes:

| Smell | Question | Class often behind it |
|---|---|---|
| **Stale** | Does this pointer / section number / rule ID still resolve? | 1, 12, 13 |
| **Friction** | Does this slow me down more than it helps? | 4, 9, 10, 11 |
| **Drift** | Does reality match what this claims? | 2, 4, 7, 14 |
| **Overdue** | Is this cadence-rule being honoured? | 5 |
| **No-scope** | Can a reader tell the audience? | 6, 13 |

A debt row is **one of those smells + a named class + a
concrete `site:line` + an effort estimate**. Anything shorter
is not ready to file.

---

## How the factory automates discovery

This is the "next-level" part. Most teams treat debt-discovery
as a heroic audit — a senior engineer blocks out a week to
"clean up the codebase" and then debt quietly re-accumulates
between audits. The factory inverts this: **discovery is a
scheduled service**.

### Cadenced hygiene audits

`docs/FACTORY-HYGIENE.md` is the one-file index of every
audit the factory runs on itself. Current count: 29 rows.
Each row has an owner, a cadence, a source-of-truth file,
and a scope tag (`project` / `factory` / `both`). Examples
directly relevant to debt-discovery:

- **Row #25 (pointer-integrity audit)** — Daya runs every
  round-close; verifies every pointer in CLAUDE.md,
  AGENTS.md, MEMORY.md, FACTORY-HYGIENE.md resolves. Catches
  class 1 (stale-pointer).
- **Row #27 (stale-next-tick sweep)** — Architect runs every
  round-close; greps ROUND-HISTORY and persona notebooks for
  deferred-target strings; verifies each resolves. Catches
  class 12 (phantom-target).
- **Row #16 (verification-drift audit)** — Soraya runs every
  round; compares Lean / TLA+ / Z3 / FsCheck specs against
  code. Catches class 2 (verification-spec drift).
- **Row #7 (ontology-home check)** — Claude-MD-Steward runs
  every round. Catches class 13 (ontology-home drift).
- **Rows #26 / #28 (wake-briefing + harness-drift detector)**
  — session-open checks, hard-capped at `< 10s` total.
  Catches many classes at first-60-seconds.

The cadence column is the load-bearing field. A rule with no
cadence is not a rule; it is a wish.

### Specialist reviewer agents

Personas under `.claude/agents/` with focused domains. They
run as subagents (context-isolated) on explicit dispatch.
Coverage map:

| Agent | Debt classes covered |
|---|---|
| Kira (harsh-critic) | 2, 8, 9 — zero-empathy P0/P1/P2 triage |
| Rune (maintainability-reviewer) | 4, 7, 11 — readability, naming, bloat |
| Viktor (spec-zealot) | 2 — OpenSpec capability drift |
| Ilyana (public-api-designer) | 8 — internal→public API gate |
| Soraya (formal-verification-expert) | 2 — proof-tool alignment |
| Daya (agent-experience-engineer) | 1, 12, 13 — wake-UX, pointer drift |
| Bodhi (developer-experience-engineer) | 4 — contributor first-60-minutes |
| Iris (user-experience-engineer) | 4, 8 — library-consumer first-10-minutes |
| Aarav (skill-tune-up ranker) | 11, 14 — skill drift / BP drift |
| Naledi (performance-engineer) | perf-budget regressions (SUT-side) |

The Architect (Kenji) synthesises all findings; nobody
reviews the Architect (accepted bottleneck per
`GOVERNANCE.md §11`).

### Cross-wake discipline rules

Two rules are CLAUDE.md-level (100%-wake-load) specifically
because they govern the wake-boundary itself and prevent
debt across wakes:

- **verify-before-deferring** — every "next tick / next
  round" deferral must cite a path to a real target. Phantom
  handoffs are worse than stopping honestly.
- **future-self-not-bound** — on wake, if past-me's decision
  looks wrong, revise via protocol (memory edit with dated
  revision line, ADR for BP-NN, skill-edit justification
  log). "Not bound" is freedom-to-revise, not freedom-from-
  record.

Together these bound wake-to-wake continuity and prevent
class 12 (phantom-target) and class 13 (ontology-home
drift).

### Ledger structure

Three ledger shapes with distinct semantics:

- **`docs/DEBT.md`** — live accidental-debt entries.
  Current-state; delete when resolved; narrative goes to
  ROUND-HISTORY.
- **`docs/INTENTIONAL-DEBT.md`** — declared shortcuts filed
  in the same commit. Newest-first; never deleted;
  resolution moves row to "Resolved" section.
- **`docs/BUGS.md`** — correctness failures, not debt.
  Keep separate on purpose.

Accidental debt discovered later becomes **retroactive
INTENTIONAL-DEBT** with a ROUND-HISTORY process note. No
blame; the rule is "no *accidental* debt," not "no mistakes."

### BP-NN rule registry

Every durable rule gets a stable ID (`BP-01`, `BP-02`, …)
in `docs/AGENT-BEST-PRACTICES.md`. Reviewer findings cite
the rule by ID. Candidates land in
`memory/persona/best-practices-scratch.md`; promotion is
Architect-ADR gated. The registry is what lets a reviewer
say "violates BP-03" and have that mean something stable.

---

## How the factory automates fixes

Discovery without landing is noise. The factory's landing
stack:

### Architect-bottleneck

All agent-authored code passes through the human-in-the-loop
maintainer. This is the deliberate gate — not a flaw, a
feature (`GOVERNANCE.md §11`). A finding from a specialist
reviewer lands only after the Architect synthesises and the
human maintainer approves. The gate is what makes the
factory trustworthy.

### skill-creator workflow

Skill-file edits are canonical through `skill-creator` (not
ad-hoc sed). The workflow: draft → prompt-protector review
→ dry-run eval harness → commit. Mechanical renames and
injection-lint fixes are the only allowed skip-the-workflow
edits; each such edit lands a row in
`docs/skill-edit-justification-log.md`.

This closes class 11 (skill-bloat) and class 14 (rule-
registry drift) with a named pipeline rather than
case-by-case judgement.

### ADR registry with reversion triggers

`docs/DECISIONS/YYYY-MM-DD-<slug>.md`. Each ADR states the
decision, the constraint, the alternatives considered, and
— critically — the **reversion trigger**: the observable
signal that makes this decision wrong, and what the
follow-up would be.

ADRs are append-only; a superseding ADR cites and replaces
the old one but the old ADR stays as history. This is the
cross-wake revision protocol from the future-self-not-bound
rule applied at the architecture layer.

### Preserve-original-and-every-transformation

Default-ON for load-bearing data. Revisions preserve history;
the round-history log is append-only; memory files log
dated revision lines at the bottom rather than silently
overwriting. This is what makes "revise when genuinely
disagreeing" safe — revisions leave a trail.

### Just-in-time debt landing

The fastest fix for a small-effort-S finding is often to
land it inline. The round-44 pointer-integrity audit caught
a stale `(draft)` annotation and removed it in < 30 seconds.
This is the ideal loop: discovery → fix → done. Debt rows
are for findings that cannot close in-flight.

---

## How this doubles as AI instructions

If you are an AI agent reading this as part of your
onboarding: this document is your operator manual. The
following are **instructions**, not narrative:

1. **Check your pointers before you write them.** When you
   cite `GOVERNANCE.md §N`, verify §N exists at that number.
   When you cite a memory file, verify the file exists.
   When you defer work to a target, verify the target
   resolves. This is the verify-before-deferring rule; it
   is CLAUDE.md-level load-bearing.
2. **Scope every artefact you add.** New hygiene rows, new
   rules, new skills — all get a `project` / `factory` /
   `both` tag. An untagged row is not ready to land.
3. **Declare shortcuts in the same commit.** If you take a
   shortcut (time pressure, scope discipline, research-in-
   progress), file an `INTENTIONAL-DEBT.md` row in the same
   commit. Accidental debt is the only failure mode.
4. **Cite stable rule IDs.** Findings cite BP-NN. If the
   rule does not exist yet, file it in the best-practices
   scratchpad for Architect promotion. Do not inline-drift
   the stable registry.
5. **Respect the cadence column.** A hygiene row with a
   cadence is not optional. Session-open rows have a
   `< 10s` cap; round-close rows are where the deeper
   audits live.
6. **Revise past decisions with reason and record.** On
   wake, if past-me's decision looks wrong, revise via
   the protocol for that artefact class (memory edit,
   ADR, skill-edit justification). Never silently
   rubber-stamp past-me; never silently overwrite past-me.
7. **If in doubt, put it in DEBT.** Over-filing the debt
   ledger is a venial sin; under-filing is the mortal one.
8. **Read DEBT.md and INTENTIONAL-DEBT.md at round-open.**
   The ledgers are your catalogue of what past-you and
   your collaborators know is wrong right now.

---

## Relationship to other docs

- **`docs/DEBT.md`** — the live ledger. This doc tells you
  *what debt is and how to spot it*; DEBT.md tells you
  *what specific debts we currently owe*.
- **`docs/INTENTIONAL-DEBT.md`** — the declared-shortcut
  ledger. Rows live here newest-first, never deleted.
- **`docs/BUGS.md`** — correctness failures, not debt.
- **`docs/BACKLOG.md`** — unstarted features; when a debt
  grows past 500 lines of work, it becomes a BACKLOG row.
- **`docs/FACTORY-HYGIENE.md`** — the cadenced-audit index;
  the source of every debt-discovery service.
- **`docs/AGENT-BEST-PRACTICES.md`** — stable BP-NN
  registry; every finding cites a rule here.
- **`docs/ROUND-HISTORY.md`** — append-only history;
  resolved debt rows and process notes land here.
- **`docs/DECISIONS/`** — ADRs; architecture decisions,
  reversion triggers.
- **`docs/FACTORY-RESUME.md`** — the honest-scope-limits
  section names debt-class #3 (pinned-but-not-referenced).
- **`docs/SYSTEM-UNDER-TEST-TECH-DEBT.md`** — the Zeta-
  specific variant. System-under-test classes (operator
  algebra correctness, perf budgets, public-API contracts,
  F# warning hygiene) live there.

---

## Further reading

- Ward Cunningham's original debt metaphor (1992)
  — the loan analogy, interest payments, and why unpaid
  interest causes refactor-collapse.
- Martin Fowler's **debt quadrant**: reckless vs prudent,
  deliberate vs inadvertent. This factory's INTENTIONAL-DEBT
  ledger is the prudent-deliberate quadrant explicitly.
- Michael Feathers, *Working Effectively with Legacy Code*
  — the foundational debt-reducer text; characterisation
  tests as a discovery surface.
- SEI Technical Debt Field Guide (2014+) — classes of debt
  at the organisational scale; informs our own taxonomy.

---

*This document is audited on round cadence against every
class's cited example. If a class no longer has a real
in-repo example, the class is either retired or re-cited
against a current finding. No speculative classes.*
