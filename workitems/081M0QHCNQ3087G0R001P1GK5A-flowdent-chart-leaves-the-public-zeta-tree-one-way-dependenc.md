---
id: 081M0QHCNQ3087G0R001P1GK5A
type: task
state: backlog
priority: P2
slug: flowdent-chart-leaves-the-public-zeta-tree-one-way-dependenc
title: "Flowdent chart leaves the public Zeta tree — one-way dependency, and the content preserved for Max"
created: 2026-08-23T14:46:28.323Z
depends_on: []
composes_with: []
---

# Flowdent chart leaves the public Zeta tree — one-way dependency, and the content preserved for Max

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QHCNQ3087G0R001P1GK5A-*.md` glob. -->

## The invariant, in Aaron's words

> "lets go ahead and get flowdent charts out of the zeta repo i'll talk to max about it."
> — Aaron, 2026-08-23

The reason:

> "zeta should not have any private repo dependencies."

And the design note this is a down payment on:

> "part of this is we need to move forward the multi repo split eventually so flowdent
> can depend on zeta parts without itself needing to be open source — this is part of
> the design we need to take into account for our multi repo design."

**One-way dependency: Flowdent (closed) may depend on Zeta (open); Zeta must never
depend on Flowdent.** That direction is the invariant; this row is the first
enforcement of it, and the multi-repo split is where it becomes structural rather
than manual.

## What was in the tree, measured

`full-ai-cluster/k8s/applications/platform/` → `blueprints-flowdent.yaml` — three
`platform.zeta.io/v1alpha1` `Blueprint` documents, included in the `platform` ArgoCD
Application through `Application.yaml`'s `directory.include` glob.

| Blueprint | image | source repo | repo state |
|---|---|---|---|
| `opendental-suite` | `ghcr.io/flowdent/cloudservice:latest` | `Flowdent/fd-core` | **private** |
| `fd-webapp` | `ghcr.io/flowdent/fd-webclient:latest` | `Flowdent/fd-webclient` | **internal** |
| `mssql` | `mcr.microsoft.com/mssql/server:2022-latest` | (Microsoft, public) | public image, FlowDent-specific config |

Provenance was read from each package's own `repository` link, not inferred. The
`Flowdent` org reports `public_repos: 0`, `owned_private_repos: 9` — **no public
FlowDent source exists for anything**, so nobody cloning Zeta at a tag can satisfy
these references. That is `clone-at-tag-stays-sufficient` in a different costume.

### Why `mssql` went too, though its image is public

It is not a generic SQL Server Blueprint. Its only credential source is the
**`flowdent-db`** Secret (`sa-password`), and the same Secret's `sqlserver-conn` key
is what `opendental-suite` reads for `ConnectionStrings__DefaultConnection` — the
two are one deployment. The file's own header calls all three "the FlowDent stack".
Splitting the database away from the stack it belongs to would have left Zeta
holding a Flowdent-shaped fragment for no gain: `blueprints.yaml` already carries a
generic `postgres` Blueprint in the `database` category, so the library keeps a
database type. A genuinely generic `mssql` Blueprint can be added later on its own
merits, with a Secret name that is not a tenant's.

## Nothing instantiated any of them — verified, not assumed

A `Blueprint` is a **template**; it provisions nothing until a `Deployable` names it
(the rule `rendered-storage-claims.ts` and `single-node-readiness.ts` both encode,
established in #13457 / #13524). Measured on `40e993d16b`:

- The tree contains exactly **four** `Deployable` documents, all in
  `full-ai-cluster/k8s/applications/platform/examples/gmod-server.yaml`, naming
  `gmod`, `web`, and `postgres`. None names `opendental-suite`, `fd-webapp`, or `mssql`.
- `instantiatedBlueprints(loadManifests(DEFAULT_ROOTS))` returns exactly
  `["gmod", "postgres", "web"]`.
- `examples/` is outside the `platform` Application's `directory.include` glob in any
  case, so ArgoCD never applied those Deployables either.

So this removed **a dangling template reference, not a running workload**.

## PRESERVED — the removed file, verbatim

Git history holds it:

```
git show 40e993d16b:full-ai-cluster/k8s/applications/platform/blueprints-flowdent.yaml
```

but a commit someone has to go looking for is not a pointer. The full content is
reproduced here so it can be lifted into a Flowdent-side repository without
archaeology.

```yaml
# Flowdent Blueprint LIBRARY — pure DATA. The FlowDent stack (a dental-practice
# suite) made deployable as Blueprints the SAME generic engine renders: a .NET
# backend (app), a Next.js frontend (web), and a SQL Server 2022 database. ZERO
# new controller code — credentials arrive via envFrom (secretKeyRef), health is
# gated by probes, and the DB binds durable storage. See blueprint.ts.
---
# OpenDental suite — the FlowDent .NET backend. Stateless app pod on :8080.
# Connection string + JWT signing key arrive from Secrets (never inline);
# readiness gates on /health, liveness restarts on /test. Exposed on the LAN
# as a raw LoadBalancer IP (no public host routing).
apiVersion: platform.zeta.io/v1alpha1
kind: Blueprint
metadata:
  name: opendental-suite
  namespace: zeta-platform
