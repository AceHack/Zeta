---
name: Don't repeat project name inside its own folder tree
description: On-disk folder names under the repo root go bare (Core, Bayesian, Tests.FSharp) — the project name survives only in published identity (NuGet IDs, namespaces, published assembly names)
type: feedback
originSessionId: 2ac0e518-3eeb-45c2-a5dc-da0e168fe9c4
---
Inside a repo, on-disk folder paths do NOT repeat the
project name. The repo IS the project; naming every subfolder
after the project is redundant and reads as a junior mistake.

**Bare folder names** (correct):
```
Zeta/
├── src/
│   ├── Core/           (not src/Zeta.Core/)
│   ├── Core.CSharp/    (not src/Zeta.Core.CSharp/)
│   ├── Bayesian/
├── tests/
│   ├── Tests.FSharp/   (not tests/Zeta.Tests.FSharp/)
│   ├── Core.CSharp.Tests/
├── bench/
│   ├── Benchmarks/
├── samples/
│   ├── Demo/
```

**What keeps the `Zeta.*` prefix** (published identity,
seen by users — not an on-disk smell):
- NuGet package IDs: `Zeta.Core`, `Zeta.Core.CSharp`,
  `Zeta.Bayesian`
- Namespaces in source: `namespace Zeta.Core`,
  `open Zeta.Core`
- Explicit `<AssemblyName>` on published libraries:
  `Zeta.Core.dll`, `Zeta.Core.CSharp.dll`, `Zeta.Bayesian.dll`
- Solution file at repo root: `Zeta.sln`

**What drops the prefix** (internal identity, never
published to NuGet):
- Test / bench / sample AssemblyNames default to their
  filename: `Tests.FSharp.dll`, `Benchmarks.dll`, `Demo.dll`
- `.sln` project-display names inside the sln file: bare
  `Core`, `Tests.FSharp`, etc.
- `.fsproj` / `.csproj` filenames: match folder name
  (`Core.fsproj` inside `src/Core/`, not
  `Zeta.Core.fsproj`)

**Why:** Aaron round-25, 2026-04-18, after watching the
first rename pass land folders like `src/Zeta.Core/`:
"no that's stupid we should not have folders like that...
we don't need our own project name repeated like that in
our own project." Paths that repeat the project name are
noise for every contributor reading the tree.

**How to apply:**
- When creating any new subfolder in this repo, name it
  for its role (Core, Bayesian, Storage, Runtime), not for
  the project.
- When creating a new project (`dotnet new` etc.) inside
  `src/`, `tests/`, `bench/`, or `samples/`, use the role
  name; set explicit `<AssemblyName>Zeta.X</AssemblyName>`
  only if it's a published library.
- This rule is specific to Zeta. Other repos (SQLSharp,
  scratch) currently follow a different convention;
  maintainer considers theirs a latent smell but is not
  actively refactoring. Do not use them as a reference
  for Zeta's layout.
- Applies to on-disk paths only. Product identity survives
  everywhere the public cares: NuGet, namespaces,
  published assemblies, website.
