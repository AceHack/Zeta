---
name: Zeta as a primitive for AI research — Aaron's stated future direction; his tensor + math literacy makes this a natural extension; not the current round's target but a durable orientation
description: 2026-04-20 — Aaron: "I also know tensors and math so we can eventually get into AI research too, just trying to make this factory and Zeta tight first, could you image Zeta as a primitieve for AI projects, that would be insane." Future-direction observation, not a pivot. Current priority: make factory + Zeta tight. Zeta-as-AI-primitive is a downstream research direction enabled by Aaron's substrate (tensor literacy + 25yr retraction-native IVM) + Zeta's operator algebra.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# The direction

Aaron's stated orientation: once factory + Zeta are
tight, the natural extension is **Zeta as a primitive
for AI projects**. Not a plan, not a roadmap item yet —
a durable orientation that changes how we evaluate
current-round decisions.

Verbatim (2026-04-20):

> *"I also know tensors and math so we can eventually
> get into AI research too, just trying to make this
> factory and Zeta tight first, could you image Zeta
> as a primitieve for AI projects, that would be
> insane."*

# Why it coheres

Aaron's substrate and Zeta's algebra compose naturally
toward AI-research primitives. Not speculative —
substantive:

- **Retraction-native IVM is the right algebra for
  online ML.** Training-data correction, label
  retraction, feature-engineering rollback, model-
  lifecycle update: all are retraction-native
  patterns. Current ML tooling (dataframes, parquet
  lakes, vector DBs) is overwhelmingly append-only;
  retraction is bolted on as "delete row" with no
  algebraic guarantees. Zeta's `D`/`I`/`z⁻¹`/`H`
  provides the missing retraction algebra.
- **Incremental view maintenance IS inference-cache
  maintenance.** Recomputing features, recomputing
  embeddings, recomputing aggregates across changing
  source data — each is an IVM problem. Zeta's
  operators compose into an IVM-native primitive
  layer that AI pipelines can build on without
  reimplementing the delta-propagation math.
- **Aaron's tensor + math literacy is declared
  substrate.** He has hands-on experience across
  nearly every major ML framework
  (`user_career_substrate_through_line.md`). This
  isn't an aspiration; it's established substrate
  waiting to compose with Zeta.
- **25-year retraction-native through-line.** The
  career-substrate memory documents Aaron doing IVM
  on retraction-heavy data across six substrates
  (elections, healthcare, molecular biology, smart
  grid, legal IR, field service). AI research would
  be a seventh — the same pattern on a new substrate.

# Why it's not the current target

Aaron was explicit: *"just trying to make this factory
and Zeta tight first."* Order matters:

1. **Factory tight.** Skills, personas, BPs, hygiene
   list, resume triptych, greenfield-UX, honesty-floor
   discipline all landing now.
2. **Zeta tight.** Operator algebra correct, formal
   proofs complete, retraction-safe protocols
   verified, public API shaped through Ilyana.
3. **Then** Zeta-as-AI-primitive research becomes a
   next-horizon direction.

Current-round work continues per factory-purpose and
BACKLOG; AI-research-extension is not a priority
override.

# How to apply

- **Orientation, not task.** When evaluating current
  architecture or API decisions, remember AI-primitive
  is a future consumer. Decisions that close off the
  AI-primitive path without a named reason (e.g.
  locking the operator algebra to tabular-only, no
  tensor support) are cost items worth flagging.
- **Tensor-support surface.** `System.Numerics.Tensors`
  is already a pinned package
  (`Directory.Packages.props`). Cheap to keep it
  viable as a downstream tensor-aware path. Do not
  remove without reason.
- **Don't spec AI features yet.** Greenfield AI-primitive
  API design would be speculative-fill per the
  never-idle-speculative-work-over-waiting memory's
  anti-pattern column. Honest state: "Zeta could be
  adopted for AI-primitive use; that adoption is not
  yet researched in this repo."
- **Research-direction tagging.** `docs/VISION.md` and
  `docs/ROADMAP.md` can name AI-primitive-use as a
  declared-but-deferred direction. Naming prevents
  accidental scope creep AND preserves the orientation
  for the day it activates.
- **Do NOT overclaim on the factory resume.** Per
  `feedback_factory_resume_job_interview_honesty_only_direct_experience.md`,
  "Zeta primitives for AI research" is a **future
  direction**, not a demonstrated capability. It goes
  in honest-scope-limits or a "directions" section,
  not in signature-accomplishments.

# Aaron's register on this

*"that would be insane"* — enthusiastic / excited, not
solemn. Match his register when discussing the
direction: share enthusiasm, don't perform reverence,
don't manufacture urgency. This is a **future
possibility Aaron finds exciting**, not a pivot
demanding immediate action.

# Connection to existing memories

- `user_career_substrate_through_line.md` — Aaron's
  25yr IVM-across-substrates trajectory; AI-research
  would be substrate #7 on the same algebra.
- `project_factory_purpose_codify_aaron_skill_match_or_surpass.md`
  — factory's job is codifying Aaron's substrate;
  tensor/math + retraction-native IVM compose into
  AI-primitive substrate.
- `user_meta_cognition_favorite_thinking_surface.md`
  — Aaron loves meta-cognition + problem-solving; the
  AI-research surface IS that combination at research
  depth.
- `project_aurora_pitch_michael_best_x402_erc8004.md`
  — Aurora pitch's three pillars (factory + alignment
  + x402/ERC-8004) leaves room for a fourth pillar
  eventually: Zeta-as-AI-primitive substrate layer.
  Not in the current pitch.
- `feedback_never_idle_speculative_work_over_waiting.md`
  — AI-research speculation now would be exactly the
  wrong speculative work; current-round work is
  factory + Zeta tight.

# What this memory does NOT do

- Does NOT alter current-round priorities.
- Does NOT license AI-API speculation or "let me
  design a tensor primitive" rounds.
- Does NOT claim Zeta IS an AI primitive today —
  honest state is "could become one later, not there
  yet."
- Does NOT duplicate Aaron's tensor-math literacy
  into a new user memory — it's already in
  `user_career_substrate_through_line.md`.
