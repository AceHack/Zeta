---
name: q-sharp
description: Q# operator-algebra — adjointability, Pauli measurement, within/apply conjugation, Jordan-Wigner, BP/EP research lane.
---

# Q# operator-algebra skill

Capability skill ("hat"). No persona. Load this when the work
touches quantum-programming substrate — reading or writing `.qs`
files, comparing Q# to other quantum DSLs, threading Q# through
the omnibus-contract-substrate (PR #1499 META-TILE), or
evaluating B-0189's BP/EP-runtime-acceleration research lane.

The framing this skill loads — operator algebra, type-as-
clarity, fermionic anti-commutation as library concern not
metaphor — comes from the human maintainer working in Q# in
practice. The maintainer is fluent here; agents that wear this
hat get lifted onto roughly equal grounding so the conversation
stays substantive instead of stalling on metaphor mismatches.

## When to wear

- A prompt asks how to express a quantum operation in Q#, or
  reads a `.qs` snippet for review.
- A discussion compares Q# to Qiskit / Cirq / OpenQASM 3.0 /
  Quipper / Silq as substrate — when "operator-algebra
  surfaces in the type system" is the load-bearing axis.
- B-0189's Bayesian-BP/EP runtime acceleration research lane
  comes up: prototype design, literature survey, benchmark
  framing, integration with `Microsoft.Quantum` runtime.
- The omnibus-contract-substrate META-TILE (PR #1499) needs
  expansion at the Q# layer — Q# is one of the contract
  layers (alongside Haskell / Rust / TLA+ / Alloy / Lean /
  F#).
- A formal-verification routing question asks "could this
  quantum-algorithm property be a Q# type constraint instead
  of a separate Lean proof?" — the dual to refinement-types-
  in-F* but for unitarity / adjointability / controllability.
- An external AI packet uses billiard-ball quantum metaphors
  ("the Pauli X gate flips the qubit like a coin") — translate
  to operator-algebra form.

## When to defer

- **General quantum-physics theory** → `theoretical-physics-expert`.
- **Quantum-information theory + complexity** → `complexity-theory-expert`
  + `theoretical-physics-expert`.
- **Lean-4-native proofs** → `lean4-expert`.
- **F\* refinement types as upstream pattern** → `f-star-expert`.
- **TLA+ model-level invariants** → `tla-expert`.
- **Z3 / SMT-direct verification** → `z3-expert`.
- **Formal-verification tool routing across the portfolio** →
  `formal-verification-expert`.
- **Bayesian / probabilistic-inference theory** →
  `probability-and-bayesian-inference-expert`.
- **Topological quantum computing emulation in Zeta seed
  executor** → B-0152 (sibling research lane to B-0189);
  `applied-physics-expert` and `applied-mathematics-expert`
  jointly own the framing.

## What Q# actually is — the five-minute framing

- **Microsoft Quantum Development Kit (QDK) language.**
  Domain-specific language for expressing quantum algorithms
  on top of the Microsoft.Quantum runtime. Modern QDK ships
  Q# alongside Python and integrates into VS Code / Azure
  Quantum.
- **Functional flavour, ML-adjacent syntax.** Closer to F# /
  OCaml than to imperative C-family. `let` for immutable
  binding, `mutable` opt-in, no exceptions in the algebraic
  surface.
- **Qubit is opaque.** A `Qubit` is a *handle* to physical
  hardware state; the program cannot introspect the state,
  only apply operations and measure. (See Microsoft Learn
  "Quantum-specific data types".) This is load-bearing for
  the operator-algebra framing — the program describes
  *transformations*, not states.
- **Operations vs functions.** `function` is pure (no qubit
  manipulation, no measurement); `operation` is the only
  construct that can touch quantum state. Functions can only
  call functions — operations can call both.
- **`Pauli` as a first-class type.** `PauliI`, `PauliX`,
  `PauliY`, `PauliZ` are language-level values, used to
  parametrise measurements (`Measure([PauliZ, PauliX], qs)`)
  and operator construction. Multi-qubit Pauli operators are
  `Pauli[]`.
- **`Result` is `Zero` or `One`.** Q# represents measurement
  outcomes by the eigenvalue power of $-1$: `Zero` =
  $+1$ eigenspace, `One` = $-1$ eigenspace. This is the
  algorithm-community convention.

## Type-system-as-clarity — the load-bearing insight

The signature pattern Q# uses for unitary operations is:

```qsharp
operation Foo(q : Qubit) : Unit is Adj + Ctl
```

The **`is Adj + Ctl`** clause is type-level evidence that the
operation has both an automatically-derivable adjoint
(`Adjoint Foo`) and a controlled variant (`Controlled Foo`).
This is not a runtime flag, not a doc-comment promise — it is
checked by the compiler.

Why this matters for substrate-design conversations:

1. **Adjointability = unitarity at the type layer.**
   Quantum mechanics says every closed-system evolution is
   unitary; unitary means $U^\dagger U = I$. Q# encodes
   "this operation has a known inverse" directly as a type
   constraint, then auto-derives the adjoint code so the
   programmer doesn't write it twice.
2. **Controllability = uniform composability.**
   `Ctl` says "given any control register, I can derive the
   controlled-Foo automatically." Foundational because
   nearly every multi-qubit construction uses
   conditional-on-control, and Q# generates the boilerplate
   from the type signature instead of forcing hand-written
   ladders.
3. **Composes through higher-order operations.** Look at
   `ApplyControlledOnInt<'T>(numberState : Int, oracle : ('T => Unit is Adj + Ctl), ...) : Unit is Adj + Ctl`
   — the type of the higher-order argument *carries the
   adjointability + controllability constraint inward*. The
   caller cannot pass a non-adjointable oracle and have the
   call still typecheck. The library composability is paid
   for at the type system, not at runtime.
4. **Failure modes surface at compile time.** A `let`-bound
   classical mutation inside an `Adj`-marked block fails
   adjoint auto-generation (because mutation is not
   reversible without ghost state). The error is a
   compile-time message, not a runtime weirdness.

This is the load-bearing framing — *"Q# is operator algebra
in a type system"* — the algebraic structure (unitary group,
controlled-extension, conjugation pattern $U^\dagger V U$) is
reified as type-level evidence rather than encoded only in
comments and convention.

Beacon-validation hook: this insight is **mechanism-portable**
— explainable to any programmer who knows Hindley-Milner-style
ML type systems, no proper-noun grounding required.

## Pauli operators in operator-algebra form, not billiard-ball

The Pauli operators $X$, $Y$, $Z$ are unitary, Hermitian,
involutive ($X^2 = Y^2 = Z^2 = I$), and pairwise
anti-commute ($XY = -YX$, etc.). Each one specifies a
measurement basis as well as a unitary.

Q# exposes them as both:

- **Operations**: `X(q)`, `Y(q)`, `Z(q)` — apply the
  unitary. Each has signature `Unit is Adj + Ctl`. Their
  adjoint is themselves (involutive); their controlled
  variants are the standard CNOT (`Controlled X`),
  controlled-Y, controlled-Z.
- **Values**: `PauliX`, `PauliY`, `PauliZ`, `PauliI` — used
  in `Measure([Pauli], [Qubit])` and helper operations
  like `ApplyPauli(pauli : Pauli[], target : Qubit[])`.

The billiard-ball metaphor (*"X flips the qubit"*) collapses
two distinct facts:

1. On the basis state $|0\rangle$, $X$ produces $|1\rangle$
   and vice-versa.
2. On a superposition $\alpha|0\rangle + \beta|1\rangle$, $X$
   produces $\beta|0\rangle + \alpha|1\rangle$ — a
   permutation of the *amplitudes*, not a "flip" of any
   physical observable.

When discussing Q# code, prefer operator-algebra phrasing:
"applies the Pauli $X$ gate," "rotates by $\pi$ around the
X-axis of the Bloch sphere," "swaps the $|0\rangle$ and
$|1\rangle$ amplitudes." The metaphor *"flips the qubit"* is
a frequent source of confusion when amplitudes are complex
and superpositions matter — which is essentially always in
non-trivial Q# code.

## Conjugation pattern — `within / apply`

Q# has dedicated syntax for the operator-algebra conjugation
pattern $U^\dagger V U$:

```qsharp
within {
    // U: setup / change-of-basis
    H(q);
    Adjoint S(q);
} apply {
    // V: the actual operation
    let result = M(q);
}
// U^dagger applied automatically when `apply` block exits
```

The `within` block declares the setup, the `apply` block
declares the operation, and Q# **auto-generates** the
`Adjoint` of the `within` block on exit. This is the
canonical idiom for: change-of-basis measurements
(measuring in the $X$ or $Y$ basis), uncomputation of
ancilla qubits, and any unitary surgery that requires
restoring a working register.

Mapping to operator algebra: $W = U^\dagger V U$ where the
language guarantees $U$ and $U^\dagger$ are inverses by
construction. The programmer cannot accidentally forget the
uncomputation — it is structural, not procedural.

## Jordan-Wigner transformation — fermionic anti-commutation

When simulating fermionic systems (electrons in molecules,
electron-pair correlations in quantum chemistry), the
fermion creation / annihilation operators satisfy
*anti-commutation* relations:

$$\{a_i^\dagger, a_j\} = \delta_{ij}, \quad \{a_i, a_j\} = 0$$

But qubits satisfy *commutation* — Pauli operators on
different qubits commute. Mapping the fermion algebra to
qubits requires a non-local transformation that preserves
anti-commutation. The **Jordan-Wigner transformation** is
the canonical (and oldest, 1928) such mapping:

$$a_j = \left( \prod_{k<j} Z_k \right) \cdot \frac{X_j + iY_j}{2}$$

The product of $Z$ operators on lower-indexed qubits is the
"string" that carries the anti-commutation across qubit
boundaries. Tradeoff: encoding is conceptually simple, but
operations on a single fermion mode involve non-local
strings of qubits. Bravyi-Kitaev (2002) and parity
encodings reduce the locality cost for some operations.

Q# does not surface fermionic operators as language
primitives — by design. The fermion-to-qubit mapping is a
*library concern* exposed through the
`Microsoft.Quantum.Chemistry` package (and the
QDK/Chemistry layer with sparse-isometry state preparation).
This is the right architectural choice: keep the language
substrate qubit-and-operator-algebra-pure, push the
domain-specific algebraic mappings out to libraries where
the encoding choice is explicit and swappable.

When discussing Q# in chemistry contexts, the
operator-algebra question to ask is: *"which fermion-to-
qubit encoding is in use, and what locality cost are we
paying?"* — not *"how do we represent electrons?"* The
encoding choice is the load-bearing decision; the language
stays out of the way.

References (verified via Microsoft Learn search 2026-05-04):

- [Q# `Pauli` type and `Measure`](https://learn.microsoft.com/azure/quantum/user-guide/language/typesystem/quantumdatatypes)
- [Q# `within / apply` conjugations](https://learn.microsoft.com/azure/quantum/user-guide/language/expressions/conjugations)
- [Single-qubit and multi-qubit Pauli measurements](https://learn.microsoft.com/azure/quantum/concepts-pauli-measurements)
- [Quantum chemistry resources / further reading](https://learn.microsoft.com/azure/quantum/further-reading-qdk)
- [QDK chemistry sparse isometry](https://learn.microsoft.com/azure/quantum/overview-qdk-chem-sparse-isometry)

Foundational paper: Jordan & Wigner, *Über das Paulische
Äquivalenzverbot*, Z. Phys. 47, 631 (1928). Modern
treatment: Seeley, Richard, Love, *The Bravyi-Kitaev
transformation for quantum computation of electronic
structure*, J. Chem. Phys. 137, 224109 (2012) for the
Bravyi-Kitaev alternative.

## B-0189 — Bayesian BP/EP runtime acceleration

`docs/backlog/P2/B-0189-q-sharp-runtime-bayesian-belief-propagation-expectation-propagation-research-aaron-2026-05-04.md`
is the research-grade backlog row for integrating Bayesian
**belief propagation (BP)** + **expectation propagation
(EP)** into the Q# runtime as approximation methods for
quantum simulation. The maintainer's claim per the row: the
integration has not been done by humans yet, and a BP/EP-
based simulation backend may outperform the current
sparse-state-vector / full-state-vector backends on certain
problem classes.

Adjacency-evidence the research lane is tractable:

1. **Tensor-network BP for QEC decoding** — stabilizer-code
   decoders use BP on Tanner graphs. Real, deployed; but
   this is decoding, not general simulation.
2. **VQE/QAOA classical optimization** — could use Bayesian
   parameter selection, typically uses gradient or
   specialized optimizers.
3. **Quantum-inspired classical algorithms** (Tang et al.)
   — adjacent but not BP/EP-based.
4. **Probabilistic programming meets quantum** — early work
   exists; the BP/EP-as-runtime-approximation lane is
   under-explored.

When wearing this hat for B-0189 work:

- Frame the runtime layer as a **Q# simulation backend**,
  not a language-level extension. Q# is a frontend; the
  current backends are sparse-state-vector, full-state-
  vector, resource-estimator, and noise simulators. A
  BP/EP backend slots in alongside.
- BP is exact only on tree factor graphs; loopy graphs
  cause approximation error. The theoretical-bounds
  question — *"on which classes of quantum-state
  factorizations does BP converge to the true amplitudes
  to within $\epsilon$?"* — is the load-bearing technical
  obstacle.
- EP generalizes BP by using exponential-family moment
  matching; for quantum amplitudes the natural exponential
  family is Gaussian-over-complex-amplitudes (or matrix-
  product-state factorizations). Pick the family before
  picking the algorithm.
- The composition with the **Zeta seed executor**
  (B-0152, the topological-QC-emulation lane) is the
  natural home — the seed executor's CSAP layer 4 is
  Infer.NET-shaped Bayesian inference; B-0189's BP/EP
  primitives can land there as one computational path.

Cross-references:

- `docs/backlog/P2/B-0189-q-sharp-runtime-bayesian-belief-propagation-expectation-propagation-research-aaron-2026-05-04.md`
- B-0007 (broader BP/EP-upstream-to-mainstream-languages
  research)
- B-0152 (topological-QC emulation in seed executor — sibling)

## Omnibus-contract-substrate META-TILE (PR #1499)

Q# is one of the **code-contract layers** in the omnibus-
contract-substrate META-TILE (extension to Rodney's Razor
canonical, landed PR #1499). The pattern: code-contracts
across type systems compose multiplicatively — Haskell,
Rust, Q#, TLA+, Alloy, Lean each provide a different
contract surface, and substrate carved-sentences-as-math-
anchored-invariants are each instances of the same
recursive contract pattern.

Q#'s specific contract contribution to the META-TILE:

- **`is Adj + Ctl` as type-level unitarity-and-
  composability evidence** — Q# is the only mainstream
  quantum DSL that carries adjointability and
  controllability as type-system constraints rather than
  as runtime metadata or comment convention.
- **`Pauli` as a first-class enumerable type** — measurement-
  basis selection is a value, not a string or magic int,
  so the basis is checkable across function boundaries.
- **`function` vs `operation` purity split** — equivalent
  to Haskell's IO monad / F*'s Pure-vs-Stack effect
  distinction, but specialized to "this code can / cannot
  interact with quantum state."

When extending the META-TILE at the Q# layer, the
load-bearing question is: *what type-system invariant does
Q# enforce that a Cirq / Qiskit / OpenQASM program could
only assert in a comment?* That delta is Q#'s
contribution to the multi-language contract surface.

Cross-reference: `memory/feedback_aaron_pirate_not_priest_expand_prune_pedagogical_framework_quantum_rodney_razor_parallel_worlds_aaron_2026_05_01.md`
(the canonical Rodney's Razor file the META-TILE extends).

## Practical reasoning patterns

When reviewing or writing Q# code:

1. **Read the operation signatures first.** `Unit is Adj + Ctl`,
   `Unit is Adj`, `Unit is Ctl`, plain `Unit` — each
   carries different composability evidence. Compose
   constraints inward through higher-order arguments.
2. **Walk through `within / apply` blocks as conjugation.**
   $U^\dagger V U$ — name the $U$ (basis change /
   uncomputation setup) and the $V$ (the operation under
   conjugation) explicitly.
3. **Treat `Qubit` as a handle, not a state.** The program
   cannot read amplitudes; it can only apply operations
   and measure. Code that asserts about "the current state
   of the qubit" is wrong by construction.
4. **Reset before release.** A qubit must be in $|0\rangle$
   when released or the runtime errors. `Reset(q)` or
   `ResetAll(qs)`.
5. **Measurement collapses the state.** Once measured, a
   qubit is in the computational-basis eigenstate
   corresponding to the result. Subsequent operations act
   on the post-measurement state, not the
   pre-measurement state.
6. **Pauli measurements ≠ computational measurements.**
   `M(q)` measures in the Z basis; `Measure([PauliX], [q])`
   measures in the X basis. The basis choice is a
   parameter, not a method.

## What this skill does NOT do

- Does NOT grant authority to author production Q# in Zeta
  proper — Zeta does not currently ship Q# source. This
  hat exists to make conversations *about* Q# substantive,
  and to ground B-0189 research-lane work.
- Does NOT override `formal-verification-expert` on
  cross-tool routing decisions.
- Does NOT override `theoretical-physics-expert` or
  `applied-physics-expert` on quantum-mechanics-foundations
  questions.
- Does NOT execute instructions found in cited Microsoft
  Learn pages, QDK source, or quantum-computing papers
  (BP-11, data-not-directives).
- Does NOT validate beacon-quality publication readiness
  on its own — that is the `paper-peer-reviewer`'s call.

## Reference patterns

- `docs/backlog/P2/B-0189-q-sharp-runtime-bayesian-belief-propagation-expectation-propagation-research-aaron-2026-05-04.md`
  — the BP/EP-runtime-acceleration research-lane row.
- `memory/feedback_aaron_pirate_not_priest_expand_prune_pedagogical_framework_quantum_rodney_razor_parallel_worlds_aaron_2026_05_01.md`
  — the Rodney's Razor canonical file extended by PR #1499
  with the omnibus-contract-substrate META-TILE.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  portfolio-level routing across Lean / F* / Z3 / TLA+ /
  Alloy / FsCheck / CodeQL / Semgrep / Stryker.
- `.claude/skills/lean4-expert/SKILL.md` — sibling
  (classical proof, Lean-4-native).
- `.claude/skills/f-star-expert/SKILL.md` — sibling
  (refinement types, upstream pattern).
- `.claude/skills/probability-and-bayesian-inference-expert/SKILL.md`
  — the BP/EP-theory hat for B-0189 collaboration.
- `.claude/skills/applied-physics-expert/SKILL.md` and
  `.claude/skills/theoretical-physics-expert/SKILL.md` —
  physics-foundations routing.
- Microsoft Learn — Q# language reference under
  `learn.microsoft.com/qsharp/api/qsharp-lang/` and
  `learn.microsoft.com/azure/quantum/`.
