# Third-party dependency escrow — Helm chart selection, and why the retention policy is the product rather than the registry

**Date:** 2026-08-26 · **Author:** shadow (Claude Opus 5) · **Register:** Mirror→Beacon
**Scope:** selection only. **Nothing was deployed and no chart was added to the cluster.**
**Method is re-runnable:** every measurement in §2, §3 and §11 names its command or its URL.

Every factual claim below carries a register marker — **[metered]** (measured here, or quoted
verbatim from a primary source with a retrieval date), **[consistent with]** (strongly indicated
but not directly verified), **[speculative]** (reasoned, untested). §13 lists what could not be
verified at all.

***

## 0. The answer

Aaron's framing does the selecting, and it selects something narrower than a product:

> *"at itron we called the local pull through cache 3rd party dependency escrow and was backed up
> as rigorously as our database, this is another defense against time and nation state attacks."*

The finding that organises this whole document is that **the escrow/cache distinction is not a
distinction between products. It is a distinction between two feature sets inside the same
product, and the industry default on every one of them is `cache`.** Harbor is the cleanest
demonstration, because it ships both and its own documentation says so out loud:

| | Harbor **proxy cache** project | Harbor **pull-replication** into a normal project |
| --- | --- | --- |
| upstream deletes the artifact | **"If the image is no longer in the target registry, no image is served."** | your copy is untouched — **"Deletion operations are not replicated"** (manual/scheduled) |
| upstream unreachable | serves the cached copy | serves your copy |
| default retention | **"By default, Harbor creates a 7 day retention policy for each new proxy cache project."** | none created |
| can it be overwritten | yes, on the next upstream change | no, under an immutability rule |
| this is a… | **cache** | **escrow** |

All four quotes are verbatim from Harbor's own docs, retrieved 2026-08-26 **[metered]** (§7).

Read the top-left cell again, because it is the sharpest thing in this report. **Harbor's proxy
cache checks upstream on every pull and refuses to serve an artifact whose upstream has deleted
it — even though it is holding the bytes.** That is not a cache that degrades to an escrow under
attack. It is a cache that *implements* the time attack: the day MRAN dies, or Bitnami withdraws
its tags, the proxy cache goes dark on exactly the artifacts you cached it for.

So the recommendation:

> **Harbor, deployed in *escrow* configuration — scheduled pull-replication into normal projects
> with tag-immutability rules and no retention policy — for the container/OCI/Helm half, which is
> 129 of the pinned artifacts and ~75 GiB of the footprint. Start there. Then a second, separate
> decision for the language/OS-package half, where the honest answer is that no free, open,
> unlimited, polyglot option exists and Aaron has to choose which constraint to accept.**
>
> **Do not deploy Harbor's proxy-cache feature under the name "escrow."** It is the feature the
> word "pull-through cache" points at and it is the wrong one.

Artifactory — Aaron's named hypothesis — is **eliminated on a licensing fact**, §5. It is the
single most useful result here because it kills the default assumption before any effort is spent
on it.

**One honest qualification on the recommendation, stated here rather than buried in §8: Harbor is
not the best escrow in this field. Pulp 3 is.** Pulp is the only candidate that deletes *nothing*
without a human running a command, its repository versions are immutable, and its artifacts are
sha256-addressed — all verified. Harbor wins step 1 anyway, on two grounds that are about
deployment rather than about escrow semantics: **Pulp has no official NuGet plugin at all** (and
this repo has 37 NuGet pins), and **Pulp's own project describes its Helm chart as "still under
development" and its operator as "in beta stage"**, so there is no install path it presents as
production-ready. Harbor's escrow properties have to be *configured on*; Pulp's are the default,
and it cannot be installed the way this cluster installs things. That trade is worth knowing,
because it is the reason §9 makes the configuration a lint rather than a runbook note — the
recommended tool is the one whose safe state is not its default.

***

## 1. The discriminator, stated before any candidate is scored

An escrow and a cache are the same bytes under different disposal rules:

- A **cache** is disposable, because on a miss it can re-fetch. LRU is correct. Eviction is free.
- An **escrow** is not disposable, because **its entire premise is that upstream may not be
  there** — abandoned (the *time* attack) or serving different bytes (the *nation-state* attack).
  Eviction is the failure.

Three properties follow, and they are the load-bearing columns of the matrix in §4:

1. **Retention is a first-class requirement, not an ops afterthought.** A default retention
   policy is a disqualifier until it is explicitly removed, and the removal must be checkable.
2. **Immutability.** If a stored artifact can be silently replaced, the nation-state half is
   defeated by the thing that was supposed to defend against it.
3. **Exit preserved.** If builds *must* route through it, it is an appointed hub and a new single
   point of failure — `.claude/rules/clone-at-tag-stays-sufficient.md` and the exit discriminator
   in `itron-hub-patent-boundary-p2p-is-the-upgrade.md`. §10 makes this a test rather than a
   sentiment.

And the falsifier that decides whether what got built is what was named:

> **If someone configures LRU eviction on it, they have built a cache and labelled it an escrow.**

A thing that looks like a guarantee and behaves like a convenience is the vacuity class, and this
repo already names it in a dozen places. The escrow's guarantee has to be *checked*, which is why
§9 makes retention-and-immutability a lint rather than a runbook paragraph.

***

## 2. The attack is not hypothetical here — it is already measured, in this repo, with a date

This is the strongest argument for building the escrow at all, and it required no new work: the
cluster tree already measures its own upstream exposure, and the measurement is bad.

`src/Core.TypeScript/cluster/image-footprint.measured.json`, measured **2026-08-22** by
`image-footprint.ts` — every image read out of `helm template` at each Application's pinned
`targetRevision`, then resolved against the upstream registry **[metered]**:

| | count | share |
| --- | --- | --- |
| distinct container images pinned by the cluster | **129** | — |
| resolvable by an anonymous client | 114 | 88.4% |
| **NOT resolvable** | **15** | **11.6%** |
| — gone, `manifest HTTP 404` | **8** | 6.2% |
| — auth-walled, `HTTP 401` | 6 | 4.7% |
| — rate-limited, `HTTP 429` | 1 | 0.8% |

Reproduce: `node -e` over that file, or re-run `image-footprint.ts`. The eight 404s **[metered]**:

```
bitnami/kubectl:1.32.3
docker.io/bitnami/postgres-exporter:0.12.0-debian-11-r86
docker.io/bitnami/postgresql:14.8.0
docker.io/bitnami/redis-exporter:1.46.0-debian-11-r8
docker.io/bitnami/redis:6.2.16-debian-12-r1
docker.io/bitnami/redis:7.4.1-debian-12-r2
ghcr.io/ich777/steamcmd:armareforger
ghcr.io/ich777/steamcmd:gmod
```

**Five of the eight are one event.** `full-ai-cluster/k8s/applications/gitlab/Application.yaml`
records it, measured rather than assumed on 2026-08-23:

> *"Bitnami withdrew its free versioned tags from Docker Hub … `docker.io/bitnami/postgresql` and
> `docker.io/bitnami/redis` still answer `tags/list`, and every entry is `latest`,
> `latest-metadata`, or a cosign `sha256-...`/`.sig`/`.att` artifact — no versioned tags left."*

`forgejo/Application.yaml` records the same withdrawal from the other side: chart 14.0.0 **removed
its bundled PostgreSQL subchart outright**, and *"upstream's stated reason for the removal is
Bitnami ending its free image catalogue."*

That is the time attack, landed, in this repository, this month. Not MRAN in the abstract — a
vendor withdrew a catalogue and two of our Applications had to be edited to survive it. The
mitigation actually applied was `bitnamilegacy`, and the manifest is honest about what that buys:

> *"HONEST LIMIT … `bitnamilegacy` is an ARCHIVE. It gets no updates and Bitnami reserves the
> right to remove it."*

