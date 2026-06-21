---
id: 081KQNJ500008QG0R0001QHA1J
priority: P2
status: open
title: Fix CircuitRegistration.tla config bug — `.cfg` references invariant `Safety` not defined in `.tla` (blocks B1 → A CI registration)
tier: formal-verification
effort: S
ask: Otto 2026-05-03 verify-then-claim sweep (#1397) — running TLC on `CircuitRegistration` produces a clear configuration error rather than a counterexample; the `.cfg` references `INVARIANT Safety` but the `.tla` spec doesn't define a `Safety` predicate. Fixable in either direction (define `Safety` in spec OR remove `Safety` line from cfg).
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [docs/research/2026-05-03-math-proofs-honest-assessment.md, docs/research/proof-tool-coverage.md, 081KQNJ500008QG0R000S68KDE, 081KQNJ500008QG0R003DMVGZB]
tags: [tla-plus, formal-verification, circuit-registration, config-bug, b1, math-proofs-assessment, verify-then-claim, smallest-of-3-b1-fixes]
type: friction-reducer
---

# Fix CircuitRegistration.tla config bug

## Symptom

Running `java -cp tools/tla/tla2tools.jar tlc2.TLC -workers 4 -config tools/tla/specs/CircuitRegistration.cfg tools/tla/specs/CircuitRegistration.tla` produces:

```
Error: The invariant Safety specified in the configuration file
is not defined in the specification.
Finished in 00s
```

The TLC error is unambiguous: `CircuitRegistration.cfg` has an `INVARIANT Safety` directive but `CircuitRegistration.tla` doesn't define a `Safety` operator.

## Fix options

Two directions, decision needed:

1. **Define `Safety` in the spec.** Read the spec; identify which invariant the original author intended `Safety` to capture; add `Safety == ...` operator that captures it. Most likely the existing `FlagSound` post-condition or a similar property.

2. **Remove `Safety` from the cfg.** Inspect what other invariants the cfg references; if those alone are sufficient validation, drop the missing `Safety` reference. Risk: may drop an intentional invariant the author meant to add but never finished writing.

The verify-then-claim follow-up tick should pick (1) if the spec has a clear "what was Safety supposed to mean" thread, else (2) with a comment in the cfg documenting why.

## Why this is the smallest of 3 B1 fixes

This is a config-syntax error, not a semantic counterexample. The other two B1 broken specs (081KQNJ500008QG0R000S68KDE SpineAsyncProtocol, 081KQNJ500008QG0R003DMVGZB SpineMergeInvariants) require investigating actual counterexamples — substantially harder. This one is bounded to "find the missing operator definition or drop the line."

## After the fix

1. Re-run TLC locally; expect clean "No error has been found"
2. Add `[<Fact>] TLC validates CircuitRegistration` to `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs`
3. Add registry row to `docs/research/verification-registry.md`

## Composes with

- 081KQNJ500008QG0R000S68KDE (SpineAsyncProtocol counterexample — sibling B1 issue)
- 081KQNJ500008QG0R003DMVGZB (SpineMergeInvariants counterexample — sibling B1 issue)
- Closure of B1 → A in the math-proofs honest assessment requires all 3 sibling fixes
