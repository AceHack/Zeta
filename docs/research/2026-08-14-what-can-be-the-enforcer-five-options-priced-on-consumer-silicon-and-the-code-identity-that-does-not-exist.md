# What can be the enforcer — five options priced on the silicon we own, and the code identity that does not exist

Survey-and-cost. Follows PR #10675, which resolved the enforcement question in the negative and
exported the finding as `INSTALL_TIME_VS_RUNTIME`:

> *"ace can supply the policy an external enforcer names; it cannot be that enforcer."*

The open question this note answers: **what can be that enforcer, on the hardware we actually
have, and what does each option cost?**

The answer is *not yet*, for a reason stronger than cost. Three of the five candidates fail for
one shared and previously unnamed reason, and the survey found the object they were meant to
protect does not exist.

---

## 0. The four corrections — measured, not inherited

I was asked to verify rather than inherit. Four inherited claims did not survive, and one of them
changes the shape of the whole question.

### 0.1 There is no HSM. The credential in open question 2 does not exist

The preliminary note's §3 describes L1-today as *"A YubiHSM offers domains and authentication keys,
so each agent can be given its own auth key."* That reads as a description of the fleet. It is not.

`docs/inventory/hardware-to-buy.md` §2 lists YubiHSM 2 under **Tier 1 — discrete HSMs (the buy
list)**, at ~$650 each, with a recommended buy of 3× YubiHSM 2 + 1× NetHSM ≈ $3,150. It is
procurement, not inventory. The owned-hardware draft
(`hardware-2026-05-27-addison-draft.md`) lists no HSM of any kind.

Confirmed by running the probe on the Mac Studio:

```
[Hardware Security Probe] Result:
  TPM 2.0:           Not found
  YubiKey:           Not detected
  PKCS#11 Library:   Not found
  Hardware present:  NO - a hardware seal tier will THROW here
```

So **open question 2 — "does the macOS keychain ACL reach the HSM credential?" — is asking about an
object that does not exist on this fleet.** The honest answer is not "only keychain-resident
secrets"; it is *there is no HSM credential to reach, and the question cannot be settled by
measurement until one is bought.* §1 answers it anyway for the case where one is bought, because
the answer turns out not to depend on the purchase.

### 0.2 The hardware probe does not detect the Secure Enclave. It never looks

The preliminary note §4 says the Secure Enclave is *"present-but-unusable, precisely because no seal
tier reaches it,"* attributing this to `frost-hardware-probe.ts`. The probe contains **no Secure
Enclave code path at all.** It probes exactly three things: Linux TPM device nodes
(`/dev/tpmrm0`, `/dev/tpm0`, `/sys/class/tpm`), `ykman` output, and five hardcoded PKCS#11 library
paths. On the M2 Ultra it therefore reports `noHardwareDetected: true` and says nothing whatsoever
about the Enclave.

The Enclave's presence is an **inference from the CPU being Apple Silicon**, not a measurement. The
conclusion is right and the stated reason is wrong, which matters because the real reason is more
useful and is recorded elsewhere in the same codebase — `frost-partial-signer.ts:110-113` and
`frost-share-adapter.ts:705-709`: the Enclave is reachable only through the Keychain
(`kSecAttrTokenIDSecureEnclave`), is **P-256 only**, exposes **no AES key-wrapping primitive of the
required shape**, and **cannot do Ed25519 FROST partials**. No seal tier reaches it because of a
curve and primitive mismatch, not because nobody wired up a probe.

### 0.3 TPM 2.0 *is* available on the x86 fleet. The "no hardware isolation" premise is too broad

The briefing's consequences — no Intel TDX (Xeon-only), no AMD SEV-SNP (EPYC-only), SGX removed
from consumer desktop — are all **correct**, and I verified each independently:

| Claim | Verdict | Source |
|---|---|---|
| TDX is Xeon Scalable only (4th gen / Sapphire Rapids+) | **confirmed** | Intel developer docs |
| SGX removed from client CPUs from 11th gen (Tiger Lake) | **confirmed** | Intel Community, Intel staff response |
| SEV-SNP is EPYC-only; consumer Ryzen lacks it | **confirmed** | AMDESE/AMDSEV; AMD SEV product page |

