# Identity Space Boundary — Multi-Oracle DLA Site

React 19 + Tailwind 4 + shadcn/ui frontend for the multi-oracle DLA proof.

## Oracles

| # | Name | Substrate | Binary/Source Size |
|---|------|-----------|-------------------|
| 1 | Canvas | HTML5 Canvas 2D API | JS |
| 2 | CSS | CSS custom properties + DOM | JS |
| 3 | Chip-8 | Chip-8 VM emulator | JS |
| 4 | SVG | SVG DOM manipulation | JS |
| 5 | Quantum Walk | Quantum walk simulation | JS |
| 6 | Infer.NET | Bayesian posterior heatmap | JS |
| 7 | C. elegans Worm | Biological neural circuit | JS |
| 8 | SLE_κ | Loewner equation (κ≈5.7) | JS |
| 9 | WebGPU | WGSL compute shader | GPU |
| 10 | WASM×7 | WAT/Zig/C/LLVM/Rust/ASC/Go | 697B–1.5MB |
| 14 | V8 Bytecode | JS engine internal bytecode | 632B |

## Key claims

- D_f ≈ 1.322 across all 14 oracles (substrate independence)
- Z-7: binary_size ⊥ D_f (Pearson r = 0.000000, 70 pairs)
- Z-3: S_Loew(t*) = ln(3√2) ≈ 1.4427 nats (analytic identity, discharged)

## Build

```bash
pnpm install
pnpm dev
```
