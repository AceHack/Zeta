---
id: 081KTQXFPTQ08QG0R002BD36HC
type: task
state: completed
priority: P1
slug: zetaid-generation-dst-room-byte-lock-the-workitem-v1-zetaid
title: "ZetaId-generation DST room — byte-lock the WorkItem-V1 ZetaId across all oracles: F#/C#/TS/Rust 4-lang + MUMPS + bit oracles + compiler oracles; add the missing WorkItem(cat 8)-V1 cross-verify vector, regenerate every oracle output, save the test results (Aaron 2026-06-10)"
created: 2026-06-10T04:43:39.735Z
depends_on: []
composes_with: []
---

# ZetaId-generation DST room — byte-lock the WorkItem-V1 ZetaId across all oracles: F#/C#/TS/Rust 4-lang + MUMPS + bit oracles + compiler oracles; add the missing WorkItem(cat 8)-V1 cross-verify vector, regenerate every oracle output, save the test results (Aaron 2026-06-10)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTQXFPTQ08QG0R002BD36HC-*.md` glob. -->

> **Aaron, 2026-06-10:** "make sure all 4 languages generate the same id for this and save the test results"
> · "build a room around a zetaid generate test around MUMPS in all 4 languages" · "need the bit oracles too"
> · "compiler and bit oracles on this one." · "use the existing workitem zetaids generator mini program"
> (this item was minted by `tools/backlog/new-workitem.ts`, Category.WorkItem V1 — the governed common
> generator; no hand-rolled id).

## Audit result (done — the prompt for this item)

- ✅ `tools/backlog/new-workitem.ts` mints via the **canonical common ZetaId generator** — it imports
  `pack`/`format` from `src/Core.TypeScript/zeta-id` and builds a `ZetaObservation { version: 1,
category: Category.WorkItem, chromosome MetaCoherence, firefly NoDirective, authority Standard,
momentum Normal, location 0 }`. **V1 + WorkItem confirmed.** Not a hand-rolled base32.

- ✅ The 4-language byte-lock is **currently GREEN**: `tests/cross-verification/zeta-id/compare.ts` →
  "All implementations agree on **12 vectors**" (TS/F#/C#/Rust).
- ⚠️ **Gap:** all 12 existing vectors are category **0 (Observation)** or **3 (Heartbeat)** — there is **no
  WorkItem (category 8) V1 vector**. The exact id type new-workitem.ts mints is **not yet byte-locked**.

## The room (build it)

A **DST room** (rooms/ — a bounded, replayable treaty/test cell; hat-governed) around **ZetaId generation**,
seating **every oracle** on the WorkItem-V1 case:

1. **The 4 language oracles** — F#, C#, TS, Rust each generate the WorkItem-V1 ZetaId from the same
   `ZetaObservation` (fixed timestamp + randomness via the injected env, DST-deterministic) and must emit a
   **byte-identical** id.
2. **MUMPS** — a **fifth oracle**: a MUMPS routine generates the same ZetaId (the bit layout over MUMPS
   integers/globals), byte-locked to the other four. (The room "around MUMPS" Aaron asked for — MUMPS as a
   first-class oracle of the generator, and the gitfs/global substrate the room runs over.)
3. **Bit oracles** — the **bit-perfect** verification layer: assert the 128-bit layout field-by-field
   (version 5b / timestamp 48b / chromosome 5b / category 4b / firefly 1b / authority 5b / persona 8b /
   momentum 8b / location 8b / randomness 32b) is identical across oracles — not just the final hex, the
   **bits**. (The three-bit-perfect-oracle-shapes discipline; `BitAdinkra`/Gates-ECC anchor.)
4. **Compiler oracles** — verify the id is identical **across compilers/toolchains** (the host→compiler→OS
   closure): same F# under different .NET, same Rust under different rustc, etc. — the id must not depend on
   the compiler (Trusting-Trust closure; ties to the ace declarative host→compiler→OS dep graph).

### Deliverables

- **Add the WorkItem(cat 8)-V1 vector** to `tests/cross-verification/zeta-id/vectors.yaml` (fixed
  timestamp + randomness so it's deterministic).
- **Regenerate every oracle output** via the per-language emitters (NOT hand-written hex — each oracle
  computes it) so `compare.ts` proves all agree on the new vector; extend compare.ts to include MUMPS + the
  bit-field oracle + the compiler-matrix.
- **Save the test results** (the cross-verify output + the bit-field table + the compiler matrix) as the
  room's golden record (text golden vectors — hex-in-JSON, no binary; the no-binary-in-proof-lineage rule).
- Wrap it as a **room** under `rooms/` (Max's domain — co-design): bounded DST tick, hat-governed,
  judged on agreement (a mismatch = a P0 byte-lock break).

## Honest scope / peels

- **No hand-faked hex.** Each oracle must _compute_ the id; faking outputs defeats the byte-lock. The
  emitters do the work; I located the comparator (`compare.ts`) and the pre-generated `*-output.json`, not
  yet the per-lang regen entrypoints — finding/running those is part of this item.
- **MUMPS as an oracle** is new work (a MUMPS ZetaId routine byte-locked to the codec) — design with the
  MUMPS/globals owner.
- **Governed:** the WorkItem ZetaId stays minted by the common generator; this room _verifies_ it across
  oracles, it does not introduce a second minter.

## Ties / routing

`src/Core.FSharp.ZetaId` (the F# common generator — `ZetaIdCodec.pack`, V1, Category.WorkItem) ·
`src/Core.TypeScript/zeta-id` (`pack`/`format`; what new-workitem.ts uses) · C#/Rust ZetaId ports ·
`tests/cross-verification/zeta-id/` (vectors.yaml + compare.ts + the 4 `*-output.json` — currently 12
vectors, all cat 0/3) · MUMPS/globals + gitfs (the fifth oracle + substrate) · the three bit-perfect oracle
shapes + `BitAdinkra`/Gates-ECC (bit oracles) · host→compiler→OS closure / Trusting-Trust / ace dep graph
(compiler oracles) · rooms/ (Max — the DST room) · no-binary-in-proof-lineage (text golden results).
**Routes to:** the ZetaId/cross-verify owners (the WorkItem vector + regen), Max (the room), the
MUMPS/globals owner (the 5th oracle), Soraya/Sova (bit + compiler oracle properties), Dejan (compiler
matrix in CI), Aaron (priority + the all-oracles scope).
