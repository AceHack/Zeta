---
name: AutoMemory — Anthropic built-in feature added Q1 2026; the underlying memory system (MEMORY.md + per-fact files) agents use across sessions
description: AutoMemory is Anthropic's 2026-Q1 Claude Code built-in feature — the persistent cross-session memory system itself (MEMORY.md index + per-fact files under `~/.claude/projects/<slug>/memory/`). Distinct from AutoDream (the consolidation feature layered on top — `reference_autodream_feature.md`). AutoMemory prescribes the frontmatter schema (name/description/type/originSessionId) and the four memory types (user / feedback / project / reference). Aaron confirmed this 2026-04-20 verbatim "AutoMemory is a buit in featue antropic added in Q1 for you." Implication for factory work — the memory system is an Anthropic product surface, not a Zeta-local invention; local customisation (e.g., proposed `scope:` field extension at `docs/research/memory-scope-frontmatter-schema.md`) is a factory-level overlay on top of Anthropic's schema, not a replacement of it.
type: reference
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## What AutoMemory is

AutoMemory is the **base memory feature** Anthropic
added to Claude Code in Q1 2026: the persistent
per-project memory folder at
`~/.claude/projects/<slug>/memory/` that contains:

- `MEMORY.md` — the always-loaded index
- `user_*.md`, `feedback_*.md`, `project_*.md`,
  `reference_*.md` — per-fact files loaded on demand

It is the feature that makes an agent's memory
survive across sessions. Every memory an agent has
"earned" across sessions is stored here.

## The "Daytime logger" framing (Anthropic's metaphor)

Anthropic documents AutoMemory as the **"Daytime"
logger**:

- **Function:** automatically takes notes during a
  coding session — build commands, architectural
  decisions, user preferences — into `MEMORY.md`.
- **Behavior:** **additive** — appends new
  information continually during work.
- **Limitation without curation:** the file grows
  messy, accumulates conflicting information,
  "yesterday" references that become stale, and
  noise. **Degrades Claude's performance after
  ~10-15 sessions** if left uncurated.

AutoDream (`reference_autodream_feature.md`) is the
**"Nighttime" consolidation** that prevents the
degradation:

- **Function:** background sub-agent that cleans,
  prunes, structures `MEMORY.md`.
- **Behavior:** **subtractive / curative** — merges
  duplicates, resolves contradictions, converts
  relative dates to absolute.
- **Cadence:** ~24 hours **and** ≥5 sessions since
  the last cycle (both conditions).

**Relationship:** AutoMemory is additive; AutoDream
is subtractive. AutoMemory without AutoDream → the
10-15-session degradation cliff. AutoDream without
AutoMemory → nothing to consolidate. They compose
into a "second brain" that stays clean across
long-horizon projects.

Source for the framing: Anthropic docs + YouTube /
LinkedIn surface summaries, relayed by Aaron
2026-04-20 during the first cadenced Claude-surface
audit data delivery.

## Distinct from AutoDream

- **AutoMemory** = the memory system itself (base
  feature).
- **AutoDream** = the REM-sleep-style consolidation
  pass that runs on top of AutoMemory
  (`reference_autodream_feature.md`).

AutoDream requires AutoMemory to exist; AutoMemory
does not require AutoDream (and as of 2026-04-19
AutoDream is still flag-gated while AutoMemory is
generally available).

## What Anthropic prescribes vs. what the factory
customises

**Anthropic-prescribed** (from the CLAUDE.md
auto-memory section and the product documentation):

- Frontmatter fields: `name`, `description`, `type`,
  `originSessionId`.
- Type taxonomy: `user`, `feedback`, `project`,
  `reference`.
- Loading model: `MEMORY.md` always loaded;
  per-fact files loaded on demand.
- Location: `~/.claude/projects/<slug>/memory/`.

**Factory-local customisation layered on top**
(examples):

- Newest-first ordering in `MEMORY.md` index
  (`feedback_newest_first_ordering.md`).
