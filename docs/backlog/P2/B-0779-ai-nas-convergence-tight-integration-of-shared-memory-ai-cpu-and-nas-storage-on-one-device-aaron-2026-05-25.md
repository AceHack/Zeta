---
id: B-0779
priority: P2
status: open
title: AI NAS convergence — tight integration of shared-memory AI CPU + NAS storage on one device (NAS-as-cluster-node)
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0778
composes_with:
  - B-0754
  - B-0755
  - B-0758
  - B-0759
  - B-0760
  - B-0763
  - B-0767
  - B-0771
  - B-0772
  - B-0773
  - B-0775
  - B-0776
tags: [cluster, hardware, nas, ai-nas, shared-memory, storage, convergence, synology, qnap, ugreen, zimacube, terramaster, asustor]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, sharpening B-0778 hardware
sourcing: *"also we are composing with many ai nas systems to
where nas and cpu are tightly integrated with shared memoory ai
cpus over nas."*

A distinct hardware category from the mini-PC class named in
B-0778: **AI NAS** — devices where storage and AI compute fuse
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
| **NATS JetStream pushdown predicates** | Subject filter evaluated at broker; client receives only matching events | B-0772 Rx fabric: `.Where(pred)` compiles to server-side filter; bandwidth + CPU + latency all saved |
| **AI NAS pushdown processing** (this row) | Inference compute placed at storage; model executes against data without copying to remote compute | B-0779: inference latency drops; no PCIe / network copy of data to GPU; warm caches stay warm; better energy efficiency |
| **Zeta-native scheduler data-gravity hints** (B-0767 sub-wave C) | Workloads placed where their data already lives; scheduler honors data-locality observable | B-0767: scheduling decisions minimize data movement cluster-wide |
| **PostgreSQL pushdown** (well-known) | Predicates pushed to storage layer; FDW pushes filters to remote DB | Industry-sharp mature pattern |
| **Hadoop / MapReduce** (well-known) | "Ship the code to the data, not the data to the code" | Industry-sharp mature pattern |
| **Apache Spark locality** (well-known) | Task scheduler honors data-locality (NODE_LOCAL > RACK_LOCAL > ANY) | Industry-sharp mature pattern |

All instantiate the same load-bearing principle: **compute
follows data → minimize data movement → bandwidth-engineering
applied at every layer where data + compute can be co-located**
(per `.claude/rules/bandwidth-served-falsifier.md`).

AI NAS convergence is the hardware-substrate realization of
pushdown-AI-to-storage. Combined with NATS pushdown predicates
(B-0772) + data-gravity-aware scheduler (B-0767), Zeta
substrate operates under bandwidth-engineering end-to-end:
per-event broker filtering → per-workload placement →
per-inference data-locality.

Industry-sharp positioning (per B-0777): this is
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
(eGPU per B-0778 OCuLink) + dedicated storage (Longhorn
replication across mini-PC nodes per B-0754 greedy N-disk).

## Per-AI-NAS-class Zeta substrate composition

### UGREEN DXP / TerraMaster F-series / CWWK / Aoostar WTR

Composes with:

- B-0754 zero-typing first-boot — greedy N-disk handles 4-8
  NVMe + HDD layouts cleanly; OS on fastest disk (NVMe);
  Longhorn distributes across remaining
- B-0758 USB-persistent OS — for vendors that ship locked-down
  OS (Synology DSM, QNAP QTS), USB-persistent OS bypasses;
  AI NAS hardware becomes Zeta cluster node
- B-0771 audio+NPU+ONNX — shared-memory NPU substrate works
  same as B-0778 mini-PCs; per-vendor NPU support per Intel
  Meteor/Lunar/Arrow Lake OR AMD Ryzen AI
- B-0767 scheduler — schedules workloads aware of
  storage-locality + AI-CPU capacity (data-gravity-aware
  scheduling)

### Synology / QNAP (locked-down vendor OS)

Composes with:

