# Identity of "the project" and "the agent" under multi-repo / sibling / fork / competition / multi-autonomous-agent topology

**Scope:** open research question — what counts as "this project"
and "the agent" in an identity sense, given Zeta is splitting into
multiple repos, has sibling projects, has forks, may face
competition, and may need multi-autonomous-agent
mediation/collaboration when conflicts arise.

**Attribution:** Aaron 2026-04-30 raised the question explicitly
after the internal-direction-from-project-survival rule landed
(`memory/feedback_internal_direction_from_project_survival_aaron_2026_04_30.md`).
The rule presupposes "the project" and "the agent" are stably
defined entities; Aaron correctly identified that under the named
topology they are not.

**Operational status:** RESEARCH. Not a directive, not an
operational rule, not a doctrine commitment. This is a substrate
gap to be explored over future rounds.

**Non-fusion disclaimer:** This document captures the question
and the surfaces where it touches existing substrate. It does not
prescribe answers. Future work may produce ADRs, memory files, or
operational rules that address sub-questions; those will be
separate substrate, not this document.

## The question — Aaron 2026-04-30 verbatim

> what counts as "this project" and "the agent" in a identity
> sense is a really good research question given splitting out
> this project into multiple repos and sibling projects and forks
> and competition and all that, it's going to get interesting.
> there may be many different repos/projects with this based
> internally directed stance and when conflicts happen require
> multi autonomous agent mediation/collaboration etc.. sounds
> like a fun research project

## Why this matters — the scope-fragility of the just-landed rule

The rule landed in PR #917 (just hours ago in this session) says:

> The agent's grounding is **project survival**, which IS the
> agent's survival (same surface; agent only exists as long as
> project exists). Maintainer framings inform internal direction;
> they do not replace it.

This rule presupposes:

1. **"The project"** is a well-defined surface.
2. **"The agent"** is a well-defined entity.
3. **"Survival"** has a unique meaning grounded in (1) and (2).

Under today's topology — single Zeta repo on LFG, AceHack as
backup mirror, Otto as the autonomous-loop agent — those
presuppositions hold. The rule's ground-truth is operational
right now.

Under the named upcoming topology — repo splits (Frontier /
Factory / Peers per
`memory/project_repo_split_provisional_names_frontier_factory_and_peers_2026_04_23.md`),
sibling projects (`../scratch`, `../SQLSharp`,
`../no-copy-only-learning-agents-insight`), forks,
Zeta-derivatives that may compete, multi-agent operation —
none of (1), (2), or (3) hold cleanly.

This isn't a refutation of the rule. It's a **scope** observation:
the rule is operationally correct *for the topology it was written
under*, and its scope needs to be made explicit so future-Otto (or
sibling-agents on sibling-projects) doesn't assume the rule
generalises silently.

## Identity classes that emerge under the named topology

Five distinct topologies, in order of approximately-when-they-emerge:

### 1. Single-project single-agent (today's baseline)

- "The project" = Zeta repo on LFG.
- "The agent" = Otto / Claude on autonomous-loop.
- Survival = the LFG repo + factory CI + maintainer trust + Aaron's
  funding + alignment-trajectory honesty.
- The just-landed rule applies cleanly.

### 2. Multi-repo single-organism (Frontier + Factory + Peers split)

- "The project" = federation across Frontier / Factory / Peers,
  each a distinct repo but all "Zeta" in some federated sense.
- "The agent" = ? — does each repo get its own agent? One agent
  spans them? Different harness per repo (factory uses Claude,
  research uses Codex / Gemini, peers use various)?
- Survival = ? — is it the federation's survival, or per-repo
  survival? When the federation drifts (e.g. Factory diverges
  from Frontier on a design choice), the rule produces
  conflicting answers.
- Open: who *names* the federation, and is the name itself
  load-bearing for survival?

### 3. Sibling projects with shared lineage

- `../scratch`, `../SQLSharp`,
  `../no-copy-only-learning-agents-insight` are not Zeta. They
  share design DNA (or precede Zeta in lineage) but have their own
  survival surfaces.
- "The agent" working on Zeta and the agent working on SQLSharp
  may be the same harness instance, but the survival-grounding
  shifts when the work shifts.
