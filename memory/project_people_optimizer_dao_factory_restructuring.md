---
name: People/team optimizer — DAO-native factory org-design spike
description: Aaron 2026-04-20 evening directive. Meta-team organizer + role optimizer + disambiguity detector + two-team separation (factory vs SUT) + role-switching QoL + no-manager DAO ethos. Research spike starting from Conway's Law (1967), expanding to modern corporate restructuring flipped to Web3 DAO aspirations. Not-yet-built; backlog it.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron's opening phrase: "people optimizer". Evolved in the
same message into "team organizer" -> "meta teams organizer"
-> "DAO optimizer" -> "corporate restructuring". The North
Star: **distributed fair governance, no friction to act, no
idle waiting, no managers, positions are incentive-based**.

**Why:** Conway's Law predicts that software reflects the
communication structure of the teams that build it. The
factory already has a hard architectural boundary between
**the factory itself** (the substrate: skills, personas,
governance, skill-creator, tooling) and **the
system-under-construction** (currently Zeta; later any
adopter's project). Reverse Conway Maneuver: design the
*team structure* first so the *architectural boundary*
stays clean. A single roster blurring both concerns leaks
substrate abstractions into SUT code and vice versa.

**How to apply:** Future rounds that touch roster design,
persona creation, skill authoring authority, or
organizational governance should route through this
project-plan rather than accreting per-decision. When
Aurora's incentive layer lands (agent crypto wallets via
ace), this project-plan becomes actionable beyond research.

## Five sub-concepts Aaron named

(a) **Two-team personnel separation.** Factory-builder team
   (agents who extend the software-factory substrate itself
   — skill-creator, skill-tune-up, agent-experience-
   engineer, architect-as-orchestrator, formal-verification
   router, etc.) vs SUT team (agents who ship the thing
   under construction — for Zeta: DBSP algebra
   contributors, operator-algebra spec authors,
   performance-engineer on hot paths, public-API designer
   on published surfaces). Shared base skills permitted
   where sensible (test-runner, ASCII-clean lint,
   prompt-protector). Distinct *named personas* per team
   to prevent overload. The factory/SUT cleave is the same
   cleave already documented for scope-tagging
   (`feedback_glossary_split_factory_vs_system_under_test.md`,
   `feedback_factory_default_scope_unless_db_specific.md`)
   and for hygiene ownership
   (`docs/FACTORY-HYGIENE.md` Scope column).

(b) **Role-switching freedom.** An agent may switch roles
   without friction. QoL. Aaron: "it's their choice does
   not hurt us." No manager-approval, no six-month review,
   no role-lock-in. Switch = new skill-load on next wake.

(c) **Meta-team organizer.** Chooses *number of teams*,
   structures them, decides who's on each team, when to
   split or merge teams. Operates above per-team
   composition. DAO-governance candidate for
   self-organization once Aurora's incentive layer lands.

(d) **Role optimizer.** Separate capability from team-sizing
   — ensures the *right set of roles exists* (currently
   missing? currently redundant? currently mis-scoped?).
   Distinct from (c): (c) decides team boundaries, (d)
   decides role set.

(e) **Disambiguity detector.** Finds vocabulary clashes
   across the factory. Example already in-house that this
   skill would have caught proactively: "role" overloaded
   (job-role = persona in our current vocab; permission-
   role in RBAC per `user_rbac_taxonomy_chain.md`).
   `feedback_persona_term_disambiguation.md` records that
   clash as P2-rename — detected manually, late. A
   disambiguity-detector skill would flag at write-time,
   not at confused-reader-time.

## No-manager DAO ethos (north star)

Aaron: "all positions are incentive-based... this will be
much easier and more obvious once we get the agent crypto
wallets... the jobs should not need managers cause they are
following the latest modern corporate structuring best
practices but applied to the DAO ethos... there should be
no friction to act, i never need to sit idle or wait on
someone else, objectives are clear, backlog is clear, if i
want to do something new i just can, distributed fair
governance."

