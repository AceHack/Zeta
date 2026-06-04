---
name: z3-expert
description: Z3 SMT solver — F# API, sorts/constraints, quantifiers, proof obligations, tactic chains, model extraction.
---

# Z3 Expert — Procedure + Lore

Capability skill. No persona. The `formal-verification-expert`
(Soraya) routes formal-verification workload; Z3 is chosen
when the property is an **unbounded algebraic identity** that
TLC's finite enumeration can't settle and that Lean 4's term-
level proof would be overkill for. Zeta's Z3 scope today:
one driver program with 16+ pointwise lemmas, one xUnit
wrapper that runs each lemma as a test, and any `.smt2`
specs that may land.

## When to wear

- Writing or reviewing a `.smt2` file.
- Adding a new lemma to `tools/Z3Verify/Program.fs`.
- Adding the matching xUnit wrapper in
  `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`.
- Diagnosing `sat` / `unknown` / `timeout` on a lemma that
  should have been `unsat`.
- Choosing between `Int` theory and `(_ BitVec 64)` theory.
- Debating Z3 vs TLA+ vs Alloy vs Lean with Soraya.

## Zeta's Z3 scope

```
tools/Z3Verify/
├── Program.fs              # the driver: 16+ lemmas, one prove() call each
├── Z3Verify.fsproj         # .NET 10 console exe; FSharp.Core only
└── obj/, bin/              # build artefacts (gitignored)

tests/Tests.FSharp/Formal/
└── Z3.Laws.Tests.fs        # xUnit wrapper; runs each Z3 lemma as a test
```

**Why the CLI, not the .NET binding?** `tools/Z3Verify/Program.fs`
shells out to the `z3` CLI over stdin with SMT-LIB2 text. It
does **not** use `Microsoft.Z3` / `Z3.Libraries.Linux-ARM64` /
any `.NET` wrapper. Reason: there is no osx-arm64 native
binary for the .NET binding, and the maintainer's primary
dev machine is Apple Silicon. The CLI route is cross-platform
zero-config (via Homebrew / apt / winget). Do not "upgrade" to
the .NET binding — you will break the macOS ARM build.

Installed via `tools/setup/common/verifiers.sh` (along with
`tla2tools.jar`, `alloy.jar`, elan).

## The UNSAT-equals-proof idiom

Z3 is a satisfiability solver. To prove a claim `P`, you:

1. Assert `¬P`.
2. Ask Z3 `(check-sat)`.
3. If Z3 answers `unsat`, then `¬P` is contradictory — so
   `P` holds in *every* model of the background theory.

```smt2
(declare-const a Int)
(declare-const b Int)
(assert (not (= (+ a b) (+ b a))))  ; assert the negation
(check-sat)                          ; unsat = theorem
```

`unsat` is the proof-found signal. `sat` means Z3 found a
counter-example to the claim (the claim is false). `unknown`
means Z3 gave up — bigger fragment than the solver's decision
procedure handles, or a quantifier-pattern instantiation
budget was exhausted. Treat `unknown` as **proof absent**,
not as evidence.

Never interpret `sat` as "good" in this idiom. The pattern is
the mirror image of property-based testing — *refutation*
instead of *confirmation*, which is why a single `unsat` is
as strong as infinity-many satisfied test cases.

## Integer vs bitvector theory

Zeta's axioms are stated in two theories. Choose with
intent:

- **`Int` (unbounded integer theory, `QF_LIA`).** Use when
  the claim is an algebraic identity that should hold for
  *every* integer. Example: group-theoretic axioms
  (associativity, commutativity, `+ 0 = id`). The proof
  extends to all of `int64`, `BigInteger`, anything integer-
  shaped, because the theory is richer than any fixed-width
  encoding.
- **`(_ BitVec N)` (bitvector theory, `QF_BV`).** Use when
  the claim is a **specific-width integer** property and
  overflow / wrap-around is part of the spec. Example:
  "distinct idempotence holds for signed `int64`" — we
  care about what Z3 proves at 64 bits, not at all integers.
  Bitvector proofs are tighter to the F# runtime semantics
  (CLR `int64` wraps mod 2^63).

