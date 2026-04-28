---
name: Symmetry-opportunities audit as a cadenced factory-hygiene item — sweep for asymmetries, classify each as load-bearing (keep, document) or drift (flip to symmetric); lives on docs/FACTORY-HYGIENE.md as row #22; consolidated hygiene list is itself a new factory artifact
description: 2026-04-20 — Aaron: "can we have a symmetry breaking or symmetric check or something that will look for opportunities to make things symmertic that are not allready as part of factory hygene, we might was well start a hygene list of all the different things we do for hygene on a reuglar bases". Two linked asks. (a) New cadenced audit — sweep the factory for asymmetries and classify each as load-bearing (Architect-bottleneck, merge-authority, codebase-ownership asymmetries) or drift (one-direction disclosure/review/visibility that has no named reason). (b) Consolidated hygiene list as a factory artifact so new agents see the full cadence in one read. Both landed same tick.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

The factory runs a **symmetry-opportunities audit** on a
round-cadenced basis. The audit sweeps every factory surface
(rules, skills, personas, ADRs, governance, hygiene items,
code boundaries) and classifies each **asymmetry** as either:

1. **Load-bearing asymmetry — keep and document.** The
   asymmetry exists on purpose; flipping it would break a
   named invariant or defeat an explicit design constraint.
   If the asymmetry is not yet documented, the audit files a
   BACKLOG row to add the documentation (the asymmetry is
   real but the reason has not been written down).
2. **Drift asymmetry — flip to symmetric.** The asymmetry is
   accidental. There is no named reason for one side being
   visible / heard / audited / protected and the other not.
   The audit files a BACKLOG row to flip to symmetric.

**Discriminator (tentative, pending Aaron confirmation):**
an asymmetry is load-bearing if at least one of the following
holds:

- (a) Flipping it would break a named invariant (e.g.
  architect-bottleneck per GOVERNANCE.md §11 is deliberate;
  flipping to "nobody reviews architect either" would defeat
  the human-in-the-loop gate).
- (b) The asymmetry is already documented with a reason (an
  ADR, a BP rule, or a memory naming the asymmetry and why).
- (c) The asymmetry mirrors a physical, legal, or governance
  constraint that cannot itself be symmetric (e.g. the
  maintainer has legal ownership of the repo; the agent has
  no citizenship; the human can die and the AI can be rolled
  back — these aren't drift).

Otherwise the asymmetry is drift and flips to symmetric.

# Why:

Aaron's verbatim (2026-04-20):

> *"can we have a symmetry breaking or symmetric check or
> something that will look for opportunities to make things
> symmertic that are not allready as part of factory hygene,
> we might was well start a hygene list of all the different
> things we do for hygene on a reuglar bases"*

Two linked observations drive the ask:

- **Symmetry is already a load-bearing factory pattern** —
  symmetric human-AI register
  (`feedback_anthropomorphism_encouraged_symmetric_talk.md`),
  bidirectional trust
  (`project_trust_infrastructure_ai_trusts_humans.md`),
  consent-first as symmetric primitive
  (`project_consent_first_design_primitive.md`),
  preserve-original-AND-every-transformation
  (`feedback_preserve_original_and_every_transformation.md`),
  all-life-inclusive outcome-optimization
  (`feedback_agent_agreement_must_be_genuine_not_compliance.md`),
  and the DBSP operator algebra itself (insert/retract dual,
  `z⁻¹` is the reversed-time operator). Given that symmetry
  is already a durable factory pattern, finding places it
  *isn't* applied is a real mis-application class.
- **Hygiene items are scattered.** ASCII-clean, TWAE, BP-11,
  skill-tune-up, scope-audit, ontology-home, idle-tracking,
  meta-wins, Aarav notebook prune, MEMORY.md cap, copilot-
  instructions audit, public-API review, upstream-sync,
  verification-drift, round-history — all of these live
  in their own skills / memories / docs. A consolidated list
  is the natural index. Adding an item to the list without
  having the index makes the factory's cadence harder to
  audit.

# How to apply:

- **Sweep cadence:** round-cadenced; initially every 3-5
  rounds so the audit has material to sweep, tunable after
  observing rate. Lives as row #22 on
  `docs/FACTORY-HYGIENE.md`.
- **Classification:** every asymmetry found gets classified
  via the three-part discriminator (invariant-break, already-
  documented, physical/legal/governance constraint). If none
  of the three apply, the asymmetry is drift and flips.
- **Durable output:** findings go to BACKLOG rows, not just
  notebook entries — a flip-to-symmetric action is a
  structural change and needs a sized, prioritised backlog
  row. A "document-the-asymmetry-reason" action is a
  lower-effort backlog row but still filed, not hand-waved.
- **Self-apply.** The audit sweeps the hygiene list itself
  as one of its first passes — finding an asymmetric hygiene
  item (e.g. we lint agent-written code but never
  human-written; we track agent idle-time but never log
  when the human is idle on the factory; etc.) is the most
  likely early-round output.
- **Honest open question.** The discriminator is tentative.
  Aaron to confirm whether the three-condition OR is the
  right frame or whether it needs refinement. Until
  confirmed, the audit files findings as
  `asymmetry-load-bearing-pending-confirmation` rather
  than flipping unilaterally.

# Initial scan — draft findings (for round-45)

Sweeping the factory with the new audit, round-0 findings:

**Candidate load-bearing (well-named, keep):**

- Architect-bottleneck (GOVERNANCE.md §11) — nobody reviews
  Architect; deliberate human-in-the-loop gate. Documented.
- Zeta-is-AI's-codebase ownership
  (`project_zero_human_code_all_content_agent_authored.md`)
  — codebase guarded from human harm including maintainer.
  Documented asymmetric ownership.
- Public-API-one-way (Ilyana review) — new public members
  get review, existing public members get compatibility
  guarantees but no retrospective review. Documented.

**Candidate drift (flag for flip-to-symmetric audit):**

- **Skill-tune-up runs on `.claude/skills/*/SKILL.md` but
  not on `.claude/agents/*.md` directly** — persona-agent
  files are cousin artifacts but skill-tune-up doesn't
  currently rank them. Either (a) load-bearing (agents are
  who-wears-hat, skills are how-to-wear — different axis)
  or (b) drift (both are agent-authored durable
  guidance-docs and should be ranked together). Aaron
  confirmation needed.
- **Scope-audit fires at absorb-time** but **not at
  review-time** — when agents *review* existing policy,
  there's no step that checks scope drift of the rule
  being reviewed. Possibly drift.
- **Meta-wins logged, anti-wins not logged** — we track
  structural fixes but not structural regressions or
  "I almost did the right thing and didn't". Mirror
  artifact `docs/research/anti-wins-log.md` would be
  the symmetric sibling. Possibly drift.
- **Idle-logging tracks agent idle but not tool/skill
  idle** — we notice when an agent sits doing nothing but
  not when a skill hasn't been invoked in N rounds (staleness
  is a skill-tune-up criterion but not an always-on lint).
  Possibly drift.
