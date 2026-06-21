---
id: 081KTGYWCTT08QG0R001G96DXY
type: task
state: done
priority: P1
slug: b-0969-cross-language-collation-c-rust-ts-ordinal-audit-non
title: "081KT07NV0008QG0R001YDB73K cross-language collation: C#/Rust/TS ordinal audit + non-ASCII golden-vector regen (un-mask the ASCII fixtures)"
created: 2026-06-07T11:53:23.034Z
completed: 2026-06-14T02:55:11.663Z
depends_on: []
composes_with: ["081KT07NV0008QG0R001YDB73K"]
---

# 081KT07NV0008QG0R001YDB73K cross-language collation: C#/Rust/TS ordinal audit + non-ASCII golden-vector regen (un-mask the ASCII fixtures)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGYWCTT08QG0R001G96DXY-*.md` glob. -->

## Purpose (suggested owner: LIOR)

Bring the non-F# oracles into line with the F# binary/ordinal collation fix (081KT07NV0008QG0R001YDB73K) and un-mask the ASCII
golden vectors. The F# `src/Core` ordering audit is COMPLETE (GSet/ZSet/IndexedZSet/Hierarchy/Residuated/
Aggregate now ordinal; Bag already was). The other three languages + the shared vectors are the remaining
legs.

## Scope

- **C# audit:** ensure GSet/ZSet/Bag/IndexedZSet (+ aggregates) order strings via `StringComparer.Ordinal`
  (C# G-Set #6363 already takes a comparer — verify the rest); no bare `Comparer<string>.Default` /
  `String.Compare` / `ToLower`/`ToUpper` (use `*Invariant`). Consider the `CA1304/1305/1307/1310` analyzers
  at error in `Directory.Build.props` (Otto's probe was inconclusive — needs a proper ruleset wire-up).
- **Rust:** confirm `Ord`/byte order (already ordinal) — mostly verification + a note.
- **TS:** confirm `<` / `compare` is code-unit (locale-independent); resolve the UTF-16-vs-codepoint astral
  caveat to the treaty order (codepoint ≡ UTF-8 byte order).
- **Non-ASCII golden-vector regen:** regenerate the G-Set / Bag / Z-set shared golden vectors with non-ASCII
  keys so the 4-oracle byte-consensus exercises ordinal (ASCII fixtures currently MASK divergence); remove
  the "known gap" notes in `src/Core.TypeScript/{g-set,bag}/golden-vectors.json`.

## Acceptance

All four oracles agree on ordinal ordering over non-ASCII keys in the shared vectors; the masking "known
gap" notes removed; C# globalization analyzers enforced (or a documented reason if deferred).

## Anchors

- 081KT07NV0008QG0R001YDB73K (the standing rule + the completed F# fix) · `.claude/rules/culture-invariant-by-default.md` ·
  `src/Core.TypeScript/{g-set,bag}/golden-vectors.json` (the masked fixtures) · 081KSXN940008QG0R003FCQ7WT (4-oracle checklist).
