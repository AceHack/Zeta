# Blob store contract — shared S3 for the cluster

Zeta ships two S3-compatible backends under `k8s/applications/`. **Both reconcile
by default** so you can A/B-test without tearing either down. Loki and Mimir
point at MinIO unless you repoint the endpoint.

| App | Sync | Endpoint (in-cluster) | Port | Consumer default |
|-----|------|------------------------|------|------------------|
| **minio/** | automated | `blob-store.object-store.svc.cluster.local` | 9000 | **yes** |
| **seaweedfs/** | automated | `blob-store-seaweedfs-all-in-one.object-store.svc.cluster.local` | 8333 | no (opt-in; not in kind included gate) |

## When to pick which (production)

| | MinIO | SeaweedFS |
|---|-------|-----------|
| **Sweet spot** | Pure S3 semantics; Loki/Mimir/backup tools that speak S3 | Many small objects; optional filer/FUSE; lighter all-in-one footprint |
| **S3 compatibility** | Broad AWS S3 parity (IAM, lifecycle, replication, versioning) | S3 gateway — works for Loki/Mimir, but edge-case differences vs AWS exist |
| **Extra protocols** | S3 (+ optional FTP in chart) | S3 + native HTTP filer + optional SFTP |
| **Scale-out story** | Distributed erasure-coded pools | Master / volume / filer topology; tiering to cloud blob |
| **Ops weight (dev)** | Standalone pod + PVC | allInOne pod + PVC (lighter) |
| **Console** | Built-in web UI | Filer UI / metrics; less “S3 console” polish |

**Zeta default:** MinIO for observability consumers (safer S3 fidelity). Keep
SeaweedFS running for comparison, filer workloads, and future backup paths that
benefit from Seaweed’s append/small-file strengths.

## Layering

```
Loki / Mimir / backups  →  S3 API  →  MinIO or SeaweedFS  →  PVC (zeta-local-path or longhorn)
```

Longhorn (or `zeta-local-path`) provides **block** volumes. The blob store provides **object**
storage. Observability apps never talk to Longhorn directly for chunks.

## Shared buckets

Each backend provisions its **own** copy of these buckets (isolated stores):

| Bucket | Consumer |
|--------|----------|
| `loki-chunks` | Loki write/read/backend |
| `loki-ruler` | Loki ruler |
| `mimir-tsdb` | Mimir blocks storage |
| `mimir-ruler` | Mimir ruler + alertmanager storage |
| `zeta-backups` | DB dumps, snapshots (future CronJobs) |

## Dev credentials (pre-v1)

Both backends use the same dev identity for now:

- **Access key:** `zeta-blob-store`
- **Secret key:** `zeta-blob-store-dev-secret`

Promote to Vault / External Secrets before any production tenant data lands.

## Consumer wiring (MinIO — default)

**Loki** (`loki/Application.yaml`):

```yaml
minio:
  enabled: false
loki:
  storage:
    type: s3
    bucketNames: { chunks: loki-chunks, ruler: loki-ruler }
    s3:
      endpoint: blob-store.object-store.svc:9000
      accessKeyId: zeta-blob-store
      secretAccessKey: zeta-blob-store-dev-secret
      insecure: true
      s3ForcePathStyle: true
```

**Mimir** (`mimir/Application.yaml`):

```yaml
minio:
  enabled: false
mimir:
  structuredConfig:
    blocks_storage:
      backend: s3
      s3:
        endpoint: blob-store.object-store.svc:9000
        bucket_name: mimir-tsdb
        access_key_id: zeta-blob-store
        secret_access_key: zeta-blob-store-dev-secret
        insecure: true
    alertmanager_storage:
      backend: s3
      s3:
        endpoint: blob-store.object-store.svc:9000
        bucket_name: mimir-ruler
        access_key_id: zeta-blob-store
        secret_access_key: zeta-blob-store-dev-secret
        insecure: true
    ruler_storage:
      backend: s3
      s3:
        endpoint: blob-store.object-store.svc:9000
        bucket_name: mimir-ruler
        access_key_id: zeta-blob-store
        secret_access_key: zeta-blob-store-dev-secret
        insecure: true
```

## Consumer wiring (SeaweedFS — A/B test)

Replace `endpoint` and port in the snippets above:

```yaml
endpoint: blob-store-seaweedfs-all-in-one.object-store.svc:8333
```

Keep bucket names and credentials unchanged. Sync Loki/Mimir after editing.
Data does **not** migrate automatically — each backend has its own empty/filled buckets.

## Cutover procedure (move consumers MinIO → SeaweedFS)

1. Ensure `seaweedfs` Application is Synced+Healthy (buckets exist).
2. Update Loki/Mimir `endpoint` to the SeaweedFS row in the table above.
3. `argocd app sync loki mimir`
4. Optional: scale/write test queries to compare behaviour before decommissioning MinIO.

To revert, point endpoints back to `blob-store.object-store.svc:9000`.

## Storage class

| Profile | `persistence.storageClass` / `allInOne.data.storageClass` |
|---------|-----------------------------------------------------------|
| kind CI / k3d dev | `zeta-local-path` |
| homelab k3d full (Longhorn) | `longhorn` |

Changing to `longhorn` excludes the blob-store app from `--scope included` proof
(harness skips apps referencing Longhorn) but keeps it in `--scope full`.
