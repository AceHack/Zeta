---
id: 081M0Z5M416087G0R003XGWM5T
type: bug
state: backlog
priority: P2
slug: full-ai-cluster-k8s-applications-ddns-has-no-application-yam
title: "full-ai-cluster/k8s/applications/ddns/ has no Application.yaml -- the DDNS CronJob is applied by nothing"
created: 2026-08-26T13:54:44.902Z
depends_on: []
composes_with: []
---

# full-ai-cluster/k8s/applications/ddns/ has no Application.yaml -- the DDNS CronJob is applied by nothing

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Z5M416087G0R003XGWM5T-*.md` glob. -->

## Measured on origin/main (695f20afab)

`full-ai-cluster/k8s/applications/ddns/` contains exactly one file:

    ddns/cronjob.yaml   [kind: CronJob]

There is **no `Application.yaml` in the directory at all**. Nothing else names
it either:

- the app-of-apps roots (`zeta-root`, `zeta-root-dev`) include only
  `{*/Application.yaml,Application.yaml}`, and `ddns/cronjob.yaml` is not named
  `Application.yaml`;
- no other Application declares a git source whose `path` covers `ddns/` --
  checked against all 13 git-directory sources in the cluster tree.

So this CronJob is applied by nothing, on metal or in the kind lane.

## How it was found

By direction C of `src/Core.TypeScript/cluster/app-of-apps-discovery.ts`, added
in the same change that files this. That audit asks, for every one of the 57
**non-Application** manifests under the applications tree, whether any
Application's git source reconciles it. Three did not; this is one of them.

The pre-existing audit could not have found it: directions A and B only ever
looked at `kind: Application` files, and the defect here is a directory that
has none.

## Provenance

Landed unreconciled in `4764d8db3a` -- "feat(domain): zeta-gateway + Let's
Encrypt issuer + Namecheap DDNS (#7432)". The sibling pieces of that PR
(gateway, ClusterIssuer) live under `applications/platform/` and ARE reconciled
by the platform Application's explicit include list; the DDNS CronJob was
placed in its own directory and never given an owner.

## Not fixed here, deliberately

Two reasons, and the second is the harder one:

1. Authoring the missing Application is a deployment change to a workload
   outside the scope of the change that found it.
2. The CronJob needs a **Namecheap DDNS credential**. This repo cannot mint one,
   and the secret machinery it would hang off (external-secrets ← Vault) is
   itself unavailable: Vault "has never been initialised on metal"
   (`applications/vault/TOPOLOGY.md` §2). Writing the Application without
   naming that dependency would produce an app that syncs and then fails at
   runtime -- a different flavour of the same "looks deployed" defect.

Registered meanwhile in `ORPHANED_SUPPORTING_REASONS`, so it is visible and
cannot silently drift: if anything ever does reconcile it, the audit reports
STALE-ORPHAN and this entry must be removed.
