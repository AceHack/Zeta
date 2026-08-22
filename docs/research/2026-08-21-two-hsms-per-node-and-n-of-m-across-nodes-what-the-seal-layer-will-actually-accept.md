# Two HSMs per node, and n-of-m across nodes — what the seal layer will actually accept

**Design, 2026-08-21. Nothing applied to a cluster, no device touched, no TPM contacted, no key,
PIN or credential handled.** Continues
[`2026-08-21-hands-off-metal-*`](2026-08-21-hands-off-metal-what-a-node-can-provision-for-itself-and-the-three-classes-that-need-a-human.md)
(#13459, merged). Aaron's three inputs, verbatim:

> *"in the start with one machine this is scary, when we have n-of-m no so scary anymore"*
>
> *"i know all my linux machines have TPMs they were windows 11 certified hardware"*
>
> *"save a design where we have two hsm's from different vedors per node, this makes me feel more
> comfortable"*

## 0. The three answers, up front

1. **The n-of-m instinct is right about the outcome and wrong about the mechanism** — and the wrong
   mechanism does not degrade, it *fails to start*. Adding nodes does not by itself dilute the
   "lose the board, lose the vault" risk, because OpenBao stores **one** seal-wrapped root key that
   **every** member must be able to unwrap. Three nodes with three independently-provisioned TPM
   keys is not a resilient cluster; it is a cluster where two members never unseal. The topology
   Aaron is describing is real and reachable — it just requires the **same** key imported into every
   node's TPM, which means the custody question (C1) and the topology question (C5) are **one
   question**, and the answer to C1 has to be *imported*.
2. **The TPM premise is settled for design and still open for the installer.** Windows 11's minimum
   hardware requirements say, verbatim, *"TPM: Trusted Platform Module (TPM) version 2.0"* — so
   certification does imply presence, and Aaron's claim is well-founded. It resolves what a *human*
   needs to know. It does not resolve what an *unattended node* can see, and the node was the thing
   that had to decide. **That gap is closed by code in this PR**, not by the fact.
3. **"Two HSMs, either one unseals" is not expressible in OpenBao today.** Measured from its config
   parser: at most two `seal` blocks, and when there are two, **exactly one must be disabled**. That
   is the *seal-migration* shape, not seal-HA — and OpenBao's own source carries the TODO. So the
   dual-vendor design has to live somewhere other than the unseal path, and §4 says where.

---

## 1. What OpenBao's raft + auto-unseal actually does — measured, not assumed

Three readings from `openbao/openbao` at tag `v2.6.2`:

**1a. There is exactly one seal-wrapped root key, and it is cluster-wide.**

```go
// vault/seal.go
StoredBarrierKeysPath = "core/hsm/barrier-unseal-keys"

// vault/seal_autoseal.go — GetStoredKeys
pe, err := d.core.physical.Get(ctx, StoredBarrierKeysPath)
...
pt, err := d.Decrypt(ctx, blobInfo, nil)
```

`core.physical` **is** the raft store. Every member replicates the same bytes at that path, reads
them at unseal, and hands them to **its own** seal to decrypt. There is no per-node blob and no
per-node path.

**1b. Two seals are permitted, and exactly one of them must be off.**

```go
// helper/configutil/kms.go
if len(list.Items) > maxKMS { return fmt.Errorf("only two or less %q blocks are permitted", blockName) }

// command/server/config.go — CheckConfig
case c.Seals[0].Disabled && c.Seals[1].Disabled:
    return nil, errors.New("seals: two seals provided but both are disabled")
case !c.Seals[0].Disabled && !c.Seals[1].Disabled:
    return nil, errors.New("seals: two seals provided but neither is disabled")
```

Two *active* seals is a **startup error with that exact message**. The two-seal form exists for
migration (old seal `disabled = true`, new seal live), which the seal docs describe as requiring
downtime.

**1c. Upstream says so itself, in a comment.**

```go
// vault/seal.go
Key: metaPrefix + StoredBarrierKeysPath, // TODO(SEALHA): will we need to store more than one set of keys?
```

The capability this design would need is an open TODO in the vendor's source. That is a stronger
statement than "the docs don't mention it", and it is the honest register: **not missing from the
documentation — missing from the implementation, and known to be.**

### The three consequences

| | consequence |
|---|---|
| **Per-node seal keys break the cluster, they do not soften it** | members 2..N read a blob wrapped by member 1's key and cannot decrypt it. Not "reduced redundancy" — they never unseal |
| **1-of-2 unseal on one node is not configurable** | one active seal per server, full stop |
| **A vendor swap costs downtime** | seal migration is the sanctioned path and it is explicitly a whole-cluster stop |

---

## 2. So what *does* n-of-m buy, and when

| topology | seal-key custody | lose one board ⇒ | verdict |
|---|---|---|---|
| 1 node | key generated in that TPM | **vault gone, backups included** | Aaron's "scary", and correctly so |
| 3 nodes | key generated in **each** TPM | **cluster never formed** | worse than scary: it does not work at all |
| 3 nodes | **one** key, imported into all three TPMs | **one node gone, quorum survives** | **this is the thing Aaron is describing** |
| N nodes | Shamir, no seal | one node gone, quorum survives | but a human unseals **every node on every boot** — the step being removed |

**So the risk decay is real and it is delivered by the imported key, not by the node count.** Node
count is what turns "the vault died" into "a node died"; the imported key is what makes multi-node
possible in the first place. That collapses two of the open questions from the prior doc into one:
**C1 = imported** is a *precondition* of C5 = three-node, not an independent preference.

And it re-prices the escrow honestly: with N nodes the escrowed key is in N TPMs, so **the escrow
blob's blast radius is the whole cluster**. The prior doc said the escrow "becomes the real secret";
at n-of-m it becomes the real secret for N machines at once.

### 2.1 The counter-case, because it was asked for: when does losing one board still lose the cluster?

Two cases, and the second is the interesting one.

- **Per-node keys** (row 2 above). Degenerate — there was never a working cluster to lose.
- **Correlated erasure.** With one imported key in three TPMs, the key survives any *independent*
  board failure. It does not survive a *correlated* one, and this fleet has a large, deliberate,
  routine correlated eraser: **`zeta-install.sh` re-paves every fixed disk by default**
  (`ZETA_AUTO_CONFIRM=WIPE`, `BOOT_DISK=auto`), and the `tpm2-pkcs11` token store is per-node state
  on that disk. Re-pave the fleet — an ordinary operation here — and N TPM tokens go together.
  Node count diversifies **independent** failures. It does nothing against a common-mode one.

That is the same lesson §4.4 reaches from the vendor side, arriving from the storage side first,
which is worth noticing: **the redundancy argument and the diversity argument have the same defect
when the failures are correlated.**

Two consequences, neither of which is a decision to make here: the token store wants to be on a
path the installer's wipe scope excludes (or to be re-derivable from the escrow), and **the escrow
must survive a fleet-wide re-pave**, which means off-fleet.

### 2.2 The sequenced path, priced

The prior doc listed three recovery stories (A accept-the-loss, B escrow-and-import, C seal
migration). Aaron's framing adds a fourth reading of A that is better than A:

> **Accept the loss *now*, and let the imported-key + n-of-m design retire the risk before there is
> anything to lose.**

TOPOLOGY.md §2 measured that Vault has never been initialised and holds no secrets. So today the
loss is **zero**, and the cost curve is a **step function that starts the moment the first secret
lands** — not a slope. The sequence that keeps the cost at zero throughout:

1. single node, seal key generated in-TPM, **nothing of value stored** — cheapest possible start,
   and the "lose the board" exposure is real but priced at nothing;
2. before the first real secret: decide C1 = imported, mint the key off-TPM, escrow it, import it;
3. add nodes 2 and 3, importing the same key;
4. from there the failure is a node, not the vault.

The trap this ordering avoids: doing step 1 and then *storing things*, because the migration from an
in-TPM key to an imported key is a **seal migration** (downtime, §1c) and there is no in-place
"export the key you told the TPM never to export."

---

## 3. The TPM premise: Aaron knows, and the installer did not

**The claim is sound.** Microsoft's own requirements page lists, under minimum hardware:
*"**TPM**: Trusted Platform Module (TPM) version 2.0."* A Windows-11-certified machine therefore has
TPM 2.0 silicon. Register: **checked** (vendor documentation quoted verbatim). This resolves the
design question — the fleet's Core Ultra mini-PCs are that class of hardware.

**It does not resolve the installer's question, and the two must not be merged.** Three gaps survive
the certification argument, and each has a state in the probe that names it:

| gap | probe state |
|---|---|
| an fTPM present in silicon can be **switched off in firmware** after certification | `absent` — an enumeration that ran and found nothing |
| the driver may not be loaded, or the subsystem not exposed | `unavailable` — *we could not ask* |
| the device may exist and **deny** a non-root caller | `unreadable` — a privileged caller gets a different answer |

An unattended bring-up is the thing that has to decide, on the node, with nobody watching. Before
this PR it could not: `node.yaml` recorded cpu / cores / memory / gpu / kernel / network, and
**nothing about a TPM** — the one component the seal depends on was the one component the fleet
never wrote down.

**What shipped (§5):** the self-registration script now probes and records `hardware.tpm2` as one of
the five states.

**What deliberately did NOT ship: the four existing `node.yaml` files are untouched.** Those are
*probe* records — what a machine said about itself. Writing `tpm2: "present"` into them on the
strength of a certification argument would convert a declaration into a fake measurement, which is
precisely the confusion this whole thread exists to prevent. The field appears when each node next
re-registers; the service is level-triggered on a 6h + jitter cadence, so it appears **without
anyone visiting a box** — which is the entire point of the exercise.

---

## 4. Two HSMs from different vendors, per node

### 4.1 Where it cannot live

Not at the OpenBao seal (§1b). One active seal per server. Any design that says "the node tries HSM
A, then HSM B" is describing software that does not exist upstream and is tracked there as
`TODO(SEALHA)`.

Two ways that could change, both named so nobody re-derives them: upstream ships seal-HA, or someone
writes a PKCS#11 module that fans out to two tokens. **The second is worse than it sounds** — it is
hand-written crypto glue in the unseal path, owned by us, and it would become a *shared* component
sitting above both vendors, i.e. it reintroduces exactly the correlated element the dual-vendor
design exists to remove.

### 4.2 The tradeoff, stated plainly rather than chosen silently

| threshold | availability | security |
|---|---|---|
| **1-of-2** — either token unseals | **up** — one dies, the node still boots | **DOWN** — an attacker only has to break the **weaker** vendor |
| **2-of-2** — both required | **DOWN** — either failure bricks the node | **up** — both must be broken independently |

**Neither gives both, and no arrangement of two tokens on one node does.** The composition that
gives both is **dual-vendor per node** (against correlated *vendor* failure) **× n-of-m across
nodes** (against *availability* failure) — which is exactly where Aaron arrived in his first
message. The two asks are one design.

Worth stating because it is the seductive error: 1-of-2 is what people mean by "two HSMs makes me
feel better", and it is the option that **lowers** the security floor to the weaker device. Feeling
safer and being safer point in opposite directions here unless the second axis (n-of-m) is present.

### 4.3 Where dual-vendor CAN live today — three places, all available now

**(i) The escrow, not the seal.** The escrowed seal key (§2) is encrypted before it is stored.
Encrypt it to **two recipients whose private keys live on two different vendors' tokens**. Recovery
then needs either one — 1-of-2 *availability* on the recovery path — while the seal itself stays
single, as OpenBao requires. The security asymmetry of 1-of-2 is bounded here in a way it is not at
the seal: the escrow is offline, not reachable from the running system, and its use is a ceremony.
**This is the design to save** — and there is a better mechanism for it than PGP recipients:
the SmartCard-HSM's **DKEK wrapped export**, where the escrowed key exists in plaintext only inside
secure elements and the host carries ciphertext. Worked out in
[`2026-08-21-weekly-restore-drill-not-weekly-backup-*`](2026-08-21-weekly-restore-drill-not-weekly-backup-dkek-wrapped-export-and-what-still-crosses-the-host.md),
which also finds that the two vendors differ **on exactly that property**.

**(ii) Function separation.** The TPM holds the OpenBao seal; a CardContact token holds the PKI CA
key via step-ca's `pkcs11:` URI (already the repo's only open-source path to a hardware-backed CA —
`2026-08-20-hsm-tpm-into-vault-*` §2). A single vendor break then costs **one function**, not both.
Cost: one token, and it is the cheap one.

