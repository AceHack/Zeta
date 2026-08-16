---
id: 081M00J1EWW087G0R000RJ6790
type: bug
state: done
priority: P2
slug: actorref-invalid-vector-class-is-hand-copied-per-oracle-not
title: "ActorRef invalid-vector class is hand-copied per oracle, not a shared cross-verification vector file"
created: 2026-08-14T16:35:17.532Z
completed: 2026-08-15T22:52:05.512Z
depends_on: []
composes_with: []
---

# ActorRef invalid-vector class is hand-copied per oracle, not a shared cross-verification vector file

## The symptom that was fixed, and the cause that was not

The symptom (fixed separately, same PR): `parseSpiffe` in
`src/Core.TypeScript/identity/actor-ref.ts` accepted 4 of the 7 strings in its own
`INVALID_VECTORS` list, while `ActorRef.parseSpiffe` in `src/Core/ActorRef.fs` rejected
all of them. Two oracles, opposite verdicts, on the peer-facing identity door.

**The cause is that the invalid-vector class exists twice, hand-copied, and nothing
compares the copies:**

| Where | Form |
|---|---|
| `src/Core.TypeScript/identity/actor-ref.ts` | `INVALID_VECTORS` — a TS `const` |
| `tests/Tests.FSharp/ActorRef.Tests.fs` | a re-typed F# list, plus four *extra* SPIFFE cases the TS side never had |

The F# test carries `spiffe://zeta/persona/otto/cell/COWORK` and
`.../cell/cli/fg@UPPER`; the TS side had neither, and had no SPIFFE rejection test at
all. Nobody wrote them down in one place, so one side grew cases and the other did not,
and the drift was invisible to both test suites — each was green against its own copy.

## Why this is the repo's own solved problem, applied everywhere except here

`tests/cross-verification/` already holds ~25 primitives (`blake3-256`, `ed25519`,
`fmix64`, `modulo-gset`, `zset-merkle`, …), each with a single `vectors.yaml` /
`vectors.json` that **every** oracle reads. That is the established remedy and it is
exactly the `no-binary-in-proof-lineage` shape: the vectors are text, diffable, and
shared rather than restated.

**`ActorRef` is not one of them** — despite being the identity primitive, and despite
`actor-ref.ts` carrying a comment that says the invalid class is what "every oracle port
(F# ActorRef.fs, future langs) MUST reject."  The doctrine is written down in the file
whose vectors are not shared.

## Proposed shape

Add **tests/cross-verification/actor-ref/vectors.json** carrying both classes — the golden
(valid) vectors with their canonical string + SPIFFE projections, and the invalid class
with the *door* each must be rejected at. Have the TS test and `ActorRef.Tests.fs` both
read it instead of restating it. Then a vector added for one oracle is automatically
binding on the others, which is the property that was missing.

**The check that makes it non-vacuous:** adding a vector to the shared file with no
implementation change must turn some oracle red. If a new vector can be added and
everything stays green, the file is decorative and this work-item is not done.

## Deliberately not done in the fixing PR

Wiring the shared file touches `tests/Tests.FSharp/` and the `_harness` conventions in
`tests/cross-verification/`, which is a wider blast radius than the parser fix and has an
established harness pattern worth following rather than improvising. The parser fix
closes the live divergence; this closes the class.

## Evidence

- 759/1879 corpus inputs changed verdict on `parseSpiffe` after the fix — all in the
  tightening direction, 0 loosened, 0 altered.
- `parse` was unchanged on all 1879 (it was already correct; only the SPIFFE door drifted).
- F# `ActorRef` tests: 6/6 pass on `origin/main`, including
  `Invalid SPIFFE vectors — same rejection class through the URI port`. The F# oracle was
  right the whole time.

## Pointers

- `src/Core.TypeScript/identity/actor-ref.ts` · `src/Core/ActorRef.fs`
- `tests/cross-verification/` — the pattern to follow
- `.claude/rules/no-binary-in-proof-lineage.md` — text vectors, shared and diffable
- `docs/writer-actor-routing-model.md` — a bus address is not identity; this is the parser
  for the address half

## Resolution (2026-08-15)

`tests/cross-verification/actor-ref/vectors.json` is the invalid class. TS
`INVALID_VECTORS` / `INVALID_SPIFFE_VECTORS` are projections of that file by
`door`. F# `ActorRef.Tests` reads the same file. Adding a row with no parser
change turns the matching oracle red.
