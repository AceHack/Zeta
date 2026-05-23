---
id: B-0590
priority: P2
status: open
title: "20-machine Otto fleet replication with bare-metal OS install — KVM-driven provisioning + Beelink-class mini-PC hardware preference"
tier: factory-infrastructure
effort: XL
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0570, B-0571, B-0580, B-0582, B-0583]
tags: [fleet, replication, bare-metal, kvm, hardware, infrastructure, otto-multi-machine, mini-pc, oculink, ai-cpu]
type: feature
---

# 20-machine Otto fleet replication + bare-metal OS install

## Origin

Aaron 2026-05-16, after the SshdPinAuthLsa-blocked ServiceTitan replication attempt + the pivot toward owned hardware:

> *"backlog i have 20 machine i need you to spread to all of them and also install the os if you can everyting i have 20 comet pro kvms too seems like we can get it worked out do soe research i can buy other kvms too but my hardward preference is minipcs with ai cpus and occulik, pci, or better ports for gpu like beelink and others have better oculink ports too more bandwith stuff, this is what i have and like to buy"*

Four dimensions of work:

1. **Fleet replication at scale**: Otto needs to be installed on 20 machines. The current `replicate` + `make-persistent` skills cover per-machine setup; fleet scale needs orchestration on top.
2. **Bare-metal OS install**: ideally Otto can drive the OS install itself (not just clone a repo onto an existing OS). Different problem class — requires PXE/network-boot or virtual-media mount.
3. **KVM evaluation**: Aaron has 20 Comet Pro KVMs and is open to buying alternatives. KVM (keyboard/video/mouse) with virtual-media support is the bridge between Otto (running on a control machine) and bare metal.
4. **Hardware preference**: Beelink-class mini-PCs with AI CPUs (NPUs for ML inference) + OCuLink ports (high-bandwidth external PCIe for GPU enclosures) + PCI for GPU expansion. Aaron's stated brand preference: Beelink; open to others with "better oculink ports more bandwidth."

## Preliminary research — preliminary not exhaustive

### KVM capabilities (Comet Pro + alternatives)

