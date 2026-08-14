---
id: 081M00QP7FB087G0R00031BQ93
type: task
state: backlog
priority: P2
slug: name-the-vendor-root-in-every-attestation-claim-amd-ark-inte
title: "Name the vendor root in every attestation claim — AMD ARK, Intel PCS, NVIDIA NRAS, TPM EK are centralized roots"
created: 2026-08-14T18:14:00.939Z
depends_on: []
composes_with: []
---

# Name the vendor root in every attestation claim — AMD ARK, Intel PCS, NVIDIA NRAS, TPM EK are centralized roots

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QP7FB087G0R00031BQ93-*.md` glob. -->
## Why

Every hardware attestation available to Zeta terminates in a silicon vendor's self-signed root:

- **AMD SEV-SNP** — report signed by VCEK, chained VCEK -> ASK -> ARK, certificates from AMD's Key
  Distribution Service. VCEK derivation is deterministic, so certificates can be cached and
  verification done offline — but the root key is AMD's.
- **Intel TDX** — quotes chain to PCK certificates issued through Intel's provisioning
  infrastructure.
- **NVIDIA GPU (Hopper/Blackwell only)** — verified through NVIDIA's Remote Attestation Service.
- **TPM 2.0** — trusts the TPM manufacturer's Endorsement Key certificate.

The sovereign-keys ladder's L3 ("attestation-gated invocation") and L5 ("remote-attestation
heartbeats ... proves it is running unmodified firmware") both rest on this, and neither currently
names the root. A decentralized system whose strongest identity claim is *"AMD says this is genuine
AMD silicon running this measurement"* has imported a centralized authority — the same shape as the
Microsoft-CA-in-`db` tension, one layer deeper.

## What this item is

**Documentation honesty, not a redesign.** There is no exit — this is the state of the industry,
and the correct move is to state the ceiling rather than design around it.

Scope:
1. Add a vendor-root line to the L3 and L5 rungs of
   `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-*.md`, in the same
   register §6.3 of the secure-boot doc uses for the Microsoft CA.
2. Note the AMD-vs-Intel asymmetry (offline verifiability) where a platform choice is being made.
3. Where §1 scale-free is asserted, mark it as a software-layer guarantee that does not extend to
   firmware trust roots.

## Not in scope

Not proposing to drop confidential compute, avoid TPMs, or chase a vendor-independent attestation
root. None exists.

## Anchor

`docs/research/2026-08-14-what-a-full-rewrite-cannot-remove-binding-dependencies-and-the-claims-they-cap.md` §5.1
