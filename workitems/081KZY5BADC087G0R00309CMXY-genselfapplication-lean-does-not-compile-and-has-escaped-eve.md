---
id: 081KZY5BADC087G0R00309CMXY
type: bug
state: backlog
priority: P2
slug: genselfapplication-lean-does-not-compile-and-has-escaped-eve
title: "GenSelfApplication.lean does not compile and has escaped every check since 2026-06-21"
created: 2026-08-13T18:15:00.268Z
depends_on: []
composes_with: []
---

# GenSelfApplication.lean does not compile and has escaped every check since 2026-06-21

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZY5BADC087G0R00309CMXY-*.md` glob. -->

## Evidence

```
$ lake build Lean4.GenSelfApplication
error: Lean4/GenSelfApplication.lean:107:47: Unknown identifier `selfCode`
error: Lean exited with code 1
```

`selfCode` is bound existentially at `:99`
(`∃ selfCode : IrTerm, ∀ t, decode (eval selfCode (encode t)) = gen t`) and is then
referenced at `:107` as though it were a top-level definition:

```lean
theorem selfCode_gen_fixpoint : gen selfCode = selfCode := rfl
```

No `def selfCode : IrTerm` exists anywhere in the file.

## Why it was invisible

`src/Core.Lean4/Lean4.lean` is the root module `lake build` walks transitively.
`GenSelfApplication` was never imported there, so the default target never reached it.
This is the **same failure mode already recorded in `lakefile.toml`** for
`ImaginaryStack` — which, when finally wired in on 2026-08-10, turned out to hold a
hard compile error AND a `sorry` on a false theorem.

## The part that makes it a bug rather than an unfinished file

The file asserts its own verification in its footer:

```
-- SORRY-FREE. ... all closed.
-- Run: lake build Lean4.GenSelfApplication
-- Expected: NO warnings, NO errors = oracle passes.
```

It has never been run. A check that did not run must never look like a check that
passed; here the file says so about itself, in its own words, for ~2 months.

Entered via #8883 (2026-06-21, "chore: recover orphaned session artifacts + Rx
pipeline fixes") — a recovery commit, which is likely why it was never built.

## Fix shape

Supply the missing constructive `selfCode` term (or delete the two theorems that
depend on it and keep the vacuity result, which does build). Then add
`import Lean4.GenSelfApplication` to `src/Core.Lean4/Lean4.lean` so it can never
escape again. The exclusion is currently NAMED in that file rather than silent.

## Related

- PR #10353 wired `Lean4.MenoBraidedRMatrix` into the root module for exactly this
  reason and documented this exclusion beside it.
- `src/Core.Lean4/lakefile.toml` — the ImaginaryStack precedent, in-comment.
