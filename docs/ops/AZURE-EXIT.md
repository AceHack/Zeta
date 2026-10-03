# Azure exit -- the website and the registry move to the cluster; what is left on Azure, and why it is safe to delete the rest

> **Carved sentence.** The public website (`flowdent.net`, `www.flowdent.net`) is served from this cluster,
> as a byte-identical copy of the image Azure was *serving* (not the image Azure's newest tag points at);
> the two Azure storage accounts (`fddiagbundlesprod`, `flowdent863701`) **stay on Azure by the owner's
> decision**, and nothing else on Azure is used by anything running. Deleting the managed environment,
> the Container Apps, the managed certificates, the Log Analytics workspace or the container registry
> cannot touch what the storage accounts serve -- but deleting the **resource group**
> `flowdent-containerapp-rg` would, because `fddiagbundlesprod` lives inside it.

> **Second pass, 2026-10-03 (finishing agent).** Everything below was re-measured, not inherited. Three
> things changed: (1) the website **Deployment is no longer in this repository** -- it references a private
> Flowdent image and the one-way rule (Flowdent may depend on Zeta, never the reverse; enforced by
> `image-source-provenance.ts`, which went red on the first version of this PR) puts it in the tenant
> repo: `flowdent/fd-webclient` MR !2, `k8s/flowdent-web/deployment.yaml`, byte-identical to the live
> object; (2) the registry copy now also holds the Failed `06a4d160` web image and the one `flowdent-api`
> tag, digests verified; (3) the dependency table and deletion order are final and say what was verified.

Work item `081M3ZH0G1R087G0R002MK4H67`. Manifests: `full-ai-cluster/k8s/flowdent-web/` (opt-in: namespace, quota, PDB, Service, routes -- **not** the
Deployment) and two listeners in `full-ai-cluster/k8s/public-tls/`. Pinned by `src/Core.TypeScript/cluster/flowdent-web.test.ts`.
Every number below was MEASURED on 2026-10-02/03 from this PC, the cluster, Azure's read APIs and
`check-host.net`; nothing was deleted, stopped or modified on the Azure side.

## What is where after this change

| Thing | Where it runs now | Evidence |
| --- | --- | --- |
| `api.flowdent.net`, `api-staging.flowdent.net` | cluster (`flowdent-prod` / `flowdent-staging`) | unchanged by this work; `/health` 200 |
| `flowdent.net`, `www.flowdent.net` | cluster, namespace `flowdent-web` | below |
| DataProtection key ring + diagnostic bundles | **Azure** `fddiagbundlesprod` (kept, owner decision) | Secret `flowdent-api-secrets` keys `DataProtection__AzureBlobConnectionString`, `Diagnostics__BundleStore__AzureBlobConnectionString` |
| Installers / releases / prereleases / uat | **Azure** `flowdent863701` (kept, owner decision) | clients hardcode `flowdent863701.blob.core.windows.net` -- see "What the kept storage accounts mean" |
| Azure OpenAI | deleted by the lead (`az cognitiveservices account list` is empty); the cluster's `AzureOpenAI__Endpoint` still names it | `/api/AzureOpenAIProxy/*` fails by design |

## C. The website

### What was serving, and the trap in Azure's repository

Azure Container App `flowdent-webapp` has **two** active revisions with different images:

| Revision | Image tag (source) | State | Is it what visitors saw? |
| --- | --- | --- | --- |
| `--0000113` | `flowdent-webapp:672c0d13...` (fd-webclient `672c0d13`, Next.js 16, port 3000, user `nextjs`) | Healthy, Running | **yes** |
| `--0000115` | `flowdent-webapp:06a4d160...` = `latest` (fd-core `06a4d160`, a .NET Blazor WebAssembly host, entrypoint `dotnet flowdent.WebAssembly.dll`, port 80) | **Failed** since 2026-09-17, holds the 100% traffic label | no |

The old fd-core GitHub workflow pushed its own build into the `flowdent-webapp` repository on 2026-09-17
and Azure kept serving the previous revision because the new one never became ready. **Copying `latest`
would have deployed a different application**, so the image copied is the *serving* one, by digest:
`sha256:eb977e99014405e7eb49524890f09788d59a0f8a9d414d2fc749c02889faf2fb`.

The site is static-ish Next.js (the image contains no Azure hostname, no blob URL and no secret; it was
built with `NEXT_PUBLIC_API_URL=https://api-staging.flowdent.net`, which is **its existing behaviour** and
is not changed here -- worth a deliberate decision, not a silent one).

### What was built

| Piece | Value |
| --- | --- |
| Image | `registry.flowdent.net/flowdent/fd-webclient/flowdent-webapp:672c0d13afa2` (also tagged with the full sha), pinned in the Deployment **by digest**; the registry and ACR report the same digest (re-verified 2026-10-03, section D) |
| Deployment | **in `flowdent/fd-webclient` MR !2** (`k8s/flowdent-web/deployment.yaml`), not in this repo: it names a private image. `kubectl diff` of that file against the live object is empty |
| Namespace | `flowdent-web`, Pod Security `restricted` **enforced**, ResourceQuota (no PVC), PriorityClass `flowdent-prod` (non-preempting) |
| Pods (in that Deployment) | 2 replicas, `maxUnavailable: 0`, PDB `minAvailable: 1`, soft anti-affinity, startup/readiness/liveness on `/` |
| Pod hardening (same) | uid 1001 (the image's own `nextjs`), `readOnlyRootFilesystem`, all caps dropped, seccomp `RuntimeDefault`, no SA token; writable only `/tmp` (64Mi) and `/app/.next/cache` (128Mi), both `emptyDir` with limits |
| Resources (same) | request 50m / 128Mi / 64Mi ephemeral, limit 512Mi / 256Mi ephemeral (Azure had 0.25 CPU / 0.5Gi) |
| Gateway | listeners `https-flowdent-web` (index 7, `flowdent.net`) and `https-flowdent-web-www` (index 8, `www.flowdent.net`) on `zeta-public-gateway`, **each with its own cert-manager Certificate** via the existing Cloudflare DNS-01 solver |
| Routes | one HTTPS route per name + one `:80` route that only 301-redirects |
| Pull credential | GitLab **group** deploy token `cluster-pull-web` (`read_registry`), as Secret `flowdent-registry` in `flowdent-web` (not in git). The existing `flowdent-registry` token is scoped to the fd-core project and got `insufficient_scope` on the fd-webclient path -- measured, then fixed with a group-scoped token |

Resource cost: 100m CPU / 256Mi memory *requested* in total.

### Proof it is the same site

First pass: a local read-only container run of the pushed image vs. the live Azure site. **Second pass
(2026-10-03 01:3xZ), the live paths**, three vantage points per path -- Azure's own hostname
(`flowdent-webapp.graycliff-20a1aa77.eastus.azurecontainerapps.io`), the cluster Gateway
(`curl --resolve flowdent.net:443:192.168.1.240`), and the public name through Cloudflare:

| Path | Azure | cluster | via Cloudflare | body md5 (all three equal) |
| --- | --- | --- | --- | --- |
| `/` | 200 | 200 | 200 | `ff4b909b...` |
| `/robots.txt` | 200 | 200 | 200 | `bb5d5390...` |
| `/sitemap.xml` | 200 | 200 | 200 | `85be06b4...` |
| `/favicon.ico` | 200 | 200 | 200 | `c30c7d42...` |
| `/pricing`, `/logo.png`, `/about`, `/contact`, `/terms`, `/privacy`, `/nonexistent-xyz` | 404 | 404 | 404 | `b97c0c67...` (the Next.js 404 page) |

Response headers are equal apart from the proxy that added them (`server: envoy` and
`x-envoy-upstream-service-time` on the cluster, `server: cloudflare` at the edge): `cache-control:
s-maxage=31536000`, `x-frame-options: DENY`, `x-content-type-options: nosniff`,
`referrer-policy: strict-origin-when-cross-origin`, `x-xss-protection: 1; mode=block`, `x-powered-by:
Next.js`, `x-nextjs-prerender: 1`, identical `vary`. The `x-envoy-upstream-service-time` header arriving
through Cloudflare is the proof that the public path ends on the cluster Gateway and not on Azure.

**Pre-existing, identical on Azure and on the cluster, therefore not a regression:** all 16 URLs listed in
`/sitemap.xml` (`/pricing`, `/features`, `/claimassist`, `/integrations/*`, ...) return **404** -- the
served build is effectively a one-page site whose sitemap advertises pages it does not have. Worth fixing
in `fd-webclient`; deliberately not "fixed" by shipping a different build here.

Origin certificate: Let's Encrypt (`CN=flowdent.net` and `CN=www.flowdent.net`, `notAfter 2026-12-31`,
cert-manager renews at 2026-12-01), `Certificate flowdent-web-tls` and `flowdent-web-www-tls` in
`zeta-platform` both `Ready=True`. The browser-facing certificate is Cloudflare's own (Google Trust
Services). `HTTP -> HTTPS`: at the origin `:80` answers `301 -> https://<host>:443/<path>` (the explicit
`:443` is Envoy's redirect spelling; harmless); through Cloudflare see "Plain HTTP ... is broken" below.

### Cutover and what the 525 was

**The apex `525` was Azure's, and it was a certificate that never existed.** Evidence:

- `az containerapp show`: custom domain `flowdent.net` has `bindingType: Disabled` (no certificate bound);
  `www.flowdent.net` has `SniEnabled` with a managed certificate.
- `az containerapp env certificate list`: `mc-flowdent-envir-flowdent-net-7580` (the apex) is in state
  **`Failed`**; the other three are `Succeeded`. Why it failed is inferred, not observed: Azure validates an
  apex managed certificate against an A record to the environment IP, and that record was Cloudflare-**proxied**.
- `curl --resolve flowdent.net:443:48.223.241.141`: *Connection reset* during the TLS handshake (no cert
  for that SNI), while `www.flowdent.net` against the same IP returned 200. Cloudflare reports a failed
  origin handshake as `525`.

So the apex has been down on Azure since its certificate failed; moving it could not make it worse.

Cloudflare changes (zone `flowdent.net`; both records stay **proxied**; the origin is the router's public IP,
which forwards `:443` to the node):

| Record | Before (rollback value) | After |
| --- | --- | --- |
| `A flowdent.net` | `48.223.241.141` proxied, ttl auto | `66.10.240.234` proxied, ttl auto |
| `www.flowdent.net` | `CNAME flowdent-webapp.graycliff-20a1aa77.eastus.azurecontainerapps.io` proxied | `A 66.10.240.234` proxied |

Order: apex first (already broken), verified from outside, then `www`. Cloudflare's SSL mode could not be
read (the DNS token lacks Zone Settings); it is Full or Full (strict), because Azure's `allowInsecure: false`
redirect would loop under Flexible -- and a valid public certificate satisfies both.

### Verification from outside (check-host.net HTTP, 20 probes x several rounds)

| Target | Result |
| --- | --- |
| apex after cutover | 77 / 80 probes `200`; the 3 failures were `520` x2 and one probe error |
| `www` after cutover | 54 / 60 probes `200`; failures `520` / `525` from a few Asia-Pacific probes |
| `www` while still on Azure (baseline) | 68 returned, 0 failed (12 still pending) |
| `api.flowdent.net/health` (DNS-only, same origin path) | 74 / 80 and 9-10 / 10 in single rounds |
| raw TCP to `66.10.240.234:443` | 18-19 of 20 probes connect; one Russian probe never does |

Second pass, 2026-10-03 01:2x-01:40Z (20 nodes per round, same tool):

| Target | Result |
| --- | --- |
| apex `https://flowdent.net/`, 4 rounds | 70 / 80 `200`; 10 failures = `520` x6, `525` x3, one probe error (nodes in IN, DE, UK, BG, IR, RU) |
| `www`, 4 rounds | 79 / 80 `200` |
| `http://flowdent.net/`, 2 rounds | 34 / 40 answered, all redirects (`301` x14, `302` x20); 6 probes timed out (BR, IR, RU) |
| **interleaved, same minutes**: apex / `www` / `api.flowdent.net/health` (DNS-only, direct to the origin), 4 rounds each | apex **78 / 80**, `www` **78 / 80**, api **50 / 80** (28 probe errors) |
| the node itself, `curl --resolve ...:443:192.168.1.240`, 60 requests per name | `flowdent.net` 60/60, `www.flowdent.net` 60/60 |

**Honest finding: there is a measurable intermittent failure from some Cloudflare edges to this origin
(roughly 2-12% of cold probes in the second pass; the DNS-only api name, which skips Cloudflare, was
*worse* in the same minutes at 38%), at a rate comparable to or worse than every other public name served
from the same residential origin, and visible only as `520`/`525` because Cloudflare reports the origin leg.** It is not
specific to the website: the node's own counters are clean (`TcpExtListenOverflows 0`,
`ListenDrops 18`), the cause is upstream of the node (the consumer router / path), and Azure's datacentre
origin did not have it. The structural fix is a Cloudflare Tunnel (`cloudflared` dialling *out* from the
cluster, as `studio.flowdent.net` already does), which removes the inbound port-forward from the path --
it needs a tunnel credential this work does not hold, so it is recorded here and **not done**.

