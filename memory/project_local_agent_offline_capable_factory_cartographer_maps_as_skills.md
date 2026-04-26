---
name: Local-agent offline-capable factory — cartographer maps are the offline skills substrate; ordinary mapping work is inadvertently building toward internet-free operation
description: Aaron 2026-04-22 "offline-capable that is exactly what we are inadvertenly doing everytime you map somthing cartographer, next time we don't have to go online and with a local agent you would not need the internet to have the skills of the factory." Reframes cartographer discipline from documentation hygiene to offline-capability investment. Surface maps + settings-as-code + research docs + budget history together form the knowledge base a local-only agent would need to operate without internet. Aligns with graceful-degradation first-class principle — offline-capable UI/microservice pattern scales to "offline-capable factory."
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Fact:** Every cartographer work-product committed to
the repo (GitHub surface map, declarative GITHUB-SETTINGS.md,
budget-history JSONL, research docs, tech radar,
hygiene snapshots) is **simultaneously a working artifact
and an offline cache entry** for a future local-only agent.
The factory has been accumulating this offline knowledge
base as a byproduct of ordinary mapping work, without
treating it as a deliberate goal. Aaron 2026-04-22 named
the emergent property and promoted it to a deliberate
direction.

**Why — Aaron 2026-04-22, verbatim:**

> *"offline-capable that is exactly what we are
> inadvertenly doing everytime you map somthing
> cartographer, next time we don't have to go online and
> with a local agent you would not need the internet to
> have the skills of the factory"*

Context: sent immediately after the graceful-degradation
memory got reframed with microservice + UI patterns (the
*offline-capable* UI pattern being one of them). Aaron
recognized that the factory was *already* doing the
offline-capable pattern inadvertently — every
cartographer pass writes another durable, git-persisted,
internet-free-readable artifact.

**The insight — three layers:**

1. **Observation.** Every time cartographer-discipline
   fires (map a GitHub surface, snapshot settings to
   code, capture a budget state in JSONL, backfill a
   research doc), the output is an internet-free
   knowledge artifact. Readers (human or agent) who come
   back later do **not** need to re-query `gh api`, GitHub
   UI, billing dashboards, or external docs to understand
   the mapped surface — the map itself contains the
   answer.

2. **Reframe.** Cartographer work was treated as
   documentation hygiene (keep the repo legible, resist
   drift, enable auditing). It is also **offline-
   capability investment**. The durable artifacts compose
   into a factory-operable knowledge base that would
   survive network loss, API deprecation, third-party
   service shutdown, or agent-only-has-local-filesystem
   deployment.

3. **Direction.** The long-run goal this enables:
   **local-agent operation of the factory** — a Claude
   Code session (or any local agent) running on a
   developer's laptop, air-gapped CI runner, or embedded
   deployment context, with zero internet requirement,
   using the committed maps as its primary knowledge
   source. *"with a local agent you would not need the
   internet to have the skills of the factory."* Maps =
   skills substrate.

**What this promotes from emergent to deliberate:**

Cartographer discipline was already enforced by existing
memories and hygiene rules. The change is that
*offline-capability* is now a **first-class design
criterion** evaluated alongside freshness, portability,
and legibility when:

- Authoring a new map (surface map, settings doc, hygiene
  snapshot): ask "does this artifact let a reader answer
  the mapped question without going online?"
- Reviewing an existing doc: ask "if the network went
  away tomorrow, would this doc still convey its answer,
  or does it depend on live links?"
- Deciding what to persist to git vs. what to leave
  live-only: default toward persist if the answer serves
  a future offline read.

**Composition with graceful-degradation
(`feedback_graceful_degradation_first_class_everything.md`):**

This directive is the **offline-capable UI pattern**
scaled up from "one tool" to "the whole factory."
Graceful-degradation says a single tool should serve
stale-cache when fresh is unavailable. This directive
says the factory as a whole should be operable from
stale cache (committed maps) when the internet is
unavailable. Same pattern, wider scope. The cache layer
is git itself.

**How to apply:**

1. **Every cartographer artifact carries its answer.**
   A surface map doesn't just link to GitHub UI — it
   captures the fields, values, and semantics an offline
   reader needs. A settings-as-code doc doesn't just
   reference `gh api` — it inlines the current expected
   values with their rationale. Live links are
   supplementary, not load-bearing.

2. **Live links get backup treatment.** When a doc cites
   an external URL (GitHub docs, upstream spec, vendor
   API reference), accompany it with a local summary
   sufficient for the reader to understand the reference
   without following the link. Live link dies → local
   summary still works.

