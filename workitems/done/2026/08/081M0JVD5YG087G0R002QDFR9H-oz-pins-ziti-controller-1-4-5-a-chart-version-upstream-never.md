---
id: 081M0JVD5YG087G0R002QDFR9H
type: bug
state: done
priority: P2
slug: oz-pins-ziti-controller-1-4-5-a-chart-version-upstream-never
title: "oz pins ziti-controller 1.4.5, a chart version upstream never published -- the Application cannot resolve"
created: 2026-08-21T19:05:18.544Z
completed: 2026-08-22T00:44:56.824Z
depends_on: []
composes_with: []
---

# oz pins ziti-controller 1.4.5, a chart version upstream never published -- the Application cannot resolve

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JVD5YG087G0R002QDFR9H-*.md` glob. -->

## Measured

`full-ai-cluster/k8s/applications/oz/Application.yaml`:

    :19   repoURL: https://docs.openziti.io/helm-charts/
    :20   chart: ziti-controller
    :21   targetRevision: 1.4.5

Checked against the upstream index at that exact repoURL: **`ziti-controller`
1.4.5 does not exist.** The published 1.x line ends at **1.3.4** (2025-05-01).
`1.4.2` exists upstream only as an *appVersion*, not a chart version — which is
the likely origin of the mistake: an app version copied into a chart-version
field.

ArgoCD cannot resolve a chart version that was never published, so this
Application cannot sync at all. It is not a drift or a deprecation; the
coordinate has never been valid.

## Why nobody noticed

`oz` is not in the included dev/CI proof, so nothing ever attempted to resolve
its chart. This is the cost of the 26-of-45 exclusion surface: an Application
can carry a coordinate that has never once been resolved by anything, and no
check says so.

The general form is worth more than this instance: **nothing in the tree
verifies that a pinned `chart`+`targetRevision` is actually published.** Every
Application sourcing a remote Helm chart carries that risk, and a typo in a
version field is indistinguishable from a correct pin until something tries to
sync it. A resolvability check over every remote-chart Application would catch
this class rather than this row.

## Not fixed here — superseded 2026-08-21, and the reason given here was WRONG

This section said choosing the replacement was "a product call, not a mechanical
one" because "moving major versions is a decision about OpenZiti's own
compatibility". That was a plausible reason that nobody had checked, and it is
false for the keys this manifest actually sets. MEASURED by `helm pull` +
`helm template` of **1.3.4, 2.1.2, 3.1.1 and 3.2.1** against this Application's
own valuesObject:

| version | appVersion | renders with our values | PVC produced |
|---|---|---|---|
| 1.3.4 | 1.5.4 | yes | `ziti-controller` 3Gi longhorn |
| 2.1.2 | 1.7.2 | yes | identical |
| 3.1.1 | 1.7.2 | yes | identical |
| 3.2.1 | **2.0.1** | **no** — `cluster.mode` is required | identical once set |

Every key this manifest sets survives all three major lines; the storage
contract is byte-for-byte the same in all four. What 2.x/3.x actually dropped —
the bundled `ingress-nginx` / `cert-manager` / `trust-manager` subcharts, then
`highAvailability` and `trustDomain` — this manifest never used.

**Resolved as 3.1.1**: the newest chart still on appVersion 1.7.2, so it is the
furthest forward the pin can move *without* changing which OpenZiti server runs.
3.2.1 is a server major (1.7.2 → 2.0.1) and additionally makes `cluster.mode`
required; that is two operator decisions and is left as a separate, deliberate
choice.

## What the bad pin was HIDING — the more important half

The pin failed at `helm pull`, so nothing ever reached `helm template`, so two
further defects in the same manifest were invisible:

1. **`clientApi.advertisedHost` was never set**, and every published version
   refuses to template without it. Correcting the pin alone would have moved the
   failure from `helm pull` to `helm template` and lifted nothing.
2. **`adminSecret: {name, key}` is inert** — `adminSecret` is not a key
   ziti-controller has ever had, in any version. The chart reads
   `useCustomAdminSecret` + `customAdminSecretName`, and the secret's keys are
   fixed as `admin-user`/`admin-password`, not `password`. The controller would
   have run on a chart-generated random credential while the manifest claimed
   otherwise. Same class as hindsight's `postgresql.primary.*` and nats' top-level
   `cluster:`.

Both are fixed alongside the pin, because fixing only the pin would have left the
Application still unable to sync and the storage row still unverifiable.

## Verification

- `bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts` — 35 of 35
  coordinates resolve, **0 acknowledged** (the register this bug created is now
  empty; the entry was retired by fixing the pin, not by re-keying it).
- `bun src/Core.TypeScript/cluster/rendered-storage-claims.ts --offline` — `oz`
  is no longer UNRENDERABLE, and `full-ai-cluster/oz/data` now MATCHES a rendered
  PVC (`ziti-controller`, 3Gi, longhorn) rather than being counted as neither
  verified nor refuted.
- `full-ai-cluster/k8s/storage-profiles.json` — `acknowledgedUnmeasuredRequests`
  is `[]`; `oz`'s requests are measured (`resources: {}` → 0m/0Mi, which is a
  measurement that it reserves nothing, not a missing value).

## Provenance

Found by the day-zero chart-requirements research (PR #13309) while pulling
every pinned chart at its exact `targetRevision` — eleven of twelve resolved;
this was the twelfth. Independently re-verified against the upstream index
before filing.

