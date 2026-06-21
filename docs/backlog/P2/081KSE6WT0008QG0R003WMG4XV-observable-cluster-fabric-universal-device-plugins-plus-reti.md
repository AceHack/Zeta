---
id: 081KSE6WT0008QG0R003WMG4XV
priority: P2
status: open
title: Observable cluster fabric — universal device plugins (NPU/GPU/audio/etc.) + Reticulum mesh (AllJoyn-successor) + polyglot Rx streams in every language
effort: XL
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KR2E4K0008QG0R001SWEPNV
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R0009YYNP4
  - 081KSE6WT0008QG0R00063R6HB
  - 081KSE6WT0008QG0R00049EFBD
  - 081KSE6WT0008QG0R0016CEE2Z
  - 081KSE6WT0008QG0R0029S1D5Z
  - 081KSE6WT0008QG0R0022D6GN8
tags: [cluster, device-plugin, reticulum, alljoyn, rx, reactive, observability, mesh, polyglot, ai-fabric]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, composing three Zeta
substrate threads: *"rmember eventually we want to use the
device plusings over npu gpu audio etc... and reticulum like
alljoyn making everything iobervable in rx in every language."*

Three threads already on individual rows; this row names their
COMPOSITION as a coherent target:

| Thread | Existing substrate | This row's composition role |
|---|---|---|
| Universal device plugins | 081KSE6WT0008QG0R0022D6GN8 (Intel NPU); 081KSE6WT0008QG0R0029S1D5Z (Comet Pro IP-KVM); 081KSE6WT0008QG0R0009YYNP4 (CNCF force multipliers); existing nvidia/amd device plugins | Generalize the k8s device-plugin pattern to EVERY hardware-class resource: NPU, GPU, audio I/O, NIC offload, NVMe namespaces, USB-passthrough, FPGAs, TPUs, sensors, etc. — all exposed via same standard interface |
| Reticulum mesh (AllJoyn-successor) | 081KR2E4K0008QG0R001SWEPNV (Green Lantern hardware spec — Reticulum substrate); existing Reticulum / pt174 / pt196 substrate in cross-AI conversation memory | Cryptographic mesh networking for cluster nodes to discover + RPC each other's services + device-plugin-exported hardware without central registry; same shape AllJoyn was meant to deliver for IoT but Reticulum (modern + crypto-native + radio-agnostic) actually delivers |
| Polyglot Rx observability | F# + Rx.NET shipped in Zeta.Core; algebra-owner skill (DBSP↔Rx duality); rx-expert skill; existing Reaqtor / standing-queries substrate | Every device event, workload signal, audio sample, NPU inference, scheduler decision, telemetry envelope flows as Rx-observable stream; same algebraic model in F# / C# / Rust (rxrust) / TS (RxJS) / Python (RxPY) / Java (RxJava) / Swift / Kotlin / etc. |

## Target

**Observable cluster fabric**: every Zeta cluster operator can
subscribe to any hardware/software signal from any node as an
Rx Observable. Reticulum mesh handles discovery + transport.
Device plugins are the entry points. Algebra (DBSP retraction-
native) is the composition layer. Polyglot SDK in every major
language.

