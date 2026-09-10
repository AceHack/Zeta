---
id: 081M246EAP0087G0R003FFYST2
type: task
state: backlog
priority: P2
slug: usb-install-picks-hsm-then-tpm-then-sidecar-ci-tests-all-thr
title: "USB install picks hsm then tpm then sidecar; CI tests all three"
created: 2026-09-09T23:00:57.664Z
depends_on: []
composes_with:
  - 081M22M7G8M087G0R003R1C8Z4
---

# USB install picks hsm then tpm then sidecar; CI tests all three

Aaron 2026-09-09: some machines have no HSM and no TPM; almost none have
two HSMs on one box. USB install must detect hardware and pick **one**
rung: **hsm, then tpm, then sidecar**. CI must exercise the HSM simulator,
the TPM simulator, **and** the sidecar independently (all three), not
treat sidecar as leftover "neither".

## Prior-art (start gate)

Already on `main` (do not redo):

- `src/Core.TypeScript/cluster/unseal-path.ts` `integrateAtSetup` auto
  already picks YubiHSM > CardContact > TPM > Lucent. Dual-vendor on one
  box is one OpenBao seal (YubiHSM first). Dual-vendor custody is ZetaFS
  k-of-n, not two seals.
- `tools/setup/persona-keys/seal-path-detect.ts` is the only live-look
  join. USB install runs it after Step 6.95a (`081M22M7G8M087G0R003R1C8Z4`)
  as **observational** — it does not write Application.yaml.
- CI 2x2 in `.github/workflows/seal-emulator-install.yml` already installs
  SoftHSM / swtpm / both / neither. Neither is named `neither-kind-shamir`.
  SoftHSM/swtpm stay **job declarations**, never inferred from `/dev/tpmrm0`.

Gap: the picker speaks UnsealPath (`pkcs11-yubihsm` / `lucent-shamir`).
The USB-install product vocabulary is `hsm` | `tpm` | `sidecar`. CI cell
names do not say that all three rungs are independently tested.

## This hop

- Project UnsealPath → `UsbInstallSeal` (`hsm` | `tpm` | `sidecar`).
- `seal-path-detect.ts` JSON gains `ladder` (null when refused / unmeasured).
- USB install logs `ladder: hsm|tpm|sidecar` next to the path. Still
  observational. Still no overlay, no Application.yaml, bun JSON probe stays
  `null`.
- CI cells: `hsm-simulator`, `tpm-simulator`, `sidecar`, plus
  `both-softhsm-wins` (one seal; HSM wins). `--expect-ladder=` on the witness.

## Not this hop

- `seal "pkcs11"` in Application.yaml.
- Calling overlay / `plan-setup-from-frost-look.ts` from `zeta-install.sh`.
- Acting on the ladder (operator PIN for HSM).
- Two OpenBao seals on one node.
- Inferring SoftHSM/swtpm from `/dev/tpmrm0`.
- Completing `081M23ESC5B087G0R002HJ39DG`.