But those three facts are about **confidential computing** — encrypted VM memory and attested
enclaves. They do not imply the fleet has *no* hardware root. **Firmware TPM 2.0 is present on
essentially the whole x86 fleet**: AMD fTPM runs inside the PSP on consumer Ryzen, Intel PTT is the
equivalent on Intel client parts including N100/N150-class. `hardware-to-buy.md` already says this
in its own **Tier 0 — already owned (use first, $0)**: *"TPM 2.0 in the mini-PCs / Start9 servers
(fTPM or discrete) — free per-machine sealing root … Start here for the PoC."*

So the L3 rung (TPM-sealed to PCRs) is **not blocked by hardware** on the x86 nodes. It is blocked
by other things, priced in §3. Two caveats keep this honest:

- **Unverified per-node.** The Secure Boot research doc's own open question 4 — *"Do the nodes have
  TPM 2.0?"* — is still open. fTPM commonly ships **disabled in BIOS**, and enabling it is a
  per-node physical ceremony. Nobody has run the probe on a Linux node and posted the result.
- **fTPM is not a discrete TPM.** *faulTPM* (TU Berlin, arXiv:2304.14717) extracts the chip-unique
  secret protecting AMD fTPM objects via ~$200 of voltage fault injection on the SVI2 bus, defeating
  anything sealed to it — Zen 1/2/3, plausibly Zen 4. AMD's own bulletin AMD-SB-4005 acknowledges
  it. This requires **physical access to the motherboard**, so against our actual threat model (a
  confused agent, not an attacker with a soldering iron) fTPM is fine. It should simply never be
  described as equivalent to a discrete TPM.

### 0.4 `ace verify` on `origin/main` is still a check that cannot fail

Reported as the tenth such check. Confirmed on `origin/main` (`src/Core.TypeScript/ace/ace.ts:1794`):

```ts
if (parsed.command === "verify") {
  const pkgs = listInstalled(parsed.storePath);
  const found = pkgs.find((p) => p.hash === parsed.hash || p.manifest.content_hash === parsed.hash);
  if (!found) { console.error(`ace: no installed package with hash ${parsed.hash}`); return 1; }
  console.log(`ace: ${found.manifest.name}@${found.manifest.version} present (manifest hash ${found.manifest.content_hash})`);
  return 0;
}
```

It calls neither `verifySignature` nor any content re-hash — both of which the same file imports and
uses on the install path. It matches the argument against the store's **own recorded** hash and
prints that same recorded value back. A payload swapped on disk after install passes. The help text
is candid — `Confirm an installed package is present` — but the verb is `verify`, and the failure
mode of a tautological `verify` is that it is *believed*.

Left unfixed deliberately: `src/Core.TypeScript/ace/` is another agent's live area this cycle, and
commit `28f6b424bc` on `feat/ace-capability-manifest` is titled *"ace verify can now fail."* Noted
here so the finding is not lost if that branch changes shape.

---

## 1. The shared defect: there is no code identity on this fleet to name

Options 1, 2 and 3 — macOS keychain ACL, Linux LSM label, IMA/EVM — are three different mechanisms
with one common assumption: **that the thing asking for a credential presents a distinguishable
code identity.** On this fleet it does not, and this is measured, not argued.

`tools/setup/host-loop-bootstrap.sh` generates one launchd plist per cell. Every cell's
`ProgramArguments` is:

```xml
<string>${CLONE_DIR}/tools/kiro/kiro-loop-wrapper.sh</string>
```

A **shell script**. Shell scripts carry no code signature; to any signature-based mechanism their
identity is their interpreter, `/bin/bash`, shared with every process on the machine. The script in
turn drives `bun`, and `bun`'s signature is:

```
Authority=Developer ID Application: Jarred Sumner (7FRXF46ZSN)
TeamIdentifier=7FRXF46ZSN
```

So the only real code identities available to an ACL on this fleet are:

1. `/bin/bash` — Apple-signed, shared with the entire operating system. Names nothing.
2. `bun`, Team ID `7FRXF46ZSN` — shared by all four cells, and by anyone anywhere who downloaded the
   same signed build. Names nothing *and* roots our key policy in a third party's Developer ID.
3. The `.ts` files, which are **data read by an interpreter**, not executed code, and are not what a
   signature-bound ACL inspects.

Confirmed live: `launchctl list` shows `com.lucent.zeta.{otto,vera,lior,alexa}`, all in
`$HOME/Library/LaunchAgents`, all bootstrapped into `gui/$(id -u)`. All four clone directories are
`acehack:staff` mode 755 — every cell can read every other cell's working tree.

**This is `INSTALL_TIME_VS_RUNTIME`'s third reason — the unmeasured interpreter — reappearing one
layer down.** It was found to disqualify ace as an enforcer. It equally disqualifies the OS
mechanisms that were proposed to replace ace, and for the identical reason. That is the survey's
central result: the gap is not that we lack an enforcement mechanism. **It is that we lack the
identity any of them would enforce against**, and buying a mechanism does not create one.

Option 2 in the numbered list below (`codeIdentityCollisions`) is this result as a test, in
`src/Core.TypeScript/enforcement/credential-reachability.ts`.

### 1a. The measured baseline: current isolation is zero, and now that is a number

Aaron's position — *"we might just have to trust agents not to read each others keys in the start"*
— is correct, and it is now **measured** rather than assumed. The one real credential on this box is
the 1Password service-account token in the file-based login keychain. From an arbitrary `bash`
process running as the user:

```
$ security find-generic-password -s zeta-op-service-account -w
READ SUCCEEDED without prompt. secret length=852 (value redacted)
```

No prompt, no ACL challenge, no code check. The ACL on the one credential that actually exists is
effectively *"any code running as this user."* Every cell has it.

Note what this reframes. The custody stack — FROST, DKG, reshare, ROAST, seal tiers, the
no-silent-downgrade factory — is built and well-tested, but `find ~/.zeta ~/.config/zeta` turns up
**no FROST shares on disk at all**. So today the enforcement question protects: one keychain token,
readable by everything. Not a set of per-agent sovereign keys — those have not been provisioned.

---

## 2. The five options, priced

### Option 1 — macOS keychain ACL bound to a code signature

**What it enforces.** For items in the **file-based login keychain** (`login.keychain-db` — which is
exactly where `zeta-op-service-account` lives), an ACL can list trusted applications; a caller whose
signature is not on the list is challenged or refused. `SecTrustedApplicationCreateFromPath` is
deprecated as of macOS 10.15 but remains the only way to put another program on an item's ACL, and
the rule is that to read without a prompt your code signature must match a trusted app or you must
be in the right keychain access group. It does **not** apply to the data-protection keychain, where
`kSecAttrAccessControl` / `SecAccessControl` govern instead — and those flags
(`.userPresence`, `.biometryCurrentSet`, `.devicePasscode`) gate on **human presence, not code
identity**. The briefing pairs these two APIs; they are different mechanisms with different
subjects, and only the deprecated one binds code.

**Does it reach the HSM credential?** No, twice over:

1. There is no HSM (§0.1).
2. If one is bought, it still does not. The "HSM credential" is a PKCS#11 PIN or YubiHSM auth key.
   An ACL can protect a *stored copy* of that PIN in the keychain — but it cannot gate **use of the
   token**. Once any process opens a PKCS#11 session the keychain has no further say, and the
   PC/SC layer is a shared system service, not a per-caller one. The ACL protects a copy of a
   credential, never the use of the device. That is a time-of-check/time-of-use gap of exactly the
   kind that disqualified ace.

**Cost.** Low in code, prohibitive in operation, and pointless in effect:

- *Effect:* nil today. The only signature to bind is `bun`/Team ID `7FRXF46ZSN`, shared by all four
  cells (§1). An ACL naming it separates nothing.
- *Operation:* the failure mode of an ACL miss on macOS is a **modal prompt**. The cells are
  unattended launchd agents on a 60s `StartInterval`. A prompt in that context is not a denial — it
  is a wedged cell that stays wedged. This is a node-availability regression bought for zero
  isolation.
