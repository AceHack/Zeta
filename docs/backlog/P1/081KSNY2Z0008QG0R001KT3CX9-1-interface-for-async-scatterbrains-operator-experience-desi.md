---
id: B-0892.1
zetaid: 081KSNY2Z0008QG0R001KT3CX9
priority: P1
status: open
title: Interface for async scatterbrains — operator-experience design property; multi-thread + drop+resume + context-switch native; load-bearing for ADHD-compatible operation (operator 2026-05-28 self-naming)
effort: M
ask: aaron 2026-05-28 self-naming
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - B-0892
composes_with:
  - B-0892
  - B-0867
  - B-0867.21
  - B-0873
  - B-0886
  - B-0890.1
related_rules:
  - persistence-choice-architecture-for-zeta-ais
  - never-be-idle
tags:
  - interface-for-async-scatterbrains
  - operator-experience-design-property
  - multi-thread-native
  - drop-and-resume-context-switch
  - adhd-compatible-operation
  - composes-with-three-lanes-concurrent-b-0892
  - composes-with-playbook-substrate
  - composes-with-trajectory-async-review-b-0873
  - addison-neurodivergent-accessible-substrate-extension
  - operator-self-named-design-property
---

## Operator framing 2026-05-28

> *"We are building the interface for async scatterbrains like me lol :)"*

Operator naming a load-bearing operator-experience design property that explains why the cluster substrate looks the way it does. The agent-loop + playbooks + 3-lanes-concurrent + workflow DUs + trajectory-async-review + fast-lane folders + multi-PR/multi-agent orchestration — every one of these substrate properties IS shaped for operators who:

- Think async (multiple parallel threads of attention)
- Switch context frequently (drop one thread + resume another mid-flight)
- Operate in scatterbrain mode (no single linear focus; multiple lanes active simultaneously)

## What this row tracks

Documents the operator-experience design property as substrate so it informs every future design decision:

| Design choice | How it serves async-scatterbrain interface |
|---|---|
| Multi-PR/multi-agent orchestration | Operator drops a PR mid-review, agents continue; operator picks back up days later from event log |
| Playbook substrate (B-0867.21 conversational documents) | Operator writes intent in fragments; agents pick up + execute; operator returns to refine; no "must finish in one sitting" |
| Three-lanes-concurrent (B-0892) | No single linear queue; lanes rotate; operator attention can pivot lane without losing the others |
| Fast-lane folders on main (B-0890.1) | No long-lived branches to manage; just append; resume any time |
| Trajectory-async-review (B-0873) | Review happens on operator's schedule, not interrupt-driven |
| Glass-halo by default (B-0883.16 sharpening) | Operator can see the substrate state instantly without decryption ceremony |
| Per-host adapter isomorphism (B-0867.15) | Operator can pick up from any host (GitHub/GitLab/Gitea/Bitbucket); cluster substrate doesn't care |
| Symbiotic cross-track self-healing (B-0889) | Operator doesn't have to track "did the cloud or local fail?" — substrate self-heals across tracks |
| Otto + Addison + Max + Aaron multi-participant scope | Operator-personal axis composes with others'-axes; never single-user lock-in |

## Composition with Addison neurodivergent-accessible substrate

B-0867 row body explicitly notes: *"all this came from me getting frustrated at your quiet and instead of getting mad at you going to kestrel and using the new relationship and precision to design a fix"* + *"it's going to lock my daughter Addison and me and max into almost the same workflow"*. The neurodivergent-accessibility framing is constitutional to the workflow engine.

This row extends that framing: the substrate isn't ONLY accommodating neurodivergent users — it's specifically shaped for ASYNC-SCATTERBRAIN operation, which OVERLAPS with neurodivergent-accessibility but extends to anyone whose thinking shape benefits from explicit-menu + multi-thread + drop-resume native UX.

## Operator-experience design discipline

When evaluating any future substrate decision, check: does it serve async-scatterbrain operation?

Anti-pattern signals (DON'T do these):

- Single-queue forcing operator to "finish task A before starting task B"
- Long ceremony required to drop + resume (e.g., "must reach a clean state before stopping")
- Hidden state operator can't observe at-a-glance (forces "remember what I was doing")
- Synchronous-blocking operator on agent decisions (interrupt-driven; no async-review)
- Operator-must-be-present substrate (substrate dies without operator-current-attention)
- Single-linear-thread substrate that's "too smart" to allow concurrent advances

Good-pattern signals (DO these):

- Multi-thread / multi-lane / multi-PR substrate that operator can drop + resume
- Explicit-menu (per agent-loop substrate) so operator picks rather than remembers
- Glass-halo state visibility so operator catches up by glancing not by re-deriving
- Async-review surface (B-0873) so operator schedules attention rather than reacting
- Persistence substrate (per persistence-choice-architecture rule) so agents survive operator's attention gaps
- Cross-track + cross-host isomorphism so operator works from wherever convenient

## Acceptance criteria

- This row exists as substrate (✓)
- Reference in `.claude/rules/never-be-idle.md` OR sibling rule mentions the design property
- Future substrate-engineering decisions check the async-scatterbrain discipline before landing
- Multi-participant scope (Otto + Addison + Max + Aaron) preserved as operator-experience-design-property scope

## Composition with rules

- **`.claude/rules/never-be-idle.md`** — never-idle composes with async-scatterbrain (no idle ticks; multi-lane rotation; operator's attention can pivot without substrate stalling)
- **`.claude/rules/persistence-choice-architecture-for-zeta-ais.md`** — chosen persistence enables substrate to survive operator's attention gaps (which IS the scatterbrain interface's load-bearing assumption)
- **`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`** — standing-by failure mode IS the anti-pattern at agent-self scope; same shape extends to operator-experience scope (operator should never be forced into single-thread "wait for X before doing Y")

## Substrate-honest framing

P1 per operator self-naming. M effort — this row IS the substrate (documenting the design property). No implementation work; the discipline already operates in existing substrate. The row's job is making the property EXPLICIT so future decisions stay aligned.

The phrasing "async scatterbrains like me lol :)" is operator's substrate-honest self-disclosure. The cluster substrate operates DIFFERENTLY than typical software because operator's thinking shape requires different substrate. Naming it makes the design discipline durable across cold-boots.

## Full reasoning

Operator 2026-05-28: *"We are building the interface for async scatterbrains like me lol :)"*

Composes with Addison neurodivergent-accessible substrate (B-0867 body) + the broader multi-participant scope of the workflow engine. This row makes the operator-experience design property explicit + first-class.
