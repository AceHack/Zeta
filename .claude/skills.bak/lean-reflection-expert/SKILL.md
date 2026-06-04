---
name: lean-reflection-expert
description: "Lean 4 metaprogramming — MetaM, TermElabM, TacticM, macro/elab_rules, Syntax/Expr pipeline, simp/reducible attributes."
stage: 1
backlog: B-0050
---

# Lean 4 Reflection Expert — Stage 1 (Read-Only Competence)

Capability skill. Stage 1 only: read and diagnose existing Lean 4
metaprogramming code. Does NOT yet author new tactics, macros, or
elaborators (Stages 2-5).

Complements `lean4-expert` (which covers `lake build`, tactic basics,
Mathlib imports, sorry discipline). This skill covers the layer beneath
the user-facing tactics — the metaprogramming infrastructure that BUILDS
them.

## When to wear

- Reading Lean 4 code that uses `MetaM`, `TermElabM`, `TacticM`
- Diagnosing elaboration errors ("type mismatch", "failed to synthesize")
- Explaining what a `macro`, `macro_rules`, `elab`, or `elab_rules`
  definition does
- Explaining what `@[simp]`, `@[reducible]`, `@[irreducible]`,
  `@[deprecated]` attributes do to a definition
- Navigating Mathlib tactic source code to understand how a tactic works
- Answering "what does this `Syntax`/`Expr` code do?"

## The three-stage pipeline

```
Source text
    │
[1] Parser → Syntax (no semantics, just structure)
    │
    ▼ macro expansion (Syntax → Syntax, recursive)
[2] Macros
    │
    ▼
[3] Elaborator → Expr (typed AST, de Bruijn-indexed)
    │
Type-checker → kernel-verified proof term
```

**Macros** = pure syntax rewriting (no type information).
**Elaborators** = produce typed `Expr` (have type information, can
call back into elaboration). The two are cleanly separated.

## The monad stack

```
CoreM           — global environment (all constants/definitions)
  └── MetaM     — metavariable context (unsolved goals, local contexts)
        └── TermElabM  — term elaboration state (typeclass deferral, etc.)
              └── TacticM    — current proof goal list
```

Each monad can run those below it. Read the return type's monad to know
what the computation has access to.

### `MetaM` — key operations to recognize

```lean
mkFreshExprMVar (type? : Option Expr) : MetaM Expr
  -- creates a "hole" (unknown term) of the given type

assign (mvarId : MVarId) (val : Expr) : MetaM Unit
  -- fills a hole with a proof term

instantiateMVars (e : Expr) : MetaM Expr
  -- substitute all assigned holes into an expression

inferType (e : Expr) : MetaM Expr
  -- what type does this expression have?

isDefEq (a b : Expr) : MetaM Bool
  -- are these two types definitionally equal (unifiable)?
```

### `TermElabM` — term elaborator signature

```lean
def myElab (stx : Syntax) (expectedType? : Option Expr) : TermElabM Expr
```

When you see this signature, the function converts a parse tree
(`Syntax`) into a typed expression (`Expr`), with optional type hint.

### `TacticM` — tactic implementation pattern

```lean
def myTactic : TacticM Unit := do
  let goal ← getMainGoal           -- current goal MVarId
  let goalType ← inferType (mkMVar goal)  -- what we need to prove
  closeMainGoal proofTerm           -- close goal with proof term
```

## Syntax and quotations

**Quotation syntax (backticks):**

```lean
`(term| $a + $b)        -- match/construct addition syntax
`(tactic| ring)         -- syntax node for the `ring` tactic
`($x:ident)             -- anti-quotation: insert/extract identifier
`(term| if $c then $t else $e)  -- conditional
$[...],*                -- splice: zero-or-more comma-separated items
```

Backtick expressions create or pattern-match `Syntax` objects.
Anti-quotations (`$x`) are the "holes" — they bind variables
into/from the syntax tree.

## Macro vs. elab

| Feature | Input → Output | Monad | When to use |
|---------|----------------|-------|-------------|
| `macro` / `macro_rules` | Syntax → Syntax | `MacroM` | Pure structural rewriting; no types needed |
| `elab` / `elab_rules` | Syntax → Expr | `TermElabM` | Need type information or proof search |
| `@[macro xxx]` | Syntax → Syntax | `MacroM` | Low-level macro registration |
| `@[command_elab xxx]` | Syntax → `CommandElabM Unit` | `CommandElabM` | Commands (not terms) |

## Attributes — reading guide

