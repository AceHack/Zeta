---
id: 081KSE6WT0008QG0R0022D6GN8
priority: P2
status: open
title: Audio codecs working (DAW-ready) + Intel NPU/VPU exposed as cluster compute resource — beyond cosmetic firmware fix
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KSE6WT0008QG0R003612WGJ
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0009YYNP4
  - 081KSE6WT0008QG0R0016CEE2Z
tags: [cluster, audio, daw, npu, vpu, intel, openvino, ai-workload, pipewire, alsa, jack]
---

## Problem

Aaron 2026-05-25 mid-iter-3-prep, extending the audio-firmware
cleanup scope: *"i'd like the sound codecs workikng and npus for
use like by daw and others."*

081KSGS9H0008QG0R002T3BJ2R iter-3 PR (#5057) bundles `hardware.enableRedistributableFirmware = true`
into the installer ISO, which silences the Intel SoF `ASoC: failed
to instantiate card -2` boot-time warning by giving the firmware
probe what it needs. But that's only the FIRMWARE LAYER. To
actually use audio (DAW workloads) + NPU (AI inference workloads)
on Zeta cluster nodes, more substrate is needed:

| Layer | What iter-3 fixes | What this row adds |
|---|---|---|
| Kernel | Firmware blobs reachable; SoF + intel_vpu can probe cleanly | Confirm intel_vpu module loaded; expose `/dev/accel/accel0` for NPU |
| Audio stack | (nothing) | ALSA configured; PipeWire (default modern stack) or PulseAudio; JACK for DAW-class real-time audio; per-role config |
| NPU userspace | (nothing) | intel-npu-driver userspace package; OpenVINO 2024.0+ runtime; per-workload library access |
| Container access | (nothing) | k8s device plugin for NPU (similar to nvidia-device-plugin); makes `intel.com/npu: 1` requestable in Pod specs |
| Per-role substrate | (nothing) | New host config variants: `workstation` (audio + NPU + GPU + GUI); existing roles get NPU-only by default if NPU hardware present |
| Operator UX | (nothing) | Documented: "use Zeta cluster node as a DAW workstation"; "schedule AI inference on NPU instead of GPU when latency-acceptable" |

## Target

Three coherent capability deliveries:

### Capability 1: Audio works end-to-end on cluster nodes (DAW-ready)

Operator can use a Zeta cluster node as a workstation that runs a
DAW (Ableton, Reaper, Ardour, Bitwig, Logic-via-CrossOver) with
real-time audio. Built-in audio output (HDMI / analog / SPDIF /
USB) + microphone input + low-latency PipeWire/JACK substrate.

### Capability 2: NPU exposed as a first-class cluster compute resource

Operator can deploy AI workloads (inference primarily; some
training where NPU substrate supports) that request NPU compute
via standard k8s resource-requests (`intel.com/npu: 1` or similar
per device plugin convention). Workloads use OpenVINO 2024.0+
runtime to access NPU. Scheduler (081KSE6WT0008QG0R0016CEE2Z) is NPU-aware for
multi-NPU nodes.

### Capability 3: Per-role substrate handles audio + NPU declaratively

New host role `workstation` (composes with 081KSE6WT0008QG0R003612WGJ role taxonomy)
that includes audio stack + NPU + GPU + GUI for nodes that double
as user workstations. Existing roles (`control-plane`,
`worker-gpu`, etc.) get NPU-only enabling automatically when NPU
hardware is present (lspci detection at install time).

## Acceptance

### Capability 1: Audio

- [ ] `modules/audio-stack.nix` ships PipeWire as the default
      audio server (NixOS modern recommendation; backwards-
      compatible PulseAudio + JACK protocols)
- [ ] ALSA + UCM profiles configured per detected codec
      (SoundWire codecs auto-recognized via topology files
      shipped in sof-firmware)
- [ ] Real-time audio support: `security.rtkit.enable = true`;
      audio group membership for operator user; rtprio limits
      adjusted for JACK / Pro Audio
- [ ] Optional JACK2 + jack2-dbus for DAW workloads that
      require explicit JACK (most modern DAWs work over
      PipeWire's JACK shim; explicit JACK for hardcore
      Pro Audio cases)
- [ ] Test: play a tone + record from mic on a Zeta cluster
      node; document the test recipe; per-hardware-class
      compatibility matrix
- [ ] DAW-specific recipes: documented bootstrap for Ableton
      Live (via WINE/Bottles), Reaper (native Linux), Ardour
      (native), Bitwig (native); per-DAW USB-audio-interface
      compatibility notes

### Capability 2: NPU

- [ ] `modules/intel-npu.nix` ships:
      - `boot.kernelModules = [ "intel_vpu" ];` (mainline
        kernel 6.5+ has the driver)
      - `hardware.firmware = with pkgs; [ intel-npu-driver-firmware ];`
        (Intel NPU firmware blobs)
      - User-namespace permission to `/dev/accel/accel0` via
        udev rule + group membership
- [ ] `modules/openvino.nix` ships OpenVINO 2024.0+ runtime
      with NPU plugin enabled
- [ ] k8s NPU device plugin: ships intel/intel-device-plugins-
      for-kubernetes (specifically the GPU + VPU plugins);
      registers `intel.com/npu` resource per node with NPU
- [ ] Per-pod NPU access: documented Pod spec for requesting
      `intel.com/npu: 1` + mounting OpenVINO runtime
- [ ] Test: run a simple OpenVINO inference workload
      (resnet50 image classification) on NPU vs CPU; show
      latency + power benefit
- [ ] Auto-detection: install-time `lspci | grep -i "Neural"`
      check; if NPU present, enable NPU modules in installed
      host config

### Capability 3: Per-role substrate

- [ ] New `nixos/hosts/workstation/configuration.nix` host
      config: composes modules/audio-stack.nix + modules/
      intel-npu.nix + modules/desktop-environment.nix (GNOME
      or KDE Plasma) + modules/k3s-agent.nix (so workstation
      is also a cluster member)
- [ ] flake.nix `nixosConfigurations.workstation = mkSystem
      { modules = [ ... ]; };` entry
- [ ] 081KSGS9H0008QG0R002T3BJ2R v1 role keystroke prompt extended: add 'k' for
      workstation (composes with 081KSE6WT0008QG0R003612WGJ role taxonomy
      expansion); other role options unchanged
- [ ] Existing roles (`control-plane`, `worker-gpu`) get
      NPU-only enabling at install time if NPU detected
      (audio stack OFF by default unless workstation role)
- [ ] Documented: when to pick workstation role (DAW user;
      AI engineer wanting NPU on local box; cluster member
      that's also a daily-driver)

### Capability 4: Scheduler awareness (composes with 081KSE6WT0008QG0R0016CEE2Z)

- [ ] `Zeta.K8s.Scheduler` NPU-aware plugin (per 081KSE6WT0008QG0R0016CEE2Z
      sub-wave B GPU topology + sub-wave C model locality):
      - NPU-class workloads prefer nodes with available NPU
      - Workload-class fitness: small models (sub-1B params)
        + low-latency requirements → NPU; large models → GPU
      - Latency-vs-throughput trade-off awareness

## ServiceTitan-route composition (081KSE6WT0008QG0R00063R6HB / 081KSE6WT0008QG0R000WVYAJ2)

Inference access goes through layered existing standards:

| Layer | Standard | Role |
|---|---|---|
| **Model format** | **ONNX** (Open Neural Network Exchange) | Operator-facing portability format; cross-framework (PyTorch / TF / scikit-learn / XGBoost export to ONNX); one model definition runs everywhere Zeta supports |
| **Inference runtime** | **ONNX Runtime** (Microsoft-led) | Cross-platform engine that abstracts hardware backends via Execution Providers |
| **ONNX Runtime EPs** | OpenVINO EP (Intel CPU/GPU/NPU); CUDA EP + TensorRT EP (NVIDIA); ROCm EP + MIGraphX EP (AMD); CoreML EP (Apple); DirectML EP (Windows); default CPU EP (fallback) | One ONNX model → ONNX Runtime → best-fit EP per node hardware |
| **Native vendor runtimes** | OpenVINO (Intel); TensorRT (NVIDIA); MIGraphX (AMD); Core ML (Apple) | Highest perf for vendor-specific workloads; Zeta exposes for operators who want max perf at cost of portability |
| **k8s device plugin** | intel-device-plugins-for-kubernetes; nvidia-device-plugin; amd-device-plugin | Existing CNCF/vendor standards adopted per 081KSE6WT0008QG0R0009YYNP4 |
| **PipeWire / ALSA / JACK** | Linux audio standards | Operators using vanilla audio software unchanged |

**Substrate-honest layering**: ONNX is the operator's contract;
runtime selection is Zeta's substrate decision (scheduler-driven
per 081KSE6WT0008QG0R0016CEE2Z). Operator deploys an ONNX model + resource
requirements; Zeta picks the best Execution Provider per node
hardware automatically. Operator can override with explicit
vendor-native runtime (OpenVINO IR, TensorRT engine, MIGraphX
MXR) for max perf when willing to lose portability.

### Why ONNX as operator contract (not OpenVINO or TensorRT directly)

| Choice | Portability | Perf ceiling | Operator lock-in |
|---|---|---|---|
| **ONNX → ONNX Runtime → vendor EP** | High | High (within EP capabilities) | None — model moves anywhere |
| OpenVINO IR (operator-side) | Low (Intel-only) | Highest on Intel | High (Intel-locked) |
| TensorRT engine (operator-side) | None (NVIDIA-only + per-GPU-compiled) | Highest on NVIDIA | High (NVIDIA-locked) |
| PyTorch model (operator-side) | High via torch.compile | Variable | Medium (torch ecosystem) |
| TensorFlow SavedModel (operator-side) | High | Variable | Medium (TF ecosystem) |

ONNX wins the operator-contract slot because it preserves
operator optionality (per 081KSE6WT0008QG0R000WVYAJ2 negotiation-high-seat) while
allowing Zeta to pick the best execution path per node. Operators
wanting max perf can OPT INTO vendor-native runtime; default
contract stays portable.

Per 081KSE6WT0008QG0R000WVYAJ2 vendor swap: alternative inference runtimes (MLIR-
based, TVM, IREE, ONNX MLIR), alternative NPU hardware (AMD
XDNA, Apple Neural Engine via Asahi, Hailo-8/15, etc.), and
alternative scheduler-policy backends all fit the same
`Zeta.AI.Inference` interface; operators swap via config change
without rewriting application code.

## Hardware compatibility matrix

| Hardware class | Audio | NPU | Workstation-role-suitable |
|---|---|---|---|
| Intel Meteor Lake (Core Ultra 1st gen) | SoF + SoundWire | Intel NPU (3 TOPS INT8) | Yes |
| Intel Lunar Lake (Core Ultra 200V) | SoF + SoundWire | Intel NPU 4 (48 TOPS INT8) | Yes |
| Intel Arrow Lake (Core Ultra 200S desktop) | HD Audio | Intel NPU 3 (13 TOPS) | Yes |
| AMD Ryzen AI 300 series | HD Audio | XDNA NPU (50 TOPS) | Yes (different driver substrate; out of scope v1) |
| Apple Silicon (M-series) | Apple Audio | Neural Engine | Asahi Linux scope; out of scope v1 |
| NVIDIA + dedicated GPU only | HD Audio | (none — GPU does the inference) | Yes (no NPU; GPU schedules) |

V1 scope: Intel Meteor Lake / Lunar Lake / Arrow Lake (Aaron's
hardware family). AMD XDNA + Apple Neural Engine as separate
sub-rows when those operators show up.

## Composes with

- 081KSGS9H0008QG0R002T3BJ2R — installer ISO (the iter-3 firmware fix is the
  prerequisite this row builds on)
- 081KSE6WT0008QG0R003612WGJ — role taxonomy expansion (workstation role lands here)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona (DAW operators are a
  persona variant; AI engineers running OpenVINO are another)
- 081KSE6WT0008QG0R0015ZF2G6 — open reference architecture (NPU + audio support
  becomes part of the AI-cluster reference; ARC-AGI scenarios
  can include NPU-vs-GPU latency benchmarks)
- 081KSE6WT0008QG0R000WVYAJ2 — cloud-native plugins fit Zeta interfaces
  (`Zeta.Compute.NPU` interface accommodates Intel + AMD +
  Apple + future NPU vendors)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF force multipliers (intel-device-plugins-for-
  kubernetes is the existing standard adopted)
- 081KSE6WT0008QG0R0016CEE2Z — Zeta-native scheduler (NPU-awareness in scheduler
  sub-wave B/C)

## Why not just use kube-scheduler's default device-plugin support?

Default kube-scheduler treats device plugins as opaque
countable resources. For NPU specifically, you want:

- NPU-vs-GPU placement based on workload class (small +
  latency-sensitive → NPU; large → GPU)
- Model locality (NPUs have on-chip cache; warm models stay
  put)
- Power-cost tier (NPU is ~10x more power-efficient than GPU
  for small models; cluster-level power optimization wants
  to prefer NPU when possible)
- Multi-NPU topology awareness (some boards have multiple
  NPUs; Zeta scheduler can co-locate multi-NPU workloads)

This is exactly the value 081KSE6WT0008QG0R0016CEE2Z Zeta-native scheduler adds.
NPU awareness is one of its first concrete sub-wave-B/C
plugins.

## Out of scope

- AMD XDNA NPU support — separate row when an operator
  shows up with that hardware
- Apple Neural Engine via Asahi Linux — separate row; Asahi
  Linux substrate is its own track
- Audio-over-network (Dante / AVB / AES67) for studio-grade
  multi-machine audio — separate scope; pro-audio-cluster row
- VST / AU plugin substrate (running Windows VSTs via WINE,
  Mac AU plugins via emulation) — separate per-DAW scope
- Sample library distribution + asset management for DAWs —
  separate scope
- Headphone-spatial-audio / Dolby Atmos / HRTF processing —
  separate scope

## Origin

Aaron 2026-05-25 mid-iter-3-prep, extending the cosmetic
firmware fix to the broader scope: cluster nodes should
support DAW workloads (audio working) + NPU compute (for AI
inference) — not just be silent-cluster-workers. This makes
Zeta cluster substrate suitable for AI engineers + creative
professionals using their cluster nodes as workstations too,
which composes naturally with the AI-cluster-substrate value
prop the reference architecture (081KSE6WT0008QG0R0015ZF2G6) demonstrates.
