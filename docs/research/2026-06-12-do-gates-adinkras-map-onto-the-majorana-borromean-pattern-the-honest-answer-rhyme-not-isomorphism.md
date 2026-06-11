# Do Gates' adinkras map onto the Majorana/Borromean pattern? — the honest answer: a real rhyme, not an isomorphism

Aaron 2026-06-12: "do the adinkras from James Gates happen to map onto the Majorana-one pattern
perfectly?" The answer his question deserves is precise, because what MATCHES is load-bearing and
what DOESN'T is a different algebra.

## What genuinely connects them (named chain, real prior art)

- **Adinkras → Clifford algebras:** adinkra edge colors realize gamma-matrix relations (Gates &
  Faux 2004; Doran–Faux–Gates–Hübsch–Iga–Landweber). The N-color structure IS a Clifford-algebra
  representation with a ±1 twist (the dashing).
- **Clifford algebras → Majorana operators:** Majorana fermion operators generate Clifford
  algebras — this is the substance of Kitaev's chain (2001) and everything Majorana 1 builds on.
- **The shared invariant (the rhyme):** both stores hold information as a twist that is GLOBALLY
  nontrivial but LOCALLY invisible. Adinkras: every 2-colored 4-cycle must carry an ODD number of
  dashed edges, and no vertex-local sign flip (gauge move) can remove that odd parity. The
  Borromean/locked braid: no local wiggle combs out the braiding; only cutting a strand does.
  Same defense, different algebra: **information protected by a global obstruction** — and Gates'
  own "codes in the equations" (doubly-even self-dual codes inside adinkras) is the
  error-correcting reading of exactly that protection, which is also WHY topological qubits are
  error-resistant. The rhyme has a common ancestor, not a coincidence.

## Where the mapping honestly breaks

- **Adinkra edges are involutions** — traverse twice, you're back (σ² = 1: the symmetric/Clifford
  world). **Braid generators remember** — σ² ≠ 1 is the braid's whole point (who crossed over
  whom). The braid group SURJECTS onto the adinkra's permutation layer but carries strictly more
  memory; the adinkra compensates by storing its memory in the DASHING (the ±1 layer), not the
  crossing order.
- So: not a perfect map — a **two-register correspondence**: braid memory ↔ dashing parity.
  Crossing-order information and sign-twist information are different fibers over the same
  permutation base.

## The testable piece (named slice — makes the rhyme code, not prose)

AdinkraViz's dashings are still the open retraction-register slice. Land them with TWO laws:
(1) every 2-colored 4-cycle carries odd dashing (the Gates condition, checked); (2) vertex-local
sign flips preserve that parity (the gauge-invariance lemma — "no local move removes the twist"),
which is the same sentence THE STUCK LAW says about the locked braid. Then the rhyme is two
passing tests pointing at each other, with the difference (involution vs memory) stated in both
files. Q#/math-team wording per the Vera brief discipline.

## Pointers

- `src/Core/AdinkraViz.fs` (dashings slice named) · `shapes/cartridges/braid.lines` (THE STUCK
  LAW; Borromean naming proposal) · the Vera brief (wording gates)
- Beacon: Gates & Faux 2004; DFGHIL "Adinkras and the dynamics of superspace prepotentials";
  Kitaev 2001; Brunn 1892; Aravind 1997 (GHZ↔Borromean)
