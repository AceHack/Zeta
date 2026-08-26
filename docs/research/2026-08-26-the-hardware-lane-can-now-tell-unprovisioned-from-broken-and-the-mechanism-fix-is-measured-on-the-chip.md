# The hardware lane can now tell UNPROVISIONED from BROKEN — and the mechanism fix is measured on the chip

**Date:** 2026-08-26
**Host:** darwin-arm64, YubiHSM 2 firmware **2.4.1**, serial **39160506**, attached over USB
**Predecessor:** [`2026-08-26-h3-measured-the-yubihsm-login-works-the-lane-ran-and-the-pkcs11-mechanism-constant-was-wrong.md`](2026-08-26-h3-measured-the-yubihsm-login-works-the-lane-ran-and-the-pkcs11-mechanism-constant-was-wrong.md)

The device is still factory-empty. **Nothing on it was created, deleted, or reconfigured by this
session** — verified before and after by `yubihsm-shell -a list-objects`, which reports the same
single object (`0x0001`, the default authentication key) at both ends.

---

## 0. The register — what is metered, what is only consistent-with, what is unexercised

Every row states its evidence. A row marked `unexercised` is a claim this session did **not** buy,
and saying so is the point of the table.

| # | claim | register | evidence |
|---|---|---|---|
| R1 | The device is reachable, authenticates, and holds **no** key labelled `zeta-frost-wrap` | **metered** | `frost-hsm-provision.ts status` → `reachable-unprovisioned`, **rc 3**, token `YubiHSM#39160506`. Corroborated by `list-objects` = 1 object. |
| R2 | `CKM_AES_CBC_PAD` **is** `0x1085` on this device's own module, with encrypt+decrypt and a 32-byte ceiling | **metered** | `C_GetMechanismInfo(slot 0, 0x1085)` → rv `0`, min `16`, max `32`, flags `0x301` (`CKF_HW\|CKF_ENCRYPT\|CKF_DECRYPT`). |
| R3 | The pre-fix constant `0x10d` is **rejected by the real device** | **metered** | `C_GetMechanismInfo(slot 0, 0x10d)` → rv **`112`** = `0x70` = `CKR_MECHANISM_INVALID`. Also absent from the 38-entry `C_GetMechanismList`. |
| R4 | "Not provisioned" and "broken" now produce different exit codes and different readouts | **metered** | three rungs driven on the real host: `reachable-unprovisioned` rc 3 · `module-init-failed` rc 1 · `module-absent` rc 1. Plus 38 unit falsifiers, `HSMP-1 … HSMP-38`. |
| R5 | The `yubihsm-shell` flag spellings in the provisioning plan are the ones this binary accepts | **consistent with** | every flag read out of `yubihsm-shell --help` (3.0.7); capability tokens `encrypt-cbc` / `decrypt-cbc` and algorithm `aes256` read out of `libyubihsm.dylib`'s own tables and the device's `get-device-info` algorithm list. **The command was never executed**, so acceptance is inferred from the parser's documented surface, not observed. |
| R6 | A key generated without `decrypt-cbc`, or with `exportable-under-wrap`, is refused before a human is asked | **metered** | `HSMP-19 … HSMP-22`; each refusal fails the plan builder, not the device. |
| R7 | `apply` cannot reach the device without an operator approval | **metered** | `HSMP-28 … HSMP-35`: absent door, declined door, already-provisioned, unreachable device, and dry run all leave the exec effect uncalled; only approval + rc 0 reaches it. |
| R8 | **A share round-trips through the chip** (`C_EncryptInit` → `C_Encrypt` → `C_Decrypt` against a real key) | **unexercised** | no such key exists. This is unchanged from the predecessor doc and is the one thing the provisioning step buys. |
| R9 | The YubiHSM's CBC IV/padding handling matches what the adapter does with it | **unexercised** | depends on R8. |
| R10 | The multi-token lane (`pkcs11-multi`, HW-6…HW-12) | **unexercised** | one device on the desk; the lane needs ≥ 2 and cannot run here at all. |
| R11 | The mtools FAT-assembly smoke has ever run in CI | **was never true, now can be** | it was a bare `return` reporting PASS; nothing installed mtools. Now a real skip locally, and a *required* check in the one job that installs the toolchain. |
| R12 | There is no lockout counter on the YubiHSM auth key | **consistent with** (unchanged) | inherited from the predecessor doc. Establishing it positively needs a deliberate failed authentication, which this session did not do and should not. |

