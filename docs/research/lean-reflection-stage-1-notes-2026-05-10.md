# Lean 4 Reflection / Metaprogramming — Stage 1 Scouting Notes

**Date:** 2026-05-10  
**Stage:** 1 — Read-only reflection competence  
**Backlog row:** 081KQ3HBZ0008QG0R000H8K8CC (P2)  
**Teaching discipline:** additive-layering, Mr-Khan-pedagogy posture — free to read, prior understanding preserved

---

## Purpose

Stage 1 goal: be able to **read** Lean 4 code that uses `MetaM`, `TermElabM`,
`macro`, `elab_rules`, and attributes (`@[simp]`, `@[reducible]`, `@[deprecated]`)
and explain what each piece does. Navigate Mathlib tactic code with comprehension.
Diagnose elaboration errors by tracing the `Syntax → Expr` pipeline.

This note covers what we need to know at Stage 1. It is the teachable artifact
per the teaching-discipline commitment in 081KQ3HBZ0008QG0R000H8K8CC — the next learner (human or
agent) picks up from here.

---

## The Three-Stage Lean 4 Compilation Pipeline

```
Source text
    │
    ▼
[1] Parser → Syntax (parse tree, no semantics, just structure)
    │
    ▼ (macro expansion — Syntax → Syntax, recursive until fixed point)
[2] Macros
    │
    ▼
[3] Elaborator → Expr (typed AST, semantics, de Bruijn-indexed)
    │
    ▼
Type-checker → kernel-checked proof term
```

**Key insight:** Macros are pure syntax manipulation (no type information).
Elaborators introduce types and resolve references. The two are cleanly separated.
When you read metaprogramming code, the first question is: which stage does
this code live in?

---

## Core Data Types

### `Syntax`

A parse tree node. No semantic meaning — just structure. Produced by parsing,
consumed by macros and elaborators.

```lean

-- The `Syntax` type has four variants:

-- Syntax.missing  — parse error placeholder
-- Syntax.node k children  — internal node (k = SyntaxNodeKind = Name)
-- Syntax.atom info val  — terminal (a string like "+" or "if")
-- Syntax.ident info rawVal val pre  — identifier
```

When you see `stx : Syntax` in code, you're reading code that works with
raw parse trees — usually a macro or the entry point of an elaborator.

**Quotation syntax (backticks):** The primary way to work with `Syntax`.

```lean
`(term| $a + $b)     -- match or construct an addition expression
`(tactic| ring)      -- a syntax node for the `ring` tactic
`($x:ident)          -- anti-quotation: insert variable x as an identifier
```

Anti-quotations (`$x`) splice variables into or extract variables from syntax
trees. The category annotation (`:term`, `:ident`, `:tactic`) tells the parser
what syntactic category to use.

### `Expr`

The internal AST. Fully typed, de Bruijn-indexed (variables are numbers, not
names — avoids capture). Produced by elaboration, consumed by the kernel.

```lean

-- Key Expr constructors:
Expr.bvar (deBruijn : Nat)       -- bound variable (number = distance to binder)
Expr.fvar (id : FVarId)          -- free variable in local context
Expr.mvar (id : MVarId)          -- metavariable (unsolved goal / placeholder)
Expr.const (name : Name) (levels) -- reference to a global definition
Expr.app (f arg : Expr)          -- function application
Expr.lam (binderName : Name) (binderType body : Expr) (bi : BinderInfo)
Expr.forallE (binderName : Name) (binderType body : Expr) (bi : BinderInfo)
Expr.letE (declName : Name) (type val body : Expr) (nonDep : Bool)
Expr.lit (val : Literal)         -- numeric / string literals
Expr.sort (u : Level)            -- `Type u`, `Prop` = `Sort 0`
```

When you see `e : Expr` in code, you're in elaboration or proof-term manipulation
territory.

---

## The Monad Stack

Each layer adds more state/context. The stack is:

```
CoreM           — global environment (all known definitions/constants)
  └── MetaM     — metavariable context (unsolved goals, local contexts)
        └── TermElabM  — term elaboration state (pending synthesis, etc.)
              └── TacticM    — list of current proof goals
```

Every monad can run those below it: `MetaM` can call `CoreM`; `TermElabM`
can call `MetaM`; `TacticM` can call `TermElabM`. Reading code, look at the
return type's monad to know what context the computation has access to.

### `CoreM`

Access to the global `Environment` — the set of all declared constants,
inductive types, and their definitions.

```lean
getEnv : CoreM Environment
getConst (name : Name) : CoreM (Option ConstantInfo)
```

### `MetaM`

The key metaprogramming monad. Adds metavariable context (a mapping from
`MVarId` to assigned/unassigned `Expr`s) and local contexts (`LocalContext`
— the variables in scope at a given proof state).

```lean

-- Create a fresh metavariable (a "hole" to fill later)
mkFreshExprMVar (type? : Option Expr) : MetaM Expr

-- Assign a metavariable
assign (mvarId : MVarId) (val : Expr) : MetaM Unit