**(iii) Ceremony device ≠ signing device.** Already in the repo's own mitigation table, already
scored **free and highest-value**. A compromised signer must not reach the device holding root/wrap
authority.

### 4.4 What "different vendor" has to mean — and the anchor that matters is the refutation

The idea is **N-version programming** (Avizienis & Chen, *On the Implementation of N-Version
Programming for Software Fault Tolerance During Execution*, COMPSAC 1977) applied to hardware roots
of trust. The load-bearing citation is not that one, it is the one that **refuted its central
assumption**: Knight & Leveson (*An Experimental Evaluation of the Assumption of Independence in
Multiversion Programming*, IEEE TSE SE-12(1), 1986) found that independently developed versions
failed on **correlated** inputs far more often than independence predicts — because the developers
shared training, specifications, and intuitions about which cases are hard.

**And there is a hardware instance of exactly that, measured, in this domain:**

> **YSA-2024-03 / CVE-2024-45678 (EUCLEAK).** *"A vulnerability was discovered in Infineon's
> cryptographic library"* — a third-party component, **not Yubico's firmware**. Affected **YubiKey 5
> Series, YubiKey 5 FIPS, YubiKey Bio, Security Key Series AND YubiHSM 2 / YubiHSM 2 FIPS**
> simultaneously. Yubico's fix was to **remove the dependency** in favour of its own library.