**An escrow is the mitigation that does not depend on the adversary's continued goodwill.** Had
one been running before 2026-08-01, those five images would still be servable and neither manifest
would have needed editing. That is the ΔU this work banks, and it is ordinal and witnessed: the
witness is the eight-row 404 list above, and the sign is that it would have been zero.

The 429 is worth its own line. `cr.weaviate.io/semitechnologies/weaviate:1.32.7` **[metered]** was
not gone and not private — it was *throttled*. An escrow fixes that class too, and that is the
mundane, everyday half of the value that pays for the apocalyptic half.

***

## 3. What actually has to be escrowed — eleven channels, and two of them no repository manager speaks

The requirement was *"deps for any language and os and container images all hosted."* Enumerated
against what this repo actually pulls **[metered]** — counts from the working tree at
`89c8a23c40`:

| # | channel | measured size today | covered by a repository manager? |
| --- | --- | --- | --- |
| 1 | **Container images / OCI** | **129 images**, 28.09 GiB compressed | yes — Harbor, Nexus, Pulp, Zot |
| 2 | **npm** | **411 resolved** (`bun.lock`), 222 MB on disk | yes — Nexus, Verdaccio, Gitea/Forgejo (push-only) |
| 3 | **NuGet** | **37 pinned** direct, 48 projects | yes — Nexus |
| 4 | **PyPI** | **131 distinct** across 3 `uv.lock` | yes — Nexus, Pulp, devpi |
| 5 | **Cargo** | **94 distinct crates** across 36 `Cargo.lock` | yes — Nexus, Gitea/Forgejo |
| 6 | **Go modules** | 5 (`src/Core.Go/go.sum`) | yes — Nexus, Athens |
| 7 | **Maven/Java** | java 26 toolchain, few direct deps | yes — everything |
| 8 | **apt/deb** | **561 MB per ubuntu CI job** | yes — Nexus, Pulp, apt-cacher-ng |
| 9 | **Helm charts** | ~20 chart pins, 5 chart repos + 3 OCI | yes — Harbor, Nexus |
| 10 | **mise toolchains** | **18 tools** — dotnet, go, rust, zig, python, java, bun, node, uv, … | **NO** |
| 11 | **Nix substituters** | `cache.nixos.org`, `nix-community` | **NO** |

Channels 10 and 11 are the finding in this section, and neither candidate list — Aaron's or
mine — contained anything that addresses them.

**`mise` is this repo's actual toolchain acquirer** and it is named as such: `global.json` says
the SDK version is *"DERIVED from .mise.toml's `dotnet` pin, which is the single declared source
(mise is the only one of the two that ACQUIRES an SDK)"* **[metered]**. And
`arc-runner-set/Application.yaml` records that the k8s CI lane needs `.mise.full.toml` — k3d,
kubectl, helm — *"at BOTH install and run time"*. But mise does not fetch from npm or PyPI; it
fetches release tarballs from GitHub Releases, `nodejs.org`, `dotnet.microsoft.com` and a dozen
other vendor CDNs. **No repository manager in this evaluation proxies that traffic in a
format-aware way.** The best available answer is a *generic/raw* proxy repository (Nexus `raw`,
Artifactory `generic`, Pulp `pulp_file`) fronting each host, which works but is unglamorous and
must be wired per-host **[consistent with]**.

**Nix is a second uncovered channel** and a happier one. `infra/nixos/modules/common.nix` and
`infra/nix-darwin/configuration.nix` both set `substituters = [ "https://cache.nixos.org" … ]`
**[metered]**. Nix's substituter protocol is plain HTTP over an S3-shaped bucket layout, and
**the cluster already runs MinIO** with an S3 endpoint at `blob-store.object-store.svc:9000`
(`k8s/object-store/BLOB-STORE-CONTRACT.md`). An S3 substituter on the existing MinIO, or
`attic`/`harmonia`, is the shaped answer — and it is a *different* decision from this one
**[consistent with]**. It is named here so it does not get silently assumed into "Harbor covers
it," which it does not.

**Consequence for the recommendation:** any answer of the form "install product X and we are
done" is wrong, because 2 of 11 channels are outside every product's format list and a third
(Helm charts from classic chart repos) is only partly covered. The escrow is a *programme*, and
the chart selection is its first step.

***

## 4. The selection matrix

Scored against the requirement set in the brief. Licensing rows carry their source and retrieval
date inline; all licensing retrieval is **2026-08-26**.

| | **Artifactory OSS** | **Nexus Repo CE** | **Harbor** | **Pulp 3** | **Zot** | **Gitea/Forgejo** |
| --- | --- | --- | --- | --- | --- | --- |
| **OCI / containers** | ❌ *(JCR only)* | ✅ | ✅ | ✅ `pulp_container` | ✅ | ✅ (push-only) |
| **Helm** | ❌ *(JCR only)* | ✅ | ✅ (OCI) | via container | ✅ (OCI) | ✅ (push-only) |
| **npm / PyPI / NuGet** | ❌ **none** | ✅ | ❌ | npm ✅, py ✅, **NuGet ❌** | ❌ | ✅ (push-only) |
| **Cargo / Go / gems** | ❌ | ✅ | ❌ | gems ✅, cargo preview, **Go ❌** | ❌ | ✅ (push-only) |
| **apt / rpm / apk** | ❌ | ✅ | ❌ | ✅ **strongest** | ❌ | ✅ (push-only) |
| **Maven** | ✅ *(only this)* | ✅ | ❌ | **proxy-only, beta** | ❌ | ✅ |
| **proxy / pull-through** | ✅ *(Maven only)* | ✅ all formats | ✅ **but see §7** | ✅ | ✅ sync ext | ❌ **push-only, §8** |
| **licence** | AGPL-3.0 *(unconfirmed by vendor)* | **proprietary EULA** | **Apache-2.0** | **GPLv2 ⚠️ §8** | **Apache-2.0** | MIT / GPLv3 |
| **usage cap** | none found | **40k components / 100k req/day** | none | none | none | none |
| **immutability** | n/a | **not found** | ✅ **explicit rule** | ✅ **immutable versions + sha256** | ⚠️ **ACL convention only** | no overwrite, **deletable** |
| **default retention** | none | none | ⚠️ **7d on proxy projects** | ✅ **nothing auto-deletes** | ❌ **GC on, 1h, untagged** | cleanup rules opt-in |
| **backup story** | — | blob+DB, read-only mode | Velero, **excludes external DB + S3** | operator CR, **excludes external DB + S3** | filesystem | filesystem |
| **maintained chart** | ✅ official | ⚠️ community only | ✅ **official, 2026-08-03** | ⚠️ **operator, self-declared beta** | ✅ 2026-07-13 | ✅ 2026-07-19 |
| **footprint** | JVM, heavy | **8 GB / 2 CPU min** | **2 CPU / 4 GB min** | **1–3 GB per worker** | **not published** | light |
| **ArgoCD fit** | good | good | **good** | operator, awkward | good | good |
| **verdict** | ❌ **eliminated §5** | ⚠️ **§6** | ✅ **recommended, §7** | ⚠️ **runner-up, §8** | ❌ **disqualified §8** | ❌ not a proxy |

Two columns decide almost everything, and neither is a feature-count: **licence/cap** and
**default retention**. Read the `default retention` row on its own and it sorts the field into the
answer: **Pulp deletes nothing without a human running a command; Harbor deletes on proxy-cache
projects at 7 days; zot deletes untagged manifests roughly an hour after they are pushed.** Only
one of those three is an escrow by default, and it is not the one being recommended — §9 explains
why the default is not the deciding factor once the configuration is enforced by a check.

***

## 5. Artifactory — the named hypothesis, and it does not fit

Aaron said *"in my head i hear artifactory but i don't really know at all if that fits with
features and licensing."* It does not, and the reason is a single sentence on JFrog's own page.

