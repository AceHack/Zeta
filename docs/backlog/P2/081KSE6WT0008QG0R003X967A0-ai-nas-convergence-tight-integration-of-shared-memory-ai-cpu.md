---
id: 081KSE6WT0008QG0R003X967A0
priority: P2
status: open
title: AI NAS convergence — tight integration of shared-memory AI CPU + NAS storage on one device (NAS-as-cluster-node)
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R0004AP0ZA
composes_with:
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R003612WGJ
  - 081KSE6WT0008QG0R00021PPX1
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R003WG0V6P
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0016CEE2Z
  - 081KSE6WT0008QG0R0022D6GN8
  - 081KSE6WT0008QG0R003WMG4XV
  - 081KSE6WT0008QG0R0008483B2
  - 081KSE6WT0008QG0R000QXSG91
  - 081KSE6WT0008QG0R002275NDE
tags: [cluster, hardware, nas, ai-nas, shared-memory, storage, convergence, synology, qnap, ugreen, zimacube, terramaster, asustor]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, sharpening 081KSE6WT0008QG0R0004AP0ZA hardware
sourcing: *"also we are composing with many ai nas systems to
where nas and cpu are tightly integrated with shared memoory ai
cpus over nas."*

A distinct hardware category from the mini-PC class named in
081KSE6WT0008QG0R0004AP0ZA: **AI NAS** — devices where storage and AI compute fuse
on one chassis, with shared-memory NPU+iGPU+CPU running
inference workloads against locally-attached NVMe/HDD storage.

The 2024-2025 product category is rapidly expanding:

| Vendor / class | Example products | Storage capacity | AI CPU | Why fits Zeta substrate |
|---|---|---|---|---|
| **UGREEN DXP series** | DXP4800 Plus / DXP6800 Pro / DXP8800 Plus | 4-8 NVMe + 4-8 HDD bays | Intel Pentium / Core i5 / N100 | Consumer CPU; supports Zeta install; affordable NAS-as-cluster-node |
| **QNAP TS-AI series** | TS-h2477AXU (Ryzen 5700X); TS-x73AU (Ryzen) | 12+ HDD; 2 NVMe | AMD Ryzen 7 / Ryzen AI | NPU-bearing variants emerging; storage + compute on one chassis |
| **Synology DSx24+ series** | DS1825+, DS1525xs+ | 8-25 HDD | Intel/AMD; some NPU variants 2025+ | Enterprise-grade NAS; supports custom installs via DSM bypass |
| **TerraMaster Flagship** | F8 SSD Plus; F6-424 Max | All-NVMe (8x); or 6 HDD | Intel Core i3-N305 / N355 (12-core efficiency) | Compact; energy-efficient; supports custom Linux |
| **Asustor Flashstor** | Flashstor 6 / 12 / 12 Pro | All-NVMe (6-12 slots) | Intel N5105 / N6005 | All-NVMe = NPU+iGPU+CPU shared memory + fast storage |
| **ZimaCube / ZimaBoard 2** | ZimaCube Pro; ZimaBoard 2 | 6 HDD + 4 NVMe / configurable | Intel Core i5 / N100 / N305 | Designed as NAS-PC convergence; SBC roots; hackable |
| **Aoostar WTR Pro / GEM** | Aoostar WTR Pro (5 bay); GEM10/GEM12 | 4-5 HDD + 2 NVMe | AMD Ryzen AI | Mini-PC + NAS form factor; consumer pricing |
| **CWWK / Aliexpress mini-NAS** | CWWK N100 / N305; various | 4-6 NVMe / SATA | Intel N100 / N305 / Ryzen | Very cheap (USD $300-600); standard Linux/NixOS compatible |
| **DIY**: ITX motherboard + NAS case | Jonsbo N1/N2/N3; Sliger CL520; Fractal Node 304 | Operator chooses | Operator chooses | Custom build path; max flexibility |

## The load-bearing principle: push-down AI processing to NAS

