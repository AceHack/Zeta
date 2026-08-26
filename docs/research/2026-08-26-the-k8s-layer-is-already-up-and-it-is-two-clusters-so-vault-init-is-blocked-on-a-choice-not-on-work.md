# The k8s layer is already up — and it is two clusters. So Vault init is blocked on a choice, not on work

**Date:** 2026-08-26 · **Author:** shadow · **Register:** mixed, labelled per claim
**Task framing:** Aaron — *"route bringing up the k8s layer and initializing vault."*

> **Nothing in this note was executed against a cluster.** No manifest was applied, no
> `vault operator init` was run, no key, token, or share was generated, read, or handled.
> Every measurement below is an outbound read: ICMP, a TCP connect, a TLS handshake, the
> local ARP table, and files in this repository.

---

## 0. The premise this work started from was wrong, and the correction matters

The brief said: *both kube contexts refuse connection, there is no container runtime, and
`TOPOLOGY.md` states nothing has been applied to any cluster — so establish whether the
gap is "installed but never bootstrapped" or "never installed."*

It is **neither**. Measured 2026-08-26:

> **The k8s layer has been up since 2026-06-09. There are two live k3s control planes on
> the LAN, they are two independent clusters, and this workstation holds credentials for
> neither.**

The two kube contexts that refuse connection are `kind-zeta-ci-podman` and
`kind-zeta-local-included` — both point at `https://127.0.0.1:*`, both are local `kind`
clusters, and they refuse because the podman VM is stopped. They were never the physical
estate. There is **no kubeconfig entry for the real cluster at all**, which is why every
`kubectl` probe read as "the cluster is down".

A container runtime does exist: `podman` is installed with a machine created two months ago
(`podman machine list` shows it, last up two weeks ago), alongside `kind`, `k3d`, `helm`,
`kubectl` and `nix`. The machine is merely stopped, which is also why the Docker socket is
absent and `kind get clusters` fails.

This is worth stating plainly because it inverts the work: **bring-up is not an
installation problem. It is a reconciliation-and-decision problem**, and the decisions are
Aaron's.

---

## 1. Ground truth (register: **metered** — executed and observed here)

### 1.1 The estate answers

| # | Measurement | Result |
|---|---|---|
| M1 | This workstation's subnet | `192.168.4.116` / `192.168.4.190`, gateway `192.168.4.1` |
| M2 | `hosts/control-plane/configuration.nix` static IP | `192.168.1.10`, gateway `192.168.1.1` — **a different subnet**; the declared address is not the one in use |
| M3 | Ping sweep of `192.168.4.0/24` | 18 live hosts |
| M4 | Hosts with `6443` **or** `10250` open | exactly **two**: `192.168.4.152`, `192.168.4.153` |
| M5 | `192.168.4.152` ports | 22 open, 6443 open, 10250 open; 8200/80/443 closed |
| M6 | Unauthenticated `GET /version` on both | HTTP **401 Unauthorized** — a real, healthy apiserver enforcing auth |

Controls were run for every negative, because a negative from a broken instrument is a
check that did not run:

- `nc` reports `rc=1` on a known-closed port (`127.0.0.1:59999`) — so "closed" is a real
  reading, not a silent failure.
- mDNS browse works on this LAN: `_services._dns-sd._udp` returned 90 lines of live
  services. Against that control, `_zeta-k3s._tcp` returned **nothing** — the discovery
  advertisement in `nixos/cluster-discovery/` is not live.
- `.local` resolution works: `AceHacks-Mac-Studio.local` pings `rc=0`. Against that
  control, `control-plane.local`, `node-ad1efd.local`, `node-542b91.local` and
  `node-b1e1b5.local` all fail to resolve. **No cluster node publishes an mDNS hostname.**

### 1.2 The two nodes identify themselves — differently

Read from each API server's TLS certificate chain:

