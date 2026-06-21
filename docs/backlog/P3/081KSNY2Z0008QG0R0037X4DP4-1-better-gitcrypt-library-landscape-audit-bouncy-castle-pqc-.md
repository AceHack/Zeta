---
id: 081KSNY2Z0008QG0R0037X4DP4
priority: P3
status: open
title: Better-git-crypt library landscape audit — Bouncy Castle PQC patterns + "Swapple lattice" naming clarification + TS PQ library survey
effort: S
ask: aaron 2026-05-28
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002JKH50A
composes_with:
  - 081KSNY2Z0008QG0R002JKH50A
tags:
  - library-landscape-audit
  - bouncy-castle-pqc-patterns
  - swapple-lattice-naming-clarification
  - ts-pqc-library-survey
  - liboqs-noble-post-quantum-libsodium-boringssl
  - small-spike-then-document
  - sonatype-guide-required-before-any-pull
  - potential-extension-not-committed
---

## What this row tracks

Empirical landscape audit (1-2 days) before 081KSNY2Z0008QG0R002JKH50A design work. Three deliverables:

1. **Bouncy Castle PQC patterns** — read the Java/C# Bouncy Castle lattice-based crypto implementations (Kyber, Saber, NTRU, Dilithium, Falcon); document the patterns that compose into Zeta's better-git-crypt design (key-encapsulation API shape, signature API shape, encoded-format conventions, error handling, side-channel mitigations)
2. **"Swapple lattice" naming clarification** — operator named "swapple lattice" in 2026-05-28 framing; this is not a standard named scheme. Candidates:
   - Saber (Module-LWR; NIST PQC Round-3 finalist; not standardized but published)
   - SWIFFT (older lattice-based hash; FFT-based)
   - SWOOSH (Module-LWR variant)
   - Operator coinage / informal naming for a specific lattice family
   Goal: clarify with operator OR document the most-likely interpretation + alternates
3. **TS PQ library survey** — empirical assessment of:
   - `@noble/post-quantum` (TS-native; ML-KEM-512/768/1024 + ML-DSA + SLH-DSA; audit status; bundle size; API ergonomics)
   - `liboqs` JS/WASM bindings (mature; broader algorithm coverage; WASM size; binding maturity)
   - Other candidates (libsodium-PQ; BoringSSL-PQ via FFI; etc.)
   - For each: licensing, security audit history, maintenance velocity, TS ergonomics, performance benchmarks

## Acceptance criteria

- Memo at `docs/research/2026-XX-XX-better-gitcrypt-pq-library-landscape-bouncy-castle-patterns-swapple-clarification.md` covering all three deliverables
- Recommendation: which library (or which combination) for 081KSNY2Z0008QG0R002JKH50A prototype phase
- Sonatype Guide invocation results for any candidate libraries (per project standing discipline)
- Bouncy Castle pattern excerpts that 081KSNY2Z0008QG0R002JKH50A design should adapt (API shapes; not literal code-copy without license review)

## Composition

- **081KSNY2Z0008QG0R002JKH50A** (parent) — informs design memo
- Sonatype Guide (`sonatype-guide:sonatype-guide` skill) — REQUIRED before recommending any pull
- Operator standing crypto-substrate work (081KRW63S0008QG0R000QJR08H adinkras; 081KSGS9H0008QG0R0006F4BGX thermal-forgetting; 081KSKBP80008QG0R003AX2A69 USB-bound credentials)

## Substrate-honest framing

POTENTIAL spike per operator standing direction. P3 — small (1-2 days); pure research + documentation; informs the larger 081KSNY2Z0008QG0R002JKH50A design work.

## Full reasoning

`docs/backlog/P2/081KSNY2Z0008QG0R002JKH50A-...md` § "Library landscape (preliminary; refined by 081KSNY2Z0008QG0R0037X4DP4)"

Operator 2026-05-28: "post quantium lattice based with swapple lattice" + "look at bouncy castle or someting or some other libaries and copy patterns"