Aaron 2026-05-25 sharpening: *"it's push down AI processing
directly to nas."*

AI NAS convergence isn't just smaller-form-factor — it's the
**data-gravity / compute-follows-data principle** at the
storage layer. Same architectural pattern Aaron named earlier
for NATS JetStream pushdown predicates, applied one layer down:

| Layer | Pushdown principle | What Zeta substrate gets |
|---|---|---|
| **NATS JetStream pushdown predicates** | Subject filter evaluated at broker; client receives only matching events | 081KSE6WT0008QG0R003WMG4XV Rx fabric: `.Where(pred)` compiles to server-side filter; bandwidth + CPU + latency all saved |
| **AI NAS pushdown processing** (this row) | Inference compute placed at storage; model executes against data without copying to remote compute | 081KSE6WT0008QG0R003X967A0: inference latency drops; no PCIe / network copy of data to GPU; warm caches stay warm; better energy efficiency |
| **Zeta-native scheduler data-gravity hints** (081KSE6WT0008QG0R0016CEE2Z sub-wave C) | Workloads placed where their data already lives; scheduler honors data-locality observable | 081KSE6WT0008QG0R0016CEE2Z: scheduling decisions minimize data movement cluster-wide |
| **PostgreSQL pushdown** (well-known) | Predicates pushed to storage layer; FDW pushes filters to remote DB | Industry-sharp mature pattern |
| **Hadoop / MapReduce** (well-known) | "Ship the code to the data, not the data to the code" | Industry-sharp mature pattern |
| **Apache Spark locality** (well-known) | Task scheduler honors data-locality (NODE_LOCAL > RACK_LOCAL > ANY) | Industry-sharp mature pattern |

All instantiate the same load-bearing principle: **compute
follows data → minimize data movement → bandwidth-engineering
applied at every layer where data + compute can be co-located**
(per `.claude/rules/bandwidth-served-falsifier.md`).

AI NAS convergence is the hardware-substrate realization of
pushdown-AI-to-storage. Combined with NATS pushdown predicates
(081KSE6WT0008QG0R003WMG4XV) + data-gravity-aware scheduler (081KSE6WT0008QG0R0016CEE2Z), Zeta
substrate operates under bandwidth-engineering end-to-end:
per-event broker filtering → per-workload placement →
per-inference data-locality.

Industry-sharp positioning (per 081KSE6WT0008QG0R000JSJ3SR): this is
**storage-class-compute / in-storage processing / near-data
computing** in established academic + industry vocabulary.
Active research area + emerging product category; Zeta
substrate composes naturally.

## Why AI NAS convergence matters for Zeta substrate

The convergence eliminates a tier in cluster architecture:

| Traditional cluster (separate tiers) | AI NAS convergence (one tier) |
|---|---|
| Compute nodes (mini-PC) + Storage nodes (NAS) + Network connecting them | Single AI NAS = compute + storage + Longhorn-replica-target |
| PCIe/network copy between compute and storage tier | Local NVMe attached directly to AI-CPU shared-memory bus |
| 2-3 device tiers × 3 nodes for HA = 6-9 devices | 1 device tier × 3 nodes for HA = 3 devices |
| Wiring + switching complexity scales with device count | Simpler topology; fewer cables; fewer failure points |
| Per-tier vendor diversity | Operator picks one AI NAS class; HA via 3+ identical units |
| ~$3000-5000 home-lab BOM | ~$1500-3000 home-lab BOM (3 AI NAS units) |

For AI workloads specifically:

