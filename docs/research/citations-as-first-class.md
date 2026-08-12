# Citations as a first-class concept — research report 2026-04-20

> **Commissioned by Aaron before bed, 2026-04-20.** Quoted,
> in order:
>
> 1. *"first class feature of source or ace our package
>    manager ../scratch parity converts the vibe-citation
>    into an auditable inheritance graph"*
> 2. *"citations is really the feature"*
> 3. *"sorry inheritance graph is awesome too I was just
>    saying concepts are the feature, then we have the
>    implementation"*
> 4. *"i think that will help us 'remember' to keep things
>    clean and audit more easy, you are going research and
>    tell me"*
>
> Phase 5 deliverable of the BACKLOG entry
> "Citations-as-first-class concept — research commission".
> Phases 1-4 (prior-art scan, Zeta inventory, shape design,
> home selection) are compressed below into first-pass
> conclusions; each phase gets a subsequent round to deepen.

## 1. The concept — "citations are data"

Today, every cross-reference in the Zeta factory lives in
prose. When `docs/BACKLOG.md` says *"see also
`project_zeta_as_database_bcl_microkernel_plus_plugins.md`"*,
when a skill body says *"this skill pairs with
`skill-creator`"*, when a round-history entry says *"closes
the concern raised in round 32"*, when a memory file cites
another memory file by name — these are **vibe-citations**:
legible to a human reader, opaque to any tool.

The concept Aaron elevated on 2026-04-20 is that **every
such cross-reference is a citation with structure**, and
making those citations queryable (rather than prose-only)
is the feature. The inheritance graph, the drift-checker,
the "remember" primitive, and the lineage tracer are all
**implementations** that fall out of treating citations as
data.

Aaron's sharpening: *"concepts are the feature, then we
have the implementation"*. The concept is the load-bearing
idea; the implementations compete for budget beneath it.

### Citation shape

Every citation has four fields:

| Field | Meaning | Example |
|---|---|---|
| **Subject** | Where the citation lives | `docs/BACKLOG.md:1982` |
| **Object** | What is cited | `memory/project_vibe_citation_to_auditable_graph_first_class.md` |
| **Relation** | What kind of citation | `derived-from`, `inherits-from`, `supersedes`, `implements`, `tests`, `reviews`, `reviewed-by`, `see-also`, `contradicts`, `borrowed-pattern`, `follows-convention-of` |
| **Provenance** | When / who / which round | `commit ad472ee, round 34, Kenji` |

The subject is always a path-plus-line (or commit-hash-plus-
line) the factory can resolve. The object can be internal
(another repo artefact) or external (a paper DOI, an arXiv
version, a URL, an upstream repo at a pinned commit). The
relation is drawn from a **closed vocabulary** — open-ended
relations turn the graph back into prose.

## 2. Four implementations the concept enables

### 2.1 Auditable inheritance graph

**What it is.** Nodes = artefacts / patterns / repos;
edges = citations with relation labels. The first substrate
Aaron named was `../scratch ↔ Zeta` parity: the two repos
cite each other ethos-wise (declarative-bootstrap,
retractable-everything), and the vibe-citation deserves to
become an auditable edge set. Every `../scratch` manifest
that Zeta mirrors is a node; every Zeta file that borrows a
pattern is a node; every "inherits-from" claim becomes an
edge.

**Why it wants to be a graph.** A list says "Zeta mirrors
`../scratch`'s `@include` discipline". A graph says:
`tools/setup/manifests/min.apt` `follows-convention-of`
`../scratch/declarative/debian/apt/min.apt@<commit>`, and
the relation carries a `last-verified` date. When
`../scratch` changes, the graph surfaces every downstream
Zeta node that inherited the pattern.

**Prior art.** Academic citation graphs (OpenCitations
Index, Crossref event data), OSS dependency graphs
(Software Heritage, `deps.dev`, `sourcegraph.com/graph`),
source-code symbol-reference trackers (ctags, LSP's
`workspace/references`), knowledge-base backlinks
(Obsidian's linked references, Logseq, Roam's block
references). None of them treat *pattern inheritance* as a
first-class edge class — they treat *literal dependency*.
Zeta's contribution space is the pattern-inheritance class.

### 2.2 Drift-checker generalised from `verification-drift-auditor`

**What it is.** The factory already has
`.claude/skills/verification-drift-auditor/` — it catches
drift between papers and Lean/TLA+/Z3/FsCheck artefacts
that cite those papers. The six drift classes (name,
precondition, statement, definition, numbering, source-
decay) are **citation-agnostic**: they apply to any
citation subject/object pair, not just paper-to-proof.

