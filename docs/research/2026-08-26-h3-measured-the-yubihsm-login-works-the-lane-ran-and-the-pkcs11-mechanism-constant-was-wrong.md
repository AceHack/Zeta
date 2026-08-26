# H3, measured: the YubiHSM login works, the lane ran, and the PKCS#11 mechanism constant was wrong

> Measured 2026-08-26 on the maintainer's darwin-arm64 host, against the attached YubiHSM 2
> (firmware **2.4.1**, serial **39160506**). Follow-up to
> [`2026-08-26-get-a-working-machine-readiness-…`](2026-08-26-get-a-working-machine-readiness-measured-the-yubihsm-is-attached-r8-is-one-word-and-the-live-cluster-tree-carries-13-known-failures.md)
> item **H3**, which that doc left deliberately unattempted.
>
> **Authorization:** Aaron, explicit, 2026-08-26 — *"for yubihsm, you should be able to proceed
> testing with the default password `password` just don't change the password for now, that's
> fine to route."* Read-only/test use. No device state was changed.

## The one-paragraph result

The lane **ran**. Login with the default credential **works**, in the exact
`<4-hex-auth-key-id><password>` form the PKCS#11 layer expects. The lane then failed — on the
**prerequisite**, not the credential: the device holds **no objects at all**, so there is no
AES-256 key labelled `zeta-frost-wrap` to seal against. Provisioning one is device state, which
this session was not authorized to change.

And running it found something the credential question was hiding: **the adapter's
`CKM_AES_CBC_PAD` constant was wrong**, and had been since the file was written. The
`hardware-pkcs11` tier could not have sealed a share on *any* conforming token. Provisioning the
key alone would **not** have turned the tier green.

## 1. Discovery — no login

`describeAttachedPkcs11Tokens` against `/usr/local/lib/pkcs11/yubihsm_pkcs11.dylib`:

```json
[ { "slotId": 0, "tokenIdentity": "YubiHSM#39160506" } ]
```

**This did not work on the first attempt**, and the way it failed is defect #2 below. Bare, it
returned:

```text
frost-share-adapter: C_GetSlotList (count) failed: 400
```

`400` is `0x190`, `CKR_CRYPTOKI_NOT_INITIALIZED` — the YubiHSM PKCS#11 module needs a connector
config and had none. It reads as a token or slot fault and is neither.

```bash
printf 'connector = http://127.0.0.1:12345\n' > yubihsm_pkcs11.conf
export YUBIHSM_PKCS11_CONF=$PWD/yubihsm_pkcs11.conf   # yubihsm-connector already running, pid 11484
```

## 2. The credential — confirmed, not assumed

`ZETA_FROST_PKCS11_PIN=0001password` (auth key `0001` ‖ password `password`).

```text
C_Initialize            -> 0x00000000
C_OpenSession (RO)      -> 0x00000000
C_Login (CKU_USER)      -> 0x00000000   (CKR_OK)
```

The `_PIN` env var name is PKCS#11's word for any credential (`C_Login`), not a smartcard PIN.
The format is confirmed working.

## 3. The prerequisite — ABSENT

```text
--- ALL objects visible to this session ---
count: 0

--- CKO_SECRET_KEY + CKA_LABEL="zeta-frost-wrap" ---
matches: 0
```

Cross-checked with an independent tool, so this is not one library's view:

```text
$ yubihsm-shell -a list-objects
Found 1 object(s)
id: 0x0001, type: authentication-key, algo: aes128-yubico-authentication,
    label: DEFAULT AUTHKEY CHANGE THIS ASAP
```

The device is **factory-empty**. The only object is the default auth key; auth keys are not
exposed as PKCS#11 objects, which is why the PKCS#11 count is `0` and the shell's is `1`. Both
readings agree.

**The device is capable of hosting the key** — firmware 2.4.1 reports `aes256`, `aes-ecb`,
`aes-cbc` in its supported algorithms, and auth key 1 carries `generate-symmetric-key`,
`put-symmetric-key`, `encrypt-cbc`, `decrypt-cbc`. It simply has not been provisioned.

## 4. The lane — actually run, exit code read directly

```bash
YUBIHSM_PKCS11_CONF=… ZETA_FROST_HARDWARE_LANE=pkcs11 \
ZETA_FROST_PKCS11_LIB=/usr/local/lib/pkcs11/yubihsm_pkcs11.dylib \
ZETA_FROST_PKCS11_PIN=0001password \
bun --config=bunfig.hardware-lane.toml test \
  ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts
```

