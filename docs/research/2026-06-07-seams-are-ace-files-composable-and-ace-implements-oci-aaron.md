# Seams are Ace files too (composable/recursive); and Ace implements OCI (Aaron, 2026-06-07)

Two extensions to the Ace-file / seam-grammar thread (#6957/#6960). Aaron:

> *"seams can be Ace files too, so they're composable — and Ace could implement OCI, that would be great."*

## 1. Seams are Ace files ⇒ composable, recursive, self-describing

A **seam** (the integration plane in `zeta <seam> <verb> <noun>`, #6957 — implicit/git/bus/test) is itself
**declared as an Ace file** (#6960). Consequences:

- **Seams compose by composing files.** An Ace file can `ensure` other Ace files (its seams) — so a seam is a
  reusable, declarative, idempotent, content-addressed unit (#6960). Compose seams the way you compose any Ace
  files; a complex environment is a tree of Ace files (seams within seams).
- **Recursive / self-similar (manifesto §9/§10).** The thing that *routes* a command (the seam) is the same
  kind of artifact as the thing it sets up (an Ace file). No special seam-definition language — seams are Ace
  files; the CLI grammar is **self-describing** (the planes are declared in the same format as the work).
  Homoiconic at the infra layer: the integration boundary and the build script share one representation.
- **Content-addressed seams** — because a seam is an Ace file, it's content-addressed + cacheable + DST-able
  (#6958) like any other; a seam is a ZetaId-resolvable noun too (#6916). The `git`/`bus`/`test` seams are
  built-in Ace files; new seams plug in by adding Ace files.

So: **Ace file = the unit; seams, builds, and environments are all Ace files at different scopes** — composable
all the way down.

## 2. Ace implements OCI ⇒ Ace images run anywhere containers run

Ace's content-addressed, per-layer model (#6960) maps **directly** onto the **OCI** (Open Container Initiative)
image spec — so Ace should *implement OCI*:

- **The fit is natural — both are content-addressed by layer.** OCI image layers are content-addressed by digest
  (sha256); Ace layers are content-addressed (BLAKE3/`ContentStore`, #6925/#6960). Ace's idempotent
  layer-cache is already OCI-shaped; emit an **OCI image manifest + config + layer blobs** and an Ace build *is*
  an OCI image.
- **Instant ecosystem interop.** OCI-compliant ⇒ Ace images run on **containerd / Docker / Podman / Kubernetes**
  — including the **k8s-on-real-hardware cluster (#6949)** and **ArgoCD (#6939)**. Universal Ace files (cross-OS
  patch sets, #6960) → OCI images deployable through the existing stack. Ace doesn't replace the container
  ecosystem; it *targets* it.
- **OCI distribution too.** The OCI distribution-spec (registries) gives Ace a push/pull transport for images —
  content-addressed, dedup-friendly, already standard. (Ace's `[source]` noun bracket #6959 ≈ a registry ref.)
- **Standard, not vendored.** OCI is an open spec (Apache-2.0); *implementing* it is interop, not copying —
  safe and high-leverage. (Contrast the NVIDIA-ACE naming flag #6946 — that's a name collision; this is a
  standard we conform to.)

Net: Ace files → reproducible, content-addressed builds → **OCI images** that run on every container runtime,
while *also* being native Zeta closures (#6939). Best of both: Zeta-native semantics + universal container
portability.

## Honest scope / peel

- **Design + interop direction, not built.** Ace itself is in-flight (081KSGS9H0008QG0R0031PBNGA/#6939/#6960); "seams as Ace files"
  and "Ace implements OCI" are the architecture, not shipped. OCI compliance is a real scoped effort
  (image-spec: manifest/config/layer digests; optionally runtime-spec + distribution-spec).
- **Reproducibility/hermeticity bound (#6960) still applies** — OCI layers from non-hermetic steps aren't
  reproducible; idempotent `ensure` (#6959) + hermetic steps are what make Ace's OCI layers content-stable.
- Implementing OCI ≠ writing a container *runtime* — start with the **image-spec** (build/emit OCI images),
  reuse existing runtimes (containerd); runtime-spec is optional/later.

## Ties

- **CLI seam grammar (#6957)** — seams are Ace files; the grammar is self-describing.
- **Ace file = universal content-addressed Dockerfile (#6960)** — the unit; seams/builds/envs are all Ace files.
- **ace ensure / idempotent (#6959)** — hermetic idempotent layers = content-stable OCI layers.
- **Content store / BLAKE3 (#6925)** — Ace layers ↔ OCI digests (both content-addressed).
- **k8s-on-hardware (#6949) + ArgoCD (#6939)** — where OCI-compliant Ace images deploy.
- **Manifesto §9 recursive / §10 self-similar** — seams-as-Ace-files is the recursion.
- **Ace lane (081KSGS9H0008QG0R0031PBNGA/081KSKBP80008QG0R000F4311E/081KSGS9H0008QG0R001Y9FB62)** — OCI is the container-interop face of the distribution lane.

## Beacon anchors

- **OCI — Open Container Initiative** (image-spec: content-addressed manifest/config/layer digests;
  runtime-spec; distribution-spec; Apache-2.0 open standard). · **containerd / Docker / Podman / Kubernetes**
  (the runtimes Ace images would run on). · **Content-addressed layers** (OCI sha256 digests ↔ Ace BLAKE3,
  #6925). · **Composability / homoiconicity / self-similarity** (the seam-is-an-Ace-file recursion; manifesto
  §9/§10) + Feathers' **seam** (#6957). Honest novelty: none — it makes **seams composable Ace files** (the CLI
  grammar self-describing/recursive) and proposes **Ace implements the OCI image spec** (its content-addressed
  idempotent layers map onto OCI digests → Ace images run on every container runtime, incl. the k8s-on-hardware
  cluster), interop with an open standard, not vendoring; design + direction, gated/in-flight.
