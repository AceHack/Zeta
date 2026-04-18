# Naming

How this project refers to itself, to the algorithm, and to
the ecosystem. Short file, load-bearing distinctions.

## Two names, two owners

| Thing | Name | Owned by |
| --- | --- | --- |
| **The algorithm** (delay / D / I, incrementalization, chain rule) | **DBSP** | Mihai Budiu, Tej Chajed, Frank McSherry, Leonid Ryzhyk, Val Tannen. VLDB'23 paper (`arXiv:2203.16684`). |
| **This library** (F# + C# implementation on .NET 10) | **Zeta** | This repository and its contributors. |

Zeta implements DBSP. Zeta is *not* DBSP. "DBSP" is the
academic construct; "Zeta" is the product-name, the NuGet
family, the GitHub repo. When in doubt: a citation of the
paper says **DBSP**; an `open` on a namespace says **Zeta**.

Zeta because: ζ-function reads over infinite series
(stream-coded), **Z** matches Z-sets (the core data type),
short, pronounceable, not a trademark in any adjacent
database / streaming / .NET space, not a cryptocurrency.

## What keeps the "DBSP" name

These are academic citations, paper-theorem names, or
descriptions *of the paper*. They stay DBSP — even the
public-facing ones.

- **Paper references** — every `arXiv:2203.16684`, every
  Budiu et al. citation in `docs/`, in source comments,
  in Lean proof headers.
- **Tests that assert paper theorems** — file names like
  `IncrementalTests.fs`, `ChainRuleTests.fs`; test-method
  names like `chainRule_holds`, `distinct_H_bound`,
  `bilinearJoin_identity`. These describe *what the paper
  proves*, not product branding.
- **Lean theorem names** — `chain_rule`, `D_I_id`, etc.
  Mirror the paper.
- **Glossary entries for DBSP vocabulary** — Z-set, delay,
  integration, differentiation, bilinear, stream, circuit.
- **FAQ phrasing** — "What is DBSP?" stays, answered as
  "the algebra from Budiu et al.'s VLDB'23 paper, which
  Zeta implements."
- **TLA+ module names that model paper constructs**
  (e.g. `DbspSpec.tla`) — paper-level artefacts, kept
  under the DBSP name.
- **NuGet package `<Description>` fields** — "Database
  Stream Processing (DBSP) for .NET" is the algorithm;
  the ID is `Zeta.*`.

## What carries the "Zeta" name

These are the project's product identity.

- **Solution file:** `Zeta.sln`.
- **Published library NuGet IDs:** `Zeta.Core`,
  `Zeta.Core.CSharp`, `Zeta.Bayesian`.
- **Namespaces** in source: `namespace Zeta.Core`,
  `open Zeta.Core`, `using Zeta.Core;`.
- **`<AssemblyName>`** on published libraries:
  `Zeta.Core.dll`, `Zeta.Core.CSharp.dll`,
  `Zeta.Bayesian.dll`.
- **GitHub repo** — currently `AceHack/Zeta`.
- **README title** — "Zeta — an F# implementation of DBSP
  for .NET 10".

## What carries neither

On-disk folders under the repo root do **not** repeat
either name. The repo *is* the project; naming every
subfolder after it is redundant noise:

- `src/Core/`, `src/Core.CSharp/`, `src/Bayesian/`.
- `tests/Tests.FSharp/`, `tests/Tests.CSharp/`,
  `tests/Core.CSharp.Tests/`, `tests/Bayesian.Tests/`.
- `bench/Benchmarks/`, `bench/Feldera.Bench/`.
- `samples/Demo/`.

`.fsproj` / `.csproj` filenames match their folder
(`Core.fsproj` inside `src/Core/`, not `Zeta.Core.fsproj`).
Test / benchmark / sample assembly names default to the
filename (`Tests.FSharp.dll`, `Benchmarks.dll`, etc.);
only the three *published* libraries carry explicit
`Zeta.*` AssemblyName + PackageId.

The folder-naming rule lives in the shared memory folder as
`feedback_folder_naming_convention.md`. GOVERNANCE.md §18 carries
the canonical path to that folder; read the full policy
there.

## Product-vs-algorithm language rules

In docs written here:

- First mention on a page: "Zeta (an implementation of
  DBSP)". Subsequent mentions: just "Zeta" for APIs, just
  "DBSP" for the algebra.
- In code comments: `// DBSP chain rule` is correct. The
  chain rule is the paper's, not Zeta's.
- In API names: `ZSet`, `Circuit`, `Stream`, `Operator`
  are paper terms, preserved exactly — do not rename
  `ZSet` to `ZetaSet`.

## When NOT to rename

- A comment explaining why code is the way it is *because
  of the DBSP paper* — say DBSP.
- A test that proves a paper theorem — say DBSP (or say
  nothing and let the theorem name stand).
- A blog post aimed at the streaming-systems research
  community — lead with "Zeta implements DBSP in F#".
  The algorithm is the hook; the product is the punchline.
