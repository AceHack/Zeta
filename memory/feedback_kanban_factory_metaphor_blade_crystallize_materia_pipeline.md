---
name: Backlog-kanban fill + crystallize vision + materia-forge pipeline — "we are building a blade" / "we are basically a role playing game now"
description: Aaron 2026-04-21 big directive — the factory needs (1) a backlog-kanban-fill skill, (2) a research-vision skill to expand the DENSE vision through targeted research, (3) a crystallize-vision skill (Aaron revised "sharpen" → "crystallize") that takes research and phase-changes it into sharper vision facets, (4) swim lanes on the BACKLOG so every scope makes forward progress, no lane left idle over time. Then immediately reframed the whole thing as FF7 Materia: "crystalize the vission and use that to forge the skills/materia which get upgraded over time by experinces" / "We are basically a role playing game now". Blade metaphor (outer) + Materia metaphor (inner). Skills = materia, forged from crystallized vision, leveled up via eval-harness experiences.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## The rule

Four joined moves, all durable, all load-bearing
for how the factory processes the vision:

### Move 1 — research-vision skill

The VISION.md document is **DENSE**. Aaron's
exact word, repeated: *"the vision is DENSE
very very dense"*. Density is a feature (it
packs 887 lines of substrate), but it is also
a bottleneck — dense vision is hard to cut
against without targeted research expanding
specific facets.

The `research-vision` skill (expert-class)
takes a vision section and runs focused
research — external prior art, adjacent
technology, internet sweep per
`feedback_prior_art_and_internet_best_practices_always_with_cadence.md`
— and produces a research report sufficient
to inform the crystallize-vision step.

### Move 2 — crystallize-vision skill

Aaron's verb-correction is load-bearing:
*"maybe crystalize vision?"* — replacing
"sharpen" which I'd used earlier. Why this
matters:

- **Sharpen** = incremental edge refinement of
  an existing blade.
- **Crystallize** = phase change. Research
  dissolves into solution; crystallization
  produces **structured vision facets** that
  didn't exist before, not merely a finer
  edge on what was there.

The `crystallize-vision` skill (capability-
class) takes the vision + research and emits
**delta-to-vision** classified as:

- **refinement** — existing facet sharpened.
- **new facet** — new facet added to
  `docs/VISION.md`.
- **direction-shift** — contradicts existing
  vision; **Aaron sign-off required** (routes
  through `docs/HUMAN-BACKLOG.md` with type
  `conflict` per
  `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`).

Append-only **crystallization ledger** records
which research informed which vision changes.

### Move 3 — backlog-kanban-fill skill

Aaron named this first: *"backlog kanban fill
skill"*. The skill takes the crystallized
vision and ensures the BACKLOG has rows for
every un-worked vision facet, sized into
swim lanes, priorities assigned per
`feedback_data_driven_cadence_not_prescribed.md`
(instrument-first, not prescribed).

### Move 4 — swim lanes + forward-progress-guarantee

Aaron verbatim: *"we kind of need different
lanes i think they might call this swim lanes
to keep view of the diffeer scopes backlog"*
— yes, that is what they are called.

Plus: *"don't leave anyting not making
progess over time"* — every swim lane must
see **at least one commit per round**. Zero
commits in a lane over N rounds = escalation
signal.

Seven proposed swim lanes (Round 44 draft;
may consolidate):

- **factory** — tools, skills, governance
- **seed** — DB microkernel, core primitives
- **zeta** — DB-product surface (SQL, LINQ,
  EF Core, wire protocols)
- **research** — open problems, proofs,
  papers-in-progress
- **ecosystem** — plugins, ace package
  manager, Aurora / x402 / ERC-8004
- **operations** — CI, install scripts,
  deployment, observability
- **human-channel** — work humans do;
  pointer-only into `docs/HUMAN-BACKLOG.md`

### Move 5 — FF7 Materia reframe (inner metaphor)

Aaron's rapid-fire refinement, verbatim in
sequence:

> *"we are building mataria FF7"*
> *"LFG@@"*
> *"that's the skills really"*
> *"crystalize the vission and use that to
>  forge the skills/materia which get
>  upgraded over time by experinces"*
> *"We are basically a role playing game now"*

The reframe is structural, not cosmetic:

