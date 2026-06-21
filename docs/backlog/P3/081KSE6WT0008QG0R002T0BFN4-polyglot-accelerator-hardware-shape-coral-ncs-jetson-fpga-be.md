---
id: 081KSE6WT0008QG0R002T0BFN4
priority: P3
status: open
title: "Polyglot-accelerator hardware-shape extension — Coral / NCS / Jetson / FPGA beyond NVIDIA-only; activates as gadgets come out of drawer"
created: 2026-05-25
last_updated: 2026-05-25
classification: research-then-buildable
decomposition: needs-design-pass-per-vendor
type: hardware-substrate
discovered_by: aaron
owners: [aaron, maintainer]
composes_with:
  - full-ai-cluster/nixos/modules/gpu-device-plugin.nix
  - full-ai-cluster/nixos/modules/disko-shapes/2nvme.nix
  - full-ai-cluster/k8s/applications/node-feature-discovery/
  - full-ai-cluster/tools/cluster-inventory/
---

# 081KSE6WT0008QG0R002T0BFN4 — Polyglot-accelerator hardware-shape extension (Coral / NCS / Jetson / FPGA beyond NVIDIA-only)

## Carved blade

> The substrate already extends cleanly. NFD catches per-device PCI vendor IDs automatically; gpu-device-plugin takes a `vendors = [...]` list; disko-shapes follow a template per hardware class. Filing this row so when the Coral / Neural Compute Stick / Jetson / FPGA gadgets come out of the drawer, it's PR-by-PR additions to known modules — not a fresh design exercise.

## Origin

Aaron 2026-05-25, on the maintainer hardware inventory:

> *"i own all these just not in first wave an many gadgets and fpga and such"*

Plus the Alexa-Amazon-data-loop observation: Alexa-website (Amazon) knows the shopping history and surfaced the accelerator inventory back to Aaron in conversation. That's the actual hardware list — Coral TPU, Intel Neural Compute Stick (Movidius MyriadX), NVIDIA Jetson modules, Xilinx/AMD + Intel/Altera FPGAs, plus *"many gadgets."* First-wave cluster build uses NVIDIA GPUs in the worker boxes; everything else activates over time as physical-deployment decisions surface.

## What's already in place

Today's shipped substrate (no work needed; just leveraged):

| Substrate | Path | What it gives us for polyglot |
|-----------|------|-------------------------------|
| GPU device plugin module | `full-ai-cluster/nixos/modules/gpu-device-plugin.nix` | Takes `zeta.gpu-device-plugin.vendors = ["nvidia"]` today; extending to `["nvidia","amd","intel","google-coral","intel-myriad","xilinx-fpga","intel-fpga"]` is appending to the list + adding a per-vendor DaemonSet block |
| NFD per-device PCI labels | `full-ai-cluster/k8s/applications/node-feature-discovery/Application.yaml` | Auto-labels `feature.node.kubernetes.io/pci-<vendor>.present=true` for every PCI device class enabled in the chart values — Coral PCIe (1ac1), Jetson PCIe-edge, Xilinx FPGAs (10ee), all caught automatically. USB-attached accelerators (Coral USB, NCS USB) need NFD's `usb` source-plugin labels instead (different scheduling path; see notes below) |
| disko-shape template | `full-ai-cluster/nixos/modules/disko-shapes/2nvme.nix` | Per-hardware-class shapes follow the same options pattern; future siblings `2nvme-with-coral-usb.nix`, `fpga-accel-node.nix`, etc. just add module options + partitions for their devices |
| cluster-inventory capture | `full-ai-cluster/tools/cluster-inventory/capture.sh` | Already pulls NFD labels + lstopo XML per node; will surface the per-accelerator devices in the inventory once present |

The scheduling story is also in place **for PCIe-attached accelerators** — `nodeAffinity: feature.node.kubernetes.io/pci-10ee.present=true` targets nodes with Xilinx FPGAs; `pci-1ac1.present=true` targets nodes with Coral PCIe cards; same pattern for every PCIe vendor. **USB-attached accelerators** (Coral USB, Intel NCS / Movidius USB) need the NFD `usb` source-plugin labels instead (`feature.node.kubernetes.io/usb-<vendor>.present=true`); copying the PCI pattern for USB devices produces unschedulable pods. See the per-class extension paths below for which devices use which bus.

