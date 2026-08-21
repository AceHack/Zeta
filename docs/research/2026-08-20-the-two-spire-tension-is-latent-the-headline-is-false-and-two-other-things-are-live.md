# The two-SPIRE tension is LATENT, the headline claim is FALSE — and two other things are live

**Kenji / architect — analysis only. No config edited, no device touched, no credential handled.**
**Date:** 2026-08-20 · **Register:** MEASURED except where marked.

> **Verdict up front: the reported collision is real but LATENT, its headline is wrong, and the two
> genuinely live defects found on the way are neither of the things that were reported.**

## 0. First, the check that mattered most: is this already decided?

**No — and the document that looked like it decides this is a homonym trap.**
`2026-08-20-cross-ca-agreement-*.md:323-418` §*"Correction — what we built is a CLUSTER, not a
FEDERATION"* is about **Addison Cooper's social-structure distinction** — relationships vs contracts,
enforceability, the Lodge, the Universal Exit Principle. **Its "cluster" means *a group held together
by relationships*.** It has nothing to do with `full-ai-cluster/` or Kubernetes; it never mentions
`full-ai-cluster`, `spire-install.yaml`, or k3s. Its §10 states plainly: *"real SPIRE server / agent
— **not attempted.** The issuer is SPIRE-*shaped*; no SPIRE binary was contacted."*

**The k8s SPIRE was out of scope, not reconciled.** So: not a misread of a settled decision — but
also not what was reported.

## 1. The headline claim is FALSE as stated

> Reported: *"two different trust architectures **sharing a trust-domain name** (`zeta.local`)."*

**They do not share a trust domain. They share a DNS suffix, which in SPIFFE carries exactly zero
semantics.**

| side | trust domain | evidence |
|---|---|---|
| cluster (central) | `zeta.local` | `spire-install.yaml:37` |
| node module | `node-a.zeta.local`, `node-b…`, `node-c…` | `federation-loop.ts:332,347,361` |

And matching is **exact string equality against an explicit allow-list** —
`trust-bundle.ts:337`: `if (!policy.admissibleDomains.includes(offered.trustDomain))`. A grep for
`endsWith` / `startsWith` / suffix logic across `trust-bundle.ts` and `local-issuer.ts` returns
**zero**. `local-issuer.ts:215-220` fails closed with `no-accepted-bundle-for-domain`.

**`zeta.local` ≠ `node-a.zeta.local` in every code path that exists.** The shared suffix reads like a
collision to a human eye and is a no-op to the machine.

## 2. Does anything issue under BOTH? No — four independent ways

1. **No importers.** `rg "federated-identity"` across `src`, `full-ai-cluster`,
   `agentic-organization`, `.github`, excluding the module's own directory: **zero hits.** A closed
   island.
2. **No network.** `rg "createServer|listen\(|fetch\(|http\.|https\.|net\.|WebSocket|axios"` over
   `federated-identity/*.ts`: **zero hits.** It cannot contact a SPIRE server even in principle.
3. **Not wire-compatible.** No X.509 anywhere; its SVID is a bespoke ed25519-signed struct over
   **phases, not wall-clock.** A real SPIRE X.509 SVID cannot be parsed by it.
4. **Typed shut.** `ports.ts:239-245` — `RootOfTrustClass` is a **closed six-member union** with no
   k8s/PSAT member, and `:235-237` says why on purpose: *"A closed set: a new device family is a TYPE
   ERROR until its isolation profile is stated."*

> **Bridging k8s node identity into the claim ladder is a compile error today, not a judgement call.
> The type system is already holding the wall — a better guard than any doc.**

**Conclusion: LATENT.** Two designs coexisting harmlessly. Nothing breaks; no claim about the running
system is falsified by the coexistence.

## 3. What IS live — and neither is the reported finding

### (i) A false comment about the Vault upstream CA

`spire-install.yaml:1-3` states **as fact**: *"runs AFTER Vault (SPIRE chains to Vault as upstream
CA)"*. There is **no `upstreamAuthority` key in that file** — `grep -c` returns **0**. The server
**self-signs.**

