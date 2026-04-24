# Factory-vs-Zeta separation audit

**Status:** seed v0 — framework + first doc classified. Grows tick-by-tick.
**Purpose:** closes gap #5 of the Frontier bootstrap readiness roadmap (BACKLOG P0).
**Owner:** Otto (loop-agent PM hat); reviewer consultation as sections mature.

## Why this audit exists

The Zeta monorepo currently holds two conceptually distinct projects:

1. **The factory** — the software-factory substrate (AGENTS.md,
   CLAUDE.md, `.claude/`, GOVERNANCE.md, persona agents,
   skills, hygiene discipline, autonomous-loop protocol).
   This substrate is designed to be generic — reusable
   across any project that adopts the factory shape.
2. **Zeta the library** — the retraction-native DBSP library
   (F# reference implementation under `src/Core/`, tests,
   samples, benchmarks, public NuGet artifacts). This is
   the specific library Zeta was originally built for.

The eventual multi-repo split (per
`docs/research/multi-repo-refactor-shapes-2026-04-23.md`)
separates these into sibling repos. Frontier will host the
factory substrate; Zeta will keep the library.

Before the split can execute cleanly, **every doc and
configuration file in the monorepo needs an honest
classification**: is it factory-generic, Zeta-library-
specific, or genuinely both? This audit is the classification
substrate.

## The three classes

| Class | Meaning | Where it lives post-split |
|---|---|---|
| **factory-generic** | Content applies to any project that adopts the factory — agents, personas, skills, governance, hygiene. No Zeta-library-specific assumptions. | Frontier |
| **zeta-library-specific** | Content is about the DBSP library — retraction-native algebra, ZSet, Spine, F# implementation, library API, benchmarks. | Zeta |
| **both (coupled)** | Content covers both concerns in the same file; needs refactor before split to separate. | Gets split during the refactor; each half lands in the appropriate repo. |

## Audit schema — one section per file

For each audited file:

- **Overall classification**: factory-generic / zeta-library-specific / both
- **Section-by-section breakdown** (when the file is long
  enough to benefit from it): which sections fall into which
  class
- **Refactor notes**: what needs to change before the split
  can cleanly separate this file (if class is "both")
- **Audit date + auditor**: traceability

## Audit progress

### Files audited

- **CLAUDE.md** (below, seed fire)
- **AGENTS.md** (below, Otto-9 fire)
- **docs/CONFLICT-RESOLUTION.md** (below, Otto-12 fire)
- **docs/AGENT-BEST-PRACTICES.md** (below, Otto-13 fire)
- **docs/AUTONOMOUS-LOOP.md** (below, Otto-15 fire)
- **docs/WONT-DO.md** (below, Otto-15 fire) — also GOVERNANCE.md on PR #181, ALIGNMENT.md on PR #185

### Files to audit (not yet classified; add rows as they land)

- `docs/GLOSSARY.md`
- `docs/FACTORY-HYGIENE.md`
- `docs/ROUND-HISTORY.md`
- `docs/TECH-RADAR.md`
- `docs/BACKLOG.md`
- `docs/ROADMAP.md`
- `docs/VISION.md`
- `.claude/skills/*/SKILL.md` (each)
- `.claude/agents/*.md` (each)
- `openspec/**` (structural; library-specific-heavy)
- `tools/**/*` scripts (some factory, some Zeta-build)
- `.github/` workflows + config

Not a prescriptive queue; the audit lands as sections
mature. One or two files per tick is the intended cadence.

## Audit — CLAUDE.md

**Overall classification:** **both (coupled)** — the file is
structured around Claude Code harness as the session-bootstrap
mechanism (factory-generic for any Claude-harness-using
project), but includes several Zeta-library-specific examples
and references.

**File location post-split:** Frontier (factory side). The
Zeta-library references in it are illustrations of "what a
Claude Code user would reach for," not Zeta-library content
itself.

**Length:** 267 lines.

### Section-by-section breakdown

