---
id: 081KSE6WT0008QG0R0029S1D5Z
priority: P2
status: open
title: GL.iNet Comet Pro IP-KVM integration — remote BIOS-to-cluster-member; zero-physical-access cluster bring-up + repair
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R003WG0V6P
composes_with:
  - 081KSE6WT0008QG0R003WW3YJQ
  - 081KSE6WT0008QG0R000CV98PV
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R003FG3E8R
tags: [cluster, ip-kvm, comet-pro, gl-inet, remote, bios, headless, repair, hardware]
---

## Problem

Aaron 2026-05-25 mid-iteration-2-wait (iter-2 USB just flashed,
ready for cluster node 1 test): *"is usb stuff on main and new
iso built also with pc two we are going to add gl.net comet pro
and see if you can do complete remote setup even bios stuff."*

PC 2 (second cluster node) will have a [GL.iNet Comet Pro][comet]
IP-KVM attached. The Comet Pro provides everything needed for
**complete remote setup including BIOS**:

| Comet Pro capability | What it enables for Zeta cluster bring-up |
|---|---|
| HDMI capture (1080p60) | Agent SEES the BIOS / boot menu / OS console remotely via web UI |
| USB HID injection (keyboard + mouse) | Agent TYPES into BIOS / boot menu / OS console remotely |
| USB mass-storage emulation | Agent PRESENTS the Zeta installer ISO as a virtual USB drive — no physical USB stick required on PC 2 |
| ATX power control (with optional cable) | Agent POWERS the box on/off + reboots remotely |
| Wake-on-LAN | Power-on without ATX cable if motherboard supports WOL |
| Web UI + API | Standards-layer interface (per 081KSE6WT0008QG0R00063R6HB ServiceTitan route) — REST + WebRTC for stream + HID |
| BliKVM-derived firmware | Open-source-friendly; hackable; community substrate |
| Local network or Tailscale / Headscale (per Zeta substrate) | Operator's network OR Zeta's existing zero-trust mesh; no exposed public ports needed |

[comet]: https://www.gl-inet.com/products/gl-rm10/

Combined with Zeta's zero-typing first-boot (081KSGS9H0008QG0R002T3BJ2R), USB-as-
repair-tool (081KSE6WT0008QG0R003WG0V6P), and the cluster-install substrate cluster:

**PC 2 bring-up flow becomes**:

1. Aaron unboxes PC 2 + plugs in Comet Pro (HDMI + USB-C to PC 2
   + ethernet to network + power) — 5 minutes of physical work
2. Agent connects to Comet Pro web API
3. Agent presents Zeta installer ISO as virtual USB
4. Agent powers PC 2 on; presses BIOS key during POST; sets
   USB-virtual-disk as first boot; saves + reboots
5. Zeta first-boot service runs (the iter-2 substrate just
   flashed); cluster joins; node ready
6. Aaron's physical work for the rest of the cluster lifecycle:
   zero (until hardware failure requiring physical replacement)

**Repair-tool composition** (081KSE6WT0008QG0R003WG0V6P): when PC 2 fails, agent
mounts the same Zeta installer ISO via Comet Pro; same zero-
typing first-boot service runs; cluster identity preserved per
081KSE6WT0008QG0R003WG0V6P. Aaron doesn't have to BE at PC 2 to repair it.

## Target

Zeta substrate that wraps Comet Pro into a coherent
"remote-cluster-bring-up + repair" capability:

- **Comet Pro inventory**: per-cluster registry of which nodes
  have a Comet Pro attached + each Comet Pro's network address
  (mDNS-discovered per 081KSE6WT0008QG0R000CV98PV, OR static config)
- **Agent-facing API wrapper**: TypeScript wrapper around
  Comet Pro's REST + WebRTC (`tools/kvm/comet-pro.ts`) that
  exposes the operations Zeta needs:
  - `presentISO(deviceId, isoPath)` — mount ISO as virtual USB
  - `powerOn(deviceId)` / `powerOff(deviceId)` /
    `reboot(deviceId)` — ATX control
  - `enterBIOS(deviceId, vendorHint)` — vendor-specific
    BIOS-entry-key sequence; agent times the keypresses
    during POST
  - `setBootOrder(deviceId, primary)` — vendor-specific
    BIOS menu navigation via HID injection
  - `captureScreen(deviceId)` — screenshot for AI vision
    confirmation that we're in the right BIOS screen
  - `sendKeys(deviceId, keys)` — HID injection
  - `clickAt(deviceId, x, y)` — for graphical BIOS / OS GUIs
- **BIOS vendor handlers**: per-vendor BIOS navigation scripts
  (AMI, Phoenix, Insyde, AwardBIOS) — agent picks based on
  vendor string from screenshot OCR or board ID via dmidecode