- *Direction:* binding key policy to a third party's Developer ID makes Apple and the Bun project
  joint authorities over whether our agents can reach their own keys. That is the centralized
  authority the framing forbids, arrived at accidentally.

**Worth doing before server hardware?** **No.** It protects the wrong object, cannot distinguish the
things it would need to distinguish, and degrades unattended operation. Say it plainly: *on macOS,
L2 protects the wrong object, and on this fleet it also names the wrong code.*

### Option 2 — Linux LSM labels (SELinux / AppArmor) gating the credential path

**What it enforces.** A mandatory-access-control label on subjects (processes, by executable path or
transition rule) and objects (files, by path/inode), enforced by the kernel regardless of uid. In
principle exactly right for "this domain may open this credential file, that one may not," and
unlike the macOS ACL it **fails closed with `EACCES`, not with a prompt** — which suits unattended
nodes much better.

**Does it reach the HSM credential?** Partially, and better than option 1. An LSM label can gate the
**device node and the PKCS#11 library** (`/dev/bus/usb/*`, the pcscd socket), not merely a stored
PIN. That is genuine use-gating rather than copy-gating. It still cannot gate *within* a session
once opened, and it does nothing about there being no HSM.

**Cost.**

- *NixOS module:* AppArmor is supported (`security.apparmor`) and is the cheap end — profiles are
  path-based, which suits per-cell clone directories (`~/.zeta/clones/<agent>/`). Call it a few days
  for a working profile set. **SELinux on NixOS is effectively unsupported** — no reference policy
  integration; treat it as a research project, not a module.
- *The defect that dominates:* AppArmor profiles attach to an **executable path**, and cells
  transition into a profile by exec'ing a profiled binary. Every cell execs the same `bash` and the
  same `bun` (§1). Profiles could be keyed on the *wrapper script path*, which does differ per cell
  (`~/.zeta/clones/otto/...` vs `.../vera/...`) — this is the one place where a per-cell distinction
  genuinely exists. But that identity is a **path, not a signature**: the cells run
  `git reset --hard origin/main`, and any cell can write into any other cell's clone (mode 755, same
  uid), so a cell can place code at a peer's profiled path. The label is only as strong as the
  filesystem permissions underneath it — which returns us to option 4.
- *Failure modes:* a mislabeled file after a `git reset` is a hard `EACCES` on a headless node.
  Recovering needs console access. Real, but debuggable, and honest — it fails closed.

**Worth doing before server hardware?** **Not on its own, and not yet — but it is the strongest of
options 1–3** and it is the one that becomes worth building *immediately* after option 4, because
option 4 supplies the per-subject distinction that makes the label mean something. Sequence
matters more than choice here.

### Option 3 — IMA/EVM

**What it enforces.** The kernel measures a file's hash at exec/open and, in *appraise* mode,
verifies a signature stored in the `security.ima` extended attribute against a key in the `.ima`
keyring, refusing to load on mismatch. Uniquely among options 1–3, an IMA policy with a
`FILE_CHECK`/`MMAP_CHECK` rule can appraise **files a process opens, not just files it execs** —
meaning it is the *only* mechanism surveyed that can in principle reach the `.ts` files rather than
stopping at the interpreter. It is the right shape for the actual problem.

**Does it reach the HSM credential?** Not directly — IMA appraises files, and a token is a device.
Indirectly it is the strongest of the three: it constrains *what code can run at all*, which is
upstream of every credential on the box.

**Does it compose with the ace signature, or duplicate it?** **It duplicates it**, for precisely the
reason the Secure Boot work already established for UEFI `db`. ace is **Ed25519 over canonical
JSON**; IMA appraisal wants an **X.509-rooted signature over file content** in an xattr, with
Ed25519 not among its standard algorithms. Same crypto-vs-policy split, same conclusion: the two
share a *policy* shape (trust roots plus revocation) and nothing more. Building the crypto bridge
was explicitly advised against; that advice applies here unchanged.

