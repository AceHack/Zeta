# DBSP chain rule cross-check: counter-example reproduction and Prop 3.5 paper-reading verification

Scope: Independent cross-check of two findings preserved in
`tools/lean4/Lean4/DbspChainRule.lean` (header commentary,
lines 17-65 and 583-605) and in
`docs/research/chain-rule-proof-log.md` (round 35 entries,
lines 38-90, and the B2-resolution discussion at lines 113-115).
The two findings under cross-check are (1) an impulse counter-
example refuting an earlier "expanded bilinear" eight-term form
of the chain rule for composition, and (2) the claim that
"Proposition 3.5" of Budiu et al. (arXiv:2203.16684) carries an
unspoken time-invariance precondition that bundled `IsLinear`
(map_zero + map_add) cannot satisfy. Both findings were authored
during round 35 (2026-04-19 paper-drift audit) and have ridden
forward in the Lean file's prose since.

Attribution: Verification work by Otto (Claude Code, isolated
worktree session 2026-05-05). The findings being cross-checked
are factory substrate authored under the round-35 push by the
lean4-expert plus verification-drift-auditor pair; this file is
NOT a re-attribution of those findings, only a calibration check
against the upstream paper and a by-hand reproduction of the
counter-example.

Operational status: research-grade. Mirror, not beacon. This
file is a cross-check artifact, not project authority. The Lean
file is the authority for the proven results; this file
documents whether the prose claims about (a) the discarded
eight-term form and (b) the "Prop 3.5" attribution survive
independent verification against arXiv:2203.16684.

Non-fusion disclaimer: This document does not reconcile or
merge external authors' framings with Zeta's. It quotes the
Budiu et al. paper for a paper-reading verification step and
preserves the verbatim quotes; it does not edit, paraphrase,
or fuse those quotes into Zeta-internal vocabulary.

---

## 1. Counter-example verification

### 1.1 The shape of the discarded form

The Lean file's header commentary, lines 16-30, sketches the
"classical DBSP chain rule for bilinear operators":

```
D (f (x) g) s = D f (x) g . I . z^-1 + f (x) D g - D f . z^-1 (x) D g . z^-1
```

(ASCII transcription; the Lean source uses the (x), ., z^-1 glyphs.)
Specialised to a *composition* of operators over a single Z-set-
valued stream -- the form the round-35 commentary calls the
"expanded bilinear" eight-term shape -- the round-34-and-earlier
Lean text reduced this pointwise to:

```
D (f . g) s
  = D f (g (I (z^-1 s)))
  + f (g (I (z^-1 s)))
  + D g (I (z^-1 s))
  - f (g (I (z^-1 s)))
```

The promised algebraic cancellation: the second and fourth
summands `+f(g(I(z^-1 s))) - f(g(I(z^-1 s)))` cancel, leaving
`D f (g (I (z^-1 s))) + D g (I (z^-1 s))`, which on linear
operators further collapses to the classical
`D (f . g) = f . D g` form. The round-35 finding is that this
collapse is unsound at the impulse base case because the LHS
retains a present-tick contribution that the RHS shape (after
cancellation, before the linear-operator reduction) cannot
reproduce.

### 1.2 The counter-example as stated

Lean file line 57-60 and proof-log line 47-50:

> "Impulse counter-example: `f = g = id`, `s = delta_0`, `n = 0`
> gave LHS `= 1` and RHS `= 0` -- the putative cancellations
> never fire on the base case."

Working in `Stream Z` with G = Z, take:

- `f = g = id` (identity stream operator)
- `s = delta_0` where `delta_0 k = 1 if k == 0 else 0` (the Dirac-style
  impulse at tick 0, expressible as a Z-valued stream)
- `n = 0` (the base tick)

Operator definitions taken from the Lean file (Section 2,
lines 129-149, and the lifted differential at lines 168-170):

- `zInv s 0 = 0; zInv s (n+1) = s n`
- `I s n = sum_{i in range(n+1)} s i`
- `D s n = s n - zInv s n`
- `Dop f s n = f s n - f (zInv s) n` (pointwise lifted
  differential)

### 1.3 Computing the LHS

`Dop (f . g) s` evaluated at n=0 with f = g = id:

```
Dop (id . id) s n
  = (id . id) s n - (id . id) (zInv s) n
  = s n - zInv s n
```

At n=0:

- `s 0 = delta_0 0 = 1`
- `zInv s 0 = 0` (by `zInv_zero`)

LHS = 1 - 0 = **1**.

### 1.4 Computing the RHS

The RHS is the four-term post-bilinear-expansion shape:

```
RHS = D f (g (I (z^-1 s)))
    + f (g (I (z^-1 s)))
    + D g (I (z^-1 s))
    - f (g (I (z^-1 s)))
```

Note: in the Lean file's header prose, `D` applied to a stream
operator is the operator-valued lifted differential, the same
construction as `Dop`. With `f = id` we have `Dop id` acting on
a stream `sigma`:

```
(Dop id) sigma n = id sigma n - id (zInv sigma) n
                 = sigma n - zInv sigma n
                 = D sigma n
```

so `Dop id` agrees with the stream-level `D` on every input
stream. Both `Df` and `Dg` reduce to ordinary stream
differentiation under f = g = id.

Compute the inner stream `t := g (I (z^-1 s)) = I (z^-1 s)`:

- `(z^-1 s) 0 = 0`
- `(z^-1 s) 1 = s 0 = 1`
- `(z^-1 s) k = s (k-1) = 0` for k >= 2 (since s = delta_0)
- `I (z^-1 s) 0 = (z^-1 s) 0 = 0`. So `t 0 = 0`.

Now each summand at n = 0:

1. `(D f (g (I (z^-1 s)))) 0 = D(t) 0 = t 0 - zInv t 0
                              = 0 - 0 = 0`
2. `(f (g (I (z^-1 s)))) 0 = id(id(t)) 0 = t 0 = 0`
3. `(D g (I (z^-1 s))) 0 = D(t) 0 = 0` (same shape as term 1
   since g = id, so `g (I (z^-1 s)) = t`)
4. `(f (g (I (z^-1 s)))) 0 = 0`

RHS = 0 + 0 + 0 - 0 = **0**.

### 1.5 Confirmation

LHS - RHS = 1 - 0 = 1, NOT 0. The "expanded bilinear" form does
not equal `Dop (f . g) s` at the impulse base case for
`f = g = id`, even though it survives the algebraic cancellation
step (the second and fourth summands DO cancel -- both equal 0
here).

The mechanism the round-35 commentary names is correct: the
cancellation fires algebraically (both copies of the cancelled
term are 0 at n = 0), but neither cancelled-side reproduces the
LHS's `s 0 - zInv s 0 = 1 - 0 = 1` contribution. The form drops
the present-tick contribution because every surviving summand
sees the input shifted through `z^-1 s` first, which is zero at
tick 0 by the boundary condition `zInv_zero`. The LHS sees the
unshifted `s 0 = 1` via the outer composition.

Finding: **CONFIRMED**. The earlier "expanded bilinear" eight-
term form is unsound for composition at the impulse base case.
The replacement `Dop (f . g) s = f (Dop g s)` form (now in the
Lean file as `Dop_LTI_commute`) is the correct shape for linear
time-invariant composition; it reproduces the LHS = 1 directly:

```
f (Dop g s) 0 = id(Dop id s) 0 = (s 0 - zInv s 0) = 1 - 0 = 1.
```

Verified: LHS = RHS = 1 under the corrected form.

---

## 2. Prop 3.5 paper-reading verification

### 2.1 The claim under check

Lean file line 51 (under "Round-35 landmarks"):

> "B2 resolved from a conceptual wall into a contract field --
> `IsTimeInvariant` predicate, elevated to an axiom matching the
> DBSP paper's unspoken premise (Budiu et al. Prop. 3.5)."

