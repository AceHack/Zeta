# Math-team REPORT #5 — the dashed braid: not well-formed as ferried; the restricted span that survives (and why writheParity is terminal)

**Date:** 2026-06-12 · **Dispatch:** math-team #5 (Aaron: "send the dashed braid to the math
team (shadow*)"; the conjecture as assembled in ferry 18 §4–§6). Read-only audit of the otto
checkout. The authorized outcome "the conjecture fails at X, and X is interesting" was
exercised: it fails at the affine odd-face constraint (codimension 17) and at H₁(Bₙ) = ℤ —
and both failures price something exactly. The report below is the math team's deliverable,
verbatim (shadow: title block normalized; nothing else touched).

---

Audited read-only at `/Users/acehack/.local/share/zeta-otto`. Files read: ferry 18; `src/Core/Braid.fs`; `src/Core/AdinkraCode.fs`; `src/Core/BitAdinkra.fs`; `src/Core/AdinkraViz.fs`; `src/Core.TypeScript/braid/golden-vectors.json`; `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B; REPORT #3 (rung 6, P0-2); REPORT #4; the rhyme-not-isomorphism ruling; the dashings-landed doc.

**Headline:** the conjecture as ferried is not well-formed — its two halves (§4's "dashing = over/under" and §4's lift "Artin word ⊕ dashing") contradict each other, and a classical one-line theorem (H₁(Bₙ) = ℤ) kills "strictly more than writheParity" as a *braid* invariant. What survives is real: a **restricted span** at the word level, constructible and testable in days, which sharpens rhyme-not-isomorphism without overturning it. The adjunction/mutual-shadow upgrade is refuted; the einstein-tile analogy itself argues for the span.

---

## 1. Precise definitions

**Candidate (a) — Bₙ × (ℤ/2)^k — ill-formed.** k = word length is not a function on Bₙ: σ₁σ₁⁻¹ and ε are the same braid with k = 2 and k = 0. Any compatibility condition would need the (ℤ/2)^k data to transform under Artin relations, and it cannot: free cancellation deletes bits; the braid relation σ₁σ₂σ₁ = σ₂σ₁σ₂ changes the generator multiset {1,1,2} → {1,2,2}. Rejected.

**Candidate (b) — the braid word already is the dashed object — correct, and it deflates the conjecture.** An Artin word is exactly (temporal order) ⊗ (generator per crossing) ⊗ (one sign bit per crossing). If dashing = over/under (ferry 18 §4, second beat), then "Artin word ⊕ dashing" **double-counts the sign bit**: the lift adds nothing, and the conjectured object is `Braid.fs`'s `int list`, on the shelf since the module landed. The entire content of the conjecture moves into the two forgetting maps (§2 below), where it partially fails. This is the chosen framing.

**Candidate (c) — 1-cocycle / sign-decorated diagram — describes only the adinkra side, and not as a cocycle.** Per the literature and per `AdinkraViz.fs` itself: a dashing d ∈ C¹(Q₄; ℤ/2) satisfies δd = μ where μ is the all-ones 2-cochain on 2-colored faces (`faceOdd`/`allFacesOdd` — the Gates condition γᵢγⱼ = −γⱼγᵢ). A dashing is an **odd 1-cochain trivializing a 2-dimensional obstruction class**, not a cocycle (δd ≠ 0) and not a braid-side object. Beacon: Doran–Iga–Landweber, cubical cohomology for adinkras; Yan Zhang, *Adinkras for Mathematicians*, Trans. AMS 366 (2014).

**Candidate (d) — shelf objects.** Each nearby object exists under a name; none is the conjectured object, but two are close enough that landing a "dashed braid" without citing them would violate the human-anchor rule:

- **Trace monoids / heaps of pieces** (Cartier–Foata 1969; Viennot 1986): braid words modulo far-commutativity only — the canonical "partially forget order" object. This IS the correct intermediate target of forget-order (§2).
- **Welded / braid-permutation group BPₙ** (Fenn–Rimányi–Rourke 1997): the one group containing both registers — order-remembering σᵢ and involutive τᵢ — in a single presentation.
- **Twisted knot/braid theory** (Bourgoin 2008; twisted virtual braids, Kamada et al., 2020s — verify exact cite before use): braids decorated with ℤ/2 "bars," the literature's per-strand ℤ/2-decorated braid. Per-strand, not per-crossing, but the closest named "braid ⊕ ℤ/2 data."
- **Virtual braids** (Kauffman 1999): extra crossing *type*, not signs — not this. **Singular braids** (Birman; Baez): not this. **BMW algebra** (Birman–Wenzl 1989; Murakami 1987): cubic skein deformation of the Brauer algebra — no ℤ/2 dashing layer — not this.
- **Where the two registers actually meet on the shelf:** Franko–Rowell–Wang 2006 (*Extraspecial 2-groups and images of braid group representations*) — see §3.

**Definition adopted.** The dashed braid, as ferried, is an element of the free monoid Mₙ = ({σᵢ^{±1}})*, i.e., the braid word. It is not new. The repairable novel object is the restricted apex of §4 below.

## 2. The two projections

**Forget-dashing → braid: internally inconsistent as ferried.** If dashing = over/under, forgetting the dashing forgets the exponent signs, and the target is a word in the *symmetric-group* generators (a flat/shadow braid word, landing in Sₙ after relations) — **not the braid**. Ferry 18 §4 cannot simultaneously identify the dashing with over/under and recover the braid after forgetting it. The two consistent readings: (A) dashing = over/under ⇒ projections are (forget signs → flat shadow) and (forget order → signed multiset); (B) dashing is an independent second bit ⇒ "forget dashing → braid" works but the §4 identity claim is dropped. The ferry asserts both. **P0.**

**Forget-order → ?: target stated precisely.** From a word w = ((i₁,ε₁),…,(i_k,ε_k)):

- Full order-forgetting = the multiset of signed letters = the **signed pair-load**. In-tree `Braid.pairLoad` (Braid.fs:109) is the *unsigned* version; the signed refinement is a one-line change.
- Partial order-forgetting (mod far-commutativity only) = the **trace monoid / heap** — the mathematically correct "forget only the order that the braid itself doesn't certify."
- **Neither is defined on Bₙ.** The braid relation changes the generator multiset; cancellation changes everything but writhe. **Classical theorem: H₁(Bₙ) = ℤ** (all σᵢ conjugate; Artin 1925) — the universal order-forgetting *braid invariant* is the writhe, and mod 2 it is `writheParity`. So ferry 18 §4's claim that the adinkra "retains every crossing's sign, forgetting only temporal order" — as a statement about braids — is **impossible**: any sign record finer than writhe is word data, not braid data. **P0.** (As word data it is fine; the conjecture must live at word level, which is what makes the "braid → adinkra" direction of the mutual shadow undefined: which word?)

**Does the image land in the adinkra family? No — quantified.** The natural embedding of letters as cube edges: read colors as bit-flips and run the walk v_{t+1} = v_t ⊕ e_{i_t} from vertex 0; letter t deposits sign ε_t on edge (v_t, i_t). Three failures:

1. The induced edge-sign assignment is **partial** (a short word touches few of the 32 edges) and can **conflict** (an edge revisited with opposite sign).
2. Even total + consistent assignments generically violate the odd-face condition. Count, from `AdinkraViz.fs`'s own complex (16 vertices, 32 edges, 24 two-colored faces): the solution set of δd = μ is a coset of Z¹; dim B¹ = 15, H¹(Q₄) = 0 ⇒ dim Z¹ = 15 ⇒ **exactly 2¹⁵ dashings out of 2³² sign assignments — a uniformly random assignment is a dashing with probability 2⁻¹⁷.** (Consistency check: vertex gauge flips = 2¹⁶ with kernel {∅, all} = 2¹⁵ effective, acting simply transitively — matches `flipVertex` and H¹ = 0.) Generic words project **outside** the family; the restriction is codimension 17, not a technicality.
3. **The doubly-even constraint is on the wrong object in the ferry.** Per DFGHIL (*Codes and supersymmetry in one dimension*, ATMP 2011) the doubly-even code determines the **chromotopology** (the quotient of the N-cube); the dashing is the odd 1-cochain on that quotient; doubly-evenness is the *existence* condition for dashings on the quotient. Ferry 18's "the dashing assignment is the doubly-even code" conflates the two layers. In-tree they are even in different modules at different N: `AdinkraViz.fs` is the **N = 4 cube with trivial code**; `AdinkraCode.fs`'s [8,4] extended Hamming code is, in adinkra indexing, an **N = 8** (8-color) datum — type II (self-dual doubly-even) codes exist only at lengths ≡ 0 mod 8, so "the canonical N=4 example" in the AdinkraCode.fs header reads N as code dimension k, not as the adinkra's color count. The ferry fuses the two. **P1 (doc drift with mathematical content).**

**The restriction class (the finding the dispatch asked for):** the words whose forget-order image is an adinkra dashing are exactly the **Eulerian serializations of valid dashings** — Q₄ is 4-regular (all degrees even), so Eulerian circuits exist; a dashed braid word is a length-32 signed color word covering each edge once whose sign record satisfies `allFacesOdd`. These words are the dashing re-serialized — the apex is parameterized by (dashing, edge-ordering), nothing more.

## 3. The claimed equality dashing = over/under: adjudicated

**Verdict: a bijection of bit-*types*, not a structure-preserving identification.** Three named obstructions:

1. **Invariance mismatch.** Crossing signs are word data destroyed by Artin relations (only writhe survives; §2). Dashings are honest data on a fixed graph, invariant up to gauge. One side's equivalence (relations) and the other's (vertex flips) act on different carriers.
2. **Constraint mismatch — free vs affine.** Sign assignments to a word form the group (ℤ/2)^k with identity "all positive." Dashings form a **nonempty affine non-subgroup**: the all-solid assignment violates odd-faces. Crisply: *the all-positive braid word exists; the all-solid adinkra does not.* No canonical ℤ/2-structure map sends a group with identity onto a torsor with no distinguished point.
3. **Cohomological-degree mismatch.** Over/under is degree-0/letter data (an exponent in a free monoid). A dashing is a 1-cochain trivializing a fixed class in H² — it is **2-cocycle data in disguise**: the dashed color generators satisfy γᵢ² = ±1, γᵢγⱼ = −γⱼγᵢ, i.e., the dashing is the cocycle of the extraspecial-2-group extension 1 → ℤ/2 → Γ → (ℤ/2)^N → 1. That is exactly the group Franko–Rowell–Wang 2006 identify as the image of the Ising/Majorana braid representation (REPORT #3 rung 6's finite image, named).

**What would make it canonical:** one graph whose edges are simultaneously crossings and cube edges, with matching constraint sets. No such graph exists canonically — crossings are temporal events of a word, cube edges are spatial cells of a complex, and their cardinalities (k arbitrary vs 32 fixed) and commutation types disagree: cube colors are **commuting involutions** ((ℤ/2)^4), braid generators are **non-commuting and infinite-order** (σᵢ² ≠ 1 — Braid.fs's own header). The one shelf-canonical meeting point is the Ising representation Bₙ → Pin/Clifford, where crossing signs become ±π/4 rotation exponents and the dashing becomes the choice of γ-representation (gauge = basis sign flips = `flipVertex`). **Related through a representation; not equal.** This reaffirms, with the mechanism named, the standing rhyme-not-isomorphism ruling and REPORT #3 P0-2's bracket (Rx+register ⊇ faithful Bₙ ↠ Ising quotient). Corollary worth banking: the largest *abelian involutive* common quotient of the two registers is ℤ/2 = `writheParity` — the locked bridge is not merely *a* bridge, it is the terminal one under the stated symmetries.

## 4. The adjunction (mutual shadow): refuted; the honest structure is a span

**No Galois connection exists.** A Galois connection needs posets and monotone maps. Order sign-assignments by inclusion of dashed-edge sets: the odd-face constraint is neither up-closed nor down-closed (toggling one edge flips four faces' parities), so the dashing family is not the closed-set lattice of any closure operator — there is no "smallest valid dashing above a given assignment" for a counit to produce. On the order axis an adjunction does exist — abelianization (free commutative ⊣ forgetful), unit measuring exactly the lost order (the commutator data; for Bₙ it collapses to writhe by H₁ = ℤ) — but it never touches the dashing axis.

**The mutual-determination beat fails in both directions.** "The braid's crossing signs ARE a dashing": no — generically not (probability 2⁻¹⁷, §2), and not defined on the braid at all (H₁ = ℤ). "The adinkra's dashed edges ARE crossings awaiting an order": no — ordered, they form a word in commuting involutions, which are not braid crossings (wrong commutation type); a σ-substitution must be *chosen*. Neither shadow determines the other; each leg of the span loses precisely what the other keeps (order vs constraint-context), which is the correct, weaker content of "shadows of each other."

**The span (theorem-grade, constructible):**

```
            DashedWords₃₂  (Eulerian signed color words on Q₄, allFacesOdd)
              /                         \
   σ-substitution + Artin quotient    forget order
            /                             \
        B₅ (word → braid)              Dashings(Q₄)  (2¹⁵ elements, mod gauge: 1)