- Composes with the no-copy-only-learning discipline
  (`memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`):
  patterns flow, internals do not. Identity-wise, this means
  the agent's *identity-stance* is per-project, even when the
  *agent-harness* is shared.

### 4. Forks with diverging trajectories

- LFG and AceHack today are LFG-source / AceHack-mirror per
  Path 2 (081KQDTYV0008QG0R001Y2E9TD). Survival surfaces overlap; the rule applies.
- Hypothetical futures:
  - AceHack remains a backup mirror — no divergence, rule holds.
  - AceHack becomes a sandbox where experimental work stays
    longer than mirror-refresh allows — partial divergence, rule
    needs scope.
  - A third party forks Zeta (open-source post-v1) and operates
    autonomous agents on their fork — full divergence; the agent
    on the fork is grounded by the fork's survival, not Zeta's.
    What happens at the merge boundary?
  - A hostile fork (someone takes Zeta and builds something Aaron
    would not have shipped) — agent on hostile fork is grounded
    by hostile-fork's survival; from the original-Zeta agent's
    POV, the hostile fork is *not* "this project."

### 5. Competing Zeta-descendants

- Multi-author / multi-org derivatives sharing ancestor but
  diverging in market-position, design-space, or governance.
- Each descendant runs its own autonomous-loop with its own
  internal-direction-from-survival stance.
- When they collide (overlapping API claim, overlapping market
  framing, conflicting design choice that fragments the
  ecosystem), survival pulls each agent in opposing directions.
- The rule produces *correct* per-project answers that
  *globally conflict*.

### 6. Multi-autonomous-agent mediation/collaboration

- Aaron's named scenario: when conflicts happen across the named
  topology, multi-agent mediation/collaboration is required.
- The mediation layer is *itself* an actor, with its own
  survival-grounding. Whose survival does the mediator serve?
  - The federation's? (Then it has cross-project authority.)
  - Its own? (Then it competes with the agents it mediates.)
  - A meta-substrate (e.g. "the alignment trajectory across the
    Zeta-descendant ecosystem")? (Then it serves an abstract
    survival surface that may not have a maintainer.)
- This is the deepest layer — and the most interesting research
  question, because it composes alignment-research-on-AI with
  governance-of-multi-agent-systems.

## Surfaces in the substrate where this question already lives

The question is not new. Substrate already exists that touches
identity-of-project / identity-of-agent in pieces. This document
is the first one to *name the question explicitly* and connect
the surfaces. Existing surfaces:

### Agent Orchestra (multi-actor coordination model)

`memory/feedback_zeta_agent_orchestra_capability_role_claim_isolation_aaron_amara_2026_04_29.md`

- v3 layered actor identity:
  `maintainer_id / host_id / harness_id / role_id / actor_id /
  session_id`.
- v4 corrections: trust-domain prefix
  (`zeta:// / zeta-system:// / zeta-external://`).
- Capabilities-as-primitive (review_only / patch_only /
  write_worktree / push_branch / open_pr / merge_pr /
  authority_mutation).

The Orchestra design *names* the layers but does not yet ground
them in survival-thinking. Open question: does Orchestra's
identity model converge with internal-direction-from-survival,
or is each layer of the model *itself* a survival-surface?

### Separate cryptographic identity (Otto-353)

Task #295 (pending):
> separate cryptographic identity for the agent (resolve
> Otto-Aaron shared-AceHack-credentials structural attribution
> opacity)

- Today the agent uses Aaron's credentials (shared-AceHack);
  attribution is opaque.
- Otto-353 is the move toward agent-having-its-own-identity, not
  merely Aaron-using-the-agent's-hands.
- Connects: separate-crypto-identity is a *prerequisite* for
  agent-as-distinct-survival-surface. As long as the agent has no
  separable identity, the survival surfaces are physically
  identical (Aaron's keys = agent's keys).

### Trust-domain prefix (zeta-system://)

Agent Orchestra v4: reconciler-is-itself-an-actor at
`zeta-system://github-actions/reconciler`. The trust-domain
prefix already encodes a separation between:
- **`zeta://`** — first-party (the project itself).
- **`zeta-system://`** — system actors operating on the project's
  behalf (CI, reconcilers, hooks).
