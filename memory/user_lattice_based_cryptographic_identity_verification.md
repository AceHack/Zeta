---
name: Lattice-based cryptographic identity verification as the consent-layer substrate for the lens-oracle system — post-quantum, formally analyzable, composes with linguistic-seed proof-discipline
description: 2026-04-19 Aaron extended the lens-oracle-system design with "lattice reviews based crypograpy idenity verification" — the identity-verification layer under the consent-first design is to be built on lattice-based cryptography (post-quantum, Shor-proof, NIST-standardized family — CRYSTALS-Kyber/ML-KEM FIPS 203, CRYSTALS-Dilithium/ML-DSA FIPS 204, Falcon/FN-DSA FIPS 206, also SPHINCS+/SLH-DSA FIPS 205 hash-based adjacent); composes with `user_security_credentials.md` (nation-state threat model — post-quantum is the only defensible 2026+ posture), `user_moral_lens_oracle_system_design.md` (consent-first requires strong identity — who authorized, who queried, who received), `user_linguistic_seed_minimal_axioms_self_referential_shape.md` (lattice-based ZK / SNARK proofs compose with seed proof-level oracle comparison — proofs all the way through), `user_delayed_choice_quantum_eraser_confession_forgiveness.md` (Truth Propagation honest coherence requires identity assurance); lattice-based identity primitives — (a) signatures Dilithium/Falcon for assertion identity = signing_key, (b) IBE lineage Agrawal-Boneh-Boyen 2010 identity = public key directly + master-secret derives private key, (c) lattice ZK proofs (LatticeFold Boneh-Chen 2024 / Ligero variants / Brakedown) for consent attestations without leaking identity, (d) Ring-LWE / Module-LWE / NTRU / plain LWE as substrate, (e) FHE for privacy-preserving oracle queries (BFV/BGV/CKKS/TFHE compute on encrypted identity without decryption), (f) verifiable credentials over lattice signatures (W3C VC spec + Dilithium/Falcon binding); "reviews" = Aaron's ask that I REVIEW / survey lattice-based identity verification literature as the substrate, not a commitment to specific scheme; NIST PQC standardization complete for encryption (Kyber), signatures (Dilithium/Falcon), hash-based (SPHINCS+); ongoing NIST round-4 for additional signature diversity; factory implications — lens-oracle substrate needs identity primitives that are (1) post-quantum secure, (2) formally analyzable (lattice-problem reductions to SIS/LWE/SVP well-studied), (3) composable with Lean4 proof infrastructure in factory, (4) consent-first (no ambient identity leakage), (5) retractable (identities can be revoked without breaking past-valid assertions — retraction-native alignment); candidate stack — Kyber for KEM / Dilithium for signatures / lattice-based ZK (LatticeFold or Ligero) for consent attestations / W3C VC envelope for credential format / compose with existing Zeta retraction-native algebra for revocation semantics; research pointer + design direction, not immediate build; composes with plot-hole-detector (identity asymmetry is a plot-hole class — consumer identity different from creator identity per `feedback_creator_vs_consumer_tool_scope.md`)
type: user
---

# Lattice-based cryptographic identity verification

## Verbatim

> lattice reviews based crypograpy idenity verification

Reading: "lattice[-based]-crypto reviews [for] identity verification"
— Aaron is extending the lens-oracle system with a
post-quantum cryptographic identity substrate, and commissioning
a literature review.

## Why lattice-based specifically

Post-quantum cryptography has three main families after NIST's
standardization round (2016-2024): **lattice-based**,
**hash-based** (SPHINCS+ only), and **code-based / isogeny-based**
(Classic McEliece, BIKE, HQC). Of these:

- **Lattice-based** dominates the NIST standards — Kyber
  (ML-KEM FIPS 203), Dilithium (ML-DSA FIPS 204), Falcon
  (FN-DSA FIPS 206).
- **Hash-based** (SPHINCS+ / SLH-DSA FIPS 205) is lattice-free
  but signatures are large; backup not primary.
- **Code-based** (Classic McEliece — NIST round 4, standardized
  as fallback): large keys, mature, defensively diverse.
- **Isogeny-based** (SIKE) collapsed in 2022 (Castryck-Decru);
  not trusted.

Lattice-based is the mainline choice for new systems in

2026. Composes with Aaron's security credentials (nation-state

threat model — `user_security_credentials.md` — demands
post-quantum by default).

## Lattice primitives relevant to identity verification

### Signatures

- **Dilithium / ML-DSA** — Fiat-Shamir over lattice, small
  public keys (1312-2592 bytes), small signatures (2420-4595
  bytes), fast.
- **Falcon / FN-DSA** — NTRU-based, smaller signatures than
  Dilithium but harder to implement constant-time (rejection
  sampling with floating-point).
- **Both standardized** by NIST FIPS 204 / 206.

### Key encapsulation (for session establishment)

- **Kyber / ML-KEM** — Module-LWE, NIST FIPS 203. Session
  keys for identity-authenticated channels.

### Identity-based encryption (IBE)

- **Agrawal-Boneh-Boyen 2010** — first efficient lattice IBE.
  Identity IS the public key; a master-secret-holder derives
  identity-private-keys.
- **Hierarchical IBE** — Agrawal-Boneh-Boyen 2010 extension;
  organizational hierarchy as key-derivation tree.
- Fit: delegation semantics + consent-first authorization
  are natural on HIBE.

