# Install-time configuration: every value that breaks a fresh install when it is wrong

Goal this document serves: a USB installer that installs and first-boots on **somebody else's
network** with **no post-install hand-editing**. A generic installer edits no file, so any
environment-specific value that lives in the tree is *applied as written* on every install. This
is the inventory of those values, what happens when each is wrong, where its install-time source
is (or should be), and what is still open.

Audited 2026-09-30 against `origin/main` `6aac8b4d39`. Companion docs:
[`full-ai-cluster/INJECTION-POINTS.md`](../../full-ai-cluster/INJECTION-POINTS.md) (the catalog of
injection points, §10 public TLS, §11 LoadBalancer range + LAN collision),
[`full-ai-cluster/DOMAIN-SETUP.md`](../../full-ai-cluster/DOMAIN-SETUP.md),
[`full-ai-cluster/PROVISIONING.md`](../../full-ai-cluster/PROVISIONING.md),
[`FIRST-BOOT-EXTERNAL-DEPENDENCIES.md`](FIRST-BOOT-EXTERNAL-DEPENDENCIES.md).

## The one mechanism (reused, not reinvented)

Introduced for the public domain + ACME email in #17712 (`3fa2bc325e`). Every row below that says
"install-time" uses exactly this path:

```text
zflash --<flag>  ──►  ESP /zeta-firstboot.conf  ──►  zeta-first-boot.sh `export`s it
        │                       (ZETA_<NAME>='…')              │
        └── or the installer prompt, at the START ◄────────────┘
                             │   (ESP -> prompt -> UNSET, validated, BEFORE any disk work)
                             ▼
              /mnt/etc/zeta/<file>  (written only when SET; symlinked to /etc/zeta/ for --impure eval)
                             ▼
     nixos/modules/injected-<thing>.nix reads it at Nix evaluation time, asserts its shape, and on a
     k3s server adds ONE entry to the k3s auto-deploy roster: a SEPARATE ArgoCD Application whose
     kustomize base (k8s/<thing>/) carries NO value — the value arrives only as an inline patch.
```

Three properties make it safe and are the contract for any new row:

1. **The repo carries no default.** An unset value is a *visible* state, never a placeholder.
2. **Fail loud.** A value that cannot work is refused (an ESP value with nobody to ask refuses the
   install **before the wipe**; at a console the operator is asked again). "Unknown" is never
   "permitted", and a probe that did not run says so rather than passing.
3. **A twin is parity-tested.** The shell validator in `zeta-install.sh` is replayed against a
   TypeScript oracle (`installer/*-shell-parity.test.ts`); the rendered template is mirrored in
   TypeScript (`cluster/*.ts`) and tested for SET and UNSET.

The fail-closed backstop for everything that is *not* yet injected:
`bun src/Core.TypeScript/hygiene/lint-rendered-manifest-placeholders.ts` scans every manifest the
cluster applies (and both install-time templates, *rendered*) for `example.com`, RFC 2606 TLDs,
`you@…`, `change-me`, `:placeholder` image tags and unrendered `@ZETA_…@` tokens. A finding that is
not in its baseline fails; a baseline entry that no longer matches fails too (stale).

## Status legend

| status | meaning |
| --- | --- |
| **DONE (this PR)** | moved to install time / detected, with tests that fail without the change |
| **DONE (prior)** | already install-time or derived before this audit |
| **OK (default)** | environment-independent default; not a failure source |
| **OPEN (lane)** | a real defect, owned by the named lane — listed, deliberately not fixed here |
| **OPEN** | a real defect with no owner yet |
| **UNSUPPORTED** | not supported; fails loud (or should) rather than silently |

## The inventory