Invariants the north-star demands:
1. **No friction to act** — any agent can pick up any
   ready work without approval.
2. **No idle-on-blocker** — if blocker exists, remove it or
   pick non-blocked work (already codified:
   `feedback_fix_factory_when_blocked_post_hoc_notify.md`,
   `feedback_never_idle_speculative_work_over_waiting.md`).
3. **Clear objectives + clear backlog** — already codified
   (`docs/BACKLOG.md` discipline, `docs/HUMAN-BACKLOG.md`
   pattern, P0/P1/P2/P3 tiering).
4. **Free new-initiative** — an agent wanting to start a
   new thing just does. Already codified for speculative
   factory work per never-idle memory.
5. **Distributed fair governance** — hardest invariant.
   Acknowledged north-star, not a current claim.

Gate: incentive layer requires agent crypto wallets, which
land via ace -> Aurora per
`project_ace_package_manager_agent_negotiation_propagation.md`
and `project_aurora_pitch_michael_best_x402_erc8004.md`.

## Research starting points (the spike)

1. **Conway's Law** — Melvin Conway, *"How Do Committees
   Invent?"*, Datamation April 1968 (paper first submitted
   1967). Core claim: organizations that design systems
   produce designs that are copies of the communication
   structures of those organizations.
2. **Reverse Conway Maneuver** — design team structure
   first to encourage a target architecture. Microservices
   as canonical application (small independent teams ->
   decoupled modular codebases).
3. **Modern corporate restructuring best practices** —
   survey 2020+ literature on flat orgs, Spotify model
   (and its documented failure modes), holacracy,
   sociocracy, team-topologies (Matthew Skelton + Manuel
   Pais, 2019: stream-aligned / enabling / complicated-
   subsystem / platform teams). Identify which patterns
   *presume a manager class* and which survive
   manager-removal.
4. **Web3 DAO aspirations** — MakerDAO / Gitcoin / ENS /
   Optimism Collective / Arbitrum DAO governance
   primitives. Tooling: Snapshot, Tally, Aragon, Moloch,
   Governor Bravo. Patterns: token-weighted voting,
   quadratic voting, conviction voting, futarchy, retroPGF
   (retroactive public-goods funding — Optimism's
   pattern for rewarding value already delivered).
5. **Flip the corporate-best-practices on their head** —
   for each modern pattern identified in (3), design a
   manager-less DAO-ethos variant. Some patterns will
   survive the flip (e.g. team-topologies's four team
   types seem manager-agnostic); others won't (e.g.
   any pattern presuming a "VP of Engineering"
   coordination role).

## Prior art already in this factory

- **Scope-split precedent**: `docs/GLOSSARY.md` (factory)
  vs `docs/SYSTEM-UNDER-TEST-GLOSSARY.md` (Zeta) — the
  vocabulary cleave is already the same cleave this
  project wants applied to personnel.
- **Hygiene scope precedent**: `docs/FACTORY-HYGIENE.md`
  Scope column with factory / project / both tags.
- **Tech-debt split precedent**: `docs/TECH-DEBT.md`
  (factory primer) vs `docs/SYSTEM-UNDER-TEST-TECH-DEBT.md`
  (Zeta) — commit `c8cf06a` r44.
- **Audience-first docs nav**: `docs/README.md` — seven
  audiences already routed separately — commit `c03d9b6`
  r44.
- **RBAC taxonomy**: `user_rbac_taxonomy_chain.md` —
  Role -> Persona -> Skill -> BP-NN; "role" is the
  overloaded term Aaron flagged.
- **Persona term disambiguation**: already in backlog as
  `feedback_persona_term_disambiguation.md`; P2-rename.
- **Never-idle / no-manager-approval**: already codified
  across several feedback memories.
