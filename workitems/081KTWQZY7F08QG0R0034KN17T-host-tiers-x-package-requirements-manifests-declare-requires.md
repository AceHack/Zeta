---
id: 081KTWQZY7F08QG0R0034KN17T
type: task
state: backlog
priority: P2
slug: host-tiers-x-package-requirements-manifests-declare-requires
title: "Host tiers x package requirements — manifests declare requires, hosts declare capabilities, the installer matches (the cap/support pattern applied to setup)"
created: 2026-06-12T01:43:52.303Z
depends_on: []
composes_with: []
---

# Host tiers x package requirements — manifests declare requires, hosts declare capabilities, the installer matches (the cap/support pattern applied to setup)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTWQZY7F08QG0R0034KN17T-*.md` glob. -->

## Origin (Aaron 2026-06-12, verbatim)

> "maybe we should start having category or tier or something when we add a tier or packages can
> declare their requirements and os declare their capablities and that's how wo know not to
> install on small/slow runner"

Triggered by the low-memory wedge (#7865): `dotnet workload update` downloading every advertising
manifest on a constrained runner. The shape is EXACTLY the capability-ledger pattern
(db/capabilities: cap rows declare, support rows place) applied to setup — packages = cap rows
(declare requirements), hosts = support rows (declare capabilities), the installer is the
resolver. Prior art in-repo: one-liner-tools.sh ZETA_INSTALL_FULL opt-in (a 2-tier special case).

## Slice 1 (landed with this workitem)

- Manifest token `tier=<slim|standard|full>` (untagged = slim = required everywhere);
  `ZETA_HOST_TIER` declares the host (default full — dev machines get everything; the low-memory
  workflow declares slim). slim < standard < full; install when host ≥ requirement; skips are
  LOUD (named tool + both tiers).
- Applied in dotnet-tools.sh; the diagnostics suite + stryker + fsharp-analyzers tagged standard
  (build/test on slim lanes need none of them; gate lanes default to full).

## Slice 2 (Aaron: "what else we got — do that too")

- `common/host-tier.sh` — THE shared helper: explicit `ZETA_HOST_TIER` wins, else AUTO-DETECT
  from memory (>=16GB full / >=8GB standard / else slim; unknown hardware degrades to full —
  permissive, never silently slim); skip messages name declared-vs-detected.
- Consumers: dotnet-tools.sh (refactored onto the helper), dotnet-workloads.sh (entries may
  carry tier=), macos.sh brew loop (tier-aware parse — a tier= token no longer reaches
  `brew install`).
- brew manifest: qemu/podman/opam/r/tectonic tagged standard (z3 stays slim — tests use it;
  ollama/hermes stay slim — operator-declared core).

## Remaining

- apt manifest: all current entries are dotnet-required (slim) — tier the loop when a heavy
  entry first appears.
- Fold the legacy full-tier gates (ZETA_INSTALL_FULL in one-liner-tools/tlaps, ZETA_INSTALL_QUANTUM)
  into the same vocabulary.
- verifiers.sh jars: tests may invoke TLC/Alloy — audit before tiering.
- Unify with db/capabilities resolver wiring (one cap/support vocabulary across setup + runtime).

## Slice 3 (Aaron: "do the mise k8s split too… addison and max and every cluster to have full…
we want to test full")

- `.mise.full.toml` — the k8s set (k3d/kind/kubectl/helm/kubeconform) at the SAME pins, merged
  only on full hosts via MISE_ENV=full (mise.sh sources host-tier.sh; slim/standard skip LOUDLY).
- Cluster nodes are full BY DECLARATION (Aaron verbatim): zeta-install.sh pins ZETA_HOST_TIER=full
  at its install.sh call — hardware auto-detect never decides for a cluster node.
- "Test full" honored: the gate `lint (yaml/k8s)` job + both k8s-argocd-health install steps
  declare ZETA_HOST_TIER=full explicitly (never rely on runner-size auto-detect).
- Cache keys (gate + low-memory) hash BOTH mise files; manifest-symmetry reads the PAIR;
  install.ps1 defaults Windows to full (merges .mise.full.toml) unless declared otherwise.
- Drive-by main fix: #7477's headscale-cli/tailscale brew entries had no Windows symmetry —
  tailscale joins manifests/windows (winget client, optional), headscale-cli allowlisted
  (server-side ops CLI).
