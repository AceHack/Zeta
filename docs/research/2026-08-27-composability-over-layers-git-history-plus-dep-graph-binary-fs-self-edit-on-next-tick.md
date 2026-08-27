# Composability over layers — measured extract, binary FS, self-edit on the next tick

*2026-08-27. Operational status: research-grade absorb of a current-state
correction; live pointers [`docs/ROADMAP.md`](../ROADMAP.md) (names /
format treaty / 8c) and [`docs/VISION.md`](../VISION.md) §compiler
ladder. GOVERNANCE.md §33. Workitem `081M120GFSV087G0R003XCPC64`.*

Aaron 2026-08-27, on the four names Ace · Zeta · Nucleus · Loom:

> the less "layers" the better, would prefer composability over
> layers, more how dotnet BCL does it

And, on the cut itself:

> when we actually go to split things out to different repos we are
> going to need to do some sort of git history analysis of the code
> and dependency graph of the code so we can figure out what can be
> split to its own repo

And, on storage and the compiler:

> our end state is binary fs and db storage so we can be blazing
> fast our text based encodings are to play nice with git for now.
> Eventually we want to make the file system kind of part of the
> compiler through things like type providers and roslyn stuff, the
> end goal is a intelligent compiler that can edit itself in real
> time and pickup the new updates on the next tick since each one
> of our tick are bounded.

## What this corrects

The four names were recorded as "decided layers." They are a
**preliminary split** — bootstrap names for packages that compose,
not a stack you must climb. A layer table is a naming aid. A cut is
a measurement.

## What is already measured (do not rebuild)

| Half | In-tree |
|---|---|
| Dependency / toolchain closure | `docs/research/2026-08-19-repo-split-round-3-*`; `src/Core.TypeScript/ace/build-graph.ts` |
| Change-rate (DV2 hub/link/satellite) | repo-split round 2 |
| Binary-leaning FS codec | CBOR is the filesystem default; YAML is the git-default **bootstrap** |
| Tick duration is injected, not intrinsic | `AdinkraClock.isMetricFree` (VISION §epoch) |
| Type-provider direction | `docs/research/2026-06-07-zs-is-a-durable-cell-reified-types-every-loop-*`; PRIOR-ART-LIST Syme/Battocchi 2012 |

## What is missing

1. **Git-history co-change analysis** as a first-class input to a
   cut. Round 3 measured closure of *today's* graph; it did not ask
   "which files have moved together for a year." That is the
   archaeology half. No repository is created until both halves
   agree (gated, same as 8c).
2. **Composition-root BLAKE3 default** for the tamper-evident store.
   `Blake3Hasher` already implements `IContentHasher` in
   `Zeta.Core.FSharp.Blake3` (NuGet isolated). `ContentHasher.defaultHasher`
   stays XxHash128 **on purpose** — Core does not take the Blake3
   package. The default for `ZetaFsDeltaLog` is still
   `MerkleHash.ofBytes` (xxhash) when no hasher is injected. The
   store's composition root is what should select BLAKE3.
3. **A type provider / Roslyn generator that reads the store.**
   Direction is recorded; no provider yet.
4. **Tick-N loads tick-(N−1)'s compiler edits.** Bounded ticks make
   this well-defined. The wire does not exist.

## Beacon

- **.NET BCL assembly factoring** — many small assemblies that
  compose; not a layer cake. `System.Collections` is not above
  `System`.
- **Don Syme, Keith Battocchi et al.**, *Strongly-Typed Language
  Support for Internet-Scale Information Sources* (MSR, 2012) — F#
  type providers reify an unbounded external space on demand.
- **Roslyn source generators** — the C# analogue.
- Language package ecosystems (NuGet, crates.io, PyPI) — the same
  composability shape, applied to distribution.

## Honesty

This document does not pick the next extract. Harny remains the
first dogfood-then-extract. It forbids treating Ace · Zeta ·
Nucleus · Loom as four repos-to-be. The names can survive as
package names; they do not license a four-way split.
