# Credential binding — TPM seal or USB iSerial? The R8 decision brief

**For Aaron · 2026-08-21 · author: shadow · register: measured except where marked**

This brief exists to make **§5.2 of `docs/design/2026-08-21-the-zeta-bootstrap-usb-full-design-document.md`**
answerable in a few minutes. It does **not** make the call and it does **not** implement the binding.
The seam stays a seam until §6 is answered.

**How to read this.** §0 is three defects found while building the brief — read it first, because one of
them changes what the options in §5.2 actually mean. §1–§4 are the decision material. §5 is a
recommendation, clearly marked as one. **§6 is the one question.**

**Method.** Every claim about current behaviour cites `file:line` at `origin/main` `94945a646`. No device
was touched, no secret read, nothing installed, nothing executed against hardware. Claims that could not
be grounded in code are marked **OPEN QUESTION** and are not counted as evidence.

---

## 0. Three defects found while building this brief

### 0.1 The shipped iSerial path is not stick-bound — the model says it is, and a test pins the claim

This is the most valuable finding here, because it means **one of the two options in §5.2 does not
currently deliver the property the table credits it with.**

The model asserts that binding to `usbISerial` **refuses** on a stick swap:

- `src/Core.TypeScript/installer/credential-binding-model.ts:157-159` —
  `stick_swap` ⇒ `{ decrypts: false, reason: "iSerial is physical-stick-bound" }`
- pinned as a test: `src/Core.TypeScript/installer/credential-binding-model.test.ts:68` —
  `expect(expectedBindingScenarioOutcome("usbISerial", "stick_swap").decrypts).toBe(false)`
- and carried verbatim into the design doc's table: `…-full-design-document.md:360`
  ("USB iSerial · reformat **yes** · stick swap **no** · machine swap **yes**").

The shipped restore path does the opposite. It never probes the device; it reads a **recorded copy of the
serial from a file on the installed root filesystem**, and says so in its own log line:

- `full-ai-cluster/nixos/modules/zeta-creds-restore.nix:104-106` — `usbISerialPath` defaults to
  `/etc/zeta/usb-iserial`
- `full-ai-cluster/nixos/modules/zeta-creds-restore.nix:230` —
  `BIND_VALUE="$(tr -d '\r\n' < ${cfg.usbISerialPath})"`
- `full-ai-cluster/nixos/modules/zeta-creds-restore.nix:236` —
  `log_restore "…binding-factor usbISerial (recorded; not a live probe)"`
- and the TypeScript that models it agrees: `src/Core.TypeScript/installer/installer-binding-cli.ts:228-229`
  — *"Re-probe is install-time; restore uses the recorded serial the same way UUID restore uses
  `/etc/zeta/usb-uuid` (stick need not still be plugged in)."*
- the value gets written there at install time:
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh:2607-2610` (`--usb-iserial` selected, serial teed to
  `/mnt/etc/zeta/usb-iserial`).

**So the two layers are not describing the same mechanism.** The model describes a *live-probe* binding —
`applyBindingScenario` mutates `usbISerial` and `bindingMaterialForContext` re-reads it from the mutated
context (`credential-binding-model.ts:73`, `:100-109`), i.e. it assumes the decrypting party asks the
device. The shipped restore reads a recorded string that travels with the *node*, not the stick.

Consequences, stated plainly:

1. **On the shipped path, `usbISerial` binds to neither the stick nor the node.** It is a plaintext string
   stored beside the blob on the same disk. Against anyone holding the disk it adds **no key entropy** —
   the whole strength is the operator passphrase. The same is true of `usbUuid`
   (`zeta-creds-restore.nix:100`, `/etc/zeta/usb-uuid`). This is not an argument against either option; it
   is an argument that **today's "binding" is passphrase-only in the threat model where it matters**, and
   the model does not say so.
2. **The one property that would make iSerial the better answer — "the stick carries the credentials from
   machine to machine, and only that stick opens them" — is exactly the property not implemented.**
3. **A test currently passes that pins a claim the system does not honour.** It is not a false test: it
   tests the model, and the model is internally consistent. It is a *falsifier aimed at the wrong layer* —
   the vacuity class in its polite form.

**This is not a reason to prefer TPM.** It is a reason to know that choosing iSerial means **also building
the live probe into the restore path**, which the §4 cost table now reflects.

### 0.2 The option the doc says your words "literally pointed at" is refused by construction at three layers

The design doc's R8 row quotes you (`…-full-design-document.md:86`):

> *"remember creds by default after logging in, tied to the USB key **AND** a hardware key … **AND** the
> UEFI boot partition, every time"*

and §5.2 offers a fourth row — **`iSerial ⊕ UEFI keyfile`** — annotated *"what your 2026-06-09 phrasing
literally pointed at"* (`…-full-design-document.md:362`).

**Every layer implements XOR, not AND, and falls back to the weakest factor when both are asked for:**

- `src/Core.TypeScript/installer/installer-binding-cli.ts:82-84` —
  `"--usb-iserial and --uefi-keyfile are mutually exclusive"`
- `src/Core.TypeScript/installer/zeta-creds-picker.ts:112` — the same refusal, again
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh:2504-2508` — both env opt-ins set ⇒
  `"both set; staying --usb-uuid"` — i.e. asking for *more* binding silently yields the **ephemeral FAT
  UUID**, the one factor the doc's own root-cause analysis calls broken.

