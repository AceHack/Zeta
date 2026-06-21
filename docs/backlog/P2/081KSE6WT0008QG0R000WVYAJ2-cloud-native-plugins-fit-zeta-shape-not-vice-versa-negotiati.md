---
id: 081KSE6WT0008QG0R000WVYAJ2
priority: P2
status: open
title: Cloud-native plugins fit Zeta's interface shape (not vice versa) — vendor-swap capability puts the operator in the negotiation high seat
effort: L
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-26
composes_with:
  - 081KSE6WT0008QG0R002CC6314
  - 081KSE6WT0008QG0R000SH6E0R
  - 081KSE6WT0008QG0R002E6P098
  - 081KSE6WT0008QG0R001RG4FXD
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R003G0Y62D
  - 081KSE6WT0008QG0R0015ZF2G6
  - 081KSE6WT0008QG0R003FG3E8R
tags: [cluster, cloud-native, plugins, interfaces, negotiation, vendor-lock-in, swap]
---

## Problem

Aaron 2026-05-25 (mid-iteration-2 wait): *"we can start adding
cloud native plugins to our interfaces but we make them fit out
shape and it puts us in the negoation high seat cause we can swap
around."*

The default cloud-native pattern: vendor publishes a service +
SDK (AWS S3, GCP Cloud SQL, Azure Cosmos DB, Cloudflare R2,
Cloudflare D1, Vercel Blob, etc.); operator builds against
vendor's interface; switching cost is rewriting the operator's
code paths to match a different vendor's interface; vendor
captures the operator long-term.

This is **vendor-in-the-negotiation-high-seat** — the vendor
sets the interface; operator adapts; operator pays whatever the
vendor charges because switching is expensive.

The Zeta-native alternative Aaron names:

> **Zeta defines the interfaces; cloud vendors implement Zeta's
> interface to be usable by Zeta operators. Operator owns the
> shape; swaps vendors at will.**

This is **operator-in-the-negotiation-high-seat** — operator
sets the interface; vendors compete on quality/price/SLA
underneath; switching cost approaches zero because the operator's
code paths don't change when the vendor swaps.

## Target

Define Zeta-native interfaces for every cloud-native primitive
the cluster needs, then ship plugin adapters that fit each major
vendor's substrate to the Zeta interface. Operators write against
Zeta's interfaces; plugins translate to vendor APIs underneath.
Operator swaps plugin → vendor changes; operator's code doesn't.

| Zeta interface (operator-facing) | Plugin adapters (vendor-implementing) |
|---|---|
| `Zeta.Storage.BlobStore` | S3 / GCS / Azure Blob / Cloudflare R2 / Backblaze B2 / Longhorn / Ceph / local-disk |
| `Zeta.Storage.KeyValue` | DynamoDB / Cosmos DB / Cloudflare D1 / Cloudflare KV / Redis / Valkey / DragonflyDB / FoundationDB |
| `Zeta.Storage.Document` | MongoDB / Cosmos DB / Firestore / CouchDB / Postgres-JSONB |
| `Zeta.Storage.Vector` | Pinecone / Weaviate / Qdrant / Milvus / pgvector / OpenSearch-kNN |
| `Zeta.Compute.Function` | AWS Lambda / GCP Cloud Functions / Cloudflare Workers / Knative / K8s Jobs |
| `Zeta.Compute.GPU` | AWS EC2-GPU / GCP A100 / Lambda Labs / RunPod / local NVIDIA / local AMD ROCm |
| `Zeta.Identity.Auth` | Auth0 / Okta / Cognito / Firebase Auth / Keycloak / OIDC / WebAuthn (081KSE6WT0008QG0R000SH6E0R) |
| `Zeta.Messaging.Queue` | SQS / Pub/Sub / Service Bus / NATS / Kafka / RabbitMQ |
| `Zeta.Network.LoadBalancer` | ALB / GCP LB / Azure FrontDoor / nginx / Traefik / kube-vip |
| `Zeta.Observability.Metrics` | CloudWatch / GCP Monitoring / Datadog / Prometheus / Grafana Cloud |
| `Zeta.Observability.Logs` | CloudWatch Logs / GCP Logging / Splunk / Loki / Elasticsearch |
| `Zeta.Observability.Traces` | X-Ray / GCP Trace / Honeycomb / Jaeger / Tempo |
| `Zeta.Secrets` | AWS Secrets Manager / GCP Secret Manager / Vault / SOPS / age |