| | `192.168.4.152` | `192.168.4.153` |
|---|---|---|
| SAN node name | `node-ad1efd` | **`node-542b91`** |
| CA subject | `CN=k3s-server-ca@1780996293` | `CN=k3s-server-ca@1782009400` |
| CA epoch decoded | 2026-06-09T09:11:33Z | 2026-06-21T02:36:40Z |
| CA **public key** SHA-256 (16) | `d10d70706bf61b0f` | `682c3123d78546aa` |
| ARP MAC | `90:10:57:6e:7e:72` | `80:84:89:01:c5:16` |
| Leaf validity | Jun 9 2026 → Jun 9 2027 | Jun 21 2026 → Jun 21 2027 |

**The two CAs have different public keys.** That is the load-bearing measurement, and it is
a proof rather than an inference: two k3s servers in one cluster share a CA; two servers
that each ran `--cluster-init` never do. Comparing the issuer *strings* would have been
weaker — the string is just a name with an epoch in it. The keys were compared directly,
twice, by two different digests, and they differ both times.

> **Therefore the estate is not one cluster with two nodes. It is two clusters of one node
> each, both of which believe they are `control-plane`, and both of which own `10.43.0.1`.**

Node `.152`'s CA was created 2 minutes 16 seconds after `node-ad1efd`'s recorded
registration timestamp (`2026-06-09T09:09:17Z`) — so k3s founded its cluster at
provisioning time, exactly as configured.

### 1.3 The inventory disagrees with reality

`maintainers/*/cluster-nodes/*/node.yaml` holds four records. Against them:

| Defect | Evidence | Register |
|---|---|---|
| **D1** — `80:84:89:01:c5:16` is recorded as `node-b1e1b5`; the machine's own certificate says **`node-542b91`**, with a CA minted 12 days after the record. The machine was re-provisioned and the record never followed. There is **no `node-542b91` record in the repo.** | cert SAN vs `node-b1e1b5/node.yaml` | metered |
| **D2** — `node-5b2dfa` and `node-f82aa6` record the **same MAC** `b0:41:6f:17:87:cc`. One MAC cannot name two machines, so the record→observation mapping is ambiguous. | both `node.yaml` files | metered |
| **D3** — Neither maximdolphin node is reachable from here; both records carry `ip: ""`. | ARP + sweep | metered |
| **D4** — Both Addisons820 records carry `flake-host: "control-plane"`. | both `node.yaml` files | metered |

### 1.4 The root cause of the split (register: **metered**, mechanism read from the code)

D4 is the mechanism, and it is nobody's mistake:

- `full-ai-cluster/nixos/modules/k3s-server.nix` sets `clusterInit = lib.mkDefault true`.
- Both machines were flashed from the **`control-plane`** flake host, which imports that
  module.
- `--cluster-init` **founds** a cluster. It does not join one.

> **Every machine flashed from the `control-plane` host founds its own cluster.** Two
> machines flashed that way are two clusters, deterministically. A third would be a third.

And the join path is independently broken, which is why nothing self-corrected:
`k3s-agent.nix` sets `serverAddr = "https://control-plane:6443"`, and **`control-plane` does
not resolve on this LAN** (§1.1). So a worker flashed from `worker-gpu` or
`worker-template` could not have joined either cluster even if one had been designated.

This is the "no intelligence assumes malice where a mistake is possible" case in its
ordinary form: a default that is correct for the first machine, applied a second time.

---

## 2. What this does to Vault

`full-ai-cluster/k8s/applications/vault/TOPOLOGY.md` is in good shape and its section 5
already designs the init ceremony conservatively. `audit-vault-topology-coherence.ts`
passes **0 findings against 12 rules** — rc=0, run in a checkout with `node_modules`
present; the audit and `Application.yaml` were confirmed byte-identical (`git hash-object`)
to the versions on `origin/main`, so the result carries. The manifest declares
`cluster.zeta.io/topology: single-node` at `replicas: 1`, which — given §1 — is the
*correct* shape for any one of these clusters.

But the audit is honest that it reads the **values**, not a cluster. Nothing in the repo
compared the declared topology against the **actual estate**, and that is the gap this note
closes with code (§5). The consequence, stated as sharply as it deserves:

> `vault operator init` mints a root token and the unseal shares **once**, against whichever
> cluster the operator's kubeconfig happens to name. With two clusters and no kubeconfig,
> the subject of the most irreversible command in this repository is currently
> **unidentified**.

That is the real blocker, and it sits *before* every custody question below. It is also
not a large amount of work — it is one decision plus a re-provision.