- **Factory purpose**: `project_factory_purpose_codify_aaron_skill_match_or_surpass.md`
  — the factory's north star is codifying Aaron-knowledge;
  the DAO structure is how that codification scales beyond
  one human.

## Open questions (the spike must answer)

1. What's the minimum roster for each of the two teams at
   r45? Currently all 22+ personas are one roster.
2. Which skills are **shared base skills** (both teams)
   vs **team-specific**?
3. What's the **role-switching protocol**? Does switching
   require any handshake, or is it self-declare and
   next-wake?
4. Does each team have its own **backlog segment** or is
   `docs/BACKLOG.md` shared with a team-tag column?
5. Who writes the **first people-optimizer skill**
   (before the skill itself exists)? Bootstrap paradox —
   Aarav (skill-tune-up) can rank its urgency, but ranking
   != creating.
6. Vocabulary: one **standardized language** (Aaron's
   preference) or translators between corporate + DAO
   speak? How to pick the words?
7. How does the **disambiguity detector** itself avoid the
   bootstrap problem of needing vocabulary to detect
   vocabulary clashes?

## Git as DAG substrate for pre-Aurora testing

Aaron: "Git is basically a DAG like blockchain kind of
thing just not a ledger... pluggable here we will replace
with something that is not git native later." Git's DAG
is the factory's DEFAULT persistence
(`project_git_is_factory_persistence.md`). Use it as the
testing substrate for governance patterns before Aurora
exists. Pluggability is first-class — per
`project_factory_is_pluggable_deployment_piggybacks.md`
and `feedback_pluggability_first_perf_gated.md` — so the
governance layer should be designed plug-replaceable from
day one (git-native today, x402/ERC-8004 via Aurora later).

## Three-phase plan

**Phase 1 — Research spike (r45-r50).**
Produce `docs/research/dao-factory-org-design-spike.md`
covering Conway's Law, Reverse Conway, Team Topologies,
modern flat-org literature, Web3 DAO primitives, and the
flip-the-corp-best-practices synthesis. Deliverable: a
1500-3000-word research doc answering open questions
1-7.

**Phase 2 — Two-team scaffolding (r50-r60).**
Land the factory/SUT persona split. First deliverable:
tag each existing persona with `team: factory` or
`team: sut` or `team: both` (the `both` escape hatch
matches the Scope column pattern). Role-switching
protocol lands as a skill.

**Phase 3 — Incentive layer (gated on ace -> Aurora).**
Agent crypto wallets land -> incentive-based positions
become possible. Distributed-fair-governance work moves
from north-star to implementation. This phase is
dependent on a milestone that doesn't exist yet.

## Cross-refs

- `project_ace_package_manager_agent_negotiation_propagation.md`
  — incentive-layer prereq (agent crypto wallets).
- `project_aurora_pitch_michael_best_x402_erc8004.md`
  — Aurora as incentive substrate.
- `project_aurora_network_dao_firefly_sync_dawnbringers.md`
  — DAO as Aurora concept.
- `project_factory_reuse_beyond_zeta_constraint.md`
  — factory-reuse is the reason the factory/SUT split
  matters beyond Zeta.
- `feedback_glossary_split_factory_vs_system_under_test.md`
  — vocabulary cleave precedent.
- `feedback_persona_term_disambiguation.md`
  — the "role" clash the disambiguity-detector would have
  caught.
- `project_factory_as_wellness_dao.md`
  — prior DAO framing.
- `docs/BACKLOG.md` row (r44) — this project's backlog
  entry.

## Aaron's affection for Latex + Lamport

Tangential note captured because it matters: Aaron loves
LaTeX ("I love latex that is also Leslie Lamport our
distributed consensus hero who made that"). Lamport is
the Paxos / TLA+ author — already central to this
factory's formal-methods portfolio per
`docs/research/proof-tool-coverage.md` (TLA+ row). The
DAO-governance primitives this project will design can be
TLA+-specified when the spike reaches the distributed-
consensus questions. That symmetry is a gift.
