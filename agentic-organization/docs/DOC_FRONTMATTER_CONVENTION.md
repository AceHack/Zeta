---
title: Doc Frontmatter Convention
canonical_name: Agentic Organization
status: design
ideas: [3]
extends: [README.md]
composes_with:
  - ./OBSERVE_COMPOSER_AND_RUN_STATE.md
  - ./GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md
code_anchors: []
supersedes: []
---

# Doc Frontmatter Convention

Operator idea 3: every design document in `agentic-organization/docs/` carries
YAML frontmatter with pointers to the documents and code it relates to, so the
doc set is a navigable graph rather than a flat list. The frontmatter is the
machine-readable edge layer; the prose is the node.

## Schema

```yaml
---
title: <human title, matches the H1>
canonical_name: Agentic Organization      # always; never "Hermes"/"Work OS" at platform scope
status: design | v0 | implemented          # lifecycle of the doc's content
ideas: [<operator idea numbers this doc covers>]
extends: [<doc filenames this builds directly on>]
composes_with:                             # related docs (bidirectional intent)
  - ./<doc>.md
code_anchors:                              # real code paths the doc describes
  - ../packages/<pkg>/src/<file>.ts
supersedes: [<doc filenames this replaces, if any>]
---
```

### Key semantics

- **`canonical_name`** — enforces the naming discipline from the README:
  "Agentic Organization" is the platform; "Hermes" is *only* the agent runtime;
  "Organization Work OS" is *only* the work-management subsystem. Docs whose
  scope is one of those subsystems may still set `canonical_name: Agentic
  Organization` and name the subsystem in the body.
- **`status`** — `design` (reference substrate), `v0` (smallest end-to-end
  slice in flight), `implemented` (code exists and is tested). A doc moves
  `design → v0 → implemented` as its `code_anchors` become real and green.
- **`extends` vs `composes_with`** — `extends` is the parent(s) a reader should
  read first; `composes_with` is the lateral graph. Both are pointers, not
  copies (substrate-or-it-didn't-happen: the pointed-at doc is the source of
  truth).
- **`code_anchors`** — relative paths from the doc to real code. When a doc
  claims a contract, the anchor proves it exists. Empty is allowed for
  pure-design docs.
- **`supersedes`** — retraction-native: a superseding doc names what it
  replaces; the replaced doc stays in git history (never deleted silently).

## Why pointers, not a central index

The README remains the human entry list, but it is hand-maintained and drifts.
Frontmatter pointers let a tool (or an agent) reconstruct the doc graph from the
files themselves — the same way `composes_with:` edges work in the backlog. The
graph is derivable, so it cannot rot out of sync with the docs.

## Two roles, one mechanism

Frontmatter plays two roles in the Agentic Organization, and they are the same
mechanism at two scopes:

1. **Doc-graph metadata** (this doc) — `title`/`status`/`extends`/`composes_with`/
   `code_anchors` make the design docs a navigable graph.
2. **Database rows + schema** (`GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md`) —
   a `.md` file is a row, its frontmatter is the typed columns, and `fk`/`fk_array`
   columns are graph edges resolved exactly like `composes_with`.

A doc's `composes_with` list *is* an `fk_array` over the docs "table"; a task row's
`depends_on` is an `fk_array` over the task table. The traversal code
(`packages/frontmatter-db/src/traverse.ts`) is therefore reusable for both: the
doc graph and the data graph are one graph with different schemas.

## Adoption

New docs MUST carry the frontmatter. Existing docs adopt it opportunistically as
they are edited (no big-bang rewrite). The two docs landed alongside this one
(`OBSERVE_COMPOSER_AND_RUN_STATE.md`, `GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md`)
are the first adopters and the reference examples.

## Future: derive the graph

A small tool under `agentic-organization` (or the repo's `tools/`) can parse
frontmatter across `docs/*.md`, validate that every `extends`/`composes_with`
target exists, that `canonical_name` is set, and that `code_anchors` resolve to
real files — then emit the doc graph for the UI (composes with
`UI_AND_OBSERVABILITY_CONCEPTS.md`). That validator is the natural next slice for
this convention; until it lands, the discipline is enforced in review.
