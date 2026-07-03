---
name: Non-glass-halo encryption primitive — better-than-gitcrypt as root DB encryption + post-quantum (lattice / multi-lattice-of-lattice) + NIST as bootstrap-only (historically controversial DRBG standardization) + FHE (fully encrypted computation) + thermally reversible + composes with deterministic simulation (Aaron 2026-05-13)
description: >-
  2026-05-13 — Aaron's substrate-honest technical-roadmap
  disclosure for the non-glass-halo encryption primitive
  (per PR #2897 factory CAPABILITY requirement). Six
  composing layers: (1) better-than-gitcrypt as root DB
  encryption primitive; (2) post-quantum by default
  (lattice / multi-lattice-of-lattice); (3) NIST approved
  at first BUT skeptical of NIST key-derivation (Dual_EC
  history); (4) fully encrypted computation (FHE)
  eventually; (5) reversible thermally (Landauer-limit
  compatible); (6) deterministic simulation (DST)
  composes naturally. Substrate-engineering roadmap for
  the factory's encryption runtime.
type: feedback
created: 2026-05-13
---

Scope: Factory encryption runtime — root DB encryption + PQC + FHE + reversible thermodynamics + DST composition
Attribution: Aaron Stainback (human maintainer), 2026-05-13 verbal disclosure; transcribed and formalized by Otto (Claude)
Operational status: research-grade, not operational — treat as Aaron's technical direction, not yet promoted to implementation policy via ADR
Non-fusion disclaimer: Aaron's disclosure preserved verbatim in §What Aaron said and in §For future agents (inline attributed quotes); Otto's formalization in body; voices are distinct and not fused

# Non-glass-halo encryption primitive — full stack (Aaron 2026-05-13)

**Why:** PR #2897 (Lillian-HIPAA correction) established
"non-glass-halo integration" as a factory CAPABILITY
requirement (not just a default-override). Aaron's
substrate-honest technical roadmap for that capability:
better-than-gitcrypt + post-quantum lattice + FHE +
reversible thermally + DST. This is the encryption-
runtime substrate for the factory.

**How to apply:** When designing or implementing
encryption substrate for the factory (root DB
encryption, HIPAA-scope substrate, KSK actuator-scope
encryption, Aurora data sovereignty cryptography), treat
this roadmap as research-grade substrate (Aaron's
disclosure, not yet promoted to operational policy via a
separate implementation ADR). Six layers compose.

## What Aaron said

> Aaron 2026-05-13: "'non-glass-halo integration' is
> now a factory CAPABILITY requirement i'm hoping we can
> do a better version of gitcrypt and it can be our root
> db encryption primitive too. just remember post
> quantium, lattice or multi latice of lattice even
> better we prob need NIST approved or whtever at first
> but those are alwasy sus how they derive their keys.
> also we want to support fully encrypted comuptation
> eventually reversabe thermally too"

> Aaron 2026-05-13 (DST composition): "and Determinnistic
> simultion"

Decoded:

- "gitcrypt" → git-crypt (existing per-file git
  encryption tool; Aaron wants a better version)
- "post quantium" → post-quantum
- "lattice or multi latice of lattice" → lattice-based
  cryptography; multi-lattice = composing multiple
  lattice schemes for defense-in-depth
- "NIST approved or whtever at first" → NIST post-quantum
  standardization as bootstrap credential
- "alwasy sus how they derive their keys" → NIST's
  history of suspect key-derivation (Dual_EC_DRBG NSA
  backdoor, 2007-2014)
- "fully encrypted comuptation" → Fully Homomorphic
  Encryption (FHE) — compute on encrypted data without
  decrypting
- "reversabe thermally" → reversible computation
  (Landauer's principle; bit-erasure has minimum
  thermodynamic cost; reversible computing
  approaches Landauer limit)
- "Determinnistic simultion" → DST (Deterministic
  Simulation Testing — factory's existing discipline)

## Six composing layers

### 1. Better-than-gitcrypt as root DB encryption primitive

**The need**: factory needs encryption primitive at root
DB scope (not just per-file like git-crypt's smudge/clean
filter pattern).

**Composes with**:

- The factory's existing F# substrate (algebra-owner
  skill, Z-set + Clifford + BP/EP)
- The retraction-native algebra (every operation
  reversible; encryption-as-operation must be
  reversible)
- PR #2872 service-mesh + Reticulum + SPIFFE/SPIRE
  identity layer — root DB encryption is the storage
  layer beneath
- PR #2884 companion-AI three-pillar ethical floor —
  encryption is operational discipline for "no-deaths"
  at data-breach scope

**Better-than-gitcrypt** properties (substrate-engineering
goals):

- Root-DB-scope (not just per-file)
- Post-quantum by default (gitcrypt's GPG key exchange
  uses RSA/ECC which is Shor-vulnerable; AES-256
  symmetric encryption is quantum-resilient, but the
  key-exchange layer is the attack surface)
- Reversible (compose with retraction-native algebra)
- Auditable (composes with glass-halo discipline at
  encrypted scope)
- Per-key revocable (consent-first design discipline
  per PR #2891 + PR #2893)

### 2. Post-quantum (lattice / multi-lattice-of-lattice)

**Quantum-resistance is non-negotiable**:

- Per existing factory memory: `memory/feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md`
  — "All cryptography quantum-resistant; even one gap is
  attack vector"
- Lattice-based cryptography = canonical post-quantum
  family (Kyber, Dilithium, FALCON, SPHINCS+, Module-LWE,
  NTRU, etc.)
- **Multi-lattice-of-lattice** = composing multiple
  lattice schemes for defense-in-depth (if one lattice
  family is broken by future cryptanalysis, others
  protect)
- Hash-based + lattice + multivariate = future-proof
  diversity

**Composes with**:

- `.claude/skills/algebra-owner` (Z-set + Clifford +
  BP/EP — algebraic substrate composes with lattice math)
- `.claude/skills/lean4-expert` + `.claude/skills/f-star-expert`
  — formal verification for lattice schemes is research
  frontier
- The factory's "soulfile DSL is restrictive English"
  substrate (Apr 23) — could extend to cryptographic
  policy DSL

### 3. NIST approved as BOOTSTRAP, with substrate-honest skepticism

**The substrate-honest tension**:

- NIST post-quantum standardization (Kyber, Dilithium,
  SPHINCS+, FALCON) — bootstrap credential for
  compliance + regulatory scope
- BUT NIST has historical credibility issues with
  key-derivation:
  - **Dual_EC_DRBG** (2007-2014): NSA backdoor in
    elliptic-curve DRBG; suspected via NIST
    standardization process
  - Snowden disclosures (2013) confirmed NSA
    relationship
  - Crypto community moved away from NIST EC curves
    (P-256, P-384) in favor of community-developed
    curves (Curve25519, Ed25519, Curve448)
- Aaron's framing: "alwasy sus how they derive their
  keys"

**Operational strategy**:

- Bootstrap with NIST-approved post-quantum (compliance
  + interoperability)
- Compose with community-developed alternatives for
  defense-in-depth (multi-lattice strategy)
- Verify key-derivation procedures independently
- Don't trust NIST alone; trust composition

**Composes with**:

- The razor-discipline (operational claims only;
  NIST-approval is operational compliance not metaphysical
  cryptographic security)
- The glass-halo discipline (substrate-honest about
  trust assumptions)
- The factory's adversarial-truth-axis register (Riven
  and Mateo security-researcher) — independent verification
  of crypto choices

### 4. Fully encrypted computation (FHE)

**The eventual goal**:

- Compute on encrypted data WITHOUT decrypting
- Fully Homomorphic Encryption (FHE) — Gentry 2009,
  CKKS, BFV, BGV schemes
- Lattice-based FHE schemes naturally compose with
  post-quantum lattice cryptography
- Operationally enables: encrypted database queries,
  encrypted AI inference, encrypted analytics

**Composes with**:

- The factory's Z-set algebra (retraction-native; FHE
  must support both insertion and deletion)