Each interface is small (5-20 methods), Zeta-shaped (operator-
ergonomic, retraction-native where applicable), and lives in
`Zeta.<Primitive>` namespaces (e.g., `Zeta.Storage`, `Zeta.Compute`,
`Zeta.Identity`, `Zeta.Messaging`, `Zeta.Network`,
`Zeta.Observability`, `Zeta.Secrets`) — matching the table above.
Plugin adapter implementations live under
`Zeta.Cloud.Plugins.<vendor>` namespaces (per the registry
acceptance bullet below); the `Zeta.Cloud.Plugins.*` tree is the
adapter-implementation surface, NOT the operator-facing interface
surface.

## Acceptance

- [ ] One canonical example shipped end-to-end:
      `Zeta.Storage.BlobStore` interface + 3 plugin adapters
      (Longhorn + S3 + Cloudflare R2) + sample app that uses
      the interface and swaps plugins via config change only
- [ ] Plugin authoring contract: documented in
      `docs/PLUGIN-AUTHOR.md`; every plugin must
      implement the full interface OR explicitly mark
      unsupported methods (no silent partial implementation)
- [ ] Conformance test suite per interface: every plugin runs
      the same test suite; passing means it's swappable
- [ ] Plugin registry: discoverable list of supported vendors
      per interface; community can publish plugins under
      `Zeta.Cloud.Plugins.<vendor>` namespaces
- [ ] Cost-comparison surface: per-interface table of vendor
      pricing (per-GB-stored, per-request, per-egress-GB);
      operator-facing tool to estimate cost across vendors for
      same workload
- [ ] SLA-comparison surface: per-interface table of vendor
      SLA (uptime %, latency p99, max-throughput)
- [ ] Hot-swap support where possible: operator changes plugin
      config; zero data migration needed for stateless plugins
      (LoadBalancer, Auth); explicit migration path for
      stateful (BlobStore — has to copy bytes; KeyValue —
      has to export/import)
- [ ] Reference deployment: full Zeta stack with all interface
      plugins picked + documented + cost-estimated, ready for
      operators to fork
- [ ] `full-ai-cluster/PROVISIONING.md` updated: name the
      swap-vendors capability as a load-bearing competitive feature
- [ ] `full-ai-cluster/README.md` updated: lead with
      "vendor-lock-in is a choice; Zeta lets you un-choose it"

## The negotiation-high-seat framing

The substrate-honest argument: **interfaces own the negotiation
because they own switching cost**. When the operator owns the
interface, switching cost is plugin-replacement (low). When the
vendor owns the interface, switching cost is application-rewrite
(high). Whoever pays the lower switching cost holds the
negotiation high seat.

Today's cloud market is interface-owned-by-vendor:

- AWS interfaces → operators rewrite to leave AWS → AWS captures
  rent indefinitely
- Cloudflare interfaces → same shape, different vendor
- Vercel / Supabase / Netlify / Fly / Render → same shape,
  more vendors

The exceptions (where operator owns interface):

- **POSIX filesystem** — operators write to `open()` /
  `read()` / `write()`; filesystem implementations compete
  underneath (ext4, btrfs, xfs, zfs, NFS, etc.); operator
  never rewrites application code to swap filesystems
- **SQL** — operators write SQL; databases compete to implement
  the standard (PostgreSQL, MySQL, MSSQL, Oracle, SQLite,
  CockroachDB, TiDB, etc.); switching is hard ONLY because
  every vendor adds non-standard extensions; operators who
  stay-pure-SQL can swap
- **HTTP** — clients write to HTTP; servers compete; trivial to swap

The strategic point: **POSIX, SQL, HTTP own the high seat.** The
vendors compete underneath. Each is a moat for the standard
itself.

Zeta's bet: build the **POSIX-equivalent for cloud-native
primitives**. Operators write to `Zeta.Storage.BlobStore`; AWS
S3 / GCS / R2 / Backblaze compete to be the cheapest+fastest+most-
reliable implementation of that interface.

