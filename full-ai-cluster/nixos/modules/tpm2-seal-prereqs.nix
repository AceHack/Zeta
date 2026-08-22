# full-ai-cluster/nixos/modules/tpm2-seal-prereqs.nix
#
# The option surface for TPM-2.0-backed seal provisioning, and a fail-closed
# gate on the rung that decides key custody.
#
# Answering Aaron 2026-08-21: *"if they are absolutely needed, could the nix
# installer setup anything that's needed?"* — for the seal's PREREQUISITES the
# answer is yes and this module is it. `zeta.tpm2Seal.mode = "prereqs"` is the
# entire installer-side change: the tpm2-pkcs11 module lands on the system path,
# udev grants the kernel resource manager to the `tss` group, the TCTI
# environment variables point at `/dev/tpmrm0`, and `tpm2-tools` plus an
# HSM-capable `bao` CLI are on PATH. Nothing is minted, nothing is read, nothing
# is held.
#
# STATE OF THE WORLD (verified 2026-08-21, not assumed)
# -----------------------------------------------------
# `rg -li tpm full-ai-cluster` returned six files before this change and none of
# them set a single `security.tpm2.*` option: the fleet has no TPM userspace at
# all. `tools/setup/persona-keys/tpm2-linux-captures.json` carries exactly one
# `observed` capture and it is the macOS one — **no TPM has been contacted by
# anyone in this repo**, so the hardware premise under every rung below is a
# DECLARATION ("we can count on it") and not a PROBE. Workitem
# 081M00VN9P1087G0R000FYTTVS is the one command that closes that gap.
#
# This module does not close it either. At its default mode it sets NO option
# and contributes one always-true assertion, so importing it leaves every host
# byte-for-byte unchanged.
#
# THE GATE — why mode = "provision" fails instead of working
# ----------------------------------------------------------
# The `provision` rung creates a PKCS#11 token, mints its SO/user PIN, and
# generates the seal key. Two of those are gated classes, and the third is worse
# than gated — it is a fork with opposite failure modes:
#
#   * a key GENERATED in the TPM cannot be exported, so the board becomes the
#     only thing in the universe that can decrypt this vault. OpenBao states the
#     consequence itself: "If the seal mechanism or its keys are permanently
#     deleted, then the OpenBao cluster cannot be recovered, even from backups."
#   * a key generated outside and IMPORTED (`tpm2_ptool import`) is recoverable
#     from its escrow blob — and that blob is then the real secret, which moves
#     the whole problem to wherever it is kept.
#
# An agent that picked one by writing a default would be extending authority,
# not inheriting it (`.claude/rules/no-directives.md`). So the module fails
# closed and names the fork.
#
# Scoping doc: docs/research/2026-08-21-hands-off-metal-what-a-node-can-
#              provision-for-itself-and-the-three-classes-that-need-a-human.md

{ config, lib, pkgs, ... }:

let
  model = import ./tpm2-seal-model.nix;
  cfg = config.zeta.tpm2Seal;
  plan = cfg.plan;