**[metered]** — JFrog's feature comparison matrix for self-managed JPDs
(`https://docs.jfrog.com/installation/docs/feature-comparison-matrix-for-self-mangaged-jpds`,
retrieved 2026-08-26), "Universal Package Management" row, non-commercial column, **verbatim**:

> **"JCR: Docker, Helm, OCI, Generic. OSS: Maven, Gradle, Ivy, SBT, Generic. CE: Conan, Generic"**

Commercial tiers get *"All package types."* So:

- **Artifactory OSS is Maven-family plus generic. It has no npm, no PyPI, no Docker, no NuGet, no
  Go, no Cargo, no apt, no rpm, no apk, no Helm.** Not "harder to configure" — the formats do not
  exist in the licence.
- The three free things are **three separate products on separate installs** — Artifactory OSS,
  JFrog Container Registry, and CE for C/C++ — not tiers you can combine. You cannot assemble
  Docker + npm from the free set because npm is not in any of them.
- Remote/proxy repositories *are* in all editions **[metered]**, but a remote repo only exists for
  a format the licence includes, so free Artifactory buys you a Maven Central pull-through and
  nothing else.
- The next step up is **Pro X, "starting at $27,000/year"** self-hosted
  (`https://jfrog.com/pricing/`, retrieved 2026-08-26) **[metered]**. There is no cheap
  intermediate rung.

**JFrog's marketing pages say "60+ package types including Docker, Maven, npm, PyPI, Helm."** That
is the commercial product. The docs matrix contradicts the marketing framing, and the docs matrix
is the one that governs what a free install can do. This is worth flagging as a pattern, not a
gotcha: it recurs verbatim in §6.

The Helm chart is real and current — `jfrog/charts`, `artifactory-oss` chart **107.161.19** /
appVersion 7.161.19, not deprecated **[metered]**. It is a good chart for a product that cannot
meet the requirement.

**Licence, honestly:** multiple secondary sources say Artifactory OSS is AGPL-3.0, and
`jfrog.com/community/download-artifactory-oss/` **states no licence at all** — I could not find a
JFrog-primary assertion **[consistent with, not verified]**. It does not change the outcome. JCR
and CE-for-C/C++ are free-of-charge proprietary, not open source **[metered]**.

**Verdict: eliminated.** Not on price, not on quality — on the format list, at the licence level,
where no configuration can reach.

***

## 6. Nexus Repository Community Edition — the broadest format list, attached to the worst escrow property

Nexus is the only single product in this evaluation that covers essentially every format the
requirement names. Sonatype's own feature matrix
(`https://help.sonatype.com/en/nexus-repository-feature-matrix.html`, retrieved 2026-08-26) checks
**every repository format for both Community Edition and Pro** — maven2, npm, PyPI, NuGet, Docker,
OCI, Helm, Go, Cargo, RubyGems, apt, yum, Alpine, Conan, Conda, R, Composer, raw, and more. There
are **no Pro-only formats** **[metered]**. Proxy repositories are core and un-gated **[metered]**.
Cargo, Composer and Conan v2 *moved into* CE in 3.77.0, so any pre-2025 comparison table is wrong.

That is a genuinely strong offer, and then three facts land on it.

**(a) It is not open source in the configuration you would use.** Sonatype split the thing in
February 2025 **[metered]**:

| | EPL core (source) | **Community Edition (binary)** |
| --- | --- | --- |
| licence | Eclipse Public Licence v1.0 | **proprietary EULA** |
| formats | **maven, raw, APT only** | npm, Docker, NuGet, PyPI + many others |

Verbatim from the `sonatype/nexus-public` README **[metered]**: the OSS core *"contains
functionality for maven, raw, and APT repository formats"*; CE *"includes additional format support
such as npm, Docker, NuGet, PyPI and many others."* **OSS binary distributions were sunset at
3.76.1**; every binary from 3.77.0 on is CE
(`https://community.sonatype.com/t/changes-to-nexus-repository-core-codebase/14341`). The CE EULA
forbids service-bureau/hosting use for third parties and **explicitly forbids circumventing
telemetry collection** **[metered]**.

**(b) The usage cap is a countdown, and it is the wrong shape for an escrow.** CE enforces
**40,000 components and 100,000 requests/day**; exceeding either **pauses addition of new
components** until usage falls below both **[metered]**
(`https://help.sonatype.com/en/sonatype-nexus-repository-3-87-0-release-notes.html`,
`https://help.sonatype.com/en/ce-onboarding.html`).

Two things about that number.

*It is not binding today.* This repo's whole snapshot closure is roughly **1,200–1,800
components** — 411 npm + 131 PyPI + 94 crates + 129 images + 37 NuGet + ~20 charts + a few
hundred `.deb` **[metered for the named counts, [speculative] for the total]**. That is 3–5% of
the cap.

*And that is not the point.* **An escrow's component count is monotone by construction** — it
never evicts, so every version anything ever resolved stays forever. A cap on a monotone counter
is not a limit, it is a countdown; the only open question is the rate. Worse, **the enforcement
behaviour is precisely inverted for this use case**: on the day you cross it, the escrow silently
stops capturing new dependencies while continuing to serve old ones — it *looks* healthy and has
stopped doing the one job. A check that stopped running, wearing the face of one that passed.

**And the number is not yours.** Sonatype **cut it from 100,000/200,000 to 40,000/100,000 in
3.87.0 (2025-12-02)**, justified in the release notes only as *"to better align with our goals"*
**[metered]**. `sonatype/nexus-public#883` asks why and was **open with no maintainer response** at
retrieval **[metered]**. A store whose capacity ceiling a third party can halve unilaterally and
without explanation fails the exit test in §1 by construction: **you cannot route around your own
escrow's vendor.** That is the appointed-hub shape, not the oracle shape.

*(A related defect worth knowing: `nexus-public#736` reports that **failed requests count toward
the daily request limit**, which makes the cap trivially exhaustible by hammering nonexistent
paths **[metered — issue exists; the behaviour itself is unverified by me]**.)*

**(c) Immutability was not found.** Searching Sonatype's docs surfaced **no first-class artifact
or blob immutability feature** **[consistent with — absence of evidence, and I did not find a doc
saying it is unsupported]**. The adjacent features are read-only mode (an ops state for backups),
and Pro-only staging/promotion and component tagging. **Do not assume "published artifacts can
never be overwritten" is enforceable in CE.** That is the nation-state half of the requirement,
unmet.

**Two operational notes.** Sonatype's own single-instance Helm chart is **archived** — *"As of
October 24, 2023, we will no longer update or support the Single-Instance OSS/Pro Helm Chart"*
**[metered]**; the maintained path is the community `stevehipwell/nexus3` chart (5.25.1 tracking
Nexus 3.95.1) **[metered]**, so the *vendor* supports only a Pro-HA chart. And the smallest
documented profile is **8 GB RAM / 2 CPU with Java 21**, with **≥4 GB free disk at all times or
the database drops to read-only** **[metered]**.

**One more instance of the §5 pattern, and it is worth naming.** Sonatype's CE *download page*
shows a comparison table in which **"Unlimited Components and Transactions" is checked for
Community Edition** — flatly contradicting the 40,000-component limit in Sonatype's own docs and
release notes **[metered]**. Twice in two vendors, the marketing surface and the documentation
surface disagree, in the same direction. **Score licensing from docs and release notes, never
from a comparison table on a product page.**

**Verdict: the best format coverage available, and the worst fit for the word "escrow."** It stays
on the table for the language/OS half in §9 precisely because the alternatives there are worse —
but it should be adopted with the cap understood as a countdown and the licence understood as
proprietary.

***

## 7. Harbor — one binary, two products, and only one of them is an escrow