---

## 1. The defect this change removes

The predecessor doc ended on a correct failure:

```text
HW-2  fail — frost-share-adapter: no PKCS#11 key labelled zeta-frost-wrap in the token
exit code 1
```

That is the lane behaving exactly as designed: it did not skip, and it did not fall back to the
software fake. But the *reading* was lossy. **Exit 1 is also what a dead connector, an unloadable
module, a missing token, and a refused login produce.** An operator seeing rc 1 could not tell

> *"you have one approved command left to run"*

from

> *"your hardware is broken"*

and the first of those is the **ordinary, expected state of a device fresh out of its box**. A
missing prerequisite wearing the costume of a failure is the same shape as the vacuity class,
turned inside out: instead of a non-check looking like a passing check, an expected state looks
like a defect.

### The ladder

`tools/setup/persona-keys/frost-hsm-provision.ts` gives the question a ladder and gives the middle
rung its own exit code:

| state | rc | meaning |
|---|---|---|
| `provisioned` | **0** | the wrap key is on the device; the hardware lane can run |
| `reachable-unprovisioned` | **3** | the device answered, authenticated, and holds no such key. **Expected.** One approved command away. |
| `unreachable` | **1** | something is actually wrong, and `stage` names which of eight things |

`reachable-unprovisioned` is reachable **only** by getting all the way through login. It is not a
guess: the module loaded, the connector answered, a token was in the slot, the mechanism the
adapter needs was verified present, a session opened, and the PIN was accepted. Everything except
the key. Anything short of that is `unreachable` with a named stage — so a check that could not run
never wears the answer of a check that ran and said no.

The eight stages: `module-absent` · `module-load-failed` · `module-init-failed` ·
`slot-enumeration-failed` · `no-token-attached` · `mechanism-unsupported` · `session-failed` ·
`login-refused`.

### Measured on the real device, all three readouts

```text
$ … frost-hsm-provision.ts status                    # connector up, module configured
  STATE       reachable-unprovisioned
  TOKEN       YubiHSM#39160506
  LABEL       zeta-frost-wrap
  MECHANISM   ok — CKM_AES_CBC_PAD present, encrypt+decrypt, up to 32 bytes
  NEXT        EXPECTED for a factory device. One operator-approved command remains: …
rc=3

$ … frost-hsm-provision.ts status                    # YUBIHSM_PKCS11_CONF unset
  STATE       unreachable — the device could not answer
  STAGE       module-init-failed
  DETAIL      C_Initialize returned 7. … point YUBIHSM_PKCS11_CONF at a file containing
              `connector = http://127.0.0.1:12345`, with yubihsm-connector running.
  NEXT        This is a real failure, not a missing prerequisite. Fix the stage above.
rc=1

$ … frost-hsm-provision.ts status                    # module path does not exist
  STATE       unreachable — the device could not answer
  STAGE       module-absent