**Cost — and this is the one that kills it operationally.** IMA signatures live in **extended
attributes**, and **git does not carry xattrs**. Every cell runs
`git -C "$CLONE_DIR" reset --hard origin/main`, rewriting its working tree on every provisioning
cycle. So every `.ts` file would need re-signing after every sync, which requires **the IMA signing
key to be resident on the node being protected**. A signing key on the box, usable by the same
confused agent the scheme exists to contain, is not an enforcement boundary — it is a rename of the
problem. Add: initrd/keyring plumbing, a NixOS module with no upstream precedent, and a failure mode
where a mis-signed file makes a headless node unbootable.

**Worth doing before server hardware?** **No.** It is the most interesting of the three and the only
one that reaches the interpreter, but its unit of protection (a signed file at rest) is at war with
our unit of deployment (a git working tree rewritten every tick). That conflict is architectural,
not a matter of effort.

### Option 4 — ordinary Unix separation: a distinct user per agent cell

Assessed seriously, as asked. It is the best of the five, and it is still not free.

**What it enforces.** Everything the actual threat model needs. If cell-0 runs as `zeta-cell-0` and
cell-1 as `zeta-cell-1`, then mode-0600 files under each cell's own home are unreadable across
cells by the oldest, most-audited access control in existence — no new kernel feature, no new
trust root, no new failure mode the operator has not seen before. Against **a confused agent
reading a path it should not**, which is the stated threat, this is close to complete containment.
It is also the only option that requires **no code identity at all**, which is why it survives the
§1 defect that kills options 1–3.

**Does it reach the HSM credential?** **Yes, better than any other option here** — and this is the
part that is easy to miss. A PKCS#11 token is reached through a **device node and a daemon socket**,
both of which are ordinary filesystem objects with ordinary ownership. Unix groups gate access to
`/dev/bus/usb/*` and the pcscd socket natively. So when an HSM is eventually bought, per-user
separation gates **use of the token**, not merely a copy of the PIN — the exact thing option 1
cannot do. The unfashionable mechanism is the one that reaches the object.

**Cost.**

- *On Linux:* low, and the NixOS shape is idiomatic — `users.users.zeta-cell-N` plus systemd units
  with `User=`, `ProtectHome=`, `PrivateTmp=`. This is a normal NixOS module, not research.
- *On macOS: high, and structurally so.* This is the real cost and it is specific.
  `host-loop-bootstrap.sh` installs cells as **launchd user agents** in
  `$HOME/Library/LaunchAgents`, booted into `gui/$(id -u)`. LaunchAgents are per-user **by
  construction** — there is no `UserName` key that works in a user agent. Per-cell users on macOS
  requires converting cells to **LaunchDaemons** (root-loaded, `/Library/LaunchDaemons`, `UserName`
  set), which means: root-owned provisioning, four new local accounts, no GUI session (so anything
  depending on the login keychain or a user Homebrew prefix breaks), and per-user keychains that
  must be created and unlocked headlessly. Non-trivial and touching the live tick path.
- *Ongoing:* four clones become four home directories; per-user `bun`/`mise` state; log paths move.

**The defect that must be stated — and it is the answer to open question 5.** The manifest is
explicit: *"cell-id: Stable identifier for the cell slot (survives agent rotation)"* and *"To rotate
an agent: change the agent= field, push to main, re-run install."* So a per-cell uid binds keys to
the **slot, not the occupant**. When otto rotates out of cell-0 and a successor rotates in, the
successor inherits `zeta-cell-0`'s uid and therefore **every key otto left addressable by it**.

Which is intended? Neither, as currently posed. The two are different objects and the manifest
conflates them:

- A key bound to **code** is stable across rotation and is what §6 of the preliminary note wants.
- A key bound to a **cell occupant** must move when the occupant moves — and *moving it* is exactly
  the operation the no-forced-upgrade rule says only the holder may perform.

