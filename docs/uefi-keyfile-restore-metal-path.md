# UEFI keyfile restore — what CI proves, and what it does NOT

The `build-ai-cluster-iso.yml` restore-decrypt job (`QEMU_UEFI_KEYFILE_RESTORE=1`,
contract in `src/Core.TypeScript/ci/qemu-full-install-test.ts`) is green
end-to-end. This note records — durably, outside the code comments — exactly what
that green covers, so no one quotes it for a guarantee it does not make.

## Verified in CI (QEMU)

- The persisted cred blob is **delivered** to the ESP and survives reboot
  (`reading preserved ESP blob` in phase-2).
- The restore unit **starts** and runs to completion (`ExecStart entered` → bind →
  transport → wrote).
- The **binding factor** is `uefiKeyfile` (ESP file), not the usbUuid fallback.
- **Decrypt works** with the correct passphrase delivered over the hypervisor
  `fw_cfg` channel, and the passphrase never leaks to the serial.
- The run **names its transport** as `qemu-fw_cfg metal-capable=no`, and the
  contract **refuses** any run that claims the interactive/metal transport inside
  QEMU. A green therefore cannot be misread as a metal proof.

## NOT verified in CI — the two open gaps

### 1. The metal (bare-metal `tty1`) passphrase path

`fw_cfg` **does not exist on hardware**. On metal, `zeta-creds-restore.nix` falls
back to `systemd-ask-password` on `tty1` (an operator types the passphrase). No
CI harness can drive that console prompt, so the `interactive-ask-password
metal-capable=yes` path has **never executed in CI**. The QEMU green proves the
decrypt and the binding; it proves **nothing** about the metal passphrase entry.

**Manual verification runbook (hardware):**

1. Build the ISO (`build-ai-cluster-iso.yml` artifact) and write it to USB.
2. Install to a UEFI machine with the picker enabled so ≥1 credential is baked
   and the encrypted blob lands on the ESP.
3. Reboot. At `tty1`, confirm `systemd-ask-password` prompts for the passphrase
   (the `fw_cfg` staging line must be ABSENT — there is no hypervisor).
4. Enter the correct passphrase; confirm the serial/journal shows
   `passphrase transport=interactive-ask-password metal-capable=yes` followed by
   `wrote N creds` (N ≥ 1) and the restored creds present with correct ownership.
5. Negative check: reboot, enter a WRONG passphrase; confirm restore **refuses**
   (decrypt error, not garbled plaintext) and does not write.
6. Record the run (serial capture + photo of the prompt) under
   `docs/hygiene-history/` and link it here.

Until step 6 lands, treat the metal path as **unverified**.

### 2. The non-zero write path in the QEMU guest

The current QEMU picker bakes **0 credentials**, so a passing restore reports
`wrote 0 creds`: the decrypt + bind are proven, but the **write/chown** path is
vacuous. `restoreExercisedWritePath()` in the contract makes this legible
(`false` on the lane today). Closing it means baking a real test cred in the
picker scenario and asserting `wrote >= 1`. The wrong-passphrase and wrong-device
**refusal** paths are already covered by the installer decrypt security-rejection
unit tests; the gap is the positive in-guest write.

Work item `081M12178AR087G0R0014Z5JGE` tracks both follow-ups (non-zero in-guest
write + metal `tty1` verification).

## Why this matters

Same discipline as the rest of the restore work: a check that did not run must
never look like one that passed. Recording the boundary of the proof is part of
the proof.
