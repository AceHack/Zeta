---
name: STRATEGIC DIRECTIVE — PROGRESSIVE ADOPTION STAIRCASE — new person / company interest can adopt the ABSOLUTE SMALLEST piece first (maybe a plugin to their existing AI harness), then progressively adopt more and more of our technology in LAYERED COMPOSABLE BITS or LARGE CHUNKED PACKAGES; the entire Zeta factory setup is one of the LARGEST templates (requires all layers composed), but the factory is structured as a hierarchy of smaller and smaller pieces so each adoption layer has a minimal entry cost + clear next-step path; applies to skills, memories, agents, governance patterns, tooling, workflows, event-stream emission (Otto-270), Bayesian curriculum (Otto-267/269); progressive adoption is a FUNCTION of the factory's substrate design, not a separate add-on; Aaron Otto-274 2026-04-24 "backlog progressive adoption, so a new person / company insterest can adapot the absoulte smallest piece first (maybe a plugin to their harness?) then progressivly and very easily start to take advante of more and more of our technology in layered composable bits or large cheunked packages like the entire setups we have he being one of the largest template setup, requires all the layers and compositions but composed of smaller and smaller hierarchy"
description: Aaron Otto-274 strategic directive — factory must be adoptable progressively from tiniest-unit to entire-template. Informs every design decision: every new component must fit the staircase AND each level must have trivial entry cost. File as BACKLOG; save durable.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The directive

**Progressive adoption must be designed-in, not
bolted-on.** A new person or company interested in
Zeta's factory technology can adopt the ABSOLUTE
SMALLEST piece first (e.g. one plugin for their
existing AI harness) and progressively add more
via layered composable bits or large chunked
packages.

**The entire Zeta setup is one of the LARGEST
templates** — requires all layers composed. But the
factory is structured as a hierarchy of smaller and
smaller pieces, so each adoption layer has a minimal
entry cost.

Direct Aaron quote 2026-04-24:

> *"backlog progressive adoption, so a new person /
> company insterest can adapot the absoulte smallest
> piece first (maybe a plugin to their harness?) then
> progressivly and very easily start to take advante
> of more and more of our technology in layered
> composable bits or large cheunked packages like
> the entire setups we have he being one of the
> largest template setup, requires all the layers
> and compositions but composed of smaller and
> smaller hierarchy. backlog"*

## The adoption staircase (draft — refine per adopter feedback)

### Level 0 — single skill / plugin

**What**: one Claude Code plugin or skill that
works standalone in an existing harness.

**Entry cost**: ~5 minutes (copy one file,
reference it).

**Examples**:
- `skill-creator` skill — for building new skills
- `claude-md-steward` skill — for CLAUDE.md hygiene
- `.claude/agents/harsh-critic.md` — a review agent

**Value prop**: solves one specific problem with
minimal investment.

### Level 1 — skill bundle (composable mini-kit)

**What**: a related set of skills + agents that
work together for one discipline.

**Entry cost**: ~30 minutes (copy a folder,
reference in settings).

**Examples**:
- Review-disciplines bundle: harsh-critic +
  spec-zealot + code-reviewer + threat-model-critic
- Build-discipline bundle: verify-audit +
  clean-default-smell + auto-format CI scripts
- Memory-discipline bundle: claude-md-steward +
  skill-tune-up + skill-creator

**Value prop**: coordinated set; composes among
itself and with adopter's existing harness.

### Level 2 — governance template

**What**: governance + hygiene + AGENTS.md +
CLAUDE.md template with role-refs ready to fill in.