And the model cannot express a combination either: `CredentialBindingFactorKind` is a single-member union
(`credential-binding-model.ts:16`), `bindingMaterialForContext` returns one factor's material
(`:68-79`), and `encryptWithBindingMaterial` takes one material string (`:257`). There is no
`and`, no ordered fallback, no k-of-n.

So §5.2's fourth row is **not an option that can be selected today** — it is a fifth thing to build, and
its cost is not the sum of the two probes but the sum of the two probes *plus a combination primitive the
model does not have*. Worse, the fallback direction is inverted: asking for two factors gets you the
weakest one instead of refusing.

### 0.3 Smaller, but it is in the same file: a comment that contradicts its own code

`credential-binding-model.ts:101-103` says `stick_swap` models *"no uefi keyfile unless explicitly
carried"*; `:107` then carries it unconditionally (`uefiKeyfile: encryptCtx.uefiKeyfile`), and `:168-172`
expects `uefiKeyfile`/`stick_swap` ⇒ `decrypts: true`. The code is a defensible modelling choice (operator
cloned the ESP); the comment describes the opposite choice. **Reading the comment gives you the wrong
answer about what the matrix says.** One-line fix, not a decision — noted so it does not get lost.

---

## 1. The two options, in the existing model's vocabulary

Stated as `CredentialBindingFactorKind` values (`credential-binding-model.ts:16`) so this brief and the
model use one vocabulary. No new terms are coined.

**Option A — `tpmSeal`.** KDF material is a value released by the node's TPM 2.0. Binding is to the
**machine**. Not currently reachable from any CLI: `installer-binding-cli.ts:57-58` types it *out* of the
persist/restore set (`Exclude<CredentialBindingFactorKind, "tpmSeal">`), and `parseRecordedBindingFactor`
(`:216-222`) rejects any sidecar value other than the three USB-side factors, so a `tpmSeal` sidecar aborts
restore today rather than being ignored.

**Option B — `usbISerial`.** KDF material is the USB controller's iSerial string. Binding is *intended* to
be to the **physical stick**; per §0.1 the shipped restore binds to a recorded copy on the node instead.
Reachable: probe (`usb-iserial-probe.ts`), opt-in (`ZETA_BIND_USB_ISERIAL=1`,
`zeta-install.sh:2506-2517`), persist flag, restore branch.

Two factors are **not** on the ballot and should not be, but are worth one line each so the ballot is
honest:

- **`usbUuid`** — today's default (`zeta-install.sh:2604`). It is what R8 is blocked *on*, not a candidate.
- **`uefiKeyfile`** — a real third option (`uefi-keyfile-esp.ts`), but it binds to a file on the target
  ESP, which is the thing a re-pave destroys. It answers a different question than either option above, and
  §5.2 already scores it "only if ESP survives."

---

## 2. Scenario by scenario

Two tables, because two of the five scenarios you named **do not exist in the model** and it matters which
is which.

### 2.1 Derived from `expectedBindingScenarioOutcome` — these are read off the code

