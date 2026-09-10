---
id: 081M23P7JDA087G0R003MM6MM9
type: bug
state: backlog
priority: P2
slug: codegen-interface-identity-replacement-chains-hid-a-rust-and
title: "codegen-interface identity-replacement chains hid a Rust and Go void miscompile"
created: 2026-09-09T18:17:38.986Z
depends_on: []
composes_with: []
---

# codegen-interface identity-replacement chains hid a Rust and Go void miscompile

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23P7JDA087G0R003MM6MM9-*.md` glob. -->

## The alert class

CodeQL `js/identity-replacement`, 10 open alerts (numbers 537-546), all in
`tests/cross-verification/_harness/codegen-interface.ts`. Each is a link in a
chained `String.prototype.replace` that maps a token to ITSELF —
`.replace(/\bint\b/g, "int")`, `.replace(/\bbool\b/g, "bool")`, and so on.

## Why the dead links were more than cosmetic

Seven functions mapped IR type names to a target language by CHAINING
`.replace` calls. A chain is order-dependent: every later pattern re-scans the
OUTPUT of every earlier one, so mapping `int64` to `int` and then `int` to
`long` silently yields `long` for `int64`. Nothing here tripped that, but
nothing prevented it either.

The identity links made the chains LOOK exhaustive. `goType` enumerated four
tokens, all four mapping to themselves, which reads as a complete mapping and is
in fact the identity function. That appearance is what hid the actual defect:

- `RUST_TYPES` had no `void` row, so every void-returning IR member emitted
  `-> void;`. `void` is not a Rust type; the emitted trait does not compile.
- `GO_TYPES` had no `void` row, so the same members emitted `) void`. A Go
  method that returns nothing omits the result type entirely.

Twelve members across four committed IR fixtures (`database`, `port`, `zset`,
`zset-isa`) emitted invalid Rust and invalid Go. C#, TypeScript, Python and Q#
were correct — the first two because `void` is genuinely their spelling, the
last two because their chains DID carry a void row.

## Disposition

Fixed, not dismissed.

1. The seven chains become seven declared `TypeMap` data tables applied by one
   `applyTypeMap` pass. A single pass cannot cascade, so order-independence is
   structural rather than a fact about the current ordering.
2. `RUST_TYPES` gains `void -> ()`; `GO_TYPES` gains `void -> ""` and the Go
   emitter appends the result type only when it is non-empty.
3. `codegen-interface-golden.json` byte-locks all 7 emitters over all 17
   committed IR fixtures (text in JSON, per `no-binary-in-proof-lineage.md`).
   The refactor was proved behaviour-preserving by regenerating the vectors
   before and after and diffing: byte-identical over 119 emissions. The void fix
   is then the ONLY behavioural delta, and it is 8 vectors wide in the diff.

## Falsifiers, and what mutation found

In `codegen-interface.test.ts`:

- `applyTypeMap does not cascade, and a chain would` — asserts both the correct
  result AND that the chain it replaced disagrees, so it cannot go vacuous.
- `key declaration order cannot change the result` — reverses every static map.
- `longer keys win over their own prefixes`.
- `a key a word boundary cannot anchor is REFUSED` — a map entry that can never
  fire is the vacuity class, so a non-bare-word key throws.
- `which IR primitives each language leaves unmapped is PINNED`.
- the void-spelling block, per language.
- the golden byte-lock, plus a non-vacuity check on the lock itself.

Three mutations were run against them:

| mutation | killed by |
|---|---|
| drop both `\b` anchors from the pattern | 3 tests |
| remove `void` from `RUST_TYPES` | 3 tests |
| Go emitter always appends the return type | 2 tests (1 before the fix below) |

A FOURTH mutation SURVIVED and changed the code: a longest-first key sort was
written into `applyTypeMap`, and reversing it to shortest-first changed no
result. The word boundaries had already decided every prefix case by
backtracking. The sort was dead code — the same defect class this work-item is
about — so it was removed rather than kept as decoration.

The Go mutation initially escaped the unit test and was caught only by the
golden byte-lock (the mutant left a trailing space). The unit assertion is now
anchored to the exact emitted line.
