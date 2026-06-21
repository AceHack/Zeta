---
id: 081KTH59TVZ08QG0R000YRX5HW
type: task
state: done
priority: P2
slug: contenthash256-full-256-bit-raw-blake3-proof-tier-files-pack
title: "ContentHash256 — full 256-bit raw BLAKE3 proof tier (files/packages/blocks/adversarial); the remaining trust-core gap"
created: 2026-06-07T13:45:34.847Z
completed: 2026-06-20T09:40:00.000Z
depends_on: []
composes_with: ["081KTH323AK08QG0R000ZZ0N93"]
---

# ContentHash256 — full 256-bit raw BLAKE3 proof tier (files/packages/blocks/adversarial); the remaining trust-core gap

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH59TVZ08QG0R000YRX5HW-*.md` glob. -->

## Purpose

The remaining trust-core gap after Lior's ZetaId overlay: the **full 256-bit raw-byte BLAKE3 proof tier**.
The ZetaId ContentAddress category (9) embeds a 119-bit truncated prefix (internal CAS, ~64-bit adversarial
resistance); the standalone `ContentAddress128` (16-byte `MerkleHash`) is the internal address. Neither is
safe for adversarial/export/signed surfaces — per the treaty (Vera + Lior), **files / packages (Ace) /
blocks (Zeta) / anything signed-or-exported must address by the full `ContentHash256`.** Treaty doc:
`docs/research/2026-06-07-blake3-content-address-treaty-two-tier-128-le-vs-256-zetaid-typed-word-vera-aaron.md`.

## Build

- A distinct **`ContentHash256`** type = a 32-byte raw BLAKE3 digest wrapper, **raw byte order, no reversal**
  (empty input = `af1349b9f5f9a1a6a0404dea36dcc949…`) — distinct from the LE-rendered `ContentAddress128`.
- Full-digest function on `Core.Blake3` (alongside the existing 128-bit adapter) + the empty-input
  known-answer test; the 128-bit `ContentAddress128` must be derivable-from / verifiable-against it.
- Wire content-addressing of files/packages/blocks to `ContentHash256`; the 119-bit ZetaId / 128-bit
  address stay as compact internal handles backed by the full digest.
- 4-lang parity: golden vector for the full 256 digest (raw) in the cross-verify suite.

## Acceptance

`ContentHash256` (raw 32-byte) implemented + known-answer locked; files/packages/blocks address by it;
128-bit handle verifiable against it; 4-oracle golden vector for the full digest. Adversarial caveat closed.

## Anchors

- Treaty doc (above) · `Core.Blake3.Blake3Hasher` (128-bit adapter) · `IContentHasher` port · ZetaId
  ContentAddress category (Lior) · umbrella 081KTH323AK · 081KSXN940008QG0R003FCQ7WT (4-oracle) · no-binary-in-proof-lineage.