-- Substitute all assigned metavariables into an expression
instantiateMVars (e : Expr) : MetaM Expr

-- Run computation in a local context (the hypotheses available in a proof)
withLocalContext (lctx : LocalContext) (m : MetaM α) : MetaM α

-- Infer the type of an expression
inferType (e : Expr) : MetaM Expr

-- Check definitional equality (unification)
isDefEq (a b : Expr) : MetaM Bool
```

When you see `MetaM`, the code is doing proof-search-level manipulation —
creating unknown terms, checking if two types are the same, filling in
implicit arguments.

### `TermElabM`

Used inside term elaborators (the functions that turn `Syntax` into `Expr`).
Adds a layer for handling "synthetic metavariables" — goals that elaboration
defers for later solving (typeclasses, coercions, tactic blocks).

The signature of a **term elaborator**:

```lean

-- stx: the Syntax node to elaborate
-- expectedType?: what type the result should have (can be `none`)
-- returns: the Expr this syntax elaborates to
def myElab (stx : Syntax) (expectedType? : Option Expr) : TermElabM Expr := ...
```

### `TacticM`

Used inside tactic implementations. Has access to the list of current goals
(`MVarId`s) and can manipulate them.

```lean

-- Get all current goals
getGoals : TacticM (List MVarId)

-- Close a goal with a proof term
closeMainGoal (e : Expr) : TacticM Unit

-- Run a tactic on the main goal
evalTactic (tactic : Syntax) : TacticM Unit
```

---

## Macros, `macro_rules`, `elab_rules`

### `macro` / `macro_rules` — Syntax → Syntax

The simplest metaprogramming tool. A macro takes a `Syntax` tree and returns
a new `Syntax` tree. No type information. Pure structural rewriting.

```lean

-- Single-rule macro (the `macro` keyword)
macro "myNotation" x:term "⊕" y:term : term => `($x + $y + 0)

-- Multi-rule macro (the `macro_rules` keyword)
macro_rules
  | `(myNotation $x $y) => `($x + $y)
  | `(myNotation $x) => `($x)
```

Macros are **hygienic by default**: names introduced in macro expansions are
scoped to avoid capture. To intentionally expose a name (make it available in
the caller's scope), use `mkIdent`.

### `elab` / `elab_rules` — Syntax → TermElabM Expr

Used when the expansion needs type information or proof search. The elaborator
receives the expected type and can create metavariables.

```lean

-- Single elaborator
elab "myTerm" : term => do
  let type ← inferType (mkConst `Nat)
  return mkConst `Nat.zero

-- Multi-rule elaborator
elab_rules : term
  | `(myTerm $x) => elabTerm x none
```

**Reading rule:** if you see `elab` or `elab_rules`, you're in `TermElabM`
territory and the code needs type information. If you see `macro` or
`macro_rules`, it's pure syntax rewriting.

### `@[macro xxx]` and `@[command_elab xxx]`

Lower-level registration: registers a function as the macro/elaborator for
a syntax kind named `xxx`. The `macro` / `elab` keywords are syntactic sugar
over these.

---

## Attributes

Attributes are metadata attached to definitions via `@[attrName]`. They tell
Lean's subsystems how to handle the definition.

### `@[simp]`

Registers a theorem/lemma as a rewrite rule for the `simp` tactic.

```lean
@[simp] theorem zInv_zero (s : Stream G) : zInv s 0 = 0 := rfl
```

When `simp` runs, it tries to rewrite the goal using all `@[simp]`-tagged
lemmas whose LHS matches. Direction: LHS → RHS (LHS is the "complex" form,
RHS is the "simplified" form).

**Reading `DbspChainRule.lean`:** `zInv_zero` and `zInv_succ` are `@[simp]`
so that calls to `simp [I, D, zInv]` in the proof automatically close goals
involving `zInv s 0 = 0`.

### `@[reducible]`

Marks a definition as unfoldable by proof automation. The default is
`semireducible` (unfolded only when needed); `reducible` means "always unfold."
`@[irreducible]` means "never unfold" (useful for abstract types).

```lean

-- In DbspChainRule.lean:
abbrev ZSet (K : Type _) : Type _ := K →₀ ℤ
abbrev Stream (G : Type _) : Type _ := ℕ → G
```

`abbrev` is syntactic sugar for `@[reducible] def` — the type alias is always
unfolded, so `Stream G` and `ℕ → G` are definitionally equal.

### `@[deprecated]`

Marks a definition as deprecated, producing a warning when used. Takes the
replacement name.

```lean

