# full-ai-cluster/nixos/modules/injected-server-join.nix
#
# ONE NODE FOUNDS; EVERY OTHER ONE JOINS. This is the module that makes the
# second half possible for a CONTROL PLANE.
#
# THE DEFECT
# ----------
# `k3s-server.nix` sets `clusterInit = lib.mkDefault true` and sets no
# `serverAddr`. `injected-join-server.nix` — the sibling that reads the same
# injected endpoint — guards itself to `config.services.k3s.role == "agent"`.
# So on today's tree:
#
#   flashed as a WORKER  (worker-template / worker-gpu, role = agent)
#       -> reads /etc/zeta/cluster-join-server-url, joins. Works.
#   flashed as a CONTROL PLANE (control-plane, role = server)
#       -> `--cluster-init`, no `--server`, no token. FOUNDS ITS OWN CLUSTER,
#          silently, with a brand-new CA, whatever the medium said.
#
# The second row is not hypothetical. Two k3s control planes are sitting on the
# maintainer's LAN right now with CA founding epochs TWELVE DAYS APART — two
# sovereign clusters where one was intended. That is this defect's signature,
# and nothing in the boot path could have said so at the time.
#
# THE FIX, AND WHAT IT DELIBERATELY DOES NOT CHANGE
# ------------------------------------------------
# `clusterInit = mkDefault true` STAYS. Sovereign-by-default is the intent
# (Aaron, confirmed): a machine flashed with no join endpoint founds its own
# cluster, which is exactly right for the first node and for anyone building a
# standalone one. What this module adds is that JOINING is expressible and
# EXPLICIT — a node joins because the medium carried an endpoint, never because
# a default guessed for it.
#
#   endpoint present + role == "server"  ->  clusterInit := false,
#                                            serverAddr := the endpoint,
#                                            tokenFile  := the staged token.
#   endpoint absent                      ->  nothing set. Byte-identical to
#                                            today's founding behaviour.
#
# ALL THREE OR NONE, and the token is why. A server told to join with no token
# cannot authenticate, and k3s's failure there ("token is required") reads
# nothing like "the flash carried no token". Worse, `clusterInit = false` with
# no reachable server leaves a node that founds nothing and joins nothing. So
# the override applies only when BOTH the endpoint and the token file are
# present, and when only one is present it REFUSES AT EVALUATION rather than
# producing a node that boots into a state no operator asked for. Same
# all-or-none discipline, for the same reason, as
# `injected-cluster-address.nix`.
#
# WHY A SEPARATE TOKEN PATH FROM THE AGENT'S. `zeta-install.sh` stages a
# joining AGENT's token at `/var/lib/rancher/k3s/agent/token`, which is where
# `k3s-agent.nix` points. A server's `--token-file` must not be
# `/var/lib/rancher/k3s/server/token`: that is the path k3s MANAGES and writes
# itself, and pre-seeding it conflates "the credential I present to join" with
# "the credential I hand out". `/etc/zeta/k3s-join-token` is neither, so the
# two never collide.
#
# THIS DOES NOT INVENT A JOIN. k3s's join is the join (Aaron 2026-08-13,
# closing PR #10493). Everything here is `services.k3s` options that k3s
# already honours; there is no handshake, no protocol, and no credential
# minting in this file.
#
# UNVERIFIED ON HARDWARE. Nothing here has been evaluated by a `nixos-install`
# or a boot. What IS checked: the option names against the nixpkgs k3s module,
# the file-path contract against `zeta-install.sh`, and the resulting option
# values by `nixos/tests/k3s-server-join-eval-test.nix`.
#
# PURE EVAL IS A SILENT NO-OP, exactly as for every sibling in this family:
# `builtins.pathExists` on an absolute path returns FALSE under pure eval
# (measured 2026-08-21, Nix 2.34.6), so a `nixos-rebuild` without `--impure`
# reverts a joining server to a FOUNDING one. That is the worst reversion in
# this family — it re-founds a sovereign cluster on a node that was a member.
# `zeta-install.sh` passes `--impure`, and
# `src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts` is the check
# that keeps every documented rebuild string carrying it.
#
# `k3s-datastore-preflight.nix` is the runtime half: on a node that ALREADY
# holds a datastore, k3s ignores every option this module sets, and the
# preflight makes that loud instead of silent.