rc=1
```

### The same split, one layer down

`findKeyByLabel` is now split out of `findKey` in `frost-share-adapter.ts` and returns `bigint |
null` instead of throwing on absence, so the provisioning module can ask the question without
catching an exception and **parsing its message** to learn which of two very different things
happened.

A second defect fell out of that split. The old code was:

```ts
if (!rvOk(rv) || (pulObjectCount[0] ?? 0n) === 0n) {
  throw new Error(`… no PKCS#11 key labelled ${keyLabel} in the token`);
}
```

**A failed search reported itself as "no such key."** `C_FindObjects` returning a non-OK value and
`C_FindObjects` returning zero results shared one branch and one message — a check that could not
run, wearing the answer of a check that ran and said no, in the same function this whole document
is about. It now throws distinctly (`C_FindObjects failed: <rv>`), pinned by `HSMP-12`.

Nobody could have caught this from a test: every mock in the package answers `() => 0n`, so the
`!rvOk(rv)` half of that condition was unreachable in the suite. Ordinary error at a surface with
no falsifier, not carelessness.

---

## 2. Provisioning as reviewable code, not as instructions

The predecessor doc carried the provisioning step as a shell snippet with an honest disclaimer:
*"flags not executed, so treat the exact spelling as unverified."* A command nobody can run is a
command nobody can check — and the two things most likely to be wrong in it are the two that fail
**silently and late**:

- a key generated **without `decrypt-cbc`** provisions fine and can never unseal a share;
- a key generated **with `exportable-under-wrap`** provisions fine and quietly voids
  `keyResidency: "hardware-resident"` — the single property that separates `hardware-pkcs11` from a
  software tier.

`planWrapKeyProvisioning` **refuses both at plan time**, before a human is asked to approve
anything. That refusal is the part a doc line cannot have. It also refuses an empty password (which
would put an interactive auth prompt behind a biometric gate), an empty label (the adapter searches
*by* label), and any algorithm but `aes256` (a shorter key provisions without error and silently
lowers the tier below what its name claims).

### The human gate

`apply` runs behind `ceremony-gate.ts`'s existing `provision-or-reconfigure-hardware-token`, which
that closed set already classifies `biometric-ceremony` — so no new authority was invented, and the
gate decision was made by whoever drew that line, not at the prompt. The brief is built from the
**plan object**, never authored beside it, so the sentence the operator reads cannot describe a
different act than the one that runs (`ceremony-brief.ts`'s one-object discipline).

Fail-closed at four points, in order, each with a falsifier:

1. **already provisioned** → no-op and **no prompt** (§12 idempotency — re-running must not train an
   operator to approve a key they already have, and a second key with the same label is how a token
   quietly acquires two candidates for one search);
2. **device unreachable** → refuse **without prompting**; asking a human to approve an act against a
   device that cannot answer is the unevaluable prompt;
3. **dry run** → return the plan, never touch the biometric door;
4. **declined or absent approval** → abort. `requireBiometric` is fail-closed on an absent door.

The dry run, on the real device, with the password redacted:

```text
  ACTION      dry-run
  DETAIL      no biometric door was opened
  WOULD RUN   yubihsm-shell -p <redacted> --connector http://127.0.0.1:12345 --authkey 1 \
              -a generate-symmetric-key -i 0 -l zeta-frost-wrap -d 1 \
              -c encrypt-cbc,decrypt-cbc -A aes256
  (dry run — the biometric door was never opened and the device is untouched)
