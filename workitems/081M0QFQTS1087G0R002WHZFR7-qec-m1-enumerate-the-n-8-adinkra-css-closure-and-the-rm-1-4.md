---
id: 081M0QFQTS1087G0R002WHZFR7
type: task
state: in-progress
priority: P2
slug: qec-m1-enumerate-the-n-8-adinkra-css-closure-and-the-rm-1-4
title: "QEC M1: enumerate the N=8 adinkra CSS closure and the RM(1,4) reopening at N=16, four-oracle"
created: 2026-08-23T14:17:36.801Z
depends_on: []
composes_with: []
---

# QEC M1: enumerate the N=8 adinkra CSS closure and the RM(1,4) reopening at N=16, four-oracle

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QFQTS1087G0R002WHZFR7-*.md` glob. -->

**Routing:** direct enumeration in the four oracles. NOT Lean, NOT Z3, NOT TLA+ — see
`docs/research/2026-08-23-qec-stack-routing-the-adinkra-bridge-closes-at-n8-and-reopens-at-n16-soraya.md` §5.

## What lands

1. RM(1,4) and RM(2,4) constructed from the monomial basis over F_2^4 (16 points), in each
   language oracle. RM(1,4): dim 5, weights {0,8,16}.
2. Checks, exhaustive over 2^11 = 2048 codewords: RM(1,4) doubly-even; self-orthogonal;
   RM(1,4)^perp == RM(2,4) as a SET (not merely same-dimension); RM(1,4) subset RM(2,4).
3. `k_q = 2*dim(C1) - n = 6`; `d = min weight in RM(2,4) \\ RM(1,4) = 4`. So [[16,6,4]].
4. **The N=8 closure, landed as a test** — enumerate every doubly-even self-orthogonal
   binary code of length 8 and pin the best achievable distance at each dimension:
   **dim 0 (uncoded, the full 8-cube) -> [[8,8,1]]**, dim 1 -> [[8,6,2]], dim 2 -> [[8,4,2]],
   dim 3 -> [[8,2,2]], dim 4 (self-dual) -> [[8,0,4]]. The dim-0 row is REQUIRED, not optional:
   it is the non-coded adinkra family, and omitting it as degenerate is what invited the
   scope question answered in section 3a of the research doc.
   This is the load-bearing NEGATIVE: no N=8 adinkra CSS code both encodes a qubit and
   corrects an error. Landing it as a test is what makes the "don't build it" verdict
   metered rather than an opinion. **State the domain in the test name**: this is closed over
   CSS(C^perp, C^perp) for C doubly-even self-orthogonal -- the adinkra category -- NOT over all
   8-qubit stabiliser codes. [[8,3,3]] (CRSS 1997) beats every row but does not split into X and
   Z parts, so it comes from no binary code and is not an adinkra object.
5. Golden vectors **hex-in-JSON** per `.claude/rules/no-binary-in-proof-lineage.md`.

## Falsifier

The dim-4 row must come back k_q = 0. If a self-dual code ever reports k_q > 0 the
enumeration is broken, since `k_q = 2*dim(C) - n` and self-duality forces dim = n/2.

## Not in scope

The quantum layer (M2/M3), and any N=8 or Steane [[7,1,3]] stack as a destination.

Compute cost: milliseconds. If only one QEC milestone ever ships, ship this one.

## Progress 2026-08-24 (Lumen) — items 1-5 landed; the oracle count is SHORT of four

Landed: `src/Core/CssCode.fs` (RM from the monomial definition, CSS parameters, the length-8
closure, puncture, reduced-echelon bases, syndromes, hex+SHA-256), `tests/Tests.FSharp/CssCode.Tests.fs`
(25 exhaustive tests), `src/Core.QSharp.ReferenceOracle/css-stabilizer-treaty.json` (hex-in-JSON),
`CssStabilizerCodes.qs`, and `css-stabilizer.test.ts` (an independent TypeScript re-derivation).

**The falsifier named above is discharged:** the dim-4 self-dual row comes back `k_q = 0`, and the
test asserts it for *every* self-dual doubly-even code of length 8, not only ours.

**Still open, and the reason this row is `in-progress` rather than closed:** the title says
**four-oracle** and what exists is **two independent implementations (F#, TypeScript) plus one
declaration cross-checked as text (Q#)**. Rust and Go are unwritten. The Q# surface is the weakest of
the three because QDK is an opt-in install, so the `.qs` is checked by parsing its declared stabiliser
rows and comparing them rather than by executing the circuit — which is genuinely a check (it caught a
wrong Steane row on the first draft) and is genuinely not an execution.

Detail, including the 14-mutation report and its three named equivalent mutants:
`docs/research/2026-08-23-qec-stack-routing-*-soraya.md` §11.
