# NuGet lock files — what they add, and what to do when one goes stale

> **The one-line remedy, because a gate with no stated remedy is a trap.** You changed a
> package version and CI now says `NU1004`. Run `dotnet restore Zeta.sln` locally and commit
> the `packages.lock.json` files it rewrites. That is the whole workflow.

## What this buys that Central Package Management did not

`Directory.Packages.props` already pins **versions**, transitively — `ManagePackageVersionsCentrally`
plus `CentralPackageTransitivePinningEnabled` mean no project resolves a version nobody wrote down.

A version is a **label**, and a label is not a **byte**. A package republished under the same
version number — by an upstream compromise, a registry incident, or a mirror serving something
else — passes a version pin without complaint. `packages.lock.json` records a **sha512
contentHash per resolved package**, direct and transitive, and `--locked-mode` refuses the
restore when the resolved graph does not match it.

So: **versions were already pinned; this pins the bytes.** It is the NuGet half of the same
discipline the repo already applies to container bases (`@sha256:`), GitHub Actions (40-hex
refs), and the npm/bun `integrity` fields — see [`UNHASHED-DEPENDENCIES.md`](UNHASHED-DEPENDENCIES.md),
where NuGet moved out of the *undeclared unhashed* column when these files landed.

## Where it is turned on

| Surface | How | Restores in locked mode |
|---|---|---|
| Everything in `Zeta.sln` (53 projects) | `RestorePackagesWithLockFile` in the root `Directory.Build.props` | `.github/workflows/low-memory.yml` — the Core smoke graph |
| `full-ai-cluster/orleans-silo` | restated in its own `Directory.Build.props` (it deliberately stops inheritance) | its `Dockerfile` |
| `genesis/_src/auth-backend` | restated in its own `Directory.Build.props` (same reason) | its `Dockerfile` |

The **ten** projects outside `Zeta.sln` — `vocab`, `src/SwarmRunner`, `src/Core.FSharp.Cli`,
`src/Core.FSharp.Mcp`, `src/Core.FSharp.Z3Verify`, `src/Core.CSharp.SchemaEvolution`,
`experiments/zetafs-webdav`, `src/Research.FSharp.Cli/MetadataProbe`,
`full-ai-cluster/orleans-silo`, `genesis/_src/auth-backend` — inherit the root property (the
last two restate it) and have committed locks too, so restoring them does not leave an
untracked file behind. Nothing in CI builds them, so nothing restores them in locked mode; the
cross-OS lane below restores them explicitly for that reason. (Re-counted 2026-09-11 while
building the cross-OS lane, which has to name every project it restores: `Zeta.sln` holds 53
projects and all 53 carry a lock, with 10 more outside it — 63 in total. This paragraph
previously said seven and the table above said 54; both are corrected here. Nothing about the
mechanism changed, only the count of what it covers.)

## Honest boundary — what is NOT verified

`dotnet build` performs an **implicit, unlocked** restore. Only the three sites in the table
above pass `--locked-mode`, so the solution-wide gate job (`dotnet build Zeta.sln -c Release`)
would silently regenerate a stale lock rather than fail on it. The `low-memory` lane restores
`tests/Core.CSharp.Tests` in locked mode, which covers that project's transitive closure and
not the whole solution.

This was left deliberately rather than overlooked: the gate runs on ubuntu, windows and macos,
and a lock file that legitimately differs per-OS would turn a supply-chain check into a
cross-platform flake. Widening locked mode to the full solution wants a measurement of
cross-OS lock stability first, on a lane that can fail loudly without blocking `main`.

## The measurement that would authorise widening it

That lane now exists: [`.github/workflows/lock-cross-os-stability.yml`](../.github/workflows/lock-cross-os-stability.yml),
comparing with `src/Core.TypeScript/hygiene/lock-cross-os-stability.ts`. It re-resolves every
one of the 63 locks with `--force-evaluate` on all **five** platform legs the gate's
`build-and-test` matrix actually uses — `ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-26`,
`windows-2025`, `windows-11-arm` — and compares each leg against every other leg **and**
against the committed files. It produces no `gate (required)` context and cannot block `main`.

`--force-evaluate` is load-bearing rather than decorative: a plain restore is a no-op against a
lock whose project-input hash still matches, so a lane without it would compare 63 files to
themselves. That is the self-comparison class — `f(x) = f(x)` cannot prove anything.

**The static premise, measured 2026-09-11.** Nothing in this tree asks for a per-platform
graph. Across every `*.csproj` / `*.fsproj` / `*.props` / `*.targets`: zero `RuntimeIdentifier`
or `RuntimeIdentifiers`, zero OS-suffixed target frameworks (61 locks are `net10.0`, the other
two `.NETStandard,Version=v2.0`), and zero `Condition=`-guarded `PackageReference`. The four
`Condition=` attributes that do exist key on `$(CI)`, `$(Configuration)` and
`$(MSBuildProjectExtension)` — none on an OS or an architecture. A regression test pins this
premise, so adding a RID to the root props fails loudly rather than being inherited in silence.