{ config, lib, ... }:

let
  cfg = config.zeta.k3sServerJoin;
  urlFile = cfg.joinServerUrlFile;
  tokenFile = cfg.tokenFile;

  readTrimmed = path:
    if builtins.pathExists path
    then
      let stripped = lib.removeSuffix "\n" (lib.removeSuffix " " (builtins.readFile path));
      in if stripped == "" then null else stripped
    else null;

  # Shape-checked in Nix as well as in bash and in TypeScript. Each is the last
  # guard on a different substrate, and the value came off a FAT filesystem
  # anyone with physical access can rewrite.
  rawUrl = readTrimmed urlFile;
  injectedUrl =
    if rawUrl != null
      && lib.hasPrefix "https://" rawUrl
      && builtins.match "https://[A-Za-z0-9._:-]+" rawUrl != null
    then rawUrl
    else null;

  # Presence only. The token's CONTENT is not read here — a NixOS module
  # evaluates into the world-readable Nix store, and `builtins.readFile` on a
  # cluster credential would copy it there. `zeta-install.sh` does the content
  # check (`K10<64 hex>::…`) at staging time, on the machine, where the bytes
  # already are.
  tokenPresent = builtins.pathExists tokenFile;

  isServer = config.services.k3s.role == "server";
  joining = isServer && injectedUrl != null && tokenPresent;

  # Half-provisioned: an endpoint with no token, or a token with no endpoint.
  # Not a no-op and not a join — a state nobody asked for.
  halfProvisioned = isServer && (injectedUrl != null) != tokenPresent;
in
{
  # The two paths are OPTIONS rather than literals for one reason: it is what
  # makes `nixos/tests/k3s-server-join-eval-test.nix` able to drive this module
  # over fixtures and prove each branch. A module whose inputs are hardcoded
  # absolute paths can only be read, never exercised.
  options.zeta.k3sServerJoin = {
    joinServerUrlFile = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta/cluster-join-server-url";
      description = ''
        k3s `--server` URL of the cluster this node should JOIN, staged by
        `zeta-install.sh` from the flash medium. Absent, the node founds its
        own cluster (`k3s-server.nix`'s `clusterInit = mkDefault true`).
      '';
    };
    tokenFile = lib.mkOption {
      type = lib.types.str;
      default = "/etc/zeta/k3s-join-token";
      description = ''
        The k3s cluster token this node presents when joining. Deliberately NOT
        `/var/lib/rancher/k3s/server/token`, which k3s manages and writes
        itself; pre-seeding that path conflates "the credential I present" with
        "the credential I hand out".

        Only its PRESENCE is read at evaluation time. A NixOS module evaluates
        into the world-readable Nix store, so `builtins.readFile` on a cluster
        credential would copy it there. `zeta-install.sh` checks the content
        (`K10<64 hex>::…`) on the machine, where the bytes already are.
      '';
    };
  };

  config = lib.mkMerge [
    {
      assertions = [
        {
          assertion = !halfProvisioned;
          message =
            "this control plane is HALF-PROVISIONED for a join: "
            + (if injectedUrl != null
               then "${urlFile} names ${injectedUrl} but ${tokenFile} is absent, so the node could "
                    + "not authenticate to it"
               else "${tokenFile} is present but ${urlFile} is absent, so the node has a credential "
                    + "and nothing to present it to")
            + ". A server joins with BOTH or founds with NEITHER; there is no third state that "
            + "produces a cluster. Re-flash with `zflash --role joiner --join-token <path>`, or "
            + "remove both files to found a sovereign cluster deliberately. "
            + "(Nothing is deleted for you: see .claude/rules -- a datastore or credential wipe "
            + "we initiated would be confiscation.)";
        }
      ];
    }

    (lib.mkIf joining {
      # mkOverride 50 beats k3s-server.nix's mkDefault (1000) while still losing
      # to an explicit operator mkForce — the same priority choice, for the same
      # reason, as injected-hostname.nix and injected-join-server.nix.
      services.k3s.clusterInit = lib.mkOverride 50 false;
      services.k3s.serverAddr = lib.mkOverride 50 injectedUrl;
      services.k3s.tokenFile = lib.mkOverride 50 tokenFile;
    })
  ];
}