| Section | Class | Notes |
|---|---|---|
| Preamble / purpose of CLAUDE.md | factory-generic | Bootstrap tree pointing at AGENTS.md; generic to any factory adopter. |
| "Read these, in this order" (numbered 1-7) | factory-generic, with Zeta-library examples | Pointers are factory-generic (ALIGNMENT.md / CONFLICT-RESOLUTION.md / GLOSSARY.md / WONT-DO.md / openspec / GOVERNANCE.md); the specific files referenced will ALSO be factory-generic after their own audit, though GLOSSARY + WONT-DO may have Zeta-specific content. |
| "Claude Code harness — what this buys us" | factory-generic | Lists skills / subagent dispatch / auto-memory / session compaction / hooks + settings. All factory shape. |
| "Ground rules Claude Code honours here" | factory-generic with one illustrative ZSet reference | The "Result-over-exception" bullet mentions `Result<_, DbspError>` and `AppendResult` — those are Zeta-library types. In Frontier, this example needs generalisation or replacement with a generic result-type illustration. The principle (result-over-exception) is factory-generic. |
| "Build and test gate" | zeta-library-specific | `dotnet build -c Release` and `dotnet test Zeta.sln -c Release` are Zeta-library-specific. In Frontier, this section goes away or becomes generic ("your project's build/test gate"). |
| "When Claude is unsure" | factory-generic | Architect escalation via CONFLICT-RESOLUTION.md; generic discipline. |
| "What Claude won't find here" | factory-generic with one Zeta reference | Mentions `openspec/changes/` intentionally-unused. Openspec is factory-adopted but the specific "intentionally unused" choice is per-project. Generic otherwise. |

### Refactor notes

Before the split:

1. **Generalise the Result-over-exception example** from
   `Result<_, DbspError>` to a generic illustration,
   or remove the example and keep the principle.
2. **Remove the Zeta-library build-and-test gate section**
   entirely from Frontier's CLAUDE.md. Replace with a
   generic "your project's build/test gate is load-bearing"
   pointer that each adopter fills in per their own project.
3. **Keep the openspec reference but neutralise the
   Zeta-specific "intentionally unused" directive** —
   each adopter may use openspec differently.

Estimated refactor effort: S (small) — these are isolated
surgical edits, not structural redesign.

### Classification rationale

CLAUDE.md is the *bootstrap pointer tree* for a Claude Code
session, which is a factory-generic mechanism. The file
contains Zeta-library examples illustrating how the factory
shape grounds in this specific project, but the shape itself
transfers. In Frontier, this file carries the same role; the
examples swap out or generalise.

## Audit — AGENTS.md

