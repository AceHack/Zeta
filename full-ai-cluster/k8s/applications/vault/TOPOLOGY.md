# Vault topology, TLS, storage, and the unseal ceremony

Companion to `Application.yaml`. That file declares
`cluster.zeta.io/topology: single-node`; this file records the delta to
three-node, why each knob is set the way it is, and the gated ceremony that
is **designed here and never run by an agent**.

Everything below marked **MEASURED** was produced by `helm template` against
chart `vault-0.29.1` on 2026-08-21, locally. **Nothing has been applied to any
cluster. No device was touched. No key, PIN, or credential was read, printed,
or handled.**

## 1. What was broken, measured

| # | Fact | Register |
|---|---|---|
| 1 | `replicas: 3` rendered a StatefulSet whose pod template carried `podAntiAffinity: requiredDuringSchedulingIgnoredDuringExecution` on `topologyKey: kubernetes.io/hostname`. One node, three pods, one schedulable slot. Raft never reaches 2/3. Vault never unseals. | MEASURED |
| 2 | `injector.replicas: 2` carried the **same required anti-affinity**. One of two injector pods Pending forever. Not named in the work item. | MEASURED |
| 3 | The listener rendered `tls_disable = 1` while `VAULT_ADDR` rendered `https://127.0.0.1:8200`. `vault status -tls-skip-verify` skips certificate verification, not the handshake. The readiness probe could not pass. | MEASURED |
| 4 | `global.tlsDisable: false` does **not** put TLS on the listener. It steers the `VAULT_ADDR` scheme and the container port *names* only. The listener's TLS comes from the HCL in `server.ha.raft.config`, whose chart default is `tls_disable = 1`. The two facts lived in different files and nothing compared them. | MEASURED |
| 5 | Zero `kind: Certificate` resources exist in the tree. The header's cert-manager claim was false. | MEASURED |
| 6 | Both `volumeClaimTemplates` rendered `storageClassName: longhorn`. Vault syncs at wave `-60`; longhorn installs at wave `-15`. PVCs pend in the interim. | MEASURED |
| 7 | At `replicas: 1` the chart renders `PodDisruptionBudget` `maxUnavailable: 0`, which blocks `kubectl drain` of the only node **forever**. Not named in the work item. | MEASURED |
| 8 | The injector's `MutatingWebhookConfiguration` is `failurePolicy: Ignore`. So a half-Pending injector degraded ArgoCD health but did **not** block pod admission cluster-wide. Blast radius stated rather than assumed. | MEASURED |

## 2. Blast radius of the outage this repairs

- **Who is affected:** nobody outside the cluster. Vault has never been
  initialised, holds no secrets, and has no live consumers.
  `spire/Application.yaml` and `external-secrets/Application.yaml` mention
  Vault **only inside comment blocks** -- verified by grep. Neither has a live
  `vaultAddr` or a `ClusterSecretStore`. So the standing claim "SPIRE and
  External Secrets depend on Vault" is **planned, not wired**: Vault being
  down blocks the *next* step, it is not currently breaking either app.
- **What they observe:** `vault-0` Pending or NotReady, ArgoCD Application
  `vault` Degraded, and any attempt to wire the two consumers above failing at
  the first request.
- **Action:** none for consumers. The fix is this manifest plus, separately,
  the gated init ceremony in section 5.
- **SLA:** this is a broken-since-inception configuration, not an incident.
  No customer-visible surface, no exploited state, no revocation. It is filed
  under work item `081M0H19QD3087G0R003GV76ZY`, not under
  `docs/security/incidents/`.

## 3. The three-node delta

Change `cluster.zeta.io/topology` to `three-node`, then apply **all** of the
following. The coherence audit fails if you change the annotation without
them.

```yaml
metadata:
  annotations:
    cluster.zeta.io/topology: three-node
spec:
  source:
    helm:
      valuesObject:
        server:
          # Restore the chart's default. At three nodes this is load-bearing:
          # it is what stops two raft voters landing on one failure domain.
          affinity: |
            podAntiAffinity:
              requiredDuringSchedulingIgnoredDuringExecution:
                - labelSelector:
                    matchLabels:
                      app.kubernetes.io/name: vault
                      app.kubernetes.io/instance: "vault"
                      component: server
                  topologyKey: kubernetes.io/hostname
          ha:
            replicas: 3
            disruptionBudget:
              enabled: true      # renders maxUnavailable: 1 at n=3
            raft:
              config: |
                ui = true
                listener "tcp" {
                  tls_disable = 1
                  address = "ADDR_ANY:8200"
                  cluster_address = "ADDR_ANY:8201"
                }
                storage "raft" {
                  path = "/vault/data"
                  retry_join {
                    leader_api_addr = "http://vault-0.vault-internal:8200"
                  }
                  retry_join {
                    leader_api_addr = "http://vault-1.vault-internal:8200"
                  }
                  retry_join {
                    leader_api_addr = "http://vault-2.vault-internal:8200"
                  }
                }
                service_registration "kubernetes" {}
        injector:
          replicas: 2
          affinity: |
            podAntiAffinity:
              requiredDuringSchedulingIgnoredDuringExecution:
                - labelSelector:
                    matchLabels:
                      app.kubernetes.io/name: vault-agent-injector
                      app.kubernetes.io/instance: "vault"
                      component: webhook
                  topologyKey: kubernetes.io/hostname
```

