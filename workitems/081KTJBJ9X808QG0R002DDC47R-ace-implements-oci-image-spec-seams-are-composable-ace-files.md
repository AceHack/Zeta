---
id: 081KTJBJ9X808QG0R002DDC47R
type: task
state: backlog
priority: P2
slug: ace-implements-oci-image-spec-seams-are-composable-ace-files
title: "Ace implements OCI (image-spec) + seams are composable Ace files. (1) Seams (zeta <seam> <verb> <noun>, #6957) are themselves Ace files (#6960) -> composable/recursive/self-describing (manifesto §9/§10); an Ace file can ensure other Ace files (its seams); seams content-addressed + DST-able + ZetaId-resolvable like any noun. built-in git/bus/test seams = Ace files; new seams plug in as files. (2) Ace emits OCI-compliant images: Ace's content-addressed idempotent layers (BLAKE3/ContentStore #6925/#6960) map onto OCI layer digests (sha256) -> emit OCI manifest+config+layer blobs => an Ace build IS an OCI image, runnable on containerd/Docker/Podman/k8s (incl. k8s-on-hardware #6949 + ArgoCD #6939); OCI distribution-spec = push/pull transport (Ace [source] noun ~ registry ref #6959). OCI = open standard (Apache-2.0) -> interop not vendoring. Scope: START with image-spec (build/emit images), reuse existing runtimes (containerd); runtime-spec optional/later. Reproducibility bound: hermetic idempotent steps (#6959) => content-stable OCI layers. Design+interop, not built; Ace lane 081KSGS9H0008QG0R0031PBNGA/#6939/#6960. Anchors: OCI image/runtime/distribution spec, containerd/Docker/Podman/k8s, content-addressed digests."
created: 2026-06-08T00:54:18.280Z
depends_on: []
composes_with: []
---

# Ace implements OCI (image-spec) + seams are composable Ace files. (1) Seams (zeta <seam> <verb> <noun>, #6957) are themselves Ace files (#6960) -> composable/recursive/self-describing (manifesto §9/§10); an Ace file can ensure other Ace files (its seams); seams content-addressed + DST-able + ZetaId-resolvable like any noun. built-in git/bus/test seams = Ace files; new seams plug in as files. (2) Ace emits OCI-compliant images: Ace's content-addressed idempotent layers (BLAKE3/ContentStore #6925/#6960) map onto OCI layer digests (sha256) -> emit OCI manifest+config+layer blobs => an Ace build IS an OCI image, runnable on containerd/Docker/Podman/k8s (incl. k8s-on-hardware #6949 + ArgoCD #6939); OCI distribution-spec = push/pull transport (Ace [source] noun ~ registry ref #6959). OCI = open standard (Apache-2.0) -> interop not vendoring. Scope: START with image-spec (build/emit images), reuse existing runtimes (containerd); runtime-spec optional/later. Reproducibility bound: hermetic idempotent steps (#6959) => content-stable OCI layers. Design+interop, not built; Ace lane 081KSGS9H0008QG0R0031PBNGA/#6939/#6960. Anchors: OCI image/runtime/distribution spec, containerd/Docker/Podman/k8s, content-addressed digests

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTJBJ9X808QG0R002DDC47R-*.md` glob. -->