Harbor is **Apache-2.0, CNCF graduated**, and the chart is healthy: `helm.goharbor.io` serves
chart **1.19.2 / appVersion 2.15.2, created 2026-08-03** — 23 days old at time of writing —
verified by fetching the chart repo's own `index.yaml` **[metered, 2026-08-26]**. No usage caps,
no EULA, no component ceiling.

Its format coverage is narrow and honest: **OCI artifacts and OCI-packaged Helm charts.** It does
not speak the npm, PyPI, Maven or apt wire protocols, so `npm install` cannot point at it
**[consistent with]**. Harbor solves channel 1 and part of channel 9 in §3, and nothing else.

Everything else about it turns on which of two features you use, and this is the section that
justifies the whole document.

### 7a. The proxy cache is a cache, by documentation, by default, and irreparably

All quotes verbatim from `goharbor/website` `main`,
`docs/administration/configure-proxy-cache/_index.md`, retrieved **2026-08-26** **[metered]**:

> *"If the target registry is not reachable, the proxy cache project serves the cached image."*
>
> **"If the image is no longer in the target registry, no image is served."**
>
> *"By default, Harbor creates a 7 day retention policy for each new proxy cache project."*
>
> *"you are not able to push images to a proxy cache project"*

Read those four together and the proxy cache's disposition is unambiguous:

1. It survives a **network outage** — upstream unreachable, cache served. Good.
2. It **does not survive a deletion**. Upstream 404 ⇒ *"no image is served"*, with your bytes on
   disk. **This is the time attack, and the proxy cache implements it rather than defending
   against it.** Applied to §2: all eight already-404 images would be unservable from a Harbor
   proxy cache today.
3. It **evicts by default at 7 days**, so even the network-outage protection is bounded by a
   window nobody set deliberately.
4. You **cannot push into it**, so you cannot promote a cached artifact to permanence in place.

There is no configuration that fixes (2). It is not a retention setting; it is how the feature
decides what to serve. **A Harbor proxy cache cannot be made into an escrow.**

This is the single most valuable operational fact in the report, because "Harbor proxy cache" is
the answer a search for *"self-hosted pull-through cache for containers"* returns, it is what the
phrase in Aaron's own sentence points at, and it is wrong for the purpose he named.

### 7b. The escrow configuration, which is a different feature

**Scheduled pull-mode replication into a normal project, plus tag immutability, plus no retention
policy.** Verbatim from Harbor's docs, retrieved 2026-08-26 **[metered]**:

- Replication supports **pull-based** mode from an upstream (Docker Hub, GHCR, quay, ECR, GCR,
  ACR, Artifactory, Harbor) on a **scheduled cron** trigger, with repository and tag filters.
- **"Deletion operations are not replicated"** under manual and scheduled triggers. ⇒ **upstream
  deleting an artifact does not delete your copy.** *This is the escrow property, stated by the
  vendor.* (Event-based replication *does* offer optional deletion propagation — so **the trigger
  choice is load-bearing and event-based is the wrong one.**)
- Tag immutability: **"an immutable tagged artifact cannot be deleted, and also cannot be altered
  in any way such as through re-pushing, re-tagging, or replication."** ⇒ a later replication run
  **cannot overwrite** an immutable tag. *This is the nation-state property*, and note it names
  replication explicitly.

Plus, unchanged from the general product: Trivy scanning, Cosign/Notation signature storage, and
content-addressed OCI storage in which the digest *is* the identity.

The cost of 7b over 7a is real and should not be glossed: replication is **eager** (you enumerate
what to mirror in advance and pull it on a schedule) where proxy cache is **lazy** (it mirrors
what you happened to ask for). Eager is more configuration and more storage. **It is also the only
one of the two that is an escrow**, and the enumeration is not burdensome here because
`image-footprint.measured.json` **already contains the exact list of 129 images** — the filter set
can be generated from a file that exists **[consistent with]**.

### 7c. The open questions on Harbor, stated rather than assumed

1. **Does an immutability rule protect an artifact from a retention policy? — probably yes, and
   the evidence is not in the documentation.** Harbor's retention docs say *"any tags in a
   repository that are not identified as being eligible for retention are discarded"* **[metered]**
   and say nothing about immutable tags; the immutability docs say nothing about retention.
   **Both pages are silent about the other** **[metered — the silence is verified]**. The answer
   exists only in an **open, unmerged** pull request against the experimental `harbor-next` branch,
   which states the current behaviour in order to change it: *"Currently, **immutability overrides
   retention policy**, making it impossible to delete tags once they are marked immutable even if a
   tag retention policy says they should be deleted"* (goharbor/harbor#22047, `needs/proposal`)
   **[consistent with — a maintainer-adjacent statement of current behaviour, in a PR that is not
   merged and could change it]**.

   That is the answer an escrow wants, and note the shape of it: **the guarantee this
   recommendation rests on is documented nowhere, and is currently classified as a defect
   somebody has opened a PR to remove.** It also carries a consequence worth stating — if
   immutability truly overrides retention, then **there is no supported way to delete an immutable
   artifact except by turning immutability off first.** That is correct for an escrow and
   surprising for an operator.
   **The pre-adoption test in §9 step 4 stands unchanged** — a PR body is a statement about
   intent, and this repo's standing discipline is that an anchor must be *checked*, not cited.

   A second, related finding: **Harbor's 7-day proxy-cache retention policy may not be removable
   at all.** goharbor/harbor#16776, *"Ability to disable default retention policy for proxy
   projects"*, has been **open since 2022-04-28**, its reporter *"surprised when tons of cached
   images were removed by GC"* **[metered — the issue and its age are verified; whether the policy
   can be edited today is not]**. Four years open is itself the signal.

1b. **Harbor's backup tooling excludes the topology this recommendation proposes.** The official
   procedure is Velero, and its own caveats are explicit: **"Backups of external databases are not
   supported"** / *"Only backups of the Harbor internal database is supported"*, Redis is not
   backed up, and *"The data in memory is lost during the backup"* **[metered, verbatim,
   2026-08-26]**. Since §9 proposes backing Harbor with the **existing external MinIO**, the
   tooled path does not cover it. This is not fatal — object storage is backed up as object
   storage, and PostgreSQL as PostgreSQL — but *"backed up as rigorously as our database"* is the
   bar Aaron set, and **the vendor's turnkey answer does not reach it.** Pulp has the identical
   gap (§8), which suggests it is a property of this software category rather than of Harbor.
2. **Governance.** Every maintainer email in the Harbor chart's `index.yaml` is `@broadcom.com`
   **[metered, 2026-08-26]**. Harbor is CNCF-graduated and Apache-2.0, so the code cannot be
   withdrawn — exit is preserved by the licence. But single-vendor stewardship is a real signal
   given that vendor's recent licensing history, and it belongs in Aaron's decision (§12), not in
   a footnote where it looks handled. Note this is a *fact about the maintainer list*, not an
   attribution of intent — §"never assume malice."

***

## 8. The rest of the field

**Pulp 3 — the runner-up, and on the escrow properties specifically it BEATS the recommendation.**
This entry was revised upward after a second verification pass; the first draft under-scored it on
a stale prior, and the correction is recorded rather than quietly applied.

*Retention — Pulp is the only candidate that deletes nothing on its own.* `retain_repo_versions`
defaults to null, and *"By default, `retain_repo_versions` is null which means that Pulp will store
all versions of a Repository"* **[metered, verbatim]**. `ORPHAN_PROTECTION_TIME = 1440` reads like
an eviction timer and **is the opposite** — a 24-hour guard that makes deletion *harder*, gating
content from becoming a candidate for an orphan-cleanup task that **must be triggered by hand**
(`POST /pulp/api/v3/orphans/cleanup/`). A maintainer confirms there is no scheduler: *"You are
reading correctly. The `ORPHAN_PROTECTION_TIME` behaves different from the others… so yes, this
sounds pretty much like a feature request"* (pulpcore#6099) **[metered]**. And the project treats
this as a rule rather than an accident — pulpcore#5363: *"Deleting content or artifacts outside of
orphan cleanup is breaking the rules. And no, we cannot get away with that."* **[metered]**
**Deleting anything is two deliberate steps, both human-initiated.** That is the escrow disposition
by default, which is exactly what Harbor and zot do not have.

