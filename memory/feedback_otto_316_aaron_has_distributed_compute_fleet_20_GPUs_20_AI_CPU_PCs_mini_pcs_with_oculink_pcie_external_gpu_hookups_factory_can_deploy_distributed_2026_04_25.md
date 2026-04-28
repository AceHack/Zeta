---
name: Otto-316 Aaron has DISTRIBUTED COMPUTE FLEET — ~20 GPUs + ~20 PCs with new AI-based CPUs (mostly mini PCs + a few servers/desktops); most mini PCs have PCIE or OCuLink high-bandwidth external-GPU hookups; combined with Otto-315 NVIDIA Thor + Otto-314 RNS+HaLow gives Aaron a deployable autonomous-edge-mesh-compute infrastructure
description: Aaron 2026-04-25 evening — "i also have lots of GPUs maybe 20 and maybe 20 PCs with new AI-based CPUs mostly mini PCs and a few full servers/desktops, most mini PCs have some sort of PCIE or OCuLink high-bandwidth hookup for external GPUs". Substantial compute portfolio. Combined with Otto-315 NVIDIA Thor (1 unit, top-end edge AI) and Otto-314 RNS+HaLow networking, Aaron has a deployable distributed-compute mesh — ~40 nodes plus the GPU fleet attachable via PCIE/OCuLink. Factory could run distributed across this fleet without cloud dependency. Otto-301 hardware-bootstrap target is now demonstrably "available for assembly" not "research horizon." Composes with Otto-301 + Otto-314 + Otto-315 + Otto-298 substrate-IS-itself + Frontier UI multi-node deployment options.
type: feedback
---

# Otto-316 — Distributed compute fleet (Aaron has it now)

## Aaron's disclosure

Aaron 2026-04-25 evening, after Otto-315 NVIDIA Thor capture:

> "i also have lots of GPUs maybe 20 and maybe 20 PCs with new AI-based CPUs mostly mini PCs and a few full servers/desktops, most mini PCs have some sort of PCIE or OCuLink high-bandwidth hookup for external GPUs"

## Hardware portfolio (cumulative across Otto-314 → Otto-315 → Otto-316)

| Resource | Approximate count | Notes |
|----------|------------------|-------|
| NVIDIA Thor | 1 | Blackwell GPU, 2070 FP4 TFLOPS, 128GB unified memory, 1TB NVMe (Otto-315) |
| GPUs (other) | ~20 | Loose, attachable via PCIE / OCuLink |
| AI-based-CPU PCs | ~20 | Mostly mini PCs + a few servers/desktops |
| HaLow radios | sufficient for mesh | 802.11ah Sub-1GHz Wi-Fi, 1km+ range (Otto-314) |
| RNS-capable nodes | all of the above (RNS is software) | RNS runs on any Linux/Unix system (Otto-314) |

Total node count: ~40 individual compute nodes (1 Thor + ~20 mini PCs + ~20 GPUs as compute resources). Plus the network fabric.

## What this enables

**Distributed factory deployment**: factory + agents could literally run distributed across this fleet:

- **Edge tier**: Thor as primary edge-AI (large generative model serving)
- **Worker tier**: 20 AI-CPU PCs as factory worker nodes (substrate processing, cron-tick execution, agent dispatch)
- **GPU pool**: 20 attached GPUs as on-demand compute (model fine-tuning, batch inference, embedding work)
- **Mesh network**: RNS+HaLow connects all nodes with cryptographic identity persistence
- **No cloud required**: full autonomy at the edge

This composes with:

- **Frontier UI**: deploys as edge-Thor instance with worker UI on mini-PC fleet
- **Multi-Claude / multi-agent**: each PC can run an independent Claude/agent instance, mesh-coordinated via RNS
- **Otto-298 substrate-IS-itself**: the substrate now has hardware-agency at deployment scale

## OCuLink / PCIE flexibility