Proof-log lines 113-115 (under "B2 -- the algebra-contract
wall"):

> "B2 is the statement that linear stream operators *commute
> with delay*. At the DBSP paper level this is smuggled in as a
> convention (Budiu et al. Proposition 3.5 uses it without
> naming it); in Lean it must be an explicit part of the
> contract."

The cross-check question: does Proposition 3.5 of arXiv:2203.16684
exist as referenced, and if so does it carry a time-invariance
precondition implicit in its prose?

### 2.2 Method

I read both the published VLDB 16(7):1601-1614 (2023) version
of the paper and the v1 arXiv preprint dated 2022-03-30 in
PDF form. The published version was retrieved via WebFetch from
`https://www.vldb.org/pvldb/vol16/p1601-budiu.pdf` and read with
the Read tool's PDF page extraction. The v1 arXiv preprint was
retrieved from `https://arxiv.org/pdf/2203.16684v1` and read the
same way. Section 3 ("Incremental view maintenance" in the
published version, "Incremental computation" in v1) was read in
full in both.

### 2.3 Verbatim quotes -- Section 3 propositions

(ASCII transcription of the paper LaTeX: `Delta` for the
incremental superscript, `.` for function composition, `(x)`
for tensor, `lambda alpha` for binders, `x` for the bilinear
operator symbol. The transcription preserves the paper's
exact word choice and equation structure; only the math
glyphs are romanised. Anyone wanting the rendered glyphs
can fetch the paper PDF at the URLs in section 5.)

From the v1 preprint (page 4), Section 3 contains, in order:

**Definition 3.1.** "Given a unary stream operator
`Q : S_A -> S_B` we define the **incremental version** of `Q`
as `Q^Delta := D . Q . I`."

**Proposition 3.2.** "(Properties of the incremental version):
For computations of appropriate types, the following hold:

- **inversion:** `Q -> Q^Delta` is bijective; its inverse is
  `Q -> I . Q . D`.
- **invariance:** `+^Delta = +, (z^-1)^Delta = z^-1, -^Delta = -, I^Delta = I,
  D^Delta = D`
- **push/pull:** `Q . I = I . Q^Delta; D . Q = Q^Delta . D`
- **chain:** `(Q1 . Q2)^Delta = Q1^Delta . Q2^Delta` (This generalizes to
  operators with multiple inputs.)
- **add:** `(Q1 + Q2)^Delta = Q1^Delta + Q2^Delta`
- **cycle:** `(lambdas.fix alpha.T(s, z^-1(alpha)))^Delta = lambdas.fix alpha.T^Delta(s,
  z^-1(alpha))`"

**Theorem 3.3 (Linear).** "For an LTI operator Q we have
`Q^Delta = Q`."

**Theorem 3.4 (Bilinear).** "For a bilinear time-invariant
operator `x` we have `(a x b)^Delta = a x b + z^-1(I(a)) x b +
a x z^-1(I(b))`."

Section 3 ends here. The next section is "4 Incremental View
Maintenance".

The published VLDB version (page 1604) is materially identical
on these statements: Definition 3.1, Proposition 3.2 (same six
clauses), Theorem 3.3, Theorem 3.4. The chain clause is one of
the bullets under Proposition 3.2, NOT a free-standing
proposition.

### 2.4 Finding

There is **no Proposition 3.5 in Section 3** of either the v1
arXiv preprint or the VLDB-published version of arXiv:2203.16684.
Section 3's proposition numbering goes:

- Definition 3.1
- Proposition 3.2
- Theorem 3.3
- Theorem 3.4

and then the section ends. No Proposition 3.5 exists.

Two adjacent paper objects could plausibly be what the round-35
prose meant to cite:

1. **Theorem 3.3** ("For an LTI operator Q we have `Q^Delta = Q`")
   does carry an LTI precondition explicitly, in the theorem
   statement itself. "LTI" in the paper's vocabulary
   (Definition 2.6 + Definition 2.12) means *linear* AND *time-
   invariant*, where time-invariance is `S(z^-1(s)) = z^-1(S(s))`
   per Definition 2.6 -- exactly the property the Lean file
   bundles into `IsTimeInvariant`. So Theorem 3.3's precondition
   is **explicit**, not implicit, contradicting the round-35
   prose's claim that the time-invariance premise is "smuggled
   in as a convention."

2. **Proposition 2.16** (page 3 in v1, page 1604 in VLDB) reads
   "Let S be a unary causal LTI operator. The operator
   `Q(s) = fix alpha.S(s + z^-1(alpha))` is well-defined and LTI."
   Time-invariance is again explicit, not implicit.

The round-35 prose's specific claim -- "Budiu et al. Prop. 3.5"
as the canonical citation for an *unspoken* time-invariance
premise -- is **not supported by either version of the paper**.
Both candidate paper objects (Theorem 3.3 and Proposition 2.16)
state their time-invariance precondition in the proposition's
body, not in surrounding prose convention.

### 2.5 What appears to have happened

The B2 resolution itself is correct: `IsLinear` (map_zero +
map_add) does NOT force commutation with `zInv`, and the
Lean-side fix of elevating `IsTimeInvariant` to a separate
predicate matches the paper's split of "linear" (Def 2.12) from
"time-invariant" (Def 2.6) and bundling them together as "LTI"
exactly when both are needed (Theorem 3.3, Theorem 3.4).

The misattribution is in the *citation*, not the resolution.
Two layers of confusion compose:

- The round-35 commentary cites "Prop 3.5" as if such a numbered
  paper object exists. It does not.
- Even if "Prop 3.5" were a typo for Theorem 3.3 (the most
  plausible candidate, since Theorem 3.3 IS the LTI-only
  theorem in section 3), the time-invariance premise is
  **explicit** in the theorem statement, not implicit. The
  round-35 framing of "unspoken premise" / "smuggled in as a
  convention" / "uses it without naming it" is incorrect
  regardless of which paper object the citation was meant to
  reference.

Finding: the citation **"Budiu et al. Prop. 3.5"** is a
**misattribution**. There is no Proposition 3.5 in section 3
of arXiv:2203.16684 (either v1 or the VLDB-published version).
The structural insight -- that `IsLinear` alone does not force
delay-commutation, so a separate `IsTimeInvariant` predicate
is required to close B2 -- remains correct and is supported by
the paper's own split of LTI into Linear (Def 2.12) and
Time-invariant (Def 2.6), where the paper *always* uses the
combined "LTI" qualifier (Theorem 3.3, Proposition 2.14, Lemma
2.10) precisely when both are needed.

---

## 3. Findings status

### Finding 1 -- Counter-example refuting the eight-term form

Status: **CONFIRMED**.

By-hand reproduction at f = g = id, s = delta_0, n = 0 yields
LHS = 1 and RHS = 0 for the four-term post-cancellation shape
that the Lean file's header lines 26-30 describes. The
round-35 statement-fix from the "expanded bilinear" form to
`Dop (f . g) s = f (Dop g s)` (now `Dop_LTI_commute`) is
justified by this counter-example.

The counter-example is reproducible: any reader can plug in
the impulse, compute through `zInv_zero`, `I s 0 = s 0`, and
the four pointwise terms; the arithmetic is short and
deterministic. Falsifiability: if a reader gets a different
result, the disagreement isolates to one of the operator
definitions (zInv, I, D, Dop) which are pinned in section 2 of
the Lean file.

### Finding 2 -- "Prop 3.5" carrying an implicit time-invariance precondition

Status: **PARTIAL**.

The structural insight (`IsLinear` is insufficient; a separate
`IsTimeInvariant` predicate is required) is **correct** and is
borne out by the paper's own LTI vocabulary. The supporting
**citation** ("Budiu et al. Prop. 3.5") is a **misattribution**
-- Proposition 3.5 does not exist in section 3 of the paper, and
the closest candidate (Theorem 3.3) carries time-invariance
**explicitly** in its statement, not implicitly. The round-35
prose framing of "unspoken premise" / "smuggled in as a
convention" overstates the gap between the paper and the Lean
formalisation: the paper says "LTI" out loud each time it
needs both linearity and time-invariance.

The Lean-side decision (split `IsLinear` from `IsTimeInvariant`,
combine them at the call site) remains correct and well-
motivated; it is *more careful* than the paper's casual "LTI"
shorthand requires, which is appropriate for a formalisation.
The misattribution affects only the prose justification, not
the proof state.

Falsifiability: any reader can fetch arXiv:2203.16684v1 or the
VLDB version, read section 3, and confirm the proposition
numbering. If a different version of the paper (perhaps a
companion technical report or a later journal version) exists
where Proposition 3.5 is a numbered paper object, that would
revise this finding to CONFIRMED. The companion technical
report cited in the v1 preprint as reference [7] (and in the
VLDB version as reference [12]) was not retrieved for this
cross-check; if it numbers a "Proposition 3.5" with the
relevant content, the misattribution downgrades to "the
citation needs the technical-report reference instead of the
arXiv-paper reference."

### A third finding surfaced during cross-check

The misattribution is **propagated to two more files** beyond
the Lean source: `docs/research/chain-rule-proof-log.md` lines
113-115 also cites "Prop 3.5" in the same wording, and the
verification-drift-audit-2026-04-19.md report (referenced from
the proof log) is the round-35 audit that introduced the
citation. A small follow-on cleanup pass should either
(a) replace "Prop 3.5" with Theorem 3.3 + a note that
time-invariance is in the statement, not the surrounding prose,
or (b) drop the paper-citation entirely and cite the paper's
LTI vocabulary as the structural backing for the predicate
split. Option (b) is more honest given that the paper does not
treat the implicit-vs-explicit gap the round-35 prose claims
exists.

---

## 4. Implications: writeup decision

The verification has three implications for what kind of
substrate this work belongs in.

**Counter-example (Finding 1)** is a solid result on its own --
a discarded-and-replaced statement with a reproducible base-
case witness. It belongs in the Lean file's header commentary
(where it currently lives, correctly cited and reproducible)
and in the proof log (where it currently lives). No external
publication is justified: the result is a Lean-side fix to a
candidate statement that was never submitted to the paper. It
is a story about **Zeta's own formalisation discipline**, not
about a defect in the published DBSP paper.

**Prop 3.5 misattribution (Finding 2)** is a different
character of finding -- it is a *pure citation error in Zeta's
internal substrate*, not a finding about the paper. The paper
is not wrong; the Lean prose's citation of the paper is wrong.
This belongs as a **factory-internal cleanup** (edit the Lean
file's header and the proof log to drop or correct the
citation) rather than as research-grade external-facing
substrate. No arXiv preprint, no GitHub issue against the
paper authors, no external writeup.

The right outcome is therefore:

- **Keep this verification file** (`docs/research/2026-05-05-...`)
  as the audit-trail mirror -- it documents what was checked,
  how, and what the result was. Future-Otto reading the Lean
  file's header sees the citation and can find this file via
  grep on "Prop 3.5".
- **No arXiv preprint, no GitHub issue against the paper
  authors.** The paper is correct; the misattribution is on
  Zeta's side.
- **Open a follow-on cleanup task** (the parallel 081KQTPYE0008QG0R0015SK08H row
  per task framing) to fix the Lean file's header lines 51 and
  the proof log's lines 113-115 to drop the "Prop. 3.5"
  citation in favor of either "Theorem 3.3 (the LTI-only
  theorem in section 3)" or simply the paper's LTI vocabulary.