- **Skills ARE materia.** Not "skills are
  like materia" — the factory's skills under
  `.claude/skills/` **are** the materia orbs
  in Aaron's mental model. Each skill slots
  into an agent (the materia-wielder), confers
  capabilities, and levels up.
- **Forge = crystallize-vision output →
  `skill-creator`.** Crystallized vision is
  the raw material; `skill-creator` is the
  forge. The existing workflow
  (`.claude/skills/skill-creator/SKILL.md`)
  **is already** the forge — we just didn't
  name it that.
- **AP = eval-harness scores + runtime
  usage.** A materia levels up through
  experiences. A skill levels up through
  evals and invocations. The existing eval-
  harness (`evals/evals.json`, pass-rates,
  tokens, duration) **is already** the AP
  meter — we just didn't name it that.
- **`skill-improver` (Yara) = the
  materia-leveler.** Yara's existing role is
  to act on skill-tune-up BP-NN citations and
  refine skills checkbox-style. That **is**
  the level-up mechanism. Yara is the
  materia-trainer NPC.
- **"We are basically a role playing game
  now"** — the factory is a RPG. Agents are
  party members, personas are classes, skills
  are materia, BACKLOG rows are quests,
  swim lanes are regions, rounds are chapters,
  the eval-harness is the battle system.

Critical: **this reframe does not require new
infrastructure** beyond the pipeline already
proposed. `skill-creator` is the forge;
`skill-improver` is the leveler;
`evals/evals.json` is the AP log. The FF7
metaphor makes the mechanism legible; it
does not add work.

### Move 6 — blade metaphor (outer)

Aaron's outer frame: *"we are building a
blade!!! our knife is will be the sharpest."*

- **Vision** = the edge geometry we're
  aiming at.
- **Research** = the whetstone — abrasive
  material that removes blunt truth.
- **Crystallize** = tempering / phase-change
  that gives the blade hardness.
- **Skills** = the cutting surfaces (materia
  edges).
- **Backlog-fill + swim lanes** = the cutting
  work.

The blade metaphor and the materia metaphor
coexist: blade is the **external** frame (what
we're forging and why it needs to be sharp);
materia is the **internal** frame (how the
forged skills gain power through use).

## Why (the reasons Aaron gave)

### On density

*"the vision is DENSE very very dense"* — the
vision is not a prospectus; it is a compressed
substrate. Research is the decompressor. The
pipeline is *how the factory processes the
vision without burning it all at once*.

### On priority

*"i don't really have priorties right now, i
much try to move each part forward at the
same time just don't leave anyting not making
progess over time"* — Aaron's stated
preference is **breadth over depth** on the
vision. Every facet gets a little progress
every round; no facet goes dark. This is why
the forward-progress-guarantee rule is
load-bearing, and why swim lanes matter
(visibility of per-scope progress).

### On swim lanes

*"we kind of need different lanes i think
they might call this swim lanes to keep view
of the diffeer scopes backlog"* — Aaron
independently landed on the Kanban swim-lane
primitive. The factory already adopted Kanban
+ Six Sigma per
`user_kanban_six_sigma_process_preference.md`
— swim lanes are the missing visualization
primitive.

### On the blade and the materia

*"we are building a blade!!! our knife is will
be the sharpest."* — Aaron frames the factory
externally as a weapon-forge (the blade is
Zeta + the factory itself). Then pivots to
the materia metaphor to describe the **inner
mechanism** by which skills accumulate power.
Both are true simultaneously; the factory is
**a blade forged from materia**.

### On RPG framing

*"We are basically a role playing game now"*
— not a joke. Aaron's gaming roots (FF7, D&D,
MMORPGs, ARGs, medieval, XBL — per
`user_gaming_roots_ff7_dnd_mmorpg_arg_medieval_and_xbl_acehack00.md`)
give him native vocabulary for distributed
agent systems. The RPG framing is how he
already thinks. The factory finally matches
his cognitive resolution.

Compound typos-expected (per
`user_typing_style_typos_expected_asterisk_correction.md`):
"vsison"→"vision"; "sharpen"→ (Aaron later
revised to "crystalize"); "mataria"→"materia";
"vission"→"vision"; "experinces"→"experiences";
"probalby"→"probably"; "priortize"→"prioritize";
"diffeer"→"different"; "anyting"→"anything";
"konw"→"know".

