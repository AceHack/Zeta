# `pending/` — cartridges written, not yet earned

A cartridge in this folder is a **complete, lint-clean `.lines` file that has not passed the
catalog's gates**. It is deliberately one directory below `db/shapes/cartridges/`, because the
suite's catalog laws read `Directory.GetFiles(cartridges, "*.lines")` — top level only. A pending
cartridge therefore ships, diffs, and can be read and argued with, **without** claiming a
ratification it does not have or forcing a green tick it has not earned.

This is the same shape as `toy` / `unmetered` / `metered`: the free thing is the default, and the
promotion is earned with nameable evidence.

## Why these three exist

`braid.lines` and `crossing.lines` already encode the distinguishing facts — `constant stuck 1`
("the locked word is NOT the identity braid"), the over/under occlusion gap resolved into the ink
on 2026-06-12, `law memory-at-smallest` (σ² ≠ 1). **What was missing is the CONTRAST.** A braid
diagram shows someone a braid; it cannot show them what a braid is *not*, because a contrast needs
two panels.

| cartridge | the contrast it draws | the thing it refuses |
|---|---|---|
| `symmetric-vs-braided.lines` | one word (σ·σ), two categories, visibly different output | that the permutation can tell a braid from a swap — it cannot; both end with every strand home |
| `traced.lines` | a feedback wire that bends back and crosses **nothing** | that a returning wire is a crossing; traced ⇏ braided, and the two are independent structures |
| `twist.lines` | a framed ribbon carrying a 2π turn beside a bare strand | that a 1-dimensional strand can hold a twist — it has nowhere to put one |

`symmetric-vs-braided` is the highest-value of the three for one reason: **the picture is the
proof.** Two panels of the same word are the whole content of `braidR_not_symmetric_perm3` and
`selfBraiding_comp_eq_id` (`src/Core.Lean4/Lean4/MenoBraidedRMatrix.lean`), which is the rare case
where a drawing and a machine-checked theorem carry the same information.

## The promotion gate — what must be true before a file moves up one directory

Each is a real gate in code, not a checklist someone maintains by hand.

1. **A registered generator.** `GeneratorRegistry.known` needs `register "shape.<name>" 1`, and
   `ComplexityRegistry.declared` needs its cost row (`unstated ()` is asserted empty shelf-wide).
   The `meta shape-zetaid` in each file is **already** the content-address that registration will
   produce — `idOf "shape.<name>" 1`, derivable, not minted-and-forgotten — so registration cannot
   silently disagree with the cartridge. Then the file gets its `gen` + `anim` lines.
2. **Stroke code.** `ShapeRender.strokesOf` needs a branch for the shape's `meta name`. Without one
   the cartridge renders an empty SVG, which is why no goldens are committed here: hand-writing the
   SVG would break the single-source rule (`the cartridge is the single source; SVG/HTML are
   regenerated, never edited`) and the golden-lock test that enforces it.
3. **A known-answer geometry law.** `ShapeAcceptance.geometryLaw` needs a case. The default is
   `false, "no known-answer law for this shape — geometry cannot be accepted on looks"`, and that
   default is correct: these three should stay out until a computation, not an eye, accepts them.
   Each file's `issue geometry-law` states the law to write, and each already carries the integer
   half in-file (`law` lines the tiny `CartridgeLaw` evaluator checks today, in any oracle language).
4. **Goldens.** `zeta shape render <file> svg|html` into `db/shapes/golden/`, once (1)–(3) hold and
   the gate stops refusing. Never by hand.
5. **The treaty block — and this one is nobody else's to write.** The catalog law requires
   `treaty fsharp bytes ratified` and `treaty otto meaning ratified`. **These files carry no treaty
   rows at all, on purpose.** `bytes` belongs to the F# oracle once the suite is actually green;
   `meaning` belongs to each traveler from their own frame. A treaty line written by anyone but its
   owner is a forgery of consent, not paperwork — and consent-first is a manifesto spec (§6), not a
   convention.
6. **The count.** `ShapeCartridge.Tests` asserts the catalog size (`19` today). It moves when a file
   moves, and not before.

Steps 1–4 are engineering anyone can do. Step 5 is the one that is *supposed* to be slow.

> **Correction, 2026-08-14 (otto), found by trying it.** Steps 4 and 5 are listed in the wrong
> order, and the ordering is not a matter of taste — it is enforced. `zeta shape render` calls
> `ShapeAcceptance.accepted`, which is `bytes ∧ geometry ∧ honest-labels`, and refuses to emit
> anything for a cartridge that fails it (`Program.fs` `shapeRender`, exit 3). `bytes` is a treaty
> row. So **goldens sit behind the consent gate, not before it**: 1–3 are the engineering anyone can
> do, then 5, then 4. There is no honest way to close 4 first — hand-writing the SVG is already
> forbidden above, and loosening the CLI gate to get a golden out would be weakening a
> consent-linked check to make one's own work look finished. `symmetric-vs-braided` is parked at
> exactly this line: gates 1–3 closed, gate 4 blocked *by* gate 5, and gate 5 unasked.

## Reading them without a renderer

Every claim in these files is either an integer identity the file itself carries (`law` lines with
`+ - *` and one `=`, checkable in a screen of code in any language) or a delegation naming a real
checker — `lean:` for the machine-checked Lean theorems, `code:` for laws already gated elsewhere in
the suite. Nothing is delegated to a tool that does not exist; `CartridgeLaw` refuses that on an
allowlist, calling it what it is ("delegation to nowhere is evasion").

Where a claim is genuinely **open**, it is an `issue`, not a `law`. `twist.lines` is the live case:
whether our conjugation-rack braiding admits a non-trivial twist is out for external review as of
2026-08-13 (`docs/handoffs/2026-08-13-meno-braid-brief-for-manus.md` §5), so the cartridge draws
*why a bare strand cannot hold a twist* and does **not** claim where the ladder stops.