Operator code (e.g., F#):
```fsharp
let gpuPower : IObservable<DevicePowerReading> =
  cluster.Devices.Observable<DevicePowerReading>(
    nodeSelector = "zeta.io/role in (worker-gpu, control-plane-gpu)",
    deviceClass  = "nvidia.com/gpu",
    metric       = "power.draw.watts")

let inferenceLatency : IObservable<InferenceEvent> =
  cluster.Workloads.Observable<InferenceEvent>(
    labelSelector = "app=zeta-inference",
    eventType     = "inference.completed")

// Compose: alert when GPU power AND inference latency
// both above thresholds simultaneously (likely overload).
gpuPower.WithLatestFrom(inferenceLatency)
  .Where(fun (p, l) -> p.watts > 250.0 && l.p99Ms > 100.0)
  .Subscribe(fun _ -> alertManager.Fire "gpu_overload")
```

Operator code (same semantics, TypeScript / RxJS):
```typescript
const gpuPower$ = cluster.devices.observable<DevicePowerReading>({
  nodeSelector: "zeta.io/role in (worker-gpu, control-plane-gpu)",
  deviceClass:  "nvidia.com/gpu",
  metric:       "power.draw.watts",
});
const latency$ = cluster.workloads.observable<InferenceEvent>({
  labelSelector: "app=zeta-inference",
  eventType:     "inference.completed",
});
combineLatest([gpuPower$, latency$]).pipe(
  filter(([p, l]) => p.watts > 250 && l.p99Ms > 100)
).subscribe(() => alertManager.fire("gpu_overload"));
```

Same algebra. Same composition. Different language. Reticulum
mesh under the hood; device plugins as the entry point;
DBSP as the retraction-native algebra; Rx as the operator-
facing API.

### Bidirectional — emit to interact with devices, not just observe

Aaron 2026-05-25 sharpening: *"and you emit to interact with the
devices"*. The framework's symmetric dual — every device class
exposes BOTH:

- `IObservable<TEvent>` — events FROM the device (telemetry, state
  changes, async results)
- `IObserver<TCommand>` — commands TO the device (writes, control,
  parameter sets, synchronous calls)

Combined: `IDeviceChannel<TEvent, TCommand>` — operator subscribes
to events AND emits commands using the same algebraic shape.

Operator code (F#):
```fsharp
// Observable side: read GPU power
let gpuPower : IObservable<DevicePowerReading> = ...

// Observer side: set GPU power limit
let gpuPowerLimit : IObserver<PowerLimitCommand> =
  cluster.Devices.Observer<PowerLimitCommand>(
    nodeSelector = "...",
    deviceClass  = "nvidia.com/gpu",
    operation    = "power.limit.set")

// Compose: AUTO-CONTROL the GPU power limit based on observed
// inference latency. When latency drops below target, reduce
// power limit (save energy); when latency spikes, raise limit
// (preserve perf). Pure Rx; runs distributed via Reticulum mesh
// + DBSP retraction-native semantics; survives node failures.
inferenceLatency
  .Window(TimeSpan.FromSeconds(10.0))
  .Select(fun w -> w.Average(fun e -> e.p99Ms))
  .Select(fun p99 ->
    if p99 < 50.0 then { watts = 200; nodeId = thisNode }
    elif p99 > 100.0 then { watts = 350; nodeId = thisNode }
    else { watts = 275; nodeId = thisNode })
  .DistinctUntilChanged()
  .Subscribe(gpuPowerLimit)  // ← bidirectional: emit commands
```

Operator code (TypeScript):
```typescript
const gpuPower$ = cluster.devices.observable<DevicePowerReading>({...});
const gpuPowerLimit = cluster.devices.observer<PowerLimitCommand>({
  nodeSelector: "...",
  deviceClass:  "nvidia.com/gpu",
  operation:    "power.limit.set",
});
inferenceLatency$.pipe(
  windowTime(10000),
  map(w => avg(w.map(e => e.p99Ms))),
  map(p99 => p99 < 50 ? { watts: 200 } : p99 > 100 ? { watts: 350 } : { watts: 275 }),
  distinctUntilChanged()
).subscribe(gpuPowerLimit);  // ← bidirectional
```

Per-device-class command surfaces (illustrative):

| Device class | Example observe (events out) | Example emit (commands in) |
|---|---|---|
| `nvidia.com/gpu` | power.draw, temp, util%, vram.used | power.limit.set, persistence-mode, clock.lock |
| `intel.com/npu` | inference.complete, queue.depth, util% | inference.submit, model.load, model.unload |
| `zeta.io/audio` | sample.in (mic stream), level.peak | sample.out (playback), volume.set, route.change |
| `zeta.io/kvm` (Comet Pro) | screen.frame, hid.event | key.send, mouse.move, power.button, iso.mount |
| `zeta.io/nic-offload` | packet.in, flow.stats | flow.install, ebpf.attach, qos.classify |
| `zeta.io/sensor` | temperature, humidity, GPIO.read | GPIO.write, RGB.set, fan.pwm |

Bidirectional means **the cluster becomes a programmable
control system over its own hardware**, not just an observable
one. Composes with 081KSE6WT0008QG0R0016CEE2Z scheduler (scheduler emits placement
commands by subscribing to load events + observing constraints),
081KSE6WT0008QG0R0029S1D5Z Comet Pro (HID injection IS command emission), 081KSE6WT0008QG0R003FG3E8R
telemetry flywheel (the telemetry is event-out; the LLM-PR
proposals are command-in, mediated by operator review).

The duality is the load-bearing pattern from
`.claude/skills/duality-expert/SKILL.md` — pull/push, monad/
comonad, LINQ/Rx, Observable/Observer applied at cluster-
substrate scope.

## Why this composition is load-bearing

The three threads compose into a value prop NONE of the
individual threads delivers alone:

- **Device plugins alone**: k8s resource accounting; per-pod
  device allocation. Operator gets opaque "GPU is allocated"
  — no visibility into device behavior.
- **Reticulum alone**: distributed networking + service
  discovery. Cluster nodes can talk to each other but no
  observability layer.
- **Rx alone**: algebraic composition of event streams.
  Beautiful API but nothing to observe.
- **All three composed**: every hardware event from every
  node is a first-class Observable in any operator's preferred
  language. AI workloads compose by subscribing. Telemetry
  flywheel (081KSE6WT0008QG0R003FG3E8R) feeds in. Scheduler (081KSE6WT0008QG0R0016CEE2Z) makes
  decisions by observing. Reference architecture (081KSE6WT0008QG0R0015ZF2G6)
  becomes substantively observable not just deployable.

This IS what makes the AI-cluster reference architecture
operationally distinct from "k8s with extras." It's a fabric
where every signal is composable.

## ServiceTitan-route composition (081KSE6WT0008QG0R00063R6HB + 081KSE6WT0008QG0R000WVYAJ2)

Each substrate layer plugs into existing standards (per 081KSE6WT0008QG0R00063R6HB):

| Layer | Existing standard |
|---|---|
| Device plugins | k8s device plugin API (CNCF standard) |
| Mesh transport | Reticulum (open-source; radio-agnostic — LoRa/WiFi/Ethernet/serial/I2C/TCP); secondary: HamNet, AllJoyn legacy bridges, NATS for higher-throughput |
| Service discovery on mesh | Reticulum's destination address + announce mechanism; mDNS bridge for k8s-native consumers |
| Stream protocol | gRPC bidirectional streaming over Reticulum (existing CNCF gRPC standard); fallback to plain Reticulum LXMF for low-bandwidth |
| Algebra | DBSP / Rx duality (Frank McSherry et al. — algebraic standard) |
| Operator SDK shape | Rx (Microsoft-led; cross-language with consistent algebra: RxJS, Rx.NET, RxJava, RxSwift, RxKotlin, RxPY, rxrust, etc.) |

Per 081KSE6WT0008QG0R000WVYAJ2 vendor swap: alternative mesh transports (Yggdrasil,
Tinc, Tailscale, Headscale, Tor) fit the same operator-facing
Observable shape; alternative stream protocols (Kafka, NATS,
Apache Pulsar) fit the same Rx subscription contract;
alternative device plugins (Intel/AMD/NVIDIA/Apple/Hailo)
fit the same `cluster.devices.observable<T>` interface.

## Acceptance

### Layer 1: Universal device plugins

- [ ] Plugin authoring contract documented:
      `docs/zeta-device-plugin-spec.md` — every device plugin
      MUST expose: resource quantity, per-device metrics
      stream, per-device events stream, RPC for direct
      device commands (where applicable)
- [ ] First-class device classes shipped:
      - `nvidia.com/gpu` (existing CNCF plugin wrapped)
      - `amd.com/gpu` (existing CNCF plugin wrapped)
      - `intel.com/gpu` (existing CNCF plugin wrapped)
      - `intel.com/npu` (per 081KSE6WT0008QG0R0022D6GN8)
      - `zeta.io/audio` (PipeWire-backed; per-codec discovery)
      - `zeta.io/nic-offload` (DPDK / XDP / eBPF program slots)
      - `zeta.io/nvme-namespace` (NVMe namespace allocation)
      - `zeta.io/usb-passthrough` (per-VID:PID USB devices)
      - `zeta.io/kvm` (IP-KVM devices per 081KSE6WT0008QG0R0029S1D5Z)
      - `zeta.io/sensor` (thermal / power / RGB / GPIO sensors)
- [ ] Per-device-class conformance test suite: every plugin
      verifiable swappable

### Layer 2: Reticulum mesh

- [ ] `Zeta.Mesh.Reticulum` package: NixOS module that ships
      Reticulum on every cluster node by default; auto-
      configures destinations + announces per role
- [ ] Bridge to k8s service discovery: Reticulum destinations
      visible as k8s Services with `zeta.io/mesh: reticulum`
      annotation; mDNS bridge for non-Reticulum-aware
      consumers
- [ ] Device-plugin export over mesh: per-node device plugins
      announce their devices to the mesh; remote nodes can
      query + subscribe via Reticulum
- [ ] Network-policy integration: k8s NetworkPolicy
      translates to Reticulum destination ACLs

### Layer 3: Polyglot Rx SDK

- [ ] Reference SDK in F# + Rx.NET (Zeta-primary language):
      `Zeta.Cluster.Reactive` package; full Observable surface
      over device plugins + workloads + mesh events
- [ ] Polyglot ports (priority order based on demand):
      - C# (Rx.NET) — facade for .NET ecosystem
      - TypeScript (RxJS) — for web UIs + Node.js services
      - Rust (rxrust) — for systems integrators
      - Python (RxPY) — for ML/data-science workloads
      - Go (rxgo) — for k8s controller authors
      - Java (RxJava) — for JVM ecosystem
      - Swift (RxSwift) — for iOS/macOS clients
      - Kotlin (RxKotlin) — for Android clients
- [ ] Cross-language conformance: identical operator examples
      tested in every language; semantically-equivalent
      Observable composition produces identical results
- [ ] Type-safety: every Observable carries a typed event
      record (F# record / TS interface / Rust struct / Python
      TypedDict / etc.); cross-language schema definition via
      Protobuf or similar (per 081KSE6WT0008QG0R000WVYAJ2 vendor-swap; could be
      JSON Schema if simpler)

### Layer 4: Algebra grounding (DBSP / Rx duality)

- [ ] Every Observable backed by DBSP retraction-native
      semantics — operators can compose with retraction-aware
      Rx operators (`.WithRetraction()`, `.Materialize()`,
      `.PivotByKey()`)
- [ ] Time-travel debugging: any Observable can be replayed
      from any historical timestamp (composes with 081KSE6WT0008QG0R0016CEE2Z DST)
- [ ] Telemetry flywheel (081KSE6WT0008QG0R003FG3E8R) feeds in: every Observable
      can be opt-in routed to the telemetry endpoint as a
      training signal for AI-substrate improvement

## Polyglot importance

The substrate-honest argument: **AI operators come from every
language ecosystem**. ML researchers default to Python; web app
developers default to TS; systems engineers default to Rust /
Go; enterprise integrators default to Java / C#; mobile app
developers default to Swift / Kotlin. If Zeta's observability
surface is F#-only, every operator from another ecosystem has to
either learn F# OR write their own SDK.

The bandwidth-engineering payoff: **same Rx algebra in every
language** means an operator can use the language they already
know. Cross-language conformance means examples in one language
translate cleanly to another (Aaron's example F# can be
mechanically translated to RxJS, RxJava, etc. by an LLM with
high fidelity because the algebra is identical).

This composes with 081KSE6WT0008QG0R0015ZF2G6 (AI-trainable substrate) — the
polyglot examples become training data for AI systems learning
to operate Zeta clusters in their preferred ecosystem.

## Reticulum vs AllJoyn historical context

AllJoyn (Qualcomm 2011 → Linux Foundation 2016 → effectively
dormant 2020+) was a service-fabric / device-discovery protocol
for IoT — meant to make every device discoverable + RPC-callable
without central registry. The pattern was right; the
implementation accrued cruft, took too long to ship modern
crypto, and got overtaken by alternatives.

Reticulum (Mark Qvist 2018 → ongoing) is the modern realization
of the same shape:

- Cryptographic-first (X25519 + Ed25519 baked in)
- Radio-agnostic (LoRa / WiFi / Ethernet / I2C / serial / TCP /
  custom — same Reticulum protocol)
- Mesh-native (multi-hop without central infra)
- Federated (operators run their own Reticulum networks; can
  bridge or stay isolated)
- Identity-first (every endpoint has a cryptographic
  destination address; no IP-address dependency)
- Resource-frugal (designed for embedded devices + low-power
  radios; scales up to high-bandwidth IP transport)

For Zeta cluster substrate, Reticulum offers:

- Cluster-node-to-cluster-node service discovery without
  depending on cloud DNS + cloud LBs
- Operator-to-cluster discovery from anywhere (mobile, edge,
  unattended sites) without VPN setup
- Cross-cluster mesh (multi-cluster federation per future row)
- Substrate that survives WiFi / cellular / internet outages
  via radio fallback (LoRa for telemetry; mesh for control
  plane)

The AllJoyn parallel is the IoT-substrate-fabric vision Aaron
named. Reticulum delivers what AllJoyn meant to.

## Composes with

- 081KR2E4K0008QG0R001SWEPNV — Green Lantern hardware spec (Reticulum substrate
  origin; existing Zeta memory)
- 081KRFA460008QG0R0018SN61J — F# fork for AI safety (the F# substrate Rx-based
  SDKs build on)
- 081KSE6WT0008QG0R000WVYAJ2 — cloud-native plugins fit Zeta interfaces (universal
  device-plugin pattern IS this row's first layer)
- 081KSE6WT0008QG0R0009YYNP4 — CNCF ecosystem force multipliers (existing CNCF
  device-plugin standards + Reaqtor for Rx-server)
- 081KSE6WT0008QG0R00063R6HB — ServiceTitan route (each layer plugs into existing
  standards: k8s device plugin API / Reticulum / Rx)
- 081KSE6WT0008QG0R00049EFBD — slow-replace k8s binary-compat (the Zeta-native
  device-plugin substrate composes with Wave 2 operator surface)
- 081KSE6WT0008QG0R0016CEE2Z — Zeta-native scheduler (subscribes to device-class
  observables for scheduling decisions; per sub-wave B+C+D)
- 081KSE6WT0008QG0R0029S1D5Z — Comet Pro IP-KVM (one of the device classes;
  `zeta.io/kvm` plugin)
- 081KSE6WT0008QG0R0022D6GN8 — audio + NPU + ONNX (the device classes this row
  generalizes from; 081KSE6WT0008QG0R0022D6GN8 ships specific plugins, this row
  ships the unifying pattern)
- `algebra-owner` skill — DBSP + Rx duality substrate
- `rx-expert` skill — Rx.NET operator catalog
- `duality-expert` skill — pull/push + LINQ/Rx duality
- `streaming-incremental-expert` skill — DBSP retraction-native
- `crdt-expert` skill — for mesh-state-convergence semantics
- `gossip-protocols-expert` skill — Reticulum is a gossip-
  family protocol; SWIM-adjacent
- `networking-expert` skill — TCP/UDP/QUIC fallback transports

## What this enables that doesn't exist elsewhere

| Capability | Today's status quo | With this row's substrate |
|---|---|---|
| Subscribe to GPU power consumption across cluster | Manual: scrape Prometheus or vendor SDK | One-line Rx: `cluster.devices.observable<DevicePowerReading>(...)` |
| Cross-language observability SDK | Pick a language; rebuild SDK for next operator | Same algebra in every language; LLM-translatable |
| Mesh discovery without cloud LB | VPN / kubectl proxy / port-forwards | Reticulum mesh; works over LoRa for unattended sites |
| Compose device events + workload events | Custom collector + custom matcher | Rx CombineLatest / WithLatestFrom / Window |
| Replay cluster behavior for AI training | Capture Prometheus metrics; piece together | Every Observable replayable from any timestamp (composes with 081KSE6WT0008QG0R0016CEE2Z DST) |
| Cluster-of-clusters federation | Custom (Kubefed deprecated; no clean standard) | Reticulum bridges between cluster meshes |

## Out of scope

- Building the Rx SDKs for languages where the operator
  population is tiny (Erlang / Elixir / Crystal / Zig) —
  community can contribute via the documented contract
- Reticulum vs alternative-mesh comparison + recommendation —
  defer; this row picks Reticulum per Aaron's existing
  substrate; alternatives plug in per 081KSE6WT0008QG0R000WVYAJ2
- Replacing every CNCF observability project (Prometheus,
  Loki, Tempo, Jaeger) — this row composes WITH them, not
  replaces; per 081KSE6WT0008QG0R00063R6HB ServiceTitan route
- Real-time low-latency audio over the cluster mesh
  (audio-over-network for studio use) — composes with 081KSE6WT0008QG0R0022D6GN8
  audio scope but stays scoped to per-node audio for v1
- Hardware-class plugins beyond the first-class list — community
  contributes per the documented spec

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, composing three Zeta
substrate threads into a coherent target: universal device
plugins + Reticulum mesh + polyglot Rx observability. Each
thread has existing substrate; this row names their COMPOSITION
as the AI-cluster fabric substrate that makes the reference
architecture (081KSE6WT0008QG0R0015ZF2G6) operationally distinct from "k8s with
extras." Substrate-honest: Reticulum delivers what AllJoyn meant
to (cryptographic + mesh + modern); Rx delivers cross-language
algebra; device plugins deliver hardware-class uniformity.