- Absolute dates, not relative
  (consolidation/AutoDream discipline).
- Proposed `scope:` frontmatter field for factory
  vs project vs user vs hybrid
  (`docs/research/memory-scope-frontmatter-schema.md`
  — research-grade, not yet adopted).
- Cross-reference discipline (memory files link to
  related memories).
- Retrospective audits (FACTORY-HYGIENE rows 35/36)
  check for missing or mis-tagged scope declarations.

The distinction matters: factory-local customisation
can evolve with factory policy; Anthropic-prescribed
structure may change when Anthropic ships a new
version of the feature, and factory edits must stay
compatible.

## Why this matters for factory decisions

When the factory proposes to **change** something
about the memory system (e.g., add a `scope:` field,
change the type taxonomy, rename a frontmatter
field), the question **"is this a change to
Anthropic's schema or a factory-overlay?"** must be
answered *before* the change lands.

- **Factory-overlay additions** (new optional field,
  a convention, a cross-reference discipline) — land
  as Tier-1/Tier-2 in the factory's edit envelope.
  Safe; they don't break Anthropic's feature.
- **Changes to Anthropic's schema** (renaming a
  field Anthropic expects, removing a required
  field) — **do not land**. They would break the
  feature. Route via Anthropic bug report or
  feature request.

The proposed `scope:` field at
`docs/research/memory-scope-frontmatter-schema.md`
is correctly framed as a **factory-overlay optional
addition** — the Anthropic-required fields stay;
`scope:` is added between `type:` and
`originSessionId:` as an extension. This is
compatible with future Anthropic updates because
Anthropic's parser is expected to ignore unknown
frontmatter keys (standard YAML frontmatter
behaviour).

## Source

Aaron 2026-04-20 verbatim:

> *"AutoMemory is a buit in featue antropic added
> in Q1 for you"*

Context — during autonomous /loop research on
extending the memory frontmatter schema, Aaron
corrected the framing: the memory system I'd been
treating as factory-authored infrastructure is
actually an Anthropic product feature. This is
load-bearing for how future factory work describes
and extends the memory system.

## How to apply

- When writing about the memory system, **cite
  AutoMemory as the underlying feature**, not
  describe it as factory-native or Zeta-native.
  Example: "AutoMemory (Anthropic's Q1 2026 Claude
  Code feature) provides the MEMORY.md +
  per-fact-file substrate; the factory layers
  newest-first ordering and scope-tagging
  discipline on top."
- When proposing **changes** to the memory system,
  explicitly classify: is it a factory-overlay
  addition (safe, local) or a request for
  Anthropic-side change (file upstream, don't
  land)?
- CLAUDE.md auto-memory section is **documentation
  of Anthropic's feature + factory customisation**
  — edits to it are Tier-3 because they change
  the per-memory-write behaviour, but the schema
  itself is Anthropic's and factory can only add,
  not remove.
- When talking to Aaron about memory work, don't
  describe AutoMemory as something the factory
  built. It's Anthropic's. Describe factory
  contributions precisely (scope-tagging, ordering
  discipline, cross-reference discipline, etc.).

## Cross-references

- `reference_autodream_feature.md` — AutoDream,
  the consolidation feature that runs on top of
  AutoMemory.
- `docs/research/memory-scope-frontmatter-schema.md`
  — the `scope:` field extension research; this
  reference memory clarifies it's a factory-overlay
  addition, not an Anthropic-schema change.
- `feedback_newest_first_ordering.md` — factory-
  overlay ordering discipline layered on top of
  AutoMemory.
- `project_memory_is_first_class.md` — factory
  policy on memory preservation; applies to
  AutoMemory-stored memories.
- `CLAUDE.md` auto-memory section — the
  documentation of AutoMemory + factory overlay.

**Scope:** factory-wide. Any adopter of this
factory kit that uses Claude Code inherits
AutoMemory as the underlying memory substrate. The
factory's customisations (ordering, scope-tagging,
cross-references) are the factory-kit value-add;
AutoMemory itself is Anthropic's.
