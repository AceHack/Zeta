---
id: 081M0DN91RK087G0R002X8MBWM
type: bug
state: done
priority: P2
slug: state-du-glyphs-collide-across-claim-classes-cold-unobserved
title: "State DU glyphs collide across claim classes: cold/unobserved and stale/sealed reduce to the same mark"
created: 2026-08-19T18:41:59.571Z
completed: 2026-08-19T20:32:04.254Z
depends_on: []
composes_with: []
---

# State DU glyphs collide across claim classes: cold/unobserved and stale/sealed reduce to the same mark

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DN91RK087G0R002X8MBWM-*.md` glob. -->

Detected by `bun src/Core.TypeScript/hygiene/audit-visual-confusability.ts` (TIER 1), baselined
there against this id. Analysis: `docs/design/2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md` §6.

## The defect

`src/Core.TypeScript/cluster/state-du.ts` assigns eight glyphs, six of them circles. Two pairs
reduce to the same mark under the perceptual quotient in
`src/Core.TypeScript/hygiene/visual-skeleton.ts`, and **both pairs cross the observation/withheld
claim-class boundary**:

| pair                  | glyphs                  | skeleton       | claim classes           |
| --------------------- | ----------------------- | -------------- | ----------------------- |
| `cold` / `unobserved` | `○` U+25CB / `◌` U+25CC | circle/empty   | observation vs withheld |
| `stale` / `sealed`    | `◐` U+25D0 / `◍` U+25CD | circle/partial | observation vs withheld |

The colour channel and the texture channel both protect this boundary. The glyph channel breaks it,
and does so silently — everywhere the glyph appears beside its colour the other channels cover for
it, so the defect is invisible on exactly the surfaces it is easiest to check.

**Semantic cost.** `cold` means "watched, and nothing is there" — an OBSERVATION. `unobserved` means
"no measurement was written here" — WITHHELD. Reading one as the other **mints an observation nobody
made**, which is the failure the CSS fail-safe (`unknown reads cold, never live`) exists to prevent,
reintroduced in a different channel.

`state-du.test.ts:128` does not catch it: it asserts glyph uniqueness by **codepoint**. U+25CB and
U+25CC are different strings and the same ring.

## The fix (a lookup, not a debate)

Give the withheld register its own base form. Capacity argument in the analysis doc §3: base-form
separation is scarce and must be spent on the claim-class boundary.

| member       | claim    | now                           | proposed                                            |
| ------------ | -------- | ----------------------------- | --------------------------------------------------- |
| `unobserved` | withheld | `◌` DOTTED CIRCLE             | **`□` U+25A1 WHITE SQUARE**                         |
| `sealed`     | withheld | `◍` CIRCLE WITH VERTICAL FILL | **`▩` U+25A9 SQUARE WITH DIAGONAL CROSSHATCH FILL** |

Everything else unchanged. `heat` `◆` and `unavailable` `∅` are already correctly separated (a
distinct base form; a full-diameter strike). Result: zero cross-class collisions, one remaining
within-class warning (`sealed` ▩ / `frost` ▨, both square/partial), which is correct grading — both
are withheld claims and their textures differ (hatch vs blur).

## Blast radius (four surfaces — this is why it was not landed with the guard)

- `src/Core.TypeScript/cluster/state-du.ts` — the table
- `src/Core.TypeScript/cluster/state-du-css.test.ts` — asserts `◍` in the Settlement markup
- `docs/design/root-site-iris/Settlement.dc.html` — authoring source, contains `◍`
- the shipped site markup under `docs/design/root-site-iris/site/`

Iris is advisory on the shipped DU surfaces; this wants the DU owner's eyes. `▩` and `□` are both
Geometric Shapes block, same coverage class as the glyphs they replace — check font fallback on the
shipped page before merging, since a substituted glyph comes from a different font and can change
apparent weight and size.

## Done when

The audit reports zero TIER 1 errors and the corresponding `KNOWN_OPEN` lines are deleted from
`audit-visual-confusability.ts` (the audit fails on a stale baseline line, so this is enforced).
