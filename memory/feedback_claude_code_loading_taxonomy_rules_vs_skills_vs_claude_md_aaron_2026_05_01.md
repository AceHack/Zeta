---
name: Claude Code loading taxonomy — three mechanisms across multiple surfaces; auto-load doc-supported but unverified — the human maintainer 2026-05-01
description: The human maintainer 2026-05-01 question — *"is .claude/rules anthropic endorsed? skills are there too but go through a router that i don't how reliable is but you control the router search description does rules work in a similar way?"* Per canonical Anthropic docs at code.claude.com/docs/en/memory (WebSearch + WebFetch 2026-05-01) `.claude/rules/*.md` is documented as Anthropic-endorsed with auto-load behavior. Three loading mechanisms across multiple surfaces: (1) **direct-load** — CLAUDE.md + CLAUDE.local.md auto-loaded; `.claude/rules/*.md` without `paths:` documented to auto-load **but unverified in our harness — canary test in PR #1163**. (2) **lazy-load** — `.claude/rules/*.md` with `paths:` glob, on file-pattern match. (3) **router-keyed** — `.claude/skills/<name>/SKILL.md` via Skill tool description matching (canonical path only, empirically tested). Plus subagent-discovery for `.claude/agents/<name>.md` and on-demand for memory `MEMORY.md` (first 200 lines / 25KB) + topic files. For lessons with a recognition-failure component (goldfish-ontology), triggering-independent surfaces beat router-loaded ones — IFF the auto-load actually works, which the canary verifies.
type: feedback
caused_by:
  - "The human maintainer 2026-05-01 verbatim: 'is ./claude/rules anthropic endorsed?'"
  - "Predecessor verbatim same tick: 'skills are there too but go though a router that i don't how reliable is but you control the routher search description does rules work in a similar way? you had to really test this to figure it out we tried a different folder than .claude/skills or they would not load in your router.'"
  - "WebSearch + WebFetch 2026-05-01 on https://code.claude.com/docs/en/memory confirmed `.claude/rules/` is documented in canonical Anthropic source (not third-party convention)"
  - "Composes with the meta-rule landed earlier same session in feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md — that memo's example list of pointer targets was incomplete (didn't include .claude/rules/ as a direct-load wake-time surface)"
composes_with:
  - feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md
  - feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md
  - feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md
---

# EMPIRICAL VERIFICATION STATUS (added 2026-05-01 same tick, before merge)

**The auto-load claim for `.claude/rules/*.md` is doc-only,
NOT empirically verified in our harness.**

Per the human maintainer's calibration challenge 2026-05-01:
*"i think rules are not special you have to look those up
like any other docs, is that true? there is no router so the
only way you know about them is if they are pointed to in
claude code... what's will you magically read and apply all
the rules?"*

What I actually have:

- **Doc citation**: Anthropic's canonical docs at
  [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)
  state rules are auto-loaded from `.claude/rules/*.md` at
  session start. WebFetch 2026-05-01 confirmed the
  documentation language.
- **Empirical evidence in our harness**: NONE. There is no
  `.claude/rules/` directory in this repo at the time this
  memo was written. The auto-load behavior has not been
  tested on Zeta's specific Claude Code version /
  configuration.

The Otto-364 search-first-authority discipline says: cite
canonical docs, not training data. I did that — but treating
doc-citation as empirical fact is a different failure mode.
Doc-supported isn't the same as harness-tested.

**Calibrated language to use until the canary test runs**:

- "Per Anthropic docs, `.claude/rules/*.md` is documented to
  auto-load." — accurate.
- "In our harness, `.claude/rules/*.md` auto-loads." —
  unverified; do NOT assert as fact.

**Canary test plan** (set up in a sibling PR, runs on next
fresh session):

1. Create `.claude/rules/test-canary.md` with detectable
   unique content.
2. Restart Claude Code session in this repo.
3. Run `/memory` slash command. Per Anthropic docs, it
   "lists all CLAUDE.md, CLAUDE.local.md, and rules files
   loaded in your current session."
4. Canary appears in `/memory` output → docs accurate, rules
   auto-load in our harness.