in
{
  options.zeta.tpm2Seal = {
    mode = lib.mkOption {
      type = lib.types.enum model.modes;
      default = "off";
      example = "prereqs";
      description = ''
        The ONE place a host's TPM-seal desired state is written. Every other
        TPM setting is derived from this by `modules/tpm2-seal-model.nix`; a
        second description of the same state anywhere else in the tree is the
        drift this option exists to prevent.

        TPM PRESENCE is deliberately NOT expressible here — no OS can enable its
        own firmware TPM (Intel PTT / AMD fTPM is a setup-console setting), so
        presence is a measured fact, not a declared one. See
        `zeta.tpm2Seal.plan.tpmMustBePresent` and the model's `assess`, and
        `tools/setup/persona-keys/tpm2-linux-probe.ts` for the five-state
        reading that must never be collapsed to a boolean.

        `"prereqs"` is safe and is the intended next step. `"provision"`
        currently fails evaluation: the seal-key custody decision it depends on
        has not been made.
      '';
    };

    plan = lib.mkOption {
      type = lib.types.attrsOf (lib.types.nullOr lib.types.bool);
      readOnly = true;
      description = ''
        Derived, never written by hand. The settings a TPM-seal implementation
        would take from `mode`, plus `tpmMustBePresent` — an expectation to
        CHECK against a measurement, not a setting to apply.

        Only booleans and nulls appear here by construction: a key origin, an
        escrow recipient, a PIN, or any other custody decision in this attrset
        is a bug, and the eval test fails on one.
      '';
    };
  };

  config = lib.mkMerge [
    { zeta.tpm2Seal.plan = model.derivePlan cfg.mode; }

    {
      assertions = [
        {
          assertion = cfg.mode != "provision";
          message = ''
            zeta.tpm2Seal.mode = "provision" is refused: no seal-key custody
            decision has been recorded for this fleet, so there is nothing
            honest to provision.

            Blocked on the maintainer:
              C1 is the seal key GENERATED IN the TPM (unexportable; losing the
                 board loses the vault, backups included) or generated outside
                 and IMPORTED (recoverable, but the escrow blob becomes the real
                 secret)?
              C2 if imported, whose public keys is the escrow encrypted to, and
                 where does the blob live?
              C3 where does the PKCS#11 PIN live at rest? It cannot live in the
                 rendered HCL — the chart puts that in a ConfigMap.
              C4 may an unattended process run `bao operator init` at all, and
                 with which `-recovery-pgp-keys` recipients?
              C5 single-node or three-node FIRST? Three TPMs are three different
                 keys, so three raft members cannot unseal each other's data
                 unless C1 is "imported" and they share one key.

            Lifting this gate means answering those, landing the token/key
            provisioning, and — first — running the probe on one node so the
            hardware premise stops being a declaration
            (081M00VN9P1087G0R000FYTTVS).
          '';
        }
      ];
    }

    (lib.mkIf plan.tpm2Enable {
      # The whole installer-side provisioning, and it is this short. Every
      # option below is upstream nixpkgs `security.tpm2` (nixos/modules/
      # security/tpm2.nix), read at the pinned channel rather than recalled.
      security.tpm2 = {
        enable = true;
        # Places `libtpm2_pkcs11.so` at /run/current-system/sw/lib/ — the path
        # `BAO_HSM_LIB` would name. NOTE, because it is the difference between
        # a design and a running system: that library is glibc-linked out of
        # the Nix store, and the upstream `openbao-hsm` container image is
        # Alpine/musl. Host-side use is direct; in-pod use is the open question
        # the scoping doc's §1.4 prices.
        pkcs11.enable = plan.pkcs11Module;
        # udev: /dev/tpmrm0 becomes mode 0660, group `tss`. Without this only
        # root can reach the kernel resource manager, and a non-root seal
        # process reads as "no TPM" — the exact error/absence conflation
        # tpm2-linux-probe.ts exists to refuse.
        applyUdevRules = true;
        # TPM2TOOLS_TCTI / TPM2_PKCS11_TCTI = device:/dev/tpmrm0. Set here so a
        # tool that forgets the flag still talks to the resource manager rather
        # than grabbing the raw device.
        tctiEnvironment = {
          enable = plan.tctiEnvironment;
          interface = "device";
          deviceConf = "/dev/tpmrm0";
        };
      };

      environment.systemPackages =
        (lib.optionals plan.tpm2Tools [ pkgs.tpm2-tools ])
        # The `bao` CLI built with the `hsm` build tag. In nixpkgs 25.11 the
        # package's `withHsm` argument already defaults to
        # `hostPlatform.isLinux`, so this override is a PIN, not a change: if
        # that default ever flips, this line keeps the PKCS#11 code compiled in
        # instead of silently shipping a binary that cannot see a token.
        #
        # Installing the CLI does NOT start a server. `services.openbao` is not
        # touched by this module, and whether OpenBao runs on the host at all is
        # an architecture decision recorded in the scoping doc, not here.
        ++ (lib.optionals plan.baoCliWithHsm [ (pkgs.openbao.override { withHsm = true; }) ]);
    })
  ];
}