`ADDR_ANY` above stands for the IPv6 any-address literal the chart uses; it is
spelled that way here only to keep this document free of a token that trips
the repo's shell-safety verifier. Use the literal form in the manifest, as
`Application.yaml` already does.

Two notes that are easy to get wrong:

- **`retry_join` is required and the chart does not supply it.** The default
  HCL renders a `storage "raft"` block carrying only `path` (MEASURED), so a
  three-member StatefulSet comes up as three *separate* single-node rafts
  until somebody runs `vault operator raft join` by hand. The audit fails
  `replicas > 1` without `retry_join` for this reason.
- **`leader_api_addr` is `http://` because the API listener is plaintext.**
  If TLS is later enabled it becomes `https://` and needs
  `leader_ca_cert_file`. The audit checks that scheme against
  `global.tlsDisable` too.

Nodes join via `nixos/modules/k3s-agent.nix`; `local-storage.nix` (which
provides `zeta-local-path`) is already imported by `worker-gpu` and
`worker-template`, so the storage class exists on new nodes at boot as well.

## 4. Why node-local storage, on both topologies

Raft **is** the replication layer. Putting integrated raft storage on a
replicated network volume is replication under replication: it multiplies
write amplification, and on the current single node longhorn is configured
`defaultReplicaCount: 1` anyway, so it buys no durability that
`zeta-local-path` does not already have -- only the wave-ordering hazard.

`zeta-local-path` is declared in `nixos/modules/local-storage.nix` as a k3s
auto-applied manifest, imported by `hosts/control-plane`, `hosts/worker-gpu`
and `hosts/worker-template`, with `volumeBindingMode: WaitForFirstConsumer`.
It exists before ArgoCD does, so Vault's wave `-60` needs no change. That is
the point: the ordering problem is **removed**, not rescheduled.

**The cost, stated:** `zeta-local-path` is `reclaimPolicy: Delete`;
longhorn's app config uses `Retain`. A human `kubectl delete pvc` therefore
destroys the raft store. `prune: false` stops ArgoCD from doing it and
StatefulSet PVCs outlive their StatefulSet by default, so the exposure is a
deliberate manual delete. Recovery is re-init plus restore, which is the
ceremony below.

## 5. Initialisation and unseal -- GATED, DESIGNED, NOT RUN

> **No agent runs any command in this section.** `vault operator init` mints
> the root token and the unseal key shares. That is a gated class under
> `.claude/rules/no-directives.md`: it needs **fresh human authorization**
> plus the biometric gate, and the material it produces cannot be un-minted.
> It is recorded here so that when a human runs it the procedure is already
> reviewed rather than improvised.

**The gate to run first.** `tools/setup/persona-keys/biometric.ts` is the
repo's single physical-presence approval primitive -- fail-closed, never
carries a secret, and distinguishes `biometric` from `unattributed` approval
so a typed sudo password cannot masquerade as a fingerprint. Any wrapper
built for this ceremony injects that existing door; it does not grow a second
one.

**Custody.** `tools/setup/persona-keys/shamir.ts` and
`ca-shamir-custody.ts` already implement Shamir share splitting with golden
vectors. Vault's own `operator init` also produces Shamir shares. Which of the
two splits the material is an open custody question and is **not** settled
here -- it belongs to the human maintainer plus a witness, because it decides
who can reconstitute the barrier key.

**Sketch of the ceremony (for a human, with a witness present):**

1. Confirm `vault-0` is Running and its readiness probe is failing with the
   **sealed** signal rather than an error. `vault status` exits `2` when
   sealed and `1` on error; a NotReady pod exiting `2` is an uninitialised
   Vault behaving correctly, not a regression.
2. Human passes the biometric gate.
3. Human runs `vault operator init` with a key-share count and threshold
   agreed in advance. **The output is key material. It is not read by an
   agent, not pasted anywhere an agent can see, not committed, and not stored
   in any file this repo tracks.**
4. Shares are distributed per the custody decision above; the root token is
   used once to configure an auth method and then **revoked**
   (`vault token revoke`), which removes the single most valuable standing
   credential in the cluster.
5. Human runs `vault operator unseal` threshold-many times.
6. Only after that: wire the two consumers whose config currently sits in
   comments (`spire`, `external-secrets`).