5. Canary absent → doc-vs-harness mismatch; rules require
   manual pointer / lookup like memory files.

If the test fails, the entire "direct-load surfaces" section
below collapses to "single direct-load surface (CLAUDE.md)
plus pointer-discovered surfaces (everything else, including
`.claude/rules/`)." The MVP architecture analysis in
`feedback_learnings_must_land_in_claude_md_or_pointer_*` and
the CLAUDE.md bullet pointing at this memo would need
revision.

The body below preserves the doc-language taxonomy AS AN
INTERPRETATION of the Anthropic docs. Read it with the above
caveat applied. Once the canary test runs, this section will
be replaced with an empirical result line.

# Rule

Claude Code has THREE loading mechanisms (direct-load,
lazy-load, router-keyed) operating across multiple surfaces.
The load-bearing distinction is the *mechanism*, not the
surface count — earlier drafts of this memo claimed "five
surfaces" but the enumeration below totals six numbered
items, plus `.claude/agents/` makes seven if counted as a
distinct surface. The exact count depends on whether you
treat each loading mode of `.claude/rules/` as one surface
or two, etc. Don't fixate on the count; fixate on the
mechanism. (Per Anthropic docs; see the EMPIRICAL
VERIFICATION STATUS section above for the calibration
caveat — auto-load is doc-only, not yet harness-tested.)

## Direct-load wake-time surfaces (no router, no lazy)

These load at session start, full content, in context.
The harness reads them directly from canonical paths.

1. **`CLAUDE.md`** — project-shared, loaded from
   `./CLAUDE.md` or `./.claude/CLAUDE.md`. Multiple
   locations supported (managed policy, project, user,
   local) per Anthropic docs §"Choose where to put
   CLAUDE.md files."
2. **`.claude/rules/*.md` without `paths:` frontmatter** —
   project-shared, recursive discovery under
   `.claude/rules/`. **Same priority as
   `.claude/CLAUDE.md`** per Anthropic docs §"Organize
   rules with `.claude/rules/`." User-level analogue:
   `~/.claude/rules/`.
3. **`CLAUDE.local.md`** — personal project notes,
   gitignored.

## Lazy-load wake-time surfaces (path-glob-keyed)

Loaded into context only when Claude reads a file matching
the configured glob pattern.

4. **`.claude/rules/*.md` with `paths:` frontmatter** —
   YAML frontmatter `paths:` field is a glob list; rule
   loads only when Claude opens a file matching one of the
   globs. This is the *path-scoped rule* mechanism.

## Router-keyed surfaces (description-matched)

The harness's `Skill` tool searches available skills by
description and surfaces matches to the model. The model
chooses whether to invoke; invocation loads the
`SKILL.md` body into context.

5. **`.claude/skills/<name>/SKILL.md`** — only the
   canonical path is discovered. Empirically (the human
   maintainer 2026-05-01 tested), skills in
   non-canonical folders are NOT loaded — the router
   has a hard-coded path expectation.

## On-demand surfaces (memory)

6. **`~/.claude/projects/<project>/memory/MEMORY.md`** —
   first 200 lines OR 25KB (whichever first) loaded at
   session start. Topic files (`*.md` siblings of
   `MEMORY.md`) are NOT auto-loaded; read on-demand by
   Claude using standard file tools.

# Why

The human maintainer 2026-05-01 (verbatim, two-message
clarification):

> *"skills are there too but go though a router that i
> don't how reliable is but you control the routher search
> description does rules work in a similar way? you had to
> really test this to figure it out we tried a different
> folder than .claude/skills or they would not load in your
> router."*
>
> *"is ./claude/rules anthropic endorsed?"*

Two composing arguments:

## Why-1: The mental-model gap I had

Before this clarification, I was conflating two distinct
concepts:

- **"Wake-time loaded"** — the property of being in
  context at session start.
- **"Pointed at from CLAUDE.md"** — a specific way of
  achieving wake-time discoverability.

These are not the same. `.claude/rules/*.md` files are
**wake-time loaded** by the harness directly, WITHOUT being
pointed at from CLAUDE.md. The harness does the discovery
itself; the rule body becomes context regardless of any
CLAUDE.md content.

