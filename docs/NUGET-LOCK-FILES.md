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

**Local result, one leg of five.** On macOS arm64 (darwin-arm64, SDK 10.0.400), a
`--force-evaluate` restore of `Zeta.sln` plus all ten out-of-solution projects reproduced all
63 committed locks **byte-identically** — `git status` reported zero modified files. That is
one platform; the other four are what the lane is for, and until it has run on them the answer
for those is `unknown`, not `probably the same`.

**What widening would change, exactly.** If the lane reports every project `identical` across
all five legs, the supported edit is one flag on one step: `gate.yml`'s
`build-and-test` → `Build (0 Warning(s) / 0 Error(s) required)`, from
`dotnet build Zeta.sln -c Release` to `dotnet restore Zeta.sln --locked-mode` followed by
`dotnet build Zeta.sln -c Release --no-restore`. Nothing else in the gate changes. If instead
it reports `differs-unexplained` anywhere, that project is the finding and the remedy is a
per-project decision — an exclusion, or per-RID locks — not a blanket widening.

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
