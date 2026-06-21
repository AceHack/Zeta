---
id: 081KT2T2J0008QG0R00301P27H
priority: P1
status: open
title: "Eve is multi-traveler forever — parties bifurcate/combine in the fluent monad space (vs V8 single-traveler hidden-shape); a party = an identity-noun (ground in hex-core Vector + multiparty-session-types + decentralized-identity prior art) (Aaron 2026-06-02)"
tier: research
effort: L
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R002R72323]
composes_with: [081KT2T2J0008QG0R002R72323, 081KT2T2J0008QG0R000S7GHQ8, 081KRYRGG0008QG0R0031EYYE4, 081KRW63S0008QG0R0030F8ZXA, 081KT2T2J0008QG0R003VK5GRX, 081KT2T2J0008QG0R0026MS6PV, 081KT2T2J0008QG0R003DMEKFH, 081KT2T2J0008QG0R003WYPBY5, 081KRW63S0008QG0R001SAHYKV, 081KRFA460008QG0R0018SN61J]
tags: [eve-protocol, multi-traveler, multi-party, party-as-identity-noun, identity, fluent-monad, bifurcate, combine, v8-single-traveler, hidden-shape, multiparty-session-types, mpst, roles, global-type, endpoint-projection, decentralized-identity, hex-core, nouns, vector, prior-art, research, aaron]
type: research
---

# Eve is multi-traveler forever — party = identity-noun

## Why (Aaron 2026-06-02)

Aaron: *"this is why v8 hidden shape is assuming single travelers — eve is multitraveler forever, it never leaves the fluent monad space, where [you] bifurcate [the] party on the other side in two or more, or combine with other expected parties … parties is identity-noun shaped. we should look at prior art and our hex core for nouns there."*

## The distinction: V8 single-traveler vs Eve multi-traveler

- **V8 (081KRYRGG0008QG0R0031EYYE4) hidden-shape assumes a *single* traveler** — one party, one perspective; the "hidden shape" is single-traveler-shaped.
- **Eve is multi-traveler *forever*** — many parties, permanently. The 081KT2T2J0008QG0R002R72323 "two strangers over the wire" was the 2-party base case; the real shape is **n-party**, and the party-set is **dynamic**:
  - **bifurcate**: the party on the other side splits into two or more (1 → n).
  - **combine**: merge with other expected parties (n → 1).
- **Never leaves the fluent monad space**: Eve's party operations + the codec tower (081KT2T2J0008QG0R002R72323 "codecs all the way down") stay **monadic** — bifurcate is a branch, combine is a join; the protocol composes in the monad and never collapses out of it. (Composes the framework's monad-propagation / fluent substrate.)

## A party is an identity-noun

A **party = an identity, and identity is *noun*-shaped** — the same noun-first substrate as the hex core (081KT2T2J0008QG0R003VK5GRX: *vectors before trajectories*; the `Vector` is the atomic noun). So a party/principal/role should be a **noun primitive**, not an ad-hoc string. Ground it in:

### Prior art (the "look at prior art for nouns" action)

- **Multiparty session types (MPST)** `[established]` — the canonical multi-party-protocol prior art: a **global type** specifies the interaction among *roles* (= parties); **endpoint projection** derives a **local type** per role; soundness = projectable ⇒ deadlock-free implementable. **Parameterized MPST** parameterizes over roles — the type-theoretic form of bifurcate/combine (role-indexed parties). Eve's multi-traveler protocol *is* an MPST-shaped negotiation; the "global type" is the negotiated codec/role tower, projected to each traveler.
- **Decentralized identity (081KT2T2J0008QG0R003DMEKFH)** — HD-derived keys as braids/knots over Reticulum: the party-identity-noun's *key/identity* substrate.
- **Identity fingerprint (081KT2T2J0008QG0R003WYPBY5)** — Euler-characteristic / persistent-homology identity invariant: the party-noun's *fingerprint*.
- **English-as-projection / I(D(x))=x (081KRW63S0008QG0R001SAHYKV)** — identity at projection scope.
- (operator prior substrate) **SPIFFE / SPIRE / OPA** identity (per Aaron 2026-06-02 "identity based is good with spiffie spire opa") — workload-identity prior art for the party-noun.