## Per-accelerator-class extension paths

### Google Coral TPU (USB Edge TPU + PCIe variants)

- **K8s device plugin**: https://github.com/google-coral/edgetpu-platforms (or community `coral-device-plugin` DaemonSet)
- **NixOS package**: `libedgetpu` + udev rules; in nixpkgs already
- **Disko shape**: `2nvme.nix` works as-is (USB Coral has no disk impact); for PCIe Coral cards, may want `2nvme-with-pcie-accel.nix` later
- **PCI vendor ID**: `1ac1` (Global Unichip)
- **Workload class**: edge inference, vision (MobileNet, EfficientDet); 8-bit quantized TFLite models

### Intel Neural Compute Stick (Movidius MyriadX)

- **K8s device plugin**: Intel Device Plugins Operator for Kubernetes (`intel.com/myriad`) — https://github.com/intel/intel-device-plugins-for-kubernetes
- **NixOS**: `openvino` runtime + Movidius firmware
- **Disko shape**: same as Coral USB (no disk impact)
- **PCI/USB vendor ID**: `03e7` (Intel Movidius)
- **Workload class**: OpenVINO inference; same model class as Coral but Intel-flavored

### NVIDIA Jetson (Nano / Xavier / Orin)

- **NOT a USB accelerator** — Jetsons are full ARM64 SoCs that join the cluster as nodes themselves (or as edge nodes via wireguard back to control plane)
- **K8s integration**: NVIDIA GPU Operator handles Jetson CUDA / TensorRT same as desktop GPUs (with Jetson-specific values)
- **NixOS angle**: needs an aarch64-linux installer ISO variant — extends `usb-nixos-installer/` flake to aarch64; `disko-shape-jetson.nix` for the eMMC + SD-card + NVMe topology Jetsons typically have
- **Cookie-cutter pattern**: `full-ai-cluster/nixos/hosts/worker-template/default.nix` already supports per-host overrides; an `aarch64-template/` sibling lands when first Jetson joins
- **Workload class**: edge-deployed multimodal models; CUDA + TensorRT runtime; not really USB-class workloads

### Xilinx (AMD) FPGAs

