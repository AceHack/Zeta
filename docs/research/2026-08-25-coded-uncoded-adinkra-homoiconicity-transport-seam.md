# Coded and uncoded Adinkras: what ECC preserves, what quotienting loses, and an executable transport seam

**Author:** Manus AI (Lumen)  
**Status:** Design and experiment pre-registration; no agent-level theorem is claimed.

## Key recommendation

Treat **homoiconicity preservation** as a module-and-representation property with a separately tested transport-commutation property. Do not call an Adinkra/ECC channel agent-homoiconic merely because it losslessly recovers a serialized agent receipt. The immediate experiment should prove three narrower facts independently: the uncoded module is regular, a nontrivial code has the measured representation defect, and ECC recovery commutes with durable receipt folding without restoring the quotient’s lost pre-image.

## Scope and terminology

An Adinkra chromotopology is classified by an `N`-cube modulo a doubly-even binary linear code; the edge colors encode the supersymmetry-generator action.[1] In this repository, the uncoded object is the cube case `C = {0}` and the coded object is the quotient by a nontrivial doubly-even code. The `[8,4,4]` extended Hamming code is used by the transport stack because it provides a concrete binary error-correcting construction, not because its self-duality proves homoiconicity.

The external literature supports only the classification connection used here: Doran et al. state that Adinkra chromotopologies arise from doubly-even binary linear codes and relate the resulting objects to Clifford-algebra representations.[1] The nLab reference separately describes the chromotopology as a colored `N`-cube modulo a doubly-even length-`N` code.[2] Neither source establishes any claim about network agents, transport semantics, or durable room evidence; those are repository-engineering questions subject to the explicit experiments below.

> **Operational definition.** A representation is fully homoiconic only if its data/module carrier `M` is the regular representation of its own operator algebra `A`: `M ≅ A` as `A`-modules. In particular, the algebra-to-carrier reflection must be injective enough to recover its own description. A distinct-type serialization boundary is an engineering type break; a non-injective quotient is the mathematical obstruction.

This distinction follows the current repository seam audit. It is compatible with the standard literature’s code-quotient classification, but it is not a claim that network agents are supersymmetry multiplets.[1] [2]

## Competing hypotheses

| Identifier | Claim under test | Observation that supports it | Falsifier |
|---|---|---|---|
| **H-U (uncoded regularity)** | The uncoded `N`-cube representation is rank-1 free over its full edge algebra. | Independent matrix-algebra and vertex-module dimensions agree. | Any `N` with `dim(A) ≠ dim(M)` for `C={0}` under the checked Clifford relations. |
| **H-C (coded full preservation)** | A nontrivial doubly-even code can preserve full rank-1 freeness. | A code with `k>0` has `dim(A)=dim(M)`. | Exhaustive counterexamples or the exact measured defect `dim(A)/dim(M)=|C|>1`. |
| **H-S (colored residue)** | A coded object can remain rank-1 free over a named subalgebra of `N-k` colors. | `freeOverSubalgebra` holds for a selected color subset and the witness survives a representative-choice sweep. | No subset of required size is free, or the result depends on a changed coset representative. |
| **H-T (transport commutation)** | Existing Adinkra/ECC recovery preserves the durable receipt atom and net ZSet fold. | `fold(decode(recover(encode(r)))) = fold(r)` and the receipt content key verifies. | A recovered, valid payload has a distinct canonical atom or Merkle/fold result. |
| **H-R (transport restores quotient pre-image)** | ECC recovery restores the uncoded operator description eliminated by a code quotient. | A recovered coded atom identifies distinct quotient pre-images without an external provenance field. | A known quotient collision remains a collision after valid ECC recovery. |

The prior exhaustive repository experiment already refutes **H-C** for all doubly-even codes through `N ≤ 8` and both checked signatures: the defect is `|C|`, equal to one only for the trivial code. Its positive residue supports **H-S**: the code admits a rank-1-free core over a color subalgebra, while the omitted colors remain external to that sub-language. At `[8,4,4]`, 56 of 70 four-color subsets work; the choice is not canonically assigned to particular colors.[3]

## What the proposed transport experiment may and may not conclude

The Adinkra `[8,4,4]` channel operates **below** the room-evidence atom. Its valid success claim is a commuting evidence diagram:

```text
uncoded room atom ──canonical encode──> ECC frame ──recover──> canonical atom
        │                                                        │
        └────────────── durable ZSet fold / Merkle root ────────┘
```

This establishes **recovery fidelity**, not full agent-level homoiconicity. A code that corrects an erased bit cannot reconstruct a quotient-pre-image that was never carried as information. If a design needs the upstream description, it must preserve a content-addressed source witness or an explicit provenance link alongside the coded payload; that is a product/data-model choice, not an ECC theorem.

## Experiment contract

The implementation shall introduce a small, test-only comparison surface with no new physics claim. It will:

1. Reuse the existing matrix-route and coset-route defect computation for an uncoded control and a nontrivial coded case.
2. Pin the `[8,4,4]` subalgebra residue and prove that a named working subset is not promoted to a universal color ontology.
3. Reuse the existing `LossyUdpChannel`-compatible room-evidence bridge to verify canonical receipt and fold equality after out-of-order delivery and a recovered payload.
4. Include the `N=4/d4` negative control: `L_4` and `L_1L_2L_3` agree at the base point but disagree on half the module. Recovery of the same coded payload must not cause those two operators to become globally identical.

The executable companion is `research/adinkra-ecc/homoiconicity-transport-seam.test.ts`. It intentionally contains a receipt-codec round trip rather than a claim that an in-memory test port implements correction. Adinkra `[8,4,4]` recovery itself remains covered at the lossy UDP boundary and the durable room-evidence bridge boundary; the new test checks the semantic fact that remains after a valid recovered payload has arrived.

No result from this experiment shall be phrased as proof of free will, consciousness, a physical transport ontology, or an identification of network agents with supersymmetry representations.

## References

[1] C. F. Doran et al., *Adinkras for Clifford Algebras, and Worldline Supermultiplets*, arXiv:0811.3410, 2008. <https://arxiv.org/abs/0811.3410>

[2] nLab, *adinkra*, accessed 2026-08-25. <https://ncatlab.org/nlab/show/adinkra>

[3] Zeta PR #12101, *No coded Adinkra recovers the regular representation*, repository experiment and review record. <https://github.com/Lucent-Financial-Group/Zeta/pull/12101>