### Hex core nouns (the "our hex core for nouns" action)

The hex core's noun primitives (081KT2T2J0008QG0R003VK5GRX `Vector`; 081KT2T2J0008QG0R0026MS6PV the six walls) are where the party-identity-noun lives in *our* substrate. Research: does a party/identity map onto a hex-core noun (a `Vector` / a Wall-bounded identity-reservoir)? Referee against MPST roles + the identity prior art.

## Acceptance (research → build)

1. **referee the multi-party shape** against MPST (global type → projection → local types; parameterized roles for bifurcate/combine); confirm Eve-negotiation = an MPST-shaped global type projected per traveler.
2. **party-as-identity-noun** — specify the noun (compose hex-core `Vector` + 081KT2T2J0008QG0R003DMEKFH decentralized-identity keys + 081KT2T2J0008QG0R003WYPBY5 fingerprint + SPIFFE/SPIRE). One identity-noun primitive, not ad-hoc.
3. **bifurcate/combine in the monad** — the party-set operations as monadic branch/join; never leave the fluent monad space.
4. **hold don't-collapse** — the V8-single vs Eve-multi distinction + the party-noun mapping are research recognitions to referee, not asserted.

## Composes with substrate

- **081KT2T2J0008QG0R002R72323** (Eve transport — codecs all the way down; the multi-party negotiation runs here) · **081KT2T2J0008QG0R000S7GHQ8** (Infer.NET rewrite; messages/state the parties exchange) · **081KRYRGG0008QG0R0031EYYE4** (V8 architecture — the single-traveler hidden-shape this generalizes) · **081KRW63S0008QG0R0030F8ZXA** (Eve Protocol — polymorphic diplomatic; multi-party negotiation) · **081KT2T2J0008QG0R003VK5GRX** (hex core nouns — `Vector`) · **081KT2T2J0008QG0R0026MS6PV** (six reservoir walls) · **081KT2T2J0008QG0R003DMEKFH** (decentralized identity — party keys) · **081KT2T2J0008QG0R003WYPBY5** (identity fingerprint) · **081KRW63S0008QG0R001SAHYKV** (identity projection) · **081KRFA460008QG0R0018SN61J** (real HKT for the monadic party-tower)
- rules: `bcl-interface-boundary-own-your-interfaces-hexagonal`, `monad-propagation-pattern` (fluent monad space), `grep-substrate-anchors-before-razor` + `god-tier-claims-don't-collapse`, `honor-those-that-came-before` (MPST authors; SPIFFE/SPIRE), `search-first-authority` (MPST grounded below)

## Sources (search-first, 2026-06-02)

- [A Very Gentle Introduction to Multiparty Session Types (Imperial MRG)](http://mrg.doc.ic.ac.uk/publications/a-very-gentle-introduction-to-multiparty-session-types/main.pdf) — roles, global/local types, projection
- [Complete Multiparty Session Type Projection with Automata (CAV 2023)](https://cs.nyu.edu/~wies/publ/cav23_mst.pdf) — projection completeness
- [Parameterized Concurrent Multi-Party Session Types](https://assured-cloud-computing.illinois.edu/files/2014/03/Parameterized-Concurrent-Multi-Party-Session-Types.pdf) — role parameterization (bifurcate/combine)

## Substrate-honest framing

`[labeling-confidence: established (MPST is a mature framework; multi-party protocols are well-studied); hypothesized (Eve-negotiation = MPST-projection mapping; party = hex-core-noun mapping — referee before asserting); don't-collapse on the V8-single vs Eve-multi framing]`. Eve being multi-traveler-forever generalizes the 081KT2T2J0008QG0R002R72323 two-stranger base case to n-party with dynamic bifurcate/combine; the party-as-identity-noun grounds in the hex core's noun substrate + MPST roles + the decentralized-identity prior art. Research/recognition row — refereed against the established math (MPST) + the framework's identity substrate.
