# Remember-creds-by-default — root cause: the KDF binds to the *ephemeral* boot-USB UUID; rebind to a *stable* hardware key (+ ask-before-format / check-partition-before-format reorders)

*Captured 2026-06-09 from Aaron ("the USB should boot and remember creds by default after logging in, tied to the
USB key AND a hardware key of some sort on the USB stick AND the UEFI boot partition, every time; check if the
partition exists every time before formatting; ask the questions BEFORE formatting; format and persist/repersist
right after — do this now"). Otto investigated the destructive install path and found a **crypto root cause** that
makes the rebind the real fix. Registers: [grounded — file:line], [root cause], [design], [safe reorders],
[needs-one-decision].*

## What's already there (grounded)

- Cred blob `zeta-creds.enc` lives on the ESP (`/boot/zeta-creds.enc`; `/mnt/boot/...` at install).
- Encrypted via `HKDF(USB-UUID ‖ stretched-passphrase, salt, info)` (`zeta-creds-crypto.ts deriveKey`;
  `zeta-install.sh:452`). The **USB UUID is captured by blkid at install** (`/etc/zeta/usb-uuid`).
- A **boot-USB retention** path exists (`zeta-install.sh:509-526`): copies a zflash-baked `zeta-creds.enc` from the
  boot USB ESP → target ESP after format. (Carries the *flashing* USB's baked creds forward.)
- Restore at boot: `zeta-creds-restore.nix` reads `/boot/zeta-creds.enc` + the USB UUID, decrypts, restores.

## The root cause (why "remember" doesn't just work)

**The blob is bound to the *ephemeral boot-USB UUID*.** Consequences:

- Reformat with the **same** USB → UUID matches → creds decrypt → remembered. ✅
- Reformat with a **different** USB (or a re-made USB whose FAT UUID changed) → UUID differs → **the preserved creds
  won't decrypt.** ❌
- So a naïve "preserve the target disk's old creds before wipe + repersist" (the literal ask) would, across USBs,
  carry a **dead, undecryptable blob** forward — and its precedence could **mask** the boot-USB's valid baked creds.
  **That's why blind-editing the destructive path here is a bug, not progress.**

## The fix = Aaron's instinct: rebind to a STABLE key (not the ephemeral USB UUID)

Aaron asked for binding to "the USB key **AND** a hardware key of some sort **AND** the UEFI partition." That is
exactly the rebind: replace the ephemeral-USB-UUID factor with a **stable** factor so remembering survives *any*
reformat / *any* USB:

`key = HKDF( passphrase ‖ STABLE-HW-KEY ‖ [operator-pubkey] , salt, info )`

**The one decision needed — what is the stable hardware key?** (determines the rebind):

| Option | Stable across reformat? | Stable across USB swap? | Notes |
|---|---|---|---|
| **TPM** (node motherboard, `tpm2`/`systemd-creds`) | yes | yes (node-bound) | strongest; node-bound (creds tied to the *machine*, not a stick); needs TPM present |
| **USB controller hardware serial** (not the FAT UUID — the device iSerial) | yes | no (stick-bound) | survives reformat of the same stick; "hardware key on the USB stick" literally |
| **Keyfile on the UEFI partition** (random key written once, persists across reformat *if* ESP preserved) | only if ESP not wiped | travels with the stick | "tied to the UEFI partition"; but a full ESP wipe loses it |

Aaron's phrasing ("hardware key on the USB stick AND the UEFI partition") points at **USB-iSerial ⊕ a UEFI-partition
keyfile** — stick-bound remembering. **TPM** would make it node-bound (arguably better for a cluster node that
reformats but stays the same machine). *This is the decision to confirm before the rebind.*

## The safe, crypto-neutral reorders (Otto can do these now, QEMU-validated)

Independent of the crypto rebind, two ordering fixes are pure flow (no binding risk) and directly match the ask:

1. **Fully headless boot + a 1-minute CANCEL window before format (default = proceed).** *(Corrected by Aaron
   2026-06-09: "it should NOT ask before format — it should ask to CANCEL for a minute before format; this USB
   should fully boot headless.")* The USB must boot **fully headless** — **no required interaction**: every "question"
   (host/role, wifi, login) is answered by **defaults + remembered creds**, never an interactive prompt. The current
   interactive blockers must become non-blocking: `read -rp "Type WIPE"` (`:162`, already has `ZETA_AUTO_CONFIRM=WIPE`)
   and the host/role `read -rp "Choice…"` (`:330`) must **timeout-default** (`read -t`, hardware-detected
   `DEFAULT_CHOICE` already computed) so no stdin is required. The **only** human touchpoint is a **~60 s cancel
   countdown immediately before the destructive wipe/format**: *"Formatting in 60s — press any key to CANCEL."* No
   keypress → **proceed** (headless-safe). Any key → **abort**. This replaces "ask before format" — it's a
   *cancel-window*, not a prompt, so headless is preserved while still giving a real abort gate.
2. **Check if the partition exists before formatting.** Before the unconditional wipe (`:166-171`), probe
   `part_name "$BOOT_DISK" 1` for an existing Zeta ESP + `zeta-creds.enc`; report it; *and* (once rebind lands)
   preserve→repersist it. The check itself is safe; the preserve is only correct after the stable rebind.

## Plan (autonomous, QEMU-validated — closing the loop)

1. **Headless + 60 s cancel-window** before format + timeout-default the interactive prompts + partition-existence
   check (all crypto-neutral) — implement + QEMU-boot-assert (incl. a headless no-keypress run).
2. **Rebind KDF** to the chosen stable key (pending the one decision above) — implement in `zeta-creds-crypto.ts` +
   `restore.nix` + install; QEMU-validate decrypt-after-reformat.
3. **Preserve→format→repersist** target creds (now crypto-valid) — implement + QEMU-validate remember-across-reformat.
4. **Default-on:** remembering is the no-keypress default when a blob/partition is detected (#UX-Iris, #7007 model).

All gated by the QEMU harness (grown from the 081KSNY2Z0008QG0R0008PN7RQ PoC to boot-and-assert) on the free GitHub workflows — humans
only for the narrow physical surface.

## Honest scope

[grounded]: KDF binds to the ephemeral boot-USB UUID (`zeta-install.sh:452`, `zeta-creds-crypto.ts`); blob at
`/boot/zeta-creds.enc`; boot-USB retention at `:509-526`; menu after format at `:330`; wipe unconditional at `:166`.
[root cause]: ephemeral-UUID binding → remember-across-reformat only same-USB; naïve preserve carries dead blobs.
[fix]: rebind to a stable HW key (Aaron's instinct) — **one decision: TPM (node-bound) vs USB-iSerial vs
UEFI-keyfile (stick-bound)**. [safe-now]: fully-headless boot + a 60 s cancel-window before format (default proceed, any key
aborts — NOT interactive questions; corrected by Aaron) + timeout-defaulted prompts + partition-check are
crypto-neutral; do them QEMU-validated (incl. a headless no-keypress run). [discipline]: did NOT blind-edit the destructive+crypto path — a naïve edit would have shipped an
undecryptable-blob / cred-masking bug. No code shipped in this doc; it's the executable spec + the one decision.

## Pointers

- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (`:166` wipe, `:211` format, `:330` menu, `:452` UUID
  capture, `:509-526` retention) · `tools/installer/zeta-creds-crypto.ts` (deriveKey/HKDF) · `zeta-creds-persist.ts`
  · `nixos/modules/zeta-creds-restore.nix` (`/boot/zeta-creds.enc`, usbUuidPath).
- Design context: the trust-model + honest-QEMU plan (#7251) · the 4-audience no-keypress UX (Iris, this session) ·
  the 3-level erase / InstallMode.Live (#7007/#7008/#7010) · close-the-AI-loop QEMU enforcement (#7229).