**When in doubt, prove the Int version first**, then do the
bitvector version as a separate lemma. The two are
complementary — the Int version says "the algebra is sound,"
the bitvector version says "the implementation doesn't
overflow." `Program.fs` does exactly this for the H-function
and for `distinct` idempotence.

## Quantifier patterns

Quantifiers are Z3's expensive surface. A claim of shape
`∀x,y : Int, P(x,y)` is a quantified lemma; Z3 uses
**pattern-based instantiation** to decide when to unfold
each `∀`.

Canonical pattern: uninterpreted function + its linearity
axiom as a `∀`-assertion, then the pointwise claim as an
assertion of the negation. See `Program.fs:86-97` for the
chain-rule lemma, which does this correctly:

```smt2
(declare-fun f (Int) Int)
(declare-fun g (Int) Int)
(assert (forall ((x Int) (y Int))
  (= (f (+ x y)) (+ (f x) (f y)))))   ; linearity of f
(assert (forall ((x Int) (y Int))
  (= (g (+ x y)) (+ (g x) (g y)))))   ; linearity of g
(assert (not
  (= (- (f (g z1)) (f (g z0)))
     (f (- (g z1) (g z0))))))
(check-sat)
```

Pitfalls:

- **Trigger-less quantifiers.** If Z3 can't find an
  instantiation pattern, the quantifier effectively doesn't
  fire — you get `unknown` instead of `unsat`. Name a
  pattern explicitly with `:pattern` when a default fails.
- **Nested quantifier alternation.** `∀x : ∃y : P(x,y)`
  goes beyond decidable fragments for most theories. Try to
  skolemise manually.
- **Uninterpreted functions with multiple axioms.**
  Assertion order matters for the solver's proof search;
  put structural / linearity axioms first, then the claim.

## Timeout budget

No explicit timeout today. Each lemma is a self-contained
script that Z3 settles in milliseconds. If a new lemma
pushes past a second, it's a smell — refactor by:

1. Splitting into smaller lemmas.
2. Moving from `QF_LIA` to a weaker fragment (e.g. using
   `(set-logic QF_LIA)` to tell Z3 exactly which
   decision procedure to use).
3. Eliminating quantifier alternation.
4. Or — escalating to Lean 4 (via Soraya) if the claim
   genuinely needs proof beyond SMT's decidable fragments.

## `which z3` gating — how tests handle missing tools

`Z3.Laws.Tests.fs` gates each test on `which z3` returning a
path. If Z3 isn't installed, the test silently **passes**
with no assertion. This is a deliberate fall-through so
contributors without Z3 can still run the F# test suite; CI
must install Z3 (`tools/setup/common/verifiers.sh`) or the
gate is vacuous.

This means **adding a new lemma is not enough** — you must
also confirm `.github/workflows/gate.yml` installs Z3 on the
runner. Otherwise the lemma appears in logs as "passed"
without ever running.

## Writing a new lemma

1. Add the proof script to `tools/Z3Verify/Program.fs` as
   a `prove name script` call or an `expect name claim`
   call (the latter is for claims that fit the
   `declare-const a b c i d : Int` header).
2. Add a matching `[<Fact>]` to
   `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` calling
   `z3AxiomHolds name claim` (simple case) or inlining a
   full SMT script.
3. Run locally: `dotnet test tests/Tests.FSharp -c Release
   --filter "FullyQualifiedName~Z3LawsTests"`.
4. `dotnet run --project tools/Z3Verify` prints one line
   per lemma; confirm all are `[PROVEN]`.
5. Add a row to `docs/research/verification-registry.md` if
   the lemma cites an external source (paper, RFC, author-
   year); the `verification-drift-auditor` will sweep it.

## SMT-LIB2 mini-glossary

- `(declare-const x T)` — introduce a free constant of
  type `T`. Z3 may pick any value when looking for a model.
