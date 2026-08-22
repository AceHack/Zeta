# full-ai-cluster/nixos/modules/secure-boot-phase-model.nix
#
# 081M00KTH58087G0R00120WT6F increment 1 — the ONE place a node's Secure Boot
# desired state is written, and the pure derivation of everything else from it.
#
# WHAT THIS IS
# ------------
# A pure Nix value: an enum of phases, a function from phase to a settings plan,
# and a function that compares a declared phase against an OBSERVED firmware
# state. No I/O, no defaults read from disk, no packages, no lib dependency —
# `builtins` only, so it evaluates identically under any nixpkgs and can be
# tested by `nix eval` with no channel (see
# `nixos/tests/secure-boot-desired-state-eval-test.nix`).
#
# WHAT THIS IS NOT — read this before citing it
# ---------------------------------------------
# NOTHING here signs, enrols, or verifies anything. There is no lanzaboote
# input in this flake, no `boot.lanzaboote.*` setting anywhere in the tree, and
# no node has ever booted with any of it. `assess` does not read
# `/sys/firmware/efi/efivars/*` — a caller must hand it a measurement, and no
# caller exists yet. Secure Boot on this fleet is UNIMPLEMENTED; this file is
# the desired-state model that a future implementation would derive from.
#
# WHY A MODEL BEFORE AN IMPLEMENTATION
# ------------------------------------
# The work-item's title carries the requirement: "keep desired-state ... one".
# The failure it names is two descriptions of enrolment state that drift, with
# nobody able to say which is authoritative. The structural answer is that a
# host declares exactly ONE fact — `zeta.secureBoot.phase` — and every other
# setting is *derived* from it by `derivePlan`, never written a second time.
#
# The firmware is the honest exception. Per the design doc §3.2, no software
# running on a node can put its own firmware into UEFI Setup Mode: deleting the
# Platform Key requires an authenticated variable update signed by the OEM's PK
# private key. So firmware state is not desired-state at all — it is a
# MEASUREMENT, and the model's job is to notice when the measurement disagrees
# with the declaration. That is `assess`, and it is why the plan carries
# `firmwareMustEnforce` (an expectation to check) rather than a setting to
# apply.
#
# WHAT IS DELIBERATELY ABSENT — key custody
# -----------------------------------------
# Where the Platform Key / KEK / db private keys live, whether Microsoft's UEFI
# CA is admitted to `db`, whether a signature requires an operator biometric —
# every one of those is a maintainer decision (design doc §9 Q3/Q4/Q5), and an
# agent choosing one by writing a default would BE the failure. `custodyKeys`
# below is the explicit refusal list, and the eval test asserts no plan
# attribute names any of them and that every plan value is a bool or null — so
# this model cannot smuggle a key path, a CA name, or a custody policy.
#
# Design doc: docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-
#             desired-state-with-one-firmware-ceremony.md

let
  # The declared phases. A host's Secure Boot desired state is exactly one of
  # these, written in exactly one place (its host file), and nowhere else.
  #
  #   off       — no Secure Boot path at all. The fleet's state today.
  #   provision — signing enabled, unsigned still tolerated, firmware ceremony
  #               not yet performed. Design doc §5.3: `allowUnsigned` stays true
  #               here precisely so a node cannot brick itself before enrolment.
  #   enforce   — unsigned refused at build time (§5.3: a missing key must fail
  #               `nixos-rebuild` loudly, never produce an unbootable
  #               generation), and the firmware is expected to be enforcing.
  phases = [ "off" "provision" "enforce" ];

  # Settings this model refuses to decide. Each is a key-custody or
  # trust-root question that belongs to the maintainer, not to a derivation.
  custodyKeys = [
    "pkiBundle" # where the private keys live at rest
    "autoGenerateKeys" # whether a node mints its own PK/KEK/db
    "autoEnrollKeys" # whether enrolment happens without a human in the loop
    "includeMicrosoftKeys" # whether Microsoft's UEFI CA enters our root of trust
    "signerBackend" # on-disk key vs PKCS#11/YubiKey touch-to-sign
    "biometricApproval" # whether each signature is operator-approved
    "bootCounting" # a boot-path behaviour change; §7.3 sequences it separately
  ];

  derivePlan =
    phase:
    if phase == "off" then
      {
        # Everything the fleet does today, restated as the default phase, so
        # that importing this module is a provable no-op.
        lanzabooteEnable = false;
        systemdBootEnable = true;
        allowUnsigned = null; # not applicable: there is no signing path
        firmwareMustEnforce = null; # no claim on firmware state
      }
    else if phase == "provision" then
      {
        lanzabooteEnable = true;
        systemdBootEnable = false; # lanzaboote takes over the install hook
        allowUnsigned = true; # §5.3 — pre-enrolment brick guard
        firmwareMustEnforce = null; # the ceremony may not have happened yet
      }
    else if phase == "enforce" then
      {
        lanzabooteEnable = true;
        systemdBootEnable = false;
        allowUnsigned = false; # §5.3 — fail the build, not the boot
        firmwareMustEnforce = true; # declaring enforce asserts a measurable fact
      }
    else
      throw "zeta.secureBoot: unknown phase ${toString phase}; expected one of ${toString phases}";

  # Compare a DECLARED phase against an OBSERVED firmware state.
  #
  #   firmwareSecureBoot :: null (never measured) | false | true
  #
  # Returns one of:
  #   "no-claim"   — the phase makes no assertion about firmware (off/provision)
  #   "unmeasured" — the phase asserts enforcement, nobody has looked
  #   "agree"      — declared enforce, firmware enforces
  #   "drift"      — declared enforce, firmware does NOT enforce
  #
  # "unmeasured" is a distinct outcome on purpose: a check that has not run must
  # never read as one that passed.
  assess =
    { phase, firmwareSecureBoot }:
    let
      plan = derivePlan phase;
    in
    if plan.firmwareMustEnforce == null then
      "no-claim"
    else if firmwareSecureBoot == null then
      "unmeasured"
    else if firmwareSecureBoot then
      "agree"
    else
      "drift";
in
{
  inherit phases custodyKeys derivePlan assess;
}