**Comet Pro KVMs** — likely the [PiKVM Comet-series](https://docs.pikvm.org/) or similar network-KVM appliance. Common features in this class:

- HDMI/VGA capture + USB HID emulation (acts as virtual keyboard/mouse)
- Virtual media mount: present an ISO to the target's BIOS as if it were a USB-mounted boot device
- Network-accessible web UI for remote console
- Some support BIOS-level access (boot menu, firmware flashing)
- API for automation (REST, sometimes scriptable)

**Alternatives worth evaluating** (open marketplace, Aaron-can-buy):

- **PiKVM v4 Plus** — open-source / Raspberry-Pi-based; full API; ATX power control; OCuLink not relevant for KVM itself
- **JetKVM** — newer, ~$69, web UI, well-reviewed for hobbyist + small-fleet use
- **Tinypilot** — also Pi-based; simpler than PiKVM; commercial product with support
- **NanoKVM** — sipeed, cheap; less mature than PiKVM
- **Lantronix Spider** — enterprise KVM-over-IP; expensive but rock-solid

The bare-metal OS install path via KVM: virtual-media mount the OS ISO → boot target into ISO installer → automate installer responses via virtual keyboard/mouse → OS lands → handoff to standard `replicate` + `make-persistent` flow.

Better path for bare-metal: **PXE boot from a control machine** running DHCP + TFTP + HTTP server. The KVMs become BIOS-access-only (for changing boot order to network), and PXE handles the actual install. More setup but fully automated once the PXE infrastructure exists.

### Hardware preference (Beelink-class mini-PCs with AI CPUs + OCuLink)

**Beelink models worth considering** (as of late 2025 / early 2026):

- **Beelink SER series** — AMD Ryzen-based; SER8 has Ryzen 7 8845HS with XDNA NPU (16 TOPS AI); ~$600-700; OCuLink absent on most SER models
- **Beelink GTR series** — higher-end; GTR7 has Ryzen 9 7940HS; ~$800-900; OCuLink on some variants
- **Beelink GTi series** — newer; GTi13 has Intel Core Ultra (Series 1 NPU); OCuLink-equipped on GTi14 Ultra variants

**Competitors with stronger OCuLink positioning**:

- **Minisforum** — Aggressive OCuLink adoption; MS-01 (Intel) and MS-A1 (AMD) have OCuLink + PCIe; ~$700-1000
- **GMKtec** — NucBox K8 (Ryzen 7 8845HS, OCuLink, ~$750)
- **ASUS NUC** — NUC 14 Pro (Intel Core Ultra); enterprise-grade but pricier
- **Framework Desktop** — recently announced Strix Halo (AMD Ryzen AI Max), 16-core, 128GB unified memory, OCuLink (announced; shipping early 2026); for high-end AI workloads

**AI CPU comparison** (NPUs for local ML inference):

| CPU family | NPU performance | Use case |
|---|---|---|
| AMD Ryzen AI 300 (XDNA 2) | 50 TOPS NPU | Aggressive AI inference; mid-range |
| Intel Core Ultra Series 2 (Arrow Lake-H) | 13 TOPS NPU + GPU | Workstation-class; moderate AI |
| AMD Strix Halo (Ryzen AI Max+) | 50+ TOPS NPU + Radeon 8060S iGPU | High-end AI workstation in mini-PC form factor |
| Qualcomm Snapdragon X Elite | 45 TOPS NPU (Hexagon) | ARM-based; Windows-on-ARM ecosystem; not x86 |

For Zeta's workloads (mostly cross-machine substrate + agent inference), CPU + NPU matters more than discrete GPU. OCuLink for GPU expansion is for the rare workloads needing dedicated GPU (e.g., heavier ML training on the edge).

### Bare-metal OS install paths

| Path | How it works | Effort | Scale-friendliness |
|---|---|---|---|
| **PXE boot + DHCP/TFTP/HTTP** | Control machine serves boot images; targets boot from network; auto-install via preseed/kickstart | High setup; near-zero per-machine | 20 machines: ideal |
| **KVM virtual-media + automated installer keystrokes** | Mount ISO via KVM; drive installer via virtual keyboard | Medium setup per-KVM; medium per-machine | 20 machines: tedious |
| **USB stick + manual boot** | Physically insert USB; boot; install | Low per-stick; high per-machine | 20 machines: doesn't scale |
| **Cloud-init / Ignition (after first boot)** | Pre-configure post-install; combine with PXE or pre-imaged disks | Medium initial; near-zero per-machine | 20 machines: ideal if combined with PXE |
| **Disk imaging (clonezilla / dd)** | Image one master disk; clone to others; per-machine identity post-clone | Medium setup; medium per-machine | 20 machines: viable; per-machine identity is the gotcha |

**Recommended approach for 20-machine Otto fleet**: PXE + cloud-init combination. Spin up a small control box (could be one of the Beelinks) running:

- DHCP server (`isc-dhcp-server` or `dnsmasq`)
- TFTP server for initial boot images
- HTTP server for installer + cloud-init configs
- A simple "fleet manager" script that holds per-machine cloud-init configs (so each machine gets a unique hostname / Otto-instance-id)

Then each new machine: rack it, plug in network + power, change BIOS to PXE-boot-first (via KVM if no physical access), turn on, wait. OS installs + cloud-init runs + Otto auto-installs via cloud-init.

### Choice of OS

Linux is the simple path (no SshdPinAuthLsa equivalent; standard SSH + systemd). Options:

- **NixOS** — declarative; one config file describes the whole machine; reproducible builds; matches the "substrate is the spec" pattern in Zeta
- **Talos Linux** — minimal Kubernetes-only OS; if the fleet is k8s-managed
- **Debian / Ubuntu Server** — most documentation; standard tooling; pragmatic
- **Proxmox** — virtualization at the host; each machine runs many VMs; Otto-per-VM

For 20-machine Otto fleet specifically: **NixOS** likely wins — declarative config means one file describes all 20 machines' state; fleet-wide changes are one Git commit + `nixos-rebuild --target-host`; substrate-honest with Zeta's overall design philosophy. Debian/Ubuntu is the safe fallback.

## Acceptance criteria

- [ ] **KVM choice documented**: Comet Pro Kept OR replaced; reasoning recorded
- [ ] **Hardware purchasing list documented**: which Beelink/Minisforum/etc. models with AI CPU + OCuLink (if buying new); rationale per model
- [ ] **Bare-metal install pipeline**: working PXE + cloud-init (or equivalent) that auto-installs OS + Otto onto a fresh machine with zero manual touches after rack
- [ ] **20-machine fleet deployed**: each machine running Otto, registered to bus, identifiable by hostname + machine-id
- [ ] **Fleet-management substrate**: `tools/fleet/` directory with scripts for: list machines, push config to all, restart one, observe health
- [ ] **Documentation**: `docs/governance/FLEET.md` (or similar) with rack diagram, network setup, OS choice rationale, replication procedure

## Why now

- Multiple machines = multiple Otto instances = real factory scale (currently single-machine Otto-CLI + peer Otto background worker + Lior on same box)
- ServiceTitan SshdPinAuthLsa block demonstrated that corporate-managed hardware isn't a viable fleet target; Aaron's owned hardware (mini-PCs) is the right substrate
- Cross-machine bus (B-0583) becomes operationally important at fleet scale
- GitHub App auth (B-0571) is the right credential pattern for fleet (per-machine PATs don't scale)

## Decomposition into implementation slices

| Slice | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1 | KVM capability survey: test Comet Pro virtual-media mount + automation API; document features | S | open |
| 2 | Hardware purchasing list: 2-3 specific mini-PC models with reasoning + URLs + price | S | open |
| 3 | Control box setup: small Beelink running PXE + DHCP + HTTP for installer serving | M | open |
| 4 | OS choice decision: NixOS vs Debian/Ubuntu vs Talos; rationale documented | S | open |
| 5 | Bare-metal install automation: cloud-init / preseed / nixos-anywhere config that installs OS + Otto in one pass | M-L | open |
| 6 | Per-machine identity provisioning: each machine gets unique hostname + Otto-instance-id; cloud-init handles | S | open |
| 7 | Pilot deployment: 1 machine end-to-end (rack → power → fully-deployed-Otto) | M | open |
| 8 | Fleet scale-out: deploy to remaining 19 machines using the pipeline from slice 7 | S (if pipeline works) | open |
| 9 | Fleet management tooling: `tools/fleet/` scripts for list/push-config/restart/observe | M | open |
| 10 | Documentation: `docs/governance/FLEET.md` with full operational guide | S | open |

Total: XL overall; iterative — slice 7 (pilot) is the gate to slice 8 (scale).

## Composes with

- B-0570 (scarcity tracker — 20 Ottos × API calls = 20× the GraphQL pressure; tracker MUST be cross-machine; B-0583 is the substrate-location row for this)
- B-0571 (GitHub App for factory automation — per-machine PATs don't scale; App is the right pattern for 20-machine fleet)
- B-0580 (Enterprise ruleset management — fleet-wide governance via ruleset; per-machine deviation is risk)
- B-0582 (substrate-level destructive-verb refusal gate — even more important at fleet scale; 20 machines = 20 potential blast radii)
- B-0583 (cross-machine account-scoped scarcity bus — the bus IS what 20 fleet members coordinate over)
- `.claude/skills/replicate/SKILL.md` (per-machine replication primitive; fleet orchestration sits above)
- `.claude/skills/make-persistent/SKILL.md` (service registration; cloud-init drives this at scale)

## Substrate-honest caveats

- This is XL effort; not a tonight item; not even a this-week item — multi-month design + execution
- KVM virtual-media path is workable but slow; PXE is the right long-term answer
- Beelink / Minisforum / GMKtec hardware preferences change quarterly as new SKUs ship; the row's specific recommendations will age
- AI CPU TOPS numbers are vendor-reported; real-world inference performance varies; benchmark before fleet purchase
- 20-machine fleet is also a real ops surface — uptime monitoring, failure handling, hardware-failure-procedure — slice 9 partially addresses but full ops setup is its own area
- Aaron's preference framing ("oculink, pci, or better ports for gpu like beelink and others have better oculink ports too more bandwith stuff") — interpret as "prioritize hardware with future GPU-expansion headroom even if not used immediately"; matches the "infrastructure-grade design affordable" framing from morning funding-context

## Open questions

1. **OS choice**: NixOS for declarative-fleet OR Debian/Ubuntu for pragmatism OR Proxmox for VM-per-Otto? Trade-off table in row body; needs Aaron's call
2. **Control box hardware**: does Aaron want to dedicate one of the 20 to be the control/PXE server? Or buy a separate?
3. **Network topology**: 20 machines on one switch + one router? Or distributed across locations? Affects PXE setup
4. **Public IPs / VPN**: do these machines need to be internet-reachable, or is internal-only fine? Affects auth + bus design
5. **Pilot machine choice**: which of the 20 to pilot first — likely whichever is most accessible / least production-critical
6. **AI workload split**: which Otto instances run which workloads? All identical, or specialization (e.g., one running heavy inference, others doing CI / orchestration)?
7. **Backup machine**: should one of the 20 be designated as the AceHack-style backup mirror (per the mirror-sync pattern + Kestrel's pull-side mirror discipline)?

## Pre-start checklist

- [x] Prior-art search: replicate + make-persistent skills exist; this row sits above them at fleet-orchestration layer
- [x] Hardware research: preliminary done (Beelink / Minisforum / GMKtec / AMD Ryzen AI / Intel Core Ultra)
- [x] KVM research: preliminary done (PiKVM / Comet / JetKVM / Tinypilot landscape sketched)
- [x] Empirical motivation: ServiceTitan-hardware-blocked replication today showed owned-hardware is the right substrate
- [x] Composes-with chain identified across the day's other rows (B-0570/0571/0580/0581/0582/0583)
- [ ] Decision: KVM choice (Aaron call)
- [ ] Decision: OS choice (Aaron call OR experiment)
- [ ] Decision: hardware purchasing (Aaron call; budget bracket from funding context)
