---
id: 081KVM04R4T08QG0R003AZ0E6K
type: task
state: backlog
priority: P2
slug: microcontroller-rtos-support-anchor-to-net-nanoframework-cos
title: "Microcontroller + RTOS support — anchor to .NET nanoFramework + Cosmos for the Micro/unikernel"
created: 2026-06-21T02:28:50.458Z
depends_on: []
composes_with: ["081KSV2WD0008QG0R000WNY74Q"]
---

# Microcontroller + RTOS support — anchor to .NET nanoFramework + Cosmos for the Micro/unikernel

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KVM04R4T08QG0R003AZ0E6K-*.md` glob. -->

## Why this exists (Aaron, 2026-06-20)

We have **microkernel** substrate on the backlog (`081KSV2WD0008QG0R000WNY74Q` — declarative
microkernel substrate) but **nothing for microcontrollers + RTOS**. Zeta should run down to the
**microcontroller** tier (ESP32/STM32-class MCUs), and we can **learn from existing .NET-on-metal
projects** for our own Micro/unikernel rather than reinventing the metal layer.

Strategic fit: completes the substrate ladder Zeta already spans — cloud → home/business → edge → and
now **MCU** — keeping the same managed-.NET shape all the way to the silicon. Reticulum mesh + soft
scheduler + the deterministic CHIP-8 compute unit are all small enough to be meaningful targets on
constrained devices.

## Concrete hardware: a real ESP32 fleet already on hand (Aaron, 2026-06-20)

**This is not hypothetical — Aaron has *hundreds* of ESP32s** (salvaged from bitcoin-mining rigs that
were doing SHA hashing). That changes the priority and the first slice:

- **Ready-made best-effort node fleet.** 100s of ESP32s = a concrete instance of the *soft
  mutual-empowerment / volunteer-compute* network (BOINC/SETI/Folding lineage from the orientation-flow
  note) — dependable-vs-best-effort tiering with real best-effort nodes to test against, today.
- **SHA-hashing is the load-bearing capability.** These boards are purpose-built/proven for SHA work,
  which lands exactly on Zeta's hash-shaped substrate: **content-addressing** (CAS self-verifying
  cache), **Merkle proofs** (the 4-lang byte-locked inclusion proofs), **anti-Sybil entropy-cost / G3b**
  (proof-of-work-style metering), and **CHIP-8-frame content-addressing** for distributed compute. An
  ESP32 fleet is essentially a distributed hash/CAS/Merkle co-processor pool.
- **Reflashable — we control the firmware.** The boards can be **overwritten** (not vendor-locked);
  Aaron is sourcing the **current open-source miner firmware** as the flashing reference / starting
  point. So deploying .NET nanoFramework (or a Zeta-shaped payload) onto the fleet is viable, and the
  existing OSS SHA-miner code is a concrete reference for the ESP32 toolchain + the SHA datapath we'd
  reuse.
- **Implication for the first slice:** target this fleet directly. Smallest viable: an ESP32 node that
  (a) content-addresses + verifies CAS blocks (its native SHA strength), or (b) runs the deterministic
  CHIP-8 compute unit and agrees-by-hash with peers (redundancy-with-agreement = free, since
  deterministic). Reticulum mesh ties them in. (Drop the OSS miner-firmware repo link here once Aaron
  surfaces it — the flashing/toolchain reference.)

## Anchors (Beacon — learn from these)

- **.NET nanoFramework** — <https://github.com/nanoframework> — runs C#/.NET on microcontrollers
  (ESP32, STM32, NXP, TI, etc.): a small managed runtime + CLR on bare metal / over an RTOS. The
  primary anchor: it already solves "managed .NET on an MCU," which is exactly the tier we lack.
- **Cosmos** — <https://github.com/CosmosOS/Cosmos> — the C# Open Source **Managed Operating System**
  toolkit (the ".NET microkernel" referenced): IL → native, ring-0 managed kernel. Anchor for the
  **Micro/unikernel** side (kernel-from-managed-code), distinct from nanoFramework's MCU-runtime side.
- **RTOS layer** — nanoFramework typically sits on FreeRTOS/Azure-RTOS (ThreadX)-class schedulers;
  study how the managed runtime cooperates with the RTOS scheduler — directly informs our soft
  `IScheduler` / ferry-throttle at DoP=1 on constrained hardware.

## Atomic scope (research-first, then a slice)

1. **Survey + extract** (research deliverable): what nanoFramework + Cosmos do for (a) managed runtime
   on MCU, (b) RTOS cooperation, (c) IL→metal — and what maps to Zeta's microkernel item
   (`081KSV2WD0008QG0R000WNY74Q`) vs what's genuinely new for the MCU/RTOS tier.
2. **Decide the boundary**: nanoFramework-on-RTOS (run our managed payload on their runtime) vs
   Cosmos-style managed-kernel (our own) vs a thin Zeta-shaped layer over an RTOS. Honest tradeoff doc.
3. **First slice** (out of this item; size after the survey): the smallest Zeta primitive that runs on
   an MCU target — candidate: the deterministic CHIP-8 compute unit (already minimal + content-
   addressed) or the soft scheduler at DoP=1, on an ESP32-class board.

## Composition

- `composes_with` `081KSV2WD0008QG0R000WNY74Q` (declarative microkernel substrate — the unikernel side;
  this item is the **MCU + RTOS** complement, not a duplicate).
- Relates to the substrate-tiering / hardware-shape items (federated cluster topology, polyglot
  accelerator hardware) — MCU is the smallest tier of that ladder.

## Honest scope note

This is **research-first** (survey + boundary decision). Running managed .NET on an MCU is a real
undertaking; the deliverable here is the extraction + the boundary call + a sized first slice — not a
commitment to ship an MCU runtime in one go.
