---
id: 081KR2E4K0008QG0R001SWEPNV
scope: Green Lantern ring — hardware spec and local inference requirements
attribution: Otto (Claude Code, claude-sonnet-4-6)
operational-status: research-grade
created: 2026-05-14
parent: 081KQZVQW0008QG0R00348SHDZ
---

# 081KR2E4K0008QG0R001SWEPNV — Green Lantern Hardware Spec: Local Inference Requirements

## Summary

The Green Lantern ring (081KQZVQW0008QG0R00348SHDZ) is a ring-form-factor wearable running the
Genesis Seed with local inference, consent gating, and Reticulum mesh
connectivity. "Local inference" means the Genesis Seed system prompt runs
against an LLM that never leaves the owner's physical space — no cloud API
call for the cognitive layer.

This doc compares four hardware candidates across the inference tier and the
MCU (on-ring) tier, provides a power/compute/connectivity matrix, and
recommends the initial target configuration.

---

## Architecture overview

The ring is two physically coupled tiers:

```
[Ring MCU]  —BLE 5.0—>  [Local inference gateway]
  ESP32-S3                RPi 5 / Jetson Orin Nano
  consent UI              Genesis Seed + LLM
  BLE/LoRa/Reticulum      policy cache
  receipt signing         WebSocket hole puncher
```

The ring MCU handles the wearable form factor: LED/haptic feedback, consent
buttons, BLE/LoRa radio, and receipt signing (lightweight Ed25519). The
gateway node (kept in a pocket, bag, or on a desk nearby) runs the LLM.
"On-ring inference" of a full LLM is not feasible today at the power
envelope of a ring (<50 mW sustained); see §6 for the ESP32-S3 micro-model
experiment boundary.

---

## Candidate overview

| # | Device | Tier | MSRP (USD, 2026-05) |
|---|--------|------|---------------------|
| A | NVIDIA Jetson Orin Nano 8GB | Gateway (best) | ~$199 module + ~$50 carrier |
| B | Raspberry Pi 5 8GB | Gateway (recommended) | ~$80 |
| C | Raspberry Pi 5 4GB | Gateway (budget) | ~$60 |
| D | ESP32-S3-DevKitC-1 | On-ring MCU | ~$10–15 |

All four are active, production-available parts as of 2026-05.

---

## Candidate A — NVIDIA Jetson Orin Nano 8GB

### Compute

| Attribute | Value |
|-----------|-------|
| CPU | 6-core Arm Cortex-A78AE @ 1.5 GHz |
| GPU | 1024 CUDA cores (Ampere) + 32 Tensor Cores |
| AI accelerator | 40 TOPS (INT8) via DLA + GPU |
| RAM | 8 GB LPDDR5 unified (CPU + GPU shared) |
| Storage | NVMe M.2 / UHS-I microSD |

### Inference capability (llama.cpp / TensorRT)

| Model | Quantization | Tok/s (estimated) |
|-------|-------------|-------------------|
| Llama 3.2 3B | Q4_K_M | ~60–80 |
| Mistral 7B | Q4_K_M | ~30–40 |
| Llama 3.1 8B | Q4_K_M | ~25–35 |
| Phi-3 mini 3.8B | Q4_K_M | ~55–70 |

The 8B Q4 model fits entirely in the 8 GB unified memory pool with room for
the OS and KV cache.

### Power / thermal

| Mode | Power draw |
|------|-----------|
| Idle | ~2 W |
| CPU-only inference | ~7 W |
| GPU-accelerated inference | 10–15 W |
| TDP (max) | 15 W (MAXN) / 7 W (power-save) |

Requires 5 V / 3 A DC barrel or USB-C PD. Not battery-portable at full load
without a >20 000 mAh bank.

### Connectivity

- 1× Gigabit Ethernet (carrier board dependent)
- WiFi 6 / Bluetooth 5.3 via M.2 WiFi card (not on-module; carrier-dependent)
- USB 3.2 Gen 2

### Reticulum mesh integration

Reticulum runs over any underlying transport. On Jetson: USB-attached LoRa
module (RAK4631 or WisDuo RAK3172 USB adapter) or WiFi mesh (802.11).

### Verdict

Best throughput. Recommended when the gateway is semi-fixed (desk, bag hub)
and GPU-accelerated inference quality matters. The TensorRT backend gives a
2–3× speedup over CPU-only llama.cpp for quantized models.

---

## Candidate B — Raspberry Pi 5 8GB (recommended)

### Compute

| Attribute | Value |
|-----------|-------|
| CPU | BCM2712, Cortex-A76 quad-core @ 2.4 GHz |
| GPU | VideoCore VII (display/encode only — no GPGPU) |
| NPU | None |
| RAM | 8 GB LPDDR4X-4267 |
| Storage | UHS-I microSD / USB 3.0 / PCIe x1 (HAT+) |

### Inference capability (llama.cpp CPU only)

