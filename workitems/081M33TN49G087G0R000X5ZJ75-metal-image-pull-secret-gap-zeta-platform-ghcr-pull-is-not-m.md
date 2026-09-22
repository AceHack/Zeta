---
id: 081M33TN49G087G0R000X5ZJ75
type: bug
state: backlog
priority: P2
slug: metal-image-pull-secret-gap-zeta-platform-ghcr-pull-is-not-m
title: "Metal image-pull secret gap: zeta-platform/ghcr-pull is not minted outside dev/CI"
created: 2026-09-22T05:50:39.408Z
depends_on: []
composes_with: []
---

# Metal image-pull secret gap: zeta-platform/ghcr-pull is not minted outside dev/CI

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M33TN49G087G0R000X5ZJ75-*.md` glob. -->

## The gap

`full-ai-cluster/k8s/applications/platform/{controller,portal}.yaml` both declare
`imagePullSecrets: [{name: ghcr-pull}]`, pulling
`ghcr.io/lucent-financial-group/zeta-{platform-controller,portal}` — both **private**
GHCR packages. `src/Core.TypeScript/cluster/dev-cluster/lib.ts`'s `DEV_GHCR_PULL_SECRET`
mints `ghcr-pull` per dev/CI cluster at bring-up from `ZETA_GHCR_PULL_TOKEN` /
`GITHUB_TOKEN`, and `argocd-health-test.ts`'s `assertDevRegistryPullSecretPresent`
refuses an included dev run without it — but that is a CI-only runtime harness action.

**Nothing in the committed tree mints `ghcr-pull` for a real metal install.**
`collectTreeMintedSecretNames()` (src/Core.TypeScript/cluster/audit-existing-secret-is-minted.ts)
confirms zero `Secret`/`SealedSecret`/`ExternalSecret` manifests exist anywhere under
`full-ai-cluster/k8s/applications/` — this is true of every credential in the tree, not
only this one, but `ghcr-pull` is the worst instance: `platform` is sync-wave `-20`
(automated, not manual-sync), so without this Secret both platform pods
`ImagePullBackOff` forever on first boot. Measured 2026-09-22 while restoring
`resource.customizations.health.argoproj.io_Application` (081M33T23ZQ087G0R002ZYRHDG):
even under the OPT-IN gating design that change shipped with (only annotated
providers propagate health to wave ordering), an operator who annotates `platform`
as gating — or who simply needs platform's controller/portal actually running — hits
this wall on the very first metal install.

## Why this is a human decision, not a mechanical fix

It needs a REAL credential: either a GHCR PAT/deploy-token with `read:packages` scope
on `lucent-financial-group/zeta-{platform-controller,portal}`, or a decision to make
the packages public. Minting fake material would defeat the point of the check.

## Two options for whoever picks this up

1. **Make the GHCR packages public.** `platform`'s own `DEV_EXCLUDED_REASONS` entry
   (argocd-health-test.ts) already measured that both images are legitimately built and
   published (`.github/workflows/build-platform-images.yml` pushes on every push to
   main touching those paths); the only reason they need a pull secret at all is
   `visibility: private`. Flipping visibility is a disclosure decision the maintainer
   owns, not a mechanical change.
2. **Project the credential from the USB-restored install-time material**, via
   `full-ai-cluster/nixos/modules/zeta-creds-to-k8s.nix` and the
   `full-ai-cluster/INJECTION-POINTS.md` rail. That module already does the shape
   needed (allowlisted host-restored files → Opaque Secrets in `zeta-host-creds`,
   `src/Core.TypeScript/installer/zeta-creds-to-k8s.ts` allowlist) but does not
   currently emit a `kubernetes.io/dockerconfigjson` Secret into `zeta-platform`, and
   a GHCR PAT is SECRET-class material under `INJECTION-POINTS.md`'s rail
   ("Cluster console at install time ONLY; operator-typed; never on USB ESP") — so
   this is an install-time operator-typed value, not a file that can ship on the ESP.

## Acknowledged in the interim

`src/Core.TypeScript/cluster/existing-secret-is-minted.baseline.json` key
`platform|ghcr-pull` carries the full analysis and this workitem's id as the lift
condition. `crd-provider-consumer-order.ts`'s opt-in gating design does NOT mark
`platform` as a gating provider (nothing depends on platform's own CRDs across
Applications today), so this gap does not itself propagate a stall to later waves
under the shipped design — but platform's own pods still never come up without it,
which is the actual product impact.

