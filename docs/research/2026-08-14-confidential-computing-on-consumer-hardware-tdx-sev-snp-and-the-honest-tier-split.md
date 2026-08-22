# Confidential computing on consumer hardware — and why the honest tier split is the answer

**Ferried 2026-08-14 (Otto).** Source transcripts:
`docs/research/ip-questionable/2026-08-14-intel-smm-and-seam-hidden-cpu-operating-modes-transcripts-aaron-forwarded.md`.

Aaron asked whether *"one of these hidden modes"* could hide our OS from the regular OS, and
whether SR-IOV / passthrough could sandbox the proprietary GPU driver. This note answers both, and
**retracts a suggestion I made an hour earlier** that does not survive contact with his actual
hardware.

## 1. Peeling the source (Mirror → Beacon)

The transcripts are worth preserving and are partly wrong. Three corrections, none of which
diminish the underlying facts:

- **SMM is *System* Management Mode**, not "Service Management Mode". Real, present since the 386,
  and genuinely more privileged than the kernel or a hypervisor. The concern is legitimate; SMM
  exploits are a real class.
- **SEAM is not an undocumented backdoor.** It is the publicly documented foundation of **Intel TDX**
  (Trust Domain Extensions) — Intel's confidential-computing feature, counterpart to **AMD SEV-SNP**.
  The "NSA runs a VM next to your OS" frame is the video's, not Intel's.
- **You cannot put your code in SEAM root.** It runs an **Intel-signed module**. This is the
  load-bearing fact the transcript never states, and it kills the "hide our OS in there" idea
  outright. SEAM is not a place you can occupy.

What survives is better than the scare: the *mechanism* the video describes — a hardware-encrypted
memory range the host cannot read, with an ephemeral per-machine key — is real, and it is exactly
the primitive an autonomous signer wants.

## 2. The retraction

Earlier I suggested TDX/SEV-SNP as a route to the L2 rung — a signer whose key the host OS cannot
read, on hardware we own rather than rent, and the general form of the AWS Nitro enclave that
Coinbase's agentic wallets use.

**That is not available on the hardware Aaron actually has.** He describes the fleet as: consumer
parts, high-end *laptop* CPUs, a few low-end, plus integrated-memory "AI" CPUs with unified
CPU/GPU memory. Against that:

| feature | availability |
|---|---|
| Intel TDX | Xeon (Sapphire Rapids and later) — **server only** |
| AMD SEV-SNP | EPYC — **server only** |
| AMD SME | present on consumer Ryzen, but it is *memory encryption*, **not** per-VM isolation or attestation |
| Intel SGX | **removed** from consumer desktop parts (11th gen onward) |
| Apple Secure Enclave | present on the M2 Ultra — and no seal tier reaches it (measured by the probe) |

So on the default scale unit — **mini PC + eGPU + HSM** — there is **no hardware-enforced VM memory
isolation**, and no attested enclave. The suggestion was right about the mechanism and wrong about
the fleet.

## 3. Which makes Aaron's position correct rather than a compromise

> *"we might just have to trust agents not to read each others keys in the start ... we can just say
> consumer swarms in the gpu are not guaranteed independent like server swarms can be with real
> hardware isolation, that's an acceptable split and even investors will understand that."*

That is the right call, and it is the same discipline as the proven/open ledger: **state the tier,
do not overclaim it.**