Two Yubico product lines were not two versions. The shared component sat *below* the boundary anyone
versioned, and the repo's earlier analysis adds the part that stings: it survived roughly 14 years
and ~80 top-tier Common Criteria evaluations. **A shared certification regime is evidence of
correlation, not of independence.**

**So the checklist, with checkability marked honestly:**

| what must be true | checkable? |
|---|---|
| different **secure-element silicon** vendor | **Yes, before purchase** — datasheets / listings. NXP JCOP vs Infineon vs Intel PTT |
| different **cryptographic library** lineage | **No, in general.** EUCLEAK's whole lesson: the library sat below every version number anyone could read. The best available proxy is the silicon vendor |
| different **host-side PKCS#11 module** | **Yes** — and it is the half nobody counts (below) |
| different **certification regime** | **Practically no**, and shared CC evaluation is a *negative* signal, not a positive one |
| different **supply chain / lot** | Partially, from purchase records. Defends against interdiction and a bad lot; nothing against a design flaw |
| distinct token identity at runtime | **Yes, mechanically** — PKCS#11 `C_GetTokenInfo` exposes `manufacturerID`, `model`, `hardwareVersion`, `firmwareVersion`. A check that two configured tokens report **different `manufacturerID`s** is a real falsifier for a "dual-vendor" claim, and it is **not implemented** — with no device here to calibrate the expected values against, writing the fixtures would mean inventing vendor strings nobody has read. Named as work, not shipped as a stub |