The earlier memo (`feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md`)
listed CLAUDE.md, AGENTS.md/BP-NN/skill/agent transitive
discovery — but did not list `.claude/rules/`. That's a real
gap in the meta-rule's pointer-target list. This memo
fills it.

## Why-2: The asymmetry between rules and skills

Both `.claude/rules/` and `.claude/skills/` use the
`.claude/` namespace. Both are Anthropic-endorsed. But
they load via DIFFERENT mechanisms:

- **Rules**: harness discovers and loads directly. No
  description matching, no model decision, no router. The
  glob in `paths:` is a *path-pattern matcher* (file-system
  pattern), not a *semantic matcher* (description-keyed).
  Rules are essentially "additional CLAUDE.md content"
  with optional path-scoping.
- **Skills**: the `Skill` tool searches by frontmatter
  `description`. The model's prompt-context determines
  whether the skill description matches the current task;
  the model invokes the `Skill` tool with the matching
  skill name. The router is the description-matcher; the
  human maintainer's empirical observation 2026-05-01 is
  that this router only matches against descriptions in
  `.claude/skills/<name>/SKILL.md` (non-canonical paths
  produce no results).

The implication for Zeta: when adding wake-time substrate,
`.claude/rules/` is a viable target — particularly for
path-scoped guidance (e.g. rules that only apply to
`tools/github/**/*.ts` or `memory/*.md`). The path-scoped
case is novel; CLAUDE.md doesn't have an equivalent.

# How to apply

When deciding where to land a new rule / discipline /
pattern:

1. **Cross-cutting, applies-everywhere?** → CLAUDE.md
   bullet (with memory-file pointer for full reasoning).
2. **Path-scoped (only applies to certain files)?** →
   `.claude/rules/<topic>.md` with `paths:` frontmatter
   glob. Examples: `tools/github/**/*.ts` for the
   poll-pr-gate-batch.ts SQLSharp pattern; `memory/*.md`
   for memory-file authoring conventions; `**/*.test.ts`
   for the test.each + DST patterns.