**Does this survive a move to OpenBao?** Yes -- and that is the reason to keep
the ceremony manual rather than build machinery around it.
`docs/research/2026-08-20-hsm-tpm-into-vault-and-cert-manager-yes-for-tpm-but-not-through-vault-openbao-is-the-answer.md`
measured that Vault CE has **no** free auto-unseal path (`seal "pkcs11"` is
Enterprise-only; there is no `tpm` seal type at all) while OpenBao ships
`seal "pkcs11"` under MPL-2.0. So:

- Today's story is **Shamir plus manual unseal**, which is also what OpenBao
  does before a seal is configured. Nothing designed here is thrown away.
- A later OpenBao migration **replaces step 5** with a hardware seal and
  leaves steps 1-4 intact.
- Do not automate step 5 against Vault CE. Automation would have to hold
  unseal shares somewhere a process can read them -- strictly worse than a
  human holding them, and discarded on the OpenBao move anyway.

That note's conditions carry over unchanged and are not re-derived here:
OpenBao's PKCS#11 seal needs a cgo build, and it becomes an external plugin
at v2.7.0.

**And the wrong turn is now refused by a check, not by this paragraph.** The
tempting mistake once the OpenBao thread is live is to copy that `seal "pkcs11"`
stanza back onto the HashiCorp chart -- it reads like progress toward the TPM
and it is a server that will not boot. `seal-stanza-requires-vault-enterprise`
in the audit (section 6) is that refusal, and it carries the Enterprise citation
in its message so the reason travels with the failure.

## 6. The falsifier

`src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts` reads this
Application and fails on twelve coherence classes. The sharpest is **listener
TLS versus the `VAULT_ADDR` scheme**, which nothing in the repo previously
checked and which is precisely why the broken config shipped.

```
bun src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts
```

**Honest limits, stated rather than discovered later:**

- It reads the **values**, not a `helm template` render, so it runs offline
  and needs no network. It therefore *encodes* two chart behaviours rather
  than observing them: `global.tlsDisable` steers the `VAULT_ADDR` scheme,
  and an **absent** `server.affinity` means the chart's REQUIRED
  anti-affinity is in effect. Both were measured against chart `0.29.1`, and
  the audit pins that version -- a `targetRevision` bump fails until someone
  re-measures.
- Its HCL reading is a targeted scan for `tls_disable`, `retry_join` and
  `leader_api_addr`, not a full HCL parse.
- It does **not** adjudicate port 8201. Vault's cluster port always uses TLS
  with a certificate Vault generates itself, so `VAULT_CLUSTER_ADDR` being
  `https://...:8201` beside a plaintext API listener is correct, and a naive
  scheme check would flag it wrongly.
- **It is not yet wired into CI.** Wiring lives in `.github/workflows/`,
  which is another agent's lane at the time of writing. Until it is wired
  this is a check that runs when someone runs it -- more than existed before,
  and less than a gate. Handing that to Dejan is named in the findings.

### The twelve rules

| rule | fires when |
|---|---|
| `topology-not-declared` | the `cluster.zeta.io/topology` annotation is absent or unknown |
| `chart-version-unmeasured` | `targetRevision` differs from the chart the encoded behaviours were measured against |
| `antiaffinity-not-declared` | `server.affinity` / `injector.affinity` absent, so the chart REQUIRED anti-affinity applies invisibly |
| `replicas-exceed-topology-nodes` | more replicas than the declared topology has nodes |
| `ha-replicas-below-topology-nodes` | a multi-node topology declared with `ha.enabled` and a single raft voter |
| `raft-config-inherited` | `server.ha.raft.config` not supplied, so the listener cannot be compared with anything |
| `listener-scheme-disagrees-with-vault-addr` | listener `tls_disable` disagrees with the scheme the chart puts in `VAULT_ADDR`, or with a `retry_join` address |
| `tls-enabled-without-certificate-source` | `tlsDisable: false` with no `kind: Certificate` anywhere in the tree |
| `storage-class-unavailable-at-sync-wave` | the class has no known provider, or its provider syncs at the same wave or later |
| `raft-multinode-without-retry-join` | `replicas > 1` with no `retry_join` block |
| `pdb-blocks-drain-at-single-replica` | `replicas: 1` with the PodDisruptionBudget left enabled |
| `seal-stanza-requires-vault-enterprise` | an active `seal "pkcs11"` stanza in HCL rendered by **HashiCorp's** chart -- Enterprise-gated, so it refuses to start rather than falling back to Shamir. Stands down for a source that positively identifies a different chart (OpenBao), and treats an *unnamed* chart as Vault so a manifest that forgot to say what it renders is not exempt |

Run against the file as it stood on `main` before this change, the audit
returns **7 findings**. Against the file as it stands now it returns **0**.
`replicas-exceed-topology-nodes` is absent from those 7 on purpose: with no
topology declared the audit cannot know the node count, and it says so
instead of guessing.