```text
2 pass · 1 fail · 10 skip · 3 expect() calls · 13 tests
exit code 1
```

| test | result |
|---|---|
| **HW-1** the declared token is actually present | **pass** |
| **HW-5** the opted-in lane name is one this file implements | **pass** |
| **HW-2** a share round-trips through the token | **fail** — `no PKCS#11 key labelled zeta-frost-wrap in the token` |
| HW-3/4, HW-6..12 | skip (other lanes) |

The 10 skips are the TPM and multi-token lanes, correctly not selected. **The lane behaved as
designed**: it did not fall back to the software fake, and it failed loudly rather than
reporting green on a token that could not serve it. That much of the anti-vacuity machinery is
now measured rather than claimed.

**This is the blocker, stated precisely:** `hardware-pkcs11` cannot be exercised end-to-end
until an AES-256 key labelled `zeta-frost-wrap` exists on the device. That is a device-state
change and needs a human with provisioning authorization.

## 5. What running it found — two real defects

### 5.1 `CKM_AES_CBC_PAD` was `0x0000010d`. It is `0x00001085`.

```ts
const CKM_AES_CBC_PAD = 0x0000010dn;   // before
const CKM_AES_CBC_PAD = 0x00001085n;   // after
```

`0x0000010d` is **not a defined PKCS#11 mechanism at all** — `0x106..0x10f` is the unassigned
gap between the RC2 block (`0x100..0x105`) and RC4 (`0x110`). `C_EncryptInit` with an undefined
mechanism returns `CKR_MECHANISM_INVALID`.

**Checked, not cited** — four independent sources, one of them the device itself:

| source | says |
|---|---|
| Yubico's `/usr/local/include/pkcs11/pkcs11t.h:1019` | `CKM_AES_CBC_PAD 0x00001085UL` |
| NSS's independently-maintained `pkcs11t.h:1219` | `CKM_AES_CBC_PAD 0x00001085UL` |
| the YubiHSM's own `C_GetMechanismList` | `0x1085` **present**, `0x10d` **absent** |
| this repo's own OpenBao note, independently | `CKM_AES_GCM (0x1087)` — same `0x108x` AES block |

**So the `hardware-pkcs11` tier was broken from the day it was written**, on every conforming
token, and the missing `zeta-frost-wrap` key is what kept anyone from finding out. The
provisioning blocker was masking a correctness bug behind it.

**Why nothing caught it — the vacuity class, again.** Every software test drives this backend
through a mock whose `C_EncryptInit` is:

```ts
C_EncryptInit: () => 0n,
```

