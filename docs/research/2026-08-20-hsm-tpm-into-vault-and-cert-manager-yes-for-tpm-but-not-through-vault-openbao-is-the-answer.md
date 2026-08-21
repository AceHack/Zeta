# HSM/TPM into Vault and cert-manager: yes for TPM, but not through Vault — and OpenBao is the answer

**Dejan / devops — analysis only. No files written, no device touched, nothing applied to a cluster.**
**Date:** 2026-08-20 · Answering Aaron's *"we also want to hook in hsm/tpm to our cert manager and
vault in our k8s cluster if possible."*

> **Answer to the "if possible": YES for TPM, on the floor that matters — but NOT THROUGH VAULT.**
> Vault's `seal "pkcs11"` is Enterprise-only, and **Vault CE ships no TPM seal type at all**, so
> *neither* HSM *nor* TPM can back auto-unseal on the binary you run. **OpenBao — the MPL-2.0 Linux
> Foundation fork — ships PKCS#11 auto-unseal for free**, which turns *"we want to replace Vault
> anyway"* into the actual answer rather than a workaround. And the cheapest genuine hardware hook in
> the whole cluster is **one flag in a chart you already install.**

## 1. The three decisive external facts

| # | Fact | Register |
|---|---|---|
| **F1** | *"Auto-unseal and seal wrapping for PKCS11 require Vault Enterprise."* — verbatim, first sentence of the page body. Nav badges confirm the asymmetry: AliCloud/AWS/Azure/GCP/OCI/Transit unbadged, **`HSM PKCS11 ENT`** badged. | **measured** ([developer.hashicorp.com](https://developer.hashicorp.com/vault/docs/configuration/seal/pkcs11)) |
| **F2** | Vault's seal list is `alicloudkms, awskms, azurekeyvault, gcpckms, ocikms, pkcs11(ENT), transit`. **There is no `tpm` seal.** A TPM can only reach Vault by pretending to be a PKCS#11 token — landing on the same ENT-gated stanza. | **measured** |
| **F3** | **OpenBao has `seal "pkcs11"`, no licence gate**, and names the contrast itself: *"Unlike Vault Enterprise, OpenBao requires key material to be created externally before initializing the instance."* | **measured** ([openbao.org](https://openbao.org/docs/configuration/seal/pkcs11/)) — MPL-2.0, 7,104★, pushed 2026-08-20 |

Two conditions on F3, both load-bearing and from the same page: it needs *"a HSM-enabled build of
OpenBao with PKCS#11 support compiled in via cgo"* (or the external KMS plugin), and — flagged —
*"This seal remains built-in in OpenBao v2.6.x, but will remain available only as an external plugin
starting v2.7.0."* **Adopting it means owning a build or a plugin pin.**

**Vault Enterprise price: UNKNOWN**, quote-gated with no public list price — which is itself the
finding: **you cannot size the bridge without a sales call.** Given F3, you should not have to.

**A second, independent gate:** Vault's *Managed Keys* — the feature that would put a **PKI CA
private key** in an HSM, as opposed to the barrier key — carries the nav badge **`kms_library ENT`**.
Register: **checked** (URL path + nav badge; body is JS-rendered). So on Vault CE the PKI CA key
lives in Vault's own storage under the barrier key, and hardware cannot hold it. **The two gates are
independent, and both are closed on CE.**

## 2. cert-manager: no PKCS#11 issuer exists, and the CA issuer is the anti-pattern

- The in-tree `CA` issuer: *"a Certificate Authority whose certificate and private key are stored
  inside the cluster as a **Kubernetes Secret**."* **measured** ([cert-manager.io](https://cert-manager.io/docs/configuration/ca/)).
  **That is exactly the property an HSM exists to remove.**
- The **complete** known-issuer roster was pulled — 24 issuers. **Register: measured.** There is **no
  PKCS#11 issuer, no HSM issuer, no TPM issuer.** The only hardware-adjacent entries are
  `tcs-issuer` (Intel SGX — a TEE, not a TPM/HSM) and `kms-issuer`/`keyvault-issuer` (AWS KMS / Azure
  Key Vault — **remote custody, excluded by your own constraint**).
- **The one open-source path runs through `step-issuer` → step-ca**, which natively supports both:
  *"step-ca integrates with… PKCS #11 hardware security modules (HSMs), **TPM 2.0**, YubiKey PIV…"*
  **measured** ([smallstep.com](https://smallstep.com/docs/step-ca/cryptographic-protection/)).
  Conditions, verbatim: *"The standard step-ca binary does not support TPM 2.0. For native TPM 2.0
  support, you'll need a CGO build of step-ca"* (or the `step-ca:hsm` image), plus `tpm2-tss`, plus
  the `step kms` plugin; and *"You can use the TPM for **X.509** CAs"* — **no SSH CA on TPM.**

## 3. Measured in the repo — verified, not inherited

- `vault-install.yaml` — **37 lines, read in full. No `seal` stanza, no config override.** So the
  chart default HCL applies: `storage "file"` and **`tls_disable = 1`** (measured from `vault-helm`
  `values.yaml:903-928`) — while the repo file sets `global.tlsDisable: false` and its header comment
  says *"Vault TLS certs come from cert-manager."* **Nothing wires a cert.** **A second
  comment-vs-YAML gap in the same file**, independent of the SPIRE one.
- **The SPIRE correction is confirmed independently.** `grep -nE "upstreamAuthority|NodeAttestor|KeyManager"`
  on `spire-install.yaml` returns exactly **one hit — the comment on line 2.** No `upstreamAuthority`.
  The SPIRE server self-signs.
- **Issuers:** there are **two** `ClusterIssuer`s, both in
  `applications/platform/clusterissuer.yaml` — `letsencrypt-staging` and `letsencrypt-prod`, both
  ACME/HTTP-01, both with `email: you@example.com   # ← CHANGE`. **No `CA` issuer, no private CA
  anywhere.** So **there is currently no CA private key in the cluster to protect** — which
  materially shrinks this problem.
- **The TPM hook, verified with detail.** `nodeAttestor.tpmDirect`: `enabled: false`, described as
  *"the direct TPM node attestor, a 3rd party plugin by Boxboat. **This plugin is experimental.**"*
  Image pinned by SHA. **measured** from the chart's `values.yaml`.
  - **Provenance matters:** `boxboat/spire-tpm-plugin` is **8★, last pushed 2024-02-12** (stale);
    `spiffe/spire-tpm-plugin` is **12★, pushed 2026-04-23** — SPIFFE adopted it. **Thin either way;
    said out loud.**
  - Mechanism, **measured** from its README: TPM **credential activation** — agent makes an AK,
    server challenges with a secret sealed to the EK, SPIFFE ID = `…/spire/agent/tpm/<sha256 of tpm
    pubkey>`. Validation accepts **either** an EK cert chained to `ca_path` **or** a bare EK
    public-key hash in `hash_path`. **That second mode is why this is deployable on your hardware** —
    firmware TPMs (AMD fTPM / Intel PTT) frequently ship no EK certificate, and `hash_path` turns
    enrollment into "record the pubkey hash out of band."
  - **Not** SPIRE's built-in `tpm_devid` attestor, which requires *"a LDevID certificate through an
    out-of-band mechanism"* — strictly more provisioning, and it needs a CA you do not have.
- **`secure-boot.nix` refuses every phase but `off`**, naming *"Q4 do the nodes have TPM 2.0?"* as
  maintainer-blocked. **Aaron's "we can count on it" is the answer to Q4** — worth recording *there*,
  since that module is gated on it.

## 4. Feasibility matrix

Read as: **TPM = required floor (assume present); HSM = optional upgrade.** A design that only works
with an HSM is not deployable, and none of the recommendations are one.

| Surface | TPM 2.0 (floor) | USB HSM (optional) | Neither |
|---|---|---|---|
| **Vault CE seal / auto-unseal** | **NOT POSSIBLE.** No `tpm` seal; a PKCS#11 shim routes to the ENT stanza | **NOT POSSIBLE on CE.** Possible on Enterprise — cost unknown | Shamir, manual unseal. **This is today** |
| **↳ same requirement, OpenBao** | **POSSIBLE-WITH-CONDITIONS.** `seal "pkcs11"` + `tpm2-pkcs11`. Conditions: cgo build; v2.7.0 moves it out of tree; **mechanism compatibility with OpenBao's wrap is UNKNOWN and is the thing to bench first** | **POSSIBLE-WITH-CONDITIONS**, same stanza, only on the node the device is plugged into | — |
| **Vault PKI CA private key** | **NOT POSSIBLE on CE** — Managed Keys ENT-gated, separately from the seal | **NOT POSSIBLE on CE** | Today — and **moot**, nothing configures a Vault PKI CA |
| **cert-manager CA private key** | **NOT POSSIBLE directly** (no TPM issuer in the full roster). **POSSIBLE indirectly** via `step-issuer` → step-ca `tpmkms:`, X.509 only | **POSSIBLE indirectly**, step-ca `pkcs11:` URI. Node-pinned | Today — also **moot**, both issuers are ACME |
| **Node identity (SPIRE)** | **POSSIBLE — cheapest real step in the cluster.** One line. Conditions: experimental 12★ plugin; `/dev/tpmrm0` must reach the agent pod; enroll by EK-hash if fTPMs lack EK certs; **keep `k8sPSAT` enabled during rollout or nodes stop attesting** | **NOT APPLICABLE** — SPIRE's built-in KeyManagers are `disk` and `memory` only. No HSM KeyManager ships | Today: `k8sPSAT`. Software-only — binds to a ServiceAccount token, not hardware |
| **SPIRE → Vault chain** | **NOT CONFIGURED — a row, not an assumption.** Any story where hardware under Vault reaches SPIRE SVIDs requires wiring this first — and under *"we will replace Vault"* that is a deliberate coupling decision, **not an inheritance from a comment that was never true** | same | same |

**Physical connectivity, resolved rather than argued: the TPM path makes it moot.** A TPM is already
soldered to each node, so the appointed-hub objection from the connector doc — one box holding every
key, an endpoint replaceable with `kill` because nothing respawns it, plus the pre-MAC response-parser
class — **does not apply to the TPM path at all.** That is its strongest property and it is
**architectural, not incidental.** The USB HSM keeps every one of those objections and adds
node-pinning.

## 5. The test constraint — which tests, and the one deliberate tripwire

**No test in the repo asserts on `vault-install.yaml` or `spire-install.yaml`.** So a `seal` stanza or
a `tpmDirect: true` flip breaks **zero** existing tests on a hardware-free machine.

> **UPDATE 2026-08-21 — the seal half of that sentence is now false, deliberately.** `vault-install.yaml`
> was deleted (#13039) and the Vault Application is audited by
> `src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts`, which gained rule
> `seal-stanza-requires-vault-enterprise`: an active `seal "pkcs11"` stanza in a config rendered by
> **HashiCorp's** chart is now a finding, with the Enterprise citation in the message. It is the one
> wrong turn this document's own recommendation makes tempting — copying OpenBao's hardware seal
> stanza back onto the Vault chart, which reads like progress toward the TPM and is a server that
> will not boot. The rule **retires itself**: it stands down for a source that positively identifies
> a different chart, so the OpenBao migration in section 6 is not obstructed by it, and it treats an
> *unnamed* chart as Vault so an Application that forgot to say what it renders is not thereby
> exempt. The `tpmDirect` half of the sentence stands unchanged and is still unguarded.
>
> This does **not** touch the `tpm2-linux-probe.test.ts:333` tripwire below, which remains the
> designed red-on-first-capture signal.

The three-state idiom **already exists** and should be extended, not duplicated:
`tpm2-linux-probe.ts:327` defines `Tpm2State = "present" | "absent" | "unreadable" | "unavailable" |
"indeterminate"`, and `tpm2CheckRan(state)` at `:635` returns true only for `present | absent |
indeterminate`. **"The check did not run" is already a distinguished value with a predicate.**
Inventing a boolean beside it would be the regression.

**One existing test is a designed tripwire and will correctly go red at the first real step** —
`tpm2-linux-probe.test.ts:333` asserts no observed TPM-2.0 capture exists, with its own comment
saying it *"flips to red and is deleted in the same commit that lands the real capture — so the gap
cannot close silently."* **Landing an observed capture is the event it was written to catch;
deleting it in that commit is compliance, not breakage.**

## 6. Recommended smallest real step

**Step 0 — zero cost: fix the two lying comments.** `spire-install.yaml:2` asserts a Vault upstream
chain with zero implementing keys; `vault-install.yaml:1-2` asserts cert-manager TLS that nothing
wires, while the effective default is `tls_disable = 1`. **Both are the vacuity class.**

**Step 1 — the actual smallest real step: capture one TPM from one cluster node.** Run the existing
probe on the control-plane node, commit the observed capture, delete the `:333` tripwire in the same
commit as its own comment instructs. **Cost: zero CI minutes, zero hardware spend, ~1 hour. Value: it
converts "we can count on the TPM" from an assumption into a measurement** — and it is the
precondition for every other row in the matrix. It also answers `secure-boot.nix`'s blocked Q4.

**Step 2 — one line, after Step 1 is green: `nodeAttestor.tpmDirect.enabled: true`**, with `k8sPSAT`
left enabled. Node identity moves from *"holder of a ServiceAccount token"* to *"holder of a specific
TPM's EK"* — **the only row genuinely reachable today**, with no purchase, no Enterprise licence, no
network HSM. Priced honestly: an experimental 12★ plugin, pinned SHA, behind a flag, fallback
attestor still live.

**Step 3 — bench, not deploy: OpenBao + SoftHSM, then OpenBao + `tpm2-pkcs11`, off-cluster.** This is
the fork in the road for *"what replaces Vault"*, answerable at laptop scale. **The unknown to kill is
whether `tpm2-pkcs11` offers the wrap mechanism OpenBao's seal wants** — SoftHSM first (the documented
example), then the TPM. **Do not wire `upstreamAuthority.vault` before this bench returns:** under
*"we will replace Vault eventually"*, coupling SPIRE's trust root to Vault is a decision to make once,
deliberately, and it is cheaper to make after you know which vault you are keeping.

**Deliberately not recommended:** buying a NetHSM (€11,898.81 for a problem the TPM covers);
attaching the YubiHSM over `yubihsm-connector` (re-imports every finding of the connector doc in
exchange for one node's keys); paying for Vault Enterprise (unknown price, and OpenBao is the same
capability at MPL-2.0).

## 7. Gated / never-run

Vault-or-OpenBao root and unseal-key generation stays a **gated ceremony** — fresh human
authorization plus biometric approval. Every command above is design text. Nothing was run, no device
touched, no key/PIN/credential handled, `op` not invoked, nothing applied to a cluster.

**Open questions for Aaron:** (1) should `secure-boot.nix`'s Q4 be recorded as answered on the
strength of the steer, or wait for the Step-1 measurement? *(The module's own bar is evidence.)*
(2) Does the SPIRE trust root chain to a vault at all, or does SPIRE stay self-signed with a separate
step-ca as the private CA? (3) OpenBao as the successor — bench this quarter, or defer?

### Verification note (Otto, landing this)

Both licence claims re-checked against the live pages before landing. **Vault confirmed verbatim:**
*"Auto-unseal and seal wrapping for PKCS11 require Vault Enterprise."* **OpenBao confirmed:** its
PKCS#11 seal page carries no licence gate and states *"Unlike Vault Enterprise, OpenBao requires key
material to be created externally…"* — the contrast is the vendor's own.