spec:
  category: app
  stateful: false
  image: ghcr.io/flowdent/cloudservice:latest
  env:
    ASPNETCORE_ENVIRONMENT: Production
    ASPNETCORE_URLS: "http://+:8080"
    JwtSettings__Issuer: "https://api.flowdent.net"
    JwtSettings__Audience: "https://app.flowdent.net"
  envFrom:
    - { name: ConnectionStrings__DefaultConnection, secret: flowdent-db, key: sqlserver-conn }
    - { name: FLOWDENT_JWT_PRIVATE_KEY_PEM, secret: flowdent-jwt, key: private-pem }
  ports:
    - { name: http, port: 8080 }
  resources: { cpu: "1", memory: "1Gi" }
  # Probe paths confirmed against D:/OpenDentalSuiteService Program.cs:
  # MapHealthChecks("/health") (readiness) + MapGet("/test") (liveness).
  probe:
    readiness: { httpGet: { path: /health, port: 8080 } }
    liveness: { httpGet: { path: /test, port: 8080 } }
  defaultExpose: lan
---
# FlowDent web app — the Next.js frontend. Stateless, single HTTP port :3000,
# web-routable. The public API/app URLs are variables so a Deployable can point
# the frontend at any backend; API_URL must match the image's build-arg.
# Exposed on the LAN as a raw LoadBalancer IP.
apiVersion: platform.zeta.io/v1alpha1
kind: Blueprint
metadata:
  name: fd-webapp
  namespace: zeta-platform
spec:
  category: web
  stateful: false
  image: ghcr.io/flowdent/fd-webclient:latest
  env:
    NODE_ENV: production
    NEXT_PUBLIC_API_URL: "${API_URL}"
    NEXT_PUBLIC_APP_URL: "${APP_URL}"
    NEXT_PUBLIC_APP_NAME: FlowDent
  ports:
    - { name: http, port: 3000, web: true }
  resources: { cpu: "500m", memory: "1Gi" }
  probe:
    readiness: { httpGet: { path: /, port: 3000 } }
    liveness: { httpGet: { path: /, port: 3000 } }
  variables:
    - { name: API_URL, default: "http://192.168.1.243:8080", description: "backend base URL; must match the image build-arg" }
    - { name: APP_URL, default: "http://192.168.1.79:3000", description: "public URL of this frontend" }
  defaultExpose: lan
---
# SQL Server 2022 — the FlowDent database. Stateful, TDS on :1433, durable
# storage on zeta-local-path, cluster-internal only (never LAN/public).
# SA password arrives from a Secret. Single-replica by design: a single-writer
# DB must NOT be scaled to 2 (no multi-primary). mssql needs >=2Gi RAM; the
# in-process limit (MSSQL_MEMORY_LIMIT_MB) sits below the 3Gi pod limit.
apiVersion: platform.zeta.io/v1alpha1
kind: Blueprint
metadata:
  name: mssql
  namespace: zeta-platform