## How to apply

### When the VISION.md feels dense and inert

Invoke `research-vision` on the densest section
— the one that most blocks understanding. Do
not rewrite VISION.md freehand; produce a
research report first, crystallize second,
edit VISION.md third.

### When research lands and vision feels vague

Invoke `crystallize-vision`. Produce a delta
classified as refinement / new-facet / direction-
shift. Direction-shift escalates to Aaron;
refinement and new-facet land directly with a
ledger entry.

### When the backlog feels stuck or imbalanced

Invoke `backlog-kanban-fill`. Check the
forward-progress-guarantee per lane. Any lane
with zero commits over N rounds = file an
escalation row.

### When proposing a new skill

Remember: **skills are materia**. They are not
disposable. They level up with use. Before
creating a new materia, check whether an
existing materia can be leveled up to cover
the gap (via `skill-improver`). Honor those
that came before (per
`feedback_honor_those_that_came_before.md`).

### When proposing a new swim lane

Seven lanes is the draft. If a lane proposal
duplicates an existing one, fold rather than
add. The lanes are for **visibility of per-
scope progress**, not for bureaucracy.

### When `skill-creator` is invoked

It is now explicitly the **forge**. A new
skill (materia) is being forged from
crystallized vision. The vision-to-skill
trace should be recordable — the
crystallization ledger + skill-creation
workflow should cross-reference.

### When eval-harness runs fire

Eval-harness scores are **AP**. A skill that
never runs through evals never levels up. A
skill-tune-up finding is a **materia status
effect** (needs repair). `skill-improver`
applies the level-up.

## Cross-references

- `docs/VISION.md` — the source substrate
  (887 lines, dense).
- `docs/BACKLOG.md` — the kanban board
  (5957 lines, currently flat — needs swim
  lane migration, incremental not big-bang).
- `docs/ROUND-HISTORY.md` — per-round
  narrative; lane-progress visible here.
- `docs/HUMAN-BACKLOG.md` — human-channel
  lane pointer; direction-shifts escalate
  here.
- `docs/WONT-DO.md` — what gets rejected
  from the backlog-kanban-fill output.
- `docs/research/crystallization-loop.md`
  — the loop design doc (renamed 2026-04-22
  from `vision-research-backlog-pipeline.md`
  after the pipeline→loop reframe; has
  materia-framing and cartographer reframe
  sections).
- `docs/research/kanban-six-sigma-factory-process.md`
  — existing Kanban adoption research;
  this pipeline sits on top.