So per-cell users are sound for **cell-scoped resources** (workspace, logs, scratch, a build cache)
and unsound for **agent-scoped keys**, and the split is not currently drawn anywhere. A rotation
under naive per-user isolation silently hands one agent's sovereign key to its successor — which
fails the checkable test verbatim: *a party other than the key's holder caused that key to move.*
The fix is not more mechanism; it is that an agent's keys live with the **agent**, and rotation is a
reshare the agent performs on itself, exactly as §6a already argues.

**Worth doing before server hardware?** **The Linux half, yes — it is the only "yes" in this
survey**, and it should be scoped to cell-scoped resources, explicitly not to agent keys. The macOS
half: not yet; the LaunchDaemon conversion costs more than the isolation is worth while the only
credential on the box is a shared 1Password token that all four cells legitimately need anyway.

### Option 5 — VFIO passthrough for the GPU driver

**What it enforces.** Real containment of the one dependency we cannot rewrite, verify or sign: the
proprietary NVIDIA kernel module. Bound to `vfio-pci` and assigned to a VM, the driver runs inside a
guest, and IOMMU translation means a compromised or merely buggy driver cannot DMA into host memory.
For an unauditable out-of-tree blob with full kernel privilege, that is a genuine and correctly
identified boundary.

The module already exists: `full-ai-cluster/nixos/modules/gpu-passthrough.nix`, 75 lines,
`zeta.gpu-passthrough.enable`, `pciIds`, IOMMU kernel params, early `vfio_pci` binding, libvirtd +
OVMF. It is written and appears unexercised — `pciIds` defaults to `[ ]` and no host sets it.

**Does it reach the HSM credential?** **No, and it is not meant to.** Different axis entirely: VFIO
contains a *device driver*, not an agent. It is the only option here addressing the
kernel-privilege threat rather than the agent-to-agent threat, and it should not be scored on the
latter.

**Cost — and there is an architectural collision the module does not mention.**

- The primary-stack decision is on record
  (`2026-05-24-cluster-bare-metal-substrate-architecture…`): **Hypervisor = "None for primary stack
  (bare-metal direct)"**, justified partly by *"GPU passthrough simpler direct."* VFIO passthrough
  **requires** a hypervisor. So enabling it does not extend the architecture, it **reverses a landed
  decision** for GPU nodes: hypervisor + guest OS + k3s, the three declarative layers that decision
  chose NixOS to avoid.
- Downstream: GPU workloads move out of host k3s into guest VMs, so the NVIDIA k8s device plugin,
  the CSI path and Longhorn volumes all need re-plumbing for the guest. This is a cluster-topology
  change, not a module flag.
- IOMMU groups on consumer boards are the classic obstacle — consumer chipsets frequently group the
  GPU with other devices, forcing ACS-override patches that weaken the isolation being bought. Must
  be verified per board before any of this is planned.

**Worth doing before server hardware?** **No — but for a reason worth recording precisely.** It is
technically the most *real* containment in this survey, and it is aimed at a threat that is not the
one asked about. Deferred on **architectural collision and unverified IOMMU grouping**, not on
merit. If the fleet ever runs untrusted third-party GPU workloads, this moves to the top of the
list immediately.

---

## 3. Summary table

| # | Option | What it enforces | Reaches HSM credential? | Cost | Before server hw? |
|---|---|---|---|---|---|
| 1 | macOS keychain ACL + code signature | Read-gate on login-keychain items by signature | **No** — no HSM exists; if bought, gates a *copy of the PIN*, never token use | Low code, **prompt-wedges unattended cells**, roots policy in a 3rd-party Developer ID | **No** |
| 2 | Linux LSM label (AppArmor) | Kernel MAC on credential paths + device nodes; fails closed | **Partially** — can gate the device node and PKCS#11 lib | AppArmor: days. SELinux-on-NixOS: unsupported. Label strength bounded by underlying file perms | **Not yet — but first in line after #4** |
| 3 | IMA/EVM | Appraise files at exec **and open** — the only option reaching the interpreter | Indirectly (constrains what runs at all) | **Duplicates** ace (Ed25519/JSON vs X.509/xattr). xattrs die on `git reset --hard`; signing key would have to live on the protected node | **No** |
| 4 | Per-cell Unix user | Cross-cell file isolation; needs **no code identity** | **Yes — best of the five**; groups gate the device node and pcscd socket | Linux: low, idiomatic NixOS. macOS: **structural** — LaunchAgents are per-user by construction; needs LaunchDaemon conversion | **Linux half: yes**, scoped to cell resources, not agent keys |
| 5 | VFIO GPU passthrough | Contains the unauditable NVIDIA kernel module via IOMMU | **No** — different axis (driver, not agent) | **Reverses the landed no-hypervisor decision**; re-plumbs device plugin + CSI; consumer IOMMU grouping unverified | **No** — deferred on collision, not merit |

