# Public TLS without inbound port 80 — opt-in Cloudflare DNS-01

Work item `081M3XJTBMZ087G0R0026R420W`. Manifests: `full-ai-cluster/k8s/public-tls/resources.yaml`.
Pinned by `src/Core.TypeScript/cluster/public-tls-dns01.test.ts`.

## Why this exists (measured on node-5b2dfa)

`gitlab-tls` and `gitlab-registry-tls` could not issue over HTTP-01: Let's Encrypt must reach
**inbound :80**, and the owner's consumer router only offers a "pick a device" port-forward menu
while the node answers for several LoadBalancer IPs (`.240` public gateway, `.241`, `.242`, `.250`)
through Cilium L2 announcements. The forward landed on the wrong gateway — the GitLab-only LAN
gateway `.250` answers every Host with GitLab's 302/HTML, and Let's Encrypt failed with
`Error reading HTTP response body: reader size limit exceeded`. Full finding:
[`ROUTER-PORT-FORWARD-AMBIGUITY.md`](ROUTER-PORT-FORWARD-AMBIGUITY.md). DNS-01 proves control of the name by a
TXT record through the Cloudflare API: **no inbound connectivity at all**.

## What changed in git

Both ClusterIssuers (`letsencrypt-prod`, `letsencrypt-staging`) now have two solvers:

| # | solver | selected when |
|---|---|---|
| 1 | `dns01.cloudflare` (token from Secret `cloudflare-api-token`, key `api-token`, namespace `cert-manager`) | the Certificate carries label `zeta.io/acme-solver: dns01` |
| 2 | `http01.gatewayHTTPRoute` on `zeta-public-gateway` — **unchanged, no selector** | everything else (the default) |

An install that never sets the label behaves byte-for-byte as before. The Secret is **never
committed**; its absence is not a defect — it is only read when a Certificate opts in. Like
`hindsight-llm-api-key` (`full-ai-cluster/INJECTION-POINTS.md`, "stays an EXTERNAL gap, on purpose"),
this is a real third-party credential the cluster cannot draw for itself, and it must not be
papered over with a generated value.

## Where the label goes — on the GATEWAY, not the Certificate

The Certificates are **not** in git and ArgoCD does not own them: cert-manager's gateway-shim
creates them from the `cert-manager.io/cluster-issuer` annotation on `zeta-public-gateway`
(`portal-tls`, `gitlab-tls`, `gitlab-registry-tls`, `forgejo-tls`), controller-owned by the Gateway.
Measured against cert-manager v1.21.1 `pkg/controller/certificate-shim/sync.go`:

- a new Certificate takes its labels from the **Gateway** (`Labels: ingLike.GetLabels()`);
- `certNeedsUpdate` returns true on any label difference and the update does `updateCrt.Labels =
  crt.Labels` — the source carries the comment *"we'll reset/remove the label values back
  automatically"*. So a label set by hand **on the Certificate is removed again** by the shim.

Therefore the opt-in is a label on the Gateway; the shim copies it to **every** Certificate that
Gateway owns (all four public names move to DNS-01 together):

```bash
sudo k3s kubectl -n zeta-platform label gateway zeta-public-gateway zeta.io/acme-solver=dns01 --overwrite
# back to HTTP-01 (default):
sudo k3s kubectl -n zeta-platform label gateway zeta-public-gateway zeta.io/acme-solver-
```

ArgoCD does not revert the extra Gateway label: the manifest does not carry the label, ArgoCD only
diffs fields present in the manifest, and Argo CD 3.x (chart `argo-cd` 10.8.0 here) tracks resources by
annotation, so the label-copied Certificates are not "its" resources either (they are neither
diffed nor pruned). *Reasoned from the sources, not yet observed live — see "Unproven" below.* If
the Gateway ever shows OutOfSync on this label, add the narrowest `ignoreDifferences` to
`argocd-application.yaml.in` (group `gateway.networking.k8s.io`, kind `Gateway`, name
`zeta-public-gateway`, jsonPointer `/metadata/labels/zeta.io~1acme-solver`); that file is rendered by
NixOS, so it needs a `nixos-rebuild`, unlike the issuers which the live cluster picks up from `main`.

A **hand-made** Certificate (not shim-owned) keeps its own label — used for the staging probe below.

