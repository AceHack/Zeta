# MinIO is archived upstream — what replaces our S3, and the answer is already running in this cluster

**Date:** 2026-08-21 · **Register:** Beacon (outward-facing; every upstream claim carries the URL or API call it was read from)
**Question (Aaron, verbatim):** *"Only minio is current, and only because upstream stopped publishing in January 2025. should we be using an alternative to minio for our s3? We were looking at ceph or others."*
**Sharpening (Aaron, verbatim):** *"we just want a s3 like interface cause so much other software works well with that interface. we can git rid of minio for sure if it's no longer being maintained"*
**Status:** RESEARCH ONLY. **No manifest is changed by this document.** The decision is the maintainer's.

Every claim below is tagged **MEASURED** (I ran the command / read the file, and the command is shown),
**RESEARCHED** (primary upstream source, URL given), or **ASSUMED** (stated so it can be attacked).

---

## 0. Headline

| | finding | register |
|---|---|---|
| Is the MinIO **chart** stale? | Yes — newest is `5.4.0`, published **2025-01-02**, ~19 months ago | MEASURED |
| Is the MinIO **server** unmaintained? | **Yes.** `minio/minio` is **archived / read-only**; last release **2025-10-16** | MEASURED |
| Are those two separable facts? | **No — they are the same archived repository.** The chart source lives at `minio/minio/helm/minio` | MEASURED |
| Did the licence/product posture change? | Yes — server stays AGPL-3.0, but development moved to proprietary **AIStor**; the admin console was removed from the community build in May 2025 | RESEARCHED |
| **Is the AGPL build carrying unpatched vulnerabilities?** | **Yes — four unpatched HIGH advisories, two of them unauthenticated object write. Every fix ships only in AIStor.** | RESEARCHED |
| Does Aaron's condition hold? | **Yes.** "if it's no longer being maintained" is satisfied on the strongest available evidence: an archived upstream repo | MEASURED |
| Is there already an S3 alternative in this cluster? | **Yes — SeaweedFS, deployed, S3 gateway on, the same five buckets already created** | MEASURED |
| Which S3 consumers exist here? | **Two: Loki and Mimir.** Not three — Tempo is on `backend: local` | MEASURED |
| Which candidate is eliminated on the API, not on taste? | **Garage** — no conditional writes, and upstream calls that *"structurally impossible"* to change | RESEARCHED |
| Recommendation | **Adopt SeaweedFS as the S3 backend; retire MinIO — sequenced behind the metal boot, and conditional on one large-object A/B that this cluster already has the wiring to run** | judgement |

**The two-line version of the whole argument, both measured today:**

```
charts.min.io      newest minio     5.4.0    created 2025-01-02   appVersion RELEASE.2024-12-18
seaweedfs helm     newest seaweedfs 4.43.0   created 2026-08-21   appVersion 4.43
```

One of those repos published a chart the same day this document was written. The other stopped
publishing before the server it packages had its last eight releases.

---

## 1. What is MinIO's actual status?

The brief asked me to keep three claims apart, because they are different facts with different
consequences. Here they are separately, and then the part that collapses two of them.

### 1a. The Helm chart stopped publishing — MEASURED

```
$ curl -sS https://charts.min.io/index.yaml | grep -E '^\s+(version|created|appVersion):' | paste - - -
    appVersion: RELEASE.2024-12-18T13-15-44Z	created: "2025-01-02T21:34:25...-08:00"	version: 5.4.0
    appVersion: RELEASE.2024-04-18T19-09-19Z	created: "2025-01-02T21:34:25...-08:00"	version: 5.3.0
    ...
$ curl -sS https://charts.min.io/index.yaml | grep -cE '^\s+version:'
90
```