It never reads the mechanism, so it accepts every value for it. A fake that cannot reject a
wrong mechanism **cannot falsify a wrong mechanism constant**. The suite was green and
constrained nothing here. This is the same shape as
[`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md):
the tier was labelled `hardware-pkcs11` and was never metered.

**Closed by falsifiers, not by assertion.** `FSA-32` reads the mechanism bytes the adapter
actually puts on the wire and checks them against the spec constant; `FSA-33` drives a mock that
*refuses* a mechanism it does not implement, proving the refusal is surfaced rather than
swallowed. Deliberately, `FSA-32` asserts on the wire bytes and **not** on the imported constant
— importing it would compare the value to itself, which cannot fail.

### 5.2 `C_Initialize`'s return value was discarded at every call site

Three bare `lib.C_Initialize(0n)` calls, rv thrown away. That is what produced the misleading
`C_GetSlotList (count) failed: 400` in §1: the error named an innocent downstream call and sent
the reader to look at the token, when the token was attached and healthy and the module was
merely unconfigured.

Now read, with `CKR_CRYPTOKI_ALREADY_INITIALIZED` (`0x191`) still treated as the non-error it is.
Measured on the real device after the fix — same unconfigured condition, new message:

```text
frost-share-adapter: C_Initialize failed: 7. The module loaded but would not initialise,
which is usually module CONFIGURATION rather than hardware. For the YubiHSM PKCS#11 module:
point YUBIHSM_PKCS11_CONF at a file containing `connector = http://127.0.0.1:12345`, with
yubihsm-connector running. …
```

Falsifiers `FSA-34`/`FSA-35`/`FSA-36`.

### 5.3 Both fixes are mutation-checked

A falsifier that passes for the wrong reason is the defect it is meant to catch, so both were
run against a restored mutant:

| mutant | result |
|---|---|
| `CKM_AES_CBC_PAD` back to `0x0000010d` | **FSA-32, FSA-33 fail** (52 pass / 2 fail) |
| `C_Initialize` rv swallowed again | **FSA-34, FSA-35 fail** (52 pass / 2 fail) |
| neither (HEAD of this branch) | **54 pass / 0 fail** |

## 6. The lockout caution — retired, with the evidence that retires it

The readiness doc declined H3 because *"an authenticated PKCS#11 login with an unknown PIN risks
an auth-key lockout counter."* Two separate things retire it, and only the first is decisive:

1. **The PIN is no longer unknown.** Aaron tested the default password himself and authorized
   its use. The premise of the caution is gone.
2. **No retry counter is exposed anywhere in the YubiHSM's model.** `get-object-info` on auth
   key 1 returns `id / type / algorithm / label / length / domains / sequence / origin /
   capabilities / delegated_capabilities` — and no attempts-remaining field, which is exactly
   the field PIV *does* expose (`yubico-piv-tool -a status` → *"PIN tries left"*). `yubihsm.h`'s
   error enum likewise has no blocked/locked code.

**Stated at its true strength:** (2) is *consistent with* there being no lockout; it is not
proof. Establishing that positively would require deliberately failing authentication, which
this session did not do and should not. The original caution appears to have been generalised
from PIV/smartcard semantics, where a retry counter is real and visible — a reasonable inference
from an adjacent device class, and one nobody had a reason to check until now. Recorded as a
**mistake-shaped** finding, per
[`never-assume-malice-where-mistake-is-possible`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md);
declining to touch the only HSM on an unverified risk was the correct call under the information
that agent had.

## 7. What is still NOT measured — say it plainly

- **The seal/unseal round trip on the chip.** HW-2 never reached `C_Encrypt`. No share has been
  sealed by this device. The `hardware-pkcs11` tier remains **unexercised end-to-end**.
- **The mechanism fix, on hardware.** `0x1085` is confirmed as the right constant by four
  sources including the device's own mechanism list, and is unit-falsified — but no
  `C_EncryptInit` has yet been issued against a real key on this device. That call needs the key
  from §3. **Header-verified and unit-falsified is not the same as exercised**, and this doc does
  not claim it is.
- **Whether the YubiHSM's CBC accepts the adapter's IV and padding handling in practice.**
  Unknown until the round trip runs.
- **The multi-token lane.** One device; `pkcs11-multi` needs at least two and cannot be run here
  at all.

## 8. The one action that unblocks the rest

Someone with provisioning authorization runs one command against the device. Shape, from
`yubihsm-shell --help` — **flags not executed, so treat the exact spelling as unverified**:

```bash
yubihsm-shell --connector http://127.0.0.1:12345 --authkey 1 -p <password> \
  -a generate-symmetric-key -i 0 -l zeta-frost-wrap -d 1 \
  -c encrypt-cbc,decrypt-cbc -A aes256
```

Then §4's lane command runs unchanged and either passes or produces the next real finding.

Note that this **also** changes the device from its factory state, and the auth key still reads
`DEFAULT AUTHKEY CHANGE THIS ASAP`. Password rotation was explicitly held out of scope for this
session and remains a separate, human-authorized decision.

## Changed by this note

| file | change |
|---|---|
| `tools/setup/persona-keys/frost-share-adapter.ts` | `CKM_AES_CBC_PAD` `0x10d` → `0x1085`; `initializePkcs11` reads `C_Initialize`'s rv at all three call sites |
| `tools/setup/persona-keys/frost-share-adapter.test.ts` | `FSA-32`..`FSA-36` — mechanism-recording mock, mechanism-refusing mock, init-failure mocks |
| the readiness doc's **H3** row and its *"why no agent ran H3"* note | superseded by this measurement |

## Pointers

- [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — `hardware-pkcs11` was an **unmetered** tier wearing a hardware name; §5.1 is what the
  promotion costs.
- [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md) — anchors must
  be **checked**; §5.1's table is four checked sources, one of them the device.
- [`never-assume-malice-where-mistake-is-possible`](../../.claude/rules/never-assume-malice-where-mistake-is-possible.md)
  — §6.
- `docs/research/2026-08-21-openbao-migration-path-for-the-deployed-vault-*.md` §mechanisms — the
  in-repo note that independently records the `0x108x` AES block.