3. **Timestamp + source sha on every cached value.** An
   offline reader needs to know when the cache was last
   refreshed and what the source state was at the time.
   `factory_git_sha` + `ts` + `scope_coverage` pattern
   from `docs/budget-history/snapshots.jsonl` is the
   shape. Extend to other cartographer outputs where
   time-sensitive.

4. **Periodic sync without ambient dependency.** The
   factory can still call `gh api` to refresh the cache —
   but the factory should never *require* that call to
   answer a previously-mapped question. Refresh is
   cadence, not runtime dependency.

5. **Offline-readiness as a review lens.** When a new
   artifact lands, ask: *"if I cloned this repo to a
   machine with no internet, could I answer the question
   this artifact addresses?"* If no, the artifact is
   incomplete as an offline cache entry (land it anyway,
   but open a follow-up to backfill the missing
   self-contained answer).

6. **Research docs and radar entries count.** A research
   doc that summarizes an external paper + cites its DOI
   is an offline cache for that research (the reader
   doesn't re-fetch the paper to get the summary). A
   tech radar entry with Trial / Adopt / Hold rationale
   is an offline cache of the current decision context.
   Both are skills-substrate material.

**What's already offline-ready (2026-04-22 state):**

- `docs/GITHUB-SETTINGS.md` — declarative settings as code
- `docs/budget-history/snapshots.jsonl` — budget state
  snapshots with scope_coverage manifest
- `docs/hygiene-history/` — loop tick history, factory
  hygiene snapshots
- `docs/research/*.md` — external research captured
  locally with summaries
- `docs/TECH-RADAR.md` — tech-selection decisions with
  rationale
- `docs/DECISIONS/*.md` — ADRs (all prior decisions
  readable offline)
- `.claude/skills/*/SKILL.md` — skill library (agent's
  own procedural knowledge, already file-based)
- `memory/` — cross-session memories (file-based,
  git-persisted for factory runs — note this is
  user-scoped auto-memory, technically outside the repo
  but on the same filesystem and usable offline)
- `docs/glossary` / `docs/CONFLICT-RESOLUTION.md` /
  `docs/EXPERT-REGISTRY.md` — coordination knowledge

**What's currently online-dependent (candidate
follow-ups):**

- Per-PR CI run details (factory relies on `gh run list`;
  no committed cache of recent run summaries).
- Live Copilot billing seat status (only snapshots are
  persisted; between snapshots the factory is blind).
- External upstream project releases / versions (no
  committed cache of "latest known upstream version"
  for key deps; relies on live Dependabot / release
  feeds).
- Collaborator / team / permission state beyond
  settings-doc coverage.

These are candidates for cartographer expansion, not
immediate work. They become priorities if / when local-
agent operation becomes a near-term goal.

**What this directive does NOT say:**

- Does not commit to shipping a local-only agent now.
  The factory's offline-capability is a *destination*,
  not a deadline.
- Does not deprecate internet use during factory work.
  The current internet-connected agent (this Claude Code
  session) is the way things work today; offline-capable
  is the long-horizon goal.
- Does not imply every map must be perfectly offline-
  complete on first pass. Incremental — each new map is
  a little more coverage.

**Open questions for future sessions:**

- At what point does "local agent" become a concrete
  Stage (e.g., Stage 5 of the three-repo split)?
- Does offline-capability factor into SKILL.md authoring
  guidance (skills must be self-contained / not rely
  on web-fetch-at-invocation)?
- Does the Forge-bundled-with-app story
  (`project_multi_sut_scope_factory_forge_command_center.md`)
  imply that bundled Forge must be offline-capable by
  default (since bundled deployments may be air-gapped)?
- What's the test: could the factory operate for N days
  with no internet, reading only committed state?

**Source:** Aaron direct message 2026-04-22 during
round-44 speculative drain, immediately after the
graceful-degradation memory was reframed with microservice
+ UI framing. Previous messages in the same tick:
*"Graceful-degradation should be first class in everything
we do"* + *"thats why we have the data in git too"* +
*"frame it how a microservice and ui would frame graceful
degradation not a scientist, they are similar but not 100%
overlapping."*

**Cross-reference:**

- `feedback_graceful_degradation_first_class_everything.md`
  — this is the factory-scope version of the UI-pattern
  offline-capable bullet
- `project_multi_sut_scope_factory_forge_command_center.md`
  — Forge-bundled-with-app case implies bundled Forge
  should be offline-capable
- `feedback_github_settings_as_code_declarative_checked_in_file.md`
  — the settings-as-code pattern that instantiates this
  for GitHub surfaces
- `feedback_surface_map_consultation_before_guessing_urls.md`
  — consult-the-map before guessing; the map is the
  offline substrate
- `feedback_dv2_scope_universal_indexing.md` — indexing
  substrate serves offline readers as well as online
