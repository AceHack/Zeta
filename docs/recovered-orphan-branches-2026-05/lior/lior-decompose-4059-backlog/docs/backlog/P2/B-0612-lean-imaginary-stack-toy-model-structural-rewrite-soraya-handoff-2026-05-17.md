---
id: B-0612
priority: P2
status: open
title: "Lean ImaginaryStack/ToyModel.lean structural rewrite — Imag8 projections + sorry-in-type-position + lakefile wiring (Soraya handoff)"
tier: research
effort: M
created: 2026-05-17
last_updated: 2026-05-17
depends_on: [B-0584, B-0543]
composes_with: [B-0584, B-0543]
tags: [lean4, mathlib, formal-verification, soraya, imaginary-stack, qg-isomorphism]
type: research
---

# Lean ImaginaryStack/ToyModel.lean structural rewrite — Soraya handoff

## Parent

[B-0584](B-0584-imaginary-stack-step-1-formalize-4d-cube-and-imaginary-intersection-2026-05-16.md) (the Imaginary Stack Step-1 row this rewrite addresses) and [B-0543](B-0543-qg-isomorphism-proof-path-remember-when-pay-attention-axioms-to-quantum-gravity-2026-05-15.md) (the QG isomorphism proof path).

## Why

`tools/lean4/ImaginaryStack/ToyModel.lean` shipped via PR [#4059](https://github.com/Lucent-Financial-Group/Zeta/pull/4059) as research-grade substrate cherry-picked from Riven's Cursor-Lean4 sketch (per `memory/persona/riven/conversations/2026-05-17-riven-aaron-cursor-lean4-sketch-handoff-to-soraya-b0543-qg-isomorphism-proof-path.md`). Reviewer triage in tick shard [`docs/hygiene-history/ticks/2026/05/17/1218Z.md`](../../hygiene-history/ticks/2026/05/17/1218Z.md) verified three structural P0/P1 findings:

### P0 — Imag8 tuple projections do not typecheck

**File:** `tools/lean4/ImaginaryStack/ToyModel.lean:86-100, 137-138`

`abbrev Imag8 := F × F × F × F × F × F × F × F` is right-nested as `F × (F × (F × …))`. Lean's `Prod` admits only `.1` (head) and `.2` (tail). The `mul` body uses `a.3` … `a.8` and the theorem hypothesis uses `v.1.3` … `v.1.8`. These do not typecheck.

**Fix candidates:**

- Use nested `.2.2.2…` projections (verbose but mechanically correct)
- Define a structure with named fields (e.g. `structure Octonion := (e0 e1 e2 e3 e4 e5 e6 e7 : F)`)
- Define `Imag8` as `Fin 8 → F` (function from finite index) and project via application
- Define explicit accessor lemmas `proj3 : Imag8 → F := fun a => a.2.2.1` … etc.

Soraya's lane to pick between these — depends on which form composes best with Cayley-Dickson doubling proofs.

### P0 — `sorry` in type position

**File:** lines 141 and 163

```lean
theorem reconstruction_property … : sorry := by sorry
theorem lemma1_toy : … sorry := by sorry
```

`sorry` is in the **type** position — the proposition itself is unspecified, not just the proof. The theorem doesn't have a meaningful statement until the type is filled in. Structural fix required: state the lemma in actual proposition form (an equation or a `∀` quantified equality) and leave only the proof as `sorry`.

### P1 — Not in `lean_lib`

**File:** `tools/lean4/lakefile.toml`

`lakefile.toml` declares `[[lean_lib]] name = "Lean4"`; `Lean4.lean` only `import Lean4.DbspChainRule`. `tools/lean4/ImaginaryStack/ToyModel.lean` is dead code under `lake build` — never compiled by CI's `type-check Lean DbspChainRule` job. To get the file actually exercised, either:

- Add a new entry `[[lean_lib]] name = "ImaginaryStack"` with root `ImaginaryStack`
- Add `import ImaginaryStack.ToyModel` to `Lean4.lean` to fold it into the existing lib
- Create a new CI job `type-check Lean ImaginaryStack`

Soraya's lane: which option fits the formal-verification routing convention?

## Goal

A Lean 4 toy model that:

1. Type-checks under `lake build` (CI exercises it)
2. States Lemma 1 with a real proposition (not `sorry` in type position)
3. Has projection ergonomics that compose with Cayley-Dickson doubling proofs
4. Documents the ℝ-vs-finite-field choice (the prose lemma-1 doc uses ℝ; the Lean file uses `ZMod 17` for enumerability — clarify which is canonical)

## Acceptance criteria

- [ ] `lake build` from `tools/lean4/` succeeds with no `unsolved goals` and no type errors in `ImaginaryStack/ToyModel.lean`
- [ ] All `sorry`s are in proof positions only (none in type positions)
- [ ] `Imag8` ergonomics chosen and documented (one of the four candidates above, or another)
- [ ] `tools/lean4/lakefile.toml` exercises `ImaginaryStack.ToyModel` (file is dead code → live code)
- [ ] `docs/research/2026-05-17-imaginary-stack-toy-model-lemma-1.md` updated to note the field choice (ℝ vs `ZMod 17`) and link Lemma 1's actual proposition statement

## Non-goals

- Completing the proof of Lemma 1 (sorry-in-proof position is acceptable)
- Adinkra layer (future row, B-0584 non-goals)
- ZMod 17 → general `ZMod n` parameterization (research-grade; pick one for now)

## Routing

Per [`.claude/skills/formal-verification-expert/SKILL.md`](../../../.claude/skills/formal-verification-expert/SKILL.md) (Soraya / `formal-verification-expert` agent) — picks the right tool for the property class. For this row:

- Tool: Lean 4 + Mathlib (already chosen by Riven's sketch)
- Property class: equational + finite-field linear algebra
- Soraya's expanded scope per [PR #4043](https://github.com/Lucent-Financial-Group/Zeta/pull/4043) (`memory/persona/soraya/NOTEBOOK.md` ratified expansion) lets her route to algebra-owner / q-sharp peers if Cayley-Dickson algebraic substrate is needed beyond Mathlib's coverage

## Composes with

- B-0584 (parent — Imaginary Stack Step-1 decomposition)
- B-0543 (grandparent — QG isomorphism proof path)
- PR #4059 (the shipping PR for the original Riven sketch + the 21+ review threads documenting these findings)
- PR #4040 (Riven's handoff conversation — merged 2026-05-17)
- PR #4043 (Soraya's expanded-scope invariants)
- [`docs/hygiene-history/ticks/2026/05/17/1218Z.md`](../../hygiene-history/ticks/2026/05/17/1218Z.md) (peer-Otto's triage shard — the substrate this row formalizes)

## Status

Open. Ready for Soraya (or proof-engineer agent acting in formal-verification-expert role) to pick up. The findings are verified; the fix space is enumerated; the routing is clean.

---

**Otto-CLI** — Split by truth.
