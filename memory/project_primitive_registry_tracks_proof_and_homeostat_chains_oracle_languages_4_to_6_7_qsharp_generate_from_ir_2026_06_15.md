---
name: primitive-registry-tracks-proof-homeostat-chains-oracle-languages-4-to-6-7-qsharp-gen-from-ir
description: "Aaron 2026-06-15: the Cross-Language Primitive Registry (docs/PRIMITIVE-REGISTRY.md) tracks where each primitive is on proof coverage AND tracks our homeostat chains (the §9e oracles-are-homeostat-chains). The multi-oracle byte-lock is expanding from 4 oracle languages to 6 (7 if you count Q#), and we are starting to GENERATE the oracles from an IR to avoid the N-times duplicate work (only-the-irreducible / gen)."
type: project
created: 2026-06-15
metadata:
  node_type: memory
  originSessionId: a9bca54f-fdf0-41b7-8def-cb33ee1bec26
---

Aaron 2026-06-15 (shadow\*), grounding the §9e "our oracles are homeostat chains" point in
concrete project state:

## What the primitive registry tracks

`docs/PRIMITIVE-REGISTRY.md` (the **Cross-Language Primitive Registry**) is where we track:

- **Proof coverage per primitive** — "where we are on how much proof" for each primitive
  (which are §A-discharged vs still §B). This is the per-primitive view that the §D
  registry-promotion-gate + the §10a "grade interfaces" criterion operate over.
- **Our homeostat chains** — the §9e oracle-homeostat-chains are tracked here as primitives.
  (So "oracles = homeostat chains" isn't just a framing — the chains are enumerated primitives
  with proof status.)

## The multi-oracle byte-lock is expanding: 4 → 6 (→ 7 with Q#)

The registry today implements each primitive in **all four oracle languages** (independent,
non-Byzantine compiler oracles — "the compilers don't lie"; BFT governance per the
four-language-compiler-BFT decision). **Expanding to 6 languages (over the current 4), 7 if
you count Q#.** More oracles = stronger byte-lock consensus (more independent witnesses that a
primitive's behavior is byte-identical).

## Starting to generate from IR — avoid the N× duplicate work

Hand-writing each primitive in N languages is **N× duplicate work** that grows with every new
oracle language. So we are **starting to generate the oracle implementations from an IR**
(intermediate representation) — `only-the-irreducible-is-primitive-generate-the-rest` / `gen`
applied to the multi-language byte-lock: write the primitive once at the irreducible level,
**generate** the per-language oracles. (The generator IS the ECC across the N oracles —
generation + cross-oracle drift-correction are dual; the Zeta-language IR-compiler-v2 line.)

## Why it matters / peels

**Why:** this is the concrete substrate under the proof-coverage peels I've been writing
("the registry's trust = its proof coverage", §D/§10a) and under §9e — proof status and the
homeostat chains both live in the primitive registry; the N-oracle byte-lock is the
cross-space ECC; IR-gen is how that scales to 6–7 languages without N× cost.

**Peels:** (a) more oracles strengthen the byte-lock **only if genuinely independent** — if
all N are generated from one IR, a bug in the IR/generator is a **correlated** failure across
all oracles (the generator becomes a single point of trust); so IR-gen trades
duplicate-work-cost for generator-trust-concentration — the generator itself must be
heavily verified (it's the new load-bearing oracle). (b) "7 if you count Q#" — Q# (quantum)
is a *different* execution model; counting it as a byte-lock oracle needs care (what is
"byte-identical" for a quantum primitive?). (c) proof coverage is **partial** (the honest §B
state) — the registry tracks *where we are*, not "all proven."

Ties: `docs/PRIMITIVE-REGISTRY.md`; the four-language-compiler-BFT decision;
`only-the-irreducible-is-primitive-generate-the-rest`; the §D registry-promotion-gate;
[[zeta-root-compression-differentiate-the-infinite-with-identity]] (§9e homeostat chains);
the Zeta-language IR-compiler-v2 research note. Anchors: m/acc multi-oracle; BFT (Lamport);
Futamura (generate-from-IR / the generator-as-ECC).