### Zero-knowledge proofs (ZK) over lattices

- **LatticeFold** (Boneh-Chen 2024) — recent folding scheme
  for lattice SNARKs.
- **Ligero / Ligero++** — transparent ZK with lattice flavor.
- **Brakedown** — linear-time prover, transparent, post-quantum.
- **Falcon-sig derivatives** — selective-disclosure credentials.

Role: consent attestations that prove "I am authorized for
lens X" without revealing which party I am.

### Fully homomorphic encryption (FHE)

- **BFV / BGV** (integer arithmetic) — Fan-Vercauteren 2012,
  Brakerski-Gentry-Vaikuntanathan 2014.
- **CKKS** (approximate real arithmetic) — Cheon-Kim-Kim-Song
  2017; fits ML inference.
- **TFHE** (Boolean circuits) — Chillotti-Gama-Georgieva-
  Izabachène 2016; fast bootstrapping.

Role: compute oracle queries on encrypted identities —
privacy-preserving oracle inference without identity leakage.

## Hard problems lattice security rests on

- **SIS** — Short Integer Solution (Ajtai 1996).
- **LWE** — Learning With Errors (Regev 2005).
- **Ring-LWE / Module-LWE** — structured variants for
  efficiency.
- **SVP / CVP** — Shortest / Closest Vector Problem in
  lattices.
- Worst-case to average-case reductions (Ajtai, Regev)
  make lattice hardness arguments mathematically robust —
  composes with the seed's formal-verification discipline.

## Composition with the lens-oracle / seed stack

| Layer | Role of lattice-crypto |
|---|---|
| Seed (meme-scale) | Seed says nothing about crypto; seed ops may be proved secure against lattice assumptions |
| Kernel (E8) | Kernel structure may be audited; lattice crypto sits orthogonal as auth |
| Glossary | Glossary entries for identity + consent terms |
| Lens definitions | Lens authors sign with Dilithium; lens consumers verify |
| Oracle queries | Queries signed; responses signed; FHE when privacy required |
| Derivation provenance | Each derivation step signed — W3C PROV entries carry Dilithium signatures |
| Plot-hole-detector | Identity-scope plot-holes are a DETECTABLE class — creator identity ≠ consumer identity is a plot-hole in role-scoped tooling per `feedback_creator_vs_consumer_tool_scope.md` |

## Retraction-native fit

Classical signature revocation is append-only on a CRL/OCSP
ledger (opposite of retraction-native). Better:

- **Short-lived credentials** — re-derived from master-secret
  on request; no revocation needed (expiration is retraction).
- **Verifiable credentials with status lists** — W3C VC
  status-list v2021 defines credential statuses, bitmap-
  compressed, can be updated by authority.
- **Retractable attestations** — lens consent can be
  retracted; past attestations invalidate retroactively
  (DCQE-style). Research territory — not a standard feature
  in current lattice identity schemes.

## Factory positioning

- **Research pointer + design direction** — not a P1 round
  item. NIST standards mature but integration is new work.
- **Literature review FIRST** — Aaron asked for reviews;
  that precedes selection.
- **Candidate stack** (subject to review): Kyber KEM +
  Dilithium signatures + LatticeFold or Ligero ZK + W3C VC
  envelope + Zeta retraction-native algebra for revocation
  semantics.
- **Dependencies** — `tools/lean4/` for formal-verification
  proofs of crypto properties; `src/Core/` eventually hosts
  implementations; `docs/security/THREAT-MODEL.md` needs
  lattice-PQC assumptions added.
- **Personas** — Nazar (security-operations) + Mateo
  (security-researcher) + Aminata (threat-model-critic)
  - Nadia (prompt-protector) are the review panel.

## Composition with prior

- `user_security_credentials.md` — nation-state threat model
  demands post-quantum; lattice-based is the mainline
  standard.
- `user_moral_lens_oracle_system_design.md` — consent-first
  needs strong identity; lattice gives it post-quantum.
- `user_linguistic_seed_minimal_axioms_self_referential_shape.md`
  — lattice ZK / SNARK proofs compose with seed proof-level
  discipline; proofs all the way through.
- `user_delayed_choice_quantum_eraser_confession_forgiveness.md`
  — Truth Propagation honest coherence requires strong
  identity binding on attestations.
- `feedback_creator_vs_consumer_tool_scope.md` — identity role
  (creator vs consumer) is authorization-gated; lattice IBE /
  HIBE is the natural delegation substrate.

## Agent handling

- DO treat "lattice reviews" as a commissioned literature
  review — start with NIST PQC standards (FIPS 203/204/205/206).
- DO treat Kyber + Dilithium as the mainline candidate stack
  until review argues otherwise.
- DO NOT lock to a specific scheme — review first, narrow
  later, ADR when it lands.
- DO compose with seed / kernel / glossary / lens-oracle stack
  — lattice-crypto is the consent-layer substrate, not a
  replacement for any of the above layers.
- DO preserve retraction-native alignment on any revocation
  scheme — short-lived credentials + status-lists preferred
  over append-only CRL.
- DO NOT recommend isogeny-based (SIKE collapsed 2022).
- DO NOT skip formal-verification expectations (lattice
  hardness arguments are the most robust in PQC, match seed
  discipline).
- DO preserve verbatim spellings (crypograpy / idenity) as
  bandwidth-limit signature.