| Model | Quantization | Tok/s (estimated) |
|-------|-------------|-------------------|
| Llama 3.2 1B | Q4_K_M | ~30–45 |
| Llama 3.2 3B | Q4_K_M | ~12–18 |
| Phi-3 mini 3.8B | Q4_K_M | ~10–15 |
| Mistral 7B | Q4_K_M | ~5–8 |

For interactive Genesis Seed use, 3B Q4 at ~15 tok/s is acceptable latency
(first-token ~0.5s, full 200-token reply ~13s). The 8B Q4 model fits but
inference latency pushes to ~25 s per reply — marginal for interactive.

### Power / thermal

| Mode | Power draw |
|------|-----------|
| Idle | ~2.7 W |
| CPU-only inference (full load) | 8–12 W |
| Max TDP | 12 W |

Runs from 5 V / 3 A USB-C. A 10 000 mAh (37 Wh) power bank yields ~3–4 h
continuous inference. The RPi 5 active cooler (~$5 heatsink + fan) is
recommended for sustained inference.

### Connectivity

- 1× Gigabit Ethernet
- IEEE 802.11ac (WiFi 5) dual-band
- Bluetooth 5.0
- 2× USB 3.0, 2× USB 2.0
- PCIe FPC connector (HAT+ for LoRa / NVMe)

### Reticulum mesh integration

Reticulum on RPi 5 over:

- WiFi (built-in): ad-hoc or infrastructure AP mode
- LoRa: RFM95 HAT via SPI (Reticulum `RNodeInterface`) — 433/868/915 MHz,
  up to 5 km line-of-sight
- USB serial: attaches to ESP32-S3 ring MCU for BLE bridging

### Verdict

**Recommended starting point.** Best cost-to-capability ratio. The 8 GB
model fits the 7B model class comfortably. Llama 3.2 3B Q4 provides
acceptable interactive speed. PCIe HAT+ slot enables LoRa add-in without
USB dongles. Widely available.

---

## Candidate C — Raspberry Pi 5 4GB (budget)

Identical to Candidate B except RAM halved. Constraints:

- 7B Q4 models do not fit (require ~4.5 GB for weights + KV cache at context
  length 2048; system + runtime consume ~800 MB)
- 3B Q4 models fit comfortably (use ~2 GB)
- 1B models fit with room to spare

**Verdict:** Viable for a Llama 3.2 3B or Phi-3 mini configuration. Not
recommended if 7B model quality is required. Save ~$20 vs. 8GB variant.

---

## Candidate D — ESP32-S3 (on-ring MCU)

### Compute

| Attribute | Value |
|-----------|-------|
| CPU | Xtensa LX7 dual-core @ 240 MHz |
| On-chip RAM | 512 KB SRAM |
| External RAM | Up to 8 MB PSRAM (Octal-SPI) |
| Flash | Up to 16 MB |
| FPU | Single-precision; no vector |

### Inference capability

Standard LLM models — even at maximum quantization — do not fit in 8 MB
PSRAM. TinyLlama 1.1B at Q2_K (2-bit) requires ~275 MB for weights alone
(1.1B × 2 bits ÷ 8); phi-1 1.3B is similarly unloadable. Purpose-built
MCU micro-models fit within the memory envelope:

| Task | Framework | Model size |
|------|-----------|------------|
| Keyword detection | TFLite Micro / Edge Impulse | < 200 KB |
| Intent routing (3–10 fixed intents) | TFLite Micro LSTM | < 500 KB |

**Conclusion:** The ESP32-S3 can execute micro-inference for simple
classification tasks (keyword detection, intent routing, consent
classification) but cannot reliably run a Genesis Seed interaction loop at
acceptable latency. It is the **ring MCU layer**, not the inference layer.

### On-ring functions (design boundary)

The ESP32-S3 handles:

- BLE 5.0 central/peripheral (ring-to-gateway pairing)
- IEEE 802.11 b/g/n (WiFi fallback)
- Ed25519 receipt signing (hardware-accelerated via ESP-IDF mbedTLS)
- Three-dial consent UI (capacitive touch or button GPIO)
- LED/haptic feedback driver
- Reticulum node (via WiFi or SPI-attached LoRa module)
- Policy cache (KSK-gated, stored in encrypted SPI flash)

### Power / thermal

| Mode | Current | At 3.3 V |
|------|---------|---------|
| Deep sleep | <10 µA | <33 µW |
| BLE connected (low duty) | ~10 mA | ~33 mW |
| WiFi TX peak | ~240 mA | ~790 mW |
| Active MCU (no radio) | ~30 mA | ~99 mW |

A 300 mAh LiPo (a ring-viable size) yields:

- ~30 h standby with BLE connected
- ~12 h active use with occasional WiFi tx

### Verdict

The ESP32-S3 is the **ring compute platform**. Not the inference platform.
The two-tier architecture (ring MCU + nearby gateway) is the correct
architectural split for the Green Lantern form factor.

---

## Power / compute / connectivity matrix