## THE ANSWER — the locks are NOT cross-platform stable, so do not widen `--locked-mode`

First run, 2026-09-11 (workflow run `34664278420`). **Zero of 63 projects came back
`identical`.** The measurement says no, and it says it for two independent reasons.

| verdict | count | what it is |
|---|---|---|
| `identical` | **0** | — |
| `differs-unexplained` | **30** | one package, `FSharp.Core`, resolving differently per leg. **The blocking finding** |
| `differs-formatting-only` | **33** | Windows writes CRLF; Unix writes LF |

### Finding 1 — `FSharp.Core` resolves to a different `contentHash` per leg (30 locks)

The 30 affected locks are **exactly** the 30 that reference `FSharp.Core`, and
`net10.0/FSharp.Core` is the **only** differing entry in any of them. Same requested range,
same resolved version `10.1.400`, three different hashes:

| leg | `contentHash` (truncated) |
|---|---|
| `macos-26`, `windows-2025`, **and the committed files** | `H9wlZ/tWgNp+Q4WQ5aUSi3XO…` |
| `ubuntu-24.04` | `mxCkXuBt4wyRMmHf4boZXm30…` |
| `ubuntu-24.04-arm` | `90c8OKU41fCkzphlHq8nQiOJ…` |

So the committed locks are the **macOS/Windows** answer, and both Linux legs disagree — with
the committed files and with each other. `dotnet restore --locked-mode` on the gate would
therefore fail `NU1403` on every Linux leg, which is most of the gate.

#### The mechanism, traced to the SDK line that causes it

This started as a hypothesis and was then found in the shipped SDK targets.
`sdk/<version>/FSharp/Microsoft.FSharp.NetSdk.targets` adds the SDK's **own bundled copy of
`FSharp.Core`** as an additional restore source for every F# project:

```xml
<PropertyGroup Condition=" '$(DisableImplicitLibraryPacksFolder)' != 'true' ">
  <RestoreAdditionalProjectSources Condition="Exists('$(_FSharpCoreLibraryPacksFolder)')">
    $(RestoreAdditionalProjectSources);$(_FSharpCoreLibraryPacksFolder)
  </RestoreAdditionalProjectSources>
</PropertyGroup>
```

`_FSharpCoreLibraryPacksFolder` is `sdk/<version>/FSharp/library-packs/`, which holds exactly
one file: `FSharp.Core.10.1.400.nupkg`. **That file is built per SDK platform, so its bytes —
and therefore the `contentHash` NuGet records when it resolves from there — differ per
platform.** The nuget.org `.nupkg` sha512 (`aM8GRu3juiHLoQqcV7+nnynXrw1G…`) matches none of the
three lock values, and the locally bundled copy hashes differently again
(`T9R1BJRK32NxCH9vneBi…`), which is the same story from the other side.

#### It is not per-platform at all. It is NONDETERMINISTIC — measured, not inferred

The second run (`34664982677`, ~30 minutes after the first, same commit, all five legs
restoring) settles this. **`macos-26` produced a fourth value it had not produced before:**

| leg | run `34664278420` | run `34664982677` | |
|---|---|---|---|
| `macos-26` | `H9wlZ/tWgNp+Q4WQ5aUSi3XO…` | `C8Myl8/HMoTWw0K/xJ+Q6JHl…` | **changed between runs** |
| `ubuntu-24.04` | `mxCkXuBt4wyRMmHf4boZXm30…` | `mxCkXuBt4wyRMmHf4boZXm30…` | stable |
| `ubuntu-24.04-arm` | `90c8OKU41fCkzphlHq8nQiOJ…` | `90c8OKU41fCkzphlHq8nQiOJ…` | stable |
| `windows-2025` | `H9wlZ/tWgNp+Q4WQ5aUSi3XO…` | `H9wlZ/tWgNp+Q4WQ5aUSi3XO…` | stable |
| `windows-11-arm` | *(leg crashed)* | `H9wlZ/tWgNp+Q4WQ5aUSi3XO…` | — |

Same platform, same SDK `10.0.400`, same commit, **different answer**. So **four** distinct
`contentHash` values have now been observed for one resolved version, and a single leg is not
even self-consistent across runs.

The cause follows from the mechanism: whether a leg records the nuget.org hash or its SDK's
bundled hash depends on which source populated `~/.nuget/packages` first — a property of the
runner image and its cache at that moment, not of the operating system. The grouping accordingly
follows **neither** OS nor architecture (`windows-2025` x64 and `windows-11-arm` arm64 agree;
`ubuntu-24.04` x64 and `ubuntu-24.04-arm` arm64 do not).

**This is the strongest form of the answer.** A per-platform difference could at least be
encoded. A nondeterministic one cannot: widening `--locked-mode` would produce a gate that
fails *intermittently*, on a schedule nobody controls — which is worse than one that fails
predictably, and is exactly the "cross-platform flake" #17305 refused to create.

#### Why a per-RID lock is the WRONG remedy here