| scenario | `tpmSeal` | `usbISerial` |
|---|---|---|
| `reformat_same_stick` | **opens** — `:182-183` *"TPM seal is node-bound; stick events do not change PCR seal"* | **opens** — `:154-155` *"iSerial survives reformat"* |
| `stick_swap` | **opens** — `:182-183` | **refuses** — `:157-159` *"iSerial is physical-stick-bound"* ⚠ **§0.1: not true of the shipped path** |
| `esp_wipe` | **opens** — `:182-183` | **opens** — `:160-165` *"ESP wipe does not change USB controller serial"* |
| `machine_swap` | **refuses** — `:185-186` *"TPM seal fails on different machine"* | **opens** — `:154-155` *"stick-bound not node-bound"* |
| `wrong_passphrase` | refuses — `:137-138` (GCM auth; both factors, always) | refuses — `:137-138` |

The two columns are **exact complements** on the only two rows where they differ (`stick_swap`,
`machine_swap`). That is the whole decision, and the doc's one-sentence framing of it
(`…-full-design-document.md:364-365`) is correct: *does a re-paved node remember its own credentials, or
does the stick carry them between machines?*

### 2.2 Beyond the model — reasoning, not derivation

**These rows are not in `CredentialBindingScenario` (`credential-binding-model.ts:22-28`). There is no
`tpm_cleared` and no `node_repave`.** What follows is argued from the mechanism, and is the weakest
material in this brief. Treat it accordingly.

| scenario | `tpmSeal` | `usbISerial` |
|---|---|---|
| **TPM cleared** (owner clear / ownership change) | **refuses, permanently.** The sealing hierarchy's primary seed is regenerated; no re-derivation exists. Observationally identical to `machine_swap`, which the model *does* cover (`:185-186`) — the difference is that `machine_swap` leaves the original machine able to open the blob and a clear does not | **opens** — no TPM in the path |
| **Firmware update** (dTPM vendor update / fTPM via BIOS) | **refuses if the seal has a PCR policy; opens if it does not.** The design decision "seal to PCRs or not" is not made anywhere in the repo and is *not* implied by choosing `tpmSeal`. Precedent that firmware updates are a real repair class with artifact consequences: `docs/research/2026-08-18-tpm-2-0-versus-yubihsm-2-as-root-of-trust-the-isolation-architectures-are-inverted.md:512-516` (ROCA — patch the chip, and every key it produced stays poisoned) | **opens** |
| **Node re-pave** (wipe the disk, reinstall, same machine, same stick) | **opens** — the seal is in the chip and survives the disk … **but only if the sealed object was persisted somewhere the wipe does not reach.** `tpm2_unseal -c <path>` needs a context/blob file (`tools/setup/persona-keys/frost-share-adapter.ts:1338`), and a context file on the wiped root is gone. **OPEN QUESTION: where does the sealed object live — TPM NV index, or the ESP?** It has to be one of the two, and nothing in the repo decides it | **opens** *if the recorded serial survives the wipe* — and per §0.1 it lives at `/etc/zeta/usb-iserial` on the root, so **a re-pave destroys it** unless the installer re-probes or re-writes it. With a live probe (which iSerial needs anyway) this becomes a clean **opens** |

One column-crossing observation worth having before §5: **`node_repave` is the scenario R4 and §4.4 of the
design doc are entirely about** — *"am I already running on this? … recover any hardware IDs and just
reinstall the image"* — and it is the scenario the model does not model. The matrix was built around
**stick** events (`reformat`, `swap`, `esp_wipe`) because that is where the code was. The decision is about
**node** events. That mismatch is why §5.2 has been hard to answer from the artifacts alone.

---

## 3. Recovery — what the operator does when the blob will not open

**This section is the one that decides it, so it is the longest.**

### 3.0 The fact that reframes the whole question: the blob is a cache, not a vault

Read `DEFAULT_MANIFEST` (`src/Core.TypeScript/installer/zeta-creds-manifest.ts:48-115`) and every declared
credential is in one of two classes:

- **re-obtainable by re-authenticating** — `gh-cli` (`:52`), `claude` (`:59`), `gemini` (`:66`), `codex`
  (`:73`), `wifi` (`:100`), `ssh-operator-pubkey` (`:93`, re-injected from the ESP by the installer)
- **explicitly declared regenerable** — `ssh-host-keys` (`:79-91`), `required: false`, notes:
  *"Regen on fresh installs is acceptable; persist for SSH-known-hosts continuity across re-installs."*
- **not produced by anything today** — `install-answers` (`:110`), the R10 gap

**Nothing in the blob is irreplaceable.** So the worst case of an unopenable blob is: *the operator
authenticates again, exactly as they do today*, plus an SSH known-hosts warning. That is R11 — *"gh has
throttled me for loggin in" / "this is the 3rd time i booted"* — which is a **real cost you have named**,
but it is a **recurring annoyance, not a loss event.**

