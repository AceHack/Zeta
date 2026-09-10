---
id: 081M25QNJ49087G0R000CRS6MN
type: bug
state: backlog
priority: P2
slug: windows-hosts-default-to-tier-full-and-install-kubernetes-to
title: "Windows hosts default to tier=full and install Kubernetes tooling nothing on Windows uses"
created: 2026-09-10T13:21:14.889Z
depends_on: []
composes_with: []
---

# Windows hosts default to tier=full and install Kubernetes tooling nothing on Windows uses

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M25QNJ49087G0R000CRS6MN-*.md` glob. -->

## The defect

`tools/setup/install.ps1` assigned `ZETA_HOST_TIER = 'full'` to every Windows host that did
not declare one. On Windows, that setting changes exactly one thing: `MISE_ENV=full`, which
merges `.mise.full.toml`. Over `.mise.toml` that file adds exactly five tools --
`k3d`, `kind`, `kubectl`, `helm`, `github:yannh/kubeconform` -- plus `rust` and `zig`
entries that are deliberate byte-identical mirrors of the base tier.

So the tier's entire Windows payload was the five Kubernetes tools, and no Windows surface
invokes any of them:

| consumer                                         | runner                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `lint (yaml/k8s)` (gate.yml) -- kubeconform      | `ubuntu-24.04`, and it `go install`s its own copy                 |
| `helm-validate.yml` -- helm + kubeconform        | `ubuntu-24.04`                                                    |
| `k8s-argocd-health-test.yml` -- k3d/kind/kubectl | `ubuntu-24.04`                                                    |
| `build-and-test (windows-2025 / windows-11-arm)` | `dotnet build` + `dotnet test` over `Zeta.sln`. None of the five. |

`install.ps1` reads no manifest carrying a `tier=` token (`manifests/windows`,
`manifests/from-bun-global`, `manifests/local-llm`) and drives no dotnet-global manifest,
so nothing else on Windows was tier-gated.

## What it cost

`build-and-test (windows-11-arm)` failed on `main` at `Install toolchain via three-way-parity
script` because `github:yannh/kubeconform@0.7.0` could not be installed -- GitHub's
attestation service returned 503. An outage in a Kubernetes tool took down a Windows
build-and-test leg with no Kubernetes in it.

This is the same shape as the `qemu` row in `manifests/windows`, which was demoted to
`optional` on 2026-09-01 for the identical measured reason: a chocolatey 404 on a package
nothing on Windows invokes blinded the whole Windows lane.

## The fix

Windows now defaults to `standard`. A declaration still wins, exactly as
`tools/setup/common/host-tier.sh` specifies -- `ZETA_HOST_TIER=full` on Windows still
installs the k8s set, so the capability stays reachable for Aaron's stated future
("eventually we may support windows non control nodes"); it just stops being the
unasked-for default. The skip is printed by name with both tiers, per the loud-skip
discipline at the top of `host-tier.sh`.

`standard` rather than `slim` because this is a WORKLOAD statement, not a capacity one:
the ranks are read as host size elsewhere (`host-tier.sh` detects `slim` below 8 GB) and a
Windows dev box, or a 16 GB GitHub runner, is not a small host. `standard` also keeps every
standard-tier entry (`manifests/from-dotnet-global`: the dotnet diagnostics suite, stryker,
fsharp-analyzers) available the day Windows wires that manifest up.

## Three-way parity (GOVERNANCE section 24)

`install.ps1` is consumed by dev laptops, CI runners and devcontainer images, and the change
is identical for all three: none of them installs the k8s five unless it asks. The
divergence introduced is against the UNIX installers, which auto-detect from RAM and so
resolve `full` on any 16 GB host -- and that divergence is deliberate and is the point.
Detection answers "how big is this host"; the question here is "can this host run the
workload", and the answer on Windows is no regardless of RAM.

## Falsifier

`src/Core.TypeScript/ci/windows-install-ps1-smoke.test.ts` parses the policy out of
`install.ps1` itself (`parseWindowsHostTierPolicy`, comments stripped so the guard reads the
CALL and not the prose beside it) and asserts both halves: the default is `standard`, and
`ZETA_HOST_TIER=full` still reaches the full graph. Mutation-checked -- reverting the
default to `full` turns the first assertion red. A third test pins the fact the other two
rest on: the only entries `.mise.full.toml` adds over `.mise.toml` are those five k8s tools.
