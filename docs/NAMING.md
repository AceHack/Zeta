# NAMING

> **Status: proposal, not yet executed.** The repository is
> currently named `Dbsp.Core`: `Dbsp.sln`, `src/Dbsp.Core/`,
> `namespace Dbsp.Core`, NuGet IDs, and every `*.fs` still use
> the "Dbsp" name. This document captures the planned rename to
> **Zeta** — direction approved, migration pending. When the
> rename lands, this banner goes away; until then, trust the
> files on disk over this document.

How we refer to ourselves, to the algorithm, and to the ecosystem we
live in. Short file, load-bearing distinctions.

## Two names, two owners

| Thing | Name | Owned by |
| --- | --- | --- |
| **The algorithm** (delay / D / I, incrementalization, chain rule) | **DBSP** | Mihai Budiu, Tej Chajed, Frank McSherry, Leonid Ryzhyk, Val Tannen. VLDB'23 paper (`arXiv:2203.16684`). |
| **This library** (F# + C# implementation on .NET 10) | **Zeta** | This repository and its contributors. |

We implement DBSP. We are *not* DBSP. "DBSP" is the academic
construct; "Zeta" is our product-name, our NuGet family, our GitHub
org. When in doubt: if you're citing the paper, say DBSP. If you're
`open`-ing a namespace, say Zeta.

Zeta because: ζ-function reads over infinite series (stream-coded),
**Z** matches Z-sets (the core data type), short, pronounceable,
not a trademark in any adjacent database/streaming/.NET space,
not a cryptocurrency.

## What stays "DBSP" after the rename

These are either academic citations or assertions *about the paper*.
They stay DBSP forever, even as files move around them.

- **Paper references** — every `arXiv:2203.16684`, every Budiu et al.
  citation in docs/, in source comments, in Lean proof headers.
- **Tests that assert paper theorems** — file names like
  `IncrementalTests.fs`, `ChainRuleTests.fs`, test method names like
  `chainRule_holds`, `distinct_H_bound`, `bilinearJoin_identity`.
  These describe *what the paper proves*; they are not our branding.
- **The `proofs/lean/ChainRule.lean` family** — theorem names
  (`chain_rule`, `D_I_id`) mirror the paper. Keep them.
- **Glossary entries for DBSP terminology** — `docs/GLOSSARY.md`
  entries for Z-set, delay, integration, differentiation,
  bilinear, stream, circuit: these are the paper's vocabulary.
- **FAQ phrasing** — "What is DBSP?" stays. The answer is
  "the algebra from Budiu et al.'s VLDB'23 paper, which Zeta
  implements."
- **TLA+ model names** that reference paper constructs
  (e.g. `DbspSpec.tla` — this models the paper's semantics and
  should read as a paper-level artifact, not a product artifact;
  keep it as `DbspSpec.tla`).

## What becomes "Zeta"

These are *us*. They rename.

- **Solution** — `Dbsp.sln` -> `Zeta.sln`.
- **Projects** — `src/Dbsp.Core` -> `src/Zeta.Core`,
  `Dbsp.Core.CSharp` -> `Zeta.Core.CSharp`,
  `Dbsp.Bayesian` -> `Zeta.Bayesian`,
  `Dbsp.Tests.FSharp` -> `Zeta.Tests.FSharp`, etc.
- **Namespaces** — `namespace Dbsp.Core` -> `namespace Zeta.Core`.
  `open Dbsp.Core` -> `open Zeta.Core`.
- **NuGet package IDs** — `Zeta.Core`, `Zeta.Core.CSharp`,
  `Zeta.Bayesian`. Description field should say
  "DBSP implementation for .NET" — algorithm in description,
  product name in ID.
- **GitHub org / repo** — `github.com/<org>/zeta` with
  `org.name = zeta-streams` (or similar). The `dbsp` repo
  name is currently a directory name, not the published org.
- **README title** — "Zeta: an F# implementation of DBSP for
  .NET 10". Subtitle makes the relationship explicit.
- **Benchmark artifacts** — `Dbsp.Benchmarks` -> `Zeta.Benchmarks`.
- **Demo / samples** — `Dbsp.Demo` -> `Zeta.Demo`.

## Product vs algorithm: language rules

In docs written by us:

- First mention on a page: "Zeta (an implementation of DBSP)".
- Subsequent mentions: just "Zeta" when describing our APIs,
  just "DBSP" when describing the algebra.
- In code comments: "// DBSP chain rule" is good. "// Zeta
  chain rule" is wrong — the chain rule is the paper's, not ours.
- In API names: `ZSet`, `Circuit`, `Stream`, `Operator` — these
  are paper terms, keep them exactly. Don't rename `ZSet` to
  `ZetaSet`.

## Rename-migration checklist

Run top-to-bottom. Each step is a single commit on a
`rename-to-zeta` branch. Don't squash — review each step alone.

- [ ] **1. Reserve names.** Confirm `Zeta.Core` is available on
      nuget.org (or claim a prefix with a placeholder package
      first). Register the GitHub org. Reserve the domain if
      we're going that far.
- [ ] **2. Product-name references only** — update `README.md`,
      `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
      prose. Leave algorithm references as DBSP. This is a
      prose-only commit; no build changes.
- [ ] **3. NuGet IDs in `Directory.Build.props` and
      `.fsproj`/`.csproj`** — `<PackageId>`, `<Product>`,
      `<AssemblyTitle>`, `<RootNamespace>`. Assembly name
      changes here.
- [ ] **4. Solution and project file renames.**
      `Dbsp.sln` -> `Zeta.sln`, each `Dbsp.*.fsproj` /
      `Dbsp.*.csproj` renamed on disk. Directory renames
      (`src/Dbsp.Core` -> `src/Zeta.Core`) — use `git mv` one
      directory at a time so blame survives.
- [ ] **5. Source `namespace`/`open` declarations.**
      Sweep `namespace Dbsp.*` -> `namespace Zeta.*`,
      `open Dbsp.*` -> `open Zeta.*`,
      `using Dbsp.*;` -> `using Zeta.*;`. Mechanical
      grep-and-replace; algorithm identifiers
      (`ZSet`, `Circuit`, `Stream`) untouched.
- [ ] **6. Test project names and test class names.**
      `Dbsp.Tests.FSharp` -> `Zeta.Tests.FSharp`. Individual
      test-method names that assert paper theorems stay put.
- [ ] **7. Build-output paths in CI / BenchmarkDotNet config /
      Stryker config.** `stryker-config.json` has a hard-coded
      project reference; update it.
- [ ] **8. Docs sweep.** Everywhere the library calls *itself*
      "DBSP" — repoint to Zeta. Academic citations stay.
      `docs/GLOSSARY.md` gets a new first entry explaining the
      split.
- [ ] **9. TLA+ filenames.** Review each `.tla`. Spec files that
      model *paper constructs* (e.g. `DbspSpec.tla`) stay named
      after DBSP. Spec files that model *our implementation
      concerns* (e.g. `OperatorLifecycleRace.tla`,
      `ConsistentHashRebalance.tla`) need no rename — they're
      already subject-named.
- [ ] **10. New-name smoke.** Fresh clone, `dotnet build`,
      `dotnet test`, `dotnet run --project samples/Zeta.Demo`.
      Nothing should reference `Dbsp.*` except paper-citation
      prose and test-method names.
- [ ] **11. Old-name compatibility shim (optional).** Publish
      one final `Dbsp.Core` NuGet that type-forwards to
      `Zeta.Core` and prints a deprecation notice. Saves
      consumers one breaking upgrade; skip if there are no
      external consumers yet.
- [ ] **12. Repo rename on GitHub.** Last step. Redirect works
      automatically for existing clones; pinned docs don't.
      Update any `repository.url` in NuGet metadata.

## When NOT to rename

- If you're writing a comment explaining why some code is the way
  it is *because of the DBSP paper*, say DBSP.
- If you're naming a test that proves a paper theorem, say
  DBSP (or don't say it at all — the theorem name is enough).
- If you're writing a blog post aimed at the streaming-systems
  research community, lead with "We implement DBSP in F#."
  The algorithm is the hook; the product is the punchline.