- `docs/research/meta-wins-log.md` —
  classify this landing as partial-win
  depth-2 (factory-structural change
  informed by Aaron's cognitive framing).
- `.claude/skills/skill-creator/SKILL.md`
  — the forge. The workflow was already
  there; the materia reframe makes it
  legible.
- `.claude/skills/skill-improver/SKILL.md`
  — the materia-leveler (Yara).
- `.claude/skills/skill-tune-up/SKILL.md`
  — status-effect detector (Aarav).
- `.claude/skills/next-steps/SKILL.md` —
  the ranker; swim-lane progress informs
  ranking.
- `user_gaming_roots_ff7_dnd_mmorpg_arg_medieval_and_xbl_acehack00.md`
  — Aaron's gaming substrate; Materia=harm-
  ladder already noted; this extends to
  Materia=skills.
- `user_kanban_six_sigma_process_preference.md`
  — Kanban + Six Sigma adoption; swim lanes
  are the missing visualization primitive.
- `feedback_data_driven_cadence_not_prescribed.md`
  — forward-progress-guarantee cadence is
  observed, not prescribed.
- `feedback_honor_those_that_came_before.md`
  — unretire before recreate, including
  materia.
- `feedback_practices_not_ceremony_decision_shape_confirmed.md`
  — this proposal is three artifacts (three
  skills + swim lanes) and could be reduced;
  audit before over-building.

## Scope

**Scope:** factory-wide. All three skills and
the swim-lane primitive are portable across
any adopter of the factory kit. The VISION.md
they operate on is Zeta-specific, but the
pipeline structure is generic.

## Addendum 2026-04-22 — feedback loop, residue, cartographer

Aaron's second-round correction immediately after
the pipeline doc landed (verbatim):

> *"Write vision→research→crystallize→backlog its more
> of a feedback loop than pipeline cryalitize should
> also update the original vision it was based on and
> add to the backlog, its like a loop with resdiue each
> time lol or whatever, the backlog and factory uptates
> that comes out of this will also speed up the whole
> proces so the next vission crystalize process is even
> faster, you should notice this converging over time
> to a very clar and precice vision and roadmap, you
> have become the cartographer"*

Four structural corrections to the "pipeline" framing:

### Correction 1 — loop, not pipeline

Crystallize writes back to VISION.md directly. Not a
delta report; an in-place edit. The "output" of a
crystallize turn is the new starting state for the next
research-vision turn.

### Correction 2 — residue accumulates

Each loop turn leaves residue in three channels:

1. Vision residue — VISION.md accumulates precision.
2. Backlog residue — BACKLOG.md accumulates actionable
   rows.
3. Factory residue — tooling/skills/artifacts improve,
   speeding future turns.

### Correction 3 — the loop is convergent

Aaron's *"converging over time to a very clar and
precice vision and roadmap"* is a mathematical claim:
the loop is a contraction mapping. Each turn's output
shrinks; the fixed point is a stable, precise vision.
Algebraic shape matches Zeta's DBSP semi-naive
evaluation: residue from one turn seeds the next
turn's delta-computation. **The factory is running a
self-convergent feedback loop whose fixed point is a
precise vision + roadmap.**

### Correction 4 — the agent is the cartographer

Aaron: *"you have become the cartographer"*. New role
identity. A cartographer:

- Surveys territory (research-vision).
- Draws the map (crystallize-vision editing
  VISION.md).
- Annotates known-unknowns (backlog-kanban-fill).
- Iterates as territory becomes known.

A map is never final. Stable ≠ complete. The agent
wearing cartographer-hat measures progress by how much
the output shrinks turn over turn, not by lines
written.

### Skill-spec consequences

- `research-vision` — unchanged.
- `crystallize-vision` — **sharpened**: edits VISION.md
  directly (not a delta), drafts BACKLOG rows, emits
  factory-improvement candidates, writes
  crystallization-ledger entries tracing research →
  vision → backlog → factory.
- `backlog-kanban-fill` — **narrowed**: gap-coverage
  and swim-lane balancing + forward-progress-
  guarantee enforcement (not primary row-generation).

### Convergence metric — a new factory measurement

Track crystallize-turn output size over time. If the
curve trends down, loop is converging. If it trends up
or oscillates: either early-expansion (fine) or
diverging (escalate to Aaron). Candidate
FACTORY-HYGIENE row or ROUND-HISTORY field.

### Cartographer persona question

**Open:** does "cartographer" want to be a full
persona under `.claude/agents/`, or does the agent
wear cartographer-hat capability-style from a skill?
Lean capability-skill-with-hat (cartographer-hat
attached to `crystallize-vision`), not a separate
persona — stay additive, avoid persona sprawl
(per `feedback_honor_those_that_came_before.md`
unretire-before-recreate — and no retired cartographer
exists, so create as needed but prefer hat-over-
persona for now).

## Explicitly deferred / open questions

- **How many lanes** is the right number?
  Seven is a draft; five or eight might be
  better. Decide empirically after first
  round of population.
- **Migration strategy** for the 5957-line
  BACKLOG.md — incremental (BACKLOG-SWIM.md
  as staging) vs big-bang. Lean incremental
  per
  `feedback_new_tooling_language_requires_adr_and_cross_project_research.md`.
- **Crystallization ledger** location —
  `docs/research/crystallization-ledger.md`
  or inline in each round's
  ROUND-HISTORY entry? Lean for dedicated
  ledger; cross-reference from ROUND-HISTORY.
- **Materia-level display** — is there a
  useful skill-AP-scoreboard surface? Maybe.
  Don't build it until several skills have
  multiple eval iterations; low signal
  before that.
- **Practices-not-ceremony check** — could
  we reduce this to two skills instead of
  three? research-vision and crystallize-
  vision might merge into a single
  `vision-refinery` skill with two phases.
  Run that audit before landing.