---

## 3. The ordered bring-up, with reversals

Each step names its precondition, its reversal, and who may run it. Steps 1–3 are
prerequisites nobody had named.

| # | Act | Precondition | Reversal | Who |
|---|---|---|---|---|
| 1 | **Repair the inventory**: resolve D2 (duplicate MAC), and re-record the machine at `.153` under the name it actually serves (`node-542b91`). | none | git revert — records are text | agent, once Aaron says which of D2's records is real |
| 2 | **Choose which cluster is THE cluster.** | step 1 | none needed — it is a decision, not an act | **Aaron only** |
| 3 | **Re-provision the losing node(s) as agents** against the chosen server, and give `control-plane` a resolvable address (static host record, or make the `_zeta-k3s._tcp` advertisement live). | step 2 | **NOT REVERSIBLE** — destroys the losing node's cluster state. It holds nothing today, which is precisely why doing it now is cheap. | Aaron / a maintainer at the node |
| 4 | **Fetch a kubeconfig** for the chosen cluster and rewrite its server from `127.0.0.1` to the node address. k3s writes it at `/etc/rancher/k3s/k3s.yaml`, mode `0640`, group `wheel` (`--write-kubeconfig-mode=0640 --write-kubeconfig-group=wheel`), so a wheel member can read it over SSH (port 22 is open). | step 3 | delete the context | **Aaron** — it is a credential |
| 5 | **Establish what is actually deployed** (ArgoCD from `k8s/bootstrap/`, `zeta-local-path`, Vault). Unknown today: **it cannot be seen without a credential, and is not guessed here.** | step 4 | read-only | agent |
| 6 | **Apply the bootstrap** if absent (`k8s/bootstrap/root-application.yaml` and friends). | step 5 | `kubectl delete -f`; ArgoCD `prune: false` on Vault | agent, after Aaron approves the target |
| 7 | **Let Vault sync** (sync-wave `-60`) and come up **sealed**. `vault status` exits `2` when sealed and `1` on error — a NotReady pod exiting `2` is an uninitialised Vault behaving correctly. | step 6 | delete the Application | agent |
| 8 | **The init ceremony.** | §4 decided | **NOT REVERSIBLE — mints once** | **Aaron, biometric-gated** |

---

## 4. The ceremony design

### 4.1 The machinery already exists and should be used, not re-derived

