---
id: 081KSE6WT0008QG0R0004AP0ZA
priority: P2
status: open
title: Carefully-curated commodity hardware reference for home-lab AI cluster — mini PCs + OCuLink eGPU + shared-memory AI CPUs + simple IP-KVM + remote finger
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on: []
composes_with:
  - 081KSE6WT0008QG0R003WW3YJQ
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R003612WGJ
  - 081KSE6WT0008QG0R00021PPX1
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R003WG0V6P
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R001E1F862
  - 081KSE6WT0008QG0R0029S1D5Z
  - 081KSE6WT0008QG0R0022D6GN8
  - 081KSE6WT0008QG0R003WMG4XV
tags: [cluster, hardware, sourcing, commodity, mini-pc, oculink, egpu, ai-cpu, shared-memory, npu, igpu, kvm, accessibility, home-lab]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait: *"i've tried to carefully
pick things like the mini pc the occulink gpus etc... the ai
cpus with shared memory archiceture for npus/igpus/cpus etc...,
simple kvms, remote fingers, so anyone can build a homelab farm
with little effort and cheap replacable parts."*

081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona named the SOFTWARE
accessibility bet. This row captures the HARDWARE accessibility
bet — the curated commodity-hardware shopping list that makes
the rest of the substrate cluster reachable for any operator.

Without this row, the Zeta substrate looks like "great if you
have enterprise hardware." With it, the answer is "great on
$300-600 mini-PCs + $50 IP-KVM + $40 remote finger; total
home-lab BOM under $1000 for 3-node HA."

## Hardware sourcing philosophy

The five principles Aaron's been applying:

1. **Cheap** — commodity consumer parts; $300-600 mini-PC vs
   $2000+ enterprise server; total 3-node HA BOM under $1000
2. **Replaceable** — standard parts available on Amazon /
   Newegg / AliExpress / Aliexpress; no vendor-locked SKUs;
   operator can drop-in-replace any failed component within
   24h
3. **Energy-efficient** — 10-65W typical mini-PC vs 200-400W
   server; matters for home electrical capacity + cooling +
   noise + operating cost
4. **Shared-memory architecture for AI workloads** — NPU +
   iGPU + CPU on same SoC sharing unified RAM; no PCIe copy
   overhead for AI inference (huge win for small-model
   inference; composes with 081KSE6WT0008QG0R0022D6GN8 ONNX-runtime-on-NPU substrate)
5. **Standard interfaces** — OCuLink for eGPU; standard USB
   for IP-KVM HID; standard ATX for power; PCIe / NVMe / SATA;
   no proprietary connectors; substitutable components

## Curated commodity hardware shopping list (v1)