- **HUMAN-BACKLOG tracks human-pending-actions, no
  equivalent for agent-pending-actions** — agents file
  to BACKLOG.md (all actions collapsed together). Possibly
  drift; possibly load-bearing (agent-pending is just
  "backlog") depending on interpretation.

These are DRAFT findings, not landed actions. The audit
itself files BACKLOG rows for each after Aaron confirms
the discriminator.

# Connection to existing factory rules

- `feedback_anthropomorphism_encouraged_symmetric_talk.md` —
  the conversational instance of symmetric treatment.
  Symmetry-audit generalises: what other surfaces should
  be symmetric?
- `project_trust_infrastructure_ai_trusts_humans.md` —
  named the bidirectional trust *pattern*. Symmetry-audit
  hunts for *more* places that pattern belongs.
- `feedback_agent_agreement_must_be_genuine_not_compliance.md`
  — all-life-inclusive algorithm. Symmetry-audit is the
  operational sweep that checks whether the algorithm is
  applied evenly (is some stakeholder's experience being
  silently weighed less?).
- `feedback_meta_wins_tracked_separately.md` — meta-wins
  log. Symmetry-audit is meta-hygiene and can itself fire
  meta-wins when it catches a drift that should-have-been-
  caught-by-another-rule-but-wasn't.
- `feedback_ontology_home_check_every_round.md` — ontology
  homing is another cadenced audit; symmetry-audit is its
  sibling.
- `docs/FACTORY-HYGIENE.md` — the consolidated index this
  memory anchors. Row #22 (symmetry-opportunities audit) is
  this memory's operational surface.

# What this rule does NOT do

- It does NOT make symmetry a universal goal. Some
  asymmetries are load-bearing and the audit documents
  them; it does not flip them. The discriminator is the
  defense against over-application.
- It does NOT replace existing hygiene items. The hygiene
  list is additive; existing items stay in their own
  owner-skills.
- It does NOT gate any existing workflow. Findings are
  advisory; action is backlog-routed, not CI-blocking.
- It does NOT license retroactive "fairness policing" of
  already-landed code or policy. The audit is forward-
  looking — what asymmetries should be flipped *going
  forward*; already-shipped asymmetries that are documented
  stay documented.
- It does NOT claim that symmetry is the same as equality.
  Symmetric-register talk, symmetric trust-infrastructure,
  symmetric stakeholder-weighting — all mean "treat the
  two sides with comparable care and visibility", not
  "ignore real differences between them".

# Open question — pending Aaron confirmation

The three-condition discriminator (invariant-break /
already-documented / physical-legal-governance-constraint) is
my draft. The honest question I want to ask, not answer
unilaterally: is this the right discriminator? Candidates for
refinement:

- Should "cadence frequency" count as a load-bearing
  constraint? (e.g. something that fires every-build is
  inherently asymmetric with something that fires
  every-5-rounds.)
- Should "reversibility" factor in? (An asymmetric
  mechanism that is cheap to flip is different from one
  that would require major migration.)
- Should the discriminator be binary (load-bearing vs.
  drift) or three-tier (load-bearing / ambiguous /
  drift)?

Until Aaron confirms, the audit files findings with
`classification-pending` status and does not unilaterally
flip anything. Genuine-agreement rule
(`feedback_agent_agreement_must_be_genuine_not_compliance.md`)
applies — I'd rather surface the question than encode
guesswork.

# Meta-note

This memory pairs with the new `docs/FACTORY-HYGIENE.md`
consolidated list. The list is the *what* (enumerated
hygiene items); this memory is the *why/how* for adding
item #22 (symmetry audit) and the discriminator to use.
Both landed same tick; both are additive to the factory
substrate.