| Workload class | Discrete tiers | AI NAS convergence |
|---|---|---|
| Small-model inference (sub-7B) | NPU on compute node ← network ← storage node | NPU on same chassis as model weights → zero network hop; warm cache stays warm |
| Embedding generation + vector store | Compute node → network → vector DB on storage node | Embedding compute + vector storage co-located; no copy overhead |
| RAG (retrieval-augmented generation) | Compute (inference) ← network ← retrieval (storage) ← network ← embedding (compute) | Inference + retrieval + embedding all on same chassis; storage local; perf wins compound |
| Multi-tenant inference + per-tenant storage | Compute fleet + storage fleet + per-tenant routing | Per-tenant AI NAS unit; tenant isolation = device boundary; simpler operationally |
| Training data + training compute | Separate compute + storage tiers (standard) | Less ideal for training (need many GPUs); fall back to discrete compute + storage when training; AI NAS for inference-dominated workloads |

The pattern: **AI NAS convergence wins for inference-heavy
workloads** (most home-lab + small-business AI today).
Training-heavy workloads still benefit from discrete compute
(eGPU per 081KSE6WT0008QG0R0004AP0ZA OCuLink) + dedicated storage (Longhorn
replication across mini-PC nodes per 081KSGS9H0008QG0R002T3BJ2R greedy N-disk).

## Per-AI-NAS-class Zeta substrate composition

### UGREEN DXP / TerraMaster F-series / CWWK / Aoostar WTR

Composes with:

- 081KSGS9H0008QG0R002T3BJ2R zero-typing first-boot — greedy N-disk handles 4-8
  NVMe + HDD layouts cleanly; OS on fastest disk (NVMe);
  Longhorn distributes across remaining
- 081KSE6WT0008QG0R00021PPX1 USB-persistent OS — for vendors that ship locked-down
  OS (Synology DSM, QNAP QTS), USB-persistent OS bypasses;
  AI NAS hardware becomes Zeta cluster node
- 081KSE6WT0008QG0R0022D6GN8 audio+NPU+ONNX — shared-memory NPU substrate works
  same as 081KSE6WT0008QG0R0004AP0ZA mini-PCs; per-vendor NPU support per Intel
  Meteor/Lunar/Arrow Lake OR AMD Ryzen AI
- 081KSE6WT0008QG0R0016CEE2Z scheduler — schedules workloads aware of
  storage-locality + AI-CPU capacity (data-gravity-aware
  scheduling)

### Synology / QNAP (locked-down vendor OS)

Composes with:

- 081KSE6WT0008QG0R00021PPX1 USB-persistent OS — bypass vendor OS; Zeta substrate
  takes over hardware; vendor warranty likely voided (operator
  decision)
- 081KSE6WT0008QG0R003WG0V6P USB-as-repair-tool — Zeta substrate is the repair
  tool; vendor's recovery method preserved as fallback
- 081KSE6WT0008QG0R000WVYAJ2 vendor-swap — operator can return to vendor OS
  by re-flashing vendor recovery; Zeta substrate stays as
  alternative

### ZimaCube / DIY ITX NAS / Asustor Flashstor

Composes with:

- 081KSGS9H0008QG0R002T3BJ2R zero-typing first-boot — these are essentially
  mini-PCs in NAS chassis; existing substrate works unchanged
- 081KSE6WT0008QG0R0004AP0ZA hardware sourcing — these straddle mini-PC + NAS
  categories; included in 081KSE6WT0008QG0R0004AP0ZA's curated picks where vendor
  ships with Zeta-friendly defaults

## Acceptance

- [ ] Per-AI-NAS-vendor compatibility matrix added to
      `docs/hardware-shopping-list.md` (081KSE6WT0008QG0R0004AP0ZA):
      - Vendor + model
      - Zeta substrate compatibility status (works / partial /
        blocked-by-vendor-lockdown)
      - Storage layout (NVMe count + HDD bay count)
      - AI CPU class (Intel ML/LL/AL or AMD Ryzen AI or
        N100-class)
      - Network (1GbE / 2.5GbE / 10GbE built-in)
      - Power draw (idle / typical AI load / max)
      - Per-vendor BIOS quirks (per 081KSE6WT0008QG0R0029S1D5Z BIOS handler library)