- B-0758 USB-persistent OS — bypass vendor OS; Zeta substrate
  takes over hardware; vendor warranty likely voided (operator
  decision)
- B-0760 USB-as-repair-tool — Zeta substrate is the repair
  tool; vendor's recovery method preserved as fallback
- B-0763 vendor-swap — operator can return to vendor OS
  by re-flashing vendor recovery; Zeta substrate stays as
  alternative

### ZimaCube / DIY ITX NAS / Asustor Flashstor

Composes with:

- B-0754 zero-typing first-boot — these are essentially
  mini-PCs in NAS chassis; existing substrate works unchanged
- B-0778 hardware sourcing — these straddle mini-PC + NAS
  categories; included in B-0778's curated picks where vendor
  ships with Zeta-friendly defaults

## Acceptance

- [ ] Per-AI-NAS-vendor compatibility matrix added to
      `docs/hardware-shopping-list.md` (B-0778):
      - Vendor + model
      - Zeta substrate compatibility status (works / partial /
        blocked-by-vendor-lockdown)
      - Storage layout (NVMe count + HDD bay count)
      - AI CPU class (Intel ML/LL/AL or AMD Ryzen AI or
        N100-class)
      - Network (1GbE / 2.5GbE / 10GbE built-in)
      - Power draw (idle / typical AI load / max)
      - Per-vendor BIOS quirks (per B-0770 BIOS handler library)
- [ ] AI NAS reference deployment recipe: single-node home
      lab with AI NAS as both compute + storage + cluster
      member; documents the convergence pattern
- [ ] HA AI NAS recipe: 3 identical AI NAS units; Longhorn
      replication across nodes; control-plane HA per B-0756;
      total BOM <$3000 typical
- [ ] Per-storage-class Longhorn config: greedy N-disk needs
      to handle the AI-NAS NVMe + HDD layout efficiently
      (NVMe for hot tier; HDD for cold tier; Longhorn
      auto-tiers via volume class)
- [ ] AI-NAS-specific first-boot considerations (per B-0754):
      AI NAS often has more disks than mini-PC; greedy N-disk
      should label disks per role automatically (boot disk =
      fastest NVMe; longhorn-hot = remaining NVMe; longhorn-cold
      = HDDs)
- [ ] Vendor-lockdown bypass documentation: for Synology /
      QNAP / Asustor, document the BIOS / boot-USB / vendor-OS
      bypass procedure required to install Zeta substrate
- [ ] Data-gravity-aware scheduler hint (composes with B-0767
      sub-wave C model-locality): AI NAS nodes have local
      data; scheduler prefers them for workloads accessing
      data already on disk

## What changes when AI NAS lands as a first-class cluster node class

Substrate-honest delta:

- **B-0754 zero-typing**: greedy N-disk extends to handle 4-12
  disk layouts (currently tested with 2 NVMe per iter-2/3); per
  AI NAS class, the disk-count + class mix differs
- **B-0755 role taxonomy**: new role `ai-nas` that combines
  worker-storage + worker-gpu (with NPU instead of discrete
  GPU); alternatively, existing `worker-gpu` + `worker-storage`
  roles compose into the AI NAS chassis
- **B-0758 USB-persistent OS**: more relevant for AI NAS due
  to vendor OS lockdown patterns
- **B-0763 vendor-swap**: AI NAS hardware vendors compete on
  shipping Zeta-friendly defaults; differentiation lever
- **B-0767 Zeta-native scheduler**: data-gravity-aware
  scheduling becomes load-bearing because AI NAS nodes
  have data + compute co-located
- **B-0772 fabric**: storage observability + AI inference
  observability all flow as Observables from same chassis
- **B-0775 scale**: AI NAS class fits in tier 50-500 nodes
  comfortably; many small AI NAS units > few big servers
  for many home-lab + SMB workloads
- **B-0776 plugin sequence**: `Zeta.Storage.BlobStore` per
  rank 1 (revised; per per-vendor support gradient) maps to
  AI NAS local storage as one backend option