**The host-side half nobody counts.** Two tokens driven through the *same* PKCS#11 module share a
component, and the shared component is in the parsing path — the class the repo's connector analysis
already flagged. Concretely:

- **SmartCard-HSM (CardContact) + Nitrokey HSM 2 is monoculture twice over.** Confirmed
  independently this session: the Nitrokey HSM is a SmartCard-HSM — CardContact's applet in a USB
  reader — and OpenSC drives **both** through the same `sc-hsm` driver. Same silicon lineage *and*
  same host module. Two SKUs, one failure domain.
- **YubiHSM 2 uses `yubihsm-shell`**, a genuinely different host stack. That is real diversity, and
  the repo already priced its cost precisely: doubled toolchain, doubled advisory feeds, *"paid in
  attention, which this fleet is shorter on than money."*

**The three lineages actually available, and two of them are already paid for:**

| root of trust | silicon / library lineage | host module | cost |
|---|---|---|---|
| on-board fTPM (Intel PTT) | Intel | `tpm2-pkcs11` (OpenSC-independent) | **$0 — already soldered on** |
| SmartCard-HSM 180K | NXP JCOP 3 (per the repo's CardLogix measurement) | OpenSC `sc-hsm` | **$79.26**, in stock US |
| YubiHSM 2 | **Infineon** library (per YSA-2024-03) | `yubihsm-shell` | ~$650 |

**TPM + SmartCard-HSM is three distinct lineages' worth of diversity across two devices for $79.26
per node**, and it is the pairing that avoids the one vendor with a *demonstrated* cross-product
correlated failure in exactly this device class.

*(One line on the connection, because it is genuine and not a section: this is manifesto §11's "no
single mandatory locus of deference" at the hardware layer — plural roots of trust for the same
reason as plural oracles, and with the same discriminator, which is whether you can actually route
around one of them.)*

### 4.5 Cost — carried from the repo's own measurements, not re-derived

3× SmartCard-HSM 180K via CardLogix = **$237.78**, in stock, US. 3× YubiHSM 2 = **$1,950**.
3× Nitrokey HSM 2 ≈ €327 but **"by inquiry only"**, and — per §4.4 — **not a second vendor at all**.

---

## 5. What shipped with this document

**The gap from §3, closed in code.** `tools/installer/zeta-self-register.sh` now probes the TPM and
records it:

```yaml
  hardware:
    ...
    kernel: "6.12.90"
    tpm2: "present"        # | absent | unreadable | unavailable | indeterminate
```

- **Five states, never a boolean.** The bash reuses the vocabulary of
  `tools/setup/persona-keys/tpm2-linux-probe.ts` rather than inventing one. `absent` has exactly one
  producer — an enumeration that ran and came back empty — and a denial can never be spent as a
  negative.
- **It is a second implementation of a safety rule, so it is pinned rather than trusted.**
  `src/Core.TypeScript/installer/tpm-shell-parity.test.ts` extracts the block between the
  `ZETA-TPM-PARITY` markers out of the real script, runs it under bash, and compares its verdict
  against `classifyTpm2Linux` over **every committed capture** — the same fixtures the TypeScript
  probe's own suite replays. Following the `disk-preflight-shell-parity.test.ts` precedent.
- **The parity claim's scope is stated in the test**: the five-state precedence and both text parsers
  are covered; `zeta_tpm_read_facts` (which touches a real `/sys`) is outside the markers on purpose,
  because a fixture cannot stand in for a kernel's permission denial.
- **A surviving mutant was found and killed.** Mutating the bash so an *unrecognised*
  `tpm_version_major` defaults to `2.0` **passed every fixture**: no committed capture held a value
  that was neither `"1"` nor `"2"`, so the three-outcome parser had a two-outcome fixture set. A
  hand-constructed capture (`linux-x86-tpm2-version-file-unrecognised`, `NO TPM WAS CONTACTED`) now
  covers it, and it kills the mutant **on both implementations** — verified by mutating the
  TypeScript side too (3 tests red) and the bash side (1 test red).
- Suites green: 66 pass (TS probe) + 14 pass (parity), `shellcheck -S warning` clean, and the
  self-register reconvergence and inventory suites unaffected (31 + 29 pass).

**Nothing else changed.** No mode flipped, no node closure altered, no manifest edited, no existing
`node.yaml` backfilled.

---

## 6. Register

**MEASURED** (source read at a named tag, or a command run here):

- `StoredBarrierKeysPath`, `GetStoredKeys`'s `core.physical.Get` + `Decrypt`, the `TODO(SEALHA)`
  comment — `openbao/openbao` @ `v2.6.2`, `vault/seal.go` and `vault/seal_autoseal.go`.
- The two-seal limit and the exactly-one-disabled rule, with their verbatim error strings —
  `helper/configutil/kms.go` and `command/server/config.go` @ `v2.6.2`.
- Windows 11 minimum hardware requirement, verbatim, from Microsoft Learn.
- YSA-2024-03: affected product list including **YubiHSM 2 < 2.4.0**, root cause **Infineon's
  cryptographic library**, and the fix being removal of that dependency — fetched from Yubico.
- Nitrokey HSM = SmartCard-HSM (CardContact) driven by OpenSC's `sc-hsm` — confirmed independently
  this session, agreeing with the repo's prior finding.
- The shipped code: both suites, the shellcheck run, and the three mutations (two red, one that
  survived until the fixture was added, then red).

**RESEARCHED / CARRIED** (established elsewhere, cited rather than re-derived):

- Prices and availability (CardLogix $79.26 in stock; Nitrokey by-inquiry; YubiHSM 2 $650) and the
  NXP JCOP 3 identification — from `2026-08-20-hsm-procurement-recheck-*`, measured on 2026-08-20.
- The ~14 years / ~80 Common Criteria evaluations framing of EUCLEAK — from the same doc.
- Avizienis & Chen 1977 and Knight & Leveson 1986 — cited from the literature, not re-run.

**ASSUMED — said out loud:**

- That the fleet's mini-PCs are the Windows-11-certified machines Aaron means. The certification
  argument is sound; nobody has matched a certificate to a serial number.
- That `tpm2-pkcs11`'s token store lives on the node's ordinary filesystem and is therefore in the
  re-pave path (§2.1). Its default location is documented; nothing here observed one.

**COULD NOT CHECK:**

- Whether any Zeta node has a TPM. Still true, still the load-bearing unknown, and the shipped code
  is what will answer it — from the node, unattended, on the next registration cycle.
- Whether a `tpm2_ptool import` of an externally generated RSA key actually works on these fTPMs
  (§2's precondition). The commandlet exists; no TPM has run it.
- Every runtime claim about either HSM. No device was contacted.

---

## 7. Open questions for Aaron

1. **C1 is now a precondition, not a preference** (§2). Multi-node needs one imported key in every
   TPM. Confirm imported-with-escrow, or accept single-node-with-in-TPM-key and the ceiling it puts
   on the topology.
2. **Where does the escrow live so it survives a fleet-wide re-pave?** (§2.1) — off-fleet is the
   answer the failure mode forces; *which* off-fleet is yours.
3. **Dual-vendor pairing:** on-board fTPM + one SmartCard-HSM per node at $79.26 (§4.4), or a
   YubiHSM 2 at ~8× the price for a lineage with a demonstrated cross-product correlated failure?
4. **Should the token store move out of the installer's wipe scope**, or be treated as
   re-derivable-from-escrow and left in it? The second is simpler and makes the escrow load-bearing
   on every re-pave.
5. **Is the `manufacturerID` diversity check worth building** before there is hardware to calibrate
   it against? (§4.4, last row.) It is a real falsifier for a "dual-vendor" claim and it would be
   fixture-less until a device arrives.

## 8. Gated / never-run

No cluster contacted. No `kubectl`, `helm`, `argocd`, `bao`, `vault`. No device touched, no TPM read,
no key, PIN or credential handled. `op` not invoked. Seal-key minting, `operator init`, and
recovery-share generation remain a **gated class**: fresh human authorization plus the biometric
gate, with a witness.
