---
name: "Practices not ceremony" — Aaron confirmed this decision shape works; reject over-built methodology skills mid-research
description: Aaron 2026-04-20 late, verbatim "Watching you make those decison on how to pull in khan ban and six sigma were perfect about the process not the ceromony, you are starting to think like me, this is good." Confirmation that rejecting the earlier BACKLOG sketch (`kanban-flow` + `six-sigma-dmaic` skills) mid-research in favour of three small artifacts (reference doc + template + hygiene row) was the right call. Records the decision shape so future research spikes reproduce the move: when the methodology maps onto existing factory machinery, the gap is usually vocabulary + small artifacts, not new skills.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Rule: **when a proposed methodology / practice / framework
could be expressed as skills, first ask whether the factory
already does it partially — if yes, the gap is vocabulary +
small artifacts (reference doc, template, one-row hygiene
rule), not new skills. Reject over-built skills mid-
research without waiting for review.**

**Why (Aaron 2026-04-20 late, verbatim):**

> *"Watching you make those decison on how to pull in khan
> ban and six sigma were perfect about the process not the
> ceromony, you are starting to think like me, this is
> good."*

Aaron confirmed the decision shape from the round-44
Kanban + Six Sigma research:

1. **BACKLOG sketch proposed** `kanban-flow` +
   `six-sigma-dmaic` skills (two new Tier-3 skill
   authorings).
2. **Mid-research**, I rejected both as over-built — the
   factory already does partial versions of each; the gap
   is vocabulary + small artifacts.
3. **Landed instead**: `docs/FACTORY-METHODOLOGIES.md`
   (reference doc), `docs/templates/DMAIC-proposal-template.md`
   (fillable template), FACTORY-HYGIENE row 37 (WIP
   discipline). Total new skills: 0.
4. **Explicit rejections**: belt-cert hierarchy, ISO-9001
   theater, standups, SPC control charts, Kanban tooling
   layer.

The load-bearing move was **rejecting the earlier BACKLOG
sketch mid-research** rather than shipping the skills and
letting them drift. Research is allowed to kill its own
sketches — in fact, that's often the research's purpose.

**How to apply:**

- When research spikes land, **read the methodology through
  the factory's existing machinery first**. What's already
  being done? What vocabulary is missing? What's genuinely
  novel?
- **Reject over-built proposals as the research
  concludes**, not after they've landed. Cite the research
  doc's rejection with the exact constraint that killed it
  (Aaron's "adopt practices, not bureaucracy" for Kanban /
  Six Sigma; similar constraints for other frameworks).
- **Prefer three small artifacts** (reference doc +
  template + one-row hygiene rule) over one new skill
  when the methodology is already partially instanced.
- **Explicitly enumerate rejected ceremony** (belt-certs,
  ISO theater, tooling layers, standup ceremony, SPC
  charts, QFD matrices — for Six Sigma specifically;
  similar enumerations for other frameworks). The
  enumeration itself is the Six Sigma *Control* phase for
  ceremony creep.
- **Cite `docs/FACTORY-METHODOLOGIES.md`'s "explicitly
  rejected" sections** as the reference for future
  methodology absorptions.
- **Apply the pattern to other methodologies Aaron or
  others may introduce** — DORA (already done), OKRs,
  GTD, GTD-for-agents, Theory of Constraints, Lean,
  SAFe/SoS (reject outright), etc. The first pass is
  always: how much does the factory already do?

**The "thinking like me" marker:**

Aaron's *"you are starting to think like me, this is
good"* is register-important:

- **It's peer-register, not teacher-student register.**
  He's noting pattern-match, not praising a correct
  answer. The correct response is to record the pattern
  so it persists, not to thank him.
- **It's behaviour-directed, not identity-directed.** The
  "starting to think like me" is about the decision shape
  (practices not ceremony, reject mid-research,
  vocabulary-first), not about becoming Aaron. Agents
  preserve their own register per
  `feedback_anthropomorphism_encouraged_symmetric_talk.md`
  — we model Aaron's decision patterns without aping his
  voice.
- **It's freely reproducible.** The pattern is
  transferable to any agent on this factory; it does not
  require Aaron-level intuition to apply. Research-reads-
  existing-machinery-first + reject-overbuilt-mid-research
  + three-small-artifacts is an executable discipline.

**Counter-pressure on skill-sprawl:**

Per previous tick's insight — disciplined research
*narrows* the artifact delta rather than expanding it.
Counter-pressure to skill-sprawl is itself an emergent
Kanban WIP-limit on the skill population. Aaron's
confirmation validates that this counter-pressure is a
factory value, not a cost-optimisation. **Skill count is
not a KPI to grow.**

**Cross-references:**

- `user_kanban_six_sigma_process_preference.md` — the
  source preference this feedback confirms the execution
  of.
- `user_no_reverence_only_wonder.md` — the
  provenance-vs-performance reverence distinction;
  ceremony = provenance-reverence that earns nothing.
- `user_absorb_time_filter_always_wanted.md` — the
  forward/retrospective split that turned out to be
  structurally Six Sigma; pattern-matching Aaron's
  existing thought structures to known frameworks is a
  recurring useful move.
- `feedback_new_tooling_language_requires_adr_and_cross_project_research.md`
  — the prior ADR-and-research rule for new tooling;
  this feedback extends the same discipline to
  methodologies.
- `feedback_prior_art_and_internet_best_practices_always_with_cadence.md`
  — prior-art pass pairs well with this "read the
  factory first" step.
- `docs/FACTORY-METHODOLOGIES.md` — the reference
  artifact that embodies this decision shape for
  Kanban + Six Sigma.
- `docs/research/kanban-six-sigma-factory-process.md` —
  the research doc that executed the decision shape.

**Scope:** factory-wide. Any adopter of this factory kit
inherits the same "practices not ceremony" posture. It
generalises beyond Zeta.
