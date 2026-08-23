---
id: 081M0QMDMAA087G0R000MADEEB
type: bug
state: backlog
priority: P2
slug: oraclergba-wgsl-atomicadd-on-a-non-atomic-array-u32-confirm
title: "OracleRGBA WGSL atomicAdd on a non-atomic array<u32> — confirm on a device"
created: 2026-08-23T15:39:25.386Z
depends_on: []
composes_with: []
---

# OracleRGBA WGSL atomicAdd on a non-atomic array<u32> — confirm on a device

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QMDMAA087G0R000MADEEB-*.md` glob. -->
**Reported as a finding, not a fix.** `demo/identity-dla-site/src/components/OracleRGBA.tsx`, in
`WGSL_RGBA`, declares

```wgsl
@group(0) @binding(5) var<storage, read_write> harmonic: array<u32>;
```

and then writes it with

```wgsl
atomicAdd(&harmonic[i], 1u);
```

WGSL `atomicAdd` requires `ptr<storage, atomic<u32>, read_write>`; an element of a plain `array<u32>`
is not an `atomic<u32>`. As written this reads as a **shader-validation error**, which would make the
whole GPU path fail at `createShaderModule`.

**Circumstantial support, not proof:** `harmonicBuf` and `walkLenBuf` are allocated and bound and
**never read back**, and `runGPU`'s renderer writes a flat `(220,100,50,255)` per cluster cell rather
than the four-channel encoding the file's header documents. A GPU path that never worked would look
exactly like this.

**LOOK, DON'T INFER — this has not been run on a device.** The claim is read off the WGSL spec.

**Falsifier.** Load the page in a WebGPU-capable browser with the GPU toggle on and read the console.
Either a validation error appears (confirmed; fix is `array<atomic<u32>>`) or it does not (refuted, and
the reason the buffers are unread is something else). Do not change the file before running it.