-- In DbspChainRule.lean:
@[deprecated Dop_LTI_commute (since := "2026-04-19")]
theorem chain_rule ... := Dop_LTI_commute ...
```

This is Lean's built-in deprecation system — not a metaprogramming hook, just
metadata for tooling.

### `@[ext]`

Tags a theorem as an extensionality lemma. The `ext` tactic uses these to
decompose equality goals.

### `@[simp]` sets management

When reading tactic proofs, `simp [lemma1, lemma2]` adds those lemmas to the
simp set for that call only. `simp only [lemma1]` restricts to ONLY those
lemmas (no global `@[simp]` set). The difference matters for proof robustness
across Mathlib bumps: `simp only` is more stable.

---

## Reading Mathlib Tactic Code

Mathlib uses reflection heavily. The pattern to recognize:

```
import Mathlib.Tactic.Ring    -- imports the `ring` tactic
import Mathlib.Tactic.Abel    -- imports the `abel` tactic
import Mathlib.Tactic.Linarith -- imports the `linarith` tactic
```

Each of these tactics is implemented as a `TacticM Unit` that manipulates
the goal list. When you read `by ring` in a proof, you're seeing `TacticM`
run the `ring` elaborator, which internally calls into `MetaM` to build a
proof term.

**The pattern in `DbspChainRule.lean` to read:**

```lean
theorem T3 ... := by
  induction n with
  | zero => simp [I, zInv]          -- TacticM: apply induction, simp closes base
  | succ n ih =>                    -- TacticM: introduce induction hypothesis
    rw [hL, hR, zInv_succ, ih]      -- TacticM: rewrite using lemmas
    abel                            -- TacticM: close abelian group identity
```

Each tactic line is elaborated as a `TacticM Unit` that transforms the goal list.
`by` switches from term mode to tactic mode.

---

## What Zeta's Lean Code Already Uses (Stage 1 Reading Inventory)

From `tools/lean4/Lean4/DbspChainRule.lean`:

| Feature | Occurrence | What it does |
|---------|-----------|--------------|
| `@[simp]` | `zInv_zero`, `zInv_succ` | Auto-close `simp` goals matching these patterns |
| `@[deprecated]` | `chain_rule` | Warning when old name used; points to `Dop_LTI_commute` |
| `abbrev` (`@[reducible] def`) | `ZSet`, `Stream` | Transparent type aliases |
| `structure` | `IsLinear`, `IsCausal`, `IsTimeInvariant`, `IsPointwiseLinear` | Record types used as proof predicates |
| `theorem`/`lemma` in `by` mode | All proofs | Tactic-mode proof blocks (TacticM) |
| `simp`, `abel`, `ring`, `rfl` | Throughout | Core tactics from Mathlib |
| `funext` | `D_I_eq`, `I_D_eq`, etc. | Functional extensionality — closes `f = g` by proving `∀ x, f x = g x` |
| `cases n with \| zero => ... \| succ n => ...` | Throughout | Pattern-match on `Nat` for inductive proofs |
| `rw [lemma1, lemma2]` | Throughout | Rewrite goal using equalities |
| `obtain ⟨phi, hphi⟩ := hf.pointwise` | `IsPointwiseLinear` proofs | Destructure an existential |
| `calc` | `linear_commute_I` | Chain of equalities with justifications |

**None of the current code uses `MetaM`, `TermElabM`, `macro`, or `elab_rules`
directly** — all tactic usage goes through Mathlib's pre-built tactics.
Stage 2 (tactic authoring) is where we'd write code that USES these monads.

---

## Elaboration Error Diagnosis (Stage 1 Level)

Common error patterns and what they mean:

| Error | What it means |
|-------|--------------|
| `unknown identifier 'x'` | `x` is not in scope; check binder structure |
| `type mismatch` | Elaboration inferred type A, expected type B; check `abbrev`/`def` unfolding |
| `function expected at f` | `f` is not a function — universe or application-order issue |
| `failed to synthesize TypeClass instance` | Typeclass resolution failed; a `@[instance]` is missing or ambiguous |
| `maximum recursion depth reached` | Macro loop or infinite type-class search |
| `metavariable ... has not been assigned` | A `?` placeholder in a term was never resolved |

---

## Authoritative Resources

- **Lean 4 Metaprogramming Book:**
  `https://leanprover-community.github.io/lean4-metaprogramming-book/`
  Chapters: Overview, Expressions, MetaM, Syntax, Macros, Elaboration
- **Lean 4 Official Reference:**
  `https://lean-lang.org/doc/reference/latest/`
- **Mathlib4 Metaprogramming wiki:**
  `https://github.com/leanprover-community/mathlib4/wiki/Metaprogramming-for-dummies`

---

## Stage 2 Preview (next step)

Stage 2 is tactic authoring — writing a simple tactic (e.g., `by decide_retractible`)
using `TacticM`. The prerequisite from Stage 1: understanding what `MVarId` goals
look like, how `MetaM` manipulates them, and how `closeMainGoal` closes a goal
with a proof term. All of that is now in this note.

**Composes with:**

- `tools/lean4/Lean4/DbspChainRule.lean` — the proof that benefits from Stage 2+
- 081KQ3HBZ0008QG0R002SM3G49 — isomorphism catalog, IF4 filter
- 081KQ3HBZ0008QG0R003JCR6P8 — 3-colorability (Stage 4 decision procedure target)
- `.claude/skills/lean4-expert/SKILL.md` — the complementary build/proof skill
- `.claude/skills/lean-reflection-expert/SKILL.md` — the Stage 1 capability skill (this PR)
