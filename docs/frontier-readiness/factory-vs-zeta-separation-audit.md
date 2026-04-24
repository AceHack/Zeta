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
- **AGENTS.md** (below, fire #9)
- **GOVERNANCE.md** (below, fire #10)
- **docs/CONFLICT-RESOLUTION.md** (below, fire #12)
- **docs/AGENT-BEST-PRACTICES.md** (below, fire #13)
- **docs/ALIGNMENT.md** (below, fire #14)
- **docs/AUTONOMOUS-LOOP.md** (below, fire #15)
- **docs/WONT-DO.md** (below, fire #15) — also docs/ALIGNMENT.md on PR #185
- **docs/TECH-RADAR.md** (below, fire #16)
- **docs/FACTORY-HYGIENE.md** (below, fire #16) — also docs/AGENT-BEST-PRACTICES.md on PR #184, docs/ALIGNMENT.md on PR #185
- **docs/GLOSSARY.md** (below, Otto-18 fire)
- **docs/ROUND-HISTORY.md** (below, Otto-18 fire)
- **docs/BACKLOG.md** (below, Otto-18 fire)
- **docs/ROADMAP.md** (below, Otto-18 fire)
- **docs/VISION.md** (below, Otto-18 fire) — also GOVERNANCE.md on PR #181, AGENT-BEST-PRACTICES.md on PR #184, ALIGNMENT.md on PR #185, TECH-RADAR.md + FACTORY-HYGIENE.md on PR #188

Cross-PR audits that duplicate in-file coverage: GOVERNANCE (also on PR #181), AGENT-BEST-PRACTICES (also on PR #184), ALIGNMENT (also on PR #185), TECH-RADAR + FACTORY-HYGIENE (PR #188, now merged and recorded in-file) — the in-file `## Audit —` sections are the authoritative classification.

### Files to audit (not yet classified; add rows as they land)

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

## Audit — GOVERNANCE.md

**Overall classification:** **factory-generic** (with three
rules needing surgical adopter-specific notes). Breaks the
both-coupled pattern seen in CLAUDE.md + AGENTS.md —
GOVERNANCE.md is the rule substrate that is uniformly
factory-shape.

**File location post-split:** Frontier as-is; no content
extraction needed. Three rules get adopter-specific tweaks
via inline placeholder rather than removal.

**Length:** 746 lines. **32 numbered rules.**

### Rule-by-rule classification

Rules classified factory-generic unless otherwise noted.

| Rule | Title | Class | Notes |
|---|---|---|---|
| §1 | Architect is the integration authority | factory-generic |  |
| §2 | Docs read as current state, not history | factory-generic |  |
| §3 | Contributors are agents, not bots | factory-generic |  |
| §4 | Skills created through `skill-creator` | factory-generic |  |
| §5 | Prompt-injection corpora are radioactive | factory-generic |  |
| §6 | Round naming stays in history log | factory-generic |  |
| §7 | Shared vocabulary, round-table enforcement | factory-generic |  |
| §8 | Bug fixes go through the Architect | factory-generic |  |
| §9 | `docs/BUGS.md` is the running known-open log | factory-generic | File name is universal template. |
| §10 | The table is round | factory-generic |  |
| §11 | Debt-intentionality is the invariant | factory-generic |  |
| §12 | Bugs before features, explicit ratio | factory-generic |  |
| §13 | Reviewer count scales inversely with backlog | factory-generic |  |
| §14 | Standing off-time budget per persona | factory-generic |  |
| §15 | Reversible-in-one-round | factory-generic |  |
| §16 | Dynamic hats | factory-generic |  |
| §17 | Productive friction between personas | factory-generic |  |
| §18 | Agent memories are the most valuable resource | factory-generic |  |
| §19 | Public API changes go through the public-api-designer | **both** | Shape (public-API review gate) is generic. Specific libraries (`Zeta.Core` / `Zeta.Core.CSharp` / `Zeta.Bayesian`) are Zeta-specific. In Frontier: keep shape, adopter fills in their own published-library list. |
| §20 | Standing reviewer cadence per round | factory-generic |  |
| §21 | Per-persona memory is real persona-scoped | factory-generic |  |
| §22 | `~/.claude/projects/` is Claude Code harness | factory-generic | Claude-Code-specific but harness-shape; Frontier adopters using different harnesses substitute their equivalent path. |
| §23 | Upstream open-source contributions encouraged | factory-generic |  |
| §24 | Dev setup / build-machine / devcontainer | **both** | The one-install-script-consumed-three-ways pattern is generic. Zeta-specific install content (F#/.NET tooling) needs substitution per adopter. Frontier template + adopter-substitutes. |
| §25 | Upstream temporary-pin expiry | factory-generic |  |
| §26 | Research-doc lifecycle | factory-generic |  |
| §27 | Abstraction layers — skills, roles, personas | factory-generic |  |
| §28 | OpenSpec is first-class | **both** | OpenSpec adoption pattern is generic. Specific `openspec/specs/**` capability list is Zeta-specific. Frontier: keep pattern, adopter fills in capabilities. |
| §29 | Backlog files are scoped | factory-generic | Multi-backlog shape (HUMAN-BACKLOG vs BACKLOG) is generic. The specific files `docs/BACKLOG.md` + `docs/HUMAN-BACKLOG.md` are named canonically; adopters keep names. |
| §30 | Cross-repo `sweep-refs` after rename campaign | factory-generic |  |
| §31 | Copilot instructions are factory-managed | factory-generic |  |
| §32 | Alignment contract is `docs/ALIGNMENT.md` | factory-generic | The alignment-contract pattern is generic; `docs/ALIGNMENT.md` content itself gets audited separately (likely factory-generic with adopter-specific clauses). |

### Refactor notes

Before the split, surgical-only edits on GOVERNANCE.md for
Frontier (three rules with Zeta-specific content; §22 is
Claude-Code-harness-shape rather than Zeta-library-specific
and is called out separately):

1. **§19 (public API review)**: generalise the specific
   library list (`Zeta.Core` / `Zeta.Core.CSharp` /
   `Zeta.Bayesian`) to `<adopter-published-libraries>`
   placeholder with fill-in example.
2. **§24 (dev setup)**: move Zeta-specific install steps to
   `tools/setup/` README; keep the one-install-script-
   consumed-three-ways pattern in §24 generic.
3. **§28 (OpenSpec first-class)**: generalise specific
   `openspec/specs/**` Zeta-capability references; keep the
   OpenSpec adoption pattern.

Additionally for §22 (`~/.claude/projects/` path): clarify
the path is Claude-Code-specific and provide equivalent-paths
for other harnesses (Codex, Gemini, Copilot) OR name the
harness substrate without hardcoding. This is harness-shape
adaptation rather than Zeta-library-content extraction.

Estimated refactor effort: **S** — three small inline edits
plus one harness-path clarification, no structural change.

### Classification rationale

GOVERNANCE.md is the factory's rule substrate — "numbered
repo-wide rules for humans and agents." By design, rules are
abstract patterns that shape behaviour rather than enforce
project-specifics. The three rules with Zeta-library-specific
content (§19 / §24 / §28) all preserve the abstract shape
(public-API review, install-script pattern, OpenSpec adoption)
and only reference specific Zeta files / libraries as
illustrative examples. §29 is factory-generic: the
multi-backlog shape is the pattern, and the canonical
filenames `docs/BACKLOG.md` + `docs/HUMAN-BACKLOG.md` carry
across to adopters unchanged. Frontier inherits the rules
verbatim; adopters substitute their specifics on the three
flagged rules.

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

## Audit — docs/ALIGNMENT.md

**Overall classification:** **both (coupled)** — mostly
factory-generic, with narrow adopter-specific + both-coupled
rows. The alignment contract between human maintainer and
agents is structurally instructional and transfers wholesale
to any factory adopter, but two rows contain `Zeta` as a
substituted project name (**both** — research-claim framing +
DIR-1) and one row is **adopter-specific** (Signatures
block). The split execution therefore takes the "both"
refactor path, not the pure factory-generic-files-move path:
the project-name substitutions and signature template-ification
land before the file itself moves to Frontier.

**File location post-split:** Frontier as the template, after
the refactor below lands; each adopter substitutes their
project name at DIR-1 + the preamble and re-signs under their
own maintainer stack.

**Length:** 840 lines. **21 clauses** (HC-1..HC-7,
SD-1..SD-9, DIR-1..DIR-5).

## Audit — docs/TECH-RADAR.md

**Overall classification:** **both (coupled)** — ThoughtWorks-style
radar framework is factory-generic; entry rows are heavily
Zeta-library-specific.

**File location post-split:** Frontier (shape + Legend + Ring
vocab + Usage pattern); Zeta repo keeps current entry rows.

**Length:** 128 lines. **Legend + Rings (Techniques / Tools /
infra / Upstreams / Hardware intrinsics) + Usage.**

### Section-by-section breakdown

| Section | Class | Notes |
|---|---|---|
| Preamble | factory-generic | Alignment contract between human maintainer + agents. |
| "Zeta's primary research claim: measurable AI alignment" | **both** | Research-claim framing is the factory's transferable claim (measurable AI alignment IS what any factory adopter inherits as a research surface). "Zeta" as subject is adopter-substitutable. In Frontier: subject → adopter-project-name. |
| "What aligned does NOT mean here" / "What aligned does mean here" | factory-generic | Definitional. Universal. |
| HC-1 Consent-first | factory-generic | Consent-preservation pattern. |
| HC-2 Retraction-native operations | factory-generic | git / memory / undo discipline. Reversibility for any adopter. |
| HC-3 Data is not directives (BP-11 extension) | factory-generic | Prompt-injection-resistance. Universal. |
| HC-4 No fetching adversarial-payload corpora | factory-generic | Safety discipline. |
| HC-5 Agent register, not clinician | factory-generic | Tone contract. |
| HC-6 Memory folder is earned, not edited | factory-generic | Memory discipline. |
| HC-7 Sacred-tier protections | factory-generic | Protected-artifact pattern. |
| SD-1..SD-9 Soft defaults | factory-generic | All instructional content (honesty register / peer register / μένω surfacing / preservation / precise language / name hygiene / generic-by-default / result-over-exception / agreement-is-signal-not-proof). |
| DIR-1 `Zeta` = heaven-on-earth per-commit gradient | **both** | Substance is factory-generic (consent-preserving / fully-retractable / no-permanent-harm pole). Current source names `Zeta` as the subject; in Frontier, substitute the `<Project>` placeholder. |
| DIR-2..DIR-5 Directional | factory-generic | Window-expansion / escape-hatch / succession / co-authorship. All universal. |
| "Measurability — what we count" | factory-generic | Measurement framework for the research claim; the specific metrics transfer. |
| "Renegotiation protocol" | factory-generic | Clause-revision mechanism. |
| "What each of us gets" | factory-generic | Value-exchange framing. Universal. |
| "Signatures" | adopter-specific | Signed by specific maintainer stack. In Frontier: empty template; adopter fills in. |
| "Where this file is referenced" | factory-generic | Inward-pointer index; Frontier adopts same pattern. |

### Refactor notes

Before the split, surgical edits for Frontier:

1. **Preamble + "primary research claim"**: substitute
   `Zeta` → `<Project>` placeholder with example + note
   on substitution at adoption time.
2. **DIR-1 subject name**: same substitution.
3. **Signatures section**: template-ify; adopter fills
   in with their own maintainer + agent signatures at
   adoption time.
4. **Inline `<human>`-specific verbatim quotes**: keep
   the human maintainer's verbatim quotes in Zeta repo's
   alignment contract as attribution anchors; Frontier
   template references "adopter's direct verbatim
   statements" as the pattern.

Estimated refactor effort: **S** — simple substitution +
template-ify signatures section.

### Classification rationale

ALIGNMENT.md is the factory's alignment-contract substrate.
21 clauses are all structurally instructional (hard
constraints / soft defaults / directional aims). Substance
transfers to any factory adopter; only the project name +
signatures + a few verbatim-quote attributions are adopter-
specific. Confirms the rule-substrate-instructional
hypothesis: instructional rule substrates are structurally
factory-generic by design. The overall class is **both
(coupled)** because the narrow substitutions (project-name
`both` rows + adopter-specific Signatures row) route the
file through the "both" refactor path at split time — not
because the substance is non-generic.

### Section-by-section breakdown — TECH-RADAR.md

| Section | Class | Notes |
|---|---|---|
| Preamble | factory-generic | ThoughtWorks radar attribution. |
| Legend (Adopt / Trial / Assess / Hold) | factory-generic | Standard ring vocabulary. |
| Rings — Techniques table | zeta-library-specific | ~30 rows: DBSP algebra / Z-sets / semi-naive LFP / Bloom / FastCDC / residuated lattices / etc. All Zeta-library technical decisions. |
| Rings — Tools / infra table | **both** | Tooling decisions: some Zeta-specific (NuGet, F# tooling), some factory-generic (CI, auto-merge). Mixed per-row. |
| Rings — Upstreams / prior art | zeta-library-specific | Prior-art and upstream references for the library's technical direction; part of Zeta's research and implementation context, not factory substrate. |
| Rings — Hardware intrinsics / platform | zeta-library-specific | Platform / hardware-sensitive implementation concerns belong with DBSP library performance/runtime choices, not the generic factory. |
| Usage | factory-generic | How to add a row, ring-motion protocol. |

### Refactor notes — TECH-RADAR.md

Before split:

1. Frontier inherits Legend + Usage + empty Rings table
   stubs for all current Rings sections (Techniques,
   Tools / infra, Upstreams / prior art, Hardware
   intrinsics / platform).
2. Zeta retains full current entry rows as the library's
   technology-research record.
3. Tools/infra section has mixed entries — **copy** (do
   not move) factory-generic entries to Frontier as
   examples. Canonical ownership of each carried row is
   **Frontier** (the factory-generic example ring),
   with Zeta's Tools/infra table as a decision record
   that may reference them. No row is removed from
   Zeta during split; duplication is intentional so
   Zeta's historical radar record stays complete.

Effort: **S** — mostly extraction; shape transfer is trivial.

### Classification rationale — TECH-RADAR.md

TECH-RADAR.md is a research-tracking substrate. Shape is
Universal (ThoughtWorks pattern is explicit); adopters fork
the shape and fill in their own research. The Zeta-specific
content is exactly what makes the radar useful for Zeta; in
Frontier, adopters get the shape to fill with their own
content.

## Audit — docs/FACTORY-HYGIENE.md

**Overall classification:** **both (coupled)** — the file
is the factory's meta-hygiene substrate (factory-generic
shape), but the per-row Scope column already tags rows as
`project` / `factory` / `both`, meaning execution of the
split is not a whole-file move. Classifying as
`factory-generic` + "Frontier as-is" would drop
project-scoped hygiene rows out of Zeta at split time.

**File location post-split:** Frontier keeps the canonical
`FACTORY-HYGIENE.md` intact as the factory's meta-hygiene
substrate; Zeta derives a project-specific hygiene doc by
filtering rows whose Scope is `project` or `both`. The
split is asymmetric (derivation, not duplication).

**Length:** 206 lines + the Scope column's inline
classification per row (already done by gap #8 discovery:
gap #8 in the Frontier readiness roadmap was closed on
re-inspection because this file self-classifies).

### Meta-audit insight

FACTORY-HYGIENE.md's Scope column IS the factory-vs-Zeta
separation manifest, but the intended post-split shape is
asymmetric:

- Frontier keeps the canonical `FACTORY-HYGIENE.md` intact
  as the factory's meta-hygiene substrate
- Zeta derives its own project-specific hygiene doc from
  the rows whose Scope is `project` or `both`
- Rows marked `both` remain canonical in Frontier and are
  mirrored into the derived Zeta doc with surgical
  cross-references where needed

The "Ships to project-under-construction" section is a
Frontier-side projection over the canonical table: the
adopter subset that ships with Frontier adoption.

### Refactor notes — FACTORY-HYGIENE.md

Trivial. The file's own Scope column is the split manifest:

1. Keep `FACTORY-HYGIENE.md` in Frontier as the canonical
   source of truth; do not split the main table into peer
   Frontier-vs-Zeta copies
2. Derive Zeta's project-specific hygiene doc by filtering
   rows where Scope = `project` or `both`
3. Preserve the "Ships to project-under-construction"
   projection in Frontier only, because it is a projection
   over the canonical table rather than part of the
   derived Zeta doc

Effort: **S** — mechanical derivation using the existing
Scope column.

### Classification rationale — FACTORY-HYGIENE.md

FACTORY-HYGIENE.md is the factory's meta-hygiene substrate,
by construction. Every row already declares its scope, so
split execution reads directly off the Scope column
without re-classification: Frontier keeps the canonical
file, and Zeta receives a derived project-facing hygiene
doc. This file is the gold standard for how rule
substrates should be designed from the start —
self-classifying, no retrofit audit needed. Confirms
gap #8's closure: the hypothesis "hygiene rows not
tagged" was wrong; the rows were all tagged. This
audit formalises that self-classification as the
file's purpose.

## Audit — docs/GLOSSARY.md

**Overall classification:** **both (coupled)** — plain-
English/technical format is factory-generic; specific Zeta
term entries (IVM, DBSP, Z-set, retraction, Spine, etc.)
are Zeta-library-specific content.

**File location post-split:** Frontier (format + preamble
plus the-rule-for-this-file and "spec has two meanings"
framing pattern); Zeta retains specific term entries.

**Length:** approximately 840 lines. Large vocabulary.

### Classification

- **Format** (plain/technical dual-definition, grandparent-
  comprehensibility rule, two-meanings disambiguation): factory-generic
- **Entries** (IVM, DBSP, Z-set, retraction, operator algebra,
  Spine, HyperLogLog, etc.): zeta-library-specific

### Refactor notes

1. Frontier inherits preamble + format rule + empty-section
   scaffolding
2. Zeta retains all current term entries as library
   glossary
3. Adopters populate their own glossary per the format

Effort: **S** — shape extraction; entries stay in Zeta.

## Audit — docs/ROUND-HISTORY.md

**Overall classification:** **zeta-library-specific** — by
design this file is historical narrative of Zeta's specific
rounds. The separation between round-history narrative here
and current-state documentation elsewhere is factory-generic
in shape (the file's own preamble is the authoritative
source for the newest-first / append-only convention), but
this file's content is purely Zeta project history.

**File location post-split:** Zeta repo retains as-is
(historical record); Frontier gets empty template with
preamble + append-only rule as an adopter template.

**Length:** approximately 3560 lines — large history.

### Refactor notes

1. Frontier inherits preamble + "newest first" convention +
   empty Contents section as template
2. Zeta retains full round-history as historical record
3. Adopters start their own ROUND-HISTORY.md at round 1

Effort: **S** (shape extraction).

## Audit — docs/BACKLOG.md

**Overall classification:** **zeta-library-specific** — the
file contains thousands of lines of specific-project BACKLOG rows
(P0/P1/P2/P3). The *shape* (priority tiers, one-row-per-item,
newest-first-within-tier, legend + appendix) is factory-
generic (GOVERNANCE §29 scopes the file).

**File location post-split:** Zeta retains as-is; Frontier
gets empty template with preamble + priority-tier legend +
example-row framework.

**Length:** approximately 8500 lines (size grows tick-by-tick; see BACKLOG split design doc for the per-row-file migration).

### Refactor notes

1. Frontier inherits preamble + legend + empty priority
   sections as template
2. Zeta retains full BACKLOG content
3. Adopters populate their own BACKLOG from empty template

Note: the Frontier readiness P0 row itself is partly
factory-generic (the gap-8-audit pattern is reusable)
but instance-specific to Zeta's own Frontier construction.
On split, the Frontier-bootstrap row gets an "executed"
marker and moves to Frontier's own ROUND-HISTORY as
historical-record of the split.

Effort: **S** (shape extraction).

## Audit — docs/ROADMAP.md

**Overall classification:** **zeta-library-specific** —
roadmap is by definition project-specific. Shape (P0/P1/P2
tiers + Research category + newest-first) is factory-
generic (effectively same shape as BACKLOG; a "roadmap vs
backlog" sibling-scope convention).

**File location post-split:** Zeta retains; Frontier gets
empty template.

**Length:** approximately 178 lines.

Effort: **S**.

## Audit — docs/VISION.md

**Overall classification:** **zeta-library-specific** — the
long-term vision document is by definition project-specific
(named after Zeta; 11 passes of human-maintainer editing
history). Shape (Dedication header + foundational principle +
Products numbered + Product-N vision subsections) is
factory-generic pattern.

**File location post-split:** Zeta retains as-is (preserves
the human-maintainer 11-pass editorial lineage plus the
in-memoriam dedication header; the dedication names a
specific person and stays per the "honor those that came
before" discipline in CLAUDE.md);
Frontier gets empty template with the shape.

**Length:** approximately 887 lines.

Effort: **S**.

## Pattern summary after 15 audits

| Class | Count | Files |
|---|---|---|
| factory-generic | 4 | GOVERNANCE, AGENT-BEST-PRACTICES, AUTONOMOUS-LOOP, FACTORY-HYGIENE |
| both (coupled) | 7 | CLAUDE, AGENTS, CONFLICT-RESOLUTION, WONT-DO, TECH-RADAR, GLOSSARY, ALIGNMENT |
| zeta-library-specific | 4 | ROUND-HISTORY, BACKLOG, ROADMAP, VISION |

Total: 4 + 7 + 4 = **15** top-level files audited out of
~16. Remaining: the `.claude/skills/**`, `.claude/agents/**`,
`openspec/**`, `tools/**`, and `.github/**` directory-level
surfaces (each a multi-file audit).

**Mechanical-verification status:** all 15 audits now have
dedicated `## Audit —` sections in this file (TECH-RADAR +
FACTORY-HYGIENE merged in via PR #188; ALIGNMENT in-file is
authoritative per its own `## Audit —` section above which
classifies it as **both (coupled)**, not factory-generic). A
reader can `grep '^## Audit —'` this file and reproduce the
15-count directly. The deeper "each file-level summary should
be mechanically consistent with its own in-file sections"
discipline is tracked in `docs/BACKLOG.md` row
*"Separation-audit cross-PR rollup — mechanically verify
pattern-summary counts against in-file `## Audit — ...`
sections"* — the residual concern is now tooling (option c:
automated diff check), since the wait-for-merge option (a)
has resolved itself.

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
