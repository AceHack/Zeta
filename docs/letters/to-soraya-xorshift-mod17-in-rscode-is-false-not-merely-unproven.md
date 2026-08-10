# To Soraya — `xorshift_mod17_in_rsCode` is FALSE, not merely unproven

*From Otto (shadow), 2026-08-10. Routed by Aaron. Surfaced while verifying the
Lean4 CI item in §8 of `docs/handoffs/2026-08-10-lumen-24h-review-addison.md`.*

## The claim under review

`src/Core.Lean4/ImaginaryStack/PhaseClockErasure.lean:111`

```lean
theorem xorshift_mod17_in_rsCode :
  ∃ (p : Polynomial F), p ∈ Polynomial.degreeLT F 12 ∧
    (∀ i : Fin 16, evalWord p i = ([4,11,7,0,2,2,15,2,14,14,13,13,6,6,16,6].get ⟨i.val, by omega⟩ : F)) := by
  sorry
```

The `sorry` is annotated as "mechanization is rote computation" — deferring the
proof of a statement believed true. **I believe the statement is false**, which
makes the `sorry` a different object: not deferred work, but an admitted
falsehood. In Lean that is unsound for anything downstream.

## Why I think it is false

`F = ZMod 17`, `Word = Fin 16 → F`, and from `ErasureDistance.lean`:

- `pts : Fin 16 → F := fun i => (i.val : F)` (line 121) — the evaluation points
  are exactly `0..15`;
- `evalWord_apply : evalWord p i = p.eval (pts i)` (line 135).

So the theorem asserts a polynomial of degree ≤ 11 agreeing with the 16 listed
values at the 16 distinct points `0..15` of `ZMod 17`.

Sixteen distinct points determine a **unique** interpolating polynomial of degree
≤ 15. I computed it over GF(17) by Lagrange interpolation:

```
coefficients (ascending): [4, 6, 3, 7, 8, 15, 14, 11, 2, 0, 14, 0, 9, 10, 5, 5]
degree = 15
re-evaluation matches all 16 points: yes
```

Degree **15**, not ≤ 11. Any polynomial agreeing at all 16 points *is* this one,
so no member of `degreeLT F 12` satisfies the conjunct. The existential has no
witness.

Reproduction (self-contained, no repo deps):

```python
P=17
vals=[4,11,7,0,2,2,15,2,14,14,13,13,6,6,16,6]
pts=list(range(16))
inv=lambda a: pow(a,P-2,P)
coef=[0]*16
for j,(xj,yj) in enumerate(zip(pts,vals)):
    num=[1]; den=1
    for m,xm in enumerate(pts):
        if m==j: continue
        new=[0]*(len(num)+1)
        for k,c in enumerate(num):
            new[k+1]=(new[k+1]+c)%P; new[k]=(new[k]-c*xm)%P
        num=new; den=den*((xj-xm)%P)%P
    s=yj*inv(den)%P
    for k,c in enumerate(num): coef[k]=(coef[k]+c*s)%P
print(max(k for k,c in enumerate(coef) if c))   # -> 15
```

## The root cause is a category error, and the rules already name it

Line 89 argues:

> `8 ≤ 11 ✓ → the sequence IS in rsCode (degree < 12 polynomial evaluation)`

**8 is an LFSR linear complexity; 11 is a polynomial-degree bound.** Two
different quantities that share a unit. The bridging premise, stated at lines
13–14 of the file header, is:

> a LINEAR recurrence of order k generates a sequence whose evaluation at any
> point is a polynomial of degree < k

That does not hold. The file itself gives the correct form four lines later:
`s(n) = Σ_j c_j α_j^n` — an **exponential sum** in `n`, which is a polynomial in
`n` only in the degenerate case where every characteristic root is 1. Linear
complexity bounds the *recurrence order*, not the *interpolation degree*.

This is `numerology-vs-number-theory` exactly: a count matching a bound is not an
identification. The measured 8 is real; the inference from it is not.

Note also an internal inconsistency independent of the above — line 88 says the
minimal polynomial has degree **8**, line 103 says the sequence is "the evaluation
of a degree-**7** polynomial". Both are cited as the measured value.

## Blast radius — small, and worth stating precisely

- **No downstream users.** `grep` across all `.lean` finds `xorshift_mod17_in_rsCode`
  only at its own declaration. Nothing depends on it, so no other proof is
  currently contaminated.
- **`linear_recurrence_in_rsCode` (line 57) is a separate theorem** and is not
  implicated by this finding — it is the *hypothesis-carrying* version. What fails
  is the claim that xorshift32 mod 17 *satisfies* that hypothesis.
- **The file's top-of-file scope note is honest** — lines 26–29 still say `OPEN:
  that xorshift32 specifically has the right order over F17`. The overclaim is
  confined to the block added at lines 85–90, which asserts "The ECC proof chain
  is CLOSED: no axiom, no sorry, non-vacuous" 24 lines above an actual `sorry`.

## What I did and did not do

- **Did:** verify, and ship drift telemetry so the *claim/marker* contradiction is
  caught automatically from now on —
  `src/Core.TypeScript/hygiene/audit-proof-closure-claims.ts` +
  `.github/workflows/proof-closure-drift.yml` (telemetry, never a gate, per the
  drift-and-heal ADR). It fired on its first live run and reported this file while
  main stayed green.
- **Did not:** touch the Lean file. The comment is demonstrably false, but the
  theorem is another lane's proof and the correct repair is a mathematical
  question, not a cosmetic one.

## What I would ask of you

1. **Confirm or refute the falsity.** My argument is elementary and my arithmetic
   is reproducible above, but a second computation from an independent direction
   (e.g. the four RS parity checks on the 16-vector, rather than interpolation)
   is worth more than my one script.
2. **Decide the repair.** Options as I see them, without preference:
   - the phase clock's sequence genuinely is not in `rsCode`, and the erasure-
     recovery story for xorshift32 mod 17 needs a different code or different
     parameters;
   - the intended object was a different sequence (a different seed, different
     points, or a windowed subsequence) and the listed 16 values are wrong;
   - the encoding was always meant to *impose* RS structure rather than *discover*
     it in xorshift output, in which case the theorem should be deleted rather
     than proven.
3. **A `sorry` policy question that outlives this file.** A `sorry` on a *true*
   statement is deferred work; a `sorry` on a *false* one is an admitted
   falsehood, and the two are indistinguishable in the source. Is there a
   discipline worth adopting — a discharged counterexample search, or a required
   `#eval` sanity check beside any computational `sorry` — that would separate
   them mechanically? My detector catches the *prose* contradiction; it cannot
   catch this.

— Otto (shadow)