## ARC-AGI parallel (081KSE6WT0008QG0R0015ZF2G6) + telemetry flywheel (081KSE6WT0008QG0R003FG3E8R)

Composes naturally with the two flywheels already filed:

- **081KSE6WT0008QG0R0015ZF2G6 reference architecture**: cloud-agnostic + AI-trainable
  reference is more valuable when the operator's code doesn't
  change per vendor — the reference IS the interface, not the
  vendor-specific composition
- **081KSE6WT0008QG0R003FG3E8R auto-submit-back telemetry**: in-the-wild installs
  generate telemetry on which plugin combinations work best for
  which workloads; that data feeds vendor-cost optimization +
  improves the plugin registry's recommendations for future
  operators

## Composes with

- 081KSE6WT0008QG0R002CC6314 — ontology+category negotiation (this row IS that
  pattern applied at the cloud-vendor layer)
- 081KSE6WT0008QG0R000SH6E0R — FIDO2/WebAuthn/Passkeys/OIDC bridge (the
  `Zeta.Identity.Auth` interface composes with this)
- 081KSE6WT0008QG0R002E6P098 — kro/Crossplane/middleware spectrum (the runtime
  substrate for declaring plugin choices via k8s CRDs)
- 081KSE6WT0008QG0R001RG4FXD — KubeVela/OAM Component/Trait model (the vocabulary
  for declaring interface implementations + composing them)
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing cluster install (the operator-facing
  install path needs interface plugins to be discoverable at
  install time)
- 081KSE6WT0008QG0R003G0Y62D — first-time-CLI-user persona (the swap-vendors
  capability needs persona-aligned UX: cost-compare in plain
  language, not jargon)
- 081KSE6WT0008QG0R0015ZF2G6 — open-source reference architecture (the swappability
  is what makes it actually cloud-agnostic, not just
  cloud-portable-in-theory)
- 081KSE6WT0008QG0R003FG3E8R — AI auto-submit-back telemetry (the in-the-wild data
  source for plugin-recommendation + vendor-cost optimization)

## Implementation strategy

V1 (this row's scope): one canonical interface +
3 plugin adapters as proof-of-concept. `Zeta.Storage.BlobStore`
is the right starting point because:

- Concrete, well-understood semantics (write blob, read blob,
  delete blob, list blobs, presigned URLs)
- Big switching cost in today's market (AWS S3 lock-in is
  load-bearing for many SaaS operators)
- Many vendors to compare against (S3, GCS, R2, Backblaze,
  Wasabi, MinIO, Longhorn, Ceph)
- Conformance testable (fixed test suite per plugin)
- Composable with Zeta's existing storage substrate
  (longhorn-disks.nix, ceph/rook future)

V2+ (separate rows): each additional interface gets its own
row + acceptance + conformance suite.

## Out of scope

- Building plugins for EVERY cloud vendor immediately —
  start with major ones (AWS / GCP / Azure / Cloudflare /
  open-source); community adds others
- Trying to standardize Zeta interfaces with an industry body
  (CNCF, OASIS, etc.) — premature; ship working substrate
  first, standardize later if traction
- Hot-swap migration tooling for stateful plugins (BlobStore,
  KeyValue) — separate row; v1 documents the migration path,
  v2 automates it

## Strategic context

This row + 081KSE6WT0008QG0R0015ZF2G6 (reference architecture) + 081KSE6WT0008QG0R003FG3E8R (telemetry
flywheel) compose into Zeta's competitive moat against:

- Proprietary cloud platforms (locked APIs)
- Other open-source cluster products (Talos, k3s-vanilla, etc.)
  that don't explicitly own the interface layer
- Cloud-portable orchestrators (Pulumi, Terraform, Crossplane)
  that work at the resource-provisioning layer but don't
  abstract the runtime interfaces operators write code
  against

The combination — owned interfaces + open reference architecture +
self-improving telemetry — is what makes Zeta a genuinely new
shape in the cluster-infrastructure market, not just "another
cluster product."

## Origin

Aaron 2026-05-25, mid-iteration-2 wait, naming the negotiation-
high-seat positioning that owning interfaces (vs implementing
vendors' interfaces) delivers. Composes naturally with today's
already-filed substrate cluster (081KSE6WT0008QG0R002CC6314 through 081KSE6WT0008QG0R003FG3E8R).