The ArgoCD twin is honest about it: `applications/spire/Application.yaml:42-50` has the entire
`upstreamAuthority.vault` block **commented out**, with *"Uncomment + configure after
vault/Application.yaml is healthy"*.

> **So the advisory finding's own premise — "chaining to Vault as upstream CA" — was read off a
> comment that the config does not implement.** This is the vacuity class the repo already names: a
> comment that reads as a guarantee and performs nothing. **Independently re-verified before landing
> this doc.**

### (ii) Two controllers own one Helm release

`root-application.yaml:32-38` recurses `k8s/applications/` and picks up every `*/Application.yaml`,
including `spire/Application.yaml`, whose `syncPolicy` is `automated: { prune: false, selfHeal: true }`
(`:68`). Meanwhile k3s auto-applies the `HelmChart` CR from `spire-install.yaml`
(`k3s-server.nix:120` — **so the manifest is wired into k3s auto-apply; not dead config**).

On a real bring-up, k3s' helm-controller and ArgoCD **both manage release `spire` in namespace
`spire`** — one via `helm install`, one via ServerSideApply of rendered output, with `selfHeal` on.
Values are identical so they will not disagree on *content*; **they will contend over ownership.**

*(Out of the assigned scope and untouched — but more immediately actionable than the trust-architecture
question, so it is not left unsaid.)*

## 4. The node attestor — CITED, then verified upstream

The finding's premise here **is** correct. `spire-0.24.2` chart defaults: `nodeAttestor.k8sPSAT.enabled: true`
and `externalK8sPSAT.enabled: true`; `joinToken`, `httpChallenge` and **`tpmDirect`** are `false`.
Neither manifest sets `nodeAttestor`, so **k8s PSAT applies** — node attestation rooted in the API
server's projected service-account token. *Verified against the upstream chart, not read from the repo.*

## 5. The options

### (a) Name the cluster SPIRE a deliberate cluster-grade compromise — **recommended standing position**

What must be true for it to be defensible:

1. The k8s trust domain is honestly labelled **k8s-API-rooted**, not hardware-rooted. The claim
   ladder already has the vocabulary: PSAT evidence is `software-only` → `node-bookkeeping`, **rung 0
   of three** (`node-attestation.ts:107-113`, `:206`).
2. The boundary is stated: `zeta.local` SVIDs authenticate **workloads inside one k3s cluster to each
   other**, full stop.
3. **What must never cross out of it:** a `zeta.local` SVID must never enter any `node-*.zeta.local`
   policy's `admissibleDomains`, and **no `RootOfTrustClass` member is ever added for PSAT.** The
   second is enforced by the type system; **the first is enforced by nothing but this sentence.**
4. §1's exit test is satisfied *within* the cluster: a workload that stops trusting the cluster SPIRE
   can leave the cluster. That is real exit — it costs a redeploy, and **costly exit is still exit.**

**Cost:** documentation only, zero code.
**Falsifier:** any config naming `zeta.local` alongside a `node-*` domain. Also — **if the k3s cluster
ever becomes the only place agents can obtain identity, the "boundary" is a hub with a
boundary-shaped label**, and this option was wrong.

### (b) Migrate the cluster to per-node issuance — **reject**

Partially possible, and much less than it sounds. SPIRE is one server per trust domain; per-node
issuance means one trust domain per node, i.e. abandoning the cluster-as-a-unit model. **K8s workloads
move between nodes** — a pod rescheduled elsewhere changes trust domain mid-life, breaking every
peer's `admissibleDomains` and every `audience` scoping (`local-issuer.ts:279`).

**Cost:** high, and structurally wrong for the workload — Kubernetes' whole premise is that a pod is
not bound to a node.
**Falsifier:** if workloads turn out to be node-pinned anyway (GPU, storage), this cost estimate was
too high.

### (c) Separate the trust-domain names — **reject**

**It resolves nothing, because there is nothing to resolve** (§1). Renaming buys legibility for a
human reader and **zero machine-checkable safety**. Not free either:
`agentic-organization/packages/application/src/spiffe-identity.ts:69` hardcodes `?? "zeta.local"`,
pinned in twelve test places.
**Falsifier:** a reviewer who asks the same question after the rename — then the name was not what
was confusing.

