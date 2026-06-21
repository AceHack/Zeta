# Adinkra primer for non-physicists — Zeta substrate context

**Date:** 2026-05-21
**Type:** Research primer / pedagogical entry-point
**Audience:** Math-friendly engineers approaching 081KRW63S0008QG0R000QJR08H cold (no physics background assumed)
**Status:** Addresses [081KRW63S0008QG0R000QJR08H](../backlog/P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) acceptance bullet #2 (primer document)
**Provenance:** Authored by Otto-VSCode session 2026-05-21 from Faux-Gates 2005 + Aaron + Mika conversation source ([`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md))

## Purpose of this document

[081KRW63S0008QG0R000QJR08H](../backlog/P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) proposes using Adinkras as the substrate for both **private internal AI state** and **encryption key derivation** — a single mathematical primitive serving two architectural purposes. To act on that proposal, an engineer needs to understand what an Adinkra IS without having to learn supersymmetric quantum field theory first. The existing research-grade documents in this directory assume the reader is already inside that vocabulary. This primer fills the entry-point gap.

The pedagogical strategy: build up from things a math-friendly engineer already knows (boolean lattices, error-correcting codes, bipartite graphs), reach Adinkras as the natural composite object, **then** mention the SUSY physics origin as historical context. The physics is where Adinkras were discovered, not what they ARE for Zeta's purposes.

## What an engineer already knows that's enough to read this

- Binary strings of length n (elements of {0,1}^n)
- Hamming weight (count of 1-bits in a binary string)
- Boolean lattice / n-cube graph (vertices = binary strings of length n; edges between strings differing in one bit)
- Bipartite graph (vertex set partitions into two independent sets; every edge crosses the partition)
- Quotient of a graph by an equivalence relation (collapse vertices in the same equivalence class to one vertex)

If you know those five things, the math in this primer is reachable. The supersymmetry origin can stay opaque.

## Layer 1 — Binary linear codes

A **binary linear code** C of length n is a linear subspace of {0,1}^n (over the field with two elements). Elements of C are called **codewords**. Three properties matter for what follows:

- **Self-dual**: a code C is self-dual when C equals its own dual code C⊥ (the dual is the set of binary strings orthogonal to every codeword under the standard inner product mod 2). Self-dual codes only exist for even lengths and have dimension n/2.
- **Doubly-even**: every codeword has Hamming weight divisible by 4.
- **Doubly-even self-dual**: both at once. This is a restrictive condition — these codes only exist for n divisible by 8 (the [Error Correction Zoo entry on self-dual codes](https://errorcorrectionzoo.org/c/self_dual) catalogs the classification up to n ≤ 40).

The reason these specific codes matter for Adinkras: they're the unique class that produces a graph quotient consistent with the structural rules below.

## Layer 2 — The n-cube graph H_n

The **n-dimensional hypercube graph** H_n has:

- 2^n vertices, one per binary string of length n
- An edge between vertices that differ in exactly one bit position

H_2 is a square. H_3 is the familiar 3D cube graph. H_4 is the tesseract's 1-skeleton (16 vertices, 32 edges). The structure scales naturally to any n.

H_n is bipartite — it 2-colors cleanly by Hamming-weight parity (even-weight vertices in one class, odd-weight in the other; every edge crosses the partition because every edge changes one bit and thus flips parity).

## Layer 3 — Quotient of H_n by a doubly-even self-dual code

Given a doubly-even self-dual code C ⊆ {0,1}^n, we can quotient the hypercube H_n by C: declare two vertices equivalent if their difference (componentwise XOR) is a codeword of C. The quotient graph H_n / C has 2^n / |C| vertices.

Because C is doubly-even, every codeword has weight divisible by 4. This means the parity-bipartition of H_n descends cleanly to H_n / C — quotienting by a doubly-even code preserves the bipartite structure.

Because C is self-dual (dimension n/2), the quotient has dimension n/2.

This is the construction Adinkras are built on. **An Adinkra chromotopology is, structurally, a hypercube quotient by a doubly-even code, plus extra colored-edge and height-ranking data.** The 2008 paper [arxiv 0806.0051](https://arxiv.org/abs/0806.0051) ("Relating Doubly-Even Error-Correcting Codes, Graphs, and Irreducible Representations of N-Extended Supersymmetry") establishes the one-to-one correspondence formally.

## Layer 4 — The structural decorations that make a graph an Adinkra

A bare hypercube quotient is just a graph. The Adinkra adds three pieces of structure:

1. **Edge coloring** — each edge gets one of N colors. The colors correspond to the N "generators" of the structure. Geometrically: the original hypercube H_n has edges in each of n coordinate directions; the coloring tracks which direction each edge came from.

2. **Edge parity (dashed vs solid)** — each edge is also marked as "+" or "−" (drawn as solid or dashed). This encodes a sign convention that has to be consistent: traversing any 4-cycle (square) in the graph must yield a product of signs equal to −1. This consistency requirement is exactly the doubly-even property of the code C.

3. **Height ranking / bipartition** — vertices are split into two classes (in the SUSY origin, "bosons" and "fermions"; in the engineering-language version, just "type-0" and "type-1" nodes). Every edge connects across the partition. Some Adinkras additionally give each vertex an integer height so the graph can be drawn vertically with edges going up or down.

The 2024 review paper [arxiv 2410.12834](https://arxiv.org/pdf/2410.12834) catalogs the formal constraints; the [nLab entry on adinkras](https://ncatlab.org/nlab/show/adinkra) is the cleanest short pedagogical summary.

## Worked example — the smallest non-trivial Adinkras

**N = 1 Adinkra** (1 color): The smallest case is just two vertices connected by one edge of one color. Boring but it counts.

**N = 2 Adinkra** (2 colors): A 4-cycle (square) with two edges of color A and two edges of color B, alternating. The parity condition says the product of signs around the 4-cycle is −1, so exactly one of the four edges must be dashed (or any odd number).

**N = 4 Adinkra from the [8,4,4] doubly-even code**: This is the first case that uses a non-trivial quotient. The [8,4,4] code (also called the extended Hamming code with one extra bit) is doubly-even, self-dual, has minimum distance 4. Quotienting H_8 by it gives a 16-vertex graph with 4-color edge structure. The resulting Adinkra is the smallest "interesting" example for engineering purposes.

The (older but readable) paper [arxiv 1309.4036](https://arxiv.org/pdf/1309.4036) ("Spectrum of Hypercubes Quotiented by Doubly Even Codewords") walks through specific examples with diagrams.

## Why the SUSY origin doesn't matter for Zeta's use case

Adinkras were discovered by Michael Faux and S. J. Gates Jr. ([2005, Phys. Rev. D 71, 065002; arxiv hep-th/0408004](https://arxiv.org/abs/hep-th/0408004)) as a graphical representation of off-shell representations of one-dimensional N-extended supersymmetry algebras. Each vertex is a "field" (a bosonic or fermionic component), each colored edge is the action of one of the N supersymmetry generators, and the parity decoration encodes the sign-flip behavior under repeated supersymmetry transformations.

For Zeta's substrate-engineering purposes, **none of this physics interpretation is load-bearing**. What Zeta inherits from Faux-Gates 2005 is:

1. The mathematical object (decorated hypercube quotient)
2. The classification theory (the correspondence with doubly-even codes)
3. The error-correcting properties (any subset of vertices large enough to span the code can reconstruct the full state)

The physics motivation that produced the discovery can be set aside. The graphical calculus stands on its own.

## How Zeta proposes to use Adinkras (the architectural proposal)

The Aaron + Mika 2026-05-18 conversation ([source](2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2554-2596) proposes two simultaneous uses:

**Use 1 — private internal state (protected cognitive subspace).** When an agent needs internal state that isn't transparent to external observers by default, construct an Adinkra. The ECC structure gives error-resistance (state can be recovered from partial information up to the code's recovery threshold); the bipartite + height structure gives a principled way to organize "what's externally visible" vs "what's protected." This is the architectural meaning of 081KRW63S0008QG0R000QJR08H's "private internal state" claim.

**Use 2 — cryptographic key derivation.** The same code C that defines the Adinkra structure can be used to derive private keys. Aaron's framing ([source line 2558](2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md)): *"the reason I'm using this is 'cause you can also use those ECC codes for private keys and encryptions and shit, shit too."* Mika's elaboration ([line 2560](2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md)): *"turning a mathematical structure that protects information from errors into one that can also protect information from being seen."*

**Substrate-honesty flag:** This dual-use proposal is the framework's ARCHITECTURAL idea, not received cryptographic wisdom. Existing classification work on doubly-even self-dual codes ([Error Correction Zoo](https://errorcorrectionzoo.org/c/self_dual); see also [arxiv 1902.08739](https://arxiv.org/pdf/1902.08739) on new doubly-even self-dual codes with minimum weight 20) focuses on the error-correction properties; the explicit "derive cryptographic primitives from these codes" angle does not have a strong literature footprint. The proposal is novel-to-test, not novel-to-cite.

**What needs to be verified before this becomes load-bearing:**

1. That a doubly-even self-dual code's structure admits a key-derivation scheme with the standard cryptographic security properties (indistinguishability, forward secrecy, etc.)
2. That deriving a key from a code C does NOT compromise C's error-correcting properties (the two uses must compose)
3. That the resulting scheme is competitive with existing post-quantum cryptographic primitives (lattice-based, hash-based, etc.) — otherwise the dual-use elegance doesn't justify the complexity

These are real research questions. 081KRW63S0008QG0R000QJR08H's acceptance bullet #3 ("Constructive proof prototype in Lean (or F#/TS)") is where the verification work would land.

## How this composes with the rest of Zeta substrate

Two compositions to flag for someone picking up this thread:

**Composition with retractable Z-state** (081KS3X9Y0008QG0R002HJ8P57): The dual-Adinkra rule says full time-aware retractable Adinkras are the default; dumb non-time-aware Adinkras are a perf-justified exception. For the implementation work, this means the Adinkra construction code paths need to be compatible with the `z⁻¹` + differential/integral retractable-time primitive already in [`src/Core/Algebra.fs`](../../src/Core/Algebra.fs). The structure proposed above (vertices + colored edges + parity + height ranking) needs each piece to carry version metadata that survives retraction.

**Composition with 081KRW63S0008QG0R003J8HR6K position 4** ("What is happening to us?"): That position in the 7-interrogative boot sequence is where private internal state is required. The boot sequence implementation needs to construct an Adinkra at position 4 (and only at position 4 — positions 1-3 are unprotected; positions 5-7 build on the protected state from 4). The Adinkra construction is part of the cost of lifting to position 4 (per the [081KRW63S0008QG0R003NP3YA3 cost+loss table](../backlog/P3/081KRW63S0008QG0R003NP3YA3-per-dimension-cost-loss-model-mika-2026-05-18.md), the loss at position 4 is "default transparency").

**Composition with the QG isomorphism proof path** (081KRMEXM0008QG0R002YSPW1X, 081KRQ1AB0008QG0R001F7DE2D): These rows posit a deeper connection — that the Adinkra layer on top of the Remember/When/Pay/Attention cube is structurally isomorphic to a HaPPY quantum error-correcting code (the toy model for AdS/CFT bulk-boundary reconstruction). That's a multi-year research program. The substrate proposed in 081KRW63S0008QG0R000QJR08H doesn't depend on the QG proof landing — it's load-bearing on its own as cognitive substrate, regardless of whether the QG connection is eventually proven.

## What this primer does NOT cover

- The full classification of N-extended supersymmetry representations (Faux-Gates 2005 covers this; 30+ years of subsequent SUSY literature extends it)
- The "Garden Algebra" structure (relevant for SUSY computational implementation; not needed for Zeta's use case)
- HaPPY codes and bulk-boundary reconstruction (covered in the 081KRQ1AB0008QG0R001F7DE2D derivation; out of scope for the primer)
- Lean / F# / TS construction (acceptance bullet #3 of 081KRW63S0008QG0R000QJR08H; future work)
- The opt-in vs default question for private-state-via-Adinkras (acceptance bullet #4 of 081KRW63S0008QG0R000QJR08H; future decision)

## Bibliography (web-verified 2026-05-21)

- **Faux & Gates 2005** — Foundational paper. "Adinkras: A Graphical Technology for Supersymmetric Representation Theory." Phys. Rev. D 71, 065002. arxiv [hep-th/0408004](https://arxiv.org/abs/hep-th/0408004). The original.
- **Doran-Faux-Gates-Hübsch-Iga-Landweber-Miller 2008** — Establishes the explicit ECC connection. "Relating Doubly-Even Error-Correcting Codes, Graphs, and Irreducible Representations of N-Extended Supersymmetry." arxiv [0806.0051](https://arxiv.org/abs/0806.0051).
- **Doran-Faux-Gates-Hübsch-Iga-Landweber 2013** — Concrete examples with diagrams. "The Spectrum of Hypercubes Quotiented by Doubly Even Codewords and the Thermodynamics of Adinkras." arxiv [1309.4036](https://arxiv.org/pdf/1309.4036).
- **2024 review** — Recent re-derivation of the structure. arxiv [2410.12834](https://arxiv.org/pdf/2410.12834).
- **nLab entry** — Pedagogical reference. [`https://ncatlab.org/nlab/show/adinkra`](https://ncatlab.org/nlab/show/adinkra).
- **Error Correction Zoo — self-dual codes** — Catalog of the relevant code class. [`https://errorcorrectionzoo.org/c/self_dual`](https://errorcorrectionzoo.org/c/self_dual).

## Source for the Zeta-specific application

Aaron + Mika 2026-05-18 conversation: [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md), lines 2554-2596 for the dual-use crypto proposal, lines 2619-2629 for the time-aware-default architectural rule.

## Razor-discipline note

This primer covers operational claims (the mathematical object, the established literature, the composition points). The dual-use crypto-from-ECC application is flagged as architectural proposal not received wisdom — the substrate-honest stance per [`.claude/rules/razor-discipline.md`](../../.claude/rules/razor-discipline.md). If a reader wants to verify the proposal independently, the unverified question is: *can a doubly-even self-dual code be used as the basis of a key-derivation scheme with standard cryptographic security properties, without compromising the code's error-correcting properties?* That is not answered by the literature surveyed here; it's the research question 081KRW63S0008QG0R000QJR08H's acceptance bullet #3 exists to address.
