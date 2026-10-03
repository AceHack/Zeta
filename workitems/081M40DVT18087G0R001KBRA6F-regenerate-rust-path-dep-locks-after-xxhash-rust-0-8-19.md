---
id: 081M40DVT18087G0R001KBRA6F
type: bug
state: backlog
priority: P1
slug: regenerate-rust-path-dep-locks-after-xxhash-rust-0-8-19
title: "Regenerate Rust path-dep locks after xxhash-rust 0.8.19"
created: 2026-10-03T08:21:00.000Z
depends_on: []
composes_with: []
---

# Regenerate Rust path-dep locks after xxhash-rust 0.8.19

`lint (Rust)` on `e3adab6e5c` (archive of `#17908` as `#17910`). Clippy
`--locked` on `Core.Rust.Algebra` refused because `#17902` bumped
`xxhash-rust` 0.8.18 -> 0.8.19 in `Core.Rust.Merkle` / `Core.Rust.Metric`
and their locks, but not in crates that path-depend on Merkle:

- `src/Core.Rust.Algebra/Cargo.lock`
- `src/Core.Rust.Blake3/Cargo.lock`
- `src/Core.Rust.Durability/Cargo.lock` (via Algebra)

Regenerate those three locks to 0.8.19. Do not bump unrelated crates.
Do not change the `=0.8.19` pin in Merkle/Metric `Cargo.toml`.