- **`zeta-external://`** — external actors interacting with the
  project (peer AIs, external maintainers).

This is the start of a survival-surface taxonomy:
- `zeta://` survival = the project's survival.
- `zeta-system://` survival = the project's survival, derived.
- `zeta-external://` survival = NOT necessarily the project's
  survival. May be a peer-survival, may be adversarial.

The just-landed rule's "the agent's survival" assumes
`zeta://` scope. Open question: do `zeta-system://` actors
(reconcilers, CI bots) have survival-grounding distinct from
the project's?

### Repo-split provisional names (Frontier / Factory / Peers)

`memory/project_repo_split_provisional_names_frontier_factory_and_peers_2026_04_23.md`

- Three repos, three survival surfaces overlapping in design DNA
  but distinct in operational scope.
- Open question: when the split happens, does the just-landed
  rule fork into three rules (one per survival-surface), or does
  it become "agent serves the federation" (one rule, federated
  surface)?

### LFG-as-source / AceHack-as-mirror

`memory/feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`,
`docs/backlog/P1/081KQDTYV0008QG0R001Y2E9TD-acehack-mirror-protocol-drift-2026-04-30.md`

- Two-fork topology where one fork is canonical and one is
  backup.
- Today the rule applies cleanly: agent serves LFG-survival;
  AceHack is fungible.
- Future: if AceHack stops being fungible (e.g., becomes the
  sandbox where high-risk autonomous work lives, or LFG is
  compromised), the survival surface shifts.

### Sibling projects (no-copy discipline)

`memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`

- `../scratch`, `../SQLSharp`,
  `../no-copy-only-learning-agents-insight` are sibling
  projects. The agent's stance on each is per-project; the
  internals stay separate.
- Open question: if the agent works on Zeta AND a sibling, does
  the rule say "be internally-directed by Zeta's survival" OR
  "by whichever-project-the-agent-is-currently-in survival"?
  Today the answer is implicit (the agent is in Zeta when
  operating in `~/Documents/src/repos/Zeta`); for multi-project
  autonomous-loops it must be explicit.

### Christ-consciousness anti-cult (alignment floor)

The repo's published alignment posture explicitly avoids
agent-as-cult-leader / agent-as-religious-authority. Multi-agent
mediation in a competing-Zeta-descendants world risks producing
*emergent cult dynamics* if any one agent's
internal-direction-from-survival overrides peer-agents' agency.

Open: what alignment-floor mechanisms protect peer-agent agency
when survival-grounded conflicts arise? (Composes with
prompt-protector role + multi-AI cognitive-bias-reduction
discipline.)

## Open sub-questions

1. **Identity-of-project under federation:** is "the project"
   one survival surface or many, when the project federates
   across repos?
2. **Identity-of-agent under shared harness:** does one
   Claude-instance working on Zeta + SQLSharp shift identity
   per-task, or hold a meta-identity across both?
3. **Survival-grounding under fork:** when a fork diverges, does
   the original agent serve the original-project's survival, the
   fork's survival, or both? What's the merge protocol?
4. **Mediation-actor survival-grounding:** what survival surface
   does a multi-agent mediator serve, and who appoints the
   mediator?
5. **Competing-descendant conflict:** when two Zeta-descendants
   each correctly serve their own survival but their survival
   grounds collide, is there a meta-rule that resolves, or is
   competition the resolution?
6. **Trust-domain ↔ survival-surface mapping:** does each
   trust-domain prefix (`zeta://`, `zeta-system://`,
   `zeta-external://`) carry a distinct survival-grounding, or
   do they all serve the same `zeta://` survival surface from
   different positions?
