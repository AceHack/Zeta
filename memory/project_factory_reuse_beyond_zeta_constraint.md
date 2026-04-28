---
name: Factory reuse beyond Zeta DB — declared CONSTRAINT (not primary goal today)
description: Aaron 2026-04-20 — the Zeta software factory and its codified practices should be usable on any project, not just the Zeta database. Not the primary goal right now, but a constraint on every factory-level decision. Starts a new dimension of split (generic vs Zeta-DB-specific) layered on top of the existing project-vs-library split.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
2026-04-20 — Aaron, mid-round-43, after the invariant-
substrates doc landed:

> "also we should start thinking about how to make the software
> factory part of Zeta and all it's codified practices usable on
> any project not just the Zeta database, this is not our
> primary goal at all right now but we can at at least start
> splitting out things beween project specific and generic when
> it comes to our software factor we kind of alreay do this but
> this is adding another dimensino of split software factory
> reuse without the Zeta db"

Follow-up one turn later: **"that's a constraint."**

## Status

- **Primary goal?** No. Explicitly not round-43 scope.
- **Constraint on factory-level decisions?** Yes. Load-bearing.
- **Elevation 2026-04-20 late:** Aaron explicitly confirmed
  *"agree 100% The factory-vs-Zeta separation becomes the
  load-bearing concern"* — the separation itself (not just
  the constraint) is now called out as load-bearing. In the
  Event-Storming-adoption decision this meant: ES vocabulary
  lands at the factory level FIRST, then bridges into Zeta —
  never the reverse. Use that sequencing as the template for
  any future vocabulary / skill / persona adoption.
- **Direction of travel?** Split codified practices into
  *generic (portable across projects)* vs
  *Zeta-database-specific (retraction-native / DBSP /
  Z-set / operator algebra)*.
