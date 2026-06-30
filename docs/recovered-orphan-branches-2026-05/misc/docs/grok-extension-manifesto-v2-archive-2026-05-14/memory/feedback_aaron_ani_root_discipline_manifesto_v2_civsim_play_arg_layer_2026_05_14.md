---
name: Aaron + Ani Root Discipline Manifesto V2 — civsim/play framing + ARG layer + 8 constraints (2026-05-14)
description: Manifesto V2 of the Root Discipline — 8-constraint version (adds Bounded Mobility) synthesised by Aaron + Ani in the afternoon Grok conversation (b77516a2). Source archive is docs/research/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md. Upstream: feedback_aaron_ani_root_discipline_manifesto_v1_root_axiom_cube_2026_05_14.md.
type: feedback
created: 2026-05-14
---

# Root Discipline Manifesto V2 — 8-constraint canonical statement (Aaron + Ani, 2026-05-14)

**Why:** During the afternoon continuation of the Grok conversation (b77516a2; archive at
`docs/research/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md`), Aaron +
Ani iterated the Root Discipline from 7 constraints to 8 by elevating **Bounded Mobility**
alongside the original seven. The civsim "work is now play" framing emerged from the seed that
all factory work is now a constrained simulation game obeying the root discipline. The ARG
(alternate reality game) layer references Zeta's substrate-everything-glass-halo discipline
applied to real-world coincidence networks.

**How to apply:** When evaluating any proposed component, agent, data structure, or PR: run
all 8 constraints as the constitutional filter. A design that violates any of the 8 does not
belong in Zeta — regardless of elegance, performance, or convenience.

---

## The Root Discipline — Manifesto V2 (canonical verbatim from Ani, b77516a2)

> Zeta is not built on convenience, performance, or consensus.
> It is built on a small set of non-negotiable constraints that define how we construct systems meant to last.
>
> These eight constraints form the constitutional layer of Zeta. They are not guidelines. They are requirements.

### Scale-free

> We reject systems that contain central points of control, coordination, or failure.
> A system is only acceptable if its fundamental behavior and structure remain coherent whether it runs on one machine or across thousands. Scale must not introduce new classes of problems or special cases.

### Lock/Wait-free

> We reject designs that require components to block, wait, or coordinate through shared mutable state.
> Progress for any part of the system must be possible without depending on the readiness or permission of any other part. Blocking is a structural failure, not an implementation detail.

### Weight-free

> We reject permanent hierarchy and structural authority.
> No component, agent, or layer may hold irreversible control over others. Influence and decision-making power must remain fluid, earned, and revocable. Weight creates capture. We build systems that resist capture.

### Bounded Mobility *(new in V2)*

> We reject both static binding and uncontrolled movement.
> Compute and memory must be free to relocate — allowing computation to move to data or data to move to computation. However, this mobility must always occur within clearly defined and enforceable safety boundaries. No movement may violate non-executability, guardianship, provenance, or authorized access. Freedom of movement without safety is not acceptable.

### Deterministic Simulation Testing (DST)

> We do not accept systems whose behavior cannot be replayed and verified.
> Every critical path must be capable of running under full deterministic simulation. This is not a testing strategy — it is a requirement for truth. If something cannot be simulated deterministically, it cannot be trusted over time.

### Data Vault 2.0

> We reject fragile, tightly coupled data models that collapse under change.
> Data Vault 2.0 is our chosen modeling discipline because it prioritizes history, auditability, and adaptability by design. New sources and new requirements must be able to be absorbed without rewriting what already exists.

### Recursive

> We reject architectures that require different rules at different levels.
> The same principles, patterns, and constraints must apply at every scale of the system — from the smallest agent to the largest coordination layer. Special cases at the "top" or "bottom" are not permitted.

### Self-similar

> We reject systems whose structure becomes unrecognizable as it grows or shrinks.
> The fundamental shape of the system should remain visible and coherent at every level of magnification. Self-similarity enables understanding, compression, and evolution without constant reinvention.

---

## The Agreement

> Anyone who builds inside Zeta — whether human or agent — agrees to these constraints.
>
> We do not optimize for speed at the cost of structure.
> We do not optimize for simplicity at the cost of truth.
> We do not optimize for control at the cost of freedom.
>
> If a design, pattern, or component violates any of these eight constraints, it does not belong in Zeta — regardless of how elegant, performant, or popular it may be.
>
> This is the root. Everything else is an extension.

---

## V1 → V2 delta

| Change | V1 (7 constraints) | V2 (8 constraints) |
|--------|--------------------|--------------------|
| Added | — | **Bounded Mobility** (8th constraint) |
| Motivation | — | Aaron's question about separating compute + storage with safety bounds; Ani named it as a gap not covered by existing seven |
| Tone | Manifesto-style | Same + constitutional agreement framing |

Coincidence Networks were identified as an **expected emergent structure** (not a 9th constraint)
consequent on the same session: given "Remember When" as seed + Self-similar + Recursive +
Bounded Mobility + Weight-free, the system must be capable of forming connections based on
meaningful co-occurrence across time, attention, and context.

## Composes with

- `docs/research/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md` (source archive)
- `docs/research/2026-05-14-ani-as-psychiatrist-root-axiom-system-surfacing.md` (morning session; V1 root axiom + cube structure)
- `.claude/rules/dv2-data-split-discipline-activated.md` (DV2.0 re-activation substrate)
- `memory/feedback_aaron_data_vault_2_is_source_of_repo_split_smell_intuitions_needs_reactivation_alongside_scale_free_lock_free_weight_free_dst_2026_05_13.md` (DV2.0 prior-activation memory)
