# GitLab registry pulls: the registry proxies blobs itself

## Symptom

Image pulls from the GitLab container registry (`registry.flowdent.net`) failed for every
client outside the cluster, while the in-cluster runner worked:

- the node's own containerd/kubelet: `ErrImagePull`, `DeadlineExceeded`;
- Docker on a workstation:
  `unexpected status from GET request to http://blob-store-seaweedfs-all-in-one.object-store.svc:8333/gitlab-...`.

## Cause

The registry's object storage is the in-cluster SeaweedFS S3 gateway
(`regionendpoint: http://blob-store-seaweedfs-all-in-one.object-store.svc:8333`, from the
`zeta-blob-store` secret, key `config`). The distribution registry's default for an S3 driver is
to answer a blob `GET` with a **307 redirect to a presigned URL on that endpoint**, so the client
fetches the layer from S3 directly. The endpoint is a cluster-internal DNS name: no client outside
the cluster can resolve it, and that includes the node's own containerd/kubelet (measured: its
pulls fail the same way).

## Fix

`full-ai-cluster/k8s/applications/gitlab/Application.yaml`, `valuesObject`:

```yaml
registry:
  storage:
    secret: zeta-blob-store
    key: config
    redirect:
      disable: true          # renders storage.redirect.disable: true in the registry config.yml
```

With the redirect off the registry pod reads each blob from SeaweedFS and streams it, so clients
only ever talk to `registry.<domain>`.

Cost: registry CPU and bandwidth now carry every layer byte (one extra in-cluster hop). That is
fine for a single node and is the same trade the chart's own default makes whenever
`registry.minio.redirect` is false.

## The same failure class for GitLab downloads

Artifacts, LFS, uploads and packages are served by Workhorse. If `proxy_download` were `false`,
Workhorse would redirect a browser to a presigned URL on the same in-cluster S3 name. The chart
default is already `true` (consolidated block and every typed store), and the Application now
pins it explicitly:

```yaml
global:
  appConfig:
    object_store:
      proxy_download: true
```

so a chart bump cannot silently flip it. CI artifact downloads by the in-cluster runner were never
affected; this protects browser downloads by a person outside the cluster.

## Proof and its limits

- `src/Core.TypeScript/cluster/gitlab-exposure.test.ts` test `(i)` renders the pinned chart
  (at whatever chart version is pinned; first written at 8.7.0, verified live through 10.4.1) with `helm template` and asserts the registry ConfigMap's `config.yml.tpl` carries
  `storage.redirect.disable: true`, that the Application pins `proxy_download: true`, and that no
  rendered `proxy_download` is anything but `true`. Both tests fail on the previous Application.
- Not proven by the render: that a client outside the cluster can now pull. That needs the live
  node (ArgoCD applies this from `main`, no reflash; the registry Deployment rolls because its
  ConfigMap checksum changes). After sync, `docker pull registry.flowdent.net/<project>/<image>`
  from a workstation should no longer name `object-store.svc`.