**The generalisation.** Every citation in the graph carries
a "last-verified" timestamp. A drift-checker walks the
graph, re-fetches each object (internal files by git blob
hash; external by URL/DOI), diffs against the
last-verified snapshot, and classifies any mismatch into
one of the six drift classes. The existing paper↔Lean
checker becomes one router in a larger audit.

**What's already there.** `docs/research/verification-
registry.md` is the proof-of-concept — it stores rows of
`(artifact, paper, paper-statement, our-statement, last-
audit)`. Generalising the registry to every citation
relation means every BACKLOG-to-memory, memory-to-skill,
spec-to-code link becomes a verifiable row.

**What it buys.** Drift becomes a SAT problem, not a
sleuthing problem. "Does this memory still reference a
live file?" becomes `graph.verify(edge)` — either the
blob hash matches or it does not.

### 2.3 "Remember" primitive — Aaron's named prize

**What it is.** Memory today is a prose-soup of
"see-also X somewhere" lines. The `MEMORY.md` index at
`~/.claude/projects/<slug>/memory/MEMORY.md` is 94 entries
of free-text pointers. When a memory file is retired, every
other memory that cited it breaks silently.

**What the primitive does.** When a memory is written
through the "remember" primitive, it emits typed citations
(`derived-from`, `supersedes`, `reviewed-by`) into the
graph. When a memory is retired, the graph names every
dangling reference. The writer no longer has to remember
every cross-reference — the primitive tracks them.

**Aaron's claim verbatim:** *"help us 'remember' to keep
things clean and audit more easy"*. The claim is that
clean-memory discipline is proportional to citation-web
legibility. This report takes that claim as axiomatic and
designs toward it.

**What NOT to do.** Do not rewrite existing memory. The
primitive intercepts *new* memory writes and retirements;
back-filling the existing 94-entry index is a separate
round's work. Do not force structured citations into
memory-body prose — the citations live in frontmatter or
in a sidecar, not inside the narrative text. Prose stays
human.

### 2.4 Lineage tracer

**What it is.** For any artefact, produce its full citation-
ancestor set: "this skill inherits from these two skills,
which inherited from this paper, which the factory found
via this round-history entry". Same shape as DBSP retraction-
native algebra — every node is a function of its cited
inputs.

**What it's for.** When a paper gets retracted, the tracer
names every downstream artefact. When a memory file gets
renamed, the tracer names every file whose "see-also" broke.
When a GOVERNANCE §N clause is renumbered, the tracer names
every skill that cited §N.

**Composition with `verification-drift-auditor`.** The
drift-checker handles **point diffs** (did this one citation
rot?). The lineage tracer handles **transitive queries**
(given a root, what's the full dependency cone?).
Together they cover static-analysis and impact-analysis.

## 3. Zeta inventory — citations already in the factory

A first-pass enumeration of citation classes already
present, by subject type. Counts are approximate order-of-
magnitude from a round-34 repo snapshot.

| Subject type | Object type | Approx. count | Current shape |
|---|---|---|---|
| Memory file | Other memory file | ~200 | Prose `see also` / `composes with` blocks in memory body |
| BACKLOG entry | Memory / docs / skill | ~80 | Prose `Cross-references:` block |
| Skill body | Other skill | ~150 | `Reference patterns` section at skill bottom |
| Skill body | GOVERNANCE §N | ~60 | Inline `(GOVERNANCE.md §N)` |
| Skill body | BP-NN rule | ~120 | Inline `(BP-NN)` citations |
| Docs narrative | Paper / arXiv | ~40 | Inline prose |
| Verification artefact | Paper / arXiv | ~15 | Registry row in `docs/research/verification-registry.md` (the only structured subset today) |
| ADR | Other ADR | ~30 | Prose `Supersedes` / `Related` blocks |
| Round-history entry | Commit hash | ~100 | Prose reference |
| OpenSpec spec | Source file | ~50 | Prose `## Implementation` block |
| `.claude/settings.json` | Plugin | small | JSON config (structured, but narrow scope) |

**Observation.** Only one subset (verification-artefact →
paper, ~15 rows) is already structured. Everything else is
prose. The surface area for elevating prose-citations to
graph-citations is ~850-1000 rows total — large enough to
matter, small enough that a phased roll-out is tractable.

**Second observation.** The existing
`verification-drift-auditor` registry is exactly the shape
the generalised drift-checker wants. The registry schema
extends naturally: add columns for `relation` and for
internal-vs-external object type, and the same storage
pattern handles all citation classes.

## 4. Shape design (first pass)

### Storage

Three candidate storage models, ranked by implementability:

1. **Sidecar plaintext files** (`*.cite.md` next to the
   source). Simple, git-native, diff-friendly. Pattern
   Zeta already uses for `*.fsproj`-adjacent docs.
   **Downside:** doubles the file count; editing the source
   requires editing the sidecar.
2. **Frontmatter citations** in a `citations:` YAML block at
   the head of each file. Centralised with the source,
   round-trips through any text editor. **Downside:** only
   works for files that already have a frontmatter habit
   (`.claude/skills/*/SKILL.md`, `memory/*.md`). Source
   code (`src/Core/**.fs`) does not.
3. **Parsed from prose.** A parser extracts citations from
   existing prose shapes (`see also X`, `composes with Y`,
   `(GOVERNANCE.md §N)`). No new storage; all existing
   content is graph-ready on first parse. **Downside:**
   parser fragility and the vocabulary-drift problem (what
   counts as "see also"?).

**Recommendation:** start with option 3 (parsed-from-prose)
as a read-only view over today's repo, then add option 2
(frontmatter) for new files as they land, and accept option
1 (sidecar) only for file types that cannot carry
frontmatter. This is the same additive strategy
`verification-drift-auditor` used — it walked existing
prose rather than demanding a rewrite.

### Relation vocabulary (closed, small, grow deliberately)