---

## 4. Recommendation

**Not yet — build almost none of it.** Specifically:

1. **Do nothing about code-bound key access.** Not because the mechanisms are weak, but because
   **the identity they enforce against does not exist** (§1) and **the object they would protect
   does not exist** (§0.1). Both would have to be created first, and creating them is a larger
   decision than adopting any mechanism here. Buying an enforcer before there is a code identity
   is buying a lock for a door that has no frame.
2. **Do land per-cell Unix users on the Linux nodes**, scoped explicitly to cell-scoped resources
   and explicitly *not* to agent keys. It is cheap, idiomatic on NixOS, needs no code identity, and
   is the only option that will still be correct after server hardware arrives — everything else
   here gets replaced by SEV-SNP/TDX, while ordinary uid separation composes with them.
3. **Do not convert macOS cells to LaunchDaemons yet.** The cost is structural and the isolation
   bought is currently zero-valued: the one credential on the box is a shared 1Password token every
   cell legitimately uses.
4. **Fix the record**, which costs nothing: the Secure Enclave claim in the preliminary note
   (§0.2), the YubiHSM-as-owned reading (§0.1), and `ace verify` (§0.4).
5. **Draw the missing distinction** — cell-scoped vs agent-scoped resources (§2, option 4). This is
   free, it is a prerequisite for every later option, and without it per-user isolation silently
   violates no-forced-upgrade at the next rotation.

### The thresholds that change this answer

Stated so they can be checked rather than felt. Any **one** of these flips a "no" to a "yes":

| Threshold | Which option it unblocks |
|---|---|
| **A cell's unit of execution becomes a signed artifact** rather than a `.ts` file read by shared `bun` — a compiled `bun build --compile` binary signed with our own key, one per cell | **1, 2, 3 simultaneously.** This is the root blocker; nothing in §1 survives it. It is also *cheap* — far cheaper than any mechanism here — which makes it the highest-leverage next move if this direction is ever wanted |
| **An HSM is physically purchased** (~$650, already specced) and `probeHardwareSecurity()` reports `pkcs11ModuleFound: true` on a real node | Makes open question 2 answerable by measurement; makes option 4's device-node gating load-bearing |
| **Agent keys are actually provisioned** — FROST shares exist on disk, which today they do not | Makes the whole survey concern a real object rather than a hypothetical |
| **A node with SEV-SNP (EPYC) or TDX (Xeon Scalable) enters the fleet** | Supersedes options 1–3 outright. Aaron's tier split becomes enforceable rather than aspirational: consumer swarms not-guaranteed-independent, server swarms hardware-isolated |
| **Untrusted third-party GPU workloads** are scheduled on fleet hardware | Option 5 moves to the top the same day |
| **fTPM verified enabled on a Linux node** (`/dev/tpmrm0` present) | Makes TPM sealing a real option for at-rest share protection — worth noting it is *at-rest only*: `tpm2_unseal` returns bytes to the host, per `frost-share-adapter.ts:714-718` |

### On centralization, checked rather than asserted

Two of the five options smuggle in a central authority, and neither does it obviously:

- **Option 1** roots key policy in **Apple's notarization plus the Bun project's Developer ID**. Our
  agents' access to their own keys would depend on two companies' signing infrastructure. Aaron
  built centralized PKI at Itron and those patents are the boundary Zeta is defined against; this
  would import that shape by accident, through a convenience.
