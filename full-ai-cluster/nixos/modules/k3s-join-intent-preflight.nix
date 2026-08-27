# full-ai-cluster/nixos/modules/k3s-join-intent-preflight.nix
#
# THE SILENT FOUNDING REVERSION, MADE LOUD.
#
# `injected-server-join.nix` names this failure in its own header and calls it
# the worst in the family:
#
#   "PURE EVAL IS A SILENT NO-OP ... `builtins.pathExists` on an absolute path
#    returns FALSE under pure eval (measured 2026-08-21, Nix 2.34.6), so a
#    `nixos-rebuild` without `--impure` reverts a joining server to a FOUNDING
#    one ... it re-founds a sovereign cluster on a node that was a member."
#
# WHAT ALREADY GUARDS IT, AND WHAT THAT LEAVES
# --------------------------------------------
#   * `lint-nixos-rebuild-needs-impure.ts` keeps every DOCUMENTED rebuild string
#     carrying `--impure`. It is a lint over prose: it cannot see a human typing
#     the command, a tool composing it, or any path not in the corpus.
#   * `k3s-datastore-preflight.nix` refuses when a join-provisioned node already
#     holds a datastore -- and states its own boundary: "On a genuinely
#     from-scratch flash that is fine -- there is no datastore, so nothing is
#     ignored."
#
# The from-scratch flash is therefore uncovered, and it is the case an operator
# performs deliberately: format machine 2 from USB, join it to machine 1. No
# prior datastore, so the sibling passes. If evaluation did not see `/etc/zeta`,
# machine 2 comes up a healthy sovereign cluster of ONE with every surface
# green.
#
# THE COMPARISON
# --------------
# Two facts recorded at two different times:
#
#   INTENT   read at BOOT,  from the disk  -- `/etc/zeta/cluster-join-server-url`
#   OUTCOME  baked at BUILD, from the eval -- `config.services.k3s.*`, below
#
# The outcome is interpolated into this unit's environment at build time, so it
# is a record of what evaluation actually decided -- not a re-derivation of it.
# The intent is read again at boot, from the disk it is actually on. When
# evaluation cannot see the intent there is nothing left at eval time to compare
# against, which is precisely why the reversion is invisible today. Comparing at
# boot is what makes it observable, and it convicts regardless of WHY eval
# missed the file.
#
# WHY A RUNTIME UNIT AND NOT AN ASSERTION. An assertion evaluates in the same
# pure context that lost the input -- under pure eval it would see "no join
# intended, founding" and be perfectly satisfied. A check that cannot fail in
# the condition it is meant to catch is the vacuity class, and an assertion here
# would be exactly that.
#
# WHAT IT REFUSES TO DO. It never deletes, never rewrites a config, never starts
# anything. Remediation is printed and is the operator's (manifesto §5) -- the
# same discipline as the sibling, for the same reason.
#
# NOT A HEALTH CHECK. It says nothing about whether the join SUCCEEDS; that is
# `k3s-join-observer.nix` observing a different fact later. This rules out the
# one failure mode that produces no symptom at all.
#
# UNVERIFIED ON HARDWARE: no node has booted this unit. What IS checked, and
# where: the refusal LOGIC by EXECUTING `k3s-join-intent-preflight.sh` over
# fixture directories in
# `src/Core.TypeScript/hygiene/lint-k3s-join-intent-preflight.test.ts` -- every
# branch, every exit status, plus the property that no fixture file is removed;
# and the UNIT WIRING (`before` + `requiredBy` = fail closed, and the resolved
# values actually reaching the environment) by the same test reading this file.
# That test runs in CI (`bun test src/Core.TypeScript/hygiene/`), which matters
# because no workflow runs `nix flake check` on `full-ai-cluster/flake.nix`.
# What is NOT checked anywhere: that systemd honours the ordering on a real
# boot. That needs a booted guest.

{ config, lib, pkgs, ... }:

let
  cfg = config.zeta.k3sJoinIntentPreflight;

  # Standalone script rather than a Nix string, so a test can EXECUTE it instead
  # of reading it -- same reasoning as `k3s-datastore-preflight.sh`.
  preflightScript = ./k3s-join-intent-preflight.sh;

  # READ FROM THE RESOLVED CONFIG, never recomputed from the same inputs the
  # eval may have lost. This is the whole point: the value recorded here is what
  # evaluation DECIDED, so a decision made on missing inputs is faithfully
  # carried into the unit and can be contradicted at boot.
  resolvedClusterInit = if config.services.k3s.clusterInit then "true" else "false";
  resolvedServerAddr = config.services.k3s.serverAddr;
in
{
  options.zeta.k3sJoinIntentPreflight = {
    enable = lib.mkEnableOption "fail-closed refusal when a join-provisioned node resolved to a founding configuration";

    joinServerUrlFile = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta/cluster-join-server-url";
      description = ''
        Presence of this file is what "provisioned to join" means, and it is the
        same file `injected-server-join.nix` reads at EVALUATION time. Reading it
        again here, at boot, is the entire mechanism: the two reads happen in
        different contexts, and a disagreement between them is the reversion.
        Absent, this unit passes and changes nothing.
      '';
    };

    joinTokenFile = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta/k3s-join-token";
      description = "The staged credential, reported in the refusal for diagnosis. Never read for its content.";
    };

    role = lib.mkOption {
      type = lib.types.enum [ "server" "agent" ];
      default = "server";
      description = ''
        `clusterInit` is meaningful only for a server; `serverAddr` means
        "joining" for both. The script checks `serverAddr` first so the agent
        path is covered by a branch that is actually taken rather than by one
        that never is.
      '';
    };

    serialDevice = lib.mkOption {
      type = lib.types.str;
      default = "/dev/ttyS0";
      description = "Where the refusal is echoed in addition to the console.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.services.zeta-k3s-join-intent-preflight = {
      description = "Refuse to start k3s when a join-provisioned node resolved to found";
      # `before` + `requiredBy` together are what make this FAIL CLOSED. A unit
      # wired `wantedBy` would let k3s start anyway, which is the vacuity class
      # in unit-file form.
      before = [ "k3s.service" ];
      requiredBy = [ "k3s.service" ];
      environment = {
        ZETA_JOIN_URL_FILE = cfg.joinServerUrlFile;
        ZETA_JOIN_TOKEN_FILE = cfg.joinTokenFile;
        ZETA_RESOLVED_CLUSTER_INIT = resolvedClusterInit;
        ZETA_RESOLVED_SERVER_ADDR = resolvedServerAddr;
        ZETA_ROLE = cfg.role;
        ZETA_SERIAL_DEVICE = cfg.serialDevice;
      };
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
        ExecStart = "${pkgs.bash}/bin/bash ${preflightScript}";
        StandardOutput = "journal+console";
        StandardError = "journal+console";
      };
    };
  };
}