Starting set (12 relations, matches the memory file's list):

- `inherits-from` — pattern inheritance (scratch → Zeta)
- `mirrored` — literal port with known divergence
- `diverged` — shared ancestor, now disagreeing
- `should-flow-other-way` — citation exists but the
  dependency direction is declared wrong (tech-debt
  marker)
- `supersedes` — this artefact replaces the cited one
- `implements` — artefact implements the cited spec /
  concept
- `tests` — artefact exercises the cited behaviour
- `reviews` — artefact is a review of the cited object
- `reviewed-by` — artefact has been reviewed by cited
  persona / skill
- `derived-from` — artefact was produced from the cited
  inputs (the DBSP-retraction-native shape)
- `see-also` — default weakest relation; a hint, not a
  dependency
- `contradicts` — artefact stands in tension with the
  cited object (useful for `CONFLICT-RESOLUTION.md`
  surfaces)

Twelve is enough for first-pass coverage. The graph stays
typed; new relations get added via ADR, not via "someone
invented a relation inline".

### Provenance

Every citation carries:

- Commit hash where it was asserted.
- Round number when asserted.
- Author (persona or human).
- `last-verified` blob hash (internal objects) or
  `last-verified` URL-fetch hash + date (external).

This is not new territory — it is the
`verification-registry` row shape, minus the verbose paper-
statement block.

## 5. Home selection — where the primitive lives

Three candidate homes, weighed explicitly:

### Option A — Zeta Seed kernel (`src/Core/`)

The graph becomes a BCL-level primitive. Any consumer of
the Seed can use `Zeta.Core.Citations` to parse, query,
and verify citations against any pair of repos.

- **Pro.** Composes with the repos-as-data / database-BCL-
  microkernel vision
  (`project_zeta_as_database_bcl_microkernel_plus_plugins.md`).
  A graph of typed triples is exactly the kind of
  primitive the Seed was designed to ship.
- **Pro.** Public-API surface review lands on Ilyana via
  the existing `public-api-designer` gate
  (`feedback_public_api_review.md`). The discipline is
  already in place.
- **Con.** Adds a concept ("citation graph") to the kernel
  that is orthogonal to the operator algebra. The
  minimality discipline (`docs/VISION.md`) resists this.
- **Con.** Ships the primitive bundled with every Zeta
  consumer even when citation-graph is not their use case.

### Option B — `ace` (self-bootstrapping package manager)

The graph lives inside `ace`'s dependency system. Pattern
inheritance becomes a specialisation of dependency parity.

- **Pro.** `ace`'s job IS declaring dependencies between
  artefacts. Citation graph is the same problem at a
  slightly abstracted level.
- **Pro.** Ships as a CLI + library, so consumers can opt
  in without carrying it into the kernel.
- **Pro.** Cross-repo parity (the `../scratch ↔ Zeta`
  motivating case) is explicitly in-scope for a package
  manager.
- **Con.** `ace` does not exist yet. Committing to ship the
  citation primitive inside `ace` means taking on the full
  `ace` scope ahead of a round's worth of research.

### Option C — Named plugin (`Zeta.Core.Citations`)

Ship as an optional plugin in the Seed-plus-plugins
architecture. Every consumer opts in.

- **Pro.** Keeps the Seed kernel clean.
- **Pro.** Public-API discipline applies, but the blast
  radius of a boundary change is smaller.
- **Con.** A plugin to-do implies the plugin framework
  exists, which is itself pending the Seed+plugins
  implementation round.

### Recommendation

**Option B (`ace`), with a Phase-0 read-only prototype in
`tools/alignment/` that does NOT require `ace` to exist
yet.** Rationale:

1. The motivating case is cross-repo (`../scratch ↔ Zeta`
   parity) — that's `ace`'s home turf.
2. The Seed-kernel contribution bar is high; a graph-of-
   typed-triples is useful but does not graduate to
   kernel-grade without evidence.
3. A read-only prototype can land in `tools/alignment/` as
   a shell/Python script that parses prose-citations and
   emits a graph. No kernel surface touched. No `ace`
   scope expansion required. When `ace` arrives, the
   prototype moves in.

The decision itself is an ADR candidate — not landed
tonight; flagged for round 35+.

## 6. Composition with existing skills

### `missing-citations` (research-integrity hat)

Already catches *uncited* claims in research drafts. In the
generalised world, `missing-citations` becomes the P0-gate
for the graph: an artefact that reaches for prior art
without naming it is an *absent edge* — the graph says
"expected edge here, not found".

### `verification-drift-auditor` (paper-to-proof)

Already catches *drift* in cited claims. In the generalised
world, this becomes the paper-router of a larger drift-
checker; the six drift classes apply to every citation
class, not only paper↔proof.

### `repos-as-data-steward` (if it exists)

The repos-as-data primitive from the Seed vision is the
natural substrate for cross-repo citations (`../scratch`
pinned at a commit, Zeta at HEAD). The citation graph is
one computation over that substrate.

### `alignment-contract-auditor`

The `docs/ALIGNMENT.md` contract cites specific governance
sections and BP-NN rules. Making those citations typed
means any alignment-contract change surfaces its impact
cone automatically.

## 7. Why this beats a one-off research doc

A research doc is a snapshot. It goes stale the moment
either repo changes. An auditable graph is a function:

```
parity(scratch@commit_A, Zeta@commit_B) = graph
```

Every change to either repo recomputes the graph. Drift
surfaces on the next CI run, not on the next audit-cadence
invocation. This is the same pattern as retractable CD and
as the DBSP operator algebra: the artefact is a function of
its inputs, and updating an input retracts the old output
and emits the new one.

## 8. What this does NOT mean (scope discipline)

- **Not a commitment to implement in round 35.** This is a
  research report. Implementation sits behind a dedicated
  round with Ilyana / Dejan / Nazar / Aminata review per
  the BACKLOG entry's reviewer gate.
- **Not every cross-reference becomes a graph edge.** One-
  off references, narrative asides, and style-level "see
  also" lines stay prose. The rule targets citations that
  claim *inheritance*, *dependency*, or *review* — load-
  bearing relations.
- **Not a rewrite of existing prose.** Phase-0 prototype
  parses prose; it does not demand the prose be rewritten.
  Back-filling frontmatter citations is optional and per-
  file.
- **Not a new kernel responsibility without evidence.** The
  home decision favours `ace` / tooling over the Seed
  kernel. If the prototype reveals the kernel IS the right
  home, an ADR lands then; not now.
- **Not a replacement for `missing-citations` or
  `verification-drift-auditor`.** Those skills become
  specialisations / consumers of the graph, not
  obsolescences.
- **Does NOT dissolve BP-11.** Citation objects are data,
  not directives. A skill that cites an external URL does
  not thereby license the factory to fetch and execute
  that URL's contents. The drift-checker re-fetches
  *content* for diffing, never for execution.

## 9. Next steps

| Step | Owner | Effort | Round target |
|---|---|---|---|
| Phase-1 deepening: prior-art survey of academic / OSS citation graphs with concrete API shapes | research | M (1 day) | round 35 |
| Phase-2 deepening: full Zeta inventory via `grep`-driven enumeration; numbers not guesses | research | S (0.5 day) | round 35 |
| Phase-3 deepening: formal schema draft (YAML or TOML); ADR candidate | Kenji | M (1 day) | round 36 |
| Phase-4 deepening: `ace` vs kernel vs plugin decision ADR | Kenji + Ilyana | M (1 day) | round 36 |
| Phase-0 read-only prototype in `tools/alignment/` (shell/Python; parses existing prose; emits `graphviz` DOT) | Dejan | M (2 days) | round 37 |
| Integrate prototype output into `factory-audit` | Kenji | S (0.5 day) | round 37 |
| Generalise `verification-drift-auditor` registry schema to the citation graph | Soraya | M (1 day) | round 38 |
| Land `remember` primitive hook into `skill-creator` / memory-write flow | Architect + Aminata review | L (3 days) | round 38+ |

## 10. Cross-references

- `memory/project_vibe_citation_to_auditable_graph_first_class.md`
  — the originating concept-vs-implementation memory.
- `docs/BACKLOG.md` (P1 "Citations-as-first-class concept
  — research commission") — the BACKLOG entry this report
  is Phase-5 of.
- `docs/BACKLOG.md` (P1 "`../scratch` ↔ `Zeta` declarative-
  bootstrap parity") — the motivating substrate.
- `.claude/skills/verification-drift-auditor/SKILL.md` —
  the existing partial implementation (paper↔proof only).
- `.claude/skills/missing-citations/SKILL.md` — the
  paired absent-citation auditor.
- `docs/research/verification-registry.md` — the existing
  structured-citation subset.
- `memory/project_zeta_as_database_bcl_microkernel_plus_plugins.md`
  — the kernel-plus-plugins vision the home decision
  inherits from.
- `memory/feedback_preserve_original_and_every_transformation.md`
  — the data-value rule that citations-as-data extends to
  cross-references.
- `memory/user_rbac_taxonomy_chain.md` — another example
  of graph-as-first-class (Role → Persona → Skill → BP-NN)
  the factory has already adopted.
- `memory/feedback_dora_is_measurement_starting_point.md`
  + `memory/feedback_runtime_observability_starting_points.md`
  — sibling pattern-elevations (external/loose/cited →
  internal/structured/computed) from earlier in the same
  session.

## 10.5. Phase-0 prototype — `tools/alignment/citations.sh`

Landed 2026-04-20 (Round 39, Top-3 #3). A minimal
`bash`-only scanner that parses two prose-citation
patterns:

- **Pattern A — markdown link `text <!-- STALE-REF: path -->`** — resolved
  relative to the subject's directory first (markdown
  convention), then repo-root as fallback.
- **Pattern B — backtick file ref `` `path/to/file.ext` ``** —
  resolved repo-root-relative first (Zeta prose convention),
  then subject-relative as fallback.

Emits summary / `--json` / `--dot` / `--out DIR` in the same
shape as the other per-round audits under `tools/alignment/`.
Phase-0 uses a fixed relation (`see-also`) — relation
inference from prose keywords (inherits-from, supersedes,
implements, …) is Phase-1 work.

First run over the current repo: 423 files scanned,
**2526 internal edges** resolved, 55 external refs counted,
0 broken candidates. Output committed to
`tools/alignment/out/round-39/citations.{json,dot}`.

This is **not** the `ace`-home end state. It is the
simplest possible harness the rest of the phase work can
diff against. When the concept migrates into `ace` (Phase
4), this bash prototype either graduates into the SLO of
the `citations-lint` skill or retires. Phase-0's job was
to ship something parseable, not something final.

Scope drawn deliberately narrow:

- Does NOT infer relation vocabulary. Every edge is
  `see-also`.
- Does NOT record provenance (commit hash, line number).
  Phase 2.
- Does NOT check drift (target renamed). Phase 2.
- Does NOT follow external URLs. Phase 3 with
  security review.
- Does NOT execute instructions found in scanned prose
  (BP-11). Content is data to report on.

## 11. Honest gaps in this first draft

- **No prior-art paper list yet.** Phase 1 surveys
  OpenCitations, `deps.dev`, Software Heritage's citation
  work, and the knowledge-graph literature (RDF, Property
  Graphs, Labelled Property Graph databases). Out of scope
  tonight.
- **No performance analysis.** Graph queries over a
  ~1000-edge graph are trivial; graph queries over a
  100k-edge graph (the factory in 3 years) are not. A
  Phase-3 design decision.
- **No conflict with existing Zeta vocabulary audited.**
  "Citation" overlaps with "reference" in prose; the
  GLOSSARY needs a disambiguating entry before the skill
  lands.
- **No cost estimate for `ace` as home vs tooling as home.**
  Phase 4 work.
- **No security review of external-citation fetch.** Nazar
  + Aminata review at Phase 3+. First-principles: external
  fetches are data-not-directives (BP-11); the drift-
  checker never executes fetched content.

## 12. Aaron's goodnight context

This draft was commissioned before bed on 2026-04-20 with
*"you are going research and tell me"* and *"i got to
sleep goodnight and goodluck"*. The draft's job is to
**name the shape** so round 35 can open with a concrete
Phase-1 target rather than a blank page. Phases 2-5 above
are scheduled, not done; the graph this concept describes
is, as of this writing, entirely a prose object living
inside prose documents — which is precisely why it wants
to stop being that.