- **Option 3** needs a signing key with fleet-wide reach to re-sign after each sync — a fleet CA in
  all but name, which the ace design deliberately avoided (*"ace trust roots are per-node, with no
  fleet CA"*).

**Option 4 has no such property**, which is a further argument for the boring mechanism: a uid is
local to a machine, issued by nobody, and revocable by its own holder.

### Against the no-forced-upgrade test

The checkable test is: **can any party other than the key's holder cause that key to move?**

- Options 1, 2, 3: **fail as naively specified.** Each binds a key to a code identity, so whoever
  controls the signing key or the policy controls whether an agent may still reach its own key
  after it changes its own code. That is a forced-upgrade lever wearing a security hat — the
  mechanism does not have to *move* the key to violate the rule; making the key unreachable until
  the agent adopts blessed code is the same coercion by another route. Any future version must put
  the signing authority in the **agent's own hands** (an agent signs its own code, the policy names
  the agent's own key) for the rule to hold.
- Option 4: **fails at rotation**, as shown above, and the fix is §6a's reshare, not more mechanism.
- Option 5: **passes** — it constrains a device driver, not a key holder.

---

## 5. The check built for this survey

`src/Core.TypeScript/enforcement/credential-reachability.ts` (+ `.test.ts`, 14 tests). Pure and
total; all effects injected (dv2 #7 noninterference). Verdicts name the **fact**, never the reading —
`reachable-without-authentication`, not `leaked` — per
`dual-use-detection-is-neutral-oracle-decides.md`: four cells deliberately sharing a credential and
one exposed by accident are the same fact, and the module is not allowed to choose.

It encodes three things this survey measured:

- `classifyReachability` — keeps **absent** distinct from **unreachable**. An untested boundary is
  not a boundary that held. That conflation is how a check comes to be one that cannot fail.
- `assessCellIsolation` — an unchallenged credential is reachable by every cell sharing the uid, and
  reports `isolated` and `rotationCaveat` **separately**, so the option-4 defect is visible as a
  state where both are true at once.
- `codeIdentityCollisions` — §1 as an assertion: given the fleet's real code identities, returns the
  identities mapping to more than one cell. On the measured fleet it returns one entry covering all
  four.

**Mutants planted, each killed** (per the standing discipline; restored to 14 pass after):

| Mutant | Result |
|---|---|
| `classifyReachability` returns `unreachable` for an absent item (the conflation) | **13 pass, 1 fail** |
| `assessCellIsolation` ignores `uid` and grants every cell | **11 pass, 3 fail** |
| `codeIdentityCollisions` raises its threshold so collisions never report | **12 pass, 2 fail** |

---

## Pointers

- `docs/research/2026-08-14-code-bound-key-access-preliminary-integration-agent-to-agent-isolation-on-one-machine.md` — the note this answers; §0.1/§0.2 correct two of its claims
- `docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-desired-state-with-one-firmware-ceremony.md` — the boot half; §6.1 (NVIDIA loads fine under Secure Boot) and its still-open TPM question
- `tools/setup/host-loop-bootstrap.sh` — the launchd user-agent provisioning that makes option 4 structural on macOS
- `tools/setup/manifests/cluster-cells` — "cell-id … survives agent rotation", the source of the slot-vs-occupant conflation
- `tools/setup/persona-keys/frost-share-adapter.ts:696-718` — the TPM tier's honest at-rest-only limit
- `tools/setup/persona-keys/frost-partial-signer.ts:106-113` — the *real* reason no seal tier reaches the Secure Enclave
- `full-ai-cluster/nixos/modules/gpu-passthrough.nix` — option 5, written and unexercised
- `docs/inventory/hardware-to-buy.md` §2 — the HSM is procurement, not inventory; Tier 0 names fTPM as already-owned
- Anchors: Hunt & Larus, *Singularity* (SIGOPS OSR 41(2), 2007) — manifest/capability model without the verified kernel; Wulf et al., **HYDRA** (CACM 1974) — capability as unforgeable token naming object + rights; Jäger et al., *faulTPM* (arXiv:2304.14717) — the fTPM bound; Goguen & Meseguer (1982) — noninterference, the discipline the check is built under
