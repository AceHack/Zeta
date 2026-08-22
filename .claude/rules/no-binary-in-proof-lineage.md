# No binary in the proof lineage

Carved sentence:

> Verification artifacts are TEXT, never binary blobs. Byte-lock every binary
> format (CBOR · Arrow · protobuf · Merkle roots · metric sketch tables · …) as
> hex/decimal strings inside JSON golden vectors — so each byte-lock is diffable,
> DST-replayable, and human-auditable in a `git` diff. No format's golden vectors
> are a checked-in binary; the proofs never depend on bytes you cannot read or
> merge. New format whose vectors are tempting to store raw → encode hex-in-JSON.

## Why

A checked-in binary in the proof lineage is opaque: a reviewer can't read it, a
merge can't reconcile it, and a malicious/accidental byte-swap hides where no diff
shows it. Hex-in-JSON keeps the entire verification substrate text — every
byte-lock change is a readable diff, replays deterministically (DST), and stays
mergeable. (Tradeoff accepted: large fixtures get verbose, still diffable.)

The only binary files in the repo are NON-verification (reference PDFs, a couple
images, forensic logs) — never proofs.

## Pointers

- `docs/PROVEN-COVERAGE-AND-GAPS.md` — the audit (all golden vectors `.json`/hex).
- The `golden-vectors-*.json` files (cbor/arrow/merkle/bloom/countmin) — the pattern.
- `docs/backlog/P2/081KT07NV0008QG0R0032MCYER-four-oracle-multi-format-golden-vector-seeds-cbor-json-yaml-*` — the seed doctrine.
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) — DST (#4) + idempotency: text golden vectors replay deterministically.