rc=3
```

`HSMP-26` asserts **both** halves of the redaction: the password *is* in `argv` and *is not* in
`displayArgv`. Asserting only the redaction would pass for a plan that never authenticates at all,
which is a command that cannot work.

**One flag spelling that is easy to get wrong, and is now recorded:** `yubihsm-shell` takes
`--authkey 1 -p <password>`; PKCS#11 takes the two **concatenated** as
`<4-hex-authkey-id><password>`. They are not interchangeable spellings of one thing, and the
provisioning verb reads them from two separate environment variables for exactly that reason.

---

## 3. H3′ — closed as far as it can go without changing the device

H3′ was: *the `CKM_AES_CBC_PAD` fix is header-verified against four sources and unit-falsified, but
never exercised on hardware.*

It is now **partly exercised, on this chip, with no object created**:

```text
C_GetMechanismInfo(slot 0, 0x1085) -> rv 0    minKey 16  maxKey 32  flags 0x301
C_GetMechanismInfo(slot 0, 0x10d)  -> rv 112  (0x70 = CKR_MECHANISM_INVALID)
```

Read precisely, that buys three things and not a fourth:

- **The corrected constant names a mechanism this device's module implements** — and implements
  with `CKF_ENCRYPT | CKF_DECRYPT` and a **32-byte** maximum key size, which is exactly the shape
  the adapter needs for an AES-256 wrap key. Previously this was *"0x1085 appears in the mechanism
  list"*; a mechanism can be listed and still be unusable for the key size or direction you want.
- **The pre-fix constant is refused by the device itself**, by name, with the rv the fix predicted.
  That is a hardware falsification of the old value, not a citation.
- The check is wired into the readiness ladder, so a token that advertises `CBC_PAD` with a 16-byte
  ceiling, or without `CKF_DECRYPT`, is reported `unreachable/mechanism-unsupported` rather than
  being discovered at seal time. `HSMP-14` and `HSMP-15` drive both.

**What it does NOT buy — stated plainly.** No `C_EncryptInit` has been issued against a real key on
this device, so R8 and R9 stay `unexercised`. A mechanism the module *advertises* correctly can
still be refused at `C_EncryptInit` for reasons only a real key handle can surface. **Capability-
verified and unit-falsified is not the same as exercised, and this document does not claim it is.**

A deliberate detail: `frost-hsm-provision.ts` declares `CKM_AES_CBC_PAD_EXPECTED = 0x1085n` as its
own literal rather than importing the adapter's constant. Importing it would compare the value to
itself, which cannot fail — the same reasoning that made `FSA-32` assert on wire bytes.

`C_GetMechanismInfo` was added to `Pkcs11Lib` as an **optional** member. Making it required would
have broken every object-literal mock in the package for the sake of a read-only capability query.
Callers must treat `undefined` as *"the check did not run"* — never as a pass — and the module
reports exactly that (`MechanismCheck.checked === false`, rendered as `NOT VERIFIED`). `HSMP-16`
and `HSMP-17` pin both halves.

---

## 4. The rest of the local-hardware lane — what actually passes today

Compiled by reading the workflows and test files at `83ec419c00`. Where a row was not personally
re-executed it says so.

### Required-check ground truth

`gate (required)` has an eight-job floor (`matrix-setup`, `path-filter`, `build-and-test`, `lint`,
`lint-typescript`, `cross-verify`, `full-verify`, `test-typescript-hermetic`). **None of
`helm-validate.yml`, `k8s-argocd-health-test.yml`, `k8s-lane-partition.yml`, or
`multiboot-qemu-uefi-smoke.yml` is a required check** — all four report without blocking, and
`k8s-argocd-health-test.yml` says so in its own header. What *does* block is the bare
`bun --config=bunfig.hermetic.toml test` in `test (TS hermetic)`, which sweeps up the k8s, cluster,
zflash and multiboot unit tests without any path filter.

### The skip audit — the thing worth hunting

| lane | skip guards | verdict |
|---|---|---|
| k8s / helm / cluster (`infra/k8s/tests/`, `src/Core.TypeScript/cluster/`, `full-ai-cluster/`, `examples/helm-dependency-graph/`) | **zero** — no `test.skipIf`, no `describe.if`, no env-gated early return | clean |
| `installer/multiboot/multiboot.test.ts:380` | bare `return` when `qemu-img`/`mformat` absent | **the one live silent skip. Fixed in this change.** |
| `zflash/esp-inject.test.ts:60` | `test.skipIf(!iso)` on an installer ISO in `~/Downloads` | honest — reason in the title *and* a `console.warn` |
| `installer/repair-mode-existing-install.test.ts:247` | `describe.if(CAN_RUN)` on linux + passwordless sudo + seven loop-device tools | honest — `ZETA_REPAIR_LOOPBACK_REQUIRED=1` turns the skip into a hard failure, and its workflow sets it |
| `installer/host-capability-vector.test.ts:246` | `test.skipIf(platform() !== "darwin")` | hardware-absent; only ever runs on the maintainer's Mac |
| `full-ai-cluster/tools/flash-usb-windows.security.test.ts` (5 guards) | `test.skipIf(!existsSync(FORK))` | **not** hardware — deletion-safety on a stale fork, with three unskipped controls |
| `frost-share-adapter.hardware.test.ts` (6 guards) | `describe.if(LANE)` on `ZETA_FROST_HARDWARE_LANE` | hardware-absent, registered in `registry/unexecuted-test-files.json`, reachable only via `bunfig.hardware-lane.toml` |

**Classified as asked:** every skip above is *waiting on hardware, privilege, or an artifact* —
except the `flash-usb-windows.security.test.ts` group, which is waiting on a **deletion**, and the
multiboot one, which was **not a skip at all**. `multiboot.test.ts` returned early from inside
`it(...)`, and a bare return reports the test as **passed**. No workflow installed mtools, so that
green result had never once corresponded to a check that ran.

Both halves are fixed here, and the second half is the one that matters:

1. it is now a real skip with its reason **in the title** (bun's non-TTY reporter prints the *count*
   of skips, not their names — a reason living only in a comment is invisible in a log);
2. `MULTIBOOT_MTOOLS_SMOKE_REQUIRED=1` turns absence into a failure, and
   `multiboot-qemu-uefi-smoke.yml` — the one job that installs mtools — now sets it and runs the
   file. A loud skip that is still never exercised anywhere is only half a fix.

Falsified in all three directions on this host:

| condition | result |
|---|---|
| toolchain present (this Mac) | 15 pass, 0 fail — the smoke **actually runs** |
| toolchain absent, default | 14 pass, **1 skip**, 0 fail |
| toolchain absent, `REQUIRED=1` | 14 pass, **1 fail** — `missing tooling: qemu-img, mformat` |

### Honest gaps in the other lanes, recorded not fixed

- **`helm-validate.yml` schema-validates zero documents for the two repo-owned charts.** Both are
  metadata-only (`Chart.yaml`, no `templates/`), so `helm template` renders nothing. The tool prints
  `Schema-validated manifests: 0` under a `NOT SCHEMA-VALIDATED (stated, not silent)` heading rather
  than implying coverage — this is a declared limit, not a hidden one.
- **`k8s-lane-partition.yml` measures but never deploys.** Its header says so: the `--root-exclude`
  glob that would scope an ArgoCD root Application to one lane exists and is not wired.
- **The live kind clusters run on hosted GitHub runners, not local hardware.** No self-hosted runner
  label appears in any of the four workflows, and the kubevirt job *records* KVM availability rather
  than gating on it.
- **`docs/security/USB-HARDWARE-SETUP-TEST-PROCEDURE.md` §4 results log is still empty.** Ten
  registered manual checks (`MAN-USB-01…05`, `MAN-TOK-01…05`), a 335-line runbook, and *no step has
  ever been executed and recorded*. The register prints a banner saying so on every suite run, which
  is the right behaviour; it does not make the set non-empty.
- Three defects named in `2026-08-21-usb-proven-on-metal-is-an-empty-set-*` (a `SHA256SUMS`
  namespace collision, rule R1 unreachable on the production path, `expectedIdentity` falling back
  to `observedIdentity`) were **not re-verified against today's `zflash/`** in this session.

---

## 5. Two pre-existing failures, not folded in

`frost-hardware-probe.test.ts` → *"the real host > probes without crashing…"* and *"…never reports
tpm2Available without a device node on THIS machine"* fail on this host at **6619 ms** and
**5313 ms** against bunfig's effective **5000 ms** per-test cap. They are timeouts, they reproduce
identically on clean `origin/main`, and they are out of scope here. `frost-share-adapter.ts` and
`multiboot.test.ts` also both fail `prettier --check` on `main`; `format:check` is not wired into
`gate.yml`, so this is pre-existing and untouched — the diffs in this change are kept minimal rather
than folding in a whole-file reformat.

---

## 6. NEXT BLOCKING STEP

**One command, by a human, behind a Touch ID prompt. Everything else in the `hardware-pkcs11` tier
is blocked behind it and nothing else is blocked at all.**

```bash
# Prerequisite (not gated, no device change): the connector must be running and the
# module must know where it is.
yubihsm-connector -l 127.0.0.1:12345 &
printf 'connector = http://127.0.0.1:12345\n' > ~/.yubihsm_pkcs11.conf