- **Per-cluster-node BIOS config baseline**: declarative
  expected-BIOS-state per node (boot order = USB-virtual then
  NVMe; UEFI secure boot off for installer iteration; etc.)
  — agent reconciles BIOS state at install time (composes
  with 081KSE6WT0008QG0R003D199HE git-native per-machine state)
- **Reference deployment recipe**: documented step-by-step
  for adding a Comet-Pro-equipped node to a Zeta cluster;
  used as canonical zero-physical-access bring-up

## Acceptance

- [ ] `tools/kvm/comet-pro.ts` TypeScript wrapper around the
      Comet Pro REST + WebRTC APIs
- [ ] BIOS vendor handler library: at minimum AMI Aptio (most
      common); Insyde + Phoenix + Award as needed per Aaron's
      actual PC 2 hardware
- [ ] Vision confirmation: agent screenshots the BIOS screen
      after each key sequence to verify we're navigating
      correctly (Claude vision API or local AI vision per
      Zeta substrate)
- [ ] Mass-storage virtual-USB ISO presentation: agent mounts
      ~/Downloads/zeta-installer-*.iso (or CI-built artifact)
      as virtual USB on the Comet Pro
- [ ] End-to-end PC 2 bring-up demonstrated: from "Comet Pro
      plugged in, network reachable" → "cluster node joined +
      workloads scheduled" with zero physical interaction
      after the initial 5-min Comet Pro plug-in
- [ ] Repair-tool composition: PC 2 fails → agent re-runs the
      same flow → node rejoins as same identity (composes with
      081KSE6WT0008QG0R003WG0V6P)
- [ ] Auth + secrets: Comet Pro admin credentials + WebRTC
      session tokens handled via SOPS/age per existing Zeta
      secrets substrate; no plaintext in repo
- [ ] Network reach: documented patterns for Comet Pro
      accessibility from agent — local network (default),
      Tailscale (if operator uses), Headscale (if operator
      runs their own mesh), Reticulum (Zeta's mesh per
      existing substrate)
- [ ] Multi-Comet-Pro orchestration: agent can drive multiple
      Comet Pros in parallel for cluster-wide ops (e.g., add 5
      nodes simultaneously)
- [ ] Documentation: `docs/remote-cluster-bring-up.md`
      naming the Comet Pro flow as the canonical
      zero-physical-access pattern; per-vendor BIOS
      navigation notes

## ServiceTitan-route composition (081KSE6WT0008QG0R00063R6HB)

Comet Pro is **the existing IP-KVM standards interface** Zeta
plugs into — exactly per the ServiceTitan-route principle. The
substrate Zeta adds:

- AI-driven BIOS navigation (vision + per-vendor handlers)
- Integration with Zeta's cluster substrate (identity-aware
  repair per 081KSE6WT0008QG0R003WG0V6P; auto-discovery per 081KSE6WT0008QG0R000CV98PV)
- Multi-node orchestration patterns

Alternative IP-KVM devices fit the same Zeta wrapper if their
API surface matches (BliKVM, PiKVM, NanoKVM, Tinypilot,
JetKVM). Aaron picked Comet Pro; the wrapper is shaped per
081KSE6WT0008QG0R000WVYAJ2 so alternative IP-KVM vendors plug in behind the same
operator-facing interface.

## Why this is load-bearing for the cluster substrate

| Without Comet Pro integration | With Comet Pro integration |
|---|---|
| Operator must physically attend each node for first install + every BIOS-level change | Zero-physical-access for everything except the initial 5-min plug-in of Comet Pro itself |
| Repair-tool semantics (081KSE6WT0008QG0R003WG0V6P) require physical access to plug in USB | Repair fully remote via virtual-USB mount |
| 3-node HA promise (081KSE6WT0008QG0R001NG9JZH) requires Aaron to drive 3 hours to remote site if all 3 fail | Aaron can repair from anywhere with network access |
| Reference architecture (081KSE6WT0008QG0R0015ZF2G6) limited to "buyers who have physical access to all nodes" | Reference architecture works for distributed / colo / edge deployments where physical access is expensive |
| ARC-AGI benchmark scenarios (081KSE6WT0008QG0R0015ZF2G6) limited to scenarios humans can stage | Benchmark scenarios can include "5-node cluster gets rebuilt remotely from cold-iron after 3 simultaneous node failures" |

The Comet Pro substrate extends Zeta's reach from
"home-lab where Aaron walks to each node" to "distributed
infrastructure where Aaron's physical presence is the
exception, not the default." Same substrate; vastly larger
deployment surface.

## Composition with the strategic substrate cluster

