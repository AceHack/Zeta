# full-ai-cluster/nixos/modules/secure-boot.nix
#
# 081M00KTH58087G0R00120WT6F increment 1 — the option surface for the one
# desired-state fact, and a fail-closed gate on everything downstream of it.
#
# STATE OF THE WORLD (verified 2026-08-17, not assumed)
# -----------------------------------------------------
# `grep -rn 'lanzaboote|secureboot|sbctl|SecureBoot' full-ai-cluster/ infra/`
# returns NOTHING. There is no lanzaboote flake input, no signing key anywhere,
# no enrolled node, and no machine in this fleet has ever booted with UEFI
# Secure Boot on. This module does not change that. It declares
# `zeta.secureBoot.phase` (default "off"), derives a plan from it, and REFUSES
# to evaluate any phase other than "off".
#
# So, precisely:
#   - implemented: the option, the derivation, the refusal, and their tests.
#   - scaffolding: nothing here is wired to a bootloader. No `boot.*` option is
#     set by this file at any phase.
#   - UNVERIFIED and unexercised: signing, enrolment, the firmware ceremony,
#     and every claim about how a real node behaves. Nothing below has been
#     evaluated by `nixos-rebuild`, and no hardware was booted in this change.
#
# WHY IT IS IMPORTED ANYWAY (`common.nix`)
# ----------------------------------------
# Same reason as `injected-join-server.nix`: an option nobody evaluates is an
# option nobody checks. Imported at the default phase this module contributes
# exactly one always-true assertion and zero settings, so every host evaluates
# it on every `nix flake check` while its boot path stays byte-identical.
#
# THE GATE — why phase != "off" fails instead of working
# ------------------------------------------------------
# Turning any phase on requires answers this repo does not have: where the
# private keys live at rest, whether Microsoft's UEFI CA enters `db`, whether
# enrolment is operator-approved. Those are the maintainer's calls (design doc
# §9 Q3/Q4/Q5), and the standing position is that an agent may EXECUTE setup
# while a human APPROVES the sensitive gate. An agent that quietly picked a
# default here would be extending authority, not inheriting it. So the module
# fails closed and names the questions.
#
# Design doc: docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-
#             desired-state-with-one-firmware-ceremony.md

{ config, lib, ... }:

let
  model = import ./secure-boot-phase-model.nix;
  cfg = config.zeta.secureBoot;
in
{
  options.zeta.secureBoot = {
    phase = lib.mkOption {
      type = lib.types.enum model.phases;
      default = "off";
      example = "provision";
      description = ''
        The ONE place a host's Secure Boot desired state is written. Every other
        Secure Boot setting is derived from this by
        `modules/secure-boot-phase-model.nix`; a second description of the same
        state anywhere else in the tree is the drift this option exists to
        prevent.

        Firmware state is deliberately NOT expressible here — no software can
        put its own firmware into UEFI Setup Mode, so enrolment is a measured
        fact, not a declared one (see `zeta.secureBoot.plan.firmwareMustEnforce`
        and the model's `assess`).

        Any value other than "off" currently fails evaluation: the key-custody
        decisions it depends on have not been made.
      '';
    };

    plan = lib.mkOption {
      type = lib.types.attrsOf (lib.types.nullOr lib.types.bool);
      readOnly = true;
      description = ''
        Derived, never written by hand. The settings a Secure Boot
        implementation would take from `phase`, plus `firmwareMustEnforce` —
        an expectation to CHECK against a measurement, not a setting to apply.

        Only booleans and nulls appear here by construction: a key path, a CA
        name, or any other custody decision in this attrset is a bug, and the
        eval test fails on one.
      '';
    };
  };

  config = {
    zeta.secureBoot.plan = model.derivePlan cfg.phase;

    assertions = [
      {
        assertion = cfg.phase == "off";
        message = ''
          zeta.secureBoot.phase = "${cfg.phase}" is refused: no Secure Boot key
          custody decision has been recorded for this fleet, so there is nothing
          honest to enable.

          Blocked on the maintainer, per design doc §9:
            Q3 does the control-plane node carry a discrete GPU with an option
               ROM? (decides whether Microsoft's UEFI CA must enter `db`)
            Q4 do the nodes have TPM 2.0? (decides whether the private key can
               ever be protected at rest — §6.4: without full-disk encryption a
               db key on plain ext4 defeats Secure Boot outright)
            Q5 is a BIOS password acceptable operationally?
          plus Q2 (BMC/IPMI for headless recovery) and Q6 (which node pilots).

          This module wires no bootloader at any phase. Lifting this gate means
          answering the questions above and landing the lanzaboote input, the
          signing config, and a QEMU/OVMF boot test — none of which exist.
        '';
      }
    ];
  };
}