**Plain HTTP to the public name is broken, and was not on Azure.** `http://flowdent.net/` and
`http://www.flowdent.net/` go through Cloudflare to the origin's **port 80**, and that lands on whichever of
the node's addresses the home router bound the rule to (the node's address and each Cilium LB IP share one
MAC, see the header of `node-lan-hosts.yaml`). Measured 01:5xZ, 30 sequential `curl http://flowdent.net/`:
**26 returned GitLab's `302 -> http://flowdent.net/users/sign_in`** (the `gitlab-lan` Gateway, `.250`, which
also answers on `:80`), 2 returned the intended `301 -> https://flowdent.net:443/` (the public Gateway,
`.240`), 1 returned `200` with another site's page (the Zeta portal's Gateway), and the rest timed out.
`curl -H 'Host: flowdent.net' http://192.168.1.250/` reproduces the GitLab answer on the LAN. Azure answered
`301 -> https` here. Browsers that default to `https://` never hit it; a typed `http://`, an old link or a
crawler does, and gets a GitLab sign-in page under the website's name. The fix is not in this repo and is
not done: turn on Cloudflare **Always Use HTTPS** (a zone setting; the DNS token used here lacks Zone
Settings, and changing it is outside this task's scope), or a Redirect Rule, so `:80` never reaches the
origin. The same MAC-keyed forwarding is the plausible cause of the intermittent `520`/`525` above (SYNs
arriving at an address that does not serve the port) -- an inference, not a measurement; the `https-relay`
externalIPs Service exists precisely to absorb it for `:443`.

Azure's own `Requests` metric for the web app is **weak evidence and is not relied on here**: over the 7 days
to 2026-10-03 it shows a single request in total (even while `www` was still served from Azure), and my own
probes of the Azure hostname at ~01:30Z had not appeared 10 minutes later. What the doc relies on instead:
no Cloudflare record points at an Azure host any more (zone listing 2026-10-03, below), and the
`x-envoy-upstream-service-time` header that only the cluster Gateway adds arrives on public responses.

### Bring-up and rollback

```bash
# 1. the pull Secret (never in git): a group deploy token with read_registry on registry.flowdent.net
kubectl create ns flowdent-web   # or let the Application's CreateNamespace do it
# create Secret flowdent-registry (type kubernetes.io/dockerconfigjson) in flowdent-web
# 2. opt in, once (namespace, quota, PDB, Service, routes)
kubectl apply -f full-ai-cluster/k8s/flowdent-web/Application.yaml
# 2b. the workload, from the tenant repo (it names a private image, so it is not in this tree):
#     flowdent/fd-webclient  k8s/flowdent-web/deployment.yaml   (MR !2)  ->  kubectl apply -f deployment.yaml
# 3. on a node whose platform-public-tls Application was rendered before this change, append listeners 7 and 8
#    (a node rebuild re-renders them from argocd-application.yaml.in): see "Gateway listeners on the live node"
```

Rollback (website only), in this order:

1. Cloudflare: `A flowdent.net` back to `48.223.241.141` (proxied). Note it returns `525` again.
2. Cloudflare: delete `A www.flowdent.net`, recreate `CNAME www.flowdent.net` ->
   `flowdent-webapp.graycliff-20a1aa77.eastus.azurecontainerapps.io` (proxied). Valid only while the Azure
   web app and its managed certificate still exist.
3. The in-cluster site can stay up; it receives no traffic. The values are also in the session scratchpad
   as `dns-rollback-web.json` (Cloudflare record ids: apex A `3b014eb174f77858118e5defad0ed24a`,
   www `bf3eacc9bea963e82c374a27a66da84a`; both created 2026-07-14, proxied, ttl auto).

**Rollback ceases to exist once `flowdent-webapp` is deleted** (step 2 needs it, and the apex rollback only
returns the `525`). After that the cluster is the only host of the website, and the way back is the
registry image (`registry.flowdent.net/flowdent/fd-webclient/flowdent-webapp@sha256:eb977e99...`) on any
host that can run a container.

Cloudflare zone listing 2026-10-03 01:2xZ, read through the API (token not printed), the records this work
may touch: `A flowdent.net 66.10.240.234 proxied ttl auto`, `A www.flowdent.net 66.10.240.234 proxied ttl auto`.
Not touched and not Azure: `api`, `api-staging`, `git`, `gitlab`, `portal`, `registry`, `ssh` (all A
`66.10.240.234`, DNS-only, ttl 60), `studio` (Cloudflare tunnel), Microsoft 365 (`MX`, `autodiscover`,
`lyncdiscover`, `sip`, `msoid`, two `_sip*` SRV, the `NETORG...onmicrosoft.com` TXT), GoDaddy (`email`, `pay`,
`_domainconnect`, SPF TXT). The one remaining Azure-related record is `TXT asuid.flowdent.net` (verification only).

### Gateway listeners on the live node

`platform-public-tls` on this node is created by a k3s addon from a NixOS-rendered template, so a live
change is an appended inline patch (exactly as for the api listeners):

```json
{"op":"add","path":"/spec/source/kustomize/patches/-","value":{
  "target":{"group":"gateway.networking.k8s.io","kind":"Gateway","name":"zeta-public-gateway"},
  "patch":"[{\"op\":\"add\",\"path\":\"/spec/listeners/7/hostname\",\"value\":\"flowdent.net\"},{\"op\":\"add\",\"path\":\"/spec/listeners/8/hostname\",\"value\":\"www.flowdent.net\"}]"}}
```

It was applied together with `targetRevision: feat/azure-exit` so the listeners and the patch arrived in
one render; **after the PR merges, `targetRevision` must be set back to `main`** (the branch is deleted on
merge, and the Application would then fail to render). Applying the patch *before* the
base has listeners 7 and 8 is a render error (nothing changes); applying the base *before* the patch would
briefly put two hostname-less `:443` listeners on the Gateway, which Gateway API marks `Conflicted`.

**Cost to other installs, stated:** an install with a public domain now also gets an apex listener and a
Certificate for the bare domain. Like the api listeners, it costs only that name when DNS does not point
at the cluster.

## D. The registry `flowdentacr`

`Basic` SKU, admin user enabled, anonymous pull off, created 2025-08-18. **6.26 GB, 235 tags in 3
repositories** (Azure's own usage counter: 6260260709 bytes). Re-measured 2026-10-03: no webhooks, no tasks,
no tokens, no replication (Premium-only), no diagnostic settings; the only role assignment on it is
`AcrPush` for a GitHub deploy service principal.

| Repository | Tags | Used by | In `registry.flowdent.net` (digest compared with ACR's, **all MATCH**) |
| --- | --- | --- | --- |
| `flowdent-webapp` | 115 (`latest` + 114 commit shas) | the web app (revisions `--0000113` serving, `--0000115` Failed) | `flowdent/fd-webclient/flowdent-webapp:672c0d13afa2` and `:672c0d13afa22f9ef9eb89cef587b6d83bd18539` = `sha256:eb977e99...` (**what runs now**); `flowdent/fd-core/azure-archive/flowdent-webapp:06a4d160b6fe` and `:06a4d160b6fef1f4013f683eb8b93c7623df2ac4` (also what ACR's `latest` points at) = `sha256:ca98daa6...` -- the Failed Blazor build, evidence only |
| `flowdent-services` | 119 (`latest`, 112 commit shas, 6 named) | the two (deleted) API apps | `flowdent/fd-core/azure-archive/flowdent-services:06a4d160b6fe` = `sha256:8e84c3af...` (the last image Azure ran in production); plus the six named, one-off builds that are **not** reachable from a git sha: `image-router-20260429233039` / `-233556` / `-233933` (`9f8bc0a0...`, `ab090f77...`, `ba5d62f1...`), `vision-gpt54-20260518-224221` + `vision-gpt54-latest` (one image, `b73a6621...`), `diagnostic-bundles-20260619-1730` (`c517d60a...`) |
| `flowdent-api` | 1 (`staging-9242a07`, 2026-05-19) | nothing | `flowdent/fd-core/azure-archive/flowdent-api:staging-9242a07` = `sha256:8004c452...` |

**What would be lost if `flowdentacr` is deleted**, measured: of the 235 tags, 226 are commit-sha tags and
**every one of those 226 commits exists in GitLab** (`flowdent/fd-core` for `flowdent-services`; fd-webclient
or fd-core for `flowdent-webapp` -- looked up through the GitLab API) so each can be rebuilt; the `latest`
tags are aliases; the 8 remaining tags are copied above. What is genuinely gone after deletion: two
untagged manifests from 2025-08-18/19 (`sha256:87a05a8a...`, `sha256:9399cbce...`, ~116 MB each, never
referenced by a tag), and the bytes of the ~220 other historical builds (rebuildable, not copied). Nothing
in the cluster references `azurecr.io` (scan below). The GitHub workflows that push to it
(`deploy-to-container-apps.yml`, `promote-to-prod.yml`, `azure-container-app-deploy.yml`) would fail, and
they target apps that no longer exist or are about to be deleted.

## E. Dependency table -- what remains on Azure, what uses it, and whether it is safe to delete

**Inventory (re-read 2026-10-03, `az resource list`, subscription "Microsoft Azure Sponsorship"):** exactly
these ten resources, in two resource groups, and nothing else:
`flowdent-containerapp-rg` = Container App `flowdent-webapp`, managed environment `flowdent-environment`,
four managed certificates, ACR `flowdentacr`, Log Analytics `workspace-flowdentcontainerapprgZIrZ`, storage
`fddiagbundlesprod`; `flowdent-installers-rg` = storage `flowdent863701`. Resource group `fd_dev` holds only
the soft-deleted AI account `flowdent-ai` (`az cognitiveservices account list-deleted`, eastus2).
**Unverified:** the login also lists "Azure subscription 1" (`b0dc1abf-...`, "not found" for this login) and
"PayAsYouGo" (`ed776cad-...`, needs an interactive `az login`); I could not list them. `lucentacr.azurecr.io`
(another registry in this PC's docker config) is not in the Sponsorship subscription and is out of scope.

Scan behind the "nothing still uses it" claims -- re-run 2026-10-03: **all 130 container images of every pod
in every namespace**, every ConfigMap, Deployment, StatefulSet, DaemonSet, CronJob, Job, and **every key of
every Secret** (values decoded in memory, never printed), searched for `azurecr.io`, `azurecontainerapps.io`,
`database.windows.net`, `openai.azure.com`, `cognitiveservices.azure.com`, `blob.core.windows.net`,
`windows.net`, `.azure.`, `azurewebsites`, `applicationinsights`, `vault.azure`:

| Where | Match |
| --- | --- |
| pod images (130) | **none** |
| `flowdent-api-secrets` (prod and staging) `DataProtection__AzureBlobConnectionString` | `fddiagbundlesprod.blob.core.windows.net` (**kept**) |
| `flowdent-api-secrets` (prod and staging) `Diagnostics__BundleStore__AzureBlobConnectionString` | `fddiagbundlesprod.blob.core.windows.net` (**kept**) |
| `flowdent-api-secrets` (prod and staging) `AzureOpenAI__Endpoint` (+ `__ApiKey`, `__DeploymentName`, `__VisionDeploymentName`) | `flowdent-ai.cognitiveservices.azure.com` -> the AI account (**deleted**) |
| ArgoCD `argocd-ssh-known-hosts-cm` | `ssh.dev.azure.com` host key (Azure DevOps); a stock ArgoCD entry, not a dependency |
| anything else | **none** -- no `azurecr.io`, `azurecontainerapps.io`, `database.windows.net` anywhere |

GitLab CI variables (all 9 projects + the group): none contains an Azure credential
(`FLOWDENT_DEPLOYER_TOKEN`, `FLOWDENT_PULL_*`, `REGISTRY_INSECURE` only; first-pass finding, not re-run).
Cloudflare: no record points at an Azure host (re-read, section C). Azure side, re-read: no diagnostic
setting on either storage account, the environment or the registry, no resource lock, no private endpoint,
no managed identity on the web app (`identity: None`).

**Independence of the two kept storage accounts from everything being deleted, measured:**

| Property | `fddiagbundlesprod` | `flowdent863701` |
| --- | --- | --- |
| network rules | `defaultAction: Allow`, 0 VNet rules, 0 IP rules | same |
| private endpoint connections | 0 | 0 |
| managed identity | none | none |
| diagnostic settings (account level) | none | none |
| resource lock | none | none |
| role assignments on it | none | one service principal, `Storage Blob Data Contributor` (GitHub release pipeline) |
| public blob access | off (the API reaches it with a connection string) | **on** (clients download anonymously) |
| referenced by the web app / environment / registry / workspace | no (web app env: `ASPNETCORE_*`, `PORT`, `HOSTNAME`, `NODE_ENV` only; the environment has no VNet) | no |

The environment is Consumption with `vnetConfiguration: null`, so deleting it releases only its static IP
(`48.223.241.141`). The only things that ever named that IP are the two Cloudflare records already moved.

| Azure resource | Used by (evidence) | Safe to delete? | After deleting |
| --- | --- | --- | --- |
| Container App `flowdent-webapp` (revision `--0000113` Healthy, `--0000115` Failed holding the traffic label) | was `flowdent.net`/`www`. **No longer**: both Cloudflare records point at the cluster, which serves identical bytes (section C) | **yes** | the cluster is the only host; frees a 0.25-CPU always-on replica |
| Container Apps `flowdent-api`, `flowdent-api-staging` | `api*.flowdent.net` are A records to the cluster | **already deleted by the lead** (`az containerapp list` shows only `flowdent-webapp`) | the archived image is in `registry.flowdent.net` |
| Managed certificates `mc-flowdent-envir-api-flowdent-net-8816`, `...-api-staging-flow-7697`, `...-www-flowdent-net-0045` (Succeeded) and `...-flowdent-net-7580` (**Failed**) | only the custom-domain bindings of the apps (`flowdent.net` is `Disabled`, `www` is `SniEnabled`) | **yes**, after the app | none |
| Managed environment `flowdent-environment` (`eastus`, Consumption, no VNet, static IP `48.223.241.141`) | hosts only `flowdent-webapp` now | **yes**, after the app (Azure refuses while apps exist) | releases the IP; **no effect on either storage account** (table above) |
| Log Analytics `workspace-flowdentcontainerapprgZIrZ` (PerGB2018, 30-day retention, no daily cap) | only the environment's `appLogsConfiguration`; no diagnostic setting, linked service or linked storage points at it | **yes**, after the environment | the last 30 days of container logs are gone; the cluster logs to Loki |
| ACR `flowdentacr` | pulled by the web app only; pushed by GitHub workflows (SP `AcrPush`) | **yes**, after the app | section D: 226 sha tags rebuildable from GitLab, the 8 others copied, two untagged 2025 manifests gone |
| Storage `fddiagbundlesprod` (`flowdent-containerapp-rg`) | **API prod+staging, via two connection strings** | **NO -- kept by decision** | holds the DataProtection key ring that decrypts the 84 stored Plaid tokens, and the new `archive` container with the DB dumps |
| Storage `flowdent863701` (`flowdent-installers-rg`) | **installed clients and the release pipeline** | **NO -- kept by decision** | see below |
| Azure SQL `flowdent` / `FlowdentService` | the cluster uses Postgres (CNPG) | **already deleted by the lead** | rollback to Azure SQL no longer exists |
| AI account `flowdent-ai` (+ project `fd_agents`) | `AzureOpenAI__*` in the cluster Secrets | **already deleted by the lead** (soft-deleted; `az cognitiveservices account purge` frees the name) | see "Azure OpenAI is gone" below |
| Entra service principals with role assignments (`26df6627-...`, `e713b491-...`: `Contributor` on `flowdent-containerapp-rg`; `c4259557-...`: `Contributor` on `flowdent-installers-rg`; `91b17d9d-...`: `Contributor` on the subscription and `Storage Blob Data Contributor` on `flowdent863701`) | the GitHub deploy/release workflows | the two scoped to `flowdent-containerapp-rg` become useless after the deletions below and can be removed (`az role assignment delete`); **keep** `c4259557` and `91b17d9d` while releases are published to `flowdent863701` | -- |
| Cloudflare TXT `asuid.flowdent.net` | Azure custom-domain verification for the apex | removable after `flowdent-webapp` is deleted | none |

**Subdomain-takeover check:** no Cloudflare record points at `*.azurecontainerapps.io` any more, so freeing
`flowdent-webapp.graycliff-20a1aa77.eastus.azurecontainerapps.io` leaves nothing dangling.

### Verdict

**SAFE TO DELETE: webapp / environment / ACR / Log Analytics**, individually and in the order below -- and
only as individual resources. Nothing running on the cluster and nothing served from either kept storage
account depends on any of the four (evidence: the scans and tables above). **NOT safe:** the resource group
`flowdent-containerapp-rg` (contains `fddiagbundlesprod`) and `flowdent-installers-rg` (contains
`flowdent863701`). Conditions to accept first, none a blocker: the website then has **no Azure fallback**
(the cluster, behind a residential origin that shows a measured 2-12% intermittent `520`/`525` rate at the
Cloudflare edge, is the only host); the apex was already down on Azure; and the historic Log Analytics data
is unrecoverable.

### Safe deletion order (not run -- commands for the lead)

```bash
export MSYS_NO_PATHCONV=1
export PATH=$PATH:/c/Users/maxim/AppData/Local/Microsoft/WinGet/Links
RG=flowdent-containerapp-rg
# 0. precondition: both kept accounts answer (compare after)
az storage account show -n fddiagbundlesprod -g $RG --query provisioningState -o tsv
az storage account show -n flowdent863701 -g flowdent-installers-rg --query provisioningState -o tsv
# 1. the app (api / api-staging are already gone)
az containerapp delete -g $RG -n flowdent-webapp --yes
# 2. the managed certificates (they only back the app's custom-domain bindings; strip CR on Windows)
for c in $(az containerapp env certificate list -g $RG -n flowdent-environment --query '[].name' -o tsv | tr -d '\r'); do
  az containerapp env certificate delete -g $RG -n flowdent-environment --certificate "$c" --yes
done
# 3. the environment, then its log workspace (--force true skips the 14-day soft delete; omit it to keep that)
az containerapp env delete -g $RG -n flowdent-environment --yes
az monitor log-analytics workspace delete -g $RG -n workspace-flowdentcontainerapprgZIrZ --yes --force true
# 4. the registry
az acr delete -g $RG -n flowdentacr --yes
# 5. postcondition: only the storage account is left in the group, and both accounts still answer
az resource list -g $RG --query "[].[type,name]" -o tsv    # expect exactly: Microsoft.Storage/storageAccounts fddiagbundlesprod
az storage account show -n fddiagbundlesprod -g $RG --query provisioningState -o tsv
curl -sI https://flowdent863701.blob.core.windows.net/releases/latest.json | head -1
# 6. Cloudflare: delete TXT asuid.flowdent.net (zone flowdent.net)
# 7. optional: `az role assignment delete` for the two SPs scoped to flowdent-containerapp-rg;
#    `az cognitiveservices account purge` (name flowdent-ai, rg fd_dev, location eastus2) to free the name.
# NEVER:  az group delete -n flowdent-containerapp-rg      (contains fddiagbundlesprod)
#         az group delete -n flowdent-installers-rg        (contains flowdent863701)
```

Order rationale: Azure refuses to delete an environment that still has apps, an ACR is only pulled by apps,
and the workspace is only attached to the environment -- so app, certificates, environment, workspace,
registry is the dependency order.

### Azure OpenAI is gone -- what that breaks, and local-model options

`flowdent-ai` (and its three deployments) was deleted, so `api.flowdent.net/api/AzureOpenAIProxy/*` and the
background defect description now fail by design; the cluster Secrets still hold the dead `AzureOpenAI__*`
values. The API's client is the Azure SDK, so it calls **Azure-style routes**
(`/openai/deployments/{deployment}/chat/completions?api-version=...`, header `api-key`), not OpenAI's
`/v1/chat/completions`. Options, none built or tested here:

1. **An OpenAI-compatible server in the cluster behind an Azure-shaped adapter.** vLLM and Ollama both serve
   `/v1/chat/completions`; something must map `/openai/deployments/{name}/...` to `/v1/...`, drop
   `api-version`, and translate `api-key` to `Authorization: Bearer` (Ollama ignores auth, so a path rewrite
   is enough there; a Gateway `URLRewrite` can do a fixed-prefix mapping per deployment name). LiteLLM's
   proxy documents Azure-compatible routes for exactly this purpose (not verified here).
2. **Point `AzureOpenAI__Endpoint` at that adapter** and set `AzureOpenAI__DeploymentName` /
   `__VisionDeploymentName` to the local model names (the vision name needs a vision-language model).
3. **Reality check on this node:** `node-5b2dfa` has ~62 GB RAM and **no GPU** (`nvidia.com/gpu` is not
   allocatable); the `ollama` and `vllm` Argo apps are `OutOfSync/Missing` (not deployed). A model here is a
   CPU-only, small, quantised one, and vision on CPU will be slow. The only true drop-in is a hosted model
   with an Azure-compatible surface (a new Azure OpenAI resource, which the owner has excluded); anything
   else needs the adapter above and a quality/latency decision by the owner.

### What the kept storage accounts mean (so nobody deletes them by accident)

- **`fddiagbundlesprod`** holds the ASP.NET DataProtection key ring for production
  (`dataprotection-prod/keys.xml`, 3.9 KB). The 84 stored Plaid access tokens are encrypted with keys in
  it, protected by a PFX that lives in cluster Secret `flowdent-api-secrets`. **Losing or replacing that
  blob makes those tokens unreadable.** Keep an offsite copy of `keys.xml` *and* the PFX.
- **`flowdent863701`**: installed clients hardcode `https://flowdent863701.blob.core.windows.net/releases`
  as the stable update source (`UpdateConfiguration.cs:19`, shipped `appsettings.json:156`, the web
  installer `installer/FlowDent-Web.iss:25`), poll `.../releases/latest.json`, will not follow redirects
  (`AllowAutoRedirect=false`), and only download from an allow-list that contains that host. Beta/alpha come
  from fd-core's `/api/v1/updates/access`, which returns an Azure SAS URL signed with the account key. The
  prod `UpdateAccess` store is `unconfigured-placeholder` (so beta/alpha are denied and clients fall back to
  stable), identically on Azure and on the cluster. **That account must stay until a new client release
  points elsewhere.** Neither account depends on the managed environment or the registry: no VNet rules,
  no private endpoints, no firewall rules (`defaultAction: Allow`), no managed identity.

## Known limits of this change

- The pod, the Gateway listeners and the certificates are proven on the live node; the `check-host`
  failure rate above is an *upstream path* measurement, not a fix.
- `NEXT_PUBLIC_API_URL` in the served bundle is `https://api-staging.flowdent.net` -- preserved, not changed.
- The image is a copy, not a rebuild. A rebuild from `flowdent/fd-webclient` (its `feat/gitlab-ci` MR) needs
  `NEXT_PUBLIC_API_URL` as a build argument (the Dockerfile fails without it by design, ADR-088); until it
  lands, update by pushing a new digest and changing the pin in fd-webclient's `deployment.yaml` (MR !2).
- **The Deployment is applied by hand, not by Argo CD.** No `flowdent-web` Argo Application exists on the live
  cluster (checked 2026-10-03): the namespace, quota, PDB, Service, routes and Deployment were applied with
  `kubectl`. Applying `Application.yaml` later adopts the first five and leaves the Deployment alone (prune
  is off and the Deployment is not in this tree). A node rebuilt from git therefore comes back with the
  website's namespace and routes but **without the pods** until the Deployment is applied from fd-webclient.
- Moving the Deployment out of this tree was forced by CI, not chosen: the first version of this PR failed
  `image-source-provenance` (a public-tree manifest naming a private registry image has no ledger row;
  adding one would only record a 401 against the one-way rule). The alternative -- an acknowledged
  exception -- was declined for the reason that rule exists.
- Pre-existing and out of scope: the served site 404s every URL its own sitemap lists (section C).
- Local `bun test src/Core.TypeScript/cluster` on Windows has pre-existing path-separator failures
  (`ENOENT ... '\D:\...'`, `...\Application.yam`); the new tests and the affected suites
  (`flowdent-platform`, `public-tls`, `public-tls-dns01`, `secret-reference-audit`) pass.