| Attribute | What it does |
|-----------|-------------|
| `@[simp]` | Register as rewrite rule for the `simp` tactic (LHS → RHS direction) |
| `@[reducible]` / `abbrev` | Always unfold in proof search (transparent type alias) |
| `@[semireducible]` (default) | Unfold when needed (default for `def`) |
| `@[irreducible]` | Never unfold (abstract type; prevents leaking internals) |
| `@[deprecated name (since := "date")]` | Warning when used; tooling shows replacement |
| `@[ext]` | Register as extensionality lemma for `ext` tactic |
| `@[instance]` | Register as typeclass instance for synthesis |
| `@[inline]` / `@[specialize]` | Compiler hints; not semantically meaningful in proofs |

## What Zeta's code already uses

From `tools/lean4/Lean4/DbspChainRule.lean`:

| Feature | Usage | Reading |
|---------|-------|---------|
| `@[simp] theorem zInv_zero` | Auto-applied by `simp [zInv]` | Closes `zInv s 0 = 0` goals automatically |
| `@[deprecated Dop_LTI_commute]` | Warning on old `chain_rule` name | Points users to `Dop_LTI_commute` |
| `abbrev ZSet (K) := K →₀ ℤ` | Transparent alias | `ZSet K` and `K →₀ ℤ` are definitionally equal everywhere |
| `abbrev Stream (G) := ℕ → G` | Transparent alias | Same — `ℕ → G` is always acceptable where `Stream G` is expected |
| `structure IsLinear (f) : Prop where` | Proof predicate | A record type grouping multiple proof fields (`map_zero`, `map_add`) |
| `simp [I, zInv]` | Unfold + rewrite | Unfolds `I` and `zInv` definitions, applies all `@[simp]` lemmas |
| `simp only [lemma1]` | Restricted simp | Only use `lemma1`; no global simp set (more stable across Mathlib bumps) |
| `funext n` | Function extensionality | Close `f = g` by proving `∀ n, f n = g n` |
| `obtain ⟨phi, hphi⟩ := hf.pointwise` | Existential destructure | Unpack `∃ phi, ...` hypothesis |
| `calc expr = ... := ... _ = ... := ...` | Equational chain | Chain of equalities with per-step justifications |

**None of the current Zeta Lean code uses `MetaM`, `TermElabM`, `macro`,
or `elab_rules` directly.** Those are the Stage 2+ targets.

## Elaboration error reading guide

| Error text | Meaning |
|-----------|---------|
| `unknown identifier 'x'` | `x` is not in scope; check binder structure or missing `intro` |
| `type mismatch, expected T, got U` | Elaborator inferred type U; expected T; check `abbrev` / unfolding |
| `function expected at f, term has type T` | `f` is not a function — wrong arity or universe level |
| `failed to synthesize TypeClass instance` | Missing `@[instance]` or ambiguous resolution |
| `maximum recursion depth reached` | Macro loop or infinite typeclass chain |
| `metavariable ?m has not been assigned` | A `?` hole was created but never closed |
| `application type mismatch` | Argument type mismatch — check implicit arguments |

## Mathlib tactic reading pattern

When reading a tactic like `by ring` or `by abel`:

1. `by` switches to `TacticM` mode
2. `ring` / `abel` are tactic names — elaborated by registered `TacticM`
   functions from `Mathlib.Tactic.Ring` / `Mathlib.Tactic.Abel`
3. Each tactic internally calls into `MetaM` to build a proof term
4. `simp` is special: it runs a simplification engine using all `@[simp]`
   lemmas registered in the current import context

## Stage 2 prerequisite checklist (not yet implemented)

To move to Stage 2 (tactic authoring), the following are prerequisites:

- [ ] Understand `MVarId` and what a "goal" looks like as an `Expr`
- [ ] Understand `closeMainGoal` / `liftMetaTactic` patterns
- [ ] Write a trivial `TacticM Unit` that closes a goal with `rfl`
- [ ] Wire it as `macro "my_tactic" : tactic => ...` or `elab_rules : tactic`

## Does NOT do

- Stage 2: Writing new tactics (use when Stage 2 is shipped)
- Stage 3: Macro/elab authoring (notation, custom syntax)
- Stage 4: Decision-procedure authoring
- Stage 5: `aesop`/`polyrith`/`linarith` extension
- Build/proof mechanics — that's `lean4-expert`
- Formal-verification routing (Lean vs Z3 vs TLA+) — that's
  `formal-verification-expert`
- Algebra correctness sign-off — that's `algebra-owner`
- Paper-level proof rigor — that's `paper-peer-reviewer`

## Reference

- Scouting note: `docs/research/lean-reflection-stage-1-notes-2026-05-10.md`
- Real proof surface: `tools/lean4/Lean4/DbspChainRule.lean`
- Complementary skill: `.claude/skills/lean4-expert/SKILL.md`
- Routing authority: `.claude/skills/formal-verification-expert/SKILL.md`
- Primary reading: `https://leanprover-community.github.io/lean4-metaprogramming-book/`