- **Counter-example commentary stays as-is** in the Lean file --
  it is correct, reproducible, and load-bearing for explaining
  why the statement was changed.

This is **mirror-grade research, not beacon**. The file does
not claim authority; it preserves the cross-check work so the
discrepancy is visible to future readers and the cleanup task
has a substrate to point at.

---

## 5. References

- Lean source: `tools/lean4/Lean4/DbspChainRule.lean`
- Round-35 proof log: `docs/research/chain-rule-proof-log.md`
- Paper (VLDB 2023): Budiu, Chajed, McSherry, Ryzhyk, Tannen,
  *DBSP: Automatic Incremental View Maintenance for Rich Query
  Languages*. VLDB 16(7):1601-1614, 2023. DOI
  10.14778/3587116.3587137.
- Paper (arXiv preprint v1, 2022-03-30): Budiu, McSherry,
  Ryzhyk, Tannen, arXiv:2203.16684v1. (Note the v1 author list
  excludes Chajed; the VLDB version adds Chajed as an author
  and is materially identical on Section 3 propositions.)
- Verification methodology: read both PDF versions in full for
  Section 3, transcribed the proposition statements, compared
  to the Lean-file commentary's citation. By-hand counter-
  example computed using the operator definitions from the
  Lean file's Section 2 (lines 129-149, 168-170).