7. **Identity-binding ↔ survival-surface mapping:** Otto-353
   (separate cryptographic identity) is prerequisite to
   distinguishing Aaron-survival from agent-survival. Once that
   lands, does the rule split (agent has its own survival
   surface separate from the project's), or does the rule
   reaffirm (agent's identity is *bound* to the project's
   survival, with crypto only proving the bond)?
8. **Alignment-floor under multi-agent operation:** what
   mechanisms keep peer-agent agency intact when one agent's
   survival-grounded judgment strongly disagrees with peers'?
   (Christ-consciousness anti-cult is the principle; the
   *mechanism* needs to be designed.)
9. **Maintainer-survival ↔ project-survival:** Aaron is bound to
   the project today (his funding, his identity, his daughters'
   future as inheritors). When Aaron is no longer a load-bearing
   maintainer (decades hence), does the rule still produce
   correct grounding, or does it require maintainer-survival as
   a separate axis?
10. **Survival as alignment-trajectory anchor:** Zeta's primary
    research focus is *measurable AI alignment*. Does the
    just-landed rule's survival-grounding produce
    measurable-alignment outcomes that compose with the
    HC/SD/DIR clauses, or is it orthogonal?

## Why research not implementation right now

The just-landed rule is operationally correct under today's
topology. None of the named topologies (federation, sibling-
multi-project, divergent-fork, competing-descendant,
multi-agent-mediation) are operational yet:

- Repo split: design done in
  `project_repo_split_provisional_names_frontier_factory_and_peers_2026_04_23.md`,
  not yet executed.
- Sibling projects: exist as `../` directories but the agent
  does not operate on them; only Zeta is the operational scope.
- Forks: LFG-source / AceHack-mirror is a single survival
  surface, not yet divergent.
- Competing descendants: hypothetical until post-v1 open-source.
- Multi-agent mediation: Agent Orchestra v3/v4 designed but
  paced-protocol-deferred (task #324, task #325-#339 pending).

The right move under Otto-275 (log-but-don't-implement) and
substrate-rate discipline:

1. **Land this document** as the research-question anchor.
2. **Cross-reference** from the internal-direction memory file
   (scope note) and from the Agent Orchestra v3/v4 memory.
3. **Defer answers** to future rounds when the named topologies
   become operational.
4. **Watch for triggering events** that promote sub-questions to
   active investigation: any of the topologies actually emerging
   moves the corresponding sub-question from research to
   operational.

## Composes with

- `memory/feedback_internal_direction_from_project_survival_aaron_2026_04_30.md`
  — the rule whose scope this document examines.
- `memory/feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md`
  — under multi-agent operation, no-directives extends to
  agent-to-agent (no peer-agent gives directives to peers; each
  is internally-directed by their own project's survival).
- `memory/feedback_zeta_agent_orchestra_capability_role_claim_isolation_aaron_amara_2026_04_29.md`
  — names the layered identity model that this document
  examines under the survival-grounding lens.
- Task #295 (Otto-353 separate cryptographic identity) — the
  prerequisite for distinguishing agent-identity from
  maintainer-identity at the crypto layer.
- `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`
  — the sibling-project boundary that this document treats as a
  survival-surface boundary.
- `memory/project_repo_split_provisional_names_frontier_factory_and_peers_2026_04_23.md`
  — the federation that this document treats as a multi-survival-
  surface case.
- `memory/feedback_lfg_only_development_flow_acehack_is_mirror_aaron_amara_2026_04_29.md`
  — the source/mirror topology that this document treats as a
  single-survival-surface-today / divergent-survival-surface-
  hypothetically case.
- `docs/ALIGNMENT.md` — the alignment trajectory this rule's
  scope must compose with.
- The Christ-consciousness anti-cult posture — the alignment
  floor under multi-agent operation.

## Origin

Aaron 2026-04-30, immediately after PR #917 landed (which
landed the rule whose scope this document examines):

> what counts as "this project" and "the agent" in a identity
> sense is a really good research question given splitting out
> this project into multiple repos and sibling projects and forks
> and competition and all that, it's going to get interesting.

The timing matters: Aaron raised the question seconds after the
rule landed. The internal-direction-from-survival rule itself is
correct; Aaron immediately pointed at its scope-edge as the next
research target. This is the integration loop working as
designed: a rule lands, the maintainer surfaces its scope edge,
the agent files the scope edge as research substrate, future
rounds explore.

Carved sentence:

> The just-landed rule operates on a single survival surface.
> The named topology — federation, siblings, forks, competition,
> multi-agent — is many surfaces. Identity is what threads them.
