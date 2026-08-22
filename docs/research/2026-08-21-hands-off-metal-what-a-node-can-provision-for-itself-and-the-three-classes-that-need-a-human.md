# Hands-off metal: what a node can provision for itself, and the three classes that need a human

**Scoping, 2026-08-21. Nothing applied to a cluster, no device touched, no TPM contacted, no key,
PIN or credential handled.** Answering Aaron, verbatim:

> *"why do i have to do work on the hardware? is not not possible to ship where it will be fully
> operational without human intervenion on hardware? I'm trying to avoid any manual step, if they
> are absoutly needed, could the nix installer setup anything that's needed?"*

**The short answer.** Yes to the fallback: the nix installer can pre-stage essentially all of the
seal machinery, and it is about fifteen lines — `security.tpm2.*` plus an `openbao` that already
ships with PKCS#11 compiled in at our pinned nixpkgs. No, not to the whole ask: **three classes of
step remain, and only one of them is a decision you can delegate to the installer.** They are
(1) firmware — no OS can turn on its own fTPM, the same class of impossibility as UEFI Setup Mode;
(2) the physical acts — power, cabling, the stick; (3) **one custody decision**, which is the one
that actually matters, because the honest form of "the node unseals itself" is **"the board is the
only thing in the universe that can ever unseal this vault"**, and OpenBao says so in its own docs:
*"If the seal mechanism or its keys are permanently deleted, then the OpenBao cluster cannot be
recovered, even from backups."*

That sentence is the whole tradeoff, and §3 refuses to bury it.

This doc **does not rewrite** `full-ai-cluster/k8s/applications/vault/TOPOLOGY.md` §5. §5 is the
ceremony of record; §5 of this doc is a **proposal** against it, with the diff in what a human does
spelled out, for Aaron to accept or refuse.

---

## 0. The chain, link by link

Bare metal → a vault that serves secrets. Each row: who does it **today**, and whether it can be
unattended.

| # | Link | Today | Unattended? |
|---|---|---|---|
| 1 | Rack, power, network, plug the stick | human, physically present | **No.** Remote-power and the GL.iNet Comet KVMs already in the fleet reduce this to *once per box*, not once per boot |
| 2 | **Enable fTPM (Intel PTT) in firmware setup** | **never done — nobody has looked** | **No, and not by any installer.** §4.1. A KVM-over-IP makes it *remote*, never *automatic* |
| 3 | USB boots, wipes, installs NixOS | already unattended (`ZETA_AUTO_CONFIRM=WIPE`, `BOOT_DISK=auto`) | **Yes — already is** |
| 4 | TPM userspace present, `/dev/tpmrm0` reachable, PKCS#11 module on disk | does not exist anywhere in the fleet | **Yes.** `zeta.tpm2Seal.mode = "prereqs"`, shipped inert with this doc |
| 5 | PKCS#11 token + PIN + seal key exist on the node | does not exist | **Mechanically yes; a custody decision first.** §3 |
| 6 | `bao operator init` | human ceremony, TOPOLOGY.md §5 | **Yes** — with `-recovery-pgp-keys` the node never holds readable key material. §2 |
| 7 | **Unseal, on this boot and every boot after** | **human, every restart** | **Yes — this is the whole point of the seal.** It is the step Aaron is actually asking about |
| 8 | Use the root token once to configure auth, then revoke it | human | **Only if the root token is plaintext somewhere.** §2.4 — a real fork, not a detail |
| 9 | Wire SPIRE / External Secrets | not wired (still comments) | Yes, ordinary GitOps |

**So the answer to "why do I have to do work on the hardware" is: for row 2, and only row 2 —
plus the physical acts in row 1.** Every other row is automatable, and rows 4–7 are automatable
*today* with parts that already exist in nixpkgs. Row 7 is the one that currently costs a human on
every reboot, and it is the one the seal removes entirely.

---

## 1. The seal

### 1.1 First: do the nodes have TPM 2.0? — **UNMEASURED, and that is a finding, not a gap in this doc**