**Entry cost**: ~half a day (adapt role-refs to
adopter's context; wire into their repo).

**Examples**:
- Factory-governance template: GOVERNANCE.md
  section-header template + AGENTS.md + CLAUDE.md
  + hygiene-history + round-history structure
- Personas template: `memory/persona/**` structure
  + canonical agent frontmatter schema

**Value prop**: adopter gets the factory's governance
shape without recreating it.

### Level 3 — counterweight-discipline layer

**What**: Otto-264 rule-of-balance + associated
counterweight-filing mechanism + standing-audit
tooling.

**Entry cost**: ~1-2 days (wire hygiene audits,
counterweight-BACKLOG rows, memory file discipline).

**Dependencies**: level 0 + 1 + 2 landed.

**Value prop**: the stabilization discipline itself
— progressively makes the adopter's factory
resilient.

### Level 4 — gitnative-sync layer (Otto-261)

**What**: all-GitHub-artifacts-to-gitnative sync
tooling + enhancement-backlog mechanism.

**Entry cost**: ~1 week (per-artifact sync tools,
ADR decisions, `docs/gitnative-sync-enhancement-
backlog.md`).

**Value prop**: adopter's corpus is durable +
host-portable.

### Level 5 — Bayesian curriculum + training corpus (Otto-267/269/270)

**What**: event-stream emission tool + annotation
envelope + training-data extraction + (optionally)
eval-harness + BP curriculum design.

**Entry cost**: ~2-4 weeks (research-grade work).

**Dependencies**: levels 0-4 mature; data volume
aggregated.

**Value prop**: adopter can fine-tune / scratch-train
AI aligned to their factory's disciplines.

### Level 6 — entire Zeta-equivalent setup

**What**: the full thing. Zeta is one instance.
Adopter builds their own instance with their own
domain-specific library.

**Entry cost**: ~months (multi-contributor +
substantial effort).

**Value prop**: adopter has a fully self-hosting
factory + trained model + event stream + ingested
corpus.

## Design principles for staircase coherence

Each level must:

1. **Stand alone** — adopters who only take level N
   still get value without needing N+1.
2. **Add cleanly** — level N+1 composes with N
   without forcing reorganization of N.
3. **Expose seams** — level N documents exactly
   where level N+1 plugs in.
4. **Maintain backwards-compat** (post-v1) OR
   explicitly break with migration guide (pre-v1
   per Otto-266 greenfield).

**Anti-patterns that break the staircase**:

- Tight coupling between levels (adopting N
  requires also adopting M)
- Hidden dependencies (adopter doesn't know level N+2
  is required until mid-adoption)
- Monolithic packaging (no granular adoption;
  all-or-nothing)
- Jargon requirements (level 0 requires understanding
  level 6 to use)

## Factory-internal design implications

**Every new component** gets classified by staircase
level at design time. Components that don't fit any
level need to be redesigned to fit — the staircase
is the structural constraint.

**Every memory file** (Otto-NNN) should indicate
which adoption level it applies at. E.g.:

- Otto-260 `F#`/`C#` preservation → level 2+
  (governance discipline)
- Otto-265 merge-queue counterweight → level 3+
  (counterweight-discipline layer)
- Otto-269 training-time corpus → level 5 (Bayesian
  curriculum layer)
- Otto-274 THIS memory → meta (applies to ALL
  levels' design)

**Every skill** should declare staircase level in
frontmatter so adopters can query "what's available
at level N?"

## Composition with prior memory

- **Otto-263** best-of-both-worlds — adopters
  benefit from both gitnative durability AND
  host-first-class; level 4 (gitnative-sync) makes
  this explicit.
- **Otto-264** rule of balance — level 3 introduces
  the counterweight discipline; composable on top
  of levels 0-2.
- **Otto-267** Bayesian teaching curriculum —
  level 5's goal is adopter's OWN curriculum + trained
  model; Zeta's curriculum is the example, not the
  monopoly.
- **Otto-269** training-time data — level 5
  operationalizes.
- **Otto-270** enriched event stream — level 5's
  data format.
- **Otto-272** DST-everywhere — applies to every
  staircase level; each level is DST-conformant
  unless explicitly demo/sample-scoped per Otto-273.
- **Otto-273** seed-lock policy — every level's
  adopter inherits the prod-vs-dev/test seed-lock
  defaults.
- **Skill library discipline** (skill-creator,
  skill-tune-up, skill-improver) — progressive
  adoption is what makes the library valuable beyond
  Zeta; adopters pick up individual skills at level 0
  and compose upward.

## Backlog-owed

- **P1 BACKLOG row**: `docs/ADOPTION-STAIRCASE.md`
  primary doc — enumerates levels 0-6 with entry
  costs, dependencies, value props, examples.
- **P2**: Per-skill `staircase-level:` frontmatter
  field; skill-tune-up enforces.
- **P2**: Per-memory `staircase-level:` frontmatter
  field; claude-md-steward enforces.
- **P3**: Adopter-facing `README-ADOPTERS.md` at
  repo root walking level 0 → level 6 with
  clickable jumps.

## What Otto-274 does NOT say

- Does NOT mandate every piece of the factory fit
  neatly into one level. Some pieces span levels;
  document the span, don't force fit.
- Does NOT compete with Otto-263 best-of-both-worlds
  — composes: adopter picks which worlds at which
  level.
- Does NOT license Zeta-specific technology leaking
  into generic factory skills. Factory-generic
  (Frontier split per `docs/DECISIONS/2026-04-22-
  three-repo-split-zeta-forge-ace.md`) stays
  Zeta-agnostic; adopters get the generic version.
- Does NOT require running Zeta itself. Adopters at
  levels 0-4 don't need Zeta-the-library at all;
  they get the factory substrate.
- Does NOT apply to the ZETA LIBRARY itself (DBSP
  retraction-native algebra, ZSet, Spine, etc.).
  That's the library; staircase is about the
  FACTORY SUBSTRATE that builds libraries.

## Direct Aaron quote to preserve

> *"backlog progressive adoption, so a new person /
> company insterest can adapot the absoulte smallest
> piece first (maybe a plugin to their harness?) then
> progressivly and very easily start to take advante
> of more and more of our technology in layered
> composable bits or large cheunked packages like
> the entire setups we have he being one of the
> largest template setup, requires all the layers
> and compositions but composed of smaller and
> smaller hierarchy. backlog"*

Future Otto: when designing a new skill, agent,
tool, memory, or workflow, ask: "what staircase
level does this belong to? what's the adoption
path? what's the minimum viable adopter experience
at that level?" If it doesn't fit the staircase,
redesign until it does. The factory's value is
unlocked by progressive adoption; monolithic
packaging defeats the business model.