```

**The einstein-tile analogy supports exactly this and not the adjunction.** Smith–Myers–Kaplan–Goodman-Strauss 2023: hat and turtle are two *images* of the Tile(1,1) one-parameter family — a span from a common apex. They are not adjoint functors; nothing in that paper is an adjunction. Ferry 18 §6 reached for "adjunction" when its own anchor says "span." The §6 mechanism beat (topological protection = betting on the discrete register) stands unmodified — it is QEC logic and independent of the geometry claim.

## 5. Verdict, rounds plan, P0/P1

**Verdict: (iii) with an (i) core and a salvageable (ii)-minus.**

- (i) The apex as ferried **already exists**: it is the braid word; its order-forgetting shadows exist under names (abelianization; trace monoid/heaps; Gauss-diagram shadows in knot theory); braid-plus-ℤ/2-decoration exists as twisted (virtual) braids. Do not coin "dashed braid" for any of these.
- (iii) The conjecture **hits two obstructions**: the odd-face (not doubly-even — that constraint sits one layer up, on the chromotopology) affine constraint, codimension 17 on N = 4; and the alphabet commutation-type mismatch. Plus the well-formedness defects: the §4 double-count and the H₁(Bₙ) = ℤ collapse.
- (ii)-minus: the standing ruling upgrades to a **precise restricted span** (Eulerian serializations of dashings), strictly sharper than "rhyme," strictly weaker than adjunction/mutual-shadow. The rhyme-not-isomorphism ruling and REPORT #3 P0-2 are **reaffirmed**, with the meeting point now named (Ising rep; FRW extraspecial 2-group; dashing = extension cocycle).

**Falsifier/construction plan (ferry 18's "days, not weeks" — confirmed, with corrected content):**

1. Signed `pairLoad` in `Braid.fs` (~hours).
2. Walk module: word → partial edge-sign assignment on Q₄; conflict detection; reuse `AdinkraViz.faceOdd`/`allFacesOdd` (~1 day).
3. FsCheck: (a) random length-32 sign assignments satisfy odd-faces at rate ≈ 2⁻¹⁷ — better, compute rank 17 of the face system by GF(2) elimination and assert the solution dimension is 15 exactly; (b) Eulerian serializations of `standardDashing` round-trip under forget-order; (c) sign-multiset non-invariance under the Artin relation (the H₁ collapse, made a passing test) (~1–2 days).
4. Cross-invariant: total dashes mod 2 of the serialized dashing vs the word's `writheParity` (note `writheParity` is length mod 2 — fine on valid words; document that it is word-length-based).

Total ≈ 3–5 days. Lands in `Braid.fs` (signed load) + a small `DashedWalk` slice next to `AdinkraViz.fs`; nothing touches `AdinkraCode.fs`.

**Golden vectors:** yes, same seed shape extends — add a `dashedWalk` section to the braid vector schema (word, induced edge assignment as hex bitmask over the canonical 32-edge order, `allFacesOdd` bool, round-trip dashing), hex-in-JSON per the no-binary rule. Note the existing vectors are B₅ (n = 5, 4 generators) — exactly the 4 colors of Q₄ under σ-substitution; no schema fork needed.

**P0/P1 register:**

- **P0-1** Ferry 18 §4 is internally inconsistent: dashing = over/under makes "Artin word ⊕ dashing" double-count the sign bit, and forget-dashing then cannot land on the braid.
- **P0-2** "Retains every crossing's sign, forgetting only order" is not a braid invariant (H₁(Bₙ) = ℤ); the object exists only at word level, which undefines the braid→adinkra direction of the mutual shadow.
- **P0-3** Generic forget-order images violate the dashing constraint (2¹⁵ of 2³² on N = 4); the restriction class is the Eulerian-serialization family, and that restriction is the theorem.
- **P1-1** "Dashing is the doubly-even code" (ferry 18 §1/§4) misstates the literature layering (code → chromotopology; dashing → odd 1-cochain; doubly-even = existence condition); `AdinkraCode.fs`'s "[8,4] … canonical N=4" reads N as k — in adinkra color-indexing it is an N = 8 datum (type II codes need 8 | N). The viz cube and the code module are at different N; ferries fuse them.
- **P1-2** Ferry 18 §6's "adjunction" should be re-ferried as "span"; its own einstein-tile anchor is a span.

**Beacon anchors used:** Artin 1925; Gates–Faux 2004; DFGHIL 2008/2011 (codes ↔ adinkras); Yan Zhang 2014; Doran–Iga–Landweber (cubical cohomology of adinkras); Cartier–Foata 1969; Viennot 1986; Kauffman 1999; Fenn–Rimányi–Rourke 1997; Bourgoin 2008 (+ Kamada twisted virtual braids — verify cite); Birman–Wenzl 1989 / Murakami 1987; Franko–Rowell–Wang 2006; Smith–Myers–Kaplan–Goodman-Strauss 2023; Kitaev 2001 (standing).

The conjecture fails at the affine odd-face constraint and at H₁(Bₙ) = ℤ — and both failures are interesting: the first prices the restriction exactly (codim 17), the second proves the standing writheParity bridge is terminal, not provisional.

---

## Reception (Aaron, on finding §1's double-count, verbatim — shadow addendum, not part of the report)

> yes the seed is it's own interpertation

The "failure" read as the theorem it contains: the lift added nothing **because the braid word
already carries its own meaning** — order ⊗ generator ⊗ sign is simultaneously the data and the
program acting (the Artin automorphism it denotes). That is ferry 18 §1's homoiconicity claim,
relocated and *proven* by the double-count: the math team's "the object you conjectured was
already on the shelf" is exactly "serialize(Acts) = Remains" holding at the braid-word level —
the seed needs no second copy of its interpretation attached, which is why attaching one
double-counted. Composes with: the MediaLines storage law (store the irreducible seed, generate
the rest — the interpretation IS generated from the seed because the seed is it); DST (a seed's
meaning is its replay); μένω (ferry 12 — what remains is also what acts, at the fixed point).
The dispatch's sharpest negative finding and the lane's oldest positive claim turn out to be
the same sentence read in two directions.