- [ ] AI NAS reference deployment recipe: single-node home
      lab with AI NAS as both compute + storage + cluster
      member; documents the convergence pattern
- [ ] HA AI NAS recipe: 3 identical AI NAS units; Longhorn
      replication across nodes; control-plane HA per 081KSE6WT0008QG0R001NG9JZH;
      total BOM <$3000 typical
- [ ] Per-storage-class Longhorn config: greedy N-disk needs
      to handle the AI-NAS NVMe + HDD layout efficiently
      (NVMe for hot tier; HDD for cold tier; Longhorn
      auto-tiers via volume class)
- [ ] AI-NAS-specific first-boot considerations (per 081KSGS9H0008QG0R002T3BJ2R):
      AI NAS often has more disks than mini-PC; greedy N-disk
      should label disks per role automatically (boot disk =
      fastest NVMe; longhorn-hot = remaining NVMe; longhorn-cold
      = HDDs)
- [ ] Vendor-lockdown bypass documentation: for Synology /
      QNAP / Asustor, document the BIOS / boot-USB / vendor-OS
      bypass procedure required to install Zeta substrate
- [ ] Data-gravity-aware scheduler hint (composes with 081KSE6WT0008QG0R0016CEE2Z
      sub-wave C model-locality): AI NAS nodes have local
      data; scheduler prefers them for workloads accessing
      data already on disk

## What changes when AI NAS lands as a first-class cluster node class

Substrate-honest delta:

- **081KSGS9H0008QG0R002T3BJ2R zero-typing**: greedy N-disk extends to handle 4-12
  disk layouts (currently tested with 2 NVMe per iter-2/3); per
  AI NAS class, the disk-count + class mix differs
- **081KSE6WT0008QG0R003612WGJ role taxonomy**: new role `ai-nas` that combines
  worker-storage + worker-gpu (with NPU instead of discrete
  GPU); alternatively, existing `worker-gpu` + `worker-storage`
  roles compose into the AI NAS chassis
- **081KSE6WT0008QG0R00021PPX1 USB-persistent OS**: more relevant for AI NAS due
  to vendor OS lockdown patterns
- **081KSE6WT0008QG0R000WVYAJ2 vendor-swap**: AI NAS hardware vendors compete on
  shipping Zeta-friendly defaults; differentiation lever
- **081KSE6WT0008QG0R0016CEE2Z Zeta-native scheduler**: data-gravity-aware
  scheduling becomes load-bearing because AI NAS nodes
  have data + compute co-located
- **081KSE6WT0008QG0R003WMG4XV fabric**: storage observability + AI inference
  observability all flow as Observables from same chassis
- **081KSE6WT0008QG0R000QXSG91 scale**: AI NAS class fits in tier 50-500 nodes
  comfortably; many small AI NAS units > few big servers
  for many home-lab + SMB workloads
- **081KSE6WT0008QG0R002275NDE plugin sequence**: `Zeta.Storage.BlobStore` per
  rank 1 (revised; per per-vendor support gradient) maps to
  AI NAS local storage as one backend option

## Hardware vendor partnership opportunity (081KSE6WT0008QG0R0004ZPPRP Itron-mode)

Per 081KSE6WT0008QG0R0004ZPPRP Itron-mode standards co-creation: AI NAS market is
fragmenting fast (2024-2025 boom); no incumbent has clear
position; Zeta has opportunity to:

- Define **"AI NAS cluster reference"** specification
  (storage layout + NPU integration + Zeta-substrate compat)
  that vendors can certify against
- Partner with leading AI NAS vendors (UGREEN, QNAP, TerraMaster,
  ZimaBoard) on default-shipping-with-Zeta-substrate
  configurations
- Co-define the **storage-locality + AI-inference-locality**
  scheduler hints (per 081KSE6WT0008QG0R0016CEE2Z sub-wave C) as
  industry-recognized cluster-substrate primitives

