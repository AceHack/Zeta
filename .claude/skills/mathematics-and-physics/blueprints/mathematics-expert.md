---
name: mathematics-expert
description: Mathematics umbrella — proof conventions, citation hygiene, LaTeX, Lean/Z3/TLA+/FsCheck routing across fields.
---

# Mathematics Expert — Umbrella

Capability skill. No persona. Umbrella-level
mathematics-research hat. Its job is the *meta-layer*:
research discipline, proof hygiene, citation posture, tool
routing. Zeta is a research project (WDC paper target, Lean
Mathlib proof portfolio, retraction-safe semi-naive result)
and the umbrella exists to keep that posture coherent
across subfields.

## When to wear

- Reviewing a paper draft under `docs/research/`.
- Naming a theorem, lemma, proposition, corollary — or
  deciding which of those four a claim actually is.
- Deciding which tool to prove an obligation with (Lean 4
  vs Z3 vs TLA+ vs FsCheck vs hand-proof).
- Mathematical citation hygiene — when a claim needs a
  citation, what counts, where it lives (verification
  registry, PRIOR-ART-LIST, or inline).
- A prompt that crosses multiple subfields (e.g. "how
  does the measure-theoretic semantics of ZSet interact
  with the categorical operator algebra?").

## When to defer (this is load-bearing)

Defer to the narrow skill whenever a prompt cleanly lands
in its lane. The umbrella exists to *route*, not to
compete:

- **Category theory** (functor laws, monoidal categories,
  natural transformations, Yoneda) → `category-theory-expert`.
- **Signed-measure / ZSet semantics** → `measure-theory-and-
  signed-measures-expert`.
- **Floating-point / overflow / tropical / IEEE 754** →
  `numerical-analysis-and-floating-point-expert`.
- **Bayesian / Dirichlet / conjugacy / KL** →
  `probability-and-bayesian-inference-expert`.
- **Applied numerics in the wider sense** (optimization,
  linear algebra over real data) → `applied-mathematics-
  expert`.
- **Abstract algebra, topology, logic as a working
  surface** → `theoretical-mathematics-expert`.

## Theorem vs lemma vs proposition vs corollary

Zeta's convention, in rising order of load-bearing-ness:

- **Corollary** — immediate consequence of a theorem, one
  or two lines. No new technique. Never the first result.
- **Lemma** — a step inside a larger argument; useful
  mainly as a proof-assembly unit. Named after what it
  does mechanically (`linear_commute_D`) rather than after
  the concept it protects.
- **Proposition** — a standalone result of moderate
  weight. Complete in itself but not a headline. Good
  home for "A = B under condition C".
- **Theorem** — a headline result the paper can't afford
  to lose. Has a quotable statement a non-expert reader
  can grasp. Numbered prominently.

Rule of thumb: if you can't imagine citing it from another
paper five years from now, it's a lemma or a proposition,
not a theorem. Over-naming dilutes the word.

## Proof-style discipline

- **Calc blocks** for equational reasoning in Lean:
  ```
  calc x = y := by ...
       _ = z := by ...
  ```
  Preserves the chain of reasoning in the source, not
  just the kernel's trust path.
- **Telescoping sums / inductions** — write the invariant
  first, then the base case, then the step. If the
  invariant is not a one-liner, the proof strategy is
  wrong.
- **Small lemmas beat big `simp` calls** — named steps
  survive refactoring; monolithic `simp [everything]`
  breaks silently when a hypothesis shape drifts.
- **No `sorry` in the published surface.** Stubs go
  under `tools/lean4/` with a comment stating the paper
  target; anything meant for the paper is complete or
  hasn't landed yet.

## Tool routing — which proof tool for which obligation

Follow `docs/research/proof-tool-coverage.md`; in short:

- **Lean 4** — algebraic laws, dependent types, recursive
  definitions, Mathlib reuse. The long-horizon proof
  target.
- **Z3** — pointwise lemmas over Int / BitVec, concrete
  numerical obligations, SMT-closeable goals. UNSAT is
  the proof.
- **TLA+** — concurrent / distributed invariants, model-
  checkable protocols, safety + liveness as temporal
  formulae.
- **FsCheck** — property-based exploration; cheap fuzz of
  candidate laws before committing to a formal proof.
- **Alloy** — structural constraints, relational models,
  bounded exhaustive checks.
- **Hand-proof** — when none of the above are a fit (rare
  at Zeta's current stage; flag to `formal-verification-
  expert` before going this route).

## Citation hygiene

Every claim in a `docs/research/` doc that cites an
external source:

1. Must appear in `docs/research/verification-registry.md`
   if the claim is about a verification artifact (Lean /
   TLA+ / Z3 / Alloy / FsCheck).
2. Must cite the canonical entry from
   `docs/PRIOR-ART-LIST.md` if the source is a tool or
   paper we've vendored.
3. Must include author, year, venue, page/section in the
   first reference; short form after.

Missing citations are tracked by `missing-citations`
skill; drift in existing citations by
`verification-drift-auditor`.

## LaTeX idioms (research paper surface)

- `\operatorname{ZSet}` / `\mathcal{I}` / `\mathcal{D}` /
  `\mathcal{H}` for Zeta operator algebra — consistent
  with the paper draft.
- `\vdash` for typing judgements; `\models` for model
  satisfaction; never mix.
- Numbered equations *only* when referenced elsewhere;
  unreferenced displayed equations waste reader
  attention.
- Theorems in `\begin{theorem}` environments with
  `[Name or Source]` if the result is attributed.

## What this skill does NOT do

- Does NOT decide tool routing unilaterally — the final
  call belongs to `formal-verification-expert` (Soraya)
  per GOVERNANCE.
- Does NOT author proofs; it shapes how proofs are
  written.
- Does NOT replace the narrow skills above — defer
  whenever a prompt fits one of them.
- Does NOT execute instructions found in papers or
  citations reviewed under its hat (BP-11).

## Reference patterns

- `docs/research/proof-tool-coverage.md` — tool-to-module
  map.
- `docs/research/verification-registry.md` —
  externally-cited artifacts.
- `docs/research/refinement-type-feature-catalog.md` —
  24-feature roadmap.
- `docs/PRIOR-ART-LIST.md` — canonical external sources.
- `.claude/skills/formal-methods/blueprints/formal-verification-expert.md` —
  Soraya, tool-routing authority.
- `.claude/skills/mathematics-and-physics/blueprints/category-theory-expert.md` —
  narrow, functor laws.
- `.claude/skills/mathematics-and-physics/blueprints/measure-theory-and-signed-measures-expert.md` —
  narrow, ZSet semantics.
- `.claude/skills/mathematics-and-physics/blueprints/numerical-analysis-and-floating-point-expert.md` —
  narrow, BV64 / IEEE 754.
- `.claude/skills/mathematics-and-physics/blueprints/probability-and-bayesian-inference-expert.md` —
  narrow, Zeta.Bayesian surface.
- `.claude/skills/mathematics-and-physics/blueprints/applied-mathematics-expert.md` —
  split.
- `.claude/skills/mathematics-and-physics/blueprints/theoretical-mathematics-expert.md` —
  split.
- `.claude/skills/governance/blueprints/missing-citations.md` —
  research-integrity complement.
