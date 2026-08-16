---
name: HKT on geometry/topology is a MULTI-MONTH, NO-FORK, upstream-contribution program — good faith binding for every person and team (Aaron 2026-08-15)
description: "Aaron 2026-08-15 standing frame for the F#/HKT effort, superseding the 2026-05-13 fork framing. Four commitments: (1) multi-month program, so 'the case is not ready' is the correct status of an early stage, not a failure; (2) NO FORK — build it 'to the point that clr/c#/f# will allow without a fork and take back as a contribution'; (3) reviewer + team research authorized, and the useful half is RESPONSIBILITIES (who owns which decision); (4) good faith binding for EVERY person and team — 'we assume every person and team are doing best effort and has 0 nefarious internal state… not trying to detect deception… just align with public stated held positions of the ecosystem we are trying to contribute to.' Full program, responsibilities map and six staged entry criteria in docs/research/2026-08-15-the-hkt-case-for-fsharp-audited-against-symes-published-positions-arrow-first-keeps-us-at-kind-star.md (PR #10820)."
type: feedback
created: 2026-08-15
---

# HKT is a multi-month, no-fork, upstream-contribution program (Aaron 2026-08-15)

**Why this file exists.** A sibling agent (PR #10821) found the same day that an insight living in exactly one
transcript and **zero of 1082 memory files** had degraded to a wrong recollection within two days. This is a
**standing decision** that will shape months of work across many agent wakes, so it lands in the substrate
rather than in a conversation. `wake-time-substrate`.

## Aaron's verbatim disclosure

> *"yes keep up with all of this, i expect this to be a multi month effort for us to design and build hkt on
> top of geometry/topology intuition and for it to be useful to the point that clr/c#/f# will allow **without a
> fork** and take back as a contribution. this is not a fast process. and yes we can research any potential
> reviewers for their public views and teams public views and responsibilities. and as always, we assume every
> person and team are doing best effort and has 0 nefarious internal state for these projects. we are not
> trying to detect deception or anything of that nature, just align with public stated held positions of the
> ecosystem we are trying to contribute to."*

## The four commitments

1. **Multi-month program, not a submission.** *"this is not a fast process."* So an honest "the case is not
   ready" is the **correct status of an early stage**, never a failure to be worked around.
2. **NO FORK — upstream contribution is the goal.** This **supersedes** the 2026-05-13 framing in
   `feedback_aaron_dbpedia_…_fork_fsharp_compiler_for_ai_safety_real_hkt_over_clifford_2026_05_13.md`
   ("when we fork f# compiler for ai safety"). Any agent reading that file must read this one alongside it.
3. **Reviewer/team research is authorized**, and the practically useful half is **responsibilities** — who owns
   which decision — not opinions.
4. **Good faith is binding for every person and every team.** No motive attribution, no reading between the
   lines, no modelling of internal disagreement between teams. Where a position does not exist, write
   **"not stated publicly"**. We are **aligning with an ecosystem's stated positions, not overcoming anyone**.

## How to apply

- Before proposing anything upstream, check the stage table and its **entry criteria** (measurements, not
  declarations) in the research doc below. Stages 1–4 are ungated; only 5–6 involve anyone outside this repo.
- The interim capability that needs **no approver** is the `.fsi`-sealed single-`App` brand (measured in
  PR #10817). Its trigger has **not** fired — do not build it until a candidate site reaches two instances.
- **Types-as-values is the ARCHITECTURE; the HKT question is separate and additive.** Aaron 2026-08-15 resolved
  this (it was recorded as three open relations earlier the same day — that version is **superseded**):
  *"yes this is our relative, no-central-processor zetadb/fs too — they are all one, and when combined with
  DynamicValue it's also code that can be interpreted and compiled and specialized at runtime, with JIT-like
  behavior."* Memories, types, files and code are **one content-addressed object store**; `DynamicValue` makes
  those objects executable.
- **We do not need HKT for the system to function — and that is a STRONGER contribution position.** The ask
  becomes "should F# have this, on evidence", which is the register the published rubric rewards, and it
  cannot be answered with "a passed function would have done" (Syme's Objection D). **Never argue from need;
  we have no dependency to argue from.**
- **The `AssemblyLoadContext` wall (PR #10819) is not a problem to solve.** If the objects are `DynamicValue`s
  rather than CLR types, everything is GC-granular again and the design never enters that layer. That is why
  `ShivaGc` works on `DynamicValue` and could not work on `Type`.
- **Keep the capability claim honest.** Shipped: content-addressed stores (`ZetaFs`, `DagFs`), an interpreter
  whose rules are data (`MixIr.defaultEvalDef : DynamicValue`), Futamura specialization behind a weak reference
  (`SpecializationCache` — generator strong, product weak, errors never cached = **compression, not creation**,
  PR #10815). **Not** shipped: runtime code generation — zero `Reflection.Emit`/`ILGenerator` in the repo. So
  "compiled" holds in the **Futamura** sense only, and **"JIT-like" is an analogy (`toy`)**, never a claim that
  we emit IL.
- **The epoch hazard now covers all four object kinds** (memory, type, file, code), not just types: an epoch
  must be a **logical** clock. `ace/deps.ts`'s `asOf || new Date()` is the shape to avoid —
  `.claude/rules/local-time-never-enters-the-shared-fold.md`.

## Pointers

- `docs/research/2026-08-15-the-hkt-case-for-fsharp-audited-against-symes-published-positions-arrow-first-keeps-us-at-kind-star.md`
  (PR #10820) — the program: standing frame, Syme's objections as the durable steelman, the responsibilities
  map (F# squad / C# LDM / CLR), six stages with entry criteria, and the four-axis criterion-3 measurement.
- PR #10817 — the HKT residue measured (arrow-first, kind `*`, the `.fsi` seal, the trigger condition).
- PR #10819 — types are collectable only at `AssemblyLoadContext` granularity; values are GC-granular.
- `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md` — the governing discipline.
