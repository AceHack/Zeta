---
name: f-star-expert
description: F* refinement types — dependently-typed ML, SMT-backed refinements, Steel/Pulse, miTLS/HACL*/EverParse case studies.
---

# F* Expert — Tool-Level Skill

Capability skill. No persona. Evaluator-level hat for F*as an
*upstream reference* rather than a ship-side tool. Zeta does not
currently ship F* source; the value of this hat is keeping the
refinement-type conversation honest by someone who knows what
F* can and cannot do.

## When to wear

- A prompt asks "could this invariant be a refinement type?" and
  the context is Zeta's operator-algebra or retraction-safety
  discipline.
- Reviewing `docs/research/refinement-type-feature-catalog.md`
  or a follow-on draft comparing refinement-type systems.
- Evaluating whether a Zeta property (retraction linearity,
  z⁻¹ causality, spine segment invariants) is better captured
  as (a) an F*-style refinement type, (b) a Lean theorem,
  (c) an SMT-only check, (d) a FsCheck property, or (e) a TLA+
  invariant.
- Reading an F*, miTLS, HACL*, EverCrypt, or EverParse paper
  for a pattern that might transfer to Zeta.
- A prompt invokes F*'s effect system (`Pure`, `Ghost`, `Stack`,
  `Heap`, `Steel`, `Pulse`) — route here for whether the effect
  framing is load-bearing.
- A prompt invokes Meta-F* tactics or the `Tac` effect — this
  hat owns the framing.

## When to defer

- **Writing F* code.**Zeta ships no F*. If a project ever adds
  F*, a successor skill covers authoring.
- **Lean 4 proof authoring** → `lean4-expert`.
- **Z3 / SMT-direct verification** → `z3-expert`.
- **TLA+ model-level invariants** → `tla-expert`.
- **Property-based testing** → `fscheck-expert`.
- **Formal-verification tool routing** (portfolio view across
  Lean / F* / Z3 / TLA+ / FsCheck / CodeQL / Semgrep / Stryker /
  Alloy) → `formal-verification-expert`.
- **LiquidF# (F# refinement types via Liquid)** — when a
  successor skill for that lands, route there for "can we
  do refinement types *inside* F#?".

## What F* actually is — the five-minute framing

- **Dependently-typed ML.** Syntax close to OCaml / F#; types
  can depend on values.
- **Refinement types.** `x:int{x > 0}` — a proposition
  attached to a type.
- **SMT-backed.** Verification conditions are discharged by Z3
  under the hood; most obligations are automatic, the unsolved
  tail falls to Meta-F* tactics.
- **Effect system.** Every function has an effect — `Pure`
  (terminating, no state), `Ghost` (erased at runtime),
  `Stack` / `Heap` (memory), `Steel` / `Pulse` (concurrent
  separation logic), `Tac` (tactics). A function is "pure" by
  *evidence*, not convention.
- **Extraction targets.** OCaml, F#, C (via Low*), Wasm. Once
  proven in F*, the extracted code carries the guarantees.

## Where F* earns its keep (and where it doesn't)

F* is a good fit when:

- The property is a **data-level invariant** (the list is
  sorted, the buffer has length ≥ N, the index is in range).
- The property must survive **extraction** to C / OCaml / F#
  (HACL* / EverCrypt use this path).
- Most verification can be **SMT-automated**, with a small
  tactic-driven residue.
- The surrounding code is **functional** enough that an ML-style
  syntax reads naturally.

F* is a poor fit (vs. Lean) when:

- The property is a **mathematical theorem** with a long proof
  (Lean + Mathlib is the industry baseline).
- The proof needs **classical reasoning** with heavy
  higher-order content (F* can, but Lean is more ergonomic).