*Immutability — upgraded from `consistent with` to metered.* *"Each time the content set of a
repository is changed, a new **immutable** `RepositoryVersion` is created"*; versions can be
created and deleted, never edited **[metered, verbatim]**. And the content-addressing claim I
declined to promote in the previous revision **is** confirmed, in code rather than prose: sha256
determines the storage path (not the filename), equality is by digest, `before_save()` validates
checksums, and **sha256 cannot be removed from `ALLOWED_CONTENT_CHECKSUMS`** **[metered — verified
in source]**. *Named limit that survives: there is no scrub/fsck story and no published integrity
guarantee, so **bit-rot is the operator's problem** — which matters for a store whose whole purpose
is to hold bytes for years.*

*Plugin maturity — my "uneven" was right in general and wrong in two specifics.* `pulp_maven` is
**proxy-only, confirmed in code** (its viewset has `add_cached_content` and `repair_metadata`, and
**no `sync` action**) — so there is no bulk pre-seed of Maven Central, only the closure you pulled.
But **`pulp_npm` was my stale prior**: dormant 2022–2025, then real releases through **0.10.1 on
2026-08-25** with a working sync task — young and active, not abandoned. `pulp_rpm`, `pulp_deb`,
`pulp_container`, `pulp_python` and `pulp_gem` are all Production/Stable with full sync.

*The two facts that keep it out of step 1.* **`pulp_nuget` does not exist officially** — there is
only a personal repository — and this repo has **37 NuGet pins across 48 projects** (§3), so
Pulp cannot cover channel 3 at all. And its Kubernetes story is worse than "an operator instead of
a chart": the Helm chart lives in `pulp/pulp-k8s-resources`, carries **"This installation method is
still under development!"**, installs the operator rather than Pulp, and the operator's own README
says **"Pulp Operator is in beta stage and under active development"** **[metered]**. The
documented k8s quickstart is `git clone` + `make deploy`. **There is no install path the project
itself presents as production-hardened**, which is disqualifying for *step 1* and not for the
programme.

*Two further findings to carry into any adoption.* Its backup tooling has **the identical gap as
Harbor's**: `PulpBackup` states that files in object storage *"will **not** be copied"* and that
*"the current version of the Operator does not execute backups of external PostgreSQL instances
yet"* **[metered]**. And the licence is genuinely ambiguous — `pyproject.toml` declares
`GPL-2.0-or-later`, **the LICENSE file is bare GPLv2 (1991) with no "or later" grant**, and
GitHub's detector reports `GPL-2.0` (v2-only) **[metered — all three verified; per-file headers
not audited]**. Harmless for internal use; **name it to counsel before anything is distributed.**

**Zot — disqualified, and on precisely the property this document exists to test.** Apache-2.0,
CNCF **Sandbox** (not graduated), OCI-native; chart `0.1.122` / appVersion `v2.1.18`, created
**2026-07-13** **[metered, 2026-08-26]**. The first draft called it "narrow but excellent." That
was wrong, and the reason is the retention column:

> **zot garbage-collects by default.** `GC: true`, `GCDelay: 1h`, `GCInterval: 1h` in its defaults
> **[metered — verified in source]**, and its docs say *"if `retention` is not configured, garbage
> collection deletes all untagged manifests which are not referenced by indexes or artifacts after
> the `gcDelay` passes"* and *"By default, if no retention policies are defined, all untagged
> manifests are deleted"* **[metered, verbatim]**.

Tagged content is safe. **Content referenced only by digest — which is exactly how a
content-addressed escrow refers to things — is deleted about an hour after it is pushed.** This is
not theoretical: zot#4148 reports images *"actively being pulled get evicted and immediately
re-synced… There is no configuration that prevents this, because retention rules apply to tags
only"* **[metered]**. Two further traps: **the shipped Helm chart config does not set `gc`**, so a
default install runs with deletion on; and defining any `keepTags` policy **flips tags from
default-keep to default-delete**. Its immutability is *"not… an explicit configuration flag"* but
an ACL convention — withhold the `update` action — which any admin principal or config edit lifts
**[metered, verbatim]**. Add that `zot-minimal` **excludes the sync and scrub extensions
entirely**, and that syncing Docker-format images **changes the manifest digest** unless
`preserveDigest` and `http.compat` are both set — *"digest-pinned pulls… and verifiable signatures
will not work as expected"* **[metered, verbatim]**.

*It is recoverable* — set `gc: false` — but a candidate whose default configuration silently
deletes digest-addressed content, whose immutability is a convention, and whose sync path can
change a digest is the wrong substrate for a store built on digests. **The "minimal" framing also
does not survive measurement**: the project publishes no RAM or CPU figures at all, its own
reference systemd unit sets `MemoryMax=32G`, and `zot-minimal` has grown 2.5× in twenty months
(32.1 MB → 81.9 MB) **[metered]**. "Minimal" in zot's vocabulary means fewer dependencies, not a
small process.