The repo already has a provenance vocabulary for exactly this (`docs/inventory/README.md`), and it
gives the honest answer:

- **Declaration** — Aaron: *"we can count on it."* Recorded in
  `2026-08-20-hsm-tpm-into-vault-and-cert-manager-*.md` §3 as the answer to `secure-boot.nix`'s
  blocked Q4.
- **Probe** — **empty.** `tools/setup/persona-keys/tpm2-linux-captures.json` carries twelve
  captures and **exactly one is `observed`**: the Mac Studio, whose state is `unavailable` — the
  state that means *we could not ask*. Its own README says it: *"No TPM has been contacted by
  anyone in this repo."* The four `node.yaml` self-registrations record CPU, RAM, GPU, disks and
  MAC, and **no TPM field at all**, so the fleet's probe surface has never had a place to put the
  answer.
- **Expectation** — the nodes are `Intel Core Ultra 9 285H` (Aaron ×2) and `185H` (Max). Firmware
  TPM on that family is **Intel PTT**, a firmware feature rather than a discrete chip. That makes
  presence a *BIOS setting*, which is precisely why row 2 above is not automatable, and why
  "the CPU supports it" and "the OS can see it" are different claims.

`tpm2-linux-probe.test.ts` carries a tripwire asserting no `observed` capture reports `present`; it
goes red on the first real capture, by design. **One command on one node closes this**
(081M00VN9P1087G0R000FYTTVS), and everything below is contingent on it.

Nothing in this document should be read as evidence that a TPM exists on any Zeta node.

### 1.2 What the NixOS installer provisions — measured from the module source at our pinned rev

`nixos/modules/security/tpm2.nix` exists upstream and does all of it. Read at
`github:NixOS/nixpkgs/b77b3de8775677f84492abe84635f87b0e153f0f` — the rev in
`full-ai-cluster/flake.lock`, not a channel name:

| option | what it actually does |
|---|---|
| `security.tpm2.enable` | the umbrella; nothing below applies without it |
| `security.tpm2.pkcs11.enable` | puts **`/run/current-system/sw/lib/libtpm2_pkcs11.so`** on the system path — the file `BAO_HSM_LIB` names |
| `security.tpm2.applyUdevRules` | `/dev/tpm[0-9]` → `0660 OWNER=tssUser`; `/dev/tpmrm[0-9]` → `0660 GROUP=tss`. **Without this only root reaches the kernel resource manager, and a non-root seal process reads exactly like "no TPM"** — the error/absence conflation `tpm2-linux-probe.ts` was written to refuse |
| `security.tpm2.tctiEnvironment.{enable,interface,deviceConf}` | sets `TPM2TOOLS_TCTI` / `TPM2_PKCS11_TCTI` to `device:/dev/tpmrm0`, so a tool that forgets the flag still talks to the resource manager instead of grabbing the raw device |
| `security.tpm2.abrmd.enable` | the userspace resource manager daemon. **Not needed** — the kernel `tpmrm` device is the simpler path and is what `deviceConf` points at |

Packages at the same pinned rev, evaluated (not recalled): `tpm2-pkcs11` **1.9.2**, `tpm2-tools`
**5.7**.

### 1.3 The binary needs no fork and no owned build — corrected

The 2026-08-20 doc priced the PKCS#11 seal as *"owning a build or a plugin pin"*; the 2026-08-21
migration doc answered the build half with upstream's `quay.io/openbao/openbao-hsm` image. **For
the nix path it is cheaper than either.** Evaluated at the pinned rev:

```
pkgs.openbao.tags                              => [ "hsm" "ui" ]
pkgs.openbao.override { withHsm = false; }.tags => [ "ui" ]
pkgs.openbao.version                            => "2.5.4"
```

`withHsm ? stdenvNoCC.hostPlatform.isLinux` — **HSM support is already on by default on Linux.**
`nixpkgs` also ships `services.openbao`. So a NixOS node can have a PKCS#11-capable `bao` with zero
build work.