`tools/setup/persona-keys/ceremony-handoff.ts` (merged #15597) provides `runGatedCeremony`,
whose ordering guarantee is structural rather than documentary — the sequence *is* the
function body: **classify → resolve credentials → specify → measure → (dry-run exit) →
brief + biometric → act → measure**. Approval provably follows authentication because
`resolveSecret` runs before `requireBiometric`, and that order is pinned by an event-log
test. It defaults `dryRun` to **true**, and a dry run never touches the biometric door, so
planning cannot habituate an operator into approving.

Everything a Vault ceremony needs is there: unseal keys and the root token are a natural
`SecretRequirement[]` resolved through `keychainSecretSource`, and each refusal carries the
store's own remedy.

### 4.2 But the ceremony cannot be written yet, and this is a decision for Aaron

`src/Core.TypeScript/federated-identity/ceremony-gate.ts` declares a **closed set** of 25
operations as a string-literal union, classified by a `switch` with **no `default` arm** —
so adding a member is a type error until someone classifies it and writes its `reason`.

**No member covers Vault initialisation or unsealing.** The full set was read; the nearest
neighbours are `generate-node-root-key`, `open-authenticated-hsm-session` and
`export-or-destroy-key`, and none of them fits. `runGatedCeremony` calls
`assertGatedCeremony`, which **throws** for an unclassified operation.

> So a Vault-init ceremony is not merely gated — it is currently **unnameable**. Extending a
> closed set is exactly the friction the design intends, so this note **proposes and does
> not add**:
>
> | proposed member | classification | draft `reason` (quoted verbatim to the operator) |
> |---|---|---|
> | `initialize-vault-seal` | `biometric-ceremony` | "Mints the Vault root token and the unseal key shares. It happens once per cluster and cannot be undone or repeated; losing the output destroys the data, leaking it compromises everything the Vault will ever hold." |
> | `unseal-vault` | `biometric-ceremony` | "Reconstitutes the Vault barrier key from threshold-many shares, making every stored secret readable. It is the moment the shares are in one place." |
>
> Adding these is a maintainer decision and a one-line-each change plus its classification
> arm. It is not done here.

### 4.3 One honest limit to carry into the design

`ceremony-handoff.ts` states its invariant 2 is *partial*: it refuses a knowably-absent
credential but **cannot prove no prompt appears**, because programs like `gpg`, `ssh-keygen`
and `yubihsm-shell` prompt on a tty regardless. `vault operator init` and
`vault operator unseal` are exactly that class. Any implementation must use
`-format=json` with non-interactive flags and run with stdin closed, and must record the
limit rather than imply a guarantee.

Also: `ceremony-gate.ts` discloses its own vacuity — `ceremonyRequirementFor` is a
**classifier, not an enforcer**. It returns a label; nothing stops a caller ignoring it.
Enforcement lives in `assertGatedCeremony`. Worth knowing before treating the gate as a
wall.

---

## 5. What shipped (register: **metered** — written, tested, and run here)

`full-ai-cluster/tools/cluster-bringup/` — a **read-only** ladder that answers the one
question nothing answered: *is this estate one cluster?*

- `estate.ts` — the pure core. Three rungs mirroring `Readiness<TStage>` from
  `ceremony-handoff.ts` (**ready 0 / actionable 3 / blocked 1**, usage 2), five blocked
  stages, each of which **cannot be added without a remedy** because `blocked()` validates
  the refusal it is handed.
- `probe.ts` — the IO half: ICMP, TCP connect, TLS handshake, ARP, `kubectl config view`.
  Read-only, no shell, every argument a literal.
- `cli.ts` — `status` and `plan`. **There is no `apply` verb and the file says why there
  must not be one.**
- `estate.test.ts` + `probe.test.ts` — **38 tests, rc=0.**

Why it is mirrored rather than importing `ceremony-handoff.ts`: that module's dependency
graph reaches `biometric.ts`, and **a read-only prober must not have a biometric door
anywhere on its graph.** It also sits outside `tools/setup/persona-keys/`, so it is not
scanned by the `ceremony-reachability.test.ts` `LIVE_BY_DEFAULT` ratchet — correctly, since
it can perform nothing.

**The falsifier is falsifiable.** Three mutants were introduced deliberately and every one
went red, then green on restore:

| mutant | result |
|---|---|
| split-brain check disabled (`identities.length > 99`) | **2 tests failed** |
| MAC normalisation neutered (`padStart` removed) | **1 test failed** |
| inventory reconciliation disabled (`if (false)`) | **2 tests failed** |
| restored | **27 pass, 0 fail** |

**Run against the live estate it reports `blocked` / `duplicate-mac-in-inventory` (rc 1)**,
naming D2. With one colliding record temporarily parked — a measurement, restored
immediately, worktree verified clean — it advances to **`blocked` / `control-plane-split`
(rc 1)**, naming both CAs. So the tool independently reproduces §1.2 and §1.3 from a cold
start.

One test earned its keep during development: the `flake-host` regex was anchored to a bare
key and silently returned `undefined` for **every real record**, because the field appears
annotation-prefixed. That is the vacuity class — a parser that reads nothing looks exactly
like a field that is absent.

### Stated limits of the tool

- It discovers nodes by matching recorded MACs against the **local ARP table**. A node that
  is powered on but has not exchanged a packet with this workstation is not in ARP and will
  not be probed. `--address <ip>` is the escape.
- It cannot see **inside** a cluster it has no credential for. It says nothing about whether
  ArgoCD, storage, or Vault are deployed, and does not guess.
- The doors (ICMP/TCP/TLS/arp/kubectl) are **not** unit-tested — mocking them would pin the
  mock. The parsers are tested against verbatim captured output.
- `markdownlint` ignores `docs/research/2026-*-*.md`, so an rc=0 from it on **this file** is
  vacuous and is not claimed.

---

## 6. THE QUESTION ONLY AARON CAN ANSWER

> **Where do the unseal keys and the root token go?**

Five options. The first thing to know is that **one of them is not available at all**, and
that removes the circular dependency the brief anticipated.

| | Option | Available on the binary we run? | Failure mode | Recovery | People present |
|---|---|---|---|---|---|
| **A** | **Shamir, shares held offline** (paper / hardware, distributed to distinct humans) | **Yes — today** | A human must unseal after **every** pod restart. On single-node k3s that is every reboot. | Threshold-many custodians reconvene | k of n, every unseal |
| **B** | **Shamir, shares under the repo's `ca-shamir-custody.ts` scheme** | Yes | **See the trap below.** | Same | Same |
| **C** | **Auto-unseal via YubiHSM PKCS#11 on Vault** | **NO — Enterprise-gated** | n/a | n/a | n/a |
| **D** | **Transit unseal via another Vault** | Yes, in principle | Recursive: the transit Vault must itself be unsealed, and we have two uninitialised clusters | Inherits the root problem | Same, one layer down |
| **E** | **OpenBao + `seal "pkcs11"` + YubiHSM** | Yes — **MPL-2.0, no licence gate** | Owning a cgo build or a plugin pin; seal becomes an external plugin at v2.7.0 | Device + its backup | **Zero** at unseal |

**C is measured-unavailable, not merely unattractive.** `docs/research/2026-08-20-hsm-tpm-into-vault-and-cert-manager-yes-for-tpm-but-not-through-vault-openbao-is-the-answer.md`
records HashiCorp's own page: *"Auto-unseal and seal wrapping for PKCS11 require Vault
Enterprise."* There is **no `tpm` seal type at all**. A `seal "pkcs11"` stanza on the
HashiCorp chart produces a server that **refuses to start** — and
`audit-vault-topology-coherence.ts` already refuses that stanza by rule
(`seal-stanza-requires-vault-enterprise`), so the wrong turn is caught by a check rather
than by a paragraph.

### The trap in option B — please read before choosing it

`ca-shamir-custody.ts` implements k-of-n Shamir over GF(257) with golden vectors and a
strong test suite (a 2-of-4 split reconstructs a byte-identical Ed25519 key that
`ssh-keygen -y` accepts). It is good code. But:

> It writes **all n shares to one directory on one machine** —
> `~/.config/zeta/ca/shares/<ca>/share-NN.json` — as **plain, unencrypted JSON**, mode
> `0600`. It records **no custodian identity**, and warns in prose that distribution is
> out-of-band.

For a cold backup of a local CA that is a defensible design. For Vault unseal shares it
means that **until a human distributes them, the threshold is defeated**: anyone who can
read that directory has all n shares, which is strictly worse than a single key, because it
*looks* like k-of-n. It is also not classified in `ceremony-gate.ts` at all.

So: reusing the scheme is reasonable; reusing it **as storage** is not. If B is chosen, the
share files should be treated as transient output that is moved to custodians and deleted.

### The ordering hazard, answered

The brief asked whether Vault init is blocked behind a Touch ID ceremony that is itself
blocked, because the YubiHSM's `zeta-frost-wrap` key does not yet exist.

**Under A, B and D: no.** Those need no HSM, so the YubiHSM chain is irrelevant to them and
Vault init is not blocked on it.

**Under E: yes, and it is a real chain, not a cycle** —

```
YubiHSM wrap key provisioned   (frost-hsm-provision.ts apply --apply, Touch ID)
        ↓
OpenBao built with PKCS#11 via cgo, or the external plugin pinned
        ↓
seal "pkcs11" configured  — OpenBao "requires key material to be created externally
                            before initializing the instance"
        ↓
init
```

There is **no deadlock**: every link has a known actor and the first link is one approved
command away (`frost-hsm-provision.ts` reports rc 3 = *reachable but not provisioned* for
exactly this). But E is the only option whose prerequisites are not satisfiable today
without also adopting OpenBao, and that is a larger decision than unseal custody.

**The honest recommendation-shaped observation, not a choice:** A and B are the only options
that work on the binary currently declared in `Application.yaml`, and their real cost is
*a human at every reboot of a single-node cluster*. If that cost is unacceptable, the
answer is not Vault Enterprise pricing — it is E, and E should be decided as "do we move to
OpenBao", separately from "how are shares held". **This note does not pick.**

---

## 7. What Aaron must DECIDE

1. **Which of the two clusters is THE cluster** — `192.168.4.152` (`node-ad1efd`, CA
   `d10d7070…`, founded 2026-06-09) or `192.168.4.153` (`node-542b91`, CA `682c3123…`,
   founded 2026-06-21). The loser gets re-provisioned as an agent, which destroys its
   cluster state. Neither holds anything today, so this is the cheapest it will ever be.
2. **Which of `node-5b2dfa` / `node-f82aa6` is real** (defect D2), so the inventory can be
   repaired.
3. **Unseal custody: A, B, D or E** (§6) — and if E, whether OpenBao is adopted.
4. **Whether to extend the closed ceremony set** with `initialize-vault-seal` and
   `unseal-vault` (§4.2), and whether the draft `reason` strings say what he wants said to
   the operator at the prompt.
5. **Whether `clusterInit = lib.mkDefault true` should stay the default** on the
   `control-plane` host, given that it makes every future flash found a new cluster (§1.4).

## 8. What Aaron must RUN

Nothing yet — items 1 and 2 above are decisions with no command attached. Once decided:

```bash
# read-only, safe to run now, from a clone:
bun full-ai-cluster/tools/cluster-bringup/cli.ts status --verbose
bun full-ai-cluster/tools/cluster-bringup/cli.ts plan

# after choosing the cluster — the credential step, his to run:
ssh zeta@<chosen-node> sudo cat /etc/rancher/k3s/k3s.yaml   # then rewrite 127.0.0.1
```

`vault operator init` is **not** listed here, and will not be until §7.3 and §7.4 are
answered. When it is, it should be a single gated verb built on `runGatedCeremony`, not a
sequence of shell commands.

---

## 9. Registers

| Claim | Register |
|-------|----------|
| §1 every measurement, with controls | **metered** |
| §1.2 two distinct cluster CAs | **metered** — public keys compared directly, twice |
| §1.4 root cause (`clusterInit` default + unresolvable `control-plane`) | **metered** — read from the code and confirmed by the certs |
| §2 audit passes 0/12 | **metered** — run rc=0 against byte-identical files (hash-compared to `origin/main`) in a checkout with deps installed |
| §3 the ordered bring-up | **speculative** — designed against records and code; steps 5–8 have never been executed |
| §4.2 no ceremony member covers Vault | **metered** — full closed set read |
| §5 the tool, its tests, its mutants, its live run | **metered** |
| §6 option table | **metered** for availability (C is cited to HashiCorp's own page via the 2026-08-20 note); **speculative** for operational cost |
| §6 the option-B storage trap | **metered** — read from `ca-shamir-custody.ts` |

## 10. A routing constraint worth recording

`docs/handoffs/2026-08-09-CLEAN-SIDE-key-custody-and-rotation.md` puts **shadow** — this
persona — on the **contaminated side** of a clean-room wall for key custody and rotation
tooling. That is why this note **specifies** the custody options and **implements none of
them**. The code shipped here is a read-only cluster prober, which is outside that wall.
Whoever implements Vault share custody should be routed as clean-side, and told so.

## Pointers

- `full-ai-cluster/k8s/applications/vault/TOPOLOGY.md` — the manifest delta and the earlier ceremony sketch this builds on
- `src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts` — 12 rules, values-level; **still not wired into CI**
- `tools/setup/persona-keys/ceremony-handoff.ts` — `runGatedCeremony`, the ordering guarantee
- `src/Core.TypeScript/federated-identity/ceremony-gate.ts` — the closed set to extend
- `tools/setup/persona-keys/ca-shamir-custody.ts` · `shamir.ts` — the existing k-of-n scheme
- `docs/research/2026-08-20-hsm-tpm-into-vault-and-cert-manager-yes-for-tpm-but-not-through-vault-openbao-is-the-answer.md` — why option C is unavailable
- `full-ai-cluster/nixos/modules/k3s-server.nix` · `k3s-agent.nix` — the split mechanism
- `.claude/rules/never-assume-malice-where-mistake-is-possible.md` — the reading applied to §1.4