- 081KSE6WT0008QG0R003WW3YJQ ("I execute, you fingerprint") — extended: now also
  "I execute, you ONCE walked to PC 2 to plug in Comet Pro"
  — physical-presence consent floor lives at Comet-Pro-
  initial-setup time; subsequent ops are agent-driven with
  the same NCI floor
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot runs unchanged inside the
  virtual-USB-mounted ISO; the Comet Pro is just a different
  delivery mechanism for the same ISO
- 081KSE6WT0008QG0R000CV98PV — cluster auto-discovery via mDNS extends to Comet
  Pros (discoverable as cluster-node-adjacent KVM devices)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona broadens: includes
  operators who manage colo / edge / remote deployments
- 081KSE6WT0008QG0R003WG0V6P — USB-as-repair-tool fully composed with remote
  delivery via Comet Pro
- 081KSE6WT0008QG0R0015ZF2G6 — open reference architecture grows: distributed-
  remote-access cluster bring-up becomes a documented
  reference scenario
- 081KSE6WT0008QG0R003FG3E8R — auto-submit-back telemetry includes Comet Pro
  driver compatibility + BIOS vendor handler accuracy
- 081KSE6WT0008QG0R000WVYAJ2 — IP-KVM device alternatives (BliKVM, PiKVM, JetKVM,
  NanoKVM, Tinypilot) plug in via the same Comet Pro wrapper
  shape per the negotiation-high-seat principle
- 081KSE6WT0008QG0R0009YYNP4 — composes with KubeVirt / Crucial Cluster API for
  bare-metal provisioning workflows that other operators
  already use

## Hardware vendor BIOS notes (per Aaron's PC 2 — fill in once known)

| Component | Vendor | Notes |
|---|---|---|
| Motherboard | TBD (Aaron to confirm) | BIOS vendor + BIOS-entry-key + UEFI secure boot policy |
| BIOS / UEFI | TBD | AMI / Phoenix / Insyde / Award |
| NVMe / SATA / HDD layout | TBD | per 081KSGS9H0008QG0R002T3BJ2R greedy N-disk + 081KSE6WT0008QG0R00021PPX1 USB-persistent-OS triage |
| GPU | TBD | per 081KSE6WT0008QG0R003612WGJ worker-gpu role |
| ATX power header pin layout | TBD | for Comet Pro power-control cable |

Once Aaron confirms PC 2 hardware, this section gets concrete.
Until then, agent uses vision + per-vendor handler library to
adapt at runtime.

## Security notes

- Comet Pro admin credentials stored via SOPS/age; rotated per
  operator policy
- WebRTC session tokens ephemeral; per-session
- Comet Pro firmware updates managed via existing Zeta substrate
  (NixOS module per 081KSGS9H0008QG0R002T3BJ2R substrate; declarative)
- Network exposure: Comet Pro should NOT have public-internet
  reachability by default; agent reach via operator's network
  OR Zeta's mesh substrate (Tailscale / Headscale / Reticulum)
- Audit trail: every agent-driven Comet Pro operation logged +
  telemetry-eligible per 081KSE6WT0008QG0R003FG3E8R opt-in
- Physical-presence consent: Comet Pro plug-in IS the physical-
  presence consent event per 081KSE6WT0008QG0R003WW3YJQ; subsequent agent ops
  operate under that consent until operator revokes (e.g.,
  unplugs Comet Pro or changes admin password)

## Out of scope

- Replacing Comet Pro firmware with Zeta-native BliKVM fork —
  separate row if ever; today's scope is integrate-as-standard
  per 081KSE6WT0008QG0R00063R6HB
- Power-distribution unit (PDU) integration for remote power
  cycling — Comet Pro ATX cable covers single-node; rack-PDU
  is separate scope
- Out-of-band management via IPMI / iLO / iDRAC — server-class
  hardware has these; Comet Pro fills the gap for
  desktop/workstation-class hardware that doesn't; both
  patterns coexist in larger deployments
- IP-KVM-vendor benchmarking + recommendations — defer until
  multiple alternatives have been substantively tested
- Multi-tenant IP-KVM sharing (one Comet Pro driving multiple
  PCs via USB switches) — Aaron's PC 2 use case is 1:1; scope
  expansion later if needed

## Origin

Aaron 2026-05-25 mid-iter-2-test prep: PC 2 is being added
with GL.iNet Comet Pro for remote BIOS-to-cluster-member setup.
The Comet Pro substrate composes with the cluster-install
cluster (081KSGS9H0008QG0R002T3BJ2R / 081KSE6WT0008QG0R003WG0V6P / 081KSE6WT0008QG0R000CV98PV) and extends Zeta's
deployment reach from physical-access-required to fully
remote. ServiceTitan-route composition (081KSE6WT0008QG0R00063R6HB) preserved:
Comet Pro is the existing standards-layer interface; Zeta
plugs in with AI-driven BIOS navigation + cluster-substrate
integration.