export YUBIHSM_PKCS11_CONF=~/.yubihsm_pkcs11.conf
export ZETA_FROST_PKCS11_LIB=/usr/local/lib/pkcs11/yubihsm_pkcs11.dylib
export ZETA_FROST_PKCS11_PIN='0001<password>'     # PKCS#11 form: <4-hex-authkey><password>
export ZETA_YUBIHSM_PASSWORD='<password>'         # yubihsm-shell form: password only

# 1. Read-only. Expect rc 3 and `reachable-unprovisioned`.
bun tools/setup/persona-keys/frost-hsm-provision.ts status

# 2. Read-only. Prints the exact command with the password redacted. Opens no gate.
bun tools/setup/persona-keys/frost-hsm-provision.ts plan

# 3. THE GATED STEP. Prints the ceremony brief, then raises the biometric prompt.
#    Declining leaves the device byte-for-byte as it was.
bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply
```

**What the operator is approving:** the creation of one AES-256 symmetric key on the YubiHSM,
labelled `zeta-frost-wrap`, in domain 1, with capabilities `encrypt-cbc,decrypt-cbc` and **not**
`exportable-under-wrap`. It changes no password, deletes nothing, and resets nothing.

**What it unblocks, immediately and in this order:**

1. `status` flips to `provisioned` / rc 0.
2. HW-2 can run — the first share ever sealed and unsealed by this chip. **R8 and R9 become
   measurable**, and `hardware-pkcs11` stops being an unexercised tier.
3. The `CKM_AES_CBC_PAD` fix gets its last mile: a real `C_EncryptInit` against a real key handle.

**What stays blocked afterwards, and by what:**

- `pkcs11-multi` / HW-6…HW-12 — needs a **second** token. Not a software problem.
- `MAN-USB-01…05` — needs a USB stick and a physical boot. `MAN-USB-03` and `-04` are destructive.
- `MAN-TOK-03` — needs a touch-capable token; the YubiHSM has no button, which is why it can only
  ever carry an `autonomous-hsm` custody gate.

**For the next agent in this lane:** if the step above has not been run, do not attempt to work
around it — the refusal is the design. Start by running `status`; rc 3 means the device is fine and
waiting, rc 1 means read the `STAGE` line and fix that instead.

---

## 7. Anchors (Beacon)

- **PKCS#11 v2.40 / v3.1**, OASIS — `CK_MECHANISM_INFO` (`ulMinKeySize`, `ulMaxKeySize`, `flags`),
  `CKF_ENCRYPT` `0x0100` / `CKF_DECRYPT` `0x0200`, and the AES mechanism block
  `0x1080…0x1085`. Checked against Yubico's `pkcs11t.h`, NSS's independently-maintained
  `pkcs11t.h`, **and this device's own `C_GetMechanismList` / `C_GetMechanismInfo`** — three
  independent sources, one of them the hardware.
- **Goguen & Meseguer (1982), *Security Policies and Security Models*** — noninterference. Every
  door in `frost-hsm-provision.ts` (`exists`, `load`, `pointerOf`, `run`, `biometricAuth`, `notify`,
  `requester`) is injected; nothing is ambient, which is what lets 38 falsifiers drive the whole
  ladder with no device attached.
- **The closed command set** — `ceremony-gate.ts`'s operation union, whose portable lineage is
  recorded in [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md).
  A caller may *name* `provision-or-reconfigure-hardware-token`; it can never *define* an operation.
  This change added a CLI and added **no** member to that union — the classification already existed.
- **Hanlon's razor, in the form this repo carries it** —
  [`never-assume-malice-where-mistake-is-possible.md`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md).
  The `!rvOk(rv) || count === 0` conflation and the bare-`return` skip were both written by people
  making the system better, at surfaces where no falsifier existed to catch them. Named precisely,
  attributed to the budget.

## 8. Pointers

- `tools/setup/persona-keys/frost-hsm-provision.ts` — the ladder, the plan, the gate
- `tools/setup/persona-keys/frost-hsm-provision.test.ts` — `HSMP-1 … HSMP-38`
- `tools/setup/persona-keys/frost-share-adapter.ts` — `findKeyByLabel` (the split), optional
  `C_GetMechanismInfo`
- `src/Core.TypeScript/installer/multiboot/multiboot.test.ts` +
  `.github/workflows/multiboot-qemu-uefi-smoke.yml` — the silent skip, and the job that now refuses it
- `docs/security/USB-HARDWARE-SETUP-TEST-PROCEDURE.md` — the manual register whose results log is
  still empty
