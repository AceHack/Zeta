# OpenBao migration path for the deployed Vault — the data question answered, and the two checks that do not catch it

**Analysis only. Nothing applied to any cluster, no device touched, no key / PIN / credential read,
printed or handled. `op` not invoked. This is a PATH, not a MOVE — Vault is live in this cluster.**

**Date:** 2026-08-21 · Follows
[`2026-08-20-hsm-tpm-into-vault-and-cert-manager-yes-for-tpm-but-not-through-vault-openbao-is-the-answer.md`](2026-08-20-hsm-tpm-into-vault-and-cert-manager-yes-for-tpm-but-not-through-vault-openbao-is-the-answer.md),
which established that OpenBao is the answer. This one establishes what moving would actually cost,
against the manifest that is actually deployed.

> **Three answers up front.**
>
> 1. **Our own audit rule does NOT obstruct the migration.** `seal-stanza-requires-vault-enterprise`
>    stands down for an OpenBao source exactly as designed — **measured**, by running the audit
>    against a migration-shaped `Application.yaml` carrying a live `seal "pkcs11"` stanza. It
>    reported one finding, and that finding was `chart-version-unmeasured`, which is a re-measure
>    demand, not a block. §4.
> 2. **The secret-data migration requires nothing, because there is no secret data** — Vault has
>    never been initialised. That is the whole answer, and it is the _only_ reason the answer is
>    cheap: the documented Vault→OpenBao in-place path **does not cover this deployment** on two
>    independent counts (our Vault is 1.18.1, the guide caps at 1.14.x; the guide's procedure needs
>    ≥ 2 raft nodes, we run 1). Migrate before initialisation or migrate the hard way. §3.
> 3. **Two things in the tree would let a broken migration ship green**, both found by running the
>    checks rather than reading them: the chart-version pin is satisfiable by the _wrong chart_
>    (openbao-helm forks vault-helm's version line, so both publish `0.29.1`), and nothing compares
>    the raft `path` against the chart's data `mountPath` — which differ between the two charts.
>    §5.

---

## 1. What is actually deployed — measured, not inherited

Every row read from the tree at `origin/main` `9d25885d4`.

| Fact                     | Value                                                                                                                                      | Where                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| ArgoCD Application       | `name: vault`, `namespace: argocd`, sync-wave `-60`                                                                                        | `full-ai-cluster/k8s/applications/vault/Application.yaml:87,92`                                             |
| Topology declaration     | `cluster.zeta.io/topology: single-node`                                                                                                    | same file `:91`                                                                                             |
| Chart source             | `repoURL: https://helm.releases.hashicorp.com`, `chart: vault`, `targetRevision: 0.29.1`                                                   | same file `:98-100`                                                                                         |
| **Vault binary version** | **appVersion `1.18.1`** (chart `vault-0.29.1`, created 2024-11-20)                                                                         | `helm.releases.hashicorp.com/index.yaml`, fetched 2026-08-21                                                |
| Helm release name        | `vault`                                                                                                                                    | same file `:102`                                                                                            |
| Storage backend          | integrated raft, `path = "/vault/data"`, `setNodeId: true`                                                                                 | same file `:123,137`                                                                                        |
| Replicas                 | `server.ha.replicas: 1`, `ha.enabled: true`, PDB disabled                                                                                  | same file `:114-120`                                                                                        |
| TLS                      | `global.tlsDisable: true`; listener `tls_disable = 1`                                                                                      | same file `:107` and the HCL at `:131-135`                                                                  |
| PVC classes              | `zeta-local-path` for both data and audit                                                                                                  | same file `:142,146`                                                                                        |
| Sync policy              | `automated: { prune: false, selfHeal: true }`                                                                                              | same file `:164`                                                                                            |
| Initialisation state     | **never initialised, holds no secrets, no live consumers**                                                                                 | `full-ai-cluster/k8s/applications/vault/TOPOLOGY.md` §2                                                     |
| Consumers                | `spire` and `external-secrets` reference Vault **only inside comments** — re-verified by grep 2026-08-21, 15 hits, every one on a `#` line | `applications/spire/Application.yaml:5,6,42-49`; `applications/external-secrets/Application.yaml:1-9,35-43` |

**The single most important row is the last two.** Everything expensive about a Vault migration —
seal compatibility, token-format breakage, secrets-engine re-creation, client cutover — is expensive
_because of stored state and live clients_. This deployment has neither.

---

## 2. The chart swap, field by field

The OpenBao Helm chart is a **fork of vault-helm and tracks its version line**. Measured:
openbao-helm publishes `0.29.2`, `0.29.1`, `0.29.0`, `0.28.6`… — the same numbering vault-helm uses.
Current: **chart `0.29.2`, appVersion `v2.6.2`**, published 2026-08-18, digest
`dc6c523aa895eb65b25aa31ad370d2facefb709d27d8020cec4177ac1524bea4` (verified by downloading the
tarball and re-computing the SHA-256 — it matches the index).

Repo: `https://openbao.github.io/openbao-helm` (classic Helm repo, **not** OCI). Chart name:
`openbao`.

### 2a. Carries over UNCHANGED

Measured by reading `openbao-0.29.2/values.yaml` and `templates/` directly, not by assuming
fork-parity:

| Value path                                   | Why it carries                                                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `global.tlsDisable`                          | Feeds `openbao.scheme` (`_helpers.tpl:1135-1141`) → `BAO_ADDR` / `BAO_API_ADDR` scheme. **Identical semantics to vault-helm.**                                                          |
| `server.affinity` / `injector.affinity`      | Chart default is the same **REQUIRED** `podAntiAffinity` on `topologyKey: kubernetes.io/hostname` (`values.yaml:314` injector, `:733` server). Our `""` override still means "drop it". |
| `server.ha.raft.{enabled,setNodeId,config}`  | Same paths, same raw-HCL-string shape (`values.yaml:1036-1067`).                                                                                                                        |
| `server.ha.disruptionBudget.enabled`         | Default `true` (`values.yaml:1112`); same `(n/2)-1` maxUnavailable hazard at replicas 1.                                                                                                |
| `server.dataStorage` / `server.auditStorage` | Same keys; volumeClaimTemplates still named `data` and `audit` (`_helpers.tpl:302-338`).                                                                                                |
| Cluster port behaviour                       | `BAO_CLUSTER_ADDR` is unconditionally `https://…:8201` (`server-statefulset.yaml:118-123`) — so the coherence audit's deliberate port-8201 exclusion stays correct.                     |
| ArgoCD Application shape                     | `destination`, `syncPolicy`, `syncOptions`, finalizer, sync-wave: all ArgoCD-level, chart-agnostic.                                                                                     |

**Licensing wrinkle that does not exist, checked so it stops being raised:** the OpenBao chart's
injector image is still `docker.io/hashicorp/vault-k8s:1.7.2` (`values.yaml:72-78`).
`hashicorp/vault-k8s` is **MPL-2.0** (GitHub API `spdx_id: MPL-2.0`; `LICENSE` head reads "Mozilla
Public License Version 2.0"). It was not swept into the BUSL relicensing. No licence problem.

### 2b. MUST change

| Item               | From                      | To                                                                    | Consequence if missed                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Raft data path** | `path = "/vault/data"`    | `path = "/openbao/data"`                                              | `server.dataStorage.mountPath` defaults to `/openbao/data` (`values.yaml:914`) and is what the container actually mounts (`_helpers.tpl:279-280`). Leaving `/vault/data` mounts the PVC at one path and writes raft at another — **the raft store lands on the container's ephemeral layer and is destroyed on every pod restart.** Silent.                                          |
| Audit path         | `/vault/audit` (implicit) | `/openbao/audit`                                                      | `values.yaml:943`. Same class of failure, lower stakes.                                                                                                                                                                                                                                                                                                                              |
| Server image       | chart default             | `quay.io/openbao/openbao-hsm:2.6.2` **if** the PKCS#11 seal is wanted | The stock `openbao/openbao` image has no PKCS#11 support compiled in (§6.1).                                                                                                                                                                                                                                                                                                         |
| `helm.releaseName` | `vault`                   | a decision, not a default                                             | `openbao.fullname` = release name if it contains the chart name, else `<release>-<chart>` (`_helpers.tpl:12-20`). `releaseName: vault` renders `vault-openbao`; `releaseName: openbao` renders `openbao`. **Either way the StatefulSet is renamed, so the PVC name changes** from `data-vault-0` to `data-vault-openbao-0` or `data-openbao-0`. The old PVC is orphaned, not reused. |

### 2c. DISAPPEARS

- The `vault` Helm release itself. ArgoCD's `prune: false` means the old release's objects are **not**
  removed automatically; that is a deliberate `helm uninstall` / `kubectl delete` by a human.
- `data-vault-0` and `audit-vault-0` PVCs — orphaned by the rename above, and `zeta-local-path` is
  `reclaimPolicy: Delete`, so deleting them destroys the (currently empty) store. Harmless today,
  which is again why today is the cheap moment.

---

## 3. The secret-data migration — the part that gets hand-waved

**Our answer: nothing to migrate, and that is load-bearing rather than lucky.** Below is what the
answer would have been otherwise, with the vendor's own words.

### 3a. OpenBao does not promise seal compatibility. It promises API compatibility.

OpenBao's ratified migration policy defines three layers and picks one. Verbatim, from
`website/content/community/policies/migration.mdx` at tag `v2.6.2`:

> 1. **Seal compatibility**. Is encrypted data drop-in compatible with upstream, for a given
>    combination of `(seal mechanism, storage provider, plugin)`. […] This implies no to minimal
>    migration necessary.
> 2. **Storage compatibility**. For unencrypted data […] can this be migrated from an upstream
>    instance directly into downstream at an equivalent path without rewriting the data itself.
> 3. **API compatibility**. For consumers of upstream's secret's or auth plugin's API only, would
>    they be able to point interchangeably at an upstream or OpenBao instance […]

and the proposal:

> Aim for API compatibility only, with limited seal compatibility when using remaining seal,
> storage, and plugins […]
>
> This means that some operators will need to make a conscious, one-time migration from a compatible
> upstream version to an OpenBao version. […] It means that OpenBao's server will not be drop-in
> binary equivalent from upstream's, and that we should likely place some marker to detect and
> prevent incompatible, unsupported usage.

(Policy discussed at <https://github.com/orgs/openbao/discussions/55>, ratified 2024-02-08.)

**So "it's a fork, the data just works" is false as a general claim.** Seal compatibility — the only
layer that would make an existing barrier-encrypted raft store readable — is explicitly _limited_
and scoped to "remaining seal, storage, and plugins", i.e. the intersection that survived the fork.

The same page's own hierarchy is worth quoting because it is what makes the claim precise: _"1
implies 2 implies 3"_. API compatibility, which OpenBao does commit to, implies **nothing** about
whether your encrypted bytes are readable.

### 3b. The in-place guide exists, and it does not cover this deployment

`website/content/docs/guides/migration.mdx` at `v2.6.2` ("In-Place Migration from Vault CE"),
verbatim:

> ## Constraints
>
> - Vault version 1.14.1 (OSS)
> - OpenBao version 2.2.0
> - Raft storage
> - Shamir unseal (no auto-unseal)

> If your Vault version is lower than 1.14.1, upgrade to v1.14.1.
>
> :::warning
>
> This guide will not work on Vault versions 1.15.0 and newer; use at your own risk.
>
> :::

**Two independent misses against our deployment:**

1. **Version.** `vault-0.29.1` pins appVersion **1.18.1** (measured, §1). That is four minor
   versions above the guide's stated ceiling, and the ceiling is a "will not work", not a "untested".
2. **Topology.** The procedure is a rolling raft-join: _"**One by one**, upgrade the *follower*
   nodes first"_, then `vault operator step-down` on the leader and repeat. At
   `server.ha.replicas: 1` **there are no followers and no step-down target.** The documented
   procedure is structurally inapplicable to a single-node raft, independent of the version issue.

Also stated by the guide and worth carrying forward for whenever data does exist:

> - Make a backup of your data! A raft snapshot will do.
> - It is recommended to use different storage path for the OpenBao instance. The nodes will pull
>   the data from the cluster when joining, there is no need to reuse existing data.
> - OpenBao uses a different type of tokens in the form of `[sbr].<random>` while Vault uses much
>   longer tokens (`{hvs,hvb,hvr}.<long_random>`). Old tokens will still be accepted according to
>   their TTLs. However, newly issued tokens will have the Bao form.
> - OpenBao comes without many plugins by default.
> - If you have `disable_mlock` in your Vault config, remove it. OpenBao does not use `mlock` since
>   2.0.0.

Note what the second bullet actually says: even the _supported_ path does **not** reuse the existing
raft directory. It re-replicates over the raft join. So "the data carries over" is true only in the
sense that a live quorum hands it to the new node — which needs a quorum, which needs ≥ 2 nodes.

### 3c. And the seal we want breaks compatibility by construction

From OpenBao's own PKCS#11 page, `website/content/docs/configuration/seal/pkcs11.mdx` at `v2.6.2`:

> Because PKCS#11 auto-unseal was not present in Vault v1.14 OSS, it is not expected that it is
> seal-compatible; manual migration of data between nodes may be required.

That is the vendor saying the destination configuration is _outside_ even the limited seal
compatibility they offer. A Vault→OpenBao move that also turns on the hardware seal is two
migrations, not one.

### 3d. Therefore

| Scenario                                            | What the data migration is                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Today** (uninitialised, no secrets, no consumers) | **Nothing.** Delete the release, point the Application at OpenBao, run the init ceremony once — against OpenBao.                                                                                                                                                                     |
| If Vault is initialised first, then migrated        | Out of the documented path on both version and node count. Realistic route: `vault operator raft snapshot save`, stand up OpenBao separately, and **replay configuration + secrets through the API** (which _is_ compatible), not through storage. Cost scales with what was put in. |

**The decision this frames:** the cost of migrating is currently zero and rises the moment
`vault operator init` is run. That is the whole strategic content of this document.

---

## 4. Would our own audit obstruct the migration? — MEASURED: no

`src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts` gained
`seal-stanza-requires-vault-enterprise` (rule list `:79-92`), which refuses an active
`seal "pkcs11"` stanza when `rendersHashiCorpVault(source)` (`:214-242`) is true. The stand-down is
deliberate and documented in the file's own comment: _"THE STAND-DOWN IS DELIBERATE AND IS WHY THIS
RULE RETIRES ITSELF."_

**Reading that is not verifying it.** So it was run.

**Method.** A migration-shaped `Application.yaml` was written into a throwaway copy of the cluster
tree (`/tmp/mig-root`, never committed, never applied): `repoURL:
https://openbao.github.io/openbao-helm`, `chart: openbao`, `targetRevision: 0.29.2`, server image
`quay.io/openbao/openbao-hsm:2.6.2`, raft `path = "/openbao/data"`, and a **live** seal stanza:

```hcl
seal "pkcs11" {
  lib           = "/usr/lib/pkcs11/libtpm2_pkcs11.so"
  token_label   = "openbao"
  key_label     = "bao-root-key-rsa"
  mechanism     = "CKM_RSA_PKCS_OAEP"
  rsa_oaep_hash = "sha256"
}
```

Everything else was left byte-identical to the deployed values. World facts (`Certificate`
resources, StorageClass availability) were derived from the real tree, not stubbed.

**Result** — `bun src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts --root /tmp/mig-root`,
**exit 1**:

```
audit-vault-topology-coherence: 1 finding(s) in full-ai-cluster/k8s/applications/vault/Application.yaml
  [chart-version-unmeasured] targetRevision is "0.29.2" but every chart behaviour this audit
  encodes was measured against 0.29.1. Re-measure with helm template and bump
  MEASURED_CHART_VERSION in the same commit; a silent bump would make this audit assert things it
  never checked.
```

**`seal-stanza-requires-vault-enterprise` did not fire.** The stand-down works. The one finding is
the audit correctly demanding a re-measure against a chart it has never templated — which is the
right behaviour and is one commit of work, not a block.

**Control run**, same command against the real tree (`--root` = the repo): **exit 0**,
`OK (12 rules, 0 findings)`. So the fixture's single finding is attributable to the change, not to
pre-existing noise.

**Unit tests**: `bun test src/Core.TypeScript/hygiene/audit-vault-topology-coherence.test.ts` →
**37 pass, 0 fail, 65 expect() calls**. The suite already pins both directions — it fires on the
HashiCorp source (`:395`) and does not fire on `{ repoURL: "https://openbao.github.io/openbao-helm",
chart: "openbao" }` (`:413-417`). Those tests were not modified.

**The other CI gate was checked too.** `.github/workflows/helm-validate.yml` triggers on
`full-ai-cluster/k8s/**` and resolves every chart pin against its repo index.
`bun infra/k8s/tests/validate-applications.ts --apps-dir <fixture>` reports
`PASS: vault/Application.yaml: Helm source (chart=openbao, version=0.29.2)` and
`PASS: vault: openbao 0.29.2 is published`. Identical pass profile to the same run against the
current HashiCorp manifest. **No obstruction.**

---

## 5. Two things our checks do NOT catch — found by running them

Neither is the seal rule's fault. Both are migration-specific and both would ship green today.

### 5.1 The chart-version pin is satisfiable by the wrong chart (vacuity)

`MEASURED_CHART_VERSION = "0.29.1"` (`audit-vault-topology-coherence.ts:67`) is compared against
`source.targetRevision` alone (`:289-290`). It is **chart-agnostic** — nothing ties the version string
to the `(repoURL, chart)` it was measured against.

That would be a theoretical complaint if the two charts had disjoint version lines. **They do not.**
Measured from both indexes on 2026-08-21: `helm.releases.hashicorp.com` publishes `vault-0.29.1`
and `openbao.github.io/openbao-helm` publishes `openbao-0.29.1`. openbao-helm is a fork of
vault-helm and tracks its numbering, so the collision is **systematic, not coincidental**, and will
persist.

**Demonstrated**, `--root /tmp/mig-root2` (OpenBao source, `targetRevision: 0.29.1`): **exit 0**,
`OK (12 rules, 0 findings)`. The audit asserts it measured chart behaviours it has never seen.

_Next action (unowned — proposing Dejan, whose lane the audit is in):_ key the pin on the triple, not
the string — e.g. `MEASURED_CHARTS: Record<"<host>/<chart>", version>`, and make an unknown
`(host, chart)` a finding rather than a pass. Fail-closed on unknown is already this file's stated
posture for `rendersHashiCorpVault`; the version pin does not yet share it.

### 5.2 Nothing compares the raft `path` against the chart's data `mountPath`

The same run (`/tmp/mig-root2`) also carried `storage "raft" { path = "/vault/data" }` under the
**OpenBao** chart, whose `dataStorage.mountPath` is `/openbao/data`. **0 findings.**

This is exactly the audit's founding failure shape — _two facts that live in different places and
nothing compares them_ — and the outcome is worse than the ones it was built for: not a pod that
never becomes ready, but a pod that **is** ready, serves traffic, and loses its raft store on every
restart. On vault-helm the two happen to agree (`/vault/data` both), which is why the gap has never
bitten; the chart swap is precisely what makes them disagree.

_Next action (same owner):_ a `raft-path-outside-mounted-data-volume` rule comparing the HCL `path`
against `server.dataStorage.mountPath` (with the chart default supplied when the value is absent,
and the chart default itself keyed by §5.1's triple). Cheap, and it should land **before** any
migration PR, not with it.

**Neither defect is fixed in this document.** They are named, measured, and reproducible; fixing
them is a separate change with its own mutation check, and doing it inside a research PR would put
an unreviewed rule in the path of the migration it is supposed to protect.

### 5.3 A third, smaller one: the audit's path is hardcoded

`VAULT_APP_RELPATH = "full-ai-cluster/k8s/applications/vault/Application.yaml"`. Renaming the
directory to `openbao/` makes the audit **exit 2** — `not found` — measured against `/tmp/mig-root3`.
Exit 2 is "usage/IO error", not "coherent", so it fails loudly rather than silently; still, the
directory rename and the constant must move in one commit. `deriveWorldFacts` also maps StorageClass
providers by directory name, so the rename is not purely cosmetic.

---

## 6. Blockers and unknowns

### 6.1 RESOLVED, and it cheapens the plan: upstream publishes an HSM build

The prior doc priced adopting the PKCS#11 seal as _"owning a build or a plugin pin"_. **The build
half is answered.** Measured:

- OpenBao's release workflow builds an `hsm` target for `linux/amd64` and `linux/arm64` with CGO
  (`.github/workflows/release.yml:124-125` and `:184-185` at `v2.6.2`).
- Release assets include `openbao-hsm_2.6.2_linux_amd64.{deb,rpm,tar.gz,pkg.tar.zst}` (+ arm64),
  each with `.sbom.json`, `.gpgsig` and `.sigstore.json`.
- A container image exists: **`quay.io/openbao/openbao-hsm`**, public, 46 tags,
  `2.6.2` / `2.6.1` / `2.5.x` / `2.4.x` / `2.3.x`, amd64 and arm64.
- The build gate is a Go build tag: `//go:build hsm && (linux || darwin)`
  (`helper/kmsplugin/pkcs11.go`).

So the seal is reached by `server.image.repository: openbao/openbao-hsm`, not by maintaining a
fork's build pipeline. **The plugin-pin half stands:** _"This seal remains built-in in OpenBao
v2.6.x, but will remain available only as an external plugin starting v2.7.0."_

### 6.2 RESOLVED — the named unknown from the prior doc: TPM mechanism compatibility

The prior doc named this as _"the thing to bench first"_. It is now answerable from source, with a
**conditional yes**.

| Side                    | Supported mechanisms                                                                                                                                                                                                                             | Source                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| OpenBao `seal "pkcs11"` | **`CKM_AES_GCM` (0x1087)**, **`CKM_RSA_PKCS_OAEP` (0x0009)** — _"in order of precedence"_, and _"OpenBao only supports AEAD-enabled algorithms and will not support Encrypt-Then-MAC constructs (like `CKM_AES_CBC_PAD` with explicit HMACing)"_ | `docs/configuration/seal/pkcs11.mdx:131-145` @ `v2.6.2` |
| `tpm2-pkcs11`           | `CKM_AES_{KEY_GEN,CBC,CBC_PAD,CFB128,ECB,CTR}`, `CKM_RSA_PKCS_OAEP`, RSA/EC sign-verify, HMAC, digests                                                                                                                                           | `src/lib/mech.c:150-201` @ tag **v1.10.1**              |

**`CKM_AES_GCM` appears zero times in `mech.c`.** `CKM_RSA_PKCS_OAEP` is present at `:158` with
`mf_encrypt|mf_decrypt|mf_rsa`.

**Intersection = `CKM_RSA_PKCS_OAEP`, and only that.** So a TPM-backed OpenBao seal is possible but
must pin `mechanism = "CKM_RSA_PKCS_OAEP"` explicitly — the default is _"best available"_, which
prefers AES-GCM and would negotiate to something the TPM cannot do. An HSM that offers AES-GCM
(the optional upgrade path) can use the preferred mechanism; the TPM floor cannot.

One consequence to carry: with an RSA mechanism, _"OpenBao performs the encryption operation locally
in memory by exporting the public key from the HSM"_ unless `disable_software_encryption = true`
(available since v2.4.0). For an unseal key that is arguably fine — decryption still requires the
TPM — but it is a property to decide deliberately, not inherit.

**Register: this is RESEARCHED (two source files read), not MEASURED.** No TPM was touched and no
seal was exercised. The falsifier is §7's bench.

### 6.3 OPEN — the image does not contain a PKCS#11 module

`quay.io/openbao/openbao-hsm` supplies a `bao` binary that _can_ load a PKCS#11 library. It does not
supply one. The Dockerfile's package install is
`apk add --no-cache ca-certificates libcap su-exec dumb-init tzdata gcompat` — **no `tpm2-pkcs11`,
no `softhsm`, no `opensc`** (`Dockerfile:28` @ `v2.6.2`).

So `lib = "/usr/lib/pkcs11/libtpm2_pkcs11.so"` names a file that is not in the image. Closing this
needs one of: a thin derived image layering `tpm2-pkcs11`, an initContainer that copies the module
into a shared `emptyDir`, or a hostPath mount from the NixOS node. **Owner: Dejan** (image / supply-chain
lane). **Next action:** pick one of the three and price it; the derived-image option collides with
"pin an upstream-published, signed image", which was §6.1's entire benefit.

Adjacent and unresolved in the same breath: the pod also needs `/dev/tpmrm0` (device plugin or
privileged mount) and a `tpm2_ptool` token store, which is per-node state that must survive pod
rescheduling. On a single node that is a hostPath; on three nodes it is three separately-provisioned
TPMs and **three different wrapped root keys**, which means a raft cluster whose members cannot
unseal each other's data. That is a design decision, not a config value, and it is the strongest
argument for settling single-vs-three-node _before_ the seal, not after.

### 6.4 OPEN — the PKCS#11 PIN cannot live in the HCL

The chart renders `server.ha.raft.config` into a **ConfigMap** (`templates/server-config-configmap.yaml`),
and the chart's own values file says so: _"Configuration files are stored in ConfigMaps so sensitive
data such as passwords should be either mounted through extraSecretEnvironmentVars or through a Kube
secret"_ (`values.yaml:976-979`). A `pin = "…"` in the HCL is a plaintext PIN in a ConfigMap, readable
by anything with namespace read.

The supported route is `BAO_HSM_PIN` via `server.extraSecretEnvironmentVars` (`values.yaml:698-700`,
consumed at `server-statefulset.yaml:141`). OpenBao documents the full env-var set
(`BAO_SEAL_TYPE`, `BAO_HSM_LIB`, `BAO_HSM_SLOT`, `BAO_HSM_TOKEN_LABEL`, `BAO_HSM_PIN`,
`BAO_HSM_MECHANISM`, `BAO_HSM_RSA_OAEP_HASH`).

**Note for §5:** the coherence audit reads the HCL, so it cannot see a seal configured entirely
through env vars. A future `seal` rule that only greps HCL is half-blind by construction. Worth
saying now, before someone relies on it.

### 6.5 OPEN — key material must exist before init

> Unlike Vault Enterprise, OpenBao requires key material to be created externally before
> initializing the instance. OpenBao will not attempt to create its own key material.
> — `docs/configuration/seal/pkcs11.mdx` @ `v2.6.2`

This adds a step to the gated ceremony that TOPOLOGY.md §5 does not yet have: **generate the wrapping
key in the TPM/HSM, out of band, before `bao operator init`.** It is a key-minting operation and
therefore a gated class — fresh human authorization plus the biometric gate
(`tools/setup/persona-keys/biometric.ts`). **Owner: human maintainer + witness.** No agent runs it.

### 6.6 OPEN — the helm-validate ratchet

`full-ai-cluster/k8s` is under a **failure-count ratchet** against
`infra/k8s/tests/FULL-AI-CLUSTER-FAILURE-BASELINE.md`, which fails if the count goes up _or_ down
without the baseline moving. A chart swap changes what renders. **Cannot be settled without running
it:** `bun infra/k8s/tests/validate-applications.ts --render --apps-dir full-ai-cluster/k8s/applications`
needs `helm` and `kubeconform`, which are `MISE_ENV=full` and were not on this machine. **Next
action:** run that command on a full-tier host (or let the migration PR's CI report it) before
assuming the render is clean. Stated rather than assumed.

### 6.7 OPEN — the two SPIRE / External-Secrets couplings

Both are still comments. If they are wired to Vault _before_ the migration, they must be re-wired
after. If they are wired _after_, they are wired once. This is free ordering value and the prior doc
already recommended it (_"Do not wire `upstreamAuthority.vault` before this bench returns"_). Nothing
has changed to weaken that.

---

## 7. Ordered path

Each step is small, reversible, and named with what it buys.

| #   | Step                                                                                                                                                                                                 | Buys                                                                                              | Gate                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0   | Fix §5.1 and §5.2 in the audit (chart-keyed pin; `path` vs `mountPath`)                                                                                                                              | The migration PR is checkable instead of trusted                                                  | none — ordinary PR                                                |
| 1   | Bench off-cluster: OpenBao + SoftHSM with `CKM_RSA_PKCS_OAEP`, then `tpm2-pkcs11` on a real TPM                                                                                                      | Converts §6.2 from RESEARCHED to MEASURED; kills §6.3's packaging question with a concrete answer | none — laptop scale, no cluster                                   |
| 2   | Decide single-vs-three-node **before** the seal (§6.3, last paragraph)                                                                                                                               | Avoids a per-node-key raft cluster that cannot unseal itself                                      | maintainer decision                                               |
| 3   | Swap the Application: repoURL / chart / targetRevision / raft path / mountPaths / releaseName, **no seal stanza yet**, re-measure `MEASURED_CHART_VERSION` against openbao-0.29.2 in the same commit | The whole §2 delta, verified by CI, with the seal still out of the picture                        | ordinary PR; `helm-validate` render must stay at baseline         |
| 4   | Run the init + unseal ceremony **once, against OpenBao**                                                                                                                                             | Never pays the §3 migration at all                                                                | **GATED** — fresh human authorization + biometric, TOPOLOGY.md §5 |
| 5   | Add the seal, with the key pre-created (§6.5) and the PIN in a Secret (§6.4)                                                                                                                         | Hardware-backed auto-unseal — the thing this whole thread is for                                  | **GATED** — key minting                                           |
| 6   | Only then wire SPIRE / External Secrets                                                                                                                                                              | One wiring instead of two                                                                         | ordinary PR                                                       |

**Steps 0-3 are reversible and cost nothing that is not already spent. Step 4 is the one-way door**
— it is the moment the §3 migration cost stops being zero.

---

## 8. Register

**Provenance of the in-repo reads, stated because it nearly went wrong.** The shared checkout at
`/Users/acehack/Documents/src/repos/Zeta` was behind `origin/main` when this work started, and its
copy of `audit-vault-topology-coherence.ts` carried **11 rules, with no
`seal-stanza-requires-vault-enterprise` and no `rendersHashiCorpVault`** — the exact function §4 is
about did not exist in it. Every finding here was taken in a **fresh clone at `origin/main`**, and
that clone was re-fetched and reset to `9d25885d4` before the final measurement pass;
`git diff 94945a646..9d25885d4` over the audit, its tests, `full-ai-cluster/k8s/applications/` and
`infra/k8s/tests/` came back **empty**, so nothing here was invalidated by the seven intervening
commits. Recorded because _a stale checkout is a check that did not run wearing the face of one that
passed_ — and because a conclusion drawn from a file's apparent absence in that checkout would have
been exactly backwards here.

**MEASURED** (a command was run, or a file was read and its bytes checked):

- Every row in §1 (repo files at `9d25885d4`; helm index fetched 2026-08-21).
- The four audit runs in §4 / §5 with their exit codes (0, 1, 0, 2) and the two
  `validate-applications.ts` runs.
- `bun test …audit-vault-topology-coherence.test.ts` → 37 pass / 0 fail.
- openbao-helm `0.29.2` tarball downloaded, SHA-256 re-computed and matched against the index digest;
  all `values.yaml` / `templates/` line references read from that tarball.
- The `quay.io/openbao/openbao-hsm` tag list (46 tags) and the `v2.6.2` release asset list, via the
  Quay and GitHub APIs.
- `CKM_AES_GCM` absent / `CKM_RSA_PKCS_OAEP` present in `tpm2-pkcs11` `v1.10.1` `src/lib/mech.c`.
- `hashicorp/vault-k8s` is MPL-2.0.
- The audit is **not** referenced anywhere in `.github/` or `preflight.ts` — it is a run-it-yourself
  check, not a gate. Its unit tests do run under `bun test`, so the seal rule's _behaviour_ is pinned
  in CI even though the audit is never pointed at the manifest.

**RESEARCHED** (a document says so; not exercised):

- Every verbatim quotation in §3 and §6, from OpenBao's own `website/content/**` at tag `v2.6.2`
  (primary source — the repo, not the rendered site) plus the HashiCorp PKCS#11 page carried over
  from the prior doc.
- §6.2's conclusion. Two source files agree on the mechanism sets; no TPM was exercised.

**ASSUMED — say so out loud:**

- That openbao-helm `0.29.2` renders the same _shapes_ vault-helm `0.29.1` does for the values we
  set. The value paths and defaults were read directly (§2a) but **no `helm template` was run** —
  `helm` is not on this machine. §7 step 3 requires that render before the swap is trusted.
- That our nodes are `linux/amd64` or `linux/arm64` — both have `openbao-hsm` images, so the
  assumption is not load-bearing, but it is unverified here.

---

## 9. Gated / never-run

No cluster was contacted. No `kubectl`, no `helm`, no `argocd`, no `bao`, no `vault`. No device
touched, no TPM read, no key, PIN or credential handled. `op` not invoked. The `seal "pkcs11"` block
in §4 is a fixture in `/tmp`, contains no real library path, no slot, and **no PIN**, and was never
applied anywhere.

`vault operator init` / `bao operator init`, unseal-share generation, and TPM/HSM key minting remain
a **gated class**: fresh human authorization plus the biometric gate in
`tools/setup/persona-keys/biometric.ts`, with a witness. Designed here; run by a human, never by an
agent.

## 10. Open questions for Aaron

1. **Is step 4 (init) imminent?** If yes, the §7 ordering is urgent — steps 0-3 are cheap now and
   expensive after. If it is weeks away, there is room to bench first.
2. **Single-node or three-node, decided before the seal?** §6.3 makes this a seal-design input, not
   just a capacity choice.
3. **`releaseName`: keep `vault` (renders `vault-openbao`) or move to `openbao`?** It decides PVC
   names and every in-cluster DNS name; cheapest to choose once, now.
4. **Should §5.1 / §5.2 be fixed by whoever takes this, or handed to Dejan's lane?** They are audit
   changes, not migration changes, and mixing them would put an unreviewed rule in front of the
   migration it guards.