| tier | isolation | independence claim |
|---|---|---|
| **Consumer swarm** (mini PC + eGPU) | software and convention only | agents on one box are **not guaranteed independent** |
| **Server swarm** (EPYC / Xeon) | SEV-SNP / TDX, hardware-enforced | independence is **attestable — to a silicon-vendor root** (AMD ASK/ARK for SEV-SNP; Intel's provisioning root for TDX) |

**The vendor root is the ceiling on the second row, and it should be stated wherever that row is
cited.** "Attestable" here means *a relying party can verify a report that chains to AMD's or
Intel's self-signed key* — so the independence claim is exactly as strong as trust in that vendor,
and two SEV-SNP nodes are **one root wearing two boxes**. The mitigation is not a stronger claim but
a **diverse** one: an AMD root and an Intel root are genuinely different roots, which is why a
mixed-vendor server fleet buys something a single-vendor fleet does not. (Note the distinction that
matters for air-gapped operation: AMD's KDS, Intel's PCS and NVIDIA's NRAS are *distribution and
verification services*, which are avoidable — offline verification works. The **root** is not
avoidable.)

The split is legible to a technical investor precisely *because* it declines to claim the stronger
property on the cheaper hardware. A fleet claiming hardware isolation on consumer laptop silicon
would fail the first diligence question; this does not.

Note also that **it does not weaken the custody design at all**. Geographic distribution is what
makes shares independent, and that is a property of *where the boxes are*, not of what the CPU
supports. Three houses with consumer hardware still means an attacker needs two houses.

## 4. The tension nobody has named: unified memory makes isolation *worse*

Aaron listed integrated-memory AI CPUs — Mac-like unified architectures on non-Apple hardware,
where CPU and iGPU share one physical address space — as attractive for the BNN workload. They are:
large models in shared memory with no PCIe copy is exactly what inference wants.

**For key isolation they are the worst case.** A discrete GPU has its own VRAM behind an IOMMU; a
compute kernel reads GPU memory. On a unified architecture the iGPU addresses the same physical
memory the CPU uses, so the boundary between a GPU compute kernel and CPU-resident secrets is
weaker, and depends entirely on IOMMU/driver enforcement rather than on physical separation.

So the property that makes these parts good for the workload makes them bad for the thing we want
next. That is a genuine trade, not a defect, and it should be recorded before hardware is chosen at
scale rather than discovered after.

## 5. GPU sandboxing — passthrough works, SR-IOV mostly does not

- **VFIO full-device passthrough works on consumer cards.** The GPU is handed to a VM, the
  proprietary driver runs *inside* that VM, and the host never loads it. That is a real containment
  boundary for the one dependency we cannot rewrite, verify or sign.
- **SR-IOV is gated.** NVIDIA restricts vGPU/SR-IOV to licensed datacenter cards; consumer GeForce
  does not expose it.
- Aaron notes community firmware work can unlock SR-IOV-like partitioning on some consumer parts,
  and is willing to reverse-engineer. Worth knowing what that does and does not buy: it changes the
  **resource-sharing** story (one card, several guests) and **not** the **trust** story. Partitioning
  obtained by patched firmware is not attested isolation, and it should not be presented as such.

## 6. What this changes, concretely

1. **Do not design around TDX/SEV-SNP** for the current fleet. Revisit only if server parts enter it.
2. **Record the consumer/server tier split** wherever independence is claimed — including in any
   investor-facing material. It is a strength, not a caveat.
3. **VFIO passthrough is the available containment** for the GPU driver, and it is worth costing.
4. **`inventory/` has two items** — the Mac Studio M2 Ultra and one RTX 4090 — against a fleet
   described as ~20 units. The register, its schema and a Phase-7 independent security audit all
   exist; the *data* does not. Any claim about fleet composition currently has nothing behind it,
   and populating it is cheap.

## Pointers

- `inventory/items/` — the ZetaId-keyed asset register (git-as-database); `inventory/AUDIT-PHASE7.md`
- `docs/research/2026-08-14-nixos-secure-boot-lanzaboote-…` — why the GPU driver survives Secure Boot today (`MODULE_SIG = no`), and why the chain stops at the UKI
- `docs/research/2026-08-14-code-bound-key-access-preliminary-integration-…` — the ladder this was an attempted shortcut up
- `tools/setup/persona-keys/frost-share-adapter.ts` — the L1 ceiling, stated in its own header
- [`mirror-beacon-register-discipline.md`](../../.claude/rules/mirror-beacon-register-discipline.md) — the peel in §1