| Attribute | Jetson Orin Nano 8GB | RPi 5 8GB | RPi 5 4GB | ESP32-S3 |
|-----------|---------------------|-----------|-----------|---------|
| **Tier** | Gateway (best) | Gateway (rec.) | Gateway (budget) | Ring MCU |
| **LLM model class** | 7B–8B Q4 | 3B–7B Q4 | 1B–3B Q4 | micro / none |
| **Tok/s (3B Q4)** | ~70 | ~15 | ~15 | N/A |
| **Tok/s (7B Q4)** | ~35 | ~6 | OOM | N/A |
| **RAM** | 8 GB | 8 GB | 4 GB | 8 MB PSRAM |
| **Idle power** | ~2 W | ~2.7 W | ~2.5 W | <33 mW |
| **Inference power** | 10–15 W | 8–12 W | 8–11 W | — |
| **WiFi** | M.2 add-in | 802.11ac built-in | 802.11ac built-in | 802.11 b/g/n built-in |
| **Bluetooth** | 5.3 (M.2) | 5.0 built-in | 5.0 built-in | 5.0 built-in |
| **Ethernet** | 1 GbE | 1 GbE | 1 GbE | — |
| **LoRa / Reticulum** | USB or M.2 HAT | SPI HAT / USB | SPI HAT / USB | SPI add-in |
| **BLE to ring** | Via USB dongle or M.2 | Built-in BT 5.0 | Built-in BT 5.0 | Is the ring |
| **Cost (USD)** | ~$249+ | ~$80 | ~$60 | ~$10–15 |
| **Portable battery** | Difficult (15 W) | 3–4 h (10 000 mAh) | 3–4 h (10 000 mAh) | 12–30 h (300 mAh) |

---

## Recommended initial configuration

**Ring (tier 1):** ESP32-S3-WROOM-1 module (8 MB PSRAM, 8 MB flash)

- BLE 5.0 to gateway
- SPI-attached RFM95W LoRa for Reticulum mesh
- Capacitive three-dial consent UI
- Ed25519 signing via hardware RNG + mbedTLS
- Policy cache in encrypted SPI flash

**Gateway (tier 2):** Raspberry Pi 5 8GB

- llama.cpp server (REST endpoint) running Llama 3.2 3B Q4_K_M
- Reticulum LoRa HAT (SPI)
- Genesis Seed loaded as system prompt at startup
- WebSocket hole puncher for outbound connection
- BLE central (built-in) paired with ring

**Inference model recommendation for Genesis Seed:**
Llama 3.2 3B Instruct Q4_K_M is the recommended starting model. It fits
the system prompt (Genesis Seed is ~500 tokens), leaves ~1.5 GB for KV
cache at context length 4096, and delivers ~15 tok/s on the RPi 5 8GB —
sufficient for interactive consent-dialog and policy lookups.

Upgrade path: when Candidate A (Jetson Orin Nano) gateway is used, switch
to Mistral 7B Q4_K_M or Llama 3.1 8B Q4_K_M for meaningfully higher
response quality.

---

## Open questions (feed 081KR2E4K0008QG0R003MJ4JK0 + follow-on slices)

1. **Firmware protocol**: how does the ring MCU authenticate to the gateway
   (mutual TLS over BLE? OPAQUE PAKE? KSK-signed challenge?). Feeds 081KQZVQW0008QG0R002Q58F6Z
   KSK gating work.
2. **Cold-start latency**: llama.cpp model load time on RPi 5 is ~8–15 s for
   3B Q4. Is persistent-daemon mode sufficient, or does the ring need a
   wake-on-BLE trigger to the gateway? Needs measurement.
3. **Reticulum LoRa channel contention**: shared 868/915 MHz spectrum with
   other IoT devices. Need bandwidth budget for the heartbeat + receipt
   traffic. Feeds 081KQZVQW0008QG0R001CQPQ0E WebSocket/mesh work.
4. **Ring form-factor PCB feasibility**: ESP32-S3-WROOM-1 footprint is
   18 × 20 mm. A ring-sized PCB (inside diameter ~18 mm) requires a custom
   WLCSP or similar BGA packaging. Commercial reference: Oura ring (Gen 4)
   uses a custom ASIC; we need a dev-board proxy first.
5. **Privacy of inference data**: the gateway runs locally, but if connected
   to WiFi, the inference server is reachable from the LAN. Firewall rules
   + KSK access policy needed.

---

## Prior art searched (pre-start checklist)

- `docs/research/*hardware*` — no results
- `docs/research/*iot*` — no results
- `docs/research/*jetson*` — no results
- `docs/backlog/*/081KQZVQW0008QG0R00348SHDZ*.md` — parent item (Green Lantern ring design)
- `docs/research/2026-05-07-genesis-seed-final-zfcv2-base-prompt-aaron.md` —
  Genesis Seed system prompt (zfcv2); ~500 tokens
- `docs/research/2026-05-07-claudeai-genesis-seed-evaluation-network-hats-*` —
  Lior/DeepSeek evaluation of Genesis Seed

No prior hardware spec doc found. This document is the first research landing.

---

## Acceptance criteria status

- [x] Research doc with 3+ hardware candidates compared (A, B, C, D above)
- [x] Power/compute/connectivity matrix (§ matrix table)
