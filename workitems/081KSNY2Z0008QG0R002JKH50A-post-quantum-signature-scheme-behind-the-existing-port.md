---
id: 081KSNY2Z0008QG0R002JKH50A
type: task
state: backlog
priority: P2
slug: post-quantum-signature-scheme-behind-the-existing-port
title: "Post-quantum signature scheme behind the existing port (ML-DSA / SLH-DSA)"
created: 2026-08-10T03:00:00.000Z
depends_on: []
composes_with: []
---

# Post-quantum signature scheme behind the existing port (ML-DSA / SLH-DSA)

## This ID was cited in code but never filed

`src/Core/Crypto.fs` references this ZetaId twice — `| PqLattice // future: Zeta post-quantum
lattice (081KSNY2Z0008QG0R002JKH50A) — not yet implemented` and again in the hexagonal-swap
comment. **No workitem file existed for it.** Filing it under the cited ID so the source
reference resolves, rather than minting a new one and leaving the code pointing at nothing.

## Measurement (2026-08-10, verified by execution — not assumed)

.NET 10 **does** ship the FIPS 203/204/205 types in the BCL:

```
MLDsa:          System.Security.Cryptography.MLDsa
MLKem:          System.Security.Cryptography.MLKem
SlhDsa:         System.Security.Cryptography.SlhDsa
CompositeMLDsa: System.Security.Cryptography.CompositeMLDsa
MLDsa.IsSupported = false        ← on this macOS host
```

**The types exist and the platform does not back them here.** .NET's PQC is
platform-provided rather than managed, so availability depends on the host crypto stack. A
check that only asked "does the type exist?" would have concluded we have post-quantum
signatures. We do not, on this machine.

**Not yet verified:** whether `IsSupported` is true on the Linux cluster nodes. That is the
first thing to measure, and it decides whether this is buildable today or blocked.

## What makes this cheap now

The N=3 exercise already built the shape this needs:

- **`R6`** — the signature scheme is a **port** (`ISignatureScheme`), with no call site naming
  a concrete algorithm. Adding ML-DSA is one adapter, not a refactor.
- **`R7` + `B9`** — migration is a **bounded, half-open window** on the verifier
  (`Current` / `Retiring firstRejectedEpoch`), with **no coordinator** to sequence a cutover.
  Two honest peers can verify each other throughout the change.
- **`B4`** — an **unbounded** window is legal, so permanent hybrid classical+PQ is a supported
  configuration rather than a misconfiguration. Note `CompositeMLDsa` exists in the BCL and is
  exactly that shape: classical and PQ in one credential.
- **`B7`** — the port contract requires adapters to be **pure and total**. A PQ adapter must
  return a fault rather than throw when unsupported.

## Done when

1. **`IsSupported` measured on the cluster nodes**, and the result recorded here — including
   if it is false, which would block this and is worth knowing.
2. An `ISignatureScheme` adapter for **ML-DSA (FIPS 204)**, gated on `IsSupported` so it
   **degrades honestly** — absent from the registry rather than throwing at verification time.
3. Golden vectors for it, hex-in-source (`no-binary-in-proof-lineage`), self-verified on
   generation.
4. A test that a verifier accepting **both** ECDSA and ML-DSA authorizes under either, and
   that a `Retiring` ECDSA window closes on schedule — the actual migration path, exercised.
5. **Decide and state** whether the target is ML-DSA, SLH-DSA (hash-based, more conservative,
   larger signatures), or `CompositeMLDsa`. The bespoke `PqLattice` enum case should be
   **removed rather than implemented** — a hand-rolled lattice construction is exactly what
   the standardised primitives exist to avoid.

## Pointers

- `src/Core/MultiSignatureVerification.fs` — the port and the migration window.
- `docs/specs/threshold-signature-verification-cleanroom-spec.md` — amendments B4, B7, B9.
- `.claude/rules/numerology-vs-number-theory.md` — the E8/adinkra work in-tree is a
  **coding-theory** lattice (Construction A over extended Hamming), **not** a cryptographic
  hardness assumption. Same word, different thing; do not conflate them when choosing here.