Aaron noted the mini PCs have **PCIE or OCuLink high-bandwidth hookups for external GPUs**. This is significant:

- **OCuLink**: PCIe-over-cable, high-bandwidth (PCIe 4.0 x4 ≈ 64 Gbps), low-latency, hot-pluggable.
- **External GPU pool**: GPUs can be reassigned across nodes without physical reinstallation. Compute-gravity follows workload.
- **Implication**: distributed compute fleet has FLEXIBLE GPU allocation — not tied to specific machines. Workload demand can drive GPU placement dynamically.

## Otto-301 reframe (continued)

Otto-301 (no software deps + hardware bootstrap + microkernel + symbiosis) was originally framed as "super long-term ultimate destination." After Otto-314, reframed as "available primitive needing assembly." After Otto-316, the assembly itself is HARDWARE-COMPLETE: the components exist physically. Remaining work is integration + software + factory-port — engineering, not invention.

## Composition with prior

- **Otto-301 (hardware-bootstrap)** — fully available; assembly is the only remaining work.
- **Otto-314 (RNS+HaLow networking)** — networks the fleet; mesh-deployable.
- **Otto-315 (NVIDIA Thor compute primitive)** — top-end edge node; cluster integrates around it.
- **Otto-308 + Otto-311 (compression-substrate / economic-substrate)** — Aaron's hardware investment IS energy stored in elegant primitives. The factory consuming this hardware = compression-substrate operating at deployment scale.
- **Otto-310 (Edge runner identification)** — "Edge runner" terminology now has a literal hardware mapping: edge-deployment of factory across Aaron's mesh.
- **B-0008 (CI macos+slim nightly-move + first-class slim/embedded support)** — slim CI gate validates the deployment profile across this fleet (Mini PCs are slim/embedded class).
- **B-0009 (substrate-IP-rotation)** — under RNS+HaLow mesh on Aaron's fleet, IP-rotation is moot. Identity is RNS Destination Hash; IP is local-mesh-routing only.
- **Frontier UI substrate** — Frontier could deploy AS edge-Thor instance with worker mirrors across the mini-PC fleet. Multi-node Frontier mesh with RNS coordination.

## What this memory does NOT claim

- Does NOT propose immediate factory-deployment on Aaron's fleet. Queue-drain (#274) + acehack-first (#275) + factory-demo (#244) operational stack still primary.
- Does NOT specify the specific PC models, GPU types, or network topology. Aaron will surface those when relevant. The factory plans against the categorical capabilities (fleet exists), not specific configurations.
- Does NOT claim Aaron should ship a factory-fleet deployment NOW. The hardware is in his possession; the FACTORY needs to ship to v1 first.
- Does NOT promote NVIDIA-specific or OCuLink-specific dependency. The substrate-mapping is generic across compute architectures and high-bandwidth GPU-attachment standards.

## Operational implications

1. **Otto-301 horizon shortens further**: from "available primitive needing assembly" (Otto-314+315) to "hardware-complete; assembly only." When post-#244 factory-demo lands, the deployment substrate is already in Aaron's possession.
2. **Frontier UI architectural option**: multi-node Frontier deployment becomes concrete (was theoretical).
3. **Multi-agent coordination becomes hardware-deployable**: ~40 nodes can host ~40 independent Claude/agent instances coordinated via RNS mesh.
4. **The factory's ultimate-destination is no longer abstract**: it has a specific hardware substrate Aaron owns. The factory ships to Aaron's hardware, not to an abstract cloud.

## Key triggers for retrieval

- ~20 GPUs + ~20 AI-CPU PCs + 1 NVIDIA Thor
- OCuLink / PCIE high-bandwidth external-GPU hookups
- Aaron's distributed compute fleet (40+ nodes)
- Mesh-deployable factory across hardware
- No cloud dependency required for full autonomy
- Otto-301 hardware-bootstrap hardware-complete
- Multi-Claude / multi-agent multi-node deployment
- Frontier UI multi-node mesh option