Two honest deltas: our pin is **2.5.4** while the docs quoted throughout this thread are **v2.6.2**,
and the *"seal becomes an external plugin at v2.7.0"* pin from the earlier docs still stands. Both
are version skew to re-check at adoption, not blockers.

### 1.4 Where the PKCS#11 module has to be loadable from — the open blocker, with a fourth option

`2026-08-21-openbao-migration-path-*.md` §6.3 left this open: the `openbao-hsm` image contains no
PKCS#11 module (its `apk add` line has no `tpm2-pkcs11`), and the pod also needs `/dev/tpmrm0` and
a token store that survives rescheduling. Three options were named. There is a fourth, and it is
the one that matters for *hands-off*:

| option | cost |
|---|---|
| **A. hostPath-mount the NixOS library into the pod** | the `.so` is a symlink into `/nix/store`, so `/nix/store` must be mounted read-only too. **And the library is glibc-linked while the `openbao-hsm` image is Alpine/musl+`gcompat`** — loading it is at best unproven. Nobody has tried it |
| **B. derived image layering a PKCS#11 module** | throws away §6.1's benefit (an upstream-published, signed image) and creates a supply-chain artifact we own |
| **C. initContainer copies a module into an `emptyDir`** | same musl/glibc question, plus a second image to source the module from |
| **D. run OpenBao on the host via `services.openbao`, not in a pod** | the TPM, the module, the token store, the libc and the systemd unit are all natively the same system — **the entire class of problem above disappears**. The cost is architectural: Vault/OpenBao stops being an ArgoCD-managed workload, so the cluster's secret store is no longer described by the same GitOps surface as everything else, and `services.openbao`'s `DynamicUser = true` needs a `SupplementaryGroups = [ "tss" ]` to reach the TPM at all |

**D is not a recommendation and is not landed.** It is a real option that only became visible once
the nix side was measured, and it is Aaron's call — it moves a component out of the cluster.

### 1.5 The seal configuration itself

Carried from the migration doc, not re-derived — with one thing upgraded from *researched* to
*checked at the version we would install*:

```hcl
seal "pkcs11" {
  lib          = "/run/current-system/sw/lib/libtpm2_pkcs11.so"
  token_label  = "zeta-openbao"
  key_label    = "bao-root-key-rsa"
  mechanism    = "CKM_RSA_PKCS_OAEP"   # NOT the default
  # pin: never here. See below.
}
```

- **`mechanism` must be pinned.** The default is *"best available"*, which prefers `CKM_AES_GCM`,
  and `CKM_AES_GCM` **does not exist in `tpm2-pkcs11`**. The migration doc measured that at tag
  `v1.10.1`; re-checked here at **1.9.2, the version our pinned nixpkgs ships**:
  `CKM_RSA_PKCS_OAEP` present at `src/lib/mech.c:158` with `mf_encrypt|mf_decrypt|mf_rsa`,
  `CKM_AES_GCM` absent. The intersection is one mechanism, at *our* version.
- **The PIN cannot live in the HCL.** The Helm chart renders `server.ha.raft.config` into a
  **ConfigMap**. `BAO_HSM_PIN` via a Secret is the supported route (§6.4 of the migration doc). On
  path **D** it is a systemd `EnvironmentFile` with `0400` root ownership instead — strictly
  simpler, and worth noting as a point in D's favour.
- **Honest note on what the PIN protects.** It is stored on the same node as the token it unlocks.
  It defends against a *remote* reader and against nothing that already has node root. Saying so
  now stops it being cited later as a second factor it is not.

### 1.6 What the installer must run once per node

