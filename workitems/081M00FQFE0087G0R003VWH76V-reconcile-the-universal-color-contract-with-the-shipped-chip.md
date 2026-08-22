---
id: 081M00FQFE0087G0R003VWH76V
type: task
state: backlog
priority: P2
slug: reconcile-the-universal-color-contract-with-the-shipped-chip
title: "Reconcile the universal color contract with the shipped CHIP-9 bindings — universal/color.md still says CHIP-8 is Mono1 'not yet', and three display edges carry three independent palette tables with no single source"
created: 2026-08-14T15:54:53.248Z
depends_on: []
composes_with: []
---

# Reconcile the universal color contract with the shipped CHIP-9 bindings

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00FQFE0087G0R003VWH76V-*.md` glob. -->

Two findings, both **checked against `origin/main` @ `d55305bb` on 2026-08-14** by reading the files,
not by recalling them. Neither is a behaviour bug; both are a written contract that has drifted behind
the code that implements it.

## Finding 1 — `universal/color.md` describes the CHIP-8 binding as unbuilt; it shipped

`universal/color.md` line 32 still carries:

| surface | capability today | the upgrade path |
|---|---|---|
| CHIP-8 | `Mono1` (64×32, 1-bit) — **"not yet"** | **color opcode extensions, original-compatible** … |

That "upgrade path" column is now **the built thing**, and has been since 2026-06-11/13:

- `src/Core/Chip8Cow.fs` — `Plane: byte` (bit0=R, bit1=G, bit2=B), `Fn01` plane select, per-plane
  `DRW`, selective `CLS`; mono is the *structural zero case* (`Plane = 1uy` default), not a mode.
- Four-oracle conformance: `src/Core.TypeScript/chip9/chip9.ts` · `src/Core.CSharp/Chip9Machine.cs` ·
  `src/Core.Rust.Chip9/src/lib.rs`, all replaying
  `src/Core.TypeScript/chip9/golden-vectors.lines` (text golden vectors, DRW clip semantics locked).
- `src/Core/ZetaMax.fs` — the honest-capability render binding, whose `Capability` is
  `Mono1 | Indexed8`, dispatched off the frame's own state (`Map.isEmpty f.Extra`).
- Tests: `tests/Tests.FSharp/Chip9Planes.Tests.fs`, `Chip9Treaty.Tests.fs`,
  `tests/Tests.CSharp/Chip9CrossVerifyTests.cs`, `src/Core.Rust.Chip9/tests/golden_vectors.rs`.

There is also a **type-level disagreement** between the doc and its one implementation: the doc's
`Capability` is `Mono1 | Grey<n> | Indexed<palette> | TrueColor`; `ZetaMax.Capability` is
`Mono1 | Indexed8`. One of the two is the contract; today neither says which.

**Scope:** update `universal/color.md`'s binding table + `Capability` line to state what is built,
and to name the still-unbuilt columns as unbuilt. Nothing in `src/` needs to move for this half.

## Finding 2 — one 3-bit gamut, three tables, two of them disagreeing, none of them golden

The mask→colour mapping is defined independently in three places:

| site | form | table |
|---|---|---|
| `src/Core/ZetaMax.fs` `colorName` / `fg` / `bg` | names + ANSI SGR (`30 + mask`) | black red green yellow blue magenta cyan white |
| `src/Core/ShapeRender.fs` `colorHex` | hex | `#000000 #d62828 #2a9d2a #d6c828 #2828d6 #d628d6 #28c8d6 #f0f0f0` |
| `demo/chip9-cart-viewer.html` `PALETTE` | hex | `#000000 #e11d48 #10b981 #f59e0b #3b82f6 #d946ef #06b6d4 #f8fafc` |

The **semantics agree** (same hue per mask, same bit order, R=1 G=2 B=4 = ANSI's 3-bit order — that
identity is the whole reason the ZetaMax binding is nearly free). The **bytes do not**: the two hex
tables are different palettes for the same eight slots. `ShapeRender.colorHex`'s own comment calls
itself "the ZetaMax Spectrum palette", but `ZetaMax.fs` carries no hex at all, so that claim has
nothing to be checked against — an unverifiable in-code anchor, which is exactly the class the Beacon
discipline exists to catch.

**Not asserted here:** that either hex table is wrong. Display-edge palettes may legitimately differ
(a terminal SGR, an SVG stroke, and a web swatch are three different media). What is missing is a
*declared* source and a golden vector — so that a future edit to one table is a visible divergence
rather than a silent one.

**Constraint a fixer must know before touching `ShapeRender.colorHex`:** `db/shapes/golden/*.svg`
and `*.html` are byte-locked against the current hexes (`#d62828` appears in the committed goldens).
Changing that table churns every golden, and the goldens are regenerated-never-edited. So the cheap
move is almost certainly to make the mask→(name, SGR, hex) table one declared thing with the
*existing* `ShapeRender` hexes, and align the viewer to it — not the reverse.

## Not in scope (named so nobody widens this silently)

- `db/shapes/` cartridge promotion and `ShapeRender.strokesOf` / `ShapeAcceptance.geometryLaw` —
  another agent is live on `db/shapes/cartridges/pending/` as of 2026-08-13/14.
- Emitting a shape cartridge as a CHIP-9 ROM. The two cartridge families already share the
  `MediaLines` container, the 64×32 court, and the 3-bit plane mask, but their back ends are
  disjoint (`ShapeRender` → SVG/HTML; `Chip8Cow`/`ZetaMax`/`chip9.ts` → frame → ANSI/pixels).
  That bridge is a real, separate, larger piece of work and is **not** filed here.

## Anchors

- Sinclair ZX Spectrum (1982) — the 8-colour set the palette is named for.
- ECMA-48 / ANSI X3.64 SGR — `30 + mask` is the arithmetic identity `ZetaMax` rides.
- John Earnest, XO-CHIP — the plane-opcode precedent CHIP-9 follows (strict superset; mono ROMs
  unchanged). Joseph Weisbecker, COSMAC VIP (1977) — the DRW clip reference the goldens lock.
