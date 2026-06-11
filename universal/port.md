# universal/port — Universal Port Interface (plug-shaped systems, one grammar)

> **Universal Port Interface** — the universal SHAPE of every plug-shaped surface: a **port we
> OWN** named by stable identity (ZetaId), **adapters** supplying it (theirs never in Core), a
> **resolution ladder** binding port→adapter against what the host actually has
> (Live → Injected → Adapted(via, from) → Mock), an **honesty register on the binding** (the red
> light: `[REC ●]`/`[off ○]` — a binding's truth is always visible), and a **refusal that
> teaches** (repulsion + the missing piece via `findAdapter`, never a bare no).

Aaron 2026-06-13: *"we have universal interfaces too — this smells like that."* Correct, and
senior: the plugin-convergence audit (docs/research/2026-06-13-the-plugin-convergence-audit-*)
found four plug-shaped systems sharing one grammar — and that grammar was already living here:
[`universal/extension.md`](extension.md)'s **Probe** is this port's resolution, its **Zero** is
this port's Mock ("not yet," never a crash), its **Vectors** are this port's conformance cases.
This file names the rest of the shape so the next plug-shaped system reuses it instead of growing
a sixth. (Interfaces are free; the rules of the game are interfaces.)

## The contract (pure shape)

- **`Name`** — the port's stable identity is a **ZetaId** (content-addressed, version-bumped —
  never silent; `GeneratorRegistry.idOf` is the mint).
- **`Adapters`** — implementations register against the Name; OUR engine and THEIR engine are
  peers behind it (hexagonal: the external one never enters Core; it exists to TEST ours —
  conformance cases run through both, divergence is a finding).
- **`Ladder`** — resolution returns Live | Injected | Adapted(viaPiece, fromCapability) | Mock,
  in that order; Adapted carries its provenance IN the value; absence is Mock, never an error
  (the expansion law for capabilities).
- **`Light`** — every binding renders its red-light glance form; a recording-capable binding
  without its light shown is a consent violation (manifesto §6), and a Mock says "rehearsal —
  nothing real is heard."
- **`Missing`** — when two ends repel, the answer is the toolbox piece that would complete the
  flow (`findAdapter`), or the honest gap — constructive refusal, the GraphEdit feel.

## Instances (running)

| system | Name | Ladder | Light | Missing |
|---|---|---|---|---|
| MediaLines io (cartridges) | io line ZetaId | resolveIoWith (full ladder) | bindingLight ✓ | toolbox adapters ✓ |
| MagneticPorts (kid UX) | Port.TypeId | compatible/snap | repulsion is the light | findAdapter ✓ |
| GeneratorRegistry | the ZetaId itself | byId (Live-or-dangling) | catalog-law test | collisions() gate |
| PluginApi/Harness | capability interfaces | wiring-time probes | (inherit: add the light) | (inherit) |
| IInferenceEngine (newest) | (follow-up: engine ZetaIds) | (follow-up: ladder resolution) | (inherit) | conformance divergence |

## Pointers

- [`universal/extension.md`](extension.md) — Probe/Zero/Vectors (the senior half of this shape)
- `src/Core/MediaLines.fs` (the fullest instance) · `MagneticPorts.findAdapter` ·
  `GeneratorRegistry` · `IInferenceEngine` (first new customer)
- docs/research/2026-06-13-the-plugin-convergence-audit-*.md — the audit this file crystallizes