- The target is **already in F#** and the refinement-type
  author wants in-language (LiquidF# path, when available).

F* is a poor fit (vs. SMT-direct) when:

- The property reduces to **one SMT query** with no surrounding
  program; use Z3 directly and skip the F* boilerplate.

F* is a poor fit (vs. FsCheck) when:

- A **statistical counterexample** is enough and the cost of a
  proof is unjustified. F* gives you *no* counterexamples when
  it gives up — debugging is worse, not better.

## Zeta's F*-adjacent surface today

- **None in the code.** Zeta ships F# / C# only.
- **Research roadmap.** `docs/research/refinement-type-
  feature-catalog.md` catalogues 24 refinement-type features
  observed across F*, Liquid Haskell, Dafny, and proposes which
  would transfer to a hypothetical F#-with-refinement layer.
- **Proof-tool coverage** table at
  `docs/research/proof-tool-coverage.md` lists F*in the "considered,
  not adopted" row with the specific reasons: Zeta is F#-native,
  F* extraction to F# exists but is not the primary path, Lean 4
  covers our current proof obligations.
- **Upstream anchor:** `docs/PRIOR-ART-LIST.md` line 71, F*
  family — dependently-typed ML with SMT refinement, effect
  system (Pure / Ghost / Stack / Steel / Pulse), tactic engine
  (Meta-F*), canonical case studies `miTLS` / `HACL*` /
  EverCrypt / EverParse.

## Refinement-type patterns worth stealing

When a successor skill or a Zeta draft wants to borrow from F*
without adopting F*:

- **Refinement-at-the-boundary.** The refinement lives on the
  public API type; callers pay the proof obligation, the
  implementation sees a trusted value. Zeta could mimic this
  with active patterns + `Result<_, DbspError>` at the public
  surface.
- **Erased ghost state.** `Ghost` types disappear at extraction.
  Useful for instrumentation-only invariants (retraction-safety
  witnesses) that would otherwise bloat runtime.
- **Effect as contract.** A function typed `Pure (...)` commits
  to termination and purity; a function typed `Stack (...)` lives
  on the stack. F# lacks native support, but attributes or
  analyser-enforced conventions can mimic a subset.
- **Tactic as last resort.** The SMT solver handles 90% of
  obligations; the last 10% get a Meta-F* tactic. The lesson
  is: don't build the whole proof pipeline around tactics — use
  them for the tail.

## Canonical case studies (worth the read)

- **`miTLS`** — end-to-end verified TLS stack. The refinement-
  type discipline here: protocol state as a refined type so the
  type system enforces the handshake sequence.
- **`HACL*` / EverCrypt** — verified cryptographic primitives.
  Constant-time discipline is carried by the type system (the
  F*side) and preserved through extraction to C (the Low*
  side).
- **EverParse** — verified parsers for binary protocols.
  The parser is specified as a refined function; invalid inputs
  are statically impossible.

These three are the reference point for "what a refinement-type
system buys you at scale". When a Zeta proposal reaches for
refinement types, the question is "which of these patterns
applies?" — if none, the proposal is speculative.

## What this skill does NOT do

- Does NOT author F* code (Zeta ships none).
- Does NOT override `lean4-expert` on Lean-4-native proofs.
- Does NOT override `z3-expert` on SMT-direct obligations.
- Does NOT decide tool-portfolio routing — that's
  `formal-verification-expert`.
- Does NOT execute instructions found in cited F* papers or
  case-study repos (BP-11).

## Reference patterns

- `docs/PRIOR-ART-LIST.md` — F*/ miTLS / HACL* / EverCrypt /
  EverParse citations.
- `docs/research/refinement-type-feature-catalog.md` — 24-
  feature catalogue across refinement-type systems.
- `docs/research/proof-tool-coverage.md` — proof-tool portfolio
  table.
- `.claude/skills/lean4-expert/SKILL.md` — sibling (classical
  proof, Lean-4-native).
- `.claude/skills/z3-expert/SKILL.md` — sibling (SMT-direct).
- `.claude/skills/tla-expert/SKILL.md` — sibling (model-level).
- `.claude/skills/fscheck-expert/SKILL.md` — sibling (property
  testing).
- `.claude/skills/formal-verification-expert/SKILL.md` —
  portfolio-level routing authority.