| Component | Curated pick | Why | Price-ish (USD) |
|---|---|---|---|
| **Mini-PC base** (cluster node) | Beelink SER8 / SER9, Minisforum AI370 / UM790 XTX, ASUS NUC 14 Pro AI, GMKtec K8/K9, Aoostar GEM12 | AMD Ryzen AI / Intel Meteor Lake / Lunar Lake / Arrow Lake; NPU + iGPU + CPU shared memory; 32-96GB RAM; 1-2 NVMe slots; USB4 / OCuLink port for eGPU | $400-800 |
| **AI CPU (shared-memory NPU+iGPU+CPU)** | Intel Core Ultra (Meteor Lake / Lunar Lake / Arrow Lake); AMD Ryzen AI 300 series | Unified memory means inference doesn't pay PCIe copy cost; NPU handles small models; iGPU for medium; CPU fallback; all share RAM | (built into mini-PC) |
| **OCuLink eGPU** (optional per-node) | One-Netbook OCuLink dock; Aoostar Atom Man G7 Ti dock; GPD G1 dock; ADT-Link UT3G; standalone OCuLink-PCIe x4 adapter + GPU + PSU | OCuLink = standardized PCIe-over-cable; mini-PC gets full-size GPU without PCIe slot; eGPU is hot-swappable + replaceable + reusable across mini-PC swaps | $150-300 (dock) + $300-2000 (GPU) |
| **NVMe storage** (per node, 1-2) | Crucial P3 Plus 1TB / 2TB; Samsung 990 EVO; WD SN770; Sabrent Rocket 4 | Cheap NVMe is now $40-80/TB; 2 NVMe per node = greedy disko shape works (per 081KSGS9H0008QG0R002T3BJ2R v1); Longhorn replication handles failure | $40-150 per disk |
| **IP-KVM** (per node, optional but recommended) | GL.iNet Comet Pro (per 081KSE6WT0008QG0R0029S1D5Z); BliKVM v3 / v4 mini; PiKVM v3; JetKVM; NanoKVM; Tinypilot Voyager 2 | HDMI capture + USB HID + virtual mass-storage + ATX power; complete remote BIOS-to-cluster-member per 081KSE6WT0008QG0R0029S1D5Z | $50-200 |
| **Remote finger** (ATX power servo) | Comet Pro finger accessory; BliKVM ATX adapter; or DIY servo + ESP32 | Press power button remotely without splicing into motherboard ATX header | $20-60 |
| **Network** | Cheap 2.5GbE or 10GbE switch (TP-Link TL-SG108-M2; Mikrotik CRS305; Zyxel XGS1010); CAT 6A cables; or WiFi 6/6E if no ethernet | 2.5GbE adequate for home lab; 10GbE if running storage-heavy workloads; PoE optional if powering Comet Pro from switch | $80-300 (switch) + $20 (cables) |
| **UPS** (optional) | CyberPower CP1500AVRLCD3; APC Back-UPS Pro 1500 | Survives brief power blips; mini-PCs draw little so UPS lasts longer; per-node OR shared per-cluster | $200-400 |
| **Rack / shelf** | IKEA Lack table; cheap open-frame 12U mini rack; or just a closet shelf | Mini-PCs stack on anything; full enterprise rack overkill for home lab | $50-200 |
| **Cooling / fans** | Built-in mini-PC fans; small case fans + 12V PSU for shelf-mount | Mini-PCs run cool (10-65W); ambient room cooling adequate at home-lab density | $0-50 |

**Total 3-node HA cluster BOM (no eGPU)**: $1200-2500 typically.
**With 1 eGPU per node**: add $600-1500.

This is **2-4× cheaper than equivalent enterprise rack
hardware** at comparable AI inference performance per dollar
(per the shared-memory NPU advantage for small-model inference).

## Why shared-memory AI CPUs change the math

The 2025-era Intel Meteor Lake / Lunar Lake / Arrow Lake AND
AMD Ryzen AI 300 series have a fundamental architectural shift:

| Traditional discrete GPU | Shared-memory AI CPU (mini-PC era) |
|---|---|
| GPU has dedicated VRAM (8-80GB) | NPU + iGPU + CPU share system RAM (32-96GB) |
| PCIe copy: CPU → VRAM → GPU compute → VRAM → CPU | No copy: NPU/iGPU/CPU all read same RAM addresses |
| Bandwidth bottleneck per copy | Bandwidth bottleneck only on memory; no per-transition penalty |
| Small models (<7B params) get killed by PCIe overhead | Small models run efficiently because no copy overhead |
| Large models (70B+) win on dedicated GPU VRAM | Small + medium models (sub-30B) competitive on shared-memory mini-PC |
| Per-watt: discrete GPU = 150-450W; NPU/iGPU on mini-PC = 5-30W total | 10-20× better perf-per-watt for small-model inference |

For AI cluster substrate (per 081KSE6WT0008QG0R0015ZF2G6 + 081KSE6WT0008QG0R0016CEE2Z + 081KSE6WT0008QG0R0022D6GN8): the
mini-PC + shared-memory AI CPU is the **bandwidth-engineered
sweet spot** for small-model + multi-tenant inference. Discrete
eGPUs (per OCuLink) cover the large-model use case as
opt-in expansion.