This is exactly the 081KSE6WT0008QG0R0004ZPPRP Itron-mode pattern: AI NAS is
GREENFIELD; Zeta substrate has a viable position; vendors
benefit from sharing the standards; operators benefit from
substrate-honest competition.

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (extends to AI NAS disk
  layouts)
- 081KSE6WT0008QG0R003612WGJ — role taxonomy expansion (new `ai-nas` role OR
  composition of worker-storage + worker-gpu)
- 081KSE6WT0008QG0R00021PPX1 — USB-persistent OS (bypass vendor-OS lockdown)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona (AI NAS is one
  hardware class this persona may pick)
- 081KSE6WT0008QG0R003WG0V6P — USB-as-repair-tool (replaceable AI NAS units;
  rebuild via USB stays universal)
- 081KSE6WT0008QG0R000WVYAJ2 — operator-in-the-negotiation-high-seat (per-vendor
  AI NAS support gradient is operator's competitive lever)
- 081KSE6WT0008QG0R0016CEE2Z — Zeta-native scheduler (data-gravity-aware
  scheduling becomes load-bearing for AI NAS class)
- 081KSE6WT0008QG0R0004ZPPRP — Itron-mode standards co-creation (AI NAS is
  greenfield; Zeta has standards-leadership opportunity)
- 081KSE6WT0008QG0R0022D6GN8 — audio+NPU+ONNX (same shared-memory substrate
  used by AI NAS class)
- 081KSE6WT0008QG0R003WMG4XV — observable+controllable cluster fabric (storage
  + inference observability co-located on AI NAS chassis)
- 081KSE6WT0008QG0R0008483B2 — digital twin (twin events + storage co-located)
- 081KSE6WT0008QG0R000QXSG91 — HA-that-scales (AI NAS class fits tier 50-500
  nodes; many small > few big)
- 081KSE6WT0008QG0R002275NDE — simplest-first plugin sequence
  (`Zeta.Storage.BlobStore` substrate maps to AI NAS local
  storage as a backend option)
- 081KSE6WT0008QG0R0004AP0ZA — curated commodity hardware (this row extends with
  AI NAS class alongside mini-PC class)

## Out of scope

- Specific vendor partnerships (UGREEN / QNAP / Synology /
  TerraMaster / Asustor / ZimaBoard) — separate per-vendor
  engagement scope when Zeta adoption justifies (081KSE6WT0008QG0R0004ZPPRP
  Itron-mode pursuit)
- Vendor-OS-specific bypass procedures (Synology DSM /
  QNAP QTS recovery procedures) — per-vendor sub-rows when
  operators show up with specific AI NAS hardware
- Training-workload optimization for AI NAS chassis —
  AI NAS is inference-optimized; training-heavy stays
  discrete (mini-PC + eGPU per 081KSE6WT0008QG0R0004AP0ZA); separate row if AI
  NAS hardware evolves to support training workloads
- All-NVMe-only NAS chassis (Asustor Flashstor; CWWK all-NVMe
  variants) — slightly different storage-class composition;
  handled as substrate gradient within this row's scope

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, sharpening 081KSE6WT0008QG0R0004AP0ZA: 'also
we are composing with many ai nas systems to where nas and cpu
are tightly integrated with shared memoory ai cpus over nas.'

AI NAS is a distinct hardware category from 081KSE6WT0008QG0R0004AP0ZA's mini-PC
class — devices where storage + compute fuse on one chassis,
with shared-memory NPU+iGPU+CPU running inference against
locally-attached NVMe/HDD. Eliminates a tier in cluster
architecture; data-gravity wins; cheaper BOM; simpler topology.

Pairs with 081KSE6WT0008QG0R0004AP0ZA as the second-class hardware substrate for
Zeta cluster: 081KSE6WT0008QG0R0004AP0ZA mini-PC class (compute-dominant) +
081KSE6WT0008QG0R003X967A0 AI NAS class (compute + storage convergence) cover the
two main consumer-affordable cluster-node form factors.
