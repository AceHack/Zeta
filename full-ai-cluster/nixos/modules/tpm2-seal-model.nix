# full-ai-cluster/nixos/modules/tpm2-seal-model.nix
#
# The ONE place a node's TPM-2.0-backed-seal desired state is written, and the
# pure derivation of everything else from it.
#
# WHAT THIS IS
# ------------
# A pure Nix value: an enum of modes, a function from mode to a provisioning
# plan, and a function that compares a declared mode against an OBSERVED TPM
# reading. `builtins` only — no lib, no packages, no I/O — so it evaluates
# under any nixpkgs and is testable by `nix eval` with no channel
# (`nixos/tests/tpm2-seal-prereqs-eval-test.nix`).
#
# WHAT THIS IS NOT — read before citing it
# ----------------------------------------
# Nothing here contacts a TPM, creates a PKCS#11 token, mints a PIN, generates
# a seal key, or unseals anything. No node in this fleet has been measured for
# TPM 2.0 — `tools/setup/persona-keys/tpm2-linux-captures.json` still carries
# exactly one `observed` entry and it is the macOS one, whose state is
# `unavailable` ("we could not ask"). So this file is a desired-state model
# standing in front of a hardware premise that is DECLARED and not PROBED.
#
# WHY A MODEL BEFORE AN IMPLEMENTATION
# ------------------------------------
# Same reason as `secure-boot-phase-model.nix`, which this deliberately
# mirrors: the failure to avoid is two descriptions of provisioning state that
# drift with nobody able to say which is authoritative. A host declares exactly
# ONE fact — `zeta.tpm2Seal.mode` — and every setting is derived from it.
#
# THE HONEST EXCEPTION, and it is the same one Secure Boot has
# -----------------------------------------------------------
# No software running on a node can turn its own firmware TPM on. Intel PTT /
# AMD fTPM is a firmware setting reached from the setup console; an OS cannot
# set it, for the same class of reason an OS cannot put its own firmware into
# UEFI Setup Mode. So TPM PRESENCE is not desired state — it is a MEASUREMENT,
# and this model's job is to notice when the measurement disagrees with the
# declaration. That is `assess`, and it is why the plan carries
# `tpmMustBePresent` (an expectation to check) rather than a setting to apply.
#
# WHAT IS DELIBERATELY ABSENT — key custody
# -----------------------------------------
# Whether the seal key is generated INSIDE the TPM (unexportable, so the board
# is the only thing that can ever unseal — lose the board, lose the vault) or
# generated outside and imported (recoverable from an escrow blob, which then
# becomes the real secret) is a maintainer decision with opposite failure
# modes. So is where the PKCS#11 PIN lives, who the recovery-share recipients
# are, and whether an unattended process may run `operator init` at all.
# `custodyKeys` is the explicit refusal list, and the eval test asserts that no
# plan attribute names any of them and that every plan value is a bool or null
# — so this model cannot smuggle a key origin, a PIN, or a recipient.
#
# Scoping doc: docs/research/2026-08-21-hands-off-metal-what-a-node-can-
#              provision-for-itself-and-the-three-classes-that-need-a-human.md

let
  # The declared modes. A host's TPM-seal desired state is exactly one of
  # these, written in exactly one place (its host file), and nowhere else.
  #
  #   off       — no TPM path at all. The fleet's state today, and the default.
  #   prereqs   — the TPM 2.0 userspace is installed and the device is
  #               reachable: tpm2-tools, the tpm2-pkcs11 module on the system
  #               path, udev rules granting the `tss` group the kernel resource
  #               manager, and the TCTI environment variables. Mints nothing,
  #               reads no secret, holds no key. This rung is SAFE and is the
  #               whole of "what the nix installer can pre-stage".
  #   provision — the token, the PIN and the seal key exist on this node. This
  #               rung is REFUSED by the module: reaching it decides key
  #               custody, which is not a derivation's call.
  modes = [ "off" "prereqs" "provision" ];

  # Settings this model refuses to decide. Each is a key-custody or
  # trust-root question that belongs to the maintainer, not to a derivation.
  custodyKeys = [
    "sealKeyOrigin" # generated in-TPM (unexportable) vs imported from an escrow
    "escrowRecipients" # whose public keys an escrowed seal key is encrypted to
    "recoveryShareRecipients" # whose public keys `-recovery-pgp-keys` names
    "pinStorage" # where BAO_HSM_PIN lives at rest
    "autoInitialize" # whether an unattended process may run `operator init`
    "autoUnsealAutomation" # whether anything may hold an unseal/recovery share
    "biometricApproval" # whether a gate requires operator physical presence
  ];

  derivePlan =
    mode:
    if mode == "off" then
      {
        # Everything the fleet does today, restated as the default mode, so
        # that importing this module is a provable no-op.
        tpm2Enable = false;
        pkcs11Module = false;
        tctiEnvironment = false;
        tpm2Tools = false;
        baoCliWithHsm = false;
        provisionToken = false;
        mintSealKey = false;
        tpmMustBePresent = null; # no claim on hardware
      }
    else if mode == "prereqs" then
      {
        tpm2Enable = true;
        pkcs11Module = true;
        tctiEnvironment = true;
        tpm2Tools = true;
        baoCliWithHsm = true;
        provisionToken = false; # the rung's whole point: stop before custody
        mintSealKey = false;
        # Still null, and this is the load-bearing line. Installing the
        # userspace asserts nothing about silicon: on a node with no TPM the
        # udev rules match no device and the tools report `absent`. A mode that
        # claimed presence here would be a check that cannot fail.
        tpmMustBePresent = null;
      }
    else if mode == "provision" then
      {
        tpm2Enable = true;
        pkcs11Module = true;
        tctiEnvironment = true;
        tpm2Tools = true;
        baoCliWithHsm = true;
        provisionToken = true;
        mintSealKey = true;
        tpmMustBePresent = true; # declaring provision asserts a measurable fact
      }
    else
      throw "zeta.tpm2Seal: unknown mode ${toString mode}; expected one of ${toString modes}";

  # Compare a DECLARED mode against an OBSERVED TPM reading.
  #
  #   tpmState :: null (never probed)
  #             | "present" | "absent" | "unreadable" | "unavailable" | "indeterminate"
  #
  # The five non-null values are exactly `Tpm2State` from
  # `tools/setup/persona-keys/tpm2-linux-probe.ts`, reused rather than
  # re-invented — that file's whole argument is that a boolean cannot hold this
  # answer, and a second vocabulary here would undo it.
  #
  # Returns one of:
  #   "no-claim"   — the mode asserts nothing about hardware (off / prereqs)
  #   "unprobed"   — the mode asserts a TPM, nobody has looked
  #   "agree"      — declared provision, the probe says `present`
  #   "check-did-not-run" — the probe could not look (`unreadable` /
  #                  `unavailable` / `indeterminate`). NOT a negative, and
  #                  never collapsed into one.
  #   "drift"      — declared provision, the probe ENUMERATED and found none
  assess =
    { mode, tpmState }:
    let
      plan = derivePlan mode;
    in
    if plan.tpmMustBePresent == null then
      "no-claim"
    else if tpmState == null then
      "unprobed"
    else if tpmState == "present" then
      "agree"
    else if tpmState == "absent" then
      "drift"
    else
      "check-did-not-run";
in
{
  inherit modes custodyKeys derivePlan assess;
}
