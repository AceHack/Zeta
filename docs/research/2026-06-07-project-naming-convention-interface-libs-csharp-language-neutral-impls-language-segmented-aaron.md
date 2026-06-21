# Project naming convention: interface libs are C# + language-neutral; implementations are language-segmented (Aaron, 2026-06-07)

The principle behind the `Core.Blake3`→`Core.FSharp.Blake3` and `Core.Git`→`Core.FSharp.Git` renames.
Faithful capture; a convention proposal (naming-expert / Ilyana review before it becomes a rule).

## The carved principle (Aaron)

> *"C# interfaces support in and out [declaration-site variance] so it would be the canonical interface
> language for dotnet. You can implement them in F# and C#, so the interface libraries would not need a
> language name."*

Two project classes, two naming families:

| class | names | language | why |
|---|---|---|---|
| **contract / interface** (ports, abstractions) | **language-neutral** — `Zeta.Core.Abstractions`, `Zeta.Core.Ports` | **C#** | C# has declaration-site variance (`in`/`out`); F# **cannot declare** variant interfaces. C# is the canonical .NET interface language. No language segment — both F# and C# implement against the *same* contract. |
| **implementation / adapter / oracle** | **language-segmented** — `Zeta.Core.<Lang>.<X>` (`Core.FSharp.Sha256`, `Core.CSharp.Merkle`, `Core.Rust.ZetaId`) | F# / C# / Rust / TS | implementations **must not share code across languages** (4-oracle independence / byte-lock parity). The language segment is load-bearing: it says "this is *one language's* impl," leaving room for siblings. |

## Why implementations don't share code

The 4-language oracle discipline (081KSXN940008QG0R003FCQ7WT) requires each language to implement a primitive **independently**
and prove byte-identical results via hex-in-JSON golden vectors. Shared code would defeat the cross-check —
a bug in shared code can't be caught by agreement. So `Core.FSharp.Blake3` and `Core.CSharp.Blake3` are
*separate projects with separate code*, agreeing only at the wire (golden vectors), both implementing the
neutral C# `IContentHasher` contract.

## The two renames this produced

- **`Core.Blake3` → `Core.FSharp.Blake3`** (PR #6852): BLAKE3 is a hash *primitive* on the 4-lang dispatch
  board (C#/Rust/TS oracle siblings coming) — belongs in the per-language family, not a neutral name.
- **`Core.Git` → `Core.FSharp.Git`** (this PR): `Core.Git` is an **F# implementation** (LibGit2Sharp adapter
  implementing the `IDeltaLog`/`ISnapshotStore` ports) wearing a neutral name — the same smell. A future C#
  git backend would collide. Renamed; the neutral name is freed for the *contract* library.

## The distinction from a backend-variant (why `Core.Git` was confusing)

The honest test: **does this project's variation come from *language* or from *backend/dependency*?**
- *Language* variation (4 oracles of one primitive) → language segment: `Core.<Lang>.<X>`.
- *Backend* variation (LibGit2Sharp now, pure-managed later — same language) → that's **multiple impls of one
  port**, each its own project, but the *port* is the neutral C# contract lib. `Core.Git` mistakenly used the
  neutral name for an F# *impl*; the neutral name belongs to the **port**, and the impl is
  `Core.FSharp.Git` (LibGit2Sharp/F#), with a later `Core.FSharp.Git.Managed` or `Core.CSharp.Git` as
  sibling backends.

## Backlog (deferred — API-reviewed extraction)

1. **Extract a C# language-neutral contract library** (`Zeta.Core.Abstractions` or `Zeta.Core.Ports`) holding
   the ports currently in F# `Core` (`IContentHasher`, `IDeltaLog<'K>`, `ISnapshotStore<'K>`, …), authored in
   C# to get declaration-site variance. Both `Core.FSharp.*` and `Core.CSharp.*` reference it. Needs
   public-API review (Ilyana) — moving an interface is a contract change.
2. **Audit remaining neutral-named projects** for the same smell (any `Core.<X>` that is actually one
   language's impl, not a contract).

## Beacon anchors

- **Declaration-site variance** — C# `in`/`out` on interfaces/delegates (Eric Lippert's variance series); F#
  supports *consuming* variant types but not *declaring* variance — hence C# as the canonical .NET contract
  language. · **Hexagonal architecture / ports & adapters** (Alistair Cockburn) — the port (neutral
  contract) vs adapter (language/backend impl) split this convention encodes. · **4-oracle byte-lock** (ours,
  081KSXN940008QG0R003FCQ7WT) — why impls stay independent/unshared. · Ties: the `Core.FSharp.Sha256` family (the convention
  already followed), `Core.Git`/`Core.FSharp.Git`, `Core.Blake3`/`Core.FSharp.Blake3`.
