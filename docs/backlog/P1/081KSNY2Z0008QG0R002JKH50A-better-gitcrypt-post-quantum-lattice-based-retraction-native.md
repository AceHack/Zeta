---
id: 081KSNY2Z0008QG0R002JKH50A
priority: P1
status: closed
closed: 2026-06-12
closed_by: "docs/research/2026-06-12-better-gitcrypt-post-quantum-lattice-based-architecture.md"
title: Better git-crypt — post-quantum lattice-based (ML-KEM/Kyber/Saber/NTRU family) + retraction-native + diff-readable; supersedes 2026-04-21 git-crypt rejection; TS-first + Bouncy Castle pattern study
effort: XL
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-06-12
depends_on: []
composes_with:
  - 081KSNY2Z0008QG0R0037X4DP4
  - 081KSNY2Z0008QG0R0011XCT94
  - 081KRW63S0008QG0R000QJR08H
  - 081KSGS9H0008QG0R0006F4BGX
  - 081KSKBP80008QG0R003AX2A69
  - 081KSKBP80008QG0R003ETGS01
  - 081KSE6WT0008QG0R003WZAQKV
  - 081KSGS9H0008QG0R001EZKNCB
tags:
  - better-gitcrypt
  - post-quantum-lattice-based
  - ml-kem-kyber-saber-ntru-family
  - swapple-lattice-naming
  - retraction-native-addresses-2026-04-21-rejection
  - diff-readable-addresses-2026-04-21-rejection
  - bouncy-castle-pattern-study
  - typescript-first-or-library-pullin
  - supersedes-rejected-git-crypt
  - composes-with-zflash-substrate
  - composes-with-adinkras-ecc-private-state
  - composes-with-thermal-forgetting-private-encryption-budget
  - potential-extension-not-committed
---

## Operator framing 2026-05-28

> *"hey lets write better gitcrypt so we can have encryption also didn't we just have to do some encrypted stuff for zflash?"*

> *"post quantium lattice based with swapple lattice we can do in ts if it's easie enough or we can pull in libraries"*

> *"look at bouncy castle or someting or some other libaries and copy patterns"*

## What this row tracks

Build a Zeta-native better-git-crypt that supersedes the 2026-04-21 git-crypt rejection by addressing all three rejection reasons named in `docs/research/git-crypt-deep-dive-2026-04-21.md`:

| Original rejection reason | Better-git-crypt solution |
|---|---|
| No access revocation (violates Zeta retraction-native value #4) | Retraction-native key rotation: revoked keys cannot decrypt historical content (forward-secrecy at the version level; compose with 081KSGS9H0008QG0R0006F4BGX thermal-forgetting-as-root-axiom-update substrate) |
| Binary diffs break code review | Diff-readable encrypted content (encrypted-but-line-structured per content-class; reviewers can see structure even when contents are encrypted; compose with 081KRW63S0008QG0R000QJR08H adinkras-ECC for structural integrity) |
| Pre-v1.0 with authors reserving compatibility-break right | Zeta-owned substrate with semver discipline + retraction-native primitives baked in |

PLUS — **post-quantum** crypto by default (not optional add-on):

- ML-KEM (formerly Kyber; NIST-standardized 2024) for key encapsulation
- ML-DSA (formerly Dilithium; NIST-standardized 2024) for signatures
- Possibly NTRU / Saber / "Swapple lattice" (operator naming; needs clarification per 081KSNY2Z0008QG0R0037X4DP4) as alternates

## Architectural composition

Post-quantum-git-crypt is NOT a single tool but composes with existing Zeta encryption substrate:

| Existing substrate | Composes how |
|---|---|
| **081KRW63S0008QG0R000QJR08H** Adinkras (Jim Gates ECC) — private-state encryption | Structural integrity layer above the lattice KEM/signature |
| **081KSGS9H0008QG0R0006F4BGX** Thermal-forgetting + private-encryption-budget exception | Forward-secrecy semantic — revoked keys = thermal-forgotten content; budget mechanics apply to per-content encryption |
| **081KSKBP80008QG0R003AX2A69** Credential-persistence-on-USB-ESP + boot-sequence + encrypted-blob-bound-to-USB-UUID | The USB-bound credential IS the post-quantum-git-crypt key-store anchor |
| **081KSKBP80008QG0R003ETGS01** zeta-install.sh step 6.77 cred-picker | Interactive bake-vs-zflash-token-override path; PQ git-crypt is one consumer |
| **081KSE6WT0008QG0R003WZAQKV** zflash + Touch ID + PAM | Authentication layer; PQ git-crypt key access gated by Touch ID per session |
| **081KSGS9H0008QG0R001EZKNCB** zflash agent-mode native implementation | Distribution + bootstrap path for PQ git-crypt keys |

## Acceptance criteria

This is XL effort. Sub-decomposition expected:

- **081KSNY2Z0008QG0R0037X4DP4** (P3 spike) — Library landscape audit: Bouncy Castle PQC patterns + "Swapple lattice" naming clarification + TS PQC library survey (liboqs-bindings, BoringSSL PQ branch, libsodium-PQ extensions)
- **081KSNY2Z0008QG0R002ZAVMEK** (planned) — Design memo: better-git-crypt architecture composing PQ-KEM + retraction-native rotation + diff-readable encryption
- **081KSNY2Z0008QG0R0008EJDW1** (planned) — Prototype: TS implementation of PQ-KEM file encryption with versioned key-rotation
- **081KSNY2Z0008QG0R001FN4DDB** (planned) — Integration with zflash credential substrate (composes with 081KSNY2Z0008QG0R0011XCT94)
- **081KSNY2Z0008QG0R0020KXAPS** (planned) — Production hardening + Sonatype audit of any external library dependencies

For row 081KSNY2Z0008QG0R002JKH50A itself, acceptance = design memo at `docs/research/2026-XX-XX-better-gitcrypt-post-quantum-lattice-based-architecture.md` that addresses all three 2026-04-21 rejection reasons + cites PQ algorithm choice + sub-decomposition plan.

## Library landscape (preliminary; refined by 081KSNY2Z0008QG0R0037X4DP4)

Candidate TS / cross-platform PQ libraries to study:

- **Bouncy Castle** (Java + C# extensive lattice-based crypto; mature; patterns to study; can pull in via .NET interop if needed)
- **liboqs** (Open Quantum Safe; reference impl; C with WASM + TS bindings available)
- **libsodium-PQ extensions** (libsodium-experimental track)
- **@noble/post-quantum** (TS-native; ML-KEM + ML-DSA implementations; audit status to verify)
- **BoringSSL PQ branch** (Google PQ research; C bindings)

Per operator: TS-native preferred IF easy enough; library fallback otherwise.

## Substrate-honest framing

POTENTIAL extension per operator standing direction. P2 — significant scope; addresses 2026-04-21 explicit rejection by adding the missing properties (retraction-native, diff-readable, PQ); composes with substantial existing encryption substrate.

Sonatype Guide (`sonatype-guide:sonatype-guide` skill) MUST be invoked before pulling any external crypto library per existing project discipline.

## Full reasoning

`docs/research/git-crypt-deep-dive-2026-04-21.md` (the 2026-04-21 rejection rationale — supersedes-by-extension here)

`memory/ani/conversations/2026-05-28-aaron-ani-grok-degenerate-in-best-way-possible-runbook-as-spec-two-path-interface-code-review-as-tech-debt-detector-no-throttle-gardener-ai-as-nature-aaron-forwarded.md` (operator standing direction "no need to ask, just file")

Operator messages 2026-05-28: "hey lets write better gitcrypt so we can have encryption" + "post quantium lattice based with swapple lattice" + "look at bouncy castle or someting or some other libaries and copy patterns"