`packages.<rid>.lock.json` exists for projects whose graph genuinely varies by
`RuntimeIdentifier`. This one does not: nothing in the tree declares a RID, and the observed
grouping does not follow RID lines — two *different* architectures agree with each other while
two builds of the *same* OS disagree. Per-RID locks would encode the machine-state accident as
if it were a platform fact.

**The lever the SDK already provides** is the condition in the snippet above:
`<DisableImplicitLibraryPacksFolder>true</DisableImplicitLibraryPacksFolder>` removes the
bundled folder as a restore source, so `FSharp.Core` resolves from nuget.org on every leg and
one version means one `contentHash`. That is a real change to how restore behaves and to all 30
affected lock files, so it belongs in its own change — and this lane is exactly what would
verify it. It is **not** applied here: this PR measures.

### Finding 2 — every lock differs at byte level on Windows (33 locks, and really all 63)

`windows-2025` writes `packages.lock.json` with **CRLF**; `ubuntu-*` and `macos-26` write
**LF** (measured directly on the captured bytes). The 33 that are not already in Finding 1
report `differs-formatting-only` for that reason alone; the other 30 carry it too, underneath
the semantic difference.

This one does **not** block `--locked-mode` — NuGet parses the JSON and compares the resolved
graph, not the bytes — but it does mean a "restore leaves the tree clean" check would be red on
every Windows leg. The two failure modes are separate and want separate remedies, which is why
the lane reports them as separate verdicts instead of one "differs".

### What would have to be true before widening

Finding 1 has to be **fixed**, not waived: one resolved version must mean one `contentHash` on
every leg. Until then the supported edit named below stays unapplied.

**The edit, when it is ever supported:** one step in `gate.yml`'s `build-and-test` —
`Build (0 Warning(s) / 0 Error(s) required)`, from `dotnet build Zeta.sln -c Release` to
`dotnet restore Zeta.sln --locked-mode` followed by
`dotnet build Zeta.sln -c Release --no-restore`. Nothing else in the gate changes.

### A note on the lane's own first run, because it caught itself

The `windows-11-arm` leg crashed in `dotnet --version` (exit `-2147483644`), **skipped both
restore steps, and still uploaded a full 63-file manifest** — the files exactly as checked
out. The first version of the comparison counted that as a fifth platform's opinion, and
because a Windows checkout is CRLF it turned 33 genuinely-identical projects into
`differs-formatting-only`. A leg that did no work was voting.

The capture now records `--restored`, computed from whether the restore steps actually
succeeded, and `compare` refuses such a manifest as data and fails the run for it. The default
is **false**, so a manifest that does not vouch for its own restore is not trusted. This is the
"a check that did not run looking like one that passed" class, found by the lane in itself on
its first execution.

## The three things that go wrong

**1. `NU1004` — "the packages lock file is inconsistent with the project dependencies".**
Somebody changed a version (or added/removed a `PackageReference`) and did not regenerate.
Fix: `dotnet restore Zeta.sln`, then `git add` the changed `packages.lock.json` files. A plain
restore rewrites them automatically — measured 2026-09-11, no extra flag needed.

**2. The lock looks current but you want to re-resolve anyway.** Floating versions, or a
transitive bump that did not change any project input, leave the lock *valid* by NuGet's own
input hash. `dotnet restore Zeta.sln --force-evaluate` re-resolves and rewrites regardless.

**3. `NU1403` — content hash mismatch.** This is the case the whole mechanism exists for: the
bytes on the wire are not the bytes that were locked. Do **not** regenerate the lock to make it
go away. Check the package on nuget.org, check whether a mirror or proxy is in the path, and
escalate per [`security/INCIDENT-PLAYBOOK.md`](security/INCIDENT-PLAYBOOK.md) before changing
anything.

## The cost, stated

63 files that are rewritten together whenever a central version moves. That churn class is
registered in [`../registry/unbounded-growth-register.json`](../registry/unbounded-growth-register.json)
with a measured rate and a measured on-disk cost per version, next to `bun.lock`,
`package-lock.json` and `mise.lock`, which are the same shape. The register's own answer for
this class is that the bytes **are** the information: re-resolving today reproduces today's
graph, never the graph as it stood at an old tag, so there is no generator that substitutes
for keeping them.

## Pointers

- `Directory.Build.props` — where the property is set, with the reason inline.
- `docs/UNHASHED-DEPENDENCIES.md` — the generated roster; the `nuget` row moved columns here.
- `docs/security/V1-SECURITY-GOALS.md` — "a malicious patch version between two `dotnet restore`s",
  which is the threat this closes.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why `--locked-mode` was proven to
  **fail** on a changed graph before it was claimed as a check.
- `.github/workflows/lock-cross-os-stability.yml` + `src/Core.TypeScript/hygiene/lock-cross-os-stability.ts`
  — the cross-platform measurement lane and its comparator; the findings above are its output.
  A measurement lane, not a gate: it emits no `gate (required)` context and cannot block `main`.