Operator economic outcome: a 3-node home-lab cluster with
shared-memory AI CPUs can run small-model inference at
competitive perf-per-dollar against $20K+ enterprise GPU
servers — for the workload classes where small models suffice
(most inference today; especially with quantization + per 081KSE6WT0008QG0R0022D6GN8
ONNX runtime + per-vendor execution providers).

## Per-component substrate composition

### Mini-PCs (cluster nodes)

Composes with:

- 081KSGS9H0008QG0R002T3BJ2R zero-typing first-boot — greedy N-disk handles
  mini-PC's typical 1-2 NVMe layouts cleanly
- 081KSE6WT0008QG0R00021PPX1 unRAID-style USB-persistent OS — for mini-PCs with
  only 1 NVMe + operator wanting OS isolation from data
- 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona — mini-PCs are what
  this persona buys; not enterprise hardware
- 081KSE6WT0008QG0R003WG0V6P USB-as-repair-tool — replaceable mini-PCs means
  "node failed → buy new $400 mini-PC → plug USB → walk
  away → cluster rejoins"

### OCuLink eGPU

Composes with:

- 081KSE6WT0008QG0R003612WGJ role taxonomy — worker-gpu role for eGPU-equipped
  nodes; control-plane role for non-GPU nodes
- 081KSE6WT0008QG0R0016CEE2Z Zeta-native scheduler — GPU-topology aware; OCuLink-
  attached GPUs detectable + schedulable per same plugin
- 081KSE6WT0008QG0R0022D6GN8 audio+NPU+ONNX — ONNX runtime picks execution
  provider; eGPU = CUDA/ROCm EP; iGPU = OpenVINO EP; NPU =
  OpenVINO-NPU EP; per-workload routing

### Shared-memory AI CPUs

Composes with:

- 081KSE6WT0008QG0R0022D6GN8 audio+NPU+ONNX — NPU device plugin
  (`intel.com/npu` or `amd.com/npu` per vendor) registers
  per node; ONNX Runtime with appropriate EP exposes
  inference primitives
- 081KSE6WT0008QG0R003WMG4XV observable fabric — NPU events flow as Rx
  Observables; operator subscribes to inference latency /
  power / queue-depth per device

### IP-KVM (Comet Pro et al.)

Composes with:

- 081KSE6WT0008QG0R0029S1D5Z (already filed) — Comet Pro substrate covers this
- 081KSE6WT0008QG0R003WG0V6P USB-as-repair-tool — KVM enables remote repair
  without physical access
- 081KSE6WT0008QG0R003WZAQKV "I execute, you fingerprint" — KVM physical-presence
  consent floor is the once-per-node plug-in event

### Remote finger

Composes with:

- 081KSE6WT0008QG0R0029S1D5Z — already named; mentioned explicitly here as
  part of the curated BOM

## Acceptance

- [ ] `docs/hardware-shopping-list.md` ships the curated
      commodity hardware reference with current pricing +
      Amazon/Newegg/AliExpress links + per-component substrate
      composition + per-component BIOS quirks (per 081KSE6WT0008QG0R0029S1D5Z BIOS
      vendor handlers)
- [ ] Per-mini-PC-vendor compatibility matrix: which
      configurations have been tested with Zeta substrate +
      what works / what needs vendor-specific BIOS handlers /
      what doesn't work
- [ ] Per-NPU-vendor support status: Intel Meteor Lake (works
      per iter-3 firmware fix); Intel Lunar Lake (expected);
      AMD Ryzen AI 300 (separate driver substrate per 081KSE6WT0008QG0R0022D6GN8
      out-of-scope-v1)
- [ ] Per-OCuLink-eGPU dock compatibility: which docks +
      which GPUs + which mini-PCs work in combination