This is load-bearing for the decision because it converts the question from *"which binding is safest?"*
(where the answer is always the most conservative) to *"which binding is unopenable less often, and how
loud is it when it is?"* — where the answer can be the more aggressive one.

**OPEN QUESTION, and the only thing that could overturn the paragraph above:** if node identity — the
self-registration keypair, or anything a node uses to prove it is *the same node* to the cluster — ever
lands in this blob, then an unopenable blob produces a **duplicate registration**, which is precisely the
`HWR-2` failure the design doc is holding open (`…-full-design-document.md`, §4.4 item 2). Today the
manifest does not declare such a credential. **If it ever does, re-read this section before trusting it.**

### 3.1 Option A — `tpmSeal` recovery

| when it stops opening | what the operator does | how loud |
|---|---|---|
| moved the disk to another machine | re-authenticate on the new node (device flow); the blob re-persists bound to the new TPM | one login round |
| TPM cleared, or firmware update invalidated a PCR policy | **same**: re-authenticate; re-persist | one login round |
| sealed object lost with the disk (see the §2.2 OPEN QUESTION) | **same** | one login round |
| operator forgot the passphrase | same as today — passphrase is in the KDF regardless of factor (`zeta-creds-crypto.ts:106-131`) | one login round |

**The recovery story is one story, and it is "re-run the thing you already run on a fresh node."** The
critical property is that the failure must be **detected and reported, not silently fallen back from** —
and the restore service already has exactly the right instinct: it *aborts* rather than falling back to
UUID (`zeta-creds-restore.nix:227`, `:239`, refusing UUID fallback). Extending that refusal to a failed
unseal is the correct shape and it is already the shape.

**The cost of the worst case is bounded and equals today's status quo.**

### 3.2 Option B — `usbISerial` recovery

| when it stops opening | what the operator does | how loud |
|---|---|---|
| stick lost, destroyed, or replaced (**with the live probe built** — §0.1) | **there is no recovery. The blob is dead.** Re-authenticate on every node that stick provisioned | one login round **per node** |
| re-pave wiped `/etc/zeta/usb-iserial` (shipped path today) | re-authenticate | one login round |
| operator plugged the stick into a different port / hub, or the enclosure was replaced | **OPEN QUESTION — I could not ground how stable a given stick's sysfs `serial` is across ports, kernels, and enclosure/controller swaps.** The probe reads it (`usb-iserial-probe.ts`) but nothing in the repo measures its stability. This is a real unknown sitting under the option | unknown |
| the stick reports no iSerial at all | falls back to UUID, silently (`zeta-install.sh:2515-2516`) — i.e. to the broken factor | silent |

Two asymmetries against B:

