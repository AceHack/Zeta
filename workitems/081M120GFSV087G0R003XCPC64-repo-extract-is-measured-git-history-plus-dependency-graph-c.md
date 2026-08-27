---
id: 081M120GFSV087G0R003XCPC64
type: task
state: backlog
priority: P1
slug: repo-extract-is-measured-git-history-plus-dependency-graph-c
title: "Repo extract is measured: git-history plus dependency graph; composability over layers"
created: 2026-08-27T16:23:06.299Z
depends_on: []
composes_with: ["081M10AAVAT087G0R0027M0GV5", "081M108RYNT087G0R001JSRNZE"]
---

# Repo extract is measured: git-history plus dependency graph; composability over layers

Aaron 2026-08-27: Ace · Zeta · Nucleus · Loom is a **preliminary split**,
not the destination. Prefer **composability over named layers** — the
.NET BCL model (`System.Collections` is not a layer above `System`;
assemblies compose). Fewer named layers, more packages that compose.

When we actually extract peer repos, the cut is **measured**, not named:

1. **Dependency graph** — live project/package references. Already
   started: `src/Core.TypeScript/ace/build-graph.ts` and
   `docs/research/2026-08-19-repo-split-round-3-*` (toolchain closure).
2. **Git-history analysis** — who changes with whom, over time
   (co-change / code archaeology). Not built. A name on a layer table
   is not a cut.

No repository is created from this row (gated, same as 8c).

## Also recorded here (same session, not a second item)

- **Text encodings play nice with git for now.** End-state storage is
  **binary FS and DB** (CBOR / own-format / BLAKE3). YAML-on-git is a
  bootstrap codec, not the destination.
- **Filesystem becomes a compiler stage** — F# type providers
  (Syme / Battocchi 2012) and Roslyn source generators reify the store
  as types. Already pointed at in VISION's compiler ladder and
  `docs/research/2026-06-07-zs-is-a-durable-cell-reified-types-every-loop-*`.
- **Self-editing compiler.** Edits land as content-addressed objects;
  the next **bounded tick** loads them. Ticks are bounded (epoch /
  `AdinkraClock` duration-free). Not a wall-clock hot-reload.

Beacon: .NET BCL assembly factoring; Syme/Battocchi type providers;
Roslyn source generators. Round-3 closure measurement is the dep-graph
half; git-history analysis is the missing half.

Pointers: `docs/ROADMAP.md` (layers + 8c + format treaty);
`docs/VISION.md` §compiler ladder.