**Overall classification:** **both (coupled)** — the file is
explicitly designed as a *universal onboarding handbook*
("works with any AI harness ... as well as for human
contributors") which is factory-generic in shape, but
contains several Zeta-library-specific sections that need
surgical edits before the split.

**File location post-split:** Frontier (factory side). Acts as
the authoritative template; adopters fork + customise the
example sections.

**Length:** 359 lines.

### Section-by-section breakdown

| Section | Class | Notes |
|---|---|---|
| Preamble / philosophy | factory-generic | Universal-handbook intent; GOVERNANCE.md pointer; "if harness addendum contradicts this file, this file wins" rule. Generic. |
| "Status (authoritative)" (pre-v1) | factory-generic (shape) | Pre-v1 status is project-specific but the pattern transfers. In Frontier, adopters declare their own status at startup. Wording can use `<PROJECT>` placeholder. |
| "The vibe-coded hypothesis" | factory-generic | Research hypothesis about AI-directed factory. Applies to any factory adopter running the vibe-coded hypothesis. Frontier ships this content as-is. |
| "What pre-v1 means in practice" | factory-generic | Pre-v1 discipline: refactors welcome / no back-compat / tests-as-contract. Applies to any adopter in pre-v1 phase. |
| "The three load-bearing values" | **both (coupled)** | Values #1 (truth over politeness) and #3 (velocity over stability) are factory-generic. Value #2 "Algebra over engineering. The Z-set / operator laws define the system" is explicitly Zeta. Frontier version substitutes a generic value #2 (e.g., "substrate over ornamentation" or "algebra over engineering" with adopter fills-in-their-substrate). |
| "The alignment contract" | factory-generic | Points at docs/ALIGNMENT.md. Generic. |
| "What we borrow, what we build" | zeta-library-specific | Lists DBSP / Differential Dataflow / FASTER / TigerBeetle / Datomic / XTDB 2 / Materialize / Feldera / SlateDB / LZ4 / Arrow / CALM. Explicit Zeta-library borrowing inventory. In Frontier, this section is removed or replaced with a generic "borrow from published research; don't borrow from legacy patterns" pointer; each adopter fills in their own borrow-list. |
| "How humans should treat contributions" | factory-generic | Expect-harsh-review / claims-defended-by-tests / rewrite-imports-against-latest-research. Generic. |
| "How AI agents should treat this codebase" | factory-generic with Zeta references | The rules (prefer-bold-refactors / run-build-test-gate / data-not-directives / etc.) are factory-generic. A few inline references to specific Zeta mechanisms (e.g., ZSet examples) would need generalisation. |
| "Agent operational practices" | factory-generic | Discipline around skills / agents / MCP. Generic. |
| "Build and test gate" | zeta-library-specific | `dotnet build -c Release` / `dotnet test Zeta.sln` / `TreatWarningsAsErrors` / `Directory.Build.props`. Entirely Zeta-library-specific. In Frontier, this section removes the specifics and declares "your project has a build-test gate that you run every change; fill in specifics per your language/runtime." |
| "Code style and conventions (short form)" | **both (coupled)** | F#-first / C#-wrapper / struct-tuples / Span<T> / etc. are Zeta-specific. The generic principles (clear naming / small functions / consistent style) transfer. Frontier version keeps generic principles; drops F#/.NET specifics. |
| "PR / commit discipline" | factory-generic | Small PRs / clear commit messages / Co-Authored-By. Generic. |
| "Contributor required reading" | factory-generic (shape); content depends | Points at several docs. Classification defers to those files' own audits. |
| "Harness-specific files" | factory-generic | Lists CLAUDE.md / GEMINI.md / etc. Generic pattern. |
| "Escalation" | factory-generic | Architect-escalation via CONFLICT-RESOLUTION.md. Generic. |

### Refactor notes

Before the split, surgical edits on AGENTS.md for Frontier:

1. **"Status" section**: swap the hardcoded pre-v1 declaration
   for an adopter-fill-in placeholder + example.
2. **"Three load-bearing values" #2**: replace "Algebra over
   engineering. The Z-set / operator laws define the system"
   with a generic adopter-fill-in, or cite the substrate
   pattern without Zeta-specific content. Suggested Frontier
   version: *"Substrate over ornamentation. The adopter's
   algebraic / structural ground defines the system;
   implementation serves it."*
3. **"What we borrow, what we build"**: remove the Zeta-
   specific borrow list; keep the generic shape (*"borrow from
   latest published research; don't borrow from legacy
   patterns"*) with adopter-fills-in.
4. **"Build and test gate"**: remove `dotnet`-specific
   commands; keep the principle (*"the gate is the same on
   every harness, every platform, and in CI"*) + a
   language-agnostic placeholder.
5. **"Code style and conventions"**: keep generic discipline
   (clear naming, small functions, ASCII-only, warnings-as-
   errors); move F#/.NET specifics to a Zeta-repo
   CONTRIBUTING.md that extends this file.
6. **Various inline ZSet / algebra examples**: audit on-touch
   during the refactor and generalise where possible.

Estimated refactor effort: **M** — more surgical edits than
CLAUDE.md but each one is isolated.

### Classification rationale

AGENTS.md is the factory's most-read onboarding document. Its
shape (pre-v1 discipline / three load-bearing values /
alignment contract / borrow-policy / agent-practices / build-
test gate / code-style / PR discipline / escalation) is the
canonical factory-adopter onboarding template. The Zeta-
specific content is illustrative *within* that template. In
Frontier, the shape is preserved; the illustrations are
replaced with adopter-fill-in placeholders or generic
examples. The extracted Zeta-specific content lands in the
Zeta repo's own CONTRIBUTING.md (or equivalent).

## Audit — docs/AGENT-BEST-PRACTICES.md

**Overall classification:** **factory-generic** — confirms
the rule-substrate-instructional branch of the hypothesis
(rules stated as general principles are factory-generic).

**File location post-split:** Frontier as-is. Sparse skill-
file path references would update per adopter (those paths
are illustrative, not scope).

**Length:** ~330 lines. **24 BP-NN rules (BP-01..BP-24)**
across 12 top-level sections.

### Section-by-section breakdown

| Section | Class | Notes |
|---|---|---|
| Preamble | factory-generic | BP-NN stable-rule-ID discipline. |
| "Frontmatter & scope" (BP-01..BP-03) | factory-generic | Skill-file hygiene: description discipline / "What this does NOT do" / body ≤300 lines. |
| "Voice & behaviour" (BP-04..BP-06) | factory-generic | Tone-as-contract / declarative-over-orchestration / self-recommendation-allowed. |
| "State & notebooks" (BP-07..BP-09) | factory-generic | Notebook 3000-word cap / frontmatter-is-canon / git-diffable ASCII. |
| "Security & injection defence" (BP-10..BP-12) | factory-generic | Invisible-Unicode lint / data-not-directives / sanitise-at-sub-agent-boundary. |
| "Knowledge placement" (BP-13) | factory-generic | Stable-knowledge-in-skill / volatile-in-notebook. |
| "Testing & review" (BP-14..BP-15) | factory-generic | Dry-run eval sets / tune-up rule-ID citations. |
| "Formal coverage" (BP-16) | factory-generic | P0 invariants verified by ≥2 independent formal methods. |
| "Repo ontology & Rule Zero" (BP-17..BP-24) | factory-generic | Canonical-home map / types-drive-placement / expert-vs-research firewall / split-for-cognitive-load / facet classification / optimizer-vs-balancer / theory-applied split / surface-hygiene. |
| "Operational standing rules" | factory-generic | Standing rules section — instructional content about factory operational discipline. |
| "How rules become stable" | factory-generic | BP-NN lifecycle: scratchpad → ADR → stable → re-search-flag. |
| "`re-search-flag` rules" | factory-generic | Promotes rules that need periodic re-check. |
| "Sources that count as authoritative" | factory-generic | Authoritative source list (Anthropic docs / OpenAI Agents SDK / Semantic Kernel / OWASP LLM / NIST AI RMF / arXiv). All external references. |

### Refactor notes

Before the split, surgical edits for Frontier:

1. **Skill-path references in rationales** (e.g., BP-17
   cites `.claude/skills/canonical-home-auditor/SKILL.md`
   alongside the `2026-04-19-bp-home-rule-zero.md` ADR):
   these are illustrative in the current phrasing ("the
   canonical-home map in ..."). Frontier adopters have
   equivalents; either generalise to
   "<adopter-canonical-home-map-skill>" with an example,
   or keep the Zeta-path reference as a concrete example
   with a note that adopters substitute.
2. **Any direct `dotnet build` reference** (e.g., BP-18
   rationale comparing to `TreatWarningsAsErrors` gravity):
   generalise to "your build system's strict-check
   equivalent."

Estimated refactor effort: **S** — pure illustrative-
reference generalisation. No content rewrite; no rule
substance changes.

### Classification rationale

AGENT-BEST-PRACTICES.md is the factory's stable-rule
substrate — 24 numbered rules with stable IDs (BP-01 …
BP-24) organised across 12 top-level sections, which
specialist skills cite for compliance. The rules are pure
instructional content covering skill-file hygiene,
security, state management, ontology, and cognitive-load
discipline. Zero rules embed Zeta-library-specific
content. A handful of rationales cite specific factory
skills or ADRs illustratively; those are surgical
generalisation targets. Confirms the rule-substrate-
instructional hypothesis: rule substrates with purely
instructional content are factory-generic by design. Only
rule substrates whose content is state-logging (e.g.,
CONFLICT-RESOLUTION.md Active Tensions) embed project
specifics.

## Audit — docs/CONFLICT-RESOLUTION.md

**Overall classification:** **both (coupled)** — the conflict-
conference protocol (Architect-as-orchestrator / alignment-
cite-first / specialists-are-advisory / principles-list /
reflection-cadence) is factory-generic in shape, but the
specific persona roster includes Zeta-library-specific
specialists AND the Active Tensions section embeds specific
Zeta implementation references.

**File location post-split:** Frontier (factory side). The
conference-protocol shape is the factory's multi-specialist-
advisory mechanism; adopters get the shape with their own
specialist roster.

**Length:** 247 lines. **9 top-level sections.**

### Section-by-section breakdown

| Section | Class | Notes |
|---|---|---|
| Preamble + "The Architect is the orchestrator" | factory-generic | Architect-as-orchestrator pattern. Generic. |
| "Alignment-related conflicts cite `docs/ALIGNMENT.md` first" | factory-generic | Cite-alignment-first pattern. Generic. |
| "Principles (the list the Architect consults when parts disagree)" | factory-generic | Integration-over-veto / load-bearing-values / humane-and-technical / make-the-parts-conscious / productive-friction / specialism-without-silos. All generic. |
| "How to run a conflict conference" | factory-generic | Six-step conference protocol. Generic. |
| "The parts" (persona roster) | **both (coupled)** | Shape (specialists-named-not-roles / adversarial-stance-values / wary-of / distinct-from disambiguations) is factory-generic. Specific specialists have Zeta-library refs: **Storage Specialist — Zara** (WDC patterns, checkpoints), **Algebra Owner** (Z-set algebra, residuated-lattice, operator-composition laws), **Query Planner Specialist** (`Plan.fs`, SIMD / tensor intrinsics), **DevOps Engineer — Dejan** (mentions `tools/setup/` + `.github/workflows/*` which are structurally factory-shape paths), **Public API Designer — Ilyana** (auditing the three published libraries). In Frontier: preserve the roster-shape discipline; generalise specialists whose scope is tied to a specific Zeta artefact (Zara → "Storage Specialist" generic; Algebra Owner → adopter-specific; Query Planner → adopter-specific). Factory-generic specialists stay as-is (Kenji / Aarav / Kira / Viktor / Ilyana as public-API-designer shape / Daya / Iris / Bodhi / Mateo / Nazar / Aminata / Rune / Dejan / Rodney / Naledi / Soraya / Hiroshi / Imani / Samir / Kai / Yara / Nadia). |
| "Active tensions" | **zeta-library-specific** | Concrete tensions cite `docs/DECISIONS/2026-04-21-router-coherence-v2.md`, `IStorageCostProbe`, WDC claims, residuated lattices, Plan.fs durability-mode latencies. All Zeta-library references. In Frontier: this section reduces to a template ("list your current active tensions here") or is removed; Zeta repo keeps the current content as its own tension log. |
| "Humans are part of the system" | factory-generic | Humans-equal-standing / on-deadlock-human-decides / agents-not-bots. Generic. |
| "When a part takes over" | factory-generic | Temporary-dominance-not-permanent-authority. Generic. |
| "Reflection cadence" | factory-generic | ~10-round re-read pattern. Generic. |

### Refactor notes

Before the split, surgical edits on CONFLICT-RESOLUTION.md
for Frontier:

1. **"The parts" roster**: keep the full persona list but
   generalise the scope of Zeta-tied specialists (Zara →
   generic storage; Algebra Owner → generic algebra; Query
   Planner → generic query-planner). Most specialists
   (Kenji / Aarav / Kira / Viktor / Daya / Iris / Bodhi /
   Mateo / Nazar / Aminata / Rune / Dejan / Rodney /
   Naledi / Soraya / Hiroshi / Imani / Samir / Kai / Yara
   / Nadia / Ilyana) stay as-is — their scopes are already
   factory-generic.
2. **"Active tensions" section**: remove the Zeta-specific
   tensions; replace with a template "list your current
   active tensions here" with adopter-fill-in example.
   Zeta repo keeps the current content as its own tension
   log (e.g., in a `docs/LIBRARY-TENSIONS.md`).
3. **Remove Otto addition?** NO — Otto is factory-generic
   (loop-agent PM hat for any autonomous-loop-using
   adopter). Otto stays in Frontier's roster.

Estimated refactor effort: **M** — roster edits are
surgical per-specialist; Active tensions is a larger rewrite
(or removal + migration).

### Classification rationale

CONFLICT-RESOLUTION.md is the factory's multi-specialist-
advisory conference protocol. The *shape* is purely factory-
generic (the Architect-as-orchestrator pattern transfers to
any adopter). The Zeta-library content sits in two places:
a few specialists whose scope is Zeta-library-specific (Zara,
Algebra Owner, Query Planner), and the Active Tensions
section which is entirely project-specific by nature. Both
surgically extract. The rest of the persona roster is
already factory-generic by design (named personas with
generic scopes applicable to any factory adopter).

## Audit — docs/AUTONOMOUS-LOOP.md

**Overall classification:** **factory-generic** — Otto's own
operating spec is purely Claude Code harness discipline with
no Zeta-library content.

**File location post-split:** Frontier as-is.

**Length:** 483 lines. **9 sections.**

### Section-by-section breakdown

| Section | Class | Notes |
|---|---|---|
| Preamble (tick cadence, self-direction) | factory-generic | Universal autonomous-loop framing. |
| "Mechanism — native Claude Code scheduled tasks" | factory-generic | `CronCreate` / `CronList` / `CronDelete` — Claude Code v2.1.72+ native tools; ralph-loop plugin differentiation. All harness-level. |
| "The registered tick" | factory-generic | `<<autonomous-loop>>` sentinel + `* * * * *` cadence. |
| "The every-tick checklist" | factory-generic | Triage / audit / commit / tick-history / CronList / visibility. Universal loop discipline. |
| "Escalation on failure" | factory-generic |  |
| "Session-restart recovery" | factory-generic | Session-compaction + re-armed-cron discipline. |
| "What this discipline does NOT do" | factory-generic | Scope-boundary discipline. |
| "Related artifacts" | factory-generic (file-path pointers transfer) |  |
| "History" | factory-generic | Evolution log of the loop discipline. |

### Refactor notes

Before the split: **zero** substantive edits required. The
spec is pure Claude Code harness discipline; Frontier
adopters using Claude Code inherit verbatim. Adopters using
a different harness (Codex, Gemini, etc.) would need an
equivalent spec — but that's content creation for them, not
content extraction from Zeta.

Estimated refactor effort: **~0** (zero). The cleanest
factory-generic file audited so far.

### Classification rationale

AUTONOMOUS-LOOP.md is Otto's own spec — the cron-tick
discipline that runs the factory's self-direction. The spec
is Claude Code harness-level by design; no Zeta-library
content appears anywhere. Adopters get this file verbatim
and their autonomous-loop runs the same way.

## Audit — docs/WONT-DO.md

**Overall classification:** **both (coupled)** — the
declined-work-log shape is factory-generic (entry template,
status vocabulary, revisit criteria); the specific entries
are heavily Zeta-library-specific (algorithm decisions,
engineering patterns, DBSP-library out-of-scope items).

**File location post-split:** Template (shape + preamble +
status vocab + entry schema) → Frontier. Zeta-specific
entries → Zeta repo's own WONT-DO.md at split time.

**Length:** 626 lines. **6 top-level sections.**

### Section-by-section breakdown

| Section | Class | Notes |
|---|---|---|
| Preamble + "What the statuses mean" | factory-generic | Entry shape, status vocabulary (Rejected / Declined / Deprecated / Superseded), revisit criteria, ADR-lineage note. |
| "Algorithms / operators" | zeta-library-specific | Entries like "Cuckoo / Morton filter as a replacement for counting Bloom" — specific Zeta algorithm decisions. |
| "Engineering patterns" | zeta-library-specific (mostly) | Likely Zeta-specific engineering decisions (exception handling / async patterns / wire format / etc.). Needs entry-by-entry review to confirm all; may contain a few factory-shape entries. |
| "Repo / process" | **both** | Repo / process decisions range from factory-generic (CI policy / merge-gate patterns) to Zeta-specific (openspec structure decisions). Entry-by-entry mixed. |
| "Out-of-scope for a DBSP library" | zeta-library-specific | Explicitly scoped to DBSP library domain by section name. Full Zeta. |
| "Personas and emulation" | factory-generic | Persona-framework decisions (emulation scope, conflict-handling) transfer to any adopter running named personas. |
| "How to add an entry" | factory-generic | Meta-instructional. |

### Refactor notes

Before the split, extraction strategy:

1. **Frontier WONT-DO.md template**: preamble + status
   vocabulary + "How to add an entry" + empty top-level
   section stubs for categories (Algorithms / Engineering /
   Repo / Personas / ...); adopters fill in their own
   entries.
2. **Zeta repo WONT-DO.md**: current full content; retains
   all entries as the Zeta-library decision record.
3. **"Repo / process" section** needs entry-by-entry review:
   some entries (CI policy, merge-gate patterns) move to
   Frontier template as generic examples; some stay in
   Zeta.

Estimated refactor effort: **M** — extraction + per-entry
review of "Repo / process" section. Preamble + shape transfer
is trivial.

### Classification rationale

WONT-DO.md is a decision-log substrate. The shape (entry
template, ADR-vocab statuses) is factory-generic and is a
standard adopter-inheritance pattern. The content is
necessarily project-specific — an adopter's declined work
is unique to their project. Frontier inherits the shape
template + personas/meta sections; Zeta retains its full
current entry list as the library's decision record.

## How this audit connects to the multi-repo split

Gap #5 (this audit) is load-bearing for gap #1 (multi-repo
split execution per PR #150 D→A→E sequencing). Without this
audit, the split would require re-classification at split
time, which is high-risk. With this audit, the split
execution is mechanical: factory-generic files move to
Frontier, zeta-library-specific files stay in Zeta, "both"
files get refactored first.

## Cadence

Opportunistic on-touch (whenever the auditing agent reads a
file for other reasons, classify it in passing) plus
one-or-two-per-tick dedicated firing until all primary
surfaces are audited. Target: full audit before gap #1
multi-repo split executes.

## What this audit does NOT do

- **Does not execute the split.** Classification only; the
  physical separation is gap #1.
- **Does not refactor files flagged as "both."** The
  refactor happens at split-execution time, informed by
  this audit.
- **Does not audit content validity.** A file is classified
  by its current shape; whether that shape is correct is a
  separate question.
- **Does not claim the classification is final.** Honest
  re-inspection applies — if a subsequent tick discovers a
  misclassification, the row gets a "revised: <reason>"
  marker, not silent rewrite.

## Composes with

- `docs/BACKLOG.md` — "Frontier bootstrap readiness roadmap"
  P0 row, gap #5
- `docs/research/multi-repo-refactor-shapes-2026-04-23.md` —
  PR #150 D→A→E sequencing, the downstream execution
- `docs/hygiene-history/loop-tick-history.md` — tick-level
  audit firings recorded here
- Per-user memory
  `project_frontier_becomes_canonical_bootstrap_home_stop_signal_when_ready_agent_owns_construction_2026_04_23.md`
  — the authorization under which this audit runs