1. **B has a single point of failure that is a small plastic object that lives in a drawer.** A's failure
   domain (this node's TPM) is destroyed only when the node is destroyed — at which point the credentials
   were going to be re-issued anyway. B's failure domain is *shared across every node the stick touched*, so
   one lost stick is N re-authentications. **For the "production ready once 3 nodes" target, B's blast
   radius grows with the fleet and A's does not.**
2. **B's stick is the same object that must be physically present to provision anything.** If you have lost
   it you are re-flashing a new one regardless — so B's binding fails at exactly the moment you were
   already going to be doing manual work, *plus* it invalidates the credentials on nodes that were fine.

### 3.3 The recovery comparison in one line

**A fails in the same event as "this node no longer exists" — B fails in the event "a USB stick went
missing," which is far more likely and hits nodes that are perfectly healthy.**

---

## 4. What each costs from where the code is today

### 4.1 Option A — `tpmSeal`

**Already built and reusable, which is the surprise here:**

- **A real five-state TPM 2.0 probe** — `tools/setup/persona-keys/tpm2-linux-probe.ts`. `Tpm2State` is
  `"present" | "absent" | "unreadable" | "unavailable" | "indeterminate"` (`:338`), specifically so a check
  that *could not run* never reads as *no TPM* (`:9-45`). This is exactly the discipline needed for the
  no-TPM-in-CI constraint, and it exists.
- **A working TPM seal/unseal effects backend** — `tools/setup/persona-keys/frost-share-adapter.ts:1311-1360`
  (`createTpmSealEffects`, argv-form `tpm2_unseal`, injected `run` seam, eager `probe()`, and an honest
  `keyResidency: "host-ram-at-use"` at `:1353`). Injectable ⇒ hermetically testable with no TPM present.

**What must be built:**

| work | where | size |
|---|---|---|
| widen the persist/restore factor type to include `tpmSeal` | `installer-binding-cli.ts:57-58`, `:213`, `parseRecordedBindingFactor` `:216-222` | small, mechanical, type-driven |
| a `--tpm-seal` flag through persist / restore / picker | `zeta-creds-persist.ts:83`, `zeta-creds-restore.ts:86`, `zeta-creds-picker.ts:97-99` | small — three parallel edits to an established pattern |
| a `tpmSeal` branch in the restore service | `zeta-creds-restore.nix:225-247` — same shape as the two branches beside it, including the abort-not-fallback discipline | small |
| **decide and implement where the sealed object lives** (NV index vs ESP) and seal it at install | new — see the §2.2 OPEN QUESTION | **the real cost** |
| **decide PCR policy or no PCR policy** | new — and it is a *separate* decision from this one | **the real cost** |
| a QEMU swtpm lane so the path has any witness at all | `qemu-usb-storage.ts` is the sibling pattern | medium |

**Constraint check, and it is clean:** sealing uses a TPM *keyedhash* object, not an elliptic curve, so the
secp256k1 requirement and the FIPS-mode contradiction raised in §5.6 of the design doc **do not bite this
path**. The repo already distinguishes these — the same probe file carries a separate `Secp256k1State`
(`tpm2-linux-probe.ts:744`) precisely because curve support is an independent question from device
presence. And because the probe and the seal effects are both injected, **tests on a machine with no TPM and
no HSM stay green** — which is the constraint, and it is satisfied by construction rather than by a skip.

### 4.2 Option B — `usbISerial`

**Already built:** the probe (`usb-iserial-probe.ts`), the install opt-in
(`zeta-install.sh:2504-2517`), the persist flag, the restore branch (`zeta-creds-restore.nix:225-236`), the
sidecar, and a QEMU lane that gives the guest a serial (`qemu-usb-storage.ts`, #11193).

**Naively this looks like "flip the default from `--usb-uuid` to `--usb-iserial`" — one line at
`zeta-install.sh:2604`. That is the trap.**

**What must actually be built, because of §0.1:**

| work | why | size |
|---|---|---|
| a **live** iSerial probe at restore time | otherwise the option delivers none of the property it is chosen for (`installer-binding-cli.ts:228-229`, `zeta-creds-restore.nix:236`) | medium — and it is a genuinely new requirement: the restore service runs at boot and would now need the stick physically present |
| decide what happens when the stick is **not** plugged in at boot — which is the normal case for a running node | **this is a product question, not an implementation detail.** Requiring the stick at every boot makes the node un-rebootable without it; not requiring it means falling back to the recorded file, i.e. §0.1 again | **the real cost** |
| update the model + its test, or reclassify the model as *intent* | `credential-binding-model.ts:157-159`, `credential-binding-model.test.ts:68` currently pin a claim the system does not honour | small, but it is an honesty fix that must happen either way |
| measure iSerial stability across ports/enclosures | the §3.2 OPEN QUESTION | unknown until measured |

**The two costs are closer than they look, and B's is the one that is understated.** A's unbuilt work is
*decisions with known shapes* (where to store the sealed object; PCR policy yes/no). B's unbuilt work
contains a **product question with no good answer** — "must the stick be present at every boot?" — and one
**unmeasured hardware assumption**.

---

## 5. Recommendation

> **This is a recommendation. It is not a decision and nothing has been implemented.**

**Recommend Option A — `tpmSeal`.** Four reasons, in the order they carry weight:

1. **Recovery (§3).** A's failure event is "this node is gone"; B's is "a USB stick is gone." The second is
   far more likely, and its blast radius grows with the fleet while A's does not. Since §3.0 establishes the
   blob is a **cache of re-obtainable credentials**, the cost of *either* failure is bounded at "log in
   again" — so the right criterion is *how often* and *how many nodes*, and on both A wins.
2. **It matches the originating problem.** R11 is *"this is the 3rd time i booted"* — the **same machine**,
   repeatedly. A node-bound seal is the thing that makes the second boot free. A stick-bound one makes the
   second boot free too, but only by way of a stick that must then be present, which is a new obligation
   that did not exist before.
3. **It is what repair mode needs.** §4.4 of the design doc and R4 are about a node **recognising itself
   across a re-pave**. The credential that survives a re-pave is the one bound to the thing the re-pave does
   not touch — the chip. A stick-bound credential re-paves fine but says nothing about *which node this is*.
4. **The constraints are already satisfied and the code is already there.** TPM 2.0 is guaranteed on Linux
   cluster nodes; the probe refuses to round "could not check" up to "absent" (`tpm2-linux-probe.ts:338`);
   the seal backend is injected so no-TPM machines test green (`frost-share-adapter.ts:1329-1360`); and
   nothing here touches secp256k1 or FIPS.

**Two things to build alongside it, or the recommendation is worth less:**

- **Never fall back.** A failed unseal must abort loudly and route to re-authentication, exactly as
  `zeta-creds-restore.nix:227` / `:239` already do for the other factors. A silent UUID fallback would
  reproduce today's bug wearing a TPM badge.
- **Do not seal to a PCR policy in phase one.** It converts every firmware update into a credential-loss
  event (§2.2), and it buys nothing against the actual threat here — someone holding the disk — which
  no-PCR sealing already defeats. Add PCR policy later, as its own decision, with its own recovery story.

**What would change my mind — any one of these:**

- **The stick is meant to be the identity.** If the product is *"this stick provisions machines and its
  credentials go where it goes,"* B is right and A is wrong, and no amount of recovery analysis matters.
  §5.2 says these *"are different products"* and that sentence is correct — this brief argues from the
  cluster-node product, and if that is the wrong product I have argued the wrong side.
- **The blob stops being a cache.** If node identity (a self-registration key, anything proving *same
  node*) is ever declared in `zeta-creds-manifest.ts`, §3.0 collapses and the analysis must be redone with
  loss, not annoyance, as the failure cost.
- **Sealed-object storage has no good home.** If it turns out there is no durable place for the sealed
  object that survives a re-pave (the §2.2 OPEN QUESTION resolves badly), A's third argument evaporates.
- **Fleet heterogeneity.** If nodes without a usable TPM 2.0 are actually in scope — despite the standing
  constraint — the *"root of trust cannot be uniform"* problem applies
  (`docs/research/2026-08-18-tpm-2-0-versus-yubihsm-2-as-root-of-trust-…md:414`).

**And regardless of A or B, §0.1 and §0.2 are true and should be fixed:** the model/restore disagreement,
and the fact that asking for two binding factors silently yields the weakest one.

---

## 6. The question

> **Should the credentials belong to the node, or to the stick?**
>
> Answer **`node`** → bind `tpmSeal`; a re-paved machine remembers itself; a lost stick costs nothing.
> Answer **`stick`** → bind `usbISerial`; the stick carries credentials between machines; a lost stick
> costs every node it touched.

**One word unblocks R8.** Everything in §4 follows mechanically from it.

*(If neither word is right because the answer is "both," say **`both`** — that is §0.2, and it is a
different and larger piece of work, because every layer currently implements XOR and falls back to the
broken factor when asked for two.)*

---

## Pointers

- `docs/design/2026-08-21-the-zeta-bootstrap-usb-full-design-document.md` §5.2 (`:353-365`), R8 (`:86`) — the decision this brief serves
- `src/Core.TypeScript/installer/credential-binding-model.ts` — the model; `expectedBindingScenarioOutcome` `:130-192`
- `src/Core.TypeScript/installer/installer-binding-cli.ts` — persist/restore selection; `tpmSeal` excluded at `:57-58`
- `full-ai-cluster/nixos/modules/zeta-creds-restore.nix:210-256` — the boot-time restore branch, and the "not a live probe" admission at `:236`
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh:2504-2517`, `:2600-2615` — the R8 seam: the opt-in switch that defaults to `--usb-uuid`
- `tools/setup/persona-keys/tpm2-linux-probe.ts` · `tools/setup/persona-keys/frost-share-adapter.ts:1311-1360` — the TPM machinery that already exists
- `docs/research/2026-08-18-tpm-2-0-versus-yubihsm-2-as-root-of-trust-the-isolation-architectures-are-inverted.md` §6, §7a — PCR semantics and firmware-update repair classes
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §2.2 is fenced off from §2.1
- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` — §0.1 is that rule's functional half: recognising *which stick made this blob* is not the same function as *requiring that stick to open it*