- **K8s device plugin**: AMD Xilinx FPGA Resource Manager (XRM) + `xilinx-fpga-device-plugin` (https://github.com/Xilinx/FPGA_as_a_Service)
- **NixOS**: `vitis-ai` runtime; tricky because Xilinx tooling is heavy and license-walled; may need an OCI image with the Vitis runtime mounted via initContainer instead of host install
- **Disko shape**: usually no disk impact (FPGA is PCIe); FPGA dev boards may have their own storage
- **PCI vendor ID**: `10ee` (Xilinx)
- **Workload class**: **the sleeper play.** Custom inference graphs compiled to FPGA fabric via Vitis AI; latency + power-per-cognition advantages over GPU for fixed-graph workloads. Composes with the watt-hour intelligence-cost framing — FPGA can be 5-10× more efficient than GPU for the right workload class
- **Polyglot composition**: FPGA bitstream + C++/OpenCL/Python orchestration; fits the "polyglot for the right job" framing perfectly

### Intel / Altera FPGAs

- **K8s device plugin**: Intel Device Plugins Operator includes FPGA support (`intel.com/fpga`)
- **NixOS**: OpenCL + OPAE runtime; harder than Xilinx because Intel FPGA tooling has shifted hands during the Altera→Intel→back-to-Altera renaming
- **PCI vendor ID**: `8086` for Intel FPGAs (overlaps with regular Intel devices; NFD needs device-class filter)
- **Workload class**: same as Xilinx; choice between vendors is hardware-dependent

### "Many gadgets" — long tail

Aaron's inventory likely includes things like USB GPIO controllers, RTL-SDR, software-defined-radio dongles, Bluetooth/Zigbee/Thread radios, etc. These aren't AI accelerators but DO benefit from the same NFD-labels + device-plugin pattern at K8s scope. Each gets its own backlog row when activated; the substrate pattern is the same.

## Why P3

First-wave cluster build (the boxes Aaron is installing tonight + this week) uses NVIDIA GPUs. The accelerators are a deferred-into-second-wave hardware decision. P3 because:

- The substrate work to support them is small (per-vendor module additions, not architectural redesign)
- No current workload demands them
- Becomes P2 when the first Coral / NCS / Jetson / FPGA gadget enters the cluster physically + needs scheduling
- Becomes P1 if a workload class emerges that genuinely needs heterogeneous accelerator scheduling (e.g., latency-critical vision pipeline that wants Coral edge inference)

## Composition with substrate

- **`gpu-device-plugin.nix`** — vendor list extension; one DaemonSet block per vendor; existing pattern
- **NFD** — auto-labels per-vendor; scheduling targets via nodeAffinity; existing
- **Disko shapes** — per-hardware-class shape file; existing template
- **NFD source-plugin config** — `full-ai-cluster/k8s/applications/node-feature-discovery/Application.yaml` already includes class `12` (processing accelerators — covers FPGAs registered as accelerators, Coral PCIe, etc.) and `03` (display controllers — GPUs); may need `11` (signal-processing controllers — some FPGA cards register here) when those vendors arrive. ALSO — USB-attached accelerators (Coral USB, NCS USB) are NOT caught by the PCI source-plugin; enable the NFD `usb` source-plugin (with its own `deviceClassWhitelist`) and reference USB vendor IDs in nodeAffinity instead. The scheduling-path-per-bus distinction is real
- **Watt-hour intelligence-cost** (per the Alexa-conversation insight) — FPGAs in particular can be 5-10× more efficient than GPUs for fixed-graph workloads; the W·hr-per-cognition measurement substrate when built will catch this naturally
- **hat-system** (PR #4930) — eventually a `hat-fpga-programmer` hat with elevated authority to flash FPGA bitstreams (high-blast-radius operation); same quorum-gated pattern as `policy-admin` and `hat-designer`
- **081KSE6WT0008QG0R00195RG48** (polyglot K8s operator pattern) — composes; FPGA-aware operators may want to live in Rust (kube-rs) for the perf characteristics of bitstream-orchestration

## Acceptance (when picked up per-class)

Per accelerator-class added:

- [ ] `gpu-device-plugin.nix` (or a sibling `accel-device-plugin.nix`) gets a new `vendors` enum value + a per-vendor DaemonSet block
- [ ] NFD PCI source-plugin config extended with the vendor's device class if missing
- [ ] Optional: new disko-shape sibling for the hardware-class if disk-topology differs
- [ ] Test workload that schedules to the accelerator via `nodeAffinity` on the NFD label
- [ ] Documented in `full-ai-cluster/tools/cluster-inventory/README.md` accelerator section

## Not in scope (yet)

- **Heterogeneous workload scheduler** that picks Coral vs GPU vs FPGA per inference request based on cost/latency profile — neat substrate-engineering target, separate row when needed
- **Vitis AI / OpenVINO model compilation pipelines** — needed before FPGA actually runs inference; separate row per vendor
- **Power management coordination** with Jetson edge nodes (PoE, battery, dynamic frequency scaling) — separate row when first Jetson joins
- **Custom FPGA bitstream development** for AI workloads — that's a research direction, not a substrate row

## References

- Coral device plugin: https://github.com/google-coral/edgetpu-platforms
- Intel Device Plugins (NCS + FPGA): https://github.com/intel/intel-device-plugins-for-kubernetes
- Xilinx FPGA Resource Manager: https://github.com/Xilinx/FPGA_as_a_Service
- NVIDIA Jetson + K8s: https://docs.nvidia.com/datacenter/cloud-native/jetson/latest/
- NFD PCI source plugin reference: https://kubernetes-sigs.github.io/node-feature-discovery/master/usage/feature-discovery.html#pci-source-features
- Vitis AI for FPGA inference: https://github.com/Xilinx/Vitis-AI

## Edge-vs-datacenter fit (open question — Aaron 2026-05-25)

Aaron: *"i want to push fpgas at the edge but i'm not sure k8s is the right iot shape"*. Real question; K8s fits some edge shapes well + is wrong for others. Quick map:

| Edge form factor | K8s fits? | What works |
|------------------|-----------|------------|
| Mini-PC / NUC / Jetson with full Linux | YES — K3S as edge node, K8s-native everything | K3S + Akri for leaf-device discovery |
| Raspberry Pi 4/5 with FPGA HAT | YES — K3S as edge node | Same as above |
| Bare FPGA on PCIe in a desktop host | YES — host is normal cluster node | Existing GPU device-plugin pattern |
| Bare FPGA on USB attached to a Pi-class device | MOSTLY — needs host Linux | Akri's USB device discovery handles it |
| Microcontroller + FPGA combo (MCU does boot, FPGA does inference, no Linux) | NO — K8s is overkill / wrong shape | Firmware + MQTT or Matter or Reticulum |
| Battery-constrained intermittent-network device | NO — K8s assumes continuous control-plane reachability | Reticulum mesh OR KubeEdge (designed for intermittent) |
| Solar/PoE-powered always-on sensor | DEPENDS — K8s if you can spare the watts for kubelet; firmware if not | Akri at the gateway if not running K8s on the device |

**Practical answer**: K8s + Akri + KubeEdge covers the *richer-end* of edge (Jetson, Pi, NUC, anything with full Linux + reliable enough network). For *true IoT* (microcontrollers, battery, intermittent, single-purpose), K8s is the wrong shape and a Reticulum-based mesh substrate is closer to right — the framework already has Reticulum / AllJoyn / Green Lantern Hardware Spec substrate (081KR2E4K0008QG0R001SWEPNV + earlier rule references). The HYBRID — K8s at the gateway + Reticulum past the gateway — is likely the load-bearing answer for FPGAs-at-edge specifically.

Relevant pieces:

- **Akri** (https://docs.akri.sh/) — Microsoft's K8s extension for leaf-device discovery; treats USB / serial / OPC UA / ONVIF cameras / arbitrary protocols as schedulable resources
- **KubeEdge** (https://kubeedge.io/) — Cloud control-plane + edge nodes that survive disconnection; CNCF graduated
- **OpenYurt** (https://openyurt.io/) — similar; Alibaba's edge-K8s
- **Reticulum** (already in framework substrate; 081KR2E4K0008QG0R001SWEPNV-class) — physical-mesh for the past-the-gateway tier

**Aaron's sharpening 2026-05-25**: *"i'm thinking it will require reticiulum at the edge and in cluster"* — not the hybrid I sketched (K8s in cluster + Reticulum past gateway). The actual direction is **Reticulum throughout** — cluster nodes ALSO speak Reticulum natively, alongside K8s. K8s and Reticulum compose as layers rather than partitioning by network-tier:

- **K8s + Cilium** owns intra-cluster networking, pod-to-pod, Service mesh, NetworkPolicy
- **Reticulum** owns identity-routing + cross-substrate addressability — every cluster node has a Reticulum identity in addition to its SPIRE SVID; every edge device speaks the same mesh; routing is identity-based not address-based; physical layer is fungible (TCP / LoRa / packet-radio / serial)
- **Workloads** addressable via BOTH paths: a pod's Service is reachable inside the cluster via Cilium; that same pod's Reticulum destination is reachable from any edge device anywhere on the mesh

Architectural decision lives in a separate row (filing as 081KSE6WT0008QG0R003C9KGQE — Reticulum throughout cluster + edge as composing substrate alongside K8s). This row stays focused on accelerator-class device-plugin extensions — the Reticulum-throughout decision is a bigger substrate change that affects EVERY workload, not just accelerators.

## Substrate-honest framing

The hardware inventory exists already in Aaron's drawer. The cluster substrate is ready to receive it. This row exists so that when physical deployment happens, the team isn't doing fresh architecture — they're following the established device-plugin + NFD-label + disko-shape pattern with per-vendor specifics filled in.

The edge-architecture question above doesn't block first FPGA deployments (those'll land in the data center on PCIe + use the K8s-native path); it surfaces when push-FPGAs-to-edge actually happens.