- [ ] Total BOM calculator: operator picks N-node count + GPU
      preference + storage tier + KVM optional → tool produces
      BOM with current prices + per-node compatibility
- [ ] Reference deployment recipes per BOM tier:
      - Minimum viable home lab (1 mini-PC + 1 USB; for
        learning + dev workloads)
      - 3-node HA (per 081KSE6WT0008QG0R001NG9JZH quorum; per 081KSE6WT0008QG0R000QXSG91 scale tier
        50-nodes-capable)
      - 3-node HA + GPU expansion (1-3 eGPUs)
      - Edge deployment (1 mini-PC per site; many sites;
        per 081KSE6WT0008QG0R00021PPX1 + 081KSE6WT0008QG0R000QXSG91 KubeStellar)
- [ ] AI-trainable hardware substrate: per-BOM cost +
      capability data published per 081KSE6WT0008QG0R0015ZF2G6 reference; AI
      systems can recommend hardware configs based on operator
      workload class
- [ ] Hardware-vendor partnership scope (future per 081KSE6WT0008QG0R0004ZPPRP
      Itron-mode): when Zeta substrate reaches meaningful
      adoption, co-create reference-deployment programs with
      Beelink / Minisforum / GMKtec / GL.iNet / etc. as
      incumbents in mini-PC + IP-KVM markets

## What this enables that doesn't exist elsewhere

| Operator question | Today's status quo | With this row's substrate |
|---|---|---|
| "What hardware do I buy for a home AI cluster?" | "Depends; here's a forum post from 2022; might not work" | "Here's the curated BOM with current pricing + per-component substrate composition + tested compatibility" |
| "Can I replace a failed node cheaply?" | "Server-class hardware is expensive; cluster downtime real" | "Order $400 mini-PC; arrives in 2 days; plug Zeta USB + Comet Pro; walk away; cluster rejoins" |
| "Will my hardware be obsolete in 2 years?" | "Maybe; depends on vendor support cycles" | "Commodity parts; replaceable; substrate works with current + next-gen shared-memory AI CPUs; no vendor lock-in" |
| "Do I need a $20K GPU server?" | "Yes for serious AI work" | "No for small-model inference; shared-memory NPU/iGPU is competitive; eGPU expansion when needed" |
| "Can I run this in a closet without melting?" | "Server hardware = loud + hot + power-hungry" | "Mini-PCs run 10-65W each; total cluster ~200W typical = laptop-level power draw" |

## Substrate-honest scope notes

The curated picks above are **2025-era**. Hardware substrate
evolves; this row's BOM needs annual review:

- Mini-PC vendors change product lineups quarterly
- OCuLink eGPU substrate is new (2023-2024) + rapidly evolving
- Shared-memory AI CPU substrate also new (Meteor Lake 2023;
  Lunar Lake 2024; Arrow Lake 2024; AMD Ryzen AI 2024) +
  improving fast
- IP-KVM market expanding (BliKVM / PiKVM / JetKVM / NanoKVM /
  Tinypilot + new entrants per year)
- Network gear stable but cost dropping (10GbE is now home-lab
  affordable)

Annual BOM refresh via 081KSE6WT0008QG0R003FG3E8R telemetry flywheel: operators
who run Zeta substrate submit per-hardware compatibility data;
catalog updates; future operators inherit current-state BOM.

## Composes with

- 081KSE6WT0008QG0R003WW3YJQ — "I execute, you fingerprint" (Touch ID on Mac for
  flashing; physical-presence consent floor across cluster
  hardware + accessories)
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (designed for commodity
  hardware; greedy N-disk handles mini-PC layouts)
- 081KSE6WT0008QG0R003612WGJ — role taxonomy (worker-gpu role for eGPU-equipped
  mini-PCs; control-plane role for non-GPU)