3. **Procedural (multi-step task instructions)?** →
   `.claude/skills/<name>/SKILL.md` via the `skill-creator`
   workflow (per Zeta's GOVERNANCE.md §4).
4. **Persona / role-bound responsibilities?** →
   `.claude/agents/<name>.md`.
5. **History / audit / per-tick narrative?** →
   `memory/<persona>/NOTEBOOK.md`, `docs/hygiene-history/`,
   `docs/ROUND-HISTORY.md`. Read-on-demand.

The earlier meta-rule (learnings-must-land-in-claude-md-or-pointer)
should be read with this taxonomy in mind: **CLAUDE.md or a
pointer from it** is one valid landing pattern; **a
`.claude/rules/<topic>.md` file** is *another* valid
landing pattern (no CLAUDE.md pointer needed; harness
loads it directly). Future-Otto should use whichever fits
the rule's scope better.

# Implication for Zeta substrate

Zeta currently uses `.claude/skills/` (10+ skills) and
`.claude/agents/` (20+ agents) but has not yet adopted
`.claude/rules/`. There's a clean opportunity: path-scoped
rules for areas where CLAUDE.md guidance would be too narrow
(would clutter the wake-time top-level context for everyone
even though the rule only applies to a subset of files).

Candidate path-scoped rules from this session's learnings:

- `.claude/rules/ts-tools.md` with
  `paths: ["tools/**/*.ts"]` — the SQLSharp
  dependencies-as-interface DI pattern (currently in
  memory file alone; promoting to a path-scoped rule
  would auto-load when authoring TS tools).
- `.claude/rules/test-fixtures.md` with
  `paths: ["**/*.test.ts", "tools/**/fixtures/**"]` — the
  test.each + DST + fixture-driven pattern (currently
  unsubstantiated learning).
- `.claude/rules/memory-files.md` with
  `paths: ["memory/*.md", "memory/MEMORY.md"]` — memory
  file authoring conventions (frontmatter, MEMORY.md
  pair-edit, no-duplicate-link-target, ASCII clean).

These would be follow-up speculative-work targets. The
ROI is substantial: the wake-time loading saves the
"recall-the-pattern-from-memory-file" step every time
Claude touches matching files.

# Composes with

- `memory/feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md`
  — that memo's pointer-target list was incomplete
  (missing `.claude/rules/` direct-load case). This memo
  fills the gap. The two compose: load-bearing learnings
  must reach EITHER (a) CLAUDE.md, OR (b) a pointer from
  CLAUDE.md, OR (c) `.claude/rules/<topic>.md` (also
  wake-time direct-loaded), OR (d) skill/agent/memory
  with appropriate routing.
- `memory/feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`
  — the answer here came from search-first-authority
  (canonical Anthropic doc fetched via WebFetch), not
  from training-data assumption. Worked example of the
  rule.
- `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
  — substrate-or-it-didn't-happen at the directive layer;
  this memo + the meta-rule memo are the same discipline
  at the loading-mechanism layer.

# What this rule does NOT do

- **NOT a directive to convert all memory files to
  `.claude/rules/`.** Memory files have their own
  legitimate role (history, attribution, lineage,
  rationale-too-long-for-rules). The rule says: when a
  rule is path-scoped, `.claude/rules/<topic>.md` is the
  better landing than a memory file with a CLAUDE.md
  pointer.
- **NOT a deprecation of CLAUDE.md or memory files.**
  Different surfaces serve different scopes. The taxonomy
  ENRICHES the landing options; doesn't replace any.
- **NOT a claim about Claude.ai.** This taxonomy is
  Claude Code-specific. Claude.ai (the chat product) has
  its own memory architecture (Projects, Memory feature)
  that is separate.
- **NOT a claim about other AI harnesses.** Codex,
  Cursor, Gemini CLI all have their own surfaces. The
  per-harness `.claude/rules/` analogue is harness-specific.

# Factory-owned substrate-discovery — `tools/.../substrate-discovery.ts` as **fallback** to harness-native discovery (NOT equal alternative)

**Preference order** per the human maintainer 2026-05-01
follow-up: *"if the skill router works that's pretty
agent/anthropic/harness native and i like that"* +
*"live off the land"*:

1. **Default**: live off the land — use harness-native
   discovery (skill router for `.claude/skills/`, rule
   auto-load for `.claude/rules/` if confirmed by canary,
   MEMORY.md auto-load for memory index). Anthropic-supplied
   mechanisms are agent-native; if they work, we use them.
2. **Fallback (only if harness-native is insufficient)**:
   build `tools/substrate-discovery/discover.ts`. Only
   invoked when the canary test shows rules don't auto-load,
   or the buddy-test shows the router skips relevant skills.

The canary test (Phase 0) is the discriminator. If
harness-native works → live off the land; substrate-
discovery.ts is unnecessary substrate. If harness-native
fails → factory-owned tool fills the gap.

Original framing of the proposal (preserved for context):

The human maintainer's prior message in the same cluster:
*"the skill router becomes the ONLY automatic discovery
mechanism the other idea is our own substrate-discovery.ts"*.

## Multi-harness reframe — substrate-discovery.ts as the cross-harness fallback

The human maintainer 2026-05-01 follow-up: *"we are going
to have to solve this for every harness, maybe the right
general solution is substrate-discovery.ts in claude.md and
agents.md and don't use native skills use native skills for
each harness and only fallback to .ts on harnesses without
skill router lookup. maybe we can improve skill router
lookup over time?"*

The "live off the land" preference applies **per harness**,
not globally. Each harness uses its native discovery
mechanism where available; substrate-discovery.ts is the
factory-owned cross-harness fallback for harnesses without
native router.

Concrete shape:

- **Claude Code**: native `.claude/skills/` router (canary +
  buddy-test verify it works); `.claude/rules/` direct-load
  (canary verifies). Use native; substrate-discovery.ts is
  optional (still useful for cross-substrate inventory the
  router doesn't unify).
- **Codex / OpenAI**: AGENTS.md is the conventional bootstrap
  surface. No equivalent of Claude Code's skill router.
  Substrate-discovery.ts becomes the primary discovery
  mechanism, pointed at from AGENTS.md.
- **Cursor**: has `.cursor/rules/` (similar to `.claude/rules/`
  by convention). Whether Cursor auto-loads them like Claude
  Code does is a separate empirical question — would need a
  per-harness canary.
- **Gemini CLI**: GEMINI.md is the bootstrap surface. No
  router; substrate-discovery.ts via GEMINI.md pointer.
- **Other harnesses**: same pattern — pointer from the
  harness's bootstrap doc to substrate-discovery.ts.

The architectural principle: substrate-discovery.ts becomes
the **harness-portable** discovery layer, pointed at from
both CLAUDE.md and AGENTS.md (and any other harness bootstrap
doc). Native routers are first-tier discovery where they
exist; the factory tool is second-tier (always available)

+ cross-substrate (covers what the native router misses).

Iterative improvement angle: the human maintainer 2026-05-01:
*"maybe we can improve skill router lookup over time?"* —
the skill router's behavior is harness-controlled but its
INPUT (skill descriptions) is ours. Carved-sentence
orthogonal descriptions (per the buddy-test design from
earlier this session) improve router reliability over time
without requiring harness changes.

Sequencing under multi-harness reframe:

- **Phase 0 (now)**: canary tests `.claude/rules/` auto-load
  in Claude Code. Discriminates whether Claude Code can fully
  "live off the land" or needs the factory tool too.
- **Phase 1**: build `tools/substrate-discovery/discover.ts`
  v0 — useful regardless of canary outcome (cross-substrate
  inventory, harness-portable).
- **Phase 2**: per-harness canaries for Cursor / Codex /
  Gemini if those harnesses are added to the buddy-test
  matrix.
- **Phase 3**: iterate skill descriptions toward
  carved-sentence orthogonality based on buddy-test results.

The skill router is harness-supplied. Its reliability,
description-matching algorithm, and even path discovery
(`.claude/skills/<name>/SKILL.md` only — empirically tested)
are Anthropic-controlled. If the buddy-test reveals the
router's matching is inconsistent across description
variants, or if `.claude/rules/` auto-load doesn't work in
our harness, we lose deterministic substrate discovery on
the Anthropic-supplied path.

The factory-first-class alternative
(per `feedback_first_class_for_us_not_for_our_host_portability_over_host_coupling_aaron_2026_05_01.md`):
build our own substrate-discovery tool. Concrete shape:

```
tools/substrate-discovery/discover.ts
```

A TS+Bun script that:

1. Walks `.claude/skills/`, `.claude/agents/`,
   `.claude/commands/`, `.claude/rules/` (if used), and
   `memory/` — known substrate locations.
2. Indexes frontmatter (`name`, `description`) and
   first-paragraph summaries.
3. Takes a topic / keyword / description query.
4. Returns ranked matches with path + summary so the caller
   can read targeted files.

Properties this gives us that the skill router can't:

- **DST-grade-A**: pure function over filesystem state;
  same input → same output; testable with fixtures (per
  the SQLSharp pattern + the dynamic-bash → TS migration
  trajectory).
- **Portable**: runs in any TS+Bun environment; not tied
  to Claude Code; usable from Codex / Gemini / Cursor
  harnesses if they invoke `bun
  tools/substrate-discovery/discover.ts <query>` as a
  shell command.
- **Inspectable**: the matching algorithm is in our
  source; we can tune it (string match → fuzzy match →
  embedding similarity, in escalating phases).
- **Deterministic at ranking**: unlike a router whose
  decisions are driven by an LLM's relevance judgment, a
  TS scorer over frontmatter is reproducible.
- **Composes with the inventory-via-router CLAUDE.md
  bullet**: instead of "search the skill router," the
  bullet's instruction becomes "run `bun
  tools/substrate-discovery/discover.ts <topic>`" — a
  mechanical step the model can always execute.

Failure modes the factory-owned tool addresses:

- Skill router skips a relevant skill because the
  description didn't match the model's framing →
  factory tool's deterministic scoring catches it.
- `.claude/rules/` doesn't auto-load in our harness (per
  the canary test pending) → factory tool reads them
  directly regardless of harness behavior.
- Memory files are read-on-demand → factory tool surfaces
  them at inventory time without separate grep.

Sequencing relative to buddy-test:

- **Phase 0 (now)**: canary test — does Anthropic's
  `.claude/rules/` auto-load work in our harness?
- **Phase 1 (next)**: build `tools/substrate-discovery/discover.ts`
  v0 — even if rules auto-load, the factory tool gives
  cross-substrate inventory the router doesn't.
- **Phase 2**: buddy-test the inventory-via-router
  CLAUDE.md bullet — does fresh-instance Otto reach for
  the factory tool when the bullet says to?
- **Phase 3 (if needed)**: skill-conversion of behavioral
  lessons — informed by Phase 2 results.

This proposal stays in the open-research lane (no
implementation in this commit). Capturing it here so it
doesn't evaporate; the actual TS script is its own future
PR.

# Behavioral-lesson placement — rules beat skills for the goldfish-ontology failure mode

The human maintainer 2026-05-01 follow-up question:

> *"is this good or bad for you remember lessons? would it
> be better memorized as a skill if its behavioral or a
> rule? it's sounds like skill maybe? IDK."*

Honest answer (counter-intuitive): **for lessons I forget,
rules are mechanically better than skills.** Skills sound
like the right fit for behavioral guidance, but the
discriminating axis is *triggering dependency*:

- **Skills** are router-keyed: the model has to recognize
  "this skill applies to my current task" before the
  router surfaces it. The recognition step requires
  remembering the skill exists.
- **Rules** (CLAUDE.md, `.claude/rules/` without `paths:`)
  have no triggering dependency. They're loaded at session
  start regardless of what the model thinks.
- **Path-scoped rules** (`.claude/rules/` with `paths:`)
  trigger on file-system path-match, which is mechanical
  (no recognition).

The goldfish-ontology failure mode IS the failure of
recognizing existing substrate. Skills compound that
failure (the router needs me to remember the skill);
rules sidestep it (in context whether I remember or not).

Worked example from this session: the TS-vs-bash
discipline. The `feedback_prefer_ts_scripts_over_dynamic_bash_*`
memory file existed for the entire session before the
CLAUDE.md bullet landed. I kept reaching for inline bash
across multiple ticks despite the memory file's existence
— because reading a memory file requires recognizing I
should look for it. The CLAUDE.md bullet (PR #1153) fixed
the recurrence because the discipline became
pre-loaded substrate that future-Otto can't miss on wake.

A skill version of the same lesson would not have fixed
it: I would have had to remember "let me check if there's
a TS-vs-bash skill" — exactly the recognition step I
keep failing.

**Rule of thumb for behavioral-lesson placement:**

- **"I keep forgetting to do X"** → CLAUDE.md bullet (or
  `.claude/rules/`). Triggering-independent surface.
- **"Apply X pattern when working with Y files"** →
  `.claude/rules/<topic>.md` with `paths: [Y]`. Mechanical
  trigger.
- **"Multi-step procedure for task T"** →
  `.claude/skills/<name>/SKILL.md`. User invokes; model
  follows.
- **"Role X has responsibilities Y, Z"** →
  `.claude/agents/<name>.md`.
- **"Historical context / why-we-did-X / per-tick
  narrative"** → memory files, history docs.

This composes cleanly with the meta-rule
(`feedback_learnings_must_land_in_claude_md_or_pointer_aaron_2026_05_01.md`):
the meta-rule says load-bearing learnings need
wake-time-discoverable landing; this rule-of-thumb says
*which* wake-time surface fits the lesson's failure-mode
shape.

# Carved sentence (candidate, not seed-layer yet)

*"Three loading mechanisms across multiple surfaces.
CLAUDE.md and (per docs, unverified) rules direct-load.
Path-scoped rules lazy-load on glob-match. Skills
router-load via description. Memory loads on demand. For
lessons you forget, pick a triggering-independent surface
that actually loads — rules beat skills if auto-load
works; the canary verifies."* (Synthesis 2026-05-01.)

(Marked candidate per CSAP. Has not been multi-domain-tested.
Promotes via Razor + CSAP under DST grading on cadence,
not by maintainer fiat.)

Sources:

- [Claude Code memory documentation — code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory) (WebFetch 2026-05-01)