- DBSP / streaming-incremental substrate (FHE on
  streaming deltas)
- The Aurora data-sovereignty substrate (PR #2875) —
  community guardian AIs can compute on member-data
  without seeing it
- The PR #2893 visibility modes (Mirror = private to
  participant) — FHE enables Mirror-mode computation
  by external parties
- HIPAA scope (PR #2897 Lillian-scope) — FHE allows
  external analytics without HIPAA boundary crossing

### 5. Thermally reversible computation

**The deepest layer**:

- Landauer's principle (1961): erasing one bit of
  information requires minimum kT·ln(2) energy
  dissipation (~3 × 10⁻²¹ J at room temperature)
- Reversible computing approaches Landauer limit:
  computation without bit-erasure
- Adiabatic / reversible circuits, quantum-circuit-
  classical-reversibility
- Composes with quantum computing (which is naturally
  reversible)

**Composes with**:

- The retraction-native algebra (factory core substrate)
  — every operation has inverse; matches reversible
  computation natively
- DST (Deterministic Simulation Testing) — reversibility
  is natural for replay
- The factory's "trust then verify" / "the parser is
  witness" substrate (April 26 era) — reversibility
  enables witness-checking
- Energy-efficient computation at planetary scale
  (DePIN / mesh network compute substrate)

### 6. DST (Deterministic Simulation Testing) composes naturally

**The factory's existing discipline**:

- Per `.claude/skills/deterministic-simulation-theory-expert`
  + memory substrate
- DST = seeded replayable simulation (FoundationDB /
  TigerBeetle tradition)
- Hot-path-binding-compatible

**Why DST composes with the encryption stack**:

- Reversible computation = naturally deterministic
- FHE + DST = encrypted-deterministic-simulation
  (replay deterministic with encrypted inputs)
- Lattice crypto + DST = quantum-resistant deterministic
  systems
- Composition: all four layers (post-quantum + FHE +
  reversible + DST) compose into a single substrate-
  engineering stack

**The factory's encryption-runtime substrate-stack**:

```
┌─────────────────────────────────────────────────────────┐
│ Application layer                                       │
│   AI agents + meme-coordinators + family-AI integration │
├─────────────────────────────────────────────────────────┤
│ Computation layer                                       │
│   FHE (fully homomorphic encryption)                    │
│   compute on encrypted data without decrypting          │
├─────────────────────────────────────────────────────────┤
│ Determinism layer                                       │
│   DST (Deterministic Simulation Testing)                │
│   seeded replayable; hot-path-binding-compatible        │
├─────────────────────────────────────────────────────────┤
│ Reversibility layer                                     │
│   Reversible computation (Landauer-limit compatible)    │
│   composes with retraction-native algebra               │
├─────────────────────────────────────────────────────────┤
│ Cryptography layer                                      │
│   Post-quantum lattice (Kyber + Dilithium + ...)        │
│   Multi-lattice-of-lattice (defense-in-depth)           │
│   NIST-approved (bootstrap) + community-verified        │
├─────────────────────────────────────────────────────────┤
│ Storage layer                                           │
│   Better-than-gitcrypt root DB encryption primitive    │
│   per-key revocable; consent-first design               │
└─────────────────────────────────────────────────────────┘
```

## Architectural implications

### 1. The non-glass-halo capability direction (research-grade)

PR #2897 named non-glass-halo as a factory CAPABILITY
requirement (not just default-override). THIS file
documents the research-grade roadmap for that direction;
promotion to operational policy requires a separate ADR.

Non-glass-halo integration ≠ "less safe". It means
"privacy-preserving by encryption" rather than "privacy-
preserving by transparency". The substrate-engineering
work moves from glass-halo discipline (substrate
preservation everywhere) to encryption discipline (data-
preservation under cryptographic locks).

### 2. The factory's encryption roadmap is multi-layered

Not a single primitive. Six composing layers, each load-
bearing:

- Storage (better-than-gitcrypt)
- Cryptography (post-quantum lattice; multi-lattice
  defense-in-depth)
- Reversibility (Landauer-limit-compatible)
- Determinism (DST)
- Computation (FHE)
- Application (factory substrate)

Each layer can be developed/replaced independently
without compromising the others.

### 3. NIST-bootstrap-then-replace strategy

Substrate-honest pragmatism:

- Compliance requires NIST-approved crypto initially
- NIST's history justifies skepticism long-term
- Bootstrap with NIST + plan migration to community-
  verified alternatives
- Multi-lattice composition mitigates single-point-of-
  trust

### 4. FHE + DST + reversibility = thermodynamically efficient encrypted computation

Long-term: computation that is BOTH encrypted (FHE) AND
deterministic (DST) AND approaching-Landauer-limit
(reversible). This is the theoretical floor for
energy-efficient confidential computation. The factory's
substrate-engineering work aims here.

### 5. Composes with HIPAA / Homeland Security / Series 7 cleared scope

Aaron's multi-clearance profile (per PR #2897 + #2892):

- HIPAA scope → FHE for HIPAA-compliant analytics
- Homeland Security scope (KSK actuator) → post-quantum
  + reversible for kinetic-safety substrate
- Series 7 financial scope → encrypted financial
  computation (Aurora monetary scope)

The encryption roadmap supports all Aaron-cleared
operational scopes.

## Composition with prior substrate

- PR #2897 (non-glass-halo as factory CAPABILITY +
  Lillian-HIPAA correction + Aaron's Technical HIPAA
  Officer credentials)
