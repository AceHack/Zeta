---
id: 081M23DC9S6087G0R003P8VCDT
type: task
state: backlog
priority: P2
slug: record-jumprope-zetadb-discriminator-chunk-sizes-and-rust-af
title: "Record Jumprope ZetaDB discriminator, chunk sizes, and Rust after ZD4"
created: 2026-09-09T15:42:56.806Z
depends_on: ["081M23BDKQA087G0R001QEFR2E"]
composes_with: []
---

# Record Jumprope ZetaDB discriminator, chunk sizes, and Rust after ZD4

Jumprope earns on multi-chunk bodies (D9, fork, seek), not the 1-byte
storm. Chunk file bodies above FastCDC min=2048; do not Jumprope each
tiny append. "Large" means more than one chunk; prefix-share is worth
it at hundreds of KiB. Rust second version only after ZD4. Not Apple.