**Gitea / Forgejo package registry — eliminated on the property nobody notices.** The format list
is genuinely long — **Gitea 23 formats** (Alpine, Arch, Cargo, Chef, Composer, Conan, Conda,
Container, CRAN, Debian, Generic, Go, Helm, Maven, npm, NuGet, Pub, PyPI, RPM, RubyGems, Swift,
**Terraform**, Vagrant), **Forgejo the same set plus ALT and minus Terraform** **[metered, both
projects' own docs, 2026-08-26]** — and the charts are healthy: Gitea chart **v12.7.0**
(appVersion 1.27.2), Forgejo chart **v17.1.5**, though the latter's appVersion **15.0.7 lags
Forgejo's current 16.0.3** **[metered]**. Licences differ and the difference has a date: Gitea is
MIT; **Forgejo relicensed to GPLv3 at v9.0 (Oct 2024)**, so ≤v8.0 is MIT and ≥v9.0 is GPLv3+
**[metered]**.

But **these registries are push-only: you upload artifacts to them, they do not proxy an
upstream** — and this is now confirmed by the feature request rather than only by absence.
**`go-gitea/gitea#21223`, "Support proxy registries for each package type", has been open since
2022-09-20**, last updated 2026-05-18, and its body cites Artifactory's remote/virtual repositories
as the model; a container-specific duplicate (#26756) was closed as such **[metered]**. **Roughly
four years open and unimplemented** is a stronger signal than a silent doc. *(Gitea's "repository
mirrors" are git-repo mirroring, a different feature — do not read it as package proxying.)* Its immutability is the weak kind, and its own docs are clear about which:
*"You cannot edit a package after you have published it in the Package Registry. Instead, you must
delete and recreate it"* **[metered, verbatim]** — no overwrite, but deletion is permitted, so it
does not resist an operator error or a compromised token the way a Harbor immutability rule does. A
push-only registry can be *made* into an escrow by mirroring into it, but every ecosystem needs
its own bespoke mirroring job, which is strictly more work than Pulp or Nexus doing it natively.
**Separately: `forgejo/Application.yaml` is already in this tree as the standby half of an
either/or pair with GitLab**, so adopting it as the escrow would entangle the escrow decision with
the Git-host decision. Two decisions, one lever — refuse.

**A candidate class neither list contained: one small proxy per ecosystem.** Verdaccio for npm
(chart `4.33.1` / appVersion `6.9.2`, verified **[metered, 2026-08-26]**), devpi for PyPI, Athens
for Go, apt-cacher-ng for Debian. Each is small, open, and single-purpose, and the composition is
maximally scale-free — no single product holds every format, so no vendor holds you. **It is also
N products to deploy, monitor, back up and prove retention on**, and the escrow's guarantee is
only as strong as the weakest one's disposal rules. **Recommended as the fallback if the §9
language/OS decision deadlocks**, not as the opening move.

**GitLab is already deployed here and has a container registry and a package registry** — worth
naming so nobody discovers it later and asks why it was ignored. It is not proposed: its registry
is push-oriented rather than a pull-through escrow, and the GitLab Application is *already* the
heaviest thing in this tree (76 GiB in the sibling `infra/` deployment, per its own manifest
**[metered]**). Making the escrow a GitLab feature couples the two hardest-to-move decisions in
the cluster.

***

## 9. Recommendation, and the migration path

Aaron said *"we don't have to get it perfect first time."* So this is a starting point with a
stated path, not an architecture.

**Step 1 — Harbor, escrow configuration, container/OCI/Helm only.**
`full-ai-cluster/k8s/applications/harbor/Application.yaml`, chart `helm.goharbor.io` pinned at
**1.19.2**, **manual-sync** (§11) until the retention behaviour is proven. Backed by the existing
MinIO S3 blob store, not a new PVC. This buys the largest share of the exposure measured in §2 —
**129 images, all 8 of the already-404 artifacts, the 429, and ~75 GiB of the footprint** — with
the only free, open, uncapped, actively-maintained option in the field.

**Step 2 — the escrow configuration is a lint, not a runbook.** The falsifier from §1 says an
escrow you cannot check is a cache. So the first code to write is not the manifest; it is a check
in `src/Core.TypeScript/cluster/` that refuses:
- a Harbor project of type **proxy cache** (7a is a cache, and using it under this name is the
  defect this document exists to prevent),
- a replication rule with an **event-based** trigger or with deletion propagation enabled,
- any **retention policy** on an escrow project,
- an escrow project without an **immutability rule**.
This is the same shape as `manual-sync-policy.ts` and `audit-proof-lineage-binaries.ts`: intent
that lives only in a comment is indistinguishable from someone forgetting.

**Step 3 — generate the replication filter set from the file that already has it.**
`image-footprint.measured.json` holds the 129 pinned references. The escrow's mirror list should
be **derived** from it rather than hand-maintained, so a new image in the cluster cannot be
outside the escrow silently.

**Step 4 — the pre-adoption test that decides whether step 1 was real** (§7c question 1): push an
artifact into a test project, apply an immutability rule, apply a retention policy that excludes
it, run retention, and check whether the artifact survives. **If immutability does not beat
retention, the escrow guarantee is unproven and the configuration must change.** Do this before
any dependency relies on it.

**Step 5 — the language/OS half, as a SEPARATE decision.** It is separate because it has no good
answer and should not hold up the half that does. §12 states the choice.

**Step 6 — channels 10 and 11 (mise toolchains, Nix), as a third decision.** Nix has a clean
shape (S3 substituter on the MinIO that already exists). mise does not, and a generic/raw proxy is
the honest placeholder.

**Migration path if Harbor is later wrong:** the escrow's contents are OCI artifacts addressed by
digest, and `skopeo sync` / `oras cp` move them between any two OCI registries without
re-fetching upstream. **The exit cost from Harbor to `pulp_container`, a plain distribution
registry, or anything else OCI-native is low and does not depend on Harbor's cooperation**
**[consistent with]**. That property is why starting imperfectly is safe here, and it is worth
preferring an OCI-native store partly *for* it. *(zot would have been the obvious sibling here and
is not — §8.)*

***

## 10. The strongest counter-argument, and the exit test

**The counter-argument, stated at full strength:** *this recommendation deploys a new stateful
service, with a database, a Redis, an object-store dependency and ~6 pods, into a single-node
cluster that already carries 54 Applications and cannot fit the 33 it applies (§11) — in order to
defend against an event that has happened once, and whose actual mitigation (repointing four image
references at `bitnamilegacy`) took one commit. The escrow is more moving parts than the failure
it prevents, and every moving part is itself a dependency that can fail.*

That argument is good, and two things answer it without dismissing it.

First, **the failure did not happen once**; it happened to **15 of 129 pinned images**, in three
different ways, and the mitigation for the largest group is an archive the vendor *"reserves the
right to remove"* — i.e. the current state is not fixed, it is deferred.

Second, and more important: **the counter-argument is correct that the escrow must not become a
dependency**, which is exactly the exit requirement, and it converts into a test:

> **If the escrow is down, can CI still build?**

**The answer must be yes, and it must be yes by construction rather than by intention.** The
mechanism is that every consumer keeps its upstream as a fallback rather than being repointed:
`containerd` mirror configuration with the escrow first and the upstream second, `.npmrc` /
`NuGet.config` with the escrow as a *primary* source and upstream retained, apt with the escrow as
the first of two sources. **Never** a configuration in which the upstream line is deleted.

This is the appointed-hub discriminator from
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` applied literally: *concentration
is fine, enforcement is not.* An escrow everyone uses because it is faster and closer is an
oracle. An escrow builds *must* traverse is a hub, and it has made the supply chain **less**
robust by adding a single point of failure in front of many redundant ones.

**And it is checkable**, which is what keeps it from being a sentiment: bring the escrow down and
run a build. That test is the acceptance criterion for step 1, and a green build with the escrow
stopped is the artifact that proves the exit is real. `.claude/rules/clone-at-tag-stays-sufficient.md`
is the standing form of the same requirement — *the repo stays buildable from `git clone` at a
pinned tag with no package manager present, permanently, never "transitionally."* An escrow is
exactly the kind of good tool that becomes a mandatory one if nobody writes the test.

***

## 11. Sizing, and the ArgoCD fit this tree actually requires

**Storage.** The container half is measurable today and the rest is not, so both are stated
rather than one being used to imply the other.

| | measured | source |
| --- | --- | --- |
| 129 pinned images, **compressed** | **28.09 GiB** | `image-footprint.measured.json` **[metered]** |
| same, ×2.67 uncompressed ratio | **~75.0 GiB** | same file's own ratio **[metered]** |
| — and that ratio is a **known over-estimate** | hindsight measured **1.77×**, vllm **2.35×** | the file says so **[metered]** |
| language/OS packages, snapshot | ~1–3 GiB | 222 MB `node_modules` + 561 MB `.deb` + … **[speculative]** |

A registry stores **compressed** layers, so **28.09 GiB is the right number for the escrow's disk**
and 75 GiB is what it costs a *node* to unpack. Then two multipliers apply and neither is
optional for an escrow:

- **Versions accumulate forever.** Today's 28 GiB is one snapshot; the escrow keeps every
  superseded tag. **Growth is monotone by design** — that is the definition, not a defect.
- **Multi-arch.** If arm64 and amd64 are both mirrored, roughly double.

**A defensible opening allocation is 250–300 GiB, and the assumption is stated because it is not
measured: ~10× the current snapshot, which buys roughly 2–4 years of accumulation at this repo's
observed pin-churn** **[speculative — the churn rate was not measured, and it is the number that
decides whether 300 GiB is two years or ten]**. Measuring it is cheap (`git log` over
`image-footprint.measured.json` and the lockfiles) and should precede the final number.

**This does not fit the existing storage anywhere.** MinIO's `blob-store` PVC is **20Gi standalone**
(`minio/Application.yaml` **[metered]**) — smaller than the compressed image set alone. The
storage-profile ladder's active rung, `measured`, **provisions 467 GiB at bring-up against a 967
GiB declared total** **[metered]**, so a 250–300 GiB escrow is a *large* new claim on a
single-node deployment, not a rounding error. **Storage is the binding constraint on this
recommendation, and it is the most likely reason for Aaron to say no.**

**What a new Application must satisfy in this tree** — surveyed, not assumed:

1. **`full-ai-cluster/k8s/applications/<name>/Application.yaml` at depth 1.** The root app-of-apps
   (`k8s/bootstrap/root-application.yaml`) recurses with
   `include: '{*/Application.yaml,Application.yaml}'`, and — per `app-of-apps-discovery.ts` —
   ArgoCD's `*` is **not** path-segment bounded, so deeper files *are* discovered by ArgoCD but are
   **invisible to this repo's own roster checks**. Depth 1 or the app is deployed and unasserted.
2. **`argocd.argoproj.io/sync-wave`.** Storage is −15 (longhorn), object-store −5 (minio),
   platform apps 30. An escrow needs its blob store first.
3. **Manual-sync requires a machine-readable declaration**, not a comment:
   `zeta.io/sync-policy: manual` + `zeta.io/sync-policy-reason` (`manual-sync-policy.ts`). Omitting
   `automated` without them is counted as a contract failure, not a decision.
4. **`repoURL` / `chart` / `targetRevision` must stay on adjacent lines** — `storage-profiles.ts`
   probes ±3 lines from `chart:` and **returns `""` rather than failing** when it cannot find the
   pin, so a comment wedged between them silently unpins the app from the resource catalogue
   (`forgejo/Application.yaml` records this).
5. **A PVC needs a row in `storage-profiles.json`** carrying `pods`, `podsSource`, `podsEvidence`,
   and `governors`/`governorEvidence` — and for an escrow **the governor row is the interesting
   one**: the honest entry is *"no eviction governor exists, by design"*, which is precisely the
   escrow property written where a checker can read it.
6. **Resource requests must be measured** by `helm template` at the pinned version against the
   Application's own `valuesObject`, not read off chart defaults — the file records a case where
   chart-default numbers carried 6 GiB for a subchart that was disabled.
7. **The images it renders get measured** by `image-footprint.ts` / `image-source-provenance.ts`.
   Pleasingly recursive: **the escrow's own images become rows in the file that measures how
   exposed the cluster is to upstream** — and until the escrow mirrors itself, it is exposed too.

**Footprint estimate:** Harbor at chart defaults is core, jobservice, portal, registry, trivy,
redis and PostgreSQL — **~6–8 pods** — and the honest statement is that its
`resources.requests` were **not** measured here, because doing it properly means `helm pull` +
`helm template` against a `valuesObject` this document deliberately did not write. It is a
step-1 task, and the tree's own convention (point 6) is that an unmeasured number does not go in
the catalogue. **[unverified — stated as absent rather than estimated]**

***

## 12. What Aaron must decide

Five decisions. Only the first two block anything.

**1. Is the escrow's job to serve deleted upstreams — yes or no?** Everything follows from this,
and it is genuinely a choice rather than an obvious yes. **Yes** ⇒ Harbor proxy cache is
eliminated (§7a), the answer is replication + immutability, and the cost is eager configuration
and monotone storage. **No** ⇒ a proxy cache is fine, this is much cheaper, and the word
*escrow* should be dropped, because a cache called an escrow is worse than a cache called a cache.
*My read of his own sentence — "backed up as rigorously as our database … defense against time and
nation state attacks" — is an unambiguous yes, but he named the pattern and he should confirm the
reading.*

**2. Which constraint do we accept on the language/OS half?** There is no free, open, unlimited,
polyglot pull-through. Pick the poison:

| option | what you accept |
| --- | --- |
| **Nexus CE** | proprietary EULA, mandatory telemetry, a **40k-component cap the vendor halved once** and can halve again — but it is the **only** option covering NuGet |
| **Pulp 3** | the **best escrow semantics in the field** (nothing auto-deletes, immutable versions, sha256-addressed) — but **no official NuGet plugin at all**, Maven proxy-only, and **no install path its own project calls production-ready** |
| **per-ecosystem proxies** | fully open and maximally scale-free, but **N services** to deploy, back up and prove retention on |
| **defer it** | ship the container half now; the language/OS half stays unescrowed for a while |

**The NuGet gap is what makes this genuinely hard, and it was not visible in the first draft.**
This repo has **37 NuGet pins across 48 C#/F# projects** (§3), and **Pulp has no official NuGet
plugin** — only a personal repository. So the option with the best escrow properties cannot cover
one of our largest ecosystems, and the option that covers everything is the one with the
vendor-adjustable cap. That is a real trade with no dominant choice, which is why it is Aaron's.

*My read: **defer**, then **Pulp for rpm/deb/PyPI/npm plus something else for NuGet** — probably
Nexus scoped to NuGet alone, where 37 packages sit nowhere near a 40,000 cap, or a plain NuGet
`v3` static feed, which is simple enough to be worth pricing before assuming a product is needed.
But someone who weights "one product, everything works today" above "no vendor-adjustable cap"
would rationally pick Nexus for the whole half, and that is not a wrong answer.*

**3. Storage.** ~250–300 GiB on a single-node deployment whose active profile already provisions
467 GiB (§11). This is the most likely no, and if it is a no, the escrow scope should shrink to a
mirrored *subset* — the 15 unresolvable images and their neighbours — rather than being abandoned.

**4. Broadcom stewardship of Harbor** (§7c). Apache-2.0 and CNCF graduation mean the code cannot
be withdrawn, so this is a maintenance-velocity risk, not a capture risk. Flagged because it is
the kind of thing that should be an explicit accepted risk rather than a surprise.

**5. Does the escrow get its own backup, or does it ride `zeta-backups`? — and note that neither
vendor's tooling reaches the stated bar.** *"Backed up as rigorously as our database"* is what
Aaron set, and the cluster has a `zeta-backups` bucket on MinIO already. Two things make this a
real decision rather than a checkbox:

- **An escrow backed up onto the same single node it runs on is not backed up.** It is a second
  copy of the same disk, and the failure that takes the escrow takes the backup. Off-node or
  off-site is what the bar actually requires, and nothing in this cluster does that today.
- **Both candidates' turnkey backup paths explicitly exclude external databases and object
  storage** — Harbor's Velero procedure says *"Backups of external databases are not supported"*,
  and Pulp's `PulpBackup` says object-storage files *"will not be copied"* **[metered, both]**.
  Since the recommended topology uses the external MinIO, **the vendor answer covers none of the
  actual bytes.** The escrow's backup has to be built out of ordinary object-storage and
  PostgreSQL backup, which is entirely doable and is *more* work than a runbook line implies.
Off-node or off-site is what the stated bar actually requires, and nothing in this cluster does
that today.

***

## 13. What I could not verify

Stated rather than guessed, per the brief.

1. **Harbor immutability vs retention** (§7c) — **partially resolved, and by a source that is not
   documentation.** An open, unmerged PR states that immutability currently overrides retention;
   both doc pages remain silent. §9 step 4 remains the test, and it is the single most important
   unverified item in this document because the recommendation rests on it.
2. **Whether Harbor's 7-day proxy-cache retention policy can be removed at all** (§7c) — the
   feature request to disable it has been open since 2022. Not decisive for the recommendation,
   since §9 does not use proxy cache, but decisive for anyone who tries to.
3. **Harbor's measured resource requests and true storage overhead** (§11) — not rendered, because
   doing it properly needs a `valuesObject` that selection should not invent. The published
   minimums (2 CPU / 4 GB) are for the Compose installer; **no Helm-specific minimum is published**.
4. **Nexus artifact/blob immutability** (§6c) — no feature found; also no doc saying it is
   unsupported. Absence of evidence.
5. **Artifactory OSS's actual licence text** (§5) — no JFrog-primary page states it. AGPL-3.0 per
   several secondary sources. Does not change the outcome.
6. **Pulp's licence** (§8) — three primary sources disagree (`GPL-2.0-or-later` in metadata, bare
   GPLv2 in LICENSE, `GPL-2.0` from GitHub's detector). **Per-file headers were not audited.**
   Irrelevant internally; a counsel question before distribution.
7. **Pulp's maintenance guarantees** (§8) — four older Z-streams still receive backports, but no
   page states which branches are supported or until when. Red Hat's CRA declaration lists Pulp as
   a **"Light Steward"**, explicitly the *lower* of two tiers — a governance signal, not a defect.
8. **Gitea/Forgejo push-only** (§8) — now strongly corroborated by a four-year-open feature
   request, but still a negative claim: **Forgejo-side issues were not exhaustively enumerated**,
   and per-format overwrite semantics were not verified.
9. **This repo's dependency-churn rate** (§11) — the number that turns 250–300 GiB into a
   defensible horizon rather than a guess. Cheap to measure; not measured here.
10. **Nexus `#736`** (failed requests counting toward the cap) — the issue exists; the behaviour
    was not reproduced.
11. **The ~1,200–1,800 component estimate** (§6b) — each named count is measured; the total is an
    estimate and the apt component count in particular is a guess.

**A note on method, because it changed two conclusions.** Three version claims in this document
were wrong on first reading and were caught only by checking each project's **API** against its
rendered release page: Harbor's chart is **v1.19.2** where the release page title reads "Harbor
v2.15.2", and zot's published chart `appVersion` is **v2.1.18** where its install docs say
v2.1.20. **Rendered release pages are unreliable for version extraction.** More substantively,
this section's §8 entries for Pulp and zot were both **materially wrong in the first revision** —
Pulp under-scored on a stale `pulp_npm` prior, zot scored as "narrow but excellent" when its
defaults delete digest-addressed content within the hour. Both were corrected by a second
verification pass, and the corrections are recorded in place rather than silently applied.

***

## 14. Register summary

| claim | register |
| --- | --- |
| 15 of 129 pinned images unresolvable; 8 gone (§2) | **metered** — `image-footprint.measured.json`, 2026-08-22 |
| Bitnami withdrawal forced edits to two Applications (§2) | **metered** — recorded in both manifests, 2026-08-23 |
| Artifactory OSS excludes Docker/npm/PyPI (§5) | **metered** — JFrog docs matrix, verbatim, 2026-08-26 |
| Artifactory Pro X from $27,000/yr (§5) | **metered** — jfrog.com/pricing, 2026-08-26 |
| Nexus CE is a proprietary EULA; EPL core is maven/raw/apt only (§6a) | **metered** — nexus-public README + EULA, 2026-08-26 |
| Nexus CE cap 40k/100k, cut from 100k/200k in 3.87.0 (§6b) | **metered** — Sonatype release notes, 2026-08-26 |
| Nexus marketing page claims "unlimited components" (§6) | **metered** — contradicts vendor docs, 2026-08-26 |
| Harbor proxy cache serves nothing when upstream deletes (§7a) | **metered** — goharbor/website, verbatim, 2026-08-26 |
| Harbor creates a 7-day retention policy on proxy projects (§7a) | **metered** — same source, verbatim |
| Scheduled replication does not propagate deletions (§7b) | **metered** — Harbor replication docs, 2026-08-26 |
| Immutable tags resist re-push, re-tag and replication (§7b) | **metered** — Harbor immutability docs, 2026-08-26 |
| Chart versions: harbor 1.19.2, zot 0.1.122, gitea 1.27.0, verdaccio 4.33.1 | **metered** — fetched from each chart repo's `index.yaml`, 2026-08-26 |
| Pulp repository versions are immutable (§8) | **metered** — pulpcore docs, verbatim, 2026-08-26 |
| Pulp artifacts are sha256-addressed; sha256 not removable (§8) | **metered** — verified in pulpcore source |
| Pulp orphan cleanup is manual-only; nothing auto-deletes (§8) | **metered** — settings + maintainer statement, pulpcore#6099 |
| Pulp has no official NuGet plugin (§8) | **metered** — absent from the canonical plugin list |
| Pulp k8s chart/operator self-declared beta (§8) | **metered** — verbatim from the chart page and operator README |
| Harbor immutability overrides retention (§7c) | **consistent with** — open unmerged PR #22047, not docs |
| Harbor Velero backup excludes external DB and S3 (§7c) | **metered** — Harbor backup doc, verbatim |
| Pulp backup excludes object storage and external PostgreSQL (§8) | **metered** — operator doc, verbatim |
| zot GC is on by default and deletes untagged manifests (§8) | **metered** — zot defaults in source + docs, verbatim |
| zot immutability is an ACL convention, not a feature (§8) | **metered** — zot docs, verbatim |
| Gitea packages cannot be edited after publishing (§8) | **metered** — docs.gitea.com, verbatim, 2026-08-26 |
| Gitea/Forgejo package registries are push-only (§8) | **consistent with** — corroborated by gitea#21223, open since 2022 |
| Gitea 23 formats incl. Terraform; Forgejo swaps in ALT (§8) | **metered** — both projects' docs, 2026-08-26 |
| Forgejo relicensed MIT → GPLv3 at v9.0 (§8) | **metered** — LICENSE at HEAD + release post |
| Harbor cannot serve npm/PyPI/apt wire protocols (§7) | **consistent with** |
| mise and Nix are uncovered by every candidate (§3) | **metered** for the pins; **consistent with** for the coverage gap |
| ~250–300 GiB opening allocation (§11) | **speculative** — churn rate unmeasured |
| ~1,200–1,800 total components (§6b) | **speculative** — component counts metered, total estimated |
| Exit cost from Harbor is low via `skopeo sync` (§9) | **consistent with** |

***

## 15. Anchors (Beacon)

- **Escrow as a pattern** — the maintainer's own Itron prior art: *"we called the local pull
  through cache 3rd party dependency escrow and was backed up as rigorously as our database."*
  The naming is his; this document's contribution is only that the *retention policy*, not the
  product, is what makes the name true. Per `.claude/rules/cleanroom-two-team-separation.md`
  nothing here derives from Itron code — the pattern is a requirement, and requirements travel.
- **Software escrow**, the older commercial practice (source deposited with a third party against
  vendor failure), which this inverts: the deposit is *artifacts*, held by *you*, against *upstream*
  failure.
- **The time attack, named instances** — MRAN / CRAN Time Machine's retirement taking every
  `checkpoint()` call with it; `left-pad` (2016); and, in this repo and this month, the Bitnami
  free-catalogue withdrawal (§2).
- **Content addressing as the integrity mechanism** — Merkle (1979); the OCI image-spec digest
  model; Nix's fixed-output derivations. The escrow's nation-state defence is not a policy, it is
  a hash.
- **Exit as the discriminator** — Hirschman, *Exit, Voice, and Loyalty* (1970), via
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`. §10 is that anchor made into a
  test.

## 16. Pointers

- `.claude/rules/clone-at-tag-stays-sufficient.md` — the permanent form of §10's requirement
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — appointed vs emergent; exit
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline used throughout
- `src/Core.TypeScript/cluster/image-footprint.measured.json` — §2's evidence, and §9 step 3's input
- `src/Core.TypeScript/cluster/image-source-provenance.ts` — what an anonymous client gets, with a date
- `src/Core.TypeScript/cluster/manual-sync-policy.ts` — the shape §9 step 2's lint should take
- `full-ai-cluster/k8s/storage-profiles.json` — the ladder §11 must fit into
- `full-ai-cluster/k8s/object-store/BLOB-STORE-CONTRACT.md` — the S3 backend and `zeta-backups`
- `docs/research/2026-08-26-caching-var-cache-apt-archives-is-the-root-fix-for-the-apt-wall-budget-class.md`
  — the apt half solved as a *cache* in Actions; an in-cluster apt escrow is the durable sibling.
  Owned by another agent; named here so the two are not built twice.

***

*Selection only. Nothing was deployed; no chart was added to the cluster.*
