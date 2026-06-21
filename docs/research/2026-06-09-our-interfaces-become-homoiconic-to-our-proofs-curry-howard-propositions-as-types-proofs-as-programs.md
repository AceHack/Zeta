# Our interfaces become homoiconic to our proofs — Curry–Howard made literal (the interface IS the proposition; the proof IS the implementation)

**Register:** [grounded] synthesis (Aaron) + [Beacon] Curry–Howard anchor. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). The interface↔proof identity that closes the types→rooms→governance loop.

## Aaron's words

> "our interfaces become homoiconic to our proofs."

## The claim

We hold two prior threads: **interfaces are the valuable thing** (code, docs, proofs all regenerate
from them) and **Meijer: let the types define the code** (types → tests/attractors/loops → rooms fall
out free). Aaron closes the loop: **the interface and its proof are homoiconic** — the *same*
structure, not two artifacts kept in sync. The interface **is** the proof; the proof **is** the
interface.

This is **Curry–Howard made literal**: **propositions-as-types, proofs-as-programs.** A type (interface)
*is* a proposition; an inhabitant (implementation) *is* a proof of it. So:

```text
interface / type   ==  proposition        (what must hold)
implementation     ==  proof              (that it holds)
homoiconic         ==  same representation (code = data = proof; no gap to drift)
```

When the interface and the proof are homoiconic, **there is no separate proof artifact to drift from
the code**: changing the interface changes the proposition changes the proof; a green proof *is* a
well-typed implementation of the interface. The byte-lock golden vectors, the conformance tests, the
type — all become **one homoiconic object** that is simultaneously the contract, the code, and its
proof.

## Why this matters (it makes the whole stack cohere)

- **No proof/code drift — ever.** The #1 failure of formal methods is the spec drifting from the code.
  Homoiconic interface≡proof removes the gap *by construction*: they are the same value, content-
  addressed by the same fingerprint. (Soraya's coverage problem inverts: a proven interface is a proven
  implementation.)
- **Proofs regenerate with the interface.** "Everything regenerates from the interfaces" now includes
  the proofs: change the type, the proof obligation regenerates; this is the proof-room (a DST tick)
  derived from the type, à la Meijer + type providers.
- **It rides on dependent types.** Lean/Coq/F*/Idris terms *are* proofs; our F#-side refinement
  witnesses + the Lean proof-rooms (D4/081KQGDBJ0008QG0R000D1YJCH) approach this. The interface carries its proof as a term.
- **Closes types → rooms → governance.** Types define tests (rooms); rooms have hats (governance); and
  now the interface **carries its proof homoiconically** — so the governed, content-addressed room is
  *also* the proof of its own contract. The polity runs on objects that are simultaneously interface +
  code + proof.

## Honest scope / handoff (peel)

*Peeled:* full homoiconic interface≡proof is the **dependent-type / Curry–Howard ideal**; F#/C#/Rust
are not dependently typed, so today we **approximate** it — byte-lock goldens + property proofs +
refinement witnesses + the Lean proof-rooms get us most of the way, and the *aspiration* is that an
interface and its proof share one content-addressed representation. Don't claim full proofs-as-types in
.NET yet; claim: the interface is the contract, the proof is derived from it and content-addressed
*with* it, and we close the drift gap. To realize: proof obligations generated from the type (type
provider / Meijer), proofs content-addressed alongside the interface, Lean terms as the homoiconic
proof carrier where dependent typing is needed. Routes to Soraya/Sova (the proof-rooms as type-derived,
homoiconic; D4/081KQGDBJ0008QG0R000D1YJCH first), the F#/observe core (type → proof-obligation generation), the public-API/
interface owners (Ilyana — the interface is now also the proof surface).

## Anchors / ties (Beacon)

**Curry–Howard correspondence** (Curry 1934 / Howard 1969 — propositions-as-types, proofs-as-programs);
dependent type theory / proofs-as-terms (Martin-Löf; Lean, Coq, Agda, Idris, F*); Erik Meijer "types
define the code"; F# type providers (regenerate from types); "interfaces are the valuable thing —
code/docs/proofs regenerate from them"; homoiconic (code=data, now =proof); content-addressing
(interface + proof share one fingerprint = canonical root); the proof-rooms (every dependency/claim a
DST room; D4/081KQGDBJ0008QG0R000D1YJCH Lean); types → tests → rooms → hats → governance (the loop this closes).