## Owner steps

1. **Cloudflare token.** Dashboard → My Profile → API Tokens → Create Token → Custom. Permissions:
   `Zone : DNS : Edit` and `Zone : Zone : Read`; Zone Resources: Include → Specific zone →
   `flowdent.net`. Copy the token once.
2. **Create the Secret ON THE NODE** (never paste the token into chat, git or an agent):
   ```bash
   sudo k3s kubectl -n cert-manager create secret generic cloudflare-api-token \
     --from-literal=api-token=<TOKEN>
   ```
   The records on Cloudflare may stay DNS-only; DNS-01 only needs the zone to be on Cloudflare.
3. **Prove it with staging first** (Let's Encrypt allows 5 failed validations per hostname per hour;
   staging has far higher limits and needs no DNS record for the probe name). A hand-made Certificate
   keeps its label:
   ```bash
   cat <<'EOF' | sudo k3s kubectl apply -f -
   apiVersion: cert-manager.io/v1
   kind: Certificate
   metadata:
     name: dns01-probe
     namespace: zeta-platform
     labels: { zeta.io/acme-solver: dns01 }
   spec:
     secretName: dns01-probe-tls
     dnsNames: [dns01-probe.flowdent.net]
     issuerRef: { kind: ClusterIssuer, name: letsencrypt-staging }
   EOF
   sudo k3s kubectl -n zeta-platform get certificate,order,challenge   # Challenge type DNS-01, then Ready=True
   ```
   Clean up: `kubectl -n zeta-platform delete certificate dns01-probe` and `delete secret dns01-probe-tls`.
4. **Label the Gateway** (command above). The shim relabels the existing Certificates.
5. **Bypass the issuance backoff.** A failed order sets `status.failedIssuanceAttempts`; measured:
   `failedIssuanceAttempts=1` ⇒ cert-manager retries only after about **1 h**, and the old
   CertificateRequest/Order keep the HTTP-01 solver they were created with. Delete the stuck
   Certificates; the Gateway shim recreates them at once, now carrying the label (their Secrets are
   untouched; the finished CertificateRequest/Order are garbage-collected with the Certificate):
   ```bash
   sudo k3s kubectl -n zeta-platform delete certificate gitlab-tls gitlab-registry-tls
   ```
   (Not ArgoCD — it never owned these. If you see them back within seconds, that is the shim.)
6. **Verify:**
   ```bash
   sudo k3s kubectl -n zeta-platform get certificate,order,challenge
   sudo k3s kubectl -n zeta-platform get certificate gitlab-tls --show-labels   # carries zeta.io/acme-solver=dns01
   ```
   Challenges show `type: DNS-01`; Certificates go `Ready=True` within a couple of minutes.

## Limits and cautions

- **No wildcard.** The shim requests exactly the listener hostnames; DNS-01 makes a wildcard
  possible later but nothing here asks for one.
- **Let's Encrypt: 5 failed validations per hostname per hour.** A wrong token fails *validation*
  per name — use staging (step 3), and do not loop on prod.
- cert-manager self-checks the TXT record against recursive resolvers; a node whose resolver cannot
  see Cloudflare's record yet keeps the Challenge `pending` — check `kubectl describe challenge`.
- The label is Gateway-wide. Per-name selection would need a `selector.dnsNames` solver instead;
  not built, because the opt-in must stay label-gated and default-preserving.

## Proven / unproven

Proven by tests (`public-tls-dns01.test.ts`): both issuers render two solvers; dns01 alone has the
selector; http01 has none and unchanged `parentRefs`; no committed Certificate, label or Secret.
Read from cert-manager source: the shim's label behaviour. **Unproven (needs the node):** that the
labelled order really takes DNS-01, that the Cloudflare token scope is sufficient, that ArgoCD leaves
the Gateway label alone, and that Let's Encrypt issues.

## Follow-up, deliberately not in this change

An install-time input (`zflash --acme-solver http01|dns01` → ESP `/zeta-firstboot.conf` → NixOS
render, mirroring `--public-domain`/`--acme-email`, `INJECTION-POINTS.md` §10) would set the Gateway
label from the Application's patches. It touches the installer, ESP schema and the Nix module, so it
is left out to keep the live-node fix GitOps-only (the cluster tracks `main`; no reflash needed).
