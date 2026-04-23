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

- **CLAUDE.md** (below, this seed fire)
- **AGENTS.md** (below, Otto-9 fire)

### Files to audit (not yet classified; add rows as they land)

- `GOVERNANCE.md`
- `docs/ALIGNMENT.md`
- `docs/CONFLICT-RESOLUTION.md`
- `docs/AGENT-BEST-PRACTICES.md`
- `docs/GLOSSARY.md`
- `docs/WONT-DO.md`
- `docs/AUTONOMOUS-LOOP.md`
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
