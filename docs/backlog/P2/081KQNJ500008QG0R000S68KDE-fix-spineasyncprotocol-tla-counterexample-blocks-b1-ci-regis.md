---
id: 081KQNJ500008QG0R000S68KDE
priority: P2
status: open
title: Fix SpineAsyncProtocol.tla counterexample (blocks B1 → A CI registration; depth-9 trace dump on TLC run)
tier: formal-verification
effort: M
ask: Otto 2026-05-03 verify-then-claim sweep (#1397) — running TLC on the 4 deferred B1 specs from the math-proofs honest assessment (#1383) found SpineAsyncProtocol produces a TTrace dump at depth 9, indicating counterexample / invariant violation. The "deliberately skipped pending re-verification" framing in `docs/research/proof-tool-coverage.md` §2 was correct; this row tracks the actual fix.
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [docs/research/2026-05-03-math-proofs-honest-assessment.md, docs/research/proof-tool-coverage.md, 081KQNJ500008QG0R0001QHA1J, 081KQNJ500008QG0R003DMVGZB]
tags: [tla-plus, formal-verification, spine-async, counterexample, b1, math-proofs-assessment, verify-then-claim]
type: friction-reducer
---

# Fix SpineAsyncProtocol.tla counterexample

## Symptom

Running `java -cp tools/tla/tla2tools.jar tlc2.TLC -workers 4 -config tools/tla/specs/SpineAsyncProtocol.cfg tools/tla/specs/SpineAsyncProtocol.tla` produces a TTrace dump:

```
Trace exploration spec path: tools/tla/specs/SpineAsyncProtocol_TTrace_<ts>.tla
The depth of the complete state graph search is 9.
Finished in 00s
```

TLC dumps a trace file when it finds an invariant violation or a `run` that can't be satisfied. The depth-9 termination + 0-second run suggests TLC found a violation immediately (rather than exhausting state space).

## Investigation needed

1. Read the TTrace file to identify which invariant fails
2. Determine whether the invariant or the spec needs the fix:
   - If the spec models the protocol incorrectly, fix the spec
   - If the invariant is over-strong (asks for a property the protocol doesn't actually guarantee), weaken the invariant
3. Verify the fix locally — re-run TLC; expect clean "No error has been found"
4. Add `[<Fact>] TLC validates SpineAsyncProtocol` to `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs`
5. Add registry row to `docs/research/verification-registry.md`

## Why P2

Pre-existing failure surfaced by verify-then-claim sweep, not a new regression. Blocks B1 → A in the assessment matrix but doesn't block any current functionality (the SpineAsync runtime works in practice; this is a formal-verification gap).

## Composes with

- 081KQNJ500008QG0R0001QHA1J (CircuitRegistration config bug — sibling B1 issue)
- 081KQNJ500008QG0R003DMVGZB (SpineMergeInvariants counterexample — sibling B1 issue)
- The closure of B1 → A in the math-proofs honest assessment requires all 3 sibling fixes to land