Ninety chart versions, and **every one of them carries a `created` stamp of 2025-01-02** — the index
was regenerated wholesale that day and never touched again. Newest chart: `5.4.0`. This is exactly
the finding [PR #13325's survey](2026-08-21-every-remote-helm-chart-pin-surveyed-against-its-own-upstream-index-two-were-never-published.md)
recorded at line 341: *"MinIO's chart repo has published nothing since 2025-01-02, so 'current' here
means 'upstream stopped', not 'upstream is fresh'."*

There is a second, worse fact hiding in that output that the survey did not need to surface.
**Chart `5.4.0` pins `appVersion: RELEASE.2024-12-18T13-15-44Z`.** So our pin at
`full-ai-cluster/k8s/applications/minio/Application.yaml:17` does not merely deploy a stale *chart* —
it deploys a **server image from December 2024**, which is eight upstream releases and ten months
behind even the last MinIO release that exists. Being "0 versions behind" on the chart concealed
being ~20 months behind on the binary.

### 1b. The server is unmaintained — MEASURED

This is the load-bearing one, because Aaron's condition is explicitly conditional on it.

```
$ gh api repos/minio/minio --jq '{archived,pushed_at,license:.license.spdx_id,stars:.stargazers_count}'
{"archived":true,"pushed_at":"2026-04-24T17:54:39Z","license":"AGPL-3.0","stars":61382}

$ gh api repos/minio/minio/releases --jq '.[0:3][] | "\(.tag_name) \(.published_at)"'
RELEASE.2025-10-15T17-29-55Z  2025-10-16T19:33:51Z
RELEASE.2025-09-07T16-13-09Z  2025-09-07T18:53:04Z
RELEASE.2025-07-23T15-54-02Z  2025-07-23T20:35:39Z
```

`archived: true` is the strongest signal GitHub has. It is not inference from release cadence, not a
community reading of the tea leaves — it is the repository owner marking the repository **read-only**.
No issue can be filed, no pull request can be opened, no commit can land, including a security fix.

The README states it in words as well (<https://github.com/minio/minio>, RESEARCHED, fetched
2026-08-21):

> THIS REPOSITORY IS NO LONGER MAINTAINED.
>
> Alternatives:
> - **AIStor Free** — Full-featured, standalone edition for community use (free license)
> - **AIStor Enterprise** — Distributed edition with commercial support

Last release: **2025-10-16**, ten months ago. Last push: **2026-04-24**. Archived since roughly late
April 2026 (RESEARCHED — the GitHub API returns `archived_at: null`, so the precise archive date is
*not established* from primary data; community reporting puts it at 2026-04-25, which is consistent
with the measured `pushed_at`, and the *fact* of archival is measured regardless of its date).

**Verdict: the server is unmaintained.** This is not the ambiguous case the brief warned about — the
one where a stale chart hides a healthy server. It is the unambiguous case.

### 1c. The licence and product posture changed — RESEARCHED

Three distinct events, in order:

1. **2021** — the server relicensed from Apache-2.0 to **AGPL-3.0**. (Still AGPL-3.0 today, MEASURED
   via the API call above. Note the licence itself is *not* the problem here and never became one.)
2. **May 2025** — the admin **console was removed** from the community edition, leaving only a basic
   object browser; policy management, lifecycle, site replication moved to the commercial edition.
   This was done without advance notice and generated a large community reaction
   (<https://github.com/minio/minio/discussions/21326>, closed by a maintainer with
   *"As this conversation has derailed into personal attacks, it is time to close this thread"*
   — Jun 28 2025; <https://www.blocksandfiles.com/ai-ml/2025/06/19/minio-users-complain-after-admin-ui-removed-from-community-edition/1610856>).
3. **Dec 2025 → Apr 2026** — maintenance mode, then archival, with users directed to **AIStor**
   (proprietary, subscription; an "AIStor Free" standalone tier exists).

The licence did **not** become restrictive. What happened is subtler and worse for us: the *code*
stayed open while the *project* left. An AGPL-3.0 archive is a licence to fork, not a supplier.

The ecosystem went with it, and this is worth listing because it is the difference between "one repo
archived" and "the supply chain is gone": `minio/mc` (the CLI) **archived**, `minio/operator`
**archived**, `minio/kes`, `minio/sidekick`, `minio/mint` all **archived** — and `minio/console` was
**deleted outright** (404, not archived). The README also states the community edition *"is now
distributed as source code only. We will no longer provide pre-compiled binary releases."*

### 1d. The part I did not expect — there are FOUR unpatched HIGH advisories — RESEARCHED

This was not in the brief and it is the single most consequential finding after the archival itself.

GitHub's advisory database carries **eight** MinIO advisories, **seven published after the last
open-source release** (`RELEASE.2025-10-15`). Four are rated HIGH:

| published | sev | advisory | "fixed in" |
|---|---|---|---|
| 2026-04-14 | **HIGH (CVSS 8.8)** | **Unauthenticated object write** — query-string signature bypass (**CVE-2026-41145**) | AIStor `RELEASE.2026-04-11` |
| 2026-04-11 | **HIGH (8.8)** | **Unauthenticated object write** — Snowball auto-extract | AIStor `RELEASE.2026-04-11` |
| 2026-04-07 | **HIGH** | DoS, unbounded memory in S3 Select CSV | AIStor `RELEASE.2025-12-20` |
| 2026-03-27 | **HIGH** | SSE metadata injection via replication headers | AIStor `RELEASE.2026-03-26` |
| 2026-04-25 | medium | Path traversal in `ReadMultiple` storage-REST | AIStor `RELEASE.2026-04-14` |
| 2026-03-20 | medium | LDAP brute-force / user enumeration | AIStor `RELEASE.2026-03-17` |
| 2026-03-19 | medium | JWT algorithm confusion in OIDC | AIStor `RELEASE.2026-03-17` |
| 2025-10-16 | high (8.1) | Privilege escalation via session-policy bypass | `RELEASE.2025-10-15` |

**Every "fixed in" version above the last row is an AIStor release.** The CVE-2026-41145 advisory says
it in words: *"Users of the open-source `minio/minio` project should upgrade to MinIO AIStor
`RELEASE.2026-04-11T03-20-12Z` or later."*

So the AGPL codebase carries **four unpatched HIGH vulnerabilities, two of them unauthenticated
object write**, and upstream's stated remedy is to buy the proprietary product. Our pin is
`RELEASE.2024-12-18`, which predates **all eight**.

This changes the shape of §4's argument. I had written the risk of staying as *"an unpatchable CVE
someday."* That was wrong and too generous: the CVEs are **already here**, already public, and
already unpatched. What remains true — and is the reason §4b's sequencing survives anyway — is that
our exposure is currently **zero**, because the cluster is not running: the blob store is a
ClusterIP service inside a single-node cluster that has never booted on metal, with no ingress. The
clock starts at the metal boot, not now. But it does start.

### 1e. The part that collapses (a) and (b) — MEASURED

The brief asked me to keep "the chart stopped publishing" apart from "the server is unmaintained",
correctly, because they are usually independent. **Here they are not**, and this is the fact that
removes the last reason to wait:

```
$ gh api repos/minio/minio/contents/helm --jq '.[].name'
minio
$ gh api repos/minio/charts
gh: Not Found (HTTP 404)
```

The chart's source is a directory *inside the archived repository*. There is no separate charts repo.
So the chart is not "unpublished pending someone's attention" — it is **archived along with the
server**, and cannot receive a fix of any kind, ever, without upstream un-archiving. There is no
maintainer to ask, no issue to file, no PR to send.

That is the whole of section 1. Aaron's precondition is met on measured evidence.

---

## 2. What actually consumes S3 in this cluster?

This section decides the rest, and the first thing it does is shrink the problem.

### 2a. The consumer set is **two**, not three — MEASURED

| App | Object storage | Evidence |
|---|---|---|
| **Loki** | **S3** — `chunks` + `ruler` buckets | `full-ai-cluster/k8s/applications/loki/Application.yaml:33-41` |
| **Mimir** | **S3** — `blocks_storage`, `alertmanager_storage`, `ruler_storage` | `.../mimir/Application.yaml:29-52` |
| **Tempo** | **not S3** — `backend: local`, a Longhorn PVC | `.../tempo/Application.yaml:22-28` |
| `zeta-backups` bucket | **nothing yet** — declared, no writer | `.../object-store/BLOB-STORE-CONTRACT.md` ("future CronJobs") |

The brief's expectation that Tempo was "likely similar" is wrong, and it is worth stating plainly
because it is a third of the assumed blast radius: Tempo writes traces to `/var/tempo/traces` on a
20 GiB Longhorn volume and never opens an S3 connection. Migrating the object store cannot break it.

So does the `zeta-backups` bucket: it exists in both backends' bucket lists and has no consumer.
A migration owes it nothing but a `CreateBucket`.

**Net: two consumers, five buckets, of which one is dead weight.**

### 2b. Only ONE of the two S3 paths has ever run — MEASURED, and this is the sharpest finding here

`src/Core.TypeScript/cluster/argocd-health-test.ts` defines the `included` CI proof: every
non-excluded ArgoCD Application must reach Synced+Healthy on a real kind cluster. The exclusion
registry at lines 268-292 is explicit and reasoned. Reading off it:

| App | In the `included` Synced+Healthy proof? | Why |
|---|---|---|
| `minio` | **yes** | `zeta-local-path`, not excluded |
| `seaweedfs` | **yes** | `zeta-local-path`, not excluded |
| `loki` | **yes** | not excluded by any list |
| **`mimir`** | **NO** | line 281: *"requests longhorn-backed persistence; same missing-StorageClass reason as cockroachdb"* |
| **`tempo`** | **NO** | line 286, same reason (and it has no S3 path anyway) |

So the only S3 consumer path this repo has *ever* exercised end-to-end is **Loki → MinIO**.
**Mimir's S3 configuration has never been executed by anything** — its `blocks_storage` block at
`mimir/Application.yaml:29-36` is, in the vocabulary of `toy-is-free-metered-must-be-earned`,
**unmetered**: implemented, committed, and never falsified.

This cuts in a direction people find counter-intuitive, so let me state it directly: it is an
argument **for** moving sooner rather than later. The usual reason to fear a storage migration is the
weight of what already runs on it. Here, half the consumer set has never run on the incumbent
either. **You cannot regress a path that has never passed.** The risk of switching Mimir's endpoint
from MinIO to SeaweedFS is not "it might break" — it is "it might not work", which is *exactly the
risk that already exists today* and which the switch does not increase.

### 2c. What S3 operations do they actually need?

Established from upstream sources and set out in **§3b** (the operation-by-operation table) and
**§3c** (what Grafana actually documents as required). It belongs next to the candidate comparison
rather than here, because its whole job is to discriminate between candidates.

The one-line preview, because it reorders the sections that follow: the demanding requirements are
**ListObjectsV2 with prefix/delimiter** (hard, both consumers), **multipart above ~64 MB** (both, in
practice), and **`If-Match` conditional writes** (Loki's newer client only — and it is the
requirement that eliminates a candidate).

### 2d. The object store is not in the single-node storage budget at all — MEASURED

Worth recording because the brief framed the candidates against "~1 TiB":

```
$ python3 -c "...walk storage-profiles.json for minio|seaweed|blob|object-store..."   # no hits
$ grep -n -i "minio\|seaweed\|object-store\|blob" full-ai-cluster/k8s/single-node-budget.json  # no hits
```

Neither `full-ai-cluster/k8s/storage-profiles.json` nor `single-node-budget.json` mentions the blob
store. Both backends request a **20 GiB PVC on `zeta-local-path`**
(`minio/Application.yaml:26-29`, `seaweedfs/Application.yaml:39-42`) — outside the Longhorn budget
those files govern.

The consequence: **the object store today is provisioned at 20 GiB, not 1 TiB, and nobody has sized
it for the real box.** That is a genuine gap, but it is a *separate* gap from this question, and it
has the useful property of being backend-independent — whatever we run, someone has to decide how
much of the NVMe the blob store gets. It should not be smuggled into the migration decision, and it
should not be used as an argument for a system whose selling point is scaling past one node.

---

## 3. The candidates, judged against THIS cluster

Aaron's sharpening sets the judging criterion: *"we just want a s3 like interface cause so much other
software works well with that interface."* So the primary axis is **S3 API fidelity for our two
consumers**, and features beyond that are close to worthless here.

### 3a. Upstream health — MEASURED, all via `gh api` on 2026-08-21

| | licence | archived | last release | last push | chart published |
|---|---|---|---|---|---|
| **MinIO** | AGPL-3.0 | **YES** | 2025-10-16 | 2026-04-24 | **2025-01-02** (19 months) |
| **SeaweedFS** | **Apache-2.0** | no | **4.43 — 2026-08-21** | 2026-08-21 | **2026-08-21** |
| **Rook (Ceph)** | Apache-2.0 | no | v1.20.6 — 2026-08-20 | 2026-08-21 | 2026-08-20 |
| **Garage** | AGPL-3.0 | n/a — not on GitHub (`deuxfleurs/garage` 404s; upstream is `git.deuxfleurs.fr`) | RESEARCHED, see 3d | — | no official chart established |

```
$ gh api repos/seaweedfs/seaweedfs --jq '{archived,pushed_at,license:.license.spdx_id}'
{"archived":false,"license":"Apache-2.0","pushed_at":"2026-08-21T20:05:15Z"}
$ gh api "repos/seaweedfs/seaweedfs/commits?since=2026-07-21T00:00:00Z&per_page=100" --jq 'length'
100                       # page cap — so >=100 commits in 30 days
```

Two things in that table are worth pausing on.

**SeaweedFS is Apache-2.0.** Moving off MinIO is not merely a maintenance trade — it is a *licence
improvement*, from a copyleft AGPL-3.0 to a permissive Apache-2.0. Given that this repo's own
`Wall.Whitebox` discipline treats an unknown or unheld licence as **blocking**
(`src/Core/DerivationProtocol.fs`, cited in `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`),
that is a real gain and not a rounding error.

**The SeaweedFS chart published on the same day this was written.** Compare the two index reads in
§0: this is not "less stale", it is the difference between a live supplier and an archive.

### 3b. The deciding table — S3 operations, per candidate — MEASURED for SeaweedFS

For SeaweedFS I did not take the wiki's word for it. The authoritative artifact is the router that
registers the HTTP routes, so I read it:

```
$ curl -sS https://raw.githubusercontent.com/seaweedfs/seaweedfs/master/weed/s3api/s3api_server.go
$ grep -oE '(...Handler)' ... | sort -u
```

| operation | **actually needed here?** | **SeaweedFS** | **Garage** | MinIO | Ceph RGW |
|---|---|---|---|---|---|
| PutObject / GetObject / HeadObject / DeleteObject | **required** | yes (MEASURED) | yes | yes | yes |
| **ListObjectsV2** w/ prefix + delimiter, `CommonPrefixes`, pagination | **hard requirement, both consumers** | yes — `ListObjectsV2Handler` | yes | yes | yes |
| ListObjectsV1 | fallback (`list_objects_version: v1`) | yes — `ListObjectsV1Handler` | yes | yes | yes |
| **Multipart** (all six ops) | **size-conditional — see below** | yes — **all six** (MEASURED) | yes — all seven | yes | yes |
| Range GET | **required** (index-header reads) | yes (`GetObjectHandler`, HTTP range) | yes (in source; undocumented) | yes | yes |
| **Conditional write / `If-Match`** | **required on Loki's Thanos/dataobj path only** | yes — *"Conditional Headers (All operations)"* | **NO — and structurally never** | yes | yes |
| **Store must NOT create directories** | **Mimir states this as its one requirement** | **⚠ see §3d** | yes | yes | yes |
| DeleteObjects (batch) | **not used** — both do single-object delete | yes | yes | yes | yes |
| CopyObject / UploadPartCopy | not established as needed on the S3 path | yes — both | yes — both | yes | yes |
| Presigned URLs / SigV4 | neither consumer; ops tooling | yes | yes | yes | yes |
| Object tagging | no | yes | **no** | yes | yes |
| Versioning | no — but Loki *recommends enabling* it | yes | **no** | yes | yes |
| Lifecycle rules | no (retention is in-app; see §3c warning) | yes (expiration; no transitions) | partial | yes | yes |
| Object lock / retention | no | yes | **no** | yes | yes |

**Multipart is size-conditional, and that is a trap rather than a relief.** Mimir and Loki-on-Thanos
share `thanos-io/objstore`, whose S3 provider documents `PartSize` as *"used for multipart upload.
Only used if uploaded object size is known and larger than configured PartSize"*, defaulting to
**64 MB**; below that it issues a single `PutObject`. So multipart is not on the smoke-test path —
but Mimir blocks and Loki chunks routinely exceed 64 MB, which means **a store with a broken
multipart path passes every quick test and fails later, on large objects.** Remember that when
reading §3d.

The measured handler list from the SeaweedFS router, verbatim and complete for the operations above:
`NewMultipartUploadHandler`, `PutObjectPartHandler`, `CompleteMultipartUploadHandler`,
`AbortMultipartUploadHandler`, `ListObjectPartsHandler`, `ListMultipartUploadsHandler`,
`ListObjectsV1Handler`, `ListObjectsV2Handler`, `DeleteMultipleObjectsHandler`, `CopyObjectHandler`,
`CopyObjectPartHandler`, `GetObjectHandler`, `PutObjectHandler`, `HeadObjectHandler`,
`DeleteObjectHandler`, `PutObjectTaggingHandler`, `GetObjectTaggingHandler`,
`PutBucketVersioningHandler`, `GetBucketVersioningHandler`, `PutBucketLifecycleConfigurationHandler`,
`GetBucketLifecycleConfigurationHandler`, `PutObjectRetentionHandler`, `PutObjectAclHandler`,
`GetBucketAclHandler`, `PutBucketPolicyHandler`.

**Reading of the table: three of four clear the bar, and Garage does not.** I had initially written
that API fidelity does not discriminate between the candidates. That was wrong, and one row is why:

> **Garage cannot do conditional writes, and upstream says it never will.** From
> <https://garagehq.deuxfleurs.fr/documentation/reference-manual/known-issues/>: *"This is
> structurally impossible to implement in Garage due to the lack of a consensus algorithm, which is
> one of Garage's core design choices which we cannot reconsider."*

Loki's newer `thanos_object_store_config` client uses `If-Match` for optimistic concurrency when
replacing metastore/ToC objects — and Grafana documents that client as *"will become the default way
… in future releases."* So Garage is not merely thinner today; it is **foreclosed on Loki's stated
direction of travel**, by a design choice its maintainers have said is not up for revision. That is
a permanent exclusion, not a version-number gap.

Everything else Garage omits — versioning, tagging, ACLs/policies, object lock — is genuinely
irrelevant to our consumers, and its blanket honesty is admirable
(<https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/>: *"All endpoints
that are missing on Garage will return a 501 Not Implemented"*; *"Amazon has 2 access control
mechanisms in S3: ACL (legacy) and policies (new one). Garage implements none of them."*). The
conditional-write row is the one that decides it.

The honest caveat on the rest of the table, stated so it can be attacked: *registering a handler is
not the same as implementing it correctly.* A route table proves the operation is not absent; it does
not prove semantic parity with AWS under concurrency, or that `ListObjectsV2` paginates identically.
Our own `BLOB-STORE-CONTRACT.md:17` already flags this — *"S3 gateway — works for Loki/Mimir, but
edge-case differences vs AWS exist"* — and I cannot promote that to MEASURED from a source read. The
falsifier that WOULD settle it is named in §4c, and it is cheap. §3d names the specific place I would
expect it to bite.

### 3c. What Loki and Mimir require — and the fact that outranks the table

The brief expected this section to be the crux. It is not, because of §2b: **only Loki has ever run
against object storage in this repo at all, and Mimir's S3 config has never executed.**

What that does to the risk calculation is worth spelling out. A normal storage migration is risky in
proportion to what already depends on the incumbent. Here:

- **Loki** — genuinely running against MinIO in the `included` CI proof. Real regression surface.
  Also the *simplest* consumer: chunk PUTs, index PUTs, GETs, LISTs, and deletes on retention.
- **Mimir** — the more demanding consumer (compactor does multipart + copy at scale) and the one
  whose S3 path is **unmetered**. Switching its endpoint does not risk a regression, because there is
  no measured baseline to regress *from*.
- **Tempo** — not a consumer.
- **`zeta-backups`** — no writer.

**What Grafana actually says it requires — RESEARCHED.** There is no "tested against X" support
matrix for Mimir or Loki; that was checked and is **not established**. What does exist:

- **Mimir** (<https://grafana.com/docs/mimir/latest/configure/configure-object-storage-backend/>) —
  *"The supported backends are: Amazon S3 (and compatible implementations like MinIO), Google Cloud
  Storage, Azure Blob Storage, Swift"*, plus exactly one stated compatibility requirement:
  > *"Like Amazon S3, the chosen object storage implementation **must not create directories**.
  > Grafana Mimir doesn't have any notion of object storage directories, and so will leave empty
  > directories behind when removing blocks."*

  That is the only screening criterion Mimir publishes, and it is the one that should worry us most
  about a filer-backed gateway. See §3d.
- **Loki** (<https://grafana.com/docs/loki/latest/operations/storage/>) tiers its backends, and the
  tier is unflattering to the whole class we are choosing within:
  > **"✅ Supported and recommended chunks stores"** — S3, GCS, Azure Blob, IBM COS, Baidu BOS, Alibaba OSS
  > **"⚠️ Supported chunks stores, not typically recommended for production use"** — Filesystem, and
  > **"S3 API compatible storage, such as MinIO"**

  Worth registering honestly: by Loki's own tiering, *we are already in the not-recommended tier* and
  have been since PR #8057. Switching from MinIO to SeaweedFS does not move us out of it. That is an
  argument about the whole self-hosted-S3 strategy, not about which one we pick, and it is not a
  reason to prefer the archived option.
- **Loki also constrains bucket-side lifecycle rules**, which matters if anyone is tempted to solve
  retention at the store: *"Never apply a lifecycle rule with an empty prefix … A blanket 'delete
  everything older than N days' rule will eventually remove objects that Loki must keep, which
  corrupts the store."*
- **Bucket pre-creation is required** — *"Mimir doesn't create the configured storage bucket, you
  must create it yourself."* Both our backends already declare the buckets in their charts
  (`minio/Application.yaml:30-45`, `seaweedfs/Application.yaml:46-51`), so this is satisfied.

CORRECTED from an earlier draft of this document (and from the brief's framing): I had assumed batch
`DeleteObjects` was on the retention path. **It is not used** — both products issue single-object
deletes; `RemoveObjects` has no callers in `grafana/mimir`. Good for compatibility, worse for
retention throughput.

**Loki has two S3 clients with different requirements, and this bears on the choice.** The legacy
`storage_config.aws` client issues no multipart at all — plain `PutObject`. The newer
`thanos_object_store_config` client (opt-in today, documented as the future default) adds **both**
multipart and `If-Match` conditional writes. So the store's requirements grow when Loki upgrades,
which is the reason §3b treats conditional-write support as load-bearing rather than a nicety.

One more, recorded because it is a live upstream trap rather than a hypothetical: Loki's own source
carries a warning that minio-go's multipart path *"silently drops customHeaders — including the
`If-Match` conditional write header … stale writes are accepted by S3 even when the object's ETag has
already changed."* That is a client-side defect affecting every S3 backend equally, ours included.
It is not a reason to choose differently; it is a reason not to believe a green A/B proves too much.

### 3d. Candidate-by-candidate, on the axes that actually differ

**SeaweedFS — already deployed, already gatewayed, already bucketed.** This is the finding that
reorders everything else. `full-ai-cluster/k8s/applications/seaweedfs/Application.yaml` is not a
proposal; it is a reconciling ArgoCD Application with `allInOne.s3.enabled: true` (line 44) and the
**same five buckets** already declared (lines 46-51): `loki-chunks`, `loki-ruler`, `mimir-tsdb`,
`mimir-ruler`, `zeta-backups`. It uses the same 20 GiB `zeta-local-path` PVC as MinIO (lines 39-42)
and the same dev credentials (lines 34-36). It is **in the `included` Synced+Healthy CI proof** — so
unlike Mimir, its ability to come up on a real cluster is measured, not assumed.

And the migration is already written down. `BLOB-STORE-CONTRACT.md:120-127` carries a *"Cutover
procedure (move consumers MinIO -> SeaweedFS)"* whose operative step is replacing one endpoint string
per consumer: `blob-store.object-store.svc:9000` -> `blob-store-seaweedfs-all-in-one.object-store.svc:8333`.
Aaron authored this himself in PR #8057 (2026-06-13,
`docs/history/pr-reviews/PR-8057-feat-k8s-shared-minio-seaweedfs-blob-store-for-loki-mimir.md`),
explicitly as an A/B alternative — *"both auto-sync so we can compare backends without tearing either
down."*

**The A/B was set up fourteen months ago for exactly this decision. Nobody has run the comparison.**
That is the actual outstanding work, and it is smaller than any migration.

Footprint: single `allInOne` pod (embedded master/volume/filer/S3), lighter than MinIO per our own
contract doc (`BLOB-STORE-CONTRACT.md:21`). Upstream documents single-node as a supported
configuration rather than a hack (<https://github.com/seaweedfs/seaweedfs/wiki/Production-Setup>:
*"You can just use `weed server -filer -s3 -ip=xx.xx.xx.xx`, to have one master, one volume server,
one filer, and one S3 API server running"*; *"One master is fine … Even for large clusters, it is
totally fine to have one single master"*). Memory at our scale is small — the in-memory index costs
*"roughly about 20 bytes … for each file"*, so 1 TiB is a sub-gigabyte service, roughly two orders of
magnitude below Ceph. Note the default volume size is 30 GB, so a ~1 TiB deployment wants
`-volume.max=0` / `master.volumeSizeLimitMB` tuning; that is a config item, not an obstacle.

Cost of migration: **data does not move** — the contract doc says so at line 118, *"Data does not
migrate automatically — each backend has its own empty/filled buckets."* For observability data with
in-app retention windows, discarding the old buckets is acceptable; for `zeta-backups` there is
nothing to move.

**The three honest marks against SeaweedFS**, stated here rather than buried, because a
recommendation that only lists a candidate's strengths is not a recommendation:

1. **An open, unresolved large-object write-finalization bug.**
   <https://github.com/seaweedfs/seaweedfs/issues/8908> — *"S3 API: Docker Registry blob
   finalization fails silently, resulting in corrupted/missing blobs"*, filed 2026-04-03, **still
   open**, last activity 2026-06-21, reproduced independently against Harbor. Reported at 2-5% of
   uploads over 200 MB: S3 returns `201 Created`, the blob never lands, and the failure surfaces
   later as a checksum mismatch. **This is exactly the path §3b warned about** — large objects,
   multipart finalization, silent success. Mimir blocks and Loki chunks live on that path. The
   reporter could not reproduce it after later changes, but nobody has closed it. This is the single
   most important thing to watch for in the §4b step-3 A/B, and it is the reason that step must
   include large objects rather than a smoke write.
2. **The filer heritage cuts against Mimir's one stated requirement.** Mimir demands the store *"must
   not create directories."* SeaweedFS's S3 gateway sits on a filer, and its own documentation
   records directory-shaped semantics: delimiters other than `/` are not allowed, and `DeleteObject`
   on a folder deletes the folder. I could not establish whether this violates Mimir's requirement in
   practice — Mimir's complaint is about *leftover empty directories*, which is an untidiness rather
   than a corruption — so this is **ASSUMED-benign and flagged**, not cleared.
3. **The only Grafana document that names SeaweedFS is negative about it.** Tempo's docs
   (<https://grafana.com/docs/tempo/latest/configuration/hosted-storage/s3/>) list it under
   *"S3-compatible local stores for testing"*: *"SeaweedFS is the recommended option for local
   testing"* — but *"SeaweedFS has not been fully tested with Tempo and is provided here as an
   alternative for local evaluation only. It isn't recommended for production use with Tempo."*
   Tempo is not a consumer here (§2a), so this does not bind us, and no equivalent statement exists
   in the Mimir or Loki docs. But it is the only official signal that exists, it points the wrong
   way, and omitting it would be selective quotation.

None of these outweighs an archived upstream with four unpatched HIGH CVEs. All three are reasons the
A/B in §4b is a **required** step rather than a formality.

**Ceph / Rook — upstream-healthy, and the wrong shape for this box.** Rook is in excellent health
(Apache-2.0, v1.20.6 on 2026-08-20, chart published the same day). The problem is not the project, it
is the fit, and this repo already knows it:

> `full-ai-cluster/usb-nixos-installer/zeta-install.sh:38-41` — *"Storage backend is currently
> Longhorn (ext4 + mount at standard paths). **Ceph/Rook is the planned alternative (B-future): takes
> the same data-disk slots but manages them as raw block devices.** When that lands, set
> `STORAGE_BACKEND=ceph` to switch the formatting strategy. For now only `longhorn` (default) is
> implemented."*

And at line 211 the installer **bails** if you ask for it: *"STORAGE_BACKEND=ceph not yet implemented."*

This is decisive for sequencing, and it is a point the brief did not anticipate. Ceph's S3 is RADOS
Gateway sitting on top of RADOS — you do not adopt "Ceph for S3", you adopt **Ceph**, which in this
cluster means replacing Longhorn as the block layer, which means **raw block devices partitioned at
install time**. That is a decision that has to be made *before the box is imaged*, and cannot be
walked back afterwards without a reinstall.

So Ceph is not a heavier version of the same choice. It is a different, larger decision (the block
layer) wearing the object layer's clothes — and taking it now would mean making the biggest
irreversible storage commitment available on a cluster that has never booted once. Against a
single node with ~1 TiB and one real S3 consumer, that is a large amount of machinery bought to
solve a problem we do not have. Ceph earns its complexity at multi-node scale with failure domains
to model; we have one failure domain, and it is the box.

And the resource arithmetic is upstream's own, not an estimate of mine:

- `osd_memory_target` defaults to **4 GiB**; Ceph's sizing rule is *"total server RAM is greater than
  (number of OSDs \* osd_memory_target \* 2)"* → **8 GiB for a single OSD**, plus `ceph-mon` at
  *">= 5 GB per daemon"* and **100 GB of SSD** for the monitor — **10% of the entire 1 TiB budget
  before a single object is stored** — plus *"at least 20% extra memory"*, with swap *"not advised"*.
  That is roughly **16 GB of RAM and 3.5 cores to serve 1 TiB.** SeaweedFS does it in under a
  gigabyte.
- Upstream: *"Setting the `osd_memory_target` below 2 GB is not recommended … extremely slow
  performance is likely."* So the number is not tunable away.
- **The defaults are structurally hostile to one host.** `osd_pool_default_size` is **3** with a
  `host` failure domain, so placement groups cannot be placed. Rook says the consequence plainly: *"If
  you do not have a sufficient number of hosts or OSDs for unique placement the pool can be created,
  **writing to the pool will hang**."* Getting to HEALTH_OK requires `osd_pool_default_size: 1` and
  `requireSafeReplicaSize: false`, which Rook documents as: *"Set to `false` if you **really** want to
  create a pool with size 1, **which will lead to permanent data loss sooner or later**. Make sure you
  are **ABSOLUTELY CERTAIN** that is what you want."*
- The single-node path exists and is named **`cluster-test.yaml`**, described as *"a test environment
  such as minikube"*, with `allowUnsupported: true`. The production quickstart *"Requires at least
  three worker nodes"*.

RGW's S3 surface is fine — this is not an API objection. It is that Ceph's smallest honest
configuration is larger than our entire budget, and its single-node configuration is one upstream
calls a test environment and warns leads to permanent data loss.

**Garage — the interesting minimalist, ruled out on a design choice rather than a gap.** Genuinely
well-matched on paper: small, simple, self-hosted-friendly, full multipart (all seven ops),
ListObjectsV2, batch delete, actively developed (`v2.3.0`, 2026-04-16). Its documentation is the most
honest of the four. But §3b settles it: **no conditional writes, structurally, permanently**, which
forecloses Loki's Thanos/dataobj metastore path — the path Grafana says will become the default.

The secondary marks, any one of which would be survivable and which together confirm the call:

- **No published Helm chart.** An in-tree chart exists (`script/helm/garage`, chart `0.9.3`,
  appVersion `v2.3.0`, maintainers field empty), but it is distributed only by cloning the repo —
  `garagehq.deuxfleurs.fr/index.yaml` and `/charts/index.yaml` both **404**. Our chart-pin survey
  tooling from PR #13325 reads indexes; there is nothing for it to read.
- **Upstream says do not run our topology.** For `replication_factor = 1`: *"Do not use this for
  anything else than test deployments"*, and known-issues adds *"Mitigation: Do not use
  `replication_factor = 1`."* We are single-node. SeaweedFS, by contrast, documents single-node as
  supported (§3d above). That asymmetry is the whole ballgame for this box.
- No documented resource minimums (**not established** — design intent only, *"as low powered … as a
  raspberry pi"*), AGPL-3.0 where SeaweedFS is Apache-2.0, no GitHub releases on the mirror, no
  in-repo history.

**It remains the second choice** if SeaweedFS fails §4c — but only for Mimir. If Loki moves to the
Thanos client, Garage stops being an option at all.

**Staying on MinIO — the honest option, and it does have a case.** It works. It is pinned, it syncs,
it is in the CI proof, and an archived project does not stop running the day it is archived. The case
for staying is entirely a case about *timing*, and it is answered in §4.

What kills it as an *end state* is §1d: **four unpatched HIGH advisories, two of them unauthenticated
object write, with the fix available only in a proprietary product.** Our pin deploys
`RELEASE.2024-12-18`, which predates all eight. The archived repo cannot ship a fix — not slowly,
not at all.

**AIStor is not the successor.** Its "Free" tier is a proprietary EULA, not an open-source licence
(<https://www.min.io/legal/aistor-free-agreement>): *"limited, non-exclusive, non-transferable,
royalty-free license to install and use the Software solely in standalone mode"* — no modification,
no derivative works, no redistribution, distributed/HA clustering prohibited on Free, and licence
expiry **degrades the running system** (read-only at 30-90 days, all S3 operations blocked past 90).
A store that stops serving when a licence lapses is not a storage layer, it is a subscription with a
filesystem attached. Adopting a vendor's paid product to escape their abandonment of the free one is
also precisely the appointed-hub shape
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` says to route around — the
discriminator is **exit**, and AIStor is the option with the least of it.

**The forks — one is credible, and it deserves naming rather than a hand-wave.**
`pgsty/silo` (renamed from `pgsty/minio` on 2026-08-06, AGPL-3.0, `RELEASE.2026-08-06`) is the only
one that has actually **backported the CVEs** — commits for the signature-bypass unauthenticated
writes, `ReadMultiple` removal, S3 Select limits, LDAP STS rate-limiting, OIDC JWT verification — and
it restores the removed console, ships binaries and multi-arch images, and publishes its own Helm
chart (`silo` 7.0.1). It is maintained by the Pigsty project, which runs it in production. The others
are not viable: `OpenMaxIO/openmaxio-object-browser` is UI-only and 14 months stale;
`libreFS/libreFS` stalled in May 2026; `openminio/openminio` has no releases.

**If the maintainer's preference is to stay on MinIO-shaped software**, `pgsty/silo` — not MinIO
community, and not AIStor — is the only defensible way to do it. It is a smaller change than a
backend migration and it closes the CVE exposure. What it does not do is remove the single-vendor
risk: one project, one maintainer group, and no track record longer than the fork itself. I would
take SeaweedFS over it, and I would take it over staying where we are.

**One thing to verify regardless of the choice**, surfaced by the research and checked in our tree:
both the Loki and Mimir upstream Helm charts still declare a `minio` 5.4.0 dependency on
`charts.min.io` — Grafana's own issue <https://github.com/grafana/mimir/issues/13118> is open about
it, saying *"We cannot recommend that end users continue to install the last available OCI build for
Minio as it is vulnerable to a Privilege Escalation CVE (8.1)"*, and lists Grafana's shortlist as
**Garage, versitygw, SeaweedFS, and Ceph RGW**. **We are already clear of this** — MEASURED:
`loki/Application.yaml:22-23` and `mimir/Application.yaml:25-26` both set `minio: enabled: false`.
Recorded because it is the kind of thing that silently comes back on a chart bump.

---

## 4. Recommendation

### 4a. The recommendation

**Adopt SeaweedFS as this cluster's S3 backend and retire MinIO — but do not do it first.**

The reasoning is short because §3 did the work:

1. Aaron's precondition is **met on measured evidence** — `archived: true`, and the chart is archived
   *inside the same repository*, so there is no version of "wait and see" in which upstream returns.
2. The requirement is **the S3 interface**, and SeaweedFS serves it — full multipart, ListObjectsV2,
   batch delete, CopyObject, range GET — measured from its own route registration.
3. It is **already running here**, already gatewayed, already holding the same five bucket names, and
   already inside the CI proof that MinIO is in. The alternative candidates would each require
   building what already exists.
4. It is **better licensed** (Apache-2.0 vs AGPL-3.0) and **actively published** (chart shipped the
   day this was written).
5. The migration, per our own contract doc, is **one endpoint string per consumer**, and there are
   two consumers.

**Conditional on one thing**, and it is not a formality: the A/B in §4b step 3, run with objects over
200 MB and verified by checksum. SeaweedFS has an open, unresolved defect on exactly that path
(§3d), and this recommendation is only as good as that check. Until it runs, the correct register
for "SeaweedFS works for us" is **unmetered** — implemented, plausible, unfalsified.

### 4b. Sequencing — and why "boot metal first" wins

The brief asked me to account for the fact that this cluster has **never run on physical hardware**,
and it changes the ordering rather than the destination.

**Boot the box on what we have. Then migrate. In that order.** Three reasons, and the third is the
one I would defend hardest:

1. **A bring-up debugs one variable at a time.** The first metal boot is the single largest
   accumulation of untested assumptions this project has — an installer that has never partitioned a
   real disk, Longhorn on real NVMe, and (per §2b) *Mimir's entire object-storage path*, which has
   never executed anywhere. Changing the S3 backend in the same window means that when something
   fails, "is this the new object store or is this the metal?" is unanswerable. MinIO's archival is
   not urgent on any timescale that competes with this.

2. **Nothing about MinIO gets worse by waiting — but this is weaker than I first wrote it, and §1d
   is why.** The original form of this argument was "the risk is a hypothetical future CVE, so timing
   is free." That is not the situation: there are **four unpatched HIGH advisories today**, two of
   them unauthenticated object write, and no upstream fix will ever arrive. What rescues the
   sequencing is not that the risk is small in the abstract but that **our exposure is currently
   zero and stays near-zero through step 1**: the box is not running, and when it is, the blob store
   is a ClusterIP inside a single-node cluster with no ingress and no untrusted tenant. An
   unauthenticated-write bug needs a reachable attacker.
   So: **an abandoned chart that works is not an emergency, but it is a clock**, and the clock starts
   at the metal boot. That is an argument for keeping steps 3-5 close behind step 1 — weeks, not
   quarters — rather than for reordering them. If the box is ever going to be reachable from outside
   the LAN, or hold a tenant we do not control, this stops being a sequencing question and becomes
   the first thing to fix.

3. **The metal boot produces the measurement that makes the migration decidable.** This is the real
   argument. Right now the case for SeaweedFS rests on a route table and a chart index. What it does
   *not* rest on is a single observation of SeaweedFS serving Loki or Mimir — the A/B that PR #8057
   built has never been run, and `BLOB-STORE-CONTRACT.md:17`'s *"edge-case differences vs AWS exist"*
   is an unfalsified warning sitting in our own tree. Booting metal on MinIO gives us the first real
   baseline — actual chunk volumes, actual compaction behaviour, actual Mimir-on-S3 — and only
   against a baseline can the A/B mean anything. **Migrating first would discard the only comparison
   that would have made the migration defensible.**

Concretely:

| # | step | why it is in this position |
|---|---|---|
| 1 | Boot metal on MinIO, unchanged | one variable; MinIO is the *known* half of an unknown bring-up |
| 2 | Get Mimir onto object storage at all (its `longhorn` exclusion, §2b) | the unmetered path becomes metered; this is owed regardless of backend |
| 3 | **Run the A/B PR #8057 built** — repoint Loki to `:8333`, verify ingest + query, **including objects over 200 MB** | the falsifier; cheap, reversible in one line |
| 4 | Repoint Mimir, watch a full compaction cycle complete | the demanding consumer, against a real baseline |
| 5 | Retire the `minio` Application; SeaweedFS becomes the default in the contract doc | the decision, paid for by steps 3-4 |

Steps 3 and 4 are each a one-line endpoint change with a documented revert
(`BLOB-STORE-CONTRACT.md:127`). This is about as reversible as a storage decision gets, which is
itself an argument for not rushing it: nothing is bought by doing it early.

**Step 3's size threshold is not decoration.** Per §3b, multipart only engages above ~64 MB, and per
§3d the one open SeaweedFS defect is a silent finalization failure on uploads over 200 MB that
returns `201 Created`. A smoke test that writes small objects would pass while the actual failure
mode sits untouched — which is the vacuity class exactly: *a check that cannot fail is not a check.*
The A/B must write large objects and then **read them back and verify checksums**, or it proves
nothing worth having.

**One thing should NOT wait**, and it is the cheapest item here: the chart-freshness survey currently
reports `minio` as *"no action — 5.4.0 is the latest published version"*
(PR #13325's doc, line 339-342). That is true and misleading, and the doc itself already says why. A
pin whose upstream is **archived** should not be able to read as green in a freshness survey. Making
that surface report "upstream archived" rather than "0 behind" is a small honesty fix, independent of
which backend we choose — and it is exactly the failure mode `included-proof-summary.ts` was written
to close, stated in its own header comment: *"a check that ran and failed looked exactly like a check
that passed."* Here it is the milder sibling — a check that ran and passed, having had nothing to
check.

### 4c. What would change my mind

Stated as falsifiers, so this is a claim rather than a preference:

| finding | effect |
|---|---|
| **SeaweedFS reproduces issue #8908** — a large-object write finalizes silently-wrong in the §4b step-3 A/B | **The recommendation is withdrawn.** This is the one result that would flip it, and it is the reason step 3 exists. Fallback becomes `pgsty/silo` (CVE-patched MinIO, §3d), *not* Garage — Garage cannot serve Loki's Thanos path |
| SeaweedFS's filer semantics actually violate Mimir's *"must not create directories"* in a way that corrupts rather than litters | Same: withdrawn, same fallback. This is the §3d mark I could not clear |
| Loki or Mimir errors against `:8333` in a way that **is** a config fix | Not a falsifier — fix the config. Named so a config bug is not mistaken for a verdict |
| A consumer appears that needs **conditional writes** (or Loki moves to the Thanos client, which Grafana says is coming) | **Garage is eliminated permanently**, not merely deprioritised (§3b). Does not affect SeaweedFS |
| `pgsty/silo` sustains >=6 months of releases, a published chart, and continued CVE backports | Staying on MinIO-shaped software becomes genuinely viable — the objection was always abandonment, not the software |
| The cluster stops being single-node, or gains a real multi-node failure-domain requirement | **Ceph/Rook becomes the serious candidate** — and per `zeta-install.sh:38` that decision must then be made *at install time*, not after. This is the one candidate whose window closes |
| Mimir's object-storage volume turns out to be far larger than assumed | Does **not** change the backend choice; it changes §2d (the unsized 20 GiB PVC), which is backend-independent |
| The box becomes internet-reachable, or hosts an untrusted tenant | **Sequencing inverts.** §1d's unauthenticated-write CVEs stop being theoretical and the migration precedes the bring-up |
| SeaweedFS's own upstream posture changes (archival, relicensing) | Re-run this document; the method is the durable part, not the answer |

### 4d. What this document deliberately does not do

- **No manifest is changed.** Not `minio/Application.yaml`, not `seaweedfs/Application.yaml`, not the
  consumers. The decision is Aaron's and the change is a separate reviewable PR.
- **It does not claim SeaweedFS has been proven to serve Loki.** It has been proven to *deploy*
  (`included` CI proof) and to *register* the needed routes (source read). Serving our consumers is
  step 3 above, and calling it done before it runs would be the exact vacuity this repo is built to
  refuse.
- **It does not price the object store.** §2d found the blob store absent from both storage budget
  files at 20 GiB; that gap is real, backend-independent, and belongs to whoever sizes the box.

---

## 5. Anchors

- **Exit, not degree** — Hirschman, *Exit, Voice, and Loyalty* (1970), via
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`. The reason AIStor is not the
  natural successor: it is the option with the least exit. SeaweedFS at Apache-2.0 is the one with
  the most.
- **`clone-at-tag-stays-sufficient`** — an archived upstream is the limiting case of the failure that
  rule guards: a supplier you cannot route around because it no longer exists.
- **`toy-is-free-metered-must-be-earned`** — the register applied to §2b: Mimir's S3 path is
  *unmetered*, and saying so is the point. Calling SeaweedFS "proven" on a route-table read would be
  the silent promotion that rule forbids.
- **`every-bug-has-economic-value`** — the survey finding that MinIO reads "0 behind" while its
  upstream is archived is a priced bug in the freshness meter, not a footnote (§4b).

## 6. Sources

| claim | source |
|---|---|
| `minio/minio` archived, AGPL-3.0, last push 2026-04-24 | `gh api repos/minio/minio` (MEASURED 2026-08-21) |
| Last MinIO release 2025-10-16 | `gh api repos/minio/minio/releases` (MEASURED) |
| "THIS REPOSITORY IS NO LONGER MAINTAINED" | <https://github.com/minio/minio> |
| Chart source inside the archived repo; no `minio/charts` | `gh api repos/minio/minio/contents/helm` -> `minio`; `gh api repos/minio/charts` -> 404 (MEASURED) |
| MinIO chart newest 5.4.0, created 2025-01-02, appVersion RELEASE.2024-12-18 | <https://charts.min.io/index.yaml> (MEASURED) |
| Console removal, community reaction | <https://github.com/minio/minio/discussions/21326> · <https://www.blocksandfiles.com/ai-ml/2025/06/19/minio-users-complain-after-admin-ui-removed-from-community-edition/1610856> |
| SeaweedFS Apache-2.0, not archived, 4.43 on 2026-08-21, >=100 commits/30d | `gh api repos/seaweedfs/seaweedfs` + `/releases` + `/commits?since=` (MEASURED) |
| SeaweedFS chart 4.43.0 created 2026-08-21 | <https://seaweedfs.github.io/seaweedfs/helm/index.yaml> (MEASURED) |
| SeaweedFS S3 handler registration | <https://raw.githubusercontent.com/seaweedfs/seaweedfs/master/weed/s3api/s3api_server.go> (MEASURED) |
| MinIO advisories (8, four HIGH unpatched); CVE-2026-41145 | GitHub Advisory Database, `minio/minio` |
| AIStor Free is a proprietary EULA; expiry degrades to read-only then blocked | <https://www.min.io/legal/aistor-free-agreement> · <https://docs.min.io/aistor/operations/licenses/> |
| `pgsty/silo` fork — CVE backports, console, own chart | `pgsty/silo` (RELEASE.2026-08-06) |
| Grafana's own MinIO-dependency issue + replacement shortlist | <https://github.com/grafana/mimir/issues/13118> |
| Mimir supported backends + *"must not create directories"* | <https://grafana.com/docs/mimir/latest/configure/configure-object-storage-backend/> |
| Loki tiers S3-compatible stores as not-recommended-for-production | <https://grafana.com/docs/loki/latest/operations/storage/> |
| Loki lifecycle-rule warning; versioning recommendation | <https://grafana.com/docs/loki/latest/operations/storage/logs-deletion/> |
| Tempo names SeaweedFS, "not recommended for production use" | <https://grafana.com/docs/tempo/latest/configuration/hosted-storage/s3/> |
| `thanos-io/objstore` 64 MB multipart threshold; `If-Match` on Loki's ToC path | `thanos-io/objstore` S3 provider; `grafana/loki` dataobj metastore |
| SeaweedFS open large-object finalization defect | <https://github.com/seaweedfs/seaweedfs/issues/8908> (open) |
| SeaweedFS single-node supported; ~20 bytes/file index | <https://github.com/seaweedfs/seaweedfs/wiki/Production-Setup> · `.../wiki/Optimization` |
| Garage S3 compatibility incl. the ACL/policy quote | <https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/> |
| Garage: conditional writes *"structurally impossible"*; don't use `replication_factor = 1` | <https://garagehq.deuxfleurs.fr/documentation/reference-manual/known-issues/> |
| Ceph sizing (`osd_memory_target` 4 GiB, mon >= 5 GB + 100 GB SSD); pool size 3 hangs writes | <https://docs.ceph.com/en/latest/> · Rook `requireSafeReplicaSize` docs |
| Rook Apache-2.0, v1.20.6 2026-08-20 | `gh api repos/rook/rook` (MEASURED) · <https://charts.rook.io/release/index.yaml> |
| Consumer wiring, cutover procedure, "edge-case differences" | `full-ai-cluster/k8s/object-store/BLOB-STORE-CONTRACT.md:9-10,17,118-127` |
| Mimir/Tempo excluded from `included` proof | `src/Core.TypeScript/cluster/argocd-health-test.ts:281,286` |
| Ceph/Rook is a block-layer decision made at install time | `full-ai-cluster/usb-nixos-installer/zeta-install.sh:38-41,211` |
| The A/B was built deliberately in PR #8057 | `docs/history/pr-reviews/PR-8057-feat-k8s-shared-minio-seaweedfs-blob-store-for-loki-mimir.md` |
| "only `minio` is current" / chart survey | `docs/research/2026-08-21-every-remote-helm-chart-pin-surveyed-against-its-own-upstream-index-two-were-never-published.md:17,102,110,341` |
