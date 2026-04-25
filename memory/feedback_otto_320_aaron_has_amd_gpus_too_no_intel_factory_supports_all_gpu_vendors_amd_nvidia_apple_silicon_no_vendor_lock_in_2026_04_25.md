---
name: Otto-320 Aaron has AMD GPUs in addition to NVIDIA — no Intel — factory should support all GPU vendors (AMD ROCm + NVIDIA CUDA + Apple Silicon Metal); compute substrate is vendor-agnostic; vendor-lock-in is anti-pattern
description: Aaron 2026-04-25 — "some of the gpus are AMD too, i don't have any intels but we should support all of them". Adds AMD ROCm path to the compute substrate alongside NVIDIA CUDA (Otto-315/316). Aaron explicit factory-design direction: support ALL GPU vendors regardless of his personal hardware. Vendor-agnostic compute is part of Otto-301 no-software-deps + microkernel direction (factory shouldn't depend on a specific GPU vendor's runtime).
type: feedback
---

# Otto-320 — AMD GPUs + factory supports all vendors (vendor-agnostic compute)

## Aaron's disclosure

> "some of the gpus are AMD too, i don't have any intels but we should support all of them"

Two parts:

1. **Factual update**: Aaron's ~20 GPUs (Otto-316) include AMD as well as NVIDIA. No Intel GPUs.
2. **Factory-design surfacing from Aaron**: support ALL GPU vendors, not just NVIDIA. Even though Aaron doesn't have Intel personally, the factory should support Intel Arc / Battlemage / future when adopters bring them. (Otto-293 mutual-alignment language — Aaron is surfacing a factory-design intention; the factory cohort aligns with it via mutual engagement, not via top-down directive.)

## Vendor-agnostic compute

| Vendor | Runtime | Aaron's hardware |
|--------|---------|------------------|
| NVIDIA | CUDA / cuDNN / TensorRT | ✓ Has (Thor + portion of ~20 GPUs) |
| AMD | ROCm / HIP | ✓ Has (portion of ~20 GPUs) |
| Apple Silicon | Metal / MLX / Core ML | (Aaron didn't mention; factory supports anyway) |
| Intel | oneAPI / SYCL / OpenVINO | ✗ Aaron has none, but factory supports |

Factory compute substrate plans against this matrix as categorical capability, not vendor-specific runtime.

## Composition with prior

- **Otto-301 (no software dependencies)** — vendor-agnostic compute is a SPECIFIC instance of no-vendor-lock-in. Factory shouldn't bind to NVIDIA's CUDA runtime any more than to Intel's MKL.
- **Otto-302 (5GL Intent-Based)** — at the Intent-Based layer, "run this model on a GPU" doesn't specify NVIDIA vs AMD vs Apple. The factory's substrate should compile to whatever GPU is available.
- **Otto-315 / Otto-316 (compute fleet)** — fleet now includes mixed-vendor GPUs; deployment needs to handle heterogeneous compute.
- **Otto-308 / Otto-311 (compression-substrate / economic-substrate)** — vendor-lock-in is the OPPOSITE of compression (it duplicates effort across vendors). Vendor-agnostic compute IS the elegant store.

## Cross-vendor abstraction layers worth investigating

- **PyTorch** — already vendor-agnostic via different backends (CUDA, ROCm, MPS, Vulkan).
- **WGPU / WebGPU** — emerging cross-vendor GPU API (browser-friendly, composes with WASM Otto-308).
- **MLX** — Apple-native but cross-platform-friendly.
- **Vulkan compute** — vendor-agnostic, works on most GPUs.
- **OpenCL** — older, broadly supported.

For factory components targeting GPU compute, prefer abstraction layers that compile to any available runtime.

## What this memory does NOT claim

- Does NOT propose immediate vendor-agnostic GPU substrate work. Queue-drain primary. This informs long-horizon factory architecture.
- Does NOT specify which abstraction layer the factory adopts. That's a design decision when GPU-compute substrate work begins.
- Does NOT diminish NVIDIA Thor's role (Otto-315). Thor is a top-end node; vendor-agnostic deployment INCLUDES Thor as a CUDA target alongside AMD ROCm targets.

## Operational implications

1. **Otto-301 no-software-deps** clarified: also "no-vendor-deps". Factory binds to compute-CAPABILITY, not vendor-runtime.
2. **Otto-316 fleet description updated**: ~20 GPUs are mixed NVIDIA + AMD; no Intel.
3. **Future GPU-compute work**: prefer cross-vendor abstraction layers (PyTorch backends / WGPU / Vulkan compute / MLX / OpenCL) over vendor-specific runtimes (CUDA-only, ROCm-only).
4. **Frontier UI deployment**: must handle mixed-vendor compute when deploying to Aaron's fleet.

## Key triggers for retrieval

- AMD GPUs alongside NVIDIA in Aaron's fleet
- No Intel GPUs (Aaron's choice)
- Factory supports ALL GPU vendors (AMD + NVIDIA + Apple + Intel future)
- Vendor-agnostic compute is part of Otto-301 no-software-deps
- Cross-vendor abstraction layers (PyTorch, WGPU, MLX, Vulkan, OpenCL)
- No vendor-lock-in anti-pattern