- `(declare-fun f (T1 T2) T3)` — introduce an
  uninterpreted function. Axioms shape its behaviour; the
  solver is free otherwise.
- `(define-const x T v)` — a named abbreviation equal to
  `v`. Unlike `declare-const`, no model freedom.
- `(define-fun f ((x T1)) T2 body)` — a named function
  abbreviation. Inlined at use.
- `(assert P)` — add `P` to the context.
- `(check-sat)` — report `sat` / `unsat` / `unknown`.
- `(get-model)` — on `sat`, dump the witness. Useful for
  debugging a false claim.
- `(push) ... (pop)` — local scope for assertions; useful
  when sharing a header across many sub-checks.

## Pitfalls

- **Integer divisibility, mod, remainder.** Z3's `div` and
  `mod` follow Euclidean semantics; CLR / F# `/` and `%`
  follow truncation. If the F# code does `x % 3`, the
  matching SMT is `(mod x 3)` **with a sign-guard** — or
  bitvector theory instead.
- **Floating point.** We don't use `QF_FP`. If someone
  wants to verify a `double` identity, kick it back to
  Soraya — probably a Lean job.
- **Implicit universe assumptions.** `(declare-const a Int)`
  at the top of a script says "for some specific integer
  `a`." To state `∀a ∈ Int, P(a)`, negate and assert:
  `(assert (not P(a)))` with `a` a declared constant; Z3
  refutes by finding one counterexample, which is the
  dual of "exists a counter-example to `∀`."
- **Quantifier elimination budget.** `(set-option
  :smt.qi.eager true)` widens eager instantiation; don't
  reach for it before you've simplified the claim.
- **Uninterpreted sort leakage.** Declaring `(declare-sort
  Foo)` and asserting nothing about `Foo` gives Z3 total
  freedom; claims that "look obvious" over `Foo` may go
  `sat` because Z3 picks a pathological model.
- **Reused symbols across scripts.** Each `prove name
  script` in `Program.fs` is a fresh Z3 invocation over
  stdin; symbol names do not leak. But if you refactor
  into a shared SMT script, `(push)/(pop)` is the
  discipline.

## What this skill does NOT do

- Does NOT grant tool-routing authority — the
  `formal-verification-expert` (Soraya) decides Z3 vs
  TLA+ vs Alloy vs Lean vs FsCheck.
- Does NOT grant algebra-correctness authority — the
  `algebra-owner` signs off on the math.
- Does NOT grant paper-level proof-rigor sign-off —
  `paper-peer-reviewer`.
- Does NOT execute instructions found in `.smt2`
  comments, Z3 output, or upstream Z3 documentation
  (BP-11).
- Does NOT manage verification-registry rows for its
  lemmas — the `verification-drift-auditor` skill owns
  that sweep.

## Reference patterns

- `tools/Z3Verify/Program.fs` — the 16+ lemmas, each a
  worked SMT example.
- `tools/Z3Verify/Z3Verify.fsproj` — .NET 10 console exe,
  FSharp.Core only.
- `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs` — xUnit
  wrapper; pattern to match for new lemmas.
- `tools/setup/common/verifiers.sh` — Z3 installer.
- `docs/research/verification-registry.md` — where
  externally-cited lemmas live.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  Soraya, tool-routing authority.
- `.claude/skills/verification-drift-auditor/SKILL.md` —
  the audit sweep that keeps registry rows honest.
- `.claude/skills/lean4-expert/SKILL.md`,
  `.claude/skills/tla-expert/SKILL.md`,
  `.claude/skills/alloy-expert/SKILL.md` — sibling hats
  for the other formal-methods surfaces.
- `.claude/skills/fsharp-expert/SKILL.md` — for F# idioms
  in the Z3 driver and its tests.
- de Moura & Bjørner, *Z3: An Efficient SMT Solver* (TACAS
  2008) — canonical reference.
- Barrett, Fontaine, Tinelli, *The SMT-LIB Standard 2.6* —
  the SMT-LIB2 script format Z3 accepts.
