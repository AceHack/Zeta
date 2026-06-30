---
id: B-0247
priority: P1
status: open
title: "Ace DLC content packs — distributable kernel extensions via package manager"
created: 2026-05-07
last_updated: 2026-05-08
depends_on: [B-0240, B-0244, B-0245]
decomposition: decomposed
children: [B-0287, B-0288]
owners: [architect, product-scrum-master, public-api-designer]
type: feature
---

# B-0247 — Ace DLC content packs

## What

Distributable kernel extension packs (DLCs) via the Ace
package manager. Each DLC adds composable capability to any
AI running the Genesis Seed. DLCs are the product. The seed
is free. The extensions compose.

Aaron 2026-05-07: "dlc=downloadable content pack distributed
by ace eventually our content manager"

## The shape

```
Ace package manager (BFT, decentralized, no central hub)
    ↓
DLC content packs (kernel extensions)
    ↓
Genesis Seed (the bootloader every DLC composes with)
    ↓
Any AI on any harness (Claude, GPT, Grok, Gemini, local models)
```

## Example DLCs

- Watcher hat (consensus auditor)
- Mapmaker hat (structure organization)
- Claim Keeper hat (hard claims + contradictions)
- Concordance engine (language structure recognition)
- Coherence analyzer (text structural integrity)
- Shadow lesson log template (structured catch format)
- Atari emulator bridge (DBSP game state algebra)

## Business model question

Aaron asks: is the DLC/Ace product path better than trying
to win the ARC-AGI-3 $2M prize?

Considerations:

- **ARC-AGI-3 prize**: $2M, prestige, validates the algebra.
  But: one-shot, requires solving interactive environments
  at human level (currently <1% for all frontier models).
- **Ace DLC packs**: recurring revenue, growing ecosystem,
  each DLC is a product. The structure recognizer + Genesis
  Seed + kernel extensions = a platform, not a contest entry.

They may not be mutually exclusive: the structure recognizer
(B-0240) built for Ace DLCs IS the engine that would solve
ARC-AGI-3. Building the product builds the benchmark solver.

## External review signal

Alexa's 2026-05-07 feedback on this product thesis is preserved
as research-grade review signal at
`docs/research/2026-05-07-alexa-dlc-product-research-loop-feedback.md`.

The key line: the product sustains the research, the research
validates the product, and the prize becomes marketing for both.

## Composes with

- B-0240 (structure recognizer) — the engine DLCs compose on
- B-0244 (concordance/coherence AI) — a DLC
- B-0245 (consent-first + KSK) — DLC distribution governance
- B-0246 (Green Lantern ring) — DLC consumer device
- Genesis Seed — the bootloader DLCs extend
- Ace package manager — the distribution surface