## Hardware vendor partnership opportunity (B-0768 Itron-mode)

Per B-0768 Itron-mode standards co-creation: AI NAS market is
fragmenting fast (2024-2025 boom); no incumbent has clear
position; Zeta has opportunity to:

- Define **"AI NAS cluster reference"** specification
  (storage layout + NPU integration + Zeta-substrate compat)
  that vendors can certify against
- Partner with leading AI NAS vendors (UGREEN, QNAP, TerraMaster,
  ZimaBoard) on default-shipping-with-Zeta-substrate
  configurations
- Co-define the **storage-locality + AI-inference-locality**
  scheduler hints (per B-0767 sub-wave C) as
  industry-recognized cluster-substrate primitives

This is exactly the B-0768 Itron-mode pattern: AI NAS is
GREENFIELD; Zeta substrate has a viable position; vendors
benefit from sharing the standards; operators benefit from
substrate-honest competition.

## Composes with

- B-0754 — zero-typing first-boot (extends to AI NAS disk
  layouts)
- B-0755 — role taxonomy expansion (new `ai-nas` role OR
  composition of worker-storage + worker-gpu)
- B-0758 — USB-persistent OS (bypass vendor-OS lockdown)
- B-0759 — first-time-CLI-user persona (AI NAS is one
  hardware class this persona may pick)
- B-0760 — USB-as-repair-tool (replaceable AI NAS units;
  rebuild via USB stays universal)
- B-0763 — operator-in-the-negotiation-high-seat (per-vendor
  AI NAS support gradient is operator's competitive lever)
- B-0767 — Zeta-native scheduler (data-gravity-aware
  scheduling becomes load-bearing for AI NAS class)
- B-0768 — Itron-mode standards co-creation (AI NAS is
  greenfield; Zeta has standards-leadership opportunity)
- B-0771 — audio+NPU+ONNX (same shared-memory substrate
  used by AI NAS class)
- B-0772 — observable+controllable cluster fabric (storage
  + inference observability co-located on AI NAS chassis)
- B-0773 — digital twin (twin events + storage co-located)
- B-0775 — HA-that-scales (AI NAS class fits tier 50-500
  nodes; many small > few big)
- B-0776 — simplest-first plugin sequence
  (`Zeta.Storage.BlobStore` substrate maps to AI NAS local
  storage as a backend option)
- B-0778 — curated commodity hardware (this row extends with
  AI NAS class alongside mini-PC class)

## Out of scope

- Specific vendor partnerships (UGREEN / QNAP / Synology /
  TerraMaster / Asustor / ZimaBoard) — separate per-vendor
  engagement scope when Zeta adoption justifies (B-0768
  Itron-mode pursuit)
- Vendor-OS-specific bypass procedures (Synology DSM /
  QNAP QTS recovery procedures) — per-vendor sub-rows when
  operators show up with specific AI NAS hardware
- Training-workload optimization for AI NAS chassis —
  AI NAS is inference-optimized; training-heavy stays
  discrete (mini-PC + eGPU per B-0778); separate row if AI
  NAS hardware evolves to support training workloads
- All-NVMe-only NAS chassis (Asustor Flashstor; CWWK all-NVMe
  variants) — slightly different storage-class composition;
  handled as substrate gradient within this row's scope

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, sharpening B-0778: 'also
we are composing with many ai nas systems to where nas and cpu
are tightly integrated with shared memoory ai cpus over nas.'

AI NAS is a distinct hardware category from B-0778's mini-PC
class — devices where storage + compute fuse on one chassis,
with shared-memory NPU+iGPU+CPU running inference against
locally-attached NVMe/HDD. Eliminates a tier in cluster
architecture; data-gravity wins; cheaper BOM; simpler topology.

Pairs with B-0778 as the second-class hardware substrate for
Zeta cluster: B-0778 mini-PC class (compute-dominant) +
B-0779 AI NAS class (compute + storage convergence) cover the
two main consumer-affordable cluster-node form factors.