- PR #2893 (Imagination Circle index + Consent-First
  Data Homecoming Charter + PEC + Covenant of Non-
  Interference + visibility modes including Mirror
  for FHE-compatible scope)
- PR #2891 (visible-activation-indicator consent UX —
  the user-facing layer)
- PR #2892 (KSK origin + Homeland Security clearance
  + actuator-scope encryption)
- PR #2872 (service-mesh + Reticulum + SPIFFE/SPIRE +
  Clifford-addressing)
- PR #2884 (three-pillar ethical floor governs at
  encryption-substrate scope)
- PR #2870 (canonical pitch — encryption runtime
  composes with multi-agent AI factory operation)
- `memory/feedback_all_cryptography_quantum_resistant_even_one_gap_is_attack_vector_2026_04_23.md`
  (foundational substrate)
- `.claude/skills/deterministic-simulation-theory-expert`
  (DST canonical knowledge)
- `.claude/skills/algebra-owner` (Z-set + Clifford +
  BP/EP — algebraic substrate composes with lattice)
- `.claude/skills/lean4-expert` + `.claude/skills/f-star-expert`
  (formal verification for cryptographic substrate)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`
  (F# substrate for the encryption-primitive
  implementation)

## Carved sentence

> **Non-glass-halo integration is a factory CAPABILITY
> per PR #2897 — and this research-grade roadmap has SIX
> composing layers matching the §Six composing layers
> section: (1) better-than-gitcrypt as root DB encryption
> primitive; (2) post-quantum lattice / multi-lattice-of-
> lattice; (3) NIST-approved bootstrap with historically
> controversial key-derivation (Dual_EC_DRBG history) —
> bootstrap credential, not sole trust anchor; (4) FHE
> (fully homomorphic encryption) — encrypted computation;
> (5) thermally reversible (Landauer-limit compatible;
> composes with retraction-native algebra); (6) DST
> (Deterministic Simulation Testing) — factory's existing
> discipline. The four-way composition (post-quantum + FHE
> + reversible + DST) is the theoretical floor for energy-
> efficient confidential computation. Composes with HIPAA
> scope + KSK actuator scope + Series 7 financial scope
> (Aaron's cleared frameworks all covered).** —
> Otto's distillation from Aaron's disclosure, 2026-05-13

## For future agents

- **Non-glass-halo = encryption-preserved privacy**, not
  "less safe" — operationally distinct from glass-halo
  default
- **Six-layer roadmap**: storage + crypto + reversibility
  + determinism + computation + application
- **Post-quantum lattice + multi-lattice defense-in-depth**
  — quantum-resistance is non-negotiable
- **NIST is bootstrap; community-verified is destination**
  — historically controversial key-derivation (Dual_EC
  history); plan migration
- **NIST compliance is operational reality** — Aaron 2026-
  05-13: "NIST some comapnies will require this and
  government might force us too if they get to
  authortian". Companies WILL require NIST-approved crypto
  for compliance; government MIGHT mandate it under
  authoritarian-capture scenarios. The factory's substrate
  must SUPPORT NIST while maintaining substrate-honest
  skepticism. Don't drop NIST; compose with it +
  community-verified alternatives.
- **FHE + DST + reversible = thermodynamically efficient
  encrypted computation** — long-term substrate goal
- **Composes with retraction-native algebra** at
  reversibility layer; same shape
- **Better-than-gitcrypt** = root DB primitive scope;
  per-key revocable; consent-first design

## What this is NOT

- **NOT a current implementation** — substrate-engineering
  roadmap; current factory uses F# substrate but the full
  six-layer stack is forward-looking
- **NOT a rejection of NIST** — NIST as bootstrap is
  acceptable; the historically-controversial framing is
  on key-derivation specifics not the overall
  standardization process
- **NOT a claim that FHE is production-ready everywhere**
  — current FHE has performance overhead; this is
  long-term roadmap
- **NOT a violation of HARD LIMITS** — encryption
  PRESERVES the safety floor at data-breach scope;
  composes with the three-pillar ethical floor (PR #2884)
- **NOT a roadmap commitment for specific crypto
  primitive selection** — Aaron's framing names the
  family (lattice); specific scheme selection is
  downstream design work