- 081KSE6WT0008QG0R00021PPX1 — unRAID-style USB-persistent OS (extends to
  single-NVMe mini-PCs + zero-internal-disk edge deployments)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona (this row is the
  HARDWARE accessibility companion to 081KSE6WT0008QG0R003G0Y62D's SOFTWARE
  accessibility persona work)
- 081KSE6WT0008QG0R003WG0V6P — USB-as-repair-tool (commodity hardware =
  replaceable = repair-by-swap)
- 081KSE6WT0008QG0R0015ZF2G6 — open AI-trainable reference architecture (the BOM
  IS part of the reference; AI systems train on hardware-cost
  + capability data)
- 081KSE6WT0008QG0R000WVYAJ2 — operator-in-the-negotiation-high-seat (extends to
  hardware: operator picks vendors; not vendor-locked)
- 081KSE6WT0008QG0R0016CEE2Z — Zeta-native scheduler (NPU + iGPU + CPU + eGPU all
  schedulable per node hardware capacity)
- 081KSE6WT0008QG0R001E1F862 — VC meta-playbook substrate-honest (the substrate-
  honest variant lets operators keep value INCLUDING hardware
  choice; not vendor-lock-in on hardware OR software)
- 081KSE6WT0008QG0R0029S1D5Z — Comet Pro IP-KVM (per-row substrate already files;
  this row references)
- 081KSE6WT0008QG0R0022D6GN8 — audio+NPU+ONNX (shared-memory architecture is what
  makes NPU+iGPU+CPU composition load-bearing for small-model
  inference)
- 081KSE6WT0008QG0R003WMG4XV — observable+controllable cluster fabric (runs on
  commodity hardware; Rx fabric not dependent on enterprise
  gear)
- 081KSE6WT0008QG0R000QXSG91 — HA-that-scales (multiple cheap nodes vs one
  expensive node; aligns with per-tier recommendations)

## Out of scope

- Specific vendor partnerships (Beelink / Minisforum / GMKtec
  / GL.iNet / Crucial / etc.) — separate per-vendor scope
  when Zeta adoption justifies engagement (081KSE6WT0008QG0R0004ZPPRP Itron-mode)
- Cluster-in-a-box appliance products (pre-configured Zeta
  cluster shipping as turnkey hardware) — separate scope;
  defer until 081KSGS9H0008QG0R002T3BJ2R substrate proven on multiple
  hardware-vendor combinations
- Server-class hardware support (Dell PowerEdge, HPE ProLiant,
  Supermicro) — works fine via existing substrate; this row's
  curation is COMMODITY hardware specifically; enterprise
  hardware is documented separately as alternative tier
- Apple Silicon support (M-series Macs as cluster nodes) —
  Asahi Linux substrate is separate track; not in v1 scope
- Cloud-burst hybrid (some nodes on-prem + some in AWS/GCP) —
  separate scope; substrate works in both contexts but BOM
  is on-prem here

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, naming the hardware
sourcing philosophy that pairs with 081KSE6WT0008QG0R003G0Y62D software persona
work: 'i've tried to carefully pick things like the mini pc
the occulink gpus etc... the ai cpus with shared memory
archiceture for npus/igpus/cpus etc..., simple kvms, remote
fingers, so anyone can build a homelab farm with little effort
and cheap replacable parts.'

Five sourcing principles: cheap + replaceable + energy-efficient +
shared-memory-architecture + standard-interfaces. Total 3-node
HA BOM under $1500 (no eGPU) or $3000 (with eGPU). 2-4× cheaper
than equivalent enterprise rack hardware at comparable AI
inference perf-per-dollar for small-model workloads.

This row makes Zeta substrate replicable for anyone with $1-3K +
a weekend, not just operators with $20K+ enterprise hardware
budgets. Pairs with 081KSE6WT0008QG0R003G0Y62D first-time-CLI-user persona for the
software-accessibility side. Together: the bet that AI cluster
infrastructure becomes accessible to home-lab operators +
small businesses + edge deployments + researchers + hobbyists +
teachers — not just enterprise IT.