- **Involvement rule?** See
  `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — Aaron wants to be part of the packaging decisions
  because there are no real best practices yet and we
  will be helping to define them.

## What "the factory" means in this scope

The second product named in `docs/VISION.md` — the cross-
platform AI-automated software factory that produces Zeta-
the-database. It is not Zeta-DB. It is the agent set,
skills, governance docs, reviewer roster, verification
stack, and ops patterns that produce Zeta-DB.

Rough split today (not authoritative; informs the factoring
work):

| Factory component | Split |
|---|---|
| AGENTS.md / GOVERNANCE.md / CLAUDE.md bootstrap pattern | generic |
| `.claude/skills/*` most skills | generic-with-Zeta-examples |
| `.claude/skills/prompt-protector/` | mostly generic |
| `.claude/skills/skill-tune-up/` | generic (already has portability-drift criterion) |
| `.claude/skills/verification-drift-auditor/` | generic pattern, Zeta sources |
| `.claude/agents/*` personas | mostly generic |
| `docs/AGENT-BEST-PRACTICES.md` (BP-NN) | generic |
| `docs/CONFLICT-RESOLUTION.md` protocol | generic |
| `docs/INVARIANT-SUBSTRATES.md` posture | generic; layer map is Zeta-specific |
| `docs/FORMAL-VERIFICATION.md` | Zeta-specific tools, generic pattern |
| Zeta-DB operator-algebra skills, spec/proof content | Zeta-specific |
| Retraction-native / DBSP / Z-set vocabulary | Zeta-specific |
| `openspec/specs/**` behavioural specs | Zeta-specific |
| `tools/tla/` `tools/lean4/` Zeta specs | Zeta-specific |
| Benchmark harness, eval harness | generic |
| CI workflow files | mostly generic (devops patterns) |

## Existing infrastructure

- **`skill-tune-up` already has a "Portability drift"
  criterion** (criterion 7 in the skill) that flags skills
  hard-coding Zeta paths / module names / governance sections
  when they don't declare `project: zeta` in frontmatter.
  This is the toehold.
- **Skill frontmatter convention:** `project: zeta` declares
  Zeta-specific; absence implies generic. This is not yet
  widely audited beyond skill-tune-up's nag.

## Event Storming as first deliberate factory-generic adoption

Event Storming is the first strategy to be adopted
*deliberately factory-first*, not as a retroactive
Zeta-vocabulary pass. The skill-group (expert / teacher /
auditor + capability skill) will be declared factory-generic
(no `project: zeta`). This establishes the pattern:

- **Phase A (factory, portable):** skill authoring, bootstrap
  integration, generic vocabulary.
- **Phase B (bridge):** glossary + alignment docs that serve
  both factory consumers and Zeta consumers.
- **Phase C (Zeta-specific):** operator-algebra spec and
  VISION gain a one-line bridge.

Any future strategy / technology adoption should follow the
same ABC phasing. See
`docs/research/event-storming-evaluation.md` §3.3.

Aaron (2026-04-20 late, automated-UX observation): *"also it
can make for one hell of a UI, event storming is lovely user
experience when automated."* An automated ES UX is a factory-
differentiator candidate — stickies emerge from chat in
real time, facilitator agent asks playbook questions. Filed
as ES-automated-ui-001 (speculative, Effort L).

## Open questions (do NOT decide unilaterally — see feedback)

- **Packaging unit.** Single meta-repo with a generic
  subtree? `zeta-factory` extracted as a template repo?
  A plugin-style loader the way Claude Code plugins work?
- **Dependency shape.** Does the generic factory depend on
  nothing? Depend on a Zeta-DB-specific overlay layer? Or
  does each consuming project overlay its own
  project-specific layer on a generic base?
- **Best-practices freshness.** Aaron's
  `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  rule says per-tech expert skills must keep a living best-
  practices artifact. How does a reusable factory keep these
  fresh when it spans projects that will not all use the
  same technology stack?
- **Governance overlay.** AGENTS.md, GOVERNANCE.md, and
  CLAUDE.md are partly Zeta-specific (`TreatWarningsAsErrors`
  build gate; specific doc tree). Do we extract a generic
  template and provide overlays?
- **Agent/persona reuse.** Personas like Kenji (architect) are
  generic. Personas like the formal-verification-expert are
  generic. But Zeta-specific personas for the operator
  algebra should stay in Zeta-DB's overlay.

## Why this is a constraint not a goal

The constraint is: **do not land factory-level decisions
that are irreversibly Zeta-DB-specific when a generic form
is cheap.** When a new skill or governance rule is written,
think at design time: is this a Zeta-DB thing or a factory
thing? If factory, keep it generic or mark the line clearly.

This is the same pattern as existing `project_*` memory
rules — load-bearing direction, applied every round, not
a Round-43-deliverable.

## How to apply

- New skills: default to generic; only set
  `project: zeta` in frontmatter when the scope is
  genuinely Zeta-DB-specific.
- New governance / BP rules: land in generic docs
  (`AGENT-BEST-PRACTICES.md`) unless the rule is about
  the Zeta operator algebra specifically.
- New ADRs: note when a decision is factory-level vs
  Zeta-DB-level.
- Factoring existing content: opportunistic only; do NOT
  scope-creep into a standalone factoring round without
  Aaron's direct direction (see feedback entry).
- Before making factory-reuse packaging decisions:
  **consult Aaron** (see companion feedback memory).

## Related memory

- `feedback_factory_reuse_packaging_decisions_consult_aaron.md`
  — the involvement rule (Aaron wants to co-define the
  packaging best practices since none exist yet).
- `project_factory_as_externalisation.md` — the upstream
  "why the factory exists" framing. The factory is
  externalisation of Aaron's ontological perception; the
  same externalisation mechanism should be usable across
  projects.
- `project_zero_human_code_all_content_agent_authored.md` —
  the vibe-coding invariant. Generalises to: the factory
  lets any project land vibe-coded artefacts under the
  same immune system.
- `project_zeta_as_database_bcl_microkernel_plus_plugins.md`
  — the Zeta-DB microkernel + plugins architecture. The
  factory-reuse split is the analogous pattern applied to
  the factory itself.
