# Cartridge self-description — in-file laws, prereqs, edges, issues, sign-offs; Aaron's first render-loop ratification

Aaron 2026-06-12, on the format: "does the shape file contain all this, readable in all langs, as
homoiconically as possible? … it should carry its math-team sign-off too, and any outstanding
issues they have, and any prerequisites for learning, and related edge kind of stuff." Then: "we
can abstract the laws from all our formal-analysis tools — DOCUMENT here, CHECK them there — until
checking is built in at the chip8 level; we want chip8 to be able to load the cartridges, or chip9
at least." And the moment that closes the loop: **"the buckyball is perfect as I imagine in my
head."**

## What the file carries now (four new kinds, all additive)

- **`law <name> <identity-or-delegation>`** — the cartridge states its OWN checks. Integer
  identities run in `CartridgeLaw` (a screen-of-code evaluator any oracle language re-implements;
  strict dialect: space-separated operators because names are kebab-case). Non-arithmetic laws
  DELEGATE by tool prefix — `code:`, `z3:`, `tla:`, `lean:`, `fscheck:` — documented in-file,
  checked by the named tool, never silent. The buckyball carries euler / double-count /
  three-regular / self-door as live in-file laws; a sabotaged constant fails the geometry gate.
- **`prereq <name> <where-to-start>`** — the craft-school road in (Euler from the cube up;
  truncation; rooms-and-doors).
- **`edge <relation> <target> <why>`** — the related-shapes graph (DV2 links between cartridges).
- **`issue <name> <owner> <status> <desc>`** — outstanding work named in-file, never hidden (the
  buckyball declares its schematic-not-full-Schlegel render and the owed math tear-down).
- **sign-offs** — the treaty block grows registers: `treaty math-team math pending` (sign-off is
  THEIRS to write, not ours to assume) — and **`treaty aaron meaning ratified`**: the first
  render-loop ratification by a human traveler, his words in the line.

## Honest answers to the format questions

Readable in all langs: yes structurally (tab-split lines) — full MediaLines ports to TS/C#/Rust
are a NAMED SLICE, not done. Frontmatter: `meta` lines. Parameters: `constant` lines + gen args.
Homoiconicity: the file now carries its laws, its lineage (prereq/edge), its debts (issue), and
its ratifications — the remaining gap is **chip-level loading** (CHIP-9 loading `.lines` directly:
named slice — the rom kind already carries hex; the loader is the missing piece).

## Pointers

- `src/Core/CartridgeLaw.fs` · `src/Core/MediaLines.fs` (new kinds + lint) ·
  `shapes/cartridges/buckyball.lines` (the fully self-describing exemplar)
- Named slices: chip9 cartridge loader · MediaLines ports (TS/C#/Rust) · full Schlegel projection