`tpm2-pkcs11` needs a store, a token and a key before OpenBao can use it — three commands
(measured from the project's `docs/INITIALIZING.md`):

```
tpm2_ptool init    --path=$STORE                                  # primary object under the owner hierarchy
tpm2_ptool addtoken --pid=1 --sopin=… --userpin=… --label=zeta-openbao --path=$STORE
tpm2_ptool addkey  --label=zeta-openbao --algorithm=rsa2048 --key-label=bao-root-key-rsa …
```

Three things a design has to say out loud about that:

1. **This is where the PINs are minted.** An unattended run mints them and must put them somewhere
   the seal process can read at boot — i.e. on the node. That is not a failure, it is the honest
   shape of unattended: **the node holds what the node needs.**
2. **RSA size.** OpenBao's own example uses `rsa:4096`. Many firmware TPMs support **RSA-2048
   only**. Unverified on our silicon — it is one of the things the first real node discovers.
3. **The store is per-node state** (a sqlite db). It must live on a path that survives a pod
   reschedule (path A/B/C) or simply be a systemd `StateDirectory` (path D).

---

## 2. The init: non-interactive, and where the shares go when nobody is there

### 2.1 The mechanism — measured from `operator init`'s own flag documentation

The premise in the ask — *"anything an unattended process can read, an attacker who owns the node
can read"* — is right, and it has an exact answer: **make the process produce material it cannot
read.**

```
bao operator init -format=json \
    -recovery-shares=3 -recovery-threshold=2 \
    -recovery-pgp-keys=<three public keys> \
    -root-token-pgp-key=<one public key>
```

`-recovery-pgp-keys` *"behaves like `-pgp-keys`, but for the recovery key shares"*, and
`-root-token-pgp-key` encrypts the root token to a public key. **The server encrypts each share
before returning it**, so what lands in the unattended job's stdout is base64 ciphertext addressed
to a private key that does not exist anywhere on the node. It can then be written to a file,
committed, posted, logged — the node has published something it cannot open.

`-recovery-*` require an auto-unseal seal, so this design and the seal are one decision, not two.

### 2.2 The recipient already exists in the repo

`maintainers/aaron/gpg-pubkey.asc` is committed. Inspected locally with `gpg --show-keys`:

```
pub  ed25519  F892A7674A2649DC  aaron <aaron@lucent.financial>
sub  cv25519  61E9EB91389A5C46  [encryption]
```

Two things follow, and one of them is a trap worth naming:

- **The file format is fine.** OpenBao's `ReadPGPFile` *"first parse[s] as an armored keyring file,
  if that doesn't work, treat[s] it as a straight binary/b64 string"* — so the committed `.asc`
  works as-is, with no `gpg --export | base64` dance.
- **The key is ECC, and that historically did not work.** Vault's classic `golang.org/x/crypto/openpgp`
  could not encrypt to Curve25519. OpenBao's `helper/pgpkeys/encrypt_decrypt.go` imports
  **`github.com/ProtonMail/go-crypto/openpgp`** (`v1.4.1` in `go.mod`), which does support ECDH.
  **Register: RESEARCHED — the import was read, no encryption was performed.** This is the
  single cheapest falsifier in the whole design and it costs one command against a scratch OpenBao:
  if it fails, the fallback is an RSA recipient key, which is a five-minute fix *before* the
  ceremony and an outage *during* it.
- It also satisfies `clone-at-tag-stays-sufficient`: the recipient ships **in the clone**. Nothing
  has to be fetched for an unattended node to encrypt to Aaron.

### 2.3 What this buys, and — precisely — what it does not

**Buys:** no plaintext recovery share is ever written to disk, an env var, a Secret, a log, or a
Kubernetes object. The failure mode where automation "holds the shares somewhere a process can
read them" — which TOPOLOGY.md §5 correctly refuses — **does not occur**, because there is nothing
readable to hold.

**Does not buy:**

1. The plaintext shares exist **in the server's own memory** for the duration of the call. An
   attacker with node root at that instant has the barrier key anyway, so this is not a new
   exposure — but it is not zero and should not be sold as zero.
2. **The PIN and the token are on the node** (§1.5). The seal's security is the TPM's refusal to
   export the key, not secrecy of the PIN.
3. **Recovery keys are not unseal keys.** OpenBao, verbatim: *"Recovery keys cannot decrypt the
   root key, and thus are not sufficient to unseal OpenBao if the Auto Unseal mechanism isn't
   working. They are purely an authorization mechanism."* They authorize `generate-root` and
   rekey. They are **not** a backup of the vault. §3.

### 2.4 The root-token fork — the step that is genuinely not free

TOPOLOGY.md §5 step 4 uses the root token once to configure an auth method, then revokes it. An
unattended pipeline cannot do that with an encrypted root token, because it cannot read it. So:

| choice | consequence |
|---|---|
| **Encrypt the root token** to Aaron's key | the node is fully self-provisioned through unseal, and then **stops**. Configuring auth methods needs Aaron to decrypt one blob, once. Row 8 of §0 becomes a human step — a keyboard step, not a hardware one, doable from anywhere |
| **Leave it plaintext**, use it in-process, revoke it in the same process | genuinely zero-touch, and for the lifetime of that process a root token exists in memory and in whatever captured its stdout. It is the same licence Aaron already granted for CI (*"if we init key materials and throw it away not a bit deal"*), applied to metal, where the migration doc is explicit the licence was **not** granted |

**Not decided here.** But note the asymmetry: the encrypted-root-token option costs one human
action **once per cluster lifetime**, and the plaintext option costs a standing property of the
system. That is worth weighing before optimising away the last step.

### 2.5 Idempotency — the shape already exists

`bao operator init -status` exits `2` when uninitialised, `0` when initialised, `1` on error. That
is the same three-way distinction `ephemeral-vault-init.ts`'s `assertSealedBeforeInit` already
encodes for Vault, and it is what makes an unattended init safe to retry: a re-run on an already
initialised node must **exit clean without minting anything**, and an *error* must never read as
"not initialised" (discipline #6 idempotency + the check-did-not-run rule).

---

## 3. The tradeoff, stated plainly: **lose the board, lose the vault**

This is the part that must not be a footnote.

> *"If the seal mechanism or its keys are permanently deleted, then the OpenBao cluster cannot be
> recovered, even from backups."*
> — OpenBao, `docs/concepts/seal.mdx`, verbatim

A key generated inside a TPM **cannot be exported** — that is the property being bought. It follows
that the node's motherboard becomes the sole custodian. Not "the hardest to replace"; **the only
one.** A dead board, a firmware reset, an fTPM clear, a BIOS update that rotates the endorsement
hierarchy, or a re-pave that wipes the token store, and the ciphertext is permanently ciphertext.
Raft snapshots do not help — the snapshot is encrypted under the barrier key, and the barrier key
is wrapped by the key that is gone.

The repo already models this, tested, in a completely different context —
`src/Core.TypeScript/installer/credential-binding-model.ts`:

```
tpmSeal × reformat_same_stick → decrypts: true   "TPM seal is node-bound"
tpmSeal × machine_swap        → decrypts: false  "TPM seal fails on different machine"
```

That row is the whole of §3 in two lines, and it has been in the tree since before this thread
started.

### 3.1 The three candidate recovery stories

| | story | what it costs |
|---|---|---|
| **A** | **Accept the loss.** The vault holds nothing irreplaceable; if the board dies, re-init and re-issue | TOPOLOGY.md §2 measured it: *"Vault has never been initialised, holds no secrets, and has no live consumers."* **So A is free TODAY and gets monotonically more expensive from the first secret stored.** That makes this decision cheap now and painful later — which is the argument for deciding it before step 4 of the migration path, not after |
| **B** | **Escrow-and-import.** Generate the RSA key off-TPM, encrypt it to Aaron's public key, `tpm2_ptool import` it into each node's TPM. `import` exists (`tools/tpm2_pkcs11/commandlets_keys.py:221`, `@commandlet("import")`) | The escrow blob **is** the vault. The TPM stops being the root of trust and becomes a usage control — real value (it still resists remote extraction) but a strictly weaker claim, and it must never be described as "the key never leaves hardware". **It also solves the raft problem** (§3.2) |
| **C** | **Two seals / seal migration + off-node snapshots.** Migrate the seal before the board dies | OpenBao: *"The Seal migration process cannot be performed without downtime … requires that you briefly take the whole cluster down."* And it is **prospective only** — it does nothing for a board that already failed. C is a planned-replacement procedure, not a recovery story |

**There is no fourth option where the key is both unexportable and recoverable.** That is not a gap
in the tooling; it is what unexportable means.

### 3.2 The multi-node consequence, which is the same decision wearing a different hat

Three nodes have three TPMs, therefore three different wrapped root keys — so three raft members
**cannot unseal each other's data**. Under **A** that means the seal effectively pins the cluster to
one node; under **B** all three import the *same* escrowed key and raft works normally. The
migration doc reached this from the pod-packaging side (§6.3) and called it *"the strongest argument
for settling single-vs-three-node before the seal"*. It arrives here from the custody side and lands
on the same square: **C1 and C5 are one question.**

---

## 4. What genuinely cannot be automated

### 4.1 Class 1: firmware state — and the repo already has the precedent

`full-ai-cluster/nixos/modules/secure-boot.nix`:

> *"Firmware state is deliberately NOT expressible here — no software can put its own firmware into
> UEFI Setup Mode, so enrolment is a measured fact, not a declared one."*

Enabling Intel PTT is the same class. It is reached from the setup console before an OS exists; an
installed OS cannot set it, and no `.nix` file can express it.

- **Can nix pre-stage it?** **No.** This is the one place where Aaron's fallback does not reach.
- **What nix *can* do — and this is not nothing:** make the node *report* it. The five-state probe
  already exists and distinguishes `absent` (the fTPM-off-in-BIOS case, an enumeration that
  succeeded) from `unavailable`/`unreadable`/`indeterminate` (the check did not run). A boot-time
  probe writing that state into the node's self-registration turns "did somebody remember to turn
  the TPM on in this box?" from a memory into a **measurement**, fleet-wide, with no human. That is
  a small, safe, high-value follow-up and it is named in §8 rather than smuggled in here.
- **Can it at least be remote?** Yes. The fleet already has **GL.iNet Comet KVMs** and remote-power
  on each node (`docs/inventory/fleet-aaron-max-2026-06-09.md`). A KVM-over-IP drives the BIOS menu
  from anywhere. So the honest ceiling is **"a human decides, once per box, without travelling"** —
  not "no human".
- **Would a biometric gate satisfy the standing rule?** The standing rule (*"nothing is operator
  run, only operator approved with hello/biometrics"*) fits this perfectly in spirit — but see 4.4.

### 4.2 Class 2: the physical acts

Racking, power, cabling, inserting the stick. Remote-power covers subsequent boots; the first one is
hands. Nothing to design here; it is just true.

### 4.3 Class 3: custody decisions

C1–C5 in `tpm2-seal-prereqs.nix`'s refusal message. These are **one-time**, they are keyboard work
rather than hardware work, and they are exactly what an agent must not decide (source ≠
authorization). Answering them does not have to happen at the node, or near it, or twice.

### 4.4 The biometric gate does not currently run where the metal is

`tools/setup/persona-keys/biometric.ts` `detectBiometricPlatform`: `darwin` → Touch ID, `win32` →
Hello, **everything else → `unsupported`, which is fail-closed.** The nodes are Linux. So a
biometric-gated step *on a node* is not implementable today — the gate would refuse every time,
correctly.

That does not sink the rule; it locates it. "Agent executes, human approves" for a metal ceremony
means the **approval happens on Aaron's Mac** and something carries it to the node. Two shapes
exist in the repo already and neither has been wired for this: a Mac-side approval that produces a
signed artifact the node verifies, or the decryption in §2.4 — **Touch ID gating the one `gpg
--decrypt` of the root-token blob is itself a biometric gate on the only remaining human step, and
it needs no new mechanism at all.** That is the cheapest way this design satisfies the standing rule,
and it is a proposal, not a decision.

---

## 5. The proposal — what would change about what a human does

**Governance-visible.** `TOPOLOGY.md` §5 is the ceremony of record and is **unchanged by this
document**. What follows is the diff a human would see if Aaron accepts it; landing it is a separate
PR that must say so in its title.

| | today (TOPOLOGY.md §5) | proposed |
|---|---|---|
| Enable fTPM in firmware | — (not part of the ceremony; nobody has done it) | **once per box**, at the console or over the KVM |
| Biometric gate | before init | before **the one decryption** (§4.4), on the Mac |
| `operator init` | human runs it, reads key material | **unattended**, output is ciphertext addressed to Aaron |
| Distribute shares | human distributes, custody undecided | **nothing to distribute** — the shares are already encrypted to their recipients when they first exist |
| Root token | human uses once, revokes | Aaron decrypts one blob once, **or** §2.4's plaintext option |
| **Unseal** | **human, `threshold`-many times, EVERY restart** | **automatic, forever** |
| Board dies | re-init, re-issue (nothing is stored yet) | **§3 — answer C1 first** |

The line that carries the value is the second-to-last. Everything else in this document is in
service of deleting a manual step that recurs on **every reboot of every node**.

**What this proposal does not touch:** TOPOLOGY.md §5's refusal to automate unseal *on Vault CE*
stands exactly as written and for exactly the stated reason. This is not a loosening of that
sentence; it is the migration the sentence itself anticipates — *"a later OpenBao migration replaces
step 5 with a hardware seal and leaves steps 1–4 intact."*

---

## 6. What shipped with this document

Uncontroversially safe, decides nothing, inert until a human flips one word:

- **`full-ai-cluster/nixos/modules/tpm2-seal-model.nix`** — the pure model: three modes
  (`off` / `prereqs` / `provision`), `derivePlan`, and `assess`, which compares a declared mode
  against the probe's **five states** rather than a boolean. `absent` is the only state that
  produces `drift`; `unreadable` / `unavailable` / `indeterminate` produce `check-did-not-run` and
  are never rounded to a negative.
- **`full-ai-cluster/nixos/modules/tpm2-seal-prereqs.nix`** — the option surface. Default `off`
  sets **no option**, so importing it is a provable no-op (verified: a real
  `nixosConfigurations.control-plane` evaluation returns an all-false/null plan). `prereqs` is the
  safe rung — §1.2's options plus `tpm2-tools` plus a `bao` CLI with `withHsm` **pinned** true.
  `provision` **fails evaluation**, naming C1–C5.
- **`full-ai-cluster/nixos/tests/tpm2-seal-prereqs-eval-test.nix`** + a `checks.*` entry —
  **25 properties, all holding**, run by `nix flake check --no-build` with no VM and no hardware.
  Mutation-checked rather than asserted: loosening the provision gate goes red by name, and
  flipping the `withHsm` pin to `false` goes red by name.

**Aaron's fallback, made concrete: the whole installer-side change is one word.**

```nix
zeta.tpm2Seal.mode = "prereqs";
```

It is *not* flipped in this PR. Flipping it changes every node's system closure and loosens
`/dev/tpmrm0` from root-only to the `tss` group — small, defensible, and still a change to the
fleet's security surface that belongs to Aaron and not to a scoping PR.

---

## 7. Register

**MEASURED** (a command was run here, or a file's bytes were read):

- `pkgs.openbao` at the pinned rev `b77b3de…`: `version = "2.5.4"`, `tags = [ "hsm" "ui" ]`,
  `override { withHsm = false; }` → `[ "ui" ]`. `tpm2-pkcs11` = 1.9.2, `tpm2-tools` = 5.7.
- `nixos/modules/security/tpm2.nix` at that rev — every option in §1.2 read from source, including
  the `libtpm2_pkcs11.so` path and the udev rule text.
- `tpm2-pkcs11` **1.9.2** `src/lib/mech.c`: `CKM_RSA_PKCS_OAEP` present at `:158`, `CKM_AES_GCM`
  absent. (The prior doc measured this at `v1.10.1`; re-checked at our pin.)
- OpenBao `v2.6.2` docs: `operator init` flags (`-recovery-pgp-keys`, `-root-token-pgp-key`,
  `-pgp-keys`, `-stored-shares`, `-status` exit codes); the `seal "pkcs11"` field list and env-var
  names; the recovery-key warning quoted in §3; the "key material created externally" note.
- OpenBao `helper/pgpkeys/{flag.go,encrypt_decrypt.go}` and `go.mod` @ v2.6.2 — armored-file
  handling, and the `ProtonMail/go-crypto v1.4.1` import.
- `tpm2_ptool` `import` commandlet exists (`commandlets_keys.py:221`); the three-step init/addtoken/
  addkey flow from `docs/INITIALIZING.md`.
- `maintainers/aaron/gpg-pubkey.asc` — ed25519 primary + cv25519 encryption subkey, via
  `gpg --show-keys` locally.
- In-repo: the twelve TPM captures and their single `observed` entry; the four `node.yaml` files
  and their absent TPM field; `credential-binding-model.ts`'s tpmSeal rows;
  `biometric.ts:detectBiometricPlatform`; `secure-boot.nix`'s firmware paragraph; TOPOLOGY.md §2/§5.
- The shipped module: 25 eval-test properties green, two mutations red, and a real
  `nixosConfigurations.control-plane` eval returning the all-off plan.

**RESEARCHED** (a document or source says so; not exercised):

- That `ProtonMail/go-crypto` will in fact encrypt to Aaron's cv25519 subkey. The import was read;
  **no encryption was performed.** §2.2 names the one-command falsifier.
- That `-recovery-pgp-keys` encrypts server-side before returning. Documented behaviour, not
  observed.

**ASSUMED — said out loud:**

- That the nodes' Core Ultra CPUs expose Intel PTT and that it can be enabled in their particular
  mini-PC firmware. Neither the CPU feature nor the BIOS menu has been looked at.
- That a firmware TPM on these boards supports the RSA key size the seal needs (§1.6).

**COULD NOT CHECK — no hardware, and no Linux node reachable from here:**

- Whether any Zeta node has a TPM 2.0 at all. **This is the load-bearing unknown**; every §1–§3
  claim is conditional on it.
- Whether `libtpm2_pkcs11.so` loads inside the Alpine/musl `openbao-hsm` image (§1.4 A/C).
- Whether OpenBao's seal negotiates `CKM_RSA_PKCS_OAEP` against a real TPM. The mechanism sets
  intersect on paper at our pinned versions; no seal has been exercised.
- `helm-validate`'s render/ratchet behaviour — unchanged from the migration doc's §6.6, and
  untouched by this PR (no manifest changed).

**"Should work" appears nowhere above on purpose.** Where something is untested it is in the last
two lists.

---

## 8. Open questions for Aaron

1. **C1 — is the seal key generated in the TPM (unrecoverable) or imported from an escrow
   (recoverable, escrow becomes the secret)?** Everything else waits on this, and §3.1 says it is
   free to answer today and expensive later.
2. **C5 — single-node or three-node first?** Same question as C1 in a different costume: three TPMs
   are three keys unless C1 is "imported".
3. **The root token (§2.4)** — encrypted to you and decrypted once, or plaintext-in-process and
   revoked? The first keeps one human step; the second removes the last one and adds a standing
   property.
4. **Path D (§1.4)** — is OpenBao allowed to run on the host as a systemd service instead of as an
   ArgoCD workload? It deletes an entire class of container plumbing and moves a component out of
   the GitOps surface.
5. **May I flip `zeta.tpm2Seal.mode = "prereqs"` on the control-plane host?** One word; installs the
   TPM userspace; mints nothing; loosens `/dev/tpmrm0` to the `tss` group.
6. **May a boot-time probe write the node's TPM state into its self-registration?** Read-only, no
   secrets, and it is what turns "we can count on it" into a measurement across the whole fleet
   without anyone visiting a box (§4.1).

## 9. Gated / never-run

No cluster contacted. No `kubectl`, `helm`, `argocd`, `bao`, `vault`. No device touched, no TPM
read, no key, PIN or credential handled, `op` not invoked. `bao operator init`, unseal/recovery
share generation, and TPM/HSM key minting remain a **gated class**: fresh human authorization plus
the biometric gate, with a witness. Designed here; run by a human, never by an agent.