### (d) The option not on the list — **flip `tpmDirect` on**

The hardened chart **already ships a TPM node attestor, disabled**. Enabling it moves cluster node
attestation from *"the API server vouched for this node"* to *"this node's TPM vouched for itself"* —
**without abandoning SPIRE, without abandoning k8s, without touching the per-node module.**

**And the claim ladder already prices exactly what that buys.** `node-attestation.ts:117-146` —
`tpm2-shared-node` has `evidenceBindsTenant: false`, `partitionsConfidentiality: false`,
`partitionsAvailability: false`, citing the TPM research: *"PCRs are byte-identical for every
container, so no PCR policy admits A and refuses B."* So `strongestClaimFor("tpm2-shared-node")`
returns `machine-rooted` (`:203-208`).

> **The flip raises node attestation from rung 0 to rung 1 and can never reach rung 2.** Per-pod
> identity stays machine-rooted at best, **forever** — because the missing property is in the device
> rather than the configuration.

That is the honest middle: **strictly better than PSAT, and incapable of pretending to be per-tenant.**

**Cost:** one line per manifest, plus a TPM on every node, plus a node with a failed TPM being unable
to attest.
**Falsifier:** nodes without a usable TPM — **Apple Silicon is explicitly in this class**
(`node-attestation.ts:135-143`). On a heterogeneous fleet this fragments node admission and is worse
than (a).

### (e) Fix the two live things first — **recommended now**

Correct the false Vault-upstream comment (`spire-install.yaml:1-3`) and resolve the dual-controller
ownership. Both unambiguous, both cheap, **neither requires deciding the architecture question.**
**Falsifier:** none meaningful — a comment describing config that does not exist is wrong under every
architecture.

## 6. Recommendation — Kenji's, for Aaron to accept or reject

> **Take (e) now, (a) as the standing position, hold (d) as a priced option. Reject (b) and (c).**

The reported collision is latent and the type system is already holding the wall. **What is actually
broken is a comment asserting a Vault chain that is not configured, and two controllers reaching for
the same Helm release.**

> A latent architecture question filed as urgent while a false comment and a controller conflict sit
> unreported is an attention misallocation — **named here rather than routed around.**

(a) is defensible because a k3s cluster's workload identity is a **genuinely different problem** from
a peer society's node identity — the same shape as the hub rule's own reasoning: the hub is the right
answer to the vendor/premises asymmetry, and wrong between peers **because that asymmetry does not
exist.** Inside one cluster, one operator owns every node; there is no asymmetry to protect and exit
is a redeploy. That makes `zeta.local` **an oracle the operator chose, not a hub that holds anyone** —
**provided it never becomes the only door to identity.** That proviso is the whole of (a), and it is
the thing to write down.

**This is not decided here and cannot be.** The routing call, which *is* mine: **this does not need a
conference** — the two positions are not in conflict, they are in different problem domains. It needs
a boundary sentence in `spire-install.yaml` and an ADR from Aaron if he wants the boundary
load-bearing.

## Register

**MEASURED** — every `file:line` above, read directly. **CITED-then-verified** — the chart defaults,
fetched from `spiffe/helm-charts-hardened` at tag `spire-0.24.2`. **Not measured** — whether any
cluster is currently running these manifests on hardware. No device touched, no credential handled,
`op` not run.

### Verification note (Otto, landing this)

Three load-bearing claims independently re-checked before landing. **Trust-domain distinctness
confirmed** — `spire-install.yaml:37` is `zeta.local`; `federation-loop.ts:332` is `node-a.zeta.local`.
**Zero suffix matching confirmed** — `grep -c 'endsWith\|startsWith' trust-bundle.ts` returns `0`.
**The false comment confirmed** — lines 1-3 assert *"SPIRE chains to Vault as upstream CA"* while
`grep -c upstreamAuthority` on the same file returns `0`. The advisory premise that produced the
original finding was itself read off that comment, and **it had already been relayed to a
concurrently-running Vault agent, who has been corrected.**