spec:
  category: database
  stateful: true
  image: mcr.microsoft.com/mssql/server:2022-latest
  env:
    ACCEPT_EULA: "Y"
    MSSQL_PID: Developer
    MSSQL_COLLATION: SQL_Latin1_General_CP1_CI_AS
    MSSQL_MEMORY_LIMIT_MB: "2560"
  envFrom:
    - { name: MSSQL_SA_PASSWORD, secret: flowdent-db, key: sa-password }
  ports:
    - { name: tds, port: 1433, protocol: TCP }
  storage: { size: "8Gi", mountPath: /var/opt/mssql }
  storageClassName: zeta-local-path
  resources: { cpu: "2", memory: "3Gi" }
  probe:
    readiness:
      exec:
        command:
          - /opt/mssql-tools18/bin/sqlcmd
          - -C
          - -S
          - localhost
          - -U
          - sa
          - -P
          - "$(MSSQL_SA_PASSWORD)"
          - -Q
          - SELECT 1
  defaultExpose: cluster
```

### What a Flowdent-side repo needs in order to use it

These Blueprints are **data for an engine that stays in Zeta**. Nothing above is
Flowdent-specific machinery — the CRD (`crd-blueprint.yaml`), the reconciler
(`controller.yaml`, `blueprint.ts`) and the `Deployable` contract all remain public
in `full-ai-cluster/k8s/applications/platform/`. So the Flowdent side needs only:

1. this YAML, in its own repo, applied to the `zeta-platform` namespace (or a
   tenant namespace) of whatever cluster runs it;
2. the two Secrets it reads — `flowdent-db` (`sqlserver-conn`, `sa-password`) and
   `flowdent-jwt` (`private-pem`);
3. a `Deployable` per Blueprint, which never existed here at all.

That is exactly the shape Aaron described: **Flowdent depends on Zeta parts; Zeta
does not depend on Flowdent.**

## What this does NOT fix — stated plainly

The `platform` Application stays in the partitioner's **CANNOT BE PRICED**
quarantine. `lane-partition.ts --rung dev` goes from **5 blockers to 3**, not to 0:

```
ghcr.io/ich777/steamcmd:armareforger                              <- does not exist upstream at all
ghcr.io/lucent-financial-group/zeta-platform-controller:latest    <- ours, private, UI-only visibility flip pending
ghcr.io/lucent-financial-group/zeta-portal:latest                 <- ours, private, UI-only visibility flip pending
```

`covered by a lane` is unchanged at **41/47**. This closes the sovereignty hole; it
does not make `platform` testable.

## Adjacent, sized and NOT taken

**`arma-reforger` is the same class of question and a different answer.** The
`arma-reforger` Blueprint in `blueprints.yaml` names
`ghcr.io/ich777/steamcmd:armareforger`, which the publisher does not ship — the tag
list returns 94 tags and that is not among them (the same measurement that fixed
`gmod` → `garrysmod` on 2026-08-23). It is likewise **uninstantiated**: no
`Deployable` names it, so it too is a dangling template. Removing it would take
`platform` to two blockers, both of which are the pending visibility clicks.

It is **not** removed here, and the reason is that it is not the same decision.
Flowdent's removal is authorized and is about repository sovereignty; `arma-reforger`
is a game Blueprint whose only defect is a wrong or not-yet-published tag, and the
right fix might be to correct the tag rather than to delete the Blueprint —
substituting a sibling tag was already refused as unevidenced. That is a call for
Aaron, not a cleanup to fold into this one.

## Coordination

- Supersedes the Flowdent half of **#14202** (`081M0QDZRR7087G0R003A3VBN4`), which
  measured the provenance and deliberately changed nothing: *"Options are recorded
  for Aaron and Max to choose. Nothing is removed from the chart here."* Aaron chose;
  this is the execution. The other two thirds of that row (the two package-visibility
  clicks, and `steamcmd:armareforger`) are untouched and still stand.
- **The `Flowdent` GitHub org was not touched.** Nothing there needs changing and it
  is not ours to change.

## Falsifier

- `bun src/Core.TypeScript/cluster/lane-partition.ts --rung dev` must report
  `platform` with **3** unmeasurable images and no `ghcr.io/flowdent/*` among them.
- `rg -i flowdent full-ai-cluster/k8s/applications/platform/` must return nothing.
- The `platform` Application must still render its remaining 30 objects (the render
  diff is in the PR body).
