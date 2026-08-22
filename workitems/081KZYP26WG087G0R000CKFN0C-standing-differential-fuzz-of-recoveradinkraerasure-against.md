---
id: 081KZYP26WG087G0R000CKFN0C
type: task
state: backlog
priority: P2
slug: standing-differential-fuzz-of-recoveradinkraerasure-against
title: "Standing differential fuzz of recoverAdinkraErasure against the ML decoder, plus structure-aware fuzzing of the packet wire format with fast-check and Jazzer.js"
created: 2026-08-13T23:07:07.536Z
depends_on: []
composes_with: []
---

# Standing differential fuzz of recoverAdinkraErasure against the ML decoder, plus structure-aware fuzzing of the packet wire format with fast-check and Jazzer.js

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYP26WG087G0R000CKFN0C-*.md` glob. -->

Filed 2026-08-13 by Mateo (security-researcher) from the research sweep over PR #10417.

## Why: the 0/56 finding was made by a differential comparison that is currently a one-off

`UCH-7` enumerates all 56 three-erasure patterns and compares `recoverAdinkraErasure` against the
GF(2) ML decoder. That is a **differential oracle**, and it is the strongest test in the suite —
it does not assert an expected output, it asserts *agreement with a reference*, so it stays
correct as the code changes. But it is written as a fixed enumeration at one block size with one
payload, and the ML decoder lives in the harness rather than in a reusable oracle position.

## Three fuzz targets, in order of expected yield

### 1. Structure-aware fuzz of the wire format — HIGHEST YIELD, already proven

`ULT-11` round-trips one well-formed packet. Nothing tests `decodePacket` against a **hostile**
buffer. The unbounded-NACK defect (`081KZYP1S96087G0R002G8XQZP`) is a header-field-range bug that
a 20-line `fast-check` property would have found on its first run:

```
fc.assert(fc.property(arbHeader, arbPayload, (h, p) =>
  decodePacket(encodePacket(h, p)) round-trips, and no field outside its declared range is accepted))
```

Specifically unvalidated today: `seq` (any u32 — the DoS), `blockPos` (any u8, never checked
against 0..7 — currently silently misclassified as a duplicate rather than rejected), and
`payloadLen` (bounded against the buffer, but only there).

Also worth a property: `decodePacket` returns `new Uint8Array(buf.buffer, buf.byteOffset + 16, …)`
— a **view aliasing the underlying pool**, not a copy. `handleIncoming` happens to copy before
storing; any other caller of this exported function does not, and would observe its payload
mutate underneath it. That is a latent aliasing bug a fuzz harness reusing buffers would expose.

### 2. Standing differential fuzz: shipped decoder vs ML decoder

Promote `UCH-7` from an enumeration to a property over random `(erasure pattern, payload,
payload length)`, with the invariant stated as a one-way implication so it survives the fix:

> If the ML decoder recovers a block byte-exactly, the shipped decoder must either recover it
> byte-exactly **or** return `null` — it must never return *wrong bytes*.

That invariant is the one that matters and it holds both before and after
`081KZYN3B79087G0R0014ZKE3C` lands; only the *rate* of the `null` branch changes. Add a metric
assertion on the rate so the fix is visible without the test being a pin that must be edited.

### 3. Differential fuzz of the encode/decode pair across the four oracles

The [8,4,4] generator also exists in `AdinkraCode.fs`. A cross-oracle differential — same random
data, same parity bytes — is the repo's standard byte-lock discipline applied to this code, and
belongs in `golden-vectors` form (hex-in-JSON, per `no-binary-in-proof-lineage`).

## Tooling that fits a Bun/TS repo

- **`fast-check`** (dubzzz) — property-based testing in TypeScript, QuickCheck lineage, already
  the natural fit: it is pure TS, runs under `bun test`, and its shrinker turns a failing random
  buffer into a minimal one. **This is the right default for all three targets above.**
- **`Jazzer.js`** (Code Intelligence) — coverage-guided, in-process, libFuzzer-based fuzzing for
  Node.js; works on anything transpiled to JS. Worth it *only* for target 1, and only if
  coverage guidance is wanted over `fast-check`'s generators. **Cost: it is a Node/libFuzzer
  toolchain, not a Bun one** — adding it means a second runner in CI. Do not pay that until
  `fast-check` stops finding things.
- Structure-aware framing (Padhye/Lemieux's JQF line): byte-level mutators produce mostly-invalid
  inputs against a structured format; generator-based structure-aware fuzzing produces valid-by-
  construction inputs and reaches deeper. For a 16-byte fixed header, `fast-check` generators
  *are* the structure-aware approach.

## Discipline

Fuzz seeds must be recorded and replayable (§7 DST) — `fast-check`'s `seed`/`path` output
satisfies this; a failing case must be pinned as a regression with its seed, not left to
rediscovery.