| # | value | where hardcoded | failure when wrong | install-time source | status |
| --- | --- | --- | --- | --- | --- |
| 1 | **Public domain** (`portal.<d>`, `gitlab.<d>`, `registry.<d>`) | was `platform/gateway.yaml`, `portal.yaml` (`portal.example.com`) | Gateway listener/route for a name nothing resolves; ACME can never validate | `zflash --public-domain` → `ZETA_PUBLIC_DOMAIN` → `/etc/zeta/public-domain` → `injected-public-tls.nix` → `platform-public-tls` Application. RFC 2606/6762 names refused (installer **and**, as of this PR, Nix) | **DONE (prior, #17712)** |
| 2 | **ACME contact email** | was `platform/clusterissuer.yaml` (`you@example.com`) | Let's Encrypt `invalidContact`; ArgoCD waits on issuer health forever → whole `platform` never applies | `zflash --acme-email` → `ZETA_ACME_EMAIL` → `/etc/zeta/acme-email` → same module | **DONE (prior, #17712)** |
| 3 | **Cilium LoadBalancer address range** (LB-IPAM pool) | `k8s/applications/cilium-lb-ipam/ip-pool.yaml` = `192.168.1.240–250` (**removed**) | On any other subnet Cilium assigns addresses no router knows, announces ARP for them, and reports the Service healthy: portal gateway + GitLab unreachable, nothing says why | `zflash --lb-pool auto\|<first>-<last>` → `ZETA_LB_POOL` → installer validates against the **measured** LAN (inside subnet; not network/broadcast/node/gateway; not pod/service/segment CIDR; **not already answering ping**) → `/etc/zeta/lb-pool` → `injected-lb-pool.nix` → `cilium-lb-ipam-pool` Application (`k8s/lb-ipam/`). Prompt offers `.240–.250` of the node's /24 only on an explicit `y`; with nobody to ask it is UNSET **loudly** (no pool, banner says Services stay `<pending>`) | **DONE (this PR)** |
| 4 | **Pod / service CIDR vs the host LAN** | derived from `clusterName` (`cluster-identity.json`): pod `10.143.0.0/17`, service `10.99.192.0/19` for `zeta`; Cilium `ipv4NativeRoutingCIDR` restates it | A 10.x site LAN that overlaps either swallows traffic to those LAN hosts into the overlay: pods get addresses, nothing crashes, packets never arrive. The derivation reserves `192.168/16` and `172.16/12` but **not** other 10.x | **Detection**, not injection (see "why not injectable"): the installer reads the node's routed networks and refuses **before the wipe** (`ZETA_ALLOW_CIDR_OVERLAP=1` overrides, named in the refusal); re-checks against the *cloned* tree's `clusterName`. The ISO ships `/etc/zeta-cluster-identity.json` so the pre-wipe check knows the name | **DONE (this PR)** |
| 5 | **L2 announcement NIC regex** | `cilium-lb-ipam/l2-policy.yaml` was `^en[ops].*`, `^eth[0-9]+` | A node whose wired NIC is a USB/Thunderbolt adapter (`enx<mac>`) announced nothing: LB IPs never answered ARP | widened to `^en.*` (every predictable ethernet name, incl. `enx*`); Wi-Fi deliberately excluded (APs commonly drop an ARP reply for a second address behind one client MAC - unverified on this hardware) | **DONE (this PR)** |
| 6 | **GitLab LAN address** (`global.hosts.gitlab/registry.name` + the `gitlab-lan` Gateway `addresses`) | `applications/gitlab/Application.yaml`: was the literal `192.168.1.250` in 3 places; now the RFC 5737 sentinel `192.0.2.250` | Outside a pool containing `.250` (every LAN but one) `gitlab-lan` stayed `<pending>`: GitLab unreachable on the LAN | the **last address of row 3's resolved range**: Job `gitlab-lan-address` in `cilium-lb-ipam-pool` merge-patches three `valuesObject` leaves; the Gateway is created by PostSync Job `gitlab-exposure` from the LIVE Application's `global.zeta.lanAddress`; root ignores exactly those paths; disjoint from the public-TLS Job's `parameters` | **DONE (this PR stack)** |
| 7 | **GitLab external URL** (public) / hostnames | `applications/gitlab/Application.yaml` (`global.hosts.*`), `domain: gitlab.invalid` sentinel | wrong URL ⇒ wrong clone URLs, OAuth redirects, runner `CI_SERVER_URL` | public domain (row 1) patched in by `gitlab-public-hosts` Job; LAN mode uses the pinned address (row 6). `gitlab.invalid` is a deliberate never-resolves sentinel and is baselined in the lint | **DONE (prior, #17737)** for public; **OPEN (gitlab lane)** for LAN |
| 8 | **GitLab root password / initial token** | `global.initialRootPassword.secret: gitlab-initial-root-password` | a known default password on the instance admin | minted by `bootstrap/internal-secret-seeding.yaml` (generated, not in git) | **DONE (prior)** — retrieval step is the gitlab lane's |
| 9 | **Runner concurrency / tags** | GitLab runner values in the gitlab Application (`kubernetes,zeta-cluster` tags are an *operator step*); ARC `arc-runner-set` `minRunners: 1` / `maxRunners: 6`, `runnerScaleSetName`, `githubConfigUrl: https://github.com/Lucent-Financial-Group`, secret `arc-github-app` | ARC: org URL is Lucent-specific and the GitHub-App secret is operator-supplied, so the scale set cannot register elsewhere; `maxRunners` beyond the node budget leaves runners `Pending` | none | **OPEN (gitlab/runner lane)** — listed, not touched |
| 10 | **Node hostname** | flake host `networking.hostName = "control-plane"` | every node built from that host is `control-plane`: mDNS collision, confusing logs | `zflash --host`, else a per-install `node-<6hex>` (R4 re-pave reuses the recovered id) → `/etc/zeta/cluster-node-id` → `injected-hostname.nix` | **DONE (prior)** |
| 11 | **Node IP / NIC / VIP** | k3s chooses by default route; no `--node-ip`; joiner segment `10.88.0.0/24` derived (`injected-cluster-address.nix`) | a node with two default-capable NICs (e.g. Ethernet + Wi-Fi) can advertise the wrong address; the API cert SANs only `control-plane` + k3s defaults, so `kubectl` by IP from elsewhere fails TLS | joiner addressing: `zeta-firstboot.conf` (§5b). Single-node: none needed | **OK (default)** for single node; **OPEN** for dual-NIC |
| 12 | **DNS resolvers** | none hardcoded — DHCP; CoreDNS forwards to host `resolv.conf` | a LAN whose DHCP hands out no resolver: installer cannot clone (caught), or pods have no DNS | installer preflight `git ls-remote $REPO_URL` + binary-cache probe exercise DNS **before the wipe**. No override | **OK (default)**: fails loud pre-wipe; no static-resolver injection |
| 13 | **NTP** | NixOS default `timesyncd` + `nixos.pool.ntp.org` | UDP/123 blocked ⇒ skewed clock ⇒ TLS (ACME, registries, GitHub) fails. The pre-wipe repo preflight prints the machine clock when it fails | none | **OK (default)** |
| 14 | **Timezone / locale** | `common.nix` `time.timeZone = lib.mkDefault "America/New_York"`, `i18n.defaultLocale = "en_US.UTF-8"`; installer ISO same | cosmetic: log timestamps and cron-style schedules read in the wrong zone. Never a failure | none (`mkDefault`, so a host can override) | **OK (default)** |
| 15 | **HTTP(S) proxy** | not supported anywhere (no `networking.proxy`, no containerd/k3s proxy drop-in) | behind a mandatory proxy the installer cannot reach GitHub (**bails pre-wipe, loudly**) and a hand-fixed node still cannot pull images | none | **UNSUPPORTED** (fails loud) |
| 16 | **Registry mirror** | `k8s/registry-mirrors.json` → `k3s-registry-mirrors.nix`: `mirror.gcr.io` for `docker.io` | a network that blocks `mirror.gcr.io`: containerd is expected to fall back to Docker Hub (k3s docs; not exercised here) with rate-limit risk on first boot, not a hard failure | none; single source of truth shared with the coverage probe | **OK (default)** |
| 17 | **Cluster join token / endpoint** | none in tree | joiner founds a rival cluster instead of joining | `zflash --role joiner --join-server-url --join-token` (§5, §5c, §6); shape enforced twice (`K10<hash>::…`); datastore + join-intent preflights | **DONE (prior)** |
| 18 | **Admin SSH keys** | `operator-ssh-keys.txt` (fallback); `PasswordAuthentication = false` | no key ⇒ no remote login; the console password is the only way in | `zflash --ssh-key` (default `~/.ssh/id_ed25519.pub`) → `/zeta-authorized-keys.pub` | **DONE (prior)** |
| 19 | **`zeta` console password** | `initial-password.nix` build-time default hash of the well-known `zeta-change-me`; the installer left it in effect whenever no password was typed (always, on the zero-typing path) | the SAME known password on every install, at the physical console (ssh password auth is off) | **an explicit install-time POLICY, `ZETA_CONSOLE_PASSWORD_POLICY=default\|mint`** (zflash `--console-password default\|mint` -> ESP `/zeta-firstboot.conf` -> exported by `zeta-first-boot.sh`; **repo default `default`, the OWNER's decision**). A password TYPED at the installer prompt always wins. With none typed: **`default`** = the PUBLIC `zeta-change-me` (sha512crypt via stdin, never argv), NOT locked, NOT minted, a loud console + serial banner at install, again in the install-complete summary, and a login-shell reminder until the hash changes; **`mint`** (explicit opt-in) = the per-install one-time password: 24 random base32 chars, shown ONCE on the console devices and never on the tee'd stdout, **locked** if it cannot be shown. Either is applied ONCE (state file), so a later `passwd zeta` is never reverted. An unknown policy value refuses the install before the wipe. SSH `PasswordAuthentication = false` is unchanged. Deliberately NOT `chage -d 0` (an expired password makes sshd demand a change even for key logins and breaks non-interactive SSH). **RISK, stated plainly:** under `default` anyone with console access is root via `sudo` (wheel, password-gated by a public password) - a physical-access threat model; do not use it on exposed hardware. Switch to the safe behaviour with `zflash --console-password mint` | **DONE (this PR)** - the Nix activation and reminder service are text-pinned only (no nix here); a system built without the installer still has the build-time default |
| 20 | **Wi-Fi credentials** | none in tree | no network ⇒ no install | console `nmtui`; **or** `--wifi-*` onto the ESP **in plaintext** (INJECTION-POINTS §4a divergence, recorded and unresolved) | **DONE (prior)** with a recorded rail divergence |
| 21 | **Longhorn disk selection** | installer enumerates internal, non-hotplug disks; WP28 sizing; extra non-blank disks need consent (#17747) | wiping/adopting the wrong disk; Longhorn starved on a big single disk | installer, with `LONGHORN1_TAIL`, `ZETA_LONGHORN_EXTRA_DISKS`; refusals before the wipe | **DONE (prior)** |
| 22 | **Repo URL / revision ArgoCD tracks** | every `Application`: `repoURL: https://github.com/Lucent-Financial-Group/Zeta`, `targetRevision: main` (incl. `root-application.yaml`, both install-time templates) | the node's OS is pinned to the ISO commit while the cluster follows `main` HEAD; a node with no route to GitHub (air-gap, firewall, fork, mirror) syncs nothing | **decided, not changed**: tracking `main` is the delivery model (the root's own header; the drift-and-heal ADR), the repo-pin governs only the OS clone. Recorded in `docs/DECISIONS/2026-10-01-the-cluster-tracks-main-while-the-os-is-pinned-to-the-iso-commit.md` with evidence; pinned by `cluster/root-tracks-main.test.ts`; the installer banner states the asymmetry on every install | **DECIDED (documented, with evidence)** - an install-time `repoURL` for offline/fork/mirror installs remains an OPEN owner decision |
| 23 | **Headscale server URL / tailnet domain** | `applications/headscale/configmap.yaml`: was `server_url: https://headscale.zeta.local`, `base_domain: tailnet.zeta.local` | `.local` is RFC 6762 mDNS-only: no client can resolve the control server | UNSET and SET alike: the in-cluster URL `http://headscale.headscale.svc:8080` (what this install actually serves), `base_domain: zeta-tailnet.internal`. **Deliberately NOT derived from the public domain**: that would mean publishing a Tailscale control server (an internet-facing registration endpoint) as a side effect of setting a domain - an operator decision, so no listener/route exists and a test pins that | **DONE for the placeholder; publishing is an open operator decision** |
| 24 | **Blueprint credentials** (`postgres` `PASSWORD`, the builder's `postgres` and `valheim` templates) | was `PASSWORD` defaulting to `change-me` in `applications/platform/blueprints.yaml` and `portal/src/blueprint-agent.ts` | every instance that did not set one ran with the SAME known password, in plaintext in its pod spec | a per-instance Secret `<instance>-credentials` (key `password`) via `envFrom`; the controller now templates the Secret name with `${RESOURCE_NAME}`; a missing Secret stops the pod at `CreateContainerConfigError` naming it. Pinned: no library Blueprint may carry a credential-named variable default or plaintext credential env | **DONE (this PR stack)** - operator creates the Secret (command in the Blueprint's comment); minting it in the controller is not done |
| 25 | **hat-system operator image tag** | `applications/hat-system/deployment.yaml` image `...:placeholder` | `ImagePullBackOff` IF the Deployment is ever scaled up before a real image exists | none - the image is not published. The Deployment ships `replicas: 0`, so nothing pulls it; that is now a CHECKED property: the placeholder lint fails (no baseline can excuse it) the moment a workload carries a `:placeholder` image with `replicas != 0` | **DONE (guarded, not published)** - needs a real build to shed the tag |
| 26 | **Dynamic DNS hosts / registrar secret** | `applications/ddns/cronjob.yaml` `DDNS_HOSTS: "@ *"`; secret `namecheap-ddns` (operator-supplied) | updates the wrong records, or fails without the secret | none | **OPEN** (operator step) |
| 27 | **`gmod-sftp` Service type** | `applications/game-hosting/gmod/service.yaml`: unconditionally `LoadBalancer` | one of the LoadBalancer pool's addresses spent on a port that answers nothing (SFTP is opt-in: no keys ConfigMap => nothing listens) | `ClusterIP` by default; the opt-in is `kubectl -n game-hosting patch svc gmod-sftp -p '{"spec":{"type":"LoadBalancer"}}'`, and the Application ignores that field's drift (`ignoreDifferences` + `RespectIgnoreDifferences`) | **DONE (this PR stack)** |
| 28 | **Forgejo public URL** (`DOMAIN` / `ROOT_URL` / `SSH_DOMAIN`) | the chart default, never set in this tree: renders `git.example.com` (measured, chart 17.1.5) | an RFC 2606 name in every clone URL and redirect; nothing exposes Forgejo off-cluster | UNSET: the in-cluster Service names. SET: `git.<domain>` - its own listener + certificate + route on the public Gateway and Job `forgejo-public-hosts` merge-patching the Application's helm parameters (the GitLab shape, a separate Job scoped to Application/forgejo) | **DONE (this PR stack)** |
| 29 | **Storage profile** (the size of every Longhorn PVC: `minimal` / `standard` / `measured` / `large`) | the committed tree is written at ONE rung (`activeStorageProfile`, `measured`, 943 GiB declared); the installer refused any pool smaller than that | a perfectly ordinary single-1-TB-disk box (810 GiB tail → **607 GiB** schedulable) was **REFUSED**: `short by 336 GiB`, with every remedy a manual flag or a destructive wipe. node-5b2dfa, measured | **automatic, at install time**: the installer measures the pool it provisions and installs the **largest** profile whose declared demand fits (`standard`, 571 GiB, for 607), refusing only when even `minimal` (204 GiB) does not. Override: `zflash --storage-profile auto\|<name>` → `ZETA_STORAGE_PROFILE` (or the env var in a shell). Written as `/etc/zeta/storage-profile` **only for a rung that differs from the committed one** → `injected-storage-profile.nix` → `zeta-storage-profile` Application (`k8s/storage-profile/`) → one Job per Application merge-patches the size leaves; `zeta-root` ignores exactly those. **NEVER shrinks** | **DONE (this PR)** - see "The storage profile (row 29)" |
| 30 | **Node-side public names** (`gitlab.<d>`, `registry.<d>` as the NODE's resolver sees them) | nothing: the node's `/etc/hosts` was NixOS's read-only symlink, so the names resolved to the PUBLIC IP | the kubelet/containerd resolve through the HOST resolver, got the public IP, and the router does not hairpin: every pull from the in-cluster registry failed `dial tcp <public-ip>:443: i/o timeout` (pods were fine - CoreDNS). node-5b2dfa, measured 2026-10-02 | the **same** `/etc/zeta/public-domain` row 1 uses → `nixos/lib/public-hosts.nix` (pure) → `injected-public-hosts.nix` → `networking.hosts`: those two names, **only** those, on the node's own loopback, which the `node-lan-hosts` relay forwards to the Gateway. Loopback, not the Gateway's address, because that address is cluster state a static line cannot know and would shadow. Absent domain → nothing | **DONE (this PR)** - decision: `docs/DECISIONS/2026-10-02-the-router-reaches-the-node-not-a-loadbalancer-address-so-the-node-serves-443-itself.md` |
| 31 | **Node inbound HTTPS** (TCP 443 on the node's firewall) | `nixos-fw` had no 443 rule | the router forwards to the node (not a LoadBalancer address); the node's relay listened and the firewall dropped the SYN. Public HTTPS never arrived. node-5b2dfa, measured | `nixos/modules/node-public-https.nix`, imported by `k3s-server.nix` **and** `k3s-agent.nix`: TCP 443 open on every node, **unconditional** (a rule gated on the public-domain file would close silently under a pure rebuild). TCP 80 stays **closed** on purpose: nothing on the host listens on it | **DONE (this PR)** |
| 32 | **Operator sudo** (how the operator becomes root) | `wheelNeedsPassword = true`; the v1 installer MINTED a one-time console password, shown once | SSH key login worked and `sudo` did not: the password scrolled off, nobody held it. node-5b2dfa, measured | already: row 19's policy (`--console-password default` is the repo default; `mint` is opt-in). New: `zeta.operatorSudo.sshAgentAuth` (**OFF by default**, `operator-sudo.nix`) lets sudo accept the forwarded ssh-agent over the SSH-login keys, and `docs/ops/OPERATOR-SUDO-BREAK-GLASS.md` is the no-wipe recovery. `NOPASSWD` rejected. **No zflash flag**: key-based sudo is the owner's call, not an installer default | **DONE (this PR)**, opt-in |
| 33 | **Kubelet disk thresholds** (image GC, container logs) | kubelet defaults: image GC at 85%/80% used, eviction at `imagefs.available<15%` (= 85% used) | GC's start and the eviction line were the SAME number, so GC had no head start: a CI burst evicted ~150 pods (DiskPressure) on a 119 GiB root. node-5b2dfa, measured (`docs/ops/NODE-DISK-HEADROOM.md`) | `k3s-process-protection.nix` (both roles): `image-gc-high/low-threshold` 75/65, `container-log-max-size` 10Mi, `container-log-max-files` 3. The eviction-hard map is NOT lowered (option C). The structural fix - a dedicated containerd partition or a larger root - changes the disk layout and stays the owner's reinstall-time decision | **DONE (cheap half)**; structural half **OPEN (owner)** |
| 34 | **ACME solver** (HTTP-01 default vs Cloudflare DNS-01) and its token Secret | `k8s/public-tls/resources.yaml`: both issuers carry a label-selected `dns01` solver; Secret `cloudflare-api-token` (ns `cert-manager`) and the Gateway label `zeta.io/acme-solver=dns01` are **operator steps** | a router that cannot deliver :80 to the right address leaves HTTP-01 pending (row 31's facts) | none: the installer asks for no token (a third-party credential is never minted or baked) and sets no label. `docs/ops/CLOUDFLARE-DNS01-CERTS.md` is the operator path; the `--acme-solver` install-time flag is its recorded follow-up | **OPEN (follow-up, deliberate)** |

## Why the pod/service CIDR is detected, not injected (row 4)

`cluster-identity.json` says it plainly: Cilium's `clusterPoolIPv4PodCIDRList` /
`ipv4NativeRoutingCIDR` live in checked-in YAML that ArgoCD reconciles **from git**, so a per-USB
cluster name could not move them — an injected name would put the CNI on one network and k3s on
another with nothing to say so. So the lever is *detection*: refuse the install while refusing is
free, and name the two real remedies (renumber the network, or change `clusterName` and rebuild).
`lint-cluster-cidr-agreement.ts` and the assertions in `cluster-network.nix` keep every surface
consistent after such an edit.

## What the installer does now (rows 3–4), in order

All of it runs at **Step 0.5/0.6, before disk enumeration** — nothing has been wiped when any of
these refuse.

1. `zeta_lan_detect` measures the interface that owns the route to the internet: address, prefix,
   gateway (`ip -4 -o route get 1.1.1.1`, `ip -4 -o addr show dev …`). If it cannot, it says so and
   every later check is marked **degraded** — never silently skipped.
2. The cluster's derived pod/service CIDR (`zeta_cluster_cidrs`, a shell twin replayed against
   `nixos/tests/cluster-cidr-golden-vectors.json`) and the inter-node segment are compared with
   every network the node can already route to. Overlap ⇒ **refuse**.
3. `ZETA_LB_POOL` from the ESP is validated and probed; a value that cannot work **refuses the
   install** when nobody can be asked, and re-asks at a console. `auto` derives `.240–.250` of the
   node's /24 and refuses if the window is not clear.
4. No ESP value: a console is asked (a one-keypress gate on the zero-typing first-boot path,
   `LB_POOL_PROMPT_SECS`, default 20 s); nobody there ⇒ **UNSET, loudly**.
5. After the clone, the collision and the range are re-checked against the **cloned** tree's
   `clusterName`, because the ISO's copy may be older than `main`.

## Operator quick reference

```text
zflash --lb-pool 192.168.1.240-192.168.1.250    # explicit, validated against the LAN at install
zflash --lb-pool auto                           # .240-.250 of the node's /24; refused if in use
(no flag)                                       # prompt at a console; else UNSET, loudly
ZETA_ALLOW_CIDR_OVERLAP=1                       # install despite a pod/service-vs-LAN overlap (named in the refusal)
LB_POOL_PROMPT_SECS=60                          # widen the first-boot keypress window
# after install, on the control plane:
echo '192.168.1.240-192.168.1.250' | sudo tee /etc/zeta/lb-pool
sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#<host>
sudo k3s kubectl get ciliumloadbalancerippool zeta-lb-pool
```

The range must be **free addresses on the node's LAN and outside the router's DHCP range**. The
ping probe is evidence, not proof: a host that does not answer ICMP is invisible to it.

## The storage profile (row 29)

**The defect, measured.** node-5b2dfa — one 1 TB boot NVMe plus one 1 TB NVMe carrying old Longhorn
data — was refused before anything was wiped:

```text
longhorn1 tail on /dev/nvme0n1   810 GiB   (LONGHORN1_TAIL=810G)     raw pool 810 GiB x 75% -> 607 GiB
committed roster DECLARES        943 GiB   ERROR: ... short by 336 GiB.
```

The refusal compared the pool against ONE number — the `measured` rung's total — as if the ladder did
not exist. It does: `full-ai-cluster/k8s/storage-profiles.json` prices the same claims at four install
rungs, and the installer now **chooses** one instead of refusing. This is the **existing** storage-profile
ladder (the repo has three — resource rungs, storage profiles, the runner disk envelope — and no fourth);
`ci` stays the hosted runner's and is not offered to a node.

| rung | declared on a fresh install | what it trades |
| --- | --- | --- |
| `minimal` | 204 GiB | cockroachdb and nats drop to 1 pod (**no Raft quorum**), redis to 2, retention halves |
| `standard` | 571 GiB | `ollama` and `vllm` PVCs 200Gi → 48Gi; **nothing that provisions at bring-up changes** |
| `measured` | 943 GiB | the committed tree — selecting it writes nothing |
| `large` | 1561 GiB | the sizes `storage-profiles.json` prices above `measured` |

The numbers are what each rung **actually requests** (`installDemandGib`), not its catalogue total: a
claim an install-time choice cannot resize keeps its committed size and is charged at it (below
`measured` that is +12 GiB, which is why `minimal` is 204 and not 192), and the one claim nothing applies
cannot consume bytes today. All of it is **generated** from the catalogue —
`bun src/Core.TypeScript/cluster/storage-profile-install.ts --write` regenerates the installer's shell
table, its TypeScript twin, the kit and the root's ignore set, and `storage-profile-install.test.ts` fails
when any of them is not byte-for-byte what the catalogue derives.

**What the installer does**, in order (Step 2.8, before the wipe, with the arithmetic on screen):

1. Measures the pool it provisions (the `longhorn1` tail + every non-boot disk whole, × 75%).
2. `auto` (the default; `ZETA_STORAGE_PROFILE` unset or `auto`): picks the **largest** rung that fits, prints
   the whole ladder with what fits, names the choice and **what it changes** against the committed rung
   and **which claims it cannot change** (`agent-memory`, `game-hosting-gmod`, `headscale`, `portal` are
   git-path Applications on a `directory` source, which has no patch surface).
3. **Refuses only when even `minimal` does not fit**, with the three remedies it always listed: add a
   second internal disk, raise `LONGHORN1_TAIL` (sized from the smallest rung), or
   `ZETA_ALLOW_LONGHORN_UNDERSIZED=1` — under which an `auto` choice that fits nothing proceeds on the
   committed tree, exactly as before (the QEMU lanes that run under the override are unchanged).
4. Writes `/etc/zeta/storage-profile` only when the choice differs from the committed rung.

**Forcing a profile.** `zflash --storage-profile <auto|minimal|standard|measured|large>` (device, Windows
and file-backed paths; `--dry-run` shows the `ZETA_STORAGE_PROFILE='…'` line it would put on the ESP), or
`ZETA_STORAGE_PROFILE=<name>` in the environment. A name is forced as asked and refused before the wipe if
the pool cannot hold it (the refusal names what `auto` would have chosen); a name that is not a rung is
refused, never quietly read as `auto`.

**Reaching the cluster.** The same path as rows 1–3: `injected-storage-profile.nix` reads the file at
evaluation time and adds the `zeta-storage-profile` ArgoCD Application to the k3s roster. Its kustomize
base (`k8s/storage-profile/`, GENERATED) carries no profile; one inline patch writes the rung name into a
ConfigMap, and one Job per Application the profile moves (`kubectl wait --for=create`, then a JSON merge
patch of that rung's size / pod-count / retention leaves — the `gitlab-lan-address` shape) patches the
git-owned Application. The root ignores exactly those leaves (generated region of
`bootstrap/root-application.yaml`). `vllm` became a **kustomize** source (a `directory` source has no patch
surface) to be reachable; it applies the same manifest it did.

**THE COST, STATED.** Those leaves are installation-owned: a later commit that edits one of them in source
control does not reach a cluster that already synced the Application, because the root keeps the live
value. The way to resize is the install-time profile.

### Growing later without a reinstall — and the part that is NOT automatic

```text
# 1. add capacity: mount the new disk and add it to the node in Longhorn (UI, or `kubectl -n longhorn-system
#    edit nodes.longhorn.io <node>`). NOT automatic: the `default-disks-config` annotation only applies at a
#    node's FIRST registration (nixos/modules/longhorn-disks.nix), so a disk added later is Longhorn's own
#    operation, not a rebuild.
# 2. raise the profile:
echo standard | sudo tee /etc/zeta/storage-profile       # or measured / large
sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#<host>
sudo k3s kubectl -n kube-system get jobs | grep zeta-storage-profile
```

The profile's name is part of every Job's **name**, so a change is a *new* Job (ArgoCD prunes the old one)
rather than a completed Job nobody re-runs. **Longhorn can expand a volume** (`allowVolumeExpansion: true`
on both Longhorn classes), **and Kubernetes cannot shrink one.** So:

- **Profile selection never shrinks.** The installer never goes below the profile a recognised prior install
  ran (it recovers `/etc/zeta/storage-profile` and the high-water mark from the old root), an explicit
  request below it is refused as a shrink, and the Nix module takes the **higher** of the file and
  `/var/lib/zeta/storage-profile-high-water`, which every activation updates. `ZETA_STORAGE_PROFILE_FLOOR=none`
  is the named act of someone who is destroying those volumes on purpose; deleting the high-water file is its
  node-side twin. A re-run on a live cluster therefore cannot select smaller than what is applied.
- **Growth through the Application is NOT always a plain GitOps converge.** A Deployment-style PVC grows when
  the chart value changes. A **StatefulSet's `volumeClaimTemplates` are immutable**: ArgoCD's sync of a larger
  size is refused by the API server (`updates to statefulset spec ... are forbidden`, the same error
  `adoption-immutable-fields.ts` documents for spire). For those claims (cockroachdb, redis, nats, mimir,
  weaviate, tempo, hindsight, openziti, prometheus/alertmanager/grafana) the profile change moves the
  *declaration*, and the live volumes need the standard expansion steps: `kubectl patch pvc <name> -p
  '{"spec":{"resources":{"requests":{"storage":"<new>"}}}}'` for each, then `kubectl delete statefulset <name>
  --cascade=orphan` so ArgoCD re-creates it with the new template. Nothing here automates that, and nothing
  here has done it on a live cluster.

### Not verified (row 29 specifically)

- **Nothing has been booted** — no nix and no QEMU locally. The Nix module is pinned on its text; the shell is
  executed (the real `assert_longhorn_pool_holds_the_roster` runs under bash against the owner's numbers) but
  `blockdev` is stubbed.
- **That ArgoCD's kustomize applies the inline patches as `storageProfileObjects` mirrors them**, including
  the patch that renames a Job to carry the profile.
- **The race.** The Jobs patch an Application *after* `zeta-root` creates it, and ArgoCD starts reconciling a
  new Application at once. The Job's init container is already waiting and patches within a second, and a
  new Application must first be rendered by the repo-server — but if a first sync created a StatefulSet at the
  committed size before the patch landed, the API server refuses the shrink and that Application sticks
  OutOfSync. For `standard` every claim that provisions at bring-up already equals the committed size, so the
  race can only matter for `minimal`.
- That the first real install on a pool like node-5b2dfa's places what `standard` declares.

## Not verified (stated, not implied)

- **Nothing here has been booted.** No nix and no QEMU were available; the Nix module
  (`injected-lb-pool.nix`) and the new assertions in `injected-public-tls.nix` are checked by review
  and by tests on their *text* (`cluster/lb-ipam-pool.test.ts`), not evaluated. `nixos-install`
  with a real `/etc/zeta/lb-pool` is the first real exercise.
- That ArgoCD's bundled kustomize applies the inline JSON6902 patch as `cluster/lb-ipam-pool.ts`
  mirrors it, and that Cilium accepts a `CiliumLoadBalancerIPPool` created with `spec: {}` plus a
  `blocks` patch (the base is never applied alone).
- That a real `ip -4 -o route get` / `addr show` prints exactly the fixtures' shape on the live ISO.
- Existing nodes: `cilium-lb-ipam` has `prune: false`, so an already-applied `zeta-lb-pool` is not
  deleted when `ip-pool.yaml` leaves git — but a node flashed from an *older* ISO has no
  `lb-pool` file either, and keeps the old pool only because nothing prunes it.
- Row 6: that ArgoCD honours a merge patch of three `valuesObject` leaves under `RespectIgnoreDifferences`
  (the same behaviour the public-TLS `parameters` patch already depends on), and that the `gitlab-runner`
  subchart's `tpl` sees `global.zeta` on a real sync (it does under `helm template`, which the tests render).
