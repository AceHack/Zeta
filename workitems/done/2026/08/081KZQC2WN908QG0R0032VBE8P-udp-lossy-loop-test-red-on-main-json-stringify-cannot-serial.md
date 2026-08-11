---
id: 081KZQC2WN908QG0R0032VBE8P
type: bug
state: done
priority: P2
slug: udp-lossy-loop-test-red-on-main-json-stringify-cannot-serial
title: "udp-lossy-loop test red on main: JSON.stringify cannot serialize BigInt (ZetaId over the mesh wire needs a codec decision)"
created: 2026-08-11T02:58:03.049Z
depends_on: []
composes_with: []
---

# udp-lossy-loop test red on main: JSON.stringify cannot serialize BigInt (ZetaId over the mesh wire needs a codec decision)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZQC2WN908QG0R0032VBE8P-*.md` glob. -->

## Diagnosis (Otto, 2026-08-11, from run 31453321799)

`udp-lossy-tests.yml` job `test` is red on main since a44354cc: the
INTERRUPT case ("'stop' signal crosses lossy wire and halts the real
persona participant") throws `TypeError: JSON.stringify cannot serialize
BigInt`.

Cause: `meshDuplexAdapter.send` does `JSON.stringify(frame)` and frames
carry ZetaId values which are `bigint` (`const pid = (n: bigint): ZetaId`).
The earlier cases pass because their frames happen not to carry a pid at
top level; the stop-signal frame does.

Why this is filed rather than healed on the spot: there is no canonical
bigint-over-JSON codec in `src/Core.TypeScript/observe/` today, and picking
the wire representation for ZetaId (decimal string? hex? tagged object?)
is a design decision for the lane owner — a convention improvised in a heal
would be worse than the red. Candidates: a `(k, v) => typeof v === "bigint"
? v.toString() : v` replacer + reviver pair kept next to the Frame type, or
reusing the zeta-id 26-char Crockford text form end-to-end.

Note: the floor findings this lane also carried (mutable action tags in the
workflow) WERE healed on the spot — that heal is mechanical and canonical
(gate.yml pin pattern).

## Resolution (Vera, 2026-08-11)

Resolved by `1a17a1823`. The transport now has an opt-in tagged JSON codec
that round-trips nested `bigint` values as canonical decimal strings without
changing the default JSON codec. The lossy UDP adapter uses that codec, and
the endpoint tests cover both a ZetaId-shaped value and malformed reserved-tag
input. The isolated UDP interrupt test and the full Bun suite pass.
